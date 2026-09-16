# MediSecours+

Plateforme médicale d'urgence pour le **Cameroun**, dimensionnée pour **200 000+ utilisateurs**.

Elle permet de consulter des maladies et gestes de premiers soins, trouver des centres de santé
proches de la position réelle du patient, gérer des comptes patient/médecin/admin, se connecter
par email/mot de passe ou Google, échanger des messages en temps réel, et administrer l'ensemble
de la plateforme depuis un dashboard admin dédié.

---

## Stack

### Backend
- PHP 8.2+
- Symfony 7.4 + `symfony/rate-limiter`
- API Platform 4.x
- PostgreSQL 15+ (Single Table Inheritance pour User/Patient/Medecin)
- Doctrine ORM + 24 migrations
- LexikJWTAuthenticationBundle (JWT TTL configurable via `JWT_TTL`, 3600s par défaut)
- Google API Client + composer/ca-bundle (fix SSL Windows)
- Nelmio CORS
- WebSocket temps réel (Node.js) — notifications consultations + messages
- VichUploader (upload fichiers / photos profil)
- Gedmo Doctrine Extensions (SoftDelete, Loggable)
- PHPUnit / Symfony PHPUnit Bridge (34 tests)

### Frontend
- Next.js 16 App Router (Turbopack)
- React 19 + TypeScript
- Tailwind CSS 4 (design system via `@theme` dans `globals.css`)
- Axios (interceptors JWT + gestion 401/429/410)
- SWR (cache global, deduplication 2 min, clés centralisées)
- `@react-oauth/google`
- lucide-react, framer-motion, recharts
- Leaflet + react-leaflet (carte interactive centres de santé)

### Temps réel
- WebSocket (Node.js) — notifications consultations, auth par message JWT
- WebSocket (Node.js) — notifications temps réel

---

## Arborescence du projet

