#!/bin/sh

# Exit immediately if any command fails
set -e

# ------------------------------------------------------------------
# 0a. Boot banner (diagnostics only — never aborts the deploy)
# ------------------------------------------------------------------
# Makes the running PHP patch visible so a stale base image is obvious
# in Render logs. Every probe degrades to "unknown" so `set -e` never
# trips on a diagnostic. Secrets are never printed: APP_KEY is only
# reported as set/missing, and the DB host is masked.
mask_db_host() {
    case "$1" in
        "")  echo "unset" ;;
        *.*) echo "*****.${1#*.}" ;;
        *)   echo "*****" ;;
    esac
}

log_banner() {
    php_ver=$(php -r 'echo PHP_VERSION;' 2>/dev/null || echo unknown)
    php_meta=$(php -r 'echo PHP_SAPI, " ", (PHP_INT_SIZE * 8), "-bit";' 2>/dev/null || echo unknown)
    fpm_ver=$(php-fpm -v 2>/dev/null | sed -n '1s/^PHP \([^ ]*\).*/\1/p' || echo unknown)
    laravel_ver=$(php /var/www/html/artisan --version 2>/dev/null | sed -n 's/^Laravel Framework //p' || echo unknown)
    node_ver=$(sed -n 's/^node=//p' /var/www/html/.build-info 2>/dev/null || true)
    built_ts=$(sed -n 's/^built=//p' /var/www/html/.build-info 2>/dev/null || true)
    commit=$(echo "${RENDER_GIT_COMMIT:-unknown}" | cut -c1-7)
    app_key_state=$(if [ -n "${APP_KEY:-}" ]; then echo set; else echo missing; fi)

    exts=""
    for ext in pdo_pgsql gd gmp bcmath; do
        if php -r "exit(extension_loaded('$ext') ? 0 : 1);" 2>/dev/null; then
            exts="$exts $ext"
        else
            exts="$exts $ext(missing)"
        fi
    done
    if php -m 2>/dev/null | grep -qi 'Zend OPcache'; then
        opc="enabled"
    else
        opc="absent"
    fi

    echo "🚀 FRAI boot — ${built_ts:-unknown}"
    echo "   PHP        $php_ver ($php_meta)"
    echo "   PHP-FPM    ${fpm_ver:-unknown}"
    echo "   Laravel    ${laravel_ver:-unknown}"
    echo "   App        env=${APP_ENV:-unset} debug=${APP_DEBUG:-unset} url=${APP_URL:-unset} key=$app_key_state"
    echo "   DB         $(mask_db_host "${DB_HOST:-}")"
    echo "   Ext       ${exts# } opcache=$opc"
    echo "   Limits     $(php -r 'echo "memory=", ini_get("memory_limit"), " upload=", ini_get("upload_max_filesize"), " post=", ini_get("post_max_size");' 2>/dev/null || echo unknown)"
    echo "   Node       ${node_ver:-unknown} (build-time only)"
    echo "   Commit     $commit"
}
log_banner || true

echo "🚀 Starting deployment tasks..."

# ------------------------------------------------------------------
# 0. Fail fast if critical env vars are missing
# ------------------------------------------------------------------
echo "🔍 Validating environment..."
: "${APP_KEY:?❌ APP_KEY is not set. Aborting.}"
: "${APP_URL:?❌ APP_URL is not set. Aborting.}"
: "${DB_HOST:?❌ DB_HOST is not set. Aborting.}"
echo "✅ Environment looks good."

# ------------------------------------------------------------------
# 1. Ensure storage directories exist at runtime
# ------------------------------------------------------------------
mkdir -p \
    /var/www/html/storage/logs \
    /var/www/html/storage/framework/cache/data \
    /var/www/html/storage/framework/sessions \
    /var/www/html/storage/framework/views \
    /var/www/html/storage/app/public
chown -R www-data:www-data /var/www/html/storage
chown -R www-data:www-data /var/www/html/bootstrap/cache

