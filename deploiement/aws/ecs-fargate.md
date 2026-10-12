# ECS Fargate — L'API sans gestion de serveur (voie B)

---

## Objectif

Faire tourner l'API (conteneur Docker) **sans jamais administrer de machine**
via **ECS Fargate** : tu pousses l'image Docker dans **ECR**, tu décris la
tâche (vCPU, RAM, variables d'environnement), tu crées un **service** derrière
un **ALB**, et AWS allume/éteint/relance les instances à ta place.

**Ce que tu gagnes** : plus de `ssh`, plus de `apt upgrade`, plus de disque
plein, redémarrage automatique si le conteneur meurt, déploiement sans
interruption.
**Ce que tu perds** : le « un seul serveur, un seul endroit où regarder ».
Il y aura 6 à 8 ressources AWS à suivre (cluster, service, tâches, ALB,
target group, ECR, logs) et un coût fixe mensuel plus élevé.

**À ne pas confondre : Kubernetes (EKS).** EKS est l'orchestrateur
industriel standard, avec ses propres concepts (pods, deployments, helm…).
C'est un surcougement : ne le prends **jamais** « parce que c'est le standard »
— ECS Fargate fait le travail pour ce projet, avec moins de pièces mobiles et
moins de facture. On passe à EKS le jour où une raison métier l'exige
(équipes qui l'exploitent déjà, outillage spécifique), pas avant.

---

## Table des valeurs à personnaliser

| Placeholder | Ce que c'est | Exemple |
|---|---|---|
| `{{NOM_PROJET}}` | Préfixe de tous les noms (repo ECR, cluster, service, log group) | `medisecours` |
| `{{REGION}}` | Région de travail — tout doit être dans la même | `eu-west-1` |
| `{{COMPTE_AWS}}` | Ton numéro de compte (12 chiffres) — indispensable pour l'URL ECR | `123456789012` |
| `{{DOMAINE}}` | Domaine de l'API (ex. `api.example.org`) | `example.org` |
| `{{IP_SERVEUR}}` | IP de l'instance EC2 (si la base est sur EC2, ou pour les tests) | `52.14.10.20` |
| `{{EMAIL_ADMIN}}` | Contact des ressources | `toi@exemple.org` |
| `{{ACCESS_KEY_ID}}` / `{{SECRET_ACCESS_KEY}}` | Clés IAM de `aws configure` | — |

---

## Prérequis

1. AWS CLI v2 configuré (`cli.md`), droits **ECR, ECS, EC2 (VPC/SG), IAM,
   ELB, Logs, Secrets Manager**.
2. **Docker installé sur TA machine** (pour builder et pousser l'image) —
   c'est le seul besoin « local » de ce fichier.
3. Le **VPC par défaut** et deux sous-réseaux publics (récupérés dans
   `rds.md` étape 1) — l'ALB et les tâches vivent dedans.
4. Idéalement la base déjà créée (`rds.md`) : l'API va s'y connecter.
5. Aucune notion de Kubernetes requise.

> **Terminal** : les blocs `cat > fichier << 'JSON'` de l'étape 6 sont de la
> syntaxe **bash**. Sous PowerShell, crée plutôt ces deux fichiers avec ton
> éditeur (les contenus sont donnés plus bas) et passe directement aux
> commandes `aws iam ... file://...`.

Contrôle :

```bash
aws sts get-caller-identity --query Account --output text   # → 12 chiffres
docker version --format '{{.Server.Version}}'               # → ex. 27.3.1
```

---

## Étapes numérotées

### Étape 1 — Identifier ton compte (pour l'URL ECR)

```bash
# L'URL du registre ECR contient ton numéro de compte :
# 123456789012.dkr.ecr.eu-west-1.amazonaws.com
# Plutôt que de le chercher dans la console, on le demande directement.
# Le champ Arn te dit aussi QUI tu es : si ça finit par ":root", arrête et
# refais cli.md (jamais de root au quotidien).
aws sts get-caller-identity --query "{Compte:Account,Identite:Arn}" --output table
```

Sortie attendue : `Compte: 123456789012`, `Identite: ...:user/mon-utilisateur`.
Note la valeur dans `{{COMPTE_AWS}}`.

### Étape 2 — Créer le dépôt d'images ECR

```bash
# ECR = le stockage privé d'images Docker. Un "dépôt" = un nom d'image,
# comme un tag Git. Les images y sont facturées au Go (quelques centimes).
aws ecr create-repository \
  --repository-name {{NOM_PROJET}}-api \
  --image-tag-mutability MUTABLE \
  --query "repository.repositoryUri" \
  --output text
```

Sortie attendue :
`{{COMPTE_AWS}}.dkr.ecr.{{REGION}}.amazonaws.com/{{NOM_PROJET}}-api`
→ c'est l'**ECR_URI** dont tu as besoin partout ci-dessous.

```bash
ECR_URI="{{COMPTE_AWS}}.dkr.ecr.{{REGION}}.amazonaws.com/{{NOM_PROJET}}-api"
```

### Étape 3 — S'authentifier auprès d'ECR avec Docker

```bash
# AWS ne donne PAS de login/mot de passe classique : la commande te génère
# un jeton valable 12 heures (c'est une passerelle de sécurité, pas un
# mot de passe à retenir). Le "| " transmet ce jeton directement au client
# docker, sans l'afficher ni l'enregistrer nulle part. Si le push échoue
# avec "no basic auth credentials", le jeton a expiré : refais cette étape.
aws ecr get-login-password --region {{REGION}} \
  | docker login --username AWS --password-stdin {{COMPTE_AWS}}.dkr.ecr.{{REGION}}.amazonaws.com
```

Sortie attendue : `Login Succeeded`.

### Étape 4 — Builder, taguer et pousser l'image

```bash
# (a) Build : on construit l'image depuis le Dockerfile du backend.
#     --platform indique l'architecture CIBLE de la machine qui EXÉCUTERA la
#     tâche. Fargate propose x86_64 (standard) et arm64 (Graviton, moins
#     cher). On reste en x86_64 pour coller au plus grand nombre d'images
#     publiques ; si tu passes en arm64 plus tard, mets linux/arm64 ici.
docker build --platform linux/amd64 -t {{NOM_PROJET}}-api:latest ./medisecours-backend

# (b) Tagger : ECR exige que le nom de l'image commence par l'URI du dépôt.
#     "latest" = le tag de la version courante. En pratique, on pousse aussi
#     un tag de version (git short sha) pour pouvoir revenir en arrière.
docker tag {{NOM_PROJET}}-api:latest "$ECR_URI:latest"
docker tag {{NOM_PROJET}}-api:latest "$ECR_URI:v1"

# (c) Push : l'image part sur les serveurs AWS. La première fois est lente
#     (les couches partent en entier), la suite n'envoie que les couches
#     modifiées — c'est le gros avantage des images Docker.
docker push "$ECR_URI:latest"
docker push "$ECR_URI:v1"
```

Sortie attendue : des barres `latest: digest: sha256:... size: ...` puis
retour au prompt.

```bash
# Contrôle : l'image est bien dans le registre.
aws ecr describe-images --repository-name {{NOM_PROJET}}-api \
  --query "imageDetails[].{Tags:imageTags,Digest:imageDigest}" --output table
```

### Étape 5 — Stocker les secrets (Secrets Manager / SSM)

Une tâche a besoin de `DATABASE_URL`, `APP_SECRET`, `JWT_*`… **Jamais en
clair dans la task definition** : elle est visible par n'importe qui disposant
des droits ECS dans la console.

```bash
# Option A — Secrets Manager (coûte quelques centimes/mois, gère les
# rotations) : idéal pour DATABASE_URL (elle contient le mot de passe).
aws secretsmanager create-secret \
  --name {{NOM_PROJET}}/api/DATABASE_URL \
  --secret-string "postgresql://postgres:MOT_DE_PASSE_DB@{{NOM_PROJET}}-db.xxxx.{{REGION}}.rds.amazonaws.com:5432/medisecours?sslmode=require" \
  --query "ARN" --output text
# → arn:aws:secretsmanager:{{REGION}}:{{COMPTE_AWS}}:secret:...  (note l'ARN)

# Option B — SSM Parameter Store, type SecureString : GRATUIT, même usage.
# À privilégier si tu as beaucoup de paramètres et peu de rotations.
aws ssm put-parameter \
  --name "/{{NOM_PROJET}}/APP_SECRET" \
  --type SecureString \
  --value "$(openssl rand -hex 32)" \
  --query "Parameter.ARN" --output text
# → arn:aws:ssm:{{REGION}}:{{COMPTE_AWS}}:parameter/...
```

Conserve ces ARN : ce sont eux qui apparaissent dans `valueFrom` (étape 6).

### Étape 6 — Enregistrer la définition de tâche

Fichier `task-definition.json` — **JSON commenté** ; supprime les lignes
`//` avant l'enregistrement (le JSON strict ne les tolère pas).

```jsonc
{
  // "family" = le nom du modèle ; chaque enregistrement crée une :1, :2…
  "family": "{{NOM_PROJET}}-api",
  // FARGATE = pas de machine à gérer. awsvpc = chaque tâche reçoit sa PROPRE
  // adresse IP dans le sous-réseau (obligatoire avec Fargate) : c'est pour
  // ça que les sous-réseaux doivent avoir des IP disponibles.
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  // Mémoire allouée À LA TÂCHE entière (conteneurs compris).
  // 0,5 vCPU / 1 Go : correct pour une API Symfony modérément sollicitée.
  // À augmenter si tu vois "OOMKilled" dans les journaux (dépannage plus bas).
  "cpu": "512",
  "memory": "1024",
  // Role d'exécution : AWS l'utilise AVANT le démarrage de ton code —
  // tirer l'image depuis ECR, écrire les logs CloudWatch. Géré par ECS.
  "executionRoleArn": "arn:aws:iam::{{COMPTE_AWS}}:role/{{NOM_PROJET}}-execution-role",
  // Task role : les droits que TON CODE possède pendant qu'il tourne
  // (lire un secret, écrire dans S3). Personne d'autre ne les a.
  // C'est la distinction la plus importante d'ECS : pense "agent" vs "app".
  "taskRoleArn": "arn:aws:iam::{{COMPTE_AWS}}:role/{{NOM_PROJET}}-task-role",
  "containerDefinitions": [
    {
      "name": "api",
      // L'image poussée à l'étape 4. En production, préfère un tag de
      // version (v1, sha) plutôt que :latest pour pouvoir revenir en arrière.
      "image": "{{COMPTE_AWS}}.dkr.ecr.{{REGION}}.amazonaws.com/{{NOM_PROJET}}-api:latest",
      "essential": true,
      // Port EXPOSÉ par nginx dans le conteneur du backend (cf.
      // docker-compose.prod.yml du projet : le backend écoute sur 10000).
      // L'ALB enverra le trafic sur ce port.
      "portMappings": [{ "containerPort": 10000, "protocol": "tcp" }],
      // Variables NON secrètes : lisibles par quiconque a les droits ECS.
      "environment": [
        { "name": "APP_ENV", "value": "prod" },
        { "name": "APP_DEBUG", "value": "0" },
        { "name": "DEFAULT_URI", "value": "https://api.{{DOMAINE}}" },
        { "name": "CORS_ALLOW_ORIGIN", "value": "^https://{{DOMAINE}}$" }
      ],
      // Variables SECRÈTES : ECS va les récupérer AU DÉMARRAGE auprès de
      // Secrets Manager/SSM (via l'execution role) et les injecter dans le
      // conteneur. valueFrom = l'ARN complet (étape 5).
      "secrets": [
        { "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:{{REGION}}:{{COMPTE_AWS}}:secret:{{NOM_PROJET}}/api/DATABASE_URL-AbCdEf" },
        { "name": "APP_SECRET", "valueFrom": "arn:aws:ssm:{{REGION}}:{{COMPTE_AWS}}:parameter/{{NOM_PROJET}}/APP_SECRET" }
      ],
      // Journaux : tout ce que le conteneur écrit en stdout part dans ce
      // groupe de logs CloudWatch. Sans ça, un crash est INVESTIGABLE.
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/{{NOM_PROJET}}",
          "awslogs-region": "{{REGION}}",
          "awslogs-stream-prefix": "api"
        }
      }
    }
  ]
}
```

Crée le groupe de logs puis enregistre la tâche :

```bash
aws logs create-log-group --log-group-name "/ecs/{{NOM_PROJET}}" --region {{REGION}}
# → rien à l'écran quand c'est créé. Si le message "already exists" apparaît,
#   le groupe existait déjà : aucun problème, on continue.

aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --query "taskDefinition.taskDefinitionArn" --output text
# → arn:aws:ecs:{{REGION}}:{{COMPTE_AWS}}:task-definition/{{NOM_PROJET}}-api:1
```

**Les deux rôles IAM** (à créer une seule fois) :

> Les `<< 'JSON'` ci-dessous sont volontairement entre guillemets : le shell
> ne remplace alors RIEN. C'est voulu pour le premier fichier, mais pour le
> second (`task-role-policy.json`) **remplace à la main** `{{REGION}}`,
> `{{COMPTE_AWS}}` et `{{NOM_PROJET}}` dans le texte avant de lancer la
> commande, sinon AWS reçoit littéralement les accolades.

```bash
# (a) Politique de confiance : "AWS ECS a le droit d'assumer ce rôle quand
#     il lance une tâche". C'est la clé de voûte de tout rôle AWS.
cat > trust-ecs.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ecs-tasks.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON

# (b) Role d'exécution : politique AWS gérée, prête à l'emploi.
aws iam create-role \
  --role-name {{NOM_PROJET}}-execution-role \
  --assume-role-policy-document file://trust-ecs.json \
  --query "Role.Arn" --output text
aws iam attach-role-policy \
  --role-name {{NOM_PROJET}}-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# (c) Task role : on ne donne QUE le droit de lire nos propres secrets.
#     Jamais "AdministratorAccess" : si le contenu est compromis, le
#     périmètre de dégât reste contenu.
aws iam create-role \
  --role-name {{NOM_PROJET}}-task-role \
  --assume-role-policy-document file://trust-ecs.json \
  --query "Role.Arn" --output text
cat > task-role-policy.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue", "ssm:GetParameters"],
      "Resource": [
        "arn:aws:secretsmanager:{{REGION}}:{{COMPTE_AWS}}:secret:{{NOM_PROJET}}/*",
        "arn:aws:ssm:{{REGION}}:{{COMPTE_AWS}}:parameter/{{NOM_PROJET}}/*"
      ]
    }
  ]
}
JSON
aws iam put-role-policy \
  --role-name {{NOM_PROJET}}-task-role \
  --policy-name lecture-secrets-{{NOM_PROJET}} \
  --policy-document file://task-role-policy.json
```

### Étape 7 — Créer le cluster ECS

```bash
# Un "cluster" n'est rien d'autre qu'un conteneur logique qui regroupe
# services et tâches dans une région. Il ne coûte rien en soi.
aws ecs create-cluster \
  --cluster-name {{NOM_PROJET}} \
  --capacity-providers FARGATE \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
  --query "cluster.{Nom:clusterName,Statut:status}" --output table
```

Sortie attendue : `{{NOM_PROJET}}` / `ACTIVE`.

### Étape 8 — Créer l'ALB et son groupe de cibles

```bash
# Repère le VPC et deux sous-réseaux publics (rappel de rds.md étape 1).
VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query "Vpcs[0].VpcId" --output text)
aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" \
  --query "Subnets[].{Id:SubnetId,AZ:AvailabilityZone}" --output table
# → choisis subnet-A et subnet-B dans DEUX zones différentes :
#    un ALB exige au moins 2 zones, c'est aussi ce qui lui survit à une panne.

# Pare-feu de l'ALB : 80 et 443 ouverts au monde. C'est LA porte d'entrée ;
# il ne parle à personne d'autre.
SG_ALB=$(aws ec2 create-security-group \
  --group-name {{NOM_PROJET}}-alb-sg \
  --description "Entree publique de l'API {{NOM_PROJET}}" \
  --query "GroupId" --output text)
aws ec2 authorize-security-group-ingress --group-id "$SG_ALB" --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id "$SG_ALB" --protocol tcp --port 443 --cidr 0.0.0.0/0

# Pare-feu des TÂCHES : le port 10000 n'est ouvert QUE depuis l'ALB.
# Ni le monde entier, ni même ton IP : seulement le pare-feu précédent.
# C'est le principe de moindre privilège appliqué au réseau.
SG_TASK=$(aws ec2 create-security-group \
  --group-name {{NOM_PROJET}}-task-sg \
  --description "API {{NOM_PROJET}} : accessible uniquement depuis l'ALB" \
  --query "GroupId" --output text)
aws ec2 authorize-security-group-ingress --group-id "$SG_TASK" --protocol tcp --port 10000 --source-group "$SG_ALB"

# L'ALB lui-même.
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name {{NOM_PROJET}}-alb \
  --type application \
  --scheme internet-facing \
  --subnets subnet-A subnet-B \
  --security-groups "$SG_ALB" \
  --query "LoadBalancers[0].LoadBalancerArn" --output text)
echo "ALB : $ALB_ARN"

# Groupe de cibles : où l'ALB envoie-t-il les requêtes ? Type "ip" est
# obligatoire avec Fargate (chaque tâche a sa propre IP, il n'y a pas
# d'instance à découvrir).
TG_ARN=$(aws elbv2 create-target-group \
  --name {{NOM_PROJET}}-api \
  --protocol HTTP --port 10000 \
  --vpc-id "$VPC_ID" \
  --target-type ip \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --matcher "HttpCode=200" \
  --query "TargetGroups[0].TargetGroupArn" --output text)

# Écouteur : c'est lui qui transforme "une adresse publique" en "des tâches".
# Port 80 pour démarrer (HTTPS/443 avec ACM = exercice du même type que
# s3-cloudfront.md étape 6, en choisissant l'ALB comme cible).
aws elbv2 create-listener \
  --load-balancer-arn "$ALB_ARN" \
  --protocol HTTP --port 80 \
  --default-actions Type=forward,TargetGroupArn="$TG_ARN" \
  --query "Listener.ListenerArn" --output text
```

Attends que l'ALB soit actif (1 à 3 minutes) puis note son DNS :

```bash
aws elbv2 wait load-balancer-available --load-balancer-arns "$ALB_ARN"
ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" \
  --query "LoadBalancers[0].DNSName" --output text)
echo "Adresse publique : http://$ALB_DNS"
```

Sortie attendue : `medisecours-alb-1234567890.{{REGION}}.elb.amazonaws.com`
→ c'est l'enregistrement **A / Alias** que tu mettras dans Route53 pour
`api.{{DOMAINE}}` (commandes dans `cli.md`).

### Étape 9 — Créer le service (le déploiement rolling)

```bash
# --desired-count 1        : une tâche en permanence. À 2, tu tiens une
#                            vraie redondance (mais tu payes deux fois).
# --deployment-configuration maximumPercent=200,minimumHealthyPercent=100
#    = DÉPLOIEMENT ROLLING : au renouvellement, ECS démarre la NOUVELLE
#    tâche AVANT d'arrêter l'ancienne (200 % = deux tâches max pendant
#    quelques minutes), sans jamais descendre sous 100 % : zéro coupure.
#    Pendant ce bref instant, tu payes deux tâches.
# --health-check-grace-period-seconds 60 : laisse 60 s à l'API (migrations
#    au démarrage, cache Symfony) avant de la juger malade.
aws ecs create-service \
  --cluster {{NOM_PROJET}} \
  --service-name {{NOM_PROJET}}-api \
  --task-definition {{NOM_PROJET}}-api:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-A,subnet-B],securityGroups=[$SG_TASK],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=api,containerPort=10000" \
  --deployment-configuration "maximumPercent=200,minimumHealthyPercent=100" \
  --health-check-grace-period-seconds 60 \
  --query "service.{ARN:serviceArn,Statut:status}" --output table
```

Sortie attendue : l'ARN du service et `Statut: ACTIVE` (le déploiement
continue en arrière-plan).

```bash
# assignPublicIp=ENABLED : la tâche a une IP publique pour TÉLÉCHARGER
# l'image ECR et parler à la base… Attention : si tu utilises des sous-réseaux
# PRIVÉS, il faut une passerelle NAT, qui se facture PAR GO TRAITÉ
# (piège n° 3 de README.md). Ici on reste sur les sous-réseaux publics du
# VPC par défaut : aucun coût de NAT.
```

Attends la fin du déploiement :

```bash
aws ecs wait services-stable --cluster {{NOM_PROJET}} --services {{NOM_PROJET}}-api
# 3 à 10 minutes au premier lancement (pull de l'image + démarrage API).
# Sans sortie = le service est "stable" : desired == running == healthy.

aws ecs describe-services --cluster {{NOM_PROJET}} --services {{NOM_PROJET}}-api \
  --query "services[0].{Desire:desiredCount,Running:runningCount,Deploy:deployments[0].status}" --output table
# → Desire: 1, Running: 1, Deploy: PRIMARY
```

### Étape 10 — Raccourcir le chemin vers la base (RDS)

La base doit n'accepter que les tâches ECS, exactement comme `rds.md` l'a
fait pour EC2 :

```bash
# Le pare-feu RDS accepte maintenant le pare-feu des TÂCHES (et non plus
# celui de l'instance EC2) — ou les deux si les deux voies cohabitent.
aws ec2 authorize-security-group-ingress \
  --group-id sg-RDS \
  --protocol tcp --port 5432 \
  --source-group "$SG_TASK"
```

### Étape 11 — Déployer une mise à jour

```bash
# (a) Rebuild + push d'une NOUVELLE version (étape 4 avec un autre tag, ex. v2)
docker build --platform linux/amd64 -t {{NOM_PROJET}}-api:v2 ./medisecours-backend
docker tag {{NOM_PROJET}}-api:v2 "$ECR_URI:v2"
docker push "$ECR_URI:v2"

# (b) Indique la nouvelle image à la tâche, puis force le redéploiement.
#     --force-new-deployment redémarre les tâches même si le tag est le même
#     (pratique quand tu utilises toujours :latest).
aws ecs update-service \
  --cluster {{NOM_PROJET}} \
  --service {{NOM_PROJET}}-api \
  --task-definition {{NOM_PROJET}}-api:2 \
  --force-new-deployment

aws ecs wait services-stable --cluster {{NOM_PROJET}} --services {{NOM_PROJET}}-api
```

---

## Vérification

```bash
# 1. Le service tourne à la taille demandée
aws ecs describe-services --cluster {{NOM_PROJET}} --services {{NOM_PROJET}}-api \
  --query "services[0].{Running:runningCount,Desire:desiredCount}" --output table
# → 1 / 1

# 2. L'ALB répond et le healthcheck de l'API passe
curl -i http://$ALB_DNS/api/health
# → HTTP/1.1 200 OK

# 3. Les journaux de l'API arrivent dans CloudWatch
aws logs tail "/ecs/{{NOM_PROJET}}" --region {{REGION}} --since 10m
# → des lignes de démarrage Symfony, migrations, "listening on 0.0.0.0:10000"

# 4. Le DNS pointe vers l'ALB (après l'étape Route53 de cli.md)
curl -i https://api.{{DOMAINE}}/api/health
# → HTTP/2 200
```

---

## Dépannage (3 pannes probables)

**1. La tâche « flippe » en boucle : `stopped`, `pending`, `stopped`…**

*Cause* : le conteneur démarre puis meurt (ou son healthcheck échoue). La
raison exacte est toujours écrite **deux fois** : l'état ECS et les logs.

```bash
# (a) Prendre la dernière tâche ARRÊTÉE et lire son motif d'arrêt.
aws ecs list-tasks --cluster {{NOM_PROJET}} --desired-status STOPPED \
  --query "taskArns[0]" --output text
aws ecs describe-tasks --cluster {{NOM_PROJET}} --tasks <ARN_TASK> \
  --query "tasks[0].{Arret:stoppedReason,Conteneurs:containers[0].{Nom:name,Etat:exitCode,Raison:reason}" --output table
# → "Essential container in task exited" = le conteneur est mort.
#   exitCode 1 = erreur applicative ; 137 = OOMKilled (RAM insuffisante,
#   augmente "memory" de la task definition) ; 127 = mauvaise image/commande.

# (b) La vérité applicative est dans CloudWatch :
aws logs tail "/ecs/{{NOM_PROJET}}" --region {{REGION}} --since 15m
# → souvent : DATABASE_URL invalide, secret introuvable, port non écouté,
#   healthcheck /api/health renvoie 404 (l'ALB tue alors la tâche).

# (c) Causes fréquentes, dans l'ordre :
#   - health check path erroné → corriger --health-check-path (étape 8)
#   - ARN de secret faux → la tâche refuse de démarrer (voir "secrets")
#   - image tag :latest non mise à jour → --force-new-deployment (étape 11)
```

**2. Les tâches restent `pending` / `PROVISIONING` indéfiniment**

*Cause* : AWS n'arrive pas à démarrer — le plus souvent, il ne peut pas
télécharger l'image, ou il n'y a plus d'adresses IP libres.

```bash
# (a) Le déploiement raconte quoi ?
aws ecs describe-services --cluster {{NOM_PROJET}} --services {{NOM_PROJET}}-api \
  --query "services[0].events[0:5].{Heure:createdAt,Message:message}" --output table
# → "unable to pull image ..." = jeton ECR ou URI d'image (refais étapes 3-4)
#   "subnet does not have enough free addresses" = sous-réseau saturé
#   (un /24 = ~250 IP, et chaque tâche Fargate en consomme UNE) :
#   utilise un autre sous-réseau ou libère des tâches.

# (b) Le rôle d'exécution existe-t-il et peut-il tirer l'image ?
aws ecs describe-task-definition --task-definition {{NOM_PROJET}}-api:1 \
  --query "taskDefinition.{Exec:executionRoleArn,Task:taskRoleArn}" --output table
aws iam get-role --role-name {{NOM_PROJET}}-execution-role
# → si "NoSuchEntity", refais l'étape 6 (b).
```

**3. `502 Bad Gateway` sur l'URL de l'ALB (ou `503`)**

*Cause* : l'ALB n'a aucune cible valide — la tâche ne répond pas au
healthcheck, ou le trafic est bloqué au niveau réseau.

```bash
# (a) Les cibles sont-elles "healthy" ?
aws elbv2 describe-target-health --target-group-arn "$TG_ARN" \
  --query "TargetHealthDescriptions[].{Cible:Target.Id,Etat:TargetHealth.State,Detail:TargetHealth.Reason}" --output table
# → "unhealthy" + "Target.ResponseCodeMismatch" = l'API répond mais PAS 200
#    sur /api/health (vérifie le chemin, une redirection HTTP peut suffire
#    à faire échouer le check) ; "unhealthy" + "Failed" = pas de réponse.

# (b) Le pare-feu des tâches accepte-t-il l'ALB ?
aws ec2 describe-security-groups --group-ids "$SG_TASK" \
  --query "SecurityGroups[0].IpPermissions" --output table
# → doit montrer port 10000, source = $SG_ALB. Sinon, refais l'étape 8.

# (c) L'écouteur pointe bien vers le target group ?
aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" \
  --query "Listeners[0].DefaultActions" --output table
```

---

## Coût

| Ressource | Facturation | Ordre de grandeur / mois |
|---|---|---|
| ECS Fargate — 0,5 vCPU + 1 Go, 24 h/24 | À l'heure, à la seconde, seulement quand la tâche tourne | ~15–25 $ **par tâche** |
| ALB | **Fixe** (≈ une vingtaine de dollars) + un supplément par LCU (volume et connexions) — **il se facture même à zéro requête** | ~20–25 $ |
| ECR | Stockage d'images au Go | ~0–2 $ |
| CloudWatch Logs | Écriture + rétention (garde 14–30 jours, pas un an) | ~0–2 $ |
| Secrets Manager | Par secret stocké (quelques centimes) ; SSM Parameter Store = gratuit | ~0–1 $ |
| Passerelle NAT (si sous-réseaux privés) | Fixe **+ facturation au Go traité** : c'est le piège n° 3 de `README.md` | 0 $ si tu restes en sous-réseau public |

**Lecture honnête du budget :** l'ALB coûte ~20 $ **le mois, point** — même
si ton API reçoit zéro visite. Avec Fargate, la voie B « API seule » démarre
donc autour de **40 $/mois** pour deux conteneurs (API + WebSocket), plus RDS
et S3/CloudFront. Si le budget serré est ta contrainte :

- **alternative budget** : Route53 (enregistrement A) + CloudFront + une
  **petite instance EC2** qui tourne nginx + Docker (voie A) : le coût fixe
  chute à ~15–25 $/mois tout compris, et le CDN reste gratuit à faible
  trafic (reste très bas à faible volume) ;
- **alternative zéro-serveur** : Netlify/Vercel pour le frontend ;
- ne **jamais** sous-dimensionner en pensant « ça passera » : un OOMKilled en
  boucle coûte autant qu'une instance plus grosse.

Vérifie la grille officielle : https://aws.amazon.com/pricing/
Free Tier : https://aws.amazon.com/free/
Documentation ECS : https://docs.aws.amazon.com/
