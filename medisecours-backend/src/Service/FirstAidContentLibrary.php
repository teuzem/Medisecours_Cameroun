<?php

declare(strict_types=1);

namespace App\Service;

/** Contenus de reference utilises pour construire les fiches de premiers secours. */
final class FirstAidContentLibrary
{
    private const IFRC_2025 = 'IFRC, International first aid, resuscitation and education guidelines 2025';
    private const IFRC_URL = 'https://www.ifrc.org/document/ifrc-international-first-aid-resuscitation-and-education-guidelines-2025';
    private const WHO_BEC = 'OMS/CICR, Basic Emergency Care, 2018';
    private const WHO_BEC_URL = 'https://www.who.int/publications/i/item/9789241513081';
    private const ERC_BLS = 'European Resuscitation Council Guidelines 2025, Adult Basic Life Support';
    private const ERC_BLS_URL = 'https://www.erc.edu/science-research/guidelines/guidelines-2025/';

    /** @var array<string, string[]> */
    private const IFRC_SECTIONS = [
        'Unresponsive and breathing normally' => [
            'perte_de_connaissance',
        ],
        'Drowning' => [
            'noyade',
        ],
        'Breathing difficulties' => [
            'difficulte_respiratoire', 'inhalation_fumee', 'hyperventilation',
            'cyanose', 'detresse_respiratoire_enfant',
        ],
        'Choking' => [
            'etouffement', 'obstruction_nourrisson', 'corps_etranger_enfant',
        ],
        'Asthma attack' => [
            'crise_asthme',
        ],
        'Severe bleeding' => [
            'saignement_externe_important', 'ecrasement_membre',
        ],
        'Chest and abdomen injuries' => [
            'traumatisme_thoracique', 'traumatisme_abdominal',
        ],
        'Amputation' => [
            'amputation',
        ],
        'Cuts and grazes' => [
            'plaie', 'objet_plante', 'plaie_oculaire', 'morsure_humaine',
            'morsure_animale', 'plaie_pied_diabetique',
        ],
        'Dental avulsion' => [
            'dent_expulsee', 'fracture_dentaire',
        ],
        'Burns' => [
            'brulure', 'brulure_chimique', 'brulure_electrique',
            'brulure_liquide_chaud', 'brulure_solaire', 'brulure_visage',
            'brulure_oculaire_chimique', 'brulure_enfant',
        ],
        'Fractures, sprains and strains' => [
            'traumatisme', 'fracture_suspectee', 'entorse', 'luxation',
            'chute_personne_agee',
        ],
        'Spinal injury' => [
            'traumatisme_colonne', 'traumatisme_bassin', 'accident_route',
            'chute_hauteur', 'effondrement_ecrasement',
        ],
        'Head injury and concussion' => [
            'traumatisme_cranien', 'traumatisme_cranien_enfant',
        ],
        'Eye injuries' => [
            'corps_etranger_oeil',
        ],
        'Snakebites' => [
            'morsure_serpent',
        ],
        'Poisoning' => [
            'intoxication', 'surdosage_medicament', 'intoxication_pesticide',
            'monoxyde_carbone', 'intoxication_alcool', 'ingestion_hydrocarbure',
            'intoxication_alimentaire', 'champignon_toxique',
            'projection_produit_peau', 'inhalation_produit_chimique',
            'piqure_scorpion', 'intoxication_enfant',
        ],
        'Nosebleeds' => [
            'saignement_nez',
        ],
        'Chest pain (cardiac)' => [
            'douleur_thoracique',
        ],
        'Stroke' => [
            'avc_suspecte', 'cephalee_soudaine',
        ],
        'Allergic reaction and anaphylaxis' => [
            'reaction_allergique', 'anaphylaxie', 'piqure_insecte',
            'allergie_alimentaire',
        ],
        'Shock' => [
            'choc_circulatoire',
        ],
        'Diabetic emergency (hypoglycemia)' => [
            'hypoglycemie_consciente', 'hypoglycemie_inconsciente',
            'hyperglycemie_grave',
        ],
        'Seizure' => [
            'convulsion', 'convulsion_febrile_enfant', 'eclampsie_suspectee',
        ],
        'Feeling faint' => [
            'malaise', 'syncope_chaleur', 'confusion_aigue',
        ],
        'Fever' => [
            'fievre', 'fievre_nourrisson',
        ],
        'Abdominal pain' => [
            'douleur_abdominale_intense',
        ],
        'Emergency childbirth' => [
            'accouchement_imminent', 'saignement_grossesse',
            'douleur_grossesse_intense',
        ],
        'Headache' => [
            'cephalee_soudaine',
        ],
        'Hyperthermia and dehydration' => [
            'deshydratation', 'deshydratation_enfant', 'coup_chaleur',
            'epuisement_chaleur', 'diarrhee_aigue', 'vomissements_persistants',
        ],
        'Hypothermia' => [
            'hypothermie',
        ],
        'Environmental emergencies' => [
            'foudre', 'electrocution',
        ],
        'Anxiety and panic' => [
            'crise_panique',
        ],
    ];

