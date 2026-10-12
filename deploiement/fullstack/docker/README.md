# docker/ — compose + variables d'environnement

## Objectif

Ce dossier décrit **comment les 4 morceaux de ton application tournent ensemble**
sur le serveur : une base de données, un backend (API REST), un frontend, et un
service WebSockets optionnel.

Tu y apprends :

1. les 5 notions Docker qu'il faut vraiment comprendre (image, conteneur, volume,
   réseau, healthcheck) ;
2. comment **choisir et composer** `docker-compose.yml` + `.env` pour ton cas ;
3. quelles commandes lancer.

## Prérequis

- Avoir lu la carte d'architecture dans `../README.md`.
- Avoir installé Docker : script `../vps/02-installer-docker.sh`
  (voir https://docs.docker.com/ et https://docs.docker.com/engine/install/ubuntu/).
- Savoir éditer un fichier texte en SSH (commande `nano` : tu édites, `Ctrl+O` pour
  enregistrer, `Ctrl+X` pour sortir).

## Les 5 notions, expliquées pour un débutant

### 1. Image vs conteneur

- **Image** = la recette de cuisine, un fichier en lecture seule téléchargé ou
  construit (`postgres:16-alpine`, `node:22-alpine`…). Elle ne change jamais.
- **Conteneur** = la cuisine en cours d'exécution, une copie vivante de l'image
  avec des données dedans. Tu peux en lancer 10 depuis la même image.

Conséquence pratique : si ton conteneur a un bug, tu peux le supprimer et en
relancer un autre à partir de la même image — **sauf** si les données sont dans un
volume (voir point 3).

### 2. Ports : pourquoi `127.0.0.1` et pas `0.0.0.0`

```yaml
ports:
  - "127.0.0.1:8000:8000"   # ← correct : joignable seulement depuis la machine elle-même
  - "8000:8000"             # ← DANGEREUX : joignable depuis n'importe quelle IP de la Terre
```

Le trafic public ne doit voir que nginx (80/443). En bindant sur `127.0.0.1`, ton
API et ta base sont **invisibles** d'Internet ; seul nginx, qui tourne sur le même
hôte, peut les appeler. C'est la règle n°1 de cette architecture.

### 3. Volume : les données qui survivent à `docker compose down`

Un conteneur **efface** ce qu'il y a dedans quand on le supprime. Si ta base vit
dans le conteneur, ta production meurt avec lui. Un **volume nommé** est un dossier
géré par Docker, hors conteneur, monté dedans à chaque démarrage :

```yaml
volumes:
  db_data:      # dossier physique : /var/lib/docker/volumes/<projet>_db_data
services:
  db:
    volumes:
      - db_data:/var/lib/postgresql/data   # montage : le conteneur écrit ICI
```

Résultat : `docker compose down` **ne touche pas** aux données. Même après une
réinstallation complète du serveur (si tu sauvegardes le volume, cf. `../vps/README.md`
étape 7), la base est récupérable. C'est la différence entre « je déploie » et « je
perds mes données ».

### 4. Réseau interne Docker

À la mise en jour, compose crée un réseau (ici `reseau-interne`). Les conteneurs s'y
voient avec des noms : `db`, `backend`, `ws`. Donc dans ton backend, l'adresse de la
base est `db:5432` — **pas** `127.0.0.1:5432` (qui, depuis l'intérieur du
conteneur, désignerait le conteneur lui-même) et **pas** l'IP publique.

### 5. Healthcheck et `depends_on: condition: service_healthy`

Un healthcheck est une petite commande exécutée **à l'intérieur** du conteneur toutes
les `interval` secondes. Si elle échoue `retries` fois de suite → conteneur marqué
`unhealthy`.

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
  interval: 10s      # fréquence du test
  timeout: 5s        # au-delà, c'est un échec
  retries: 5         # 5 échecs consécutifs → unhealthy
  start_period: 30s  # temps de grâce au démarrage (une base met 10 s à être prête)
```

`depends_on: { db: { condition: service_healthy } }` dit à compose : **ne démarre
le backend que lorsque la base a répondu OK**. Sans ça, le backend démarre, la base
n'est pas prête, la première connexion plante et l'app crash au boot.

Astuce : `$$` dans une commande YAML = un `$` réel transmis au shell. Un seul `$`
serait mangé par compose (qui croirait à une variable `${...}`).

## Étapes numérotées

### Étape 0 — La convention des dossiers (à lire une fois)

Tout ce dossier suppose **ce classement** dans ton projet :

```text
monapp/                     ← racine du projet (la où tu tapes les commandes)
├── backend/  frontend/     ← TON CODE applicatif
├── docker/                 ← CE DOSSIER : compose.yml, .env, Dockerfiles
├── nginx/  vps/  langages/ ← le reste du template
└── .env  → NON ! .env est dans docker/
```

**Les commandes `docker compose ...` de cette subtree s'exécutent depuis le
dossier `docker/`** :

```bash
cd docker
docker compose ps          # ← marche
```

Depuis la racine, écris à la place `docker compose -f docker/docker-compose.yml ps`
(équivalent exact). Sans `-f` ni `cd`, compose ne trouve pas le fichier et te dit
`no configuration file provided`.

Conséquences de ce classement, visibles dans `docker-compose.yml` :

| Ligne du compose | Signification |
|---|---|
| `context: ..` | le code source est AU-DESSUS de docker/ (racine du projet) |
| `dockerfile: docker/Dockerfile...` | chemin relatif à la racine (le `dockerfile` se résout depuis le `context`) |
| `env_file: - .env` | relatif à docker/ → c'est bien `docker/.env` |

### Étape 1 — Choisir le Dockerfile de backend

Ouvre `.env.example`, trouve `DOCKERFILE_BACKEND` et mets la valeur correspondant à
ton langage (cf. tableau `../langages/README.md`) :

| Langage | Valeur à mettre |
|---|---|
| Python (FastAPI, Django) | `docker/Dockerfile.backend-python` |
| PHP (Symfony, Laravel) | `docker/Dockerfile.backend-php` |
| Java (Spring Boot) | `docker/Dockerfile.backend-java` |
| Node (Express, Nest) | `docker/Dockerfile.backend-node` |

`docker-compose.yml` lit cette variable ici (et c'est pourquoi elle commence par
`docker/` : le chemin est résolu depuis la racine du projet) :

```yaml
build:
  context: ..                            # racine du projet
  dockerfile: ${DOCKERFILE_BACKEND:-docker/Dockerfile.backend-python}
```

### Étape 2 — Choisir le profil de base de données

Dans `.env`, la variable `COMPOSE_PROFILES` choisit la base :

| Tu veux | `COMPOSE_PROFILES=` | Image réellement démarrée | Port interne |
|---|---|---|---|
| PostgreSQL (défaut) | `postgres` | `postgres:16-alpine` | 5432 |
| MySQL | `mysql` | `mysql:8.4` | 3306 |
| Oracle Free | `oracle` | `gvenzl/oracle-free:21` | 1521 |

Seul **un** profil de base à la fois : les trois services publient le même port de
l'hôte (`PORT_DB`), sinon compose échoue avec « port déjà utilisé ».

### Étape 3 — Créer ton `.env`

```bash
cd docker
cp .env.example .env
nano .env
```

Remplace **chaque** `{{...}}` et **chaque** `CHANGE_ME`, puis génère les secrets (voir les commentaires de
`.env.example`) :

```bash
openssl rand -base64 48      # secret applicatif de 64 caractères
openssl rand -hex 32         # mot de passe de base, 64 caractères hexadécimaux
```

Sortie attendue : deux chaînes aléatoires affichées ; colle-les dans `.env`.

> `.env` contient les vrais mots de passe. **Ne le committe jamais** (ligne
> `.env` dans ton `.gitignore`), ne l'envoie à personne, ne le colle pas dans un
> forum. `.env.example`, lui, est vide de secrets : il est sûr à partager.

### Étape 4 — Composer / adapter `docker-compose.yml`

Le fichier fourni est **complet**. Les points que tu peux avoir à toucher (et
uniquement ceux-ci) :

| À adapter | Où | Pourquoi |
|---|---|---|
| Chemin du build frontend | `services.frontend.build.context` | si ton frontend n'est pas dans `../frontend` (chemin vu depuis docker/) |
| Chemin du build backend | `services.backend.build.context` | `..` = sources à la racine ; mets `../backend` si ton API vit dans un sous-dossier |
| Variables d'env du backend | `services.backend.environment` | nom de la base, host `db`, chemin des uploads |
| Commande de démarrage du backend | la `CMD` du Dockerfile (ou un `command:` à ajouter dans compose) | `npm run start:prod`, `java -jar`, `gunicorn`… |
| Healthcheck du backend | `healthcheck.test` | doit tester une route qui existe (`/api/health`) |
| Profil temps réel | `services.ws.profiles` | activer avec `--profile ws` si tu as du temps réel |

Tout le reste (volumes, réseaux, binds `127.0.0.1`, `depends_on`) ne se modifie pas.

### Étape 5 — Lancer

Toutes les commandes ci-dessous s'exécutent **depuis `docker/`** (étape 3) :

```bash
# Variante standard (profil de base lu dans .env via COMPOSE_PROFILES)
docker compose up -d --build
```

Sortie attendue (extrait) :

```text
[+] Building 42.1s (24/24) FINISHED
 ✔ db       Started
 ✔ backend  Started
 ✔ frontend Started
```

Variantes :

```bash
docker compose up -d --build            # tout, profil depuis .env
docker compose --profile ws up -d       # + le service WebSockets
COMPOSE_PROFILES=mysql docker compose up -d --build     # base MySQL au lieu de postgres
COMPOSE_PROFILES=oracle docker compose up -d --build    # base Oracle
docker compose ps                                       # état + healthcheck
docker compose logs --tail=50 backend                   # dernières lignes de log
docker compose down                                     # arrêter (les VOLUMES survivent)
docker compose down -v                                  # arrêter ET supprimer les données ⚠
```

⚠ `--profile mysql` **ajoute** un profil, il ne remplace pas celui de `.env`. Si
`.env` dit encore `COMPOSE_PROFILES=postgres` et que tu tapes
`docker compose --profile mysql up`, **les deux bases démarrent** et se disputent le
port : utilise plutôt `COMPOSE_PROFILES=mysql docker compose up -d --build`.

## Personnalisation

Remplace, dans les fichiers indiqués, **chaque** `{{...}}` et chaque `CHANGE_ME` du
tableau ci-dessous. Ne change rien d'autre : un placeholder oublié = un service qui
ne démarre pas, une URL de certificat fausse ou un 404.

## Table des valeurs à personnaliser

Valeurs à remplplacer dans `.env` (et, pour `{{NOM_PROJET}}`, dans `docker-compose.yml`) :

| Placeholder / variable | Exemple de valeur | Où la trouver / comment générer |
|---|---|---|
| `{{NOM_PROJET}}` | `monapp` | nom court de ton app, minuscules sans accent (nom de projet compose) |
| `{{DOMAINE}}` | `monapp.fr` | ton nom de domaine principal |
| `{{DOMAINE_API}}` | `api.monapp.fr` | sous-domaine de l'API si tu en as un (sinon = `{{DOMAINE}}`) |
| `{{DOMAINE_WS}}` | `ws.monapp.fr` | sous-domaine temps réel (sinon = `{{DOMAINE}}`) |
| `{{IP_SERVEUR}}` | `203.0.113.10` | IP de ton VPS, fournie par l'hébergeur |
| `{{EMAIL_ADMIN}}` | admin@monapp.fr | e-mail reçu par Let's Encrypt (certificat) |
| `{{PORT_FRONTEND}}` | `3000` | port hôte du frontend (libre, entre 1024 et 65535) |
| `{{PORT_BACKEND}}` | `8000` | port hôte de l'API |
| `{{PORT_WS}}` | `8081` | port hôte des WebSockets |
| `{{PORT_DB}}` | `5432` | port hôte de la base (5432 Postgres, 3306 MySQL, 1521 Oracle) |
| `{{MOT_DE_PASSE_DB}}` | `CHANGE_ME` | `openssl rand -hex 32` — **jamais** un mot de passe réel dans les templates |
| `DOCKERFILE_BACKEND` | `docker/Dockerfile.backend-python` | cf. étape 1 (chemin depuis la racine) |
| `COMPOSE_PROFILES` | `postgres` | cf. étape 2 |

## Vérification

```bash
docker compose ps
```

Sortie attendue :

```text
NAME        SERVICE   STATUS              PORTS
...-db-1    db        Up (healthy)        127.0.0.1:5432->5432/tcp
...-api-1   backend   Up (healthy)        127.0.0.1:8000->8000/tcp
...-web-1   frontend  Up (healthy)        127.0.0.1:3000->3000/tcp
```

« `(healthy)` » veut dire : le healthcheck a réussi. « `(health: starting)` » pendant
les 30 premières secondes, c'est normal.

```bash
docker compose exec db pg_isready -U $POSTGRES_USER   # la base répond-elle ?
docker inspect --format='{{.State.Health.Status}}' $(docker compose ps -q db)
# sortie attendue : healthy
```

## Dépannage (3 pannes probables)

### Panne 1 — `permission denied while trying to connect to the Docker daemon socket`

**Symptôme** :

```text
permission denied while trying to connect to the Docker daemon at unix:///var/run/docker.sock
```

**Cause** : tu lances `docker` avec un utilisateur **non-root** qui n'appartient pas
au groupe `docker`. Le daemon Docker n'accepte que root ou les membres de ce groupe.

**Réparation** :

```bash
sudo usermod -aG docker $USER   # ajoute l'utilisateur au groupe docker
exit                            # FERMER la session SSH...
ssh root@{{IP_SERVEUR}}         ...puis la rouvrir (le groupe ne s'applique qu'au login)
docker ps                       # doit répondre sans sudo
```

Si ça persiste : `sudo systemctl status docker` (le daemon est-il démarré ?).

### Panne 2 — conteneur `unhealthy` (ou `healthy` qui devient `unhealthy`)

**Symptôme** : `docker compose ps` affiche `unhealthy`, ou `Restarting` en boucle.

**Cause** : la commande du `healthcheck` échoue — route inexistante, `curl` absent de
l'image, démarrage plus lent que `start_period`.

**Réparation** :

```bash
docker inspect --format='{{json .State.Health}}' $(docker compose ps -q backend)
# le champ "Log" contient la sortie RÉELLE de la commande qui échoue
docker compose logs --tail=50 backend
```

Corrige ensuite **le template, pas l'app** : soit la route testée dans
`docker-compose.yml` (`healthcheck.test`), soit le `start_period`, soit l'installation
de `curl` dans le Dockerfile concerné.

### Panne 3 — `port is already allocated` / `Bind for 127.0.0.1:5432 failed`

**Symptôme** : `docker compose up` s'arrête avec « port is already in use ».

**Cause** : deux services veulent le même port de l'hôte (par exemple Postgres
installé directement sur l'hôte + conteneur `db`, ou deux profils de base activés en
même temps).

**Réparation** :

```bash
sudo ss -ltnp | grep 5432        # qui occupe le port ?
sudo systemctl stop postgresql    # base installée sur l'hôte → on l'arrête
docker ps -a                     # sinon, vieux conteneur à supprimer
docker rm -f <nom>
```

Ou change le port hôte dans `.env` : `PORT_DB=5433`. Vérifie ensuite qu'un seul
profil de base est actif : `echo $COMPOSE_PROFILES` / regarde `.env`.
