<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\ProtocoleEtape;
use App\Entity\ProtocolePremiersGestes;
use App\Service\FirstAidContentLibrary;
use App\Service\FirstAidActionLibrary;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(
    name: 'app:generate-first-aid-catalog',
    description: 'Cree 500 fiches reliees a 100 protocoles maitres.',
)]
final class GenerateFirstAidCatalogCommand extends Command
{
    private const BATCH_SIZE = 25;
    private const IFRC_SOURCE = 'IFRC, International first aid, resuscitation and education guidelines 2025, https://www.ifrc.org/document/ifrc-international-first-aid-resuscitation-and-education-guidelines-2025';
    private const WHO_BEC_SOURCE = 'OMS/CICR, Basic Emergency Care, 2018, https://www.who.int/publications/i/item/9789241513081';
    private const ERC_BLS_SOURCE = 'European Resuscitation Council Guidelines 2025, Adult Basic Life Support, https://www.erc.edu/science-research/guidelines/guidelines-2025/';

    /** @var array<string, array{suffix: string}> */
    private const VARIANTS = [
        'STANDARD' => [
            'suffix' => '',
        ],
        'TEMOIN_SEUL' => [
            'suffix' => ' - témoin seul',
        ],
        'SECOURS_ELOIGNES' => [
            'suffix' => ' - secours éloignés',
        ],
        'TRANSPORT_EN_COURS' => [
            'suffix' => ' - transport en cours',
        ],
        'PLUSIEURS_VICTIMES' => [
            'suffix' => ' - plusieurs victimes',
        ],
    ];

    /** @var array<string, array{titre: string, instruction: string}> */
    private const VARIANT_ADAPTATIONS = [
        'TEMOIN_SEUL' => [
            'titre' => 'Agir seul avec le téléphone en haut-parleur',
            'instruction' => 'Appeler les secours en activant le haut-parleur, annoncer que vous êtes seul et suivre leurs consignes tout en restant auprès de la personne. Ne vous éloigner que si cela est indispensable pour alerter ou récupérer un équipement essentiel.',
        ],
        'SECOURS_ELOIGNES' => [
            'titre' => 'Préparer l’accès des secours et maintenir la surveillance',
            'instruction' => 'Donner des repères précis, envoyer si possible une personne guider les secours et poursuivre les gestes et la surveillance sans improviser de traitement. Signaler immédiatement toute aggravation au régulateur.',
        ],
        'TRANSPORT_EN_COURS' => [
            'titre' => 'Séparer la conduite de la surveillance',
            'instruction' => 'Le conducteur doit rester concentré sur la route. Une autre personne surveille la victime et le véhicule s’arrête dans un endroit sûr si un geste urgent devient nécessaire ou si l’état s’aggrave.',
        ],
        'PLUSIEURS_VICTIMES' => [
            'titre' => 'Signaler le nombre de victimes et répartir les tâches',
            'instruction' => 'Sécuriser la zone, annoncer le nombre de victimes et les dangers, puis répartir l’appel, la recherche de matériel et la surveillance. Prioriser une absence de respiration normale, une obstruction des voies aériennes ou un saignement massif.',
        ],
    ];

