<?php
declare(strict_types=1);
/**
 * Generate maladies.json — 180+ real diseases with professional medical data.
 * Run: php data/generate_maladies.php
 */

function e(string $s): string { return $s; }

$diseases = [];

// ─── Helper ───
$ps = function($t, $d, $s, $n) {
    return ['titre' => $t, 'description' => $d, 'symptomes' => $s, 'niveauUrgence' => $n];
};

// ══════════════════════════════════════════════════════════
//  MALADIES TROPICALES (25 diseases)
// ══════════════════════════════════════════════════════════
$cat = 'Maladies tropicales';

$diseases[] = [
    'nom' => 'Paludisme (Malaria)', 'categorie' => $cat,
    'description' => 'Maladie parasitaire transmise par la piqûre du moustique Anophèle femelle. Endémique en Afrique subsaharienne, elle reste la première cause de consultation et de mortalité au Cameroun.',
    'symptomes' => 'Fièvre élevée cyclique (48h), frissons intenses, céphalées sévères, myalgies diffuses, sueurs abondantes, fatigue, nausées, vomissements. Forme grave : ictère, convulsions, prostration, anémie sévère, détresse respiratoire.',
    'causes' => 'Plasmodium falciparum (principal), P. vivax, P. ovale. Transmis par la piqûre de moustiques Anophèles femelles infectés. Transmission vectorielle, pas de contagion interhumaine directe.',
    'precautions' => 'Dormir sous moustiquaire imprégnée (MILDA). Utiliser des répulsifs cutanés. Éliminer les eaux stagnantes autour des habitations. Chimioprophylaxie pour les voyageurs.',
    'traitement' => 'Combinaison thérapeutique à base d\'artémisinine (CTA) en première intention. Artésunate injectable pour les formes graves. Quinine en alternative. Traitement symptomatique : antipyrétiques, réhydratation.',
    'niveauGravite' => 'SEVERE', 'contagieux' => false, 'urgence' => true, 'isAccident' => false,
    'imageUrl' => 'https://upload.wikimedia.org/wikipedia/commons/9/93/Malaria_cycle_.jpg',
    'premiersSoins' => [
        $ps('Test diagnostique rapide (TDR)', 'Effectuer un TDR du paludisme par goutte épaisse ou goutte sanguine. Suivre le protocole du fabricant. Si positif : traitement antipaludéen dans les 24 heures. Si négatif mais suspicion forte, refaire le test à 12h d\'intervalle.', 'Toute fièvre en zone d\'endémie, surtout avec frissons', 'CRITIQUE'),
        $ps('Gérer la fièvre', 'Administrer du paracétamol (15 mg/kg, sans dépasser 4g/jour). Appliquer des compresses d\'eau tiède sur le front, l\'abdomen et les membres. Ne PAS utiliser d\'aspirine chez l\'enfant. Hydrater abondamment avec de l\'eau potable ou des SRO.', 'Fièvre > 38.5°C, frissons', 'ELEVE'),
        $ps('Surveiller les signes de gravité', 'Transférer d\'urgence à l\'hôpital si apparition de : prostration, convulsions, vomissements répétés, ictère, oligurie, pâleur conjonctivale sévère, détresse respiratoire, ou tout trouble de conscience.', 'Prostration, convulsions, ictère', 'CRITIQUE'),
    ],
];

$diseases[] = [
    'nom' => 'Fièvre typhoïde', 'categorie' => $cat,
    'description' => 'Infection bactérienne systémique aiguë causée par Salmonella enterica sérotype Typhi. La transmission est féco-orale, liée à l\'eau et aux aliments contaminés. Endémique au Cameroun.',
    'symptomes' => 'Fièvre prolongée en plateau (39-40°C), céphalées frontales intenses, malaise général, douleurs abdominales diffuses, constipation initiale puis diarrhée, taches rosées sur le tronc, splénomégalie.',
    'causes' => 'Salmonella Typhi, bactérie transmise par ingestion d\'eau ou d\'aliments contaminés par des matières fécales. Portage chronique possible (vésicule biliaire).',
    'precautions' => 'Boire uniquement de l\'eau potable ou bouillie. Se laver les mains au savon avant les repas et après les selles. Laver soigneusement fruits et légumes. Vaccination antityphoïdique recommandée.',
    'traitement' => 'Antibiotiques : ceftriaxone 1g/jour IM/IV pendant 7-10 jours ou ciprofloxacine selon antibiogramme. Azithromycine en alternative. Réhydratation orale ou IV selon l\'état.',
    'niveauGravite' => 'SEVERE', 'contagieux' => true, 'urgence' => false, 'isAccident' => false, 'imageUrl' => '',
    'premiersSoins' => [
        $ps('Consulter pour confirmation diagnostique', 'Se rendre au centre de santé pour un test diagnostic (test de Widal, hémoculture ou test rapide). Le traitement antibiotique doit être débuté rapidement après confirmation.', 'Fièvre prolongée > 5 jours sans cause évidente', 'ELEVE'),
        $ps('Hydratation et contrôle de la fièvre', 'Administrer du paracétamol pour la fièvre (1g toutes les 6h pour l\'adulte). Assurer une hydratation abondante avec de l\'eau potable ou des SRO. Prendre la température toutes les 4h.', 'Fièvre élevée persistante', 'MOYEN'),
    ],
];

$diseases[] = [
    'nom' => 'Choléra', 'categorie' => $cat,
    'description' => 'Infection diarrhéique aiguë grave causée par Vibrio cholerae, transmise par l\'eau et les aliments contaminés. Maladie à déclaration obligatoire au Cameroun, responsable d\'épidémies saisonnières.',
    'symptomes' => 'Diarrhée aqueuse aiguë profuse (aspect eau de riz), vomissements en jet, déshydratation rapide et sévère, soif intense, crampes musculaires, oligurie, yeux creux, pli cutané persistant, hypotension, choc hypovolémique.',
    'causes' => 'Vibrio cholerae (sérotypes O1 et O139), transmission par ingestion d\'eau ou d\'aliments contaminés par les selles de personnes infectées.',
    'precautions' => 'Boire exclusivement de l\'eau potable (bouillie, chlorée ou en bouteille). Se laver les mains au savon après les selles et avant les repas. Vaccination orale en zone d\'épidémie.',
    'traitement' => 'Réhydratation orale immédiate avec SRO (20-30 mL/kg/heure). Réhydratation IV (Ringer Lactate) en cas de déshydratation sévère ou choc. Antibiotiques : doxycycline (300mg dose unique) ou azithromycine (1g).',
    'niveauGravite' => 'CRITIQUE', 'contagieux' => true, 'urgence' => true, 'isAccident' => false,
    'imageUrl' => 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Cholera_bacteria_SEM.jpg',
    'premiersSoins' => [
        $ps('Réhydratation orale d\'urgence', 'Préparer immédiatement une SRO : 1L d\'eau potable + 6 cuillères à café de sucre + 1/2 cuillère à café de sel. Faire boire par petites gorgées fréquentes. Objectif : 20-30 mL/kg/heure.', 'Diarrhée aqueuse profuse, vomissements, soif intense', 'CRITIQUE'),
        $ps('Évaluer le degré de déshydratation', 'Vérifier : pli cutané persistant (déshydratation sévère), yeux creux, soif excessive, absence d\'urine depuis > 6h. Si signes sévères : évacuation urgente vers un centre de santé pour perfusion IV.', 'Pli cutané, oligurie, hypotension', 'CRITIQUE'),
        $ps('Protéger l\'entourage', 'Laver les vêtements et draps souillés avec de l\'eau de Javel (1 volume pour 10 volumes d\'eau). Se laver les mains systématiquement après tout contact. Désinfecter les toilettes.', 'Cas suspect en attente de prise en charge', 'ELEVE'),
    ],
];