```
MediSecours/
├── Cahier de charges MediSecours final.pdf
├── diseases_list.json
│
├── medisecours-backend/
│   ├── README.md
│   ├── composer.json / composer.lock
│   ├── phpunit.xml.dist
│   ├── compose.yaml / compose.override.yaml
│   ├── bin/console
│   │
│   ├── config/
│   │   ├── bundles.php
│   │   ├── routes.yaml / services.yaml
│   │   ├── jwt/
│   │   │   ├── private.pem
│   │   │   └── public.pem
│   │   ├── packages/
│   │   │   ├── api_platform.yaml
│   │   │   ├── doctrine.yaml
│   │   │   ├── lexik_jwt_authentication.yaml
│   │   │   ├── nelmio_cors.yaml
│   │   │   ├── security.yaml
│   │   │   ├── messenger.yaml
│   │   │   ├── mailer.yaml
│   │   │   ├── stof_doctrine_extensions.yaml
│   │   │   └── vich_uploader.yaml
│   │   └── routes/
│   │       ├── api_platform.yaml
│   │       ├── framework.yaml
│   │       └── security.yaml
│   │
│   ├── data/
│   │   ├── centres_sante.json
│   │   ├── maladies.json
│   │   └── generate_*.php
│   │
│   ├── migrations/
│   │   ├── Version20260629152913.php    — structure initiale
│   │   ├── Version20260629153544.php    — ajustements
│   │   ├── Version20260630094544.php    — centres de santé
│   │   ├── Version20260630102325.php    — messages/consultations
│   │   ├── Version20260630112006.php    — média objects
│   │   ├── Version20260630143000.php    — disponibilités
│   │   ├── Version20260630144500.php    — ajustements types
│   │   ├── Version20260701170758.php    — ajustements
│   │   ├── Version20260702100000.php    — email_verified, tokens, avis
│   │   ├── Version20260702122044.php    — index Doctrine, séquence avis
│   │   ├── Version20260702131711.php    — allergies/contacts JSON
│   │   ├── Version20260706100000.php    — conversations
│   │   ├── Version20260706110000.php    — participants
│   │   ├── Version20260706120000.php    — prescriptions
│   │   ├── Version20260708072430.php    — ajustements
│   │   ├── Version20260708073421.php    — statuts consultation
│   │   ├── Version20260708092229.php    — priorité
│   │   ├── Version20260708105127.php    — date consultation
│   │   ├── Version20260710145130.php    — ajustements
│   │   ├── Version20260714090703.php    — ajustements
│   │   ├── Version20260714092255.php    — ajustements
│   │   ├── Version20260714125324.php    — ajustements
│   │   ├── Version20260716122012.php    — ajustements
│   │   └── Version20260717101726.php    — dernier ajustement
│   │
│   ├── public/
│   │   ├── index.php
│   │   └── uploads/ (images/, media/)
│   │
│   ├── src/
│   │   ├── Kernel.php
│   │   │
│   │   ├── Command/
│   │   │   ├── CreateAdminCommand.php
│   │   │   ├── CreateTestUsersCommand.php
│   │   │   ├── FetchDiseaseImagesCommand.php
│   │   │   ├── LoadCentresFromJsonCommand.php
│   │   │   ├── LoadMaladiesFromJsonCommand.php
│   │   │   └── TestEmailCommand.php
│   │   │
│   │   ├── Controller/
│   │   │   ├── AdminDashboardController.php   — dashboard admin (KPIs, graphique)
│   │   │   ├── AdminMedecinController.php      — validation médecins
│   │   │   ├── AdminUserController.php         — CRUD users admin
│   │   │   ├── GoogleAuthController.php
│   │   │   ├── HealthController.php            — /api/health
│   │   │   ├── ImportMedecinController.php
│   │   │   ├── JWTController.php               — login/register/verify/reset
│   │   │   ├── MedecinPublicController.php     — profils publics
│   │   │   ├── PatientController.php
│   │   │   ├── SearchController.php
│   │   │   ├── Admin/
│   │   │   │   ├── AdminAvisController.php
│   │   │   │   ├── ImportCentreController.php
│   │   │   │   ├── ImportMaladieController.php
│   │   │   │   ├── ImportPremierSoinController.php
│   │   │   │   ├── PremierSoinController.php
│   │   │   │   ├── UploadCategorieImageController.php
│   │   │   │   ├── UploadCentreImageController.php
│   │   │   │   └── UploadMaladieImageController.php
│   │   │   └── Api/
│   │   │       ├── MedecinDashboardController.php  — dashboard médecin agrégé
│   │   │       ├── UnreadMessagesController.php    — compteur messages non lus
│   │   │       └── UploadMessageMediaController.php
│   │   │
│   │   ├── DataFixtures/
│   │   │   └── AppFixtures.php       — admin + 5 médecins + 20 patients
│   │   │
│   │   ├── Doctrine/
│   │   │   └── CurrentUserExtension.php  — filtre auto collections par user
│   │   │
│   │   ├── DTO/
│   │   │   ├── CentreDeSanteImportDTO.php
│   │   │   ├── MaladieImportDTO.php
│   │   │   ├── MedecinImportDTO.php
│   │   │   └── PremierSoinImportDTO.php
│   │   │
│   │   ├── Entity/
│   │   │   ├── User.php / Patient.php / Medecin.php   — héritage SINGLE_TABLE
│   │   │   ├── Admin.php
│   │   │   ├── Categorie.php / Maladie.php / PremierSoin.php
│   │   │   ├── CentreDeSante.php
│   │   │   ├── Consultation.php    — statuts OUVERTE/EN_COURS/TERMINEE/ANNULEE
│   │   │   ├── Conversation.php    — conversations entre participants
│   │   │   ├── Message.php         — messages texte + média
│   │   │   ├── Prescription.php    — prescriptions médicales
│   │   │   ├── Avis.php            — avis patients (note 1-5, signalement)
│   │   │   └── MediaObject.php
│   │   │
│   │   ├── Enum/
│   │   │   ├── NiveauGravite.php
│   │   │   └── NiveauUrgence.php
│   │   │
│   │   ├── Message/
│   │   │   └── WebSocketNotification.php
│   │   │
│   │   ├── MessageHandler/
│   │   │   └── WebSocketNotificationHandler.php
│   │   │
│   │   ├── Repository/
│   │   │   ├── AvisRepository.php          — noteMoyenne, noteDistribution
│   │   │   ├── CentreDeSanteRepository.php — Haversine SQL
│   │   │   ├── ConsultationRepository.php
│   │   │   ├── ConversationRepository.php
│   │   │   ├── MessageRepository.php
│   │   │   ├── PrescriptionRepository.php
│   │   │   └── (autres repositories standard Doctrine)
│   │   │
│   │   ├── Security/
│   │   │   └── Voter/
│   │   │       └── MedecinVoter.php
│   │   │
│   │   ├── Service/
│   │   │   ├── AdminDashboardService.php         — KPIs admin (COUNT/GROUP BY)
│   │   │   ├── MedecinDashboardService.php       — agrégats SQL dashboard médecin
│   │   │   ├── CentreDeSanteImportService.php
│   │   │   ├── ConsultationEmailService.php
│   │   │   ├── EmailVerificationService.php
│   │   │   ├── MaladieImportService.php
│   │   │   ├── MedecinImportService.php
│   │   │   ├── PdfGeneratorService.php           — PDF ordonnances
│   │   │   ├── PremierSoinImportService.php
│   │   │   ├── UserSerializer.php                — sérialisation centralisée
│   │   │   └── WebSocketNotifier.php
│   │   │
│   │   └── State/
│   │       ├── AvisProcessor.php
│   │       ├── CentreDeSanteProcheProvider.php   — géolocalisation Haversine
│   │       ├── ConsultationProcessor.php         — logique métier consultations
│   │       ├── MaladieSearchProvider.php
│   │       ├── MessageProcessor.php              — dispatche vers WebSocket après persistance
│   │       ├── PrescriptionProcessor.php
│   │       └── UserPasswordHasherProcessor.php
│   │
│   ├── templates/
│   │   ├── base.html.twig
│   │   └── prescription/
│   │       └── pdf.html.twig
│   │
│   └── tests/
│       └── Api/
│           ├── AuthTest.php
│           ├── ConsultationTest.php
│           ├── MessageTest.php
│           └── SecurityTest.php
│
├── medisecours-frontend/
│   ├── package.json
│   ├── next.config.mjs          — proxy /api/* → Symfony :8000
│   ├── tsconfig.json
│   ├── .env.local
│   │
│   ├── server/
│   │   ├── package.json         — jsonwebtoken + ws
│   │   └── websocket-server.js  — auth JWT par message, notifications temps réel
│   │
│   └── src/
│       ├── middleware.ts         — protège /medecin/*, /admin/*, /messages/*
│       │
│       ├── api/
│       │   ├── axios.ts         — instance Axios + intercepteurs JWT/401
│       │   └── admin.ts
│       │
│       ├── contexts/
│       │   ├── AuthContext.tsx   — état auth global (mounted, isAdmin, isMedecin)
│       │   └── NotificationContext.tsx
│       │
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useConsultationCount.ts
│       │   ├── useDebounce.ts
│       │   ├── useGeolocation.ts        — GPS navigateur
│       │   ├── useUnreadCount.ts
│       │   └── useWebSocket.ts           — auth handshake JWT, flush sur auth_ok
│       │
│       ├── lib/
│       │   ├── api.ts
│       │   ├── config.ts
│       │   ├── consultations.ts
│       │   ├── cookies.ts               — sync localStorage ↔ cookie pour middleware
│       │   ├── fetcher.ts               — config SWR globale (deduplication 2min)
│       │   ├── iconMapping.ts
│       │   └── keys.ts                  — clés SWR centralisées (DASHBOARD_KEY, etc.)
│       │
│       ├── types/
│       │   └── api.ts                   — types TypeScript (DashboardData, Consultation, etc.)
│       │
│       ├── components/
│       │   ├── CentresMap.tsx            — carte Leaflet
│       │   ├── admin/
│       │   │   ├── CrudTable.tsx         — table CRUD générique
│       │   │   ├── CategoryEditModal.tsx
│       │   │   ├── DiseaseDetailModal.tsx
│       │   │   ├── DiseaseEditModal.tsx
│       │   │   ├── ImportCentresModal.tsx
│       │   │   ├── ImportMaladiesModal.tsx
│       │   │   ├── ImportMedecinsModal.tsx
│       │   │   ├── ImportPremiersSoinsModal.tsx
│       │   │   ├── PremierSoinEditModal.tsx
│       │   │   ├── PrescriptionModal.tsx
│       │   │   └── PrescriptionPDFTemplate.tsx
│       │   ├── cards/
│       │   │   ├── CategoryCard.tsx
│       │   │   └── MaladieCard.tsx
│       │   ├── chat/
│       │   │   └── ModernChat.tsx
│       │   ├── consultations/
│       │   │   ├── ConsultationDetailModal.tsx
│       │   │   └── PrescriptionPreview.tsx
│       │   ├── layout/
│       │   │   ├── Footer.tsx
│       │   │   └── Navbar.tsx
│       │   ├── medecin/
│       │   │   ├── MedecinHeader.tsx
│       │   │   ├── MedecinSidebar.tsx
│       │   │   └── dashboard/
│       │   │       ├── DashboardAlerts.tsx          — alertes (>48h, urgentes)
│       │   │       ├── DashboardBloodAllergies.tsx  — groupes sanguins + allergies
│       │   │       ├── DashboardCatalogueSearch.tsx — recherche catalogue maladies
│       │   │       ├── DashboardFunnel.tsx          — répartition par statut
│       │   │       ├── DashboardMotifsCloud.tsx     — nuage de motifs
│       │   │       ├── DashboardPresenceStatus.tsx  — toggle présence en ligne
│       │   │       ├── DashboardRatingsDistrib.tsx  — distribution avis
│       │   │       ├── DashboardRecentPatients.tsx  — 5 derniers patients
│       │   │       ├── DashboardRiskPatients.tsx    — patients à risque
│       │   │       ├── DashboardTimeline.tsx        — série temporelle 30j
│       │   │       └── DashboardUpcomingAppointments.tsx — prochains RDV
│       │   └── ui/
│       │       ├── Avatar.tsx
│       │       ├── Button.tsx
│       │       ├── CategoryIcon.tsx
│       │       ├── ConfirmModal.tsx
│       │       ├── EmptyState.tsx
│       │       ├── GravityBadge.tsx
│       │       ├── LoadingSpinner.tsx
│       │       ├── MedicalDisclaimer.tsx  — banner avertissement médical WCAG
│       │       ├── Modal.tsx
│       │       ├── NotificationBell.tsx
│       │       ├── SearchBar.tsx
│       │       ├── Toast.tsx
│       │       └── UrgencyBadge.tsx
│       │
│       └── app/
│           ├── globals.css          — design system @theme Tailwind CSS 4
│           ├── layout.tsx
│           ├── page.tsx            — accueil public
│           ├── providers.tsx       — masque Navbar/Footer sur /admin
│           ├── not-found.tsx
│           │
│           ├── login/page.tsx              — redirection rôle (admin→/admin, médecin→/medecin)
│           ├── register/page.tsx           — inscription patient ou médecin (3 étapes)
│           ├── forgot-password/page.tsx
│           ├── reset-password/page.tsx
│           ├── verify-email/page.tsx
│           │
│           ├── categories/page.tsx / [id]/page.tsx
│           ├── maladies/page.tsx / [id]/page.tsx
│           ├── centres/page.tsx            — carte + liste + GPS
│           ├── medecins/page.tsx / [id]/page.tsx
│           ├── messages/page.tsx           — messagerie WebSocket temps réel
│           ├── notifications/page.tsx
│           ├── profil/page.tsx
│           ├── patient/consultations/page.tsx
│           │
│           ├── medecin/                    — Espace médecin
│           │   ├── layout.tsx              — layout sidebar dédié
│           │   ├── page.tsx                — dashboard (vue d'ensemble)
│           │   ├── avis/page.tsx           — avis reçus
│           │   ├── consultations/page.tsx  — file active consultations
│           │   ├── messages/page.tsx       — messagerie
│           │   ├── notifications/page.tsx
│           │   ├── parametres/page.tsx
│           │   ├── patients/page.tsx       — liste patients
│           │   ├── pharmacy/page.tsx
│           │   ├── prescriptions/page.tsx
│           │   ├── profil/page.tsx
│           │   └── rapports/page.tsx
│           │
│           └── admin/                      — Dashboard admin
│               ├── layout.tsx              — layout séparé, sidebar sombre, route guard
│               ├── page.tsx                — KPIs + graphique + activité récente
│               ├── utilisateurs/page.tsx   — table + filtre rôle + slide-over détails
│               ├── medecins/page.tsx       — validation médecins (cards approve/reject)
│               ├── medecins/import/page.tsx
│               ├── centres/page.tsx        — CRUD centres (16 champs, régions Cameroun)
│               ├── centres/import/page.tsx
│               ├── catalogue/page.tsx      — 3 onglets : catégories, maladies, premiers soins
│               ├── catalogue/import/page.tsx
│               ├── avis/page.tsx           — modération avis signalés
│               └── parametres/page.tsx     — profil admin + infos plateforme
```

