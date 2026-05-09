# ==========================================
# Stage 1: Build Laravel Application
# ==========================================
FROM composer:2.7 AS builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    git \
    unzip \
    libpq-dev

WORKDIR /app

# Copy everything first
COPY . .

# Install PHP dependencies
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --ignore-platform-reqs \
    --no-scripts

# Run Laravel package discovery
RUN php artisan package:discover --ansi

# Install frontend dependencies
RUN npm ci

# Build Vite assets
RUN npm run build

# ==========================================
# Stage 2: Production Runtime Image
# ==========================================
FROM php:8.4-fpm-alpine

# Install PostgreSQL extension
RUN apk add --no-cache \
    postgresql-dev \
    libpq \
    && docker-php-ext-install pdo_pgsql

WORKDIR /var/www/html

# Copy built application
COPY --from=builder /app /var/www/html

# Set permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 775 /var/www/html/storage \
    && chmod -R 775 /var/www/html/bootstrap/cache

EXPOSE 9000

CMD ["php-fpm"]