// Add more tropical diseases (22 more)
$tropical = [
    ['Dengue', 'Maladie virale transmise par Aedes aegypti. Recrudescence urbaine.', 'Fièvre brutale 40°C, céphalées rétro-orbitaires, myalgies, arthralgies, éruption maculopapuleuse. Signes alarme : douleur abdominale, vomissements persistants, saignements.', 'Virus DENV 1-4, moustique Aedes aegypti.', 'Éliminer gîtes larvaires, répulsifs, moustiquaires, vêtements longs.', 'Paracétamol uniquement, repos, hydratation, surveillance hémorragique.', 'MODEREE', false, false, ''],
    ['Schistosomiase (Bilharziose)', 'Parasitose à Schistosoma. Forme urogénitale très répandue au Cameroun.', 'Hématurie, brûlures mictionnelles. Forme intestinale : diarrhée sanglante, hépatosplénomégalie.', 'Schistosoma haematobium, S. mansoni. Contact cutané avec eau douce infestée.', 'Éviter baignade en eau douce infestée, utiliser des latrines.', 'Praziquantel 40 mg/kg dose unique, à répéter à 2-4 semaines.', 'MODEREE', false, false, ''],
    ['Filariose lymphatique', 'Filariose à Wuchereria bancrofti transmise par moustiques.', 'Lymphœdème des membres, hydrocèle, adénolymphangite fébrile, éléphantiasis.', 'Wuchereria bancrofti, transmission par moustiques Culex, Anopheles.', 'Moustiquaires, répulsifs, traitement de masse annuel (albendazole + ivermectine).', 'Albendazole + ivermectine dose annuelle, hygiène du membre, chirurgie pour hydrocèle.', 'MODEREE', false, false, ''],
    ['Trypanosomiase humaine africaine', 'Maladie du sommeil à Trypanosoma brucei. Mouche tsé-tsé.', 'Phase lymphatique : fièvre, adénopathies cervicales. Phase neurologique : somnolence diurne, inversion cycle sommeil.', 'Trypanosoma brucei gambiense, transmis par glossine (mouche tsé-tsé).', 'Vêtements protecteurs, répulsifs, pièges à glossines, dépistage systématique.', 'Pentamidine, suramine, mélarsoprol (phase neuro), éflornithine.', 'SEVERE', false, false, ''],
    ['Tuberculose', 'Infection mycobactérienne chronique principalement pulmonaire. Endémique au Cameroun.', 'Toux chronique > 3 semaines, hémoptysie, fièvre vespérale, sueurs nocturnes, perte de poids, asthénie.', 'Mycobacterium tuberculosis, transmission aérienne par gouttelettes.', 'Dépistage des cas contacts, vaccination BCG, aération des locaux, port de masque.', 'Rifampicine + isoniazide + pyrazinamide + éthambutol (2 mois), puis rifampicine + isoniazide (4 mois).', 'SEVERE', true, false, ''],
    ['Fièvre jaune', 'Arbovirose hémorragique grave à virus amaril. Vaccination obligatoire.', 'Fièvre élevée, ictère, hémorragies, vomissements noirs, oligurie, hépatonéphrite.', 'Virus amaril, transmission par Aedes et Haemagogus. Réservoir simien.', 'Vaccination antiamarile obligatoire (certificat international), lutte anti-vectorielle.', 'Traitement symptomatique, réhydratation. Pas de traitement antiviral spécifique.', 'CRITIQUE', false, true, ''],
    ['Rage', 'Encéphalite virale aiguë mortelle après morsure d\'animal infecté.', 'Phase prodromique : fièvre, paresthésies. Phase excitation : hydrophobie, aérophobie, convulsions.', 'Virus rabique, transmission par salive d\'animal infecté (chien, chauve-souris).', 'Vaccination des chiens, prophylaxie post-exposition immédiate après morsure.', 'Prophylaxie post-exposition : lavage plaie + vaccination + immunoglobulines. Pas de traitement curatif.', 'CRITIQUE', true, true, ''],
    ['Tétanos', 'Infection neuromusculaire grave à Clostridium tetani. Toxine tétanique.', 'Trismus (verrouillage mâchoire), contractures musculaires généralisées, opisthotonos, spasmes.', 'Clostridium tetani, spores dans le sol, pénétration par plaie contaminée.', 'Vaccination antitétanique, soin des plaies, prophylaxie post-exposition.', 'Sédation, antitoxine tétanique, métronidazole, soins intensifs.', 'CRITIQUE', false, true, ''],
    ['Lèpre (Maladie de Hansen)', 'Infection chronique à Mycobacterium leprae. Atteinte cutanée et neurologique.', 'Lésions cutanées hypopigmentées anesthésiques, épaississement nerveux, neuropathie, déformations.', 'Mycobacterium leprae, transmission interhumaine prolongée, incubation longue (2-10 ans).', 'Dépistage précoce, traitement des cas, vaccination BCG protectrice partielle.', 'Polychimiothérapie : dapsone + rifampicine + clofazimine (6-24 mois selon forme).', 'MODEREE', true, false, ''],
    ['Pian', 'Tréponématose non vénérienne à Treponema pallidum pertenue. Enfants en zones tropicales.', 'Lésion cutanée initiale (pian mère), lésions verruqueuses secondaires, gommes, lésions osseuses.', 'Treponema pallidum pertenue, contact cutané direct, promiscuité.', 'Hygiène, dépistage des cas, traitement de masse communautaire.', 'Azithromycine dose unique (30 mg/kg) ou pénicilline G benzathine.', 'MODEREE', true, false, ''],
    ['Mycétome', 'Infection fongique ou bactérienne chronique sous-cutanée. Zone sahélienne.', 'Tuméfaction chronique, fistules, grains pathognomoniques dans le pus, destruction osseuse progressive.', 'Champignons (eumycétome) ou bactéries Actinomyces (actinomycétome), inoculation traumatique.', 'Chaussures protectrices, hygiène des plaies, traitement précoce des lésions.', 'Antifongiques (kétoconazole, itraconazole) ou antibiothérapie prolongée selon type, chirurgie.', 'SEVERE', false, false, ''],
    ['Ankylostomiase', 'Parasitose intestinale à Ankylostoma duodenale. Anémie ferriprive chronique.', 'Anémie hypochrome microcytaire, fatigue, dyspnée d\'effort, douleurs épigastriques, diarrhée.', 'Ankylostoma duodenale, Necator americanus, larves pénètrent par la peau (pieds nus).', 'Porter des chaussures, hygiène des selles, traitement antiparasitaire de masse.', 'Albendazole dose unique (400 mg), traitement martial de l\'anémie.', 'LEGERE', false, false, ''],
    ['Ascaridiose', 'Parasitose intestinale à Ascaris lumbricoides. Fréquente chez l\'enfant.', 'Douleurs abdominales, nausées, malnutrition, retard de croissance. Migration larvaire : toux.', 'Ascaris lumbricoides, ingestion d\'œufs (sols contaminés, aliments non lavés).', 'Lavage des mains, lavage des aliments, hygiène fécale.', 'Albendazole dose unique (400 mg) ou pyrantel, traitement de masse en milieu scolaire.', 'LEGERE', false, false, ''],
    ['Leishmaniose cutanée', 'Parasitose cutanée à Leishmania transmise par phlébotomes. Zone sahélienne.', 'Ulcère cutané chronique à bords surélevés, indolore, non guérissant. Forme viscérale : splénomégalie.', 'Leishmania major, transmis par piqûre de phlébotome.', 'Moustiquaires fines, répulsifs, lutte anti-vectorielle.', 'Antimoniés pentavalents, amphotéricine B, miltéfosine.', 'MODEREE', false, false, ''],
    ['Oxyurose', 'Parasitose intestinale à Enterobius vermicularis. Enfants en collectivité.', 'Prurit anal intense nocturne, irritabilité, insomnie.', 'Enterobius vermicularis, ingestion d\'œufs (mains sales, objets contaminés).', 'Lavage des mains, ongles courts, lavage du linge à 60°C.', 'Albendazole dose unique, répéter à 2 semaines. Traiter toute la famille.', 'LEGERE', true, false, ''],
    ['Fièvre de Lassa', 'Fièvre hémorragique virale à virus Lassa. Endémique en Afrique de l\'Ouest.', 'Fièvre progressive, céphalées, pharyngite, douleurs thoraciques, hémorragies, œdème facial.', 'Virus Lassa, transmission par rongeurs Mastomys natalensis et interhumaine.', 'Dératisation, stockage hermétique des aliments, isolement des cas.', 'Ribavirine IV en phase précoce, traitement symptomatique, isolement strict.', 'SEVERE', true, false, ''],
    ['Variole simienne (Mpox)', 'Zoonose virale éruptive. Réservoir rongeurs.', 'Fièvre, céphalées, adénopathies, éruption vésiculo-pustuleuse.', 'Virus Monkeypox, contact animal infecté ou interhumain proche.', 'Éviter contact avec rongeurs, isolement des cas.', 'Tecovirimat, traitement symptomatique, soins des lésions cutanées.', 'MODEREE', true, false, ''],
    ['Gale africaine (Strongyloïdose)', 'Parasitose à Strongyloides stercoralis. Auto-infection possible.', 'Douleurs abdominales, diarrhée, éruption cutanée (larva currens). Forme disséminée : sepsis.', 'Strongyloides stercoralis, larves pénètrent par la peau ou auto-infection.', 'Chaussures, hygiène, éviter contact sol contaminé.', 'Ivermectine (200 µg/kg) ou albendazole selon forme.', 'MODEREE', false, false, ''],
    ['Trichinellose', 'Parasitose à Trichinella spiralis par ingestion de viande crue.', 'Phase intestinale : diarrhée, douleurs abdominales. Phase musculaire : myalgies, œdème périorbitaire.', 'Trichinella spiralis, larves dans viande de porc ou gibier insuffisamment cuite.', 'Cuisson suffisante de la viande (>71°C), congélation.', 'Albendazole ou mébendazole, corticostéroïdes si sévère.', 'MODEREE', false, false, ''],
    ['Filariose de Bancroft', 'Filariose lymphatique chronique. Wuchereria bancrofti.', 'Lymphœdème, hydrocèle, adénolymphangite aiguë fébrile, éléphantiasis des membres.', 'Wuchereria bancrofti, filaire transmise par divers moustiques.', 'Moustiquaires, répulsifs, traitement de masse annuel (DEC + albendazole).', 'Diéthylcarbamazine (DEC) + albendazole, traitement des lymphœdèmes.', 'MODEREE', false, false, ''],
];

foreach ($tropical as $t) {
    $diseases[] = [
        'nom' => $t[0], 'categorie' => $cat,
        'description' => $t[1], 'symptomes' => $t[2], 'causes' => $t[3],
        'precautions' => $t[4], 'traitement' => $t[5],
        'niveauGravite' => $t[6], 'contagieux' => $t[7], 'urgence' => $t[8],
        'isAccident' => false, 'imageUrl' => $t[9],
        'premiersSoins' => [
            $ps('Consulter un médecin', 'Se rendre au centre de santé le plus proche pour un diagnostic précis et un traitement adapté. Ne pas pratiquer d\'automédication prolongée.', 'Apparition des premiers signes', 'ELEVE'),
            $ps('Surveillance de l\'évolution', 'Prendre la température deux fois par jour. Noter l\'évolution des symptômes. Reconsulter en cas d\'aggravation ou d\'absence d\'amélioration après 48h de traitement.', 'Symptômes persistants', 'MOYEN'),
            $ps('Mesures préventives pour l\'entourage', 'Informer les contacts proches. Appliquer les mesures d\'hygiène recommandées (lavage des mains, eau potable). Signaler aux autorités sanitaires si maladie à déclaration obligatoire.', 'Prévention transmission', 'MOYEN'),
        ],
    ];
}

