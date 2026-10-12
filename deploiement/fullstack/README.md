# Déploiement fullstack: templates réutilisables (Ubuntu 24.04 + Docker + nginx)

## Objectif

Ce dossier est une **boîte à outils de déploiement**. Il contient tout ce qu'il faut
pour mettre en production une application fullstack (frontend + API REST + base de
données + WebSockets optionnel) sur **un seul VPS Ubuntu 24.04 LTS**, sans jamais
avoir touché à la virtualisation ni au cloud.

Tu n'as besoin d'**aucune IA, d'aucune doc en ligne** : chaque fichier explique en
français ce qu'il fait, pourquoi, et ce que le serveur va faire ensuite.

Tu n'as pas non plus besoin de connaître Docker : les fichiers sont déjà écrits, tu
remplaces des valeurs entre doubles accolades (`{{...}}`) et tu lances les scripts.

## Prérequis

1. Un VPS chez un hébergeur (OVH, Hetzner, DigitalOcean, o2switch…) avec :
   - une **adresse IP** (ex : `203.0.113.10`),
   - un **utilisateur** `root` (ou un utilisateur avec les droits sudo),
   - un **mot de passe** ou une clé SSH fournis par l'hébergeur.
2. Un ordinateur Windows, Mac ou Linux avec un terminal (`ssh`).
   - Sous Windows 10/11, `ssh` est intégré à PowerShell.
   - Alternatives graphiques : PuTTY (https://www.putty.org), WinSCP pour les fichiers.
3. Un **nom de domaine** que tu possèdes (ex : `monapp.fr`) avec la possibilité
   d'éditer des enregistrements DNS (chez ton registrar : OVH, Gandar, Infomaniak…).
4. Savoir copier/coller une commande dans un terminal. C'est tout.

## Étapes numérotées (parcours complet)

| Étape | Fichier à ouvrir | Ce que tu fais |
|---|---|---|
| 1 | `README.md` (ce fichier) | Tu comprends l'architecture et tu choisis tes fichiers |
| 2 | `docker/README.md` | Tu prépares `docker/docker-compose.yml` + `docker/.env` |
| 3 | `nginx/README.md` | Tu prépares la configuration nginx (entrée unique du trafic) |
| 4 | `langages/README.md` puis `langages/<ton-langage>.md` | Tu prépares ton backend (Python, PHP, Java, Node) |
| 5 | `langages/websockets.md` (si temps réel) | Tu prépares le service WebSockets |
| 6 | `vps/README.md` étapes 0 → 8 | Tu fais tout le déploiement sur le serveur, de bout en bout |

Commande de départ recommandée une fois les fichiers copiés dans ton projet :

```bash
# Sur ton ordinateur local : rien à installer. Sur le serveur, la procédure
# commence à l'étape 0 de vps/README.md (connexion SSH avec root + mot de passe).
ssh root@{{IP_SERVEUR}}
```

Sortie attendue :

```text
Welcome to Ubuntu 24.04.x LTS (GNU/Linux 6.x.x-generic x86_64)
root@serveur:~#
```

Si tu vois ce prompt `root@...:~#`, tu es connecté : tout le reste de la procédure
se passe **dans cette fenêtre**.

## Architecture de référence

Un seul VPS. nginx est le **seul point d'entrée visible d'Internet** (ports 80 et
443). Les conteneurs Docker exposent leurs ports **uniquement sur `127.0.0.1`**,
c'est-à-dire sur la boucle de retour locale du serveur : un scanner Internet ne
peut pas les atteindre.

```text
                        ┌──────────────────────────── VPS ({{IP_SERVEUR}}) ────────────────────────────┐
                        │                                                                              │
   Navigateur           │                         nginx sur l'HÔTE                                    │
  (utilisateur)         │                    ports 80 + 443 (publics)                                 │
      │                 │              certificat Let's Encrypt (certbot)                             │
      │  HTTPS 443      │         ┌──────────────────────────────────────────────────┐                │
      ├────────────────►│         │  /        → 127.0.0.1:{{PORT_FRONTEND}}  frontend │                │
      │   (TLS)         │         │  /api/    → 127.0.0.1:{{PORT_BACKEND}}   backend  │                │
      │                 │         │  /ws      → 127.0.0.1:{{PORT_WS}}        ws       │                │
      │                 │         └──────────────────────────────────────────────────┘                │
      │                 │                        │ uniquement du loopback 127.0.0.1                    │
      │                 │                        ▼                                                    │
      │                 │      ┌────────── conteneurs Docker (réseau interne) ──────────┐             │
      │                 │      │  frontend:3000   backend:8000   ws:8081   db:5432      │             │
      │                 │      └───────────────────────────┬────────────────────────────┘             │
      │                 │                                  │ base joignable UNIQUEMENT               │
      │                 │                                  │ depuis backend (réseau docker)           │
      │                 │                                  ▼                                          │
      │                 │                          db:5432 (postgres:16-alpine)                      │
      │                 └──────────────────────────────────────────────────────────────────────────────┘
```

Ce que le serveur fait, dans l'ordre, quand quelqu'un tape `https://{{DOMAINE}}` :

1. nginx (processus de l'hôte) accepte la connexion sur 443, présente le certificat TLS.
2. nginx regarde l'URL : `/`, `/api/...` ou `/ws`.
3. nginx **reverse-proxie** (retransmet) la requête vers `127.0.0.1:<port>` du bon conteneur.
4. Le conteneur répond, nginx renvoie la réponse au navigateur en ajoutant les en-têtes
   `X-Forwarded-For` (vraie IP du client) et `X-Forwarded-Proto` (que la requête
   était en HTTPS) — sans eux, l'app croirait que tout arrive en HTTP depuis 127.0.0.1.
5. Le backend parle à la base **par le réseau interne Docker**, jamais par Internet.

## Carte de la subtree

```text
deploiement/fullstack/
├── README.md                      ← ce fichier : carte + architecture
├── docker/
│   ├── README.md                  ← concepts Docker pour novice + comment composer le compose
│   ├── docker-compose.yml         ← orchestration complète (db, backend, frontend, ws, redis)
│   ├── .env.example               ← toutes les variables, comment générer chaque secret
│   ├── Dockerfile.frontend        ← build multi-stage d'une app Node (Next et autres)
│   ├── Dockerfile.backend-python  ← API Python 3.12 (gunicorn/uvicorn)
│   ├── Dockerfile.backend-php     ← API PHP 8.3 (php-fpm + nginx interne via supervisor)
│   ├── Dockerfile.backend-java    ← API Java 21 (Maven → JRE)
│   └── Dockerfile.backend-node    ← API Node 22 (Express/Nest)
├── nginx/
│   ├── README.md                  ← rôle de nginx, installation de site.conf, certbot
│   └── site.conf                  ← configuration reverse-proxy complète commentée
├── vps/
│   ├── README.md                  ← LA procédure de bout en bout (étapes 0 → 8)
│   ├── 01-securiser-le-vps.sh     ← mises à jour, pare-feu, fail2ban, swap, SSH
│   ├── 02-installer-docker.sh     ← Docker Engine 27+ et docker compose v2
│   ├── 03-certbot-https.sh        ← certificat Let's Encrypt + renouvellement auto
│   └── 04-demarrer-avec-docker-compose.sh ← up -d --build + vérification des healthchecks
└── langages/
    ├── README.md                  ← tableau de correspondance langage → Dockerfile
    ├── python.md                  ← Django / FastAPI derrière le template nginx
    ├── php.md                     ← Symfony / Laravel derrière le template nginx
    ├── java.md                    ← Spring Boot derrière le template nginx
    └── websockets.md              ← guide temps réel complet (Node, Python, Java)
```

## Je veux X → j'utilise Y

| Je veux… | J'utilise… | Où c'est expliqué |
|---|---|---|
| Déployer une API **Python** (FastAPI, Django) | `docker/Dockerfile.backend-python` | `langages/python.md` |
| Déployer une API **PHP** (Symfony, Laravel) | `docker/Dockerfile.backend-php` | `langages/php.md` |
| Déployer une API **Java** (Spring Boot) | `docker/Dockerfile.backend-java` | `langages/java.md` |
| Déployer une API **Node** (Express, Nest) | `docker/Dockerfile.backend-node` | `langages/README.md` (colonne Node) |
| Une **base PostgreSQL** (choix par défaut, recommandé) | profil `postgres`, image `postgres:16-alpine` | `docker/README.md` |
| Une **base MySQL** | profil `mysql`, image `mysql:8.4` | `docker/README.md` |
| Une base **Oracle Free** | profil `oracle`, image `gvenzl/oracle-free:21` | `docker/README.md` |
| Du **temps réel** (chat, notifications, live) | profil `ws` + bloc `location /ws` de nginx | `langages/websockets.md` |
| De la **file d'attente / pub-sub** pour scaler le temps réel | profil `redis`, image `redis:7-alpine` | `langages/websockets.md` |
| Monter le serveur **à partir de zéro** (IP + root + mdp) | scripts `vps/01` → `vps/04` | `vps/README.md` |
| Un certificat **HTTPS** | certbot (script `vps/03`) | `nginx/README.md` |
| Choisir mon Dockerfile de backend | variable `DOCKERFILE_BACKEND` dans `docker/.env` | `docker/README.md` |

### Versions épinglées (et pourquoi)

| Élément | Version | Raison du pin |
|---|---|---|
| Système | Ubuntu 24.04 LTS | LTS = 5 ans de correctifs de sécurité, et les instructions de Docker ci-dessous sont écrites pour cette version |
| Moteur Docker | Docker Engine 27+ | dernière branche majeure stable, compatible avec les images utilisées ici |
| Orchestration | `docker compose` **v2** | commande fournie avec Docker Engine 27 ; **jamais** `docker-compose` (l'ancien binaire v1 est abandonné et n'est plus installé) |
| Base SQL par défaut | PostgreSQL 16 | version majeure stable, image `postgres:16-alpine` officielle et légère |
| Alternative SQL | MySQL 8.4 | dernière LTS MySQL |
| Alternative SQL | Oracle Free 21 | édition gratuite, image `gvenzl/oracle-free:21` |
| PHP | 8.3 | LTS de la branche 8.x |
| Python | 3.12 | branche stable largement supportée par Django/FastAPI |
| Java | 21 | LTS (sorties LTS toutes les 2 ans : 17, 21, 25) |
| Node | 22 | LTS (les versions paires : 18, 20, 22 sont celles à utiliser en prod) |

## Principe des variables `{{...}}`

Ce dossier contient des **templates**, pas un projet fini. Deux syntaxes coexistent,
il faut ne pas les confondre :

| Syntaxe | Qui la remplace | Exemple |
|---|---|---|
| `{{NOM_PROJET}}`, `{{DOMAINE}}`, `{{PORT_DB}}`… | **Toi**, à la main, dans le fichier (recherche/remplacement) | `{{DOMAINE}}` → `monapp.fr` |
| `${PORT_DB}` | **docker compose**, automatiquement, en lisant le fichier `docker/.env` | `PORT_DB=5432` dans `docker/.env` |

Les valeurs `{{...}}` sont regroupées dans chaque README de la subtree dans une
section nommée **« Table des valeurs à personnaliser »**.

Interdiction absolue dans ces templates : mettre un **vrai** mot de passe. Les seuls
valeurs autorisées pour les secrets sont `{{MOT_DE_PASSE}}`, `{{MOT_DE_PASSE_DB}}`
et `CHANGE_ME`. Tu génères les vrais avec les commandes indiquées dans
`docker/.env.example` (`openssl rand -base64 48`, etc.).

## Personnalisation

1. **Copie** le dossier `fullstack/` à la racine de ton projet (là où se trouvent
   déjà ton backend et ton frontend). Tu obtiens :
   - `docker/` — à fusionner avec ton dossier de build,
   - `nginx/site.conf` — à installer sur le serveur,
   - `vps/` — à garder tel quel, c'est ta documentation de prod,
   - `langages/` — à garder tel quel, c'est tes notes par langage.
2. **Remplace** tous les `{{...}}` (voir les tables de chaque README).
3. **Ne modifie jamais ton application** pour qu'elle colle au template : c'est le
   template qui s'adapte à ton app (ports, chemins de build, commandes de
   migration). Si une étape du template ne correspond pas à ton framework, suis
   `langages/<langage>.md` et adapte le commentaire concerné dans le Dockerfile —
   pas ton code applicatif.
4. Génère les secrets, remplis `docker/.env`, puis suis `vps/README.md` de bout en bout.

### Convention de répertoire (à respecter strictement)

Tout le **fichier de configuration** vit dans `docker/`, les **sources** restent à
la racine du projet :

```text
~/monapp/                ← racine du projet = build context (context: ..)
├── backend/  frontend/  ← ton code
└── docker/              ← compose + .env + Dockerfiles  (TOUT est relatif à ce dossier)
    ├── docker-compose.yml
    ├── .env             ← compose le lit ICI automatiquement
    └── Dockerfile.*
```

- `docker-compose.yml` pointe donc `context: ..` et `dockerfile: docker/...`
  (chemin **vu depuis la racine** : le `dockerfile:` se résout depuis le
  `context`, pas depuis le dossier du compose).
- `build.context: ../backend` quand ton API vit dans un sous-dossier.
- **Les commandes `docker compose` s'exécutent depuis `docker/`** ; depuis la
  racine, ajoute `-f docker/docker-compose.yml`.
- Un `.env` posé à la racine au lieu de `docker/.env` est **ignoré en silence** :
  compose démarre avec des vides, ça plante sur la première variable.

## Table des valeurs à personnaliser

Liste MAÎTRESE de tous les placeholders de la subtree. Chaque fichier détaille
ensuite les siens, mais celle-ci permet de tout remplacer d'un coup.

| Placeholder | Exemple de valeur | Où il apparaît | Comment l'obtenir |
|---|---|---|---|
| `{{NOM_PROJET}}` | `monapp` | `docker-compose.yml`, `nginx/site.conf`, `vps/README.md` | nom court de l'app, minuscules sans accent |
| `{{DOMAINE}}` | `monapp.fr` | `site.conf`, `docker/.env`, `vps/*.sh` | ton nom de domaine |
| `{{DOMAINE_API}}` | `api.monapp.fr` | `site.conf`, `docker/.env` | sous-domaine API (ou = `{{DOMAINE}}`) |
| `{{DOMAINE_WS}}` | `ws.monapp.fr` | `site.conf`, `docker/.env`, `langages/websockets.md` | sous-domaine temps réel (ou = `{{DOMAINE}}`) |
| `{{IP_SERVEUR}}` | `203.0.113.10` | `vps/README.md`, `docker/.env` | e-mail de livraison de l'hébergeur |
| `{{EMAIL_ADMIN}}` | admin@monapp.fr | `vps/*.sh`, certbot | boîte que tu consultes vraiment (alertes Let's Encrypt) |
| `{{PORT_FRONTEND}}` | `3000` | `site.conf`, `docker/.env` | port libre sur l'hôte (`sudo ss -ltn` pour vérifier) |
| `{{PORT_BACKEND}}` | `8000` | `site.conf`, `docker/.env` | port libre sur l'hôte |
| `{{PORT_WS}}` | `8081` | `site.conf`, `docker/.env` | port libre sur l'hôte |
| `{{PORT_DB}}` | `5432` | `docker/.env`, `docker-compose.yml` | 5432 Postgres / 3306 MySQL / 1521 Oracle |
| `{{MOT_DE_PASSE_DB}}` | `CHANGE_ME` | `docker/.env` | `openssl rand -hex 32` |
| `{{MOT_DE_PASSE}}` | `CHANGE_ME` | `docker/.env` | `openssl rand -hex 32` (jamais saisi dans les templates) |

Chaque `README` et chaque guide `.md` contient sa propre section
`## Table des valeurs à personnaliser`, avec le fichier exact à modifier.

## Vérification

Après l'étape 6 de `vps/README.md`, ces commandes doivent renvoyer ce qui est indiqué :

```bash
# 1) nginx répond et redirige en HTTPS
curl -I http://{{DOMAINE}}/
# sortie attendue : HTTP/1.1 301 Moved Permanently → Location: https://{{DOMAINE}}/

# 2) le frontend répond
curl -I https://{{DOMAINE}}/
# sortie attendue : HTTP/1.1 200 OK

# 3) l'API répond
curl -s https://{{DOMAINE}}/api/health
# sortie attendue : {"statut":"ok"} (ou l'équivalent de ton app)

# 4) rien n'est exposé publiquement sauf nginx
docker compose ps
# sortie attendue : toutes les lignes en "Up (healthy)"
```

## Dépannage (3 pannes probables)

### Panne 1 — `502 Bad Gateway`

**Symptôme** : le navigateur affiche « 502 Bad Gateway » ou nginx le met dans
`/var/log/nginx/error.log`.

**Cause** : nginx fonctionne, mais il n'obtient **aucune réponse** de
`127.0.0.1:{{PORT_FRONTEND}}`, `127.0.0.1:{{PORT_BACKEND}}` ou
`127.0.0.1:{{PORT_WS}}`. 95 % du temps : le conteneur est arrêté, ou il écoute sur
un autre port que celui déclaré.

**Réparation** :

```bash
docker compose ps          # "Up (healthy)" ? sinon ↓
docker compose logs --tail=50 backend
docker compose up -d backend   # redémarrer le conteneur mort
```

Vérifie aussi que le `proxy_pass` de `nginx/site.conf` utilise **bien le même port**
que celui publié dans `docker-compose.yml`.

### Panne 2 — « port déjà utilisé » (`address already in use` / `Bind for 127.0.0.1:5432 failed`)

**Symptôme** : `docker compose up` échoue avec `port is already allocated`, ou une
ancienne installation de PostgreSQL/MySQL bloque le port.

**Cause** : deux services veulent le même port de l'hôte. Souvent une base installée
directement sur l'hôte, ou un vieux conteneur.

**Réparation** :

```bash
sudo ss -ltnp | grep 5432    # QUI occupe le port 5432 ?
sudo systemctl stop postgresql   # si c'est une base installée sur l'hôte
docker ps -a                     # sinon, identifie le vieux conteneur
docker rm -f <nom_du_conteneur>
```

Sinon, change le port de l'hôte dans `docker/.env` (`PORT_DB=5433`) — le port interne du
conteneur, lui, ne bouge pas.

### Panne 3 — conteneur `healthy` → `unhealthy`

**Symptôme** : `docker compose ps` passe de `Up (healthy)` à `unhealthy`, ou le
conteneur redémarre en boucle (`Restarting`).

**Cause** : la commande du healthcheck échoue. Exemples : l'app met plus de temps à
démarrer que le délai du healthcheck, la route `/api/health` n'existe pas, ou
`curl` n'est pas installé dans l'image.

**Réparation** :

```bash
docker inspect --format='{{json .State.Health}}' <conteneur> | python3 -m json.tool
# regarde le champ "Log" : il contient la sortie réelle de la commande qui échoue
```

Puis corrige, dans le bon fichier, **une** de ces choses : la route testée, le délai
(`interval`/`start_period` du healthcheck), ou l'installation de `curl` dans le
Dockerfile. `docker inspect` affiche ici `{{...}}` de Go : c'est normal, ce ne sont
pas les placeholders du template.
