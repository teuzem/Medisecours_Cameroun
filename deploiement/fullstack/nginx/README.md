# nginx/ — le point d'entrée unique de ton serveur

## Objectif

nginx est le **seul programme du serveur qui parle à Internet**. Il écoute sur les
ports 80 (HTTP) et 443 (HTTPS), présente le certificat TLS, ajoute les en-têtes de
sécurité, compresse, et **retransmet chaque requête** (reverse proxy) vers les
conteneurs Docker qui, eux, n'écoutent que sur `127.0.0.1`.

Ce dossier contient :

- `site.conf` — la configuration complète et commentée (à poser sur le serveur) ;
- ce README — où la poser, comment obtenir le certificat, comment vérifier.

Deux notions à fixer avant de commencer :

| Terme | Signification concrète |
|---|---|
| **reverse proxy** | nginx reçoit la requête du navigateur, la recopie vers `127.0.0.1:<port>`, puis renvoie la réponse. nginx ne « comprend » pas le contenu : il transporte. |
| **terminaison TLS** | le chiffrement HTTPS s'arrête sur nginx. Entre nginx et le conteneur, tout est en clair **sur la même machine** (boucle de retour locale) : aucun octet ne transite par le réseau. |

## Prérequis

- Ubuntu 24.04 LTS installé et accessible en SSH (voir `../vps/README.md` étapes 0-2).
- nginx installé (`sudo apt install nginx`) — le script `../vps/03-certbot-https.sh`
  le fait automatiquement s'il manque.
- Ton domaine `{{DOMAINE}}` (ainsi que `{{DOMAINE_API}}`, `{{DOMAINE_WS}}` s'ils
  existent) pointé vers `{{IP_SERVEUR}}` en DNS de type **A** — sans ça, la
  certification Let's Encrypt échouera (cf. dépannage « DNS »).
- Pour les commandes `docker compose` de ce guide (vérification, dépannage) :
  être dans `docker/` du projet, sinon ajouter `-f docker/docker-compose.yml`
  (convention de `../docker/README.md`).

Référence officielle : https://nginx.org/en/docs/

## Étapes numérotées

### Étape 1 — Installer nginx (si pas déjà fait)

```bash
sudo apt update && sudo apt install -y nginx
```

Sortie attendue (fin de la commande) :

```text
nginx.service - A high performance web server and a reverse proxy server
   Loaded: loaded (/lib/systemd/system/nginx.service; enabled; vendor preset: enabled)
   Active: active (running)
```

Vérification intermédiaire :

```bash
curl -I http://localhost/
# sortie attendue : HTTP/1.1 200 OK  (la page « Welcome to nginx! » par défaut)
```

### Étape 2 — Poser `site.conf`

```bash
# 1. copie le fichier sur le serveur (depuis ton ordinateur, dans le dossier du projet)
scp nginx/site.conf root@{{IP_SERVEUR}}:/tmp/site.conf

# 2. sur le serveur : installer au bon endroit
sudo cp /tmp/site.conf /etc/nginx/sites-available/medisecours.conf
sudo ln -s /etc/nginx/sites-available/medisecours.conf /etc/nginx/sites-enabled/

# 3. retirer le site « par défaut » : sinon il répond sur 443 AVANT ton site
#    (nginx choisit le premier server_name qui correspond, puis le défaut)
sudo rm -f /etc/nginx/sites-enabled/default
```

**Ne recharge PAS nginx maintenant** si tu n'as pas encore de certificat : les
lignes `ssl_certificate` pointent vers un fichier inexistant et nginx refusera de
démarrer. L'étape suivante crée ces fichiers.

### Étape 3 — Obtenir le certificat HTTPS (certbot)

```bash
sudo ./vps/03-certbot-https.sh
```

Sortie attendue (extrait) :

```text
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/{{DOMAINE}}/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/{{DOMAINE}}/privkey.pem
This certificate expires on 2027-01-05.
```

Puis teste la configuration et recharge :

