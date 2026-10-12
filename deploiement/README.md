# Dossier `deploiement/`: Bibliothèque de templates prêts à l'emploi

> **Ce dossier ne fait partie d'aucune application.** C'est une bibliothèque de
> fichiers à **copier** dans n'importe quel projet (Python, PHP, Java, Node…)
> pour passer en production, sans ouvrir de documentation en ligne ni demander
> à une IA. Tout est commenté en français, fichier par fichier, ligne par ligne.

---

## 1. Ce que contient ce dossier

```
deploiement/
├── README.md                     ← tu es ici (sommaire + mode d'emploi)
├── frontend/                     ← app SANS backend (React / Next / Vite…)
│   ├── README.md                 ← quel hébergeur choisir ?
│   ├── coolify/                  ← VPS Contabo + Coolify (PaaS auto-hébergé)
│   │   ├── 01-preparer-le-vps.sh         (sécuriser la machine)
│   │   ├── 02-installer-coolify.sh       (installer Coolify)
│   │   ├── 03-creer-projet-coolify.md    (projet + GitHub + domaine + HTTPS)
│   │   ├── 04-verifier-et-depanner.md
│   │   ├── Dockerfile + .dockerignore    (à copier à la racine du projet)
│   │   └── README.md
│   ├── hostinger/                ← hébergement mutualisé (Apache)
│   │   ├── README.md             (procédure hPanel pas-à-pas)
│   │   └── .htaccess             (à déposer dans public/ avant le build)
│   ├── netlify/                  ← netlify.toml, _redirects, _headers + README
│   ├── vercel/                   ← README (déploiement Git, régions, rollbacks)
│   └── variables-a-definir.example.txt
│
├── fullstack/                    ← app AVEC backend + base de données + WebSockets
│   ├── README.md                 ← architecture de référence (schéma annoté)
│   ├── docker/                   ← docker-compose.yml + .env.example
│   │                                 + Dockerfile.frontend / -backend-{php,python,java,node}
│   ├── nginx/                    ← site.conf (reverse proxy + /api + /ws + HTTPS)
│   ├── vps/                      ← LA procédure root+IP étape par étape :
│   │                                 01-sécuriser → 02-Docker → 03-certbot →
│   │                                 04-lancer le compose
│   └── langages/                 ← python.md, php.md, java.md, websockets.md
│
├── aws/                          ← toute la voie AWS commentée pour novice
│   ├── README.md (glossaire + quel service pour quoi)
│   ├── ec2.md  rds.md  s3-cloudfront.md  ecs-fargate.md
│   ├── cli.md (cheatsheet)       budget.md (ne jamais être facturé surprise)
│
└── exemples/medisecours/         ← EXEMPLE CONCRET : ce dépôt analysé
    ├── README.md                 (topologie réelle, ports, pièges)
    ├── env.frontend.example
    ├── env.backend.example
    └── checklist-recette.md      (17 points à vérifier après la mise en ligne)
```

---

## 2. Mode d'emploi (comment l'utiliser pour TON projet)

1. **Choisis ta voie** dans le tableau ci-dessous.
2. **Copie** le sous-dossier correspondant à la racine de ton projet
   (ou dans un dossier `ops/`, comme tu veux — ces fichiers n'ont aucun
   impact sur le code applicatif).
3. **Remplace les placeholders** : chaque README contient une section
   « Table des valeurs à personnaliser ». La convention est :

   | Placeholder | Signification | Exemple |
   |---|---|---|
   | `{{NOM_PROJET}}` | nom du projet/app | `medisecours` |
   | `{{DOMAINE}}` | domaine public principal | `app.exemple.com` |
   | `{{DOMAINE_API}}` | sous-domaine de l'API | `api.app.exemple.com` |
   | `{{DOMAINE_WS}}` | sous-domaine des WebSockets | `ws.app.exemple.com` |
   | `{{IP_SERVEUR}}` | adresse IP du VPS | `203.0.113.10` |
   | `{{EMAIL_ADMIN}}` | e-mail pour les certificats SSL | `moi@exemple.com` |
   | `{{PORT_FRONTEND}}` / `{{PORT_BACKEND}}` / `{{PORT_WS}}` / `{{PORT_DB}}` | ports internes | 3000 / 8000 / 8081 / 5432 |
   | `{{MOT_DE_PASSE_DB}}` | mot de passe base de données | généré avec `openssl rand -hex 24` |

   **Astuce** : dans les fichiers `.conf`, `.yml` et `.sh`, la plupart des
   placeholders sont écrits littéralement `{{...}}` → un simple
   « rechercher/ remplacer » dans ton éditeur de texte suffit (dans VS Code :
   `Ctrl+Maj+H` → *Remplacer dans tous les fichiers*).
