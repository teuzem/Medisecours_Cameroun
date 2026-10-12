# langages/websockets.md — le guide temps réel (chat, notifications, live)

## Objectif

Mettre en place une connexion **WebSocket** (temps réel, bidirectionnel) derrière
nginx, en partant de zéro : pourquoi c'est particulier, comment le tester, comment
ne pas se faire attaquer, et comment faire évoluer le service.

Ce guide est **valable quel que soit ton langage** : la partie nginx est la même,
seule l'implémentation applicative change (cf. les 3 solutions en fin de fichier).

## Prérequis

- `../nginx/site.conf` compris (bloc `location /ws`) — c'est 90 % du travail.
- `../docker/README.md` lu (profil `ws`, profil `redis`).
- Les commandes `docker compose` de ce guide s'exécutent **depuis `docker/`**
  (où se trouve `.env`), sinon ajoute `-f docker/docker-compose.yml`.
- Un backend déjà déployé (étapes 1 à 6 de `../vps/README.md`).

## Comprendre pourquoi c'est différent d'une requête HTTP

### Le schéma complet, une seule fois

```text
Navigateur                                  nginx (hôte)              conteneur ws
    │                                            │                         │
    │ 1. GET /chat  (page HTML normale)          │                         │
    │───────────────────────────────────────────►│── proxy_pass ──────────►│
    │ 2. GET /ws  + en-têtes :                   │                         │
    │      Connection: Upgrade                   │                         │
    │      Upgrade: websocket                    │                         │
    │───────────────────────────────────────────►│── (doit RECOPIER ces    │
    │                                            │    2 en-têtes tels      │
    │                                            │    quels, sinon ───────►│
    │ 3. HTTP/1.1 101 Switching Protocols        │    la négociation casse)│
    │◄───────────────────────────────────────────│◄────────────────────────│
    │                                            │                         │
    │ 4. CANAL BIDIRECTIONNEL OUVERT (des heures)│  ← proxy_read_timeout   │
    │◄══════════════════════════════════════════►│     (60s par défaut)    │
    │    messages JSON dans les deux sens        │                         │
```

Une requête HTTP classique : le client demande, le serveur répond, **la connexion
se ferme**. Un WebSocket : le client demande d'**ouvrir un canal persistant**, le
serveur accepte avec la réponse `101`, et la connexion reste ouverte dans les deux
sens.

### Les 4 pièges, dans l'ordre où ils frappent

| # | Piège | Symptôme | Réglage |
|---|---|---|---|
| 1 | nginx ne recopie pas `Upgrade`/`Connection` | échec du handshake, « erreur de connexion » | `proxy_set_header Upgrade $http_upgrade;` + `Connection $connection_upgrade;` dans `location /ws` |
| 2 | nginx coupe la connexion inactive | déconnexion toutes les 60 s | `proxy_read_timeout 60s` **et** heartbeat côté app |
| 3 | la page est en HTTPS mais le WS en `ws://` | le navigateur **bloque** (mixed content) | utiliser `wss://` partout |
| 4 | pas de vérification d'origine | n'importe quel site ouvre un WS chez toi | vérifier l'origine + secret partagé |

## Étapes numérotées

### Étape 1 — Activer le service

```bash
# docker/.env : COMPOSE_PROFILES=postgres,ws        (ajoute ,ws à la liste existante)
# ou en ligne de commande :
docker compose --profile ws up -d --build
```

Le service `ws` du `docker-compose.yml` écoute sur `127.0.0.1:{{PORT_WS}}` (8081) ;
nginx route `/ws` vers lui. **Si tu n'as pas de service ws, commente le bloc
`location /ws` de site.conf** : sinon chaque requête `/ws` renvoie `502`.

### Étape 2 — Vérifier que nginx laisse passer le handshake

