#!/bin/sh
set -e

echo "==> MediSecours backend starting..."

# Render injects PORT. Keep nginx aligned with it while preserving a usable
# local default.
APP_PORT="${PORT:-10000}"
sed -i "s/listen 10000;/listen ${APP_PORT};/" /etc/nginx/http.d/default.conf

# Boot configuration (non-secret) : visible dans `docker logs` pour trancher
# immédiatement entre « variable manquante » et « base injoignable ».
# NOTE : les variables STRICT_* sont désormais purement informatives — aucun
# `exit 1` ne bloque plus le boot. Sur Coolify il n'y a pas de release
# précédente à préserver (« rolling update is not supported ») : faire échouer
# le boot impose une boucle de restart qui ne sert RIEN (ni API, ni health,
# ni logs HTTP). Un boot dégradé + /api/health « degraded » vaut toujours
# mieux qu'un conteneur qui redémarre en boucle.
echo "==> Boot configuration (non-secret):"
echo "    PORT=${APP_PORT} SKIP_MIGRATIONS=${SKIP_MIGRATIONS:-0} STRICT_DATABASE_BOOTSTRAP=${STRICT_DATABASE_BOOTSTRAP:-0}(advisory)"
echo "    BOOTSTRAP_REFERENCE_DATA=${BOOTSTRAP_REFERENCE_DATA:-1} STRICT_REFERENCE_DATA_BOOTSTRAP=${STRICT_REFERENCE_DATA_BOOTSTRAP:-0}(advisory) SEED_CARTE_TEST=${SEED_CARTE_TEST:-0} LOAD_CENTRES=${LOAD_CENTRES:-0} STRICT_JWT_BOOTSTRAP=${STRICT_JWT_BOOTSTRAP:-0}(advisory)"
db_host=$(printf '%s' "${DATABASE_URL:-}" | sed -E 's#^[a-z+]+://([^@/?#]+@)?([^/?#:]+).*#\2#')
echo "    DATABASE_URL host: ${db_host:-<unset>} (mot de passe jamais journalisé)"

# Production JWT keys must remain stable across deployments and be shared
# with the WebSocket service.
mkdir -p config/jwt
JWT_READY=1
if [ -n "${JWT_PRIVATE_KEY_BASE64:-}" ] && [ -n "${JWT_PUBLIC_KEY_BASE64:-}" ]; then
    printf '%s' "$JWT_PRIVATE_KEY_BASE64" | base64 -d > config/jwt/private.pem
    printf '%s' "$JWT_PUBLIC_KEY_BASE64" | base64 -d > config/jwt/public.pem
elif [ ! -s config/jwt/private.pem ] || [ ! -s config/jwt/public.pem ]; then
    JWT_READY=0
    echo "WARNING: JWT key files are not available in the container runtime."
fi

# Strict validation BEFORE boot: a bad key or passphrase currently produces a
# silent runtime 500 on login (JWTEncodeFailureException). Reject it here with
# a clear message instead.
JWT_PASSPHRASE="${JWT_PASSPHRASE:-}"
if [ "$JWT_READY" = "1" ]; then
    if ! openssl pkey -in config/jwt/private.pem -passin "pass:${JWT_PASSPHRASE}" -noout 2>/dev/null; then
        JWT_READY=0
        echo "WARNING: JWT private key is invalid or JWT_PASSPHRASE does not match it."
    fi
    if ! openssl pkey -pubin -in config/jwt/public.pem -noout 2>/dev/null; then
        JWT_READY=0
        echo "WARNING: JWT public key is invalid."
    fi
    private_fp="$(openssl pkey -in config/jwt/private.pem -passin "pass:${JWT_PASSPHRASE}" -pubout 2>/dev/null | openssl pkey -pubin -outform DER 2>/dev/null | openssl sha1 -r 2>/dev/null | cut -d' ' -f1 || true)"
    public_fp="$(openssl pkey -pubin -in config/jwt/public.pem -outform DER 2>/dev/null | openssl sha1 -r 2>/dev/null | cut -d' ' -f1 || true)"
    if [ -z "$private_fp" ] || [ "$private_fp" != "$public_fp" ]; then
        JWT_READY=0
        echo "WARNING: JWT public key does not match the private key."
    fi
