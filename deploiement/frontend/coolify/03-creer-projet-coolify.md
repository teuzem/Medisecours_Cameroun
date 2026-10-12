# 03 — Créer le projet dans l'interface Coolify (pas-à-pas)

**Prérequis :** étapes 1 à 6 de [`README.md`](./README.md) terminées. Docker + Coolify sont
installés, tu es connecté à l'interface web.

> 📌 Les libellés exacts peuvent varier d'une version de Coolify à l'autre (l'interface évolue
> vite). **Cherche le champ qui porte ce nom**, c'est le même concept : la procédure, elle, ne
> change pas.

---

## Objectif

Dire à Coolify : « voilà mon dépôt GitHub, voilà comment le builder (Dockerfile), voilà les
variables de build, voilà le domaine ». À partir de là, **chaque push sur `main` redéploie le site**.

---

## Étapes

### 1. Créer le projet

1. Menu de gauche → **Projects** (Projets) → **+ New**.
2. **Name** : `{{NOM_PROJET}}` → **Create**.

**Pourquoi un « projet » avant la ressource ?** Un projet Coolify est un **dossier** qui regroupe
plusieurs ressources (ici : le frontend, et plus tard le service WebSocket et le backend). C'est
utile pour partager les mêmes variables entre elles.

### 2. Ajouter une ressource : le dépôt Git

1. Dans le projet → **+ New** (ou **+ New resource**).
2. Choisis **Git Repository**.
3. Deux cas, **choisis LE TIEN** :

#### Cas A — GitHub App (recommandé : auto-déploiement au push, sans rien faire)

1. Sur la liste des sources, clique **GitHub** puis **Install GitHub App**.
2. La page GitHub s'ouvre → choisis ton compte/organisation → **Install** → autorise les dépôts
   (au minimum celui du frontend).
3. Tu reviens dans Coolify → recharge la page → le dépôt apparaît dans la liste → sélectionne-le.

**Ce que ça change :** Coolify s'enregistre comme *application* GitHub et reçoit un **webhook**
(`push`) à chaque commit. L'étape 8 devient automatique.

#### Cas B — Dépôt public + webhook à brancher à la main

1. Colle l'URL : `https://github.com/{{NOM_PROJET}}/medisecours-frontend`
2. Sélectionne la branche **`main`**.

