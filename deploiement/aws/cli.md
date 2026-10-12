# AWS CLI v2 — Cheatsheet commentée + décodage des erreurs

---

## Objectif

Avoir sous la main **toutes les commandes AWS** utilisées dans cette section,
commentées ligne par ligne, triées par thème — et surtout **comprendre ce que
les erreurs 403/404/ExpiredToken veulent dire** quand quelque chose casse.

AWS CLI v2 est l'outil en terminal qui pilote AWS. La console (navigateur)
sert à comprendre et à surveiller ; le CLI sert à **répéter** une procédure à
l'identique (déploiements, scripts, nettoyages). Un débutant peut tout faire
en console au départ — ce fichier est là pour que tu puisses passer au CLI
sans peur.

---

## Table des valeurs à personnaliser

| Placeholder | Ce que c'est | Exemple |
|---|---|---|
| `{{ACCESS_KEY_ID}}` | Identifiant de clé d'accès de l'**utilisateur IAM** (commence par `AKIA`) | `AKIAIOSFODNN7EXAMPLE` |
| `{{SECRET_ACCESS_KEY}}` | Secret correspondant — affiché **une seule fois** à la création | *(secret)* |
| `{{NOM_PROJET}}` | Nom du projet (noms de ressources) | `medisecours` |
| `{{REGION}}` | Région par défaut | `eu-west-1` |
| `{{IP_SERVEUR}}` | IP publique de l'instance EC2 | `52.14.10.20` |
| `{{DOMAINE}}` | Ton domaine | `example.org` |
| `{{COMPTE_AWS}}` | Numéro de compte (12 chiffres) | `123456789012` |
| `{{ZONE_ID}}` | Identifiant de la zone DNS Route53 (début `Z…`) | `Z123456789ABCDEFGHI` |
| `{{EMAIL_ADMIN}}` | Email de contact IAM | `toi@exemple.org` |

---

## Prérequis

