# ==========================================
# Stage 1: Install PHP Dependencies
# ==========================================
FROM composer:2.7 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
# Added --no-scripts so it doesn't look for artisan before the code is copied
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --ignore-platform-reqs --no-scripts
COPY . .

# ==========================================
# Stage 2: Build Frontend Assets (Vite + React)
# ==========================================
# We use a PHP CLI image so Wayfinder can run `php artisan` during the Vite build
FROM php:8.4-cli-alpine AS frontend

# Install Node.js and npm into the PHP container
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy the entire app source so Wayfinder and npm can find package.json and artisan
COPY . .

# Copy the vendor directory from Stage 1 so Artisan can boot
COPY --from=vendor /app/vendor /app/vendor

# Install node modules and run the build
RUN npm ci
RUN npm run build 

# ==========================================
# Stage 3: Final Production Image
# ==========================================
FROM php:8.4-fpm-alpine

# Install system dependencies for GD and Postgres
RUN apk add --no-cache \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    libwebp-dev \
    postgresql-dev

# Configure and install PHP extensions
RUN docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) gd pdo_pgsql

WORKDIR /var/www/html

# Copy the PHP application and vendor directory from Stage 1
COPY --from=vendor /app /var/www/html

# Copy the compiled Vite frontend assets from Stage 2
COPY --from=frontend /app/public/build /var/www/html/public/build

# Set correct permissions for Laravel
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 775 /var/www/html/storage \
    && chmod -R 775 /var/www/html/bootstrap/cache

EXPOSE 9000
CMD ["php-fpm"]