    /**
     * Overrides institutionnels pour les sujets qui nécessitent une référence
     * plus spécifique que le chapitre IFRC général.
     *
     * @var array<string, string>
     */
    private const SOURCE_OVERRIDES = [
        'arret_cardiorespiratoire' => self::IFRC_2025 . ', Unresponsive and abnormal breathing (adolescent and adult), '
            . self::IFRC_URL . ' ; ' . self::ERC_BLS . ', ' . self::ERC_BLS_URL,
        'morsure_serpent' => 'OMS, Snakebite envenoming - Treatment and first aid, '
            . 'https://www.who.int/teams/control-of-neglected-tropical-diseases/snakebite-envenoming/treatment'
            . ' ; ' . self::IFRC_2025 . ', Snakebites, ' . self::IFRC_URL,
        'exposition_rage' => 'OMS, Rage - conduite après exposition, '
            . 'https://www.who.int/news-room/fact-sheets/detail/rabies',
        'paludisme_signes_graves' => 'OMS, WHO guidelines for malaria, mise à jour du 13 août 2025, '
            . 'https://www.who.int/teams/global-malaria-programme/guidelines-for-malaria',
        'diarrhee_cholera' => 'OMS, Cholera - prise en charge et réhydratation, '
            . 'https://www.who.int/news-room/fact-sheets/detail/cholera',
        'meningite_signes_alerte' => 'OMS, Meningitis - signes et prise en charge urgente, '
            . 'https://www.who.int/news-room/fact-sheets/detail/meningitis',
        'crise_drepanocytaire' => 'OMS, Sickle-cell disease - prise en charge et signes nécessitant une évaluation urgente, '
            . 'https://www.who.int/news-room/fact-sheets/detail/sickle-cell-disease',
        'eclampsie_suspectee' => 'OMS, Recommendations for prevention and treatment of pre-eclampsia and eclampsia, '
            . 'https://www.who.int/publications/i/item/9789241548335',
        'hemorragie_postpartum' => 'OMS, Consolidated guidelines for the prevention, diagnosis and treatment of postpartum haemorrhage, 2025, '
            . 'https://www.who.int/publications/i/item/9789240115637',
        'nouveau_ne_ne_respire_pas' => 'OMS, Guidelines on basic newborn resuscitation, '
            . 'https://www.who.int/publications/i/item/9789241503693'
            . ' ; OMS, Essential Newborn Care Course, second edition, '
            . 'https://www.who.int/publications/i/item/9789240112698',
    ];

