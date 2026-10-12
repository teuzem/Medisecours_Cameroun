# budget.md — Ne jamais être facturé surprise

---

## Objectif

Mettre en place, **avant de créer la moindre ressource**, un dispositif
d'alerte : un budget mensuel qui t'envoie un email quand tu dépasses un seuil,
une alarme CloudWatch sur la facture, les alertes d'utilisation gratuite — et
te donner la **checklist de nettoyage** à exécuter après chaque test.

Le budget AWS d'un débutant n'échoue presque jamais par « trop de trafic » :
il échoue par **des ressources oubliées qui tournent**. Ce fichier existe pour
que tu ne deviennes jamais cette personne.

---

## Table des valeurs à personnaliser

| Placeholder | Ce que c'est | Exemple |
|---|---|---|
| `{{EMAIL_ADMIN}}` | L'adresse qui reçoit TOUTES les alertes de facture — doit être une boîte que tu consultes vraiment | `toi@exemple.org` |
| `{{NOM_PROJET}}` | Nom du budget et du topic d'alerte | `medisecours` |
| `{{REGION}}` | Région de travail | `eu-west-1` |
| `{{COMPTE_AWS}}` | Numéro de compte (12 chiffres) | `123456789012` |
| `{{IP_SERVEUR}}` | IP de l'instance EC2 à vérifier dans la checklist | `52.14.10.20` |
| `{{ACCESS_KEY_ID}}` / `{{SECRET_ACCESS_KEY}}` | Clés IAM (pour les commandes de checklist) | — |

---

## Prérequis

1. Compte AWS créé et carte bancaire enregistrée.
2. AWS CLI v2 configuré (`cli.md`), avec des droits de lecture sur la
   facture et Budgets.
3. Une adresse email que tu ouvres **au moins une fois par semaine**.
4. 10 minutes. C'est le meilleur investissement de toute la section.

---

## Étapes numérotées

### Étape 1 — Créer le topic SNS qui enverra les emails

Un **topic SNS** = une liste d'abonnés à qui AWS peut pousser un message.
Les alertes de budget arrivent par ce canal (un simple email direct ne
suffit pas pour les actions automatiques).

```bash
# Standard (pas FIFO) : le bon choix pour des alertes.
TOPIC_ARN=$(aws sns create-topic --name {{NOM_PROJET}}-alertes-facture \
  --query "TopicArn" --output text)
echo "Topic : $TOPIC_ARN"
# → arn:aws:sns:{{REGION}}:{{COMPTE_AWS}}:{{NOM_PROJET}}-alertes-facture

# S'abonner avec ton email.
aws sns subscribe --topic-arn "$TOPIC_ARN" --protocol email \
  --notification-endpoint {{EMAIL_ADMIN}}
# → "SubscriptionArn": "pending confirmation"
```

**Étape OBLIGATOIRE, la plus souvent oubliée** : ouvre ta boîte mail, trouve
le message « AWS Notification - Subscription Confirmation » et **clique sur
Confirm subscription**. Tant que tu ne l'as pas fait, le topic existe mais
**personne ne reçoit rien** — et tu croiras que les alertes marchent.

```bash
# Vérifier que l'abonnement est bien actif (il doit dire "Confirmed") :
aws sns list-subscriptions-by-topic --topic-arn "$TOPIC_ARN" \
  --query "Subscriptions[].{Protocole:SubscriptionProtocol,Etat:SubscriptionArn}" --output table
```

Sortie attendue : `Etat: arn:aws:sns:...:Confirmed` (et non `pending
confirmation`).

### Étape 2 — Créer le budget mensuel avec deux alertes