1. Un terminal (PowerShell, macOS/Linux) avec un accès Internet.
2. Un **compte AWS** et un **utilisateur IAM** (règle de sécurité n° 1 de
   `README.md` : le root ne sert qu'à créer cet utilisateur).
3. Rien d'autre : tout le reste s'installe ci-dessous.

---

## Étapes numérotées

### Étape 1 — Installer AWS CLI v2

```powershell
# Windows (PowerShell) : lance l'installateur MSI (Windows peut demander
# l'élévation de privilèges, clique sur "Oui") :
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi
# → puis fermer/rouvrir PowerShell et vérifier (ci-dessous)
```

```bash
# macOS / Linux : script officiel (installe dans /usr/local).
# Il te demandera sudo : c'est pour écrire dans /usr/local/bin.
curl -o "awscliv2.zip" "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip"
unzip -q awscliv2.zip && sudo ./aws/install

# Vérification dans les deux cas : la version doit commencer par 2.
aws --version
# → aws-cli/2.x.x Python/3.x ... exe/...
```

Documentation officielle (installation, options, références de commandes) :
https://docs.aws.amazon.com/

### Étape 2 — `aws configure` : à quoi servent les clés

**Ce que font les clés** : `{{ACCESS_KEY_ID}}` = ton **identité** (QUI tu
es dans AWS), `{{SECRET_ACCESS_KEY}}` = la preuve que cette identité t'appartient
(une signature calculée à chaque requête, jamais envoyée en clair). Ensemble,
elles remplacent le couple login/mot de passe de la console — mais elles
appartiennent à un **utilisateur IAM**, jamais au compte root.

**Où les créer** (une seule fois) : console → **IAM → Utilisateurs →
Créer un utilisateur** → cocher *Provide user access to the AWS CLI* →
clés d'accès → *Créer une clé d'accès* → copier le secret **immédiatement**.
Attache les politiques nécessaires (`README.md`, tableau des services).

**Pourquoi jamais le root** : une clé root compromise = contrôle total du
compte (suppression, facturation frauduleuse, changement de root email) et
aucune piste d'audit par utilisateur. La clé IAM, elle, se révoque en 10
secondes sans perdre le compte.

```bash
# Mode interactif (recommandé) : AWS te demande les 4 valeurs.
aws configure
# AWS Access Key ID   : {{ACCESS_KEY_ID}}
# AWS Secret Access Key : {{SECRET_ACCESS_KEY}}      (ne s'affiche pas à l'écran)
# Default region name : {{REGION}}
# Default output format : json

# Écriture de fichier — voici EXACTEMENT ce que la commande produit, dans
# ~/.aws/credentials (Linux/macOS) ou %UserProfile%\.aws\credentials (Windows) :
#   [default]
#   aws_access_key_id = {{ACCESS_KEY_ID}}
#   aws_secret_access_key = {{SECRET_ACCESS_KEY}}
# Et dans ~/.aws/config :
#   [default]
#   region = eu-west-1
#   output = json
# Tu peux ouvrir ces fichiers pour vérifier : ne les copie JAMAIS dans Git.
```

```bash
# Version non interactive (utile dans un script CI) :
aws configure set default.region {{REGION}}
aws configure set default.output json
```

**Révocation** (clé perdue/fuite/perso) : console → IAM → Utilisateurs → ta
clé d'accès → *Inactif* (puis *Supprimer* quand tu es sûr). Le compte continue
de tourner, seules les commandes CLI échouent : c'est exactement l'effet
voulu. **Si tu as poussé une clé dans Git, révoque d'abord, nettoie ensuite.**

### Étape 3 — Profils : plusieurs identités sur la même machine

```bash
# Un "profil" = un jeu de clés/région nommé. Utile pour séparer un compte de
# test et un compte de prod, ou ton identité perso et celle du travail.
aws configure --profile test
# → même saisie qu'à l'étape 2, mais stockée sous [profile test]

# Utiliser un profil pour UNE commande :
aws sts get-caller-identity --profile test

# Utiliser un profil pour tout un shell (pratique dans un terminal dédié) :
export AWS_PROFILE=test          # Windows PowerShell : $env:AWS_PROFILE="test"

# Lister les profils :
aws configure list-profiles
```

Sortie attendue de `aws sts get-caller-identity --profile test` : le compte
et l'Arn de ce profil.

### Étape 4 — Régions : où les commandes vont chercher

```bash
# La région est dans la commande (priorité), sinon dans le profil, sinon
# erreur. Une ressource créée en eu-west-1 est INVISIBLE en us-east-1.
aws configure get region                # → eu-west-1
aws configure set default.region {{REGION}}

# Bypasser la région par commande :
aws ec2 describe-instances --region {{REGION}}

# Lister les régions disponibles pour ton compte :
aws ec2 describe-regions --all-regions --query "Regions[].RegionName" --output text
```

### Étape 5 — EC2 (instances, clés, pare-feu)

```bash
# -- Lancer une instance (détail complet et commenté dans ec2.md étape 5) --
aws ec2 run-instances \
  --image-id ami-0xxxxxxxxxxxxx \
  --instance-type t3.small \
  --key-name {{NOM_PROJET}}-cle \
  --security-group-ids sg-XXXX \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value={{NOM_PROJET}}-serveur}]' \
  --query "Instances[0].InstanceId" --output text

# -- Lister les instances en marche, avec leur IP --
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" \
  --query "Reservations[].Instances[].{Id:InstanceId,Type:InstanceType,IP:PublicIpAddress}" \
  --output table

# -- Démarrer / arrêter / supprimer --
# stop = éteint la machine (plus de calcul facturé, le DISQUE reste payant)
# terminate = supprime instance + disque (règle si DeleteOnTermination)
aws ec2 start-instances   --instance-ids i-XXXX
aws ec2 stop-instances    --instance-ids i-XXXX
aws ec2 terminate-instances --instance-ids i-XXXX

# -- Paires de clés --
aws ec2 create-key-pair --key-name {{NOM_PROJET}}-cle2 --key-format pem \
  --query "KeyMaterial" --output text > {{NOM_PROJET}}-cle2.pem
aws ec2 describe-key-pairs --query "KeyPairs[].KeyName" --output text
aws ec2 delete-key-pair --key-name {{NOM_PROJET}}-cle2   # ne supprime PAS le fichier local

# -- Security Groups : créer puis ouvrir des ports --
# --authorize-ingress = ajouter une règle d'entrée. Un CIDR = une plage d'IP.
#   /32 = une seule IP, 0.0.0.0/0 = la planète entière (réservé aux ports 80/443).
SG=$(aws ec2 create-security-group --group-name {{NOM_PROJET}}-sg2 \
  --description "pare-feu {{NOM_PROJET}}" --query "GroupId" --output text)
aws ec2 authorize-security-group-ingress --group-id "$SG" --protocol tcp --port 22 \
  --cidr "$(curl -s https://checkip.amazonaws.com)/32"
aws ec2 authorize-security-group-ingress --group-id "$SG" --protocol tcp --port 443 --cidr 0.0.0.0/0
# Retirer une règle (si tu as ouvert trop large) :
aws ec2 revoke-security-group-ingress --group-id "$SG" --protocol tcp --port 22 --cidr 0.0.0.0/0
```

### Étape 6 — EBS (les disques)

```bash
# Créer un volume de 50 Go dans la même zone que l'instance (une zone = un
# bâtiment : un volume ne se rattache QUE dans SA zone).
aws ec2 create-volume --size 50 --volume-type gp3 --availability-zone eu-west-1a \
  --query "VolumeId" --output text          # → vol-XXXX

# Le rattacher à une instance (l'instance doit être dans eu-west-1a) :
aws ec2 attach-volume --volume-id vol-XXXX --instance-id i-XXXX \
  --query "Device" --output text            # → /dev/sdf

# Changer la taille (agrandissement seul) puis growpart/resize2fs : ec2.md étape 7
aws ec2 modify-volume --volume-id vol-XXXX --size 100

# Lister ce que tu as (et repérer les volumes orphelins qui se facturent) :
aws ec2 describe-volumes --filters "Name=status,Values=available" \
  --query "Volumes[].{Id:VolumeId,Taille:Size}" --output table
# → "available" = détaché mais toujours facturé ! Détache/supprime si inutile.
```

### Étape 7 — ECR (pousser une image Docker)

```bash
# 1) S'authentifier (jeton de 12 heures) :
aws ecr get-login-password --region {{REGION}} \
  | docker login --username AWS --password-stdin {{COMPTE_AWS}}.dkr.ecr.{{REGION}}.amazonaws.com
# → Login Succeeded

# 2) Créer le dépôt (s'il n'existe pas) :
aws ecr create-repository --repository-name {{NOM_PROJET}}-api \
  --query "repository.repositoryUri" --output text
# → {{COMPTE_AWS}}.dkr.ecr.{{REGION}}.amazonaws.com/{{NOM_PROJET}}-api

# 3) Builder puis taguer (le tag DOIT commencer par l'URI du dépôt) :
docker build -t {{NOM_PROJET}}-api:latest ./medisecours-backend
docker tag {{NOM_PROJET}}-api:latest \
  {{COMPTE_AWS}}.dkr.ecr.{{REGION}}.amazonaws.com/{{NOM_PROJET}}-api:latest

# 4) Pousser :
docker push {{COMPTE_AWS}}.dkr.ecr.{{REGION}}.amazonaws.com/{{NOM_PROJET}}-api:latest
# → latest: digest: sha256:...

# 5) Vérifier :
aws ecr describe-images --repository-name {{NOM_PROJET}}-api \
  --query "imageDetails[].imageTags" --output table
```

### Étape 8 — ECS (services, déploiements)

```bash
# Lister clusters, services et tâches :
aws ecs list-clusters --query "clusterArns" --output text
aws ecs list-services --cluster {{NOM_PROJET}} --query "serviceArns" --output text
aws ecs list-tasks  --cluster {{NOM_PROJET}} --desired-status RUNNING --query "taskArns" --output text

# Ce que le service raconte (déploiement, événements, erreurs) :
aws ecs describe-services --cluster {{NOM_PROJET}} --services {{NOM_PROJET}}-api \
  --query "services[0].{Running:runningCount,Desire:desiredCount,Evenements:events[0:3].message}" \
  --output table

# Déployer une nouvelle image (sans toucher à la task definition) :
aws ecs update-service --cluster {{NOM_PROJET}} --service {{NOM_PROJET}}-api \
  --force-new-deployment
aws ecs wait services-stable --cluster {{NOM_PROJET}} --services {{NOM_PROJET}}-api

# Détailler une tâche (utile quand elle crash — voir ecs-fargate.md) :
aws ecs describe-tasks --cluster {{NOM_PROJET}} --tasks <ARN_TASK> \
  --query "tasks[0].stoppedReason"
```

### Étape 9 — RDS (bases de données)

```bash
# Créer (détail complet commenté dans rds.md étape 6) :
# --engine-version : mets la version mineure 16.x que AWS propose encore,
#   repérable avec "aws rds describe-db-engine-versions --engine postgres"
#   (cf. rds.md étape 4) — "16.99" par exemple serait refusé.
aws rds create-db-instance \
  --db-instance-identifier {{NOM_PROJET}}-db \
  --engine postgres --engine-version 16.4 \
  --db-instance-class db.t4g.micro \
  --master-username postgres --master-user-password 'MOT_DE_PASSE_FORT' \
  --allocated-storage 20 --storage-type gp3 \
  --no-publicly-accessible \
  --query "DBInstance.DBInstanceIdentifier" --output text

# État + endpoint (l'adresse à mettre dans DATABASE_URL) :
aws rds describe-db-instances --db-instance-identifier {{NOM_PROJET}}-db \
  --query "DBInstances[0].{Etat:DBInstanceStatus,Host:Endpoint.Address,Port:Endpoint.Port}" \
  --output table

# Lister toutes les bases (repérer celles qui tournent pour rien) :
aws rds describe-db-instances --query "DBInstances[].{Id:DBInstanceIdentifier,Classe:DBInstanceClass,Etat:DBInstanceStatus}" --output table

# Sauvegarde manuelle puis restauration vers une NOUVELLE base :
aws rds create-db-snapshot --db-instance-identifier {{NOM_PROJET}}-db \
  --db-snapshot-identifier avant-maj --query "DBSnapshot.SnapshotId" --output text
aws rds restore-db-instance-from-db-snapshot --db-instance-identifier {{NOM_PROJET}}-db-restaure \
  --db-snapshot-identifier avant-maj

# Arrêter/démarrer (dev uniquement ; la production reste allumée) :
aws rds stop-db-instance  --db-instance-identifier {{NOM_PROJET}}-db
aws rds start-db-instance --db-instance-identifier {{NOM_PROJET}}-db
```

### Étape 10 — S3 (buckets et fichiers)

```bash
# Créer un bucket (nom UNIQUE dans tout AWS, minuscules) :
aws s3 mb s3://{{NOM_PROJET}}-fichiers --region {{REGION}}
# "mb" = make bucket. Sortie : make_bucket: {{NOM_PROJET}}-fichiers

# Copier un fichier / un dossier entier :
aws s3 cp ./photo.png s3://{{NOM_PROJET}}-fichiers/photo.png
aws s3 sync ./out s3://{{NOM_PROJET}}-fichiers --delete
#   sync = "rendre S3 identique à mon dossier" (ajoute + met à jour).
#   --delete = supprime aussi sur S3 ce qui n'existe plus en local.
#   ⚠ sans --delete, les vieux fichiers dorment et se facturent ; avec, un
#   mauvais dossier local peut vider le site. Vérifie toujours le chemin.

# Lister / voir / supprimer :
aws s3 ls s3://{{NOM_PROJET}}-fichiers
aws s3 ls s3://{{NOM_PROJET}}-fichiers --recursive
aws s3 rm s3://{{NOM_PROJET}}-fichiers/photo.png
aws s3 rm s3://{{NOM_PROJET}}-fichiers --recursive   # vide TOUT le bucket : irréversible

# Endpoint "site web" (hébergement statique simple, NON recommandé pour nous :
# on utilise CloudFront, voir s3-cloudfront.md) :
aws s3api get-bucket-website --bucket {{NOM_PROJET}}-fichiers --output json
# → l'URL à noter ressemble à http://BUCKET.s3-website-{{REGION}}.amazonaws.com
#   (l'hôte exact est renvoyé par la commande, jamais à deviner).

# Vider proprement un bucket avant suppression :
aws s3 rm s3://{{NOM_PROJET}}-fichiers --recursive
aws s3 rb s3://{{NOM_PROJET}}-fichiers        # rb = remove bucket (doit être vide)
```

### Étape 11 — CloudFront (invalider le cache)

```bash
# Lister les distributions (l'ID commence par E) :
aws cloudfront list-distributions \
  --query "DistributionList.Items[].{Id:Id,Domain:DomainName,Statut:Status}" --output table

# Invalider après chaque déploiement (détails : s3-cloudfront.md étape 8) :
aws cloudfront create-invalidation --distribution-id E1ABCDEF2GHIJKL --paths "/*"
# → InvalidationId + Status: InProgress (puis Completed en quelques minutes)

# Suivre l'invalidation :
aws cloudfront get-invalidation --distribution-id E1ABCDEF2GHIJKL --id <InvalidationId> \
  --query "Invalidation.Status" --output text
```

### Étape 12 — CloudWatch (les journaux)

```bash
# Suivre en direct les logs d'une tâche ECS (c'est ICI que vit la vérité
# d'un crash, pas dans la console ECS) :
aws logs tail "/ecs/{{NOM_PROJET}}" --follow --since 30m

# Lister les groupes de logs (repérer ceux qui grossissent) :
aws logs describe-log-groups --query "logGroups[].{Nom:logGroupName,Mo:storedBytes}" --output table

# Alarmes (facture, CPU) :
aws cloudwatch describe-alarms --query "MetricAlarms[].{Nom:AlarmName,Etat:StateValue}" --output table
```

### Étape 13 — IAM (identités)

```bash
# Qui suis-je ? (la toute première commande de diagnostic, toujours)
aws sts get-caller-identity
aws iam get-user --query "User.{Nom:UserName,Creation:CreateDate}" --output table

# Créer une clé d'accès pour un utilisateur :
aws iam create-access-key --user-name mon-utilisateur \
  --query "AccessKey.{Id:AccessKeyId,Secret:SecretAccessKey}" --output table
# → le Secret ne s'affiche QU'ICI. Copie-le tout de suite.

# Révoquer (clé perdue ou exposée) :
aws iam update-access-key --user-name mon-utilisateur --access-key-id AKIA... --status Inactive
aws iam delete-access-key --user-name mon-utilisateur --access-key-id AKIA...

# Politiques : voir ce qu'un utilisateur peut faire, et attacher un droit.
aws iam list-attached-user-policies --user-name mon-utilisateur \
  --query "AttachedPolicies[].PolicyName" --output text
aws iam list-policies --scope Local --query "Policies[].PolicyName" --output text
aws iam attach-user-policy --user-name mon-utilisateur \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
# ⚠ préfère des politiques ciblées : donner "FullAccess" partout, c'est
#   exactement ce que la règle n° 1 de README.md cherche à éviter.
```

### Étape 14 — Route53 (pointer {{DOMAINE}})

```bash
# La zone = le conteneur de tes enregistrements DNS pour {{DOMAINE}}.
aws route53 list-hosted-zones-by-name --dns-name {{DOMAINE}} \
  --query "HostedZones[].{Nom:Name,Id:Id}" --output table
# → Id du type /hostedzone/Z1234... : garde Z1234... (ta {{ZONE_ID}})
```

Fichier `records.json` — **JSON commenté**, supprime les `//` avant usage :

```jsonc
{
  "Comment": "Pointer {{DOMAINE}} sur le frontend CloudFront",
  "Changes": [
    {
      "Action": "UPSERT",   // UPSERT = créer si absent, remplacer si présent
      "ResourceRecordSet": {
        "Name": "{{DOMAINE}}",
        // Type A avec Alias = AWS remplace l'adresse IP par l'adresse
        // ACTUELLE de la cible : si CloudFront change son DNS, ton
        // enregistrement suit tout seul. Un A classique avec une IP
        // statique, c'est le problème que l'IP Élastique règle côté EC2.
        "Type": "A",
        "AliasTarget": {
          // ARN d'une distribution CloudFront (le host y est d'une forme
          // particulière) — trouve-le avec la commande plus bas.
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d111111abcdef8.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
```

```bash
aws route53 change-resource-record-sets --hosted-zone-id {{ZONE_ID}} \
  --change-batch file://records.json
# → Status: PENDING puis changeId → "INSYNC" en quelques minutes.
```

**Variante vers un ALB** (voie B, `ecs-fargate.md`) : même fichier, mais
`Type: "A"` reste et l'AliasTarget change. Récupère les deux identifiants
spécifiques à l'ALB :

```bash
# HostedZoneId d'un ALB = celui de la RÉGION (constante par région), et le
# DNSName = celui de l'ALB (étape 8 de ecs-fargate.md).
ALB_DNS=$(aws elbv2 describe-load-balancers --names {{NOM_PROJET}}-alb \
  --query "LoadBalancers[0].DNSName" --output text)
echo "$ALB_DNS"    # → medisecours-alb-....elb.amazonaws.com : mets-le dans DNSName
```

Pour un sous-domaine (`api.{{DOMAINE}}`), mets `"Name": "api.{{DOMAINE}}"`
dans le JSON — Route53 crée l'enregistrement à la bonne racine.

---

## Vérification

```bash
# 1. Version et identité
aws --version                     # → aws-cli/2.x
aws sts get-caller-identity       # → Account + Arn ...:user/... (jamais :root)

# 2. La région par défaut est la bonne
aws configure get region          # → {{REGION}}

# 3. Une commande de lecture par service (toutes doivent répondre)
aws ec2 describe-instances --query "length(Reservations[])" --output text
aws s3 ls                          # → liste de tes buckets (ou rien, sans erreur)
aws ecs list-clusters --query "clusterArns" --output text
aws rds describe-db-instances --query "length(DBInstances)" --output text
# → des nombres/des listes, jamais une pile d'erreurs rouge.

# 4. Les fichiers de configuration sont bien là ET bien protégés
ls -l ~/.aws/credentials           # doit être -rw------- (chmod 600)
# Windows PowerShell : icacls $env:USERPROFILE\.aws\credentials
#   → doit citer uniquement TON utilisateur, SYSTEM et Administrateurs.
```

---

## Dépannage (3 pannes probables)

**1. `Unable to locate credentials. You can configure credentials by running "aws configure".`**

*Cause* : aucun profil par défaut, ou `AWS_PROFILE` pointe vers un profil
qui n'existe pas. *Correctif* : `aws configure` (étape 2), ou
`aws configure --profile <nom>` puis `export AWS_PROFILE=<nom>`.

**2. `AccessDenied` / `UnauthorizedOperation` sur presque toutes les commandes**

*Cause* : tes clés sont valides, mais l'utilisateur IAM n'a pas le droit
demandé (politique manquante). *Correctif* : `aws sts get-caller-identity`
pour confirmer qui tu es, puis IAM → Utilisateurs → ta politique → ajouter
le service concerné (étape 13).

**3. `ExpiredToken` / `InvalidClientTokenId`**

*Cause* : jeton expiré (session SSO ou jeton ECR de 12 h) ou clé d'accès
supprimée/désactivée. *Correctif* : `aws sso login` ou refais
`aws ecr get-login-password` pour un jeton ; pour une clé, vérifie son statut
dans IAM et refais `aws configure` avec la bonne paire.

**Dictionnaire complet — chaque erreur, sa cause, son correctif :**

| Message d'erreur | Cause réelle | Correctif |
|---|---|---|
| `Unable to locate credentials. You can configure credentials by running "aws configure".` | Aucun profil par défaut, ou variable `AWS_PROFILE` pointant vers un profil inexistant | `aws configure` (étape 2), ou `aws configure --profile <nom>` puis `export AWS_PROFILE=<nom>` |
| `AccessDenied` / `AccessDeniedException` / `... not authorized to perform: s3:PutObject` | **403** : tes clés sont valides mais l'utilisateur IAM n'a PAS ce droit (politique manquante ou trop étroite) | Console → IAM → Utilisateurs → ta politique → ajouter le service concerné (S3, EC2…). Vérifie aussi la région : certaines politiques sont liées à une région |
| `An error occurred (UnauthorizedOperation) when calling the RunInstances operation: You are not authorized to perform this operation.` | Idem, spécifiquement sur EC2 : l'utilisateur ne peut pas créer d'instances | `aws iam list-attached-user-policies --user-name <toi>` → attacher une politique EC2 adaptée (étape 13) |
| `403 Forbidden` (réponse XML/JSON **dans S3 ou CloudFront**, pas dans le CLI) | Le bucket est verrouillé et la politique de bucket refuse l'accès (SourceArn de mauvaise distribution, ou accès public bloqué) | `s3-cloudfront.md` dépannage n° 1 : politique de bucket + OAC |
| `NoSuchBucket` / `The specified bucket does not exist` / **404** | Le bucket n'existe pas **dans cette région** (les buckets sont globaux, mais leur API est régionale), ou faute de frappe | `aws s3 ls` pour voir le nom exact ; `aws s3api head-bucket --bucket <nom> --region {{REGION}}` |
| `ExpiredToken` / `The security token included in the request is expired` | Ton jeton (souvent une session SSO/console ou un jeton ECR de 12 h) a expiré | Reconnecte-toi : `aws sso login --profile <nom>` (SSO) ou refais `aws ecr get-login-password` (ECR). Pour une clé IAM statique, vérifie aussi l'horloge de ta machine (un décalage d'heure casse la signature) |
| `InvalidClientTokenId` | **La clé d'accès n'existe pas** : mauvaise saisie, clé **supprimée** ou **désactivée** dans IAM, ou clé créée dans un **autre compte** | Console → IAM → Clés d'accès : vérifie l'ID et son statut *Actif*. Si tu l'as supprimée, crée-en une nouvelle et refais `aws configure`. Ne t'attends pas à ce que l'ancienne revienne |
| `InvalidSignatureException` / `SignatureDoesNotMatch` | Secret mal copié (caractères tronqués, espace final) ou horloge décalée | Recolle `{{SECRET_ACCESS_KEY}}` entier via `aws configure` ; corrige l'heure du PC (NTP) |
| `The security token included in the request is invalid` | Mélange de clés (ID d'un compte, secret d'un autre) ou clé root jamais créée | Regénère la paire depuis IAM pour le **même** utilisateur (étape 2) |
| `DryRunOperation` | **Ce n'est PAS une erreur** : `--dry-run` a vérifié les permissions avec succès | Retire `--dry-run` pour exécuter pour de vrai |
| `InvalidParameterValue: CIDR block ... is malformed` (Security Group) | Une IP seule sans masque (`1.2.3.4` au lieu de `1.2.3.4/32`) | Ajoute `/32` (une IP) ou `/0` (tout le monde) |
| `You do not have permission to describe regions` / `AuthFailure` | Clés d'un compte qui n'est pas le bon, ou utilisateur sans droits de base | `aws sts get-caller-identity` : compare le compte affiché avec celui attendu |

