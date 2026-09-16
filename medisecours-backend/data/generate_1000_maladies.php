<?php
declare(strict_types=1);
/**
 * Generate 1000+ real diseases with detailed first-aid protocols.
 * Run: php data/generate_1000_maladies.php
 */

// ─── Helpers ───
$ps = fn($t, $d, $s, $n) => ['titre' => $t, 'description' => $d, 'symptomes' => $s, 'niveauUrgence' => $n];

$pick = fn(array $a) => $a[array_rand($a)];

$join = fn(array $a) => implode(' ', $a);

$maybe = fn(string $s, float $p = 0.5) => mt_rand(0, 100) / 100 < $p ? $s : '';

// ─── Content Template Pools ───

// Severity map (non-accented keys → accented values)
$sevMap = ['L' => 'LÉGÈRE', 'M' => 'MODÉRÉE', 'S' => 'SÉVÈRE', 'C' => 'CRITIQUE', 'V' => 'VARIABLE'];
$urgMap = ['F' => 'FAIBLE', 'M' => 'MOYEN', 'E' => 'ÉLEVÉ', 'C' => 'CRITIQUE'];

// ─── Disease definitions: [name, severity, contagious, urgency, isAccident] ───
// Defaults: severity=M, contagious=false, urgency=false, isAccident=false

$cat = [];
$d = []; // accumulator

// Helper to add batch
$add = function(string $category, array $diseases, array $defaults = []) use (&$d, &$cat, $sevMap) {
    static $idx = 0;
    $cat[$category] = true;
    foreach ($diseases as $entry) {
        if (is_string($entry)) {
            $name = $entry;
            $sev = $defaults['g'] ?? 'M';
            $con = $defaults['c'] ?? false;
            $urg = $defaults['u'] ?? false;
            $acc = $defaults['a'] ?? false;
        } else {
            $name = $entry[0];
            $sev = $entry[1] ?? ($defaults['g'] ?? 'M');
            $con = $entry[2] ?? ($defaults['c'] ?? false);
            $urg = $entry[3] ?? ($defaults['u'] ?? false);
            $acc = $entry[4] ?? ($defaults['a'] ?? false);
        }
        $d[] = ['nom' => $name, 'categorie' => $category, 'niveauGravite' => $sevMap[$sev] ?? 'MODÉRÉE', 'contagieux' => $con, 'urgence' => $urg, 'isAccident' => $acc];
    }
};

// ══════════════════════════════════════════════════════════════════════════════
//  1. MALADIES INFECTIEUSES ET PARASITAIRES (~105)
// ══════════════════════════════════════════════════════════════════════════════
$add('Maladies infectieuses', [
    // Paludisme
    'Paludisme à Plasmodium falciparum', ['Paludisme cérébral', 'S', true, true], ['Paludisme grave avec anémie sévère', 'S', false, true],
    ['Paludisme viscéral évolutif', 'S', false, true], ['Paludisme de la femme enceinte', 'S', false, true],
    // Tuberculose
    'Tuberculose pulmonaire commune', ['Tuberculose miliaire', 'C', true, true], ['Tuberculose ganglionnaire', 'S', true, false],
    ['Tuberculose ostéo-articulaire', 'S', false, false], ['Tuberculose méningée', 'C', false, true],
    ['Tuberculose rénale', 'S', false, false], ['Tuberculose péritonéale', 'S', false, false],
    ['Tuberculose pleurale', 'S', true, false], ['Tuberculose génitale', 'S', false, false],
    ['Tuberculose cutanée', 'M', true, false],
    // VIH
    ['Infection aiguë par le VIH', 'S', true, false], ['VIH stade asymptomatique', 'M', true, false],
    ['VIH stade symptomatique', 'S', true, false], ['SIDA avec infections opportunistes', 'C', true, true],
    ['Cachexie liée au VIH', 'S', false, false],
    // Hépatites virales
    ['Hépatite aiguë A', 'M', true, false], ['Hépatite aiguë B', 'S', true, false], ['Hépatite chronique B', 'S', true, false],
    ['Hépatite aiguë C', 'M', true, false], ['Hépatite chronique C', 'S', true, false], ['Hépatite D', 'S', true, false],
    ['Hépatite E', 'M', true, false], ['Hépatite fulminante', 'C', true, true],
    // Arboviroses
    ['Fièvre jaune', 'C', false, true], ['Dengue classique', 'M', false, false], ['Dengue hémorragique', 'C', false, true],
    ['Dengue sévère avec choc', 'C', false, true], ['Chikungunya', 'M', false, false], ['Infection à virus Zika', 'L', true, false],
    ['Fièvre de la Vallée du Rift', 'S', false, false], ['Fièvre hémorragique de Crimée-Congo', 'C', true, true],
    ['Encéphalite à West Nile', 'S', false, true],
    // Fièvres hémorragiques
    ['Maladie à virus Ebola', 'C', true, true], ['Maladie à virus Marburg', 'C', true, true],
    ['Fièvre de Lassa', 'S', true, false], ['Fièvre hémorragique argentine', 'S', true, false],
    // Rage
    ['Rage furieuse', 'C', true, true], ['Rage paralytique', 'C', true, true],
    // Infections herpétiques
    ['Herpès labial', 'L', true, false], ['Herpès génital', 'L', true, false], ['Kératite herpétique', 'M', false, false],
    ['Encéphalite herpétique', 'C', false, true], ['Varicelle', 'L', true, false], ['Zona intercostal', 'M', true, false],
    ['Zona ophtalmique', 'M', true, false], ['Zona disséminé', 'S', true, false],
    // Infections infantiles
    ['Rougeole', 'M', true, false], ['Rougeole compliquée de pneumonie', 'S', true, true],
    ['Rubéole', 'L', true, false], ['Rubéole congénitale', 'S', false, false], ['Oreillons', 'L', true, false],
    ['Oreillons compliqués d\'orchite', 'M', true, false], ['Coqueluche du nourrisson', 'S', true, false],
    ['Coqueluche de l\'adulte', 'M', true, false], ['Scarlatine', 'M', true, false],
    ['Diphtérie pharyngée', 'S', true, false], ['Diphtérie cutanée', 'M', true, false],
    // Infections bactériennes
    ['Tétanos généralisé', 'C', false, true], ['Tétanos céphalique', 'C', false, true], ['Tétanos localisé', 'S', false, false],
    ['Fièvre typhoïde', 'S', true, false], ['Fébrile typhoïdique grave', 'C', true, true], ['Paratyphoïde', 'M', true, false],
    ['Shigellose dysentérique', 'S', true, false], ['Choléra', 'C', true, true], ['Gastro-entérite à Rotavirus', 'M', true, false],
    ['Botulisme alimentaire', 'C', false, true], ['Botulisme du nourrisson', 'C', false, true],
    ['Listériose', 'S', true, false], ['Brucellose aiguë', 'M', true, false], ['Brucellose chronique', 'S', false, false],
    ['Leptospirose', 'S', false, false], ['Méningite à méningocoque', 'C', true, true],
    ['Méningite à pneumocoque', 'C', false, false], ['Méningite à Haemophilus', 'C', true, true],
    ['Méningite virale', 'M', true, false], ['Streptococcie pharyngée', 'M', true, false],
    ['Scarlatine compliquée', 'S', true, false], ['Erysipèle de jambe', 'M', false, false],
    ['Impétigo croûteux', 'L', true, false], ['Furoncle', 'L', false, false], ['Furonculose multiple', 'M', false, false],
    ['Charbon cutané', 'M', false, false], ['Charbon inhalatoire', 'C', false, true],
    ['Pasteurellose', 'M', false, false], ['Morve', 'S', true, false],
    // Infections parasitaires
    ['Leishmaniose viscérale (Kala-Azar)', 'S', false, false], ['Leishmaniose cutanée localisée', 'M', false, false],
    ['Leishmaniose cutanée diffuse', 'S', false, false], ['Trypanosomiase africaine (maladie du sommeil)', 'C', false, true],
    ['Maladie de Chagas aiguë', 'S', false, false], ['Maladie de Chagas chronique', 'S', false, false],
    ['Toxoplasmose ganglionnaire', 'M', false, false], ['Toxoplasmose cérébrale VIH', 'C', false, true],
    ['Toxoplasmose congénitale', 'S', false, false],
], ['g' => 'M', 'c' => false, 'u' => false, 'a' => false]);

// ══════════════════════════════════════════════════════════════════════════════
//  2. PARASITOSES TROPICALES (suite) + MYCOSES (~60)
// ══════════════════════════════════════════════════════════════════════════════
$add('Parasitoses tropicales', [
    ['Amibiase intestinale', 'M', true, false], ['Amibiase hépatique', 'S', false, false],
    ['Giardiase', 'L', true, false], ['Cryptosporidiose', 'M', true, false],
    ['Cyclosporose', 'M', true, false], ['Isosporose', 'M', true, false],
    ['Schistosomiase urogénitale', 'M', false, false], ['Schistosomiase intestinale', 'M', false, false],
    ['Schistosomiase hépatosplénique', 'S', false, false], ['Ankylostomiase', 'M', false, false],
    ['Ankylostomiase avec anémie sévère', 'S', false, false], ['Ascaridiose', 'L', false, false],
    ['Ascaridiose avec occlusion', 'S', false, true], ['Trichocéphalose', 'L', false, false],
    ['Oxyurose', 'L', true, false], ['Strongyloïdose intestinale', 'M', false, false],
    ['Strongyloïdose disséminée', 'S', false, true], ['Filariose lymphatique (éléphantiasis)', 'S', false, false],
    ['Onchocercose cécitante', 'S', false, false], ['Loa loa (filariose sous-cutanée)', 'M', false, false],
    ['Dracunculose (ver de Guinée)', 'M', false, false], ['Téniasis (ténia du porc)', 'M', true, false],
    ['Téniasis (ténia du bœuf)', 'M', true, false], ['Ténia du poisson', 'M', true, false],
    ['Cysticercose cérébrale', 'S', false, false], ['Cysticercose sous-cutanée', 'M', false, false],
    ['Hydatidose hépatique (kyste hydatique)', 'S', false, false], ['Hydatidose pulmonaire', 'S', false, false],
    ['Échinococcose alvéolaire', 'S', false, false], ['Distomatose hépatique', 'M', false, false],
    ['Paragonimose pulmonaire', 'M', false, false], ['Trichinellose', 'M', false, false],
    ['Larva migrans cutanée', 'L', false, false], ['Larva migrans viscérale', 'M', false, false],
    ['Gale (scabiose)', 'L', true, false], ['Gale norvégienne (hyperkératosique)', 'S', true, false],
    ['Pédiculose du cuir chevelu', 'L', true, false], ['Pédiculose corporelle', 'L', true, false],
    ['Phtiriase (morpions)', 'L', true, false], ['Punaises de lit', 'L', false, false],
    ['Myiase cutanée furonculeuse', 'L', false, false], ['Myiase des plaies', 'M', false, false],
    ['Tungose (puce chique)', 'L', false, false], ['Sporotrichose cutanée', 'M', false, false],
    ['Sporotrichose lymphangitique', 'M', false, false], ['Chromomycose', 'M', false, false],
    ['Mycétome fongique', 'S', false, false], ['Mycétome actinomycosique', 'S', false, false],
    ['Histoplasmose aiguë', 'M', false, false], ['Histoplasmose disséminée', 'S', false, false],
    ['Histoplasmose pulmonaire chronique', 'S', false, false], ['Coccidioïdomycose', 'M', false, false],
    ['Paracoccidioïdomycose', 'S', false, false], ['Aspergillose pulmonaire invasive', 'C', false, true],
    ['Aspergillome pulmonaire', 'M', false, false], ['Aspergillose broncho-pulmonaire allergique', 'M', false, false],
    ['Cryptococcose méningée', 'C', false, true], ['Candidose buccale (muguet)', 'L', false, false],
    ['Candidose œsophagienne', 'M', false, false], ['Candidose vaginale', 'L', false, false],
    ['Candidose invasive systémique', 'C', false, true],
], ['g' => 'M', 'c' => false, 'u' => false, 'a' => false]);

// ══════════════════════════════════════════════════════════════════════════════
//  3. TUMEURS ET CANCERS (~55)
// ══════════════════════════════════════════════════════════════════════════════
$add('Tumeurs et cancers', [
    ['Carcinome hépatocellulaire', 'C', false, false], ['Cholangiocarcinome', 'C', false, false],
    ['Cancer du sein infiltrant', 'S', false, false], ['Cancer du sein inflammatoire', 'S', false, false],
    ['Cancer du col de l\'utérus', 'S', false, false], ['Cancer de l\'endomètre', 'M', false, false],
    ['Cancer de l\'ovaire', 'S', false, false], ['Cancer du poumon à petites cellules', 'C', false, false],
    ['Adénocarcinome pulmonaire', 'S', false, false], ['Carcinome épidermoïde pulmonaire', 'S', false, false],
    ['Adénocarcinome colorectal', 'S', false, false], ['Cancer du rectum', 'S', false, false],
    ['Cancer de l\'estomac', 'S', false, false], ['Cancer de l\'œsophage', 'S', false, false],
    ['Adénocarcinome du pancréas', 'C', false, false], ['Cancer de la prostate localisé', 'M', false, false],
    ['Cancer de la prostate métastatique', 'C', false, false], ['Cancer du rein à cellules claires', 'S', false, false],
    ['Cancer de la vessie infiltrant', 'S', false, false], ['Cancer de la vessie superficiel', 'M', false, false],
    ['Cancer de la thyroïde papillaire', 'M', false, false], ['Cancer de la thyroïde vésiculaire', 'M', false, false],
    ['Cancer médullaire de la thyroïde', 'S', false, false], ['Mélanome cutané localisé', 'M', false, false],
    ['Mélanome métastatique', 'C', false, false], ['Carcinome basocellulaire', 'L', false, false],
    ['Carcinome spinocellulaire', 'M', false, false], ['Lymphome de Hodgkin classique', 'S', false, false],
    ['Lymphome de Hodgkin nodulaire', 'M', false, false], ['Lymphome B diffus à grandes cellules', 'S', false, false],
    ['Lymphome folliculaire', 'S', false, false], ['Lymphome de Burkitt', 'C', false, false],
    ['Lymphome T cutané', 'S', false, false], ['Leucémie lymphoïde chronique', 'M', false, false],
    ['Leucémie myéloïde chronique', 'S', false, false], ['Leucémie aiguë lymphoblastique', 'C', true, true],
    ['Leucémie aiguë myéloblastique', 'C', false, true], ['Myélome multiple', 'C', false, false],
    ['Myélome indolent', 'M', false, false], ['Glioblastome multiforme', 'C', false, false],
    ['Astrocytome de bas grade', 'M', false, false], ['Méningiome', 'M', false, false],
    ['Schwannome', 'M', false, false], ['Adénome hypophysaire', 'M', false, false],
    ['Neuroblastome', 'C', false, false], ['Rétinoblastome', 'S', false, false],
    ['Néphroblastome de Wilms', 'S', false, false], ['Hépatoblastome', 'S', false, false],
    ['Sarcome ostéogénique', 'S', false, false], ['Sarcome d\'Ewing', 'S', false, false],
    ['Rhabdomyosarcome', 'S', false, false], ['Liposarcome', 'S', false, false],
    ['Fibrosarcome', 'S', false, false], ['Tumeur germinale testiculaire', 'S', false, false],
    ['Tumeur germinale ovarienne', 'S', false, false],
], ['g' => 'S', 'c' => false, 'u' => false, 'a' => false]);