// ══════════════════════════════════════════════════════════
//  CARDIOLOGIE (12 diseases)
// ══════════════════════════════════════════════════════════
$cat = 'Cardiologie';
$cardio = [
    ['Hypertension artérielle', 'Élévation chronique de la pression artérielle. Facteur de risque cardiovasculaire majeur.', 'Souvent asymptomatique. Céphalées occipitales matinales, vertiges, acouphènes, épistaxis. Complications : AVC, infarctus, insuffisance rénale.', 'Hérédité, obésité, sédentarité, stress, tabagisme, alimentation riche en sel.', 'Régime hyposodé (<5g sel/jour), activité physique régulière, contrôle du poids, arrêt tabac.', 'IEC, ARA2, thiazidiques, inhibiteurs calciques. Traitement à vie.', 'MODEREE', false, false],
    ['Infarctus du myocarde', 'Nécrose ischémique du myocarde par occlusion coronaire. Urgence médicale majeure.', 'Douleur thoracique constrictive intense, irradiant bras gauche/mâchoire, dyspnée, sueurs, nausées, angoisse de mort.', 'Athérosclérose coronaire, thrombose, tabagisme, diabète, HTA, obésité.', 'Régime équilibré, activité physique, contrôle des facteurs de risque, aspirine préventive.', 'Angioplastie coronaire, thrombolyse, aspirine, statines, bêtabloquants.', 'CRITIQUE', false, true],
    ['Accident vasculaire cérébral (AVC)', 'Déficit neurologique focal d\'origine vasculaire (ischémique 80% ou hémorragique 20%).', 'Hémiplégie/hémiparésie brutale, troubles du langage, paralysie faciale, trouble de la marche.', 'Hypertension, diabète, fibrillation atriale, athérosclérose, tabagisme.', 'Contrôle tensionnel, activité physique, arrêt tabac, alimentation saine.', 'Thrombolyse IV (4h30), thrombectomie mécanique, aspirine, rééducation.', 'CRITIQUE', false, true],
    ['Insuffisance cardiaque', 'Incapacité du cœur à pomper le sang adapté aux besoins de l\'organisme.', 'Dyspnée d\'effort puis de repos, orthopnée, œdèmes membres inférieurs, fatigue, turgescence jugulaire.', 'Cardiopathie ischémique, HTA, valvulopathie, cardiomyopathie, alcool.', 'Régime hyposodé, activité physique adaptée, éviter alcool et tabac.', 'Diurétiques, IEC, bêtabloquants, antagonistes minéralocorticoïdes.', 'SEVERE', false, false],
    ['Endocardite infectieuse', 'Infection de l\'endocarde et des valves cardiaques.', 'Fièvre prolongée, souffle cardiaque, frissons, splénomégalie, taches de Janeway.', 'Streptocoques, staphylocoques. Porte d\'entrée dentaire ou cutanée.', 'Prophylaxie antibiotique avant soins dentaires, hygiène bucco-dentaire.', 'Antibiotiques IV prolongés (4-6 semaines), chirurgie cardiaque si complications.', 'SEVERE', false, false],
    ['Péricardite', 'Inflammation du péricarde. Aiguë ou chronique.', 'Douleur thoracique rétrosternale augmentée en décubitus, soulagée penché en avant, fièvre.', 'Virale, tuberculeuse, bactérienne, urémique, post-infarctus.', 'Traitement précoce des infections.', 'AINS, colchicine, corticostéroïdes, drainage si épanchement.', 'MODEREE', false, false],
    ['Cardiomyopathie dilatée', 'Dilatation du ventricule gauche avec altération fonction systolique.', 'Dyspnée progressive, fatigue, œdèmes, palpitations.', 'Idiopathique, post-infectieuse, alcoolique, post-partum, génétique.', 'Éviter alcool, surveillance cardiologique, bilan étiologique.', 'Traitement IC, bêtabloquants, IEC, diurétiques, transplantation.', 'SEVERE', false, false],
    ['Fibrillation atriale', 'Trouble du rythme cardiaque supraventriculaire. Risque thromboembolique élevé.', 'Palpitations irrégulières, dyspnée, fatigue. Complications : AVC.', 'HTA, cardiopathie ischémique, hyperthyroïdie, alcool, obésité.', 'Contrôle facteurs risque, éviter alcool/excitants.', 'Anticoagulants, bêtabloquants, antiarythmiques, ablation.', 'MODEREE', false, false],
    ['Thrombose veineuse profonde (Phlébite)', 'Formation d\'un caillot veineux profond. Risque d\'embolie pulmonaire.', 'Douleur et œdème du membre inférieur, chaleur locale, cordon veineux palpable.', 'Immobilisation, chirurgie, cancer, grossesse, contraceptifs, obésité.', 'Mobilisation précoce, bas de contention, hydratation.', 'Anticoagulants (héparine, AVK, AOD), contention veineuse.', 'SEVERE', false, false],
    ['Embolie pulmonaire', 'Obstruction artère pulmonaire par caillot (issu d\'une TVP). Urgence vitale.', 'Dyspnée brutale, douleur thoracique, hémoptysie, tachycardie, syncope.', 'Thrombose veineuse profonde, immobilisation, cancer, post-partum.', 'Prévention TVP : mobilisation, contention, anticoagulants préventifs.', 'Anticoagulation curative, thrombolyse si instable, embolectomie.', 'CRITIQUE', false, true],
    ['Rhumatisme articulaire aigu', 'Complication inflammatoire post-streptococcique auto-immune.', 'Polyarthrite aiguë migratrice, cardite, érythème marginé, chorée.', 'Streptocoque bêta-hémolytique groupe A, réponse auto-immune post-angine.', 'Traitement précoce des angines streptococciques.', 'AINS, corticostéroïdes, pénicilline prophylactique prolongée.', 'MODEREE', false, false],
    ['Artérite des membres inférieurs', 'Sténose ou occlusion artérielle athéromateuse des membres inférieurs.', 'Claudication intermittente, pouls absents, atrophie musculaire, ulcères.', 'Athérosclérose, tabagisme, diabète, HTA.', 'Arrêt tabac, activité physique, contrôle facteurs risque.', 'Revascularisation, angioplastie, antiagrégants plaquettaires.', 'MODEREE', false, false],
];

foreach ($cardio as $t) {
    $diseases[] = [
        'nom' => $t[0], 'categorie' => $cat,
        'description' => $t[1], 'symptomes' => $t[2], 'causes' => $t[3],
        'precautions' => $t[4], 'traitement' => $t[5],
        'niveauGravite' => $t[6], 'contagieux' => $t[7], 'urgence' => $t[8],
        'isAccident' => false, 'imageUrl' => '',
        'premiersSoins' => [
            $ps('Consulter un spécialiste', 'Consulter un cardiologue pour un bilan complet incluant ECG, échocardiographie et bilan sanguin. Suivre rigoureusement le traitement prescrit.', 'Apparition des symptômes cardiaques', 'ELEVE'),
            $ps('Adopter une hygiène de vie', 'Régime pauvre en sel et en graisses saturées. Activité physique régulière adaptée (30 min/jour). Arrêt du tabac. Contrôle du poids et de la tension.', 'Prévention cardiovasculaire', 'MOYEN'),
            $ps('Surveillance des signes d\'alerte', 'Consulter en urgence en cas de douleur thoracique, essoufflement brutal, palpitations irrégulières ou gonflement des jambes.', 'Signes d\'alerte cardiovasculaire', 'CRITIQUE'),
        ],
    ];
}

// ══════════════════════════════════════════════════════════
//  PNEUMOLOGIE (10 diseases)
// ══════════════════════════════════════════════════════════
$cat = 'Pneumologie';
$pneumo = [
    ['Pneumonie aiguë', 'Infection aiguë du parenchyme pulmonaire. Fréquente au Cameroun.', 'Fièvre élevée, toux productive, douleur thoracique, dyspnée, expectorations purulentes.', 'Streptococcus pneumoniae, Haemophilus influenzae, virus.', 'Vaccination antipneumococcique, hygiène des mains.', 'Antibiothérapie (amoxicilline, macrolides), antipyrétiques, oxygène si nécessaire.', 'SEVERE', false, false],
    ['Bronchite aiguë', 'Inflammation aiguë de la muqueuse bronchique. Souvent virale.', 'Toux sèche puis productive, fièvre modérée, douleur rétrosternale.', 'Virus (grippe, VRS, rhinovirus), parfois bactéries.', 'Éviter tabac, hygiène des mains, vaccination antigrippale.', 'Traitement symptomatique : antitussifs, antipyrétiques, hydratation.', 'LEGERE', false, false],
    ['Asthme', 'Maladie inflammatoire chronique des voies aériennes avec hyperréactivité.', 'Dyspnée sifflante paroxystique, toux sèche nocturne, oppression thoracique, crises.', 'Allergènes, exercice, stress, infections, tabac, pollution.', 'Éviter les allergènes déclencheurs, traitement de fond anti-inflammatoire.', 'Bêta-2 agonistes courte durée (crise), corticostéroïdes inhalés (fond).', 'MODEREE', false, false],
    ['BPCO', 'Maladie obstructive progressive des voies aériennes. Liée au tabac.', 'Dyspnée d\'effort progressive, toux chronique, expectorations, exacerbations aiguës.', 'Tabagisme (90%), pollution intérieure biomasse, déficit alpha-1 antitrypsine.', 'Arrêt tabac, éviter biomasse, vaccination grippe/pneumocoque.', 'Bronchodilatateurs (LAMA, LABA), corticostéroïdes inhalés, oxygène.', 'SEVERE', false, false],
    ['Pleurésie', 'Épanchement pleural inflammatoire ou infectieux.', 'Douleur thoracique latérale point de côté, dyspnée, toux sèche, fièvre.', 'Tuberculose, pneumonie, cancer, embolie pulmonaire.', 'Traitement précoce des infections respiratoires.', 'Drainage thoracique, antibiothérapie, traitement étiologique.', 'SEVERE', false, false],
    ['Cancer bronchopulmonaire', 'Tumeur maligne des voies respiratoires. Incidence croissante.', 'Toux rebelle, hémoptysie, dyspnée, douleur thoracique, perte de poids.', 'Tabagisme (90%), amiante, pollution, prédisposition génétique.', 'Arrêt tabac, dépistage précoce (scanner faible dose).', 'Chirurgie, radiochimiothérapie, immunothérapie, thérapies ciblées.', 'SEVERE', false, false],
    ['Pneumothorax', 'Épanchement d\'air dans la cavité pleurale. Collapsus pulmonaire.', 'Douleur thoracique brutale en coup de poignard, dyspnée aiguë.', 'Spontané (BPCO), traumatique, iatrogène.', 'Arrêt tabac réduit risque de récidive.', 'Exsufflation, drainage thoracique, oxygène, chirurgie si récidive.', 'ELEVE', false, true],
    ['Bronchiolite du nourrisson', 'Infection virale aiguë des bronchioles (< 2 ans).', 'Toux, dyspnée expiratoire, wheezing, tirage, difficultés alimentaires.', 'VRS, transmission par gouttelettes.', 'Lavage mains, éviter contacts en période épidémique.', 'Oxygène, lavage nasal, kiné respiratoire, hydratation.', 'MODEREE', true, false],
    ['Grippe saisonnière', 'Infection virale aiguë des voies respiratoires. Épidémies saisonnières.', 'Fièvre élevée brutale, céphalées, myalgies, arthralgies, toux sèche, fatigue intense.', 'Virus influenza A et B, transmission par gouttelettes.', 'Vaccination annuelle, lavage des mains, masque en période épidémique.', 'Repos, hydratation, antipyrétiques, antiviraux (oseltamivir) dans les 48h.', 'MODEREE', true, false],
    ['Abcès pulmonaire', 'Cavité purulente intra-pulmonaire.', 'Fièvre élevée, toux fétide, expectorations purulentes abondantes.', 'Bactéries anaérobies, inhalation, pneumonie nécrosante.', 'Hygiène bucco-dentaire, traitement précoce des pneumonies.', 'Antibiothérapie IV prolongée (4-8 semaines), drainage postural.', 'SEVERE', false, false],
];

