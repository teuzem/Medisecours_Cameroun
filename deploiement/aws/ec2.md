# EC2 — Lancer sa machine virtuelle Ubuntu 24.04 (voie A)

> **Voie A** : ici, on ne fait rien d'exotique. On loue une machine virtuelle
> AWS et on en fait un VPS ordinaire. Toute la suite (Docker, conteneurs,
> nginx, certificats) suit la procédure décrite dans `../fullstack/vps/`.

---

## Objectif

Créer et sécuriser une instance **EC2** tournant **Ubuntu 24.04 LTS**, puis
se y connecter en SSH. À la fin de ce fichier, tu as un serveur allumé, une
IP qui ne change plus, un disque d'une taille correcte, une sauvegarde
possible — et tu peux passer à `../fullstack/vps/`.

---

## Table des valeurs à personnaliser

| Placeholder | Ce que c'est | Exemple |
|---|---|---|
| `{{NOM_PROJET}}` | Nom du projet, minuscules sans espace ; sert de nom à la clé, au pare-feu et au tag de l'instance | `medisecours` |
| `{{REGION}}` | Région de travail | `eu-west-1` |
| `{{IP_SERVEUR}}` | IP publique de l'instance (obtenue à l'étape 5) | `52.14.10.20` |
| `{{ACCESS_KEY_ID}}` / `{{SECRET_ACCESS_KEY}}` | Clés de l'utilisateur IAM utilisées par AWS CLI (étapes de `cli.md`) | — |
| `{{DOMAINE}}` | Ton domaine (sert plus tard au DNS/certificat, pas dans ce fichier) | `example.org` |

---

## Prérequis

1. AWS CLI v2 installé et `aws configure` fait avec les clés d'un
   **utilisateur IAM** → `cli.md`.
2. Un terminal avec un client SSH (Windows 10+/macOS/Linux ont `ssh` en
   standard ; sous Windows, PowerShell suffit).
3. Tu sais dans quelle région tu travailles (`eu-west-1`).
4. Aucune connaissance de virtualisation requise : EC2 *est* la virtualisation,
   la console s'en occupe.

Contrôle rapide :

```bash
aws sts get-caller-identity --query "Account" --output text
```

Sortie attendue : tes 12 chiffres de compte (`123456789012`). Si erreur de
credentials → reviens à `cli.md`.

---

## Étapes numérotées

### Étape 1 — Choisir la région

```bash
# Toutes les commandes de ce fichier travaillent dans une région unique.
# Les ressources EC2, EBS et IP Élastique créées ici N'existent que dans
# cette région-là : la changer = ne plus voir tes machines.
aws configure get region
```

Sortie attendue : `eu-west-1`. Si c'est vide ou une autre région :

```bash
aws configure set default.region {{REGION}}
```

### Étape 2 — Créer la paire de clés (la clé SSH)

```bash
# --key-name        : nom logique de la paire dans AWS (pas encore un fichier).
# --key-format pem   : format standard, ouvert par OpenSSH sans conversion.
# --query KeyMaterial / --output text : AWS nous renvoie directement le contenu
#   de la clé PRIVÉE ; on le redirige dans un fichier local. C'est le SEUL
#   moment où cette clé est visible : AWS ne la stocke pas, donc si tu la
#   perds, il faut en créer une autre.
aws ec2 create-key-pair \
  --key-name {{NOM_PROJET}}-cle \
  --key-type rsa \
  --key-format pem \
  --query "KeyMaterial" \
  --output text > {{NOM_PROJET}}-cle.pem
```

Sortie attendue : rien à l'écran, mais le fichier `{{NOM_PROJET}}-cle.pem`
existe et commence par `-----BEGIN RSA PRIVATE KEY-----`.

Restreindre les droits **immédiatement** (sinon SSH refusera la clé) :