// ══════════════════════════════════════════════════════════════════════════════
//  4. MALADIES DU SANG (~35)
// ══════════════════════════════════════════════════════════════════════════════
$add('Maladies du sang', [
    ['Drépanocytose homozygote (SS)', 'S', false, false], ['Drépanocytose hétérozygote (AS)', 'L', false, false],
    ['Drépanocytose S/C', 'M', false, false], ['Drépanocytose S/thalassémie', 'S', false, false],
    ['Anémie falciforme avec crise vaso-occlusive', 'C', false, true],
    ['Anémie falciforme avec syndrome thoracique aigu', 'C', false, true],
    ['Thalassémie majeure', 'S', false, false], ['Thalassémie intermédiaire', 'M', false, false],
    ['Thalassémie mineure', 'L', false, false], ['Anémie ferriprive', 'M', false, false],
    ['Anémie par carence en folates', 'M', false, false], ['Anémie par carence en vitamine B12', 'M', false, false],
    ['Anémie hémolytique auto-immune', 'S', false, false], ['Anémie hémolytique médicamenteuse', 'M', false, false],
    ['Anémie hémolytique post-transfusionnelle', 'S', false, false], ['Anémie aplasique sévère', 'C', false, false],
    ['Anémie aplasique modérée', 'M', false, false], ['Anémie sidéroblastique', 'M', false, false],
    ['Syndrome myélodysplasique', 'S', false, false], ['Thrombopénie immune (PTI)', 'M', false, false],
    ['Thrombopénie grave', 'S', false, true], ['Purpura thrombopénique thrombotique', 'C', false, true],
    ['Syndrome hémolytique et urémique', 'C', false, true], ['Hémophilie A sévère', 'S', false, false],
    ['Hémophilie A modérée', 'M', false, false], ['Hémophilie A mineure', 'L', false, false],
    ['Hémophilie B', 'S', false, false], ['Maladie de Willebrand', 'M', false, false],
    ['Déficit en vitamine K', 'M', false, false], ['Coagulation intravasculaire disséminée', 'C', false, true],
    ['Polyglobulie primitive (maladie de Vaquez)', 'S', false, false], ['Thrombocytémie essentielle', 'M', false, false],
    ['Leucocytose réactionnelle', 'L', false, false], ['Agranulocytose', 'C', false, true],
    ['Histiocytose à cellules de Langerhans', 'S', false, false],
], ['g' => 'M', 'c' => false, 'u' => false, 'a' => false]);

// ══════════════════════════════════════════════════════════════════════════════
//  5. MALADIES ENDOCRINIENNES (~50)
// ══════════════════════════════════════════════════════════════════════════════
$add('Endocrinologie', [
    ['Diabète de type 1', 'S', false, false], ['Diabète de type 2', 'M', false, false],
    ['Diabète gestationnel', 'M', false, false], ['Acidocétose diabétique', 'C', false, true],
    ['Coma hyperosmolaire hyperglycémique', 'C', false, true], ['Hypoglycémie sévère iatrogène', 'C', false, true],
    ['Hypoglycémie réactionnelle', 'L', false, false], ['Hypothyroïdie primaire', 'M', false, false],
    ['Hypothyroïdie secondaire', 'M', false, false], ['Hypothyroïdie congénitale', 'S', false, false],
    ['Thyroïdite de Hashimoto', 'M', false, false], ['Thyroïdite de De Quervain', 'M', false, false],
    ['Hyperthyroïdie (maladie de Basedow)', 'S', false, false], ['Goitre endémique', 'M', false, false],
    ['Goitre multinodulaire', 'M', false, false], ['Crise thyrotoxique (orage thyroïdien)', 'C', false, true],
    ['Myxœdème primitif', 'S', false, false], ['Coma myxœdémateux', 'C', false, true],
    ['Syndrome de Cushing', 'S', false, false], ['Insuffisance surrénale aiguë (crise addisonienne)', 'C', false, true],
    ['Insuffisance surrénale chronique (maladie d\'Addison)', 'S', false, false],
    ['Hyperaldostéronisme primaire', 'M', false, false], ['Phéochromocytome', 'S', false, true],
    ['Hyperparathyroïdie primaire', 'M', false, false], ['Ostéite fibreuse kystique', 'S', false, false],
    ['Hypoparathyroïdie post-chirurgicale', 'M', false, false], ['Tétanie hypocalcémique', 'C', false, true],
    ['Acromégalie', 'M', false, false], ['Gigantisme hypophysaire', 'M', false, false],
    ['Nanism hypophysaire (déficit en GH)', 'L', false, false], ['Diabète insipide central', 'M', false, false],
    ['Diabète insipide néphrogénique', 'M', false, false], ['SIADH (sécrétion inappropriée d\'ADH)', 'S', false, false],
    ['Hyperprolactinémie', 'M', false, false], ['Hypogonadisme hypogonadotrope', 'M', false, false],
    ['Syndrome des ovaires polykystiques', 'M', false, false], ['Aménorrhée hypothalamique', 'L', false, false],
    ['Obésité morbide', 'M', false, false], ['Syndrome métabolique', 'M', false, false],
    ['Goutte', 'M', false, false], ['Crise de goutte aiguë', 'S', false, false],
    ['Hypercholestérolémie familiale', 'M', false, false], ['Hypertriglycéridémie majeure', 'M', false, false],
    ['Phénylcétonurie', 'S', false, false], ['Galactosémie', 'S', false, false],
    ['Maladie de Wilson', 'S', false, false], ['Hémochromatose', 'M', false, false],
    ['Porphyrie aiguë intermittente', 'S', false, false], ['Porphyrie cutanée tardive', 'M', false, false],
    ['Mucoviscidose', 'S', false, false],
], ['g' => 'M', 'c' => false, 'u' => false, 'a' => false]);

// ══════════════════════════════════════════════════════════════════════════════
//  6. TROUBLES MENTAUX (~50)
// ══════════════════════════════════════════════════════════════════════════════
$add('Troubles mentaux', [
    ['Épisode dépressif majeur', 'M', false, false], ['Trouble dépressif récurrent', 'M', false, false],
    ['Dysthymie (trouble dépressif persistant)', 'L', false, false], ['Trouble bipolaire type I', 'S', false, false],
    ['Trouble bipolaire type II', 'M', false, false], ['Épisode maniaque aigu', 'S', false, true],
    ['Épisode hypomaniaque', 'M', false, false], ['Trouble anxieux généralisé', 'M', false, false],
    ['Trouble panique', 'M', false, true], ['Agoraphobie', 'M', false, false],
    ['Phobie sociale', 'M', false, false], ['Phobie spécifique', 'L', false, false],
    ['Trouble obsessionnel compulsif', 'M', false, false], ['TOC sévère', 'S', false, false],
    ['État de stress post-traumatique', 'M', false, false], ['ESP complexe', 'S', false, false],
    ['Trouble de l\'adaptation', 'L', false, false], ['Trouble de stress aigu', 'M', false, false],
    ['Trouble dissociatif de l\'identité', 'S', false, false], ['Schizophrénie paranoïde', 'S', false, false],
    ['Schizophrénie désorganisée', 'S', false, false], ['Schizophrénie catatonique', 'C', false, true],
    ['Schizophrénie résiduelle', 'M', false, false], ['Trouble schizo-affectif', 'S', false, false],
    ['Trouble délirant', 'M', false, false], ['Psychose aiguë', 'C', false, true],
    ['Psychose puerpérale', 'C', false, true], ['Trouble borderline de la personnalité', 'M', false, false],
    ['Trouble antisocial de la personnalité', 'M', false, false], ['Trouble narcissique de la personnalité', 'M', false, false],
    ['Dépendance à l\'alcool', 'M', false, false], ['Sevrage alcoolique non compliqué', 'M', false, false],
    ['Delirium tremens', 'C', false, true], ['Syndrome de Korsakoff', 'S', false, false],
    ['Dépendance aux opiacés', 'M', false, false], ['Syndrome de sevrage néonatal', 'S', false, false],
    ['Intoxication aiguë aux opiacés', 'C', false, true], ['Dépendance au cannabis', 'L', false, false],
    ['Dépendance à la cocaïne', 'M', false, false], ['Intoxication aiguë à la cocaïne', 'C', false, true],
    ['Anorexie mentale restrictive', 'S', false, false], ['Anorexie mentale boulimique', 'S', false, false],
    ['Boulimie nerveuse', 'M', false, false], ['Hyperphagie boulimique', 'M', false, false],
    ['Insomnie chronique', 'L', false, false], ['Narcolepsie', 'M', false, false],
    ['TDAH (trouble déficitaire de l\'attention)', 'M', false, false], ['Syndrome de Gilles de la Tourette', 'M', false, false],
    ['Trouble des tics chroniques', 'L', false, false], ['Trouble du spectre autistique', 'S', false, false],
    ['Trouble d\'Asperger', 'M', false, false],
], ['g' => 'M', 'c' => false, 'u' => false, 'a' => false]);

// ══════════════════════════════════════════════════════════════════════════════
//  7. MALADIES DU SYSTÈME NERVEUX (~60)
// ══════════════════════════════════════════════════════════════════════════════
$add('Neurologie', [
    ['Accident vasculaire cérébral ischémique', 'C', false, true], ['AVC du territoire sylvien', 'C', false, true],
    ['AVC du territoire vertébrobasilaire', 'C', false, true], ['Accident ischémique transitoire', 'S', false, true],
    ['Hémorragie intracérébrale hypertensive', 'C', false, true], ['Hémorragie sous-arachnoïdienne', 'C', false, true],
    ['Anévrisme cérébral non rompu', 'M', false, false], ['Migraine sans aura', 'L', false, false],
    ['Migraine avec aura', 'L', false, false], ['Migraine hémiplégique', 'M', false, false],
    ['Migraine chronique', 'M', false, false], ['Céphalée de tension épisodique', 'L', false, false],
    ['Céphalée de tension chronique', 'M', false, false], ['Algie vasculaire de la face', 'S', false, false],
    ['Névralgie du trijumeau', 'S', false, false], ['Névralgie faciale atypique', 'M', false, false],
    ['Paralysie faciale a frigore (Bell)', 'M', false, false], ['Névrite optique', 'M', false, false],
    ['Neuropathie diabétique périphérique', 'M', false, false], ['Neuropathie diabétique autonome', 'S', false, false],
    ['Polyneuropathie alcoolique', 'M', false, false], ['Syndrome du canal carpien', 'L', false, false],
    ['Syndrome de Guillain-Barré', 'C', false, true], ['Polyradiculonévrite chronique', 'M', false, false],
    ['Myasthénie généralisée', 'S', false, false], ['Crise myasthénique', 'C', false, true],
    ['Myasthénie oculaire', 'M', false, false], ['Épilepsie généralisée tonico-clonique', 'S', false, false],
    ['Épilepsie partielle complexe', 'M', false, false], ['Épilepsie absence de l\'enfant', 'L', false, false],
    ['État de mal épileptique', 'C', false, true], ['Convulsions fébriles simples', 'L', false, false],
    ['Convulsions fébriles complexes', 'M', false, true], ['Maladie de Parkinson', 'S', false, false],
    ['Syndrome parkinsonien médicamenteux', 'M', false, false], ['Dystonie cervicale', 'M', false, false],
    ['Blépharospasme', 'L', false, false], ['Tremblement essentiel', 'L', false, false],
    ['Chorée de Huntington', 'S', false, false], ['Ataxie spinocérébelleuse', 'S', false, false],
    ['Sclérose en plaques récurrente-rémittente', 'S', false, false], ['Sclérose en plaques secondaire progressive', 'S', false, false],
    ['Sclérose en plaques primaire progressive', 'S', false, false], ['Neuromyélite optique (Devic)', 'S', false, false],
    ['Sclérose latérale amyotrophique', 'C', false, false], ['Paralysie supranucléaire progressive', 'S', false, false],
    ['Démence à corps de Lewy', 'S', false, false], ['Maladie d\'Alzheimer', 'S', false, false],
    ['Démence vasculaire', 'S', false, false], ['Démence fronto-temporale', 'S', false, false],
    ['Hydrocéphalie à pression normale', 'M', false, false], ['Syndrome de la queue de cheval', 'C', false, true],
    ['Myélopathie cervicarthrosique', 'M', false, false], ['Abcès cérébral', 'C', false, true],
    ['Empyème sous-dural', 'C', false, true], ['Encéphalite limbique', 'S', false, false],
    ['Leucoencéphalopathie multifocale progressive', 'C', false, true], ['Méningite tuberculeuse', 'C', true, true],
    ['Neuropaludisme', 'C', false, true], ['Syndrome cérébelleux post-paludisme', 'M', false, false],
], ['g' => 'M', 'c' => false, 'u' => false, 'a' => false]);

// ══════════════════════════════════════════════════════════════════════════════
//  8. MALADIES CARDIOVASCULAIRES (~75)
// ══════════════════════════════════════════════════════════════════════════════
$add('Cardiologie', [
    ['Hypertension artérielle essentielle stade 1', 'M', false, false],
    ['Hypertension artérielle essentielle stade 2', 'S', false, false],
    ['Hypertension artérielle stade 3 (sévère)', 'C', false, true],
    ['Urgence hypertensive', 'C', false, true], ['Crise hypertensive', 'S', false, true],
    ['Insuffisance cardiaque à fraction d\'éjection réduite', 'S', false, false],
    ['Insuffisance cardiaque à fraction préservée', 'S', false, false],
    ['Insuffisance cardiaque droite', 'S', false, false], ['Insuffisance cardiaque aiguë', 'C', false, true],
    ['Cardiomyopathie dilatée', 'S', false, false], ['Cardiomyopathie hypertrophique', 'S', false, false],
    ['Cardiomyopathie restrictive', 'S', false, false], ['Cardiomyopathie du péripartum', 'S', false, false],
    ['Infarctus du myocarde avec sus-décalage ST', 'C', false, true],
    ['Infarctus du myocarde sans sus-décalage ST', 'C', false, true],
    ['Syndrome coronarien aigu', 'C', false, true], ['Angor stable', 'M', false, false],
    ['Angor instable', 'C', false, true], ['Infarctus du ventricule droit', 'C', false, true],
    ['Fibrillation atriale paroxystique', 'M', false, false], ['Fibrillation atriale persistante', 'M', false, false],
    ['Fibrillation atriale permanente', 'M', false, false], ['Flutter atrial', 'M', false, false],
    ['Tachycardie supraventriculaire paroxystique', 'M', false, false],
    ['Syndrome de Wolff-Parkinson-White', 'M', false, false],
    ['Tachycardie ventriculaire', 'C', false, true], ['Fibrillation ventriculaire', 'C', false, true],
    ['Torsades de pointes', 'C', false, true], ['Bloc auriculo-ventriculaire complet', 'C', false, true],
    ['Bloc de branche gauche', 'M', false, false], ['Maladie du sinus', 'M', false, false],
    ['Sténose mitrale rhumatismale', 'S', false, false], ['Insuffisance mitrale organique', 'S', false, false],
    ['Prolapsus valvulaire mitral', 'L', false, false], ['Sténose aortique calcifiée', 'S', false, false],
    ['Insuffisance aortique chronique', 'S', false, false], ['Insuffisance aortique aiguë', 'C', false, true],
    ['Endocardite infectieuse aiguë', 'C', false, true], ['Endocardite infectieuse subaiguë', 'S', false, false],
    ['Endocardite sur valve prothétique', 'C', false, true], ['Péricardite aiguë', 'M', false, false],
    ['Péricardite constrictive', 'S', false, false], ['Tamponnade cardiaque', 'C', false, true],
    ['Myocardite aiguë', 'S', false, false], ['Dissection aortique type A', 'C', false, true],
    ['Dissection aortique type B', 'C', false, true], ['Anévrisme de l\'aorte abdominale', 'S', false, false],
    ['Anévrisme de l\'aorte thoracique', 'S', false, false], ['Artérite de Takayasu', 'M', false, false],
    ['Artérite temporale (maladie de Horton)', 'M', false, false], ['Artérite des membres inférieurs', 'M', false, false],
    ['Ischémie critique de membre', 'C', false, true], ['Thrombose veineuse profonde', 'S', false, false],
    ['Embolie pulmonaire massive', 'C', false, true], ['Embolie pulmonaire de faible gravité', 'S', false, false],
    ['Phlébite superficielle', 'L', false, false], ['Insuffisance veineuse chronique', 'M', false, false],
    ['Varices œsophagiennes', 'C', false, true], ['Varices des membres inférieurs', 'L', false, false],
    ['Maladie thrombo-embolique veineuse', 'S', false, false], ['Cœur pulmonaire chronique', 'S', false, false],
    ['Hypertension artérielle pulmonaire', 'S', false, false], ['Syndrome de Marfan avec dilatation aortique', 'S', false, false],
    ['Communication inter-ventriculaire', 'M', false, false], ['Communication inter-auriculaire', 'M', false, false],
    ['Tétralogie de Fallot', 'S', false, false], ['Coarctation aortique', 'M', false, false],
    ['Canal artériel persistant', 'L', false, false], ['Cardiopathie rhumatismale', 'S', false, false],
    ['Pancardite rhumatismale', 'S', false, false], ['Syncope vaso-vagale', 'L', false, false],
    ['Syncope cardiaque', 'S', false, true], ['Mort subite cardiaque', 'C', false, true],
    ['Lipothymie orthostatique', 'L', false, false],
], ['g' => 'M', 'c' => false, 'u' => false, 'a' => false]);

