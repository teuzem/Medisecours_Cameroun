# langages/php.md: déployer Symfony ou Laravel derrière le template nginx

## Objectif

Mettre en production une API PHP 8.3 (Symfony ou Laravel) avec :

- `composer install --no-dev` (jamais les bundles de dev en prod),
- `.env` en `APP_ENV=prod` + `APP_DEBUG=0` (sinon l'erreur affiche la BDD à l'écran),
- les migrations de schéma,
- les permissions de `var/` (Symfony) et `storage/` (Laravel) — la panne n°1,
- php-fpm + nginx, avec opcache activé.

Fichiers du template concernés : `../docker/Dockerfile.backend-php`
(contient php-fpm + nginx interne via supervisor, écoute HTTP sur 8000),
`DOCKERFILE_BACKEND=docker/Dockerfile.backend-php` dans `docker/.env`.

## Prérequis

- `../docker/README.md` lu (profils, healthchecks, volumes).
- Les commandes `docker compose` de ce guide s'exécutent **depuis `docker/`**
  (où se trouve `.env`), sinon ajoute `-f docker/docker-compose.yml`.
- `composer install` fonctionnant en local, l'app répond en local.
- Choix du moteur de base fait (`COMPOSE_PROFILES=postgres|mysql|oracle`).
  Les extensions `pdo_pgsql` ET `pdo_mysql` sont déjà construites dans le Dockerfile.

## Étapes numérotées

### Étape 1: Dépendances

```bash
composer install --no-dev --optimize-autoloader --no-interaction
```

- `--no-dev` : exclut phpunit, faker, les bundles de debug — ils consomment de la
  RAM et exposent des routes de debug en production.
- `--optimize-autoloader` : pré-compile le mappeur de classes (autoload 2x plus rapide).
- **`composer.lock` doit être commité** : c'est lui qui garantit que la prod
  installe EXACTEMENT les mêmes versions que ta machine de dev.

Le Dockerfile fait cette commande au build ; l'entrée ici sert à valider que ça
passe avant de pousser.

### Étape 2: Variables d'environnement de production

Dans le `.env` du projet applicatif (celui de l'application, lu par le framework —
distinct de `docker/.env`, celui de docker compose) :

```dotenv
APP_ENV=prod
APP_DEBUG=0
APP_SECRET=CHANGE_ME          # Symfony : php bin/console secrets:set
                              # Laravel : php artisan key:generate (dans .env du conteneur)
```

- `APP_ENV=prod` : active les caches de production (routes, templates, DI).
- `APP_DEBUG=0` : **critique**. Avec `1`, chaque exception affiche la stack trace
  complète, les requêtes SQL et les valeurs de variables — c'est la fuite la plus
  grave qu'un site puisse avoir. Symfony refuse même de démarrer en prod avec
  `APP_DEBUG=1`.
- Les valeurs de base de données viennent de docker-compose :
  `DB_HOST=db`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. Dans le framework, lis ces
  variables d'environnement en priorité plutôt qu'un `.env` codé en dur.

### Étape 3: Migrations

| Framework | Commande |
|---|---|
| Symfony (Doctrine) | `php bin/console doctrine:migrations:migrate --no-interaction` |
| Laravel | `php artisan migrate --force` |

Le Dockerfile du template **exécute ces deux commandes automatiquement au
démarrage** si `RUN_MIGRATIONS=1` (défaut dans `docker/.env`), et détecte tout
seul `bin/console` ou `artisan`.

Pour les lancer à la main (`RUN_MIGRATIONS=0`, ou pour une migration précise) :

```bash
docker compose exec backend php bin/console doctrine:migrations:migrate --no-interaction
# Laravel :
docker compose exec backend php artisan migrate --force
```

