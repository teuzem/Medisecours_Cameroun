# RDS — Base PostgreSQL 16 managée

---

## Objectif

Créer une base **PostgreSQL 16** sur **RDS** (le service de base de données
managé d'AWS), sécurisée de façon stricte (accessible **uniquement** depuis
ton instance EC2), récupérer son adresse `xxx.rds.amazonaws.com`, la brancher
dans le `DATABASE_URL` de l'application, et comprendre sauvegardes,
restauration et facturation.

**Pourquoi RDS plutôt que PostgreSQL dans un conteneur sur EC2 ?**
AWS s'occupe de : sauvegardes automatiques quotidiennes, restauration à un
point dans le temps, patches de sécurité du moteur, redémarrage si le
disque est plein, monitoring. Toi, tu n'as jamais `apt upgrade` une base. Le prix :
tu ne choisis plus les options du moteur, et la base tourne **24 h/24**.

---

## Table des valeurs à personnaliser

| Placeholder | Ce que c'est | Exemple |
|---|---|---|
| `{{NOM_PROJET}}` | Préfixe de tous les noms (instance, groupe de sous-réseaux, pare-feu) | `medisecours` |
| `{{REGION}}` | Région — **doit être la même que l'instance EC2**, sinon les deux ne peuvent pas se parler | `eu-west-1` |
| `{{IP_SERVEUR}}` | IP de l'instance EC2 (sert aux tests de connexion depuis ce fichier) | `52.14.10.20` |
| `{{ACCESS_KEY_ID}}` / `{{SECRET_ACCESS_KEY}}` | Clés IAM de `aws configure` | — |
| `{{EMAIL_ADMIN}}` | Email pour les sauvegardes/tag de la base | `toi@exemple.org` |

---

## Prérequis

1. AWS CLI v2 configuré (`cli.md`).
2. **Une instance EC2 déjà lancée** avec son Security Group (fichier
   `ec2.md`) : RDS va n'accepter les connexions que de *ce* pare-feu-là.
3. Même région pour EC2 et RDS.
4. `openssl` disponible pour générer un mot de passe (présent sur Windows 10+,
   macOS et Linux).

---

## Étapes numérotées

### Étape 1 — Repérer le VPC par défaut et ses sous-réseaux

```bash
# Le VPC = ton réseau privé dans le cloud. AWS en a déjà créé un à
# l'ouverture du compte : le "VPC par défaut", découpé en sous-réseaux,
# eux-mêmes répartis sur plusieurs zones de disponibilité (bâtiments
# différents). RDS exige au minimum 2 sous-réseaux dans 2 zones distinctes :
# c'est ce qui permet, plus tard, un basculement automatique (Multi-AZ).
VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
  --query "Vpcs[0].VpcId" --output text)
echo "VPC par défaut : $VPC_ID"     # → vpc-0123456789abcdef0

# Liste des sous-réseaux : on va en garder 2, dans 2 zones différentes.
aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" \
  --query "Subnets[].{Id:SubnetId,Zone:AvailabilityZone}" \
  --output table
```

Sortie attendue : un tableau de 3+ lignes (`subnet-aaa` en `eu-west-1a`,
`subnet-bbb` en `eu-west-1b`, …). **Note deux identifiants dans deux zones
différentes** : je les appelle `subnet-A` et `subnet-B` ci-dessous.

### Étape 2 — Créer le groupe de sous-réseaux RDS

```bash
# Un "DB subnet group" = la liste des sous-réseaux où RDS a le droit de
# déployer la base. Sans lui, RDS refuse de démarrer (il veut pouvoir placer
# la base dans 2 zones pour le basculement).
aws rds create-db-subnet-group \
  --db-subnet-group-name {{NOM_PROJET}}-sous-reseaux \
  --description "Sous-réseaux autorisés pour la base {{NOM_PROJET}}" \
  --subnet-ids subnet-A subnet-B \
  --output table
```

Sortie attendue : un tableau avec `{{NOM_PROJET}}-sous-reseaux` et
`active`.

### Étape 3 — Créer le Security Group de la base (LA étape de sécurité)

```bash
# On crée le pare-feu de la base dans le VPC par défaut.
aws ec2 create-security-group \
  --group-name {{NOM_PROJET}}-rds-sg \
  --description "PostgreSQL : accessible uniquement depuis l'instance EC2 {{NOM_PROJET}}" \
  --query "GroupId" --output text
```

