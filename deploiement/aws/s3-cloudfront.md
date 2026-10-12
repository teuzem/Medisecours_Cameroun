# S3 + CloudFront — Héberger le frontend statique

---

## Objectif

Publier le **frontend Next.js exporté en fichiers statiques** sur un bucket
**S3**, le protéger (aucun accès public direct), le distribuer dans le monde
entier via **CloudFront** (CDN), le servir en HTTPS sur `{{DOMAINE}}`, et
savoir invalider le cache après chaque déploiement.

**Alternative plus simple, à considérer honnêtement :** pour un projet
Next.js, **Netlify ou Vercel** font tout ça en 5 minutes (build automatique
depuis Git, HTTPS, CDN, preview par branche) — souvent gratuitement pour un
petit site. Cette page existe pour ceux qui veulent tout garder chez AWS, ou
qui ont besoin du contrôle complet. Ne te culpabilise pas si tu choisis
l'alternative : ce n'est pas « tricher », c'est choisir la bonne taille
d'outil.

> **Point projet important** : le `next.config.mjs` du dépôt utilise
> actuellement `output: 'standalone'` (Next tourne comme un **serveur**, il
> est exécuté à chaque requête). Pour S3 + CloudFront, il faut une **exportation
> statique** : remplace cette ligne par `output: 'export'`, puis `npm run build`
> produit un dossier `out/` que S3 stocke comme de simples fichiers. Conséquence
> : l'API doit être accessible directement depuis le navigateur (elle est
> déjà en CORS via `CORS_ALLOW_ORIGIN`, voir `DEPLOYMENT.md`), et les
> fonctionnalités serveur de Next (routes API, SSR) doivent être absentes ou
> remplacées. Si le projet a besoin d'un serveur Next, passe plutôt par
> Netlify/Vercel ou garde la voie A (`ec2.md`).

---

## Table des valeurs à personnaliser

| Placeholder | Ce que c'est | Exemple |
|---|---|---|
| `{{NOM_PROJET}}` | Sert au nom du bucket et du domaine CloudFront | `medisecours` |
| `{{DOMAINE}}` | Domaine servi par CloudFront | `example.org` |
| `{{REGION}}` | Région du **bucket** (pas du certificat !) | `eu-west-1` |
| `{{COMPTE_AWS}}` | Numéro de compte (12 chiffres), pour l'ARN de la distribution | `123456789012` |
| `{{EMAIL_ADMIN}}` | Email de contact du certificat ACM | `toi@exemple.org` |
| `{{ACCESS_KEY_ID}}` / `{{SECRET_ACCESS_KEY}}` | Clés IAM utilisées par `aws` | — |

---

## Prérequis

1. AWS CLI v2 configuré (`cli.md`) avec des droits **S3 + CloudFront + ACM**.
2. Un domaine que tu gères (Route53 ou un registrar externe) — la validation
   de certificat exige d'ajouter un enregistrement DNS.
3. Le frontend buildé localement en `out/` (voir « Point projet » ci-dessus).
4. Avoir compris les notions du glossaire de `README.md` : S3, CloudFront.

---

## Étapes numérotées

### Étape 1 — Créer le bucket S3 (verrouillé)