fi
if [ "$JWT_READY" = "1" ]; then
    echo "==> JWT keys validated (private + public match, passphrase OK)."
else
    # STRICT_JWT_BOOTSTRAP est consultatif : sans clés, seul le login 500 ;
    # tuer le conteneur (restart loop) casserait aussi tout le reste.
    echo "WARNING: JWT validation failed; keeping the HTTP process alive for diagnostics."
fi

# PHP-FPM signs access tokens as www-data. Keep the private key restricted to
# that runtime user instead of leaving it readable only by root.
if [ -f config/jwt/private.pem ] && [ -f config/jwt/public.pem ]; then
    chown www-data:www-data config/jwt/private.pem config/jwt/public.pem
    chmod 600 config/jwt/private.pem
    chmod 644 config/jwt/public.pem
fi

# /app/var/uploads may be backed by a Render persistent disk.
mkdir -p var/cache var/log var/uploads/media
chown -R www-data:www-data var/

echo "==> Building Symfony cache..."
if ! php bin/console cache:clear --env=prod --no-debug; then
    echo "ERROR: cache:clear failed (see above); continuing — Symfony prod rebuilds a cold cache on demand."
fi
if ! php bin/console cache:warmup --env=prod --no-debug; then
    echo "ERROR: cache:warmup failed (see above); continuing — Symfony prod rebuilds a cold cache on demand."
fi

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
    # Pre-migration repair (idempotent DDL replay, app:repair-schema) :
    # rebuilds every object this release requires whatever state
    # migration_versions is in (marked « migrated » without objects,
    # partial restore, interrupted deploy — Oct 12 spiral). Runs BEFORE
    # doctrine:migrations:migrate so a stuck migration chain can never
    # leave the schema hollow again. A non-zero exit is only a WARNING:
    # booting must never be blocked (the tolerant health check keeps
    # instances routable while the database itself is reachable).
    echo "==> Repairing schema (idempotent replay, never blocks boot)..."
    if ! php bin/console app:repair-schema --no-interaction --env=prod; then
        echo "WARNING: app:repair-schema reported errors; continuing with migrations."
    fi
    echo "==> Running database migrations..."
    migration_attempt=1
    until php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration --env=prod; do
        if [ "$migration_attempt" -ge 5 ]; then
            echo "ERROR: Database migrations failed after ${migration_attempt} attempts; starting the API anyway (never restart-loop on migrations)."
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

# Post-migration schema probe (diagnostic uniquement, jamais bloquant) :
# chaque objet manquant est journalisé en ERROR pour cibler la réparation,
# mais le boot continue dans tous les cas — voir la note STRICT_* en tête
# de fichier. /api/health expose les manques comme « degraded » (200) tant
# que la base répond, 503 uniquement si elle est injoignable.
#
# The probe MUST cover the same objects as HealthController::REQUIRED_SCHEMA
# (7 objects) so the health body and the boot log describe the same gaps.
if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
    echo "==> Verifying required schema objects..."
    schema_probe_failed=0
    probe_schema() {
        label="$1"
        sql="$2"
        if ! php bin/console doctrine:query:sql "$sql" --env=prod; then
            echo "ERROR: required schema is missing (${label})."
            schema_probe_failed=1
        fi
    }
    probe_schema 'user.type_personnel' \
        "SELECT 1 FROM \"user\" WHERE type_personnel IS NULL LIMIT 0"
    probe_schema 'signature_numerique' \
        "SELECT 1 FROM signature_numerique LIMIT 0"
    probe_schema 'centre_de_sante.dirigeant_id' \
        "SELECT 1 FROM centre_de_sante WHERE dirigeant_id IS NULL LIMIT 0"
    probe_schema 'etablissement_equipe' \
        "SELECT 1 FROM etablissement_equipe LIMIT 0"
    probe_schema 'dossier_medical' \
        "SELECT 1 FROM dossier_medical LIMIT 0"
    probe_schema 'soin_administre' \
        "SELECT 1 FROM soin_administre LIMIT 0"
    probe_schema 'ordonnance_pharmacie' \
        "SELECT 1 FROM ordonnance_pharmacie LIMIT 0"
    if [ "$schema_probe_failed" = "1" ]; then
        echo "       WARNING: required schema objects are missing (see ERROR lines above) — booting anyway, /api/health reports them as degraded."
    fi
    echo "==> Schema probe done."