```bash
sudo nginx -t
# sortie attendue :
#   nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
#   nginx: configuration file /etc/nginx/nginx.conf test is successful
sudo systemctl reload nginx
```

⚠ Si `nginx -t` annonce `emerg ... SSL_certificate ... no such file` : le certificat
n'a pas été créé (DNS ou ordre des étapes) → voir le dépannage plus bas. **Ne
jamais** `systemctl reload` sans avoir lancé `nginx -t` au préalable : une erreur
de syntaxe bloquerait le redémarrage et couperait tout le site.

### Étape 4 — Vérifier que nginx route bien vers les conteneurs

À faire **après** le démarrage de docker compose (étape 4 de `vps/README.md`) :

```bash
curl -I https://{{DOMAINE}}/            # → 200 OK (frontend)
curl -I https://{{DOMAINE}}/api/health   # → 200 OK (backend)
curl -I http://{{DOMAINE}}/              # → 301 vers https://
```

### Étape 5 — Comprendre le schéma des `proxy_pass`

C'est le cœur de `site.conf`, et tout se joue dans le **port** :

```text
navigateur ──HTTPS:443──► nginx (hôte)
                            │
                            ├─ location /     → proxy_pass http://127.0.0.1:{{PORT_FRONTEND}}   frontend
                            ├─ location /api/ → proxy_pass http://127.0.0.1:{{PORT_BACKEND}}    backend
                            └─ location /ws   → proxy_pass http://127.0.0.1:{{PORT_WS}}         ws
                                                        │
                                                        └─(réseau docker interne)► db:5432
```

Trois règles qui résolvent 90 % des problèmes de reverse proxy :

1. **Le port du `proxy_pass` doit être celui publié dans `docker-compose.yml`.**
   Changer `{{PORT_BACKEND}}` dans `docker/.env` oblige à changer `site.conf` aussi.
2. **`proxy_pass` sans `/` final → le préfixe est conservé** (`/api/x` arrive tel
   quel). Avec un `/` final (`http://127.0.0.1:8000/`) → le préfixe `location`
   est retiré. Les deux sont valables, ils ne sont pas interchangeables en cours
   de route.
3. **Les en-têtes `X-Forwarded-*` sont obligatoires** : ils disent au backend la
   vraie IP, le vrai domaine et le vrai schéma (https). Sans eux, logs faussés,
   cookies `Secure` jamais posés, URLs de redirection fausses.

## Personnalisation

## Table des valeurs à personnaliser

Valeurs à remplacer dans `nginx/site.conf` :