---

## Compte Admin par défaut (Fixtures)

| Champ | Valeur |
|---|---|
| Email | `admin@medisecours.com` |
| Mot de passe | `Admin@2026!` |
| Prénom / Nom | Super Admin |
| Téléphone | +237 690000000 |
| Rôle | `ROLE_ADMIN` |

> ⚠️ Changer ce mot de passe avant toute démonstration publique ou déploiement.

Autres comptes de test créés par les fixtures :

| Type | Email | Mot de passe | Quantité |
|---|---|---|---|
| Médecins (validés) | `medecin0` à `medecin4@medisecours.com` | `Medecin@2026!` | 5 |
| Patients | `patient0` à `patient19@medisecours.com` | `Patient@2026!` | 20 |

---

## Configuration backend

Depuis `medisecours-backend` :

```bash
composer install
```

Configurer `.env` ou `.env.local` :

```dotenv
DATABASE_URL="postgresql://postgres:your_local_password@127.0.0.1:5432/medisecours_db?serverVersion=18&charset=utf8"

JWT_SECRET_KEY=%kernel.project_dir%/config/jwt/private.pem
JWT_PUBLIC_KEY=%kernel.project_dir%/config/jwt/public.pem
JWT_PASSPHRASE=une_passphrase_forte_ici
JWT_TTL=3600

GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com

CORS_ALLOW_ORIGIN='^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$'

# Mailer
MAILER_DSN=smtp://localhost:1025
MAILER_SENDER_EMAIL=noreply@medisecours.cm
MAILER_SENDER_NAME="MediSecours+"
FRONTEND_URL=http://localhost:3000

# WebSocket temps réel
WS_PUBLISH_URL=http://127.0.0.1:8082/publish
```

Créer la base et appliquer les migrations :

```bash
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate
```

Générer les clés JWT (si absentes) :

```bash
php bin/console lexik:jwt:generate-keypair --overwrite
php bin/console lexik:jwt:check-config
```

Charger les données de test :

```bash
# Supprime toutes les données et recharge les fixtures
php bin/console doctrine:fixtures:load

# Ajoute les fixtures sans supprimer les données existantes
php bin/console doctrine:fixtures:load --append
```

---

## Démarrage

### Backend

```bash
symfony serve
```

```
http://127.0.0.1:8000
http://127.0.0.1:8000/api/docs   ← Documentation API Platform (Swagger)
```

### Frontend

```bash
cd medisecours-frontend
npm install
npm run dev
```

```
http://localhost:3000              ← Application publique
http://localhost:3000/admin        ← Dashboard admin (ROLE_ADMIN requis)
http://localhost:3000/medecin      ← Espace médecin (ROLE_MEDECIN requis)
```

### WebSocket temps réel

```bash
cd medisecours-frontend/server
npm install
node websocket-server.js
```

Le WebSocket tourne sur `ws://localhost:8082` — auth par message JWT :
```json
{ "type": "auth", "token": "eyJ..." }
```

---

## Authentification

### Connexion classique

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "medecin0@medisecours.com",
  "password": "Medecin@2026!"
}
```

Réponse :

```json
{
  "token": "eyJ...",
  "user": {
    "id": "...",
    "email": "medecin0@medisecours.com",
    "roles": ["ROLE_MEDECIN", "ROLE_USER"],
    "nom": "...",
    "prenom": "...",
    "type": "medecin"
  }
}
```

Le frontend stocke le token dans `localStorage` **et** dans un cookie via `lib/cookies.js`
(nécessaire pour le middleware Next.js). Le token est injecté automatiquement dans tous les
appels Axios via un interceptor de requête.

### Inscription

```http
POST /api/auth/register
Content-Type: application/json
```

Patient :
```json
{
  "email": "patient@example.cm",
  "password": "MotDePasseFort1!",
  "type": "patient",
  "nom": "Dupont", "prenom": "Jean",
  "telephone": "+237 690000000",
  "quartier": "Bonamoussadi"
}
```

Médecin :
```json
{
  "email": "medecin@example.cm",
  "password": "MotDePasseFort1!",
  "type": "medecin",
  "nom": "Koffi", "prenom": "Marie",
  "specialite": "Cardiologie",
  "numeroOrdre": "CM-ORD-12345"
}
```

> Un médecin nouvellement inscrit a `estValide: false` — il doit être approuvé par un admin.

### Connexion Google

```http
POST /api/auth/google
Content-Type: application/json

{ "googleIdToken": "eyJ..." }
```

Le backend vérifie le token Google, crée un patient si l'email est inconnu, retourne un JWT MediSecours+.

### Vérification d'email

```http
GET /api/auth/verify-email?token=xxx
```

### Mot de passe oublié

```http
POST /api/auth/forgot-password
Content-Type: application/json
{ "email": "user@example.cm" }
```

```http
POST /api/auth/reset-password
Content-Type: application/json
{ "token": "xxx", "password": "NouveauMotDePasse1!" }
```

---

## Rôles

| Rôle | Description |
|---|---|
| `ROLE_USER` | Base ajoutée automatiquement à tout utilisateur |
| `ROLE_PATIENT` | Patient inscrit ou créé via Google |
| `ROLE_MEDECIN` | Médecin validé (accès consultations, messagerie, dashboard) |
| `ROLE_ADMIN` | Accès dashboard admin, CRUD protégé, validation médecins |

---

## Endpoints — Référence complète

### Publics (sans authentification)

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Connexion email/mot de passe |
| `POST` | `/api/auth/register` | Inscription patient ou médecin |
| `POST` | `/api/auth/google` | Connexion Google OAuth2 |
| `GET` | `/api/auth/verify-email?token=xxx` | Vérification adresse email |
| `POST` | `/api/auth/forgot-password` | Demande de réinitialisation mot de passe |
| `POST` | `/api/auth/reset-password` | Réinitialisation effective du mot de passe |
| `GET` | `/api/categories` | Liste des catégories médicales |
| `GET` | `/api/categories/{id}` | Détail d'une catégorie |
| `GET` | `/api/maladies` | Liste maladies (filtres: nom, symptomes, categorie, niveauGravite, urgence, contagieux) |
| `GET` | `/api/maladies/search` | Recherche maladies par nom (autocomplete) |
| `GET` | `/api/maladies/{id}` | Détail d'une maladie |
| `GET` | `/api/premier_soins` | Liste des protocoles de premiers soins |
| `GET` | `/api/premier_soins/{id}` | Détail d'un protocole |
| `GET` | `/api/centre_de_santes` | Liste des centres de santé |
| `GET` | `/api/centre_de_santes/{id}` | Détail d'un centre |
| `GET` | `/api/centres_de_santes/proches` | Centres dans un rayon GPS (Haversine) |
| `GET` | `/api/avis` | Avis sur les médecins |
| `GET` | `/api/medecins-publics` | Profils publics médecins validés |
| `GET` | `/api/medecins-publics/{id}` | Profil public d'un médecin + ses avis |
| `GET` | `/api/health` | Healthcheck |

> Rate limiting (par IP) : login 10/min · register 5/h · google 20/min · reset-password 3/h

### Protégés JWT (utilisateur connecté)

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users/{id}` | Voir son propre profil |
| `PATCH` | `/api/users/{id}` | Modifier son profil |
| `GET` | `/api/messages` | Messages de l'utilisateur connecté |
| `POST` | `/api/messages` | Envoyer un message |
| `POST` | `/api/messages/media/upload` | Upload média pour message |
| `GET` | `/api/messages/unread-count` | Nombre de messages non lus |
| `GET` | `/api/consultations` | Consultations liées à l'utilisateur |
| `POST` | `/api/consultations` | Créer une consultation |
| `PATCH` | `/api/consultations/{id}` | Modifier une consultation |
| `GET` | `/api/prescriptions` | Prescriptions liées à l'utilisateur |
| `POST` | `/api/avis` | Laisser un avis sur un médecin (patient) |
| `PATCH` | `/api/avis/{id}` | Modifier son avis (30 jours max) |
| `DELETE` | `/api/avis/{id}` | Supprimer son avis |