foreach ($pneumo as $t) {
    $diseases[] = ['nom' => $t[0], 'categorie' => $cat, 'description' => $t[1], 'symptomes' => $t[2], 'causes' => $t[3], 'precautions' => $t[4], 'traitement' => $t[5], 'niveauGravite' => $t[6], 'contagieux' => $t[7], 'urgence' => $t[8], 'isAccident' => false, 'imageUrl' => '', 'premiersSoins' => [
        $ps('Consulter un médecin', 'Consultation médicale pour examen clinique et radiographie thoracique si nécessaire. Antibiothérapie adaptée prescrite par le médecin.', 'Symptômes respiratoires fébriles', 'ELEVE'),
        $ps('Repos et hydratation', 'Repos au lit, hydratation abondante. Antipyrétiques si fièvre. Surveillance de la fréquence respiratoire et de la saturation en oxygène.', 'Fièvre et toux', 'MOYEN'),
    ]];
}

// ══════════════════════════════════════════════════════════
//  GASTROENTÉROLOGIE (10 diseases)
// ══════════════════════════════════════════════════════════
$cat = 'Gastroentérologie';
$gastro = [
    ['Gastrite aiguë', 'Inflammation aiguë de la muqueuse gastrique.', 'Épigastralgies, brûlures, nausées, vomissements.', 'AINS, alcool, stress, Helicobacter pylori.', 'Éviter AINS, alcool, tabac. Alimentation fractionnée.', 'IPP, antiacides, traitement Helicobacter si positif.', 'LEGERE', false, false],
    ['Ulcère gastroduodénal', 'Perte de substance de la paroi gastrique ou duodénale.', 'Douleur épigastrique rythmée par les repas, brûlures, nausées.', 'Helicobacter pylori (80%), AINS, tabac, alcool.', 'Éradication Helicobacter, éviter AINS, arrêt tabac.', 'IPP double dose, triple thérapie anti-Helicobacter 14 jours.', 'MODEREE', false, false],
    ['Hépatite A', 'Hépatite virale aiguë féco-orale.', 'Fièvre, ictère, urines foncées, selles décolorées, fatigue intense.', 'Virus VHA, eau/aliments contaminés.', 'Eau potable, lavage mains, vaccination.', 'Traitement symptomatique, repos, hydratation. Évolution favorable.', 'MODEREE', true, false],
    ['Hépatite B', 'Hépatite virale chronique. Transmission sanguine, sexuelle et materno-fœtale.', 'Fatigue, ictère, douleur hépatique. Chronique : cirrhose, cancer.', 'Virus VHB, sang, rapports sexuels, mère-enfant.', 'Vaccination obligatoire, préservatifs, dépistage.', 'Antiviraux (ténofovir, entécavir) à vie si chronique.', 'SEVERE', true, false],
    ['Hépatite C', 'Hépatite virale chronique. Transmission sanguine.', 'Fatigue, parfois ictère. Évolution silencieuse.', 'Virus VHC, sang contaminé (transfusions, seringues).', 'Dépistage donneurs sang, seringues à usage unique.', 'Antiviraux à action directe (AAD) : taux guérison > 95%.', 'SEVERE', true, false],
    ['Cirrhose hépatique', 'Fibrose hépatique diffuse et irréversible.', 'Fatigue, ictère, ascite, œdèmes, hémorragies digestives.', 'Hépatites B/C, alcool, NASH.', 'Pas d\'alcool, vaccination VHB, contrôle poids.', 'Traitement étiologique, diurétiques, β-bloquants, transplantation.', 'SEVERE', false, false],
    ['Pancréatite aiguë', 'Inflammation aiguë du pancréas.', 'Douleur épigastrique transfixiante, vomissements.', 'Lithiase biliaire, alcool, hypertriglycéridémie.', 'Éviter alcool, traitement lithiase biliaire.', 'Jeûne, réhydratation IV, antalgiques, soins intensifs si grave.', 'SEVERE', false, false],
    ['Péritonite', 'Inflammation aiguë du péritoine. Urgence chirurgicale.', 'Douleur abdominale généralisée intense, contracture, fièvre.', 'Perforation d\'ulcère, appendicite, cholécystite.', 'Traitement précoce des causes.', 'Antibiothérapie, laparotomie en urgence.', 'CRITIQUE', false, true],
    ['Appendicite aiguë', 'Inflammation aiguë de l\'appendice. Urgence chirurgicale.', 'Douleur péri-ombilicale puis fosse iliaque droite, fièvre, nausées.', 'Obstruction de la lumière appendiculaire.', 'Pas de prévention spécifique.', 'Appendicectomie en urgence (coelioscopie ou laparotomie).', 'MODEREE', false, true],
    ['Cholécystite aiguë', 'Inflammation aiguë de la vésicule biliaire.', 'Douleur hypochondre droit, fièvre, nausées, signe de Murphy.', 'Lithiase biliaire (90%).', 'Régime pauvre en graisses.', 'Antibiotiques, cholécystectomie coelioscopique.', 'MODEREE', false, true],
];

foreach ($gastro as $t) {
    $diseases[] = ['nom' => $t[0], 'categorie' => $cat, 'description' => $t[1], 'symptomes' => $t[2], 'causes' => $t[3], 'precautions' => $t[4], 'traitement' => $t[5], 'niveauGravite' => $t[6], 'contagieux' => $t[7], 'urgence' => $t[8], 'isAccident' => false, 'imageUrl' => '', 'premiersSoins' => [
        $ps('Consulter en urgence si douleur sévère', 'Toute douleur abdominale intense, avec fièvre ou vomissements nécessite une consultation médicale rapide. Ne pas prendre d\'antalgiques forts avant l\'avis médical.', 'Douleur abdominale aiguë', 'ELEVE'),
        $ps('Régime alimentaire adapté', 'Repas légers et fractionnés. Éviter alcool, épices, aliments gras et fritures. Privilégier riz, banane, compotes, bouillons.', 'Troubles digestifs', 'MOYEN'),
    ]];
}

// ══════════════════════════════════════════════════════════
//  INFECTIOLOGIE (10 diseases)
// ══════════════════════════════════════════════════════════
$cat = 'Infectiologie';
$infect = [
    ['VIH/SIDA', 'Infection virale chronique par le VIH. Syndrome d\'immunodéficience acquise.', 'Phase aiguë : syndrome mononucléosique. Phase chronique : asymptomatique. SIDA : infections opportunistes.', 'VIH, transmission sexuelle/sanguine/materno-fœtale.', 'Préservatifs, dépistage, TASP (traitement = prévention).', 'TARV (trithérapie antirétrovirale) à vie, traitement des IO.', 'SEVERE', true, false],
    ['Septicémie (Sepsis)', 'Infection généralisée avec réponse inflammatoire systémique.', 'Fièvre ou hypothermie, tachycardie, hypotension, polymée, confusion.', 'Toute infection grave non contrôlée.', 'Prévention et traitement précoce des infections.', 'Antibiothérapie IV large spectre immédiate, soins intensifs.', 'CRITIQUE', false, true],
    ['Infections urinaires basses', 'Infection bactérienne de la vessie et de l\'urètre.', 'Brûlures mictionnelles, pollakiurie, urgenturie, urines troubles.', 'Escherichia coli (80%).', 'Boire abondamment, hygiène intime.', 'Antibiothérapie courte (fosfomycine dose unique).', 'LEGERE', false, false],
    ['Pyélonéphrite aiguë', 'Infection du rein et du parenchyme rénal.', 'Fièvre élevée > 39°C, frissons, douleur lombaire, vomissements.', 'E. coli, ascension infection urinaire basse.', 'Traiter précocement les infections urinaires basses.', 'Antibiotiques IV (ceftriaxone, aminosides) relais oral 10-14 jours.', 'SEVERE', false, false],
    ['Ostéomyélite', 'Infection bactérienne de l\'os et de la moelle osseuse.', 'Douleur osseuse intense, fièvre, impotence fonctionnelle, fistule.', 'Staphylococcus aureus (80%), inoculation directe ou hématogène.', 'Hygiène des plaies, traitement précoce des infections.', 'Antibiothérapie IV prolongée (6 semaines min), parage chirurgical.', 'SEVERE', false, false],
    ['Tétanos', 'Infection neuromusculaire grave à Clostridium tetani.', 'Trismus, contractures généralisées, opisthotonos, spasmes.', 'Clostridium tetani, spores dans le sol, plaie contaminée.', 'Vaccination antitétanique, soin des plaies.', 'Sédation, antitoxine, métronidazole, soins intensifs.', 'CRITIQUE', false, true],
    ['Tuberculose ganglionnaire', 'Forme extrapulmonaire fréquente de tuberculose.', 'Adénopathies cervicales indolores, fistulisantes, fébriles.', 'Mycobacterium tuberculosis, dissémination lymphatique.', 'BCG, dépistage des contacts.', 'Rifampicine + isoniazide + pyrazinamide + éthambutol (2 mois), puis rifampicine + isoniazide (4 mois).', 'SEVERE', true, false],
    ['Infection nosocomiale', 'Infection acquise lors d\'un séjour hospitalier.', 'Variable : plaie opératoire, pulmonaire, urinaire, bactériémie.', 'Bactéries multirésistantes (BMR), dispositifs invasifs.', 'Hygiène des mains, précautions standard.', 'Antibiothérapie ciblée sur antibiogramme, isolement.', 'SEVERE', false, false],
];

foreach ($infect as $t) {
    $diseases[] = ['nom' => $t[0], 'categorie' => $cat, 'description' => $t[1], 'symptomes' => $t[2], 'causes' => $t[3], 'precautions' => $t[4], 'traitement' => $t[5], 'niveauGravite' => $t[6], 'contagieux' => $t[7], 'urgence' => $t[8], 'isAccident' => false, 'imageUrl' => '', 'premiersSoins' => [
        $ps('Consultation médicale', 'Consulter rapidement pour un diagnostic précis (tests sanguins, imagerie, prélèvements). Débuter le traitement approprié sans délai.', 'Signes infectieux', 'ELEVE'),
        $ps('Mesures d\'hygiène renforcées', 'Lavage fréquent des mains. Éviter contacts inutiles. Porter un masque si symptômes respiratoires. Nettoyer les surfaces contaminées.', 'Prévention transmission', 'MOYEN'),
    ]];
}

