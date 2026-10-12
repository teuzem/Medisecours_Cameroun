# Mise en production du frontend {{NOM_PROJET}}

Kit de déploiement **réutilisible, en français, sans IA ni documentation en ligne** pour le
frontend **Next.js 16 / React 19** de {{NOM_PROJET}}.

Chaque commande est à copier-coller telle quelle. Chaque commentaire dit **ce que fait la ligne**,
**pourquoi elle existe** et **ce que ton serveur va faire concrètement**.

---

## Objectif

Te faire déployer le frontend en production **une seule fois**, proprement, en comprenant ce qui se
passe, pour que tu puisses le refaire seul sur un autre projet.

Concrètement, à la fin de la procédure :

- le site répond en **HTTPS** sur `https://{{DOMAINE}}` (padlock vert dans le navigateur) ;
- les variables `NEXT_PUBLIC_*` sont **prises en compte** (sinon la carte et les WebSockets sont
  mortes silencieusement, voir les 5 pièges plus bas) ;
- un simple `git push` sur la branche `main` **redéploie automatiquement** le site (Coolify) ;
- tu sais **où regarder** quand ça casse (logs, healthcheck, dépannage).

---

## Prérequis

- Un ordinateur Windows, macOS ou Linux avec accès à Internet.
- Un compte **GitHub** où se trouve le code du frontend (hébergé, par ex. `{{NOM_PROJET}}/medisecours-frontend`).
- Un **nom de domaine** déjà acheté (OVH, Gandi, Namecheap, Hostinger…), avec accès aux **enregistrements DNS**.
- Un compte bancaire pour l'hébergeur (les offres Netlify/Vercel ont une gratuité suffisante pour démarrer).
- **1 à 2 heures** devant toi pour la première mise en production.
- **Aucune** connaissance Linux, Docker ou cloud n'est requise : les scripts font tout, tu copies-colles.

> **Versions retenues et pourquoi** : **Ubuntu 24.04 LTS**, **Node 22**, **Next.js 16**.
> - Ubuntu 24.04 = version **LTS** (Long Term Support) : mises à jour de sécurité garanties jusqu'en **avril 2029**, donc pas de surprise dans 2 ans.
> - Node 22 = version **LTS** en active : c'est celle que supportent officiellement Next.js 16 et les plugins de build ; une version plus vieille casse le build, une plus récente n'apporte rien de stable.
> - Next.js 16 = version du projet, avec `output: 'standalone'` (voir pièce n°2).

---

## Arborescence de ce dossier

```
deploiement/frontend/
├── README.md                        ← CE FICHIER : index, comparatif des 4 hébergeurs, les 5 pièges
├── variables-a-definir.example.txt  ← la liste des variables de build, avec la valeur attendue
├── coolify/                         ← OPTION 1 : VPS + Coolify  (RECOMMANDÉ pour ce projet)
│   ├── README.md                    ← procédure complète de bout en bout (achat VPS → site en ligne)
│   ├── 01-preparer-le-vps.sh        ← script exécuté en root : swap, pare-feu, SSH, utilisateur
│   ├── 02-installer-coolify.sh      ← installe Docker + Coolify d'un seul trait
│   ├── 03-creer-projet-coolify.md   ← pas-à-pas dans l'interface web de Coolify
│   ├── 04-verifier-et-depanner.md   ← vérification + dépannage ciblé
│   ├── Dockerfile                   ← l'image Docker du frontend (build standalone)
│   └── .dockerignore                ← ce qu'on exclut de l'image et pourquoi
├── hostinger/                       ← OPTION 2 : hébergement mutualisé (limites réelles)
│   ├── README.md                    ← procédure hPanel + les 2 cas possibles
│   └── .htaccess                    ← configuration Apache pour une app statique
├── netlify/                         ← OPTION 3 : Netlify (le plus rapide)
│   ├── README.md                    ← connexion du repo, build, variables, domaine, rollback
│   ├── netlify.toml                 ← configuration de build + en-têtes de sécurité
│   ├── _redirects                   ← règles de réécriture / redirections
│   └── _headers                     ← en-têtes de sécurité + stratégie de cache
└── vercel/                          ← OPTION 4 : Vercel (l'équipe Next.js)
    └── README.md                    ← connexion du repo, régions, previews, limites
```

---

## Tableau comparatif des 4 hébergeurs