    /**
     * Les 13 slugs historiques reçoivent une version 2.0. Les 87 autres
     * commencent en version 1.0.
     *
     * @var array<string, array<int, array{string, string, string, string}>>
     */
    private const TOPICS = [
        'respiration' => [
            ['difficulte_respiratoire', 'Difficulté respiratoire', 'CRITIQUE', 'TOUS'],
            ['etouffement', 'Obstruction des voies aériennes', 'CRITIQUE', 'TOUS'],
            ['arret_cardiorespiratoire', 'Absence de respiration normale', 'CRITIQUE', 'ADULTE'],
            ['noyade', 'Noyade ou submersion', 'CRITIQUE', 'TOUS'],
            ['inhalation_fumee', 'Inhalation de fumée', 'CRITIQUE', 'TOUS'],
            ['crise_asthme', 'Crise d’asthme', 'ELEVE', 'TOUS'],
            ['hyperventilation', 'Respiration anormalement rapide', 'MOYEN', 'TOUS'],
            ['cyanose', 'Lèvres ou extrémités bleutées', 'CRITIQUE', 'TOUS'],
            ['obstruction_nourrisson', 'Étouffement du nourrisson', 'CRITIQUE', 'NOURRISSON'],
            ['detresse_respiratoire_enfant', 'Détresse respiratoire de l’enfant', 'CRITIQUE', 'ENFANT'],
        ],
        'inconscience' => [
            ['perte_de_connaissance', 'Perte de connaissance', 'CRITIQUE', 'TOUS'],
            ['convulsion', 'Convulsions', 'CRITIQUE', 'TOUS'],
            ['malaise', 'Malaise sans perte de connaissance', 'MOYEN', 'TOUS'],
            ['avc_suspecte', 'Accident vasculaire cérébral suspecté', 'CRITIQUE', 'ADULTE'],
            ['hypoglycemie_consciente', 'Hypoglycémie chez une personne consciente', 'ELEVE', 'TOUS'],
            ['hypoglycemie_inconsciente', 'Hypoglycémie avec perte de connaissance', 'CRITIQUE', 'TOUS'],
            ['hyperglycemie_grave', 'Hyperglycémie avec signes de gravité', 'ELEVE', 'TOUS'],
            ['confusion_aigue', 'Confusion aiguë', 'ELEVE', 'TOUS'],
            ['syncope_chaleur', 'Perte de connaissance liée à la chaleur', 'ELEVE', 'TOUS'],
            ['crise_panique', 'Crise de panique suspectée', 'MOYEN', 'TOUS'],
        ],
        'cardiovasculaire' => [
            ['douleur_thoracique', 'Douleur thoracique intense', 'CRITIQUE', 'TOUS'],
            ['choc_circulatoire', 'Signes de choc circulatoire', 'CRITIQUE', 'TOUS'],
        ],
        'saignements' => [
            ['saignement_externe_important', 'Saignement externe important', 'CRITIQUE', 'TOUS'],
            ['plaie', 'Plaie simple', 'MOYEN', 'TOUS'],
            ['saignement_nez', 'Saignement de nez', 'MOYEN', 'TOUS'],
            ['amputation', 'Amputation traumatique', 'CRITIQUE', 'TOUS'],
            ['objet_plante', 'Objet planté dans une plaie', 'ELEVE', 'TOUS'],
            ['plaie_oculaire', 'Plaie de l’œil', 'CRITIQUE', 'TOUS'],
            ['dent_expulsee', 'Dent définitive expulsée', 'ELEVE', 'TOUS'],
            ['morsure_humaine', 'Morsure humaine', 'ELEVE', 'TOUS'],
            ['morsure_animale', 'Morsure animale', 'ELEVE', 'TOUS'],
            ['ecrasement_membre', 'Écrasement d’un membre', 'CRITIQUE', 'TOUS'],
            ['plaie_pied_diabetique', 'Plaie du pied chez une personne diabétique', 'ELEVE', 'ADULTE'],
        ],
        'brulures' => [
            ['brulure', 'Brûlure thermique grave ou étendue', 'ELEVE', 'TOUS'],
            ['brulure_chimique', 'Brûlure chimique', 'CRITIQUE', 'TOUS'],
            ['brulure_electrique', 'Brûlure électrique', 'CRITIQUE', 'TOUS'],
            ['brulure_liquide_chaud', 'Brûlure par liquide chaud', 'ELEVE', 'TOUS'],
            ['brulure_solaire', 'Brûlure solaire', 'MOYEN', 'TOUS'],
            ['brulure_visage', 'Brûlure du visage ou des voies aériennes', 'CRITIQUE', 'TOUS'],
            ['brulure_oculaire_chimique', 'Projection chimique dans l’œil', 'CRITIQUE', 'TOUS'],
        ],
        'intoxications' => [
            ['intoxication', 'Intoxication suspectée', 'ELEVE', 'TOUS'],
            ['surdosage_medicament', 'Surdosage médicamenteux', 'CRITIQUE', 'TOUS'],
            ['intoxication_pesticide', 'Exposition à un pesticide', 'CRITIQUE', 'TOUS'],
            ['monoxyde_carbone', 'Intoxication au monoxyde de carbone', 'CRITIQUE', 'TOUS'],
            ['intoxication_alcool', 'Intoxication aiguë à l’alcool', 'ELEVE', 'TOUS'],
            ['ingestion_hydrocarbure', 'Ingestion de pétrole ou hydrocarbure', 'CRITIQUE', 'TOUS'],
            ['intoxication_alimentaire', 'Intoxication alimentaire suspectée', 'MOYEN', 'TOUS'],
            ['champignon_toxique', 'Ingestion de champignon suspect', 'ELEVE', 'TOUS'],
            ['projection_produit_peau', 'Produit chimique sur la peau', 'ELEVE', 'TOUS'],
            ['inhalation_produit_chimique', 'Inhalation de produit chimique', 'CRITIQUE', 'TOUS'],
            ['morsure_serpent', 'Morsure de serpent', 'CRITIQUE', 'TOUS'],
            ['piqure_scorpion', 'Piqûre de scorpion', 'ELEVE', 'TOUS'],
            ['exposition_rage', 'Exposition possible à la rage', 'ELEVE', 'TOUS'],
        ],
        'allergies' => [
            ['reaction_allergique', 'Réaction allergique', 'ELEVE', 'TOUS'],
            ['anaphylaxie', 'Anaphylaxie suspectée', 'CRITIQUE', 'TOUS'],
            ['piqure_insecte', 'Piqûre d’insecte', 'MOYEN', 'TOUS'],
            ['allergie_alimentaire', 'Réaction après ingestion d’un aliment', 'ELEVE', 'TOUS'],
        ],
        'traumatismes' => [
            ['traumatisme', 'Traumatisme de la tête, du cou ou d’un membre', 'ELEVE', 'TOUS'],
            ['traumatisme_cranien', 'Traumatisme crânien', 'CRITIQUE', 'TOUS'],
            ['traumatisme_colonne', 'Traumatisme de la colonne vertébrale', 'CRITIQUE', 'TOUS'],
            ['fracture_suspectee', 'Fracture suspectée', 'ELEVE', 'TOUS'],
            ['entorse', 'Entorse suspectée', 'MOYEN', 'TOUS'],
            ['luxation', 'Luxation suspectée', 'ELEVE', 'TOUS'],
            ['traumatisme_thoracique', 'Traumatisme du thorax', 'CRITIQUE', 'TOUS'],
            ['traumatisme_abdominal', 'Traumatisme abdominal', 'CRITIQUE', 'TOUS'],
            ['traumatisme_bassin', 'Traumatisme du bassin', 'CRITIQUE', 'TOUS'],
            ['corps_etranger_oeil', 'Corps étranger dans l’œil', 'ELEVE', 'TOUS'],
            ['fracture_dentaire', 'Dent fracturée', 'MOYEN', 'TOUS'],
            ['electrocution', 'Accident électrique', 'CRITIQUE', 'TOUS'],
            ['accident_route', 'Victime d’un accident de la route', 'CRITIQUE', 'TOUS'],
            ['chute_hauteur', 'Chute d’une hauteur', 'CRITIQUE', 'TOUS'],
            ['effondrement_ecrasement', 'Victime coincée ou écrasée', 'CRITIQUE', 'TOUS'],
            ['chute_personne_agee', 'Chute chez une personne âgée', 'ELEVE', 'PERSONNE_AGEE'],
        ],
        'fievre' => [
            ['deshydratation', 'Déshydratation sévère', 'ELEVE', 'TOUS'],
            ['fievre', 'Fièvre avec signes de gravité', 'ELEVE', 'TOUS'],
            ['fievre_nourrisson', 'Fièvre du nourrisson', 'CRITIQUE', 'NOURRISSON'],
            ['paludisme_signes_graves', 'Paludisme avec signes de gravité suspectés', 'CRITIQUE', 'TOUS'],
            ['diarrhee_aigue', 'Diarrhée aiguë', 'MOYEN', 'TOUS'],
            ['diarrhee_cholera', 'Diarrhée aqueuse abondante suspecte de choléra', 'CRITIQUE', 'TOUS'],
            ['vomissements_persistants', 'Vomissements persistants', 'ELEVE', 'TOUS'],
            ['meningite_signes_alerte', 'Signes d’alerte de méningite', 'CRITIQUE', 'TOUS'],
            ['douleur_abdominale_intense', 'Douleur abdominale intense', 'ELEVE', 'TOUS'],
            ['cephalee_soudaine', 'Mal de tête brutal et inhabituel', 'CRITIQUE', 'TOUS'],
            ['crise_drepanocytaire', 'Crise douloureuse drépanocytaire', 'ELEVE', 'TOUS'],
            ['convulsion_febrile_enfant', 'Convulsion fébrile de l’enfant', 'CRITIQUE', 'ENFANT'],
        ],
        'environnement' => [
            ['coup_chaleur', 'Coup de chaleur', 'CRITIQUE', 'TOUS'],
            ['epuisement_chaleur', 'Épuisement lié à la chaleur', 'ELEVE', 'TOUS'],
            ['hypothermie', 'Hypothermie', 'CRITIQUE', 'TOUS'],
            ['foudre', 'Personne frappée par la foudre', 'CRITIQUE', 'TOUS'],
        ],
        'maternite' => [
            ['saignement_grossesse', 'Saignement pendant la grossesse', 'CRITIQUE', 'GROSSESSE'],
            ['eclampsie_suspectee', 'Convulsion ou éclampsie suspectée', 'CRITIQUE', 'GROSSESSE'],
            ['accouchement_imminent', 'Accouchement imminent', 'CRITIQUE', 'GROSSESSE'],
            ['hemorragie_postpartum', 'Saignement important après accouchement', 'CRITIQUE', 'GROSSESSE'],
            ['douleur_grossesse_intense', 'Douleur intense pendant la grossesse', 'CRITIQUE', 'GROSSESSE'],
        ],
        'pediatrie' => [
            ['nouveau_ne_ne_respire_pas', 'Nouveau-né qui ne respire pas normalement', 'CRITIQUE', 'NOUVEAU_NE'],
            ['corps_etranger_enfant', 'Corps étranger avalé par un enfant', 'ELEVE', 'ENFANT'],
            ['intoxication_enfant', 'Intoxication suspectée chez l’enfant', 'CRITIQUE', 'ENFANT'],
            ['deshydratation_enfant', 'Déshydratation de l’enfant', 'ELEVE', 'ENFANT'],
            ['brulure_enfant', 'Brûlure chez l’enfant', 'ELEVE', 'ENFANT'],
            ['traumatisme_cranien_enfant', 'Traumatisme crânien chez l’enfant', 'CRITIQUE', 'ENFANT'],
        ],
    ];

