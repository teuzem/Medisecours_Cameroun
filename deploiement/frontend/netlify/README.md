# Déploiement sur Netlify — procédure de A à Z

**Sous-dossier :** `netlify/`
**Durée estimée :** 15 minutes.

---

## Objectif

Faire déployer le frontend `{{NOM_PROJET}}` sur **Netlify** en connectant le dépôt GitHub :
chaque push sur `main` = mise en ligne automatique, chaque Pull Request = un **site de
prévisualisation** avec sa propre URL, et un **rollback en 1 clic** si ça tourne mal.

---

## Prérequis

- Un compte **Netlify** : https://docs.netlify.com/ (inscription gratuite avec GitHub).
- Le code sur **GitHub**.
- Un **nom de domaine** (optionnel les premiers jours : Netlify donne une URL `*.netlify.app`).
- Aucune ligne de commande obligatoire (la CLI est optionnelle, voir l'étape 7).

---

## ⚠️ Lis d'abord : est-ce que Netlify convient à CE projet ?

Netlify fait du **rendu serveur (SSR)** très bien, mais **il ne fait pas tourner de service
WebSocket longue durée** (le service du projet tourne sur le port **8081**, chemin `/ws`).

- Si tu déploies **le frontend seul** sur Netlify → tu dois héberger le service WS **ailleurs**
  (un VPS, voir [`../coolify/README.md`](../coolify/README.md)) et mettre
  `NEXT_PUBLIC_WS_URL=wss://{{DOMAINE_WS}}/ws`.
- Si tu laisses `NEXT_PUBLIC_WS_URL` vide → repli silencieux sur `ws://127.0.0.1:8081/ws`
  (piège 5) : **le temps réel ne marchera nulle part**, sans message d'erreur.

Netlify reste **excellent** pour : mettre en ligne vite, tester en PR, revenir en arrière.

---

## Étapes

### 1. Connecter le dépôt Git

1. Netlify → **Add new site → Import an existing project**.
2. Choisis **GitHub** → autorise l'accès → sélectionne le dépôt du frontend
   (`{{NOM_PROJET}}/medisecours-frontend`).
3. Netlify **détecte automatiquement Next.js** et pré-remplit la configuration.

**Ce que ça fait concrètement :** Netlify crée une **application** GitHub qui reçoit les webhooks
de push. Dès l'étape 4 validée, chaque `git push origin main` déclenche un build + déploiement.

### 2. Configurer le build

Dans **Site configuration → Build & deploy → Build settings** (ou l'écran d'import) :

| Champ | Valeur | Pourquoi |
|---|---|---|
| **Build command** | `npm run build` | La commande officielle du projet. ⚠️ Si le build échoue sur un **prerender**, utilise `npm run build -- --webpack` (voir le dépannage) |
| **Publish directory** | `.next` (auto-détecté) | Netlify lit le framework détecté. Si tu es en `output: 'export'`, mets **`out`** à la place |
| **Node version** | **22** | Voir ci-dessous |

**Comment forcer Node 22 :** dans le fichier `netlify.toml` fourni (étape 3), la ligne
`NODE_VERSION = "22"` fait foi. Alternatives : *Site configuration → Environment variables* →
ajouter `NODE_VERSION` = `22`, ou un fichier `.nvmrc` à la racine.

**Pourquoi Node 22 et pas une autre version :** c'est la version **LTS** que supporte
officiellement **Next.js 16**. Avec Node 18 (fin de support) ou Node 24 (trop récent pour certains
plugins), le build casse sur `npm ci` ou sur Turbopack, avec des erreurs qui n'ont rien à voir
avec ton code.

> ⚠️ **`output: 'standalone'` (piège 2) :** ce mode produit `.next/standalone/server.js`, prévu
> pour **un serveur Node que tu gères** (Docker/Coolify). Netlify fournit **son propre** runtime
> pour Next.js : il ignore `standalone` et gère lui-même le serveur.
> **Ce que ça implique :** ne t'attends pas à ce que `standalone` fasse quoi que ce soit ici.
> Si ton build échoue ou si le site déploie sans rendre les pages, c'est probablement ce conflit :
> **solution de contournement** → passer par Coolify (le standalone y est conçu pour), ou retirer
> `output: 'standalone'` sur une branche de déploiement dédiée à Netlify (à **rebuild** ensuite).

### 3. Poser les fichiers de configuration

Copie les 4 fichiers de ce dossier **à la racine du dépôt** (là où se trouvent `package.json`
et `next.config.mjs`) :

```bash
cp deploiement/frontend/netlify/netlify.toml ./netlify.toml
cp deploiement/frontend/netlify/_redirects  ./public/_redirects
cp deploiement/frontend/netlify/_headers     ./public/_headers
git add netlify.toml public/_redirects public/_headers
git commit -m "chore(netlify): ajoute la config de build, redirections et en-tetes"
git push origin main
```

**Pourquoi `public/` pour `_redirects` et `_headers` ?**
Netlify lit ces deux fichiers **à la racine du dossier publié**. Next.js **recopie le dossier
`public/` dans la racine du build** → les deux fichiers arrivent au bon endroit **à chaque build**,
sans intervention manuelle. Les poser ailleurs (ex. `src/`) = ils sont **ignorés en silence**.

> ⚠️ **`netlify.toml`, `_redirects` et `_headers` ne comprennent PAS `{{...}}`.** Ce sont des
> fichiers lus tels quels par Netlify. **Remplace chaque placeholder à la main** avant de commiter,
> sinon la règle ne s'appliquera pas (ou appliquera un domaine littéral `{{DOMAINE}}`).

- `netlify.toml` → variable `NODE_VERSION`, en-têtes globaux de sécurité.
- `_redirects` → SPA fallback + redirections + cas `/api/*` vers `{{DOMAINE_API}}`.
- `_headers` → CSP + cache spécifique `/_next/static` vs HTML.

### 4. Définir les variables d'environnement

**Site configuration → Environment variables → Add a variable.**

| Variable | Valeur en prod | Moment où elle est lue | Conséquence si elle manque |
|---|---|---|---|
| `API_BASE_URL` | `https://{{DOMAINE_API}}` | **Au build** (lu par `next.config.mjs` pour le rewrite `/api/:path*`) | `/api/*` → **404** en prod |
| `NEXT_PUBLIC_API_BASE_URL` | **(vide)** | Au build | URL non-HTTPS dans une page HTTPS → **Mixed Content bloqué** |
| `NEXT_PUBLIC_WS_URL` | `wss://{{DOMAINE_WS}}/ws` | Au build | Repli `ws://127.0.0.1:8081/ws` → **plus de temps réel, sans erreur** |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | *(clé réelle)* | Au build | Carte grise |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | *(ex. `123456789-…apps.googleusercontent.com`)* | Au build | Connexion Google KO |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | *(token réel)* | Au build | Pas de repli de carte |
| `NODE_VERSION` | `22` | Au build | Build sur une version de Node non supportée par Next.js 16 |

**Build-time vs runtime — la distinction qui explique 90 % des mises en prod ratées :**

- **Build-time (« au build »)** : la variable est **cuite dans le JavaScript** pendant
  `npm run build`. C'est le cas de **toutes** les `NEXT_PUBLIC_*` et de `API_BASE_URL`.
  → En changer **après** le déploiement **ne change rien** : il faut **rebuild**
  (Netlify le fait automatiquement si tu changes une variable **liée au build** puis que tu
  pousses ; sinon : *Deploys → Trigger deploy → Clear cache and deploy site*).
- **Runtime (à l'exécution)** : variable lue **par le serveur à chaque requête**. Sur Netlify,
  c'est le cas des fonctions serverless (`process.env` côté serveur, hors `NEXT_PUBLIC_`).
  → Un changement prend effet **au déploiement suivant**, sans rebuild du front.

**Sécurité :** clique sur le **cadenas** pour marquer les clés comme **« Secret »** : elles sont
masquées dans l'UI et dans les logs de build. Et **ne mets jamais** ces valeurs dans `.env`
committé sur GitHub.

### 5. Déployer pour la première fois

1. Retour à **Deploys** → le build en cours (2 à 5 min).
2. **Sortie attendue :** `Site is live ✅` et un bandeau vert.
   - Échec → clique sur le build → onglet **Build log** → voir Dépannage ci-dessous.

**Test immédiat :** ouvre l'URL `https://<nom-de-site>.netlify.app` (affichée en haut de la
page du site) → page d'accueil + **padlock**.

### 6. Domaine personnalisé + HTTPS automatique

1. **Domain management → Add domain name** → entre `{{DOMAINE}}` → **Verify**.
2. Chez ton **registrar**, ajoute :
   - soit les **name servers** Netlify (recopiés dans l'écran *Domain details*) —
     c'est la méthode la plus simple ;
   - soit, si tu gardes tes NS, un **CNAME** `www → <nom-de-site>.netlify.app` et un
     **A** `@ → 75.2.60.5` (l'IP statique de Netlify).
3. **Domain management → HTTPS → Set up certificate** → **Let's Encrypt** → **Verify DNS**.

**Ce qui se passe ensuite :** Netlify prouve qu'il contrôle le domaine (HTTP-01), obtient un
certificat Let's Encrypt, et le **renouvelle automatiquement** ~30 jours avant expiration.
L'option **Force HTTPS** (à activer) redirige tout le HTTP vers le HTTPS.

**Sortie attendue :** `https://{{DOMAINE}}` → 200 + padlock. La propagation DNS prend
5 min à 24 h : si *Verify DNS* échoue, attends et réessaie (ne force pas, Let's Encrypt a un
quota de 5 tentatives par heure).

### 7. Prévisualisations par Pull Request (l'avantage majeur)

**C'est automatique, rien à configurer.** Dès que tu ouvres une **Pull Request** :

1. Netlify déploie le code de la branche sur une URL dédiée :
   `https://deploy-preview-42--<nom-de-site>.netlify.app`.
2. Tu collies cette URL **dans la PR GitHub** → le client/le chef voit la modif **en vrai,
   sur une vraie URL HTTPS**, avant merge.
3. Au merge sur `main` → déploiement **de production**.

**Variables dans les previews :** par défaut, les previews utilisent les mêmes variables que la
prod. Si tu dois isoler une variable de preview (par ex. une API de test), utilise
`netlify.toml` → `context.deploy-preview.environment` (bloc commenté dans le fichier fourni).

### 8. Rollback (annuler un mauvais déploiement)

1. **Deploys → Production deploys** → clique sur le dernier déploiement **qui marchait**.
2. Clique **Publish deploy** (ou **Roll back to this deploy**).
3. **Sortie attendue :** le site revient en **< 10 secondes**, sans rebuild.

**Pourquoi c'est rapide :** Netlify conserve les builds précédents ; « publier » un ancien
revient juste à pointer le domaine sur un ancien artefact. C'est ta meilleure amie un vendredi soir.

### 9. CLI (optionnel)

```bash
# 1. installe la CLI (une seule fois, sur TON poste)
npm install -g netlify-cli

# 2. connecte-la à ton compte (ouvre un navigateur pour l'autorisation)
netlify login

# 3. lie le dossier local à ton site Netlify (à faire UNE fois dans le dossier du projet)
netlify link

# 4. déploie TOUT le build actuel, immédiatement, sans passer par Git
netlify deploy --prod
```
**Sortie attendue :** `✔ Deploy is live` + l'URL du site.
**Quand l'utiliser :** un correctif d'urgence **hors** de Git (à éviter : ça désynchronise
l'historique), ou un test rapide. **`--prod` publie sur le domaine réel** — sans ce mot-clé,
le déploiement part en **aperçu** (URL jetable), ce qui est plus sûr pour tester.

---

## Table des valeurs à personnaliser

| Placeholder | Exemple | Où trouver la valeur |
|---|---|---|
| `{{NOM_PROJET}}` | `medisecours` | Nom du dépôt GitHub |
| `{{DOMAINE}}` | `app.exemple.fr` | Registrar → NS ou A/CNAME vers Netlify ; à mettre dans **Domain management** ET dans `_headers` (CSP) à la main |
| `{{DOMAINE_API}}` | `api.exemple.fr` | Domaine du backend → variable `API_BASE_URL` = `https://{{DOMAINE_API}}` + règle `_redirects` `/api/*` |
| `{{DOMAINE_WS}}` | `ws.exemple.fr` | Service WS (hébergé **ailleurs** que Netlify) → `NEXT_PUBLIC_WS_URL=wss://{{DOMAINE_WS}}/ws` |
| `{{EMAIL_ADMIN}}` | `admin@exemple.fr` | Email du compte Netlify (menu *Account settings*) + contact Let's Encrypt |
| `{{IP_SERVEUR}}` | `75.2.60.5` | **Non applicable** : Netlify n'a pas de serveur « à toi ». Cette IP publique est celle à utiliser pour l'enregistrement **A** `@` si tu gardes tes propres name servers |
| `{{PORT}}` | `3000` | **Non applicable** : tu ne choisis pas le port chez Netlify (plateforme gérée) |

---

## Vérification

```bash
# 1. HTTPS + certificat
curl -I https://{{DOMAINE}}
# → HTTP/2 200   ✅   |  404 → domaine pas encore pointé / DNS non propagé

# 2. Variables de build présentes dans le JS livré (piège 1)
curl -s https://{{DOMAINE}} | grep -o 'wss://[^"]*' | head -1
# → wss://{{DOMAINE_WS}}/ws   ✅   |  ws://127.0.0.1:8081/ws → rebuild avec cache vidé

# 3. En-têtes de sécurité réellement posés (fichiers _headers/netlify.toml)
curl -I https://{{DOMAINE}} | grep -iE 'x-frame|nosniff|referrer-policy|strict-transport'
# → les 4 lignes présentes   ✅   |  absentes → mauvais emplacement des fichiers (voir étape 3)

# 4. Règle /api/* appliquée (piège 4)
curl -I https://{{DOMAINE}}/api/health
# → 200 ou 30x vers {{DOMAINE_API}}   |  404 → API_BASE_URL absente au build OU règle _redirects absente
```

Dans le navigateur : `https://{{DOMAINE}}` → padlock, carte OK, F12 → Console sans `Mixed
Content`, Réseau → `/api/*` en 200.

---

## Dépannage

### Erreur 1 — `Permission denied` / `EPERM` dans le build log

**Cause 1 :** un script tente d'écrire dans un dossier en lecture seule pendant le build
(typiquement un script qui crée un fichier à la racine).

**Fix :** cherche la ligne exacte dans **Deploys → Build log** ; donne-lui un dossier autorisé
(`os.tmpdir()` côté Node) ou désactive cette étape de post-build.

**Cause 2 (plus fréquente) :** `EACCES: permission denied, open '/root/.npm/...'` — la config npm
pointe vers un chemin inutilisable.

**Fix :** dans **Environment variables**, ajoute :
```
NPM_FLAGS = --cache /tmp/.npm-cache
```
puis **Clear cache and deploy site**. Si ça persiste, la cause est ailleurs : ouvre le log **en
entier** et cherche la **première** ligne en `error` (les erreurs suivantes n'en sont que la
conséquence).

**Cause 3 :** c'est **ton poste** qui pose problème (la CLI `netlify deploy` lit des fichiers
locaux) : `npx netlify deploy` depuis le dossier du projet, et vérifie les permissions du dossier.

### Erreur 2 — Port déjà utilisé / `EADDRINUSE` / build qui « plante » inutilement

**Cause :** chez Netlify, **ce n'est pas un vrai problème de port** : la plateforme alloue elle-
même un port à chaque fonction et ne te laisse pas choisir. Si tu vois `EADDRINUSE` ou un
message sur le port 3000/8081, c'est que **ton code tente de lancer un serveur lui-même**
(`next start`, `node server.js`, un service WS) pendant le build.

**Fix :** supprime cette étape du build — Netlify exécute Next.js **via son propre runtime**,
pas via ton `server.js`. Concrètement : vérifie le **Build command** (`npm run build` **seulement**,
sans `&& node server.js` ni `next start`), et que le service WS **n'est pas** dans ce dépôt de front.

> Le service WebSocket (port 8081) **ne peut pas tourner sur Netlify** : c'est un process de longue
> durée. Héberge-le sur un VPS ([`../coolify/README.md`](../coolify/README.md)) et donne son URL à
> la variable `NEXT_PUBLIC_WS_URL`.

### Erreur 3 — DNS non propagé : `Netlify could not provision certificate` / `DNS not found`

**Cause :** l'enregistrement DNS n'est **pas encore visible** quand Netlify a tenté de créer le
certificat Let's Encrypt.

**Fix :**
```bash
nslookup {{DOMAINE}}
# NS attendus : <nom-de-site>.ns.dnsimple.com (ou équivalent Netlify)
# A attendu  : 75.2.60.5   (si tu utilises tes propres name servers)
```
1. Corrige l'enregistrement chez ton registrar (type **A** → `75.2.60.5`, ou **CNAME** `www` →
   `<nom-de-site>.netlify.app`).
2. **Attends** (5 min à 24 h ; médiane 10-30 min).
3. Netlify → **Domain management → HTTPS → Verify** (ou **Renew certificate**).
4. ⚠️ Let's Encrypt limite à **5 tentatives/heure** : si tu es en rate limit, **attends 1 h**.

### Les autres cas

| Symptôme | Cause | Correction |
|---|---|---|
| Variables d'env « non prises » en prod | Piège 1 : injectées **au build** | *Deploys → Trigger deploy → **Clear cache and deploy site*** (le cache de `node_modules`/`.next` garde l'ancien build) |
| `/api/*` → 404 | `API_BASE_URL` vide au build, ou `_redirects` absent/mauvais emplacement | Remets `API_BASE_URL=https://{{DOMAINE_API}}`, redéploie **avec cache vidé**, et vérifie que `_redirects` est dans `public/` |
| En-têtes de sécurité absents | `_headers` / `netlify.toml` pas à la **racine** (ou `_headers` pas dans `public/`) | Étape 3 : recopie, commite, redéploie |
| Build échoue sur un prerender (`Error occurred prerendering page`) | Bug **Turbopack** connu du projet | `Build command` → `npm run build -- --webpack` (le `--` passe l'argument à Next, pas à npm) |
| HTML servi mais **page blanche** | JS/CSS non chargés | F12 → Réseau : si `/_next/static/...` est en 404, c'est le publish directory (étape 2) |