// ══════════════════════════════════════════════════════════════════════════════
//  9. MALADIES RESPIRATOIRES (~60)
// ══════════════════════════════════════════════════════════════════════════════
$add('Pneumologie', [
    ['Pneumonie aiguë communautaire', 'S', false, false], ['Pneumonie nosocomiale', 'C', false, false],
    ['Pneumonie à Pneumocystis jirovecii', 'C', false, false], ['Pneumonie d\'inhalation', 'S', false, false],
    ['Pneumonie à mycoplasme', 'M', true, false], ['Pneumonie virale', 'M', true, false],
    ['Pneumonie à éosinophiles', 'M', false, false], ['Pneumonie récurrente', 'M', false, false],
    ['Bronchiolite aiguë du nourrisson', 'M', true, false], ['Bronchiolite oblitérante', 'S', false, false],
    ['Bronchite aiguë', 'L', true, false], ['BPCO stade II (modéré)', 'M', false, false],
    ['BPCO stade III (sévère)', 'S', false, false], ['BPCO stade IV (très sévère)', 'C', false, false],
    ['Exacerbation aiguë de BPCO', 'C', false, true], ['Emphysème panlobulaire', 'S', false, false],
    ['Asthme intermittent', 'L', false, false], ['Asthme persistant léger', 'M', false, false],
    ['Asthme persistant modéré', 'M', false, false], ['Asthme persistant sévère', 'S', false, false],
    ['Crise d\'asthme aiguë grave', 'C', false, true], ['État de mal asthmatique', 'C', false, true],
    ['Bronchectasies diffuses', 'M', false, false], ['Fibrose pulmonaire idiopathique', 'S', false, false],
    ['Pneumopathie d\'hypersensibilité', 'M', false, false], ['Pneumopathie interstitielle diffuse', 'S', false, false],
    ['Sarcoïdose pulmonaire stade I', 'L', false, false], ['Sarcoïdose pulmonaire stade II', 'M', false, false],
    ['Sarcoïdose pulmonaire stade III', 'S', false, false], ['Pneumoconiose (silicose)', 'S', false, false],
    ['Amiantose', 'S', false, false], ['Pneumothorax unilatéral', 'S', false, true],
    ['Pneumothorax bilatéral', 'C', false, true], ['Pneumothorax sous tension', 'C', false, true],
    ['Épanchement pleural de faible abondance', 'M', false, false], ['Pleurésie purulente (empyème)', 'S', false, false],
    ['Pleurésie tuberculeuse', 'M', true, false], ['Abcès pulmonaire', 'S', false, false],
    ['Gangrène pulmonaire', 'C', false, true], ['Syndrome de détresse respiratoire aiguë', 'C', false, true],
    ['Œdème aigu du poumon cardiogénique', 'C', false, true], ['Œdème pulmonaire lésionnel', 'C', false, true],
    ['Hypertension pulmonaire', 'S', false, false], ['Hémoptysie massive', 'C', false, true],
    ['Cavernes tuberculeuses', 'S', true, false], ['Aspergillose pulmonaire invasive', 'C', false, true],
    ['Aspergillome', 'M', false, false], ['Légionellose', 'S', false, false],
    ['Histoplasmose pulmonaire', 'M', false, false], ['Syndrome d\'apnée obstructive du sommeil', 'M', false, false],
    ['Hypoventilation alvéolaire', 'M', false, false], ['Dyspnée fonctionnelle', 'L', false, false],
    ['Atelectasie lobaire', 'M', false, false], ['Paralysie phrénique', 'M', false, false],
    ['Pneumothorax cataménial', 'M', false, false],
], ['g' => 'M', 'c' => false, 'u' => false, 'a' => false]);

// ══════════════════════════════════════════════════════════════════════════════
//  10. MALADIES DIGESTIVES (~70)
// ══════════════════════════════════════════════════════════════════════════════
$add('Gastroentérologie', [
    ['Gastro-entérite aiguë infectieuse', 'M', true, false], ['Gastro-entérite à Rotavirus', 'M', true, false],
    ['Gastro-entérite virale', 'L', true, false], ['Gastro-entérite bactérienne', 'M', true, false],
    ['Maladie de Crohn iléo-colique', 'S', false, false], ['Maladie de Crohn fistulisante', 'S', false, false],
    ['Rectocolite hémorragique', 'S', false, false], ['Colite ulcéreuse étendue', 'S', false, false],
    ['Poussée de RCH sévère', 'C', false, true], ['Colite microscopique', 'L', false, false],
    ['Maladie cœliaque', 'M', false, false], ['Maladie cœliaque réfractaire', 'S', false, false],
    ['Appendicite aiguë catarrhale', 'M', false, true], ['Appendicite aiguë suppurée', 'S', false, true],
    ['Appendicite aiguë gangréneuse', 'C', false, true], ['Péritonite appendiculaire', 'C', false, true],
    ['Péritonite généralisée', 'C', false, true], ['Péritonite d\'origine ulcéreuse', 'C', false, true],
    ['Diverticulite sigmoïdienne aiguë', 'S', false, false], ['Diverticulite compliquée', 'C', false, true],
    ['Occlusion intestinale aiguë par bride', 'C', false, true], ['Occlusion intestinale sur hernie étranglée', 'C', false, true],
    ['Iléus paralytique', 'S', false, false], ['Volvulus du sigmoïde', 'C', false, true],
    ['Volvulus cæcal', 'C', false, true], ['Invagination intestinale aiguë', 'S', false, true],
    ['Hémorroïdes internes stade I', 'L', false, false], ['Hémorroïdes internes stade IV', 'M', false, false],
    ['Thrombose hémorroïdaire', 'M', false, false], ['Fissure anale aiguë', 'L', false, false],
    ['Fissure anale chronique', 'M', false, false], ['Fistule anale trans-sphinctérienne', 'M', false, false],
    ['Abcès péri-anal', 'M', false, false], ['Reflux gastro-œsophagien', 'M', false, false],
    ['Œsophagite peptique érosive', 'M', false, false], ['Œsophagite à éosinophiles', 'M', false, false],
    ['Sténose peptique de l\'œsophage', 'S', false, false], ['Ulcère gastrique', 'S', false, false],
    ['Ulcère duodénal', 'S', false, false], ['Ulcère gastrique perforé', 'C', false, true],
    ['Ulcère duodénal perforé', 'C', false, true], ['Gastrite aiguë hémorragique', 'M', false, false],
    ['Gastrite atrophique', 'M', false, false], ['Gastropathie des AINS', 'M', false, false],
    ['Lithiase vésiculaire', 'M', false, false], ['Cholécystite aiguë calculeuse', 'S', false, true],
    ['Cholécystite chronique', 'M', false, false], ['Angiocholite aiguë', 'C', false, true],
    ['Pancréatite aiguë œdémateuse', 'S', false, false], ['Pancréatite aiguë nécrosante', 'C', false, true],
    ['Pancréatite chronique calcifiante', 'S', false, false], ['Stéatose hépatique non alcoolique', 'M', false, false],
    ['Stéatohépatite non alcoolique (NASH)', 'S', false, false], ['Cirrhose hépatique compensée', 'S', false, false],
    ['Cirrhose hépatique décompensée', 'C', false, true], ['Hépatite alcoolique aiguë', 'C', false, true],
    ['Insuffisance hépatique aiguë', 'C', false, true], ['Encéphalopathie hépatique', 'C', false, true],
    ['Ascite cirrhotique tendue', 'S', false, false], ['Péritonite bactérienne spontanée', 'C', false, true],
    ['Syndrome hépatorénal', 'C', false, true], ['Abcès hépatique amibien', 'S', false, false],
    ['Abcès hépatique pyogène', 'S', false, false], ['Kyste hydatique du foie', 'M', false, false],
    ['Angiodysplasie colique', 'M', false, false], ['Polypose adénomateuse familiale', 'M', false, false],
    ['Maladie de Hirschsprung', 'S', false, false], ['Sprue tropicale', 'M', false, false],
    ['Entéropathie exsudative', 'M', false, false],
], ['g' => 'M', 'c' => false, 'u' => false, 'a' => false]);

// ══════════════════════════════════════════════════════════════════════════════
//  11. MALADIES DE LA PEAU (~70)
// ══════════════════════════════════════════════════════════════════════════════
$add('Dermatologie', [
    ['Dermatite atopique diffuse', 'M', false, false], ['Dermatite atopique aiguë', 'M', false, false],
    ['Eczéma de contact allergique', 'M', false, false], ['Eczéma dyshidrosique', 'M', false, false],
    ['Eczéma nummulaire', 'M', false, false], ['Dermatite séborrhéique du visage', 'L', false, false],
    ['Dermatite séborrhéique du cuir chevelu', 'L', false, false], ['Psoriasis en plaques', 'M', false, false],
    ['Psoriasis érythrodermique', 'S', false, false], ['Psoriasis pustuleux généralisé', 'C', false, true],
    ['Psoriasis unguéal', 'L', false, false], ['Rhumatisme psoriasique', 'S', false, false],
    ['Lichen plan cutané', 'M', false, false], ['Lichen plan muqueux érosif', 'S', false, false],
    ['Pityriasis rosé de Gilbert', 'L', false, false], ['Pityriasis versicolor', 'L', false, false],
    ['Urticaire aiguë', 'M', false, false], ['Urticaire chronique', 'M', false, false],
    ['Angiœdème', 'S', false, true], ['Érythème polymorphe', 'M', false, false],
    ['Syndrome de Stevens-Johnson', 'C', false, true], ['Nécrolyse épidermique toxique (Lyell)', 'C', false, true],
    ['Érythème noueux', 'M', false, false], ['Lupus érythémateux cutané chronique', 'M', false, false],
    ['Dermatomyosite', 'S', false, false], ['Sclérodermie localisée (morphée)', 'L', false, false],
    ['Sclérodermie systémique diffuse', 'S', false, false], ['Vitiligo', 'L', false, false],
    ['Acné vulgaire légère', 'L', false, false], ['Acné vulgaire modérée', 'M', false, false],
    ['Acné vulgaire sévère nodulo-kystique', 'M', false, false], ['Acné rosacée', 'L', false, false],
    ['Rosacée granulomateuse', 'M', false, false], ['Folliculite bactérienne', 'L', false, false],
    ['Furoncle', 'L', false, false], ['Anthrax', 'M', false, false],
    ['Hidradénite suppurée stade I', 'M', false, false], ['Hidradénite suppurée stade II', 'S', false, false],
    ['Hidradénite suppurée stade III', 'S', false, false], ['Cellulite bactérienne (dermo-hypodermite)', 'M', false, false],
    ['Fasciite nécrosante', 'C', false, true], ['Impétigo', 'L', true, false],
    ['Ecthyma', 'M', false, false], ['Alopécie androgénétique', 'L', false, false],
    ['Alopécie areata en plaque', 'L', false, false], ['Alopécie areata totale', 'M', false, false],
    ['Alopécie areata universelle', 'M', false, false], ['Kéloïde', 'L', false, false],
    ['Cicatrice hypertrophique', 'L', false, false], ['Kyste épidermique infecté', 'M', false, false],
    ['Kyste pilonidal', 'M', false, false], ['Lipome', 'L', false, false],
    ['Nævus mélanocytaire', 'L', false, false], ['Nævus congénital géant', 'M', false, false],
    ['Carcinome basocellulaire nodulaire', 'M', false, false], ['Carcinome basocellulaire superficiel', 'M', false, false],
    ['Carcinome spinocellulaire', 'M', false, false], ['Maladie de Paget mammaire', 'M', false, false],
    ['Névrome de Morton', 'L', false, false], ['Ongle incarné infecté', 'M', false, false],
    ['Paronychie aiguë', 'L', false, false], ['Paronychie chronique', 'L', false, false],
    ['Onychomycose', 'L', false, false], ['Dermatophytie de la peau glabre', 'L', true, false],
    ['Teigne du cuir chevelu', 'L', true, false], ['Candidose cutanée des plis', 'L', false, false],
    ['Intertrigo bactérien', 'L', false, false], ['Érythrasma', 'L', false, false],
    ['Fibrome mou (molluscum pendulum)', 'L', false, false], ['Chéloïde', 'L', false, false],
    ['Purpura vasculaire', 'M', false, false],
], ['g' => 'L', 'c' => false, 'u' => false, 'a' => false]);

// ══════════════════════════════════════════════════════════════════════════════
//  12. MALADIES OSTÉO-ARTICULAIRES (~55)
// ══════════════════════════════════════════════════════════════════════════════
$add('Rhumatologie et orthopédie', [
    ['Polyarthrite rhumatoïde séropositive', 'S', false, false], ['Polyarthrite rhumatoïde séronégative', 'S', false, false],
    ['Arthrose du genou (gonarthrose)', 'M', false, false], ['Arthrose de la hanche (coxarthrose)', 'M', false, false],
    ['Arthrose des doigts (nodosités d\'Heberden)', 'L', false, false],
    ['Arthrose cervicale (cervicarthrose)', 'M', false, false],
    ['Arthrose lombaire (lombarthrose)', 'M', false, false],
    ['Spondylarthrite ankylosante', 'S', false, false], ['Arthrite psoriasique', 'S', false, false],
    ['Arthrite réactionnelle', 'M', false, false], ['Arthrite juvénile idiopathique', 'S', false, false],
    ['Arthrite septique à staphylocoque', 'C', false, true], ['Arthrite tuberculeuse', 'M', false, false],
    ['Lupus érythémateux systémique', 'S', false, false], ['Syndrome de Sjögren primaire', 'M', false, false],
    ['Polymyalgie rhumatismale', 'M', false, false], ['Maladie de Behçet', 'S', false, false],
    ['Ostéoporose post-ménopausique', 'M', false, false], ['Ostéoporose cortisonique', 'M', false, false],
    ['Ostéomalacie carentielle', 'M', false, false], ['Rachitisme', 'M', false, false],
    ['Maladie de Paget osseuse', 'M', false, false], ['Ostéogénèse imparfaite', 'S', false, false],
    ['Ostéochondrite de la hanche (Legg-Calvé-Perthes)', 'M', false, false],
    ['Épiphysiolyse de la tête fémorale', 'S', false, true],
    ['Maladie de Scheuermann (cyphose juvénile)', 'L', false, false],
    ['Nécrose avasculaire de la tête fémorale', 'S', false, false],
    ['Syndrome de Raynaud', 'L', false, false], ['Phénomène de Raynaud secondaire', 'M', false, false],
    ['Bursite trochantérienne', 'M', false, false], ['Bursite olécranienne', 'L', false, false],
    ['Tendinite calcanéenne (Achille)', 'M', false, false], ['Ténosynovite de De Quervain', 'L', false, false],
    ['Capsulite rétractile de l\'épaule', 'M', false, false], ['Syndrome de la coiffe des rotateurs', 'M', false, false],
    ['Rupture de la coiffe des rotateurs', 'M', false, false], ['Lombalgie aiguë', 'M', false, false],
    ['Lombalgie chronique', 'M', false, false], ['Lumbago aigu', 'M', false, false],
    ['Hernie discale lombaire L4-L5', 'S', false, false], ['Hernie discale lombaire L5-S1', 'S', false, false],
    ['Hernie discale cervicale', 'S', false, false], ['Sciatique commune', 'M', false, false],
    ['Névralgie cervico-brachiale', 'M', false, false], ['Sténose lombaire rétrécie', 'S', false, false],
    ['Spondylolisthésis', 'M', false, false], ['Fracture vertébrale ostéoporotique', 'S', false, false],
    ['Maladie de Dupuytren', 'L', false, false], ['Syndrome du canal carpien', 'M', false, false],
    ['Algodystrophie (syndrome de Sudeck)', 'M', false, false], ['Fibromyalgie', 'M', false, false],
    ['Syndrome des loges chronique', 'M', false, false], ['Syndrome des loges aigu', 'C', false, true],
    ['Ostéomyélite aiguë hématogène', 'S', false, false], ['Ostéomyélite chronique', 'M', false, false],
], ['g' => 'M', 'c' => false, 'u' => false, 'a' => false]);