# ------------------------------------------------------------------
# 1b. Stage the Firebase service-account key (FCM server sends)
# ------------------------------------------------------------------
# Render mounts Secret Files at /etc/secrets (group-readable by gid 1000,
# and www-data is in group `runner` (gid 1000) per Dockerfile.render).
# Copy it into storage/app (gitignored, www-data-owned) BEFORE config:cache
# so FIREBASE_CREDENTIALS=storage/app/firebase-auth.json resolves. Warns but
# never aborts: web routes work without FCM, only pushes fail.
if [ -f /etc/secrets/firebase-auth.json ]; then
    echo "📦 Staging Firebase service-account key..."
    cp /etc/secrets/firebase-auth.json /var/www/html/storage/app/firebase-auth.json
    chown www-data:www-data /var/www/html/storage/app/firebase-auth.json
    chmod 600 /var/www/html/storage/app/firebase-auth.json
fi

if [ -n "$FIREBASE_CREDENTIALS_JSON" ] || [ -n "$FIREBASE_CREDENTIALS_BASE64" ]; then
    echo "✅ Firebase credentials supplied via env (JSON)."
elif [ -n "$FIREBASE_CREDENTIALS" ]; then
    case "$FIREBASE_CREDENTIALS" in
        '{'*)
            echo "✅ Firebase credentials supplied via env (JSON)."
            ;;
        /*)
            CRED_PATH="$FIREBASE_CREDENTIALS"
            ;;
        *)
            CRED_PATH="/var/www/html/$FIREBASE_CREDENTIALS"
            ;;
    esac
    if [ -n "$CRED_PATH" ]; then
        if su -s /bin/sh www-data -c "test -r \"$CRED_PATH\""; then
            echo "✅ Firebase credentials file is readable."
        else
            echo "⚠️  FIREBASE_CREDENTIALS=$FIREBASE_CREDENTIALS is not readable by www-data — web push sends will fail."
        fi
    fi
else
    echo "⚠️  FIREBASE_CREDENTIALS is not set — web push sends will fail."
fi

# ------------------------------------------------------------------
# 2. Wait for the database to be reachable (Max 5 retries)
# ------------------------------------------------------------------
echo "⏳ Testing database connection..."
RETRY_COUNT=0
MAX_RETRIES=5

until php /var/www/html/artisan db:show --json > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
        echo "❌ Database connection failed after $MAX_RETRIES attempts."
        echo "🔍 Detailing connection error below:"
        # Run the command without silencing output to show the exact PHP/PDO error
        php /var/www/html/artisan db:show
        exit 1
    fi
    echo "   DB not ready yet — retrying in 3 s (Attempt $RETRY_COUNT/$MAX_RETRIES)..."
    sleep 3
done
echo "✅ Database is reachable."

# ------------------------------------------------------------------
# 3. Run migrations and seeders
# ------------------------------------------------------------------
echo "🗄️  Running migrations..."
php /var/www/html/artisan migrate --force
php /var/www/html/artisan db:seed --force
echo "✅ Migrations and seeders complete."

# ------------------------------------------------------------------
# 4. Clear stale caches then rebuild as www-data
# ------------------------------------------------------------------
echo "🧹 Clearing stale caches..."
su -s /bin/sh www-data -c "php /var/www/html/artisan config:clear"
su -s /bin/sh www-data -c "php /var/www/html/artisan route:clear"
su -s /bin/sh www-data -c "php /var/www/html/artisan view:clear"

echo "⚙️  Rebuilding caches..."
su -s /bin/sh www-data -c "php /var/www/html/artisan config:cache"
su -s /bin/sh www-data -c "php /var/www/html/artisan route:cache"
su -s /bin/sh www-data -c "php /var/www/html/artisan view:cache"
echo "✅ Caches rebuilt."

# ------------------------------------------------------------------
# 5. Hand off to Supervisor
# ------------------------------------------------------------------
echo "🎛️  Starting Supervisor (nginx + php-fpm + laravel-worker)..."
exec /usr/bin/supervisord -c /etc/supervisord.conf
