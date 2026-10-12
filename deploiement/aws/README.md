# AWS — Déploiement pour débutant complet

> Destiné à quelqu'un qui n'a **jamais** ouvert AWS, ni même manipulé de
> machine virtuelle. Tout est expliqué ici : les mots bizarres, les clics à
> faire, ce qui coûte de l'argent et ce qui n'en coûte pas.

---

## Objectif

Te permettre de déployer l'application de référence (frontend Next.js, API
Symfony, base PostgreSQL, service WebSockets) sur AWS, en suivant **une seule
des deux voies** :

- **Voie A — « EC2 = un VPS comme les autres »** : tu loues une machine
  virtuelle Ubuntu 24.04 et tu répètes *exactement* la même procédure
  docker-compose + nginx que sur un VPS classique. C'est la voie à prendre
  quand tu débutes : une seule machine à comprendre, un seul pare-feu, une
  seule facture à surveiller. La suite du déploiement (Docker, nginx, domaine,
  certificat) est décrite dans **`../fullstack/vps/`** — cette section AWS
  s'arrête au moment où la machine est en ligne et tu peux te connecter.
- **Voie B — services managés** : tu supprimes la notion de « serveur ».
  Le frontend part sur S3 + CloudFront, la base sur RDS, l'API sur ECS
  Fargate. Chaque brique est gérée par AWS (mises à jour, sauvegardes,
  redémarrages). Plus de serveur à administrer, mais plus de fichiers à
  toucher à la main et un coût fixe mensuel plus élevé.

Règle simple : **commence par la voie A**. Passe en voie B seulement quand la
voie A fonctionne et que tu sais *pourquoi* tu veux te passer d'un serveur.

---

## Table des valeurs à personnaliser

Chaque `{{...}}` de cette section doit être remplacé par **ta** valeur. Écris
les tiens une fois pour toutes dans un bloc-notes (pas dans un dépôt Git) et
réutilise-les partout.

| Placeholder | Ce que c'est | Exemple |
|---|---|---|
| `{{NOM_PROJET}}` | Nom court du projet, **en minuscules, sans accent ni espace** (il sert de nom à des ressources AWS entières) | `medisecours` |
| `{{DOMAINE}}` | Ton nom de domaine | `example.org` |
| `{{IP_SERVEUR}}` | L'adresse publique (IPv4) de l'instance EC2 — tu la récupères à l'étape 5 de `ec2.md` | `52.14.10.20` |
| `{{REGION}}` | La région AWS où tu travailles. On utilise **`eu-west-1`** (Irlande, Europe de l'Ouest) partout dans ce guide | `eu-west-1` |
| `{{EMAIL_ADMIN}}` | Ton adresse email : réception des alertes de facture, validation de certificat | `toi@exemple.org` |
| `{{ACCESS_KEY_ID}}` | L'identifiant de la clé d'accès de ton **utilisateur IAM** (jamais du compte root) | `AKIAIOSFODNN7EXAMPLE` |
| `{{SECRET_ACCESS_KEY}}` | Le secret correspondant à cette clé — affiché **une seule fois** à la création | *(gardé secret)* |
| `{{COMPTE_AWS}}` | Ton numéro de compte AWS : 12 chiffres, visible en haut à droite de la console | `123456789012` |
| `{{ZONE_ID}}` | L'identifiant de ta zone DNS Route53 (commence par `Z…`) | `Z123456789ABCDEFGHI` |

---

## Prérequis

1. **Un compte AWS créé** avec une carte bancaire enregistrée (obligatoire, même
   si tu restes dans le Free Tier) : https://aws.amazon.com/console/
2. **Un utilisateur IAM** créé dans ce compte (pas le compte root) avec les
   politiques nécessaires, et ses clés `{{ACCESS_KEY_ID}}` /
   `{{SECRET_ACCESS_KEY}}` — c'est ce que tu installes sur ta machine.
3. **AWS CLI v2** installé et configuré sur ta machine : voir `cli.md`.
4. **Un domaine** enregistré quelque part (pas forcément chez AWS).
5. **Un terminal** : PowerShell ou un terminal WSL/Git Bash sous Windows,
   Terminal sous macOS/Linux. Les commandes de ce guide sont en bash ; sous
   PowerShell, elles fonctionnent tel quel sauf indication contraire.

Vérifie que tout est en place avant de continuer :

```bash
# Affiche ton identité d'accès : compte, utilisateur IAM utilisé.
# Si tu vois "Arn": "...:root", TU ES SUR LE COMPTE ROOT — arrête-toi et
# reviens à cli.md pour créer un utilisateur IAM.
aws sts get-caller-identity
```

Sortie attendue (les chiffres changent) :

```json
{
    "Account": "123456789012",
    "UserId": "AIDAIOSFODNN7EXAMPLE",
    "Arn": "arn:aws:iam::123456789012:user/mon-utilisateur"
}
```

---

## Glossaire illustré

Le jargon AWS, sans détour. Chaque terme indique **à quoi il sert
concrètement** dans notre déploiement.

- **Compte AWS** — ton coffre-fort chez Amazon. Un compte = une identité de
  facturation unique. Tu en crées un seul, avec ta carte bancaire.
- **Compte root (super-admin)** — le compte « propriétaire » créé à
  l'inscription : email + mot de passe principaux. Il a tous les droits sur
  tout. **Il ne sert qu'à créer les utilisateurs IAM, une fois.** Au
  quotidien, ne l'utilise jamais : si ses clés fuient, l'attaquant peut
  supprimer tout ton compte et extorquer de l'argent.
- **IAM (Identity and Access Management)** — le service de gestion des
  identités. Un **utilisateur IAM** = un sous-compte avec son propre login et
  ses propres clés. Une **politique (policy)** = un document JSON qui dit ce
  que l'utilisateur a le droit de faire (`AmazonEC2FullAccess`, ou un périmètre
  restreint). On donne à notre utilisateur les droits de gérer EC2, S3, RDS,
  ECS… sans lui donner les droits de facturation.
