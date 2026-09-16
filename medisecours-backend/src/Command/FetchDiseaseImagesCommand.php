<?php

namespace App\Command;

use App\Entity\Maladie;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:fetch-disease-images',
    description: 'Récupère les images des maladies depuis Wikipédia français (par lots de 50).'
)]
class FetchDiseaseImagesCommand extends Command
{
    private const API_URL = 'https://fr.wikipedia.org/w/api.php';

    // Known mapping: disease name prefix -> French Wikipedia article title
    private const KNOWN_TITLES = [
        'Paludisme' => 'Paludisme',
        'Tuberculose' => 'Tuberculose',
        'Infection aiguë par le VIH' => 'Syndrome d\'immunodéficience acquise',
        'VIH' => 'Syndrome d\'immunodéficience acquise',
        'SIDA' => 'Syndrome d\'immunodéficience acquise',
        'Cachexie liée au VIH' => 'Syndrome d\'immunodéficience acquise',
        'Hépatite aiguë A' => 'Hépatite A',
        'Hépatite aiguë B' => 'Hépatite B',
        'Hépatite chronique B' => 'Hépatite B',
        'Hépatite aiguë C' => 'Hépatite C',
        'Hépatite chronique C' => 'Hépatite C',
        'Hépatite D' => 'Hépatite D',
        'Hépatite E' => 'Hépatite E',
        'Hépatite fulminante' => 'Hépatite',
        'Fièvre jaune' => 'Fièvre jaune',
        'Dengue' => 'Dengue',
        'Chikungunya' => 'Chikungunya',
        'Infection à virus Zika' => 'Virus Zika',
        'Fièvre de la Vallée du Rift' => 'Fièvre de la vallée du Rift',
        'Fièvre hémorragique de Crimée-Congo' => 'Fièvre hémorragique de Crimée-Congo',
        'Encéphalite à West Nile' => 'Virus West Nile',
        'Maladie à virus Ebola' => 'Maladie à virus Ebola',
        'Maladie à virus Marburg' => 'Virus Marburg',
        'Fièvre de Lassa' => 'Fièvre de Lassa',
        'Rage' => 'Rage',
        'Herpès labial' => 'Herpès labial',
        'Herpès génital' => 'Herpès génital',
        'Kératite herpétique' => 'Kératite',
        'Encéphalite herpétique' => 'Encéphalite',
        'Varicelle' => 'Varicelle',
        'Zona' => 'Zona',
        'Rougeole' => 'Rougeole',
        'Rubéole' => 'Rubéole',
        'Oreillons' => 'Oreillons',
        'Coqueluche' => 'Coqueluche',
        'Scarlatine' => 'Scarlatine',
        'Diphtérie' => 'Diphtérie',
        'Tétanos' => 'Tétanos',
        'Fièvre typhoïde' => 'Fièvre typhoïde',
        'Paratyphoïde' => 'Paratyphoïde',
        'Shigellose' => 'Shigellose',
        'Choléra' => 'Choléra',
        'Gastro-entérite' => 'Gastro-entérite',
        'Botulisme' => 'Botulisme',
        'Listeriose' => 'Listeriose',
        'Brucellose' => 'Brucellose',
        'Leptospirose' => 'Leptospirose',
        'Méningite' => 'Méningite',
        'Streptococcie' => 'Angine streptococcique',
        'Erysipèle' => 'Érysipèle',
        'Impétigo' => 'Impétigo',
        'Furoncle' => 'Furoncle',
        'Charbon' => 'Charbon',
        'Pasteurellose' => 'Pasteurellose',
        'Morve' => 'Morve',
        'Leishmaniose viscérale' => 'Leishmaniose viscérale',
        'Leishmaniose cutanée' => 'Leishmaniose cutanée',
        'Trypanosomiase' => 'Maladie du sommeil',
        'Maladie de Chagas' => 'Maladie de Chagas',
        'Toxoplasmose' => 'Toxoplasmose',
        'Amibiase' => 'Amibiase',
        'Giardiase' => 'Giardiase',
        'Cryptosporidiose' => 'Cryptosporidiose',
        'Schistosomiase' => 'Schistosomiase',
        'Ankylostomiase' => 'Ankylostomiase',
        'Ascaridiose' => 'Ascaridiose',
        'Trichocéphalose' => 'Trichocéphalose',
        'Oxyurose' => 'Oxyurose',
        'Strongyloïdose' => 'Strongyloïdose',
        'Filariose lymphatique' => 'Filariose lymphatique',
        'Onchocercose' => 'Onchocercose',
        'Loa loa' => 'Loa loa',
        'Dracunculose' => 'Dracunculose',
        'Téniasis' => 'Ténia',
        'Cysticercose' => 'Cysticercose',
        'Hydatidose' => 'Hydatidose',
        'Échinococcose alvéolaire' => 'Échinococcose alvéolaire',
        'Distomatose' => 'Distomatose',
        'Paragonimose' => 'Paragonimose',
        'Trichinellose' => 'Trichinellose',
        'Larva migrans' => 'Larva migrans',
        'Gale' => 'Gale',
        'Pédiculose' => 'Pédiculose',
        'Phtiriase' => 'Phtiriase',
        'Punaises de lit' => 'Punaise de lit',
        'Myiase' => 'Myiase',
        'Tungose' => 'Tungose',
        'Sporotrichose' => 'Sporotrichose',
        'Chromomycose' => 'Chromomycose',
        'Mycétome' => 'Mycétome',
        'Histoplasmose' => 'Histoplasmose',
        'Coccidioïdomycose' => 'Coccidioïdomycose',
        'Paracoccidioïdomycose' => 'Paracoccidioïdomycose',
        'Aspergillose' => 'Aspergillose',
        'Aspergillome' => 'Aspergillome',
        'Cryptococcose' => 'Cryptococcose',
        'Candidose buccale' => 'Candidose buccale',
        'Candidose vaginale' => 'Candidose vaginale',
        'Candidose' => 'Candidose',
        'Carcinome hépatocellulaire' => 'Carcinome hépatocellulaire',
        'Cholangiocarcinome' => 'Cholangiocarcinome',
        'Cancer du sein' => 'Cancer du sein',
        'Cancer du col de l\'utérus' => 'Cancer du col de l\'utérus',
        'Cancer de l\'endomètre' => 'Cancer de l\'endomètre',
        'Cancer de l\'ovaire' => 'Cancer de l\'ovaire',
        'Cancer du poumon' => 'Cancer du poumon',
        'Adénocarcinome pulmonaire' => 'Cancer du poumon',
        'Carcinome épidermoïde pulmonaire' => 'Cancer du poumon',
        'Cancer colorectal' => 'Cancer colorectal',
        'Cancer du rectum' => 'Cancer colorectal',
        'Cancer de l\'estomac' => 'Cancer de l\'estomac',
        'Cancer de l\'oesophage' => 'Cancer de l\'œsophage',
        'Cancer du pancréas' => 'Cancer du pancréas',
        'Cancer de la prostate' => 'Cancer de la prostate',
        'Cancer du rein' => 'Cancer du rein',
        'Cancer de la vessie' => 'Cancer de la vessie',
        'Cancer de la thyroïde' => 'Cancer de la thyroïde',
        'Mélanome' => 'Mélanome',
        'Carcinome basocellulaire' => 'Carcinome basocellulaire',
        'Carcinome spinocellulaire' => 'Carcinome spinocellulaire',
        'Lymphome de Hodgkin' => 'Lymphome de Hodgkin',
        'Lymphome B diffus' => 'Lymphome B diffus à grandes cellules',
        'Lymphome folliculaire' => 'Lymphome folliculaire',
        'Lymphome de Burkitt' => 'Lymphome de Burkitt',
        'Lymphome T cutané' => 'Lymphome T cutané',
        'Leucémie lymphoïde chronique' => 'Leucémie lymphoïde chronique',
        'Leucémie myéloïde chronique' => 'Leucémie myéloïde chronique',
        'Leucémie aiguë lymphoblastique' => 'Leucémie aiguë lymphoblastique',
        'Leucémie aiguë myéloblastique' => 'Leucémie aiguë myéloblastique',
        'Myélome multiple' => 'Myélome multiple',
        'Glioblastome' => 'Glioblastome',
        'Astrocytome' => 'Astrocytome',
        'Méningiome' => 'Méningiome',
        'Schwannome' => 'Schwannome',
        'Adénome hypophysaire' => 'Adénome hypophysaire',
        'Neuroblastome' => 'Neuroblastome',
        'Rétinoblastome' => 'Rétinoblastome',
        'Néphroblastome' => 'Néphroblastome',
        'Hépatoblastome' => 'Hépatoblastome',
        'Sarcome ostéogénique' => 'Ostéosarcome',
        'Sarcome d\'Ewing' => 'Sarcome d\'Ewing',
        'Rhabdomyosarcome' => 'Rhabdomyosarcome',
        'Liposarcome' => 'Liposarcome',
        'Fibrosarcome' => 'Fibrosarcome',
        'Tumeur germinale' => 'Tumeur germinale',
        'Drépanocytose' => 'Drépanocytose',
        'Anémie falciforme' => 'Drépanocytose',
        'Thalassémie' => 'Thalassémie',
        'Anémie ferriprive' => 'Anémie ferriprive',
        'Anémie par carence en folates' => 'Anémie',
        'Anémie par carence en vitamine B12' => 'Anémie pernicieuse',
        'Anémie hémolytique' => 'Anémie hémolytique',
        'Anémie aplasique' => 'Anémie aplasique',
        'Anémie sidéroblastique' => 'Anémie sidéroblastique',
        'Syndrome myélodysplasique' => 'Syndrome myélodysplasique',
        'Thrombopénie' => 'Thrombopénie',
        'Purpura thrombopénique thrombotique' => 'Purpura thrombopénique thrombotique',
        'Syndrome hémolytique et urémique' => 'Syndrome hémolytique et urémique',
        'Hémophilie' => 'Hémophilie',
        'Maladie de Willebrand' => 'Maladie de Willebrand',
        'Déficit en vitamine K' => 'Vitamine K',
        'Coagulation intravasculaire disséminée' => 'Coagulation intravasculaire disséminée',
        'Polyglobulie' => 'Polyglobulie',
        'Thrombocytémie essentielle' => 'Thrombocytémie essentielle',
        'Agranulocytose' => 'Agranulocytose',
        'Histiocytose à cellules de Langerhans' => 'Histiocytose à cellules de Langerhans',
        'Diabète de type 1' => 'Diabète de type 1',
        'Diabète de type 2' => 'Diabète de type 2',
        'Diabète gestationnel' => 'Diabète gestationnel',
        'Acidocétose diabétique' => 'Acidocétose diabétique',
        'Coma hyperosmolaire' => 'Coma diabétique',
        'Hypoglycémie' => 'Hypoglycémie',
        'Hypothyroïdie' => 'Hypothyroïdie',
        'Thyroïdite de Hashimoto' => 'Thyroïdite de Hashimoto',
        'Thyroïdite de De Quervain' => 'Thyroïdite',
        'Hyperthyroïdie' => 'Hyperthyroïdie',
        'Goitre' => 'Goitre',
        'Crise thyrotoxique' => 'Thyrotoxicose',
        'Myxoedème' => 'Myxœdème',
        'Coma myxoédémateux' => 'Myxœdème',
        'Syndrome de Cushing' => 'Syndrome de Cushing',
        'Insuffisance surrénale aiguë' => 'Insuffisance surrénale',
        'Insuffisance surrénale chronique' => 'Maladie d\'Addison',
        'Hyperaldostéronisme' => 'Hyperaldostéronisme',
        'Phéochromocytome' => 'Phéochromocytome',
        'Hyperparathyroïdie' => 'Hyperparathyroïdie',
        'Hypoparathyroïdie' => 'Hypoparathyroïdie',
        'Acromégalie' => 'Acromégalie',
        'Gigantisme' => 'Gigantisme',
        'Nanisme' => 'Nanisme',
        'Diabète insipide' => 'Diabète insipide',
        'SIADH' => 'Syndrome de sécrétion inappropriée d\'hormone antidiurétique',
        'Hyperprolactinémie' => 'Hyperprolactinémie',
        'Hypogonadisme' => 'Hypogonadisme',
        'Syndrome des ovaires polykystiques' => 'Syndrome des ovaires polykystiques',
        'Obésité' => 'Obésité',
        'Syndrome métabolique' => 'Syndrome métabolique',
        'Goutte' => 'Goutte',
        'Crise de goutte' => 'Goutte',
        'Hypercholestérolémie' => 'Hypercholestérolémie',
        'Hypertriglycéridémie' => 'Hypertriglycéridémie',
        'Phénylcétonurie' => 'Phénylcétonurie',
        'Galactosémie' => 'Galactosémie',
        'Maladie de Wilson' => 'Maladie de Wilson',
        'Hémochromatose' => 'Hémochromatose',
        'Porphyrie' => 'Porphyrie',
        'Mucoviscidose' => 'Mucoviscidose',
        'Dépression' => 'Dépression',
        'Trouble dépressif' => 'Dépression',
        'Dysthymie' => 'Dysthymie',
        'Trouble bipolaire' => 'Trouble bipolaire',
        'Épisode maniaque' => 'Trouble bipolaire',
        'Épisode hypomaniaque' => 'Trouble bipolaire',
        'Trouble anxieux' => 'Trouble anxieux',
        'Trouble panique' => 'Trouble panique',
        'Agoraphobie' => 'Agoraphobie',
        'Phobie sociale' => 'Phobie sociale',
        'Phobie spécifique' => 'Phobie',
        'Trouble obsessionnel compulsif' => 'Trouble obsessionnel compulsif',
        'État de stress post-traumatique' => 'État de stress post-traumatique',
        'Trouble de l\'adaptation' => 'Trouble de l\'adaptation',
        'Schizophrénie' => 'Schizophrénie',
        'Trouble schizo-affectif' => 'Trouble schizo-affectif',
        'Trouble délirant' => 'Trouble délirant',
        'Psychose' => 'Psychose',
        'Trouble borderline' => 'Trouble borderline',
        'Trouble antisocial' => 'Trouble de la personnalité antisociale',
        'Trouble narcissique' => 'Trouble narcissique',
        'Alcoolisme' => 'Alcoolisme',
        'Sevrage alcoolique' => 'Sevrage alcoolique',
        'Delirium tremens' => 'Delirium tremens',
        'Syndrome de Korsakoff' => 'Syndrome de Korsakoff',
        'Dépendance aux opiacés' => 'Opiacé',
        'Dépendance au cannabis' => 'Cannabis',
        'Dépendance à la cocaïne' => 'Cocaïne',
        'Anorexie mentale' => 'Anorexie mentale',
        'Boulimie' => 'Boulimie',
        'Hyperphagie boulimique' => 'Hyperphagie boulimique',
        'Insomnie' => 'Insomnie',
        'Narcolepsie' => 'Narcolepsie',
        'TDAH' => 'Trouble du déficit de l\'attention avec ou sans hyperactivité',
        'Syndrome de Gilles de la Tourette' => 'Syndrome de Gilles de la Tourette',
        'Trouble du spectre autistique' => 'Trouble du spectre de l\'autisme',
        'Trouble d\'Asperger' => 'Syndrome d\'Asperger',
        'Accident vasculaire cérébral' => 'Accident vasculaire cérébral',
        'AVC' => 'Accident vasculaire cérébral',
        'Accident ischémique transitoire' => 'Accident ischémique transitoire',
        'Hémorragie intracérébrale' => 'Hémorragie intracérébrale',
        'Hémorragie sous-arachnoïdienne' => 'Hémorragie sous-arachnoïdienne',
        'Anévrisme cérébral' => 'Anévrisme',
        'Migraine' => 'Migraine',
        'Céphalée de tension' => 'Céphalée de tension',
        'Algie vasculaire' => 'Algie vasculaire de la face',
        'Névralgie du trijumeau' => 'Névralgie du trijumeau',
        'Paralysie faciale' => 'Paralysie faciale a frigore',
        'Névrite optique' => 'Névrite optique',
        'Neuropathie diabétique' => 'Neuropathie diabétique',
        'Polyneuropathie' => 'Polyneuropathie',
        'Syndrome du canal carpien' => 'Syndrome du canal carpien',
        'Syndrome de Guillain-Barré' => 'Syndrome de Guillain-Barré',
        'Myasthénie' => 'Myasthénie',
        'Épilepsie' => 'Épilepsie',
        'État de mal épileptique' => 'État de mal épileptique',
        'Convulsions fébriles' => 'Convulsion fébrile',
        'Maladie de Parkinson' => 'Maladie de Parkinson',
        'Syndrome parkinsonien' => 'Syndrome parkinsonien',
        'Dystonie' => 'Dystonie',
        'Blépharospasme' => 'Blépharospasme',
        'Tremblement essentiel' => 'Tremblement essentiel',
        'Chorée de Huntington' => 'Chorée de Huntington',
        'Ataxie' => 'Ataxie',
        'Sclérose en plaques' => 'Sclérose en plaques',
        'Neuromyélite optique' => 'Neuromyélite optique',
        'Sclérose latérale amyotrophique' => 'Sclérose latérale amyotrophique',
        'Démence à corps de Lewy' => 'Démence à corps de Lewy',
        'Maladie d\'Alzheimer' => 'Maladie d\'Alzheimer',
        'Démence vasculaire' => 'Démence vasculaire',
        'Démence fronto-temporale' => 'Démence fronto-temporale',
        'Hydrocéphalie' => 'Hydrocéphalie',
        'Syndrome de la queue de cheval' => 'Queue de cheval',
        'Abcès cérébral' => 'Abcès cérébral',
        'Neuropaludisme' => 'Paludisme',
        'Hypertension artérielle' => 'Hypertension artérielle',
        'Urgence hypertensive' => 'Hypertension artérielle',
        'Crise hypertensive' => 'Hypertension artérielle',
        'Insuffisance cardiaque' => 'Insuffisance cardiaque',
        'Cardiomyopathie' => 'Cardiomyopathie',
        'Infarctus du myocarde' => 'Infarctus du myocarde',
        'Syndrome coronarien aigu' => 'Syndrome coronarien aigu',
        'Angor' => 'Angine de poitrine',
        'Fibrillation atriale' => 'Fibrillation atriale',
        'Flutter atrial' => 'Flutter atrial',
        'Tachycardie supraventriculaire' => 'Tachycardie supraventriculaire',
        'Syndrome de Wolff-Parkinson-White' => 'Syndrome de Wolff-Parkinson-White',
        'Tachycardie ventriculaire' => 'Tachycardie ventriculaire',
        'Fibrillation ventriculaire' => 'Fibrillation ventriculaire',
        'Bloc auriculo-ventriculaire' => 'Bloc auriculo-ventriculaire',
        'Sténose mitrale' => 'Sténose mitrale',
        'Insuffisance mitrale' => 'Insuffisance mitrale',
        'Prolapsus valvulaire mitral' => 'Prolapsus valvulaire mitral',
        'Sténose aortique' => 'Sténose aortique',
        'Insuffisance aortique' => 'Insuffisance aortique',
        'Endocardite infectieuse' => 'Endocardite infectieuse',
        'Péricardite' => 'Péricardite',
        'Tamponnade cardiaque' => 'Tamponnade cardiaque',
        'Myocardite' => 'Myocardite',
        'Dissection aortique' => 'Dissection aortique',
        'Anévrisme de l\'aorte abdominale' => 'Anévrisme de l\'aorte abdominale',
        'Anévrisme de l\'aorte thoracique' => 'Anévrisme de l\'aorte',
        'Artérite de Takayasu' => 'Artérite de Takayasu',
        'Artérite temporale' => 'Artérite temporale',
        'Artérite des membres inférieurs' => 'Artériopathie oblitérante des membres inférieurs',
        'Thrombose veineuse profonde' => 'Thrombose veineuse profonde',
        'Embolie pulmonaire' => 'Embolie pulmonaire',
        'Phlébite' => 'Phlébite',
        'Insuffisance veineuse' => 'Insuffisance veineuse',
        'Varices oesophagiennes' => 'Varice œsophagienne',
        'Varices des membres inférieurs' => 'Varice',
        'Cœur pulmonaire' => 'Cœur pulmonaire',
        'Hypertension artérielle pulmonaire' => 'Hypertension artérielle pulmonaire',
        'Syndrome de Marfan' => 'Syndrome de Marfan',
        'Communication inter-ventriculaire' => 'Communication inter-ventriculaire',
        'Communication inter-auriculaire' => 'Communication inter-auriculaire',
        'Tétralogie de Fallot' => 'Tétralogie de Fallot',
        'Coarctation aortique' => 'Coarctation aortique',
        'Canal artériel' => 'Canal artériel',
        'Syncope' => 'Syncope',
        'Mort subite' => 'Mort subite',
        'Pneumonie' => 'Pneumonie',
        'Bronchiolite' => 'Bronchiolite',
        'Bronchite' => 'Bronchite',
        'BPCO' => 'Bronchopneumopathie chronique obstructive',
        'Emphysème' => 'Emphysème',
        'Asthme' => 'Asthme',
        'Bronchectasie' => 'Bronchectasie',
        'Fibrose pulmonaire' => 'Fibrose pulmonaire',
        'Sarcoïdose' => 'Sarcoïdose',
        'Pneumoconiose' => 'Pneumoconiose',
        'Amiantose' => 'Amiantose',
        'Pneumothorax' => 'Pneumothorax',
        'Épanchement pleural' => 'Épanchement pleural',
        'Pleurésie purulente' => 'Empyème',
        'Abcès pulmonaire' => 'Abcès pulmonaire',
        'Syndrome de détresse respiratoire aiguë' => 'Syndrome de détresse respiratoire aiguë',
        'Œdème aigu du poumon' => 'Œdème aigu du poumon',
        'Hémoptysie' => 'Hémoptysie',
        'Légionellose' => 'Légionellose',
        'Syndrome d\'apnée du sommeil' => 'Syndrome d\'apnée du sommeil',
        'Maladie de Crohn' => 'Maladie de Crohn',
        'Rectocolite hémorragique' => 'Rectocolite hémorragique',
        'Colite' => 'Colite',
        'Maladie coeliaque' => 'Maladie cœliaque',
        'Appendicite' => 'Appendicite',
        'Péritonite' => 'Péritonite',
        'Diverticulite' => 'Diverticulite',
        'Occlusion intestinale' => 'Occlusion intestinale',
        'Volvulus' => 'Volvulus',
        'Invagination intestinale' => 'Invagination intestinale',
        'Hémorroïdes' => 'Hémorroïde',
        'Fissure anale' => 'Fissure anale',
        'Fistule anale' => 'Fistule anale',
        'Abcès péri-anal' => 'Abcès',
        'Reflux gastro-oesophagien' => 'Reflux gastro-œsophagien',
        'Oesophagite' => 'Œsophagite',
        'Ulcère gastrique' => 'Ulcère gastrique',
        'Ulcère duodénal' => 'Ulcère duodénal',
        'Gastrite' => 'Gastrite',
        'Lithiase vésiculaire' => 'Lithiase biliaire',
        'Cholécystite' => 'Cholécystite',
        'Angiocholite' => 'Angiocholite',
        'Pancréatite aiguë' => 'Pancréatite aiguë',
        'Pancréatite chronique' => 'Pancréatite chronique',
        'Stéatose hépatique' => 'Stéatose hépatique',
        'Cirrhose' => 'Cirrhose',
        'Hépatite alcoolique' => 'Hépatite alcoolique',
        'Insuffisance hépatique' => 'Insuffisance hépatique',
        'Encéphalopathie hépatique' => 'Encéphalopathie hépatique',
        'Syndrome hépatorénal' => 'Syndrome hépatorénal',
        'Abcès hépatique' => 'Abcès hépatique',
        'Angiodysplasie' => 'Angiodysplasie',
        'Polypose adénomateuse familiale' => 'Polypose adénomateuse familiale',
        'Dermatite atopique' => 'Dermatite atopique',
        'Eczéma' => 'Eczéma',
        'Dermatite séborrhéique' => 'Dermatite séborrhéique',
        'Psoriasis' => 'Psoriasis',
        'Lichen plan' => 'Lichen plan',
        'Pityriasis rosé' => 'Pityriasis rosé',
        'Pityriasis versicolor' => 'Pityriasis versicolor',
        'Urticaire' => 'Urticaire',
        'Angioedème' => 'Angiœdème',
        'Érythème polymorphe' => 'Érythème polymorphe',
        'Syndrome de Stevens-Johnson' => 'Syndrome de Stevens-Johnson',
        'Nécrolyse épidermique toxique' => 'Syndrome de Lyell',
        'Érythème noueux' => 'Érythème noueux',
        'Lupus érythémateux cutané chronique' => 'Lupus érythémateux',
        'Dermatomyosite' => 'Dermatomyosite',
        'Sclérodermie' => 'Sclérodermie',
        'Vitiligo' => 'Vitiligo',
        'Acné' => 'Acné',
        'Rosacée' => 'Rosacée',
        'Folliculite' => 'Folliculite',
        'Anthrax' => 'Anthrax',
        'Hidradénite suppurée' => 'Hidradénite suppurée',
        'Fasciite nécrosante' => 'Fasciite nécrosante',
        'Alopécie' => 'Alopécie',
        'Kyste épidermique' => 'Kyste épidermique',
        'Kyste pilonidal' => 'Kyste pilonidal',
        'Lipome' => 'Lipome',
        'Nævus' => 'Nævus',
        'Maladie de Paget mammaire' => 'Maladie de Paget',
        'Ongle incarné' => 'Ongle incarné',
        'Paronychie' => 'Paronychie',
        'Onychomycose' => 'Onychomycose',
        'Dermatophytie' => 'Dermatophytose',
        'Teigne' => 'Teigne',
        'Polyarthrite rhumatoïde' => 'Polyarthrite rhumatoïde',
        'Gonarthrose' => 'Gonarthrose',
        'Coxarthrose' => 'Coxarthrose',
        'Spondylarthrite ankylosante' => 'Spondylarthrite ankylosante',
        'Rhumatisme psoriasique' => 'Rhumatisme psoriasique',
        'Arthrite réactionnelle' => 'Arthrite réactionnelle',
        'Arthrite juvénile idiopathique' => 'Arthrite juvénile idiopathique',
        'Arthrite septique' => 'Arthrite septique',
        'Lupus érythémateux systémique' => 'Lupus érythémateux disséminé',
        'Lupus érythémateux disséminé' => 'Lupus érythémateux disséminé',
        'Syndrome de Sjögren' => 'Syndrome de Sjögren',
        'Polymyalgie rhumatismale' => 'Polymyalgie rhumatismale',
        'Maladie de Behçet' => 'Maladie de Behçet',
        'Ostéoporose' => 'Ostéoporose',
        'Ostéomalacie' => 'Ostéomalacie',
        'Rachitisme' => 'Rachitisme',
        'Maladie de Paget osseuse' => 'Maladie de Paget',
        'Ostéogénèse imparfaite' => 'Ostéogenèse imparfaite',
        'Ostéochondrite' => 'Ostéochondrite',
        'Nécrose avasculaire' => 'Nécrose avasculaire de la tête fémorale',
        'Syndrome de Raynaud' => 'Syndrome de Raynaud',
        'Bursite' => 'Bursite',
        'Tendinite' => 'Tendinite',
        'Ténosynovite' => 'Ténosynovite',
        'Capsulite rétractile' => 'Capsulite rétractile de l\'épaule',
        'Lombalgie' => 'Lombalgie',
        'Hernie discale' => 'Hernie discale',
        'Sciatique' => 'Sciatique',
        'Fracture vertébrale' => 'Fracture vertébrale',
        'Maladie de Dupuytren' => 'Maladie de Dupuytren',
        'Algodystrophie' => 'Algodystrophie',
        'Fibromyalgie' => 'Fibromyalgie',
        'Ostéomyélite' => 'Ostéomyélite',
        'Insuffisance rénale aiguë' => 'Insuffisance rénale aiguë',
        'Insuffisance rénale chronique' => 'Insuffisance rénale',
        'Insuffisance rénale aiguë obstructive' => 'Insuffisance rénale aiguë',
        'Glomérulonéphrite' => 'Glomérulonéphrite',
        'Syndrome néphrotique' => 'Syndrome néphrotique',
        'Néphropathie diabétique' => 'Néphropathie diabétique',
        'Néphropathie hypertensive' => 'Néphropathie',
        'Néphropathie à IgA' => 'Maladie de Berger',
        'Néphropathie lupique' => 'Lupus érythémateux disséminé',
        'Polykystose rénale' => 'Polykystose rénale',
        'Pyélonéphrite' => 'Pyélonéphrite',
        'Abcès rénal' => 'Abcès rénal',
        'Cystite' => 'Cystite',
        'Urétrite' => 'Urétrite',
        'Prostatite' => 'Prostatite',
        'Hypertrophie bénigne de la prostate' => 'Hypertrophie bénigne de la prostate',
        'Rétention d\'urine' => 'Rétention d\'urine',
        'Colique néphrétique' => 'Colique néphrétique',
        'Lithiase urinaire' => 'Lithiase urinaire',
        'Incontinence urinaire' => 'Incontinence urinaire',
        'Vessie hyperactive' => 'Vessie hyperactive',
        'Hydronéphrose' => 'Hydronéphrose',
        'Reflux vésico-urétéral' => 'Reflux vésico-urétéral',
        'Torsion testiculaire' => 'Torsion testiculaire',
        'Orchi-épididymite' => 'Orchi-épididymite',
        'Hydrocèle' => 'Hydrocèle',
        'Varicocèle' => 'Varicocèle',
        'Phimosis' => 'Phimosis',
        'Grossesse extra-utérine' => 'Grossesse extra-utérine',
        'Placenta praevia' => 'Placenta praevia',
        'Décollement prématuré du placenta' => 'Décollement prématuré du placenta',
        'Pré-éclampsie' => 'Pré-éclampsie',
        'Éclampsie' => 'Éclampsie',
        'Syndrome HELLP' => 'Syndrome HELLP',
        'Chorioamniotite' => 'Chorioamniotite',
        'Accouchement prématuré' => 'Accouchement prématuré',
        'Rupture prématurée des membranes' => 'Rupture prématurée des membranes',
        'Hémorragie du post-partum' => 'Hémorragie du post-partum',
        'Rétention placentaire' => 'Rétention placentaire',
        'Endométrite' => 'Endométrite',
        'Mastite' => 'Mastite',
        'Abcès du sein' => 'Abcès du sein',
        'Embolie amniotique' => 'Embolie amniotique',
        'Souffrance fœtale' => 'Souffrance fœtale',
        'Retard de croissance intra-utérin' => 'Retard de croissance intra-utérin',
        'Macrosomie' => 'Macrosomie',
        'Incompatibilité Rh' => 'Incompatibilité Rh',
        'Cholestase gravidique' => 'Cholestase gravidique',
        'Hyperemesis gravidarum' => 'Hyperemesis gravidarum',
        'Maladie trophoblastique gestationnelle' => 'Maladie trophoblastique gestationnelle',
        'Fibrome utérin' => 'Fibrome utérin',
        'Endométriose' => 'Endométriose',
        'Salpingite' => 'Salpingite',
        'Kyste ovarien' => 'Kyste ovarien',
        'Torsion d\'annexe' => 'Torsion d\'annexe',
        'Prolapsus génital' => 'Prolapsus génital',
        'Ictère néonatal' => 'Ictère néonatal',
        'Infection néonatale' => 'Infection néonatale',
        'Détresse respiratoire néonatale' => 'Détresse respiratoire',
        'Entérocolite ulcéro-nécrosante' => 'Entérocolite ulcéro-nécrosante',
        'Hémorragie intraventriculaire' => 'Hémorragie intraventriculaire',
        'Prématurité' => 'Prématurité',
        'Asphyxie néonatale' => 'Asphyxie néonatale',
        'Trisomie 21' => 'Trisomie 21',
        'Syndrome de Turner' => 'Syndrome de Turner',
        'Spina bifida' => 'Spina bifida',
        'Luxation congénitale de la hanche' => 'Luxation congénitale de la hanche',
        'Pied bot' => 'Pied bot',
        'Fente labio-palatine' => 'Fente labio-palatine',
        'Atrésie de l\'oesophage' => 'Atrésie de l\'œsophage',
        'Sténose hypertrophique du pylore' => 'Sténose hypertrophique du pylore',
        'Convulsions néonatales' => 'Convulsion',
        'Laryngite sous-glottique' => 'Laryngite',
        'Laryngite aiguë' => 'Laryngite',
        'Épiglottite' => 'Épiglottite',
        'Malnutrition' => 'Malnutrition',
        'Kwashiorkor' => 'Kwashiorkor',
        'Syndrome de mort subite du nourrisson' => 'Mort subite du nourrisson',
        'Allergie alimentaire' => 'Allergie alimentaire',
        'Arrêt cardio-respiratoire' => 'Arrêt cardio-respiratoire',
        'Choc hypovolémique' => 'Choc hypovolémique',
        'Choc septique' => 'Choc septique',
        'Choc anaphylactique' => 'Choc anaphylactique',
        'Choc cardiogénique' => 'Choc cardiogénique',
        'Traumatisme crânien' => 'Traumatisme crânien',
        'Hématome extra-dural' => 'Hématome extra-dural',
        'Hématome sous-dural' => 'Hématome sous-dural',
        'Fracture de la base du crâne' => 'Fracture du crâne',
        'Polytraumatisme' => 'Polytraumatisme',
        'Brûlure' => 'Brûlure',
        'Noyade' => 'Noyade',
        'Asphyxie' => 'Asphyxie',
        'Intoxication au monoxyde de carbone' => 'Intoxication au monoxyde de carbone',
        'Intoxication médicamenteuse' => 'Intoxication',
        'Intoxication à l\'alcool' => 'Alcoolisation aiguë',
        'Intoxication aux organophosphorés' => 'Pesticide',
        'Intoxication au cyanure' => 'Cyanure',
        'Intoxication au paracétamol' => 'Paracétamol',
        'Envenimation' => 'Morsure de serpent',
        'Piqûre de scorpion' => 'Scorpion',
        'Morsure de chien' => 'Morsure',
        'Hypothermie' => 'Hypothermie',
        'Hyperthermie maligne' => 'Hyperthermie maligne',
        'Coup de chaleur' => 'Coup de chaleur',
        'Gelure' => 'Gelure',
        'Electrocution' => 'Électrocution',
        'Mal aigu des montagnes' => 'Mal aigu des montagnes',
        'Œdème de haute altitude' => 'Œdème de haute altitude',
        'Otite moyenne' => 'Otite moyenne',
        'Otite externe' => 'Otite externe',
        'Mastoïdite' => 'Mastoïdite',
        'Perforation tympanique' => 'Perforation tympanique',
        'Surdité' => 'Surdité',
        'Presbyacousie' => 'Presbyacousie',
        'Acouphènes' => 'Acouphène',
        'Vertige positionnel paroxystique bénin' => 'Vertige positionnel paroxystique bénin',
        'Névrite vestibulaire' => 'Névrite vestibulaire',
        'Maladie de Ménière' => 'Maladie de Ménière',
        'Sinusite' => 'Sinusite',
        'Polypose nasale' => 'Polypose nasale',
        'Rhinite allergique' => 'Rhinite allergique',
        'Épistaxis' => 'Épistaxis',
        'Amygdalite' => 'Amygdalite',
        'Pharyngite' => 'Pharyngite',
        'Dysphonie' => 'Dysphonie',
        'Conjonctivite' => 'Conjonctivite',
        'Kératite bactérienne' => 'Kératite',
        'Ulcère cornéen' => 'Ulcère cornéen',
        'Orgelet' => 'Orgelet',
        'Chalazion' => 'Chalazion',
        'Dacryocystite' => 'Dacryocystite',
        'Glaucome' => 'Glaucome',
        'Cataracte' => 'Cataracte',
        'Rétinopathie diabétique' => 'Rétinopathie diabétique',
        'Dégénérescence maculaire' => 'Dégénérescence maculaire liée à l\'âge',
        'Décollement de rétine' => 'Décollement de rétine',
        'Occlusion de l\'artère centrale de la rétine' => 'Occlusion artérielle rétinienne',
        'Occlusion de la veine centrale de la rétine' => 'Occlusion veineuse rétinienne',
        'Uvéite' => 'Uvéite',
        'Strabisme' => 'Strabisme',
        'Amblyopie' => 'Amblyopie',
        'Myopie' => 'Myopie',
        'Presbytie' => 'Presbytie',
        'Nystagmus' => 'Nystagmus',
        'Ptosis' => 'Ptosis',
        'Pemphigus' => 'Pemphigus',
        'Pemphigoïde bulleuse' => 'Pemphigoïde',
        'Dermatite herpétiforme' => 'Dermatite herpétiforme',
        'Granulomatose avec polyangéite' => 'Granulomatose avec polyangéite',
        'Polyangéite microscopique' => 'Polyangéite microscopique',
        'Périartérite noueuse' => 'Périartérite noueuse',
        'Fièvre méditerranéenne familiale' => 'Fièvre méditerranéenne familiale',
        'Maladie de Castleman' => 'Maladie de Castleman',
        'Syndrome d\'activation macrophagique' => 'Syndrome d\'activation macrophagique',
        'Maladie de Kawasaki' => 'Maladie de Kawasaki',
        'Amylose' => 'Amylose',
        'Syndrome cérébelleux' => 'Syndrome cérébelleux',
        'Carcinome épidermoïde' => 'Carcinome épidermoïde',
        'Adénocarcinome colorectal' => 'Cancer colorectal',
        'Adénocarcinome du pancréas' => 'Cancer du pancréas',
    ];

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'Simulation sans écriture');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $dryRun = (bool) $input->getOption('dry-run');

        $diseases = $this->entityManager->getRepository(Maladie::class)
            ->createQueryBuilder('m')
            ->where('m.imageUrl IS NULL OR m.imageUrl = \'\'')
            ->getQuery()
            ->getResult();

        $io->title('Récupération des images maladies depuis Wikipédia');
        $io->info(sprintf('%d maladies sans image.', count($diseases)));

        // Build article title -> list of Maladie entities
        $titleMap = [];
        foreach ($diseases as $m) {
            $title = $this->resolveArticleTitle($m->getNom());
            $titleMap[$title][] = $m;
        }

        $uniqueTitles = array_keys($titleMap);
        $io->info(sprintf('%d titres uniques à rechercher (par lots de 50).', count($uniqueTitles)));

        if ($dryRun) {
            $io->note('Mode dry-run : aucune écriture en base.');
            $io->listing(array_slice($uniqueTitles, 0, 20));
            return Command::SUCCESS;
        }

        // Fetch images in batches of 50
        $batches = array_chunk($uniqueTitles, 50);
        $found = 0;
        $notFound = 0;
        $titleToImage = [];

        $io->section('Récupération des images par lots');
        $io->progressStart(count($batches));

        $streamOpts = [
            'http' => [
                'header' => "User-Agent: MediSecours/1.0 (medical catalogue; contact@medisecours.com)\r\n",
                'timeout' => 30,
            ],
            'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
        ];
        $ctx = stream_context_create($streamOpts);

        foreach ($batches as $batchIndex => $batch) {
            $imageUrls = $this->fetchBatchImages($batch, $ctx);

            foreach ($batch as $title) {
                if (isset($imageUrls[$title])) {
                    $titleToImage[$title] = $imageUrls[$title];
                    $found++;
                } else {
                    $notFound++;
                }
            }

            $io->progressAdvance();
            usleep(200000); // 200ms between batches
        }

        $io->progressFinish();

        // Apply images to diseases
        $io->section('Mise à jour des maladies');
        $io->progressStart(count($diseases));

        $updated = 0;
        foreach ($diseases as $idx => $m) {
            $title = $this->resolveArticleTitle($m->getNom());
            if (isset($titleToImage[$title])) {
                $m->setImageUrl($titleToImage[$title]);
                $updated++;
            }

            if ($idx > 0 && $idx % 200 === 0) {
                $this->entityManager->flush();
            }

            $io->progressAdvance();
        }

        $this->entityManager->flush();
        $io->progressFinish();

        // Fallback: search Wikipedia for remaining titles without images
        if ($notFound > 0) {
            $missingTitles = [];
            foreach ($uniqueTitles as $title) {
                if (!isset($titleToImage[$title])) {
                    $missingTitles[] = $title;
                }
            }

            $io->section('Recherche individuelle pour ' . count($missingTitles) . ' titres sans image');
            $io->progressStart(count($missingTitles));

            foreach ($missingTitles as $title) {
                $imageUrl = $this->searchWikipediaImage($title, $ctx);
                if ($imageUrl) {
                    $titleToImage[$title] = $imageUrl;
                    $found++;
                    $notFound--;
                }
                $io->progressAdvance();
                usleep(100000); // 100ms between searches
            }

            $io->progressFinish();

            // Apply newly found images
            $io->section('Mise à jour supplémentaire');
            $io->progressStart(count($diseases));
            $extraUpdated = 0;
            foreach ($diseases as $m) {
                if ($m->getImageUrl()) {
                    $io->progressAdvance();
                    continue;
                }
                $title = $this->resolveArticleTitle($m->getNom());
                if (isset($titleToImage[$title]) && !$m->getImageUrl()) {
                    $m->setImageUrl($titleToImage[$title]);
                    $extraUpdated++;
                }
                $io->progressAdvance();
            }
            $this->entityManager->flush();
            $io->progressFinish();
            $updated += $extraUpdated;
        }

        // Second fallback: English Wikipedia for remaining titles
        $remaining = $this->entityManager->getRepository(Maladie::class)
            ->createQueryBuilder('m')
            ->where('m.imageUrl IS NULL OR m.imageUrl = \'\'')
            ->getQuery()
            ->getResult();

        if (count($remaining) > 0) {
            $io->section('Recherche sur Wikipédia anglais pour ' . count($remaining) . ' maladies restantes');
            $io->progressStart(count($remaining));

            $enFound = 0;
            foreach ($remaining as $m) {
                $title = $this->resolveArticleTitle($m->getNom());
                // Try English Wikipedia search
                $enUrl = 'https://en.wikipedia.org/w/api.php?' . http_build_query([
                    'action' => 'query',
                    'generator' => 'search',
                    'gsrsearch' => $title,
                    'gsrlimit' => 1,
                    'prop' => 'pageimages',
                    'pithumbsize' => 400,
                    'format' => 'json',
                    'formatversion' => 2,
                ], '', '&', PHP_QUERY_RFC3986);

                $body = @file_get_contents($enUrl, false, $ctx);
                if ($body !== false) {
                    $data = json_decode($body, true);
                    if (!empty($data['query']['pages'])) {
                        foreach ($data['query']['pages'] as $page) {
                            $img = $page['thumbnail']['source'] ?? null;
                            if ($img) {
                                $m->setImageUrl($img);
                                $enFound++;
                                break;
                            }
                        }
                    }
                }

                if ($enFound % 50 === 0 && $enFound > 0) {
                    $this->entityManager->flush();
                }

                $io->progressAdvance();
                usleep(100000);
            }

            $this->entityManager->flush();
            $io->progressFinish();
            $updated += $enFound;
        }

        $io->section('Résultats');
        $io->table(
            ['Indicateur', 'Valeur'],
            [
                ['Titres uniques', (string) count($uniqueTitles)],
                ['Images trouvées', (string) $found],
                ['Non trouvées', (string) $notFound],
                ['Maladies mises à jour', (string) $updated],
            ]
        );

        $io->success('Terminé.');
        return Command::SUCCESS;
    }

    private function resolveArticleTitle(string $diseaseName): string
    {
        foreach (self::KNOWN_TITLES as $prefix => $title) {
            if (str_starts_with($diseaseName, $prefix)) {
                return $title;
            }
        }

        // Fallback: extract first 2-3 significant words
        $words = preg_split('/[\s,]+/u', $diseaseName);
        $significant = [];
        $stopWords = ['aiguë', 'aigu', 'chronique', 'sévère', 'modérée', 'légère', 'grave',
                      'classique', 'commune', 'stade', 'avec', 'sans', 'et', 'de', 'du', 'des',
                      'type', 'localisé', 'localisée', 'généralisé', 'généralisée',
                      'disséminé', 'disséminée', 'simple', 'compliqué', 'compliquée',
                      'récurrent', 'récurrente', 'persistant', 'persistante'];

        foreach ($words as $w) {
            $clean = mb_strtolower(trim($w));
            if (empty($clean)) continue;
            if (in_array($clean, $stopWords)) break;
            $significant[] = trim($w);
        }

        return implode(' ', $significant) ?: $diseaseName;
    }

    private function searchWikipediaImage(string $term, $ctx): ?string
    {
        $url = self::API_URL . '?' . http_build_query([
            'action' => 'query',
            'generator' => 'search',
            'gsrsearch' => $term,
            'gsrlimit' => 1,
            'prop' => 'pageimages',
            'pithumbsize' => 400,
            'format' => 'json',
            'formatversion' => 2,
        ], '', '&', PHP_QUERY_RFC3986);

        $body = @file_get_contents($url, false, $ctx);
        if ($body === false) return null;

        $data = json_decode($body, true);
        if (empty($data['query']['pages'])) return null;

        foreach ($data['query']['pages'] as $page) {
            return $page['thumbnail']['source'] ?? null;
        }

        return null;
    }

    private function fetchBatchImages(array $titles, $ctx): array
    {
        $result = [];

        $url = self::API_URL . '?' . http_build_query([
            'action' => 'query',
            'titles' => implode('|', $titles),
            'prop' => 'pageimages',
            'pithumbsize' => 400,
            'format' => 'json',
            'formatversion' => 2,
        ], '', '&', PHP_QUERY_RFC3986);

        $body = @file_get_contents($url, false, $ctx);
        if ($body === false) return $result;

        $data = json_decode($body, true);
        if (empty($data['query']['pages'])) return $result;

        foreach ($data['query']['pages'] as $page) {
            $title = $page['title'] ?? null;
            $imageUrl = $page['thumbnail']['source'] ?? null;
            if ($title && $imageUrl) {
                $result[$title] = $imageUrl;
            }
        }

        return $result;
    }
}
