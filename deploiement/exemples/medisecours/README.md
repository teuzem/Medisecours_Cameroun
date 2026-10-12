# Exemple concret — MediSecours+ (ce dépôt)

> **Ce dossier est une application réelle analysée**, pas un template générique.
> Il montre comment les templates de `../frontend/` et `../fullstack/` se
> remplissent avec les valeurs d'un vrai projet, et quels sont les pièges
> qu'on y a déjà rencontrés. Toute personne reprenant ce dépôt doit lire ce
> fichier avant de toucher à la mise en ligne.
>
> Documentation de référence du dépôt (en anglais) : `DEPLOYMENT.md` (racine).
> Les fichiers de ce dossier sont la **synthèse en français** de cette analyse.

---

## 1. Topologie retenue (4 domaines)

```
Navigateur
   │
   ├── https://medisecours.batirlepays.com          ← FRONT  (Next.js 16, port 3000)
   │        └── /api/*  (rewrite interne)  ──────────┐
   │                                                  │
   ├── https://api.medisecours.batirlepays.com  ← API  (Symfony 7.4 / PHP 8.3, port 10000)
   │        └── /api/health → 200                    │   base : PostgreSQL 16 (port 5432,
   │                                                  │   bindé sur 127.0.0.1 uniquement)
   ├── https://ws.medisecours.batirlepays.com    ← WS   (Node, port 8081)
   │        ├── GET  /health    → « ok »             │
   │        ├── WS   /ws        (temps réel) ◄────────┘
   │        └── POST /publish   (le backend y envoie
   │             les évènements, en-tête X-WS-Publish-Secret)
   │
   └── https://forge.butterfly-effect.dev        ← proxy externe Forge (Google Maps/
                                                      Places), hors de notre contrôle.
```

**Pourquoi 4 domaines ?** HTTPS partout, aucun mixed content, CORS strict,
cookies/JWT lisibles partout. Le reverse proxy (Traefik de Coolify, ou nginx
si VPS nu) termine TLS sur chaque domaine et route vers le bon conteneur.

> Variante 1 domaine : tout passer par `https://DOMAINE` + chemins
> `/api`, `/ws`. Voir `../fullstack/nginx/site.conf` — mais alors le backend
> doit connaître ses sous-chemins (`SCRIPT_NAME`).

## 2. Ports et process réels

| Service | Port | Image / commande | Santé |
|---|---|---|---|
| frontend (Next standalone) | 3000 | `medisecours-frontend/Dockerfile` → `node .next/standalone/server.js` | liveness = `/` |
| backend (Symfony) | 10000 | `medisecours-backend` (PHP-FPM + router) | `GET /api/health` |
| websocket | 8081 | `medisecours-frontend/server/websocket-server.js` (`npm run ws`) | `GET /health` |
| postgres | 5432 | `postgres:16-alpine`, **uniquement `127.0.0.1:5432`** | `pg_isready` |

Le compose de production existe déjà : `docker-compose.prod.yml` (racine),
alimenté par `.env.production.example`. Deux voies possibles :
- **Voie A (recommandée par DEPLOYMENT.md)** : 4 ressources Coolify
  (frontend, backend, ws, db) gérées séparément.
- **Voie B** : un seul `docker compose -f docker-compose.prod.yml up -d --build`
  sur un VPS nu (cf. `../fullstack/vps/`).

## 3. Variables qui **cassent au build** (les pièges connus ici)

Ces variables sont lues par `next.config` **au moment du build** ; les changer
sur le serveur après coup ne change rien tant qu'on n'a pas rebuili :