```bash
# Linux / macOS / WSL / Git Bash : le fichier doit être lisible UNIQUEMENT
# par toi. "unprotected private key file" = droits trop ouverts.
chmod 400 {{NOM_PROJET}}-cle.pem
```

```powershell
# Windows PowerShell : OpenSSH s'appuie sur les ACL Windows, pas sur chmod.
# On retire l'héritage (personne d'autre n'aura accès) puis on ne laisse
# que toi en lecture.
icacls "{{NOM_PROJET}}-cle.pem" /inheritance:r /grant "$env:USERNAME:R"
```

### Étape 3 — Créer le Security Group (le pare-feu)

```bash
# Un Security Group = liste blanche de ports. On crée le conteneur vide ici,
# on l'ouvrira à l'étape suivante. Il est attaché au VPC par défaut.
aws ec2 create-security-group \
  --group-name {{NOM_PROJET}}-sg \
  --description "Pare-feu de l'instance {{NOM_PROJET}} : SSH + HTTP + HTTPS" \
  --query "GroupId" \
  --output text
```

Sortie attendue : un identifiant du type `sg-0a1b2c3d4e5f67890`.
**Note-le**, on en a besoin à l'étape 4. (Je l'écris `sg-XXXX` ci-dessous.)

Ouvre les ports, un par un :

```bash
# Ta propre IP en /32 : "un seul poste" en notation CIDR.
# checkip.amazonaws.com est un petit service AWS qui renvoie ton IP publique.
MA_IP="$(curl -s https://checkip.amazonaws.com)/32"
echo "Je vais ouvrir le SSH depuis : $MA_IP"

# Port 22 = SSH. On ne l'ouvre QUE depuis ton IP : un scanner de bots qui
# balaie Internet ne voit même pas que ce port existe chez moi.
aws ec2 authorize-security-group-ingress \
  --group-id sg-XXXX --protocol tcp --port 22 --cidr "$MA_IP"

# Port 80 (HTTP) et 443 (HTTPS) ouverts au monde : c'est un site web, tout
# le monde doit pouvoir y accéder. Le trafic HTTP sera ensuite renvoyé vers
# nginx à l'étape suivante de ../fullstack/vps/.
aws ec2 authorize-security-group-ingress \
  --group-id sg-XXXX --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress \
  --group-id sg-XXXX --protocol tcp --port 443 --cidr 0.0.0.0/0
```

Sortie attendue pour chacune : un bloc JSON avec `"Return": true`.

**Et surtout, ce qu'on N'OUVRE PAS, et pourquoi :**

- **5432 (PostgreSQL) et 3306 (MySQL)** : jamais depuis `0.0.0.0/0`. Des
  robots scannent l'Internet entier en continu à la recherche de bases de
  données exposées pour les chiffrer (rançongiciel) ou les vider. Notre base
  parlera soit en interne (même machine, `127.0.0.1`), soit depuis un
  Security Group dédié (voir `rds.md`).
- **8000 / 10000 / 3000 / 8081** (les ports applicatifs : API, frontend,
  WebSocket) : inutile de les ouvrir publiquement. C'est **nginx** (port 80
  et 443) qui reçoit le trafic et qui redirige vers ces ports *en local*.
  Ouvrir 8000 au monde, c'est laisser l'API parler directement aux bots sans
  HTTPS ni filtre.
- **22 depuis `0.0.0.0/0`** : déconseillé. Un bot teste des milliers de
  mots de passe/versions SSH par heure. Garde ton IP, ou élargis
  temporairement si tu changes de réseau (café, train), puis resserre.

Vérifie l'état du pare-feu :

```bash
aws ec2 describe-security-groups --group-ids sg-XXXX \
  --query "SecurityGroups[0].IpPermissions[].{Port:FromPort,Cidr:IpRanges[0].CidrIp}" \
  --output table
```

Sortie attendue : trois lignes — 22 (ton IP), 80 (`0.0.0.0/0`), 443
(`0.0.0.0/0`).

### Étape 4 — Choisir l'AMI (l'image Ubuntu 24.04)

