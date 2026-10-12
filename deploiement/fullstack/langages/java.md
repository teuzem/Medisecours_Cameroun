# langages/java.md: déployer une API Java 21 (Spring Boot)

## Objectif

Mettre en production une API Spring Boot avec :

- un build Maven/Gradle en 2 temps (builder → JRE seule),
- le profil `application-prod.yml` (liens de BDD, secrets, logs),
- une JVM réglée pour le conteneur (mémoire, sans quoi le conteneur est tué),
- les migrations Flyway/Liquibase exécutées au bon moment.

Fichiers du template concernés : `../docker/Dockerfile.backend-java`
(multi-stage `maven:3.9-eclipse-temurin-21` → `eclipse-temurin:21-jre`),
`DOCKERFILE_BACKEND=docker/Dockerfile.backend-java` dans `docker/.env`.

## Prérequis

- `../docker/README.md` lu (profils, healthchecks, volumes).
- Les commandes `docker compose` de ce guide s'exécutent **depuis `docker/`**
  (où se trouve `.env`), sinon ajoute `-f docker/docker-compose.yml`.
- `mvn -B package -DskipTests` fonctionnant en local (JDK 21 installé).
- Choix du moteur de base fait (`COMPOSE_PROFILES=postgres|mysql|oracle`).

> Versions : **Java 21 (LTS)** et **Maven 3.9**. Les LTS sortent tous les 2 ans
> (17, 21, 25) et sont supportés plusieurs années — c'est la seule branche à
> utiliser en production, jamais une version éphémère type 20 ou 22.

## Étapes numérotées

### Étape 1: Choisir le gestionnaire de build

| Gestionnaire | Fichier de dépendances | Commande de build | Adaptation du Dockerfile |
|---|---|---|---|
| **Maven** (choix du template) | `pom.xml` | `mvn -B package -DskipTests` | aucune, le template est fait pour |
| **Gradle** | `build.gradle` + `gradle/wrapper/` | `./gradlew bootJar -x test` | remplacer l'étape builder par l'image `gradle:8-jdk-21` et la commande |

```dockerfile
# Variante Gradle (à substituer à l'étape "builder" du Dockerfile) :
FROM gradle:8-jdk-21 AS builder
WORKDIR /build
COPY . .
RUN gradle bootJar -x test --no-daemon
# --no-daemon : dans un build Docker, le daemon Gradle ne sert à rien et bloque la fin du build.
```

Le template Maven fait `mvn -B dependency:go-offline` AVANT de copier les sources :
modifier du Java ne re-télécharge donc pas les milliers de dépendances à chaque
build (gain de 5 à 15 minutes).

### Étape 2: Le profil de configuration Spring

`src/main/resources/application.yml` (ou `.properties`) :

```yaml
spring:
  profiles:
    active: ${SPRING_PROFILES_ACTIVE:prod}     # défaut prod : jamais de dev par accident
  datasource:
    url: jdbc:postgresql://${DB_HOST:db}:${DB_PORT:5432}/${DB_NAME:app}
    username: ${DB_USER:app}
    password: ${DB_PASSWORD}                    # ⚠ pas de valeur en dur : missing = erreur au boot
  jpa:
    hibernate:
      ddl-auto: validate                        # ne JAMAIS "update" en prod : Flyway gère le schéma
    open-in-view: false                         # évite les requêtes N+1 silencieuses

server:
  port: 8000                # doit correspondre à EXPOSE 8000 et à PORT_BACKEND

management:
  endpoints:
    web:
      exposure:
        include: health     # exposition minimale : seule /actuator/health est publique
                            # (tout exposer = des infos de runtime en accès libre)
```

Points qui pètent en prod si on les oublie :

- `ddl-auto: update` : Spring modifie le schéma tout seul, hors de tout contrôle de
  version → met `validate` et laisse Flyway/Liquibase travailler.
