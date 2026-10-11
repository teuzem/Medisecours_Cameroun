<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\CentreDeSante;
use App\Entity\MediaObject;
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
 * Idempotent : un établissement est identifié par son googlePlaceId
 * « seed-carte-test-* ». Les couvertures pointent vers des photographies
 * libres (Wikimedia Commons) ; la galerie est téléchargée à la demande
 * (--with-media) et ignorée proprement hors-ligne.
 */
#[AsCommand(
    name: 'app:seed-carte-test',
    description: 'Seed de test : 10 établissements camerounais réels pour la carte Santé.'
)]
class SeedCarteTestCommand extends Command
{
    private const GOOGLE_PLACE_PREFIX = 'seed-carte-test-';

    /**
     * @var list<array<string, mixed>>
     */
    private const ETABLISSEMENTS = [
        [
            'slug' => 'laquintinie',
            'nom' => 'Hôpital Laquintinie de Douala',
            'type' => 'hopital_general',
            'adresse' => "Rue de l'Hôpital, Bonanjo",
            'quartier' => 'Bonanjo',
            'ville' => 'Douala',
            'region' => 'Littoral',
            'regionCode' => 'LT',
            'departement' => 'Wouri',
            'latitude' => 4.0475,
            'longitude' => 9.7046,
            'telephone' => '+237 233 42 51 10',
            'horaires' => '24h/24 — 7j/7',
            'description' => "Hôpital public de référence du Littoral : urgences, maternité, chirurgie, néonatologie (unité kangourou) et laboratoire.",
            'specialites' => ['Urgences', 'Maternité', 'Chirurgie', 'Néonatologie', 'Cardiologie'],
            'services' => ['Urgences 24h/24', 'Laboratoire', 'Imagerie', 'Pharmacie'],
            'urgences24h' => true,
            'ambulancesDisponibles' => true,
            'priseRendezVous' => true,
            'statut' => 'public',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/H%C3%B4pital_Laquintinie_de_Douala_Cameroun_13.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/Zone_Jaune_Urgences_H%C3%B4pital_Laquintinie_Cameroun_04.jpg?width=960',
                'https://commons.wikimedia.org/wiki/Special:FilePath/Unit_Kangourou_H%C3%B4pital_Laquintinie_Cameroun_30.jpg?width=960',
            ],
        ],
        [
            'slug' => 'hopital-general-yaounde',
            'nom' => 'Hôpital Général de Yaoundé',
            'type' => 'hopital_general',
            'adresse' => "Quartier Nsam, Yaoundé",
            'quartier' => 'Nsam',
            'ville' => 'Yaoundé',
            'region' => 'Centre',
            'regionCode' => 'CE',
            'departement' => 'Mfoundi',
            'latitude' => 3.8431,
            'longitude' => 11.5213,
            'telephone' => '+237 222 23 40 20',
            'horaires' => '24h/24 — 7j/7',
            'description' => "Hôpital public de référence de la capitale : urgences, chirurgie, maternité, imagerie médicale.",
            'specialites' => ['Urgences', 'Chirurgie', 'Maternité', 'Imagerie', 'Médecine interne'],
            'services' => ['Urgences 24h/24', 'Radiologie', 'Laboratoire', 'Ambulance'],
            'urgences24h' => true,
            'ambulancesDisponibles' => true,
            'priseRendezVous' => true,
            'statut' => 'public',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/H%C3%B4pital_G%C3%A9n%C3%A9ral_de_Yaound%C3%A9.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/Ambulance_de_l%27h%C3%B4pital_g%C3%A9n%C3%A9ral_de_Yaound%C3%A9.jpg?width=960',
                'https://commons.wikimedia.org/wiki/Special:FilePath/Doctor_and_a_nurse_in_a_Hospital_room_Cameroun.jpg?width=960',
            ],
        ],
        [
            'slug' => 'chu-yaounde',
            'nom' => 'Centre Hospitalier Universitaire de Yaoundé',
            'type' => 'chu',
            'adresse' => 'Rue Henri Dunant, Yaoundé',
            'quartier' => 'Hôpital',
            'ville' => 'Yaoundé',
            'region' => 'Centre',
            'regionCode' => 'CE',
            'departement' => 'Mfoundi',
            'latitude' => 3.8744,
            'longitude' => 11.5268,
            'telephone' => '+237 222 23 21 00',
            'horaires' => '24h/24 — 7j/7',
            'description' => 'CHU de référence nationale (Hôpital Central) : spécialistes, enseignement, chirurgie lourde, réanimation.',
            'specialites' => ['Chirurgie', 'Réanimation', 'Cardiologie', 'Oncologie', 'Neurologie'],
            'services' => ['Consultations spécialistes', 'Laboratoire', 'Imagerie', 'Pharmacie'],
            'urgences24h' => true,
            'ambulancesDisponibles' => true,
            'priseRendezVous' => true,
            'statut' => 'public',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/Infirmi%C3%A8res_au_service_N%C3%A9onatologie_A_l%27h%C3%B4pital_Laquintinie_de_Douala_au_Cameroun_12.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/Salle_d%27hospitalisation_H%C3%B4pital_Cameroun_08.jpg?width=960',
                'https://commons.wikimedia.org/wiki/Special:FilePath/M%C3%A9d%C3%A9cin_au_Laboratoire_Hopital_Douala_Cameroun.jpg?width=960',
            ],
        ],
        [
            'slug' => 'chu-garoua',
            'nom' => 'Centre Hospitalier Universitaire de Garoua',
            'type' => 'chu',
            'adresse' => 'Quartier Djarengol, Garoua',
            'quartier' => 'Djarengol',
            'ville' => 'Garoua',
            'region' => 'Nord',
            'regionCode' => 'NO',
            'departement' => 'Bénoué',
            'latitude' => 9.3017,
            'longitude' => 13.3983,
            'telephone' => '+237 234 43 30 30',
            'horaires' => '24h/24 — 7j/7',
            'description' => 'CHU du Nord : urgences, maternité, chirurgie, pédiatrie et maladies tropicales.',
            'specialites' => ['Urgences', 'Maternité', 'Pédiatrie', 'Chirurgie', 'Maladies tropicales'],
            'services' => ['Urgences 24h/24', 'Laboratoire', 'Hospitalisation'],
            'urgences24h' => true,
            'ambulancesDisponibles' => true,
            'priseRendezVous' => false,
            'statut' => 'public',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/Immunization_in_Cameroon_%2834692993536%29.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/A_lhopital_Cameroun_17.jpg?width=960',
            ],
        ],
        [
            'slug' => 'hopital-bafoussam',
            'nom' => 'Hôpital de la Référence de Bafoussam',
            'type' => 'hopital_general',
            'adresse' => 'Quartier Tamdja, Bafoussam',
            'quartier' => 'Tamdja',
            'ville' => 'Bafoussam',
            'region' => 'Ouest',
            'regionCode' => 'OU',
            'departement' => 'Mifi',
            'latitude' => 5.4839,
            'longitude' => 10.4224,
            'telephone' => '+237 233 45 11 80',
            'horaires' => '24h/24 — 7j/7',
            'description' => 'Hôpital de référence de l\'Ouest : urgences, maternité, pédiatrie, chirurgie.',
            'specialites' => ['Urgences', 'Maternité', 'Pédiatrie', 'Chirurgie'],
            'services' => ['Urgences 24h/24', 'Laboratoire', 'Pharmacie'],
            'urgences24h' => true,
            'ambulancesDisponibles' => false,
            'priseRendezVous' => false,
            'statut' => 'public',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/Consultation_at_the_Catholic_Health_Post_at_Ntemndzem.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/Baleveng_Centre_de_sant%C3%A9_la_Mis%C3%A9ricorde.jpg?width=960',
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
            'horaires' => 'Lun–Sam 07h–20h · Urgences 24h/24',
            'description' => 'Clinique privée de référence à Douala : consultations spécialistes, maternité, imagerie, laboratoire.',
            'specialites' => ['Médecine générale', 'Maternité', 'Cardiologie', 'Imagerie'],
            'services' => ['Consultations', 'Échographie', 'Laboratoire', 'Hospitalisation'],
            'urgences24h' => true,
            'ambulancesDisponibles' => true,
            'priseRendezVous' => true,
            'statut' => 'prive',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/Ophthalmologist_Hospital_Cameroon_11.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/Infirmi%C3%A8re_A_l%27h%C3%B4pital_Laquintinie_de_Douala_au_Cameroun_04.jpg?width=960',
            ],
        ],
        [
            'slug' => 'notre-dame-paix',
            'nom' => 'Polyclinique Notre-Dame de la Paix',
            'type' => 'clinique_privee',
            'adresse' => 'Mvog-Ada, Yaoundé',
            'quartier' => 'Mvog-Ada',
            'ville' => 'Yaoundé',
            'region' => 'Centre',
            'regionCode' => 'CE',
            'departement' => 'Mfoundi',
            'latitude' => 3.8689,
            'longitude' => 11.5113,
            'telephone' => '+237 222 07 17 00',
            'horaires' => 'Lun–Sam 07h–19h · Urgences 24h/24',
            'description' => 'Polyclinique privée à Yaoundé : consultations, maternité, chirurgie programmée, analyses.',
            'specialites' => ['Médecine générale', 'Gynécologie', 'Chirurgie', 'Pédiatrie'],
            'services' => ['Consultations', 'Maternité', 'Analyses', 'Pharmacie'],
            'urgences24h' => true,
            'ambulancesDisponibles' => false,
            'priseRendezVous' => true,
            'statut' => 'prive',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/Doctor_and_a_nurse_in_a_Hospital_room_Cameroun.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/A_l%E2%80%99h%C3%B4pital_au_Cameroun_-_Obst%C3%A9trique.jpg?width=960',
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
            'horaires' => 'Tous les jours 08h–23h',
            'description' => 'Pharmacie d\'officine du centre-ville : délivrance d\'ordonnances, conseil, tests rapides.',
            'specialites' => ['Officine'],
            'services' => ['Ordonnances', 'Conseil', 'Tests rapides'],
            'urgences24h' => false,
            'ambulancesDisponibles' => false,
            'priseRendezVous' => false,
            'statut' => 'prive',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/Immunization_in_Cameroon_%2834692993536%29.jpg?width=960',
            'galerie' => [],
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
            'horaires' => 'Lun–Sam 07h–19h',
            'description' => 'Laboratoire d\'analyses médicales : biologie, hématologie, sérologies, prélèvements à domicile.',
            'specialites' => ['Biologie médicale', 'Hématologie', 'Sérologies'],
            'services' => ['Analyses', 'Prélèvements', 'Résultats en ligne'],
            'urgences24h' => false,
            'ambulancesDisponibles' => false,
            'priseRendezVous' => false,
            'statut' => 'prive',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/M%C3%A9d%C3%A9cin_au_Laboratoire_Hopital_Douala_Cameroun.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/M%C3%A9d%C3%A9cin_au_Laboratoire_Hopital_Douala_Cameroun.jpg?width=960',
            ],
        ],
        [
            'slug' => 'hopital-buea',
            'nom' => 'Hôpital Régional de Buea',
            'type' => 'hopital_general',
            'adresse' => 'Quartier Molyko, Buea',
            'quartier' => 'Molyko',
            'ville' => 'Buea',
            'region' => 'Sud-Ouest',
            'regionCode' => 'SU',
            'departement' => 'Fako',
            'latitude' => 4.1527,
            'longitude' => 9.2440,
            'telephone' => '+237 233 32 21 46',
            'horaires' => '24h/24 — 7j/7',
            'description' => 'Hôpital régional du Sud-Ouest : urgences, maternité, pédiatrie, médecine interne.',
            'specialites' => ['Urgences', 'Maternité', 'Pédiatrie', 'Médecine interne'],
            'services' => ['Urgences 24h/24', 'Laboratoire', 'Hospitalisation'],
            'urgences24h' => true,
            'ambulancesDisponibles' => false,
            'priseRendezVous' => false,
            'statut' => 'public',
            'cover' => 'https://commons.wikimedia.org/wiki/Special:FilePath/Salle_d%27hospitalisation_H%C3%B4pital_Cameroun_08.jpg?width=960',
            'galerie' => [
                'https://commons.wikimedia.org/wiki/Special:FilePath/Baleveng_Centre_de_sant%C3%A9_la_Mis%C3%A9ricorde.jpg?width=960',
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

        foreach (self::ETABLISSEMENTS as $item) {
            $placeId = self::GOOGLE_PLACE_PREFIX . $item['slug'];
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

        $io->success(sprintf(
            'Seed terminé : %d créés, %d mis à jour, %d déjà présents, %d médias ajoutés, %d médias en échec.',
            $created,
            $updated,
            $skipped,
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
            ->setHoraires($item['horaires'])
            ->setDescription($item['description'])
            ->setSpecialites($item['specialites'])
            ->setServices($item['services'])
            ->setLangues(['Français', 'Anglais'])
            ->setStatut($item['statut'])
            ->setEstActif(true)
            ->setUrgences24h($item['urgences24h'])
            ->setAmbulancesDisponibles($item['ambulancesDisponibles'])
            ->setPriseRendezVous($item['priseRendezVous'])
            ->setTeleconsultation(false)
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

        // Vérification minimale : en-tête JPEG/PNG.
        $isJpeg = str_starts_with($binary, "\xFF\xD8\xFF");
        $isPng = str_starts_with($binary, "\x89PNG");
        if (!$isJpeg && !$isPng) {
            return null;
        }

        return $binary;
    }
}