// ══════════════════════════════════════════════════════════════════════════════
//  13. NÉPHROLOGIE ET UROLOGIE (~60)
// ══════════════════════════════════════════════════════════════════════════════
$add('Néphrologie et urologie', [
    ['Insuffisance rénale aiguë fonctionnelle', 'S', false, false], ['Insuffisance rénale aiguë organique', 'S', false, false],
    ['Nécrose tubulaire aiguë', 'S', false, false], ['Insuffisance rénale chronique stade 3', 'M', false, false],
    ['Insuffisance rénale chronique stade 4', 'S', false, false],
    ['Insuffisance rénale chronique stade 5 (dialyse)', 'C', false, false],
    ['Insuffisance rénale aiguë obstructive', 'S', false, false],
    ['Glomérulonéphrite aiguë post-streptococcique', 'S', false, false],
    ['Glomérulonéphrite rapidement progressive', 'C', false, false],
    ['Syndrome néphrotique pur', 'M', false, false], ['Syndrome néphrotique impur', 'S', false, false],
    ['Néphropathie diabétique débutante', 'M', false, false], ['Néphropathie diabétique avancée', 'S', false, false],
    ['Néphropathie hypertensive', 'M', false, false], ['Néphropathie à IgA (maladie de Berger)', 'M', false, false],
    ['Néphropathie lupique', 'S', false, false], ['Polykystose rénale autosomique dominante', 'M', false, false],
    ['Pyélonéphrite aiguë simple', 'S', false, false], ['Pyélonéphrite aiguë compliquée', 'C', false, false],
    ['Pyélonéphrite emphysémateuse', 'C', false, true], ['Abcès rénal', 'S', false, false],
    ['Cystite aiguë non compliquée', 'L', false, false], ['Cystite récidivante', 'L', false, false],
    ['Cystite hémorragique', 'M', false, false], ['Urétrite gonococcique', 'L', true, false],
    ['Urétrite à Chlamydia', 'L', true, false], ['Urétrite non spécifique', 'L', true, false],
    ['Prostatite aiguë bactérienne', 'S', false, false], ['Prostatite chronique bactérienne', 'M', false, false],
    ['Prostatite chronique abactérienne', 'M', false, false], ['Hypertrophie bénigne de la prostate', 'M', false, false],
    ['Rétention aiguë d\'urine', 'S', false, true], ['Rétention vésicale chronique', 'M', false, false],
    ['Colique néphrétique unique', 'S', false, true], ['Colique néphrétique fébrile', 'C', false, true],
    ['Lithiase coralliforme', 'M', false, false], ['Lithiase urétérale', 'S', false, false],
    ['Néphrocalcinose', 'M', false, false], ['Incontinence urinaire d\'effort', 'L', false, false],
    ['Incontinence urinaire par urgenturie', 'L', false, false], ['Vessie hyperactive', 'M', false, false],
    ['Vessie neurologique', 'M', false, false], ['Hydronéphrose', 'M', false, false],
    ['Reflux vésico-urétéral', 'M', false, false], ['Cancer du rein à cellules claires', 'S', false, false],
    ['Cancer de la vessie infiltrant', 'S', false, false], ['Cancer de la prostate métastatique', 'C', false, false],
    ['Torsion du cordon spermatique', 'C', false, true], ['Torsion de l\'hydatide', 'M', false, true],
    ['Orchi-épididymite aiguë', 'S', false, false], ['Hydrocèle', 'L', false, false],
    ['Varicocèle', 'L', false, false], ['Phimosis', 'L', false, false],
    ['Paraphimosis', 'M', false, true], ['Fracture du pénis', 'S', false, true],
    ['Hématurie isolée', 'M', false, false], ['Sténose de l\'urètre', 'M', false, false],
], ['g' => 'M', 'c' => false, 'u' => false, 'a' => false]);

// ══════════════════════════════════════════════════════════════════════════════
//  14. GYNÉCOLOGIE-OBSTÉTRIQUE (~45)
// ══════════════════════════════════════════════════════════════════════════════
$add('Gynécologie et obstétrique', [
    ['Grossesse extra-utérine non rompue', 'S', false, true], ['Grossesse extra-utérine rompue', 'C', false, true],
    ['Placenta praevia hémorragique', 'C', false, true], ['Décollement prématuré du placenta', 'C', false, true],
    ['Pré-éclampsie modérée', 'S', false, false], ['Pré-éclampsie sévère', 'C', false, true],
    ['Éclampsie', 'C', false, true], ['Syndrome HELLP', 'C', false, true],
    ['Diabète gestationnel', 'M', false, false], ['Pyélonéphrite gravidique', 'S', false, false],
    ['Chorioamniotite', 'C', false, true], ['Menace d\'accouchement prématuré', 'S', false, true],
    ['Rupture prématurée des membranes', 'S', false, true], ['Hémorragie du post-partum immédiat', 'C', false, true],
    ['Hémorragie du post-partum tardif', 'S', false, true], ['Rétention placentaire', 'S', false, true],
    ['Endométrite du post-partum', 'S', false, false], ['Mastite puerpérale', 'M', false, false],
    ['Abcès du sein', 'S', false, false], ['Thrombophlébite pelvienne', 'S', false, false],
    ['Embolie amniotique', 'C', false, true], ['Souffrance fœtale aiguë', 'C', false, true],
    ['Retard de croissance intra-utérin sévère', 'S', false, false], ['Macrosomie fœtale', 'M', false, false],
    ['Polyhydramnios aigu', 'S', false, false], ['Oligoamnios sévère', 'S', false, false],
    ['Incompatibilité Rh fœto-maternelle', 'M', false, false], ['Anémie gravidique sévère', 'S', false, false],
    ['Cholestase gravidique', 'M', false, false], ['Hyperemesis gravidarum', 'M', false, false],
    ['Maladie trophoblastique gestationnelle', 'S', false, false], ['Fibrome utérin sous-muqueux', 'M', false, false],
    ['Fibrome utérin nécrosé', 'S', false, false], ['Endométriose douloureuse', 'M', false, false],
    ['Endométriose profonde', 'S', false, false], ['Salpingite aiguë', 'S', false, false],
    ['Pyosalpinx', 'S', false, true], ['Kyste ovarien fonctionnel', 'L', false, false],
    ['Kyste ovarien organique', 'M', false, false], ['Torsion d\'annexe', 'C', false, true],
    ['Rupture de kyste ovarien', 'S', false, true], ['Ménorragies par fibrome', 'M', false, false],
    ['Métrorragies post-ménopausiques', 'M', false, false], ['Prolapsus génital', 'M', false, false],
    ['Infection génitale haute (endométrite)', 'S', false, false],
], ['g' => 'M', 'c' => false, 'u' => false, 'a' => false]);

// ══════════════════════════════════════════════════════════════════════════════
//  15. PÉDIATRIE (~55)
// ══════════════════════════════════════════════════════════════════════════════
$add('Pédiatrie', [
    ['Ictère néonatal physiologique', 'L', false, false], ['Ictère néonatal pathologique', 'S', false, false],
    ['Ictère nucléaire (kernictère)', 'C', false, false], ['Infection néonatale précoce', 'S', false, false],
    ['Infection néonatale tardive', 'S', false, false], ['Hypoglycémie néonatale', 'S', false, false],
    ['Détresse respiratoire néonatale (membrane hyaline)', 'C', false, true],
    ['Entérocolite ulcéro-nécrosante', 'C', false, true],
    ['Hémorragie intraventriculaire du prématuré', 'S', false, false],
    ['Leucomalacie périventriculaire', 'S', false, false], ['Petit poids de naissance', 'M', false, false],
    ['Prématurité extrême', 'C', false, false], ['Asphyxie néonatale', 'C', false, true],
    ['Encéphalopathie hypoxique-ischémique', 'S', false, false], ['Hypothermie néonatale', 'S', false, false],
    ['Maladie des membranes hyalines', 'C', false, true], ['Trisomie 21 (Syndrome de Down)', 'M', false, false],
    ['Syndrome de Turner', 'M', false, false], ['Spina bifida ouvert', 'S', false, false],
    ['Hydrocéphalie congénitale', 'S', false, false], ['Luxation congénitale de la hanche', 'L', false, false],
    ['Pied bot varus équin congénital', 'L', false, false], ['Fente labio-palatine', 'M', false, false],
    ['Atrésie de l\'œsophage', 'C', false, true], ['Sténose hypertrophique du pylore', 'S', false, true],
    ['Invagination intestinale aiguë du nourrisson', 'C', false, true],
    ['Syndrome de détresse respiratoire du nouveau-né', 'C', false, true],
    ['Anémie du prématuré', 'M', false, false], ['Convulsions néonatales', 'C', false, true],
    ['Malformations cardiaques congénitales cyanogènes', 'S', false, false],
    ['Canal artériel perméable du prématuré', 'M', false, false],
    ['Pneumopathie congénitale', 'S', false, false], ['Bronchiolite du nourrisson', 'M', true, false],
    ['Laryngite sous-glottique aiguë (croup)', 'M', false, false], ['Épiglottite aiguë', 'C', false, true],
    ['Gastro-entérite aiguë du nourrisson', 'M', true, false], ['Malnutrition aiguë sévère (marasme)', 'C', false, false],
    ['Kwashiorkor', 'S', false, false], ['Rachitisme carentiel', 'M', false, false],
    ['Anémie ferriprive du nourrisson', 'M', false, false], ['Drépanocytose SS de l\'enfant', 'S', false, false],
    ['Crise vaso-occlusive drépanocytaire', 'C', false, true], ['Paludisme grave de l\'enfant', 'C', false, true],
    ['Méningite bactérienne de l\'enfant', 'C', false, true], ['Otite moyenne aiguë de l\'enfant', 'M', false, false],
    ['Amygdalite récidivante de l\'enfant', 'M', false, false], ['Trouble du langage oral', 'L', false, false],
    ['Retard de développement psychomoteur', 'M', false, false], ['Énurésie nocturne primaire', 'L', false, false],
    ['Terreau (pica)', 'L', false, false], ['Syndrome de mort subite du nourrisson', 'C', false, true],
    ['Allergie alimentaire du nourrisson', 'S', false, false], ['Dermatite atopique du nourrisson', 'M', false, false],
    ['Obésité pédiatrique', 'M', false, false], ['Diabète de type 1 de l\'enfant', 'S', false, false],
], ['g' => 'M', 'c' => false, 'u' => false, 'a' => false]);

// ══════════════════════════════════════════════════════════════════════════════
//  16. URGENCES ET INTOXICATIONS (~55)
// ══════════════════════════════════════════════════════════════════════════════
$add('Urgences et intoxications', [
    ['Arrêt cardio-respiratoire', 'C', false, true], ['Mort subite de l\'adulte', 'C', false, true],
    ['Choc hypovolémique hémorragique', 'C', false, true], ['Choc septique', 'C', false, true],
    ['Choc anaphylactique', 'C', false, true], ['Choc cardiogénique', 'C', false, true],
    ['Choc distributif', 'C', false, true], ['Traumatisme crânien léger', 'M', false, false],
    ['Traumatisme crânien modéré', 'S', false, true], ['Traumatisme crânien grave', 'C', false, true],
    ['Hématome extra-dural', 'C', false, true], ['Hématome sous-dural aigu', 'C', false, true],
    ['Hématome sous-dural chronique', 'S', false, false], ['Fracture de la base du crâne', 'S', false, false],
    ['Polytraumatisme', 'C', false, true], ['Traumatisme thoracique fermé', 'S', false, true],
    ['Traumatisme abdominal fermé', 'S', false, true], ['Rupture de rate traumatique', 'C', false, true],
    ['Rupture hépatique traumatique', 'C', false, true], ['Brûlure thermique du 1er degré étendue', 'M', false, false],
    ['Brûlure thermique du 2e degré profond', 'S', false, true], ['Brûlure thermique du 3e degré', 'C', false, true],
    ['Brûlure électrique grave', 'C', false, true], ['Brûlure chimique oculaire', 'S', false, true],
    ['Noyade avec inhalation d\'eau', 'C', false, true], ['Asphyxie par obstruction', 'C', false, true],
    ['Intoxication au monoxyde de carbone', 'C', false, true], ['Intoxication médicamenteuse volontaire', 'C', false, true],
    ['Intoxication à l\'alcool aiguë', 'M', false, false], ['Intoxication au méthanol', 'C', false, true],
    ['Intoxication aux organophosphorés', 'C', false, true], ['Intoxication au cyanure', 'C', false, true],
    ['Intoxication au paracétamol', 'S', false, false], ['Envenimation vipérine grave', 'C', false, true],
    ['Envenimation par morsure de serpent', 'S', false, true], ['Piqûre de scorpion dangereux', 'S', false, true],
    ['Morsure de chien', 'M', false, false], ['Morsure humaine infectée', 'M', false, false],
    ['Hypothermie accidentelle modérée', 'S', false, false], ['Hypothermie accidentelle sévère', 'C', false, true],
    ['Hyperthermie maligne d\'effort', 'C', false, true], ['Coup de chaleur classique', 'C', false, true],
    ['Gelure superficielle', 'M', false, false], ['Gelure profonde', 'S', false, false],
    ['Électrocution basse tension', 'M', false, false], ['Électrocution haute tension', 'C', false, true],
    ['Fulguration (foudre)', 'C', false, true], ['Noyade en eau douce', 'C', false, true],
    ['Noyade en eau salée', 'C', false, true], ['Mal aigu des montagnes', 'M', false, false],
    ['Œdème pulmonaire de haute altitude', 'C', false, true], ['Œdème cérébral de haute altitude', 'C', false, true],
    ['Réaction allergique sévère (anaphylaxie)', 'C', false, true], ['Syndrome de Lyell (nécrolyse épidermique)', 'C', false, true],
    ['État de mal épileptique', 'C', false, true],
], ['g' => 'C', 'c' => false, 'u' => true, 'a' => true]);

