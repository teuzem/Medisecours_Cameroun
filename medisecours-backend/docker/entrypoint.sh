#!/bin/sh
set -e

echo "==> MediSecours backend starting..."

# Render injects PORT. Keep nginx aligned with it while preserving a usable
# local default.
APP_PORT="${PORT:-10000}"
sed -i "s/listen 10000;/listen ${APP_PORT};/" /etc/nginx/http.d/default.conf

# Production JWT keys must remain stable across deployments and be shared
# with the WebSocket service.
mkdir -p config/jwt
if [ -n "${JWT_PRIVATE_KEY_BASE64:-}" ] && [ -n "${JWT_PUBLIC_KEY_BASE64:-}" ]; then
    printf '%s' "$JWT_PRIVATE_KEY_BASE64" | base64 -d > config/jwt/private.pem
    printf '%s' "$JWT_PUBLIC_KEY_BASE64" | base64 -d > config/jwt/public.pem
elif [ ! -s config/jwt/private.pem ] || [ ! -s config/jwt/public.pem ]; then
    echo "ERROR: JWT_PRIVATE_KEY_BASE64 and JWT_PUBLIC_KEY_BASE64 are required."
    exit 1
fi

# Strict validation BEFORE boot: a bad key or passphrase currently produces a
# silent runtime 500 on login (JWTEncodeFailureException). Reject it here with
# a clear message instead.
JWT_PASSPHRASE="${JWT_PASSPHRASE:-}"
if ! openssl pkey -in config/jwt/private.pem -passin "pass:${JWT_PASSPHRASE}" -noout 2>/dev/null; then
    echo "ERROR: JWT private key is invalid or JWT_PASSPHRASE does not match it."
    echo "       Check that JWT_PRIVATE_KEY_BASE64 (decoded) is a real private.pem and"
    echo "       that JWT_PASSPHRASE equals the passphrase used to generate the key."
    exit 1
fi
if ! openssl pkey -pubin -in config/jwt/public.pem -noout 2>/dev/null; then
    echo "ERROR: JWT public key is invalid. Check JWT_PUBLIC_KEY_BASE64 (decoded)."
    exit 1
fi
private_fp="$(openssl pkey -in config/jwt/private.pem -passin "pass:${JWT_PASSPHRASE}" -pubout 2>/dev/null | openssl pkey -pubin -outform DER 2>/dev/null | openssl sha1 -r 2>/dev/null | cut -d' ' -f1)"
public_fp="$(openssl pkey -pubin -in config/jwt/public.pem -outform DER 2>/dev/null | openssl sha1 -r 2>/dev/null | cut -d' ' -f1)"
if [ -z "$private_fp" ] || [ "$private_fp" != "$public_fp" ]; then
    echo "ERROR: JWT public key does not match the private key."
    echo "       JWT_PUBLIC_KEY_BASE64 must be the public.pem paired with JWT_PRIVATE_KEY_BASE64."
    exit 1
fi
echo "==> JWT keys validated (private + public match, passphrase OK)."

# PHP-FPM signs access tokens as www-data. Keep the private key restricted to
# that runtime user instead of leaving it readable only by root.
chown www-data:www-data config/jwt/private.pem config/jwt/public.pem
chmod 600 config/jwt/private.pem
chmod 644 config/jwt/public.pem

# /app/var/uploads may be backed by a Render persistent disk.
mkdir -p var/cache var/log var/uploads/media
chown -R www-data:www-data var/

php bin/console cache:clear --env=prod --no-debug
php bin/console cache:warmup --env=prod --no-debug

# Cache generation runs as root in the container. Restore runtime ownership
# before PHP-FPM starts so VichUploader can update its metadata cache.
mkdir -p var/cache/prod/vich_uploader var/log var/uploads/media
chown -R www-data:www-data var/cache var/log var/uploads
chmod -R 775 var/cache var/log var/uploads

# Two supported provisioning paths:
#   A) Empty database  -> migrations build the schema automatically (default).
#   B) database/schema.sql + seed.sql imported manually (Coolify Postgres,
#      Neon, Supabase…) -> set SKIP_MIGRATIONS=1 so this entrypoint does not
#      try to re-create tables that already exist.
echo "==> Checking database provisioning..."
if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
    echo "==> Running database migrations..."
    migration_attempt=1
    until php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration --env=prod; do
        if [ "$migration_attempt" -ge 5 ]; then
            if [ "${STRICT_DATABASE_BOOTSTRAP:-0}" = "1" ]; then
                echo "ERROR: Database migrations failed after ${migration_attempt} attempts and STRICT_DATABASE_BOOTSTRAP=1."
                exit 1
            fi
            echo "WARNING: Database migrations failed after ${migration_attempt} attempts; starting the API anyway."
            echo "         Run doctrine:migrations:migrate manually after fixing the database connection/schema."
            break
        fi

        migration_attempt=$((migration_attempt + 1))
        echo "Database unavailable, retrying in 5 seconds (${migration_attempt}/5)..."
        sleep 5
    done