    private const CATEGORY_GUIDANCE = [
        'respiration' => ['Éloigner le danger respiratoire sans s’exposer et libérer l’espace autour de la personne.', 'Ne pas faire boire et ne pas retarder l’appel si la respiration ou la parole est altérée.'],
        'inconscience' => ['Sécuriser la zone, vérifier la réponse et observer la respiration sans secouer la personne.', 'Ne rien mettre dans la bouche et ne pas donner à boire en cas de conscience altérée.'],
        'cardiovasculaire' => ['Mettre la personne au repos et limiter tout effort pendant l’évaluation.', 'Ne pas laisser la personne seule et ne pas lui donner un traitement non prescrit.'],
        'saignements' => ['Se protéger du contact avec le sang et utiliser un matériel propre si disponible.', 'Ne pas retirer un objet planté et ne pas interrompre une compression efficace sans raison.'],
        'brulures' => ['Supprimer la source du danger sans exposer le secouriste et protéger la zone atteinte.', 'Ne pas appliquer de glace, de graisse ou de produit traditionnel sur la lésion.'],
        'intoxications' => ['Éloigner la personne de l’exposition uniquement si cela peut être fait sans danger.', 'Ne pas provoquer de vomissement et ne rien administrer sans consigne spécialisée.'],
        'allergies' => ['Éloigner l’allergène si cela est possible sans risque et surveiller immédiatement la respiration.', 'Ne pas attendre une aggravation en présence d’un gonflement du visage, de la langue ou d’un malaise.'],
        'traumatismes' => ['Sécuriser les lieux et limiter les mouvements de la zone potentiellement blessée.', 'Ne pas remettre un os ou une articulation en place et ne pas déplacer inutilement la victime.'],
        'fievre' => ['Installer la personne dans un environnement sûr et rechercher les signes de gravité associés.', 'Ne pas masquer une altération de conscience ou une difficulté respiratoire par une simple automédication.'],
        'environnement' => ['Interrompre l’exposition sans mettre le secouriste en danger et déplacer seulement si nécessaire.', 'Éviter les changements de température brutaux et les gestes agressifs non validés.'],
        'maternite' => ['Installer la personne en sécurité, préserver son intimité et préparer une orientation immédiate.', 'Ne pas donner de médicament et ne pas retarder le transfert vers une maternité.'],
        'pediatrie' => ['Sécuriser l’enfant, le maintenir avec son accompagnant et observer respiration et conscience.', 'Ne pas appliquer un geste prévu pour l’adulte sans validation spécifique à l’âge.'],
    ];