fi

# Legacy option (off by default) : seed des 232 mock data de
# data/centres_sante.json (idempotent — rows existantes ignorées). Deprecated :
# privilégier les données réelles Google Places via SYNC_STRUCTURES_INTERVAL_MIN
# ou app:carte:sync-structures.
if [ "${LOAD_CENTRES:-0}" = "1" ]; then
    echo "==> Loading baseline health centres (data/centres_sante.json)..."
    if ! php bin/console app:load-centres --no-interaction; then
        echo "WARNING: app:load-centres failed; keeping the API online."
    fi
fi

# One-off admin bootstrap: if CREATE_ADMIN_EMAIL / CREATE_ADMIN_PASSWORD are
# set, create or update the admin account (idempotent, CLI-created emails are
# marked verified). Unset these env vars in Render once done.
if [ -n "${CREATE_ADMIN_EMAIL:-}" ] && [ -n "${CREATE_ADMIN_PASSWORD:-}" ]; then
    echo "==> Creating/updating admin account..."
    php bin/console app:create-admin "${CREATE_ADMIN_EMAIL}" "${CREATE_ADMIN_PASSWORD}" --no-interaction || {
        echo "WARNING: app:create-admin failed; keeping the API online."
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
            # Log failures to stderr (Render captures it) instead of swallowing
            # them silently — an empty map with no clue why is an outage too.
            if ! php bin/console app:carte:sync-structures --cap="${SYNC_CAP}" --no-interaction; then
                echo "WARNING: app:carte:sync-structures failed (check FORGE/GOOGLE keys and DATABASE_URL)." >&2
            fi
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

# Make the HTTP port available to Coolify/Render before the potentially long
# initial catalogue import. The import remains blocking for this entrypoint
# but never kills the server (see STRICT_* note at the top of this file).
ready_tries=0
while [ "$ready_tries" -lt 3 ] && ! kill -0 "$server_pid" 2>/dev/null; do
    ready_tries=$((ready_tries + 1))
    sleep 3
done
if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "ERROR: Web services stopped before becoming ready (supervisord itself is dead — nothing can serve)."
    wait "$server_pid"
    exit 1
fi

if [ "${BOOTSTRAP_REFERENCE_DATA:-1}" = "1" ]; then
    echo "==> Loading versioned medical reference data..."
    if ! php bin/console app:bootstrap-reference-data \
        --no-interaction \
        --catalog-version="${REFERENCE_DATA_VERSION:-2026-08-07.1}"; then
        echo "WARNING: Reference data bootstrap failed; keeping the API online."
        echo "         Run app:bootstrap-reference-data manually after fixing the catalogue/database issue."
    fi
else
    echo "==> Reference data bootstrap disabled."
fi

# Seed de carte de test : 10 établissements camerounais réels (idempotent,
# googlePlaceId seed-carte-test-*). Phase A bloquante : centres + couvertures
# seulement (aucun réseau). Phase B en arrière-plan : téléchargement best-effort
# de la galerie (6s par image, échecs ignorés). Les comptes de test sont créés
# en premier (idempotent) pour que le seed puisse affilier medecin@test.com aux
# fiches « Médecins » du PISAM et du CHU Yaoundé.
if [ "${SEED_CARTE_TEST:-0}" = "1" ]; then
    echo "==> Creating test accounts (patient/medecin/admin)..."
    if ! php bin/console app:create-test-users --no-interaction; then
        echo "WARNING: app:create-test-users failed."
    fi
    echo "==> Seeding 10 test establishments for the health map..."
    if ! php bin/console app:seed-carte-test --no-interaction; then
        echo "WARNING: app:seed-carte-test failed (map may be empty)."
    else
        echo "==> Seeding gallery images in the background..."
        (
            if ! php bin/console app:seed-carte-test --with-media --no-interaction; then
                echo "WARNING: background gallery seed failed." >&2
            fi
        ) &
    fi
fi

echo "==> Ready. Reference data is available."
wait "$server_pid"