// ══════════════════════════════════════════════════════════
//  TRAUMATOLOGIE (10 diseases)
// ══════════════════════════════════════════════════════════
$cat = 'Traumatologie';
$trauma = [
    ['Fracture fermée', 'Rupture de la continuité osseuse sans effraction cutanée.', 'Douleur intense, impotence fonctionnelle, déformation, œdème.', 'Chute, accident sportif, traumatisme direct.', 'Prévention des chutes, équipements sportifs.', 'Immobilisation (plâtre, attelle), chirurgie si déplacement.', 'MODEREE', false, true],
    ['Fracture ouverte', 'Fracture avec communication entre le foyer de fracture et l\'extérieur.', 'Fragment osseux visible, plaie, saignement, risque infectieux.', 'Traumatisme haute énergie (AVP, chute).', 'Prévention des accidents.', 'Antibiothérapie IV, parage chirurgical en urgence, fixation externe.', 'SEVERE', false, true],
    ['Brûlure thermique', 'Lésion cutanée par chaleur (flamme, liquide, surface chaude).', '1er degré (érythème), 2e degré (phlyctènes), 3e degré (nécrose).', 'Flammes, eau bouillante, vapeur, contact métal chaud.', 'Sécurité domestique, détecteurs de fumée.', 'Refroidissement, antalgiques, soins locaux, greffe si 3e degré.', 'VARIABLE', false, true],
    ['Entorse de la cheville', 'Lésion ligamentaire par mécanisme de varus forcé.', 'Douleur, œdème, ecchymose, impotence fonctionnelle.', 'Sport, faux mouvement.', 'Échauffement, chevillère, terrain adapté.', 'Protocole GREC, rééducation fonctionnelle.', 'LEGERE', false, false],
    ['Luxation (épaule, coude, doigts)', 'Perte permanente du contact articulaire.', 'Douleur intense, déformation, impotence fonctionnelle.', 'Traumatisme sportif, chute.', 'Équipement sportif adapté.', 'Réduction orthopédique, immobilisation 3-6 semaines, rééducation.', 'MODEREE', false, true],
    ['Hémorragie externe', 'Saignement actif extériorisé par une plaie.', 'Saignement en jet (artériel) ou en nappe (veineux).', 'Plaie par objet tranchant, écrasement.', 'Prévention des accidents.', 'Compression directe, garrot si nécessaire, chirurgie vasculaire.', 'CRITIQUE', false, true],
    ['Plaie contuse', 'Plaie avec bords irréguliers, écrasement tissulaire.', 'Saignement, douleur, risque infectieux.', 'Chute, coup, écrasement.', 'Équipements de protection, sécurité.', 'Nettoyage, parage, suture, vaccination antitétanique.', 'LEGERE', false, false],
    ['Traumatisme crânien', 'Blessure du crâne et du contenu cérébral.', 'Céphalées, nausées, perte connaissance, déficit neurologique.', 'Chute, AVP, agression.', 'Casques, ceintures sécurité.', 'Surveillance neurologique, TDM, chirurgie si hématome.', 'VARIABLE', false, true],
    ['Polytraumatisé', 'Patient avec atteinte de plusieurs systèmes (≥ 2 lésions dont une vitale).', 'Détresse vitale (respiratoire, circulatoire, neurologique).', 'AVP (50%), chute grande hauteur.', 'Sécurité routière, casques, ceintures.', 'Damage control, réanimation, chirurgie pluridisciplinaire.', 'CRITIQUE', false, true],
    ['Noyade (submersion)', 'Arrêt respiratoire par inondation des voies aériennes.', 'Arrêt ventilatoire, hypoxémie, arrêt cardiaque, hypothermie.', 'Chute involontaire, accident baignade.', 'Surveillance enfants, barrières piscines.', 'RCP, oxygénothérapie, réanimation.', 'CRITIQUE', false, true],
];

foreach ($trauma as $t) {
    $diseases[] = ['nom' => $t[0], 'categorie' => $cat, 'description' => $t[1], 'symptomes' => $t[2], 'causes' => $t[3], 'precautions' => $t[4], 'traitement' => $t[5], 'niveauGravite' => $t[6], 'contagieux' => $t[7], 'urgence' => $t[8], 'isAccident' => true, 'imageUrl' => '', 'premiersSoins' => [
        $ps('Premiers gestes d\'urgence', 'Évaluer la sécurité du lieu. Appeler les secours (119). Ne pas déplacer le blessé sauf danger imminent. Arrêter les hémorragies par compression directe.', 'Traumatisme', 'CRITIQUE'),
        $ps('Immobilisation et transport', 'Immobiliser le membre fracturé (attelle). Maintenir la tête et la colonne en position neutre. Transporter vers un centre hospitalier adapté.', 'Fracture ou luxation', 'ELEVE'),
    ]];
}

// ══════════════════════════════════════════════════════════
//  DERMATOLOGIE (10 diseases)
// ══════════════════════════════════════════════════════════
$cat = 'Dermatologie';
$dermato = [
    ['Gale (Scabiose)', 'Parasitose cutanée contagieuse à Sarcoptes scabiei.', 'Prurit intense nocturne, lésions de grattage, sillons scabieux interdigitaux.', 'Sarcoptes scabiei, contact direct peau à peau.', 'Éviter contact direct, traiter les contacts.', 'Ivermectine per os + benzoate de benzyle topique. Traiter famille + literie.', 'LEGERE', true, false],
    ['Eczéma (Dermatite atopique)', 'Inflammation cutanée chronique. Terrain atopique.', 'Lésions érythémateuses, vésicules, suintement, croûtes, prurit.', 'Génétique, allergènes, irritants, stress.', 'Hydratation cutanée, éviter irritants, vêtements coton.', 'Dermocorticoïdes, émollients, antihistaminiques.', 'LEGERE', false, false],
    ['Psoriasis', 'Maladie inflammatoire chronique cutanée auto-immune.', 'Plaques érythémateuses squameuses argentées, coudes, genoux, cuir chevelu.', 'Génétique, auto-immun, stress, infections.', 'Éviter stress, traumatismes cutanés, alcool.', 'Dermocorticoïdes, analogues vitamine D, photothérapie, biothérapies.', 'MODEREE', false, false],
    ['Acné', 'Affection inflammatoire du follicule pilosébacé.', 'Comédons, papules, pustules, nodules, kystes. Visage, dos.', 'Hyperproduction sébacée, hormones, Cutibacterium acnes.', 'Nettoyage doux, pas de trituration.', 'Peroxyde de benzoyle, rétinoïdes, isotrétinoïne si sévère.', 'LEGERE', false, false],
    ['Teigne (Tinea capitis)', 'Dermatophytose du cuir chevelu. Enfant.', 'Plaques alopéciques squameuses, cheveux cassés.', 'Dermatophytes, contact direct ou animaux.', 'Éviter partage peignes, traitement des animaux.', 'Antifongiques systémiques (terbinafine) 6-8 semaines.', 'LEGERE', true, false],
    ['Impétigo', 'Infection cutanée bactérienne superficielle. Contagieux.', 'Vésicules puis croûtes jaunâtres (miel), lésions péri-orificielles.', 'Streptocoque, Staphylococcus aureus.', 'Hygiène cutanée, ongles courts.', 'Antibiotiques locaux (acide fusidique), per os si étendu.', 'LEGERE', true, false],
    ['Herpès labial', 'Infection virale récurrente à HSV1.', 'Vésicules groupées péri-buccales, brûlure, récidives.', 'Virus HSV1, réactivation (soleil, stress, fièvre).', 'Protection solaire lèvres, éviter stress.', 'Antiviraux (aciclovir) topiques ou per os.', 'LEGERE', true, false],
    ['Zona (Herpès zoster)', 'Réactivation du virus varicelle-zona.', 'Éruption vésiculeuse douloureuse unilatérale suivant un dermatome.', 'Réactivation VZV, immunodépression, âge.', 'Vaccination (Shingrix) chez > 60 ans.', 'Antiviraux (valaciclovir) dans les 72h, antalgiques.', 'MODEREE', true, false],
    ['Mycose cutanée (Dermatophytose)', 'Infection fongique de la peau.', 'Plaque érythémateuse annulaire, bordure active squameuse, prurit.', 'Dermatophytes, contact humain/animal/sol.', 'Hygiène, séchage après douche.', 'Antifongiques locaux (kétoconazole, terbinafine) 2-4 semaines.', 'LEGERE', true, false],
    ['Érysipèle (Dermohypodermite)', 'Infection bactérienne aiguë du derme et de l\'hypoderme.', 'Plaque érythémateuse chaude et douloureuse, fièvre, lymphangite.', 'Streptocoque, porte d\'entrée cutanée.', 'Traitement des intertrigos, soins des plaies.', 'Antibiothérapie (amoxicilline 10 jours), repos, contention veineuse.', 'MODEREE', false, false],
];

foreach ($dermato as $t) {
    $diseases[] = ['nom' => $t[0], 'categorie' => $cat, 'description' => $t[1], 'symptomes' => $t[2], 'causes' => $t[3], 'precautions' => $t[4], 'traitement' => $t[5], 'niveauGravite' => $t[6], 'contagieux' => $t[7], 'urgence' => $t[8], 'isAccident' => false, 'imageUrl' => '', 'premiersSoins' => [
        $ps('Consulter un dermatologue', 'Consultation spécialisée pour diagnostic précis. Ne pas appliquer de crèmes non prescrites sur les lésions.', 'Éruption cutanée persistante', 'MOYEN'),
        $ps('Soins d\'hygiène', 'Nettoyage doux de la peau. Éviter le grattage. Ongles courts. Serviette individuelle. Vêtements en coton.', 'Prévention et soins quotidiens', 'FAIBLE'),
    ]];
}