| Hébergeur | Coût réel | Difficulté | Cas d'usage | Délai | Sous-dossier à ouvrir |
|---|---|---|---|---|---|
| **Coolify + VPS Contabo** | ~12 €/mois (VPS 8 Go RAM) + domaine ~10 €/an | **Moyen** (tu copies-colles des scripts, pas besoin de savoir Linux) | **Production complète** : SSR, WebSockets (`wss://`), carte, API en same-origin, auto-déploiement au push | 1 h 30 – 2 h | `coolify/` |
| **Hostinger mutualisé** | 3 – 5 €/mois | **Facile** (glisser-déposer dans un gestionnaire de fichiers) | App **statique** uniquement (`output: 'export'`), **sans** SSR ni WebSocket côté serveur | 30 min | `hostinger/` |
| **Netlify** | 0 € (100 Go/mois) → 19 €/mois Pro | **Très facile** (connexion du repo GitHub) | SSR sans WebSocket longue durée, **previews par Pull Request**, rollback en 1 clic | 15 min | `netlify/` |
| **Vercel** | 0 € (dev) → 20 €/mois Pro | **Très facile** (détection auto du framework Next.js) | SSR + serverless, previews, **pas** de service WebSocket natif | 15 min | `vercel/` |

**Lequel choisir, en une phrase :**