- **Région** — un grand centre de données géographique : `eu-west-1`
  (Irlande), `us-east-1` (Virginie). **Tout ce que tu crées vit dans une
  région** ; une ressource d'Irlande n'est pas visible depuis Frankfurt.
- **Zone de disponibilité (AZ)** — sous-division d'une région : un bâtiment
  séparé, alimenté indépendamment. Il y en a au moins 3 par région. Deux
  machines dans 2 AZ survivent à la panne d'un bâtiment.
- **VPC par défaut (Virtual Private Cloud)** — ton réseau privé *dans* le
  cloud : un bloc d'adresses IP (ici `10.0.0.0/16`) découpé en sous-réseaux.
  AWS en a déjà créé un automatiquement à l'ouverture du compte : le « VPC
  par défaut ». On le réutilise tel quel pour la voie A et pour RDS.
- **Security Group (SG)** — **le pare-feu**. Liste blanche de ports ouverts :
  « le port 22 uniquement depuis mon IP », « le port 443 depuis partout ».
  Il s'applique à l'instance, il est *stateful* (la réponse sort toujours).
  *Ne pas confondre avec les Network ACL : couches bas niveau, on n'en a pas
  besoin ici.*
- **Key Pair (paire de clés)** — le couple « clé publique / clé privée » qui
  ouvre le SSH. AWS garde la clé publique, tu télécharges la clé privée en
  fichier `.pem` **une seule fois** (jamais re-téléchargeable). Sans ce
  fichier : aucune connexion possible, même avec le bon mot de passe (il n'y
  a pas de mot de passe).
- **AMI (Amazon Machine Image)** — le « disque de démarrage » d'une machine :
  système d'exploitation + logiciels préinstallés. On choisit l'AMI
  officielle **Ubuntu 24.04 LTS** maintenue par Canonical.
- **Instance** — **la machine virtuelle elle-même** : un serveur complet qui
  tourne dans le datacenter AWS. C'est l'équivalent exact de ton VPS. Tu lui
  parles en SSH, tu y installes Docker, il tourne 24 h/24.
- **EBS (Elastic Block Store)** — **le disque dur de l'instance**. Le disque
  de démarrage est un volume EBS ; il survit à un redémarrage, il est facturé
  au Go. `gp3` = la génération actuelle, économique.
- **Snapshot** — copie instantanée d'un volume EBS dans S3. Sert de
  sauvegarde : on en fait un avant une mise à jour risquée, on en restaure
  pour revenir en arrière. Facturé au Go stocké — d'où le piège n° 5 plus bas.
- **S3 (Simple Storage Service)** — le « Dropbox d'AWS » : un stockage
  d'objets (fichiers) infini, disponible partout, facturé au Go. Idéal pour le
  frontend statique exporté de Next.js, et pour les sauvegardes.
- **CloudFront** — le **CDN** : des serveurs répartis dans le monde qui
  gardent une copie de tes fichiers près des visiteurs. Résultat : site plus
  rapide, HTTPS géré, et peu de trafic qui remonte jusqu'à S3.
