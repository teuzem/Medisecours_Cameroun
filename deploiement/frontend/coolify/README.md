# Mise en production sur VPS + Coolify — procédure complète de bout en bout

**Sous-dossier :** `coolify/`
**Durée estimée :** 1 h 30 à 2 h (la première fois).
**Ce que tu vas faire :** acheter un serveur virtuel, y installer Coolify, et faire en sorte que
chaque `git push` sur `main` redéploie automatiquement le site en HTTPS.

---

## Objectif

Mettre le frontend `{{NOM_PROJET}}` en ligne sur **ton propre serveur**, avec :

- HTTPS automatique et renouvelé tout seul ;
- auto-déploiement au **push sur `main`** ;
- les **2 services** du projet hébergés au même endroit : frontend (port **3000**) et service
  WebSockets (port **8081**, chemin `/ws`) — ce que Netlify/Vercel ne font pas ;
- un coût **fixe et maîtrisé** (le VPS), pas un prix qui grimpe avec le trafic.

### C'est quoi Coolify ?

**Coolify** est un **PaaS auto-hébergé** : concrètement, c'est **« Vercel, mais chez toi »**.
Une interface web dans laquelle tu connectes un dépôt GitHub, tu choisis un domaine, et la plateforme
s'occupe de construire l'image Docker, de lancer le conteneur, d'obtenir le certificat HTTPS et de
relancer tout ça à chaque push. Sans Coolify, tu ferais tout ça à la main en ligne de commande.

### C'est quoi Traefik ?

**Traefik** est le **reverse proxy** installé avec Coolify. Il est la **seule porte d'entrée** du
serveur : il écoute sur les ports **80** (HTTP) et **443** (HTTPS), reçoit chaque requête entrante,
lit le nom de domaine demandé (`Host: app.exemple.fr`) et **réécrit** la requête vers le bon
conteneur interne (frontend sur 3000, WS sur 8081). C'est lui qui **demande et renouvelle les
certificats Let's Encrypt** (le fameux padlock) automatiquement, et qui **chiffre** le trafic.
Sans lui, tu devrais gérer certificats et ports à la main.

> Coolify installe **Caddy ou Traefik** selon la version : les deux jouent exactement le même rôle
> (reverse proxy + HTTPS automatique). Si ton installation affiche « Caddy », remplace « Traefik »
> par « Caddy » dans ta tête, tout le reste de la procédure est identique.

### C'est quoi l'intégration GitHub ?

Coolify a besoin de **voir ton dépôt** pour savoir quoi builder. Deux façons :

1. **GitHub App (recommandée)** : tu installes une application GitHub créée par Coolify sur ton
   organisation/compte. Coolify reçoit alors les **webhooks** (notifications automatiques à chaque
   push) → l'auto-déploiement fonctionne sans rien configurer.
2. **Dépôt public + webhook manuel** : si le dépôt est public, tu donnes juste l'URL. Comme Coolify
   ne reçoit pas alors les notifications, tu colles **à la main** l'URL de webhook fournie par
   Coolify dans GitHub (Settings → Webhooks) ou dans une GitHub Action du projet.

Les deux cas sont traités à l'étape 6.

---

## Prérequis

- Un compte **GitHub** avec le code du frontend.
- Un **nom de domaine** + accès à sa **zone DNS**.
- Une **carte bancaire** pour acheter le VPS (Contabo).
- ~2 h devant toi, et la possibilité d'ouvrir **deux fenêtres de terminal en même temps**
  (obligatoire pour l'étape 2, cf. mise en garde anti-verrouillage).
- **Aucune** connaissance Linux : tu copies-colles.

---

## Étapes

### Étape 1 — Acheter le VPS chez Contabo

1. Va sur **https://contabo.com** → crée un compte → **Login → Client Area**.
2. **Products → VPS** → choisis une config **VPS 4 ou 8 vCPU / 8 Go de RAM / 100 Go SSD**,
   région **Europe (Allemagne ou France)**.
   - **Pourquoi 8 Go de RAM :** le build d'une app Next.js (bundle webpack + optimisation d'images)
     dépasse facilement **2 Go**. En dessous de 4 Go, le kernel Linux **tue** le process de build
     (voir le dépannage « Killed / code 137 »). 8 Go laisse de la marge pour Docker + Coolify + le build.
3. Système d'exploitation : **Ubuntu 24.04 LTS** (LTS = support de sécurité jusqu'en **avril 2029**,
   c'est la seule version à choisir pour un serveur qui doit tourner des années).