```bash
# Nom du bucket : il doit être UNIQUE dans TOUT AWS (les buckets sont un espace
# global, comme les noms de domaine). D'où le suffixe projet+domaine.
# Minuscules, sans majuscule ni caractères spéciaux.
BUCKET="{{NOM_PROJET}}-frontend-{{DOMAINE}}"
BUCKET="${BUCKET//./-}"        # les points posent problème avec HTTPS : on les remplace
echo "Bucket : $BUCKET"
# ⚠ La ligne "${BUCKET//./-}" est de la syntaxe bash/zsh. Sous PowerShell,
#   saute-la : écris directement le nom déjà corrigé, ex.
#   $BUCKET="medisecours-frontend-example-org"

# --object-ownership BucketOwnerEnforced : les objets appartiennent au
#   propriétaire du bucket, plus de listes ACL inutiles (sécurité).
# --public-access-block-configuration : LE point critique. On BLOQUE TOUT
#   accès public : politique de bucket refusée, ACL refusées. Le bucket est
#   donc invisible du web… c'est voulu : seul CloudFront, via une signature
#   (OAC, étape 4), pourra lire les fichiers. Un bucket ouvert au monde,
#   c'est du trafic que tu payes, et un risque : n'importe qui pourrait y
#   écrire si les ACL étaient ouvertes.
aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region {{REGION}} \
  --object-ownership BucketOwnerEnforced \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

Sortie attendue (ou `Location` en XML selon la version) : le bucket est créé.
Sous `us-east-1`, pas de `--create-bucket-configuration` ; ailleurs, AWS
l'ajoute automatiquement quand `--region` est passé (sinon ajoute
`--create-bucket-configuration LocationConstraint={{REGION}}`).

Contrôle :

```bash
aws s3api get-public-access-block --bucket "$BUCKET" --query "PublicAccessBlockConfiguration" --output table
# → les 4 valeurs doivent être "true"
```

### Étape 2 — Créer l'origine signée CloudFront (OAC)

```bash
# OAC (Origin Access Control) = "CloudFront possède une clé de signature
# AWS, S3 vérifie cette signature avant de donner le fichier". Résultat :
# le bucket reste verrouillé et pourtant CloudFront y accède.
# EN UN MOT : l'OAC est la version moderne de l'OAI (Origin Access Identity),
# l'ancien mécanisme désormais figé ; l'OAC ajoute le chiffrement SSE-KMS et
# les bucket à réplication. Si un tutoriel ancien parle d'OAI, refais-le en OAC.
OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config \
  "Name={{NOM_PROJET}}-oac,SigningProtocol=sigv4,SigningBehavior=sigv4,Comment=Acces signe S3 pour le frontend" \
  --query "OriginAccessControl.Id" --output text)
echo "OAC : $OAC_ID"     # → XyzAbcDeFgHiJkL (identifiant court)
```

Sortie attendue : un identifiant court (pas un ARN) — c'est celui que la
distribution utilise.

### Étape 3 — Créer la distribution CloudFront

Le fichier de configuration suivant est **du JSON commenté** : les lignes
commençant par `//` servent à t'expliquer chaque champ, mais **le JSON strict
ne les accepte pas** — supprime-les avant de l'enregistrer dans
`distribution.json`.

```jsonc
// distribution.json — configuration d'une distribution CloudFront "simple"
{
  // Référence unique : si tu la changes, AWS crée une NOUVELLE distribution.
  "CallerReference": "{{NOM_PROJET}}-0001",
  "Comment": "Frontend statique {{NOM_PROJET}}",
  "Enabled": true,
  // Fichier servi quand on tape https://{{DOMAINE}}/ (la racine du site).
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "s3-{{NOM_PROJET}}",
        // Nom DNS technique du bucket (celui affiché par AWS dans le bucket).
        "DomainName": "BUCKET.s3.{{REGION}}.amazonaws.com",
        "S3OriginConfig": {
          // L'identifiant OAC de l'étape 2 : sans lui, CloudFront reçoit 403.
          "OriginAccessControlId": "OAC_ID",
          // Vide = on n'utilise PLUS l'ancien OAI. C'est normal.
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3-{{NOM_PROJET}}",
    // HTTP -> HTTPS : le navigateur est redirigé, jamais de clair.
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] },
    // Les fichiers (JS/CSS/HTML) sont compressés avant d'être envoyés :
    // page plus rapide et Go facturés en moins.
    "Compress": true,
    // Politique de cache gérée "CachingOptimized" fournie par AWS :
    // TTL par défaut d'une journée pour les objets. On invalidera le cache
    // à chaque déploiement (étape 8).
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6"
  },
  // PriceClass_100 = Amérique du Nord + Europe uniquement : la
  // combinaison la moins chère, largement suffisante pour un public
  // francophone. PriceClass_200 ajoute l'Asie, PriceClass_All le monde
  // (et augmente la facture).
  "PriceClass": "PriceClass_100",
  "ViewerCertificate": {
    // HTTP par défaut : le certificat CloudFront (*.cloudfront.net) est
    // fourni automatiquement. On branchera {{DOMAINE}} à l'étape 6 avec ACM.
    "CloudFrontDefaultCertificate": true,
    "MinimumProtocolVersion": "TLSv1.2_2021"
  }
}
```

```bash
# Supprime les lignes // puis crée la distribution.
# (OAC_ID et BUCKET viennent des étapes 1 et 2 : remplace-les dans le JSON.)
aws cloudfront create-distribution \
  --distribution-config file://distribution.json \
  --query "Distribution.{Id:Id,Domain:DomainName,Statut:Status}" \
  --output table
```