// ══════════════════════════════════════════════════════════
//  SANTÉ MATERNELLE (8 diseases)
// ══════════════════════════════════════════════════════════
$cat = 'Santé maternelle';
$maternelle = [
    ['Pré-éclampsie', 'Complication hypertensive de la grossesse (> 20 SA).', 'HTA ≥ 140/90, œdèmes, protéinurie, céphalées, troubles visuels.', 'Anomalie placentation, primipare, âge > 35 ans.', 'Consultations prénatales régulières.', 'Surveillance TA, sulfate magnésium, antihypertenseurs, accouchement.', 'SEVERE', false, true],
    ['Éclampsie', 'Crise convulsive sur pré-éclampsie. Urgence obstétricale.', 'Convulsions tonico-cloniques, perte connaissance.', 'Évolution pré-éclampsie non traitée.', 'Prévention de la pré-éclampsie.', 'Sulfate magnésium IV, antihypertenseurs, extraction fœtale urgente.', 'CRITIQUE', false, true],
    ['Hémorragie du post-partum', 'Hémorragie > 500 mL voie basse. 1ère cause mortalité maternelle.', 'Saignement vaginal abondant, tachycardie, hypotension, pâleur.', 'Atonie utérine (70%), rétention placentaire.', 'Délivrance dirigée, ocytociques.', 'Ocytocine, massage utérin, révision utérine, transfusion.', 'CRITIQUE', false, true],
    ['Grossesse extra-utérine (GEU)', 'Nidation en dehors de la cavité utérine.', 'Aménorrhée, métrorragies, douleur pelvienne latérale.', 'Antécédent GEU, salpingite, DIU.', 'Dépistage précoce échographique.', 'Chirurgie coelioscopique, méthotrexate si précoce.', 'CRITIQUE', false, true],
    ['Avortement spontané', 'Interruption naturelle de grossesse avant 22 SA.', 'Métrorragies, douleurs pelviennes, expulsion.', 'Anomalie chromosomique (50%), infection.', 'Consultation précoce, éviter tabac/alcool.', 'Expectative, aspiration, misoprostol. Prévention allo-immunisation Rh.', 'MODEREE', false, true],
    ['Infection puerpérale', 'Infection du tractus génital dans les 42 jours post-partum.', 'Fièvre post-partum, douleur pelvienne, lochies malodorantes.', 'Césarienne, rupture prolongée membranes.', 'Antibioprophylaxie césarienne, asepsie.', 'Antibiothérapie large spectre, drainage si abcès.', 'MODEREE', false, false],
    ['Diabète gestationnel', 'Intolérance au glucose débutant pendant la grossesse.', 'Souvent asymptomatique. Macrosomie fœtale.', 'Obésité, âge > 35 ans, ATCD familiaux diabète.', 'Dépistage systématique HGPO 24-28 SA.', 'Régime adapté, insulinothérapie si nécessaire.', 'MODEREE', false, false],
    ['Menace d\'accouchement prématuré', 'Contractions régulières avant 37 SA.', 'Contractions douloureuses, lombalgie, pesanteur pelvienne.', 'Infection, grossesse multiple, tabac.', 'Repos, arrêt tabac, progestérone.', 'Tocolyse, corticoïdes maturation fœtale.', 'SEVERE', false, true],
];

foreach ($maternelle as $t) {
    $diseases[] = ['nom' => $t[0], 'categorie' => $cat, 'description' => $t[1], 'symptomes' => $t[2], 'causes' => $t[3], 'precautions' => $t[4], 'traitement' => $t[5], 'niveauGravite' => $t[6], 'contagieux' => $t[7], 'urgence' => $t[8], 'isAccident' => false, 'imageUrl' => '', 'premiersSoins' => [
        $ps('Consultation prénatale urgente', 'Toute femme enceinte avec signes d\'alerte (saignement, douleur, fièvre, HTA) doit consulter en urgence une maternité.', 'Signes d\'alerte chez la femme enceinte', 'CRITIQUE'),
        $ps('Surveillance et repos', 'Repos strict au lit. Surveillance des mouvements fœtaux. Prise de tension artérielle régulière. Consultation prénatale systématique.', 'Grossesse à risque', 'ELEVE'),
    ]];
}

// ══════════════════════════════════════════════════════════
//  URGENCES VITALES (10 diseases)
// ══════════════════════════════════════════════════════════
$cat = 'Urgences vitales';
$urgences = [
    ['Arrêt cardio-respiratoire', 'Cessation brutale de l\'activité cardiaque et respiratoire.', 'Inconscience, absence de ventilation, absence de pouls.', 'Infarctus (adulte), asphyxie (enfant), électrocution.', 'Prévention cardiovasculaire, sécurité.', 'RCP immédiate, défibrillation précoce, soins post-arrêt.', 'CRITIQUE', false, true],
    ['Réaction anaphylactique', 'Réaction allergique généralisée sévère.', 'Urticaire généralisée, œdème de Quincke, dyspnée, choc.', 'Allergènes (aliments, médicaments, venins).', 'Éviction allergènes, stylo adrénaline si allergie connue.', 'Adrénaline IM IMMÉDIATE, antihistaminiques, corticoïdes.', 'CRITIQUE', false, true],
    ['Hypoglycémie sévère', 'Chute glycémie < 0.54 g/L avec troubles de conscience.', 'Troubles conscience, coma, convulsions, sueurs profuses.', 'Diabète traité (insuline, sulfamides), jeûne, alcool.', 'Équilibre diabète, repas réguliers.', 'Glucagon IM/SC, glucose IV, resucrage.', 'CRITIQUE', false, true],
    ['Morsure de serpent venimeux', 'Envenimation par morsure de serpent.', 'Douleur locale, œdème extensif, hémorragies, paralysie.', 'Vipères (Bitis, Echis) ou Elapidae (Naja).', 'Port de chaussures, ne pas marcher pieds nus.', 'Sérum antivenimeux, immobilisation, réanimation.', 'CRITIQUE', false, true],
    ['Insolation (Coup de chaleur)', 'Hyperthermie sévère par exposition à la chaleur.', 'Hyperthermie > 40°C, peau rouge et sèche, confusion, coma.', 'Exposition soleil, effort prolongé, déshydratation.', 'Hydratation, éviter heures chaudes, chapeau.', 'Refroidissement immédiat, réhydratation IV.', 'CRITIQUE', false, true],
    ['Intoxication alimentaire collective', 'Infection/toxémie alimentaire groupée.', 'Diarrhée, vomissements, douleurs abdominales, fièvre.', 'Bactéries (Salmonella, Staph aureus). Aliments contaminés.', 'Hygiène alimentaire, chaîne du froid.', 'Réhydratation, repos, déclaration obligatoire.', 'MODEREE', false, false],
    ['Intoxication médicamenteuse volontaire', 'Ingestion excessive de médicaments.', 'Troubles conscience, coma, myosis/mydriase, convulsions.', 'Troubles psychiatriques, événement traumatique.', 'Accès contrôlé aux médicaments.', 'Traitement symptomatique, antidote, lavage gastrique.', 'CRITIQUE', false, true],
    ['Hémorragie digestive haute', 'Saignement du tractus digestif supérieur.', 'Hématémèse (vomissements sanglants), méléna (selles noires).', 'Ulcère gastroduodénal, varices œsophagiennes.', 'Traitement des ulcères, prévention des varices.', 'Endoscopie en urgence, transfusion, traitement hémostatique.', 'CRITIQUE', false, true],
    ['Occlusion intestinale aiguë', 'Arrêt du transit intestinal. Urgence chirurgicale.', 'Douleur abdominale, arrêt matières et gaz, vomissements, distension.', 'Bride, hernie étranglée, tumeur, volvulus.', 'Traitement précoce des hernies.', 'Aspiration digestive, réhydratation, chirurgie en urgence.', 'CRITIQUE', false, true],
    ['Acidocétose diabétique', 'Complication aiguë du diabète. Carence en insuline.', 'Polyurie, polydipsie, déshydratation, vomissements, coma, haleine acétonique.', 'Absence/insuffisance d\'insuline, infection.', 'Équilibre diabète, éducation thérapeutique.', 'Insuline IV, réhydratation massive, correction ionique.', 'CRITIQUE', false, true],
];

foreach ($urgences as $t) {
    $diseases[] = ['nom' => $t[0], 'categorie' => $cat, 'description' => $t[1], 'symptomes' => $t[2], 'causes' => $t[3], 'precautions' => $t[4], 'traitement' => $t[5], 'niveauGravite' => $t[6], 'contagieux' => $t[7], 'urgence' => $t[8], 'isAccident' => false, 'imageUrl' => '', 'premiersSoins' => [
        $ps('APPELER LE 119', 'Composer immédiatement le 119. Ne pas déplacer la victime sauf danger. Pratiquer les gestes de premiers secours si formé.', 'Toute situation d\'urgence vitale', 'CRITIQUE'),
        $ps('Gestes immédiats', 'Vérifier conscience et ventilation. Position latérale de sécurité si inconscient. Arrêter les hémorragies. Rassurer la victime et attendre les secours.', 'En attendant les secours', 'CRITIQUE'),
    ]];
}

// ══════════════════════════════════════════════════════════
//  PÉDIATRIE (10 diseases)
// ══════════════════════════════════════════════════════════
$cat = 'Pédiatrie';
$pediatrie = [
    ['Rougeole', 'Maladie virale très contagieuse. Épidémies chez non vaccinés.', 'Fièvre, conjonctivite, coryza, toux, signe de Köplik, éruption maculopapuleuse.', 'Virus rougeole, transmission aérienne.', 'Vaccination ROR (2 doses).', 'Vitamine A, traitement symptomatique, antibiotiques si surinfection.', 'MODEREE', true, false],
    ['Malnutrition aiguë sévère', 'Dénutrition sévère avec émaciation et/ou œdèmes.', 'Perte poids, fonte musculaire, œdèmes, apathie.', 'Carence alimentaire, infections récurrentes.', 'Allaitement maternel exclusif 6 mois.', 'Aliments thérapeutiques (F75, F100, PlumpyNut).', 'SEVERE', false, false],
    ['Gastro-entérite aiguë infantile', 'Diarrhée aiguë infectieuse du nourrisson.', 'Diarrhée liquide, vomissements, fièvre, déshydratation.', 'Rotavirus, adénovirus, bactéries.', 'Vaccination antirotavirus, hygiène.', 'SRO, zinc 20 mg/j 10 jours, alimentation précoce.', 'MODEREE', false, false],
    ['Bronchiolite du nourrisson', 'Infection virale des bronchioles < 2 ans.', 'Toux, dyspnée expiratoire, wheezing, tirage.', 'VRS (80%).', 'Lavage mains, éviter contacts épidémie.', 'Oxygène, lavage nasal, kiné respiratoire.', 'MODEREE', true, false],
    ['Drépanocytose (crise vaso-occlusive)', 'Maladie génétique. Crise douloureuse.', 'Douleurs osseuses intenses, fièvre, ictère, anémie.', 'Mutation HbS, transmission autosomique récessive.', 'Dépistage néonatal, éviter froid/déshydratation.', 'Hydratation, antalgiques, oxygène, transfusion.', 'SEVERE', false, true],
    ['Convulsions fébriles', 'Crise convulsive brève sur fièvre (6 mois-5 ans).', 'Crise tonico-clonique < 15 min, fièvre.', 'Fièvre élevée (infection ORL, pulmonaire).', 'Prise en charge précoce de la fièvre.', 'Traitement de la fièvre, bilan étiologique.', 'LEGERE', false, false],
    ['Pneumopathie infantile', 'Infection pulmonaire aiguë de l\'enfant.', 'Fièvre, toux, dyspnée, tirage, battement ailes du nez.', 'Streptococcus pneumoniae, VRS.', 'Vaccination (pneumocoque, Hib).', 'Antibiothérapie (amoxicilline), oxygène, kiné respiratoire.', 'MODEREE', false, false],
    ['Paludisme grave de l\'enfant', 'Forme grave du paludisme pédiatrique.', 'Fièvre, anémie sévère, convulsions, prostration.', 'Plasmodium falciparum.', 'Moustiquaires imprégnées, TDR précoce.', 'Artésunate IV, transfusion, anticonvulsivants.', 'CRITIQUE', false, true],
    ['Varicelle', 'Infection virale très contagieuse de l\'enfance.', 'Fièvre modérée, éruption vésiculeuse généralisée, prurit.', 'Virus varicelle-zona (VZV).', 'Vaccination ROR-V.', 'Traitement symptomatique. Pas d\'aspirine.', 'LEGERE', true, false],
    ['Infections néonatales', 'Infection bactérienne du nouveau-né ≤ 28 jours.', 'Fièvre ou hypothermie, léthargie, refus téter.', 'Streptocoque B, E. coli. Transmission maternelle.', 'Dépistage prénatal streptocoque B.', 'Antibiothérapie IV, hospitalisation néonatologie.', 'CRITIQUE', false, true],
];