### Médecin (ROLE_MEDECIN requis)

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/me/dashboard` | Dashboard agrégé (KPIs, alertes, consultations, patients, stats) |

### Admin (ROLE_ADMIN requis)

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users` | Liste complète de tous les utilisateurs |
| `GET` | `/api/admin/stats` | Statistiques globales de la plateforme |
| `GET` | `/api/admin/dashboard` | Dashboard admin détaillé |
| `GET` | `/api/admin/medecins` | Tous les médecins |
| `GET` | `/api/admin/medecins/en-attente` | Médecins en attente de validation |
| `PATCH` | `/api/admin/medecins/{id}/validation` | Valider ou invalider un médecin |
| `PATCH` | `/api/admin/users/{id}/status` | Activer/désactiver/bannir un utilisateur |
| `GET` | `/api/admin/audit-log` | Journal d'audit |
| `POST` | `/api/admin/import/centres` | Import CSV centres |
| `POST` | `/api/admin/import/maladies` | Import CSV maladies |
| `POST` | `/api/admin/import/premiers-soins` | Import CSV premiers soins |
| `POST` | `/api/admin/import/medecins` | Import CSV médecins |
| CRUD | `/api/categories`, `/api/maladies`, `/api/premier_soins`, `/api/centre_de_santes` | CRUD complet |
| `POST` | `/api/admin/categories/{id}/images` | Upload images catégorie |
| `POST` | `/api/admin/maladies/{id}/images` | Upload images maladie |
| `POST` | `/api/admin/centres/{id}/images` | Upload images centre |
| `PATCH` | `/api/avis/{id}` | Modifier un avis (ex: `signale: false`) |
| `DELETE` | `/api/avis/{id}` | Supprimer un avis signalé |

---

## Dashboard Médecin — Architecture

### Backend (`MedecinDashboardService`)

Le service construit le dashboard en **UN seul appel HTTP**, avec des requêtes SQL optimisées :

| Widget | Méthode | Type SQL |
|---|---|---|
| KPIs (patients, cas actifs, consultations) | `buildKpis()` | `COUNT(DISTINCT ...)` |
| Répartition par statut | `buildStatusCounts()` | `GROUP BY statut` |
| Alertes (>48h, urgentes) | `buildAlerts()` | `COUNT` + `INTERVAL` |
| Distribution groupes sanguins | `buildBloodDistribution()` | `GROUP BY groupe_sanguin` |
| Top allergies | `buildAllergies()` | `DISTINCT ::text` + agrégation PHP |
| Top motifs | `buildTopMotifs()` | `GROUP BY motif ORDER BY n DESC LIMIT 8` |
| Timeline 30 jours | `buildTimeline()` | `DATE(created_at) + GROUP BY` |
| Statistiques avis | `buildAvisStats()` | via `AvisRepository` |
| Messages non lus | `countUnreadMessages()` | DQL COUNT |
| Consultations actives/risque/RDV | `fetchActiveConsultations()` etc. | DQL + LEFT JOIN patient |
| Patients récents | `fetchRecentPatients()` | SQL `GROUP BY patient_id ORDER BY MAX(created_at)` |

### Frontend (layout par urgence médicale)

```
Row 1 — Alertes critiques (priorité maximale)
  ├── DashboardRiskPatients    — patients à risque
  ├── DashboardAlerts          — alertes >48h, nombre urgentes
  └── DashboardUpcomingAppointments — prochains RDV

Row 2 — KPI Cards
  ├── Mes patients
  ├── Cas actifs
  ├── Consultations
  └── En attente

Row 3 — File active
  ├── Consultations actives (tableau)
  └── DashboardRecentPatients

Row 4 — Insights
  ├── DashboardTimeline        — série temporelle 30j
  ├── DashboardFunnel          — répartition statuts
  ├── DashboardBloodAllergies  — groupes sanguins + allergies
  └── DashboardRatingsDistrib  — distribution avis

Row 5 — Outils
  ├── DashboardMotifsCloud     — nuage de motifs
  ├── DashboardPresenceStatus  — toggle en ligne
  └── DashboardCatalogueSearch — recherche catalogue
```

---

## Dashboard Admin

Le frontend dispose d'un dashboard admin **complètement séparé** du reste de l'application.

### Accès

```
http://localhost:3000/admin
```

Connexion avec `admin@medisecours.com` / `Admin@2026!` → redirection automatique vers `/admin`.

### Navigation

| Section | URL | Description |
|---|---|---|
| Vue d'ensemble | `/admin` | KPIs, graphique de croissance, activité récente |
| Utilisateurs | `/admin/utilisateurs` | Liste complète, filtre par rôle, slide-over détails |
| Validation Médecins | `/admin/medecins` | Cards avec actions Approuver / Rejeter |
| Import Médecins | `/admin/medecins/import` | Import CSV masse |
| Centres de Santé | `/admin/centres` | CRUD complet (16 champs, régions Cameroun) |
| Import Centres | `/admin/centres/import` | Import CSV masse |
| Catalogue Médical | `/admin/catalogue` | Onglets : Catégories · Maladies · Premiers Soins |
| Import Catalogue | `/admin/catalogue/import` | Import CSV masse |
| Avis & Modération | `/admin/avis` | Avis signalés avec Dismiss / Supprimer |
| Paramètres | `/admin/parametres` | Profil admin, infos plateforme |

---

## Géolocalisation des centres de santé

```http
GET /api/centres_de_santes/proches?lat={lat}&lng={lng}&rayon=25&limit=30
```

| Paramètre | Description |
|---|---|
| `lat` | Latitude réelle de l'utilisateur |
| `lng` | Longitude réelle de l'utilisateur |
| `rayon` | Rayon en kilomètres (défaut: 25) |
| `limit` | Nombre maximum de résultats (défaut: 30) |

La formule **Haversine** est implémentée directement en SQL dans `CentreDeSanteRepository`.

---

## Temps réel (WebSocket)

Le système temps réel utilise **uniquement WebSocket** (Node.js) :

1. Client → `POST /api/messages` (contenu + destinataire)
2. `MessageProcessor.php` persiste le message en base
3. `MessageProcessor.php` dispatche `WebSocketNotification` via Messenger
4. `WebSocketNotificationHandler` appelle `WebSocketNotifier`
5. `WebSocketNotifier` POST sur `http://127.0.0.1:8082/publish`
6. Le serveur WebSocket notifie les clients connectés
7. Le frontend reçoit via `useWebSocket` (backoff exponentiel, reconnexion auto)

### Notifications consultations