Ordre à respecter à chaque mise à jour : `git pull` → `up -d --build` → migrations
(s'elles ne sont pas automatiques) → vérification. Si les migrations partent AVANT
le nouveau code, l'ancien code tourne sur un nouveau schéma → 500.

### Étape 4: Permissions `var/` et `storage/` (LA panne classique)

En prod, le conteneur tourne en utilisateur **non-root** (`app`, uid 10001).
PHP doit pouvoir écrire dans :

| Framework | Dossiers à écrire |
|---|---|
| Symfony | `var/cache/`, `var/log/`, `var/sessions/` |
| Laravel | `storage/framework/*`, `storage/logs/`, `bootstrap/cache/` |

Le Dockerfile fait déjà `chown -R app:app /var/www/html`, ce qui règle le cas
standard. Si tu copies le projet depuis l'hôte avec un autre uid, ajoute après le
`COPY` :

```dockerfile
RUN chown -R app:app /var/www/html/var /var/www/html/storage 2>/dev/null || true
```

Symptôme en cas d'oubli : page blanche + `Prod ContainerNotFoundException` /
`failed to open stream: Permission denied` dans
`docker compose logs backend`.

### Étape 5: opcache : activé et réglé dans le Dockerfile

```ini
opcache.enable=1
opcache.memory_consumption=256
opcache.max_accelerated_files=20000
opcache.validate_timestamps=0    ; ← le réglage important
```

`validate_timestamps=0` = PHP ne revérifie PLUS les dates des fichiers à chaque
requête (gain de 30 à 50 % sur du framework). **Conséquence** : après un
`git pull`, PHP continue de servir l'ANCIEN code en cache → **redémarre le
conteneur à chaque mise à jour** :

```bash
git pull && docker compose up -d --build backend && docker compose restart backend
```

C'est écrit dans `vps/README.md` étape 7 ; l'étape `restart` est celle qui
active le nouveau code sous opcache figé.

### Étape 6: nginx : où sont les vrais réglages

Le conteneur embarque son propre nginx (écoute 8000) pour rester uniforme avec les
autres langages ; **nginx de l'hôte reste le seul exposé** et fait un `proxy_pass`
simple. Les trois endroits à garder cohérents pour les uploads :

1. `php.ini` (dans le Dockerfile) : `upload_max_filesize=20M`, `post_max_size=25M`
2. nginx interne (dans le Dockerfile) : `client_max_body_size 20m`
3. `nginx/site.conf` sur l'hôte : `client_max_body_size 20m`

Si un des trois dit `10m`, l'upload de 15 Mo échoue **à cet endroit-là** et
personne d'autre ne voit jamais la requête.

### Étape 7: Construire et vérifier

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=50 backend
curl -s https://{{DOMAINE}}/api/health
curl -s https://{{DOMAINE}}/api/whatever | head      # route réelle de ton app
```

## Personnalisation

## Table des valeurs à personnaliser

| Placeholder / variable | Exemple | Où / comment |
|---|---|---|
| {{DOMAINE}} / {{DOMAINE_API}} | monapp.fr | docker/.env → API_PUBLIC (transmis en APP_URL), CORS, TRUSTED_PROXIES |
| `{{DOMAINE_API}}` | `api.monapp.fr` | URL publique de l'API |
| `{{PORT_BACKEND}}` | `8000` | `EXPOSE` du Dockerfile + `proxy_pass` de site.conf |
| `{{PORT_DB}}` | `5432` | port hôte de la base (5432/3306/1521) |
| `{{MOT_DE_PASSE_DB}}` | `CHANGE_ME` | `openssl rand -hex 32` |
| `APP_SECRET` / `APP_KEY` | `CHANGE_ME` | Symfony : `php bin/console secrets:set APP_SECRET` ; Laravel : `php artisan key:generate` |
| `RUN_MIGRATIONS` | `1` | `1` = auto, `0` = manuel |
| `DOCKERFILE_BACKEND` | `docker/Dockerfile.backend-php` | doit être celui-ci |

## Vérification

```bash
docker compose exec backend php -v                 # PHP 8.3.x
docker compose exec backend php -m | grep -E 'pdo_pgsql|pdo_mysql|opcache|intl|zip'
# → les 5 lignes doivent s'afficher
docker compose exec backend php artisan about 2>/dev/null || docker compose exec backend php bin/console about
# → Environment: prod / Debug: false  ← si Debug: true, TU N'ES PAS EN PROD
curl -sI https://{{DOMAINE}}/api/health            # 200
```

## Dépannage (3 pannes probables)

### Panne 1: `502 Bad Gateway`

**Cause la plus fréquente** : php-fpm ou nginx interne n'a pas démarré (config
invalide, ou port 9000/8000 mal monté).

```bash
docker compose logs --tail=100 backend
# "unable to bind listening socket" → le port 8000 est déjà pris DANS le conteneur
# "no input file specified"         → mauvais document root (public/ vs web/)
# "[emerg] ... nginx.conf"          → syntaxe nginx interne invalide
docker compose exec backend supervisorctl status   # doit afficher php-fpm:RUNNING, nginx:RUNNING
```

Si `supervisorctl status` les montre FATAL : le log exact est dans
`docker compose logs backend`. Corrige, puis `docker compose up -d --build backend`.

### Panne 2 — `Permission denied` / page blanche sur `var/` ou `storage/`

**Cause** : le dossier n'est pas écrit par l'utilisateur `app` (uid 10001), ou
n'existe pas.

```bash
docker compose exec backend ls -la /var/www/html/var
docker compose exec backend whoami                  # doit répondre "app"
# correction :
docker compose exec backend chown -R app:app /var/www/html/var /var/www/html/storage
docker compose restart backend
```

Correction durable : ajoute le `chown` du Dockerfile (étape 4) et vérifie que
`.dockerignore` n'exclut pas les dossiers vides nécessaires.

### Panne 3: conteneur `healthy` → `unhealthy`

**Cause** : le healthcheck `/api/health` répond en 500 (base injoignable,
migrations manquantes, `APP_DEBUG=1` qui affiche une exception) ou en 404.

```bash
curl -i http://127.0.0.1:8000/api/health    # depuis l'hôte : que renvoie RÉELLEMENT l'app ?
docker inspect --format='{{json .State.Health}}' $(docker compose ps -q backend)
docker compose exec backend php bin/console about   # configuration effective
```

Si la 500 vient de la base : `docker compose ps db` (healthy ?), puis vérifie
`DB_HOST=db` (et non `127.0.0.1`) dans la config de l'app.