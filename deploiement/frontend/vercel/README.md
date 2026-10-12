# Déploiement sur Vercel — procédure de A à Z

**Sous-dossier :** `vercel/`
**Durée estimée :** 15 minutes.

---

## Objectif

Déployer le frontend `{{NOM_PROJET}}` sur **Vercel**, la plateforme créée par les développeurs de
Next.js : détection automatique du framework, rendu serveur (SSR) géré pour toi, **site de
prévisualisation pour chaque Pull Request**, rollback en 1 clic.

C'est la plateforme la plus « facile » — **à condition de connaître ses limites** (voir la section
dédiée, surtout pour les WebSockets du projet).

---

## Prérequis

- Un compte **Vercel** : https://vercel.com/docs (inscription gratuite avec GitHub).
- Le code sur **GitHub**.
- Un **nom de domaine** (optionnel au début : Vercel donne une URL `*.vercel.app`).
- Aucune ligne de commande obligatoire (la CLI est optionnelle, étape 7).

---

## Étapes

### 1. Importer le dépôt Git

1. Va sur **https://vercel.com/docs** → *Get Started* → **Continue with GitHub**.
2. **Add New… → Project** → sélectionne le dépôt du frontend.
3. Vercel **détecte automatiquement Next.js** et pré-remplit :
   - **Framework Preset** = Next.js
   - **Build Command** = `next build` (équivalent à `npm run build`)
   - **Output Directory** = `.next`

**Ce que ça fait concrètement :** Vercel crée une intégration GitHub qui écoute les pushes.
Dès l'étape 4 validée, chaque `git push` sur `main` redéploie, et chaque **Pull Request** reçoit
une URL d'aperçu propre.

**Vérifie le preset** : si Vercel affiche « Other », c'est qu'il n'a pas détecté le projet —
remets **Next.js**, sinon il publiera un dossier vide (site 404).

### 2. Choisir la version de Node : **22**

**Settings → General → Node.js Version → 22** (liste déroulante), ou via `package.json` :

```json
{
  "engines": {
    "node": "22"
  }
}
```

**Pourquoi 22 et pas une autre :** c'est la version **LTS** (support actif jusqu'en avril 2027)
que supporte officiellement **Next.js 16**. Avec Node 18, `npm ci` casse sur des dépendances
récemment publiées ; avec une version expérimentale, Turbopack (le bundleur de Next.js 16)
peut planter pendant le build. On fige la version pour que le build d'aujourd'hui soit identique
à celui de dans six mois.

### 3. Choisir la région d'exécution

**Settings → Functions → Region** (ou à la création du projet, champ *Region*).

| Région | Code | Pour qui |
|---|---|---|
| **Paris** | `cdg1` | Public français / Europe de l'Ouest → **latence minimale** (~10-20 ms) |
| Francfort | `fra1` | Europe centrale/est |
| Londres | `lhr1` | Royaume-Uni |
| Washington | `iad1` | Amérique du Nord |

**Conseil :** mets **`cdg1` (Paris)** pour un public francophone. Le rendu se fait alors à
quelques milliers de km de tes visiteurs.

> ⚠️ Attention aux noms de région : Vercel utilise **ses propres codes** (`cdg1`, `fra1`,
> `iad1`…), ce ne sont **pas** les codes AWS (du type `af-south-1`, `eu-west-3`). Si une
> doc te propose un code régional, vérifie-le dans la liste officielle :
> **https://vercel.com/docs** (recherche « regions »).
>
> **À quoi ça ne sert PAS :** la région ne change que l'emplacement des **fonctions** (le
> rendu serveur). Les fichiers statiques sont servis depuis le **CDN mondial** partout,
> quel que soit le réglage.

### 4. Définir les variables d'environnement

**Settings → Environment Variables.**

Pour **chaque** variable, tu choisis les environnements auxquels elle s'applique :
- **Production** → le site réel (`{{DOMAINE}}`)
- **Preview** → les URLs d'aperçu des Pull Requests
- **Development** → `vercel dev` sur ta machine