Sortie attendue : `sg-0rdsXXXXXXX` (je l'écris `sg-RDS` ci-dessous).

Récupère le pare-feu de ton instance EC2 (`ec2.md` étape 3) :

```bash
aws ec2 describe-instances --instance-ids i-XXXX \
  --query "Reservations[0].Instances[0].SecurityGroups[0].GroupId" --output text
# → sg-0ec2XXXXXXX   (je l'écris sg-EC2)
```

Ouvre **un seul** port, **depuis un seul** pare-feu :

```bash
# --protocol tcp --port 5432 : le port d'écoute de PostgreSQL. Un seul.
# --source-group sg-EC2      : LA formulation correcte. Elle dit à AWS :
#   "n'autorise que les machines qui portent ce pare-feu-là". Contrairement
#   à --cidr, une IP peut changer (redémarrage) : ici c'est le pare-feu
#   qui porte la règle, donc le lien suit l'instance.
aws ec2 authorize-security-group-ingress \
  --group-id sg-RDS \
  --protocol tcp --port 5432 \
  --source-group sg-EC2
```

Sortie attendue : `"Return": true`.

> **Pourquoi une interdiction formelle de `0.0.0.0/0` sur 5432 ?**
> Des robots balayent l'Internet entier en permanence (Shodan, mass scans)
> à la recherche de port 5432/3306 ouverts. Ils tentent les mots de passe
> par défaut, puis déposent un rançongiciel, vident les tables ou créent un
> compte admin. Exposer une base de données sur Internet est **le** moyen le
> plus rapide de perdre ses données. Ici, la base n'est joignable que par
> l'instance EC2 ; le reste du monde reçoit un timeout silencieux. Si tu as
> *déjà* publié une base en `0.0.0.0/0`, supprime la règle tout de suite :
> `aws ec2 revoke-security-group-ingress --group-id sg-RDS --protocol tcp --port 5432 --cidr 0.0.0.0/0`.

### Étape 4 — Choisir la version exacte de PostgreSQL 16

```bash
# RDS propose plusieurs "versions mineures" (16.4, 16.5…). Plutôt que de
# deviner, on demande la liste à AWS et on prend la première proposée.
aws rds describe-db-engine-versions --engine postgres \
  --query "DBEngineVersions[?starts_with(EngineVersion,'16.')].EngineVersion" \
  --output text
```

Sortie attendue : une liste du type `16.11 16.10 16.9 …` (ça évolue).

```bash
# On garde la première valeur de la liste dans une variable.
VERSION_PG=$(aws rds describe-db-engine-versions --engine postgres \
  --query "DBEngineVersions[?starts_with(EngineVersion,'16.')].EngineVersion" \
  --output text | tr ' ' '\n' | head -n 1)
echo "PostgreSQL retenu : $VERSION_PG"
```

### Étape 5 — Générer et conserver le mot de passe maître

```bash
# 24 caractères alphanumériques tirés d'openssl. Ce mot de passe n'est plus
# ré-affichable : RDS le stocke chiffré mais ne le montre jamais. Copie-le
# dans ton gestionnaire de mots de passe MAINTENANT.
MOT_DE_PASSE_DB=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | cut -c1-24)
echo "$MOT_DE_PASSE_DB"     # copie-le, il disparaît de l'écran ensuite
```

### Étape 6 — Créer l'instance de base

```bash
# --db-instance-identifier : nom lisible de la base (celui que tu verras partout).
# --engine postgres / --engine-version : le moteur exact (étape 4).
# --db-instance-class db.t4g.micro : LE choix économique. t4g = processeur
#   ARM moins cher, micro = 2 vCPU / 1 Go de RAM. Ça suffit pour un site de
#   test ; la RAM dicte le nombre max de connexions simultanées (voir
#   dépannage "too many connections").
# --master-username postgres : l'administrateur (l'AMI PostgreSQL officielle
#   appelle l'admin "postgres").
# --allocated-storage 20 --storage-type gp3 : 20 Go de disque, extensible.
# --vpc-security-group-ids sg-RDS : le pare-feu de l'étape 3.
# --no-publicly-accessible : LA base n'a AUCUNE adresse publique. Elle n'est
#   joignable que depuis l'intérieur du VPC. C'est le dernier verrou contre
#   l'exposition accidentelle.
# --backup-retention-period 7 : sauvegardes automatiques quotidiennes
#   conservées 7 jours, avec possibilité de se rétablir à n'importe quelle
#   seconde de ces 7 jours (PITR). Ces sauvegardes occupent du stockage payant,
aws rds create-db-instance \
  --db-instance-identifier {{NOM_PROJET}}-db \
  --engine postgres \
  --engine-version "$VERSION_PG" \
  --db-instance-class db.t4g.micro \
  --master-username postgres \
  --master-user-password "$MOT_DE_PASSE_DB" \
  --allocated-storage 20 \
  --storage-type gp3 \
  --db-subnet-group-name {{NOM_PROJET}}-sous-reseaux \
  --vpc-security-group-ids sg-RDS \
  --backup-retention-period 7 \
  --no-publicly-accessible \
  --tags "Key=Projet,Value={{NOM_PROJET}}" "Key=Email,Value={{EMAIL_ADMIN}}" \
  --query "DBInstance.DBInstanceIdentifier" \
  --output text
```

Sortie attendue : `{{NOM_PROJET}}-db`.

Attends (5 à 10 minutes — AWS provisionne le disque et démarre PostgreSQL) :

```bash
aws rds wait db-instance-available --db-instance-identifier {{NOM_PROJET}}-db
# Sans sortie = OK. Si timeout au bout de ~10 min : aws rds describe-db-instances ...
```

### Étape 7 — Récupérer l'adresse (l'endpoint)

```bash
aws rds describe-db-instances --db-instance-identifier {{NOM_PROJET}}-db \
  --query "DBInstances[0].Endpoint.{Adresse:Address,Port:Port,Etat:DBInstanceStatus}" \
  --output table
```

Sortie attendue (exemple) :

```
|       Adresse                                | Port | Etat    |
|  medisecours-db.ab12cd34ef56.{{REGION}}.rds.amazonaws.com | 5432 | available |
```

**Cet `Adresse` est ta valeur de host de base.** Note-le : c'est lui qui va
dans `DATABASE_URL`.

### Étape 8 — Tester la connexion depuis l'instance EC2

Le test **doit** se faire depuis EC2 : la base n'est pas joignable d'ailleurs.

```bash
ssh -i {{NOM_PROJET}}-cle.pem ubuntu@{{IP_SERVEUR}}
```

Puis, dans la machine :

```bash
# Client PostgreSQL léger. Une seule fois.
sudo apt-get update -qq && sudo apt-get install -y -qq postgresql-client

# sslmode=require : on chiffre le transport (TLS). RDS accepte et encourage
# le chiffrement ; sans lui, la connexion peut être refusée selon le moteur.
# dbname=postgres = la base "par défaut" créée avec l'instance (tout de suite
# on créera la vraie base du projet).
psql "host={{NOM_PROJET}}-db.ab12cd34ef56.{{REGION}}.rds.amazonaws.com \
port=5432 dbname=postgres user=postgres sslmode=require \
password=MOT_DE_PASSE_DB" -c "select version();"
```

Sortie attendue : un tableau contenant `PostgreSQL 16.x ...`.

Crée la base du projet :

```bash
psql "host={{NOM_PROJET}}-db.ab12cd34ef56.{{REGION}}.rds.amazonaws.com port=5432 dbname=postgres user=postgres sslmode=require password=MOT_DE_PASSE_DB" -c "CREATE DATABASE medisecours;"
# → CREATE DATABASE
```

(Alternative : `database/schema.sql` + `database/seed.sql` du projet, voir
`DEPLOYMENT.md` à la racine du dépôt — chemin « standalone SQL ».)

### Étape 9 — Brancher l'application : `DATABASE_URL`

Dans le `.env` de l'application (backend), remplace l'ancien hôte local par
l'endpoint RDS :

```env
# Hôte = l'endpoint de l'étape 7, port 5432, base = celle créée à l'étape 8.
# sslmode=require est OBLIGATOIRE ici : la base est chiffrée en transit et
# l'application doit négocier TLS, sinon PostgreSQL répond
# "connection ... SSL off" et l'app échoue au démarrage.
DATABASE_URL=postgresql://postgres:MOT_DE_PASSE_DB@{{NOM_PROJET}}-db.ab12cd34ef56.{{REGION}}.rds.amazonaws.com:5432/medisecours?sslmode=require
```

Puis redémarre l'application (dans `../fullstack/vps/`,
`docker compose restart backend`). Ne mets **jamais** ce mot de passe dans un
dépôt Git (règle 3 de `README.md`).