| Variable | Rôle | Symptôme si absente/fausse |
|---|---|---|
| `API_BASE_URL` | cible du rewrite `/api/:path*` | chaque appel API → **404** (ou CORS si mis en `NEXT_PUBLIC_`) |
| `NEXT_PUBLIC_WS_URL` | URL absolue `wss://…/ws` | le temps réel tombe silencieusement en `ws://127.0.0.1:8081` |
| `NEXT_PUBLIC_FRONTEND_FORGE_API_KEY` (ou `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) | provider de cartes | bascule automatique Leaflet (sans clé), ou carte blanche si refusée |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | repli cartographique | repli Leaflet |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | connexion Google | bouton Google absent/inutilisable |

`NEXT_PUBLIC_API_BASE_URL` doit rester **vide en production** : tout doit
passer par le rewrite same-origin (sinon mixed content / CORS).

Côté backend, les erreurs de démarrage classiques (voir `.env.backend.example`) :
- `JWT_*` manquants → le conteneur refuse de démarrer (boot strict).
- `CORS_ALLOW_ORIGIN` mal regexé → `SyntaxError` ou requêtes refusées.
- `MAILER_DSN` absent → `:?set in .env` fait échouer `docker compose up`.
- `SKIP_MIGRATIONS` mal réglé : `1` seulement si `database/schema.sql` +
  `seed.sql` ont été importés **avant** le 1er boot ; sinon laisser `0`
  (Doctrine fait tout).

## 4. Deux chemins d'initialisation de la base (à ne pas mélanger)

| Chemin | Quand | Commande |
|---|---|---|
| **Migrations Doctrine** (défaut) | base vide | rien à faire : l'entrypoint les applique au boot (`SKIP_MIGRATIONS=0`) |
| **SQL figé** | reprise rapide / hébergeur qui impose un import | `psql … -f database/schema.sql && psql … -f database/seed.sql` **puis** `SKIP_MIGRATIONS=1` |

Jamais les deux en même temps → sinon double table/erreur de migration.

## 5. Sécurité déjà en place (à ne pas régresser)

- `CORS_ALLOW_ORIGIN=^https://medisecours\.batirlepays\.com$` — regex ancrée,
  échappée ; ne jamais mettre `*`.
- `WS_ALLOWED_ORIGINS` : liste des origines autorisées côté socket.
- `WS_PUBLISH_SECRET` partagé backend ↔ ws (le POST `/publish` est rejeté sinon).
- JWT signé par paire (`JWT_PRIVATE_KEY_BASE64` / `JWT_PUBLIC_KEY_BASE64` +
  `JWT_PASSPHRASE`), `JWT_TTL=7200`, audience dédiée pour les websockets
  (`JWT_ISSUER=medisecours-api`, `JWT_AUDIENCE=medisecours-websocket`).
- Base publiée sur `127.0.0.1` uniquement ; uploads dans un volume nommé
  (`medisecours_uploads`), pas dans le conteneur éphémère.
- `CREATE_ADMIN_EMAIL` / `CREATE_ADMIN_PASSWORD` : **à supprimer du compose
  après la première création** du compte admin.

## 6. Pour déployer ce dépôt aujourd'hui

1. Lire `DEPLOYMENT.md` (anglais, voie Coolify 4 ressources) **ou**
   suivre `../fullstack/vps/` (VPS nu, compose).
2. Copier `.env.production.example` → `.env`, remplir (tableau dans le fichier).
3. Générer la paire JWT :
   ```bash
   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
     -out private.pem -passout "pass:MOT_DE_PASSE"
   openssl rsa -in private.pem -pubout -passin "pass:MOT_DE_PASSE" -out public.pem
   base64 -w 0 private.pem   # → JWT_PRIVATE_KEY_BASE64
   base64 -w 0 public.pem    # → JWT_PUBLIC_KEY_BASE64
   ```
4. Déployer, puis exécuter `checklist-recette.md` (17 points) **avant**
   d'annoncer la mise en ligne.

## 7. Pièges déjà tombés sur ce projet

1. **Build stale** : une clé Forge/Maps modifiée sans rebuild → la carte
   reste en repli Leaflet alors que la clé est « bonne » dans le `.env`.
2. **`wss://` oublié** : `NEXT_PUBLIC_WS_URL` non défini au build → socket en
   `127.0.0.1`, plus aucun temps réel en prod, **aucune erreur visible**
   (voir `../fullstack/langages/websockets.md`, panne 1).
3. **`output: 'standalone'`** : copier uniquement `.next/` au lieu de
   `.next/standalone` + `.next/static` + `public` → page blanche (piège n°2
   de `../README.md`).
4. **Health check trop tôt** : le healthcheck backend passe à 200 alors que
   les migrations tournent encore → Coolify redéploie en boucle. Vérifier
   `GET /api/health` **après** `docker compose ps` stable.