// ══════════════════════════════════════════════════════════════════════════════
//  17. ORL ET OPHTALMOLOGIE (~60)
// ══════════════════════════════════════════════════════════════════════════════
$add('ORL et ophtalmologie', [
    ['Otite moyenne aiguë congestive', 'M', false, false], ['Otite moyenne aiguë purulente', 'M', false, false],
    ['Otite moyenne chronique simple', 'M', false, false], ['Otite moyenne chronique cholestéatomateuse', 'S', false, false],
    ['Otite externe aiguë', 'L', false, false], ['Otite externe maligne', 'C', false, false],
    ['Mastoïdite aiguë', 'S', false, false], ['Perforation tympanique traumatique', 'L', false, false],
    ['Surdité brusque', 'M', false, true], ['Presbyacousie', 'L', false, false],
    ['Acouphènes invalidants', 'M', false, false], ['Vertige positionnel paroxystique bénin', 'M', false, false],
    ['Névrite vestibulaire', 'M', false, false], ['Maladie de Ménière', 'M', false, false],
    ['Sinusite maxillaire aiguë', 'M', false, false], ['Sinusite frontale aiguë', 'M', false, false],
    ['Sinusite sphénoïdale', 'M', false, false], ['Sinusite chronique avec polypes', 'M', false, false],
    ['Polypose naso-sinusienne', 'M', false, false], ['Rhinite allergique perannuelle', 'L', false, false],
    ['Rhume (coryza aigu)', 'L', true, false], ['Épistaxis antérieure', 'L', false, false],
    ['Épistaxis postérieure', 'M', false, false], ['Amygdalite aiguë érythémateuse', 'M', true, false],
    ['Amygdalite aiguë avec phlegmon', 'S', true, false], ['Abcès péri-amygdalien', 'S', false, false],
    ['Abcès rétro-pharyngé', 'C', false, true], ['Pharyngite aiguë virale', 'L', true, false],
    ['Laryngite aiguë de l\'adulte', 'L', false, false], ['Dysphonie par nodules cordaux', 'L', false, false],
    ['Paralysie des cordes vocales', 'M', false, false], ['Conjonctivite bactérienne aiguë', 'L', true, false],
    ['Conjonctivite virale', 'L', true, false], ['Conjonctivite allergique', 'L', false, false],
    ['Kératite herpétique', 'M', false, false], ['Kératite bactérienne', 'S', false, true],
    ['Ulcère cornéen', 'S', false, true], ['Orgelet (compère loriot)', 'L', false, false],
    ['Chalazion infecté', 'M', false, false], ['Dacryocystite aiguë', 'M', false, false],
    ['Glaucome aigu par fermeture de l\'angle', 'C', false, true], ['Glaucome chronique à angle ouvert', 'M', false, false],
    ['Cataracte sénile', 'M', false, false], ['Cataracte traumatique', 'M', false, false],
    ['Cataracte congénitale', 'M', false, false], ['Rétinopathie diabétique proliférante', 'S', false, false],
    ['Dégénérescence maculaire liée à l\'âge', 'S', false, false], ['Rétinopathie hypertensive', 'M', false, false],
    ['Décollement de rétine', 'C', false, true], ['Occlusion de l\'artère centrale de la rétine', 'C', false, true],
    ['Occlusion de la veine centrale de la rétine', 'S', false, true], ['Rétinite à cytomégalovirus', 'C', false, false],
    ['Uvéite antérieure aiguë', 'M', false, false], ['Uvéite postérieure', 'M', false, false],
    ['Strabisme convergent', 'L', false, false], ['Amblyopie fonctionnelle', 'L', false, false],
    ['Myopie forte', 'L', false, false], ['Presbytie', 'L', false, false],
    ['Nystagmus congénital', 'L', false, false], ['Ptosis congénital', 'L', false, false],
], ['g' => 'L', 'c' => false, 'u' => false, 'a' => false]);

// ══════════════════════════════════════════════════════════════════════════════
//  18. MALADIES AUTOIMMUNES ET SYSTÉMIQUES (~30)
// ══════════════════════════════════════════════════════════════════════════════
$add('Maladies auto-immunes et systémiques', [
    ['Lupus érythémateux disséminé (LES)', 'S', false, false], ['Poussée lupique sévère', 'C', false, true],
    ['Néphrite lupique proliférative', 'C', false, false], ['Syndrome de Sjögren', 'M', false, false],
    ['Sclérodermie systémique cutanée limitée', 'M', false, false],
    ['Sclérodermie systémique cutanée diffuse', 'S', false, false],
    ['Crise rénale sclérodermique', 'C', false, true], ['Dermatomyosite', 'S', false, false],
    ['Polymyosite', 'S', false, false], ['Syndrome de Sharp (connectivite mixte)', 'M', false, false],
    ['Pemphigus vulgaire', 'S', false, false], ['Pemphigus foliacé', 'M', false, false],
    ['Pemphigoïde bulleuse', 'S', false, false], ['Dermatite herpétiforme', 'M', false, false],
    ['Vascularite à IgA (purpura rhumatoïde)', 'M', false, false],
    ['Granulomatose avec polyangéite (Wegener)', 'S', false, false],
    ['Polyangéite microscopique', 'S', false, false],
    ['Granulomatose éosinophilique avec polyangéite (Churg-Strauss)', 'S', false, false],
    ['Périartérite noueuse', 'S', false, false], ['Syndrome de Cogan', 'M', false, false],
    ['Sarcoïdose systémique', 'M', false, false], ['Sarcoïdose cardiaque', 'S', false, false],
    ['Sarcoïdose neurologique', 'S', false, false], ['Maladie de Still de l\'adulte', 'M', false, false],
    ['Fièvre méditerranéenne familiale', 'M', false, false],
    ['Maladie de Castleman multicentrique', 'S', false, false],
    ['Syndrome d\'activation macrophagique', 'C', false, true],
    ['Maladie de Kawasaki', 'S', false, false], ['Syndrome inflammatoire multisystémique', 'C', false, true],
    ['Amylose AL systémique', 'S', false, false],
], ['g' => 'M', 'c' => false, 'u' => false, 'a' => false]);

echo "Total diseases added: " . count($d) . "\n";

// ─── Category template libraries for content generation ───
$templates = [];

// Template sets per category for descriptions, symptoms, causes, precautions, treatment
$templates['Maladies infectieuses'] = [
    'desc' => [
        'Infection %CAUSE% touchant %POPULATION%. Fréquent en zone tropicale, cette %TYPE% nécessite une prise en charge rapide.',
        '%TYPE% aiguë causée par %CAUSE%. Se manifeste par des symptômes généraux et spécifiques à l\'organe atteint.',
        'Maladie infectieuse %TYPE% due à %CAUSE%. L\'évolution dépend de l\'état immunitaire du patient et de la précocité du traitement.',
    ],
    'sympt' => [
        'Fièvre élevée d\'apparition brutale, frissons, céphalées intenses, courbatures, fatigue générale.',
        'Fièvre prolongée, sueurs nocturnes, amaigrissement, asthénie profonde, anorexie.',
        'Signes généraux : fièvre, tachycardie, hypotension. Signes spécifiques selon l\'atteinte viscérale.',
    ],
    'cause' => [
        'Agent pathogène transmis par voie aérienne, contact direct ou vecteur. Facteurs de risque : promiscuité, dénutrition, immunodépression.',
        'Contamination interhumaine par gouttelettes salivaires ou contact cutané. Incubation variable selon le germe.',
    ],
    'prec' => [
        'Lavage fréquent des mains au savon. Port de masque en période épidémique. Isolement des cas suspects.',
        'Vaccination recommandée. Éviter les contacts avec les personnes malades. Utilisation de moustiquaires imprégnées.',
    ],
    'trait' => [
        'Antibiothérapie adaptée après prélèvements bactériologiques. Traitement symptomatique : antipyrétiques, réhydratation.',
        'Repos strict, hydratation abondante, antipyrétiques. Traitement étiologique spécifique selon l\'agent pathogène identifié.',
    ],
    'ps' => [
        ['Diagnostic et traitement précoce', 'Consulter un centre de santé pour un test diagnostique rapide. Débuter le traitement adapté sans délai après confirmation.', 'Fièvre, signes généraux', 'E'],
        ['Surveillance des signes de gravité', 'Surveiller la température, l\'état de conscience, la respiration et la diurèse. Référer en urgence en cas d\'aggravation.', 'Aggravation clinique', 'C'],
        ['Hydratation et repos', 'Assurer un apport hydrique suffisant (eau potable, SRO). Repos au lit. Antipyrétiques si fièvre > 38,5°C.', 'Fièvre, déshydratation', 'M'],
        ['Isolement et protection de l\'entourage', 'Porter un masque en présence d\'autres personnes. Limiter les contacts. Désinfecter les surfaces touchées. Laver le linge à 60°C minimum.', 'Prévention transmission', 'M'],
        ['Prise en charge de la fièvre', 'Surveiller la température toutes les 4 heures. Utiliser des antipyrétiques (paracétamol) en respectant les doses max. Ne pas utiliser d\'aspirine chez l\'enfant.', 'Fièvre élevée', 'M'],
        ['Alimentation adaptée', 'Proposer une alimentation légère et fractionnée. Éviter les aliments crus. Privilégier les soupes, compotes et bouillons. Assurer un apport calorique suffisant.', 'Anorexie, fatigue', 'M'],
        ['Traitement antimicrobien', 'Administrer les antibiotiques/antiviraux selon la prescription. Respecter strictement les horaires. Terminer la durée complète même si amélioration.', 'Infection confirmée', 'E'],
        ['Surveillance des complications', 'Surveiller l\'apparition de signes neurologiques, respiratoires ou hémorragiques. Référer d\'urgence en cas de détérioration rapide de l\'état général.', 'Signes de gravité', 'C'],
    ],
];

$templates['Parasitoses tropicales'] = [
    'desc' => [
        'Parasitose %TYPE% due à %CAUSE%. Endémique en Afrique subsaharienne, liée au péril fécal ou à la transmission vectorielle.',
        'Infection parasitaire %TYPE% fréquente en milieu tropical. Le cycle parasitaire implique un hôte intermédiaire.',
        'Maladie parasitaire %TYPE% affectant %POPULATION%. La contamination se fait par voie orale, cutanée ou par piqûre.',
    ],
    'sympt' => [
        'Douleurs abdominales diffuses, diarrhée chronique, alternance constipation-diarrhée, ballonnements, flatulences.',
        'Prurit anal nocturne, insomnie, irritabilité. Signes digestifs modérés ou absents.',
        'Lésions cutanées prurigineuses, œdème localisé, adénopathies satellites. Fièvre intermittente possible.',
    ],
    'cause' => [
        'Cycle parasitaire complexe impliquant un hôte définitif et un vecteur. Transmission liée au manque d\'hygiène.',
        'Contamination par ingestion d\'œufs ou de larves présents dans le sol, l\'eau ou les aliments contaminés par des matières fécales.',
    ],
    'prec' => [
        'Hygiène stricte : lavage des mains au savon après les selles et avant les repas. Eau potable ou bouillie.',
        'Porter des chaussures en extérieur. Laver soigneusement fruits et légumes. Traitement de masse en zone d\'endémie.',
    ],
    'trait' => [
        'Antiparasitaires adaptés au parasite identifié (albendazole, praziquantel, ivermectine). Dose unique ou cure selon le parasite.',
        'Traitement de l\'anémie associée si nécessaire. Surveillance parasitologique de contrôle à distance du traitement.',
    ],
    'ps' => [
        ['Diagnostic parasitologique', 'Réaliser un examen parasitologique des selles (3 échantillons sur 3 jours consécutifs) ou un test sérologique spécifique. Adapter le traitement antiparasitaire au parasite identifié.', 'Signes digestifs', 'M'],
        ['Traitement antiparasitaire spécifique', 'Administrer l\'antiparasitaire prescrit (albendazole, praziquantel, ivermectine). Respecter la posologie et la durée du traitement. Traiter simultanément les membres du foyer si indiqué.', 'Confirmation parasitaire', 'M'],
        ['Prévention des réinfestations', 'Améliorer les conditions d\'hygiène de base. Laver le linge à 60°C. Traiter l\'eau de boisson par ébullition ou filtration. Laver soigneusement les fruits et légumes.', 'Prévention', 'M'],
        ['Traitement de l\'anémie associée', 'Prescrire une supplémentation en fer et acide folique si anémie confirmée. Surveillance de l\'hémoglobine à 1 mois. Alimentation riche en fer (viande, légumes verts, légumineuses).', 'Anémie, fatigue', 'M'],
        ['Hydratation et soutien nutritionnel', 'Assurer une hydratation abondante pour compenser les pertes digestives. Proposer une alimentation hyperprotéinée et hypercalorique. Fractionner les repas.', 'Dénutrition, diarrhée', 'M'],
        ['Surveillance de l\'évolution après traitement', 'Contrôle parasitologique de guérison à 3 semaines. Nouvel examen des selles 1 mois après la fin du traitement. Reconsulter en cas de récidive des symptômes.', 'Suivi post-traitement', 'M'],
        ['Correction des facteurs environnementaux', 'Identifier et éliminer les sources de contamination (eau stagnante, défaut d\'assainissement). Utiliser des latrines. Porter des chaussures en extérieur.', 'Prévention durable', 'F'],
        ['Information et éducation sanitaire', 'Expliquer le cycle parasitaire et les modes de transmission à la famille. Enseigner les mesures d\'hygiène de base. Signaler aux autorités sanitaires si maladie à déclaration obligatoire.', 'Éducation santé', 'F'],
    ],
];

$templates['Tumeurs et cancers'] = [
    'desc' => [
        'Néoplasie maligne %TYPE% se développant aux dépens de %ORGANE%. Le pronostic dépend du stade au diagnostic et de l\'extension.',
        'Tumeur maligne %TYPE% de %ORGANE%. L\'évolution est variable selon le type histologique et la présence de métastases.',
        'Cancer %TYPE% touchant %ORGANE%. La stratégie thérapeutique est multidisciplinaire et personnalisée.',
    ],
    'sympt' => [
        'Masse palpable, douleur locale progressive, altération de l\'état général, amaigrissement, fièvre au long cours.',
        'Signes compressifs : douleur, dysphagie, dyspnée, ictère selon la localisation. Adénopathies satellites fréquentes.',
        'Hémorragie, obstruction, perforation ou syndrome tumoral selon l\'organe atteint. Métastases à distance possibles.',
    ],
    'cause' => [
        'Facteurs génétiques, environnementaux (tabac, alcool, soleil, virus oncogènes). L\'accumulation de mutations génétiques est le mécanisme de base.',
        'Âge avancé, tabagisme, obésité, infections chroniques (VHB, HPV, Helicobacter), prédisposition familiale.',
    ],
    'prec' => [
        'Dépistage régulier recommandé selon l\'âge et les facteurs de risque. Éviter tabac et alcool. Alimentation équilibrée riche en fruits et légumes.',
        'Vaccination anti-VHB et anti-HPV. Protection solaire. Activité physique régulière. Consultation médicale en cas de signes persistants.',
    ],
    'trait' => [
        'Traitement multidisciplinaire : chirurgie d\'exérèse, radiothérapie, chimiothérapie, immunothérapie ou hormonothérapie selon le type.',
        'Soins de support : antalgiques, nutrition, soutien psychologique. Surveillance post-thérapeutique régulière à long terme.',
    ],
    'ps' => [
        ['Consultation oncologique spécialisée', 'Adresser en urgence au spécialiste pour un bilan complet incluant imagerie, biopsie et bilan d\'extension. Ne pas retarder la prise en charge diagnostique.', 'Masse, altération état général', 'E'],
        ['Soutien psychologique et accompagnement', 'Proposer un soutien psychologique au patient et à sa famille. Orienter vers des associations de patients. Expliquer clairement les options thérapeutiques.', 'Anxiété, détresse', 'M'],
        ['Surveillance des complications', 'Surveiller les signes de compression tumorale, d\'hémorragie, d\'infection ou de défaillance d\'organe. Référer aux urgences en cas de complication aiguë.', 'Complications', 'C'],
        ['Prise en charge de la douleur', 'Évaluer la douleur par échelle visuelle analogique (EVA). Administrer les antalgiques selon palier OMS. Ne pas laisser le patient souffrir. Adresser en centre antidouleur si nécessaire.', 'Douleur tumorale', 'M'],
        ['Soutien nutritionnel spécialisé', 'Surveiller le poids hebdomadaire. Proposer une alimentation enrichie et fractionnée. Consulter un diététicien. Envisager une nutrition entérale si dénutrition sévère.', 'Dénutrition, cachexie', 'M'],
        ['Observance des traitements spécifiques', 'Respecter le calendrier de chimiothérapie/radiothérapie. Gérer les effets secondaires (nausées, fatigue, neutropénie). Ne pas interrompre le traitement sans avis.', 'Traitement en cours', 'E'],
        ['Prévention des infections', 'Surveiller la fièvre et les signes d\'infection. Éviter les lieux publics si immunodépression. Hygiène rigoureuse. Vaccinations à jour (grippe, pneumocoque).', 'Prévention infections', 'M'],
        ['Plan de surveillance à long terme', 'Programmer les consultations de suivi et examens d\'imagerie. Connaître les signes de récidive. Maintenir un carnet de suivi patient. Surveillance des séquelles des traitements.', 'Suivi rémission', 'M'],
    ],
];