### Étape 10 — Sauvegardes et restauration

**Automatique** : avec `--backup-retention-period 7` (étape 6), RDS prend une
sauvegarde chaque jour dans une fenêtre que tu choisis et conserve l'historique
de 7 jours. Cette fenêtre est visible via
`aws rds describe-db-instances --db-instance-identifier {{NOM_PROJET}}-db`.

**Manuelle** (à faire avant une migration risquée) :

```bash
aws rds create-db-snapshot \
  --db-instance-identifier {{NOM_PROJET}}-db \
  --db-snapshot-identifier {{NOM_PROJET}}-avant-maj \
  --query "DBSnapshot.SnapshotId" --output text
# → snap-0abc... (quelques minutes)

# Contrôle :
aws rds describe-db-snapshots --db-snapshot-identifier {{NOM_PROJET}}-avant-maj \
  --query "DBSnapshots[0].{Statut:Status,Taille:AllocatedStorage}" --output table
```

**Restauration** : on restaure **toujours vers une NOUVELLE instance** —
AWS ne remplace jamais une base en place (trop dangereux).

```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier {{NOM_PROJET}}-db-restore \
  --db-snapshot-identifier {{NOM_PROJET}}-avant-maj \
  --db-subnet-group-name {{NOM_PROJET}}-sous-reseaux \
  --vpc-security-group-ids sg-RDS \
  --no-publicly-accessible \
  --query "DBInstance.DBInstanceIdentifier" --output text
aws rds wait db-instance-available --db-instance-identifier {{NOM_PROJET}}-db-restore
```

