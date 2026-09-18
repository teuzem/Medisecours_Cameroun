# MediSecours+ — Deployment Guide (Contabo VPS + Coolify)

Production deployment of the complete MediSecours+ platform:

| Component  | Stack                          | Public URL                              |
|------------|--------------------------------|-----------------------------------------|
| Frontend   | Next.js 16 (standalone)        | `https://medisecours.batirlepays.com`   |
| API        | Symfony 7 / PHP 8.3 (nginx)    | `https://api.medisecours.batirlepays.com` |
| Realtime   | Node.js WebSocket (ws)         | `wss://ws.medisecours.batirlepays.com/ws` |
| Database   | PostgreSQL 16 (self-hosted)    | internal (`medisecours-db` Coolify resource) |
| Deploy     | Coolify on your Contabo VPS    | `https://coolify.medisecours.batirlepays.com` |

All traffic terminates on **Coolify's Traefik** which auto-provisions Let's
Encrypt certificates. The database stays **inside the VPS** (Coolify-managed
Postgres) — no cloud DB needed.

---

## TL;DR

1. Point DNS A records → your VPS IP.
2. Install Coolify on the VPS.
3. Create the Postgres resource and note its credentials.
4. Generate secrets (JWT keypair, `APP_SECRET`, `WS_PUBLISH_SECRET`).
5. Create 3 Coolify apps from this repo (`medisecours-backend`, `server/` for
   WS, `medisecours-frontend`), associate each with its domain, set env vars.
6. Boot backend → it auto-migrates + seeds the catalog + validates volumes.
7. Boot WS and frontend. Create the admin account.
8. Done — test the health endpoints.