**Pas-à-pas console** (console → menu en haut → *Billing* → *Budgets* →
ou directement https://aws.amazon.com/console/) :

1. **Create budget** → choisis **Customize (Advanced)** puis **Standard**
   (l'option *Budgets with filters* est inutile pour commencer).
2. *Budget type* : **Cost budget** (coût, pas utilisation).
3. *Budget name* : `{{NOM_PROJET}}-mensuel`.
4. *Budgeting period* : **Monthly**.
5. *Budgeted amount* : le montant que tu refuses de dépasser, ex. **20 USD**.
   Choisis USD comme monnaie d'affichage (c'est la monnaie de facturation
   AWS par défaut).
6. *Alert 1 — Actual* : **80 %** du budget → c'est l'alerte « tu es en train
   de dépasser ». Coche **Action** → *Select a topic* → choisis
   `{{NOM_PROJET}}-alertes-facture` (l'étape 1).
7. *Alert 2 — Forecasted* : **100 %** → l'alerte « d'après le rythme actuel,
   tu vas dépasser AVANT la fin du mois ». Même topic.
8. **Create budget.**

À quoi ça sert la différence entre les deux alertes : *Actual* te prévient
**quand c'est déjà fait**, *Forecasted* te prévient **avant** que ce ne soit
fait. Les deux, c'est ce qui te laisse le temps d'agir (supprimer une
instance) plutôt que de constater.

Commande équivalente pour vérifier depuis le terminal :

```bash
aws budgets describe-budgets --account-id {{COMPTE_AWS}} \
  --query "Budgets[].{Nom:BudgetName,Montant:BudgetLimit.Amount,Unite:BudgetLimit.Unit,Seuils:BudgetAlerts[].{Seuil:TriggerThreshold,Type:ComparisonOperator}}" \
  --output table
```

Sortie attendue : une ligne `{{NOM_PROJET}}-mensuel`, montant `20`, unité
`USD`, et deux alertes (`GREATER_THAN 80` / `GREATER_THAN 100`).

### Étape 3 — Alarme CloudWatch sur la facture totale

Les alarmes de facture sont un **second filet**, indépendant du budget : si
l'un des deux casse, l'autre reste.

**Pas-à-pas console** :

1. Ouvre **CloudWatch → Alarms → Create alarm**.
2. Dans *Select a metric* → onglet **Billing** → choisis
   **Total Estimated Charges**.
   > **Piège à connaître** : la métrique *Billing* n'existe **que dans la
   > région `us-east-1`** (Virginie du Nord), même si tout ton reste tourne
   > en Europe. Si tu ne vois pas l'onglet Billing, change de région en haut
   > à droite de la console, puis reviens.
3. *Conditions* : `Greater/Equal` → **15** (USD). Prends un seuil
   **inférieur** à celui du budget : l'alarme doit tomber avant.
4. *Configure actions* → *Select an SNS topic* → `{{NOM_PROJET}}-alertes-facture`
   → coche *Create a new topic* seulement si tu n'as pas fait l'étape 1.
5. Nomme l'alarme `{{NOM_PROJET}}-facture-totale` → **Create alarm**.

Sortie attendue : une alarme en état `OK` (et non `Insufficient data` —
elle a besoin d'au moins un relevé de facture pour passer en OK, arrive en
quelques heures).

### Étape 4 — Activer les alertes d'utilisation gratuite (Free Tier)

Le Free Tier a des **quotas mensuels** (ex. 750 h de `t2.micro`, 5 Go de
S3…) et ils ne s'affichent nulle part de façon évidente. Cette option t'envoie
un email quand tu approches de l'un d'eux.

**Pas-à-pas console** : *Billing* → **Billing preferences** →
coche **Receive free usage alerts** → mets `{{EMAIL_ADMIN}}` → enregistre.
(Le même écran permet de cocher *Receive PDF invoices by email* : utile pour
conserver les factures.)

Vérification : dans la même page, la case doit rester cochée après un
rechargement.

### Étape 5 — Réglages de la console à ne PAS toucher

- **Ne masque jamais les prix.** Dans les préférences de facturation et les
  préférences d'affichage, ne coche/active rien qui cache les montants, les
  filtres de coûts ou les détails de facture : un prix invisible est un prix
  qu'on ne conteste pas. L'objectif est que le coût reste affiché partout où
  tu passes, y compris dans le sélecteur de ressources.
- **Ne déconnecte pas les alertes.** Si tu changes d'email, refais l'étape 1
  (nouvel abonnement + confirmation) **avant** de supprimer l'ancien.
- **Ne mets pas de montant décoratif.** Un budget à 500 USD parce que « c'est
  rassurant » ne t'alerte jamais : mets le montant que tu es réellement prêt
  à payer (10 à 30 USD pour un projet de test).

### Étape 6 — Les bons réflexes, tous les jours

1. **`terminate` les instances de test, pas juste `stop`.** Une instance
   stoppée ne facture plus le calcul, mais **son disque EBS, lui, continue**
   d'être facturé à chaque heure, tout le mois.
2. **IP Élastique rattachée = souvent un coût caché.** Attachée à une
   instance *en marche*, elle est incluse. Détachée, elle reste à toi et se
   facture **à l'heure**, jusqu'à ce que tu l'oublies. Libère-la dès que tu n'en as plus
   besoin (`aws ec2 release-address`).
3. **Les snapshots finissent par coûter plus que les données d'origine.**
   Un snapshot est une copie de ton disque : en garder 30, c'est payer 30
   copies. Garde les sauvegardes utiles, supprime le reste (`aws ec2
   delete-snapshot`), et surveille le *Lifecycle Manager* que tu as créé dans
   `ec2.md`.
4. **Un RDS ne dort jamais tout seul.** En test, stoppe-le la nuit
   (`aws rds stop-db-instance`) ; en production, dimensionne juste.
5. **Un ALB coûte même à vide.** Si tu fais des pauses longues (semaines),
   pense à ce fixe mensuel : supprimer et recréer un ALB est plus propre que
   le laisser traîner (à peser : changer d'IP publique impose de bouger ton
   DNS).
6. **Vérifie la facture une fois par semaine**, même avec les alertes :
   *Billing* → *Cost Explorer* → filtre sur le mois en cours.

### Étape 7 — Checklist de nettoyage après un test

Copie-colle terminal. **Dans cet ordre** (on supprime d'abord ce qui dépend
des autres, sinon certains refusent de partir) :

```bash
# --- 1. Ce qui tourne EN CORE, en premier -------------------------------
# Instances EC2 en marche (avec leur IP pour identification)
aws ec2 describe-instances \
  --filters Name=instance-state-name,Values=running \
  --query "Reservations[].Instances[].{Id:InstanceId,Type:InstanceType,IP:PublicIpAddress,Nom:Tags[?Key=='Name']|[0].Value}" \
  --output table
# → rien à supprimer ? passe à la suite. Sinon :
aws ec2 terminate-instances --instance-ids i-XXXX

# Services ECS (ils consomment des tâches Fargate en continu)
aws ecs list-clusters --query "clusterArns" --output text
aws ecs list-services --cluster {{NOM_PROJET}} --query "serviceArns" --output text
aws ecs update-service --cluster {{NOM_PROJET}} --service {{NOM_PROJET}}-api \
  --desired-count 0        # ramène à 0 = fin des tâches facturées
# Puis suppression définitive une fois la config sauvegardée :
aws ecs delete-service --cluster {{NOM_PROJET}} --service {{NOM_PROJET}}-api --force
aws ecs delete-cluster --cluster {{NOM_PROJET}}

# Load Balancers (facturés à l'heure, MÊME à zéro requête)
aws elbv2 describe-load-balancers \
  --query "LoadBalancers[].{Nom:LoadBalancerName,Arn:LoadBalancerArn}" --output table
aws elbv2 delete-load-balancer --load-balancer-arn <ARN>
aws elbv2 delete-target-group --target-group-arn <ARN>

# Bases RDS (24 h/24, souvent LE gros poste de test)
aws rds describe-db-instances \
  --query "DBInstances[].{Id:DBInstanceIdentifier,Classe:DBInstanceClass,Etat:DBInstanceStatus}" --output table
aws rds delete-db-instance --db-instance-identifier {{NOM_PROJET}}-db --skip-final-snapshot
#   ⚠ --skip-final-snapshot : seulement si tu n'as PAS besoin des données.
#   Pour garder : remplace par un create-db-snapshot AVANT la suppression.
```

```bash
# --- 2. Le stockage qui reste après la suppression ----------------------
# Volumes détachés ("available" = toujours facturés !)
aws ec2 describe-volumes --filters Name=status,Values=available \
  --query "Volumes[].{Id:VolumeId,Taille:Size,Zone:AvailabilityZone}" --output table
aws ec2 delete-volume --volume-id vol-XXXX

# IP Élastiques NON rattachées (facturées à l'heure)
aws ec2 describe-addresses \
  --query "Addresses[?InstanceId==null].{Ip:PublicIp,Alloc:AllocationId}" --output table
aws ec2 release-address --allocation-id eipalloc-XXXX

# Snapshots (facturés au Go, tout le temps)
aws ec2 describe-snapshots --owner-ids self \
  --query "Snapshots[].{Id:SnapshotId,Taille:Size,Debut:StartTime}" --output table
aws ec2 delete-snapshot --snapshot-id snap-XXXX

# Passerelles NAT (fixe + facturation au Go traité : piège n° 3 de README.md)
aws ec2 describe-nat-gateways --query "NatGateways[].{Id:NatGatewayId,Etat:State}" --output table
aws ec2 delete-nat-gateway --nat-gateway-id natg-XXXX
#   (pense aussi à supprimer la route vers 0.0.0.0/0 dans la table de routage,
#    sinon la NAT reste "utilisée" par le VPC)
```

```bash
# --- 3. Les services de contenu ----------------------------------------
# Buckets S3 (et leur contenu — un bucket non vide refuse d'être supprimé)
aws s3 ls
aws s3 rm s3://nom-du-bucket --recursive && aws s3 rb s3://nom-du-bucket

# Dépôts ECR (images conservées au Go, même sans conteneur qui tourne)
aws ecr describe-repositories --query "repositories[].{Nom:repositoryName,Uri:repositoryUri}" --output table
aws ecr delete-repository --repository-name {{NOM_PROJET}}-api --force
#   --force supprime aussi les images dedans.

# Distributeurs CloudFront (petit fixe + coûts de requêtes)
aws cloudfront list-distributions \
  --query "DistributionList.Items[].{Id:Id,Statut:Status}" --output table
aws cloudfront delete-distribution --id E1ABCDEF2GHIJKL
#   ⚠ Distribution d'abord DÉSACTIVÉE (Enabled: false) et "Deployed",
#    sinon AWS refuse la suppression.

# Groupes de logs CloudWatch (le stockage grossit doucement)
aws logs describe-log-groups \
  --query "logGroups[].{Nom:logGroupName,Mo:storedBytes}" --output table
aws logs delete-log-group --log-group-name "/ecs/{{NOM_PROJET}}"
```

```bash
# --- 4. Vérification finale : zéro ressource active --------------------
aws ec2 describe-instances --filters Name=instance-state-name,Values=running \
  --query "Reservations[].Instances[].InstanceId" --output text     # → vide
aws rds describe-db-instances \
  --query "DBInstances[].DBInstanceIdentifier" --output text         # → vide
aws elbv2 describe-load-balancers \
  --query "LoadBalancers[].LoadBalancerName" --output text           # → vide
aws ecs list-clusters --query "clusterArns" --output text            # → vide
aws ec2 describe-addresses \
  --query "Addresses[?InstanceId==null].PublicIp" --output text      # → vide

# Et la facture, enfin : la seule source fiable est la console
# (Billing → Cost Explorer → mois en cours). Le CLI n'a pas de commande
# "montant dû" simple : c'est volontaire, la facture a ~24 h de retard.
```

> **Nettoyer ne rembourse pas** : la facture du mois en cours reste dûe pour
> le temps pendant lequel les ressources ont tourné. Le nettoyage empêche la
> facture du **mois suivant** de repartir de la même façon.

---

## Vérification

```bash
# 1. Le topic existe et l'abonnement est CONFIRMED
aws sns list-subscriptions-by-topic --topic-arn "$TOPIC_ARN" \
  --query "Subscriptions[].SubscriptionArn" --output text
# → ...Confirmed   (un "pending confirmation" = tu n'as pas cliqué le mail)

# 2. Le budget existe avec ses seuils
aws budgets describe-budgets --account-id {{COMPTE_AWS}} \
  --query "Budgets[].{Nom:BudgetName,Limite:BudgetLimit.Amount,Alertes:BudgetAlerts[].TriggerThreshold}" \
  --output table
# → 2 lignes d'alertes (80 et 100)

# 3. L'alarme de facture existe (région us-east-1 uniquement !)
aws cloudwatch describe-alarms --region us-east-1 --alarm-names {{NOM_PROJET}}-facture-totale \
  --query "MetricAlarms[].{Nom:AlarmName,Seuil:Threshold,Etat:StateValue}" --output table
# → Etat: OK ou InsufficientData (jamais de "alarm" au repos)

# 4. Test grandeur nature : envoie-toi un message de test
aws sns publish --topic-arn "$TOPIC_ARN" \
  --message "Test d'alerte facture {{NOM_PROJET}} : si tu reçois ceci, la chaîne fonctionne." \
  --subject "Test alerte AWS"
# → l'email arrive en quelques secondes dans {{EMAIL_ADMIN}}
```

---

## Dépannage (3 pannes probables)

**1. Aucun email d'alerte reçu, alors que le budget est dépassé**

*Cause n° 1, dans 90 % des cas* : l'abonnement SNS n'a jamais été **confirmé**
(étape 1). AWS n'envoie **rien** tant que le lien de confirmation n'est pas
cliqué.

```bash
# a) État de l'abonnement :
aws sns list-subscriptions-by-topic --topic-arn "$TOPIC_ARN" \
  --query "Subscriptions[].SubscriptionArn" --output text
# → "pending confirmation" = relance la confirmation : la console SNS
#   (Topics → ton topic → Subscriptions) propose "Request confirmation again".

# b) Le budget pointe-t-il vers le BON topic ?
aws budgets describe-budgets --account-id {{COMPTE_AWS}} \
  --query "Budgets[].BudgetAlerts[].Actions.{SNS:ActionType,Sujet:SnsAction.SnsTopicArn}" --output table
# → l'ARN doit être celui de ton topic. Sinon, réédite le budget dans la
#   console et re-sélectionne le topic (étape 2, point 6).

# c) Dans le SPAM : c'est un email automatisé d'Amazon, il atterrit souvent
#    en indésirable la première fois. Marque "ce n'est pas du spam".

# d) Teste la chaîne indépendamment du budget (étape 4 de la Vérification) :
#    si le test arrive mais que l'alerte budget n'arrive pas, le problème est
#    entre le budget et le topic ; sinon, il est sur l'abonnement/email.
```

**2. Le budget affiche 0 USD alors que tu consommes clairement**

*Cause* : la facture **prévisionnelle** a toujours ~24 h de retard — c'est
normal, ce n'est pas un bug. Parfois aussi : tu regardes le mauvais compte.

```bash
# a) Bien regarder la mention d'heure de dernière mise à jour dans
#    Billing → Cost Explorer : "Estimated charges" = estimation arrêtée
#    à la veille. Ce qui tourne AUJOURD'HUI n'apparaîtra que demain.

# b) Un seul compte ? Un compte organisation (ORG) agrège plusieurs comptes
#    : confirme celui que tu inspectes.
aws sts get-caller-identity --query Account --output text
# → compare avec le compte affiché dans la barre de facturation de la console.

# c) Impatience légitime sur un test : pour vérifier EN DIRECT ce qui
#    tourne, ne te fie pas à la facture, mais aux ressources (étape 7) :
#    une instance qui tourne se voit en 5 secondes, la facture en 24 h.
```

**3. L'alarme de facture reste « Insufficient data » ou ne se déclenche jamais**

*Cause* : mauvaise région (la métrique *Billing* n'existe qu'en
`us-east-1`), ou seuil placé au-dessus du montant réel, ou alarme sans
action SNS rattachée.

```bash
# a) Région : l'alarme est-elle créée là où il faut ?
aws cloudwatch describe-alarms --region us-east-1 \
  --query "MetricAlarms[].{Nom:AlarmName,Etat:StateValue,Seuil:Threshold}" --output table
# → si rien ne s'affiche, l'alarme est dans une autre région : recrée-la
#   depuis us-east-1 (étape 3, note en encadré).

# b) Seuil : "Insufficient data" pendant des heures = aucun relevé en dessous
#    du moment de création. Attends le relevé suivant (arrive en ~24 h pour
#    la facture) ou déclenche artificiellement en baissant le seuil à 1 USD.

# c) Action : alarme créée mais SANS topic SNS = elle passe en ALARM sans
#    envoyer rien. Édite l'alarme → Actions → ajoute ton topic → Save.
#    Rappel : sans abonnement confirmé, toujours rien ne part (panne 1).
```

---

## Coût

**Ce fichier coûte 0 $.** La mise en place des alertes est gratuite :

| Élément | Coût |
|---|---|
| AWS Budgets (jusqu'à 2 budgets dans la plupart des comptes) | 0 $ pour le premier budget ; les suivants restent très peu chers (quelques dollars/mois au-delà du quota) — vérifie la grille |
| Topic SNS + emails d'alerte | 0 $ à ce volume (quelques messages/mois) |
| Alarme CloudWatch « billing » | Les premières alarmes sont incluses, le reste se compte en quelques dixièmes de dollar par alarme et par mois — vérifie la grille |
| Alertes Free Tier (Billing preferences) | 0 $ |
| Cost Explorer (consultation des coûts) | 0 $ pour la consultation de base |

Autrement dit : **le dispositif d'alerte coûte moins cher qu'un seul jour
d'instance oubliée.** Aucune excuse pour ne pas le faire.

Vérifie la grille officielle : https://aws.amazon.com/pricing/
Free Tier (ce qui est gratuit les 12 premiers mois) : https://aws.amazon.com/free/
Console : https://aws.amazon.com/console/
Documentation Budgets/SNS/CloudWatch : https://docs.aws.amazon.com/
