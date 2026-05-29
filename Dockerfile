# Stage 1: Install PHP Dependencies
FROM composer:2.7 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --ignore-platform-reqs --no-scripts
COPY . .

# Stage 2: Build Frontend Assets (Vite + React)
FROM php:8.4-cli-alpine AS frontend
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy the entire app source so Wayfinder and npm can find package.json and artisan
COPY . .

# Copy the vendor directory from Stage 1 so Artisan can boot
COPY --from=vendor /app/vendor /app/vendor

RUN npm ci
RUN npm run build 


# Stage 3: Final Production Image
FROM php:8.4-fpm-alpine

RUN apk add --no-cache \
    postgresql-dev \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    libwebp-dev \
    gmp-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) \
        gd \
        pdo_pgsql \
        gmp \
        bcmath

WORKDIR /var/www/html

# Copy application files and build assets from previous stages
COPY --from=vendor /app /var/www/html
COPY --from=frontend /app/public/build /var/www/html/public/build

# Ensure correct permissions for Laravel's storage and cache
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 775 /var/www/html/storage \
    && chmod -R 775 /var/www/html/bootstrap/cache

EXPOSE 9000
CMD ["php-fpm"]