| Variable | Valeur en prod | Lue… | Environnements | Conséquence si elle manque |
|---|---|---|---|---|
| `API_BASE_URL` | `https://{{DOMAINE_API}}` | **Au build** (lit `next.config.mjs` pour le rewrite `/api/:path*`) | Production + Preview | `/api/*` → **404** |
| `NEXT_PUBLIC_API_BASE_URL` | **(vide)** | Au build | Production + Preview | **Mixed Content** bloqué par le navigateur |
| `NEXT_PUBLIC_WS_URL` | `wss://{{DOMAINE_WS}}/ws` | Au build | Production + Preview | Repli `ws://127.0.0.1:8081/ws` → **plus de temps réel, sans erreur** |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | *(clé réelle)* | Au build | Production + Preview | Carte grise |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | *(ex. `123456789-…apps.googleusercontent.com`)* | Au build | Production + Preview | Connexion Google KO |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | *(token réel)* | Au build | Production + Preview | Pas de repli de carte |
| `NODE_VERSION` | `22` | Au build | Production (+ Preview) | Build sur un Node non supporté |

**Build-time vs runtime — la distinction qui cause 90 % des mises en prod ratées :**

- **Build-time (« au build »)** : la valeur est **cuite dans le JavaScript** livré au navigateur.
  C'est le cas de **toutes** les `NEXT_PUBLIC_*` **et** de `API_BASE_URL`.
  → Changer la valeur **après** le déploiement **ne change RIEN** : il faut **rebuilder**
  (*Deployments → … → Redeploy*, en cochant **Use existing Build Cache = OFF** sinon tu
  republies l'ancien build).
- **Runtime (à l'exécution)** : lue **à chaque requête** par la fonction serveur. C'est le cas des
  variables **sans** préfixe `NEXT_PUBLIC_`, lues via `process.env` côté serveur.
  → Elles sont mises à jour au **déploiement suivant**, sans rebuild du front.

**Sécurité :** coche le cadre **Sensitive** pour chaque clé : sa valeur est masquée dans l'UI et
**remplacée par des bullets `••••`** dans les logs. Et **ne commite jamais** ces valeurs dans un
`.env` Git (un secret committé reste dans l'historique : il faut alors **révoquer** la clé chez le
fournisseur et en générer une nouvelle).

**Astuce de preview :** dans un déploiement de PR, tu peux vouloir une API de recette. Sélectionne
l'environnement **Preview** et donne une autre valeur à `API_BASE_URL` → la PR teste contre la
recette, la prod garde la vraie, **sans toucher au code**.

### 5. Domaine personnalisé + HTTPS

1. **Settings → Domains → Add** → `{{DOMAINE}}` → **Add**.
2. Vercel affiche **les enregistrements DNS à créer** chez ton registrar :
   ```
   Type A     Nom @      Valeur 76.76.21.21     TTL auto
   Type CNAME Nom www     Valeur cname.vercel-dns.com
   ```
3. Crée ces enregistrements, **attends la propagation** (5 min à 24 h), puis reviens :
   l'état passe de **Invalid Configuration** à **Valid**.

**HTTPS :** Vercel génère **automatiquement** un certificat Let's Encrypt pour chaque domaine
validé et le **renouvelle** ~30 jours avant expiration. L'option **Force HTTPS** (activée par
défaut) redirige tout le HTTP vers le HTTPS.

**Sortie attendue :** `https://{{DOMAINE}}` → 200 + padlock.

### 6. Premier déploiement + prévisualisations

1. **Deployments** → le build en cours (1 à 4 min).
2. **Sortie attendue :** `Ready` + une pastille verte, et le lien `https://<projet>.vercel.app`.

**Prévisualisation par Pull Request — automatique :**
1. Ouvre une **Pull Request** sur GitHub.
2. Vercel déploie le code de la branche et **publie un commentaire** dans la PR avec l'URL :
   `https://<projet>-git-<branche>-<equipe>.vercel.app`.
3. Le client/le chef clique, voit la modif **en vrai sur une URL HTTPS**, avant merge.
4. Merge sur `main` → déploiement **Production**.

**Pourquoi c'est utile concrètement :** plus de « ça marche sur ma machine ». On valide une
fonctionnalité **sur la vraie URL**, avec les **vraies variables** de l'environnement Preview.

### 7. Rollback (annuler un mauvais déploiement)

1. **Deployments** → repère le dernier déploiement **vert** (qui marchait).
2. Clic sur **⋯** → **Promote to Production** (ou *Instant Rollback*).
3. **Sortie attendue :** le site est de nouveau servi par l'ancien build en **quelques secondes**,
   **sans rebuild** (Vercel conserve les artefacts des builds précédents).

**C'est ta meilleure amie un vendredi soir** : on publie le correctif le lundi, dans la journée.

### 8. CLI (optionnel)

```bash
# 1. installe la CLI (une fois, sur TON poste)
npm install -g vercel

# 2. connexion interactive (ouvre le navigateur pour autoriser)
vercel login

# 3. lie le dossier local au projet (à faire UNE fois dans le dossier du projet)
vercel link

# 4. déploie en APERÇU (URL jetable) — c'est le comportement PAR DÉFAUT
vercel

# 5. déploie sur le domaine de PRODUCTION
vercel --prod

# 6. regarde les logs du dernier déploiement, en direct
vercel logs <url-du-projet>
```
**Sortie attendue :** `✔ Production: https://{{DOMAINE}}`.
**Sécurité :** sans `--prod`, tu ne risques **rien** : le déploiement part en aperçu.
Utilise `vercel --prod` uniquement quand tu es sûr — ça publie sur le vrai domaine.

---

## Limites de Vercel (à connaître AVANT de choisir)

| Limite | Détail | Ce que ça change pour toi |
|---|---|---|
| **Pas de WebSocket longue durée** | Les fonctions Vercel sont **éphémères** : elles vivent quelques secondes à 26 secondes, puis meurent. Une connexion WebSocket doit rester ouverte **des heures**. | ⚠️ **Le service temps réel du projet (port 8081, chemin `/ws`) ne peut PAS tourner sur Vercel.** → Héberge-le **ailleurs** (un VPS : [`../coolify/README.md`](../coolify/README.md)) et mets `NEXT_PUBLIC_WS_URL=wss://{{DOMAINE_WS}}/ws`. Si tu laisses la valeur vide → repli `ws://127.0.0.1:8081/ws` = **plus de temps réel, sans aucun message d'erreur** (piège 5). |
| **Durée des fonctions** | Quelques secondes par requête (plan Hobby), jusqu'à ~60 s sur les plans payants. | Un build ou un traitement long échoue en `Function timed out`. Le **build** lui-même a ses propres quotas (durée/dépendances). |
| **Quotas du plan gratuit** | Bande passante, durée de build, nombre de déploiements, fonctions par mois. | Un pic de trafic ou 50 rebuilds dans la journée peuvent **épuiser le quota** → les déploiements suivants sont refusés jusqu'au mois suivant. |
| **`output: 'standalone'` ignoré** | Ce mode produit `.next/standalone/server.js`, fait pour **un serveur Node que tu gères**. Vercel fournit **son propre** runtime Next.js. | ⚠️ Si le build échoue ou si les pages ne se rendent pas, c'est peut-être ce conflit → solution : passer par Coolify (là où `standalone` est conçu pour), ou conditionner `output` selon la cible (à **rebuilder** ensuite — piège 1). |
| **Coût qui suit le trafic** | Les plans gratuits ont des quotas ; au-delà, le prix monte avec la usage. | Pour un trafic **prévisible et maîtrisé**, un VPS (~12 €/mois, prix **fixe**) coûte souvent moins cher à partir d'un certain volume. |

### Quand préférer Coolify + VPS (résumé honnête)

Choisis **Vercel** si tu veux : mettre en ligne en 15 minutes, previews PR, rollback instantané,
zéro administration.

Choisis **Coolify + VPS** si tu veux : **les WebSockets**, un **coût fixe** quel que soit le
trafic, **un seul serveur** pour le frontend **et** le service WS (port 8081), et le contrôle
total (ports, logs, versions). C'est la seule option des 4 qui héberge **les deux services du
projet au même endroit**.

Les deux sont compatibles : **front sur Vercel, WS sur un VPS**, tant que `NEXT_PUBLIC_WS_URL`
pointe vers le domaine du VPS (et que la CSP/le navigateur acceptent ce domaine, cf.
`../netlify/_headers` pour l'exemple de CSP).

---

## Table des valeurs à personnaliser

| Placeholder | Exemple | Où trouver la valeur |
|---|---|---|
| `{{NOM_PROJET}}` | `medisecours` | Nom du dépôt GitHub → champ **Project Name** de Vercel |
| `{{DOMAINE}}` | `app.exemple.fr` | Registrar → A `@` → `76.76.21.21`, CNAME `www` → `cname.vercel-dns.com` ; à ajouter dans **Settings → Domains** |
| `{{DOMAINE_API}}` | `api.exemple.fr` | Domaine du backend → variable `API_BASE_URL` = `https://{{DOMAINE_API}}` |
| `{{DOMAINE_WS}}` | `ws.exemple.fr` | Service WS hébergé **ailleurs** (VPS) → `NEXT_PUBLIC_WS_URL=wss://{{DOMAINE_WS}}/ws` |
| `{{EMAIL_ADMIN}}` | `admin@exemple.fr` | Email du compte Vercel (Settings → Account) + contact Let's Encrypt |
| `{{IP_SERVEUR}}` | `76.76.21.21` | **Pas « ton » serveur** : c'est l'IP publique **de Vercel** à mettre dans l'enregistrement A `@`. Vercel ne te fournit pas de machine |
| `{{PORT}}` | `3000` | **Non choisi ici** : Vercel route les requêtes vers ses fonctions automatiquement. Le 3000/8081 n'a pas d'équivalent chez lui |

---

## Vérification

```bash
# 1. HTTPS + certificat
curl -I https://{{DOMAINE}}
# → HTTP/2 200   ✅   |  404 → domaine pas encore pointé / DNS non propagé

# 2. Variables de build présentes dans le JS livré (piège 1)
curl -s https://{{DOMAINE}} | grep -o 'wss://[^"]*' | head -1
# → wss://{{DOMAINE_WS}}/ws   ✅   |  ws://127.0.0.1:8081/ws → variable absente au build
#    → corrige dans Settings → Environment Variables, puis REDeploy avec cache vidé

# 3. Le rewrite /api fonctionne-t-il ? (piège 4)
curl -I https://{{DOMAINE}}/api/health
# → 200   ✅   |  404 → API_BASE_URL absente ou fausse AU BUILD

# 4. Vrai rendu serveur (pas juste une page shell)
curl -s https://{{DOMAINE}} | grep -c '<body'
# → >= 1   ✅ : le HTML a bien été rendu
```

Dans le navigateur :
1. `https://{{DOMAINE}}` → **padlock** + carte affichée avec ses marqueurs.
2. F12 → **Console** → aucune ligne `Mixed Content` ni `WebSocket connection ... failed`.
3. F12 → **Réseau** → appels `/api/*` en **200**.
4. Teste le **temps réel** (deux fenêtres) : si le WS est mal configuré, il **ne se passera rien**,
   sans erreur — d'où l'importance du test 2 ci-dessus.

---

## Dépannage

### Erreur 1 — `Permission denied` / `EACCES` pendant le build

**Cause :** une étape tente d'écrire dans un dossier en lecture seule, ou tente de modifier un
fichier enracine (`package.json`, `.next/...`).

**Fix :**
1. Ouvre **Deployments → clic sur le build échoué → Build Logs**.
2. Cherche la **première** ligne contenant `error` (les suivantes n'en sont que la conséquence).
3. Causes fréquentes :
   - écriture dans la racine du projet → utilise `os.tmpdir()` côté Node ;
   - script `postbuild` qui `chmod` un fichier → retire-le (Vercel contrôle les permissions) ;
   - `EACCES` sur `~/.npm` → cache npm : ajoute la variable
     `NPM_CONFIG_CACHE=/tmp/.npm-cache` dans *Environment Variables*, puis **redeploy**.

**À ne pas faire :** « corriger » en mettant des `chmod 777` dans le build — ça marche en local
et reste interdit chez Vercel.

### Erreur 2 — Port déjà utilisé / `EADDRINUSE` / « une fonction écoute sur 3000 »

**Cause :** ton code essaie de **lancer lui-même un serveur** pendant le build ou dans une
fonction (`next start`, `node server.js`, un service WS sur 8081). Chez Vercel, **on ne choisit
pas le port** : c'est la plateforme qui donne un port à chaque invocation de fonction.

**Fix :**
- **Build command** = `npm run build` **uniquement** (pas `&& node server.js`, pas `next start`).
- Le service **WebSocket** n'a pas sa place ici : héberge-le sur un VPS
  ([`../coolify/README.md`](../coolify/README.md)) et donne son URL à `NEXT_PUBLIC_WS_URL`.
- Si c'est un ancien process qui bloque **sur ta machine** (utilisation de la CLI `vercel dev`) :
  ```bash
  # PowerShell
  Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object OwningProcess
  Stop-Process -Id <PID> -Force
  ```

### Erreur 3 — DNS non propagé : domaine en `Invalid Configuration`

**Cause :** les enregistrements DNS ne sont pas encore visibles quand Vercel vérifie le domaine,
ou ils sont mal renseignés.

**Fix :**
```bash
nslookup {{DOMAINE}}
# attendu : A 76.76.21.21  (ou CNAME www → cname.vercel-dns.com)
nslookup -type=NS {{DOMAINE}}   # vérifie auprès de quels serveurs de noms le domaine répond
```
1. Corrige le type (**A**, pas **CNAME** pour `@`) et la valeur chez ton registrar.
2. **Attends** : 5 min à 24 h (médiane 10-30 min).
3. Vercel → **Settings → Domains** → l'état passe à **Valid** ; si besoin, clique **Refresh**.
4. ⚠️ Let's Encrypt limite à **5 tentatives/heure** : en cas de rate limit, **attends 1 h**.

### Les autres cas

| Symptôme | Cause | Correction |
|---|---|---|
| Variables « non prises » en prod | Piège 1 : injectées **au build** | *Deployments → ⋯ → Redeploy* **en décochant le cache** (un redeploy avec cache republie l'ancien JS) |
| `/api/*` → 404 | `API_BASE_URL` absente/fausse au build | Corrige dans *Environment Variables* → **Redeploy** sans cache |
| Site buildé mais **page blanche** | `/_next/static/...` en 404 | F12 → Réseau : vérifie le **Framework Preset = Next.js** (étape 1) — un preset « Other » publie les mauvais fichiers |
| `Function timed out` | Traitement trop long dans une fonction | Raccourcis la fonction, ou déplace le traitement sur le backend / un Vercel Cron |
| Build échoue sur un prerender (`Error occurred prerendering page`) | Bug **Turbopack** connu du projet | **Settings → General → Build & Development → Build Command** → `npm run build -- --webpack` (le `--` passe l'argument à Next.js, pas à npm) |
| Le temps réel ne marche **jamais** | Piège 5 : `NEXT_PUBLIC_WS_URL` vide ou service WS introuvable | Vercel **ne peut pas** héberger le service 8081 → VPS + `wss://{{DOMAINE_WS}}/ws` |