Sortie attendue :

```
|  E1ABCDEF2GHIJKL  |  d111111abcdef8.cloudfront.net  |  InProgress  |
```

Note ces deux valeurs : l'**Id** (`E…`, ta `distribution-id`) et le
**Domain** (l'URL CloudFront provisoire). Le passage à `Deployed` prend 5 à
15 minutes : `aws cloudfront wait distribution-deployed --id E1ABCDEF2GHIJKL`.

### Étape 4 — Autoriser CloudFront à lire le bucket (politique de bucket)

Sans cette politique, **CloudFront renvoie 403** (le bucket est verrouillé).
C'est la panne n° 1 du fichier, plus bas. Elle doit être posée **après** la
création de la distribution, car elle référence son ARN.

```jsonc
// bucket-policy.json — la seule autorisation d'accès au bucket
{
  "Version": "2012-10-17",
  "Statement": [
    {
      // Nom libre de la règle, visible dans la console pour s'y retrouver.
      "Sid": "CloudFrontLitLeFrontend",
      "Effect": "Allow",
      // "Service" et non un compte : c'est un SERVICE AWS qui se présente,
      // pas un utilisateur. Le service CloudFront est le seul autorisé.
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      // LIRE les fichiers, rien d'autre (pas d'écriture, pas de suppression).
      "Action": "s3:GetObject",
      // Tous les objets du bucket (le /* signifie "tout ce qu'il y a dedans").
      "Resource": "arn:aws:s3:::BUCKET/*",
      "Condition": {
        "StringEquals": {
          // VERROU SUPPLÉMENTAIRE : cette politique ne fonctionne QUE pour
          // MA distribution. Un autre compte qui créerait une distribution
          // pointant ici n'obtiendrait rien. Remplace BUCKET et E1ABCDEF2GHIJKL.
          "AWS:SourceArn": "arn:aws:cloudfront::{{COMPTE_AWS}}:distribution/E1ABCDEF2GHIJKL"
        }
      }
    }
  ]
}
```

```bash
# Supprime les lignes //, remplace BUCKET et l'ID de distribution, puis :
aws s3api put-bucket-policy --bucket "$BUCKET" --policy file://bucket-policy.json

# Contrôle : la politique est bien en place.
aws s3api get-bucket-policy --bucket "$BUCKET" \
  --query "Policy" --output text
```

Sortie attendue : le JSON de la politique (une seule ligne, dense).

### Étape 5 — Mettre les fichiers sur S3

```bash
cd medisecours-frontend

# Build : avec output:'export', Next.js génère des fichiers plats dans out/.
npm run build
# → le dossier out/ est créé (le build annonce "Export successful")

# --delete : aligne S3 sur ton dossier ET supprime sur S3 les fichiers qui n'existent plus
#   localement. C'est ce qui évite les vieux fichiers orphelins… mais si tu
#   lances la commande depuis un dossier presque vide, il vide le site.
#   Toujours vérifier qu'on est bien dans out/ avant.
aws s3 sync ./out "s3://$BUCKET" --delete
```

Sortie attendue : une ligne par fichier transféré, genre
`upload: out/index.html to s3://BUCKET/index.html`, puis `Completed N file(s)`.

```bash
# Vérification directe des fichiers (indépendante de CloudFront) :
aws s3 ls "s3://$BUCKET" --recursive | head
# → des lignes du type 2026-10-07 10:00:00 12345 index.html
```

### Étape 6 — Certificat HTTPS pour {{DOMAINE}} (piège `us-east-1`)

```bash
# ⚠ LE PIÈGE CLASSIQUE : CloudFront n'accepte les certificats ACM QUE dans
# la région us-east-1 (Virginie du Nord), même si ton bucket est en
# eu-west-1. Un certificat créé dans eu-west-1 est REFUSÉ par CloudFront,
# sans message explicite dans la console.
# --validation-method DNS : ACM te donne un enregistrement CNAME à placer
#   dans ton DNS. Une fois posé, le certificat se valide et se RENOUVELLE
#   automatiquement tant que l'enregistrement reste.
aws acm request-certificate \
  --domain-name {{DOMAINE}} \
  --subject-alternative-names "www.{{DOMAINE}}" \
  --validation-method DNS \
  --region us-east-1 \
  --query "CertificateArn" \
  --output text
```

Sortie attendue :
`arn:aws:acm:us-east-1:{{COMPTE_AWS}}:certificate/xxxx-xxxx-xxxx`.

Récupère les enregistrements DNS à poser :

```bash
# (remplace CERT_ARN par la valeur ci-dessus)
aws acm describe-certificate --region us-east-1 --certificate-arn CERT_ARN \
  --query "Certificate.DomainValidationOptions[0].ResourceRecord.{Nom:Name,Valeur:Value}" \
  --output table
```

Pose l'enregistrement **CNAME** chez ton fournisseur de DNS (console Route53 :
enregistrement type CNAME, nom et valeur ci-dessus ; chez un registrar
externe, même chose dans sa zone DNS). Puis attends la validation :