```bash
# L'AMI = le disque de départ : "quelle distrib, quelle version".
# 099720109477 est le numéro de compte AWS officiel de Canonical (l'éditeur
# d'Ubuntu) : on ne prend que SES images, pas celles déposées par d'autres.
# On trie par date de création et on garde la plus récente.
aws ec2 describe-images \
  --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" \
  --query "sort_by(Images,&CreationDate)[-1].ImageId" \
  --output text
```

Sortie attendue : un identifiant `ami-0xxxxxxxxxxxxx`.

> **Si tu choisis une instance `t4g` (Graviton / ARM) à l'étape 5**, l'image
> doit être **arm64** : remplace `amd64` par `arm64` dans le filtre. Une AMI
> amd64 sur une machine ARM ne démarre pas.

### Étape 5 — Lancer l'instance + lui donner une IP fixe

**Quel type d'instance ?** Le type = vCPU (cœurs virtuels) + RAM.

| Type | vCPU | RAM | À quoi ça sert |
|---|---|---|---|
| `t2.micro` | 1 | **1 Go** | Free Tier, suffisant pour tester… **mais pas pour builder du Node** |
| `t3.small` | 2 | 2 Go | Test / petit site, à l'aise pour Docker |
| `t4g.medium` | 2 | 4 Go | Confortable pour builder + faire tourner l'app |
| `t3.medium` | 2 | 4 Go | Idem `t4g.medium`, mais processeur Intel (amd64) |

**Pourquoi pas `t2.micro` pour un build Node/Next.js ?** Un `npm install` +
`next build` de ce projet tire facilement à 1,5–2 Go de RAM. Avec 1 Go, le
noyau tue le processus (« OOM killed ») et le build échoue d'une façon qui
ressemble à un bug alors que c'est un manque de mémoire. La règle : **la RAM
du build est le vrai critère de choix**, pas le nombre de cœurs.

```bash
# --image-id            : l'AMI Ubuntu 24.04 de l'étape 4.
# --instance-type       : la taille (RAM/vCPU) — c'est ce qui détermine le prix horaire.
# --key-name            : la paire de l'étape 2 ; AWS y injecte la clé publique,
#                          c'est pour ça qu'aucun mot de passe n'existera.
# --security-group-ids  : le pare-feu de l'étape 3. Rien d'autre n'atteindra la machine.
# --block-device-mappings : on agrandit le disque de démarrage à 30 Go dès le
#                          départ (8 Go par défaut) : Docker + images + build
#                          Node mangent vite de la place. gp3 = disque SSD
#                          récent, économique. DeleteOnTermination=true :
#                          le disque disparaît quand on supprime l'instance
#                          (pas de facture de disque orphelin).
# --tag-specifications  : un tag "Name" = l'étiquette visible dans la console.
aws ec2 run-instances \
  --image-id ami-0xxxxxxxxxxxxx \
  --instance-type t3.small \
  --key-name {{NOM_PROJET}}-cle \
  --security-group-ids sg-XXXX \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value={{NOM_PROJET}}-serveur}]' \
  --query "Instances[0].InstanceId" \
  --output text
```

Sortie attendue : `i-0abc1234def567890` (note-le : `i-XXXX` ci-dessous).

Attends qu'elle démarre :

```bash
# "wait" attend que l'état passe à "running" (30 à 60 s). Sans ça, la
# commande suivante renverrait une IP encore vide.
aws ec2 wait instance-running --instance-ids i-XXXX
```

**IP Élastique — indispensable si ton DNS doit rester valable :**

