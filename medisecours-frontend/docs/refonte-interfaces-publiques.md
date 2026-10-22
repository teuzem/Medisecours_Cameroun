# Refonte des interfaces publiques — feuille de route exhaustive

Charte : **palette plateforme conservée** (navy `primary`, mint `mint`, sable
`--color-sable`) et **logo officiel image** (`public/brand/medisecours-logo.png`).
Les techniques empruntées aux produits financiers modernes (mesh de dégradé,
verre, cartes à rayon doux, maquette produit) sont ré-encodées dans nos
couleurs, jamais dans une palette étrangère.

Contraintes transverses :

- aucune couleur de marque extérieure aux tokens `primary` / `mint` / `sable` ;
- le logo officiel reste la seule marque (pas de logotype texte) ;
- tout contenu visible passe par `useTranslation()` (FR + EN) ;
- les données affichées sont **live** (API + WebSocket), jamais figées ;
- `tsc`, ESLint, tests i18n et build doivent rester verts.

---

## 0. Fondations design — FAIT

- [x] Tokens de surfaces de marque (`--color-ms-*`, `--radius-ms-*`, `--shadow-ms-*`)
      dans `src/app/globals.css` (`@theme`).
- [x] Couche `.ms-*` : `.ms-mesh` (dégradés diffus navy/mint), `.ms-card`
      (+ `--hover`, `--glass`, `--dark`), `.ms-btn` (+ `--primary`,
      `--secondary`, `--ghost`), `.ms-logo-wall`, `.ms-logo`, `.ms-code`,
      `.ms-display`, `.ms-lede`.
- [x] `BrandLogo` : composant unique qui rend le logo officiel, partagé par
      Navbar et Footer (dimensions, priorité de chargement, `alt`).
- [ ] `docs/design-direction-contract.md` : aligner le contrat sur la nouvelle
      couche de marque (le contrat interdit aujourd'hui le verre et les
      dégradés, que la refonte réintroduit — en couleur plateforme).

## 1. Accueil (`src/app/page.tsx`) — À REFONDER

- [ ] **Hero** : titre display, phrase d'accroche, deux CTA, maquette produit
      (`.ms-code`) et fond `.ms-mesh`. Plus de carrousel plein écran.
- [ ] **Bandeau de réassurance** : 4 preuves chiffrées, tirées de l'API
      (établissements référencés, médecins, communes couvertes) — live.
- [ ] **Section « Les 4 postes »** : patient, médecin, personnel, établissement —
      4 cartes, chacune avec son lien vers l'espace réel.
- [ ] **Section « Une chaîne, pas des silos »** : le parcours
      admission → dossier → consultation → soins → pharmacie, en 5 étapes
      visuelles.
- [ ] **Section « Établissements qui nous font confiance »** : logo wall alimenté
      par `GET /api/carte/etablissements` (12 premiers, `logoUrl`), chaque logo
      cliquable vers `/carte?centre=<id>` (ouverture de la fiche sur la carte).
- [ ] **Détourage des logos** : `removeImageBackground` côté client sur les
      logos same-origin (le fond blanc disparaît), `mix-blend-mode: multiply`
      en repli pour les logos externes (suppression de l'effet noir sur blanc
      au survol).
- [ ] **Section SOS** : bandeau d'urgence, rappel du circuit, états live
      (interventions en cours via WebSocket `sos_*`).
- [ ] **Section « Données, pas illusions »** : chiffres du réseau, mise à jour
      en direct.
- [ ] **CTA de clôture** : double action (créer un compte / devenir
      partenaire), sur fond navy.
- [ ] `metadata` de la page (SEO titre + description), absente aujourd'hui.

## 2. Pages légales — À CRÉER

