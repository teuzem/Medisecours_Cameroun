<?php

namespace App\DataFixtures;

use App\Entity\Categorie;
use App\Entity\CentreDeSante;
use App\Entity\Maladie;
use App\Entity\Medecin;
use App\Entity\Message;
use App\Entity\Admin;
use App\Entity\Patient;
use App\Entity\PremierSoin;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;
use Faker\Factory;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

class AppFixtures extends Fixture
{
    public function __construct(
        private UserPasswordHasherInterface $passwordHasher
    ) {
    }

    public function load(ObjectManager $manager): void
    {
        $faker = Factory::create('fr_CM');

        // 1. UTILISATEURS
        $admin = new Admin();
        $admin->setEmail('admin@medisecours.com');
        $admin->setPassword($this->passwordHasher->hashPassword($admin, 'Admin@2026!'));
        $admin->setNom('Admin');
        $admin->setPrenom('Super');
        $admin->setTelephone('+237 690000000');
        $admin->setQuartier('Bastos');
        $admin->setRoles(['ROLE_ADMIN']);
        $manager->persist($admin);

        $specialites = ['Médecine générale', 'Pédiatrie', 'Cardiologie', 'Gynécologie', 'Chirurgie'];
        $medecins = [];
        for ($i = 0; $i < 5; $i++) {
            $medecin = new Medecin();
            $medecin->setEmail("medecin{$i}@medisecours.com");
            $medecin->setPassword($this->passwordHasher->hashPassword($medecin, 'Medecin@2026!'));
            $medecin->setNom($faker->lastName());
            $medecin->setPrenom($faker->firstName());
            $medecin->setTelephone('+237 ' . $faker->numerify('6########'));
            $medecin->setQuartier($faker->randomElement(['Bastos', 'Akwa', 'Bonanjo', 'Mvan', 'Ngousso']));
            $medecin->setSpecialite($specialites[$i]);
            $medecin->setNumeroOrdre('CM-ORD-' . $faker->unique()->numerify('#####'));
            $medecin->setEstValide(true);
            $medecin->setDisponibilites([
                ['jour' => 'lundi',    'debut' => '08:00', 'fin' => '17:00'],
                ['jour' => 'mardi',    'debut' => '08:00', 'fin' => '17:00'],
                ['jour' => 'mercredi', 'debut' => '08:00', 'fin' => '17:00'],
                ['jour' => 'jeudi',    'debut' => '08:00', 'fin' => '17:00'],
                ['jour' => 'vendredi', 'debut' => '08:00', 'fin' => '17:00'],
            ]);
            $medecins[] = $medecin;
            $manager->persist($medecin);
        }

        $patients = [];
        $groupesSanguins = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        for ($i = 0; $i < 20; $i++) {
            $patient = new Patient();
            $patient->setEmail("patient{$i}@medisecours.com");
            $patient->setPassword($this->passwordHasher->hashPassword($patient, 'Patient@2026!'));
            $patient->setNom($faker->lastName());
            $patient->setPrenom($faker->firstName());
            $patient->setTelephone('+237 ' . $faker->numerify('6########'));
            $patient->setQuartier($faker->randomElement(['Bastos', 'Akwa', 'Bonamoussadi', 'Mvan', 'Ngousso']));
            $patient->setGroupeSanguin($faker->randomElement($groupesSanguins));
            // allergies : JSON array (migration Version20260702131711)
            $allergie = $faker->optional(0.3)->randomElement(['Pénicilline', 'Aspirine', 'Arachides', 'Latex']);
            $patient->setAllergies($allergie !== null ? [$allergie] : []);
            // contactsUrgence : JSON array
            $patient->setContactsUrgence([
                [
                    'nom'       => $faker->name(),
                    'telephone' => '+237 ' . $faker->numerify('6########'),
                    'lien'      => $faker->randomElement(['parent', 'conjoint', 'ami', 'frère/sœur']),
                ]
            ]);
            $patients[] = $patient;
            $manager->persist($patient);
        }

        // 2. CATÉGORIES
        $categoriesData = [
            ['Maladies tropicales', 'Paludisme, typhoïde, dengue, choléra', '#FF6B6B'],
            ['Cardiologie', 'Maladies cardiovasculaires', '#4ECDC4'],
            ['Pneumologie', 'Maladies respiratoires', '#45B7D1'],
            ['Gastroentérologie', 'Maladies digestives', '#96CEB4'],
            ['Infectiologie', 'Maladies infectieuses et virales', '#FFEAA7'],
            ['Traumatologie', 'Blessures, fractures, accidents', '#DDA0DD'],
            ['Dermatologie', 'Maladies de la peau', '#F0E68C'],
            ['Santé maternelle', 'Grossesse, accouchement', '#FF69B4'],
            ['Urgences vitales', 'Situations d\'urgence critique', '#FF4500'],
            ['Pédiatrie', 'Maladies de l\'enfant', '#87CEEB'],
        ];

        $categories = [];
        foreach ($categoriesData as [$nom, $desc, $couleur]) {
            $cat = new Categorie();
            $cat->setNom($nom);
            $cat->setDescription($desc);
            $cat->setCouleur($couleur);
            $categories[] = $cat;
            $manager->persist($cat);
        }

        // 3. MALADIES
        $maladiesData = [
            ['Paludisme (Malaria)', 'Maladie parasitaire transmise par les moustiques anophèles.', 'Fièvre intermittente, frissons, sueurs, maux de tête, fatigue', 'Parasite Plasmodium, piqûres de moustiques anophèles', 'Utiliser des moustiquaires imprégnées, répulsifs', 'Antipaludéens (ACT), quinine, artésunate', 'SÉVÈRE', false, true, 0],
            ['Fièvre typhoïde', 'Infection bactérienne causée par Salmonella typhi.', 'Fièvre prolongée, maux de tête, douleurs abdominales, diarrhée ou constipation', 'Eau ou aliments contaminés, manque d\'hygiène', 'Boire de l\'eau potable, se laver les mains', 'Antibiotiques (ciprofloxacine, ceftriaxone), hydratation', 'SÉVÈRE', false, false, 0],
            ['Choléra', 'Infection intestinale aiguë causée par Vibrio cholerae.', 'Diarrhée aqueuse sévère, vomissements, déshydratation rapide', 'Eau contaminée, conditions sanitaires précaires', 'Hydratation immédiate, SRO (sels de réhydratation orale)', 'Réhydratation intensive, antibiotiques, zinc', 'CRITIQUE', false, true, 0],
            ['Hypertension artérielle', 'Pression sanguine anormalement élevée.', 'Maux de tête, vertiges, vision floue, saignements de nez', 'Alimentation trop salée, stress, sédentarité', 'Surveiller régulièrement la tension, réduire le sel', 'Antihypertenseurs, régime hyposodé', 'MODÉRÉE', false, false, 1],
            ['Infarctus du myocarde', 'Obstruction des artères coronaires.', 'Douleur thoracique intense, essoufflement, sueurs froides', 'Tabagisme, hypertension, diabète', 'Appeler les secours immédiatement', 'Angioplastie, thrombolyse', 'CRITIQUE', false, true, 1],
            ['Infection respiratoire aiguë', 'Infection des voies respiratoires.', 'Toux, fièvre, difficultés respiratoires, expectorations', 'Virus, bactéries, pollution', 'Se reposer, s\'hydrater, consulter si aggravation', 'Antibiotiques si bactérien, antipyrétiques', 'MODÉRÉE', true, false, 2],
            ['Tuberculose', 'Infection bactérienne causée par Mycobacterium tuberculosis.', 'Toux chronique (>3 semaines), perte de poids, sueurs nocturnes, fièvre', 'Bactérie Mycobacterium tuberculosis, transmission aérienne', 'Éviter les lieux confinés, porter un masque', 'Antibiotiques prolongés (6-9 mois)', 'SÉVÈRE', true, false, 2],
            ['Gastro-entérite', 'Inflammation de l\'estomac et des intestins.', 'Nausées, vomissements, diarrhée, crampes abdominales', 'Virus, bactéries, eau contaminée', 'S\'hydrater abondamment', 'Réhydratation, régime léger', 'LÉGÈRE', true, false, 3],
            ['Amibiase', 'Infection parasitaire intestinale causée par Entamoeba histolytica.', 'Diarrhée sanglante, douleurs abdominales, fièvre', 'Eau ou aliments contaminés par des kystes amibiens', 'Boire de l\'eau potable, se laver les mains', 'Antiparasitaires (métronidazole)', 'MODÉRÉE', false, false, 3],
            ['Dengue', 'Infection virale transmise par le moustique Aedes.', 'Fièvre élevée, maux de tête intenses, douleurs articulaires, éruption cutanée', 'Moustique Aedes aegypti', 'Éliminer les eaux stagnantes, utiliser des répulsifs', 'Repos, hydratation, paracétamol (pas d\'aspirine)', 'MODÉRÉE', false, false, 4],
            ['VIH/SIDA', 'Infection virale affectant le système immunitaire.', 'Fièvre, ganglions enflés, fatigue, infections opportunistes', 'Virus VIH, transmission sexuelle/sanguine/verticale', 'Pratiques sexuelles sûres, préservatifs', 'Antirétroviraux (ARV)', 'SÉVÈRE', false, false, 4],
            ['Fracture osseuse', 'Rupture de la continuité d\'un os.', 'Douleur intense, gonflement, déformation', 'Chute, accident, sport', 'Immobiliser la zone, ne pas déplacer', 'Immobilisation, chirurgie si nécessaire', 'MODÉRÉE', false, true, 5],
            ['Brûlure', 'Lésion de la peau causée par chaleur ou produit chimique.', 'Rougeur, cloques, douleur', 'Flammes, eau bouillante, produits chimiques', 'Refroidir sous l\'eau froide 15 min', 'Pansement stérile, crèmes cicatrisantes', 'VARIABLE', false, true, 5],
            ['Gale', 'Infection parasitaire de la peau causée par Sarcoptes scabiei.', 'Démangeaisons intenses (surtout la nuit), petites lésions', 'Parasite Sarcoptes scabiei, contact direct', 'Éviter les contacts, traiter tous les membres du foyer', 'Antiparasitaires topiques (perméthrine)', 'LÉGÈRE', true, false, 6],
            ['Pré-éclampsie', 'Complication de la grossesse avec hypertension.', 'Hypertension, protéinurie, maux de tête, vision trouble', 'Grossesse, antécédents d\'hypertension', 'Surveillance prénatale régulière', 'Surveillance médicale, accouchement', 'SÉVÈRE', false, true, 7],
            ['Hémorragie du post-partum', 'Saignement abondant après l\'accouchement.', 'Saignement vaginal important, faiblesse, pâleur', 'Atonie utérine, rétention placentaire', 'Accoucher dans un centre de santé', 'Ocytocine, massage utérin, transfusion', 'CRITIQUE', false, true, 7],
            ['Morsure de serpent', 'Envenimation par morsure de serpent.', 'Douleur, gonflement, saignements, troubles de la coagulation', 'Morsure de serpent venimeux', 'Immobiliser le membre, ne pas sucer le venin', 'Sérum antivenimeux, surveillance', 'CRITIQUE', false, true, 8],
            ['Insolation', 'Coup de chaleur dû à une exposition prolongée au soleil.', 'Fièvre élevée, peau rouge et sèche, confusion, perte de conscience', 'Exposition prolongée au soleil, déshydratation', 'Se mettre à l\'ombre, s\'hydrater', 'Refroidissement progressif, hydratation', 'SÉVÈRE', false, true, 8],
            ['Rougeole', 'Infection virale très contagieuse.', 'Fièvre élevée, toux, éruption cutanée, conjonctivite', 'Virus de la rougeole, transmission aérienne', 'Vaccination, éviter les contacts', 'Repos, hydratation, vitamine A', 'MODÉRÉE', true, false, 9],
            ['Malnutrition aiguë', 'Carence nutritionnelle sévère.', 'Perte de poids, faiblesse, œdèmes, retard de croissance', 'Manque d\'apport nutritionnel, infections', 'Allaitement maternel, alimentation équilibrée', 'Aliments thérapeutiques, suppléments', 'SÉVÈRE', false, true, 9],
        ];

        $maladies = [];
        foreach ($maladiesData as $data) {
            $maladie = new Maladie();
            $maladie->setNom($data[0]);
            $maladie->setDescription($data[1]);
            $maladie->setSymptomes($data[2]);
            $maladie->setCauses($data[3]);
            $maladie->setPrecautions($data[4]);
            $maladie->setTraitement($data[5]);
            $maladie->setNiveauGravite($data[6]);
            $maladie->setContagieux($data[7]);
            $maladie->setUrgence($data[8]);
            $maladie->setCategorie($categories[$data[9]]);
            $maladies[] = $maladie;
            $manager->persist($maladie);
        }

        // 4. PREMIERS SOINS
        $premiersSoinsData = [
            [0, 'Faire baisser la fièvre', 'Administrer du paracétamol. Appliquer des compresses tièdes. Hydrater abondamment. Consulter EN URGENCE pour test (TDR).', 'Fièvre élevée, frissons', 'CRITIQUE'],
            [0, 'Prévention contre les moustiques', 'Dormir sous moustiquaire imprégnée. Utiliser des répulsifs. Éliminer les eaux stagnantes.', 'Prévention', 'FAIBLE'],
            [2, 'Réhydratation d\'urgence', 'Préparer SRO: 1L eau + 6 càc sucre + 1/2 càc sel. Faire boire par petites gorgées. Consulter immédiatement.', 'Diarrhée sévère, déshydratation', 'CRITIQUE'],
            [11, 'Immobilisation du membre', 'Ne PAS remettre l\'os en place. Immobiliser avec attelle improvisée. Ne pas serrer trop fort.', 'Déformation, douleur intense', 'ÉLEVÉ'],
            [12, 'Refroidissement immédiat', 'Passer sous l\'eau tiède (15-25°C) pendant 15-20 min. Ne pas appliquer dentifrice ou beurre.', 'Rougeur, cloques', 'ÉLEVÉ'],
            [16, 'Immobiliser et appeler les secours', 'Immobiliser le membre mordu. Ne pas sucer le venin. Appeler immédiatement le 119.', 'Morsure de serpent', 'CRITIQUE'],
            [17, 'Refroidissement de la victime', 'Mettre à l\'ombre. Retirer les vêtements excédentaires. Appliquer des compresses fraîches. Faire boire de l\'eau.', 'Fièvre élevée, confusion', 'CRITIQUE'],
            [1, 'Surveiller la tension', 'Mesurer régulièrement. Réduire le sel. Consulter si tension > 14/9.', 'Maux de tête, vertiges', 'MODÉRÉ'],
            [5, 'Appeler les secours immédiatement', 'Appeler le 119. Noter l\'heure des symptômes. Ne rien donner à manger.', 'Douleur thoracique, essoufflement', 'CRITIQUE'],
            [18, 'Isolement et vaccination', 'Isoler l\'enfant. Administrer vitamine A. Consulter pour vaccination.', 'Fièvre, éruption cutanée', 'MODÉRÉ'],
        ];

        foreach ($premiersSoinsData as $data) {
            $soin = new PremierSoin();
            $soin->setMaladie($maladies[$data[0]]);
            $soin->setTitre($data[1]);
            $soin->setDescription($data[2]);
            $soin->setSymptomes($data[3]);
            $soin->setNiveauUrgence($data[4]);
            $manager->persist($soin);
        }

        // 5. CENTRES DE SANTÉ (chargés depuis le fichier JSON)
        $jsonPath = __DIR__ . '/../../data/centres_sante.json';
        if (file_exists($jsonPath)) {
            $json = file_get_contents($jsonPath);
            $centresData = json_decode($json, true);
            if (is_array($centresData)) {
                foreach ($centresData as $data) {
                    $centre = new CentreDeSante();
                    $centre->setNom($data['nom']);
                    $centre->setType($data['type']);
                    $centre->setAdresse($data['adresse'] ?? 'Non renseignée');
                    $centre->setVille($data['ville']);
                    $centre->setRegion($data['region']);
                    $centre->setLatitude((float) ($data['latitude'] ?? 0));
                    $centre->setLongitude((float) ($data['longitude'] ?? 0));
                    $centre->setTelephone($data['telephone'] ?? null);
                    $centre->setEmail($data['email'] ?? null);
                    $centre->setSiteWeb($data['siteWeb'] ?? null);
                    $centre->setImageUrl($data['imageUrl'] ?? null);
                    $centre->setHoraires($data['horaires'] ?? 'Non renseigné');
                    $centre->setStatut($data['statut'] ?? 'prive');
                    $centre->setQuartier($data['quartier'] ?? null);
                    $centre->setDescription($data['description'] ?? null);
                    $centre->setEstActif($data['estActif'] ?? true);
                    $centre->setUrgences24h($data['urgences24h'] ?? false);
                    $centre->setSpecialites($data['specialites'] ?? []);
                    $centre->setServices($data['services'] ?? []);
                    $manager->persist($centre);
                }
            }
        }

        // 6. MESSAGES (désactivé pour éviter les erreurs WebSocket lors du chargement des fixtures)
        /*
        for ($i = 0; $i < 10; $i++) {
            $msg = new Message();
            $msg->setContenu($faker->sentence(10));
            $msg->setExpediteur($patients[array_rand($patients)]);
            $msg->setDestinataire($medecins[array_rand($medecins)]);
            $msg->setIsRead($faker->boolean(30));
            $manager->persist($msg);
        }
        */

        $manager->flush();
    }
}
