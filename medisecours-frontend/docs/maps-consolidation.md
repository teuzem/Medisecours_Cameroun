# Maps Consolidation

## Production Entry Points

The deployed map is the Next.js `/carte` route in `src/app/carte/page.tsx`.
It renders `MapsPanel`, `GoogleCarteMap`, `MapboxCarteMap`, or `CarteMap`.
Changes to the independent reference application are not
automatically visible on this route.

The reference directory is `../medisecours-maps-module`. No directory named
`Medisecours-maps-frontend` was found at the repository root.

## Architecture Constraint

The reference uses Wouter, tRPC, Drizzle, MySQL, and its own OAuth identity.
Production uses Next.js, Axios/SWR, Symfony, Doctrine, and production JWTs.
Do not copy the reference router or database schema into production.
Port behavior through production contracts and authenticated APIs.

## Transferred Changes

- The map starts without an automatically opened desktop results panel.
- The active search bar contains the hamburger and result-opening actions.
- The old drawer search field is hidden; the map search is the visible input.
- A hamburger overlay links to existing production routes.
- Establishment selection opens the production details drawer.
- The desktop details panel is flat and scrolls its complete content.
- The details panel now uses Presentation, Avis, and A propos tabs, a single
  outlined action row, a media cover, review summaries, review search/sorting,
  likes/sharing, directions, named local collections, and result thumbnails.
- Shared `/carte?centre={id}` links resolve and open the requested facility.
- Circular action icon styling is scoped to the production map.
- Google, Mapbox, and Leaflet markers share escaped label markup.
- The Mapbox popup uses text content instead of interpolated HTML.
- Leaflet no longer loads two competing street tile layers.
- Google and Mapbox zoom controls are positioned at bottom-right.
- A provider-aware Plan/Satellite control works with Google and Mapbox and
  explicitly disables satellite mode for Leaflet.
- Production CSP permits the Mapbox JavaScript host.
- Manual establishment registration has a debounced Cameroon location search:
  Google Places AutocompleteSuggestion when available, otherwise Mapbox
  geocoding when no Google provider loads.
- A selected address fills address, city, region, latitude, and longitude.
- Editing address, city, or region clears previously selected coordinates.
- Registration sends coordinates through the existing manual-establishment
  payload. Symfony validates numeric paired coordinates and Cameroon bounds
  and saves them using existing entity columns.
- Review images are accepted by an authenticated multipart Symfony endpoint,
  limited server-side to five JPEG/PNG/WebP files of 2 MiB each, linked to the
  review, and hidden from public download when the review is moderated out of
  the published state. Migration `Version20260918140000` adds this relation.
- Review aggregate refresh no longer marks an establishment verified as an
  unrelated side effect.

## Existing Production Equivalents

- Facility registry: `/admin/centres`.
- Facility review moderation: `/admin/avis` and `/espace-etablissement`.
- Owner facility media, team, dashboard, and sync: `/espace-etablissement`.
- Review submission: `/api/avis_etablissements`.
- Facility management APIs: `/api/carte/*`.
- Facility detail/gallery: existing fiche API and `MediaGallery`.
- SOS: production `SosModal` and its existing API.
- Directions: `useGoogleDirections` and `useWayfinding`.
- Saved/recent facilities: existing browser-local map lists.

Existing equivalents must still be tested against a running Symfony database;
this inventory is not an end-to-end validation.

## Required Before Reference Removal

1. Port Google Places live search, details, photos with attribution, pagination,
   similar facilities, quota cooldown, and cache behavior through production
   APIs. Do not mix independent reference facility IDs with Doctrine IDs.
2. Implement production authenticated named collections, private item notes,
   add/remove/bulk remove, wishlist, search history, and route history.
   Existing browser-local arrays are not equivalent to the reference account
   database. Define entities, ownership checks, migrations, and tests.
3. Verify the new review-image controller and migration in a PHP/Symfony
   runtime with PostgreSQL, including moderation and download permissions.
4. Transfer edit suggestions and moderation/audit workflows into Symfony.
5. Map reference clinical requests, appointments, timeline, notifications,
   and profile preferences to production patient APIs. Preserve privacy and
   role boundaries rather than introducing a second identity system.
6. Extend provider-neutral layers only when a provider really supports the
   requested traffic/transit data. Plan/Satellite is implemented; unavailable
   layers are not presented as functional.
7. Replace the current nearby-list shortcut and browser-local collections with
   reliable account-backed nearby and collection workflows.
8. Add a clearly identified illustrative fallback cover and verify media
   loading/errors. Do not present a generic photo as the real facility.
9. Transfer useful behavior tests into production tooling. Reference tRPC
   mocks cannot verify Symfony endpoints.
10. Verify desktop/mobile screenshots, keyboard behavior, provider failures,
    directions, registration, media validation, and ownership boundaries.
11. If the reference database was used separately, back it up and migrate
    its data explicitly. Never infer that the source code contains its data.
12. Search deployment configuration and source for remaining reference-path
    dependencies. Only then remove the reference directory and commit removal.

## Verification Performed

- `npx.cmd tsc --noEmit`: passed.
- `npm.cmd run build`: passed; `/carte`, `/register`, and
  `/espace-etablissement` are present in the generated production routes.
- Production preview: `/carte` returned HTTP 200 on `localhost:3103`.
- Marker escaping tests: 2 passed.
- `git diff --check`: passed for current working changes.
- PHP lint: unavailable because PHP is not installed in this environment.
- Playwright installation timed out, so browser screenshots were not produced.
- Live provider requests, database migration/writes, and Coolify rollout are
  not verified.

## Release Gate

This is a consolidation checkpoint, not a completed feature migration.
The reference must be retained until the required checklist has passed.
Rebuild the production frontend image for public Maps variables and CSP
changes; restarting an old frontend image does not apply source changes.
