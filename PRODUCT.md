# PRODUCT.md — MediSecours

## What this is

MediSecours is a public-health access platform for Cameroon: recognize an emergency,
take the right first action, find the nearest health facility, and reach a doctor
remotely. Three surfaces serve three audiences: the public (patients, bystanders),
doctors, and facility teams (directors/managers of centres, clinics, hospitals).

## Audience & scene

- **Primary:** a Cameroonian member of the public in a stressful, real situation —
  a family member collapsed, a child has fever, someone needs the nearest CSI/CMU —
  often on a mid-range Android phone, on mobile data, sometimes in daylight glare.
- **Secondary:** patients following a consultation; doctors validating requests and
  answering SOS alerts; facility staff running the map listing, team, and analytics.
- **State of mind:** urgent and uncertain for the public; procedural and focused for
  professionals. The interface must answer "what do I do now?" before it decorates.

## Unique mechanism

Turn a real-world health situation into a guided action chain: symptom triage →
first-gesture protocol → facility on the map → live SOS with camera proof and
establishment sirens → habilitated doctor take-charge. One continuous thread from
"something is wrong" to "the right structure is handling it".

## Product truths (never invented)

- Cameroon context: 10 regions, French/English, facility types (CSI, CMA, CHU,
  hôpital de district, cliniques privées, pharmacies, laboratoires), emergency
  number 119, Cameroonian geography fields.
- The platform guides and connects; it does not diagnose and replaces no emergency
  service. Disclaimers stay visible.
- Doctors are validated before activation; affiliation requests await facility
  approval; SOS decisions require habilitations.
- Map providers fall back Google/Forge → Mapbox → Leaflet; no key = degraded tiles
  is a known local state, not a bug.

## Brand commitments (pinned)

- Palette is pinned: navy `#1E3A5F`, mint/emerald `#10B981`, emergency red
  `#EF4444`, sand `#F6F3EC`. The rebrand changes form, type, grid, and rhythm —
  not the color identity.
- Emergency red is reserved for real urgency (SOS, critical states); it is never
  decoration.
- Failure criteria agreed with the owner: losing medical clarity (info hierarchy
  must read at a glance) or becoming too austere (the public-facing product must
  stay warm and reassuring).

## Non-goals

- No diagnosis claims, no invented prices/testimonials/coverage numbers.
- No dark-pattern urgency, no gamification of health.
- `deploiement/` stays an untracked French ops template; `medisecours-maps-module`
  stays a read-only migration reference.