```bash
# Pourquoi une IP Élastique ? Par défaut, à CHAQUE redémarrage, AWS retire
# l'IP publique de l'instance et en attribue une autre. Ton enregistrement
# DNS "A" pointant vers l'ancienne IP devient faux, les certificats
# HTTP-01 de Let's Encrypt échouent, tes clients perdent le site. L'IP
# Élastique est une adresse publique PERMANENTE que tu attaches/détaches.
# Tant qu'elle est attachée à une instance EN MARCHE, son coût est inclus ;
# seule (instance stoppée/supprimée), elle se facture → libère-la alors
# (voir budget.md, piège n° 2).
ALLOCATION_ID=$(aws ec2 allocate-address --query "AllocationId" --output text)
aws ec2 associate-address --instance-id i-XXXX --allocation-id "$ALLOCATION_ID"
```

Sortie attendue : `"AssociationId": "eipassoc-…"`.

Récupère l'IP (ta `{{IP_SERVEUR}}`) :

```bash
aws ec2 describe-instances --instance-ids i-XXXX \
  --query "Reservations[0].Instances[0].PublicIpAddress" --output text
```

Sortie attendue : `52.14.10.20` → c'est ta `{{IP_SERVEUR}}`.

### Étape 6 — Se connecter en SSH

```bash
# ubuntu = l'utilisateur créé par l'AMI Ubuntu (pas root : on passe par sudo
# pour les actions admin, c'est plus sûr et ça laisse une trace).
# -i = le fichier de clé privée. Le chemin est RELATIF à ton dossier courant :
# si tu es ailleurs, mets le chemin complet.
ssh -i {{NOM_PROJET}}-cle.pem ubuntu@{{IP_SERVEUR}}
```

Sortie attendue :

```
Welcome to Ubuntu 24.04.x LTS (GNU/Linux ... x86_64)
ubuntu@ip-10-0-1-23:~$
```

Note l'IP privée `10.0.x.x` : c'est l'adresse *interne* dans le VPC. Le
public `{{IP_SERVEUR}}` sert uniquement à entrer ; les services parleront en
interne.

Vérifications à faire une fois dedans :

```bash
# sudo = passer en administrateur. Sur Ubuntu, l'utilisateur "ubuntu" a les
# droits sudo sans mot de passe.
sudo whoami                        # → root
df -h /                            # → Size: 30G (notre disque)
sudo systemctl is-active ssh       # → active
```

### Étape 7 — Agrandir le disque si tu es à court d'espace

Le disque ne peut que **grandir** (jamais rétrécir sans tout copier). Deux
temps : agrandir le volume côté AWS, puis l'agrandir à l'intérieur du système.

```bash
# (1) Côté AWS — je fixe la nouvelle taille en Go. L'instance peut rester
# allumée, l'extension est en ligne et ne redémarre rien.
aws ec2 modify-volume --volume-id vol-XXXX --size 50
# Attendre que le volume soit "completed" :
aws ec2 wait volume-in-use --volume-ids vol-XXXX
```

Puis, **dans la machine en SSH** :

```bash
# (2) On regarde la géométrie réelle. Sur les instances récentes (Nitro),
# le disque /dev/sda1 de l'AMI apparaît comme /dev/nvme0n1 :
#   NAME        SIZE
#   nvme0n1     30G     <- le disque entier (maintenant 50G)
#   └─nvme0n1p1 8G      <- la partition, toujours à 8G
lsblk

# (3) growpart agrandit la partition n°1 jusqu'au bout du disque.
# Si lsblk montre /dev/xvda1 plutôt que /dev/nvme0n1, adapte la commande.
sudo growpart /dev/nvme0n1 1

# (4) resize2fs étend le système de fichiers (ext4) qui vit DANS la
# partition. Sans cette étape, le disque grossit mais df ne bouge pas.
sudo resize2fs /dev/nvme0n1p1

# (5) Contrôle final : Size doit afficher la nouvelle taille.
df -h /
```

Sortie attendue : `Filesystem … Size: 50G … Use%` en hausse de la capacité.

### Étape 8 — Sauvegardes : snapshot manuel + planification