4. Paie, puis attends la **fin de préparation** (5 min) : le tableau de bord affiche alors une
   **IPv4**. **Note-la** : c'est ta valeur `{{IP_SERVEUR}}`.

**Sortie attendue :** dans Client Area → tes serveurs → une ligne du type
`VPS 8GB — 203.0.113.42 — RUNNING` (Ubuntu 24.04.1).

### Étape 2 — Se connecter en SSH (root + mot de passe + IP)

Ouvre **PowerShell** (Windows) ou **Terminal** (macOS/Linux). Copie-colle :

```bash
ssh root@{{IP_SERVEUR}}
```
- La **première fois**, le terminal affiche :
  `Are you sure you want to continue connecting (yes/no/[fingerprint])?`
  → tape `yes` puis Entrée. C'est la **signature SSH** du serveur, tu ne la verras plus.
- Puis : `root@{{IP_SERVEUR}}'s password:` → **colle le mot de passe** reçu par mail Contabo
  (il ne s'affiche pas à l'écran, c'est normal — pas de `***`). Entrée.

**Sortie attendue :** un invite du type `root@vps-xxxx:~#`. Tu es **root** (administrateur total)
sur le serveur. **Garde cette fenêtre ouverte.**

> ⚠️ **AVANT DE CONTINUER : ouvre une SECONDE fenêtre de terminal** et refais
> `ssh root@{{IP_SERVEUR}}`. C'est **obligatoire** : l'étape 5 durcit la config SSH et, si tu te
> trompes, **tu perds l'accès à ton serveur pour toujours**. La règle est simple : **ne ferme
> jamais la session 1 tant que la session 2 n'a pas prouvé qu'elle marche.**

> 💡 Si `ssh` n'est pas reconnu sous Windows : Activez « OpenSSH Client »
> (Paramètres → Applications → Fonctionnalités optionnelles → OpenSSH Client), ou utilise
> **Windows Terminal** qui l'inclut.

### Étape 3 — Préparer le VPS : `01-preparer-le-vps.sh`

Dans la **fenêtre 1**, copie-colle ce qui suit pour télécharger le script et l'exécuter :

```bash
curl -fsSL -o /root/01-preparer-le-vps.sh https://raw.githubusercontent.com/{{NOM_PROJET}}/{{NOM_PROJET}}/main/deploiement/frontend/coolify/01-preparer-le-vps.sh
bash /root/01-preparer-le-vps.sh
```

> Si ton fichier vit ailleurs, l'alternative « toujours vraie » consiste à ouvrir le fichier
> `coolify/01-preparer-le-vps.sh` sur ton ordinateur, **télécharger son contenu**, puis sur le VPS :
> ```bash
> cat > /root/01-preparer-le-vps.sh   # puis coller le contenu, puis Ctrl+D
> bash /root/01-preparer-le-vps.sh
> ```

**Ce que fait ce script, en résumé** (le détail est en commentaires dans le fichier) :

| Bloc | Ce que le serveur fait concrètement |
|---|---|
| `apt update/upgrade` | Met à jour la liste des paquets et installe les outils de base (`curl`, `git`, `ufw`…) |
| **Swap 4 Go** | Crée un fichier de 4 Go servi comme **mémoire virtuelle** sur le disque. Sans ça, le build Next.js est tué en plein milieu (« Killed », code 137) |
| **UFW** | Pare-feu : **tout est bloqué par défaut**, seuls les ports **22, 80, 443, 8000, 6002** sont ouverts |
| **fail2ban** | Compte les échecs de connexion SSH et **bannit** l'IP après 5 essais → bloque les bots 24 h/24 |
| Fuseau horaire | `Europe/Paris` → logs et crons alignés sur ton heure locale |
| Utilisateur `deploy` | Crée un utilisateur **non-root** avec droits `sudo` (on ne travaille jamais en root au quotidien : une commande ratée en root peut détruire le serveur) |
| Durcissement SSH | Limite les tentatives, désactive le forwarding inutile — **avec une mise en garde : ne jamais se verrouiller** |

**Sortie attendue :** à la fin, un récapitulatif à l'écran, du type :

```
==================================================
 VPS prêt pour Coolify
 - Utilisateur créé : deploy  (sudo sans mot de passe)
 - Swap actif : 4.0G
 - Pare-feu actif (UFW) : 22, 80, 443, 8000, 6002
 PROCHAINE ÉTAPE : bash 02-installer-coolify.sh
==================================================
```

### Étape 4 — Installer Coolify : `02-installer-coolify.sh`

**Toujours dans la fenêtre 1** :

```bash
curl -fsSL https://cdn.coolify.io/install.sh | bash
```

**Ce que fait ce script officiel** (il est maintenu par l'équipe Coolify, ne le modifie pas) :

1. **Installe Docker Engine** (le moteur qui exécute les conteneurs) + le plugin Compose.
2. **Télécharge et lance les services internes de Coolify** : sa propre base de données, son serveur
   d'API, et le **reverse proxy (Caddy/Traefik)** qui gérera les certificats HTTPS.
3. **Expose l'interface web sur le port 8000** (et le terminal web sur 6002).

**Durée :** 3 à 8 minutes (ça télécharge ~500 Mo d'images Docker).

**Sortie attendue :** à la très fin, le script affiche quelque chose comme :

```
Congratulations! 🎉
Coolify is up and running at http://<IP>:8000
To create an admin user and get the password, run:
   sudo coolify --admin-user
```

> 📌 **Note importante :** le **tout premier utilisateur inscrit** dans l'interface
> deviendra **l'administrateur**. Il n'y a pas de compte par défaut : si quelqu'un d'autre ouvre
> l'URL avant toi, c'est **lui** le boss. Inscris-toi **immédiatement** après l'installation.

*(Si ta version affiche un mot de passe admin généré automatiquement à l'écran, note-le dans un
gestionnaire de mots de passe — tu pourras le régénérer plus tard.)*

**Puis, une dernière chose avant l'étape suivante** (ajoute `deploy` au groupe Docker — ce groupe
n'existait pas au moment de l'étape 3, Docker vient d'être installé) :

```bash
usermod -aG docker deploy
```
**Pourquoi :** sans ça, l'utilisateur `deploy` ne peut pas parler à Docker et tu devras tout faire
en `root` (mauvaise habitude).

### Étape 5 — Se connecter à l'interface Coolify

1. Ouvre **http://{{IP_SERVEUR}}:8000** dans ton navigateur (en HTTP pour l'instant : le certificat
   n'existe pas encore, il sera créé à l'étape 7 avec ton domaine).
2. **Inscris-toi** avec `{{EMAIL_ADMIN}}` + un mot de passe fort → **ce compte est admin**.
3. Au premier écran, Coolify te propose de **répondre à quelques questions** : passe-les, tu
   pourras tout changer ensuite.

**Pourquoi en HTTP :** un certificat Let's Encrypt exige un domaine, pas une IP. On configure le
domaine à l'étape 7, et **c'est à ce moment-là que Traefik/Caddy demandera le certificat**.

### Étape 6 — Créer le projet et connecter GitHub

> Interface pas-à-pas complète avec les noms de champs exacts → **[`03-creer-projet-coolify.md`](./03-creer-projet-coolify.md)**

Résumé en 6 points (les détails et les valeurs des variables sont dans le fichier ci-dessus) :

1. **Projects → Create project** → nom : `{{NOM_PROJET}}`.
2. **+ New resource → Git Repository** → choisis ton intégration :
   - **GitHub App** (installée via *GitHub → Install GitHub App*) : sélectionne le dépôt → l'auto-déploiement au push fonctionne **tout seul** ;
   - sinon **URL de dépôt public** : colle `https://github.com/{{NOM_PROJET}}/medisecours-frontend` → tu devras **coller l'URL de webhook** de Coolify dans GitHub (Settings → Webhooks) pour activer le push-to-deploy.
3. **Build Pack : Dockerfile** → Coolify détecte le `Dockerfile` (fourni dans ce dossier, à copier à la racine du dépôt frontend).
4. **VARIABLES & SECRETS** → renseigne les 6 variables de build (liste complète dans `03-creer-projet-coolify.md`).
5. **DOMAINS** → `https://{{DOMAINE}}`, port exposé **3000**.
6. **Sauvegarder → Start**.

### Étape 7 — Configurer le domaine + HTTPS

**Avant de démarrer**, crée l'enregistrement DNS chez ton registrar :

| Type | Nom | Valeur |
|---|---|---|
| `A` | `@` (ou laisser vide pour le domaine racine) | `{{IP_SERVEUR}}` |
| `A` | `www` *(optionnel)* | `{{IP_SERVEUR}}` |
| `A` | `{{DOMAINE_WS}}` *(le service WebSocket)* | `{{IP_SERVEUR}}` |

Puis dans Coolify → ta resource → **DOMAINS** :

```
Domains : https://{{DOMAINE}}
```

**Sauvegarder**, puis **Start**. Ce qui se passe concrètement au démarrage :

1. Traefik/Caddy reçoit la demande, voit `Host: {{DOMAINE}}`.
2. Il contacte **Let's Encrypt** (`https://acme-v02.api.letsencrypt.org`) en mode HTTP-01 :
   Let's Encrypt envoie un défi sur `http://{{DOMAINE}}/.well-known/acme-challenge/...`,
   Traefik y répond → Let's Encrypt émet le certificat.
3. Traefik stocke le certificat et **le renouvelle automatiquement** ~30 jours avant expiration.
4. Le trafic bascule en HTTPS. **Rien à faire de ton côté, jamais.**

> ⏱ **Attends la propagation DNS avant de cliquer sur Start** (5 min à 24 h, en général 10 min).
> Vérifie depuis le VPS : `nslookup {{DOMAINE}} 1.1.1.1` doit afficher `{{IP_SERVEUR}}`.
> Si tu démarres trop tôt, Let's Encrypt **rate-limit** ta demande (5 échecs/heure) → il faudra
> attendre une heure. Ce n'est pas grave, mais c'est long.

### Étape 8 — Push sur `main` = mise en ligne automatique

```bash
git add deploiement/frontend/
git commit -m "docs(deploy): ajoute les templates de déploiement frontend"
git push origin main
```

**Ce qui se passe côté serveur** (à la seconde) :

1. GitHub notifie Coolify (webhook) — **c'est l'étape qui ne se déclenche que si l'intégration GitHub est configurée**.
2. Coolify clone le dépôt, construit **l'image Docker** (étape deps → build → run, ~2-5 min).
3. Il arrête l'ancien conteneur, démarre le nouveau sur le port **3000**.
4. Traefik bascule le trafic → le nouveau code est en ligne. **Zéro interruption de service.**

### Étape 9 — Vérification

→ Va directement dans **[`04-verifier-et-depanner.md`](./04-verifier-et-depanner.md)** : il contient
la checklist complète (HTTPS, healthcheck, logs) et le dépannage ciblé.

En 30 secondes, depuis ton ordinateur :

```bash
curl -I https://{{DOMAINE}}
```
**Sortie attendue :** `HTTP/2 200`. Si c'est `502` ou `503`, le conteneur ne tourne pas encore :
regarde les logs (fichier 04).

---

## Table des valeurs à personnaliser

| Placeholder | Exemple | Où trouver la valeur |
|---|---|---|
| `{{NOM_PROJET}}` | `medisecours` | Nom du projet / du dépôt GitHub |
| `{{DOMAINE}}` | `app.exemple.fr` | Registrar → zone DNS → enregistrement **A** `@` → `{{IP_SERVEUR}}`. À recopier dans Coolify → **DOMAINS** |
| `{{DOMAINE_API}}` | `api.exemple.fr` | Domaine du backend. À mettre dans la variable `API_BASE_URL` de Coolify |
| `{{DOMAINE_WS}}` | `ws.exemple.fr` | Domaine devant le service WS (port 8081). Enregistrement **A** → `{{IP_SERVEUR}}`. À mettre dans `NEXT_PUBLIC_WS_URL` sous la forme `wss://{{DOMAINE_WS}}/ws` |
| `{{IP_SERVEUR}}` | `203.0.113.42` | **Contabo → Client Area → tes serveurs → IPv4**. Sert au SSH (`ssh root@...`), aux DNS, et à `http://{{IP_SERVEUR}}:8000` pour l'UI |
| `{{EMAIL_ADMIN}}` | `admin@exemple.fr` | Ta boîte mail → compte **admin** Coolify + contact Let's Encrypt |
| `{{PORT}}` | `3000` | 3000 = frontend (à exposer dans Coolify), 8081 = WebSocket, 8000 = UI Coolify, 6002 = terminal web Coolify |

---

## Vérification

```bash
# 1. HTTPS + certificat valide (padlock)
curl -I https://{{DOMAINE}}
# → HTTP/2 200   ✅
# → 301          → refaire avec http:// pour confirmer la redirection H→S
# → 502/503      → conteneur ko → voir 04-verifier-et-depanner.md

# 2. La variable de WebSocket est-elle bien dans le JS livré ? (piège 5)
curl -s https://{{DOMAINE}} | grep -o 'wss://[^"]*' | head -1
# → wss://{{DOMAINE_WS}}/ws   ✅
# → ws://127.0.0.1:8081/ws    ❌ variable absente au build → REBUILDER

# 3. Le healthcheck du conteneur
docker ps --format 'table {{.Names}}\t{{.Status}}'
# → Up X minutes (healthy)   ✅
```

Dans le navigateur : `https://{{DOMAINE}}` → padlock, carte avec marqueurs, F12 → Console sans
erreur `Mixed Content`, onglet Réseau → appels `/api/*` en 200.

**Tests à faire sur le serveur** (SSH) :

```bash
# Coolify et ses services sont-ils levés ?
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
# → conteneurs coolify-* en « Up », plus ta resource sur 0.0.0.0:3000->3000/tcp

# Le certificat a-t-il été émis ?
ls -la /data/traefik/certificates/ 2>/dev/null || ls -la /data/caddy/pki/authorities/local/
# → un fichier .crt correspondant à {{DOMAINE}}
```

---

## Dépannage

### Erreur 1 — `Permission denied` / `sudo: a password is required`

**Cause 1 :** tu exécutes le script 01 sans être root ni sudo.
**Fix :**
```bash
sudo bash /root/01-preparer-le-vps.sh
```

**Cause 2 (la plus fréquente) :** tu es passé à l'utilisateur `deploy` et son sudo demande un mot de
passe que tu n'as pas défini — ou il n'est **pas** dans le groupe `sudo`.
**Fix :**
```bash
# reviens en root (cette session-là, elle, existe encore)
su - root
# puis vérifie et corrige
usermod -aG sudo deploy
echo 'deploy ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/deploy && chmod 440 /etc/sudoers.d/deploy
```

**Cause 3 :** `curl: (7) Failed to connect` en voulant télécharger un script → le **pare-feu UFW**
ou le réseau sortant bloque. Vérifie avec `ufw status` que 22/80/443 sont bien `ALLOW`.

### Erreur 2 — Port déjà utilisé : `bind: address already in use` / site injoignable sur :8000

**Cause :** quelque chose écoute **déjà** sur le port. 8000 = une **ancienne installation Coolify**
ou un autre service ; 3000 = un `npm run dev` oublié ou un ancien conteneur ; 8081 = un ancien
service WebSocket.

**Fix :**
```bash
# qui écoute sur quels ports ?
sudo ss -lntp | grep -E ':(3000|8081|8000)'
# → colonne users : ex. users:(("node",pid=1234,fd=23))

# cas 1 : un process classique (node, npm)
sudo kill 1234

# cas 2 : un ancien conteneur Docker
docker ps -a                       # liste tous, même arrêtés
docker stop <nom_conteneur> ; docker rm <nom_conteneur>
```
Puis relance le démarrage depuis l'UI Coolify.

**Corollaire important (502) :** si l'UI Coolify expose un **autre** port que 3000 (par ex. 80),
Traefik envoie la requête à un port où **personne n'écoute** → `502 Bad Gateway`. Dans
*Resource → Network*, le port exposé doit être **3000**.

### Erreur 3 — DNS non propagé : `Could not obtain certificate` / `Hostname has no address`

**Cause :** tu as lancé Start alors que Let's Encrypt ne pouvait pas résoudre `{{DOMAINE}}`.

**Fix :**
```bash
# depuis le VPS — c'est LA machine qui doit résoudre, pas ton PC
nslookup {{DOMAINE}} 1.1.1.1
# → Name: {{DOMAINE}} / Address: {{IP_SERVEUR}}   ✅

# si ce n'est pas le cas : vérifie le TYPE (A) et le NOM (@ ou www) chez ton registrar,
# puis attends. Un nouvel enregistrement met 5 min à 24 h (médiane : 10-30 min).
```
Quand c'est bon → Coolify → *Resource* → **Restart** pour relancer la demande de certificat.
Si Let's Encrypt t'a rate-limité (5 tentatives/heure), **attends 1 h** puis relance.

### Les autres cas (liste complète)

| Symptôme | Fichier |
|---|---|
| Build qui échoue (mémoire, cache npm, Turbopack), site blanc, 502, variables ignorées | `04-verifier-et-depanner.md` |
| Ligne de commande `docker` introuvable après reconnexion | `usermod -aG docker deploy` puis **déconnecte/reconnecte** ta session SSH (le groupe ne s'applique qu'au prochain login) |
| Le site répond en HTTP mais pas en HTTPS | Le domaine n'est pas dans le champ **DOMAINS** avec `https://` devant → corrige puis Restart |
| `Killed` ou `exit code 137` pendant le build | **Manque de RAM** → vérifie `free -h` ; le swap 4 Go du script 01 a peut-être été oublié (`swapon --show`) |

Liens officiels utiles :
- Installation Coolify : **https://coolify.io/docs**
- Docker Engine (Ubuntu) : **https://docs.docker.com/engine/install/ubuntu/**
- Certificats manuels (si jamais) : **https://certbot.eff.org/**