- **RDS (Relational Database Service)** — PostgreSQL/MySQL **managé** : AWS
  installe la base, fait les sauvegardes automatiques, applique les patches,
  redémarre si besoin. Toi, tu ne fais que `CREATE DATABASE`. Alternative à
  PostgreSQL lancé dans un conteneur sur la machine.
- **ECS / Fargate** — ECS = le service d'orchestration de conteneurs
  d'AWS (l'équivalent maison de Kubernetes). **Fargate** = le mode « sans
  serveur » : tu décris la tâche (image, vCPU, RAM), AWS allume les machines
  à ta place. Tu ne gères plus de serveur, mais tu payes au temps passé.
- **ALB (Application Load Balancer)** — l'**entrée publique** de l'API : une
  adresse DNS unique qui répartit les requêtes vers les tâches ECS et fait
  l'HTTPS. Attention : il est facturé *en continu*, même à zéro requête.
- **ECR (Elastic Container Registry)** — le « Docker Hub » privé d'AWS : tu y
  pousses tes images Docker, ECS les en tire. Stockage facturé au Go.
- **Secrets Manager** — un coffre-fort pour mots de passe et clés : au lieu
  d'écrire `DATABASE_URL` en clair dans un fichier, la tâche ECS va le lire
  au démarrage. Alternative gratuite : SSM Parameter Store (type
  `SecureString`).
- **Bill (facture)** — l'onglet **Billing** de la console : ce que tu dois ce
  mois-ci. Il a ~24 h de retard sur la réalité en cours de mois.
- **Free Tier / crédits** — le **Free Tier** = certaines ressources gratuites
  pendant 12 mois (ex. `t2.micro`). Les **crédits** = un bon d'achat en
  dollars offert à l'inscription (programme variable). Les deux ont des
  limites : lis https://aws.amazon.com/free/

---

## Je veux héberger quoi → quel service

| Ce que tu as | Service AWS | Guide |
|---|---|---|
| Un site statique (HTML/CSS/JS exporté, blog, landing page) | **S3 + CloudFront** | `s3-cloudfront.md` |
| Une app fullstack complète (Next.js + API + WebSocket + PostgreSQL) **simple à gérer** | **EC2** (une machine Ubuntu, comme un VPS) | `ec2.md` puis `../fullstack/vps/` |
| Une API sans vouloir gérer de serveur ni de mise à l'échelle | **ECS Fargate** (+ ALB, ECR) | `ecs-fargate.md` |
| Une base de données PostgreSQL sans l'administrer | **RDS PostgreSQL 16** | `rds.md` |
| Des fichiers à stocker (uploads, sauvegardes, exports) | **S3** | `s3-cloudfront.md` |
| Des noms de domaine / enregistrements DNS | **Route53** (ou ton hébergeur DNS) | `cli.md` (section Route53) |
| Être prévenu avant d'être facturé | **AWS Budgets + CloudWatch** | `budget.md` |

---

## Les 3 règles de sécurité

1. **Le compte root ne sert qu'une fois : pour créer l'utilisateur IAM.**
   Jamais d'`aws configure` avec les clés root, jamais de navigation au
   quotidien connecté en root. Crée un utilisateur IAM nommé clairement (ex.
   `admin-{{NOM_PROJET}}`), donne-lui les politiques ciblées dont il a besoin
   et utilise SES clés partout. Un compte root compromis = perte totale
   du compte + factures frauduleuses.
2. **L'accès au serveur se fait uniquement par paire de clés (`.pem`).**
   Pas de mot de passe SSH, pas d'accès « password » sur le port 22. La clé
   privée reste sur ta machine, avec des droits restrictifs (`chmod 400`), et
   n'est jamais copiée dans un dépôt, un chat, un tiroir partagé.
3. **Jamais de clé AWS dans un dépôt Git.** Ni `{{ACCESS_KEY_ID}}`, ni
   `{{SECRET_ACCESS_KEY}}`, ni `DATABASE_URL` contenant un mot de passe. Si
   tu as poussé une clé par erreur : supprime-la du dépôt **et** révoque-la
   dans IAM (`Access keys` → `Deactivate` puis `Delete`) — supprimer du Git
   ne suffit pas, l'historique garde la trace.
   Vérifie aussi que `.gitignore` couvre bien `.env` et `*.pem`.

---

## Étapes numérotées — parcours recommandé (voie A)

Étapes dans l'ordre. Chaque lien est un fichier autonome avec ses
propres commandes et sorties attendues.

1. **Créer le compte AWS** et enregistrer la carte bancaire —
   https://aws.amazon.com/console/
2. **Créer l'utilisateur IAM + ses clés** (règle 1 ci-dessus) — `cli.md`
   étapes 1 à 3.