```bash
# Un snapshot = copie du disque entier stockée dans S3. On en fait un avant
# toute manipulation risquée (mise à jour majeure, migration de base…).
# Le premier est complet (quelques minutes), les suivants sont incrémentaux
# et rapides. Le volume doit exister : vol-XXXX se lit avec :
aws ec2 describe-instances --instance-ids i-XXXX \
  --query "Reservations[0].Instances[0].BlockDeviceMappings[0].Ebs.VolumeId" \
  --output text

aws ec2 create-snapshot \
  --volume-id vol-XXXX \
  --description "Sauvegarde manuelle {{NOM_PROJET}} avant mise à jour" \
  --query "SnapshotId" \
  --output text
```

Sortie attendue : `snap-0123456789abcdef0`.

**Planification automatique** (console, 2 minutes) : console EC2 →
*Snapshots* → *Lifecycle Manager* → créer une politique : fréquence
quotidienne, rétention 7 jours, volume à sauvegarder = notre volume. Comme
ça, tu n'y penses plus — c'est ce que fait RDS automatiquement (voir
`rds.md`). Attention à la rétention : chaque snapshot vieillissant reste
facturé (piège n° 5 de `README.md`).

### Étape 9 — Déployer l'application (la suite du chemin)

La machine est prête. **À partir d'ici, AWS n'a plus rien de particulier** :
c'est un serveur Ubuntu classique. Suis `../fullstack/vps/` :

1. installer Docker et docker compose,
2. cloner le dépôt,
3. préparer `.env`,
4. `docker compose -f docker-compose.prod.yml up -d --build`,
5. installer nginx en face (ports 80/443 déjà ouverts au pare-feu),
6. certificat HTTPS + enregistrement DNS `A` vers `{{IP_SERVEUR}}`
   (commandes Route53 dans `cli.md`).

---

## Vérification

```bash
# 1. Instance en marche + IP Élastique attachée
aws ec2 describe-instances --instance-ids i-XXXX \
  --query "Reservations[0].Instances[0].{Etat:State.Name,IP:PublicIpAddress,Type:InstanceType}" --output table
# → Etat: running, IP: {{IP_SERVEUR}}, Type: t3.small

# 2. Pare-feu : exactement 3 règles
aws ec2 describe-security-groups --group-ids sg-XXXX \
  --query "SecurityGroups[0].IpPermissions[].{De:FromPort,A:IpRanges[0].CidrIp}" --output table

# 3. Connexion + disque + Docker
ssh -i {{NOM_PROJET}}-cle.pem ubuntu@{{IP_SERVEUR}} "df -h / && sudo docker --version"
# → Size: 30G (ou plus) + Docker version …

# 4. HTTP répond (une fois nginx en place dans ../fullstack/vps/)
curl -I http://{{IP_SERVEUR}}
# → HTTP/1.1 200 OK (avant nginx : connexion refusée, c'est normal)
```

---

## Dépannage (3 pannes probables)

**1. `Host key verification failed.`**

*Cause* : l'entrée de cette IP est déjà dans ton fichier `known_hosts`, mais
la machine a changé (tu as supprimé puis recréé l'instance, l'IP Élastique a
été réattribuée…). SSH refuse de se connecter à une « nouvelle machine » qui
donne une vieille empreinte — c'est une protection contre l'homme du milieu.

```bash
# On efface la mémoire de cette IP, puis on relance la connexion.
ssh-keygen -R {{IP_SERVEUR}}
ssh -i {{NOM_PROJET}}-cle.pem ubuntu@{{IP_SERVEUR}}
# À la première reconnexion, accepte l'empreinte ("yes") quand SSH affiche
# "The authenticity of host ... can't be established".
```

**2. `Permission denied (publickey).`**

*Cause* : la clé privée ne correspond pas à la clé publique de l'instance, ou
SSH ne l'utilise pas. Les 4 motifs classiques, dans l'ordre où il faut les
vérifier :

