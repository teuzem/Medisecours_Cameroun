# ── Stage 1 : Build ──────────────────────────────────────────────────────────
FROM php:8.3-fpm-alpine AS builder

# Extensions PHP requises
RUN apk add --no-cache \
    git \
    unzip \
    libpng-dev \
    libjpeg-turbo-dev \
    libwebp-dev \
    zlib-dev \
    libzip-dev \
    icu-dev \
    oniguruma-dev \
    openssl-dev \
    postgresql-dev \
    freetype-dev

RUN docker-php-ext-configure gd \
        --with-freetype \
        --with-jpeg \
        --with-webp \
    && docker-php-ext-install \
        pdo \
        pdo_pgsql \
        pgsql \
        zip \
        intl \
        mbstring \
        gd \
        fileinfo \
        opcache \
        bcmath

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Dépendances Composer (optimisé cache)
COPY composer.json composer.lock symfony.lock ./
RUN composer install \
    --no-dev \
    --no-scripts \
    --no-autoloader \
    --prefer-dist \
    --optimize-autoloader

COPY . .

# Symfony Runtime requires a readable base .env file. Production values are
# injected by Render and take precedence over these non-secret defaults.
RUN printf '%s\n' \
        'APP_ENV=prod' \
        'APP_DEBUG=0' \
    > .env

RUN composer dump-autoload --optimize --no-dev

# ── Stage 2 : Production ─────────────────────────────────────────────────────
FROM php:8.3-fpm-alpine AS production

RUN apk add --no-cache \
    nginx \
    supervisor \
    libpng \
    libjpeg-turbo \
    libwebp \
    libzip \
    icu-libs \
    oniguruma \
    openssl \
    postgresql-libs \
    freetype \
    curl

COPY --from=builder /usr/local/lib/php/extensions/ /usr/local/lib/php/extensions/
COPY --from=builder /usr/local/etc/php/conf.d/ /usr/local/etc/php/conf.d/

# Config PHP optimisée production
COPY docker/php/php.ini /usr/local/etc/php/php.ini
COPY docker/nginx/default.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf

WORKDIR /app

# Copier le build depuis Stage 1
COPY --from=builder /app /app

# Permissions
RUN mkdir -p var/cache var/log var/uploads/media \
    && chown -R www-data:www-data var/ \
    && chmod -R 775 var/

# Script de démarrage
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=5 \
  CMD curl -fsS http://127.0.0.1:10000/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
