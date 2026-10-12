# 04 — Vérifier le déploiement et dépanner

**Prérequis :** étapes 1 à 9 de [`README.md`](./README.md) terminées (site théoriquement en ligne).

---

## Objectif

1. **Prouver** que la mise en prod a marché (et pas seulement « ça a l'air de marcher »).
2. Savoir **où regarder** quand quelque chose ne va pas, et corriger les 4 pannes récurrentes
   de ce projet : build qui échoue, 502, site vide, variables ignorées.

---

## Prérequis

- Accès SSH au VPS : `ssh root@{{IP_SERVEUR}}` (ou `ssh deploy@{{IP_SERVEUR}}` + `sudo`).
- Ou accès à l'UI Coolify : `http://{{IP_SERVEUR}}:8000`.

---

## Étapes de vérification

> ℹ️ Les commandes `docker ps --format '...{{.Names}}...'` utilisent la **syntaxe de templating de
> Docker** (Go template), **pas** les placeholders de ce kit. **Ne remplace pas** `{{.Names}}`,
> `{{.Status}}`, `{{.Ports}}`, `{{.State.StartedAt}}` ni `{{.RestartCount}}` : recolle tel quel.

### 1. Le site répond-il en HTTPS avec un certificat valide ?

Depuis **ton ordinateur** (pas le serveur — il faut un test extérieur) :

```bash
curl -I https://{{DOMAINE}}
```

**Sortie attendue :**
```
HTTP/2 200
content-type: text/html; charset=utf-8
```

| Ce que tu vois | Signification | Action |
|---|---|---|
| `HTTP/2 200` | ✅ Tout va | Passer à la vérif. 2 |
| `301 Moved Permanently` | Redirection HTTP→HTTPS | Normal : refaire avec `http://{{DOMAINE}}` pour confirmer qu'elle pointe bien vers HTTPS |
| `502 Bad Gateway` | Traefik ne trouve **personne** derrière (mauvais port ou conteneur arrêté) | Voir « Panne 3 » ci-dessous |
| `503 Service Unavailable` | Conteneur en train de démarrer ou en crash-loop | Logs (étape 2) |
| `404 Not Found` | Traefik répond, mais le serveur Next ne trouve pas la page → mauvais dossier standalone | Voir « Panne 2 » |
| `SSL certificate problem` | Certificat absent ou expiré | Vérifier le DNS (étape 5) |

**Vérifier le certificat en détail :**
```bash
echo | openssl s_client -connect {{DOMAINE}}:443 -servername {{DOMAINE}} 2>/dev/null | openssl x509 -noout -dates
```
**Sortie attendue :** `notAfter=` avec une date **future** (Let's Encrypt émet pour 90 jours et
renouvelle ~30 jours avant expiration, **tout seul**).

### 2. Le conteneur est-il « healthy » ?

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```
**Sortie attendue :**
```
NAMES             STATUS                   PORTS
coolify-xxxx-yyy   Up 6 minutes (healthy)   0.0.0.0:3000->3000/tcp
```
- `(healthy)` = le **healthcheck** du `Dockerfile` a réussi : le serveur répond vraiment.
- `(unhealthy)` = 3 échecs consécutifs → le site est **tombé**. Voir les logs.
- Pas de ligne du tout = le conteneur n'a jamais démarré → onglet **Build Logs** dans Coolify.

### 3. Les logs (là où se trouve 90 % des réponses)

**Méthode A — UI Coolify** (la plus simple) : ressource → onglet **Logs**.
- **Build Logs** = ce qui s'est passé pendant `npm ci` / `npm run build` → c'est là que sont les erreurs de build.
- **Runtime Logs** = ce que `node server.js` écrit maintenant → c'est là que sont les erreurs de démarrage.

**Méthode B — SSH** :
```bash
# liste des conteneurs, même arrêtés (utile pour trouver le bon nom)
docker ps -a

# logs EN DIRECT du conteneur du frontend (Ctrl+C pour sortir)
docker logs -f --tail 100 <nom_du_conteneur>

# logs des 15 dernières minutes, avec horodatage (pour reconstituer un incident)
docker logs --since 15m --timestamps <nom_du_conteneur>

# le conteneur a-t-il CRASHÉ puis redémarré ? (preuve d'un crash-loop)
docker inspect --format '{{.State.StartedAt}} restarts={{.RestartCount}}' <nom_du_conteneur>
```

**Méthode C — le reverse proxy** (quand le front est OK mais que Traefik se trompe de cible) :
```bash
docker ps --format '{{.Names}}' | grep -Ei 'traefik|caddy'
docker logs --since 10m <nom_traefik_ou_caddy> 2>&1 | tail -50
```
Tu y leras notamment `acme: obtaining certificate failed` quand le DNS n'est pas bon.

### 4. Les variables sont-elles réellement dans le JS livré ?

Teste **le résultat**, pas la configuration (un champ rempli dans l'UI ne prouve rien) :

```bash
# Piège 5 — URL WebSocket
curl -s https://{{DOMAINE}} | grep -o 'wss://[^"]*' | head -1
#  attendu : wss://{{DOMAINE_WS}}/ws
#  obtenu ws://127.0.0.1:8081/ws → variable absente AU BUILD → Rebuild

# Piège 4 — le rewrite /api
curl -I https://{{DOMAINE}}/api/health
#  attendu : 200   (404 → API_BASE_URL vide ou fausse au build)
```

### 5. Le DNS et la certificaison

```bash
# depuis le VPS — c'est LUI qui doit résoudre, pas ton PC
nslookup {{DOMAINE}} 1.1.1.1
#  attendu : Address: {{IP_SERVEUR}}

# le port 80 est-il ouvert ? (indispensable pour la validation HTTP-01 de Let's Encrypt)
sudo ufw status | grep -E '(80|443)'
#  attendu : 80/tcp ALLOW, 443/tcp ALLOW
```

### 6. La checklist navigateur (la seule qui compte vraiment)

1. Ouvre `https://{{DOMAINE}}` → **padlock** présent dans la barre d'adresse.
2. La **carte** s'affiche avec ses marqueurs.
3. **F12** → onglet **Console** → **zéro** ligne rouge, en particulier aucune :
   - `Mixed Content: ... requested an insecure resource` (piège 3 ou 5)
   - `WebSocket connection to 'ws://...' failed` (piège 5)
   - `Failed to load resource: 404` sur `/api/...` (piège 4)
4. **F12** → onglet **Réseau** → recharger → les appels `/api/*` sont en **200**.
5. Fais une **action qui utilise le temps réel** (deux fenêtres ouvertes) : si le changement
   apparaît instantanément d'une fenêtre à l'autre, le WebSocket tourne.

---

## Table des valeurs à personnaliser

| Placeholder | Exemple | Où trouver la valeur |
|---|---|---|
| `{{DOMAINE}}` | `app.exemple.fr` | Ta zone DNS → enregistrement A `@` |
| `{{DOMAINE_API}}` | `api.exemple.fr` | Domaine du backend (variable `API_BASE_URL`) |
| `{{DOMAINE_WS}}` | `ws.exemple.fr` | Domaine du service WS (variable `NEXT_PUBLIC_WS_URL`) |
| `{{IP_SERVEUR}}` | `203.0.113.42` | Contabo → Client Area → IPv4 |
| `{{PORT}}` | `3000` | Port du frontend ; 8081 WS, 8000 UI Coolify, 6002 terminal |
| `{{NOM_PROJET}}` / `{{EMAIL_ADMIN}}` | `medisecours` / `admin@exemple.fr` | Nom du projet / compte admin Coolify |

---

## Dépannage

### Panne 1 — Le build échoue (`npm run build` plante dans les Build Logs)

**Cause 1a — Mémoire insuffisante : `Killed`, `exit code 137`, ou `JavaScript heap out of memory`.**
Le kernel a tué le process parce que la RAM (ou le swap) était épuisée.

```bash
# sur le VPS — le swap du script 01 est-il bien là ?
free -h
swapon --show
#  attendu : une ligne Swap:  4.0Gi  (si "(none)" ou vide → le script 01 n'a pas été exécuté,
#            ou le serveur a redémarré sans /etc/fstab — relance bash 01-preparer-le-vps.sh)

# ça se passe vraiment pendant le build ?
docker stats --no-stream
#  colonne MEM : le conteneur de build qui monte à 100 % de la RAM totale = la cause
```
**Solutions, dans l'ordre :**
1. **Swap 4 Go** : s'il manque, c'est ça → script 01.
2. **Passe le VPS à 8 Go** (Contabo → Client Area → Resize) si le build dépasse encore.
3. En dernier recours, limite la concurrence webpack dans le `Dockerfile` :
   `ENV NEXT_TELEMETRY_DISABLED=1` est déjà là ; ajoute au besoin
   `RUN npm run build -- --webpack` (voir cause 1c) qui consomme souvent moins que Turbopack
   sur les gros prerenders.

**Cause 1b — Cache npm cassé : `npm ci` échoue avec `ERESOLVE` ou `EACCES`.**
```bash
# dans l'onglet Build Logs, cherche la ligne "npm ci"
```
**Solutions :**
- `EACCES` / `EPERM` → c'est un fichier local qui a été copié malgré `.dockerignore`
  (regarde que `node_modules/` et `.env*` y sont bien).
- `ERESOLVE` → conflit de versions dans `package-lock.json` : le lockfile et le
  `package.json` ne sont pas synchrones. Sur ton poste local :
  `npm install --package-lock-only` puis commiter le `package-lock.json` régénéré.
- Build qui « marche chez moi, échoue sur le serveur » → c'est presque toujours le
  **lockfile non committé** ou un `.env` local présent seulement chez toi (les vars de build
  doivent venir des **Build Args** de Coolify, jamais d'un `.env` de dev).

**Cause 1c — Bug Turbopack sur les prerenders : `Error occurred prerendering page` / erreur `turbopack`.**
**Cause connue du projet** : Turbopack (bundleur par défaut de Next.js 16) plante sur certains
pages statiques pendant la phase de prerender.
**Fix :** force webpack dans le `Dockerfile` de ton projet :
```dockerfile
# remplace : RUN npm run build
RUN npm run build -- --webpack
```
Le `--` est nécessaire : il indique à `npm` de passer le reste **à Next.js**, pas à npm lui-même.
Puis **Rebuild** dans Coolify.

**Cause 1d — `.next/standalone/server.js introuvable`.**
Le `output: 'standalone'` n'est pas actif : ouvre `next.config.mjs` et vérifie la ligne
`output: 'standalone'`. Sans elle, rien n'est produit à l'étape RUN du `Dockerfile`.

### Panne 2 — Le site est vide / blanc / `404 Not Found`

**Cause :** le conteneur tourne, le port 3000 répond, mais **les bons dossiers n'ont pas été
copiés** dans l'image. C'est le piège n°2.

```bash
docker exec -it <nom_du_conteneur> ls -la /app
docker exec -it <nom_du_conteneur> ls -la /app/.next/static
docker exec -it <nom_du_conteneur> ls -la /app/public
```
**Sortie attendue :**
```
/app/server.js            ← présent = standalone OK
/app/.next/static/chunks/ ← PRÉSENT ET NON VIDE (sinon : page blanche, JS qui ne se charge pas)
/app/public/favicon.ico   ← présent (sinon : favicon en 404)
```

| Ce qui manque | Symptôme | Correction |
|---|---|---|
| `server.js` à `/app` | `Cannot find module ... server.js` au démarrage | Vérifier `output: 'standalone'` dans `next.config.mjs` |
| `.next/static` | HTML servi mais **page blanche**, aucun clic ne marche | La ligne `COPY --from=build ... /.next/static` du Dockerfile |
| `public` | Favicon/images en 404 | La ligne `COPY --from=build ... /public` |
| Le sous-dossier d'un monorepo | `server.js` introuvable **dans** `/app` mais présent dans `/app/medisecours-frontend/` | Adapter les 3 `COPY` d'un cran : `/app/.next/standalone/medisecours-frontend/` → `./` |

**Test rapide de la difference :**
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://{{DOMAINE}}
#  200 : HTML servi  |  404 : route inexistante  |  502 : personne derrière
```

### Panne 3 — `502 Bad Gateway`

**Cause :** Traefik/Caddy **ne trouve aucun conteneur** sur le port auquel il a été dit
d'envoyer la requête. Il n'y a que 3 raisons possibles :

**3a — Mauvais port exposé (la plus fréquente).**
```bash
# le port annoncé à Traefik :
#   UI Coolify → ressource → Network → "Ports Exposes"
#   doit valoir 3000, et RIEN d'autre (pas 80, pas 8080)
docker port <nom_du_conteneur>
# attendu : 3000/tcp -> 0.0.0.0:3000
```
→ Corrige le champ à **3000**, **Save**, **Restart**.

**3b — Le conteneur est arrêté ou en crash-loop.**
```bash
docker ps -a
docker logs --tail 50 <nom_du_conteneur>
```
→ Regarde la dernière ligne des logs : c'est l'erreur fatale. Corrige, puis **Rebuild**.

**3c — Le domaine n'est pas déclaré dans Coolify.**
Si le champ **DOMAINS** est vide ou sans `https://`, Traefik n'a aucune règle de routage pour
`{{DOMAINE}}` → il renvoie 502 (ou sa page par défaut).
→ *Network* → `https://{{DOMAINE}}` → Save → Restart.

### Panne 4 — Variables non prises en compte (site OK mais carte/WS/API morts)

**Cause unique et absolue : la valeur n'était pas présente au moment où `next build` s'est exécuté.**
`next build` **recopie** les `NEXT_PUBLIC_*` **dans le code JavaScript**. Après coup, c'est écrit
dans le béton : ni un redémarrage, ni un nouvel `.env`, ni un changement dans l'UI ne modifient
le JS déjà compilé.

**Checklist, dans l'ordre :**
1. La variable est-elle **bien enregistrée** dans Coolify → onglet **Variables** → **Save** ?
   (Un oubli de clic sur Save = variable perdue, et l'UI ne le dit pas.)
2. Son nom est-il **identique**, caractère pour caractère, à celui du `ARG` du Dockerfile ?
   (`NEXT_PUBLIC_WS_URL` ≠ `NEXT_PUBLIC_WSURL` → silencieusement vide.)
3. Ta valeur est-elle correcte ?
   - `NEXT_PUBLIC_WS_URL` doit commencer par **`wss://`** et finir par **`/ws`**.
   - `API_BASE_URL` doit commencer par **`https://`** (sinon mixed content sur les appels serveur).
   - `NEXT_PUBLIC_API_BASE_URL` doit être **VIDE** en prod.
4. As-tu cliqué **Rebuild** (et pas **Restart**) après le changement ?
5. **Vérifie le résultat**, jamais la config :
   ```bash
   curl -s https://{{DOMAINE}} | grep -o 'wss://[^"]*' | head -1
   ```
   → si ce n'est pas `wss://{{DOMAINE_WS}}/ws`, retour à l'étape 1.

### Panne 5 — Certificat HTTPS refusé / `Could not obtain certificate`

```bash
nslookup {{DOMAINE}} 1.1.1.1       # → Address: {{IP_SERVEUR}} ?
sudo ufw status | grep 80          # → 80/tcp ALLOW ?
```
- **DNS faux ou non propagé** → corrige l'enregistrement A, attends (5 min à 24 h),
  puis **Restart** la ressource dans Coolify.
- **Port 80 fermé** → `sudo ufw allow 80/tcp` (script 01, étape 3) : Let's Encrypt ne peut pas
  valider par HTTP-01.
- **Rate limit** (`urn:ietf:params:acme:error:rateLimited`) → Let's Encrypt n'autorise que
  **5 échecs par heure**. **Attends 60 minutes**, ne réessaie pas avant.

---

## Vérification finale (à garder sous la main)

```bash
# --- depuis ton ordinateur ---
curl -I https://{{DOMAINE}}                                   # 200 + certificat
curl -s https://{{DOMAINE}} | grep -o 'wss://[^"]*' | head -1  # wss://{{DOMAINE_WS}}/ws
curl -I https://{{DOMAINE}}/api/health                          # 200

# --- depuis le VPS ---
docker ps --format 'table {{.Names}}\t{{.Status}}'             # (healthy)
docker logs --tail 20 <nom_du_conteneur>                        # pas de stack trace
```

Tout au vert = la mise en prod est **réellement** faite. Un build qui passe **ne prouve pas**
un site fonctionnel : seuls ces 5 tests le prouvent.