foreach ($pediatrie as $t) {
    $diseases[] = ['nom' => $t[0], 'categorie' => $cat, 'description' => $t[1], 'symptomes' => $t[2], 'causes' => $t[3], 'precautions' => $t[4], 'traitement' => $t[5], 'niveauGravite' => $t[6], 'contagieux' => $t[7], 'urgence' => $t[8], 'isAccident' => false, 'imageUrl' => '', 'premiersSoins' => [
        $ps('Consulter un pédiatre', 'Tout enfant malade doit être vu par un médecin. Ne pas pratiquer d\'automédication prolongée.', 'Enfant fébrile ou malade', 'ELEVE'),
        $ps('Hydratation et surveillance', 'Assurer une hydratation suffisante. Surveiller la température, l\'état général, la respiration. Consulter en urgence si aggravation.', 'Surveillance à domicile', 'MOYEN'),
    ]];
}

// ══════════════════════════════════════════════════════════
//  NEUROLOGIE (8 diseases)
// ══════════════════════════════════════════════════════════
$cat = 'Neurologie';
$neuro = [
    ['Méningite infectieuse', 'Infection des méninges. Urgence vitale.', 'Fièvre élevée, céphalées intenses, raideur méningée, photophobie, purpura.', 'Méningocoque, pneumocoque, Haemophilus.', 'Vaccination (méningocoque, pneumocoque, Hib).', 'Antibiothérapie IV immédiate, corticoïdes, isolement.', 'CRITIQUE', true, true],
    ['Épilepsie', 'Affection neurologique chronique. Crises récurrentes.', 'Crises généralisées ou focales, perte connaissance, convulsions.', 'Idiopathique, génétique, lésion cérébrale.', 'Prévention traumatismes crâniens.', 'Antiépileptiques selon type de crise.', 'MODEREE', false, false],
    ['AVC (ischémique ou hémorragique)', 'Déficit neurologique focal d\'origine vasculaire.', 'Hémiplégie, aphasie, paralysie faciale, trouble marche.', 'HTA, diabète, FA, athérosclérose.', 'Contrôle tensionnel, activité physique.', 'Thrombolyse (4h30), thrombectomie, rééducation.', 'CRITIQUE', false, true],
    ['Migraine', 'Céphalée primaire récurrente.', 'Céphalée unilatérale pulsatile, nausées, photophobie, phonophobie.', 'Génétique, facteurs déclenchants (aliments, stress).', 'Éviter déclencheurs, sommeil régulier.', 'Triptans (crise), bêtabloquants (fond), anti-CGRP.', 'LEGERE', false, false],
    ['Tumeur cérébrale', 'Néoplasie intracrânienne primitive ou secondaire.', 'Céphalées progressives, vomissements, crises, déficit focal.', 'Rare, parfois génétique, irradiation.', 'Pas de prévention spécifique.', 'Neurochirurgie, radiothérapie, chimiothérapie.', 'SEVERE', false, false],
    ['Maladie de Parkinson', 'Maladie neurodégénérative. Déficit dopaminergique.', 'Tremblement repos, rigidité, akinésie, instabilité posturale.', 'Dégénérescence substance noire. Génétique rare.', 'Activité physique, alimentation antioxydante.', 'Lévodopa, agonistes dopaminergiques, kinésithérapie.', 'SEVERE', false, false],
    ['Alzheimer (démence sénile)', 'Maladie neurodégénérative. Troubles mnésiques.', 'Troubles mémoire récente, désorientation, apathie.', 'Protéine bêta-amyloïde, Tau. Âge, génétique.', 'Activité cognitive, sociale, physique.', 'Anticholinestérasiques, prise en charge psycho-sociale.', 'SEVERE', false, false],
    ['Méningite tuberculeuse', 'Forme grave de tuberculose extrapulmonaire.', 'Fièvre, céphalées, raideur méningée, troubles conscience.', 'Mycobacterium tuberculosis, dissémination méningée.', 'BCG, traitement précoce tuberculose.', 'Antituberculeux prolongés (9-12 mois), corticoïdes.', 'SEVERE', true, true],
];

foreach ($neuro as $t) {
    $diseases[] = ['nom' => $t[0], 'categorie' => $cat, 'description' => $t[1], 'symptomes' => $t[2], 'causes' => $t[3], 'precautions' => $t[4], 'traitement' => $t[5], 'niveauGravite' => $t[6], 'contagieux' => $t[7], 'urgence' => $t[8], 'isAccident' => false, 'imageUrl' => '', 'premiersSoins' => [
        $ps('Consultation neurologique', 'Un bilan neurologique complet (imagerie, EEG, ponction lombaire) est nécessaire pour un diagnostic précis.', 'Symptômes neurologiques', 'ELEVE'),
        $ps('Surveillance des fonctions vitales', 'Surveillance de la conscience, de la respiration et de la motricité. Hospitalisation en secteur spécialisé si nécessaire.', 'Atteinte neurologique', 'CRITIQUE'),
    ]];
}

// ══════════════════════════════════════════════════════════
//  NÉPHROLOGIE (6 diseases)
// ══════════════════════════════════════════════════════════
$cat = 'Néphrologie';
$nephro = [
    ['Insuffisance rénale aiguë', 'Détérioration rapide de la fonction rénale. Réversible.', 'Oligurie/anurie, œdèmes, fatigue, nausées, HTA.', 'Hypovolémie, sepsis, toxiques (AINS, antibiotiques).', 'Hydratation, éviter AINS.', 'Réhydratation, arrêt toxiques, dialyse si nécessaire.', 'SEVERE', false, false],
    ['Insuffisance rénale chronique', 'Altération progressive et irréversible de la fonction rénale.', 'Fatigue, anémie, œdèmes, prurit, nausées, HTA.', 'Diabète, HTA, glomérulonéphrite, polykystose.', 'Contrôle diabète/HTA, éviter AINS.', 'Traitement étiologique, dialyse, transplantation.', 'SEVERE', false, false],
    ['Glomérulonéphrite aiguë', 'Atteinte inflammatoire des glomérules.', 'Hématurie, œdèmes, HTA, oligurie, protéinurie.', 'Post-streptococcique, lupus, vascularite.', 'Traitement précoce infections streptococciques.', 'Corticothérapie, immunosuppresseurs, dialyse si nécessaire.', 'SEVERE', false, false],
    ['Lithiase rénale (Colique néphrétique)', 'Calcul dans les voies urinaires.', 'Douleur lombaire violente irradiant aux organes génitaux, agitation.', 'Hypercalcémie, hyperoxalurie, déshydratation.', 'Hydratation 2-3L/j, régime pauvre en sel.', 'AINS, antispasmodiques, lithotritie, urétéroscopie.', 'SEVERE', false, true],
    ['Néphropathie diabétique', 'Atteinte rénale chronique du diabète.', 'Microalbuminurie, protéinurie, HTA, IRC terminale.', 'Diabète type 1/2, mauvais contrôle glycémique.', 'Contrôle glycémique strict, IEC/ARA2.', 'IEC/ARA2, contrôle glycémique, dialyse/transplantation.', 'SEVERE', false, false],
    ['Polykystose rénale', 'Maladie génétique autosomique dominante.', 'Multiples kystes rénaux, HTA précoce, IRC progressive.', 'Mutation PKD1 (90%) ou PKD2.', 'Dépistage familial, conseil génétique.', 'Tolvaptan, contrôle TA, dialyse/transplantation.', 'SEVERE', false, false],
];

foreach ($nephro as $t) {
    $diseases[] = ['nom' => $t[0], 'categorie' => $cat, 'description' => $t[1], 'symptomes' => $t[2], 'causes' => $t[3], 'precautions' => $t[4], 'traitement' => $t[5], 'niveauGravite' => $t[6], 'contagieux' => $t[7], 'urgence' => $t[8], 'isAccident' => false, 'imageUrl' => '', 'premiersSoins' => [
        $ps('Consultation néphrologique', 'Bilan rénal complet (créatinine, DFG, BU, échographie). Surveillance tensionnelle régulière.', 'Signes d\'atteinte rénale', 'ELEVE'),
        $ps('Régime et hygiène de vie', 'Régime pauvre en sel, potassium et phosphore adapté au stade. Éviter les AINS. Hydratation suffisante. Contrôle du poids et de la tension.', 'Insuffisance rénale', 'MOYEN'),
    ]];
}