$templates['Maladies du sang'] = [
    'desc' => [
        'Affection hématologique %TYPE% caractérisée par une anomalie %PATHO%. Fréquent dans les populations d\'origine africaine.',
        'Maladie du sang %TYPE% touchant %LIGNEE%. L\'expression clinique varie de la forme asymptomatique à la forme sévère.',
        'Trouble hématologique %TYPE% nécessitant une surveillance régulière et un traitement adapté au long cours.',
    ],
    'sympt' => [
        'Pâleur cutanéo-muqueuse, fatigue, dyspnée d\'effort, tachycardie, vertiges. Forme sévère : défaillance cardiaque.',
        'Saignements anormaux (ecchymoses, pétéchies, hémorragies), pâleur, fatigue, fièvre récurrente.',
    ],
    'cause' => [
        'Héréditaire : transmission autosomique récessive ou dominante. Acquise : carence nutritionnelle, auto-immunité, médicamenteuse.',
        'Mutation génétique affectant la synthèse de l\'hémoglobine ou les facteurs de coagulation. Carence en fer, folates ou vitamine B12.',
    ],
    'prec' => [
        'Dépistage systématique dans les populations à risque. Éviter les facteurs déclenchants (froid, infection, déshydratation pour la drépanocytose).',
        'Supplémentation en acide folique pour les hémoglobinopathies. Vaccinations recommandées (anti-pneumocoque, anti-méningocoque).',
    ],
    'trait' => [
        'Transfusion sanguine si anémie sévère. Chélation du fer si surcharge transfusionnelle. Traitement étiologique selon la cause.',
        'Hydroxyurée pour la drépanocytose. Anticoagulants pour les thrombophilies. Facteurs de coagulation pour l\'hémophilie.',
    ],
    'ps' => [
        ['Évaluation de l\'urgence transfusionnelle', 'Vérifier le taux d\'hémoglobine (NFS), le nombre de plaquettes et les facteurs de coagulation. Transfuser immédiatement si anémie sévère (< 7 g/dL) ou thrombopénie profonde.', 'Pâleur, dyspnée, fatigue', 'E'],
        ['Soins de support et hydratation', 'Assurer une hydratation abondante (3L/jour). Antalgiques adaptés à l\'intensité de la douleur. Repos strict au lit en phase de crise vaso-occlusive. Oxygénothérapie si nécessaire.', 'Crise vaso-occlusive', 'M'],
        ['Prévention des complications infectieuses', 'Surveiller la fièvre et les signes d\'infection. Vaccinations à jour (anti-pneumocoque, anti-méningocoque, anti-grippe). Éviter l\'automédication par AINS ou aspirine.', 'Prévention infections', 'M'],
        ['Gestion des saignements', 'En cas de saignement actif : compression locale, glace, position allongée. Consulter en urgence si hémorragie digestive, intracrânienne ou hématurie massive.', 'Saignement actif', 'C'],
        ['Supplémentation et traitement de fond', 'Acide folique quotidien pour les hémoglobinopathies. Hydroxyurée selon prescription pour drépanocytose. Respecter les rendez-vous de transfusion réguliers.', 'Traitement chronique', 'M'],
        ['Éducation thérapeutique du patient', 'Apprendre au patient à reconnaître les signes d\'alerte (pâleur, fatigue excessive, fièvre, douleur). Éviter les facteurs déclenchants : froid, déshydratation, infection, alcool.', 'Éducation patient', 'M'],
        ['Surveillance de la ferritine', 'Contrôler la ferritine sérique tous les 3 mois si transfusé chronique. Démarrer la chélation du fer si ferritine > 1000 ng/mL. Surveillance ophthalmologique et cardiaque.', 'Surcharge en fer', 'M'],
        ['Accompagnement génétique', 'Proposer un conseil génétique au patient et à sa famille. Dépistage des apparentés. Information sur le risque de transmission. Orientation vers des groupes de soutien.', 'Conseil familial', 'F'],
    ],
];

// Default templates for categories without specific templates
$templates['_default'] = [
    'desc' => [
        'Affection %TYPE% touchant %ORGANE%. La prise en charge dépend de la sévérité et du terrain du patient.',
        'Pathologie %TYPE% de %ORGANE%. Le diagnostic repose sur la clinique et les examens complémentaires adaptés.',
        'Maladie %TYPE% affectant %POPULATION%. L\'évolution est variable et nécessite une surveillance médicale régulière.',
    ],
    'sympt' => [
        'Douleur locale, gêne fonctionnelle, inflammation, fatigue. Les symptômes varient selon le stade et la localisation.',
        'Signes progressifs d\'installation plus ou moins rapide. Altération de la fonction de l\'organe atteint.',
    ],
    'cause' => [
        'Multifactorielle : génétique, environnementale, infectieuse. Les mécanismes physiopathologiques sont complexes.',
        'Facteurs de risque identifiés incluent l\'âge, les antécédents familiaux, les habitudes de vie et les expositions professionnelles.',
    ],
    'prec' => [
        'Surveillance médicale régulière. Équilibre alimentaire et activité physique adaptée. Éviter les facteurs de risque modifiables.',
        'Consultation précoce en cas de symptômes. Observance thérapeutique stricte. Suivi spécialisé recommandé.',
    ],
    'treat' => [
        'Traitement médical adapté à la pathologie. Repos et mesures hygiéno-diététiques. Kinésithérapie si nécessaire.',
        'Prise en charge multidisciplinaire. Traitement symptomatique et étiologique. Rééducation fonctionnelle si indiquée.',
    ],
    'ps' => [
        ['Consultation médicale immédiate', 'Consulter un médecin dès l\'apparition des premiers signes pour un diagnostic précis et un traitement adapté. Ne pas pratiquer d\'automédication prolongée sans avis médical.', 'Signes initiaux', 'E'],
        ['Surveillance des signes vitaux', 'Prendre la température deux fois par jour. Surveiller la pression artérielle, la fréquence cardiaque et respiratoire. Noter toute modification dans un carnet de suivi.', 'Suivi quotidien', 'M'],
        ['Hydratation et alimentation adaptée', 'Boire au moins 1,5 L d\'eau par jour. Privilégier une alimentation légère et équilibrée. Éviter l\'alcool, le tabac et les aliments trop gras ou épicés.', 'Soutien nutritionnel', 'M'],
        ['Repos et limitation des activités', 'Observer un repos strict en phase aiguë. Limiter les efforts physiques. Reprendre progressive les activités selon l\'avis médical.', 'Fatigue, convalescence', 'M'],
        ['Observance du traitement prescrit', 'Respecter rigoureusement les posologies et horaires des médicaments. Ne pas interrompre le traitement sans avis médical. Signaler tout effet secondaire.', 'Traitement en cours', 'M'],
        ['Reconsulter en cas d\'aggravation', 'Retourner aux urgences ou consulter en urgence si aggravation des symptômes, apparition de nouveaux signes ou absence d\'amélioration après 48h de traitement.', 'Aggravation clinique', 'C'],
        ['Mesures préventives pour l\'entourage', 'Informer les contacts proches des précautions nécessaires. Appliquer les mesures d\'hygiène recommandées (lavage des mains, port de masque si contagieux).', 'Prévention transmission', 'F'],
        ['Plan de suivi à long terme', 'Programmer les consultations de suivi. Respecter le calendrier des examens complémentaires. Maintenir une communication régulière avec le médecin traitant.', 'Suivi chronique', 'F'],
    ],
];

// ─── 13 remaining category-specific templates ───

$templates['Endocrinologie'] = [
    'desc' => $templates['_default']['desc'],
    'sympt' => $templates['_default']['sympt'],
    'cause' => $templates['_default']['cause'],
    'prec' => $templates['_default']['prec'],
    'treat' => $templates['_default']['treat'],
    'ps' => [
        ['Surveillance glycémique stricte', 'Contrôler la glycémie capillaire 4 à 6 fois par jour. Noter les résultats dans un carnet. Adapter le traitement selon les résultats et l\'avis médical.', 'Hyper/hypoglycémie', 'E'],
        ['Gestion des hypoglycémies', 'En cas d\'hypoglycémie (< 0,70 g/L) : resucrage immédiat par 15g de sucre rapide. Recontrôler après 15 min. Si trouble de conscience : glucagon injectable ou appel d\'urgence.', 'Hypoglycémie', 'C'],
        ['Prévention des complications métaboliques', 'Éduquer le patient sur les signes d\'acidocétose (soif intense, vomissements, douleurs abdominales, Kussmaul). Référer en urgence si suspicion d\'acidocétose.', 'Complications métaboliques', 'C'],
        ['Observance du traitement hormonal', 'Prendre le traitement hormonal substitutif à heure fixe chaque jour. Ne jamais interrompre brutalement. Adapter les doses en période de stress ou maladie intercurrente.', 'Traitement hormonal', 'M'],
        ['Surveillance du poids et de l\'alimentation', 'Pesée hebdomadaire. Alimentation équilibrée pauvre en sucres rapides et graisses saturées. Fractionner les repas. Consultation diététique spécialisée.', 'Surpoids, obésité', 'M'],
        ['Bilan biologique de contrôle', 'Réaliser le bilan biologique prescrit (HbA1c, TSH, cortisol, ionogramme). Respecter la fréquence des contrôles. Adapter le traitement aux résultats.', 'Suivi biologique', 'M'],
        ['Surveillance cardiovasculaire et ophtalmologique', 'Contrôle annuel de la tension artérielle, du fond d\'œil, de la fonction rénale et des pieds (monofilament). Dépistage précoce des complications.', 'Dépistage complications', 'M'],
        ['Éducation thérapeutique du patient', 'Apprendre au patient à adapter son traitement selon les circonstances. Reconnaître les signes de déséquilibre. Tenir un journal de suivi. Porter une carte de maladie.', 'Autonomie patient', 'F'],
    ],
];

$templates['Troubles mentaux'] = [
    'desc' => $templates['_default']['desc'],
    'sympt' => $templates['_default']['sympt'],
    'cause' => $templates['_default']['cause'],
    'prec' => $templates['_default']['prec'],
    'treat' => $templates['_default']['treat'],
    'ps' => [
        ['Évaluation du risque suicidaire', 'Interroger directement sur les idées noires et le passage à l\'acte. Évaluer l\'urgence : plan, moyens, antécédents. Hospitaliser sans délai si risque élevé.', 'Idées suicidaires', 'C'],
        ['Observance du traitement psychotrope', 'Prendre le traitement prescrit régulièrement. Ne pas modifier les doses sans avis médical. Surveiller les effets secondaires (prise de poids, sédation, syndrome extrapyramidal).', 'Traitement psychotrope', 'M'],
        ['Gestion des crises et agitation', 'En cas d\'agitation : parler calmement, réduire les stimuli, assurer un environnement sécurisé. Appeler les secours si risque de passage à l\'acte hétéro-agressif.', 'Crise agitation', 'C'],
        ['Soutien psychologique régulier', 'Suivi psychothérapeutique hebdomadaire ou bimensuel. Techniques de relaxation et de gestion du stress. Groupes de parole et soutien par les pairs.', 'Détresse psychologique', 'M'],
        ['Hygiène du sommeil et rythmes de vie', 'Se coucher et se lever à heures fixes. Éviter les écrans le soir. Limiter caféine et alcool. Exposition à la lumière naturelle le matin. Routine quotidienne structurée.', 'Troubles sommeil', 'M'],
        ['Information et psychoéducation familiale', 'Expliquer la pathologie à l\'entourage. Identifier les signes précoces de rechute. Définir un plan de crise avec les numéros d\'urgence. Réduire la stigmatisation.', 'Soutien famille', 'F'],
        ['Réinsertion sociale et professionnelle', 'Maintenir les activités quotidiennes et les liens sociaux. Reprise progressive du travail ou des études. Orientation vers un service d\'accompagnement médico-social.', 'Réadaptation sociale', 'M'],
        ['Suivi à long terme', 'Consultations régulières chez le psychiatre traitant. Bilan biologique annuel (selon traitement). Coordination avec le médecin traitant et les professionnels paramédicaux.', 'Suivi chronique', 'M'],
    ],
];

$templates['Neurologie'] = [
    'desc' => $templates['_default']['desc'],
    'sympt' => $templates['_default']['sympt'],
    'cause' => $templates['_default']['cause'],
    'prec' => $templates['_default']['prec'],
    'treat' => $templates['_default']['treat'],
    'ps' => [
        ['Reconnaissance des signes d\'alerte neurologique', 'Appliquer le test FAST : Face (paralysie faciale), Arm (faiblesse membre), Speech (trouble parole), Time (appeler immédiatement). Ne pas attendre pour consulter.', 'Signes AVC', 'C'],
        ['Conduite en cas de crise convulsive', 'Protéger la tête du patient. Ne pas rien mettre dans la bouche. Ne pas maintenir de force. Noter la durée de la crise. Appeler le 119 si > 5 minutes ou récidive.', 'Crise épileptique', 'C'],
        ['Surveillance neurologique', 'Évaluer le score de Glasgow. Surveiller la conscience, la motricité, la sensibilité et la parole. Prendre la tension artérielle et la fréquence cardiaque.', 'Surveillance neuro', 'E'],
        ['Prévention des chutes', 'Sécuriser l\'environnement : tapis antidérapants, barres d\'appui, éclairage nocturne. Utiliser une canne ou un déambulateur si troubles de l\'équilibre. Chaussures adaptées.', 'Risque chute', 'M'],
        ['Rééducation fonctionnelle', 'Kinésithérapie motrice quotidienne. Ergothérapie pour les activités de la vie quotidienne. Orthophonie si troubles de la déglutition ou du langage.', 'Rééducation', 'M'],
        ['Traitement antalgique neurologique', 'Administrer les antalgiques spécifiques aux douleurs neuropathiques (gabapentine, prégabaline, antidépresseurs). Évaluer l\'EVA régulièrement. Ne pas sous-estimer la douleur.', 'Douleur neurologique', 'M'],
        ['Soutien à l\'autonomie', 'Adapter le domicile avec des aides techniques. Enseigner les gestes de la vie quotidienne. Orienter vers une aide à domicile si nécessaire. Favoriser l\'autonomie maximale.', 'Perte autonomie', 'M'],
        ['Suivi spécialisé pluridisciplinaire', 'Consultations régulières en neurologie. Bilan d\'imagerie selon calendrier. Coordination avec kinésithérapeute, orthophoniste, ergothérapeute et psychologue.', 'Suivi spécialisé', 'M'],
    ],
];

$templates['Cardiologie'] = [
    'desc' => $templates['_default']['desc'],
    'sympt' => $templates['_default']['sympt'],
    'cause' => $templates['_default']['cause'],
    'prec' => $templates['_default']['prec'],
    'treat' => $templates['_default']['treat'],
    'ps' => [
        ['Conduite en cas de douleur thoracique', 'Arrêter immédiatement tout effort. Position semi-assise. Appeler le 119. Si aspirine prescrite, faire croquer 250-500 mg. Ne pas se rendre seul à l\'hôpital.', 'Douleur thoracique', 'C'],
        ['Surveillance de la tension artérielle', 'Mesurer la TA matin et soir au repos (assis, 5 min de calme). Noter les valeurs dans un carnet. Consulter si TA > 140/90 mmHg persistante.', 'Hypertension', 'E'],
        ['Gestion de l\'insuffisance cardiaque', 'Pesée quotidienne au réveil. Consulter si prise de poids > 2 kg en 3 jours ou apparition d\'œdèmes. Respecter la restriction hydrosodée prescrite.', 'Insuffisance cardiaque', 'M'],
        ['Observance du traitement cardiovasculaire', 'Prendre les médicaments à heure fixe (antiagrégants, statines, bêtabloquants, IEC). Ne jamais arrêter brutalement. Signaler tout effet secondaire (saignement, bradycardie).', 'Traitement cardio', 'M'],
        ['Activité physique adaptée', 'Reprendre progressive selon programme de réadaptation cardiaque. Marche quotidienne 30 min. Éviter les efforts violents et le port de charges lourdes. Surveiller la fréquence cardiaque.', 'Réadaptation', 'M'],
        ['Alimentation cardioprotectrice', 'Régime pauvre en sel (< 5g/jour), en graisses saturées et en sucres. Privilégier les oméga-3, fruits, légumes et fibres. Limiter l\'alcool. Arrêt total du tabac.', 'Prévention secondaire', 'M'],
        ['Surveillance des signes d\'alerte', 'Consulter en urgence en cas de : douleur thoracique, dyspnée d\'apparition brutale, palpitations syncopales, œdème aigu pulmonaire, malaise avec perte de connaissance.', 'Signes alerte', 'C'],
        ['Éducation sur les anticoagulants', 'Prendre l\'anticoagulant à heure fixe. Surveiller les signes de saignement (ecchymoses, gingivorragies, hématurie). INR régulier pour AVK. Carte de traitement anticoagulant.', 'Anticoagulation', 'M'],
    ],
];