4. **Lis l'étape « Vérification »** du README avant de déclarer « c'est en ligne ».
5. **Lis l'étape « Dépannage »** : elle contient les 3 pannes les plus fréquentes.

### Tableau de choix

| Ton projet… | Ouvre… | Difficulté | Coût estimé |
|---|---|---|---|
| Front uniquement (SPA statique) | `frontend/netlify/` (le plus simple) | ★☆☆ | gratuit → $19/mois |
| Front uniquement, tu veux VPS à toi | `frontend/coolify/` | ★★☆ | ~5–12 €/mois (Contabo) |
| Front uniquement chez l'hébergeur classique | `frontend/hostinger/` | ★☆☆ | selon ta formule mutualisée |
| Front + API + base + WebSockets (le cas courant) | `fullstack/` (README → `vps/` puis `docker/` + `nginx/`) | ★★☆ | un VPS ~5–15 €/mois |
| Sans toucher à un serveur, sur AWS | `aws/README.md` (voie « EC2 » = comme un VPS, ou voie « managée ») | ★★★ | variable, voir `aws/budget.md` |

---

## 3. Les 5 pièges qui cassent 90 % des mises en prod

1. **Variables injectées à la CONSTRUCTION.** Dans une app Next/Vite, tout ce
   qui commence par `NEXT_PUBLIC_` (ou `VITE_`) est **écrit dans le code
   pendant le build**. Modifier le `.env` sur le serveur après le build ne
   change **rien** : il faut rebuilder. D'où l'usage de `ARG` dans les
   Dockerfiles.
2. **`output: 'standalone'`** : Next génère un dossier autonome exécuté par
   `node server.js`. Il faut copier `.next/standalone` + `.next/static` +
   `public` — copier uniquement `.next/` donne un site blanc.
3. **Mixed content** : une page en `https://` qui appelle une API en `http://`
   est bloquée par le navigateur. Solution ici : le reverse proxy (`/api/`
   → même domaine), jamais une URL `http://` côté navigateur.
4. **Le rewrite `/api` se lit AU BUILD** : si `API_BASE_URL` est absent ou
   faux au moment du build, chaque appel `/api/...` renvoie 404.
5. **URL de WebSocket absolue** : sans `wss://...` fourni au build, le client
   retombe sur `ws://127.0.0.1` (fonctionne en local, mort en prod, et le
   temps réel « disparaît » **silencieusement**).

Ces 5 pièges sont détaillés (avec les messages d'erreur exacts) dans
`frontend/README.md` et `exemples/medisecours/README.md`.

---

## 4. Règle de sécurité absolue

- **Ne supprime et ne modifie jamais de code applicatif pour coller à un
  template.** Si un template exige quelque chose d'incompatible avec ton app,
  c'est le template qui s'adapte (les README indiquent toujours les variantes).
- **Jamais de secret réel dans un fichier versionné** : les `.env.example`
  ne contiennent que des exemples ; le vrai `.env` reste ignoré par git.
- **La base de données n'est exposée sur aucun port public** (bind
  `127.0.0.1` ou security group restreint) — voir `fullstack/docker/README.md`.

---

## 5. Où sont les docs spécifiques à CE dépôt

Ce projet possède déjà sa propre documentation de déploiement, à lire en
complément (elle décrit l'existant, pas des templates) :

- `DEPLOYMENT.md` (racine du dépôt) — topologie réelle, secrets, DNS.
- `docker-compose.prod.yml`, `render.yaml`, `.github/workflows/deploy-coolify.yml`
  — fichiers de production déjà présents dans ce dépôt.
- `exemples/medisecours/` (dans ce dossier) — la synthèse de l'analyse de ce
  dépôt : ports, variables de build, pièges connus, checklist de recette.

---

## 6. Checklist express avant toute mise en production

1. [ ] HTTPS répond (padlock) sur **tous** les domaines (app, api, ws si séparés).
2. [ ] `https://.../api/health` (ou équivalent) renvoie 200 depuis le navigateur.
3. [ ] Connexion utilisateur + action critique testées (pas seulement la home).
4. [ ] Le site **fonctionne avec un cache à froid** (Ctrl+Maj+R) et en navigation privée.
5. [ ] Les variables de build datent du dernier build (rebuild après changement).
6. [ ] Aucun secret dans le dépôt : `git log -p | grep -i password` est vide.
7. [ ] La base a un backup **automatique** testé à la restauration.
8. [ ] Un compte de surveillance teste la page (cf. `.github/workflows/keepalive.yml`
   de ce dépôt, ou `aws/budget.md` / uptime externe).
9. [ ] Tu sais redémarrer chaque service en 1 commande (documentée dans le README
   du dossier utilisé).
10. [ ] Le budget/facture est surveillé (`aws/budget.md` si AWS).