    /**
     * Séquences détaillées utilisées pour construire le catalogue.
     *
     * @var array<string, array<int, array{type: string, titre: string, instruction: string}>>
     */
    private const CURATED_STANDARD_STEPS = [
        'arret_cardiorespiratoire' => [
            [
                'type' => 'PROTEGER',
                'titre' => 'Vérifier que vous pouvez intervenir sans danger',
                'instruction' => 'Regarder rapidement autour de vous. Ne vous exposez pas à la circulation, au feu, à l’électricité, à la fumée ou à un autre danger. Déplacer la personne uniquement si elle reste exposée à un danger immédiat.',
            ],
            [
                'type' => 'RECONNAITRE',
                'titre' => 'Vérifier la réponse et la respiration',
                'instruction' => 'Parler fort à la personne et stimuler doucement ses épaules. Si elle ne répond pas, ouvrir les voies aériennes en basculant prudemment la tête en arrière et en soulevant le menton. Pendant au maximum dix secondes, regarder si la poitrine se soulève et écouter la respiration. Des halètements rares, bruyants ou irréguliers ne sont pas une respiration normale.',
            ],
            [
                'type' => 'APPELER',
                'titre' => 'Appeler les secours et demander un défibrillateur',
                'instruction' => 'Appeler immédiatement le numéro d’urgence et activer le haut-parleur. Dire que la personne ne répond pas et ne respire pas normalement, puis donner l’adresse précise. Si une autre personne est présente, lui demander d’appeler et d’apporter un défibrillateur automatisé externe (DAE).',
            ],
            [
                'type' => 'FAIRE',
                'titre' => 'Commencer les compressions thoraciques',
                'instruction' => 'Allonger la personne sur le dos sur une surface ferme. Placer le talon d’une main au centre de la poitrine, poser l’autre main par-dessus et garder les bras tendus. Comprimer verticalement de cinq à six centimètres, à un rythme de cent à cent vingt compressions par minute, en laissant la poitrine remonter complètement après chaque compression.',
            ],
            [
                'type' => 'FAIRE',
                'titre' => 'Ajouter des insufflations seulement si vous êtes formé',
                'instruction' => 'Après trente compressions, réaliser deux insufflations si vous êtes formé et disposé à le faire. Chaque insufflation dure environ une seconde et doit seulement faire se soulever la poitrine. Si vous n’êtes pas formé, ne pouvez pas insuffler ou ne souhaitez pas le faire, poursuivre les compressions thoraciques sans interruption.',
            ],
            [
                'type' => 'FAIRE',
                'titre' => 'Utiliser le DAE dès qu’il est disponible',
                'instruction' => 'Allumer le DAE et suivre exactement ses instructions vocales. Dénuder et sécher rapidement la poitrine, puis coller les électrodes comme indiqué sur leurs dessins. Ne toucher personne pendant l’analyse ou la délivrance éventuelle du choc. Reprendre immédiatement les compressions lorsque le DAE le demande.',
            ],
            [
                'type' => 'SURVEILLER',
                'titre' => 'Continuer jusqu’au relais ou au retour d’une respiration normale',
                'instruction' => 'Poursuivre les cycles de réanimation et suivre les consignes du DAE jusqu’à l’arrivée des secours, la reprise évidente d’une respiration normale, l’épuisement physique ou l’apparition d’un danger. Si la personne recommence à respirer normalement mais reste inconsciente, la placer sur le côté et surveiller continuellement sa respiration. Recommencer la réanimation si la respiration redevient anormale.',
            ],
            [
                'type' => 'EVITER',
                'titre' => 'Ne pas retarder ou interrompre inutilement la réanimation',
                'instruction' => 'Ne pas perdre de temps à rechercher le pouls si vous n’êtes pas professionnel de santé. Ne rien donner à boire ou à manger. Ne pas arrêter les compressions pour déplacer la personne, sauf danger immédiat, et limiter au strict minimum toute interruption.',
            ],
        ],
    ];