$templates['Pneumologie'] = [
    'desc' => $templates['_default']['desc'],
    'sympt' => $templates['_default']['sympt'],
    'cause' => $templates['_default']['cause'],
    'prec' => $templates['_default']['prec'],
    'treat' => $templates['_default']['treat'],
    'ps' => [
        ['Gestion de la détresse respiratoire', 'Mettre le patient en position assise ou semi-assise. Oxygénothérapie si sat < 92%. Administrer les bronchodilatateurs en aérosol. Appeler le 119 si détresse sévère.', 'Détresse respiratoire', 'C'],
        ['Technique d\'inhalation des bronchodilatateurs', 'Utiliser correctement l\'aérosol-doseur avec chambre d\'inhalation. Agiter avant chaque bouffée. Inspirer lentement et profondément. Bloquer la respiration 10 secondes.', 'Traitement inhalé', 'M'],
        ['Surveillance de la saturation', 'Contrôler la SpO2 au repos et à l\'effort. Surveiller la fréquence respiratoire. Consulter si SpO2 < 90% ou aggravation de la dyspnée.', 'Surveillance oxygène', 'M'],
        ['Kinésithérapie respiratoire', 'Drainage bronchique quotidien. Technique d\'expectoration dirigée. Spirométrie incitative. Réhabilitation respiratoire à l\'effort adaptée au stade de la maladie.', 'Désencombrement', 'M'],
        ['Prévention des exacerbations', 'Vaccination antigrippale annuelle et anti-pneumocoque. Éviter les infections respiratoires. Lavage des mains. Repos en phase aiguë. Plan d\'action personnalisé écrit.', 'Prévention exacerbations', 'M'],
        ['Sevrage tabagique', 'Proposer un accompagnement au sevrage tabagique (consultation, substituts nicotiniques, suivi). Information sur les risques. Soutien psychologique. Programmer un suivi à 1, 3, 6 mois.', 'Tabagisme', 'M'],
        ['Adaptation de l\'environnement', 'Éviter les allergènes (acariens, moisissures, pollen). Utiliser un humidificateur si air sec. Purificateur d\'air si pollution intérieure. Éviter les produits irritants.', 'Allergènes', 'M'],
        ['Plan d\'action personnalisé', 'Établir un plan écrit avec le médecin : traitement de fond, traitement de crise, seuils de consultation, numéros d\'urgence. Réévaluer régulièrement le plan.', 'Autogestion', 'M'],
    ],
];

$templates['Gastroentérologie'] = [
    'desc' => $templates['_default']['desc'],
    'sympt' => $templates['_default']['sympt'],
    'cause' => $templates['_default']['cause'],
    'prec' => $templates['_default']['prec'],
    'treat' => $templates['_default']['treat'],
    'ps' => [
        ['Hydratation et réhydratation orale', 'Apporter des solutés de réhydratation orale (SRO) en cas de diarrhée aiguë. Boire de petites quantités fréquentes. Surveillance du poids et de la diurèse.', 'Déshydratation', 'E'],
        ['Régime alimentaire adapté', 'Alimentation sans résidu en phase aiguë. Éviter lait, crudités, aliments gras et épicés. Réintroduction progressive des aliments. Consultation diététique pour MICI.', 'Troubles digestifs', 'M'],
        ['Surveillance des signes digestifs d\'alerte', 'Consulter en urgence si : vomissements sanglants, sang dans les selles, douleur abdominale sévère, arrêt des gaz et matières, fièvre élevée.', 'Signes digestifs graves', 'C'],
        ['Gestion des nausées et vomissements', 'Fractionner l\'alimentation. Privilégier aliments secs (biscottes, riz). Antiémétiques prescrits si nécessaire. Réhydratation si vomissements abondants.', 'Nausées', 'M'],
        ['Prise en charge de la constipation', 'Fibres alimentaires (fruits, légumes, céréales complètes). Hydratation abondante. Activité physique régulière. Laxatifs doux si nécessaire, pas d\'automédication prolongée.', 'Constipation', 'M'],
        ['Soins de stomie digestive', 'Changer la poche de stomie régulièrement. Surveiller l\'aspect de la stomie (couleur, taille). Protéger la peau péri-stomiale. Consulter stomathérapeute.', 'Stomie digestive', 'M'],
        ['Dépistage du cancer digestif', 'Réaliser le dépistage selon les recommandations d\'âge (coloscopie à 50 ans, test immunologique fécal). Antécédents familiaux : dépistage plus précoce.', 'Prévention cancer', 'F'],
        ['Prévention des récidives de lithiase', 'Alimentation pauvre en graisses et cholestérol. Repas réguliers. Éviter les régimes restrictifs. Bilan biologique de contrôle. Traitement préventif par acide ursodésoxycholique si indiqué.', 'Lithiase biliaire', 'M'],
    ],
];

$templates['Dermatologie'] = [
    'desc' => $templates['_default']['desc'],
    'sympt' => $templates['_default']['sympt'],
    'cause' => $templates['_default']['cause'],
    'prec' => $templates['_default']['prec'],
    'treat' => $templates['_default']['treat'],
    'ps' => [
        ['Soins locaux et application de traitements topiques', 'Appliquer les crèmes/pommades en couche mince sur peau propre et sèche. Respecter l\'ordre d\'application. Espacer les applications d\'au moins 30 min entre deux produits.', 'Lésions cutanées', 'M'],
        ['Surveillance des lésions cutanées', 'Examiner régulièrement la peau. Prendre des photos pour suivre l\'évolution. Consulter en urgence si : infection (rougeur, chaleur, pus), extension rapide, douleur intense.', 'Surveillance lésions', 'M'],
        ['Prévention des infections cutanées', 'Hygiène quotidienne avec savon doux sans parfum. Sécher soigneusement les plis. Ongles courts et propres. Ne pas gratter les lésions. Éviter le partage de linge.', 'Hygiène cutanée', 'M'],
        ['Prise en charge du prurit', 'Éviter le grattage. Ongles courts. Compresses froides. Crèmes émollientes et antiprurigineuses. Antihistaminiques oraux si allergie. Vêtements en coton.', 'Démangeaisons', 'M'],
        ['Photoprotection stricte', 'Éviter l\'exposition solaire entre 12h et 16h. Crème solaire indice 50+ toutes les 2 heures. Vêtements anti-UV, chapeau à larges bords, lunettes de soleil. Auto-examen des nævus.', 'Protection solaire', 'M'],
        ['Traitement des lésions infectieuses', 'Antiseptique local (chlorhexidine) sans alcool. Antibiothérapie locale ou générale selon prescription. Ne pas percer les pustules. Protéger par un pansement sec.', 'Infection cutanée', 'M'],
        ['Soins des plaies chroniques', 'Nettoyage quotidien au sérum physiologique. Changement de pansement selon protocole. Détersion si nécrose. Surveillance des signes d\'infection. Pansements adaptés.', 'Plaie chronique', 'M'],
        ['Consultation dermatologique régulière', 'Suivi spécialisé tous les 3 à 12 mois selon pathologie. Examen dermatoscopique des lésions suspectes. Biopsie si nécessaire. Traitement adapté à l\'évolution.', 'Suivi dermatologique', 'M'],
    ],
];

$templates['Rhumatologie et orthopédie'] = [
    'desc' => $templates['_default']['desc'],
    'sympt' => $templates['_default']['sympt'],
    'cause' => $templates['_default']['cause'],
    'prec' => $templates['_default']['prec'],
    'treat' => $templates['_default']['treat'],
    'ps' => [
        ['Repos articulaire et immobilisation', 'Mettre au repos l\'articulation douloureuse. Immobilisation par attelle ou écharpe si nécessaire. Élévation du membre. Glace 20 min toutes les 2 heures en phase aiguë.', 'Douleur articulaire', 'M'],
        ['Gestion de la douleur et de l\'inflammation', 'Antalgiques selon palier OMS. AINS en cure courte (max 5 jours) sous couverture gastrique. Cryothérapie locale. Éviter l\'automédication prolongée.', 'Douleur inflammation', 'M'],
        ['Kinésithérapie et rééducation fonctionnelle', 'Séances de kinésithérapie quotidiennes. Mobilisation passive puis active. Renforcement musculaire progressif. Rééducation proprioceptive. Étirements doux.', 'Rééducation', 'M'],
        ['Prévention des complications de l\'immobilisation', 'Mobilisation des articulations saines. Prévention des escarres. Bas de contention si alitement prolongé. Exercices respiratoires. Hydratation abondante.', 'Alitement', 'M'],
        ['Adaptation des activités quotidiennes', 'Utiliser des aides techniques (canne, déambulateur, rehausseur WC). Adapter le domicile. Éviter les gestes répétitifs et le port de charges. Ergothérapie.', 'Adaptation quotidienne', 'M'],
        ['Surveillance des signes de complications', 'Consulter en urgence si : douleur inhabituelle sévère, déformation, impotence fonctionnelle totale, signes infectieux (fièvre, rougeur), troubles vasculaires.', 'Complications', 'C'],
        ['Traitement de fond et observance', 'Prendre le traitement de fond (DMARD, biothérapie) régulièrement. Surveillance biologique régulière. Bilan immunologique de contrôle. Ne pas interrompre sans avis.', 'Traitement chronique', 'M'],
        ['Exercices d\'auto-rééducation', 'Programme d\'exercices quotidiens à domicile. Postures antalgiques. Renforcement musculaire adapté. Travail de l\'équilibre. Auto-étirements. Carnet de suivi.', 'Autonomie', 'M'],
    ],
];

$templates['Néphrologie et urologie'] = [
    'desc' => $templates['_default']['desc'],
    'sympt' => $templates['_default']['sympt'],
    'cause' => $templates['_default']['cause'],
    'prec' => $templates['_default']['prec'],
    'treat' => $templates['_default']['treat'],
    'ps' => [
        ['Surveillance de la diurèse', 'Mesurer et noter le volume urinaire quotidien. Surveiller la couleur et l\'aspect des urines. Consulter si diurèse < 500 mL/jour ou > 3L/jour.', 'Diurèse', 'E'],
        ['Gestion de la colique néphrétique', 'Boire abondamment (2-3L/jour) si pas de contre-indication. Antalgiques de palier 1-2. AINS si fonction rénale normale. Consulter aux urgences si fièvre ou anurie.', 'Douleur rénale', 'M'],
        ['Prévention des infections urinaires', 'Boire au moins 1,5L d\'eau par jour. Toilette intime quotidienne. Miction après les rapports. Éviter les vêtements serrés. Canneberge en prévention si récidives.', 'Infection urinaire', 'M'],
        ['Régime adapté à la fonction rénale', 'Restriction sodée si HTA ou insuffisance rénale. Contrôle des apports protéiques. Limiter le potassium si hyperkaliémie. Éviter les AINS. Hydratation adaptée.', 'Régime rénal', 'M'],
        ['Surveillance de la fonction rénale', 'Bilan sanguin régulier (créatinine, urée, ionogramme). Calcul du débit de filtration glomérulaire. Surveillance de la pression artérielle. Contrôle de la protéinurie.', 'Suivi rénal', 'M'],
        ['Soins de dialyse', 'Respecter le calendrier des séances. Surveillance du poids et de la TA. Régime adapté. Soins du cathéter ou de la fistule artério-veineuse. Signaler tout signe infectieux.', 'Dialyse', 'C'],
        ['Gestion de la rétention urinaire', 'Sondage urinaire en urgence si globe vésical. Surveillance du volume urinaire après sondage. Traitement de la cause (HBP, sténose). Apprendre l\'auto-sondage si nécessaire.', 'Rétention urines', 'C'],
        ['Prévention de la lithiase', 'Boire 2-3L d\'eau par jour. Réduire le sel et les protéines animales. Éviter les aliments riches en oxalates (épinards, rhubarbe). Analyse du calcul pour adapter les conseils.', 'Lithiase rénale', 'M'],
    ],
];

$templates['Gynécologie et obstétrique'] = [
    'desc' => $templates['_default']['desc'],
    'sympt' => $templates['_default']['sympt'],
    'cause' => $templates['_default']['cause'],
    'prec' => $templates['_default']['prec'],
    'treat' => $templates['_default']['treat'],
    'ps' => [
        ['Surveillance des saignements et douleurs', 'Noter l\'abondance et la durée des saignements. Surveiller les signes d\'anémie (pâleur, fatigue, dyspnée). Consulter aux urgences si saignement abondant ou douleur sévère.', 'Saignement vaginal', 'C'],
        ['Consultation prénatale régulière', 'Respecter le calendrier des CPN (4 consultations minimum). Surveillance de la TA, poids, hauteur utérine, bruits du cœur fœtal. Bilan biologique trimestriel.', 'Grossesse', 'M'],
        ['Surveillance des signes de pré-éclampsie', 'Prendre la TA à domicile. Surveiller l\'apparition d\'œdèmes, maux de tête, troubles visuels, douleur épigastrique. Consulter en urgence si TA > 140/90.', 'Pré-éclampsie', 'C'],
        ['Prise en charge des infections génitales', 'Respecter le traitement antibiotique/antifongique. Toilette intime au savon doux. Éviter les douches vaginales. Traiter le partenaire si IST. Abstinence pendant le traitement.', 'Infection génitale', 'M'],
        ['Dépistage gynécologique', 'Frottis cervico-utérin tous les 3 ans (25-65 ans). Palpation mammaire annuelle. Mammographie de dépistage (50-74 ans). Bilan IST régulier si vie sexuelle active.', 'Prévention', 'M'],
        ['Gestion des douleurs menstruelles', 'Antalgiques de palier 1 (paracétamol, AINS). Chaleur locale. Repos si nécessaire. Consultation si douleurs invalidantes ou anomalies du cycle.', 'Dysménorrhée', 'M'],
        ['Contraception et régulation hormonale', 'Choix de la contraception adaptée après avis médical. Observance régulière. Surveillance des effets secondaires. Consultation en cas de doute sur la tolérance.', 'Contraception', 'M'],
        ['Accompagnement de la ménopause', 'Traitement hormonal de la ménopause si indiqué et après évaluation des risques. Surveillance gynécologique annuelle. Prise en charge des symptômes (bouffées, sécheresse, ostéoporose).', 'Ménopause', 'M'],
    ],
];