**Méthode générale de diagnostic**, dans cet ordre :

```bash
# 1) QUI suis-je et DANS quel compte ? (élimine 80 % des cas)
aws sts get-caller-identity
# 2) DANS quelle région travaille la commande ?
aws configure get region
# 3) EST-CE que la ressource existe vraiment ?
aws s3 ls ; aws ec2 describe-instances --filters "Name=instance-state-name,Values=running"
# 4) Que dit le journal des erreurs ? (les vrais détails applicatifs)
aws logs tail "/ecs/{{NOM_PROJET}}" --since 1h
```

---

## Coût

**L'AWS CLI est gratuit** : l'installation, `aws configure`, les commandes de
lecture (`describe-*`, `list-*`, `ls`) ne facturent rien. Seules les commandes
qui **créent ou modifient** des ressources commencent une facturation
(`run-instances`, `create-db-instance`, `create-load-balancer`…), et c'est la
ressource qui coûte, pas la commande.

Deux réflexes à garder :

- les commandes `describe-*` / `list-*` coûtent **0 $** — n'hésite pas à
  diagnostiquer ;
- les commandes destructives (`terminate-instances`, `rm --recursive`,
  `delete-*`) sont **gratuites elles aussi**, c'est justement pour ça
  qu'elles sont utiles : elles *arrêtent* une facturation.

Vérifie la grille officielle : https://aws.amazon.com/pricing/
Documentation CLI : https://docs.aws.amazon.com/
Console : https://aws.amazon.com/console/
