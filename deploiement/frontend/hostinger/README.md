# Déploiement sur Hostinger (hébergement mutualisé) — limites réelles et procédure

**Sous-dossier :** `hostinger/`
**Durée estimée :** 30 minutes.

---

## Objectif

Mettre le frontend `{{NOM_PROJET}}` en ligne chez **Hostinger**, en partant du principe honnête
suivant : **un hébergement mutualisé ne fait pas tourner Node.js en permanence.** Ce fichier
t'explique **exactement** ce qui est possible, ce qui ne l'est pas, et comment faire dans les deux cas.

---

## Prérequis

- Un hébergement **Hostinger** (offre *Premium* ou *Business* avec domaine inclus) + accès à **hPanel**.
- Un compte GitHub avec le code du frontend.
- Un navigateur (hPanel est 100 % graphique : **aucune ligne de commande** n'est nécessaire ici).
- Comprendre les **5 pièges** du fichier [`README.md`](../README.md) (surtout le n°1 : les variables
  `NEXT_PUBLIC_*` sont injectées **au build**).

---

## La limite honnête, à lire AVANT de commencer

L'hébergement mutualisé Hostinger tourne sur **Apache + LiteSpeed + PHP**. Concrètement :

| Ce que le mutualisé SAIT faire | Ce qu'il ne SAIT PAS faire |
|---|---|
| Servir des **fichiers statiques** (HTML, JS, CSS, images) très vite (LiteSpeed + cache) | Faire tourner un **process Node.js longue durée** (`node server.js`, `next start`) |
| Rediriger les URLs (`.htaccess`), forcer HTTPS, forcer la compression | Écouter en permanence sur un port 3000 ou 8081 |
| Exécuter du **PHP** (si ton backend est PHP) avec PostgreSQL | Faire du **rendu serveur Next.js** à chaque requête |
| Cron jobs, bases de données, SSL Let's Encrypt inclus | Héberger ton **service WebSockets** (port 8081) — il lui faut un process Node vivant |

**D'où deux cas. Choisis le tien avant d'aller plus loin.**

### Cas n°1 — App **statique** (pas de rendu serveur) → c'est possible, et c'est rapide

On exporte Next.js en fichiers statiques : `next build` génère un dossier `out/` contenant du
HTML/CSS/JS pur. Apache le sert directement, **aucun Node ne tourne**.

**Ce que ça implique concrètement :**

- ✅ Site très rapide (cache LiteSpeed), HTTPS inclus, aucun process à superviser.
- ❌ **Plus de rendu serveur (SSR)** : les pages sont pré-générées au build.
- ❌ **Plus de WebSockets côté serveur** : le service 8081 tourne sur un process Node →
  il faut soit le mettre sur un VPS, soit accepter de perdre le temps réel.
  *Dans ce cas, il faut que le frontend ait un repli gracieux : vérifie que le code tolère
  l'absence de WS (le fallback `ws://127.0.0.1:8081/ws` échouera silencieusement, ce qui est
  exactement ce qu'on veut en mode statique — mais tu n'auras **aucun** temps réel).*
- ❌ Le **rewrite `/api/:path*`** (piège 4) **n'existe pas** sur du statique : c'est `next build`
  qui le crée, et il ne s'applique qu'à un serveur Next. → soit le frontend appelle
  `https://{{DOMAINE_API}}` directement (variable `NEXT_PUBLIC_API_BASE_URL` **remplie** ici,
  c'est l'un des rares cas où on la remplit), soit tu poses un proxy côté Apache (voir le
  `.htaccess` fourni, règle proxy commentée).

**Activation de l'export statique** — dans `next.config.mjs` **de ton projet** :

```javascript
// next.config.mjs — le projet utilise output: 'standalone' pour Docker/Coolify.
// Pour Hostinger (mutualisé), on passe en 'export' : Next génère un dossier
// out/ de fichiers statiques, qu'on dépose tel quel dans public_html/.
const nextConfig = {
  output: 'export',   // <-- remplace 'standalone'
  // ... le reste de ta config (images: { unoptimized: true } est souvent requis
  // car l'optimisation d'images a besoin d'un serveur)
};

export default nextConfig;
```