La base restaurée a **un nouvel endpoint** : il faut donc changer
`DATABASE_URL` si tu veux l'utiliser. Une fois le contrôle fait, supprime la
base de restauration (`aws rds delete-db-instance --db-instance-identifier {{NOM_PROJET}}-db-restore --skip-final-snapshot`)
pour ne pas la payer toute seule.

---

## Vérification

```bash
# 1. État de la base
aws rds describe-db-instances --db-instance-identifier {{NOM_PROJET}}-db \
  --query "DBInstances[0].{Etat:DBInstanceStatus,Classe:DBInstanceClass,Public:PubliclyAccessible}" --output table
# → available / db.t4g.micro / false

# 2. Pare-feu : une seule règle, source = le pare-feu EC2
aws ec2 describe-security-groups --group-ids sg-RDS \
  --query "SecurityGroups[0].IpPermissions[].{Port:FromPort,Source:UserIdGroupPairs[0].GroupId}" --output table
# → Port 5432, Source = sg-0ec2XXXX (et JAMAIS 0.0.0.0/0)

# 3. Depuis l'instance EC2 : la base répond
ssh -i {{NOM_PROJET}}-cle.pem ubuntu@{{IP_SERVEUR}} \
  "psql 'host=... user=postgres dbname=postgres sslmode=require password=MOT_DE_PASSE_DB' -c 'select 1;'"

# 4. L'application démarre et son healthcheck passe
curl -s https://api.{{DOMAINE}}/api/health
# → {"status":"ok"} (une fois ../fullstack/vps/ déployé)
```

---

## Dépannage (3 pannes probables)

**1. `Connection refused` / `could not connect to server` / timeout**

*Cause* : le paquet est bloqué — c'est presque toujours le Security Group,
parfois le mauvais VPC.

```bash
# a) La règle de sg-RDS pointe bien vers le pare-feu de l'instance EC2 ?
aws ec2 describe-security-groups --group-ids sg-RDS \
  --query "SecurityGroups[0].IpPermissions" --output table
# → UserIdGroupPairs[0].GroupId doit valoir sg-EC2. Sinon refais l'étape 3.

# b) Le test est-il fait DEPUIS l'instance EC2 ? La base n'a pas d'IP
#    publique (--no-publicly-accessible) : depuis ton PC, ça échoue
#    TOUJOURS. Teste via SSH.

# c) Même région et même VPC pour EC2 et RDS :
aws rds describe-db-instances --db-instance-identifier {{NOM_PROJET}}-db \
  --query "DBInstances[0].{Vpc:DBSubnetGroup.VpcId,Host:Endpoint.Address}" --output table
aws ec2 describe-instances --instance-ids i-XXXX \
  --query "Reservations[0].Instances[0].VpcId" --output table
# → les deux VpcId doivent être identiques.

# d) L'endpoint est-il copié sans faute ? (les typos d'hôte donnent un
#    timeout, pas une erreur de mot de passe)
```

