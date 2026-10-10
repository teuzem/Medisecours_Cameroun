# MediSecours — Système de design « Protocole mural »

Contrat complet : `docs/design-direction-contract.md`. Ce document résume le système appliqué.

## Principe

Une affiche de protocole de secours affichée sur un mur : papier sable, feuilles
blanches à angles droits, encre navy, bandes d'instructions pleines. Le mint dit
« agir / OK ». Le rouge est réservé aux avertissements vitaux (119, danger
immédiat, critique). Chaleureux et rassurant pour le public camerounais, jamais
glacial.

## Palette (tokens dans `src/app/globals.css`, échelle `@theme` Tailwind v4)

| Rôle      | Jetons                                        | Valeurs clés                          |
| --------- | --------------------------------------------- | ------------------------------------- |
| Navy      | `primary-50…900`                              | 500 `#1E3A5F`, 600 `#1A3252`, 900 `#0C1A2C` |
| Mint      | `mint-50…900`                                 | 500 `#10B981`, 400 `#34D399`          |
| Urgence   | `urgence-*` / Tailwind `red-*`                | 500 `#EF4444`                         |
| Sable     | `--color-sable`                               | `#F6F3EC` (fond des pages publiques)  |
| Neutres   | gris Tailwind                                  | jamais teintés bleu                   |

Sub-variables des dashboards : `--dashboard-bg/surface/text/accent…` (clair =
sable + navy ; sombre = navy profond + accent mint).

## Typographie

- Display : **Archivo** (500–800), titres, `font-display`.
- Texte : **Source Sans 3** (400–700), corps, `font-sans`.
- Polices **auto-hébergées** (woff2 dans `src/app/fonts/`) — aucune police
  tierce distante.
- Échelle : display max 6rem ; mesure du corps 65–75ch ; `tabular-nums` sur les
  chiffres.

## Forme

- Rayons : `--radius-xs` 1px à `--radius-4xl` 8px (les anciens 16–32px sont
  écrasés). Pastilles `rounded-full` réservées aux badges d'état et aux pastilles
  de marqueur/carte.
- Ombres : décalées navy (`--shadow-*`), jamais de halo à offset zéro.
- Contrastes cibles : texte 4,5:1, gros titres et éléments graphiques 3:1.
  Jamais de petit texte blanc sur rouge ou sur mint.

## Composants

- Boutons primaires : navy plein ou mint plein avec texte navy foncé ; fantôme =
  bordure navy 2px, angle droit.
- Badges/statuts : pastilles, couleurs sémantiques.
- Surfaces : feuille blanche (clair) / navy profond (sombre), bordure 1px.
- `SectionHeader` : pas d'eyebrow kicker ; le texte de soutien est une phrase
  normale.
- Bannière SOS (rouge plein) et bandeaux « 119 » : bandes d'instruction, seule
  utilisation autorisée du rouge en fond.

## Interdits (craft floor)

Kickers/eyebrows décoratifs, tracking > 0,05em sur les libellés, texte en
dégradé, verre décoratif, ombres halo, emoji en guise d'icône, fontes hébergées
chez un tiers, cartes « icône + titre + texte » comme structure de page,
dégradés bleus/violets/indigo (héritage SaaS), hexes codés en dur hors presets
d'accueil d'établissement.

## Modes

- **Clair** : fond `sable`, encre `primary-900`.
- **Sombre** (`.dark` sur `<html>`) : fond navy profond, accent mint.
- **Dashboards** (`.dashboard-theme`, admin + médecin + modales) : couche CSS qui
  reconvertit les anciennes classes héritées (`bg-[#0f2418]`, `bg-[#3B6EF8]`,
  gris Google…) vers les variables du thème ; les tokens `primary-500` passent à
  l'accent en mode sombre via les règles dédiées de `globals.css`.
- **Carte** (`src/app/carte/maps.css`) : variable `--maps-blue` rebindée en navy
  ; états actifs, chips et popups en rayon 4px.

## Sources de vérité

- `PRODUCT.md` (racine du dépôt) — produit.
- `docs/design-direction-contract.md` — contrat de direction.
- `src/app/globals.css` — tokens, thèmes, conversions.
- `src/app/carte/maps.css` — carte.
- `src/app/fonts/` — Archivo + Source Sans 3.