Routes nouvelles, contenu dynamique (données de l'entreprise issues de
l'API quand elles existent) :

- [ ] `/mentions-legales` : éditeur, hébergeur, contact, responsable de
      publication.
- [ ] `/confidentialite` : données collectées, finalités, base légale,
      durées, droits d'accès, partages (SOS, personnel de santé).
- [ ] `/conditions` : objet, comptes (patient / médecin / personnel /
      établissement), obligations, responsabilité, litiges, droit applicable.
- [ ] Composant partagé `src/components/legal/LegalPage.tsx` : sommaire
      ancré, sections, dernière révision, impression.
- [ ] Liens dans le pied de page (sections Services / Contact).

## 3. Pages statiques — À DYNAMISER

- [ ] `/guide-utilisation` : parcours par rôle, recherche dans le guide.
- [ ] `/premiers-soins` (+ `[slug]`) : filtres par situation, recherche
      instantanée, protocole affiché en accordéon avec les gestes clés.
- [ ] `/maladies` (+ `[id]`) : recherche, filtres, fiches reliées aux
      consultations et aux premiers soins.
- [ ] `/categories` (+ `[id]`) : catalogue, compteurs live.
- [ ] `/centres` : recherche, filtres, fiches ; réconcilier l'endpoint
      `/api/centre_de_santes` avec `/api/carte/etablissements`.
- [ ] `/medecins` (+ `[id]`) : annuaire, pagination, notes, avis en direct.
- [ ] `/sos` : entrée de mise en relation, états live.

## 4. Tableaux de bord — À FINALISER

- [ ] **Patient** (`/patient`) : shell `.dashboard-theme`, KPI, actions
      rapides, analytics Recharts, établissements proches ; **s'abonner au
      WebSocket** (la page ne l'est pas aujourd'hui : les compteurs de
      messages/consultations ne se rafraîchissent pas en direct).
- [ ] **Médecin** (`/medecin`) : monter les 12 composants `medecin/dashboard/*`
      aujourd'hui orphelins (`DashboardTimeline`, `DashboardFunnel`,
      `DashboardAlerts`, `DashboardRiskPatients`, `DashboardRecentPatients`,
      `DashboardUpcomingAppointments`, `DashboardBloodAllergies`,
      `DashboardMotifsCloud`, `DashboardPresenceStatus`,
      `DashboardRatingsDistrib`, `DashboardCatalogueSearch`) ; supprimer ceux
      qui ne sont pas retenus.
- [ ] **Personnel** : fait (courbe 14 jours, répartition, notation) —
      uniformiser la coque avec le médecin (composants `.dashboard-*`).
- [ ] **Établissement** : idem, une coque de dashboard commune.
- [ ] **Admin** : idem.

## 5. Coque et navigation partagées

- [ ] Extraire une coque de dashboard commune (`DashboardShell` : en-tête,
      latéral, sections, thème) réutilisée par patient / médecin / personnel /
      établissement / admin.
- [ ] `SectionHeader` enrichi (sous-titre, action, icône) pour les
      dashboards sans casser les usages existants.
- [ ] États vides, squelettes et erreursuniformes sur toutes les pages
      publiques (aujourd'hui chaque page gère les siens).

## 6. Temps réel

- [ ] Inventaire des événements WebSocket consommés par page ; chaque page
      concerned doit revalider ses données.
- [ ] Indicateur de connexion dans la barre de navigation (`useWsStatus`).
- [ ] Compteurs live sur l'accueil (SOS en cours, messages non lus).

## 7. Performance et qualité

- [ ] `next/image` partout (images d'établissement, photos de profil).
- [ ] Préchargement de la maquette produit (LCP), `priority` sur le logo.
- [ ] `loading="lazy"` sur les logos du logo wall.
- [ ] Budget : aucune requête de logo ne dépasse 40 Ko.
- [ ] Audit Lighthouse sur l'accueil (cible : LCP < 2,5 s, CLS < 0,1).
- [ ] `npm run build` vert (inclut le contrôle de syntaxe PHP du backend).

## 8. Contenus et i18n

- [ ] Relecture FR des nouveaux textes (registre simple, sans jargon
      médical inutile), puis traduction EN stricte.
- [ ] Clés i18n ajoutées dans les deux langues en même temps (le test
      `i18nKeys` échoue sinon).
- [ ] `visitor.landing.*` réécrite (l'ancienne arborescence carousel est
      abandonnée).
- [ ] `visitor.legal.*` créée.

## 9. Vérifications avant commit

- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `node --test src/lib/*.test.mjs`
- [ ] `npm run build` (donc `check:php`)
- [ ] Contrôle de la base : `php bin/console app:repair-schema --env=prod` puis
      `php bin/console doctrine:schema:validate` (consultatif, ne bloque pas
      le démarrage du conteneur).
- [ ] `GET /api/health` doit répondre `status: ok`, `schema: ok`.