For an alternative without Coolify, see [Option B — docker compose](#option-b--docker-compose).
For Hostinger / Vercel / Netlify see the [alternative hosts](#alternative-hosts) section.

---

## 1. Prerequisites

- **VPS** (Contabo): Ubuntu 24.04, **2–4 vCPU, 8 GB RAM** (Postgres + Symfony +
  Next in the same box), 100 GB disk. Root SSH access.
- **A domain** with registrable DNS: `batirlepays.com` (create **4 A records** below).
- **A GitHub account** (public repo for this project).
- Values to replace in commands: `SERVER_IP`, `YOUR_EMAIL`, `YOUR_GITHUB_USERNAME`.

> The `batirlepays` subdomains below are placeholders for your exact domains.

---

## 2. DNS records

At your DNS provider create these **A records** (type `A`, TTL 300–3600):

| Name            | Type | Value      |
|-----------------|------|-----------:|
| `medisecours`   | A    | `SERVER_IP` |
| `api.medisecours` | A  | `SERVER_IP` |
| `ws.medisecours` | A   | `SERVER_IP` |
| `coolify.medisecours` | A | `SERVER_IP` |

Wait until `dig +short medisecours.batirlepays.com` returns the IP before
starting Coolify, or Let's Encrypt checks will fail.

---

## 3. Install Coolify on the VPS

SSH into the VPS (Windows terminal, or PowerShell with `ssh`):

```bash
ssh root@SERVER_IP
```

The official one-liner:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

When asked for a FQDN use `https://coolify.medisecours.batirlepays.com`, and
for instance type choose the default. The installer starts Traefik + Coolify,
obtains a Let's Encrypt cert for the Coolify domain (DNS must already point
there), and prints an **admin user + password** — save them.

---

## 4. First login & Coolify basics

1. Open `https://coolify.medisecours.batirlepays.com` → log in.
2. **Servers** → your localhost server shows **"Server is online"**.
3. **Settings → Domains**: make sure `coolify.medisecours.batirlepays.com`
   is listed (this is what the installer configured).

You now deploy applications that auto-register their own TLS certificates.

---

## 5. Create the PostgreSQL database resource

1. **Databases → New → PostgreSQL**.
2. `Name`: `medisecours-db`
3. Private port: keep `5432`. User / password / database: use strong values:
   - `POSTGRES_USER` = `medisecours`
   - `POSTGRES_PASSWORD` = a long random password
   - `POSTGRES_DB` = `medisecours`
4. Save. Coolify creates a `medisecours-db` container + volume.

> The **internal DNS name** Coolify gives this container is normally
> **`medisecours-db`** (its resource name). Use it as the DB host in the
> backend's `DATABASE_URL`. If your Coolify version uses UUIDs, grab the host
> from the resource's "Internal DNS" field instead.

Connection string used by the backend:

```
postgresql://medisecours:STRONG_DB_PASSWORD@medisecours-db:5432/medisecours?sslmode=disable
```

---

## 6. Generate secrets (on your Windows machine or the VPS)

### 6.1 JWT keypair (RS256)

This pair is **shared** by the backend (signing) and the WebSocket server
(verification). Generate it **once** and store the base64 values permanently —
rotating it later logs everyone out.

**On the VPS (recommended):**

```bash
mkdir -p /root/medisecours-jwt && cd /root/medisecours-jwt
PASS='your-strong-jwt-passphrase'
openssl genpkey -out private.pem -outform PEM \
    -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
    -aes256 -pass "pass:${PASS}"
openssl rsa -in private.pem -pubout -passin "pass:${PASS}" -out public.pem
chmod 600 private.pem
# values for Coolify:
base64 -w 0 private.pem   # -> JWT_PRIVATE_KEY_BASE64
base64 -w 0 public.pem    # -> JWT_PUBLIC_KEY_BASE64
echo "Passphrase: $PASS"  # -> JWT_PASSPHRASE
```

**On Windows (PowerShell) alternative:**

```powershell
Set-Location C:\temp
mkdir medisecours-jwt; Set-Location medisecours-jwt
$PASS='your-strong-jwt-passphrase'
openssl genpkey -out private.pem -outform PEM -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -aes256 -pass "pass:$PASS"
openssl rsa -in private.pem -pubout -passin "pass:$PASS" -out public.pem
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\private.pem"))   # JWT_PRIVATE_KEY_BASE64
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\public.pem"))    # JWT_PUBLIC_KEY_BASE64
$PASS                                                                     # JWT_PASSPHRASE
```

> The backend container's entrypoint **refuses to start** if the key is
> unreadable, the passphrase mismatches, or private/public don't pair —
> this happens before boot so you get an explicit error instead of a 500
> later.

### 6.2 Other secrets

```bash
openssl rand -hex 32        # APP_SECRET
openssl rand -base64 48     # WS_PUBLISH_SECRET (shared backend <-> ws, >= 32 chars)
```

---

## 7. Create the BACKEND app in Coolify

1. **Applications → New → Public Repo** (or **Dockerfile** deployment).
   - Git repository: `https://github.com/YOUR_GITHUB_USERNAME/medisecours`
   - **Base Directory**: `medisecours-backend`
   - **Build Pack**: `Dockerfile` (there is a `Dockerfile` at that root)
   - Watch paths: `medisecours-backend` *(so pushes to backend auto-deploy)*
2. **Domain**: `https://api.medisecours.batirlepays.com`
   *(Coolify adds TLS automatically).*
3. **General**:
   - Ports Exposed: `10000` (the container listens on 10000 via nginx)
   - Persistent Storage: `Volume` mounted at `/app/var/uploads` → this keeps
     patient photos / documents across redeploys.
   - Restart: `unless-stopped`; Health check path: `/api/health`.
4. **Environment** — copy from `medisecours-backend/.env.coolify.example`,
   replacing every `<…>`:

```env
APP_ENV=prod
APP_DEBUG=0
APP_SECRET=<openssl rand -hex 32>
APP_SHARE_DIR=/app/var
TRUSTED_PROXIES=127.0.0.1,REMOTE_ADDR
DEFAULT_URI=https://api.medisecours.batirlepays.com
PORT=10000
DATABASE_URL=postgresql://medisecours:STRONG_DB_PASSWORD@medisecours-db:5432/medisecours?sslmode=disable
BOOTSTRAP_REFERENCE_DATA=1
REFERENCE_DATA_VERSION=2026-08-07.1
CORS_ALLOW_ORIGIN=^https://medisecours\.batirlepays\.com$
FRONTEND_URL=https://medisecours.batirlepays.com
JWT_SECRET_KEY=/app/config/jwt/private.pem
JWT_PUBLIC_KEY=/app/config/jwt/public.pem
JWT_PRIVATE_KEY_BASE64=<from step 6>
JWT_PUBLIC_KEY_BASE64=<from step 6>
JWT_PASSPHRASE=<from step 6>
JWT_TTL=7200
WS_PUBLISH_URL=https://ws.medisecours.batirlepays.com/publish
WS_PUBLISH_SECRET=<32+ random>
MAILER_DSN=smtp://LOGIN:URLENCODED_KEY@smtp-relay.brevo.com:587
MAILER_SENDER_EMAIL=no-reply@medisecours.batirlepays.com
MAILER_SENDER_NAME=MediSecours
GOOGLE_CLIENT_ID=<your OAuth client id - optional>
```

5. **Save & Deploy**. On first boot the container:

   1. validates the JWT pair,
   2. waits for Postgres and **runs all 55 Doctrine migrations**,
   3. caches Symfony, boots nginx+php-fpm,
   4. **boots the medical catalog** (`app:bootstrap-reference-data`) and
      logs a warning if volumes are wrong (the API remains online; set
      `STRICT_REFERENCE_DATA_BOOTSTRAP=1` when a hard failure is required),
   5. verifies `https://api.medisecours.batirlepays.com/api/health` → `200`.

> Optional first-boot admin: add `CREATE_ADMIN_EMAIL` + `CREATE_ADMIN_PASSWORD`
> temporarily to the env, deploy once, then **remove them**. The admin email
> is created as verified.

---

## 8. Create the WEBSOCKET app in Coolify

1. **Applications → New → Public Repo**
   - Repo: `https://github.com/YOUR_GITHUB_USERNAME/medisecours`
   - **Base Directory**: `medisecours-frontend/server`
   - Build Pack: `Dockerfile` (uses `server/Dockerfile`)
2. **Domain**: `https://ws.medisecours.batirlepays.com`
3. **Ports Exposed**: `8081`
4. **Environment**:

```env
PORT=8081
HOST=0.0.0.0
WS_PUBLISH_SECRET=<same value as backend>
WS_ALLOWED_ORIGINS=https://medisecours.batirlepays.com
JWT_PUBLIC_KEY_BASE64=<from step 6>
JWT_ISSUER=medisecours-api
JWT_AUDIENCE=medisecours-websocket
```

5. **Save & Deploy**. Health check: `https://ws.medisecours.batirlepays.com/health`
   → `{"status":"ok",...}`.

> `WS_ALLOWED_ORIGINS` must contain the **exact `Origin` header** the browser
> sends (`https://medisecours.batirlepays.com`). Add more origins separated by
> commas if you later serve the frontend from another domain.

---

## 9. Create the FRONTEND app in Coolify

1. **Applications → New → Public Repo**
   - Repo: `https://github.com/YOUR_GITHUB_USERNAME/medisecours`
   - **Base Directory**: `medisecours-frontend`
   - Build Pack: `Dockerfile`
   - Watch paths: `medisecours-frontend`
2. **Domain**: `https://medisecours.batirlepays.com`
3. **Ports Exposed**: `3000`
4. **Build Arguments** (Next inlines `NEXT_PUBLIC_*` at build time):

```env
API_BASE_URL=https://api.medisecours.batirlepays.com
NEXT_PUBLIC_WS_URL=wss://ws.medisecours.batirlepays.com/ws
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your OAuth client id - optional>
```

5. **Environment** (runtime): `NODE_ENV=production`
6. **Save & Deploy**.

Done — `https://medisecours.batirlepays.com` serves the app. Browser API calls
go to `/api/*` same-origin; the Next server proxies them to the API; realtime
notifications connect to `wss://ws…/ws`.

---

## 10. First-boot verification checklist

```bash
# API health (through the frontend and directly)
curl -s https://medisecours.batirlepays.com/api/health
curl -s https://api.medisecours.batirlepays.com/api/health
# WS HTTP health
curl -s https://ws.medisecours.batirlepays.com/health
```

- Login page loads; JWT login works (verifies the JWT pair + CORS).
- Register a **patient**, register a **medecin**; verify emails (Brevo).
- Open a consultation, send a message → the other side receives it **live**
  (verifies WS auth + publish).
- Upload a profile photo → survives a backend redeploy (verifies the upload
  volume).
- Admin: `https://medisecours.batirlepays.com/admin`.

---

## New database, two ways

### Path A — Coolify handles everything (default, recommended)

Leave the database **empty**. The backend entrypoint runs the 55 migrations,
then `app:bootstrap-reference-data` imports diseases / centres / symptoms /
protocols from the JSON files bundled in the image and records
`reference_data_version`.

### Path B — Standalone SQL (`database/schema.sql` + `database/seed.sql`)

Useful for Neon, Supabase, RDS, or importing into Coolify's Postgres yourself.

1. Create the schema:

```bash
psql "postgresql://..." -f database/schema.sql
```

2. Seed the reference catalog (categories, 1038 diseases, 5312 first-aid
   sheets, 232 centres — generated from `medisecours-backend/data/*.json`):

```bash
psql "postgresql://..." -f database/seed.sql
```

   Re-generate it anytime with `python tools/generate_seed_sql.py`.

3. On the backend env set:

```env
SKIP_MIGRATIONS=1
BOOTSTRAP_REFERENCE_DATA=1
```

   The entrypoint then skips migrations and lets `app:bootstrap-reference-data`
   idempotently finish the symptom index, patient catalog (200 visible) and
   ≥500 protocols.

> On Neon, import from the VPS or your machine with `psql`.
> **Do not** run `schema.sql` on a database that already had Doctrine
> migrations applied, and vice-versa.

---

## Option B — `docker compose` on the raw VPS

If you prefer to skip Coolify (you still get TLS via a bundled Traefik/Caddy
behind the compose file's exposed ports, or by writing your own nginx config):

```bash
# on the VPS, after cloning the repo:
cp .env.production.example .env
# fill every <...> placeholder, then
docker compose -f docker-compose.prod.yml up -d --build
```

Services: `db` (Postgres 16 with healthcheck), `backend` (port 10000, uploads
volume), `ws` (port 8081), `frontend` (port 3000). Add your own reverse proxy
or point Coolify's Traefik/DNS channels at each host port.

---

## Alternative hosts

### Hostinger (shared hosting — PHP backend + uploads)

We can only run the **backend** there if the VPS/Coolify box is not an option;
shared PHP must be 8.3+ with the PostgreSQL extension enabled.

1. Upload the built `medisecours-backend/` (vendor + var + config/jwt) into
   eg. `~/domains/medisecours/public_html/api`.
2. Public web root must be `…/api/public`. Keep `config/jwt/`, `var/`,
   `vendor/`, `.env` **above** the web root if Hostinger allows it;
   otherwise rely on the hard-coded deny rules.
3. **`.htaccess`** (already provided at `medisecours-backend/public/.htaccess`):
   front-controller rewrite + forbid `.env`, `.git`, and `config/jwt/`.
   Make sure `AllowOverride All` is on for that folder.
4. Point `api.medisecours.batirlepays.com` at that folder (Hostinger redirect /
   subdomain to `public`).
5. `.env` on Hostinger: same vars as Coolify, plus
   `TRUSTED_PROXIES=127.0.0.1,REMOTE_ADDR`. HTTPS is enforced further up the
   Hostinger proxy chain.
6. MySQL is **not** supported by this stack — use the Postgres resource above
   (or Hostinger's own managed Postgres if offered).

### Vercel (frontend only) + Neon (DB)

- Push `medisecours-frontend` to a GitHub repo, import into Vercel
  (framework: Next.js). The existing `vercel.json` (region `cdg1`) is kept.
- Env vars: `API_BASE_URL=https://api.medisecours.batirlepays.com`,
  `NEXT_PUBLIC_WS_URL=wss://ws.medisecours.batirlepays.com/ws`,
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID=…` (leave `NEXT_PUBLIC_API_BASE_URL` unset so
  browser requests stay same-origin through the `/api` rewrite).
- Backend + WS still on the VPS. Add the Vercel origin to
  `CORS_ALLOW_ORIGIN` (regex) and `WS_ALLOWED_ORIGINS` on the WS app:
  `^https://medisecours(-[a-z0-9]+-yourteam)?\.vercel\.app$`.

### Netlify (frontend only)

- Import the repo, set build command `npm run build`, publish `.next`
  (uses the Next.js plugin). `netlify.toml` (in `medisecours-frontend`)
  defines headers + env.
- Same env vars and CORS/origin additions as Vercel above.

---

## Deploying updates

- **Native**: Coolify polls the repo on the configured watch path; pushing to
  `main` redeploys the affected app(s).
- **Webhook (optional)**: `.github/workflows/deploy-coolify.yml` fires each
  app's Coolify webhook URL on push — set the three repo secrets
  (`COOLIFY_WEBHOOK_BACKEND/FRONTEND/WS`).
- `.github/workflows/keepalive.yml` pings the frontend + WS every 12 min.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Backend deploy fails: `JWT private key is invalid...` | Wrong passphrase or key copy | Regenerate keypair; verify base64 decodes to `-----BEGIN ... KEY-----` |
| Backend deploy fails: `migrations failed after 5 attempts` | `DATABASE_URL` unreachable | Check `medisecours-db` host/name/credentials; DB must be up first |
| Over and over `Restarting…` | Health check failing | `curl https://api.…/api/health`; watch logs in Coolify |
| Login returns 500 / `JWTEncodeFailureException` | Key/passphrase mismatch at runtime | Re-check base64 values, they must byte-match the generated PEMs |
| CORS error in browser console | Origin regex excludes the frontend domain | `CORS_ALLOW_ORIGIN=^https://medisecours\.batirlepays\.com$` (including optional `https://www.…`) |
| WS connects then closes `Auth timeout` / `Invalid token` | WS service has wrong public key or issuer/audience | Ensure `JWT_PUBLIC_KEY_BASE64` matches backend private key; `JWT_ISSUER=medisecours-api`, `JWT_AUDIENCE=medisecours-websocket` |
| `403 Forbidden` on `wss://…/ws` | `Origin` not in `WS_ALLOWED_ORIGINS` | Add the exact frontend origin |
| Uploads vanish after redeploy | No persistent volume | Add `/app/var/uploads` volume to the backend app |
| `413 Request Entity Too Large` | Media over 16 MB | nginx already allows 16M; keep uploads below that |
| First boot very slow (>5 min) | Catalog import on small VPS | Expected once; subsequent boots are fast |
| `app:bootstrap-reference-data` failed volumes | Partially seeded DB | Pass `--force` via manual exec, or re-import seed.sql |
| 404 on `/api/…` via frontend | `API_BASE_URL` build arg wrong/missing | Set it to `https://api.medisecours.batirlepays.com` and rebuild |

---

## Secret inventory (store in a password manager)

| Secret | Used by |
|---|---|
| `JWT_PRIVATE_KEY_BASE64` + `JWT_PUBLIC_KEY_BASE64` + `JWT_PASSPHRASE` | backend (sign), WS (verify) |
| `APP_SECRET` | backend sessions/crypto |
| `WS_PUBLISH_SECRET` | backend → WS publisher auth |
| Postgres `POSTGRES_PASSWORD` | Coolify DB resource |
| Coolify admin password | generated during install |
| Brevo SMTP login/key | email verification & resets |
