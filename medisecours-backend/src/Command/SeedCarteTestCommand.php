<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\AffiliationMedecin;
use App\Entity\AvisEtablissement;
use App\Entity\CentreDeSante;
use App\Entity\MediaObject;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Seed de carte : 10 établissements camerounais réels, coordonnées et champs
 * alignés au schéma CentreDeSante (enum type, régions, JSON listes).
 *
 * Enrichissement destiné aux tests complets du module Carte Santé :
 * horaires structurés, paiement/assurance/accessibilité, avis publiés,
 * affiliation du médecin de test, couvertures externes et galerie best-effort.
 *
 * Idempotent : un établissement est identifié par son googlePlaceId
 * « seed-carte-test-* » ; les avis ne sont créés que si l'établissement
 * n'en a aucun ; l'affiliation est créée une seule fois.
 */
#[AsCommand(
    name: 'app:seed-carte-test',
    description: 'Seed de test : 10 établissements camerounais réels pour la carte Santé.'
)]
class SeedCarteTestCommand extends Command
{
    private const GOOGLE_PLACE_PREFIX = 'seed-carte-test-';

    private const TEST_MEDECIN_EMAIL = 'medecin@test.com';

    /**
     * Horaires structurés 24h/24 (urgences) ou bureau (open/close).
     *
     * @param array<int, string> $closedDays jours fermés (ex. ['dimanche'])
     *
     * @return array{weekly: array<string, array{open: string, close: string, closed: bool}>, holidays: list<string>, exceptions: list<string>}
     */
    private static function weekly(string $open, string $close, array $closedDays = []): array
    {
        $days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
        $weekly = [];
        foreach ($days as $day) {
            $weekly[$day] = [
                'open' => $open,
                'close' => $close,
                'closed' => in_array($day, $closedDays, true),
            ];
        }

        return ['weekly' => $weekly, 'holidays' => ['1er janvier', '11 mai', '20 mai', '15 août', '1er octobre', '25 décembre'], 'exceptions' => []];
    }

    private static function alwaysOpen(): array
    {
        return self::weekly('00:00', '23:59');
    }

