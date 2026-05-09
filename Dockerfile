# ==========================================
# Stage 1: Build Frontend Assets (Vite + React)
# ==========================================
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Compiles Tailwind, React, and Inertia down to static files in public/build
RUN npm run build 

# ==========================================
# Stage 2: Install PHP Dependencies
# ==========================================
FROM composer:2.7 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
# Install only production dependencies
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --ignore-platform-reqs \
    --no-scripts
COPY . .
RUN php artisan package:discover --ansi

# ==========================================
# Stage 3: Final Production Image (Tiny & Fast)
# ==========================================
# Updated to PHP 8.4
FROM php:8.4-fpm-alpine

# Install Postgres PDO driver required for pgvector/pgsql
RUN apk add --no-cache postgresql-dev \
    && docker-php-ext-install pdo_pgsql

WORKDIR /var/www/html

# Copy the PHP application and vendor directory from Stage 2
COPY --from=vendor /app /var/www/html

# Copy the compiled Vite frontend assets from Stage 1
COPY --from=frontend /app/public/build /var/www/html/public/build

# Set correct permissions for Laravel
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 775 /var/www/html/storage \
    && chmod -R 775 /var/www/html/bootstrap/cache

EXPOSE 9000
CMD ["php-fpm"]