3. **Installer et configurer AWS CLI v2** (`aws configure`) — `cli.md`.
4. **Créer la paire de clés SSH** et la sauvegarder en local — `ec2.md` étape 2.
5. **Lancer l'instance EC2 Ubuntu 24.04** avec son pare-feu (Security Group)
   — `ec2.md` étapes 1 à 6.
6. **Attacher une IP Élastique** pour que l'adresse ne change plus jamais —
   `ec2.md` étape 5.
7. **Se connecter en SSH** (`ssh -i cle.pem ubuntu@{{IP_SERVEUR}}`) —
   `ec2.md` étape 6.
8. **Installer Docker et déployer l'app** : procédure identique à celle d'un
   VPS, décrite dans **`../fullstack/vps/`** (nginx, conteneurs, démarrage).
9. **Pointer le domaine** vers `{{IP_SERVEUR}}` (enregistrement A chez
   Route53 ou chez ton hébergeur DNS) — commandes dans `cli.md` section
   Route53.
10. **Obtenir le certificat HTTPS** (Let's Encrypt via nginx, ou ACM pour le
    volet managé) — selon la voie choisie.
11. **Mettre en place les alertes de facture** AVANT de laisser tourner
    quoi que ce soit — `budget.md`.

**Voie B** (services managés) : étapes 1 à 3 ci-dessus, puis
`s3-cloudfront.md` (frontend), `rds.md` (base), `ecs-fargate.md` (API), et
`budget.md` en dernier — mais en vrai, `budget.md` se fait **avant** toute
création de ressource.

---

## Vérification

Tu peux considérer la section « installée » quand ces contrôles passent :

```bash
# 1. Tu n'es PAS sur le root
aws sts get-caller-identity --query "Arn" --output text
# → ...:user/mon-utilisateur   (et non ...:root)

# 2. La liste de tes instances ne contient que ce que tu attends
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" \
  --query "Reservations[].Instances[].{Id:InstanceId,Type:InstanceType,IP:PublicIpAddress}" \
  --output table
# → une seule ligne, ton instance, avec une IP publique

# 3. La connexion SSH fonctionne (voir ec2.md)
ssh -i {{NOM_PROJET}}-cle.pem ubuntu@{{IP_SERVEUR}} "hostname && df -h /"
# → nom de machine + disque monté

# 4. Une alerte de facture existe (voir budget.md)
aws budgets describe-budgets --account-id {{COMPTE_AWS}} \
  --query "Budgets[].{Nom:BudgetName,Montant:BudgetLimit.Amount}" --output table
# → au moins une ligne avec ton seuil mensuel
```

---

## Dépannage (3 pannes probables)

| Symptom | Cause la plus probable | Correction |
|---|---|---|
| `An error occurred (UnauthorizedOperation)` ou `AccessDenied` sur *toutes* les commandes | Tu utilises des clés d'un utilisateur IAM sans les politiques, ou (pire) un compte root mal configuré | Regarde `Arn` via `aws sts get-caller-identity`. Ouvre IAM → Utilisateurs → ta politique. Dans `cli.md`, section « Dépannage », la marche à suivre complète |
| `Could not connect to the endpoint URL` | Mauvaise région : tu crées/consultes des ressources d'une autre région que celle de tes clés | `aws configure get region` doit renvoyer `{{REGION}}` ; sinon `aws configure set default.region {{REGION}}`, ou ajoute `--region {{REGION}}` à la commande |
| Tu trouves *rien* alors que la ressource existe | Ressource créée dans une autre région | `aws ec2 describe-instances --region {{REGION}} …` — AWS ne montre jamais les ressources des autres régions par magie |

Pour les pannes *pendant* le déploiement (SSH, base, CDN, tâches), chacun des
fichiers `ec2.md`, `rds.md`, `s3-cloudfront.md`, `ecs-fargate.md` possède sa
propre section « Dépannage » avec 3 cas concrets.

---

## Les 5 pièges de facturation

À lire avant de créer quoi que ce soit. Chacun a ruiné des débutants.

1. **Instance oubliée allumée.** Une instance tourne 24 h/24, même inutilisée
   → elle se facture à l'heure. Une `t3.small` oubliée un mois = une
   dizaine-vingtaine de dollars partis (ordre de grandeur, vérifie la grille
   https://aws.amazon.com/pricing/). Réflexe : `aws ec2 terminate-instances`
   dès que le test est fini (voir la checklist de `budget.md`).
2. **IP Élastique non rattachée.** Une IP Élastique *attachée à une instance
   en marche* est comprise dans le prix de l'instance. Détachée (instance
   stoppée ou supprimée), elle reste à toi et se facture **à l'heure**, petit
   à petit, jusqu'à ce que tu la libères. Réflexe : libère-la quand tu n'en
   as pas besoin, ou garde-la attachée en permanence si elle pointe vers ton
   DNS.