> ⚠️ **Piège :** `output: 'standalone'` et `output: 'export'` sont **incompatibles**. Tu ne peux
> pas avoir les deux. Si tu restes sur `standalone`, **tu es dans le cas n°2** (il te faut un VPS).
> Ce changement se fait dans le dépôt, se commit, et **il faut rebuilder** après (piège 1).
>
> `output: 'export'` refuse aussi les routes dynamiques (`app/api/*`, `generateStaticParams` absent)
> : si le build affiche `Page "/api/xxx" is missing "generateStaticParams()"`, c'est que ton app a
> encore des parties serveur → **cas n°2**.

### Cas n°2 — App avec **SSR / API / WebSockets** → le mutualisé ne suffit pas

Deux solutions réalistes, pas de troisième :

1. **VPS Hostinger** (rubrique *VPS* dans hPanel) : Ubuntu 24.04 + Docker + Coolify →
   **suit [`../coolify/README.md`](../coolify/README.md)**, la procédure est la même que pour
   Contabo (seul l'IP change : `{{IP_SERVEUR}}` vient de hPanel → *VPS → Détails*).
   Compte ~10 €/mois.
2. **Externaliser l'API** : le frontend en statique (cas n°1) et le backend sur un hébergement
   qui accepte PHP/Node → mais alors les WebSockets restent le point dur (il faut quand même
   quelque part un process Node qui tourne).

> 📌 **Ce qui est garanti chez Hostinger en mutualisé :** le cas n°1, avec la procédure complète
> ci-dessous. Tout ce qui suit suppose donc que tu as activé `output: 'export'` (ou que ton
> projet sert déjà des fichiers statiques).

---

## Étapes — procédure hPanel pas-à-pas

### 1. Construire la version statique (sur ton ordinateur)

```bash
# à la racine du dépôt frontend
npm ci
npm run build
```
**Sortie attendue :** un dossier **`out/`** qui apparaît, contenant `index.html` et les dossiers
`_next/`, `favicon.ico`, etc.

> Si le build échoue avec `out/` non généré → reprends [`../README.md`](../README.md), section
> Piège 1 (variable manquante) et dépannage.

> 💡 Si tu préfères ne **jamais** builder en local : utilise le cas n°2 (Netlify/Vercel/build sur
> VPS). Le build local est le seul point où un développeur doit avoir Node installé.

### 2. Ouvrir le Gestionnaire de fichiers

1. Connecte-toi à **hPanel** → rubrique **Sites web** → ton domaine → **Gestionnaire de fichiers**.
   (Ou bouton **Fichiers → Gestionnaire de fichiers** directement.)
2. Tu arrives sur l'arborescence du serveur. La racine publique du site est :

```
public_html/
```
**C'est DANS ce dossier que tout doit se trouver.** Si tu vois un `index.html` par défaut ou un
dossier `default`, supprime/vides-le d'abord (sinon ta page ne s'affichera jamais).

### 3. Déposer le build dans `public_html/`

