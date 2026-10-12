# langages/ — quel Dockerfile pour quel backend

## Objectif

Ce dossier répond à **une seule question** : « mon API est écrite en <langage>,
quels fichiers je prends, et quelles commandes je lance ? ».

- `README.md` (ce fichier) : le tableau de correspondance.
- `python.md`, `php.md`, `java.md` : la procédure complète, langage par langage.
- `websockets.md` : le guide temps réel (valable quel que soit le langage).

Rappel important : **ce sont les templates qui s'adaptent à ton application, jamais
l'inverse.** Si ton projet s'appelle `mon-api` au lieu de `api`, si ton entrée est
`src/main.ts` au lieu de `dist/server.js`, c'est le commentaire du Dockerfile que tu
changes — pas ton code.

## Prérequis

- Avoir lu `../README.md` (architecture) et `../docker/README.md` (compose).
- Avoir choisi ton profil de base de données (`COMPOSE_PROFILES` dans `docker/.env`).
- Conserver la convention de `../docker/README.md` : **les commandes
  `docker compose ...` s'exécutent depuis le dossier `docker/`** (ou, depuis la
  racine, avec `-f docker/docker-compose.yml`).
- Ton projet sur le serveur (étape 4a de `../vps/README.md`).

## Le tableau : je veux X → j'utilise Y

| Langage / framework | Dockerfile à copier dans `docker/` | Fichier de dépendances attendu | Commande de build | Commande de lancement | Port |
|---|---|---|---|---|---|
| **Python** — FastAPI, Django, Flask | `Dockerfile.backend-python` | `requirements.txt` (ou `pyproject.toml` + Poetry) | `pip install -r requirements.txt` (dans le Dockerfile) | `gunicorn --bind 0.0.0.0:8000 ...` | 8000 |
| **PHP** — Symfony, Laravel | `Dockerfile.backend-php` | `composer.json` + `composer.lock` | `composer install --no-dev --optimize-autoloader` | `supervisord` → php-fpm + nginx (HTTP sur 8000) | 8000 |
| **Java** — Spring Boot | `Dockerfile.backend-java` | `pom.xml` (Maven) ou `build.gradle` | `mvn -B package -DskipTests` | `java -XX:+UseContainerSupport -jar app.jar` | 8000 |
| **Node.js** — Express, NestJS, Fastify | `Dockerfile.backend-node` | `package.json` + `package-lock.json` | `npm ci --omit=dev` (+ `npm run build` si TypeScript) | `node dist/server.js` | 8000 |

**Le port est 8000 pour tous** : c'est volontaire. `nginx/site.conf`,
`docker-compose.yml` et `docker/.env` ne changent PAS quand tu changes de langage. Seul
`DOCKERFILE_BACKEND` change — c'est tout l'intérêt d'avoir un reverse proxy devant.

### Comment choisir concrètement

1. Trouve ton langage dans le tableau.
2. Copie le Dockerfile correspondant dans `docker/`.
3. Dans `docker/.env`, mets `DOCKERFILE_BACKEND=docker/Dockerfile.backend-<langage>` (le `docker/` du chemin est obligatoire : il est résolu depuis la racine du projet).
4. Ouvre `langages/<langage>.md` et suis les étapes « dépendances », « migrations »,
   « static/media », « vérification ».
5. Vérifie les 3 points qui varient vraiment selon les projets :
   - la **commande de démarrage** (CMD du Dockerfile) : doit lancer TON entrée ;
   - le **chemin de build** (`build.context` dans compose) : doit viser TON dossier ;
   - la **route de santé** (`healthcheck.test`) : doit exister dans TON API.

### Versions épinglées (et pourquoi on ne met pas `:latest`)

| Langage | Version | Raison |
|---|---|---|
| Python | 3.12 | branche stable adoptée par Django/FastAPI ; pin = build reproductible |
| PHP | 8.3 | LTS de la branche 8.x |
| Java | 21 | LTS (17 → 21 → 25) ; supporté plusieurs années |
| Node | 22 | LTS (versions paires uniquement) |

Mettre `:latest` revient à dire « remplace-moi la base de mon serveur au prochain
build sans me prévenir » : une mise à jour majeure casse rarement le build, elle
casse la prod un vendredi soir.

## Étapes numérotées (communes à tous les langages)

1. **Choisir le Dockerfile** (tableau ci-dessus) → `DOCKERFILE_BACKEND` dans `docker/.env`.
2. **Copier le Dockerfile** dans `docker/` de ton projet, adapter la `CMD` :
   ```bash
   cd docker                                     # toutes les commandes ci-dessous
   nano Dockerfile.backend-python                # ou -php, -java, -node
   ```