- `DB_HOST: db` : l'hôte est le **nom du service Docker**, jamais `localhost`
  (depuis dans le conteneur, `localhost` = le conteneur lui-même).
- `DB_PASSWORD` sans valeur par défaut : si la variable manque, Spring s'arrête au
  démarrage avec `Failed to configure a DataSource` — c'est voulu, mieux vaut un
  refus net qu'une app connectée en dev sur la prod.

Secrets : ils viennent de `docker/.env` (injecté par docker-compose.yml). **Jamais**
de mot de passe dans `application.yml` versionné : `application-prod.yml` est
souvent commité par erreur avec des identifiants.

### Étape 3: Migrations du schéma (Flyway / Liquibase)

| Outil | Commande | Où il s'exécute |
|---|---|---|
| **Flyway** (le plus courant avec Spring Boot) | automatique au démarrage de l'app | dans le conteneur, avant de servir |
| **Liquibase** | automatique au démarrage | idem |
| manuelle | `mvn flyway:migrate` (config `spring.flyway.*`) | à lancer avant le `up` |

Spring Boot exécute Flyway **avant** que l'app ne serve la première requête : c'est
le comportement sûr, et il n'y a rien à ajouter au Dockerfile. Vérifie simplement :

```yaml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true     # base existante créée avant Flyway : on la référence sans la réinitialiser
```

