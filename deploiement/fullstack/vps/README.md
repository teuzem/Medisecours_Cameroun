# vps: procédure complète, de « j'ai une IP » à « mon site est en ligne »

## Objectif

C'est **ce fichier qui fait le déploiement**. Tout est écrit pour partir du cas
le plus brut qui existe :

> « Mon hébergeur m'a envoyé un e-mail avec une IP, un identifiant `root` et un
> mot de passe. Je n'ai jamais installé de serveur. »

À la fin de cette procédure, ton application répond en HTTPS sur `{{DOMAINE}}`,
les conteneurs redémarrent tout seuls après un reboot, et tu connais les 5
commandes du quotidien.

**Durée estimée** : 1 h la première fois (dont 30 min d'attente de propagation DNS).

## Prérequis

| Prérequis | Détail |
|---|---|
| Le VPS | IP `{{IP_SERVEUR}}`, user `root`, mot de passe, fournis par l'hébergeur |
| Un terminal | PowerShell/`ssh` intégré sous Windows 10/11, Terminal sous Mac/Linux, sinon PuTTY (https://www.putty.org) ou un client SSH moderne comme Termius (https://termius.com)| 
| Un domaine | avec droits d'édition DNS chez ton registrar |
| Le projet local | ce dossier `deploiement/fullstack/` copié dans ton projet |
| Aucune connaissance | Docker, nginx et certbot s'apprennent en cours de route, chaque commande est expliquée |

> ⚠ Avant toute chose : **les commandes de ce fichier s'exécutent sur LE SERVEUR**,
> c'est-à-dire dans ta session SSH. Les commandes marquées « (local) » s'exécutent
> sur TON ordinateur.

## Étapes numérotées

Chaque étape donne : la commande exacte, la sortie attendue, et l'erreur typique.
Ne saute pas une étape : elles sont dans l'ordre de dépendance (Docker avant
compose, DNS avant certificat, conteneurs avant vérification HTTPS).

## Étape 0: Se connecter, et réparer si ça ne marche pas

### 0a. Connexion

```bash
ssh root@{{IP_SERVEUR}}
```

Sortie attendue :

```text
The authenticity of host '203.0.113.10' can't be established.
ED25519 key fingerprint is SHA256:xxxxxxx.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
root@203.0.113.10's password:
```

Tu tapes `yes` (première connexion uniquement : c'est l'empreinte du serveur qui
est enregistrée dans `~/.ssh/known_hosts`), puis le mot de passe. Prompt final :
`root@serveur:~#`.

### 0b. Les 4 pannes de connexion et leur réparation

| Erreur | Cause | Réparation |
|---|---|---|
| `Connection refused` / timeout | Pare-feu de l'hébergeur ou VPS encore en train d'installer | Regarde l'écran de console de ton hébergeur (VNC/KVM) ; attends 5 min après la création du VPS |
| `Permission denied, please try again` en boucle | Mot de passe faux (majuscule, copie-coller tronqué) | Retape-le à la main ; sinon réinitialise-le depuis la console de l'hébergeur (bouton « root password ») |
| `Operation timed out` depuis ton PC | Ton IP est bloquée par l'hébergeur (rare) | Console de l'hébergeur → « Rescue »/« IP filtering » ; ou essaie depuis un autre réseau (partage de connexion mobile) |
| Sous Windows : `'ssh' n'est pas reconnu` | Windows trop ancien ou PATH cassé | Ouvre **PowerShell** (pas le CMD) et retape `ssh` ; sinon active OpenSSH : `Settings → Apps → Optional features → OpenSSH Client` |

### 0c. Changer le mot de passe root (immédiatement)

```bash
passwd
```

Sortie attendue :

```text
Changing password for root.
New password:
Retype new password:
passwd: password updated successfully
```

Choisis 16 caractères minimum, mélange de classes. Note-le dans ton gestionnaire
de mots de passe : c'est le mot de passe qui contrôle ta production.
(Plus tard, l'étape 1 remplacera l'authentification par mot de passe par une clé
SSH — bien plus sûre.)

## Étape 1: Sécuriser le serveur (script `01`)

```bash
# (sur le serveur) copie le script, puis exécute-le
nano 01-securiser-le-vps.sh      # ← vérifie le contenu avant de lancer, bonne habitude
chmod +x 01-securiser-le-vps.sh
./01-securiser-le-vps.sh
```

Ce que fait le script, dans l'ordre :

1. `apt update && apt upgrade`: installe les correctifs de sécurité du système ;
2. paquets de base : `curl`, `ufw` (pare-feu), `fail2ban` (anti force brute SSH),
   `unattended-upgrades` (correctifs automatiques) ;
3. **swap** si la RAM < 4 Go: sans swap, une base qui déborde fait **tuer le
   conteneur** par le noyau (erreur OOM) ;
4. `ufw` : deny par défaut sur tout, allow 22 (SSH), 80, 443 ;
5. `fail2ban` : bannit toute IP qui rate 5 mots de passe SSH d'affilée ;
6. création de l'utilisateur `deploy` avec les droits sudo ;
7. durcissement SSH (désactivation de l'auth par mot de passe) **après** vérification
   d'une seconde session, le script te demande une confirmation écrite, il ne le
   fait pas en silence.

Sortie attendue (extrait) :

```text
[OK] Paquets installes.
[OK] Swap cree (2 Go).
[OK] Pare-feu UFW actif : 22, 80, 443 ouverts, tout le reste refuse.
[OK] fail2ban actif (protection SSH).
[OK] Utilisateur 'deploy' cree.
ATTENTION : ouvre une DEUXIEME fenetre SSH avant de continuer (voir le message).
```

**Erreur typique** : `E: Unable to locate package ...` → le catalogue apt est vide,
relance `sudo apt update` puis le script.

⚠ **Mise en garde écrite** : si tu désactives `PasswordAuthentication` alors que ta
clé SSH n'est pas installée et qu'une seule session est ouverte, **tu perds l'accès
au serveur** à la fermeture de la fenêtre. La console du VPS de ton hébergeur est
le seul secours. Le script t'oblige à valider cette étape explicitement ; réponses
autres que `oui` → cette étape est sautée.

## Étape 2: Installer Docker (script `02`)

```bash
chmod +x 02-installer-docker.sh
./02-installer-docker.sh
```

Le script utilise le **script officiel Docker** (https://docs.docker.com/engine/install/ubuntu/),
ajoute l'utilisateur `deploy` au groupe `docker`, et **épingle** les paquets Docker
(`apt-mark hold`) : sinon, une mise à jour automatique de Debian/Ubuntu pourrait
installer une version incompatible de Docker au milieu de la nuit et casser le
serveur au prochain reboot.

Sortie attendue :

```text
Client: Docker Engine - Community
 Version:           27.x.x
docker compose version v2.x.x        ← compose v2, c'est bien
[OK] Utilisateur deploy ajoute au groupe docker.
[OK] Paquets docker epingles (pas de mise a jour surprise).
```

**Erreur typique** : `permission denied while trying to connect to the Docker
daemon socket at unix:///var/run/docker.sock` → tu utilises un utilisateur qui
n'est pas dans le groupe `docker`, ou **la session n'a pas été relancée** :

```bash
sudo usermod -aG docker $USER
exit
ssh root@{{IP_SERVEUR}}      # fermer et rouvrir = seul moyen d'appliquer un groupe
docker ps                     # doit répondre sans sudo
```

## Étape 3: Certificat HTTPS (script `03`)

> ⚠ **Ordre réel des opérations** : la validation Let's Encrypt (challenge HTTP)
> exige que `http://{{DOMAINE}}/.well-known/acme-challenge/...` aboutisse sur CE
> serveur. Il faut donc que le DNS (étape 5) pointe déjà ici.
> **Deux parcours valides** :
> - **Parcours A (le plus courant)** : tu fais l'étape 5 (DNS) juste APRÈS cette
>   étape 2, tu reviens ici, puis tu enchaînes sur les étapes 4 → 6 → 7 → 8.
> - **Parcours B** : tu passes cette étape 3 en dernier (après l'étape 5). Le site
>   reste en HTTP pendant 10 minutes, puis tu lances le script. Les deux chemins
>   donnent exactement le même résultat.

```bash
chmod +x 03-certbot-https.sh
./03-certbot-https.sh                    # mode nginx (recommandé, interactif)
./03-certbot-https.sh --webroot          # si nginx n'est pas encore configuré
./03-certbot-https.sh --standalone       # si aucun service n'occupe le port 80
```

Ce que fait le script : installe `certbot` (https://certbot.eff.org/), vérifie que
le domaine résout bien vers `{{IP_SERVEUR}}`, demande le certificat, puis installe
le **renouvellement automatique** (Let's Encrypt expire au bout de 90 jours).

Sortie attendue :

```text
Saving debug log to /var/log/letsencrypt/letsencrypt.log
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/{{DOMAINE}}/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/{{DOMAINE}}/privkey.pem
This certificate expires on 2027-01-05.
Congratulations, you have successfully enabled HTTPS
```

**Erreur typique** : `Some required domains are not yet pointing to this server`
→ le DNS n'est pas propagé. `nslookup {{DOMAINE}}` (sur ton PC) doit renvoyer
`{{IP_SERVEUR}}`. Attends, puis relance. Détails dans `nginx/README.md`,
dépannage « DNS ».

## Étape 4: Poser le projet et démarrer avec docker compose (script `04`)

### 4a. Transférer le projet sur le serveur

Toutes les commandes qui suivent supposent la racine du projet sur le serveur en
`~/monapp` (`cd ~/monapp` pour y aller). Deux façons d'y arriver :

```bash
# Option 1 (recommandée) — git : le template étant copié À LA RACINE de ton
# projet (cf. README), le clone ramène code + docker/ + nginx/ + vps/ en un geste
ssh deploy@{{IP_SERVEUR}} 'git clone <URL_DE_TON_DEPOT> ~/monapp'

# Option 2 — scp depuis la racine de ton projet, en local :
ssh deploy@{{IP_SERVEUR}} 'mkdir -p ~/monapp'
scp -r . deploy@{{IP_SERVEUR}}:~/monapp/
# Astuce : si tu as rsync en local, mieux (exclut node_modules, .git, .env) :
#   rsync -avz --exclude node_modules --exclude .env . deploy@{{IP_SERVEUR}}:~/monapp/
```

Arbre attendu sur le serveur à la fin du transfert :

```text
~/monapp/
├── backend/  frontend/     ← ton code
├── docker/                 ← compose + .env + Dockerfiles
└── nginx/  vps/  langages/
```

### 4b. Préparer `docker/.env` sur le serveur

```bash
cd ~/monapp && cp docker/.env.example docker/.env
nano docker/.env
```

⚠ Le `.env` se place **dans `docker/`**, à côté de `docker-compose.yml` : c'est là
que compose va le chercher automatiquement. Un `.env` posé à la racine serait
**ignoré en silence** et tes ports/mots de passe seraient vides.

Remplis **tous** les `{{...}}` et **toutes** les valeurs `CHANGE_ME` (mots de passe générés avec
`openssl rand -hex 32`, secrets avec `openssl rand -base64 48` — les commandes
sont rappelées en commentaire dans le fichier). `Ctrl+O` puis `Entrée` pour
enregistrer, `Ctrl+X` pour sortir.

### 4c. Démarrer

```bash
chmod +x vps/04-demarrer-avec-docker-compose.sh
./vps/04-demarrer-avec-docker-compose.sh
```

Ce que fait le script : vérifie que `docker/.env` existe (sans lui, compose refuse
de démarrer), lance `docker compose -f docker/docker-compose.yml up -d --build`,
**attend** que tous les healthchecks passent en `healthy`, puis affiche l'état et
les 50 dernières lignes de log de chaque service.

> **Convention à retenir pour le reste de la procédure** : les commandes
> `docker compose ps|logs|exec|restart` s'exécutent depuis `docker/`
> (`cd docker`) ou, depuis la racine, avec `-f docker/docker-compose.yml`.

Sortie attendue :

```text
[...] Building 45.2s (31/31) FINISHED
NAME        SERVICE   STATUS                 PORTS
monapp-db  db       Up (healthy)          127.0.0.1:5432->5432/tcp
monapp-api backend  Up (healthy)          127.0.0.1:8000->8000/tcp
monapp-web frontend Up (healthy)          127.0.0.1:3000->3000/tcp
[OK] Tous les conteneurs sont healthy.
Si un conteneur reste unhealthy : voir la section Depannage du README de docker/.
```

**Erreur typique** : `port is already allocated` → un service de l'hôte occupe le
port (voir dépannage ci-dessous).

### 4d. Poser la configuration nginx et (re)charger

```bash
sudo cp nginx/site.conf /etc/nginx/sites-available/medisecours.conf
sudo ln -sf /etc/nginx/sites-available/medisecours.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## Étape 5: Pointer le DNS

Chez ton registrar (OVH, Gandar, Infomaniak, Namecheap…), rubrique **Zone DNS /
DNS records**, crée :

| Type | Sous-domaine (ou nom) | Valeur | TTL |
|---|---|---|---|
| A | `@` (racine) | `{{IP_SERVEUR}}` | 300 |
| A | `www` | `{{IP_SERVEUR}}` | 300 |
| A | `api` (si `{{DOMAINE_API}}` différent) | `{{IP_SERVEUR}}` | 300 |
| A | `ws` (si `{{DOMAINE_WS}}` différent) | `{{IP_SERVEUR}}` | 300 |

Vérification (sur ton PC, **pas** sur le serveur — sur le serveur, `nslookup`
poserait la question avec les DNS du serveur, pas avec ceux du monde) :

```bash
nslookup {{DOMAINE}}
# sortie attendue : Address: {{IP_SERVEUR}}
```

**Erreur typique** : `nslookup` renvoie une autre IP ou `NXDOMAIN` → le
enregistrement est absent ou pas encore propagé. Attends (5 min à 1 h), re-teste.
Si l'enregistrement est correct pendant 24 h sans effet, vérifie que ta zone DNS
n'est pas en **redirection/miroir** (OVH : « Redirection » au lieu de « Zone DNS »).

## Étape 6: Vérification finale

> Rappel de la convention : les commandes `docker compose ...` ci-dessous sont à
> lancer **depuis `docker/`** (`cd ~/monapp/docker`) ou avec
> `-f docker/docker-compose.yml` depuis la racine.

```bash
# 6.1 les conteneurs
docker compose ps
# → toutes les lignes "Up (healthy)" ; "unhealthy" = voir le dépannage

# 6.2 HTTP force le HTTPS
curl -I http://{{DOMAINE}}/
# → HTTP/1.1 301 Moved Permanently

# 6.3 le frontend
curl -I https://{{DOMAINE}}/
# → HTTP/1.1 200 OK

# 6.4 l'API
curl -s https://{{DOMAINE}}/api/health
# → {"statut":"ok"} (ou la réponse équivalente de ton app)

# 6.5 le certificat est bien chargé
sudo certbot certificates
# → VALID: 80+ days

# 6.6 rien n'est exposé sauf nginx
sudo ss -ltnp | grep -E ':(80|443|3000|8000|5432)'
# → 80 et 443 : 0.0.0.0  (publics, c'est nginx)
# → 3000, 8000, 5432 : 127.0.0.1  (loopback UNIQUEMENT, c'est docker)
```

Si une ligne de 6.6 affiche `0.0.0.0:8000` ou `0.0.0.0:5432`, un port est exposé
publiquement : corrige immédiatement `docker-compose.yml` (il manque le
`127.0.0.1:` devant) et relance `docker compose up -d`.

## Étape 7: Au quotidien : sauvegardes et mises à jour

### 7a. Sauvegarde de la base (à programmer, tous les jours)

```bash
# sauvegarde horodatée dans /var/backups/monapp/
mkdir -p /var/backups/monapp
# -T = pas de terminal interactif (INDISPENSABLE dans un cron, sinon pg_dump attend
#      une saisie et la tâche reste bloquée indéfiniment).
# Remplace app/app par DB_USER/DB_NAME de ton docker/.env :
docker compose exec -T db pg_dump -U app app \
  | gzip > /var/backups/monapp/$(date +%F-%H%M).sql.gz
ls -lh /var/backups/monapp/
```

> Variante MySQL : `docker compose exec -T db mysqldump -uapp -pMOT_DE_PASSE app | gzip > ...`
> (le mot de passe est celui de `MOT_DE_PASSE_DB` ; il apparaît dans la liste des
> process pendant l'exécution — sur un serveur dédié à la prod, c'est accepté ;
> sinon préfère un fichier `--defaults-extra-file`.)

Tâche cron (exécution automatique chaque nuit à 3 h) :

```bash
sudo crontab -e
# ajoute cette ligne :
0 3 * * * cd /root/monapp/docker && docker compose exec -T db pg_dump -U app app | gzip > /var/backups/monapp/$(date +\%F).sql.gz
```

Conservation : garde 7 jours (`find /var/backups/monapp -mtime +7 -delete` dans
une seconde ligne de cron). Teste UNE sauvegarde dès le premier jour :
`zcat /var/backups/monapp/2026-10-07.sql.gz | head -20` — une sauvegarde jamais
testée n'est pas une sauvegarde.

### 7b. Mise à jour du code (la routine)

```bash
cd ~/monapp
git pull                              # 1. récupérer le nouveau code
docker compose -f docker/docker-compose.yml up -d --build   # 2. reconstruire + redémarrer
docker compose -f docker/docker-compose.yml ps              # 3. attendre "healthy"
# (si tu es déjà dans docker/, les "-f" sont inutiles)
```

Pourquoi `--build` : sans lui, compose réutilise l'ancienne IMAGE et ton nouveau
code n'est jamais compilé — c'est la cause n°1 de « mais ma mise à jour n'a pas
été prise en compte ».

Etapes de sécurité : `git stash` si tu as modifié `docker/.env` localement ; en cas de
régression, `git log --oneline -5` puis `git revert <commit>` et relance l'étape 2.

## Étape 8: Journal des commandes courantes

> Toutes les commandes `docker compose` ci-dessous s'exécutent **depuis
> `docker/`** (`cd ~/monapp/docker`) — ou avec `-f docker/docker-compose.yml`
> depuis la racine.

| Je veux… | Commande |
|---|---|
| Voir l'état | `docker compose ps` |
| Voir les logs en direct | `docker compose logs -f --tail=100 backend` |
| Logs du frontend | `docker compose logs -f --tail=100 frontend` |
| Redémarrer un service | `docker compose restart backend` |
| Redémarrer TOUT (après édition de `docker/.env`) | `docker compose up -d` |
| Entrer dans un conteneur (déboguer) | `docker compose exec backend sh` |
| Lancer une commande applicative | `docker compose exec backend python manage.py migrate` |
| Arrêter proprement | `docker compose down` (**les volumes de données survivent**) |
| Tout supprimer, données comprises | `docker compose down -v` ⚠ interdit en prod |
| Vérifier la config nginx | `sudo nginx -t` |
| Recharger nginx sans couper le service | `sudo systemctl reload nginx` |
| Vérifier les certificats | `sudo certbot certificates` |
| Tester le renouvellement | `sudo certbot renew --dry-run` |
| Voir qui occupe un port | `sudo ss -ltnp \| grep 5432` |
| Rechercher une erreur dans nginx | `sudo grep -i error /var/log/nginx/{{NOM_PROJET}}-error.log \| tail -20` |
| Espace disque | `df -h` puis `docker system df` |
| Nettoyer les images inutilisées | `docker image prune -af` (jamais `docker system prune -a` sans vérifier) |
| Éditer un fichier sur le serveur | `nano /chemin/fichier` (`Ctrl+O` enregistrer, `Ctrl+X` sortir) |

## Personnalisation

## Table des valeurs à personnaliser

Valeurs à remplacer dans `vps/README.md` et dans les scripts `vps/*.sh` :

| Placeholder | Exemple | Où / comment |
|---|---|---|
| `{{IP_SERVEUR}}` | `203.0.113.10` | IP fournie par l'hébergeur (e-mail de livraison, espace client) |
| `{{DOMAINE}}` | `monapp.fr` | domaine principal, identique à `docker/.env` et `nginx/site.conf` |
| `{{DOMAINE_API}}` | `api.monapp.fr` | idem |
| `{{DOMAINE_WS}}` | `ws.monapp.fr` | idem |
| `{{EMAIL_ADMIN}}` | admin@monapp.fr | e-mail que tu consultes vraiment : Let's Encrypt y envoie les alertes d'expiration |
| `{{NOM_PROJET}}` | `monapp` | nom de dossier du projet sur le serveur (ex : `~/monapp`) |
| `{{MOT_DE_PASSE_DB}}` | `CHANGE_ME` | **jamais** saisi dans un script : généré dans `docker/.env` avec `openssl rand -hex 32` |

Les scripts contiennent aussi ces placeholders : ouvre-les dans `nano` et remplace
(`Ctrl+H`) avant de les lancer, ou remplace-les en local avant le `scp`.

## Vérification

Rejoue l'étape 6 à tout moment : ces 6 commandes doivent passer d'un blocage
quelconque à « tout est vert ». En production, garde sous la main :

```bash
docker compose ps && curl -s https://{{DOMAINE}}/api/health && sudo certbot certificates
```

## Dépannage (3 pannes probables)

### Panne 1: `permission denied while trying to connect to the Docker daemon socket`

**Symptôme** : toutes les commandes `docker ...` échouent avec
`permission denied while trying to connect to the Docker daemon at
unix:///var/run/docker.sock`.

**Cause** : l'utilisateur courant n'a pas les droits sur le socket de Docker.
Soit tu n'es ni root ni membre du groupe `docker`, soit le groupe a été ajouté
**pendant** cette session (les groupes ne s'appliquent qu'à l'ouverture de session).

**Réparation** :

```bash
sudo usermod -aG docker $USER    # ajoute l'utilisateur au groupe
exit                             # 1. fermer la session SSH
ssh root@{{IP_SERVEUR}}          # 2. la rouvrir (indispensable)
id | tr ' ' '\n' | grep docker   # doit afficher "docker"
docker ps                        # marche sans sudo ?
sudo systemctl status docker     # si non : le daemon est-il démarré ?
```

Si `systemctl status docker` affiche `inactive (dead)` :
`sudo systemctl start docker && sudo systemctl enable docker` (démarrage à chaque
boot — c'est fait par le script `02`, mais une interruption pendant son exécution
peut l'empêcher).

### Panne 2: le DNS ne pointe pas (`nslookup` renvoie la mauvaise adresse)

**Symptôme** : certbot échoue (`domains not yet pointing to this server`), ou le
site ouvre la page d'accueil de ton hébergeur / d'un autre site.

**Cause** : l'enregistrement **A** est absent, pointe vers une autre IP, ou pointe
vers le domaine « parking » de l'hébergeur (cas très fréquent quand on a créé le
domaine sans transférer le DNS).

**Réparation** :

```bash
# (local) vérifier ce que voit le monde
nslookup {{DOMAINE}}
nslookup {{DOMAINE}} 8.8.8.8      # interroge explicitement Google DNS
```

1. `Address` différent de `{{IP_SERVEUR}}` → corrige l'enregistrement **A** chez
   ton registrar (type `A`, valeur = IP, sous-domaine `@` pour la racine).
2. `NXDOMAIN` → l'enregistrement n'existe pas → crée-le.
3. Correct mais toujours faux ailleurs → propagation : attends 15 min, re-teste
   avec `nslookup {{DOMAINE}} 1.1.1.1` (Cloudflare DNS).
4. Après correction : `sudo certbot --nginx -d {{DOMAINE}} --email {{EMAIL_ADMIN}} --agree-tos --no-eff-email`
   puis `sudo nginx -t && sudo systemctl reload nginx`.

### Panne 3: `502 Bad Gateway` sur `https://{{DOMAINE}}`

**Symptôme** : le HTTPS fonctionne (le cadenas est là) mais chaque page renvoie
`502 Bad Gateway`, et `/var/log/nginx/...-error.log` affiche
`connect() failed (111: Connection refused)` ou `upstream prematurely closed`.

**Cause** : nginx reçoit bien la requête, mais le conteneur derrière ne répond pas.
Trois variantes : conteneur à l'arrêt / port mal aligné / conteneur en crash-loop.

**Réparation** :

```bash
docker compose ps                                   # 1. quel état ? "Up" ? "Exit" ?
docker compose logs --tail=50 backend               # 2. que dit-il ?
docker compose up -d backend                        # 3. redémarrage si Exit
sudo ss -ltn | grep 8000                            # 4. le port est-il ouvert en 127.0.0.1 ?
sudo nginx -t && sudo systemctl reload nginx        # 5. si c'est site.conf qui a bougé
```

Si le conteneur repasse `unhealthy` en boucle : `docker inspect
--format='{{json .State.Health}}' $(docker compose ps -q backend)` affiche dans
`Log` la sortie exacte de la commande de santé qui échoue (route inexistante,
`curl` absent, démarrage trop lent). Si `ss` ne montre rien sur 8000 : le backend
n'écoute pas — vérifie la `CMD` de ton Dockerfile (elle doit bind sur
`0.0.0.0:8000`) et la variable `PORT` de `docker/.env`.
