#!/bin/sh

# Exit immediately if any command fails
set -e

echo "🚀 Starting deployment tasks..."

tail -f /var/www/html/storage/logs/laravel.log

echo "🔍 Validating environment..."
: "${APP_KEY:?❌ APP_KEY is not set. Aborting.}"
: "${APP_URL:?❌ APP_URL is not set. Aborting.}"
: "${DB_HOST:?❌ DB_HOST is not set. Aborting.}"
echo "✅ Environment looks good."

# ------------------------------------------------------------------
# 1. Wait briefly for the database to be reachable (optional safety
#    net — Render's free Postgres sometimes takes a few seconds to
#    accept connections after a cold start).
# ------------------------------------------------------------------
echo "⏳ Waiting for database connection..."
until php /var/www/html/artisan db:show --json > /dev/null 2>&1; do
    echo "   DB not ready yet — retrying in 3 s..."
    sleep 3
done
echo "✅ Database is reachable."

# ------------------------------------------------------------------
# 2. Run migrations (--force is required outside local environments)
# ------------------------------------------------------------------
echo "🗄️  Running migrations..."
php /var/www/html/artisan migrate --force
echo "✅ Migrations complete."

# ------------------------------------------------------------------
# 3. Clear and rebuild caches so the fresh schema is picked up
# ------------------------------------------------------------------
echo "⚙️  Caching config, routes, and views..."
echo "🧹 Clearing stale caches..."
php /var/www/html/artisan route:clear
php /var/www/html/artisan config:clear
php /var/www/html/artisan view:clear

php /var/www/html/artisan config:cache
php /var/www/html/artisan route:cache
php /var/www/html/artisan view:cache
echo "✅ Caches rebuilt."

# ------------------------------------------------------------------
# 4. Hand off to Supervisor — it manages Nginx, PHP-FPM, and the
#    queue worker for the lifetime of the container.
# ------------------------------------------------------------------
echo "🎛️  Starting Supervisor (nginx + php-fpm + laravel-worker)..."
exec /usr/bin/supervisord -c /etc/supervisord.conf