3. **Passerelle NAT et « data processing ».** Si tu mets des instances ou
   des tâches ECS dans un sous-réseau *privé*, une passerelle NAT devient
   obligatoire pour rejoindre Internet (téléchargement d'images, mises à
   jour)… et elle se facture **par Go traité**, en plus d'un coût horaire.
   Pour apprendre : reste dans les sous-réseaux publics du VPC par défaut.
4. **RDS allumé 24 h/24 même inutilisé.** Une base `db.t4g.micro` tourne en
   continu, la nuit, le week-end, quand personne ne se connecte. C'est le
   prix de la tranquillité (sauvegardes, patches). En *développement*, on
   peut stopper la base la nuit ; en production, on assume et on
   dimensionne juste (voir `rds.md`).
5. **Snapshots et vieux fichiers S3 oubliés.** Les snapshots EBS/RDS sont
   *incrémentaux* mais ils s'accumulent : 20 snapshots de 30 Go = 600 Go
   facturés. Sur S3, les fichiers oubliés (anciens exports, vieux builds)
   dorment aussi et se facturent au Go, tous les mois, à vie. Réflexe :
   liste périodiquement (`aws ec2 describe-snapshots`,
   `aws s3 ls --recursive`) et supprime ce qui ne sert plus.

---

## Coût

**Ce que coûte la section AWS elle-même : rien.** Les documentations, la
console, l'API, IAM, Budgets et les alarmes de facture sont gratuits. Seules
les ressources que tu *crées* coûtent quelque chose.

Ordres de grandeur mensuels (à titre indicatif, **vérifie la grille
officielle https://aws.amazon.com/pricing/**, les tarifs varient par région) :

| Élément | Ordre de grandeur / mois |
|---|---|
| Instance `t2.micro` (Free Tier, 12 premiers mois) | 0 $ pendant le Free Tier, puis ~5–10 $ |
| Instance `t3.small` (voie A de test) | ~10–20 $ |
| Instance `t4g.medium` (voie A confortable) | ~20–30 $ |
| Disque EBS gp3 30 Go | quelques dollars |
| IP Élastique attachée à une instance en marche | comprise ; détachée : ~quelques dollars |
| RDS `db.t4g.micro` PostgreSQL 16 + 20 Go | ~10–25 $ (mais **24 h/24**) |
| S3 (stockage frontend statique) | < 1 $ pour quelques Go |
| CloudFront | premiers Go gratuits (Free Tier 12 mois), puis quelques centimes par Go transféré |
| ECS Fargate 0,5 vCPU / 1 Go en continu | ~15–25 $ par tâche |
| ALB (voie B) | ~20 $ **fixe**, même à zéro requête |
| Budgets, alarmes CloudWatch « billing », IAM, ECR (quelques Go) | 0 $ |

**Budget réaliste pour la voie A** (une machine + disque + IP fixe) :
une vingtaine de dollars par mois hors Free Tier.
**Budget réaliste pour la voie B complète** (S3 + CloudFront + RDS + ALB +
1 tâche Fargate) : de l'ordre de 60 à 100 $ par mois — c'est le prix de ne
plus gérer aucun serveur.

Grille tarifaire officielle : https://aws.amazon.com/pricing/
Offre gratuite : https://aws.amazon.com/free/
Console : https://aws.amazon.com/console/
Documentation : https://docs.aws.amazon.com/

---

## Fichiers de ce dossier

| Fichier | Rôle |
|---|---|
| `README.md` | Ce panorama : glossaire, choix du service, règles de sécurité, parcours, pièges de facturation |
| `ec2.md` | Procédure complète de lancement d'une instance Ubuntu 24.04 (voie A), jusqu'à la connexion SSH |
| `rds.md` | Base PostgreSQL 16 managée : réseau, sécurité, `DATABASE_URL`, sauvegardes, restauration |
| `s3-cloudfront.md` | Frontend statique sur S3 derrière CloudFront, certificat ACM, invalidation de cache |
| `ecs-fargate.md` | API sans serveur : ECR, task definition, service derrière un ALB, rôles, dépannage |
| `cli.md` | Cheatsheet AWS CLI v2 commentée + décodage des erreurs 403/404/ExpiredToken |
| `budget.md` | Ne jamais être facturé surprise : budgets, alarmes, bons réflexes, checklist de nettoyage |