// ══════════════════════════════════════════════════════════
//  RHUMATOLOGIE (5 diseases)
// ══════════════════════════════════════════════════════════
$cat = 'Rhumatologie';
$rhumato = [
    ['Lombalgie commune', 'Douleur bas du dos sans cause spécifique.', 'Douleur lombaire, raideur, parfois radiculalgie.', 'Mécanique (mauvaises postures, sédentarité).', 'Activité physique régulière, ergonomie.', 'Antalgiques, anti-inflammatoires, kinésithérapie.', 'LEGERE', false, false],
    ['Arthrose', 'Maladie articulaire dégénérative. Usure du cartilage.', 'Douleur mécanique, raideur matinale brève, limitation mobilité.', 'Âge, obésité, traumatismes articulaires.', 'Activité physique adaptée, contrôle poids.', 'Antalgiques, AINS, kinésithérapie, prothèse si terminal.', 'MODEREE', false, false],
    ['Polyarthrite rhumatoïde', 'Maladie auto-immune inflammatoire chronique.', 'Polyarthrite inflammatoire symétrique, raideur matinale prolongée.', 'Auto-immun, génétique (HLA DR4), tabac.', 'Arrêt tabac.', 'Méthotrexate, biothérapies (anti-TNF), kinésithérapie.', 'SEVERE', false, false],
    ['Goutte', 'Arthrite microcristalline. Hyperuricémie.', 'Crise aiguë : articulation chaude, rouge, douloureuse (hallux, cheville).', 'Hyperuricémie, alimentation riche en purines, alcool.', 'Régime pauvre en purines, éviter alcool.', 'AINS, colchicine, allopurinol au long cours.', 'MODEREE', false, false],
    ['Spondylarthrite ankylosante', 'Maladie inflammatoire chronique du rachis.', 'Douleur lombaire inflammatoire nocturne, raideur matinale prolongée.', 'Génétique (HLA B27), auto-immun.', 'Activité physique régulière.', 'AINS, biothérapies (anti-TNF), kinésithérapie.', 'SEVERE', false, false],
];

foreach ($rhumato as $t) {
    $diseases[] = ['nom' => $t[0], 'categorie' => $cat, 'description' => $t[1], 'symptomes' => $t[2], 'causes' => $t[3], 'precautions' => $t[4], 'traitement' => $t[5], 'niveauGravite' => $t[6], 'contagieux' => $t[7], 'urgence' => $t[8], 'isAccident' => false, 'imageUrl' => '', 'premiersSoins' => [
        $ps('Consultation rhumatologique', 'Bilan radiologique et biologique pour diagnostic précis. Traitement antalgique et anti-inflammatoire adapté.', 'Douleurs articulaires ou vertébrales', 'MOYEN'),
        $ps('Kinésithérapie et activité', 'Kinésithérapie régulière. Maintien d\'une activité physique adaptée (natation, marche). Éviter la sédentarité prolongée.', 'Rhumatisme chronique', 'MOYEN'),
    ]];
}

// ══════════════════════════════════════════════════════════
//  ORL & STOMATOLOGIE (6 diseases)
// ══════════════════════════════════════════════════════════
$cat = 'ORL et Stomatologie';
$orl = [
    ['Otite moyenne aiguë', 'Infection aiguë de l\'oreille moyenne.', 'Otalgie, fièvre, hypoacousie, écoulement si perforation.', 'Streptocoque, pneumocoque, Haemophilus.', 'Éviter fumée, allaitement maternel, vaccination antipneumocoque.', 'Antibiothérapie (amoxicilline 7-10 jours), antalgiques.', 'MODEREE', false, false],
    ['Sinusite aiguë', 'Infection des sinus de la face.', 'Douleur faciale, céphalées, obstruction nasale, rhinorrhée purulente, fièvre.', 'Virus puis surinfection bactérienne.', 'Lavage nasal sérum physiologique, éviter tabac.', 'Antibiothérapie (amoxicilline), corticostéroïdes locaux.', 'MODEREE', false, false],
    ['Pharyngite aiguë', 'Infection aiguë du pharynx.', 'Douleur pharyngée, dysphagie, fièvre, odynophagie.', 'Virale (80%) ou streptocoque bêta-hémolytique (20%).', 'Lavage mains, éviter partage verres.', 'Antalgiques, AINS, antibiotiques si streptocoque confirmé.', 'LEGERE', false, false],
    ['Amygdalite aiguë', 'Infection aiguë des amygdales.', 'Douleur pharyngée intense, dysphagie, fièvre élevée, amygdales hypertrophiées.', 'Streptocoque, virus.', 'Éviter contact avec cas infectés.', 'Antibiothérapie (amoxicilline 10 jours si streptocoque), antalgiques.', 'MODEREE', false, false],
    ['Laryngite aiguë', 'Inflammation aiguë du larynx.', 'Dysphonie (voix rauque), toux sèche, dyspnée inspiratoire (enfant).', 'Virale, surmenage vocal, tabac.', 'Éviter tabac, repos vocal.', 'Repos vocal, hydratation, corticoïdes si dyspnée.', 'LEGERE', false, false],
    ['Carie dentaire', 'Lésion infectieuse de la dent. Déminéralisation.', 'Douleur dentaire, sensibilité au froid/chaud/sucré, cavité visible.', 'Streptococcus mutans, sucres alimentaires, mauvaise hygiène buccale.', 'Brossage 2x/jour, dentifrice fluoré, limitation sucres, visites dentistes régulières.', 'Détartrage, plombage, dévitalisation, extraction si trop avancée.', 'LEGERE', false, false],
];

foreach ($orl as $t) {
    $diseases[] = ['nom' => $t[0], 'categorie' => $cat, 'description' => $t[1], 'symptomes' => $t[2], 'causes' => $t[3], 'precautions' => $t[4], 'traitement' => $t[5], 'niveauGravite' => $t[6], 'contagieux' => $t[7], 'urgence' => $t[8], 'isAccident' => false, 'imageUrl' => '', 'premiersSoins' => [
        $ps('Consulter un spécialiste ORL', 'Un examen clinique complet (otoscopie, rhinoscopie, laryngoscopie) est nécessaire pour un diagnostic précis.', 'Symptômes ORL persistants', 'MOYEN'),
        $ps('Traitement symptomatique', 'Antalgiques, lavage nasal au sérum physiologique, repos vocal si nécessaire. Pas d\'antibiotiques sans avis médical.', 'Symptômes ORL légers', 'FAIBLE'),
    ]];
}

// ══════════════════════════════════════════════════════════
//  ENDOCRINOLOGIE (5 diseases)
// ══════════════════════════════════════════════════════════
$cat = 'Endocrinologie';
$endo = [
    ['Diabète de type 1', 'Diabète insulinodépendant. Destruction auto-immune cellules β pancréatiques.', 'Polyurie, polydipsie, polyphagie, amaigrissement, fatigue, cétose.', 'Auto-immun, génétique, déclencheur viral.', 'Pas de prévention connue.', 'Insulinothérapie à vie (multi-injections ou pompe), surveillance glycémique.', 'SEVERE', false, false],
    ['Diabète de type 2', 'Diabète non insulinodépendant. Insulinorésistance.', 'Souvent asymptomatique. Polyurie, soif, fatigue, infections.', 'Obésité, sédentarité, génétique, âge.', 'Alimentation équilibrée, activité physique, contrôle poids.', 'Régime, activité physique, antidiabétiques oraux, insuline si nécessaire.', 'MODEREE', false, false],
    ['Goitre', 'Augmentation du volume de la glande thyroïde.', 'Masse cervicale antérieure, parfois compressive (dysphagie, dyspnée).', 'Carence en iode (endémique), maladie de Basedow, nodules.', 'Sel iodé, alimentation riche en iode.', 'Traitement substitutif (L-thyroxine), iode radioactif, chirurgie.', 'MODEREE', false, false],
    ['Thyrotoxicose (Hyperthyroïdie)', 'Excès d\'hormones thyroïdiennes.', 'Tachycardie, amaigrissement, nervosité, tremblements, chaleur, exophtalmie.', 'Maladie de Basedow, nodule toxique, thyroïdite.', 'Pas de prévention spécifique.', 'Antithyroïdiens (carbimazole), bêtabloquants, iode radioactif, chirurgie.', 'MODEREE', false, false],
    ['Hypothyroïdie', 'Déficit en hormones thyroïdiennes.', 'Fatigue, frilosité, prise poids, constipation, peau sèche, bradycardie.', 'Thyroïdite de Hashimoto, carence iode, post-chirurgical.', 'Sel iodé.', 'Lévothyroxine à vie, ajustement posologique régulier.', 'MODEREE', false, false],
];

foreach ($endo as $t) {
    $diseases[] = ['nom' => $t[0], 'categorie' => $cat, 'description' => $t[1], 'symptomes' => $t[2], 'causes' => $t[3], 'precautions' => $t[4], 'traitement' => $t[5], 'niveauGravite' => $t[6], 'contagieux' => $t[7], 'urgence' => $t[8], 'isAccident' => false, 'imageUrl' => '', 'premiersSoins' => [
        $ps('Consulter un endocrinologue', 'Bilan endocrinien complet (hormones, imagerie). Traitement adapté au long cours. Surveillance régulière indispensable.', 'Troubles endocriniens', 'ELEVE'),
        $ps('Hygiène de vie et suivi', 'Alimentation équilibrée, activité physique régulière. Observance thérapeutique stricte. Surveillance glycémique ou bilan thyroïdien régulier.', 'Maladie endocrinienne chronique', 'MOYEN'),
    ]];
}

// ══════════════════════════════════════════════════════════
//  GENERATE JSON FILE
// ══════════════════════════════════════════════════════════

// ─── Normalize to proper French accents for entity constraints ───
$gravityMap = [
    'SEVERE'  => 'SÉVÈRE',
    'MODEREE' => 'MODÉRÉE',
    'LEGERE'  => 'LÉGÈRE',
    'ELEVE'   => 'SÉVÈRE',   // pneumothorax → severe
];
$urgencyMap = [
    'ELEVE' => 'ÉLEVÉ',
];
foreach ($diseases as &$d) {
    if (isset($gravityMap[$d['niveauGravite']]))
        $d['niveauGravite'] = $gravityMap[$d['niveauGravite']];
    foreach ($d['premiersSoins'] as &$ps) {
        if (isset($urgencyMap[$ps['niveauUrgence']]))
            $ps['niveauUrgence'] = $urgencyMap[$ps['niveauUrgence']];
    }
    unset($ps);
}
unset($d);

$json = json_encode($diseases, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
file_put_contents(__DIR__ . '/maladies.json', $json);

echo "✓ Generated " . count($diseases) . " diseases.\n";
echo "  File: " . __DIR__ . "/maladies.json\n";