```bash
# a) Mauvais utilisateur : Ubuntu ne se connecte JAMAIS en root ici.
ssh -i {{NOM_PROJET}}-cle.pem root@{{IP_SERVEUR}}   # → échec
ssh -i {{NOM_PROJET}}-cle.pem ubuntu@{{IP_SERVEUR}}  # → ok

# b) Mauvais chemin / droits du fichier.
ls -l {{NOM_PROJET}}-cle.pem    # doit afficher -rw------- (400), sinon chmod 400
                                # (voir étape 2 pour la variante PowerShell)

# c) Tu as supprimé puis recréé la paire de clés : l'ancien .pem ne vaut
#    plus rien. Solution : recréer l'instance OU créer une nouvelle paire,
#    la rattacher via Actions → Attach/change key pair, redémarrer.

# d) Le fichier .pem a été édité/copié avec des retours à la ligne Windows :
#    la première ligne doit être EXACTEMENT -----BEGIN RSA PRIVATE KEY-----
head -1 {{NOM_PROJET}}-cle.pem
```

**3. `Connection timed out` (la connexion n'aboutit jamais)**

*Cause* : le paquet n'atteint jamais la machine. Dans 95 % des cas, c'est le
**Security Group**, le reste, c'est la mauvaise IP.

```bash
# a) Le port 22 n'est ouvert que depuis ton IP d'origine : tu es peut-être
#    sur un autre réseau (autre wifi, mobile). Récupère ton IP actuelle :
curl -s https://checkip.amazonaws.com
# Si elle a changé, élargis temporairement :
aws ec2 authorize-security-group-ingress --group-id sg-XXXX \
  --protocol tcp --port 22 --cidr "$(curl -s https://checkip.amazonaws.com)/32"

# b) Tu utilises une ancienne IP : l'IP Élastique n'était pas attachée et
#    l'adresse a changé au redémarrage. Confirme l'IP actuelle :
aws ec2 describe-instances --instance-ids i-XXXX \
  --query "Reservations[0].Instances[0].PublicIpAddress" --output text

# c) Pare-feu LOCAL sur l'instance (rare, mais réel) : UFW peut bloquer
#    même si le Security Group est ouvert. En SSH via la console
#    (EC2 → Connect → EC2 Instance Connect) puis :
sudo ufw status
# Si "active" et que le 22 n'y figure pas :
sudo ufw allow 22/tcp && sudo ufw reload
```

Astuce : quand le SSH ne passe pas, la **console EC2 → Instance → Connect →
EC2 Instance Connect** te donne un terminal dans le navigateur (il passe par
un autre canal). C'est ton filet de sécurité pour débloquer UFW ou voir ce
qui tourne.

---

## Coût

| Ressource | Quand c'est facturé | Ordre de grandeur / mois |
|---|---|---|
| Instance `t2.micro` | Free Tier : **gratuit les 12 premiers mois**, puis à l'heure | ~5–10 $ après |
| Instance `t3.small` | Facturée à l'heure tant qu'elle tourne. Stoppée : plus de calcul, mais le disque reste payant | ~10–20 $ |
| Instance `t4g.medium` | Idem | ~20–30 $ |
| Disque EBS gp3 30 Go | Toujours, tant qu'il existe (même instance stoppée) | ~3–4 $ |
| IP Élastique attachée à une instance en marche | Comprise dans le prix | 0 $ |
| IP Élastique détachée | À l'heure tant qu'elle traîne | ~quelques dollars |
| Snapshot (20 Go, rétention 7 j) | Au Go stocké | ~quelques dollars |

**Réflexe** : après un test, `aws ec2 terminate-instances --instance-ids i-XXXX`
supprime instance + disque en un coup (l'IP Élastique doit être libérée
séparément). Checklist complète dans `budget.md`.

Vérifie la grille officielle : https://aws.amazon.com/pricing/
Free Tier (12 mois) : https://aws.amazon.com/free/
Documentation EC2 : https://docs.aws.amazon.com/
Console : https://aws.amazon.com/console/