- Authentification par message JWT `{ "type": "auth", "token": "eyJ..." }`
- Vérification RSA côté serveur avec `jsonwebtoken`
- Événements : `consultation.created`, `consultation.accepted`, `consultation.closed`
- Le hook `useWebSocket` côté frontend envoie l'auth handshake sur `onopen` et flush les messages en attente sur `auth_ok`

---

## Données structurées (JSON en base)

| Champ | Type | Exemple |
|---|---|---|
| `allergies` | JSON | `["Pénicilline", "Aspirine"]` |
| `contacts_urgence` | JSON | `[{"nom":"Mère","telephone":"+237...","lien":"parent"}]` |
| `disponibilites` | JSON | `[{"jour":"Lundi","debut":"08:00","fin":"17:00"}]` |

La méthode `isDisponibleMaintenant()` de l'entité `Medecin` exploite le JSON structuré
pour calculer si un médecin est disponible à l'instant T.

---

## Créer un administrateur

### Via commande Symfony (recommandé)

```bash
php bin/console app:create-admin admin@medisecours.com Admin@2026!
# Avec options
php bin/console app:create-admin admin@medisecours.com Admin@2026! --nom=Admin --prenom=Super
```

Si l'utilisateur existe déjà, la commande met à jour son mot de passe et ajoute `ROLE_ADMIN`.

### Via fixtures

```bash
php bin/console doctrine:fixtures:load
```

---

## Validation médecin

```http
PATCH /api/admin/medecins/{id}/validation
Authorization: Bearer <token_admin>
Content-Type: application/json

{ "estValide": true }
```

---

## Design system frontend

Défini dans `src/app/globals.css` via la syntaxe Tailwind CSS 4 `@theme` :

```css
@theme {
  --color-primary-50:  #EAF0F7;
  --color-primary-100: #CBDBEA;
  --color-primary-300: #6F94B8;
  --color-primary-500: #1E3A5F;   /* bleu médical principal */
  --color-primary-700: #152A45;
  --color-primary-900: #0C1A2C;   /* fond sidebar admin */
  --color-mint-100:    #D1FAE5;
  --color-mint-500:    #10B981;   /* actions positives */
  --color-mint-700:    #047857;
  --color-urgence-100: #FEE2E2;
  --color-urgence-500: #EF4444;   /* urgences */
  --color-urgence-700: #B91C1C;
  --color-sable:       #F6F3EC;   /* fond clair */
  --font-display: "Plus Jakarta Sans", sans-serif;
  --font-sans:    "Inter", sans-serif;
  --shadow-glass: 0 8px 32px 0 rgba(30,58,95,0.15);
}
```

---

## Commandes utiles

### Backend

```bash
# Migrations
php bin/console doctrine:migrations:migrate
php bin/console doctrine:migrations:status
php bin/console doctrine:schema:validate

# Cache
php bin/console cache:clear
php bin/console cache:warmup

# Vérifications
php bin/console lint:yaml config
php bin/console lint:container
php bin/console lexik:jwt:check-config
php bin/console debug:router

# Admin
php bin/console app:create-admin admin@medisecours.com Admin@2026!

# Fixtures
php bin/console doctrine:fixtures:load

# Tests
vendor/bin/phpunit
```

### Frontend

```bash
npm run dev        # serveur de développement (Turbopack)
npm run build      # build de production
npm run start      # serveur de production
npm run lint       # ESLint
npx tsc --noEmit   # vérification TypeScript
```

---

## Tests

```
Backend  : 34 tests, 34 assertions — PHPUnit
Frontend : build production OK, 0 erreur TypeScript, 0 erreur ESLint
```

| Fichier | Couverture |
|---|---|
| `AuthTest.php` | Login, register, Google OAuth, verify-email, reset-password |
| `ConsultationTest.php` | Création, accès filtré par rôle |
| `MessageTest.php` | Envoi, accès restreint expéditeur/destinataire |
| `SecurityTest.php` | Accès public/protégé, rate limiting, legacy 410 |

---

## Notes de sécurité

