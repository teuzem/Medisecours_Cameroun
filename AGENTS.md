# Production Ownership

- The deployed frontend is `medisecours-frontend` (Next.js).
- The production map route is `medisecours-frontend/src/app/carte/page.tsx`.
- Its components are in `medisecours-frontend/src/components/carte`.
- The production API is `medisecours-backend` (Symfony).
- Do not implement production features in `medisecours-maps-module`.
  It is a read-only migration reference, not a deployed frontend.
- Before removing the reference, verify the migration checklist in
  `medisecours-frontend/docs/maps-consolidation.md`. Do not mark missing
  workflows complete or delete their source before replacement verification.
- Preserve Google/Forge, Mapbox, and Leaflet fallback behavior.
- A build passing does not prove a live deployment or a visual match.