    /**
     * @var list<array<string, mixed>>
     */
    private const ETABLISSEMENTS = [
        [
            'slug' => 'pisam',
            'nom' => 'Polyclinique Internationale Sainte Anne-Marie (PISAM)',
            'type' => 'polyclinique',
            'adresse' => 'Rue Njo-Njo, Bonamoussadi',
            'quartier' => 'Bonamoussadi',
            'ville' => 'Douala',
            'region' => 'Littoral',
            'regionCode' => 'LT',
            'departement' => 'Wouri',
            'latitude' => 4.0215,
            'longitude' => 9.7155,
            'telephone' => '+237 233 40 33 30',
            'email' => 'contact@pisam.cm',
            'siteWeb' => 'https://www.pisam-hospital.com',
            'horaires' => '24h/24 — 7j/7',
            'horairesDetails' => self::alwaysOpen(),
            'description' => 'Polyclinique privée de référence à Douala : urgences 24h/24, maternité, chirurgie, imagerie, laboratoire et blocs modernes.',
            'specialites' => ['Urgences', 'Maternité', 'Chirurgie', 'Imagerie', 'Cardiologie'],
            'services' => ['Urgences 24h/24', 'Bloc opératoire', 'Échographie', 'Laboratoire', 'Pharmacie'],
            'accessibilite' => ['Parking privé', 'Accès handicapé', 'Ascenseur'],
            'paiement' => ['Espèces', 'Mobile Money', 'Carte bancaire'],
            'assurance' => ['CNPS', 'Assurances privées'],
            'parking' => ['Parking payant sur site'],
            'evacuationSanitaire' => ['Ambulance disponible'],
            'urgences24h' => true,
            'ambulancesDisponibles' => true,
            'priseRendezVous' => true,
            'teleconsultation' => true,
            'statut' => 'prive',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/Doctor_and_a_nurse_in_a_Hospital_room_Cameroun.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/Ophthalmologist_Hospital_Cameroon_11.jpg?width=960',
                'https://commons.wikimedia.org/wiki/Special:FilePath/Unit_Kangourou_H%C3%B4pital_Laquintinie_Cameroun_30.jpg?width=960',
            ],
            'avis' => [
                ['note' => 5, 'commentaire' => 'Accueil rapide aux urgences la nuit, personnel attentionné et bloc moderne.'],
                ['note' => 4, 'commentaire' => 'Maternité très suivie, délais d\'attente corrects en journée.'],
                ['note' => 5, 'commentaire' => 'Bonne prise en charge chirurgicale et résultats d\'analyses rapides.'],
            ],
        ],
        [
            'slug' => 'metropole',
            'nom' => 'Hôpital de la Métropole',
            'type' => 'hopital',
            'adresse' => 'Quartier Mvog-Ada, Yaoundé',
            'quartier' => 'Mvog-Ada',
            'ville' => 'Yaoundé',
            'region' => 'Centre',
            'regionCode' => 'CE',
            'departement' => 'Mfoundi',
            'latitude' => 3.8607,
            'longitude' => 11.5145,
            'telephone' => '+237 222 07 30 30',
            'email' => 'info@hopitalmetropole.cm',
            'siteWeb' => null,
            'horaires' => '24h/24 — 7j/7 (urgences)',
            'horairesDetails' => self::alwaysOpen(),
            'description' => 'Hôpital privé confessionnel de Yaoundé réputé pour sa maternité, sa pédiatrie, la médecine interne et un suivi patient rigoureux.',
            'specialites' => ['Maternité', 'Pédiatrie', 'Médecine interne', 'Chirurgie', 'Cardiologie'],
            'services' => ['Urgences 24h/24', 'Maternité', 'Laboratoire', 'Imagerie', 'Hospitalisation'],
            'accessibilite' => ['Parking', 'Accès principal de plain-pied'],
            'paiement' => ['Espèces', 'Mobile Money', 'Assurances'],
            'assurance' => ['CNPS', 'Assurances privées', 'Paiement direct'],
            'parking' => ['Parking gratuit patients'],
            'evacuationSanitaire' => ['Transert vers CHU si besoin'],
            'urgences24h' => true,
            'ambulancesDisponibles' => true,
            'priseRendezVous' => true,
            'teleconsultation' => false,
            'statut' => 'prive',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/Salle_d%27hospitalisation_H%C3%B4pital_Cameroun_08.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/Immunization_in_Cameroon_%2834692993536%29.jpg?width=960',
                'https://commons.wikimedia.org/wiki/Special:FilePath/Infirmi%C3%A8res_au_service_N%C3%A9onatologie_A_l%27h%C3%B4pital_Laquintinie_de_Douala_au_Cameroun_12.jpg?width=960',
            ],
            'avis' => [
                ['note' => 5, 'commentaire' => 'Maternité exceptionnelle, suivi de grossesse clair et rassurant.'],
                ['note' => 4, 'commentaire' => 'Pédiatrie sérieuse, files d\'attente mieux gérées qu\'ailleurs.'],
                ['note' => 5, 'commentaire' => 'Médecins expérimentés et dossier médical tenu à jour.'],
            ],
        ],
        [
            'slug' => 'chu-yaounde',
            'nom' => 'Centre Hospitalier Universitaire de Yaoundé',
            'type' => 'hopital_central',
            'adresse' => 'Rue Henri Dunant, Yaoundé',
            'quartier' => 'Hôpital',
            'ville' => 'Yaoundé',
            'region' => 'Centre',
            'regionCode' => 'CE',
            'departement' => 'Mfoundi',
            'latitude' => 3.8744,
            'longitude' => 11.5268,
            'telephone' => '+237 222 23 21 00',
            'email' => 'secretariat@chu-yde.cm',
            'siteWeb' => null,
            'horaires' => '24h/24 — 7j/7',
            'horairesDetails' => self::alwaysOpen(),
            'description' => 'CHU de référence nationale (Hôpital Central) : spécialistes, enseignement, chirurgie lourde, réanimation.',
            'specialites' => ['Chirurgie', 'Réanimation', 'Cardiologie', 'Oncologie', 'Neurologie'],
            'services' => ['Consultations spécialistes', 'Laboratoire', 'Imagerie', 'Pharmacie'],
            'accessibilite' => ['Parking', 'Accès ambulance'],
            'paiement' => ['Espèces', 'CNPS', 'Assurances'],
            'assurance' => ['CNPS', 'Assurances privées'],
            'parking' => ['Parking public autour'],
            'evacuationSanitaire' => ['Évacuations nationales'],
            'urgences24h' => true,
            'ambulancesDisponibles' => true,
            'priseRendezVous' => true,
            'teleconsultation' => false,
            'statut' => 'public',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/Infirmi%C3%A8res_au_service_N%C3%A9onatologie_A_l%27h%C3%B4pital_Laquintinie_de_Douala_au_Cameroun_12.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/Salle_d%27hospitalisation_H%C3%B4pital_Cameroun_08.jpg?width=960',
                'https://commons.wikimedia.org/wiki/Special:FilePath/M%C3%A9d%C3%A9cin_au_Laboratoire_Hopital_Douala_Cameroun.jpg?width=960',
            ],
            'avis' => [
                ['note' => 4, 'commentaire' => 'Référence nationale pour la chirurgie lourde, équipes spécialistes compétentes.'],
                ['note' => 3, 'commentaire' => 'Attente longue aux consultations, mais prise en charge sérieuse.'],
                ['note' => 4, 'commentaire' => 'Cardiologie et imagerie de bon niveau pour un hôpital public.'],
            ],
        ],
        [
            'slug' => 'chu-garoua',
            'nom' => 'Centre Hospitalier Universitaire de Garoua',
            'type' => 'hopital_central',
            'adresse' => 'Quartier Djarengol, Garoua',
            'quartier' => 'Djarengol',
            'ville' => 'Garoua',
            'region' => 'Nord',
            'regionCode' => 'NO',
            'departement' => 'Bénoué',
            'latitude' => 9.3017,
            'longitude' => 13.3983,
            'telephone' => '+237 234 43 30 30',
            'email' => 'contact@chu-garoua.cm',
            'siteWeb' => null,
            'horaires' => '24h/24 — 7j/7',
            'horairesDetails' => self::alwaysOpen(),
            'description' => 'CHU du Nord : urgences, maternité, chirurgie, pédiatrie et maladies tropicales.',
            'specialites' => ['Urgences', 'Maternité', 'Pédiatrie', 'Chirurgie', 'Maladies tropicales'],
            'services' => ['Urgences 24h/24', 'Laboratoire', 'Hospitalisation'],
            'accessibilite' => ['Cour intérieure', 'Accès ambulance'],
            'paiement' => ['Espèces', 'CNPS'],
            'assurance' => ['CNPS'],
            'parking' => ['Stationnement gratuit'],
            'evacuationSanitaire' => ['Transert vers Yaoundé'],
            'urgences24h' => true,
            'ambulancesDisponibles' => true,
            'priseRendezVous' => false,
            'teleconsultation' => false,
            'statut' => 'public',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/Immunization_in_Cameroon_%2834692993536%29.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/A_lhopital_Cameroun_17.jpg?width=960',
            ],
            'avis' => [
                ['note' => 4, 'commentaire' => 'Pôle maternité-pédiatrie actif, personnel du Nord accueillant.'],
                ['note' => 3, 'commentaire' => 'Urgences fonctionnelles malgré la saturation estivale.'],
                ['note' => 4, 'commentaire' => 'Bon contact avec les médecins pour les maladies tropicales.'],
            ],
        ],
        [
            'slug' => 'hopital-bafoussam',
            'nom' => 'Hôpital de la Référence de Bafoussam',
            'type' => 'hopital_regional',
            'adresse' => 'Quartier Tamdja, Bafoussam',
            'quartier' => 'Tamdja',
            'ville' => 'Bafoussam',
            'region' => 'Ouest',
            'regionCode' => 'OU',
            'departement' => 'Mifi',
            'latitude' => 5.4839,
            'longitude' => 10.4224,
            'telephone' => '+237 233 45 11 80',
            'email' => null,
            'siteWeb' => null,
            'horaires' => '24h/24 — 7j/7',
            'horairesDetails' => self::alwaysOpen(),
            'description' => 'Hôpital de référence de l\'Ouest : urgences, maternité, pédiatrie, chirurgie.',
            'specialites' => ['Urgences', 'Maternité', 'Pédiatrie', 'Chirurgie'],
            'services' => ['Urgences 24h/24', 'Laboratoire', 'Pharmacie'],
            'accessibilite' => ['Accès route principale'],
            'paiement' => ['Espèces', 'CNPS'],
            'assurance' => ['CNPS'],
            'parking' => ['Stationnement gratuit'],
            'evacuationSanitaire' => ['Transert Douala/Yaoundé'],
            'urgences24h' => true,
            'ambulancesDisponibles' => false,
            'priseRendezVous' => false,
            'teleconsultation' => false,
            'statut' => 'public',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/Consultation_at_the_Catholic_Health_Post_at_Ntemndzem.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/Baleveng_Centre_de_sant%C3%A9_la_Mis%C3%A9ricorde.jpg?width=960',
            ],
            'avis' => [
                ['note' => 4, 'commentaire' => 'Référence régionale, maternité fréquentée par tout le Mifi.'],
                ['note' => 3, 'commentaire' => 'Urgences correctes, à améliorer côté affluence du matin.'],
                ['note' => 4, 'commentaire' => 'Chirurgie générale sérieuse pour un public hospitalier.'],
            ],
        ],
        [
            'slug' => 'clinique-guelphe',
            'nom' => 'Clinique Guelphe',
            'type' => 'clinique_privee',
            'adresse' => 'Makepe Missoké, Douala',
            'quartier' => 'Makepe Missoké',
            'ville' => 'Douala',
            'region' => 'Littoral',
            'regionCode' => 'LT',
            'departement' => 'Wouri',
            'latitude' => 4.0264,
            'longitude' => 9.6998,
            'telephone' => '+237 233 40 63 63',
            'email' => 'contact@cliniqueguelphe.cm',
            'siteWeb' => null,
            'horaires' => 'Lun–Sam 07h–20h · Urgences 24h/24',
            'horairesDetails' => self::weekly('07:00', '20:00', ['dimanche']),
            'description' => 'Clinique privée de référence à Douala : consultations spécialistes, maternité, imagerie, laboratoire.',
            'specialites' => ['Médecine générale', 'Maternité', 'Cardiologie', 'Imagerie'],
            'services' => ['Consultations', 'Échographie', 'Laboratoire', 'Hospitalisation'],
            'accessibilite' => ['Parking privé', 'Accès taxi'],
            'paiement' => ['Espèces', 'Mobile Money', 'Carte bancaire'],
            'assurance' => ['CNPS', 'Assurances privées'],
            'parking' => ['Parking privé payant'],
            'evacuationSanitaire' => ['Ambulance clinique'],
            'urgences24h' => true,
            'ambulancesDisponibles' => true,
            'priseRendezVous' => true,
            'teleconsultation' => true,
            'statut' => 'prive',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/Ophthalmologist_Hospital_Cameroon_11.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/Infirmi%C3%A8re_A_l%27h%C3%B4pital_Laquintinie_de_Douala_au_Cameroun_04.jpg?width=960',
            ],
            'avis' => [
                ['note' => 5, 'commentaire' => 'Clinique moderne, cardiologie et échographie très sérieuses.'],
                ['note' => 4, 'commentaire' => 'Accueil soigné, rendez-vous honorés dans les délais.'],
                ['note' => 4, 'commentaire' => 'Maternité propre, suivi post-natal clair.'],
            ],
        ],
        [
            'slug' => 'notre-dame-paix',
            'nom' => 'Polyclinique Notre-Dame de la Paix',
            'type' => 'polyclinique',
            'adresse' => 'Mvog-Ada, Yaoundé',
            'quartier' => 'Mvog-Ada',
            'ville' => 'Yaoundé',
            'region' => 'Centre',
            'regionCode' => 'CE',
            'departement' => 'Mfoundi',
            'latitude' => 3.8689,
            'longitude' => 11.5113,
            'telephone' => '+237 222 07 17 00',
            'email' => 'contact@pndp.cm',
            'siteWeb' => null,
            'horaires' => 'Lun–Sam 07h–19h · Urgences 24h/24',
            'horairesDetails' => self::weekly('07:00', '19:00', ['dimanche']),
            'description' => 'Polyclinique privée à Yaoundé : consultations, maternité, chirurgie programmée, analyses.',
            'specialites' => ['Médecine générale', 'Gynécologie', 'Chirurgie', 'Pédiatrie'],
            'services' => ['Consultations', 'Maternité', 'Analyses', 'Pharmacie'],
            'accessibilite' => ['Parking', 'Accès principal'],
            'paiement' => ['Espèces', 'Mobile Money', 'Assurances'],
            'assurance' => ['CNPS', 'Assurances privées'],
            'parking' => ['Parking sur site'],
            'evacuationSanitaire' => ['Ambulance partenaire'],
            'urgences24h' => true,
            'ambulancesDisponibles' => false,
            'priseRendezVous' => true,
            'teleconsultation' => false,
            'statut' => 'prive',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/Doctor_and_a_nurse_in_a_Hospital_room_Cameroun.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/A_l%E2%80%99h%C3%B4pital_au_Cameroun_-_Obst%C3%A9trique.jpg?width=960',
            ],
            'avis' => [
                ['note' => 5, 'commentaire' => 'Gynécologie et maternité au top, cadre calme et propre.'],
                ['note' => 4, 'commentaire' => 'Chirurgie programmée efficace, devis clairs.'],
                ['note' => 4, 'commentaire' => 'Analyses rapides sur place, pharmacie pratique.'],
            ],
        ],
        [
            'slug' => 'pharmacie-du-centre',
            'nom' => 'Pharmacie du Centre',
            'type' => 'pharmacie',
            'adresse' => 'Avenue Kennedy, Yaoundé',
            'quartier' => 'Centre-ville',
            'ville' => 'Yaoundé',
            'region' => 'Centre',
            'regionCode' => 'CE',
            'departement' => 'Mfoundi',
            'latitude' => 3.8480,
            'longitude' => 11.5020,
            'telephone' => '+237 222 23 71 45',
            'email' => null,
            'siteWeb' => null,
            'horaires' => 'Tous les jours 08h–23h',
            'horairesDetails' => self::weekly('08:00', '23:00'),
            'description' => 'Pharmacie d\'officine du centre-ville : délivrance d\'ordonnances, conseil, tests rapides.',
            'specialites' => ['Officine'],
            'services' => ['Ordonnances', 'Conseil', 'Tests rapides'],
            'accessibilite' => ['Accès piéton avenue Kennedy'],
            'paiement' => ['Espèces', 'Mobile Money'],
            'assurance' => ['CNPS'],
            'parking' => ['Dépose minute'],
            'evacuationSanitaire' => [],
            'urgences24h' => false,
            'ambulancesDisponibles' => false,
            'priseRendezVous' => false,
            'teleconsultation' => false,
            'statut' => 'prive',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/Immunization_in_Cameroon_%2834692993536%29.jpg?width=960',
            'galerie' => [],
            'avis' => [
                ['note' => 5, 'commentaire' => 'Toujours en stock sur les essentiels, conseil rapide.'],
                ['note' => 4, 'commentaire' => 'Ordonnances servies vite, prix transparents.'],
            ],
        ],
        [
            'slug' => 'cerballiance-douala',
            'nom' => 'Cerballiance Douala',
            'type' => 'laboratoire',
            'adresse' => 'Bonapriso, Douala',
            'quartier' => 'Bonapriso',
            'ville' => 'Douala',
            'region' => 'Littoral',
            'regionCode' => 'LT',
            'departement' => 'Wouri',
            'latitude' => 4.0377,
            'longitude' => 9.6909,
            'telephone' => '+237 233 43 76 00',
            'email' => 'douala@cerballiance.cm',
            'siteWeb' => 'https://www.cerballiance.cm',
            'horaires' => 'Lun–Sam 07h–19h',
            'horairesDetails' => self::weekly('07:00', '19:00', ['dimanche']),
            'description' => 'Laboratoire d\'analyses médicales : biologie, hématologie, sérologies, prélèvements à domicile.',
            'specialites' => ['Biologie médicale', 'Hématologie', 'Sérologies'],
            'services' => ['Analyses', 'Prélèvements', 'Résultats en ligne'],
            'accessibilite' => ['Parking clients', 'Accès taxi'],
            'paiement' => ['Espèces', 'Mobile Money', 'Carte bancaire'],
            'assurance' => ['CNPS', 'Assurances privées'],
            'parking' => ['Parking clients'],
            'evacuationSanitaire' => [],
            'urgences24h' => false,
            'ambulancesDisponibles' => false,
            'priseRendezVous' => false,
            'teleconsultation' => false,
            'statut' => 'prive',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/M%C3%A9d%C3%A9cin_au_Laboratoire_Hopital_Douala_Cameroun.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/M%C3%A9d%C3%A9cin_au_Laboratoire_Hopital_Douala_Cameroun.jpg?width=960',
            ],
            'avis' => [
                ['note' => 5, 'commentaire' => 'Résultats rapides par e-mail, prélèvement soigné.'],
                ['note' => 4, 'commentaire' => 'Réseau sérieux, tarifs conformes à l\'affichage.'],
            ],
        ],
        [
            'slug' => 'hopital-buea',
            'nom' => 'Hôpital Régional de Buea',
            'type' => 'hopital_regional',
            'adresse' => 'Quartier Molyko, Buea',
            'quartier' => 'Molyko',
            'ville' => 'Buea',
            'region' => 'Sud-Ouest',
            'regionCode' => 'SU',
            'departement' => 'Fako',
            'latitude' => 4.1527,
            'longitude' => 9.2440,
            'telephone' => '+237 233 32 21 46',
            'email' => null,
            'siteWeb' => null,
            'horaires' => '24h/24 — 7j/7',
            'horairesDetails' => self::alwaysOpen(),
            'description' => 'Hôpital régional du Sud-Ouest : urgences, maternité, pédiatrie, médecine interne.',
            'specialites' => ['Urgences', 'Maternité', 'Pédiatrie', 'Médecine interne'],
            'services' => ['Urgences 24h/24', 'Laboratoire', 'Hospitalisation'],
            'accessibilite' => ['Accès route Buea–Limbe'],
            'paiement' => ['Espèces', 'CNPS'],
            'assurance' => ['CNPS'],
            'parking' => ['Stationnement gratuit'],
            'evacuationSanitaire' => ['Transert Douala'],
            'urgences24h' => true,
            'ambulancesDisponibles' => false,
            'priseRendezVous' => false,
            'teleconsultation' => false,
            'statut' => 'public',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/Salle_d%27hospitalisation_H%C3%B4pital_Cameroun_08.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/Baleveng_Centre_de_sant%C3%A9_la_Mis%C3%A9ricorde.jpg?width=960',
            ],
            'avis' => [
                ['note' => 4, 'commentaire' => 'Hôpital régional solide pour la maternité et la pédiatrie.'],
                ['note' => 3, 'commentaire' => 'Urgences correctes, à renforcer côté matériel.'],
                ['note' => 4, 'commentaire' => 'Personnel soignant accueillant, suivi clair.'],
            ],
        ],
    ];

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('with-media', null, InputOption::VALUE_NONE, 'Télécharge la galerie (best-effort, 6s par image)')
            ->addOption('force', null, InputOption::VALUE_NONE, 'Met à jour les champs des établissements déjà présents');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $withMedia = (bool) $input->getOption('with-media');
        $force = (bool) $input->getOption('force');

        $io->title('Seed carte — 10 établissements camerounais réels');

        $created = 0;
        $updated = 0;
        $skipped = 0;
        $mediaAdded = 0;
        $mediaFailed = 0;
        $avisAdded = 0;
        $affiliationsAdded = 0;

        /** @var array<string, CentreDeSante> $seeded */
        $seeded = [];

        foreach (self::ETABLISSEMENTS as $item) {
            $placeId = self::GOOGLE_PLACE_PREFIX . $item['slug'];
            /** @var CentreDeSante|null $centre */
            $centre = $this->entityManager->getRepository(CentreDeSante::class)
                ->findOneBy(['googlePlaceId' => $placeId]);

            if ($centre instanceof CentreDeSante) {
                if (!$force) {
                    $skipped++;
                    $io->text(sprintf('  = %s (présent)', $item['nom']));
                } else {
                    $this->applyData($centre, $item, $placeId);
                    $updated++;
                    $io->text(sprintf('  ↑ %s (mis à jour)', $item['nom']));
                }
            } else {
                $centre = new CentreDeSante();
                $this->applyData($centre, $item, $placeId);
                $this->entityManager->persist($centre);
                $created++;
                $io->text(sprintf('  + %s', $item['nom']));
            }

            $seeded[$item['slug']] = $centre;

            if ($withMedia && $centre->getImages()->isEmpty() && !empty($item['galerie'])) {
                foreach ($item['galerie'] as $index => $url) {
                    $binary = $this->downloadImage($url);
                    if ($binary === null) {
                        $mediaFailed++;
                        $io->note(sprintf('    media indisponible (%s)', $url));
                        continue;
                    }

                    $media = new MediaObject();
                    $media
                        ->setFilePath(bin2hex(random_bytes(16)) . '.jpg')
                        ->setOriginalName(sprintf('%s-%d.jpg', $item['slug'], $index + 1))
                        ->setMimeType('image/jpeg')
                        ->setSize(strlen($binary))
                        ->setData($binary)
                        ->setIsPublic(true)
                        ->setPurpose(MediaObject::PURPOSE_GENERAL)
                        ->setCentre($centre);

                    $this->entityManager->persist($media);
                    $mediaAdded++;
                }
            }
        }

        $this->entityManager->flush();

        // ── Avis publiés : uniquement si l'établissement n'en a aucun ───────
        $avisRepository = $this->entityManager->getRepository(AvisEtablissement::class);
        foreach (self::ETABLISSEMENTS as $item) {
            $centre = $seeded[$item['slug']] ?? null;
            if (!$centre instanceof CentreDeSante) {
                continue;
            }
            $existing = $avisRepository->count(['etablissement' => $centre->getId()]);
            if ($existing > 0) {
                continue;
            }
            $notes = [];
            foreach ($item['avis'] as $entry) {
                $avis = new AvisEtablissement();
                $avis
                    ->setEtablissement($centre)
                    ->setNote($entry['note'])
                    ->setCommentaire($entry['commentaire'])
                    ->setStatut('PUBLIE');
                $this->entityManager->persist($avis);
                $notes[] = $entry['note'];
                $avisAdded++;
            }
            if ($notes !== []) {
                $centre->setNoteMoyenne(round(array_sum($notes) / count($notes), 2));
                $centre->setTotalAvis(count($notes));
            }
        }

        $this->entityManager->flush();

        // ── Affiliation du médecin de test (fiche « Médecins » non vide) ────
        /** @var User|null $medecin */
        $medecin = $this->entityManager->getRepository(User::class)
            ->findOneBy(['email' => self::TEST_MEDECIN_EMAIL]);
        if ($medecin !== null) {
            foreach (['pisam', 'chu-yaounde'] as $slug) {
                $centre = $seeded[$slug] ?? null;
                if (!$centre instanceof CentreDeSante) {
                    continue;
                }
                $exists = $this->entityManager->getRepository(AffiliationMedecin::class)
                    ->findOneBy(['medecin' => $medecin, 'etablissement' => $centre]);
                if ($exists !== null) {
                    continue;
                }
                $affiliation = new AffiliationMedecin();
                $affiliation
                    ->setMedecin($medecin)
                    ->setEtablissement($centre)
                    ->setFonction('Médecin généraliste')
                    ->setStatut('ACCEPTEE')
                    ->setPlanning([
                        ['jour' => 'lundi', 'debut' => '08:00', 'fin' => '17:00'],
                        ['jour' => 'mardi', 'debut' => '08:00', 'fin' => '17:00'],
                        ['jour' => 'mercredi', 'debut' => '08:00', 'fin' => '17:00'],
                    ]);
                $this->entityManager->persist($affiliation);
                $affiliationsAdded++;
            }
            $this->entityManager->flush();
        } else {
            $io->note(sprintf(
                'Médecin de test %s absent — lancez app:create-test-users puis relancez ce seed pour l\'affiliation.',
                self::TEST_MEDECIN_EMAIL
            ));
        }

        $io->success(sprintf(
            'Seed terminé : %d créés, %d mis à jour, %d déjà présents, %d avis, %d affiliations, %d médias ajoutés, %d médias en échec.',
            $created,
            $updated,
            $skipped,
            $avisAdded,
            $affiliationsAdded,
            $mediaAdded,
            $mediaFailed
        ));

        return Command::SUCCESS;
    }

    /**
     * @param array<string, mixed> $item
     */
    private function applyData(CentreDeSante $centre, array $item, string $placeId): void
    {
        $centre
            ->setNom($item['nom'])
            ->setType($item['type'])
            ->setAdresse($item['adresse'])
            ->setQuartier($item['quartier'])
            ->setVille($item['ville'])
            ->setRegion($item['region'])
            ->setRegionCode($item['regionCode'])
            ->setDepartement($item['departement'])
            ->setLatitude($item['latitude'])
            ->setLongitude($item['longitude'])
            ->setTelephone($item['telephone'])
            ->setEmail($item['email'])
            ->setSiteWeb($item['siteWeb'])
            ->setHoraires($item['horaires'])
            ->setHorairesDetails($item['horairesDetails'])
            ->setDescription($item['description'])
            ->setSpecialites($item['specialites'])
            ->setServices($item['services'])
            ->setAccessibilite($item['accessibilite'])
            ->setPaiement($item['paiement'])
            ->setAssurance($item['assurance'])
            ->setParking($item['parking'])
            ->setEvacuationSanitaire($item['evacuationSanitaire'])
            ->setLangues(['Français', 'Anglais'])
            ->setStatut($item['statut'])
            ->setEstActif(true)
            ->setUrgences24h($item['urgences24h'])
            ->setAmbulancesDisponibles($item['ambulancesDisponibles'])
            ->setPriseRendezVous($item['priseRendezVous'])
            ->setTeleconsultation($item['teleconsultation'])
            ->setImageUrl($item['cover'])
            ->setGooglePlaceId($placeId)
            ->setVerificationStatut('VERIFIE')
            ->setSource('manuel');
    }

    private function downloadImage(string $url): ?string
    {
        $context = stream_context_create([
            'http' => [
                'timeout' => 6,
                'header' => "User-Agent: MediSecoursSeed/1.0\r\n",
            ],
        ]);

        $binary = @file_get_contents($url, false, $context);
        if ($binary === false || $binary === '') {
            return null;
        }

        if (strlen($binary) > 5 * 1024 * 1024) {
            return null;
        }

        $isJpeg = str_starts_with($binary, "\xFF\xD8\xFF");
        $isPng = str_starts_with($binary, "\x89PNG");
        if (!$isJpeg && !$isPng) {
            return null;
        }

        return $binary;
    }
}