- Ne jamais versionner les secrets de production (`.env`, `private.pem`).
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` est public par nature — normal.
- En production, remplacer la règle CORS `localhost` par votre domaine réel.
- Les clés JWT de production doivent être générées séparément du développement.
- Changer `Admin@2026!` avant toute démonstration ou déploiement public.
- En production, géolocalisation nécessite **HTTPS** (obligation navigateurs modernes).
- Le serveur WebSocket doit être séparé en production (auth par message JWT obligatoire).

---

## Dépannage

### Erreur 500 sur `/api/me/dashboard`

1. Vérifier le token JWT : `php bin/console lexik:jwt:check-config`
2. Vérifier la base : `php bin/console doctrine:migrations:migrate`
3. Le médecin doit être validé (`estValide: true`) et avoir `ROLE_MEDECIN`
4. Vérifier les logs : `symfony serve` affiche les erreurs en dev

### Google `origin_mismatch`

Ajouter dans Google Cloud Console → Origines JavaScript autorisées :
```
http://localhost:3000
http://127.0.0.1:3000
```

### JWT invalide / erreur 401

```bash
php bin/console lexik:jwt:check-config
```

### Position GPS indisponible

- Navigateur doit autoriser la localisation.
- GPS activé sur mobile.
- En production : HTTPS obligatoire.

### Erreur `Too many requests` (429)

Rate limiting actif. Attendre la fenêtre configurée :
- Login : 10/min
- Register : 5/h
- Reset password : 3/h

### WebSocket ne se connecte pas

- Vérifier que le serveur tourne : `node server/websocket-server.js`
- Vérifier que `jsonwebtoken` est installé dans `server/`
- Le token JWT doit être envoyé dans les 10 secondes après connexion

---

## Historique des corrections majeures

### 17/08/2026 — Internationalisation backend (i18n)

- **TranslationNormalizer** — normalizer Symfony qui intercepte chaque `Maladie`, `Categorie`, `PremierSoin` sérialisé par API Platform et remplace dynamiquement les champs français par les versions anglaises (`nomEn`, `descriptionEn`, etc.) lorsque l'en-tête `Accept-Language: en` est envoyé
- **TranslateDatabaseCommand** — commande Symfony (`app:translate-database`) qui traduit automatiquement tous les champs texte de la BDD en anglais via Google Translate (1 145 maladies, 513 protocoles, 26 catégories)
- **ContentLocalizer + LocaleResolver** — services dédiés à la résolution de la langue demandée via `Accept-Language` et à la sélection du contenu localisé (français/anglais) pour les protocoles de premiers gestes publics
- **Prescription state machine** — ajout de `input: false` et `read: false` sur les endpoints `/sign`, `/send`, `/cancel`, `/replace` pour corriger le bug des prescriptions bloquées en statut BROUILLON

### 25/07/2026 — Refonte Dashboard Médecin

- **MedecinDashboardService** — agrégats SQL pur (COUNT/GROUP BY), aucun hydratation entité inutile
- **MedecinDashboardController** — réponse JSON enrichie (statusCounts, alerts, timeline, allergies)
- **Fix SQL** : `DISTINCT` sur colonne JSON → cast `::text`; `ORDER BY` avec DISTINCT → `GROUP BY + MAX()`
- **Fix controller** : `$this->container->getParameter()` → `$this->getParameter()` (AbstractController)
- **Layout par urgence médicale** — Row1=Alertes critiques, Row2=KPIs, Row3=File active, Row4=Insights, Row5=Outils
- **Props frontend corrigées** pour tous les composants dashboard
- **WebSocket sécurisé** — auth par message JWT (plus de token en query string), timeout 10s
- **TypeScript** — 0 erreurs, 0 warnings ESLint
- Composants supprimés : DashboardSatisfaction (doublon), DonutChart (dead code), Chart.tsx

### 03/07/2026 — Dashboard Admin complet

- Dashboard admin séparé — layout dédié, sidebar sombre, route guard ROLE_ADMIN
- 7 pages admin avec imports CSV
- Graphique Recharts, validation médecins, CRUD centres, modération avis

### 02/07/2026 — Sécurité & Scalabilité

- Rate limiting, vérification email, reset password
- Entité `Avis`, `UserSerializer` centralisé, `MedecinVoter`
- 34 tests PHPUnit

### 30/06/2026 — Fondations

- Architecture Symfony + API Platform complète
- Authentification JWT + Google OAuth
- Entités : User/Patient/Medecin, Maladie/Categorie, CentreDeSante, Message, Consultation
- Géolocalisation Haversine SQL

---

## Modèles Backend — Entités Doctrine (détaillé)

Cette section décrit **chaque entité** (modèle Doctrine ORM) du backend. Chaque entité est mappée à une table PostgreSQL et exposée via API Platform.

---

### 🔐 Système Utilisateur (Héritage Single Table)

Les quatre entités suivantes partagent une **seule table `user`** en base de données via l'héritage Doctrine `SINGLE_TABLE`. Une colonne discriminateur `type` (`patient`, `medecin`, `admin`) détermine le type réel de chaque enregistrement. Cela optimise les jointures et unifie l'authentification JWT.

#### 1. `User` (classe abstraite)

| Aspect | Détail |
|---|---|
| **Rôle** | Entité racine pour l'authentification (JWT), la sécurité Symfony et les profils communs |
| **Table** | `user` (partagée par Patient, Medecin, Admin) |
| **ID** | UUID v4 (généré automatiquement par Doctrine) |

**Champs principaux :**

| Champ | Type | Description |
|---|---|---|
| `email` | string(180), unique | Adresse email de connexion |
| `roles` | JSON array | Rôles Symfony (`ROLE_USER`, `ROLE_PATIENT`, etc.) |
| `password` | string (hashé) | Bcrypt, min 8 car., 1 majuscule, 1 minuscule, 1 chiffre, 1 spécial |
| `nom` / `prenom` | string(255) | Identité de l'utilisateur |
| `telephone` | string | Format camerounais validé : `+237 6XXXXXXXX` |
| `quartier` | string | Quartier de résidence |
| `photoProfil` | string | URL de la photo de profil |
| `actif` / `banni` | bool | Gestion du statut du compte |
| `estEnLigne` | bool | Indicateur de présence temps réel |
| `dernierePresence` | DateTimeImmutable | Dernière activité |
| `emailVerified` | bool | Vérification de l'adresse email |
| `emailVerificationToken` | string | Token de vérification (effacé après usage) |
| `passwordResetToken` | string | Token de réinitialisation du mot de passe |

**Relations :** `OneToMany` → Message (messages envoyés), `ManyToMany` → Conversation (fils de discussion)

---

#### 2. `Patient` (hérite de User)

| Aspect | Détail |
|---|---|
| **Rôle** | Fiche médicale d'urgence et données de santé du patient |
| **Discriminateur** | `type = 'patient'` |
| **Rôle auto** | `ROLE_PATIENT` ajouté automatiquement |

**Champs spécifiques :**

| Champ | Type | Description |
|---|---|---|
| `groupeSanguin` | string | Validé par regex : `A+`, `B-`, `AB+`, `O-`, etc. |
| `allergies` | JSON array | Ex: `["Pénicilline", "Arachides"]` |
| `contactsUrgence` | JSON array | Ex: `[{"nom":"Mère", "telephone":"+237...", "lien":"parent"}]` |

---

#### 3. `Medecin` (hérite de User)

| Aspect | Détail |
|---|---|
| **Rôle** | Praticien de santé avec pièces justificatives et disponibilités |
| **Discriminateur** | `type = 'medecin'` |
| **Rôle auto** | `ROLE_MEDECIN` |
| **Validation** | Doit être approuvé par un admin (`estValide: true`) |

**Champs spécifiques :**

| Champ | Type | Description |
|---|---|---|
| `specialite` | string | Ex: "Cardiologie", "Généraliste" |
| `numeroOrdre` | string | Identifiant à l'Ordre National des Médecins (ONMC) |
| `estValide` | bool (défaut `false`) | Validé par un administrateur |
| `typePieceIdentite` | string | `'CNI'` ou `'PASSPORT'` |
| `disponibilites` | JSON | `[{"jour":"lundi","debut":"08:00","fin":"17:00"}]` |

**Relations :** `OneToOne` → MediaObject (pièce identité recto), `OneToOne` → MediaObject (verso), `OneToOne` → MediaObject (selfie vérification)

**Méthodes clés :** `isDisponibleMaintenant()` — calcul en temps réel selon le fuseau `Africa/Douala`

---

#### 4. `Admin` (hérite de User)

| Aspect | Détail |
|---|---|
| **Rôle** | Super-utilisateur avec accès complet au dashboard admin |
| **Discriminateur** | `type = 'admin'` |
| **Rôle auto** | `ROLE_ADMIN` |

Pas de champs spécifiques — hérite de tous les champs et relations de `User`.

---

### 🏥 Catalogue Médical

#### 5. `Categorie`

| Aspect | Détail |
|---|---|
| **Rôle** | Classification des pathologies médicales par catégorie |
| **Table** | `categorie` |
| **Bilingue** | ✅ `nomEn`, `descriptionEn` |

**Champs principaux :**

| Champ | Type | Description |
|---|---|---|
| `nom` / `nomEn` | string(255) | Nom FR et EN |
| `description` / `descriptionEn` | text | Description FR et EN |
| `couleur` | string(7) | Code hexadécimal (`#1E3A5F`) |
| `icone` | string(100) | Nom d'icône pour le frontend |

**Relations :** `OneToMany` → Maladie, `OneToMany` → MediaObject (images)

---

#### 6. `Maladie`

| Aspect | Détail |
|---|---|
| **Rôle** | Fiche pathologique complète avec symptômes, causes, traitements |
| **Table** | `maladie` (1 145 enregistrements) |
| **Bilingue** | ✅ 7 champs traduits |
| **Recherche** | Full-text PostgreSQL via `MaladieSearchProvider` |

**Champs principaux :**

| Champ FR | Champ EN | Description |
|---|---|---|
| `nom` | `nomEn` | Nom de la maladie |
| `description` | `descriptionEn` | Description détaillée |
| `symptomes` | `symptomesEn` | Liste des symptômes |
| `precautions` | `precautionsEn` | Précautions à prendre |
| `traitement` | `traitementEn` | Protocole de traitement |
| `causes` | `causesEn` | Causes de la maladie |
| `typeAccident` | `typeAccidentEn` | Type d'accident (si applicable) |

| Champ | Type | Description |
|---|---|---|
| `niveauGravite` | string | `LÉGÈRE`, `MODÉRÉE`, `SÉVÈRE`, `CRITIQUE`, `VARIABLE` |
| `contagieux` | bool | Maladie transmissible |
| `urgence` | bool | Nécessite une intervention urgente |
| `isAccident` | bool | Catégorie accident |
| `patientVisible` | bool | Visible dans le catalogue patient |
| `patientPriority` | int | Ordre d'affichage pour les patients |

**Relations :** `ManyToOne` → Categorie, `OneToMany` → PremierSoin, `OneToMany` → MediaObject, `OneToMany` → MaladieSymptome

---

#### 7. `PremierSoin`

| Aspect | Détail |
|---|---|
| **Rôle** | Protocole de premiers soins rattaché à une maladie |
| **Bilingue** | ✅ `titreEn`, `descriptionEn`, `symptomesEn` |

**Champs principaux :**

| Champ FR | Champ EN | Description |
|---|---|---|
| `titre` | `titreEn` | Titre du protocole |
| `description` | `descriptionEn` | Instructions détaillées |
| `symptomes` | `symptomesEn` | Symptômes associés |

| Champ | Type | Description |
|---|---|---|
| `niveauUrgence` | string | `FAIBLE`, `MOYEN`, `ÉLEVÉ`, `CRITIQUE` |

**Relations :** `ManyToOne` → Maladie

---

#### 8. `Symptome`

| Aspect | Détail |
|---|---|
| **Rôle** | Catalogue unitaire de symptômes pour la recherche et le triage |