Test depuis le serveur lui-même (pas besoin que l'app tourne : on teste NGINX) :

```bash
curl -i -N --max-time 10 \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  https://{{DOMAINE}}/ws
```

- `Connection: Upgrade` + `Upgrade: websocket` = les deux en-têtes que le navigateur
  enverra ; `Sec-WebSocket-Key` est la clé de négociation (valeur quelconque, c'est
  un test).
- **Sortie attendue si tout est bien câblé** :
  `HTTP/1.1 101 Switching Protocols` (+ `Upgrade: websocket`, `Connection: upgrade`).
- **Sortie en cas de mauvaise config nginx** : `HTTP/1.1 200 OK` ou `400 Bad
  Request` → nginx a traité ça comme une requête normale : il manque les lignes
  `proxy_set_header Upgrade/Connection` du bloc `location /ws`.
- **Sortie si le service ws est à l'arrêt** : `502 Bad Gateway`.

Puis le test réel, depuis le navigateur (onglet Console) :

```javascript
const ws = new WebSocket("wss://{{DOMAINE}}/ws");   // wss:// = WebSocket SECURISE
ws.onopen    = () => console.log("connecté");
ws.onmessage = (e) => console.log("reçu :", e.data);
ws.onerror   = (e) => console.error("ERREUR", e);
ws.onclose   = (e) => console.log("fermé, code :", e.code);
```

Un code `1006` (fermeture anormale) = l'une des 4 erreurs ci-dessus.

### Étape 3 — Mettre en place la sécurité (checklist)

À cocher **avant** toute mise en ligne :

1. **`wss://` obligatoire** — la page est en HTTPS ; un `ws://` serait bloqué par le
   navigateur (mixed content) ET transmis en clair (ton message, ton token, dans
   le réseau). nginx termine le TLS : le conteneur reste en `ws://` local,
   c'est le navigateur qui doit écrire `wss://`.
2. **Origines autorisées** — liste blanche des domaines autorisés à ouvrir la
   connexion (`WS_ORIGINS=https://{{DOMAINE}}` dans `docker/.env`). Sans ça, un site
   malveillant peut ouvrir un WebSocket vers ton serveur **avec les cookies de tes
   utilisateurs** (les cookies partent automatiquement). Vérifie l'en-tête
   `Origin` côté serveur et refuse le reste.
3. **Secret partagé ≥ 32 caractères** — `WS_SECRET` doit être **identique** dans
   le backend et le service ws (les deux lisent `docker/.env`). Le service ws s'en sert
   pour vérifier les tokens signés par l'API : sans secret commun, soit il accepte
   tout, soit il refuse tout.
   ```bash
   openssl rand -base64 48    # → 64 caractères, à coller dans WS_SECRET
   ```
4. **Authentification par JWT/session** — n'accepte pas une connexion « juste parce
   qu'elle arrive ». Trois méthodes, de la plus simple à la plus robuste :
   - token passé dans l'URL : `wss://…/ws?token=…` (simple, mais le token finit
     dans les logs nginx — à proscrire si tu as le choix) ;
   - **recommandée** : premier message envoyé après connexion contenant le token,
     le serveur ferme la connexion (`code 4001`) si invalide ;
   - cookie `Secure` + vérification de session côté serveur (la plus propre).
5. **Heartbeat anti-déconnexion** — toutes les **25 à 30 secondes**, chaque côté
   envoie un message vide (ping/pong). Deux rôles :
   - maintenir le canal vivant (nginx le coupe après `proxy_read_timeout` de 60 s
     sans activité — le heartbeat arrive donc largement à temps) ;
   - **détecter** les connexions mortes (réseau mobile coupé) que le serveur croit
     encore ouvertes.
6. **Limites** : nombre max de connexions simultanées par IP, taille max de message
   (4 Ko suffisent pour du chat), et refus des messages non validés (JSON parse
    échoué → fermeture). Sans ces limites, un client malveillant peut te manger la RAM.

### Étape 4 — Choisir l'une des 3 solutions