    /**
     * Séquences spécifiques qui remplacent les étapes génériques lorsque leur
     * réutilisation pourrait être imprécise ou dangereuse.
     *
     * @var array<string, array<int, array{type: string, titre: string, instruction: string}>>
     */
    private const CURATED_STEPS = [
        'etouffement' => [
            ['type' => 'RECONNAITRE', 'titre' => 'Évaluer si la toux reste efficace', 'instruction' => 'Demander à la personne de parler ou de tousser. Une personne qui parle, respire et tousse fortement présente une obstruction partielle. Une personne silencieuse, incapable de respirer ou de tousser efficacement, ou qui porte les mains à la gorge, présente une obstruction grave.'],
            ['type' => 'PROTEGER', 'titre' => 'Créer de l’espace autour de la personne', 'instruction' => 'Éloigner les objets dangereux, se placer de façon stable derrière ou à côté de la personne et ne pas intervenir dans une zone qui expose le témoin à un autre danger.'],
            ['type' => 'APPELER', 'titre' => 'Faire appeler les secours en cas d’obstruction grave', 'instruction' => 'Demander immédiatement à un témoin d’appeler les secours. Si vous êtes seul, activer le haut-parleur et suivre les consignes du régulateur sans abandonner la personne.'],
            ['type' => 'FAIRE', 'titre' => 'Encourager la toux si elle reste efficace', 'instruction' => 'Laisser la personne tousser et la surveiller. Ne pas donner de claques dans le dos tant que la toux est forte et efficace.'],
            ['type' => 'FAIRE', 'titre' => 'Alterner les gestes de désobstruction si elle ne respire plus correctement', 'instruction' => 'Pencher l’adulte ou l’enfant de plus d’un an vers l’avant et donner jusqu’à cinq claques fermes entre les omoplates. Si l’obstruction persiste, effectuer jusqu’à cinq compressions abdominales. Alterner les deux séries jusqu’à expulsion ou perte de connaissance. Pour une personne enceinte ou lorsque l’abdomen ne peut pas être entouré, utiliser des compressions thoraciques et suivre les consignes des secours.'],
            ['type' => 'SURVEILLER', 'titre' => 'Commencer la réanimation en cas de perte de connaissance', 'instruction' => 'Accompagner la personne au sol. Si elle ne répond pas et ne respire pas normalement, commencer la réanimation. Retirer uniquement un objet clairement visible dans la bouche, sans balayage à l’aveugle.'],
            ['type' => 'EVITER', 'titre' => 'Ne pas aggraver l’obstruction', 'instruction' => 'Ne pas faire boire, ne pas suspendre un enfant par les pieds et ne pas introduire les doigts dans la bouche sans voir l’objet. Une évaluation médicale est nécessaire après des compressions abdominales ou thoraciques, même si l’objet a été expulsé.'],
        ],
        'obstruction_nourrisson' => [
            ['type' => 'RECONNAITRE', 'titre' => 'Distinguer toux efficace et obstruction grave', 'instruction' => 'Si le nourrisson tousse, pleure ou respire encore efficacement, le laisser tousser sous surveillance. Une incapacité à pleurer, tousser ou respirer, une coloration bleue ou une diminution de la réactivité indiquent une obstruction grave.'],
            ['type' => 'PROTEGER', 'titre' => 'Installer le nourrisson sans risque de chute', 'instruction' => 'S’asseoir ou s’agenouiller si possible, libérer l’espace et soutenir continuellement la tête et le cou du nourrisson pendant les gestes.'],
            ['type' => 'APPELER', 'titre' => 'Faire appeler immédiatement les secours', 'instruction' => 'Demander à un témoin d’appeler et de mettre le téléphone en haut-parleur. Si vous êtes seul, commencer les gestes et suivre dès que possible les consignes du régulateur.'],
            ['type' => 'FAIRE', 'titre' => 'Donner cinq claques dorsales', 'instruction' => 'Soutenir la tête et la mâchoire, placer le nourrisson face vers le bas sur l’avant-bras, tête plus basse que le thorax, puis donner jusqu’à cinq claques fermes entre les omoplates. Vérifier après chaque claque si l’objet est expulsé.'],
            ['type' => 'FAIRE', 'titre' => 'Donner cinq compressions thoraciques si nécessaire', 'instruction' => 'Retourner le nourrisson face vers le haut en soutenant sa tête, toujours plus basse que le thorax. Effectuer jusqu’à cinq compressions au centre de la poitrine avec deux doigts. Alterner cinq claques dorsales et cinq compressions thoraciques.'],
            ['type' => 'SURVEILLER', 'titre' => 'Réagir immédiatement s’il devient inconscient', 'instruction' => 'Placer le nourrisson sur une surface ferme. S’il ne répond pas et ne respire pas normalement, commencer la réanimation pédiatrique guidée par les secours. Retirer seulement un objet visible et facilement accessible.'],
            ['type' => 'EVITER', 'titre' => 'Ne jamais effectuer de compression abdominale', 'instruction' => 'Ne pas pratiquer de manœuvre abdominale chez un nourrisson, ne pas secouer, ne pas suspendre par les pieds et ne pas explorer la bouche à l’aveugle.'],
        ],
        'saignement_externe_important' => [
            ['type' => 'RECONNAITRE', 'titre' => 'Reconnaître un saignement menaçant la vie', 'instruction' => 'Considérer le saignement comme grave s’il jaillit, coule continuellement, forme rapidement une flaque, imbibe plusieurs tissus, provient d’une amputation ou s’accompagne de pâleur, faiblesse, confusion ou malaise.'],
            ['type' => 'PROTEGER', 'titre' => 'Éviter le contact direct avec le sang', 'instruction' => 'Mettre des gants si disponibles ou utiliser une barrière propre. Ne retardez pas une compression vitale pour rechercher du matériel.'],
            ['type' => 'APPELER', 'titre' => 'Faire appeler immédiatement les secours', 'instruction' => 'Activer le haut-parleur et indiquer qu’il s’agit d’un saignement massif. Donner la localisation exacte et suivre les consignes du régulateur.'],
            ['type' => 'FAIRE', 'titre' => 'Comprimer directement et sans interruption', 'instruction' => 'Appuyer très fermement sur la plaie avec une compresse ou un tissu propre. Si le tissu est imbibé, ajouter du matériel par-dessus sans retirer la première couche et maintenir la pression jusqu’au relais.'],
            ['type' => 'FAIRE', 'titre' => 'Utiliser un matériel spécialisé seulement si vous savez le faire', 'instruction' => 'Si la compression directe ne contrôle pas un saignement d’un membre et qu’un garrot commercial est disponible, l’utiliser seulement selon sa notice, votre formation et les consignes du régulateur. Noter l’heure de pose et ne pas le desserrer.'],
            ['type' => 'SURVEILLER', 'titre' => 'Prévenir l’aggravation du choc', 'instruction' => 'Allonger la personne si sa respiration le permet, la couvrir, ne rien donner à boire ou à manger et surveiller continuellement conscience et respiration.'],
            ['type' => 'EVITER', 'titre' => 'Ne pas retirer un objet planté', 'instruction' => 'Comprimer autour de l’objet sans appuyer dessus. Ne pas retirer un pansement efficace, ne pas relâcher régulièrement la pression et ne pas utiliser un garrot improvisé sans instruction professionnelle.'],
        ],
        'brulure' => [
            ['type' => 'PROTEGER', 'titre' => 'Arrêter la source sans vous exposer', 'instruction' => 'Éloigner la personne de la chaleur, éteindre les flammes et retirer bijoux ou vêtements non collés. Ne pas arracher ce qui adhère à la peau.'],
            ['type' => 'RECONNAITRE', 'titre' => 'Rechercher les critères de gravité', 'instruction' => 'Appeler sans attendre si la brûlure est profonde, étendue, circulaire, électrique ou chimique, touche le visage, le cou, les mains, les organes génitaux ou une articulation, ou concerne un jeune enfant ou une personne fragile.'],
            ['type' => 'APPELER', 'titre' => 'Contacter les secours pour une brûlure grave ou étendue', 'instruction' => 'Appeler pendant le refroidissement si possible. Décrire la cause, la zone atteinte, l’âge de la personne et toute difficulté respiratoire.'],
            ['type' => 'FAIRE', 'titre' => 'Refroidir la brûlure pendant vingt minutes', 'instruction' => 'Faire couler doucement de l’eau propre et tempérée sur la zone pendant vingt minutes, idéalement le plus tôt possible. Refroidir la brûlure sans refroidir tout le corps.'],
            ['type' => 'FAIRE', 'titre' => 'Couvrir après le refroidissement', 'instruction' => 'Couvrir sans serrer avec un pansement stérile non adhérent ou un matériau propre. Maintenir le reste du corps au chaud et retirer les bijoux avant l’apparition du gonflement.'],
            ['type' => 'SURVEILLER', 'titre' => 'Surveiller respiration, conscience et refroidissement', 'instruction' => 'Rester auprès de la personne. Une voix modifiée, une toux, des suies autour du nez ou de la bouche, une difficulté respiratoire ou un malaise imposent une urgence immédiate.'],
            ['type' => 'EVITER', 'titre' => 'Ne pas appliquer de produit domestique', 'instruction' => 'Ne pas utiliser de glace, beurre, huile, dentifrice, poudre ou remède traditionnel. Ne pas percer les cloques et ne pas appliquer de pansement adhésif sur la brûlure.'],
        ],
        'intoxication' => [
            ['type' => 'PROTEGER', 'titre' => 'Éviter une seconde victime', 'instruction' => 'Ne pas toucher le produit à mains nues et ne pas entrer dans une zone contaminée ou mal ventilée. Éloigner la personne seulement si cela peut être fait sans danger.'],
            ['type' => 'RECONNAITRE', 'titre' => 'Identifier le produit et la voie d’exposition', 'instruction' => 'Chercher l’emballage, le nom du produit, la quantité possible, l’heure et la voie d’exposition : avalée, inhalée, sur la peau ou dans l’œil. Ne pas attendre l’apparition de symptômes.'],
            ['type' => 'APPELER', 'titre' => 'Demander immédiatement une consigne spécialisée', 'instruction' => 'Appeler les secours ou le centre antipoison compétent avec l’emballage à proximité. Suivre leurs instructions avant de donner quoi que ce soit.'],
            ['type' => 'FAIRE', 'titre' => 'Surveiller la respiration et conserver les preuves', 'instruction' => 'Garder le produit, l’emballage et les médicaments retrouvés pour les professionnels. Si la personne ne répond plus, vérifier sa respiration et suivre les consignes de réanimation du régulateur.'],
            ['type' => 'EVITER', 'titre' => 'Ne pas faire vomir et ne pas neutraliser le produit', 'instruction' => 'Ne pas provoquer de vomissement, ne pas donner de lait, d’huile, de citron, de charbon ou un antidote domestique sans instruction spécialisée.'],
            ['type' => 'SURVEILLER', 'titre' => 'Ne jamais laisser la personne seule', 'instruction' => 'Surveiller somnolence, vomissements, convulsions, difficulté respiratoire, brûlure de la bouche ou changement de comportement jusqu’à la prise en charge.'],
        ],
        'morsure_serpent' => [
            ['type' => 'PROTEGER', 'titre' => 'S’éloigner du serpent sans tenter de le capturer', 'instruction' => 'Mettre la personne et les témoins à distance. Ne pas poursuivre, manipuler ou tuer le serpent. Une photo prise à distance n’est utile que si elle ne retarde pas le transfert.'],
            ['type' => 'APPELER', 'titre' => 'Organiser immédiatement le transport vers une structure de santé', 'instruction' => 'Toute morsure suspectée doit être évaluée sans délai dans un centre capable de traiter une envenimation. Signaler l’heure, le lieu et les signes observés.'],
            ['type' => 'FAIRE', 'titre' => 'Immobiliser complètement la personne et le membre', 'instruction' => 'Rassurer, allonger ou asseoir la personne, retirer bagues, bracelets et objets serrés, immobiliser le membre avec une attelle et limiter strictement la marche. Faire porter la personne si possible.'],
            ['type' => 'SURVEILLER', 'titre' => 'Surveiller conscience, respiration et vomissements', 'instruction' => 'Rester auprès de la personne. Si elle vomit ou devient somnolente tout en respirant normalement, la placer sur le côté gauche, bouche orientée vers le bas. Être prêt à suivre les consignes de réanimation.'],
            ['type' => 'EVITER', 'titre' => 'Interdire les pratiques dangereuses', 'instruction' => 'Ne pas poser de garrot artériel serré, inciser, aspirer, masser, appliquer de pierre noire, glace, choc électrique, plante ou produit traditionnel. Ne pas donner d’alcool et ne pas retarder le transfert.'],
            ['type' => 'RECONNAITRE', 'titre' => 'Ne pas attendre des signes visibles', 'instruction' => 'Une morsure peut paraître peu douloureuse au début. Gonflement, saignement, faiblesse, paupières tombantes, difficulté à parler ou respirer, vomissements ou malaise indiquent une aggravation majeure.'],
        ],
        'convulsion' => [
            ['type' => 'PROTEGER', 'titre' => 'Écarter les dangers et protéger la tête', 'instruction' => 'Éloigner les objets durs, amortir la tête avec un vêtement plié et desserrer ce qui serre le cou. Ne déplacer la personne que si elle reste exposée à un danger immédiat.'],
            ['type' => 'RECONNAITRE', 'titre' => 'Chronométrer la crise', 'instruction' => 'Noter l’heure de début, la durée des secousses, la récupération, les blessures et les crises répétées. Ces informations sont importantes pour les secours.'],
            ['type' => 'EVITER', 'titre' => 'Ne rien mettre dans la bouche', 'instruction' => 'Ne pas retenir les mouvements, ne pas forcer l’ouverture de la bouche, ne pas donner à boire, à manger ou de médicament pendant la crise.'],
            ['type' => 'SURVEILLER', 'titre' => 'Vérifier la respiration après les secousses', 'instruction' => 'Lorsque les mouvements cessent, vérifier la respiration. Si elle est normale, placer la personne sur le côté et rester auprès d’elle. Si elle est anormale, commencer la réanimation guidée par les secours.'],
            ['type' => 'APPELER', 'titre' => 'Reconnaître les critères d’appel immédiat', 'instruction' => 'Appeler si la crise dure cinq minutes ou plus, se répète sans réveil complet, est la première connue, survient dans l’eau, pendant une grossesse, après un traumatisme, avec diabète ou fièvre, ou si la respiration ou la récupération reste anormale.'],
            ['type' => 'FAIRE', 'titre' => 'Rassurer pendant la récupération', 'instruction' => 'Réduire les stimulations, expliquer calmement ce qui s’est passé et préserver l’intimité. Ne pas laisser la personne reprendre une activité dangereuse avant récupération complète.'],
        ],
        'nouveau_ne_ne_respire_pas' => [
            ['type' => 'APPELER', 'titre' => 'Appeler immédiatement une aide obstétricale et néonatale', 'instruction' => 'Activer le haut-parleur et annoncer qu’un nouveau-né ne respire pas normalement. Suivre prioritairement les instructions du professionnel de régulation.'],
            ['type' => 'PROTEGER', 'titre' => 'Maintenir un environnement chaud et sûr', 'instruction' => 'Placer le nouveau-né sur une surface ferme, sèche et chaude près de la mère si la situation le permet. Retirer le linge mouillé et couvrir le corps en laissant le visage visible.'],
            ['type' => 'FAIRE', 'titre' => 'Sécher et stimuler doucement', 'instruction' => 'Sécher rapidement, frotter doucement le dos ou la plante des pieds et observer immédiatement la respiration. Ne pas secouer le nouveau-né.'],
            ['type' => 'RECONNAITRE', 'titre' => 'Vérifier la respiration sans perdre de temps', 'instruction' => 'Rechercher des mouvements respiratoires réguliers et efficaces. Une absence de respiration, des gasps ou une respiration très faible nécessitent une ventilation néonatale guidée par un professionnel formé.'],
            ['type' => 'SURVEILLER', 'titre' => 'Suivre les instructions de réanimation néonatale', 'instruction' => 'La priorité à la naissance est une ventilation efficace avec un équipement et une technique adaptés au nouveau-né. Continuer le maintien au chaud et suivre exactement les instructions des secours jusqu’au relais.'],
            ['type' => 'EVITER', 'titre' => 'Ne pas appliquer le protocole adulte', 'instruction' => 'Ne pas utiliser les profondeurs de compression, insufflations ou électrodes prévues pour l’adulte. Ne pas suspendre, secouer, claquer ou aspirer systématiquement la bouche et le nez.'],
        ],
        'hemorragie_postpartum' => [
            ['type' => 'RECONNAITRE', 'titre' => 'Considérer tout saignement important après l’accouchement comme une urgence', 'instruction' => 'Rechercher un écoulement abondant ou continu, des protections rapidement imbibées, des caillots importants, une pâleur, des vertiges, une faiblesse, une confusion ou une perte de connaissance.'],
            ['type' => 'APPELER', 'titre' => 'Appeler immédiatement les secours obstétricaux', 'instruction' => 'Dire clairement qu’il s’agit d’un saignement important après l’accouchement, préciser l’heure de naissance et la localisation exacte. Ne pas organiser seule un transport si la personne est instable.'],
            ['type' => 'PROTEGER', 'titre' => 'Allonger, couvrir et préserver l’intimité', 'instruction' => 'Installer la mère allongée, la maintenir au chaud et utiliser des protections propres pour observer le saignement. Garder le nouveau-né en sécurité et au chaud avec un accompagnant.'],
            ['type' => 'SURVEILLER', 'titre' => 'Surveiller continuellement conscience et respiration', 'instruction' => 'Ne pas laisser la mère seule. Noter toute aggravation et être prêt à suivre les instructions de réanimation si elle ne répond plus et ne respire pas normalement.'],
            ['type' => 'EVITER', 'titre' => 'Ne rien introduire et ne donner aucun médicament', 'instruction' => 'Ne rien introduire dans le vagin, ne pas tirer sur le cordon ou le placenta et ne pas administrer de médicament sans professionnel habilité.'],
            ['type' => 'FAIRE', 'titre' => 'Suivre uniquement les gestes dirigés par les secours', 'instruction' => 'Les gestes obstétricaux et médicaments relèvent de professionnels formés. Appliquer seulement les instructions données en temps réel par le régulateur ou une sage-femme présente.'],
        ],
    ];