```bash
aws acm wait certificate-validated --region us-east-1 --certificate-arn CERT_ARN
# 5 à 30 minutes (le temps que le DNS se propage). Sans sortie = validé.
```

Attache le certificat à la distribution :

```bash
# CloudFront → Distributions → ta distribution → Edit → Alternate domain
# name (CNAME) : ajoute {{DOMAINE}} (et www.{{DOMAINE}} si tu veux),
# puis Custom SSL certificate : choisis le certificat ACM de us-east-1.
# Astuce : c'est ici qu'un certificat de la mauvaise région n'apparaît pas
# dans la liste → retour à l'étape 6 avec --region us-east-1.
```

### Étape 7 — Réponses d'erreur SPA (404/403 → `index.html`)

Next.js est une **SPA** (Single Page Application) : l'URL
`https://{{DOMAINE}}/consultations/12` n'existe pas comme fichier sur S3, le
routeur client se charge de l'afficher. Sans cette étape, chaque lien
direct donne une page d'erreur.

```bash
# Console : CloudFront → ta distribution → Error pages → Create custom error response
#   - HTTP error code 403 → response page path /index.html → HTTP code 200
#   - HTTP error code 404 → response page path /index.html → HTTP code 200
# Pourquoi les DEUX codes ? Quand un objet est absent et que le bucket est
# verrouillé (notre cas, étape 1), S3 répond 403 "AccessDenied" et non 404 :
# CloudFront ne peut pas faire la différence entre "introuvable" et "interdit".
# Réponse 200 (et non 404) : le routeur client doit pouvoir s'afficher.
```

### Étape 8 — Invalider le cache après chaque déploiement

```bash
# CloudFront garde une copie de chaque fichier dans des centaines de points
# de présence dans le monde, et la politique de cache gérée garde le fichier ~24 h.
# Sans invalidation, tes visiteurs voient l'ANCIEN site (ancien JS, ancien
# CSS) pendant des heures. L'invalidation "oublie" les fichiers concernés.
aws cloudfront create-invalidation \
  --distribution-id E1ABCDEF2GHIJKL \
  --paths "/*"
```

Sortie attendue :

```
{
    "Location": "https://cloudfront.amazonaws.com/...",
    "InvalidationId": "I2J8RK0VXYZ",
    "Status": "InProgress"
}
```

`InProgress` passe à `Completed` en quelques minutes. La commande `/*`
invalide tout le site : les premiers milliers de chemins invalidés par mois
sont gratuits, au-delà c'est payant au chemin (ordre de grandeur, vérifie la
grille https://aws.amazon.com/pricing/). Dans la pratique, on invalide `/*`
uniquement après un vrai déploiement, pas à chaque rafraîchissement.

---

## Vérification

```bash
# 1. Le site répond en HTTPS sur l'URL CloudFront (avant le certif. custom)
curl -I https://d111111abcdef8.cloudfront.net/
# → HTTP/2 200

# 2. Le site répond sur ton domaine (après étapes 6 et 7)
curl -I https://{{DOMAINE}}/
# → HTTP/2 200

# 3. Redirection HTTPS effective (http doit renvoyer en https)
curl -I http://{{DOMAINE}}/
# → HTTP/1.1 301/302 ... location: https://{{DOMAINE}}/

# 4. Un deep link SPA fonctionne (erreur 403/404 réécrite en index.html)
curl -I https://{{DOMAINE}}/quelque/chose
# → HTTP/2 200

# 5. Le bucket reste bien verrouillé depuis l'extérieur
curl -I "https://$BUCKET.s3.{{REGION}}.amazonaws.com/index.html"
# → HTTP 403 (c'est le BON résultat : le public ne doit pas y accéder)
```

---

## Dépannage (3 pannes probables)