| Backend | Solution | Commentaires |
|---|---|---|
| **Node.js** | paquet [`ws`](https://www.npmjs.com/package/ws) (léger) ou Socket.IO (reconnect auto, rooms, fallback long-polling) | la voie la plus courante ; Socket.IO ajoute ~50 Ko côté client et gère les reconnexions pour toi |
| **Python** | `websockets` (ASGI pur, ~100 lignes) ou **Django Channels** (Django : groupe de consommateurs + auth Django réutilisée) | Channels exige Redis en mode multi-workers ; sans Redis, force `--workers 1` |
| **Java / autre** | **Mercure** (service externe, protocole WebSocket standard, s'installe en conteneur) ou Spring `@WebSocketHandler` | Mercure = un conteneur de plus à gérer, mais zéro code de diffusion ; Spring est intégré mais plus verbeux |
| **Quelconque, sans code** | **Socket.IO** (Node) ou **Mercure** comme service de diffusion | utile si ton backend (PHP notamment) est mal adapté au temps réel |

Variantes notables :

- **PHP (Symfony/Laravel)** : PHP n'est PAS fait pour garder des connexions ouvertes
  (chaque requête démarre et termine un cycle de vie complet, et php-fpm a un
  nombre de workers fixe). Solutions réalistes, par ordre de simplicité :
  1. **Mercure** en conteneur dédié (ton app publie un événement via HTTP, Mercure
     le pousse aux navigateurs) ;
  2. un petit service Node/Python à côté, qui publie/consomme via Redis ;
  3. **temps réel pollé** (`fetch` toutes les 3 s sur `/api/…`) : moche, mais
     parfois largement suffisant — et 0 infrastructure.
- **Polling vs SSE** : `EventSource` (Server-Sent Events) est plus simple qu'un
  WebSocket si le temps réel est **unidirectionnel** (serveur → client :
  notifications, scores). Il passe derrière nginx sans le `map`
  `$http_upgrade`, mais il faut `proxy_buffering off;` sur la route concernée.

### Étape 5 — Scalabilité : une instance ou plusieurs ?

**Une seule instance** (95 % des cas au départ) :

```text
navigateur ──nginx:443──► ws:8081 ──► base
```
Tout est en mémoire du conteneur `ws`. Simple, rapide, suffit jusqu'à quelques
milliers de connexions simultanées sur un VPS à 2 Go.

**Plusieurs instances** — le problème : l'utilisateur A est connecté sur
l'instance 1, un événement est publié sur l'instance 2 → **il ne le reçoit pas**.
Deux solutions :

| Solution | Principe | Quand |
|---|---|---|
| **Sticky sessions** (collage) | nginx envoie toujours le même client vers la même instance (`ip_hash;` dans un bloc `upstream`) | rapide à mettre en place, MAIS casse si une instance meurt (tous ses clients doivent être réorientés) |
| **Pub/Sub Redis** (recommandé) | chaque instance s'abonne à un canal Redis ; tout message publié est **diffusé à toutes** les instances, qui le relayent à leurs clients | échelle horizontalement proprement ; c'est pourquoi le profil `redis` existe dans le template |

```yaml
# docker-compose.yml → activer le profil Redis :
#   COMPOSE_PROFILES=postgres,ws,redis
```

Ordre de passage à l'échelle : 1 instance → mesurer (`docker stats`) → une seule
instance avec plus de RAM → **puis** pub/sub Redis. Ajouter des instances avant
d'avoir le pub/sub **aggrave** les bugs (messages perdus), il ne les résout pas.

## Personnalisation

## Table des valeurs à personnaliser

| Placeholder / variable | Exemple | Où / comment |
|---|---|---|
| `{{DOMAINE_WS}}` | `ws.monapp.fr` | sous-domaine temps réel (ou `{{DOMAINE}}` si tout passe par `/ws`) |
| `{{DOMAINE}}` | `monapp.fr` | valeur de `WS_ORIGINS` (origines autorisées) |
| `{{PORT_WS}}` | `8081` | port hôte du service ws — doit matcher `location /ws` de site.conf |
| `{{IP_SERVEUR}}` | `203.0.113.10` | enregistrements DNS `ws`/`api` si sous-domaines dédiés |
| `WS_SECRET` | `CHANGE_ME` | `openssl rand -base64 48` — **identique** backend ↔ service ws |
| `WS_ORIGINS` | `https://monapp.fr` | liste séparée par virgules, sans espace |
| `COMPOSE_PROFILES` | `postgres,ws` | active le service (`,ws`), `redis` si multi-instances |

## Vérification

```bash
# 1. le handshake nginx renvoie bien 101
curl -i -N --max-time 10 -H "Connection: Upgrade" -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
     https://{{DOMAINE}}/ws
# → HTTP/1.1 101 Switching Protocols

# 2. le service tourne
docker compose ps ws
# → Up (healthy)

# 3. le TLS est bien là (wss fonctionnera)
curl -I https://{{DOMAINE}}/ws
# → 101 (avec les en-têtes ci-dessus) ou 400 sans eux — jamais 502

# 4. en local sur le serveur : le port interne répond
curl -i http://127.0.0.1:{{PORT_WS}}/health
# → 200
```

## Dépannage (3 pannes probables)

### Panne 1 — `502 Bad Gateway` sur `/ws`

**Symptôme** : le handshake échoue immédiatement, `error.log` affiche
`connect() failed (111: Connection refused)`.

**Cause** : le service `ws` ne tourne pas (profil non activé) ou n'écoute pas sur
`{{PORT_WS}}`.

```bash
docker compose ps ws                          # absent → profil non actif
docker compose --profile ws up -d --build ws  # lancer le service
sudo ss -ltn | grep 8081                      # doit afficher 127.0.0.1:8081
docker compose logs --tail=50 ws              # s'il tourne : que dit-il ?
```

Si le service est obsolète pour ton besoin : **commente le bloc `location /ws`**
dans `site.conf` et recharge nginx (`sudo nginx -t && sudo systemctl reload nginx`)
— un route vers un port mort ne sert à rien.

### Panne 2 — `wss://` refusé / `ERR_SSL_PROTOCOL_ERROR` / certificat

**Symptôme** : le WebSocket ne se connecte que sur `ws://{{DOMAINE}}` (et le
navigateur le refuse en HTTPS), ou affiche une erreur de certificat.

**Cause** : certificat absent/invalide, ou sous-domaine `{{DOMAINE_WS}}` non couvert
par le certificat.

```bash
sudo certbot certificates                    # couverture réelle des domaines
echo | openssl s_client -connect {{DOMAINE}}:443 -servername {{DOMAINE}} 2>/dev/null | openssl x509 -noout -subject -dates
# Subject doit contenir ton domaine, NotAfter doit être > 30 jours
```

Si `{{DOMAINE_WS}}` n'est PAS dans le certificat : relance
`sudo certbot --nginx -d {{DOMAINE}} -d {{DOMAINE_API}} -d {{DOMAINE_WS}} --email {{EMAIL_ADMIN}} --agree-tos --no-eff-email`
puis `sudo nginx -t && sudo systemctl reload nginx`. Un sous-domaine non couvert =
erreur SSL côté client, **le navigateur bloque avant même d'arriver à nginx**.

### Panne 3 — le WS ne se connecte que depuis le domaine A, pas depuis B (DNS / origine)

**Symptôme** : `wss://{{DOMAINE_WS}}/ws` échoue depuis certains postes, ou
`Origin` refusé alors que le site s'affiche.

**Cause** : le sous-domaine `ws.` n'existe pas en DNS (erreur de saisie : `ws.monapp.fr`
au lieu de `monapp.fr`), ou l'origine déclarée dans `WS_ORIGINS` ne correspond pas
exactement (protocole compris !).

```bash
# (local) le sous-domaine résout-il ?
nslookup {{DOMAINE_WS}}          # doit renvoyer {{IP_SERVEUR}}

# (local) l'origine envoyée au serveur :
# dans la console du navigateur :
new WebSocket("wss://{{DOMAINE_WS}}/ws")   // l'erreur "from origin 'https://...' was not allowed"
#                                            te dit EXACTEMENT l'origine refusée
```

Corrige soit le DNS (enregistrement **A** pour `ws` → `{{IP_SERVEUR}}`), soit
`WS_ORIGINS` dans `docker/.env` (doit être `https://{{DOMAINE_WS}}`, **avec** `https://`,
sans `/` final, sans espace) :

```bash
docker compose up -d ws   # redémarrage pour recharger docker/.env
```

## Note sur l'hébergement mutualisé

Si ton application tourne sur un hébergement mutualisé (cPanel, shared hosting…),
les WebSockets sont **généralement désactivés** (les PHP-FPM workers y sont partagés
et ne peuvent pas garder des connexions ouvertes) : c'est une limite
d'architecture de l'hébergeur, pas de ton code. Solutions dans l'ordre : polling
léger (`fetch` toutes les 3 à 5 s), SSE si le flux est unidirectionnel, ou
migration vers un VPS (la procédure de ce template, `../vps/README.md`).
