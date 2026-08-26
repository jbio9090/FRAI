#!/bin/sh

# Exit immediately if any command fails
set -e

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