    public function __construct(private readonly EntityManagerInterface $entityManager)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $topics = [];
        foreach (self::TOPICS as $category => $items) {
            foreach ($items as [$slug, $title, $urgency, $population]) {
                if (isset($topics[$slug])) {
                    throw new \LogicException(sprintf('Slug duplique dans le catalogue : %s', $slug));
                }
                $topics[$slug] = compact('category', 'title', 'urgency', 'population');
            }
        }

        if (count($topics) !== 100) {
            throw new \LogicException(sprintf('Le catalogue doit contenir 100 sujets uniques, %d trouves.', count($topics)));
        }

        $historicalSlugs = array_keys(AssignProtocolCategoriesCommand::METADATA);
        $created = 0;
        $skipped = 0;
        $updated = 0;
        $processed = 0;

        foreach ($topics as $masterSlug => $metadata) {
            foreach (self::VARIANTS as $variantKey => $variant) {
                $standard = $variantKey === 'STANDARD';
                $slug = $standard ? $masterSlug : $masterSlug . '__' . strtolower($variantKey);
                $version = $standard && in_array($masterSlug, $historicalSlugs, true) ? '2.0' : '1.0';
                [$protection, $avoid] = self::CATEGORY_GUIDANCE[$metadata['category']];
                $existing = $this->entityManager->getRepository(ProtocolePremiersGestes::class)
                    ->findOneBy(['slug' => $slug, 'version' => $version]);

                if ($existing instanceof ProtocolePremiersGestes) {
                    $existing
                        ->setMasterSlug($masterSlug)
                        ->setVariantKey($variantKey);
                    if ($this->needsDraftSynchronization($existing)) {
                        $existing
                            ->setTitre($metadata['title'] . $variant['suffix'])
                            ->setCategorie($metadata['category'])
                            ->setNiveauUrgence($metadata['urgency'])
                            ->setPopulation($metadata['population'])
                            ->setSourceClinique($this->sourceFor($masterSlug))
                            ->setRestrictionsPopulations($this->restrictionsFor($metadata['population'], $masterSlug))
                            ->setStatut(ProtocolePremiersGestes::STATUT_BROUILLON);
                        $this->replaceSteps(
                            $existing,
                            $this->buildDraftSteps(
                                $masterSlug,
                                $metadata['title'],
                                $metadata['urgency'],
                                $variantKey,
                                $protection,
                                $avoid
                            )
                        );
                        ++$updated;
                        ++$processed;
                        if (($processed % self::BATCH_SIZE) === 0) {
                            $this->entityManager->flush();
                            $this->entityManager->clear();
                        }
                        continue;
                    }
                    ++$skipped;
                    ++$processed;
                    if (($processed % self::BATCH_SIZE) === 0) {
                        $this->entityManager->clear();
                    }
                    continue;
                }

                $protocol = (new ProtocolePremiersGestes())
                    ->setSlug($slug)
                    ->setMasterSlug($masterSlug)
                    ->setVariantKey($variantKey)
                    ->setTitre($metadata['title'] . $variant['suffix'])
                    ->setCategorie($metadata['category'])
                    ->setNiveauUrgence($metadata['urgency'])
                    ->setPopulation($metadata['population'])
                    ->setVersion($version)
                    ->setStatut(ProtocolePremiersGestes::STATUT_BROUILLON)
                    ->setSourceClinique(self::IFRC_SOURCE . ' ; ' . self::WHO_BEC_SOURCE)
                    ->setRestrictionsPopulations($this->restrictionsFor($metadata['population'], $masterSlug));

                $protocol
                    ->setSourceClinique($this->sourceFor($masterSlug))
                    ->setRestrictionsPopulations($this->restrictionsFor($metadata['population'], $masterSlug));
                $this->replaceSteps(
                    $protocol,
                    $this->buildDraftSteps(
                        $masterSlug,
                        $metadata['title'],
                        $metadata['urgency'],
                        $variantKey,
                        $protection,
                        $avoid
                    )
                );

                $this->entityManager->persist($protocol);
                ++$created;
                ++$processed;

                if (($processed % self::BATCH_SIZE) === 0) {
                    $this->entityManager->flush();
                    $this->entityManager->clear();
                }
            }
        }