| Placeholder | Exemple | Où / comment |
|---|---|---|
| `{{DOMAINE}}` | `monapp.fr` | domaine principal — sert aussi à nommer le dossier de certbot (`/etc/letsencrypt/live/{{DOMAINE}}/`) |
| `{{DOMAINE_API}}` | `api.monapp.fr` | sous-domaine API, ou identique à `{{DOMAINE}}` |
| `{{DOMAINE_WS}}` | `ws.monapp.fr` | sous-domaine temps réel, ou identique à `{{DOMAINE}}` |
| `{{PORT_FRONTEND}}` | `3000` | doit être **strictement identique** à `PORT_FRONTEND` de `docker/.env` |
| `{{PORT_BACKEND}}` | `8000` | idem avec `PORT_BACKEND` (si backend Node, c'est aussi 8000 : le port ne change pas selon le langage, c'est `DOCKERFILE_BACKEND` qui change) |
| `{{PORT_WS}}` | `8081` | idem avec `PORT_WS` (à commenter si tu n'as pas de service ws → sinon 502) |
| `{{NOM_PROJET}}` | `monapp` | sert aux noms de fichiers de logs |

Comment remplacer facilement toutes les occurrences : sur le serveur,
`sudo nano /etc/nginx/sites-available/medisecours.conf` puis `Ctrl+H`
(nano : « remplacer »), ou en local `sed -i 's/{{DOMAINE}}/monapp.fr/g' site.conf`.

## Vérification

```bash
sudo nginx -t && sudo systemctl status nginx --no-pager
# nginx: syntax is ok / nginx: configuration ... test is successful
# Active: active (running)

sudo tail -f /var/log/nginx/{{NOM_PROJET}}-access.log
# sortie attendue, après un rafraîchissement du navigateur :
#   "GET / HTTP/2.0" 200 ... "-" "Mozilla/5.0 ..."
#   "GET /api/health HTTP/2.0" 200 ...
```

Le `200` signifie que nginx a obtenu une réponse du conteneur. Un `502` signifie
le contraire (voir dépannage).

## Dépannage (3 pannes probables)

### Panne 1 — `502 Bad Gateway`

**Symptôme** : la page HTTPS s'affiche mal, `error.log` contient
`connect() failed (111: Connection refused) while connecting to upstream`.

**Cause** : nginx tourne, mais **rien n'écoute** sur `127.0.0.1:{{PORT_...}}`.
Conteneur arrêté, ou port mal aligné entre `docker/.env` et `site.conf`.

**Réparation** :

```bash
docker compose ps                                  # quel service n'est pas "Up" ?
sudo ss -ltn | grep -E '3000|8000|8081'            # le port est-il ouvert ?
docker compose logs --tail=50 backend              # que dit le backend ?
sudo tail -20 /var/log/nginx/{{NOM_PROJET}}-error.log
```

Deux cas fréquents : (a) le conteneur est `Exit` → `docker compose up -d backend` ;
(b) le port de `site.conf` diffère de celui de `docker/.env` → aligne-les, puis
`sudo nginx -t && sudo systemctl reload nginx`.

### Panne 2 — `nginx: [emerg] SSL_certificate ... no such file or directory`

**Symptôme** : `nginx -t` échoue, ou `systemctl reload nginx` refuse.
C'est un problème de **certificat**, pas de syntaxe.

**Causes, dans l'ordre de probabilité** :

1. certbot n'a jamais réussi (DNS non pointé, ou `site.conf` posé APRÈS certbot) ;
2. le chemin des `ssl_certificate` ne correspond pas au dossier créé par certbot
   (certbot nomme le dossier d'après le **premier** domaine de la liste `-d`).

**Réparation** :

```bash
sudo ls /etc/letsencrypt/live/        # quel(s) dossier(s) existe(nt) réellement ?
# → adapte les 2 lignes ssl_certificate de site.conf au dossier affiché
sudo certbot certificates             # récapitulatif des certificats détenus
sudo nginx -t                         # DOIT passer avant tout rechargement
sudo systemctl reload nginx
```

### Panne 3 — `DNS_NOT_FOUND` / certbot échoue avec `urn:ietf:params:acme:error:unauthorized`

**Symptôme** : certbot affiche `Some required domains are not yet pointing to this
server` ou `Invalid response from http://{{DOMAINE}}/.well-known/acme-challenge/...`.

**Cause** : le domaine ne résout pas vers `{{IP_SERVEUR}}` (enregistrement A
absent ou qui n'a pas encore été propagé), ou un hébergeur bloque les challenges.

**Réparation** :

```bash
# depuis TON ordinateur (pas le serveur) :
nslookup {{DOMAINE}}            # doit renvoyer {{IP_SERVEUR}}
ping -c 2 {{DOMAINE}}           # idem

# depuis le serveur :
curl -I http://{{DOMAINE}}/.well-known/acme-challenge/test
# doit renvoyer 404 (et non un timeout ou une page d'un autre site) :
# 404 = nginx répond → le chemin est bon, il manque juste le fichier de certbot
```

Si `nslookup` ne donne pas la bonne IP : corrige l'enregistrement **A** chez ton
registrar, attends la propagation (5 min à 48 h, généralement < 1 h), puis relance
`sudo certbot --nginx -d {{DOMAINE}} ...`. Si `nslookup` est bon mais que le curl
échoue : vérifie que le port 80 est ouvert pare-feu (`sudo ufw status`, script
`vps/01-securiser-le-vps.sh`).