- Tu veux **WebSockets + carte + contrôle total, à coût maîtrisé** → **Coolify + VPS** (c'est la seule option du tableau qui fait tourner les 2 services du projet : frontend 3000 **et** service WS 8081).
- Tu veux **mettre en ligne ce soir, gratuitement, sans WebSocket** → **Netlify** (le plus simple avec previews PR).
- Tu es déjà dans l'écosystème Vercel / tu veux le rendu serveur géré pour toi → **Vercel**.
- Tu es chez **Hostinger en mutualisé** et tu ne veux pas de VPS → **Hostinger**, mais **uniquement** si tu passes le frontend en export statique (voir `hostinger/README.md`, cas n°1).

---

## Les 5 pièges qui cassent une mise en prod Next.js

Ce sont exactement les 5 façons dont ce projet échoue en production. Comprends-les **avant** de déployer.

### Piège 1 — Les variables `NEXT_PUBLIC_*` sont injectées **à la construction**, pas à l'exécution

`next build` **recopie la valeur** de chaque `NEXT_PUBLIC_*` **à l'intérieur du code JavaScript** livré au navigateur.
Une fois le build terminé, **changer un fichier `.env` ne change absolument rien** : le JS embarqué dans
`.next/static` contient encore l'ancienne valeur.

```bash
# En local, ça ne se voit pas car tu relances "npm run dev" à chaque changement.
# En prod, il faut RE-BUILDER : dans Coolify, bouton "Rebuild" (pas "Restart").
```

Variables concernées ici : `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`,
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`.

### Piège 2 — `output: 'standalone'` : il n'y a PAS d'app Next complète dans l'image

Dans `next.config.mjs`, l'option `output: 'standalone'` fait générer `.next/standalone/` :
un dossier **auto-suffisant** contenant `server.js` + `node_modules` réduits au strict nécessaire.
Le serveur tourne avec `node server.js` (léger, ~50 Mo de RAM en moins que `next start` complet).

Conséquence : l'image Docker ne contient que `.next/standalone` + `.next/static` + `public`.
Si tu copies les mauvais dossiers → **site blanc** (voir `coolify/04-verifier-et-depanner.md`).

### Piège 3 — Mixed content : `NEXT_PUBLIC_API_BASE_URL` doit rester **VIDE** en prod

En production, la page est servie en **HTTPS**. Si elle appelle l'API via une URL **HTTP** (ou une
URL de dev), le navigateur **bloque la requête** (erreur « mixed content ») et ta console affiche :
`Mixed Content: The page was loaded over HTTPS, but requested an insecure resource`.

En prod, la page appelle l'API en **same-origin** : elle écrit `/api/...`, et le **rewrite** du
`next.config.mjs` (piège 4) renvoie la requête vers le backend. **Donc `NEXT_PUBLIC_API_BASE_URL` = vide.**

### Piège 4 — Le rewrite `/api/:path*` dépend de `API_BASE_URL`, lue **au build**

`next.config.mjs` lit `API_BASE_URL` **au moment du build** pour créer la règle
`/api/:path* → {{DOMAINE_API}}/api/:path*`. C'est ce qui évite le mixed content du piège 3 :
le navigateur ne parle qu'à `https://{{DOMAINE}}`, c'est le serveur Next qui parle au backend.

Si `API_BASE_URL` est vide au build → **toutes les requêtes `/api/*` renvoient 404** et la raison
n'apparaît nulle part dans les logs côté client. En prod, sa valeur doit être **HTTPS** :
`https://{{DOMAINE_API}}`.

### Piège 5 — Le WebSocket a besoin d'une URL **ABSOLUE** `wss://` fournie au build

Le service des temps réel tourne sur un **service Node séparé** (port **8081**, chemin `/ws`).
Le frontend se connecte sur l'URL dans `NEXT_PUBLIC_WS_URL`.

- **Sans cette variable au build**, le code retombe sur `ws://127.0.0.1:8081/ws`.
  En production, `127.0.0.1` c'est **le serveur lui-même**, pas le navigateur du visiteur :
  la connexion échoue **silencieusement** (pas d'erreur rouge, juste plus de temps réel).
- **Avec `ws://` au lieu de `wss://`** sur une page HTTPS : le navigateur **refuse** la connexion
  (mixed content) — pareil, sans erreur explicite.

La bonne valeur en prod : `wss://{{DOMAINE_WS}}/ws` (note le **`s`** de `wss`).

---

## Étapes

### 1. Choisir ton hébergeur

Reprends le tableau comparatif plus haut. Pour **ce projet avec ses WebSockets**, la seule option
« complète » est **Coolify + VPS**. Choisis selon ton besoin, puis ouvre **un seul** sous-dossier.

### 2. Remplacer les placeholders

Tous les fichiers de ce kit utilisent la convention `{{NOM_PROJET}}`, `{{DOMAINE}}`, etc.
**Ouvre ton éditeur de texte** (VS Code, Notepad++) et fais un *Rechercher → Remplacer dans tous les
fichiers* sur le dossier `deploiement/frontend/`, en remplaçant chaque placeholder par ta valeur
(voir le tableau ci-dessous).

> ⚠️ **Les fichiers de configuration ne sont PAS remplacés automatiquement.** Un `.htaccess`,
> un `netlify.toml`, un `_headers` ou un `_redirects` lu par Apache/Netlify ne « passe » jamais
> par un moteur de templates : si tu laisses `{{DOMAINE}}` dedans, la règle ne s'appliquera tout
> simplement pas. **Remplace à la main, puis relis le fichier avant de commiter.**
>
> ⚠️ **Exception à ne pas confondre :** les commandes Docker écrites `{{.Names}}`,
> `{{.Status}}`, `{{.Ports}}` sont la **syntaxe de Docker** (templating Go), pas un placeholder
> de ce kit. **Ne les remplace pas** — recolle la commande telle quelle.

### 3. Suivre le README du sous-dossier

Chaque README suit le même plan : Objectif → Prérequis → Étapes numérotées (copier-coller, avec la
sortie attendue) → Table des valeurs à personnaliser → Vérification → Dépannage.

### 4. Vérifier (voir section suivante) puis pousser

Une fois la première mise en ligne faite, vérifie les 4 points de la section Vérification.

---

## Table des valeurs à personnaliser

| Placeholder | Exemple de valeur | Où trouver la valeur |
|---|---|---|
| `{{NOM_PROJET}}` | `medisecours` | Le nom du projet / le nom du dépôt GitHub, ex. `https://github.com/{{NOM_PROJET}}/medisecours-frontend` |
| `{{DOMAINE}}` | `app.exemple.fr` | Le domaine **racine** du frontend. Chez ton registrar (OVH, Gandi, Hostinger…) → rubrique **DNS / Zone DNS**. Enregistrement **A** pointant vers `{{IP_SERVEUR}}` |
| `{{DOMAINE_API}}` | `api.exemple.fr` | Le domaine du **backend Symfony** (`medisecours-backend`). Déjà en ligne ? sa DNS. Sinon, un enregistrement **A** vers le serveur du backend |
| `{{DOMAINE_WS}}` | `ws.exemple.fr` | Le domaine devant le **service WebSocket** (port 8081, chemin `/ws`). Enregistrement **A** (ou **CNAME**) vers le serveur qui tourne ce service. **Doit être en HTTPS** → la valeur finale est `wss://{{DOMAINE_WS}}/ws` |
| `{{IP_SERVEUR}}` | `203.0.113.42` | L'IPv4 de ton VPS. Chez **Contabo** : client area → tes serveurs → IPv4. Sert à créer les enregistrements DNS **A** |
| `{{EMAIL_ADMIN}}` | `admin@exemple.fr` | Ta boîte mail principale. Utilisée par **Let's Encrypt** (certificats HTTPS) et par les alertes de Coolify |
| `{{PORT}}` | `3000` | Port TCP. Ici : **3000** = frontend Next.js, **8081** = service WebSocket, **8000** = interface web Coolify, **6002** = terminal web Coolify |

Le détail des **variables d'environnement de build** est dans
[`variables-a-definir.example.txt`](./variables-a-definir.example.txt).

---

## Vérification

À exécuter **après** le déploiement, quel que soit l'hébergeur. Ouvre un terminal
(Windows : `cmd` ou PowerShell ; macOS/Linux : Terminal) et copie-colle.

```bash
# 1. Le site répond-il en HTTPS avec un certificat valide ?
curl -I https://{{DOMAINE}}
```
**Sortie attendue :** `HTTP/2 200` (ou `HTTP/1.1 200`). Si tu vois `301`, c'est la redirection
HTTP→HTTPS : refaire avec `http://{{DOMAINE}}` pour confirmer qu'elle pointe bien vers la version HTTPS.

```bash
# 2. Le JS embarqué contient-il la bonne URL de WebSocket ? (piège 5)
curl -s https://{{DOMAINE}} | grep -o 'wss://[^"]*' | head -1
```
**Sortie attendue :** `wss://{{DOMAINE_WS}}/ws`. Si c'est `ws://127.0.0.1:8081/ws`, **la variable
n'a pas été injectée au build → il faut RE-BUILDER** (piège 1).

```bash
# 3. L'API est-elle bien routée (piège 4) ?
curl -I https://{{DOMAINE}}/api/health
```
**Sortie attendue :** `200`. Si tu obtiens `404` alors que le backend répond sur `https://{{DOMAINE_API}}/api/health`,
c'est `API_BASE_URL` qui était vide ou fausse **au moment du build**.

```bash
# 4. Le service WebSocket répond-il sur son port ?
curl -I http://{{IP_SERVEUR}}:8081/ws
```
**Sortie attendue :** un code d'erreur HTTP type `400`/`426`/`101` — **c'est normal** : `curl` ne fait
pas la « poignée de main » WebSocket. Ce qui compte, c'est que la connexion ne soit **pas refusée**
(`Connection refused` = le service ne tourne pas).

Dans le navigateur (dernière étape, celle qui compte) :

1. Ouvre `https://{{DOMAINE}}` → le **padlock** est présent, la carte s'affiche avec les marqueurs.
2. F12 → onglet **Console** → aucune erreur `Mixed Content` ni `WebSocket connection to ... failed`.
3. F12 → onglet **Réseau** → les appels `/api/*` sont en **200**, pas en 404.

---

## Dépannage

Les 3 erreurs les plus probables **au niveau de ce dossier**, puis les points d'entrée du dépannage
détaillé par hébergeur.

### Erreur 1 — `Permission denied` (ou `sudo: ... command not found`)

**Cause :** tu exécutes un script en utilisateur normal alors qu'il touche au système
(`/etc/fstab`, `ufw`, `/etc/ssh`), ou ton utilisateur n'a pas les droits sudo.

**Solution :** relance avec `sudo` :
```bash
sudo bash 01-preparer-le-vps.sh
```
Si tu es **déjà root** et que tu as `Permission denied` sur un fichier, c'est probablement un
fichier Windows (le télédéchargement a gardé des attributions) : `chmod +x 01-preparer-le-vps.sh`.

### Erreur 2 — Port déjà utilisé (`address already in use`, `Bind: address already in use`)

**Cause :** un process écoute **déjà** sur le port demandé : 3000 (un `npm run dev` oublié, ou un
ancien conteneur), 8000 (Coolify déjà installé), 8081 (ancien service WS).

**Solution :** trouve le coupable, puis arrête-le :
```bash
sudo ss -lntp | grep -E ':(3000|8081|8000)'
# colonne USERS : le nom du process ; PID = son numéro de process
sudo kill <PID>
```
Ensuite relance ta commande. Un `docker ps` est aussi utile si le coupable est un ancien conteneur.

### Erreur 3 — `DNS` non propagé (`Could not resolve {{DOMAINE}}`, `Hostname has no address`)

**Cause :** l'enregistrement DNS A vient d'être créé : les serveurs de DNS du monde entier mettent
jusqu'à **24 h** à le voir (en général 5 à 60 minutes).

**Solution :** vérifie la propagation, **depuis tes 2 machines** (le DNS de ton PC peut être déjà à jour
alors que celui du serveur ne l'est pas) :
```bash
# Sur ta machine locale
nslookup {{DOMAINE}}

# Depuis le VPS (là où Coolify demandera le certificat)
nslookup {{DOMAINE}} 1.1.1.1
```
**Sortie attendue :** `Address: {{IP_SERVEUR}}`. Si ce n'est pas le cas : vérifie le **type** (A, pas CNAME),
le **nom** (le domaine exact, pas `www.` par erreur), et **attends**. Ensuite **redémarre** le conteneur
pour que Let's Encrypt retente la demande du certificat.

### Où dépanner ensuite

| Symptôme | Fichier à ouvrir |
|---|---|
| Build qui échoue, site blanc, 502, variables ignorées sur VPS | `coolify/04-verifier-et-depanner.md` |
| Site inaccessible après déploiement Coolify | `coolify/04-verifier-et-depanner.md` |
| Site vide / 404 sur le mutualisé Hostinger | `hostinger/README.md` → section Dépannage |
| Build OK mais variables absentes sur Netlify | `netlify/README.md` → section Dépannage |
| Aperçu de PR qui ne correspond pas à la prod | `vercel/README.md` → section Dépannage |
| Padlock absent / `Not Secure` | certificat HTTPS : `https://certbot.eff.org/` (renouvellement manuel) ou regénérer le certificat depuis Coolify/Netlify/Vercel |