Pour une migration manuelle (ou pour vérifier l'état) :

```bash
docker compose exec backend java -cp app.jar org.springframework.boot.launcher...  # (rare)
# vérification simple et fiable :
docker compose logs backend | grep -i flyway
# sortie attendue : "Successfully applied N migrations" / "Schema is up to date"
```

Ordre de mise à jour : `git pull` → `docker compose up -d --build` → Flyway migre
au démarrage → healthcheck passe. Si la migration échoue, le conteneur **refuse de
démarrer** (c'est voulu : pas d'app sur un schéma cassé) et le conteneur passe en
`restarting` — la cause est dans `docker compose logs backend`.

### Étape 4: La JVM dans un conteneur : le réglage qui évite les kills

Le Dockerfile du template passe :

```text
-XX:+UseContainerSupport        détecte les LIMITES du conteneur (pas la RAM de l'hôte)
-XX:MaxRAMPercentage=75.0       heap ≤ 75 % de la RAM du conteneur
-Djava.security.egd=file:/dev/./urandom   démarrage accéléré (pas d'attente d'entropie)
```

Pourquoi c'est critique : sans `UseContainerSupport`, la JVM croit voir les
32 Go du VPS, alloue une heap énorme, dépasse la limite du conteneur et le noyau
la **tue** (OOM killer) — symptôme : conteneur en `restarting` toutes les minutes,
sans JavaException dans les logs. Avec 75 %, les 25 % restants servent aux
metaspace et à la mémoire native (JDBC, Netty, buffers).

À ajuster selon la RAM de ton VPS (512 Mo / 1 Go / 2 Go…) :

```dockerfile
# 1 Go de RAM → heap 600 Mo : -XX:MaxRAMPercentage=60.0
# Ajoute aussi une limite EXPLICITE dans docker-compose.yml (mémoire du conteneur) :
#   backend:
#     mem_limit: 800m
```

### Étape 5: Logs et santé

- Sorties vers stdout/stderr uniquement (fichier de logs **jamais** en prod dans un
  conteneur : le conteneur est jetable, les logs doivent être lus avec
  `docker compose logs backend`).
- Route de santé : `/api/health` (celle que teste le healthcheck du template).
  Avec actuator, ajoute une route ou adapter `management.endpoints` + le
  `healthcheck.test` de `docker-compose.yml` :

```yaml
      # équivalent actuator, si tu préfères ne pas créer de route dédiée :
      test: ["CMD-SHELL", "curl -f http://localhost:8000/actuator/health || exit 1"]
```

⚠ Les deux healthchecks (Dockerfile ET compose) doivent tester la MÊME URL.
`/actuator/health` renvoie 200 seulement si le statut est UP : il inclut la base —
utile, mais s'il tombe, le conteneur passe `unhealthy` même si l'app répond.

### Étape 6: Construire et vérifier

```bash
docker compose up -d --build     # le build Maven prend 1 à 5 min
docker compose ps                                 # backend : Up (healthy)
docker compose logs --tail=50 backend
curl -s https://{{DOMAINE}}/api/health
```

## Personnalisation

## Table des valeurs à personnaliser

| Placeholder / variable | Exemple | Où / comment |
|---|---|---|
| `{{DOMAINE}}` | `monapp.fr` | CORS allowed origins, `server.forward-headers-strategy` |
| `{{DOMAINE_API}}` | `api.monapp.fr` | URL publique de l'API |
| `{{PORT_BACKEND}}` | `8000` | `server.port` + `EXPOSE` + `proxy_pass` de site.conf |
| `{{PORT_DB}}` | `5432` | port hôte de la base (5432/3306/1521) |
| `{{MOT_DE_PASSE_DB}}` | `CHANGE_ME` | `openssl rand -hex 32` dans `docker/.env` → `DB_PASSWORD` |
| `SECRET_APP` | `CHANGE_ME` | `openssl rand -base64 48` → clé JWT/sessions |
| `DOCKERFILE_BACKEND` | `docker/Dockerfile.backend-java` | doit être celui-ci |
| `SPRING_PROFILES_ACTIVE` | `prod` | profil Spring effectif au démarrage |

## Vérification

```bash
docker compose exec backend java -version        # openjdk 21.x
docker compose logs backend | grep -Ei 'started|flyway|error'
# sortie attendue : "Started Application in X seconds" sans stacktrace
curl -s https://{{DOMAINE}}/api/health
docker inspect --format='{{.State.Health.Status}}' $(docker compose ps -q backend)   # healthy
```

## Dépannage (3 pannes probables)

### Panne 1: conteneur en boucle `restarting` (souvent OOM)

**Symptôme** : `docker compose ps` montre `Restarting`, aucun log d'exception Java.

**Cause** : la JVM déborde de la mémoire allouée au conteneur → le noyau Linux la
tue (OOM killer).

```bash
docker inspect --format='{{.State.OOMKilled}} {{.State.ExitCode}}' $(docker compose ps -q backend)
# true ...  → c'est bien un OOM
docker stats --no-stream            # consommation réelle
```

Corrige : `-XX:MaxRAMPercentage` plus bas (75 → 60), `mem_limit` plus élevé, ou
moins de workers. Rebuild : `docker compose up -d --build backend`.

### Panne 2: `502 Bad Gateway`

**Cause** : le jar n'a pas démarré (mauvais profil, variable manquante, migration
en échec) ou la `CMD` pointe un fichier inexistant.

```bash
docker compose logs --tail=100 backend
# "Description: ... Failed to configure a DataSource" → DB_HOST/DB_PASSWORD absents
# "Application run failed" → lis la stacktrace : c'est la vraie cause
# "Error: Could not find or load main class"          → la CMD ne vise pas le bon jar
docker compose exec backend ls -la /app               # app.jar est-il présent ?
```

Puis `docker compose up -d --build backend`.

### Panne 3: `unhealthy` alors que l'app « semble » tourner

**Cause** : le healthcheck appelle `/api/health` qui n'existe pas (404), ou
`/actuator/health` qui renvoie 503 (base non prête, disque plein).

```bash
curl -i http://127.0.0.1:8000/api/health   # depuis l'hôte : 404 → route absente
docker inspect --format='{{json .State.Health}}' $(docker compose ps -q backend)
```

Corrige soit la route (crée un contrôleur minimal), soit `healthcheck.test` dans
`docker-compose.yml` (vers `/actuator/health` si tu l'as activé), soit
`start_period` (Spring démarre lentement : 60 s au lieu de 40).