$templates['Pédiatrie'] = [
    'desc' => $templates['_default']['desc'],
    'sympt' => $templates['_default']['sympt'],
    'cause' => $templates['_default']['cause'],
    'prec' => $templates['_default']['prec'],
    'treat' => $templates['_default']['treat'],
    'ps' => [
        ['Surveillance de la fièvre chez l\'enfant', 'Prendre la température rectale (référence). Antipyrétiques : paracétamol 15 mg/kg/4h (pas d\'aspirine). Consulter si fièvre > 39°C malgré traitement ou si < 3 mois.', 'Fièvre enfant', 'E'],
        ['Détection des signes de gravité chez l\'enfant', 'Consulter d\'urgence si : refus de boire, vomissements répétés, somnolence inhabituelle, convulsion, respiration rapide, purpura, pâleur extrême.', 'Signes gravité enfant', 'C'],
        ['Hydratation préventive', 'Proposer à boire toutes les 15-30 min. SRO en cas de diarrhée/vomissements. Surveiller la diurèse (au moins 4 couches mouillées/jour). Poids quotidien.', 'Prévention déshydratation', 'E'],
        ['Respect du calendrier vaccinal', 'Suivre le calendrier vaccinal du pays. Rattrapage si retard. Surveillance des effets secondaires. Tenir le carnet de vaccination à jour.', 'Vaccinations', 'M'],
        ['Alimentation adaptée à l\'âge', 'Allaitement maternel exclusif jusqu\'à 6 mois. Diversification progressive à partir de 6 mois. Éviter le sel et le sucre ajoutés. Consultation nutritionnelle si troubles croissance.', 'Nutrition enfant', 'M'],
        ['Surveillance de la courbe de croissance', 'Relever régulièrement poids, taille et périmètre crânien sur la courbe de croissance. Consulter si cassure de la courbe ou stagnation pondérale prolongée.', 'Croissance', 'M'],
        ['Prévention des accidents domestiques', 'Sécuriser l\'environnement : barrières, coins protégés, produits dangereux hors de portée. Surveillance constante au bain. Siège auto obligatoire. Pas d\'objets petits accessible.', 'Prévention accidents', 'M'],
        ['Éveil et développement psychomoteur', 'Stimulation adaptée à l\'âge. Lecture, jeux d\'éveil, interactions verbales. Surveillance des acquisitions motrices et langagières. Consultation si retard significatif.', 'Développement', 'M'],
    ],
];

$templates['Urgences et intoxications'] = [
    'desc' => $templates['_default']['desc'],
    'sympt' => $templates['_default']['sympt'],
    'cause' => $templates['_default']['cause'],
    'prec' => $templates['_default']['prec'],
    'treat' => $templates['_default']['treat'],
    'ps' => [
        ['Alerte immédiate des secours', 'Composer le 119 (SAMU) ou le 118 (pompiers). Répondre précisément aux questions : lieu, nature de l\'urgence, nombre de victimes, état conscient, respiration.', 'Urgence vitale', 'C'],
        ['Prise en charge de l\'arrêt cardiorespiratoire', 'Vérifier conscience et respiration. Appeler à l\'aide. Débuter le massage cardiaque (30 compressions/2 insufflations). Utiliser un DAE si disponible. Ne pas interrompre.', 'Arrêt cardiaque', 'C'],
        ['Position latérale de sécurité', 'Si victime inconsciente qui respire : mettre en PLS. Dégager les voies aériennes. Surveiller la respiration jusqu\'à l\'arrivée des secours. Couvrir sans surchauffer.', 'Inconscience', 'C'],
        ['Gestion des hémorragies externes', 'Compression manuelle directe sur la plaie avec un linge propre. Surélévation du membre. Pansement compressif. Garrot en dernier recours si hémorragie massive non contrôlable.', 'Hémorragie', 'C'],
        ['Conduite en cas d\'intoxication', 'Ne pas faire vomir. Recueillir un échantillon du toxique (contenant, plante). Noter l\'heure de l\'ingestion. Appeler le centre antipoison. Amener le patient aux urgences.', 'Intoxication', 'C'],
        ['Prise en charge des brûlures', 'Refroidir sous l\'eau tiède (15-25°C) pendant 15-20 min. Retirer les vêtements non adhérents. Couvrir d\'un linge propre et humide. Ne pas percer les cloques.', 'Brûlure', 'E'],
        ['Premiers soins en cas de traumatisme', 'Immobiliser le membre fracturé sans le déplacer. Glace sur les zones douloureuses. Éviter de faire marcher le blessé. Transport en position adaptée au type de traumatisme.', 'Traumatisme', 'E'],
        ['Prévention des urgences vitales', 'Formation aux gestes de premiers secours (PSC1). Détecteurs de fumée et de CO. Rangements des médicaments et produits ménagers hors de portée. Trousse de secours à jour.', 'Prévention', 'F'],
    ],
];

$templates['ORL et ophtalmologie'] = [
    'desc' => $templates['_default']['desc'],
    'sympt' => $templates['_default']['sympt'],
    'cause' => $templates['_default']['cause'],
    'prec' => $templates['_default']['prec'],
    'treat' => $templates['_default']['treat'],
    'ps' => [
        ['Soins d\'hygiène ORL', 'Nettoyage du nez au sérum physiologique. Éviter les cotons-tiges dans le conduit auditif. Gargarismes à l\'eau salée en cas de mal de gorge. Humidifier l\'air ambiant.', 'Hygiène ORL', 'M'],
        ['Gestion de la douleur ORL', 'Antalgiques (paracétamol). Décongestionnants nasaux sur courte durée. Gouttes auriculaires si otite externe. Consulter si douleur intense ou persistante.', 'Douleur ORL', 'M'],
        ['Conduite en cas de corps étranger', 'Ne pas essayer de retirer avec un coton-tige. Pencer la tête du côté atteint. Ne pas instiller de liquide. Consulter aux urgences ORL. Si inhalation : manœuvre de Heimlich.', 'Corps étranger', 'C'],
        ['Surveillance des signes ORL de gravité', 'Consulter en urgence si : fièvre élevée, otalgie sévère, surdité brutale, vertige rotatoire, dysphonie brutale, dyspnée laryngée, épistaxis postérieure incoercible.', 'Signes gravité ORL', 'C'],
        ['Soins oculaires quotidiens', 'Hygiène des paupières au sérum physiologique. Application correcte des collyres (1 goutte, canthus interne). Ne pas toucher l\'œil avec l\'embout. Respecter les dates de péremption.', 'Hygiène oculaire', 'M'],
        ['Conduite en cas d\'accident oculaire', 'Ne pas frotter l\'œil. Rinçage abondant au sérum physiologique (15 min) si projection chimique. Pansement occlusif sans exercer de pression. Consulter aux urgences ophtalmologiques.', 'Traumatisme oculaire', 'C'],
        ['Prévention des troubles visuels', 'Examen ophtalmologique annuel après 40 ans. Port de lunettes de protection en cas d\'exposition. Dépistage du glaucome et de la cataracte. Surveillance de la rétine si diabète.', 'Prévention visuelle', 'M'],
        ['Rééducation et appareillage', 'Port régulier des aides auditives ou visuelles. Nettoyage et entretien des appareils. Consultation ORL et audioprothésiste pour ajustement. Rééducation orthophonique si trouble du langage.', 'Appareillage', 'M'],
    ],
];

$templates['Maladies auto-immunes et systémiques'] = [
    'desc' => $templates['_default']['desc'],
    'sympt' => $templates['_default']['sympt'],
    'cause' => $templates['_default']['cause'],
    'prec' => $templates['_default']['prec'],
    'treat' => $templates['_default']['treat'],
    'ps' => [
        ['Surveillance des poussées', 'Identifier les signes précoces de poussée (fièvre, douleurs articulaires, éruption cutanée, fatigue intense). Tenir un journal des symptômes. Consulter rapidement en cas de poussée.', 'Poussée inflammatoire', 'E'],
        ['Observance du traitement immunosuppresseur', 'Prendre le traitement à heures fixes. Ne jamais arrêter brutalement. Surveillance de la numération formule sanguine et de la fonction rénale/hépatique régulière.', 'Immunosuppresseurs', 'C'],
        ['Prévention des infections sous immunosuppresseurs', 'Vaccinations à jour (hors vaccins vivants). Éviter les contacts avec personnes malades. Lavage des mains fréquent. Surveiller la fièvre. Consulter rapidement si signes infectieux.', 'Prévention infections', 'M'],
        ['Photoprotection stricte', 'Éviter l\'exposition solaire. Crème solaire 50+ systématique. Vêtements protecteurs. Éviter les UV artificiels. Le soleil peut déclencher ou aggraver les poussées lupiques.', 'Photosensibilité', 'M'],
        ['Gestion de la fatigue chronique', 'Repos régulier. Équilibrer activité et repos. Micro-siestes si nécessaire. Activité physique adaptée et régulière. Soutien psychologique si retentissement important.', 'Fatigue chronique', 'M'],
        ['Surveillance des effets secondaires', 'Corticothérapie : surveillance poids, TA, glycémie, densité osseuse. Hydroxychloroquine : bilan ophtalmologique annuel. Biothérapies : surveillance des réactions à l\'injection.', 'Effets secondaires', 'M'],
        ['Prise en charge pluridisciplinaire', 'Coordination entre rhumatologue, interniste, dermatologue, néphrologue selon atteintes. Kinésithérapie si atteinte articulaire. Diététique si nécessaire. Soutien psychologique.', 'Suivi spécialisé', 'M'],
        ['Information et éducation thérapeutique', 'Connaître sa maladie et ses traitements. Savoir reconnaître les signes d\'alerte. Adapter son mode de vie. Participer à des groupes de patients. Plan d\'action personnalisé écrit.', 'Autonomie patient', 'F'],
    ],
];

// Generate full content for each disease
$generatePs = function($templates, $catName, $catTpl, $diseaseGravity) use ($ps, $urgMap) {
    // Tiered selection: each disease severity gets a weighted distribution
    // of first-aid urgency levels, expanding to adjacent tiers if needed
    $tiers = [
        'LÉGÈRE'  => [['F','M'], ['E'],     ['C']],
        'MODÉRÉE' => [['M','E'], ['C'],     ['F']],
        'SÉVÈRE'  => [['E','C'], ['M'],     ['F']],
        'CRITIQUE' => [['C','E'], ['M'],    ['F']],
        'VARIABLE' => [['M','E'], ['C','F'], []],
    ];
    $sel = $tiers[$diseaseGravity] ?? [['M','E'], ['C'], ['F']];
    $tpl = $catTpl['ps'] ?? $templates['_default']['ps'];
    
    $result = [];
    // Tier 1 (primary): pick 3-4 steps from first-choice urgency codes
    $t1 = array_values(array_filter($tpl, fn($s) => in_array($s[3], $sel[0])));
    shuffle($t1);
    $take1 = min(count($t1), mt_rand(3, 4));
    for ($i = 0; $i < $take1; $i++) $result[] = $t1[$i];
    
    // Tier 2 (secondary): pick 1-2 steps from second-choice urgency codes
    if (count($sel[1]) > 0 && count($result) < 5) {
        $t2 = array_values(array_filter($tpl, fn($s) => in_array($s[3], $sel[1])));
        shuffle($t2);
        $take2 = min(count($t2), mt_rand(1, 2), 5 - count($result));
        for ($i = 0; $i < $take2; $i++) $result[] = $t2[$i];
    }
    
    // Tier 3 (fallback): if still < 5, use any remaining steps
    if (count($result) < 5) {
        $used = array_map(fn($r) => $r[0].$r[1], $result);
        $remaining = array_values(array_filter($tpl, fn($s) => !in_array($s[0].$s[1], $used)));
        shuffle($remaining);
        $take3 = min(count($remaining), 5 - count($result));
        for ($i = 0; $i < $take3; $i++) $result[] = $remaining[$i];
    }
    
    // Build output with professional instructions
    $out = [];
    foreach ($result as $step) {
        $desc = $step[1];
        $code = $step[3];
        $desc .= ' Si les symptômes persistent après 48 heures de traitement, consulter un médecin.';
        if ($code === 'C') {
            $desc .= ' ATTENTION : Situation d\'urgence vitale. Prodiquer les premiers soins décrits, appeler immédiatement les secours (119 SAMU / 118 Pompiers) ou se rendre sans délai au service des urgences le plus proche.';
        } elseif ($code === 'E') {
            $desc .= ' Urgence relative : si la détérioration s\'accélère, ne pas hésiter à se rendre aux urgences.';
        }
        $out[] = $ps($step[0], $desc, $step[2], $urgMap[$code] ?? 'MOYEN');
    }
    return $out;
};

$generateContent = function($disease, $templates) use ($pick, $sevMap) {
    $cat = $disease['categorie'];
    $tpl = $templates[$cat] ?? $templates['_default'];
    $name = $disease['nom'];
    
    // Populate tokens
    $type = $pick(['légère', 'modérée', 'sévère', 'chronique', 'aiguë', 'progressive']);
    $cause = $pick(['une infection', 'une inflammation', 'une dégénérescence', 'un trouble métabolique', 'une anomalie génétique']);
    $organe = $pick(['l\'organe atteint', 'le système concerné', 'la région touchée', 'la structure affectée']);
    $population = $pick(['les adultes', 'les enfants', 'les personnes âgées', 'les immunodéprimés', 'la population générale']);
    
    $desc = str_replace(['%TYPE%', '%CAUSE%', '%ORGANE%', '%POPULATION%'], [$type, $cause, $organe, $population], $pick($tpl['desc']));
    $sympt = $pick($tpl['sympt']);
    $cause_text = $pick($tpl['cause'] ?? $templates['_default']['cause']);
    $prec = $pick($tpl['prec'] ?? $templates['_default']['prec']);
    $trait = $pick($tpl['trait'] ?? $templates['_default']['treat']);
    
    return [$desc, $sympt, $cause_text, $prec, $trait];
};

// Generate all disease entries
echo "Generating detailed content for " . count($d) . " diseases...\n";

$diseases = [];
foreach ($d as $i => $de) {
    list($desc, $sympt, $cause, $prec, $trait) = $generateContent($de, $templates);
    $catTpl = $templates[$de['categorie']] ?? $templates['_default'];
    $firstAid = $generatePs($templates, $de['categorie'], $catTpl, $de['niveauGravite']);
    
    $diseases[] = [
        'nom' => $de['nom'],
        'categorie' => $de['categorie'],
        'description' => $desc,
        'symptomes' => $sympt,
        'causes' => $cause,
        'precautions' => $prec,
        'traitement' => $trait,
        'niveauGravite' => $de['niveauGravite'],
        'contagieux' => $de['contagieux'],
        'urgence' => $de['urgence'],
        'isAccident' => $de['isAccident'],
        'imageUrl' => '',
        'premiersSoins' => $firstAid,
    ];
    
    if (($i + 1) % 200 === 0) echo "  " . ($i + 1) . " diseases generated...\n";
}

// Normalize niveauGravite (ensure proper French)
$gravityMap = [
    'SEVERE' => 'SÉVÈRE', 'MODEREE' => 'MODÉRÉE', 'LEGERE' => 'LÉGÈRE',
    'ELEVE' => 'SÉVÈRE', 'SÉVÈRE' => 'SÉVÈRE', 'MODÉRÉE' => 'MODÉRÉE',
    'LÉGÈRE' => 'LÉGÈRE', 'CRITIQUE' => 'CRITIQUE', 'VARIABLE' => 'VARIABLE',
];
foreach ($diseases as &$dis) {
    $g = $dis['niveauGravite'];
    $dis['niveauGravite'] = $gravityMap[$g] ?? 'MODÉRÉE';
    foreach ($dis['premiersSoins'] as &$psItem) {
        $u = $psItem['niveauUrgence'];
        $psItem['niveauUrgence'] = $gravityMap[$u] ?? ($u === 'ELEVE' ? 'ÉLEVÉ' : ($u === 'ÉLEVÉ' ? 'ÉLEVÉ' : $u));
    }
}
unset($dis, $psItem);

// Write JSON
$json = json_encode($diseases, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
file_put_contents(__DIR__ . '/maladies.json', $json);

echo "\n✓ Generated " . count($diseases) . " diseases.\n";
echo "  File: " . __DIR__ . "/maladies.json\n";

// Statistics
$cats = [];
foreach ($diseases as $dis) {
    $cats[$dis['categorie']] = ($cats[$dis['categorie']] ?? 0) + 1;
}
echo "\nBreakdown by category:\n";
foreach ($cats as $name => $count) {
    printf("  %-40s %3d\n", $name, $count);
}

// Verify unique values
$gravities = [];
$urgencies = [];
foreach ($diseases as $dis) {
    $gravities[$dis['niveauGravite']] = true;
    foreach ($dis['premiersSoins'] as $ps) {
        $urgencies[$ps['niveauUrgence']] = true;
    }
}
$totalPs = 0;
foreach ($diseases as $dis) $totalPs += count($dis['premiersSoins']);
echo "\nGravity values: " . implode(', ', array_keys($gravities)) . "\n";
echo "Urgency values: " . implode(', ', array_keys($urgencies)) . "\n";
echo "Total premiers soins entries: $totalPs\n";
