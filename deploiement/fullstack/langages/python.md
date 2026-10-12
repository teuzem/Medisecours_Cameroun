# langages/python.md: déployer une API Python (FastAPI, Django, Flask)

## Objectif

Mettre en production une API Python derrière le template nginx, avec :

- un build reproductible (dépendances épinglées),
- des migrations de base exécutées au bon moment,
- gunicorn comme serveur de production (**jamais** `runserver` / `uvicorn` seul),
- les fichiers statiques (CSS/JS) et médias (images envoyées) servis correctement.

Fichiers du template concernés : `../docker/Dockerfile.backend-python`,
variable `DOCKERFILE_BACKEND=docker/Dockerfile.backend-python` dans `docker/.env`.

## Prérequis

- `../docker/README.md` lu (profils, healthchecks, volumes).
- Les commandes `docker compose` de ce guide s'exécutent **depuis `docker/`**
  (où se trouve `.env`), sinon ajoute `-f docker/docker-compose.yml`.
- Une API Python fonctionnant en local (`uvicorn app.main:app` répond).
- Choix du moteur de base fait (`COMPOSE_PROFILES=postgres|mysql|oracle`).

## Étapes numérotées

### Étape 1: Le fichier de dépendances

Le Dockerfile installe `requirements.txt`. Génère-le **à partir de l'environnement
qui fonctionne** (sinon tu auras « ça marche chez moi » en prod) :

```bash
# recommandé : figer TOUTES les dépendances, y compris transitives
pip freeze > requirements.txt
```

Sortie attendue : un fichier avec une version par ligne, par exemple
`fastapi==0.115.0` (avec `==`, jamais sans). Un `requirements.txt` sans `==` n'est
pas un verrouillage : le build de prod pourra tirer une version différente.

Avec **Poetry** : garde `pyproject.toml` + `poetry.lock`, et remplace dans le
Dockerfile l'installation par :

```dockerfile
RUN pip install poetry \
    && poetry export -f requirements.txt --output requirements.txt --without-hashes \
    && pip install --no-cache-dir -r requirements.txt
```

(Deux lignes supplémentaires, mais le lockfile Poetry reste la source de vérité.)

### Étape 2: Adapter la `CMD` du Dockerfile

Ouvre `docker/Dockerfile.backend-python`, la dernière `CMD` contient
`app.main:app`. Remplace par **ton** couple `module:objet` :

```dockerfile
# FastAPI     : "app.main:app"                (app/ est un paquet Python, main.py expose `app`)
# Django      : "monprojet.wsgi:application"  (monprojet/ = dossier settings, wsgi.py = point d'entrée)
# Flask       : "app:app"                     (app.py ou app/__init__.py expose `app`)
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "60", \
     "--access-logfile", "-", "--error-logfile", "-", "app.main:app"]
```

Pourquoi gunicorn et pas `uvicorn` en prod : uvicorn seul ne gère pas le
multi-process ; gunicorn pilote les workers et survit à un worker qui plante.
(UVICORN peut être utilisé avec `--workers`, mais gunicorn est le standard
documenté pour FastAPI/Django.) **`python manage.py runserver` est interdit en
production** : serveur de développement, non threadé, sans contrôle d'accès.

Nombre de workers : `2 × cœurs + 1`. Sur un VPS à 1 cœur → 2 workers,
2 cœurs → 5, 4 cœurs → 9 (à ajuster si la mémoire est rare).

### Étape 3: Les migrations

| Framework | Commande | Exécution |
|---|---|---|
| Django | `python manage.py migrate` | automatique si `RUN_MIGRATIONS=1` (voir ci-dessous) |
| Alembic (SQLAlchemy) | `alembic upgrade head` | à lancer manuellement |
| FastAPI sans ORM | aucune | — |

**Option A — automatique** (défaut du template, `RUN_MIGRATIONS=1` dans `docker/.env`) :
ajoute un bloc en début d'entrée de l'application, ou mieux, une commande shell
dans le Dockerfile :

```dockerfile
# Exécuté au démarrage, AVANT gunicorn : pendant les migrations, aucune requête
# ne doit être servie (sinon l'app voit un schéma à moitié migré → 500).
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn --bind 0.0.0.0:8000 --workers 4 app.wsgi:application"]
```

⚠ `exec` devant gunicorn est indispensable : il remplace le shell par gunicorn,
qui reçoit alors directement le signal d'arrêt de Docker (sinon, le conteneur
attend 10 s et se fait tuer brutalement).

**Option B — manuelle** (`RUN_MIGRATIONS=0`, recommandé si tu veux contrôler le
moment du changement de schéma) :

```bash
docker compose exec backend python manage.py migrate
# Alembic :
docker compose exec backend alembic upgrade head
```

### Étape 4: Statiques et médias (le point qui casse toujours)

Deux choses distinctes, souvent confondues :

| | Statiques (`collectstatic`) | Médias (uploads des utilisateurs) |
|---|---|---|
| Quoi | CSS/JS/images du framework, générés par toi | fichiers ENVOYÉS par les utilisateurs |
| Où en dev | `static/` | `media/` |
| Où en prod | copiés **dans l'image** au build | dans un **volume Docker** (jamais dans l'image) |
| Qui les sert | nginx (directement) | nginx (directement) |

**Django — collectstatic** : à exécuter pendant le build, sinon le CSS de
l'admin est vide en prod :

```dockerfile
# Après COPY du code, avant USER app (écriture dans staticfiles/)
RUN python manage.py collectstatic --noinput
```