        $this->entityManager->flush();
        $output->writeln(sprintf('<info>Catalogue prêt : 100 protocoles maîtres, 500 fiches, %d créées, %d actualisées, %d déjà présentes.</info>', $created, $updated, $skipped));

        return Command::SUCCESS;
    }

    private function containsGeneratedPlaceholder(ProtocolePremiersGestes $protocol): bool
    {
        if ($protocol->getStatut() === ProtocolePremiersGestes::STATUT_RETIRE) {
            return false;
        }

        foreach ($protocol->getEtapes() as $step) {
            $instruction = mb_strtolower($step->getInstruction());
            if (
                str_contains($instruction, 'gestes précis doivent être complétés')
                || str_contains($instruction, 'gestes de premiers secours pour')
            ) {
                return true;
            }
        }

        return false;
    }

    private function needsDraftSynchronization(ProtocolePremiersGestes $protocol): bool
    {
        if ($protocol->getStatut() === ProtocolePremiersGestes::STATUT_RETIRE) {
            return false;
        }

        return true;
    }

    /**
     * @return array<int, array{type: string, titre: string, instruction: string}>
     */
    private function buildDraftSteps(
        string $masterSlug,
        string $title,
        string $urgency,
        string $variantKey,
        string $protection,
        string $avoid
    ): array {
        if (isset(self::CURATED_STANDARD_STEPS[$masterSlug])) {
            $steps = self::CURATED_STANDARD_STEPS[$masterSlug];
        } elseif (FirstAidContentLibrary::curatedSteps($masterSlug) !== null) {
            $steps = FirstAidContentLibrary::curatedSteps($masterSlug);
        } else {
            $action = FirstAidActionLibrary::get($masterSlug);
            $call = FirstAidContentLibrary::defaultCall($urgency);
            $steps = [
                [
                    'type' => 'RECONNAITRE',
                    'titre' => sprintf('Reconnaître « %s »', $title),
                    'instruction' => FirstAidContentLibrary::defaultRecognition(
                        $this->categoryFor($masterSlug),
                        $title
                    ),
                ],
                [
                    'type' => 'PROTEGER',
                    'titre' => 'Sécuriser la personne et le témoin',
                    'instruction' => $protection,
                ],
                [
                    'type' => 'FAIRE',
                    'titre' => $action['titre'],
                    'instruction' => $action['instruction'],
                ],
                [
                    'type' => 'EVITER',
                    'titre' => 'Éviter les gestes susceptibles d’aggraver la situation',
                    'instruction' => $avoid,
                ],
                [
                    'type' => 'SURVEILLER',
                    'titre' => 'Surveiller jusqu’à la prise en charge',
                    'instruction' => FirstAidContentLibrary::defaultMonitoring(
                        $this->populationFor($masterSlug)
                    ),
                ],
                [
                    'type' => 'APPELER',
                    'titre' => $call['titre'],
                    'instruction' => $call['instruction'],
                ],
            ];
        }

        if ($variantKey !== 'STANDARD') {
            $adaptation = self::VARIANT_ADAPTATIONS[$variantKey];
            array_splice($steps, max(1, count($steps) - 1), 0, [[
                'type' => 'ORIENTER',
                'titre' => $adaptation['titre'],
                'instruction' => $adaptation['instruction'],
            ]]);
        }

        return array_values($steps);
    }

    private function sourceFor(string $masterSlug): string
    {
        return FirstAidContentLibrary::sourceFor($masterSlug);
    }

    private function populationFor(string $masterSlug): string
    {
        foreach (self::TOPICS as $items) {
            foreach ($items as [$slug, , , $population]) {
                if ($slug === $masterSlug) {
                    return $population;
                }
            }
        }

        return 'TOUS';
    }

    private function categoryFor(string $masterSlug): string
    {
        foreach (self::TOPICS as $category => $items) {
            foreach ($items as [$slug]) {
                if ($slug === $masterSlug) {
                    return $category;
                }
            }
        }

        return '';
    }

    private function restrictionsFor(string $population, string $masterSlug): string
    {
        if ($masterSlug === 'arret_cardiorespiratoire') {
            return 'Destiné à l’adulte et à l’adolescent de morphologie adulte. Pour un nourrisson ou un enfant, suivre les instructions pédiatriques données par les secours. Les noyades, traumatismes et obstructions des voies aériennes nécessitent des adaptations spécifiques.';
        }

        return match ($population) {
            'NOURRISSON' => 'Réservé au nourrisson. Ne pas transposer les gestes et paramètres prévus pour l’adulte ou l’enfant plus âgé. Suivre les consignes des secours.',
            'NOUVEAU_NE' => 'Réservé au nouveau-né. Demander immédiatement une aide spécialisée et suivre les instructions des secours.',
            'ENFANT' => 'Réservé à l’enfant. Tenir compte de l’âge, du gabarit et des adaptations pédiatriques indiquées.',
            'GROSSESSE' => 'Concerne la grossesse ou le post-partum selon le titre. Signaler le terme et le contexte obstétrical aux secours.',
            'PERSONNE_AGEE' => 'Destiné à la personne âgée. Signaler la fragilité, les traitements anticoagulants, les troubles cognitifs et le contexte de chute.',
            'ADULTE' => 'Destiné à l’adulte. Ne pas transposer automatiquement les paramètres au nourrisson ou à l’enfant.',
            default => 'Tenir compte de l’âge, de la grossesse, du handicap, des comorbidités et des ressources disponibles. Suivre les consignes des secours.',
        };
    }

    /**
     * @param array<int, array{type: string, titre: string, instruction: string}> $steps
     */
    private function replaceSteps(ProtocolePremiersGestes $protocol, array $steps): void
    {
        foreach ($protocol->getEtapes()->toArray() as $existingStep) {
            $protocol->removeEtape($existingStep);
            $this->entityManager->remove($existingStep);
        }

        foreach ($steps as $index => $step) {
            $protocol->addEtape(
                (new ProtocoleEtape())
                    ->setPosition($index + 1)
                    ->setType($step['type'])
                    ->setTitre($step['titre'])
                    ->setInstruction($step['instruction'])
            );
        }
    }
}