**Ce que ça change :** Coolify clone le dépôt en HTTPS public (pas d'accès aux webhooks), donc
**l'auto-déploiement ne marchera PAS** tant que tu n'as pas branché le webhook (étape 8b).

### 3. Choisir le Build Pack : **Dockerfile**

Coolify te propose plusieurs « build packs » :

| Build Pack | Quand l'utiliser |
|---|---|
| **Dockerfile** ✅ | **Notre cas.** On fournit notre propre image (fichier `Dockerfile` de ce dossier) |
| Nixpacks | Build automatique « à l'aveugle » — il détecterait Node mais **ignorerait** `output: 'standalone'` et tes `ARG` de build |
| Static | Pour du HTML brut, pas pour Next.js SSR |
| Docker Compose | Plusieurs services liés entre eux |

→ Sélectionne **Dockerfile**.

**Où est le fichier ?** Coolify cherche un `Dockerfile` **à la racine du dépôt**. Le fichier
fourni dans ce dossier vit dans `deploiement/frontend/coolify/Dockerfile` : **copie-le à la
racine du dépôt frontend** (le dossier qui contient `package.json` et `next.config.mjs`),
en même temps que `.dockerignore`.

```bash
# depuis la racine du dépôt frontend
cp deploiement/frontend/coolify/Dockerfile ./Dockerfile
cp deploiement/frontend/coolify/.dockerignore ./.dockerignore
git add Dockerfile .dockerignore
git commit -m "build(docker): ajoute le Dockerfile standalone"
git push origin main
```

**Sortie attendue :** les deux fichiers apparaissent dans l'arborescence GitHub à la racine.

> 🔧 Si tu préfères ne **pas** toucher à la racine du dépôt, cherche le champ
> **Dockerfile Location** (ou `Dockerfile Location` / `Build Directory`) dans les paramètres de la
> resource et mets le chemin relatif du fichier. Mais le plus simple reste la copie ci-dessus.

### 4. VARIABLES & SECRETS — les 6 variables de build

Dans la ressource → onglet **Variables** (parfois **Environment Variables** / **Secrets**).
Ajoute **exactement** ces lignes. Les 5 premières sont des **variables de build** : elles sont
recopiées dans le code JS **au moment du build**, donc **elles doivent être en place AVANT le
premier démarrage**, et **toute modification impose un Rebuild** (pas un simple Restart).

| Variable | Valeur en prod | Pourquoi elle existe | Conséquence si elle manque |
|---|---|---|---|
| `API_BASE_URL` | `https://{{DOMAINE_API}}` | Lue par `next.config.mjs` **au build** pour créer le rewrite `/api/:path*`. C'est ce qui fait que le navigateur parle à `https://{{DOMAINE}}` et le serveur Next au backend (**same-origin**, pas de mixed content) | Toutes les requêtes `/api/*` renvoient **404** — et aucun log client ne l'indique |
| `NEXT_PUBLIC_API_BASE_URL` | **vide** (crée la variable, laisse la valeur vide) | URL de l'API vue par le navigateur, utile en dev local uniquement | Si elle contient une URL → la page HTTPS appelle du non-HTTPS → le navigateur **bloque** la requête : erreur « Mixed Content » |
| `NEXT_PUBLIC_WS_URL` | `wss://{{DOMAINE_WS}}/ws` | URL **absolue** du service WebSocket (port 8081, chemin `/ws`) | Repli silencieux sur `ws://127.0.0.1:8081/ws` = **le serveur lui-même** → plus de temps réel, **sans erreur visible** |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | *(clé réelle, en **Secret**)* | Charge la carte Google dans le frontend | Carte grise + erreur console Google Maps |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | *(ex. `123456789-exemple.apps.googleusercontent.com`)* | OAuth « Se connecter avec Google » | Le bouton Google échoue à la connexion |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | *(token réel, en **Secret**)* | Repli carte Mapbox si Google est indisponible | Pas de repli de carte |

**Où trouver les valeurs :**
- `{{DOMAINE_API}}` → le domaine de ton backend (`https://…` obligatoire, sinon mixed content).
- `{{DOMAINE_WS}}` → domaine devant le service WS ; **vérifie qu'il est en HTTPS**, sinon le
  navigateur refusera la connexion `ws://` depuis une page `https://`.
- Les clés Google → https://console.cloud.google.com/ → *APIs & Services → Credentials*.
- Le token Mapbox → https://account.mapbox.com/access-tokens/

**Consignes de sécurité :**
- Colle les clés dans le champ **Secret** (Coolify masque la valeur et l'exclut des logs).
- **Ne jamais** committer ces valeurs dans `.env` sur GitHub. Si c'est déjà fait : **révoque la
  clé** chez le fournisseur et en génère une nouvelle — un secret committé est un secret perdu,
  même si tu le supprimes ensuite (l'historique Git garde tout).

> ⚠️ **Piège n°1 rappelé :** après avoir modifié **une seule** variable, il faut **Rebuild**.
> Un `Restart` ne fait que relancer l'ancien conteneur avec l'ancien code : les `NEXT_PUBLIC_*`
> restent les anciennes. C'est la panne n°1 en prod, et elle ne produit aucun message d'erreur.

### 5. DOMAINS — le domaine et le certificat HTTPS

Dans la ressource → onglet **Network** (ou **Domains**) :

```
Domains : https://{{DOMAINE}}
```

- **Écris `https://` devant.** Sans le protocole, Coolify ne sait pas qu'il doit demander un
  certificat et peut proposer du HTTP simple → **pas de padlock**.
- Tu peux ajouter d'autres alias sur la ligne suivante (ex. `https://www.{{DOMAINE}}`), séparés
  par une virgule ou une espace selon la version.

**Vérifie le DNS AVANT de sauvegarder** (depuis le VPS, c'est la machine qui doit résoudre) :

```bash
nslookup {{DOMAINE}} 1.1.1.1
```
**Sortie attendue :** `Address: {{IP_SERVEUR}}`. Sinon → attends la propagation
(5 min à 24 h, médiane 10-30 min) et **ne lance pas encore le conteneur** : Let's Encrypt
autorise seulement **5 tentatives par heure**, au-delà tu es bloqué 60 min.

### 6. Port exposé : **3000**

Dans **Network** → champ **Ports Exposes** (ou *Exposed Port*) :

```
3000
```

**Pourquoi 3000 :** le `Dockerfile` fait `EXPOSE 3000` et `node server.js` écoute sur 3000.
C'est **le** port du frontend. Si tu laisses autre chose (80, 8080…), Traefik envoie la requête
sur un port où **personne n'écoute** → **502 Bad Gateway**.

*(Le service WebSocket, lui, est une **autre** ressource sur le port **8081** — hors périmètre
de ce fichier, mais le principe est identique.)*

### 7. Healthcheck

Le `Dockerfile` fourni contient déjà :

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"
```

**Ce que ça fait, concrètement :** toutes les 30 s, Docker exécute une vraie requête HTTP **depuis
dans** le conteneur. Si elle échoue 3 fois d'affilée → statut `unhealthy` → l'UI Coolify passe en
rouge et, selon ta config, Coolify **redémarre** le conteneur. C'est ta **surveillance 24 h/24
gratuite** : tu n'as pas besoin d'un outil externe pour savoir que le site est tombé.

Si l'UI propose un champ **Healthcheck path/port** (les versions récentes le font), mets :
- **path** : `/`
- **port** : `3000`

et laisse le reste par défaut.

### 8. Sauvegarder et démarrer

1. **Save** (en bas à droite) — **ne saute jamais cette étape**, sinon tes variables ne sont pas écrites.
2. **Start** (ou l'onglet **Start**).

**Ce qui se passe pendant 2 à 5 minutes** (regarde l'onglet **Build** / **Logs**) :

```
1. git clone du dépôt
2. étape "deps"  : npm ci          (installation, mise en cache des node_modules)
3. étape "build" : npm run build   (next build → .next/standalone)
4. étape "run"   : copie de .next/standalone + .next/static + public → conteneur final
5. docker run    : node server.js sur le port 3000
6. Traefik       : demande du certificat Let's Encrypt → HTTPS actif
```

**Sortie attendue :** statut **Running** + **Healthy**, et `https://{{DOMAINE}}` qui répond.

### 9a. Auto-déploiement — Cas A : GitHub App installée

**Rien à faire.** Push sur `main` → GitHub notifie Coolify → rebuild → redémarrage.
C'est tout l'intérêt du Cas A.

### 9b. Auto-déploiement — Cas B : brancher le webhook à la main

1. Dans Coolify → ta ressource → onglet **Webhook** (parfois *Deploy Webhook* / *Advanced → Webhook*).
   Coolify affiche une URL du type :
   ```
   https://{{DOMAINE}}/api/v1/deploy?uuid=<UUID>&force=yes
   ```
   *(sur une première installation, c'est plutôt `http://{{IP_SERVEUR}}:8000/api/v1/deploy?...`
   tant que le domaine n'est pas déclaré.)*
2. **Copie cette URL** (bouton *Copy*).

**Où la coller — deux possibilités :**

**(b1) Dans GitHub, pour un déploiement automatique à chaque push** — dans ton dépôt GitHub :

```
Settings → Webhooks → Add webhook
  Payload URL   : <l'URL copiée dans Coolify>
  Content type  : application/json
  Which events? : Just the push event
  Active        : ☑
→ Add webhook
```
**Vérification :** GitHub affiche « Recent Deliveries » ; le premier envoi doit afficher une
**croix verte** (réponse 200). Une croix rouge = l'URL est incorrecte ou le port 8000 est bloqué.

**(b2) Dans une GitHub Actions du projet**, si le dépôt en a une : recopie la même URL dans un
secret de workflow :

```
Settings → Secrets and variables → Actions → New repository secret
  Name  : COOLIFY_DEPLOY_URL
  Value : <l'URL copiée dans Coolify>
```
puis dans le workflow, une étape `curl -fsSL -X POST "${{ secrets.COOLIFY_DEPLOY_URL }}"`.
**Pourquoi un secret :** l'URL contient le `uuid` de ta ressource et un `force=yes` — quelqu'un
qui l'aurait pourrait relancer tes builds à volonté (gaspillage de RAM/CPU), donc jamais en clair
dans le YAML.

**Teste :**
```bash
git commit --allow-empty -m "test: declenche le deploy"
git push origin main
```
**Sortie attendue :** Coolify → *Activity* → une nouvelle tâche « Deploy » qui se termine en vert.

---

## Table des valeurs à personnaliser

| Placeholder | Exemple | Où trouver la valeur |
|---|---|---|
| `{{NOM_PROJET}}` | `medisecours` | Nom du dépôt GitHub |
| `{{DOMAINE}}` | `app.exemple.fr` | Registrar → zone DNS → A `@` → `{{IP_SERVEUR}}` ; à coller dans **DOMAINS** avec `https://` devant |
| `{{DOMAINE_API}}` | `api.exemple.fr` | Domaine du backend → variable `API_BASE_URL` = `https://{{DOMAINE_API}}` |
| `{{DOMAINE_WS}}` | `ws.exemple.fr` | Domaine du service WS → variable `NEXT_PUBLIC_WS_URL` = `wss://{{DOMAINE_WS}}/ws` |
| `{{IP_SERVEUR}}` | `203.0.113.42` | Contabo → Client Area → IPv4 ; sert à `nslookup`, au webhook initial et à l'UI `:8000` |
| `{{EMAIL_ADMIN}}` | `admin@exemple.fr` | Compte admin Coolify (premier inscrit) |
| `{{PORT}}` | `3000` | Port exposé de la resource frontend (les autres : 8081 WS, 8000 UI, 6002 terminal) |

---

## Vérification

```bash
# 1. Le site répond en HTTPS ?
curl -I https://{{DOMAINE}}
# → HTTP/2 200        ✅
# → 502 Bad Gateway   ❌ mauvais port exposé (doit être 3000) → étape 6
# → 404 Not Found     ❌ mauvais dossier standalone copié dans le Dockerfile

# 2. Les variables sont-elles dans le JS livré ? (piège 1)
curl -s https://{{DOMAINE}} | grep -o 'wss://[^"]*' | head -1
# → wss://{{DOMAINE_WS}}/ws  ✅   |   ws://127.0.0.1:8081/ws  ❌ → REBUILD

# 3. Le conteneur est-il sain ?
docker ps --format 'table {{.Names}}\t{{.Status}}'
# → Up 5 minutes (healthy)  ✅
```

Dans l'UI Coolify : ressource → **Monitoring** → statut **Running/Healthy**, et l'onglet
**Build Logs** sans ligne rouge.

Dans le navigateur : `https://{{DOMAINE}}` → padlock présent, carte affichée, F12 → Console sans
`Mixed Content`, onglet Réseau → appels `/api/*` en **200**.

---

## Dépannage

### Erreur 1 — `Permission denied` (dans les logs de build ou en SSH)

**Cause :** Docker refuse l'accès au socket `/var/run/docker.sock` à l'utilisateur connecté, ou tu
exécutes un script en non-root.

**Fix :**
```bash
# sur le VPS
sudo usermod -aG docker deploy     # ajoute deploy au groupe docker
exit                                # FERME la session...
ssh root@{{IP_SERVEUR}}             # ...puis RE-OUVRE-la : un groupe ne s'applique
                                    # qu'au prochain login, c'est là que 90% des gens bloquent
docker ps                           # doit répondre sans "permission denied"
```

### Erreur 2 — Port déjà utilisé / `502 Bad Gateway`

**Cause 1 :** le champ **Ports Exposes** n'est pas sur **3000** → Traefik envoie la requête vers
un port mort.
**Fix :** *Network* → `3000` → **Save** → **Restart**.

**Cause 2 :** un autre process occupe déjà le port (ancien conteneur, `npm run dev` oublié).
**Fix :**
```bash
sudo ss -lntp | grep -E ':(3000|8000|8081)'
docker ps -a            # conteneur ancien ?
docker stop <nom> ; docker rm <nom>
```

**Cause 3 :** le build a échoué, donc il n'y a **aucun** conteneur à servir.
**Fix :** onglet **Build Logs** → voir `coolify/04-verifier-et-depanner.md`.

### Erreur 3 — Variables non prises en compte (site en ligne mais carte/WS mortes)

**Cause :** tu as modifié une variable puis cliqué **Restart** au lieu de **Rebuild**. Les
`NEXT_PUBLIC_*` sont **cuites dans le JS au moment du build** : un redémarrage ne change rien au
code déjà compilé.

**Fix :**
1. Vérifie que la variable est **bien enregistrée** (onglet Variables → Save).
2. Clique **Rebuild** (pas *Restart*).
3. Re-teste : `curl -s https://{{DOMAINE}} | grep -o 'wss://[^"]*'`.

> ⚠️ Si le build **passe** mais que les variables sont toujours absentes, c'est que les `ARG`
> du `Dockerfile` ne correspondent pas aux noms des variables (elles doivent être **identiques**,
> caractère pour caractère). Compare `Dockerfile` et onglet Variables.

Les autres symptômes (build OOM, site blanc, certificat, DNS) → **[`04-verifier-et-depanner.md`](./04-verifier-et-depanner.md)**
