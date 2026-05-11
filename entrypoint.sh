#!/bin/sh

# Exit immediately if any command fails
set -e

echo "🚀 Starting deployment tasks..."

# ------------------------------------------------------------------
# 0. Fail fast if critical env vars are missing
#    (catches missing Render env vars before anything else runs)
# ------------------------------------------------------------------
echo "🔍 Validating environment..."
: "${APP_KEY:?❌ APP_KEY is not set. Aborting.}"
: "${APP_URL:?❌ APP_URL is not set. Aborting.}"
: "${DB_HOST:?❌ DB_HOST is not set. Aborting.}"
echo "✅ Environment looks good."

# ------------------------------------------------------------------
# 1. Ensure storage directories exist at runtime
#    (belt-and-suspenders in case the image build missed them)
# ------------------------------------------------------------------
mkdir -p \
    /var/www/html/storage/logs \
    /var/www/html/storage/framework/cache/data \
    /var/www/html/storage/framework/sessions \
    /var/www/html/storage/framework/views \
    /var/www/html/storage/app/public
chown -R www-data:www-data /var/www/html/storage

# ------------------------------------------------------------------
# 2. Wait for the database to be reachable
#    (Render's free Postgres can take a few seconds on cold start)
# ------------------------------------------------------------------
echo "⏳ Waiting for database connection..."
until php /var/www/html/artisan db:show --json > /dev/null 2>&1; do
    echo "   DB not ready yet — retrying in 3 s..."
    sleep 3
done
echo "✅ Database is reachable."
#!/bin/sh

# Exit immediately if any command fails
set -e

echo "🚀 Starting deployment tasks..."

# ------------------------------------------------------------------
# 0. Fail fast if critical env vars are missing
#    (catches missing Render env vars before anything else runs)
# ------------------------------------------------------------------
echo "🔍 Validating environment..."
: "${APP_KEY:?❌ APP_KEY is not set. Aborting.}"
: "${APP_URL:?❌ APP_URL is not set. Aborting.}"
: "${DB_HOST:?❌ DB_HOST is not set. Aborting.}"
echo "✅ Environment looks good."

# ------------------------------------------------------------------
# 1. Ensure storage directories exist at runtime
#    (belt-and-suspenders in case the image build missed them)
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
# 2. Wait for the database to be reachable
#    (Render's free Postgres can take a few seconds on cold start)
# ------------------------------------------------------------------
echo "⏳ Waiting for database connection..."
until php /var/www/html/artisan db:show --json > /dev/null 2>&1; do
    echo "   DB not ready yet — retrying in 3 s..."
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
#    Running as www-data ensures PHP-FPM can read the cache files,
#    and guarantees env vars are baked in under the correct user.
#    (clear MUST come before cache — otherwise old values persist)
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
# 5. Verify critical config values were baked in correctly
#    (visible in Render deploy logs — remove once confirmed working)
# ------------------------------------------------------------------
echo "🔎 Verifying cached config..."
su -s /bin/sh www-data -c "php /var/www/html/artisan tinker --execute=\"echo 'APP_NAME: ' . config('app.name');\""
su -s /bin/sh www-data -c "php /var/www/html/artisan tinker --execute=\"echo config('webpush.vapid.public_key') ? '✅ VAPID key loaded' : '❌ VAPID key missing';\""

# ------------------------------------------------------------------
# 6. Hand off to Supervisor
#    (manages Nginx, PHP-FPM, and the Laravel queue worker)
# ------------------------------------------------------------------
echo "🎛️  Starting Supervisor (nginx + php-fpm + laravel-worker)..."
exec /usr/bin/supervisord -c /etc/supervisord.conf
# ------------------------------------------------------------------
# 3. Run migrations
# ------------------------------------------------------------------
echo "🗄️  Running migrations..."
php /var/www/html/artisan migrate --force
php /var/www/html/artisan db:seed --force
echo "✅ Migrations complete."

# ------------------------------------------------------------------
# 4. Clear stale caches then rebuild from current env vars
#    (clear MUST come before cache — otherwise old values persist)
# ------------------------------------------------------------------
echo "🧹 Clearing stale caches..."
php /var/www/html/artisan config:clear
php /var/www/html/artisan route:clear
php /var/www/html/artisan view:clear

echo "⚙️  Rebuilding caches..."
php /var/www/html/artisan config:cache
php /var/www/html/artisan route:cache
php /var/www/html/artisan view:cache
echo "✅ Caches rebuilt."

# ------------------------------------------------------------------
# 5. Hand off to Supervisor
#    (manages Nginx, PHP-FPM, and the Laravel queue worker)
# ------------------------------------------------------------------
echo "🎛️  Starting Supervisor (nginx + php-fpm + laravel-worker)..."
exec /usr/bin/supervisord -c /etc/supervisord.conf