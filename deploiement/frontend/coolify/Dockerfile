# =============================================================================
# Dockerfile du frontend {{NOM_PROJET}} — image « standalone » Next.js 16
# -----------------------------------------------------------------------------
# À COPIER À LA RACINE DU DÉPÔT FRONTEND, c'est-à-dire dans le dossier qui
# contient package.json et next.config.mjs (Coolify cherche un Dockerfile là).
#
#   cp deploiement/frontend/coolify/Dockerfile ./Dockerfile
#   cp deploiement/frontend/coolify/.dockerignore ./.dockerignore
#
# POURQUOI 3 étapes et pas 1 seule ?
# Une image Docker est faite de « couches ». Docker met en cache chaque couche :
# si une ligne ne change pas, la couche est REUTILISÉE sans rebuild.
#   - étape deps  → ne change que si package-lock.json change (le plus long : npm ci ~1 min)
#   - étape build → change à chaque commit de code
#   - étape run   → presque jamais
# En séparant, on ne refait `npm ci` qu'une fois par semaine, pas à chaque push.
# =============================================================================


# =============================================================================
# ÉTAPE 1/3 — deps : installer les dépendances NODE uniquement
# -----------------------------------------------------------------------------
# node:22-bookworm-slim = Node.js 22 (version LTS : support actif jusqu'en
# avril 2027, c'est la version que supporte officiellement Next.js 16 ;
# plus récente = risque d'incompatibilité, plus vieille = fin de support).
# "bookworm" = Debian 12 (base stable), "slim" = sans les outils de compilation
# inutiles → image plus petite et surface d'attaque plus faible.
#
# On NE utilise PAS alpine : les binaires natifs de Next.js (sharp, pour
# l'optimisation d'images) sont compilés pour glibc, pas pour musl d'alpine.
# Résultat sous alpine : build qui plante sur "sharp" ou images de 0 octet.
# =============================================================================
FROM node:22-bookworm-slim AS deps

# "corepack" est livré avec Node : il fournit pnpm/yarn sans rien installer.
# Ici on reste sur npm, mais on l'active par sécurité au cas où le package.json
# déclarerait un "packageManager".
RUN corepack enable

WORKDIR /app

# On copie UNIQUEMENT ce qui sert à calculer le plan d'installation.
# --mount=type=cache : monte un cache Docker partagé entre les builds.
#   Sans ça, npm téléchargerait tout à chaque build (~40 s de perdues à chaque push).
#   Avec, la 2e couche ne se refait que si package-lock.json change.
# Le lockfile EST la source de vérité : "npm ci" installe EXACTEMENT les versions
# verrouillées (reproductible), alors que "npm install" peut monter un minor et
# casser le build une semaine plus tard sans que tu comprennes pourquoi.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci


# =============================================================================
# ÉTAPE 2/3 — build : compiler le .next/standalone
# =============================================================================
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app

# On reprend le cache des couches deps : tant que package-lock.json n'a pas
# changé, Docker RÉUTILISE la couche npm ci sans la rejouer.
COPY --from=deps /app/node_modules ./node_modules

# Le reste du code source.
# .dockerignore a exclu node_modules, .next, .git et .env : si tu ne l'avais pas
# fait, "COPY ." ferait une COPIE de tes node_modules locaux (Windows/macOS) par
# dessus les bons installés au-dessus → build cassé de façon incompréhensible.
COPY . .

# -----------------------------------------------------------------------------
# ARG = valeur passée AU MOMENT DU BUILD (docker build --build-arg ... ou par
#       l'UI Coolify : onglet Build → Build Args). Ce ne sont PAS des variables
#       d'exécution : elles sont CUITES dans le JavaScript livré au navigateur.
#
# ⚠️ LES NOMS DOIVENT ÊTRE IDENTIQUES à ceux déclarés dans Coolify/Netlify/Vercel.
#    Un caractère manquant (ARG NEXT_PUBLIC_WS_URL vs NEXT_PUBLIC_WS_URLS) et la
#    variable est VIDE, sans aucun message d'erreur.
#
# ⚠️ ces valeurs sont LUES AU BUILD. Changer un .env après coup ne change RIEN :
#    il faut RE-BUILDER l'image.
# -----------------------------------------------------------------------------
# URL du backend, lue par next.config.mjs pour le rewrite /api/:path*.
# En prod : HTTPS, sinon toutes les requêtes /api/* renvoient 404 (piège 4).
ARG API_BASE_URL=https://{{DOMAINE_API}}

# URL ABSOLUE du service WebSocket (port 8081, chemin /ws).
# SANS ELLE → repli silencieux ws://127.0.0.1:8081/ws = le serveur lui-même,
# donc plus de temps réel ET PAS D'ERREUR visible (piège 5).
# Le "s" de wss est obligatoire sur une page HTTPS.
ARG NEXT_PUBLIC_WS_URL=wss://{{DOMAINE_WS}}/ws

# Doit rester VIDE en production : la page est en HTTPS et appelle l'API en
# same-origin via le rewrite. Une valeur ici = mixed content bloqué (piège 3).
ARG NEXT_PUBLIC_API_BASE_URL=

# Clés publiques (exposées au navigateur par nature : elles partent de toute
# façon dans le JS). Elles vont dans le champ "Secret" de la plateforme.
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ARG NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=