**1. `403 Forbidden` sur l'URL CloudFront (page XML AWS vide ou "AccessDenied")**

*Cause* : CloudFront demande le fichier, S3 refuse. Deux coupables possibles,
dans cet ordre :

```bash
# a) La politique de bucket manque ou référence la MAUVAISE distribution.
aws s3api get-bucket-policy --bucket "$BUCKET" --query "Policy" --output text
# → "AWS:SourceArn" doit finir par l'ID ACTUEL de ta distribution (E…).
#   Recrée la politique (étape 4) avec le bon ID.

# b) L'OAC n'est pas rattaché à l'origine (étape 3 oubliée ou mal remplie).
aws cloudfront get-distribution-config --id E1ABCDEF2GHIJKL \
  --query "DistributionConfig.Origins.Items[0].S3OriginConfig" --output table
# → OriginAccessControlId doit contenir ton OAC_ID (étape 2). Sinon :
#   console CloudFront → Edit → Origins → S3 origin → Origin access control
#   → sélectionner l'OAC → Save → attendre le déploiement.

# c) Vérification ultime : le fichier existe-t-il au moins ?
aws s3 ls "s3://$BUCKET" --recursive | grep index.html
# → rien = retour à l'étape 5 (aws s3 sync)
```

**2. Page blanche / `404 NoSuchKey` sur les liens internes, mais la racine marche**

*Cause* : les réponses d'erreur SPA (étape 7) ne sont pas posées, ou
`index.html` n'est pas le fichier racine.

```bash
# a) index.html est-il bien à la racine du bucket ?
aws s3 ls "s3://$BUCKET" | grep index.html
# → doit afficher "index.html" (et non "out/index.html" : si c'est le cas,
#   tu as lancé le sync depuis le mauvais dossier : aws s3 sync ./out ...)

# b) Réponses d'erreur : console CloudFront → Error pages doit afficher
#    DEUX lignes (403 et 404) pointant vers /index.html avec code 200.

# c) Default root object : Edit → Settings → Default root object = index.html
```

**3. Le site affiche encore l'ANCIEN contenu après un déploiement**

*Cause* : le cache CloudFront (jusqu'à ~24 h) n'a pas été invalidé.

```bash
aws cloudfront create-invalidation --distribution-id E1ABCDEF2GHIJKL --paths "/*"
# → Status: InProgress, puis Completed en quelques minutes.

# Contrôle de ce que CloudFront sert réellement (bypass du cache navigateur) :
curl -s -H "Cache-Control: no-cache" https://{{DOMAINE}}/ | head -c 200
```

Si l'invalidation ne change rien, vérifie que le fichier a bien été
*uploadé* (étape 5) : invalider un cache qui contient la bonne copie
ancienne ne sert à rien si S3 contient lui aussi l'ancienne version.

---

## Coût

| Ressource | Facturation | Ordre de grandeur / mois |
|---|---|---|
| S3 — stockage frontend (quelques Mo) | Au Go stocké, facturé par fraction de Go | ≪ 1 $ |
| S3 — requêtes (uploads/lectures) | Au millier de requêtes | ≪ 1 $ |
| CloudFront — transfert sortant | Les premiers Go/mois sont gratuits (Free Tier ~12 mois), puis facturés au Go transféré, avec une décote au-delà d'un certain volume | ~0 à quelques dollars selon le trafic |
| CloudFront — requêtes HTTPS | Au millier (souvent inclus dans le quota gratuit) | ~0 à 1 $ |
| Certificat ACM | **Gratuit**, y compris le renouvellement automatique | 0 $ |
| Invalidations | Un certain nombre de chemins gratuits par mois (de l'ordre du millier), puis au chemin | 0 $ dans l'usage normal |
| Route53 (si tu gères le DNS chez AWS) | Zone DNS + requêtes : ~0,50 $/zone/mois + quelques centimes par million de requêtes | ~1 $ |

Le gros avantage économique : **aucun coût fixe**. Un site à zéro visiteur
coûte presque rien (quelques cents de stockage), alors qu'une instance EC2 ou
un ALB tourne et se facture quand même. C'est le service le plus « à la
carte » d'AWS.

Vérifie la grille officielle : https://aws.amazon.com/pricing/
Free Tier : https://aws.amazon.com/free/
Documentation S3 : https://docs.aws.amazon.com/
Documentation CloudFront : https://docs.aws.amazon.com/
Console : https://aws.amazon.com/console/