    /**
     * @return array<int, array{type: string, titre: string, instruction: string}>|null
     */
    public static function curatedSteps(string $slug): ?array
    {
        return self::CURATED_STEPS[$slug] ?? null;
    }

    public static function sourceFor(string $slug): string
    {
        if (isset(self::SOURCE_OVERRIDES[$slug])) {
            return self::SOURCE_OVERRIDES[$slug];
        }

        foreach (self::IFRC_SECTIONS as $section => $slugs) {
            if (in_array($slug, $slugs, true)) {
                return sprintf('%s, section « %s », %s', self::IFRC_2025, $section, self::IFRC_URL);
            }
        }

        return 'Référence clinique spécifique à confirmer avant publication ; sources-cadres de rédaction : '
            . self::IFRC_2025 . ', ' . self::IFRC_URL . ' ; '
            . self::WHO_BEC . ', ' . self::WHO_BEC_URL;
    }

    public static function defaultMonitoring(string $population): string
    {
        if ($population === 'NOUVEAU_NE') {
            return 'Maintenir le nouveau-né au chaud et suivre les instructions néonatales des secours. Ne pas transposer automatiquement une technique ou un équipement prévu pour l’adulte.';
        }

        return 'Rester auprès de la personne et vérifier régulièrement sa réponse et sa respiration. Si elle ne répond plus et ne respire pas normalement, appeler immédiatement et commencer la réanimation adaptée à son âge selon les consignes des secours.';
    }