# "ENV ..." = on recopie chaque ARG dans une variable d'environnement.
# C'est INDISPENSABLE : next build ne lit que les ENV, pas les ARG. Sans cette
# conversion, ARG existe bien pour Docker mais next build voit du vide.
# Le préfixe NEXT_PUBLIC_ fait partie du nom : c'est Next.js qui décide qu'une
# variable commençant ainsi doit être exposée au client.
# En production, on ne veut PAS de telemetry ni de sourcemap publiques.
# (Explications toujours AU-DESSUS du bloc : jamais de `#` entre les lignes
#  terminées par `\`, un commentaire dans une continuation casse certains
#  builders Docker.)
ENV API_BASE_URL=${API_BASE_URL} \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL} \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID} \
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=${NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# LE BUILD LUI-MÊME.
# -- --webpack : le "--" passe l'argument à la commande build de Next.js.
#   Pourquoi ? Sur certains prerenders, Turbopack (bundleur par défaut de
#   Next.js 16) plante pendant l'export des pages statiques. Forcer webpack
#   contourne le bug. C'est la commande du build officiel du projet.
#   >>> SI LE BUILD ÉCHOUE avec une erreur liée à "turbopack" ou "prerender",
#   >>> décommente la ligne suivante et commente la suivante.
RUN npm run build
# RUN npm run build -- --webpack

# Vérification de sécurité : si le dossier standalone n'existe pas, c'est que
# next.config.mjs n'a PAS output:'standalone' (ou que le build a échoué plus
# haut). Mieux vaut bloquer ICI qu'obtenir un conteneur qui sert une page blanche.
RUN test -f .next/standalone/server.js || \
    (echo "ERREUR: .next/standalone/server.js introuvable -> verifie output: 'standalone' dans next.config.mjs" && exit 1)


# =============================================================================
# ÉTAPE 3/3 — run : l'image finale, minimale, qui exécute le serveur
# =============================================================================
FROM node:22-bookworm-slim AS run
WORKDIR /app

# NODE_ENV=production + désactivation de la télémétrie : moins de bruit, moins
# de requêtes sortantes, et Next.js ne fait pas de travail inutile.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# -----------------------------------------------------------------------------
# Utilisateur NON-root (uid 1001) — règle de sécurité non négociable.
# Par défaut, un conteneur tourne en root : si une faille est trouvée dans le
# serveur, l'attaquant a les droits root DU CONTEXTE CONTENEUR (il peut monter
# des volumes, installer des outils, réseau…). Avec un uid non-root, il ne peut
# presque rien écrire.
# "app" est créé AVEC un home (certains packages Node vont chercher ~/.npm).
# -----------------------------------------------------------------------------
RUN groupadd --system --gid 1001 nodejs && \
    useradd  --system --uid 1001 --gid nodejs --create-home app

# .next/standalone = le serveur minimal : server.js + les seuls node_modules
# nécessaires (Next.js calcule lui-même le fruit de la dépendance).
# ⚠️ SI TON APP VIT DANS UN SOUS-DOSSIER DU DÉPÔT (monorepo), le chemin est
#    .next/standalone/<sous-dossier>/server.js et il faut adapter TOUS les
#    chemins ci-dessous d'un cran. C'est LA cause n°1 de "site vide".
COPY --from=build --chown=app:nodejs /app/.next/standalone ./

# .next/static = le JS/CSS publics (chunks, images optimisées).
# Il faut le copier À CÔTÉ de standalone, pas dedans : Next.js attend de le
# servir sur /_next/static/*. S'il manque → chaque page renvoie du HTML mais le
# JS ne se charge pas → site « blanc » qui ne réagit à aucun clic.
COPY --from=build --chown=app:nodejs /app/.next/static ./.next/static

# public/ = tes fichiers statiques à la racine (/favicon.ico, /images/...).
# Même logique : s'il manque, favicon et images en 404.
COPY --from=build --chown=app:nodejs /app/public ./public

# Le conteneur ne PARLE PAS aux ports : il faut les déclarer.
# 3000 = port d'écoute de server.js. Coolify s'appuie sur ce EXPOSE pour
# pré-remplir le champ "Ports Exposes".
EXPOSE 3000

# Healthcheck : toutes les 30 s, Docker fait une vraie requête HTTP depuis
# DANS le conteneur.
#   --start-period=20s : on laisse 20 s au serveur pour démarrer avant de
#                        compter les échecs (sinon 3 faux négatifs au boot).
#   statusCode<500 : on accepte un 301/302/401 comme "vivant" — un redirect
#                    signifie que le serveur fonctionne, il redirige juste.
#   Pas besoin d'installer curl : node suffit, et ça garde l'image légère.
# Résultat concret : "docker ps" affiche (healthy), et l'UI Coolify te montre
# le site tombé en 90 s au lieu de le découvrir à la visite d'un client.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

# On bascule sur l'utilisateur non-root AVANT de lancer le process.
USER app

# "node server.js" et non "next start" :
#   output:'standalone' produit un serveur AUTONOME. "next start" exigerait
#   l'intégralité de next.config.mjs, des node_modules complets et la CLI de
#   Next.js — tout ce qu'on a volontairement laissé tomber pour avoir une image
#   de ~150 Mo au lieu de ~1 Go, et un démarrage en 1 s au lieu de 5.
CMD ["node", "server.js"]
