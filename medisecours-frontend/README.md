# MediSecours+ — Frontend (Next.js)

Plateforme médicale d'urgence pour le Cameroun (200 000+ utilisateurs). Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + TypeScript.

## Démarrage

```bash
npm install
npm run dev
```

Le backend Symfony doit tourner sur `http://127.0.0.1:8000`.

Le WebSocket temps réel tourne sur `ws://127.0.0.1:8081` (serveur Node.js dans `server/`).

## Comptes de test

| Email | Mot de passe | Rôle |
|---|---|---|
| admin@medisecours.com | Admin@2026! | Admin |
| medecin0@medisecours.com | Medecin@2026! | Médecin |
| patient0@medisecours.com | Patient@2026! | Patient |

## Trois espaces indépendants

- **Public** (`/`, `/maladies`, `/centres`, `/messages`, `/profil`) — Navbar/Footer visibles
- **Espace Médecin** (`/medecin/*`) — sidebar dédiée, sans Navbar/Footer public
  - `/medecin` — tableau de bord (KPIs, consultations actives, avis, messages récents)
  - `/medecin/consultations` — gestion des consultations (filtres par statut)
  - `/medecin/messages` — messagerie temps réel (WebSocket)
  - `/medecin/profil` — profil + créateur de disponibilités hebdomadaires
  - `/medecin/avis` — avis reçus + signalement
- **Admin** (`/admin/*`) — sidebar redessinée avec sections groupées + horloge
  - `/admin` — vue d'ensemble (KPIs)
  - `/admin/utilisateurs`, `/admin/medecins` (validation), `/admin/centres`, `/admin/catalogue`, `/admin/avis` (modération), `/admin/parametres`

La redirection post-connexion est basée sur le rôle : `ROLE_ADMIN` → `/admin`, `ROLE_MEDECIN` → `/medecin`, sinon page d'origine ou accueil.

## Architecture temps réel

Le projet utilise **exclusivement WebSocket** pour les notifications temps réel :

- **Serveur WebSocket** (`server/websocket-server.js`) — Node.js, auth par message JWT `{ "type": "auth", "token": "..." }`
- **Hook React** (`src/hooks/useWebSocket.ts`) — connexion avec backoff exponentiel, flush des messages en attente après `auth_ok`
- **Notifications** — consultations (created/accepted/closed), messages (new_message/message_read), compteurs non lus

Le backend Symfony notifie le WebSocket via un endpoint HTTP `/publish` sur le port 8082.