**Champs :** `nom`, `slug` (unique), `synonymes` (JSON array), `ordre` (priorité d'affichage)

**Relations :** `OneToMany` → MaladieSymptome

---

#### 9. `MaladieSymptome` (table de liaison pondérée)

| Aspect | Détail |
|---|---|
| **Rôle** | Relie une maladie à un symptôme avec un poids clinique |
| **Usage** | Moteur de triage diagnostique (`SymptomTriageService`) |

**Champs :**

| Champ | Type | Description |
|---|---|---|
| `poids` | int (1-10) | Coefficient clinique |
| `frequence` | string | `TRES_FREQUENT`, `FREQUENT`, `OCCASIONNEL`, `RARE` |
| `obligatoire` | bool | Symptôme pathognomonique (indispensable au diagnostic) |
| `contradictoire` | bool | Symptôme qui infirme la pathologie |
| `gravite` | string | Niveau de gravité associé |

**Relations :** `ManyToOne` → Maladie, `ManyToOne` → Symptome (contrainte unique sur le couple)

---

### 🩺 Consultations & Prescriptions

#### 10. `Consultation`

| Aspect | Détail |
|---|---|
| **Rôle** | Téléconsultation ou prise en charge entre un patient et un médecin |
| **Cycle de vie** | `OUVERTE` → `EN_COURS` → `TERMINEE` (ou `ANNULEE`) |

**Champs principaux :**

| Champ | Type | Description |
|---|---|---|
| `statut` | string | `OUVERTE`, `EN_COURS`, `TERMINEE`, `ANNULEE` |
| `priorite` | string | `NORMALE`, `URGENTE`, `CRITIQUE` |
| `motif` | string(255) | Raison de la consultation |
| `compteRendu` | text | Notes cliniques du médecin |
| `dateConsultation` | DateTimeImmutable | Date planifiée |
| `closedAt` | DateTimeImmutable | Rempli automatiquement quand `statut = TERMINEE` |

**Relations :** `ManyToOne` → Patient (obligatoire), `ManyToOne` → Medecin (nullable si non encore assigné), `OneToMany` → Message, `OneToMany` → Prescription

---

#### 11. `Prescription` (ordonnance médicale)

| Aspect | Détail |
|---|---|
| **Rôle** | Ordonnance numérique complète avec cycle de vie et signature |
| **Référence** | Unique, format `ORD-XXXXXXXXXX` (généré automatiquement) |
| **Cycle de vie** | `BROUILLON` → `SIGNEE` → `TRANSMISE` (ou `ANNULEE` / `REMPLACEE` / `EXPIREE`) |
| **Versioning** | Champ `version` + relation `supersededBy` pour le remplacement |

**Champs principaux :**

| Champ | Type | Description |
|---|---|---|
| `reference` | string(40), unique | Identifiant public de l'ordonnance |
| `diagnostic` | text | Diagnostic médical |
| `statut` | string | Machine à états (6 statuts possibles) |
| `recommandations` | text | Recommandations du médecin |
| `signedAt` | DateTimeImmutable | Horodatage de la signature |
| `sentAt` | DateTimeImmutable | Horodatage de la transmission |
| `cancelledAt` | DateTimeImmutable | Horodatage de l'annulation |
| `cancelReason` | text | Motif de l'annulation |
| `expiresAt` | DateTimeImmutable | Date d'expiration |
| `version` | int | Numéro de version |

**Relations :** `ManyToOne` → Consultation, `ManyToOne` → Medecin, `ManyToOne` → Patient, `OneToMany` → PrescriptionItem, `ManyToOne` → Prescription (`supersededBy`)

**Endpoints d'action :**

| Endpoint | Action | Transition |
|---|---|---|
| `POST /prescriptions/{id}/sign` | Signer | BROUILLON → SIGNEE |
| `POST /prescriptions/{id}/send` | Transmettre au patient | SIGNEE → TRANSMISE |
| `POST /prescriptions/{id}/cancel` | Annuler | BROUILLON/SIGNEE → ANNULEE |
| `POST /prescriptions/{id}/replace` | Remplacer | SIGNEE/TRANSMISE → REMPLACEE + nouvelle version |

---

#### 12. `PrescriptionItem` (ligne de médicament)

| Aspect | Détail |
|---|---|
| **Rôle** | Ligne unitaire de médicament au sein d'une prescription |

**Champs :**

| Champ | Type | Description |
|---|---|---|
| `nom` | string | Nom commercial ou DCI de la molécule |
| `posologie` | string | Schéma posologique |
| `duree` | string | Durée textuelle (ex: "7 jours") |
| `dureeJours` | int | Durée numérique en jours |
| `forme` | string | Comprimé, sirop, injectable, suppositoire, etc. |
| `dosage` / `unite` | int / string | Ex: 500 mg, 10 ml |
| `voieAdministration` | string | Orale, intraveineuse, cutanée, etc. |
| `frequence` | string | Ex: "3 fois par jour", "matin et soir" |
| `momentPrise` | string | "Pendant les repas", "à jeun" |
| `quantite` | int | Nombre de boîtes / flacons |
| `instructions` | text | Précautions particulières |
| `siBesoin` | bool | Médicament en cas de crise / douleur uniquement |

**Relations :** `ManyToOne` → Prescription

---

### 💬 Messagerie Temps Réel

#### 13. `Conversation`

| Aspect | Détail |
|---|---|
| **Rôle** | Fil de discussion entre plusieurs participants (1-to-1 ou groupe) |
| **Déduplication** | Clé unique `pairKey` (longueur 73) empêche les doublons de conversations directes |

**Champs :** `titre`, `pairKey` (unique), `createdAt`, `updatedAt`

**Relations :** `ManyToMany` → User (participants), `OneToMany` → Message, `ManyToOne` → Message (`dernierMessage` — pour le tri dans la liste)

---

#### 14. `Message`

| Aspect | Détail |
|---|---|
| **Rôle** | Message unitaire avec support multimédia et suppression douce |
| **Soft Delete** | `Gedmo\SoftDeleteable` — le message est marqué supprimé sans être effacé de la base |

**Constantes de statut :** `ENVOYE`, `LIVRE`, `LU`
**Types de message :** `TEXTE`, `VOIX`, `IMAGE`, `VIDEO`, `FICHIER`

**Champs principaux :**

| Champ | Type | Description |
|---|---|---|
| `contenu` | text (max 10 000 car.) | Corps du message |
| `typeMessage` | string | Type du média |
| `dureeVoix` | int | Durée en secondes (messages vocaux) |
| `estModifie` / `estTransfere` | bool | Indicateurs d'édition et de transfert |
| `supprimePourExpediteur` / `supprimePourDestinataire` | bool | Suppression unilatérale |

**Relations :** `ManyToOne` → User (expéditeur), `ManyToOne` → Conversation, `ManyToOne` → Consultation (nullable), `ManyToOne` → MediaObject (pièce jointe), `ManyToOne` → Message (`messageParent` — réponse)

---

### 🏥 Centres de Santé & Géolocalisation

#### 15. `CentreDeSante`

| Aspect | Détail |
|---|---|
| **Rôle** | Répertoire géoréférencé des établissements de santé au Cameroun |
| **Recherche** | Formule Haversine en SQL natif pour la proximité GPS |

**Types de centres :** `hopital_general`, `hopital_de_district`, `chu`, `cma`, `csi`, `clinique_privee`, `pharmacie`, `laboratoire`, `centre_specialise`

**Champs principaux :**

| Champ | Type | Description |
|---|---|---|
| `nom` | string | Nom de l'établissement |
| `type` | string | Type parmi les 9 types ci-dessus |
| `statut` | string | `public`, `prive`, `associatif` |
| `adresse`, `ville`, `quartier` | string | Localisation textuelle |
| `region` | string | 10 régions du Cameroun (Adamaoua, Centre, Est, etc.) |
| `latitude` / `longitude` | float | Coordonnées GPS (WGS84) |
| `telephone`, `email`, `siteWeb` | string | Coordonnées de contact |
| `horaires` | string | Heures d'ouverture |
| `specialites` / `services` | JSON array | Spécialités et services offerts |
| `estActif` | bool | Centre en activité |
| `urgences24h` | bool | Urgences disponibles 24h/24 |
| `distance` | float (virtuel) | Calculé à la volée par la recherche Haversine (non persisté) |

**Relations :** `OneToMany` → MediaObject (images)

---

### ⭐ Avis & Signalements

#### 16. `Avis`

| Aspect | Détail |
|---|---|
| **Rôle** | Évaluation laissée par un patient à un médecin |

**Champs :** `note` (int 1-5), `commentaire` (text 10-2000 car.), `signale` (bool), `raisonSignalement` (string)

**Relations :** `ManyToOne` → Patient, `ManyToOne` → Medecin

---

#### 17. `SignalementMedecin`

| Aspect | Détail |
|---|---|
| **Rôle** | Signalement formel déposé par un patient contre un praticien |

**Motifs possibles :** `COMPORTEMENT_INAPPROPRIE`, `FAUSSE_INFORMATION`, `HARCELEMENT`, `NEGLIGENCE`, `FRAUDE`, `AUTRE`
**Statuts de traitement :** `NOUVEAU`, `EN_COURS`, `TRAITE`, `REJETE`

**Champs :** `motif`, `description`, `statut`, `noteAdmin` (notes internes), `traiteAt`

**Relations :** `ManyToOne` → Patient, `ManyToOne` → Medecin

---

### 🆘 Protocoles Premiers Gestes (API publique)

#### 18. `ProtocolePremiersGestes`

| Aspect | Détail |
|---|---|
| **Rôle** | Protocole d'urgence de premiers secours, versionné et bilingue |
| **Table** | `protocole_premiers_gestes` (513 enregistrements) |
| **Bilingue** | ✅ `titreEn`, `restrictionsPopulationsEn`, `sourceCliniqueEn` |
| **Cycle publication** | `BROUILLON` → `EN_REVUE` → `PUBLIE` (ou `RETIRE`) |

**Champs principaux :**

| Champ | Type | Description |
|---|---|---|
| `slug` | string (unique avec `version`) | Identifiant URL-friendly |
| `titre` / `titreEn` | string | Titre FR et EN |
| `version` | string | Ex: "1.0", "2.0" |
| `statut` | string | Cycle de publication |
| `niveauUrgence` | string | `FAIBLE`, `MOYEN`, `ELEVE`, `CRITIQUE` |
| `population` | string | `TOUS`, `ADULTE`, `ENFANT`, `NOURRISSON`, `FEMME_ENCEINTE` |
| `categorie` | string | Catégorie de protocole |
| `masterSlug` / `variantKey` | string | Gestion des variantes d'un même protocole |
| `restrictionsPopulations` / `En` | text | Contre-indications FR et EN |
| `sourceClinique` / `En` | text | Références médicales FR et EN |

**Relations :** `OneToMany` → ProtocoleEtape (étapes ordonnées, cascade persist/remove, orphanRemoval)

**Méthodes clés :** `compareVersions()`, `nextVersion()`, `duplicateAsNewVersion()`

---

#### 19. `ProtocoleEtape`

| Aspect | Détail |
|---|---|
| **Rôle** | Étape chronologique d'un protocole de premiers gestes |
| **Bilingue** | ✅ `titreEn`, `instructionEn` |

**Champs :** `position` (rang), `type` (ex: `FAIRE`, `EVITER`, `APPELER`, `SURVEILLER`, `RECONNAITRE`, `PROTEGER`), `titre`/`titreEn`, `instruction`/`instructionEn`

**Relations :** `ManyToOne` → ProtocolePremiersGestes

---

### 📎 Fichiers & Médias

#### 20. `MediaObject`

| Aspect | Détail |
|---|---|
| **Rôle** | Gestion des fichiers téléversés (VichUploader) avec fallback base64 |
| **Usages** | `general`, `identity_document`, `identity_photo` |

**Champs :** `filePath`, `originalName`, `mimeType`, `size`, `data` (contenu base64), `isPublic`, `purpose`

**Relations :** `ManyToOne` → User, `ManyToOne` → CentreDeSante, `ManyToOne` → Categorie, `ManyToOne` → Maladie

---

### 🔔 Notifications

#### 21. `Notification`

| Aspect | Détail |
|---|---|
| **Rôle** | Notifications in-app pour les utilisateurs |

**Champs :** `type` (string 80 car.), `title` (string 160 car.), `body` (text), `link` (URL in-app), `readAt` (null si non lue)

**Relations :** `ManyToOne` → User (destinataire)

---

### 🔒 Sécurité & Audit

#### 22. `RefreshToken`

| Aspect | Détail |
|---|---|
| **Rôle** | Gestion des refresh tokens JWT avec rotation et détection de replay |

**Champs :** `tokenHash` (SHA-256 unique), `family` (identifiant de famille pour invalider la chaîne en cas de replay), `expiresAt`, `revokedAt`

**Relations :** `ManyToOne` → User

**Méthodes :** `revoke()`, `isUsable()`

---

#### 23. `ProtocoleConsultation`

| Aspect | Détail |
|---|---|
| **Rôle** | Journal anonyme des consultations de protocoles (audit sans données personnelles) |

**Champs :** `slug`, `version`, `consultedAt`

---

#### 24. `ProtocoleRechercheStat`

| Aspect | Détail |
|---|---|
| **Rôle** | Statistiques journalières agrégées sur les recherches de protocoles |

**Champs :** `statDate`, `totalCount`, `withResultCount`, `withoutResultCount`

---

#### 25. `ReferenceDataVersion`

| Aspect | Détail |
|---|---|
| **Rôle** | Versioning des jeux de données de référence (read-only) |

**Champs :** `dataset` (PK), `catalogVersion`, `appliedAt`

---

### 📊 Diagramme des Relations

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│   User   │     │  Admin   │     │ Patient  │
│(abstract)│◄────│          │     │          │
│          │◄────│          │     │groupeSang│
│  email   │     └──────────┘     │allergies │
│  roles   │                      │contacts  │
│  nom     │◄────┌──────────┐     └──────────┘
│  prenom  │     │ Medecin  │
│  tel     │     │specialite│
└────┬─────┘     │estValide │
     │           │disponib. │
     │           └──────────┘
     │
     ├── OneToMany ──► Message
     ├── ManyToMany ──► Conversation
     └── OneToMany ──► Notification

┌────────────┐     ┌────────────┐     ┌──────────────┐
│ Categorie  │◄────│  Maladie   │────►│ PremierSoin  │
│ nom/nomEn  │     │ nom/nomEn  │     │ titre/titreEn│
│ description│     │ description│     │ description  │
│ couleur    │     │ symptomes  │     │ niveauUrgence│
│ icone      │     │ traitement │     └──────────────┘
└────────────┘     │ niveauGrav │
                   └─────┬──────┘
                         │
                         ├── OneToMany ──► MaladieSymptome ──► Symptome
                         └── OneToMany ──► MediaObject

┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│ Consultation │────►│ Prescription │────►│ PrescriptionItem │
│ patient      │     │ reference    │     │ nom (molécule)   │
│ medecin      │     │ diagnostic   │     │ posologie        │
│ statut       │     │ statut       │     │ dosage / unité   │
│ motif        │     │ signedAt     │     │ forme / voie     │
│ priorite     │     │ version      │     │ fréquence        │
│ compteRendu  │     └──────────────┘     └──────────────────┘
│ messages     │
└──────────────┘

┌───────────────────────┐     ┌──────────────┐
│ProtocolePremiersGestes│────►│ProtocoleEtape│
│ slug / version        │     │ position     │
│ titre / titreEn       │     │ type         │
│ niveauUrgence         │     │ instruction  │
│ population            │     │ instructionEn│
│ statut (publication)  │     └──────────────┘
└───────────────────────┘
```

---

## Date de mise à jour

Documentation mise à jour le **17/08/2026**.