Puis dans `nginx/site.conf`, sers ce dossier (la ligne `location /static/` si tu
l'as ajoutée) :

```nginx
location /static/ { alias /var/www/html/staticfiles/; expires 30d; access_log off; }
```

**Médias — volume obligatoire** : un fichier copié dans le conteneur disparaît au
prochain `up --build`. Ajoute dans `docker-compose.yml`, sous `backend` :

```yaml
    volumes:
      - uploads:/app/media        # le volume nommé du template
```

Et dans `nginx/site.conf` :

```nginx
location /media/ { alias /srv/{{NOM_PROJET}}/uploads/; expires 30d; access_log off; }
```

⚠ `alias` doit pointer vers le **chemin HÔTE** correspondant au volume ; monte
donc le volume sur un chemin de l'hôte si tu veux que nginx le voie :

```yaml
    volumes:
      - /srv/{{NOM_PROJET}}/uploads:/app/media    # bind mount : visible par nginx
```

Dans Django, configure `MEDIA_URL=/media/` et `MEDIA_ROOT=/app/media` ; dans
FastAPI/Flask, sers via le chemin que tu as monté (ou laisse nginx tout servir).

### Étape 5: Variables d'environnement

Le template injecte `.env` dans le conteneur. Dans ton code :

```python
# Django : tout ce qui est dans .env est lisible via os.environ
#   DB_HOST=db  ← HÔTE du conteneur, pas 127.0.0.1
# FastAPI :
import os
DB_HOST = os.environ.get("DB_HOST", "db")
SECRET = os.environ.get("SECRET_APP")   # ⚠ si absent : refuse de démarrer
```

`DEBUG=False` (Django) ou `ENVIRONMENT=production` : active-le dans `docker/.env` ET
vérifie que `ALLOWED_HOSTS` contient `{{DOMAINE}}` sinon Django renvoie
`DisallowedHost` (page d'erreur 400/500 incompréhensible).

### Étape 6 — Construire et vérifier

```bash
docker compose up -d --build
docker compose ps                                   # backend : Up (healthy)
docker compose logs --tail=50 backend               # pas d'erreur
curl -s https://{{DOMAINE}}/api/health              # réponse JSON attendue
```

## Personnalisation

## Table des valeurs à personnaliser

| Placeholder / variable | Exemple | Où / comment |
|---|---|---|
| `{{DOMAINE}}` | `monapp.fr` | `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` (Django) |
| {{DOMAINE_API}} | pi.monapp.fr | docker/.env → API_PUBLIC (compose le transmet en APP_URL) + CORS du framework |
| `{{PORT_BACKEND}}` | `8000` | doit correspondre à `EXPOSE` + `--bind` du Dockerfile |
| `{{PORT_DB}}` | `5432` | port hôte de la base |
| `{{MOT_DE_PASSE_DB}}` | `CHANGE_ME` | `openssl rand -hex 32` dans `docker/.env` |
| `{{NOM_PROJET}}` | `monapp` | chemin des médias (`/srv/{{NOM_PROJET}}/uploads`) |
| `SECRET_APP` | `CHANGE_ME` | `openssl rand -base64 48` — Django SECRET_KEY / clé FastAPI |
| `DOCKERFILE_BACKEND` | `docker/Dockerfile.backend-python` | doit être celui-ci (chemin depuis la racine du projet) |
| `RUN_MIGRATIONS` | `1` | `1` = migrations au démarrage, `0` = à la main |

## Vérification

```bash
docker compose exec backend python -c "import sys; print(sys.version)"   # 3.12.x
docker compose exec backend pip check            # "No broken requirements found."
curl -s https://{{DOMAINE}}/api/health           # 200
curl -sI https://{{DOMAINE}}/static/admin/css/base.css   # 200 (collectstatic ok)
```

## Dépannage (3 pannes probables)

### Panne 1: `502 Bad Gateway`

**Cause** : gunicorn n'a pas démarré (mauvais `module:objet` dans la CMD →
`WORKER TIMEOUT` en boucle, ou `ModuleNotFoundError`).

```bash
docker compose logs --tail=100 backend | head -30
# ModuleNotFoundError: No module named 'app' → le module de la CMD est faux
# WORKER TIMEOUT → le démarrage dépasse --timeout 60 : ajoute des migrations lentes
#                   ou augmente --timeout
```

Corrige la `CMD` (étape 2) puis `docker compose up -d --build backend`.

### Panne 2: conteneur `unhealthy`

**Cause** : `/api/health` n'existe pas, ou `curl` n'est pas dans l'image
(assure-toi d'utiliser bien le `Dockerfile.backend-python` du template, il
installe curl), ou le démarrage dépasse `start_period` (40 s).

```bash
docker inspect --format='{{json .State.Health}}' $(docker compose ps -q backend)
# "Log" contient la sortie réelle de curl : 404 = route absente, 000 = port fermé
```

### Panne 3: `port is already allocated` (ou conteneur qui redémarre en boucle sur un port)

**Cause** : `PORT_BACKEND` déjà pris par un autre service (ancien conteneur, ou
une app testée directement sur l'hôte avec `uvicorn --port 8000`).

```bash
sudo ss -ltnp | grep 8000        # qui écoute ?
kill <PID>                       # ou docker rm -f <ancien conteneur>
# solution définitive : change le port de l'hôte dans docker/.env → PORT_BACKEND=8001
# et le MÊME port dans nginx/site.conf (proxy_pass), puis :
#   sudo nginx -t && sudo systemctl reload nginx
```