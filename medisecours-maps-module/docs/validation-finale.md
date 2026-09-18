# Validation fonctionnelle MediSecours

La reconstruction a été validée sur la prévisualisation publique du projet. Le composant `Map.tsx` fourni par le modèle est conservé sans modification et les services Maps du compte sont utilisés par son proxy d’authentification.

| Parcours contrôlé | Résultat observé | Validation |
|---|---|---|
| Carte interactive et marqueurs | La carte Google Maps s’initialise sur la prévisualisation publique, affiche les tuiles et regroupe les marqueurs d’établissements. | Validé |
| Recherche Places | La recherche et le chargement des catégories médicales affichent les formations sanitaires de la zone, avec leurs détails consultables. | Validé |
| Fiche établissement | L’ouverture d’un établissement révèle la fiche, les actions de contact et le bouton d’itinéraire. | Validé |
| Google Directions | Les constructeurs `DirectionsService` et `DirectionsRenderer` sont disponibles ; un itinéraire entre deux points publics de Yaoundé retourne un statut `OK`, une distance de 4,1 km et une durée de 9 min. | Validé |
| Alerte de secours | Une demande de prise en charge déclenche automatiquement `notifyOwner`. Le test vérifie notamment l’alerte d’urgence, sans inclure la note clinique du patient. | Validé |
| Interface mobile | Les contrôles, catégories et liste d’établissements restent accessibles dans une vue mobile de 375 × 812 px. | Validé |

La suite Vitest compte 31 tests réussis répartis sur 13 fichiers ; la vérification TypeScript se termine sans erreur. La migration `0001_slow_lionheart` a créé les tables métier de MediSecours, dont `facilities`, `care_requests` et `patient_notifications`.

> La demande de secours enregistre le signalement, puis notifie immédiatement le propriétaire via le canal opérationnel du projet. La notification ne reprend pas la note clinique libre de l’utilisateur.