else
    echo "==> SKIP_MIGRATIONS=1 => schema assumed to already exist (imported via database/schema.sql)."
fi

# Legacy option (off by default) : seed des 232 mock data de
# data/centres_sante.json (idempotent — rows existantes ignorées). Deprecated :
# privilégier les données réelles Google Places via SYNC_STRUCTURES_INTERVAL_MIN
# ou app:carte:sync-structures.
if [ "${LOAD_CENTRES:-0}" = "1" ]; then
    echo "==> Loading baseline health centres (data/centres_sante.json)..."
    if ! php bin/console app:load-centres --no-interaction; then
        echo "ERROR: app:load-centres failed."
        exit 1
    fi
fi

# One-off admin bootstrap: if CREATE_ADMIN_EMAIL / CREATE_ADMIN_PASSWORD are
# set, create or update the admin account (idempotent, CLI-created emails are
# marked verified). Unset these env vars in Render once done.
if [ -n "${CREATE_ADMIN_EMAIL:-}" ] && [ -n "${CREATE_ADMIN_PASSWORD:-}" ]; then
    echo "==> Creating/updating admin account..."
    php bin/console app:create-admin "${CREATE_ADMIN_EMAIL}" "${CREATE_ADMIN_PASSWORD}" --no-interaction || {
        echo "ERROR: app:create-admin failed."
        exit 1
    }
fi

echo "==> Starting PHP-FPM and Nginx..."
"$@" &
server_pid=$!
sync_pid=""

# Real-time structures sync (Google Places) : première passe immédiate puis
# toutes les N minutes. Désactivé tant que SYNC_STRUCTURES_INTERVAL_MIN=0.
SYNC_INTERVAL="${SYNC_STRUCTURES_INTERVAL_MIN:-0}"
case "$SYNC_INTERVAL" in
    ''|*[!0-9]*) SYNC_INTERVAL=0 ;;
esac
if [ "$SYNC_INTERVAL" -gt 0 ]; then
    SYNC_CAP="${SYNC_STRUCTURES_CAP:-400}"
    echo "==> Structures sync (Google Places) every ${SYNC_INTERVAL} min (cap ${SYNC_CAP})."
    (
        sync_structures() {
            php bin/console app:carte:sync-structures --cap="${SYNC_CAP}" --no-interaction >/dev/null 2>&1 || true
        }
        sync_structures
        while true; do
            sleep "$((SYNC_INTERVAL * 60))"
            sync_structures
        done
    ) &
    sync_pid=$!
fi

stop_server() {
    kill -TERM "$server_pid" 2>/dev/null || true
    if [ -n "$sync_pid" ]; then
        kill -TERM "$sync_pid" 2>/dev/null || true
    fi
    wait "$server_pid" 2>/dev/null || true
}

trap stop_server INT TERM

# Make the HTTP port available to Render before the potentially long initial
# catalogue import. The import remains blocking for this entrypoint: if it
# fails, the web server is stopped and the deployment fails.
sleep 1
if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "ERROR: Web services stopped before becoming ready."
    wait "$server_pid"
    exit 1
fi

if [ "${BOOTSTRAP_REFERENCE_DATA:-1}" = "1" ]; then
    echo "==> Loading versioned medical reference data..."
    if ! php bin/console app:bootstrap-reference-data \
        --no-interaction \
        --catalog-version="${REFERENCE_DATA_VERSION:-2026-08-07.1}"; then
        if [ "${STRICT_REFERENCE_DATA_BOOTSTRAP:-0}" = "1" ]; then
            echo "ERROR: Reference data bootstrap failed and STRICT_REFERENCE_DATA_BOOTSTRAP=1."
            stop_server
            exit 1
        fi
        echo "WARNING: Reference data bootstrap failed; keeping the API online."
        echo "         Run app:bootstrap-reference-data manually after fixing the catalogue/database issue."
    fi
else
    echo "==> Reference data bootstrap disabled."
fi

echo "==> Ready. Reference data is available."
wait "$server_pid"