3. **Adapter le build dans compose** (uniquement si ton projet n'est pas à la
   racine du `context`) :
   ```yaml
   backend:
     build:
       context: ../backend      # ← dossier réel de ton API, vu depuis docker/
       dockerfile: ${DOCKERFILE_BACKEND:-docker/Dockerfile.backend-python}
   ```
4. **Migrer la base** — soit automatiquement au démarrage (`RUN_MIGRATIONS=1`),
   soit manuellement :
   ```bash
   docker compose exec backend <commande-de-migration>
   ```
   (commande exacte dans le fichier du langage).
5. **Construire et démarrer** (toujours depuis `docker/`, l'`pwd` compte pour la
   résolution de `.env` et des `context:`) :
   ```bash
   docker compose up -d --build
   ```
6. **Vérifier** :
   ```bash
   docker compose ps                                   # Up (healthy)
   curl -s https://{{DOMAINE}}/api/health
   ```

## Personnalisation

Remplace **chaque** `{{...}}` et chaque `CHANGE_ME` du tableau ci-dessous, dans le
fichier indiqué. Un placeholder oublié dans `docker/.env` fait échouer le démarrage de
compose ; un placeholder oublié dans le Dockerfile fait échouer le build.

## Table des valeurs à personnaliser

Valeurs à remplacer dans `docker/.env` (et dans le Dockerfile choisi) :

| Placeholder / variable | Exemple | Où / comment |
|---|---|---|
| `{{DOMAINE}}` | `monapp.fr` | domaine principal (nginx + `APP_URL`) |
| `{{DOMAINE_API}}` | `api.monapp.fr` | URL publique de l'API : `docker/.env` → `API_PUBLIC` (`https://{{DOMAINE_API}}`) |
| `{{PORT_BACKEND}}` | `8000` | port hôte de l'API — doit matcher `site.conf` |
| `{{PORT_DB}}` | `5432` | port hôte de la base (5432/3306/1521 selon le moteur) |
| `{{MOT_DE_PASSE_DB}}` | `CHANGE_ME` | généré : `openssl rand -hex 32` |
| `DOCKERFILE_BACKEND` | `docker/Dockerfile.backend-java` | le choix du tableau ci-dessus |
| `RUN_MIGRATIONS` | `1` | `1` = auto au démarrage, `0` = à la main |
| `SECRET_APP` | `CHANGE_ME` | généré : `openssl rand -base64 48` |

## Vérification

```bash
docker compose ps                              # toutes les lignes "Up (healthy)"
docker compose logs --tail=50 backend          # pas d'erreur de démarrage
curl -s https://{{DOMAINE}}/api/health         # {"statut":"ok"} ou équivalent
sudo ss -ltn | grep 8000                       # 127.0.0.1:8000 (jamais 0.0.0.0:8000)
```

## Dépannage (3 pannes probables)

### Panne 1 — `502 Bad Gateway` sur `/api/`

**Cause la plus fréquente** : la `CMD` du Dockerfile ne lance pas le bon fichier
(`dist/server.js` inexistant, mauvais module gunicorn, jar absent). Le conteneur
démarrée → crash → nginx n'a rien à qui parler.

```bash
docker compose logs --tail=100 backend   # lis la PREMIÈRE ligne d'erreur
docker compose exec backend ls -la       # le fichier de la CMD existe-t-il ?
docker compose up -d backend             # redémarrage après correction
```

### Panne 2 — conteneur `unhealthy` en boucle

**Cause** : le healthcheck teste `/api/health`, route qui n'existe pas dans ton
app (ou qui plante).

```bash
docker inspect --format='{{json .State.Health}}' $(docker compose ps -q backend)
# le champ "Log" te dit exactement ce que la commande de santé a renvoyé
```

Correction : soit tu crées la route (10 lignes : `{"statut":"ok"}` sans accès base),
soit tu changes `healthcheck.test` dans `docker-compose.yml` pour une route qui
existe déjà. Les deux valeurs (Dockerfile et compose) doivent tester la même URL.

### Panne 3 — `port is already allocated`

**Cause** : deux services veulent le même port hôte (base installée sur l'hôte +
conteneur, ou deux profils de base actifs en même temps).

```bash
sudo ss -ltnp | grep 5432          # qui occupe le port ?
sudo systemctl stop postgresql     # base native sur l'hôte → on l'arrête
docker ps -a                       # ou vieux conteneur à supprimer
```

Sinon : change le port de l'HÔTE dans `docker/.env` (`PORT_DB=5433`) — le port interne du
conteneur reste 5432, seule la ligne `ports:` de compose bouge.