**Méthode A — upload par l'interface :**
1. Dans `public_html/` → bouton **Téléverser** (icône d'up-arrow) → **Dossier** → sélectionne
   le dossier **`out/`** de ton ordinateur.
2. Une fois `public_html/out/` téléversé, **sélectionne tout son contenu**
   (Ctrl+A dans le panneau) → **Déplacer** → déplace-les **un cran vers le haut**, c'est-à-dire
   directement dans `public_html/`.
3. Supprime le dossier vide `out/`.

**Résultat attendu :**
```
public_html/
├── index.html          ← ta page d'accueil
├── _next/              ← JS, CSS, chunks (obligatoire : sans lui, page blanche)
├── favicon.ico
├── .htaccess           ← celui fourni plus bas (étape 4)
└── ...tes autres fichiers statiques
```

**Méthode B — déploiement par Git** (si tu as activé *Git* dans hPanel → rubrique *Git*) :
clones le dépôt dans `public_html`, puis dans hPanel → *Git → Open terminal* → `npm ci && npm run build`
— **attention**, cette méthode n'existe **pas** sur tous les plans Hostinger : si le terminal
n'est pas là, utilise la méthode A.

**Le `.htaccess` : où le placer exactement ?** Deux emplacements **valides**, et il faut en choisir un :

| Emplacement | Quand |
|---|---|
| **Dans `public/` du projet, AVANT le build** | ✅ **Recommandé.** Next.js (comme Vite) **copie le dossier `public/` à la racine du dossier de build** : ton `.htaccess` atterrit donc automatiquement dans `out/` → dans `public_html/` à chaque build. Tu ne l'oublies jamais. |
| **Directement à la racine du site (`public_html/.htaccess`)** | ✅ Valable si tu veux l'éditer sur le serveur sans rebuilder. **Inconvénient :** le prochain build/transferer peut l'écraser. |

➡️ **Copie donc `hostinger/.htaccess` dans `ton-projet/public/.htaccess`** (créant le dossier
`public/` s'il n'existe pas), puis refais `npm run build` et redépose `out/`.

### 4. Poser le fichier `.htaccess`

Ouvre [`./.htaccess`](./.htaccess), copie **tout son contenu**, et :
1. **Remplace `{{DOMAINE}}`** par ton domaine (le fichier n'est **pas** interpolé automatiquement) ;
2. Colle-le dans `public_html/` (nouveau fichier → nom `.htaccess`) **et** dans `public/` du projet
   (voir le tableau ci-dessus) ;
3. **Relis-le** ligne à ligne : une seule accolade mal placée → **500 Internal Server Error**.

> 💡 Si le gestionnaire de fichiers **refuse** de créer un fichier dont le nom commence par un
> point (c'est le cas de certains navigateurs), utilise l'upload : renomme-le `htaccess.txt` chez
> toi, téléverse-le, puis **Renommer** → `.htaccess` sur le serveur.

### 5. Activer le SSL (HTTPS) — Let's Encrypt, gratuit

1. hPanel → **Sites web** → ton domaine → **SSL** (ou **Sécurité → SSL**).
2. Coche le domaine (et `www.` si tu l'utilises) → **Installer Let's Encrypt** → attends ~2 min.
3. **Important :** coche aussi **Forcer la redirection HTTPS** (ou laisse le faire le `.htaccess`,
   qui le gère déjà — les deux ne se gênent pas).

**Ce que ça fait concrètement :** Hostinger demande à Let's Encrypt un certificat pour
`{{DOMAINE}}`, prouve qu'il contrôle le domaine via le port 80, stocke le certificat, puis
**le renouvelle automatiquement ~30 jours avant expiration**. Tu n'y reviendras jamais.

**Sortie attendue :** la pastille SSL passe à **Vert / Actif**, et `https://{{DOMAINE}}` affiche le padlock.

### 6. Configurer le domaine

1. hPanel → **Domains** → si le domaine est **déjà** chez Hostinger : il pointe déjà sur
   `public_html/` → rien à faire.
2. Domaine **extérieur** : rubrique **Pointeurs (Pointerurs/Name Servers)** → tu as le choix :
   - **Soit** tu changes les *name servers* de ton registrar pour ceux d'Hostinger
     (`ns1.dns-parking.com` / `ns2.dns-parking.com`) → tout géré par Hostinger, mais **tout**
     le domaine (y compris le backend) bascule ;
   - **soit** tu gardes tes NS et tu ajoutes un enregistrement **A** :
     ```
     Type : A   Nom : @   Valeur : {{IP_SERVEUR}}   TTL : auto
     Type : A   Nom : www  Valeur : {{IP_SERVEUR}}   TTL : auto
     ```
     `{{IP_SERVEUR}}` = l'IP de ton hébergement mutualisé → hPanel → **Sites web → Détails**
     (champ *Adresse IP du serveur*).

**Sortie attendue (après propagation, 5 min à 24 h) :**
```bash
nslookup {{DOMAINE}}
# → Address: {{IP_SERVEUR}}
```

### 7. Vider le cache LiteSpeed

LiteSpeed met en cache les pages **avant** que ton .htaccess ne soit parfois pris en compte, et
garde d'anciens fichiers après un upload.

1. hPanel → **Cache** → bouton **Vider le cache** (*Clear Cache*).
2. Et **Ctrl+Maj+R** dans le navigateur (rechargement sans cache) quand tu testes.

**Quand le faire :** **à chaque** dépôt d'une nouvelle version du site. Sans ça, tu regarderas
ton ancien site pendant 10 minutes en croyant que ton build n'a pas marché.

### 8. Versions PHP et extensions (uniquement si ton BACKEND est PHP)

Si `medisecours-backend` est un projet **Symfony/PHP** partageant le même hébergement :

1. hPanel → **PHP Configuration** (rubrique *Avancé → PHP Configuration*).
2. **Version PHP : 8.3** ou supérieure.
   *Pourquoi :* PHP 8.2 arrive en fin de vie, 8.3 est la version que Symfony exige actuellement ;
   une version trop vieille = messages d'erreur ou build impossible.
3. **Extensions :** coche **`pdo_pgsql`** (et `pgsql` si proposé).
   *Pourquoi :* c'est l'extension qui permet à PHP de parler à **PostgreSQL**. Sans elle, Symfony
   affiche `could not find driver` à chaque tentative de connexion à la base → le site tombe en 500.
   À cocher aussi si dispo : `curl`, `mbstring`, `intl`, `zip`, `opcache` (tous nécessaires à Symfony).
4. **Valider**, puis **vider le cache LiteSpeed** (étape 7).

### 9. Cron jobs (si besoin — générateur statique, relances, sauvegardes)

hPanel → **Cron Jobs** (rubrique *Avancé*) :

| Exemple | Commande | Fréquence |
|---|---|---|
| Re-générer un export statique toutes les nuits | `cd /home/<user>/public_html && /usr/bin/php bin/console ...` | `0 3 * * *` (3 h du matin) |
| Purger le cache | `cd /home/<user>/public_html && /usr/bin/php bin/console cache:clear --no-interaction` | `0 4 * * *` |

*Format des 5 champs : `minute heure jour-du-mois mois jour-de-semaine`.*
**Pourquoi la nuit :** un cron qui tourne pendant un pic de trafic peut ralentir le site. La nuit,
personne ne le sent.

> ⚠️ **Les cron jobs ne servent PAS à « garder Node vivant » sur un mutualisé.** Un `node server.js`
> lancé par cron sera **tué par Hostinger** (les process non-PHP ne sont pas autorisés à vivre).
> C'est la limite du cas n°2, pas un détail.

---

## Table des valeurs à personnaliser

| Placeholder | Exemple | Où trouver la valeur |
|---|---|---|
| `{{DOMAINE}}` | `exemple.fr` | hPanel → **Domains** → ton domaine. **À remplacer dans `.htaccess` à la main** (fichier lu par Apache, aucun moteur de template) |
| `{{DOMAINE_API}}` | `api.exemple.fr` | Domaine du backend. À utiliser si tu actives la règle proxy `/api/*` commentée dans le `.htaccess` |
| `{{DOMAINE_WS}}` | `ws.exemple.fr` | Domaine du service WebSocket — **non utilisable en mutualisé** (pas de process Node), sauf s'il tourne ailleurs |
| `{{IP_SERVEUR}}` | `203.0.113.100` | hPanel → **Sites web → Détails → Adresse IP du serveur**. Sert pour l'enregistrement A si tu gardes tes propres name servers |
| `{{EMAIL_ADMIN}}` | `admin@exemple.fr` | Sert au contact Let's Encrypt (renseigné dans le compte Hostinger) |
| `{{NOM_PROJET}}` / `{{PORT}}` | `medisecours` / `3000` | Nom du projet / port Node — **sans usage sur le mutualisé** (3000 n'est pas ouvrable ici) |

---

## Vérification

```bash
# 1. Le site répond-il en HTTPS ?
curl -I https://{{DOMAINE}}
# → HTTP/2 200 (ou HTTP/1.1 200)   ✅
# → 403 Forbidden                   → .htaccess ou index.html absent/mal placé
# → 500 Internal Server Error       → faute de syntaxe dans .htaccess
# → 301                             → redirection H→S en place, refaire en http://

# 2. Les fichiers sont-ils bien à la RACINE et pas dans un sous-dossier out/ ?
curl -I https://{{DOMAINE}}/index.html
# → 200   ✅   |   404 → tu as déposé le dossier "out/" entier au lieu de son contenu

# 3. Le JS/CSS charge-t-il ? (sinon : page blanche)
curl -I https://{{DOMAINE}}/_next/static/
# → 200 ou 301 (dossier)   |   404 → dossier _next non copié
```

Dans le navigateur :
1. `https://{{DOMAINE}}` → **padlock** vert (si `Not Secure` → étape 5 SSL, puis Ctrl+Maj+R).
2. F12 → **Console** → pas d'erreur 404 sur `/_next/static/...`.
3. **Réseau** → le `document` est en **200** et le CSS en **200** (pas `from cache` d'une vieille version).

---

## Dépannage

### Erreur 1 — `Permission denied` (upload refusé / fichier non déplaçable)

**Cause :** les permissions des fichiers sur le mutualisé sont parfois en lecture seule pour ton
compte, ou l'interface refuse de toucher à un dossier protégé.

**Fix :**
1. hPanel → Gestionnaire de fichiers → clic droit sur `public_html` (ou le fichier) →
   **Permissions** → mets **755** pour les **dossiers** et **644** pour les **fichiers**.
2. Si c'est un refus « Cannot delete », c'est qu'un fichier est **en cours d'utilisation** ou
   que tu es dans le mauvais dossier : vérifie que tu es bien dans `public_html/` et pas
   `public_html/public_html`.
3. En dernier recours : hPanel → **Fichiers → Gestionnaire de fichiers → tout sélectionner →
   Supprimer**, puis **re-téléverse** `out/` (procède proprement, sans `.env`).

> Règle à ne jamais enfreindre : sur un mutualisé, **`.htaccess` en 644, dossiers en 755**.
> Un `.htaccess` en 777 peut déclencher une **500** (Apache refuse les fichiers trop ouverts).

### Erreur 2 — Port déjà utilisé / `Address already in use`

**Cause :** **ce cas n'existe pas en mutualisé** — et c'est justement le problème : Hostinger
**n'autorise aucun process à écouter** sur 3000 ou 8081. Si tu tentes `node server.js` via un
cron ou un terminal, il échouera (souvent en `EACCES` ou il sera tué dans la foulée).

**Ce que ce message signifie donc ici :** tu es dans le **cas n°2** (app avec SSR/WebSockets) sur
un hébergement **cas n°1**. Les deux solutions, sans exception :
1. **Passer en `output: 'export'`** (voir Cas n°1) et accepter de perdre SSR + WS ;
2. **Prendre un VPS** → [`../coolify/README.md`](../coolify/README.md) (Hostinger vend aussi des
   VPS : hPanel → *VPS* → Ubuntu 24.04 → même procédure).

**Sur un vrai VPS**, la résolution est :
```bash
sudo ss -lntp | grep -E ':(3000|8081)'
# → colonne PID, puis : sudo kill <PID>
```

### Erreur 3 — DNS non propagé (`Site not found` / `This site can't be reached`)

**Cause :** l'enregistrement A ou le changement de name servers vient d'être fait (5 min à 24 h).

**Fix :**
```bash
# depuis ton ordinateur
nslookup {{DOMAINE}}
# attendu : {{IP_SERVEUR}} (celle de hPanel → Sites web → Détails)

# vérifier le SOI (avec quelles NS le domaine répond)
nslookup -type=NS {{DOMAINE}}
```
- Si les NS affichent encore **tes anciens serveurs** (OVH, Gandi…) → tu n'as pas sauvegardé le
  changement, ou le registrar met du temps : attends.
- Si les NS sont celles d'Hostinger (`dns-parking.com`) mais que l'IP est fausse → attends la
  propagation.
- **SSL refusé pendant cette période** (Let's Encrypt ne peut pas prouver qu'il contrôle le
  domaine) : **refais l'étape 5 une fois le DNS bon**.

### Les autres cas fréquents

| Symptôme | Cause | Correction |
|---|---|---|
| Page blanche, aucun style | Dossier `_next/` absent de `public_html/` | Re-dépose le **contenu** de `out/`, pas le dossier `out/` lui-même |
| `404` sur `/` mais `/index.html` marche | Le `.htaccess` (fallback) n'est pas chargé | Vérifie qu'il est bien à `public_html/.htaccess`, en **644**, et vide le cache LiteSpeed |
| `500 Internal Server Error` | Faute de syntaxe dans `.htaccess` (accolade, HTTPS mal écrit) | Re-copie le fichier fourni **en entier**, en remplaçant **uniquement** `{{DOMAINE}}` |
| Le site affiche encore l'ancienne version | Cache LiteSpeed | hPanel → **Cache → Vider le cache** + Ctrl+Maj+R |
| Variables d'env « non prises » | Piège 1 : elles sont au **build** | **Rebuild** localement (`npm run build`) puis **re-téléverse** `out/` |
| Erreur `could not find driver` (backend PHP) | Extension PostgreSQL absente | Étape 8 → coche **`pdo_pgsql`**, PHP 8.3+ |