**2. `FATAL: too many connections for role "postgres"`**

*Cause* : le nombre maximal de connexions est plafonné **par la RAM de
l'instance** — sur `db.t4g.micro` (1 Go), il est bas (de l'ordre d'une
centaine au maximum, souvent moins après le départ de PostgreSQL lui-même).
Chaque conteneur qui garde son pool ouvert finit par manger une connexion.

```bash
# Combien de connexions la base autorise-t-elle réellement ?
psql "host=... dbname=postgres user=postgres sslmode=require password=..." \
  -c "show max_connections;" -c "select count(*) from pg_stat_activity;"
```

Corrections, dans l'ordre de simplicité :

```bash
# a) Réduire le pool de l'application (le VRAI fixe). Chaque conteneur
#    backend garde N connexions ouvertes en permanence : si 3 conteneurs
#    x 20 connexions, la micro-instance est noyée. Ouvre la configuration
#    du pool côté app (Doctrine/PDO : "max connections", souvent réglé dans
#    DATABASE_URL ou dans config/packages/doctrine.yaml) et mets 5 à 10.
#    Une seule base de test = un seul conteneur backend = une seule fois le
#    pool.

# b) Arrêter les anciens conteneurs qui tournent encore (après un test) :
docker ps          # puis docker stop <id> pour les doublons

# c) Si le projet grandit et que la RAM devient le plafond : passer la
#    classe de base en taille supérieure (aws rds modify-db-instance
#    --db-instance-identifier {{NOM_PROJET}}-db --db-instance-class db.t4g.small
#    --apply-immediately — redémarrage d'une poignée de minutes). C'est
#    payant en plus : ne le fais qu'après avoir réglé le pool.
```

**3. `FATAL: no pg_hba.conf entry ... SSL off` ou `server does not support SSL`**

*Cause* : l'URL d'application négocie mal TLS. RDS chiffre le transport et
exige souvent `sslmode=require` ; une URL sans `sslmode`, ou avec
`sslmode=disable`, est rejetée.

```bash
# Vérifie l'URL : elle doit FINIR par ?sslmode=require
grep DATABASE_URL .env
# → ...rds.amazonaws.com:5432/medisecours?sslmode=require

# Si tu viens d'une base locale en docker-compose, l'ancienne URL finissait
# par sslmode=disable et un hôte de type "medisecours-db" : les DEUX bouts
# doivent être changés (hôte ET sslmode).
```

Si le message insiste malgré `sslmode=require`, vérifie que l'hôte n'est pas
celui d'une *ancienne* base (endpoint résiduel) : l'endpoint exact vient
toujours de l'étape 7.

---

## Coût

| Ressource | Facturation | Ordre de grandeur / mois |
|---|---|---|
| `db.t4g.micro` (2 vCPU / 1 Go) | **24 h/24**, à l'heure, même sans connexion | ~10–20 $ |
| Stockage gp3 20 Go | Au Go, même instance stoppée | ~2–5 $ |
| Sauvegardes automatiques (7 j) | Stockage produit (donc une fraction du stockage) | quelques dollars |
| Transfert sortant (les réponses de la base vers l'app) | Très faible en interne (même VPC ≈ 0) | ~0 $ |

**Scénario « stopper la nuit » (développement uniquement) :**

```bash
# Stopper : l'instance ne se facture PLUS (le stockage, si). Redémarrage
# : 2 à 10 minutes — inacceptable en production, largement tolérable la nuit
# en dev.
aws rds stop-db-instance --db-instance-identifier {{NOM_PROJET}}-db
aws rds start-db-instance --db-instance-identifier {{NOM_PROJET}}-db
```

Pour de la production 24 h/24, on ne stoppe pas : on choisit juste la bonne
taille, et éventuellement un **Réserved Instance** ou un engagement à long
terme (remise importante contre engagement 1 ou 3 ans — à étudier seulement
quand la facture dépasse les ~50 $/mois de façon stable).

Vérifie la grille officielle : https://aws.amazon.com/pricing/
Documentation RDS : https://docs.aws.amazon.com/
Console : https://aws.amazon.com/console/