    public static function defaultRecognition(string $category, string $title): string
    {
        $introduction = sprintf(
            'Vérifier que les signes observés correspondent bien à « %s » et noter leur heure de début.',
            $title
        );

        $dangerSigns = match ($category) {
            'respiration' => 'Rechercher une incapacité à parler normalement, un effort respiratoire important, un épuisement, une coloration bleue ou une diminution de la conscience.',
            'inconscience' => 'Évaluer la réponse, la parole, les mouvements des deux côtés du corps et la respiration. Une récupération incomplète, une faiblesse d’un côté ou une respiration anormale est un signe de danger.',
            'cardiovasculaire' => 'Rechercher douleur ou oppression thoracique, sueurs, pâleur, essoufflement, malaise, douleur irradiant vers le bras, la mâchoire ou le dos, et modification de la conscience.',
            'saignements' => 'Observer la profondeur, la localisation, la quantité de sang, la présence d’un objet ou d’une déformation, ainsi que pâleur, faiblesse, confusion ou malaise.',
            'brulures' => 'Identifier la cause, la durée d’exposition, la zone, la profondeur apparente et les localisations à risque : visage, cou, mains, organes génitaux, articulation ou grande surface.',
            'intoxications' => 'Identifier le produit, la voie d’exposition, l’heure, la quantité possible et rechercher somnolence, vomissements, convulsions, brûlure, difficulté respiratoire ou changement de comportement.',
            'allergies' => 'Rechercher gonflement du visage ou de la langue, modification de la voix, difficulté respiratoire, vomissements répétés, malaise ou atteinte rapide de plusieurs parties du corps.',
            'traumatismes' => 'Rechercher douleur intense, déformation, incapacité à bouger, saignement, perte de sensibilité, traumatisme de la tête ou du cou et modification de la conscience.',
            'fievre' => 'Rechercher incapacité à boire, vomissements répétés, urines rares, confusion, somnolence inhabituelle, convulsion, raideur de nuque, difficulté respiratoire ou éruption inhabituelle.',
            'environnement' => 'Identifier l’exposition et sa durée, puis rechercher confusion, température corporelle anormale, peau très chaude ou très froide, difficulté respiratoire, faiblesse ou perte de connaissance.',
            'maternite' => 'Noter le terme si connu, l’heure de début, les douleurs, contractions, saignements, perte de liquide, convulsions et toute diminution de la conscience.',
            'pediatrie' => 'Observer le comportement habituel, la respiration, la couleur, la capacité à boire ou téter, les mouvements et la réaction de l’enfant à son accompagnant.',
            default => 'Vérifier immédiatement la réponse, la respiration et la présence d’un saignement important.',
        };

        return $introduction . ' ' . $dangerSigns;
    }

    public static function defaultCall(string $urgency): array
    {
        return match ($urgency) {
            'CRITIQUE' => [
                'titre' => 'Contacter immédiatement les secours',
                'instruction' => 'Appeler immédiatement, activer le haut-parleur, décrire les signes observés, donner la localisation précise et suivre les consignes jusqu’au relais.',
            ],
            'ELEVE' => [
                'titre' => 'Obtenir rapidement une évaluation professionnelle',
                'instruction' => 'Contacter sans attendre un professionnel ou une structure de santé. Appeler les secours si l’état s’aggrave, si la personne devient confuse, respire anormalement, ne peut pas se déplacer en sécurité ou appartient à une population fragile.',
            ],
            default => [
                'titre' => 'Demander un avis si les signes persistent ou inquiètent',
                'instruction' => 'Faire évaluer la situation si les signes persistent, empêchent une activité normale, s’aggravent ou concernent un enfant, une grossesse, une personne âgée ou une personne atteinte d’une maladie chronique.',
            ],
        };
    }
}
