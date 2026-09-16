<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Maladie;
use App\Entity\MaladieSymptome;
use App\Repository\MaladieRepository;
use App\Entity\ProtocolePremiersGestes;
use App\Repository\ProtocolePremiersGestesRepository;
use App\Service\ContentLocalizer;

final class SymptomTriageService
{
    private const CONTEXT_LABELS = [
        'zone_tropicale' => 'zone tropicale',
        'piqure_moustique' => 'piqure de moustique',
        'voyage_recent' => 'voyage recent',
        'contact_malade' => 'contact avec une personne malade',
        'alimentation_suspecte' => 'alimentation suspecte',
        'blessure_accident' => 'blessure ou accident',
        'grossesse' => 'grossesse',
        'enfant' => 'enfant',
'personne_agee' => 'personne agee',
    ];

    private const CONTEXT_LABELS_EN = [
        'zone_tropicale' => 'tropical zone',
        'piqure_moustique' => 'mosquito bite',
        'voyage_recent' => 'recent travel',
        'contact_malade' => 'contact with sick person',
        'alimentation_suspecte' => 'suspected food poisoning',
        'blessure_accident' => 'injury or accident',
        'grossesse' => 'pregnancy',
        'enfant' => 'child',
        'personne_agee' => 'elderly person',
    ];
    private const EMERGENCY_RULES = [
        ['label' => 'Difficulte respiratoire', 'level' => 'CRITIQUE', 'keywords' => ['difficulte respiratoire', 'respire mal', 'essoufflement severe', 'suffocation', 'detresse respiratoire', 'levres bleues'], 'actions' => ['Installer la personne assise ou demi-assise et desserrer les vetements.', 'Eviter de lui donner a boire si elle respire tres mal.', 'Contacter immediatement les urgences ou le centre de sante le plus proche.']],
        ['label' => 'Perte de connaissance ou confusion importante', 'level' => 'CRITIQUE', 'keywords' => ['perte de connaissance', 'inconscient', 'coma', 'confusion', 'desorientation', 'ne repond pas'], 'actions' => ['Verifier la respiration et placer la personne sur le cote si elle respire.', 'Ne rien mettre dans la bouche.', 'Appeler les urgences sans attendre.']],
        ['label' => 'Convulsions', 'level' => 'CRITIQUE', 'keywords' => ['convulsion', 'convulsions', 'crise epileptique', 'spasmes', 'tremblements incontroles'], 'actions' => ['Proteger la tete et eloigner les objets dangereux.', 'Ne pas retenir les mouvements et ne rien mettre dans la bouche.', 'Consulter en urgence si la crise dure plus de 5 minutes, se repete, ou survient avec fievre.']],
        ['label' => 'Douleur thoracique intense', 'level' => 'CRITIQUE', 'keywords' => ['douleur thoracique', 'douleur poitrine', 'oppression poitrine', 'serrement poitrine', 'douleur bras gauche'], 'actions' => ['Mettre la personne au repos strict, en position confortable.', 'Eviter tout effort et surveiller la respiration.', 'Contacter rapidement les urgences ou un medecin.']],
        ['label' => 'Saignement important', 'level' => 'CRITIQUE', 'keywords' => ['saignement abondant', 'hemorragie', 'perd beaucoup de sang', 'sang qui coule beaucoup'], 'actions' => ['Comprimer directement la plaie avec un tissu propre.', 'Maintenir la pression sans retirer le premier pansement imbibe.', 'Aller en urgence dans un centre de sante.']],
        ['label' => 'Deshydratation severe', 'level' => 'ELEVE', 'keywords' => ['deshydratation', 'yeux creux', 'soif intense', 'urine rare', 'bouche seche', 'diarrhee severe', 'vomissements repetes'], 'actions' => ['Donner une solution de rehydratation orale par petites gorgees si la personne est consciente.', 'Continuer apres chaque selle liquide ou vomissement.', 'Consulter rapidement, surtout chez un enfant, une femme enceinte ou une personne agee.']],
        ['label' => 'Fievre avec signes de gravite', 'level' => 'ELEVE', 'keywords' => ['fievre tres elevee', 'fievre 40', 'raideur nuque', 'fievre persistante', 'prostration', 'sueurs nocturnes'], 'actions' => ['Faire boire regulierement si la personne est consciente.', 'Eviter l automedication dangereuse et surveiller la temperature.', 'Consulter rapidement si la fievre persiste, augmente ou s accompagne de confusion, convulsions ou raideur de nuque.']],
        ['label' => 'Brulure grave ou etendue', 'level' => 'ELEVE', 'keywords' => ['brulure grave', 'brulure etendue', 'cloque importante', 'brulure visage', 'brulure electrique', 'brulure chimique'], 'actions' => ['Refroidir la zone avec de l eau propre temperee pendant 15 a 20 minutes.', 'Ne pas percer les cloques et ne pas appliquer de produit gras.', 'Couvrir avec un linge propre et consulter rapidement.']],
        ['label' => 'Obstruction des voies aeriennes', 'level' => 'CRITIQUE', 'keywords' => ['etouffement', 's etouffe', 'ne peut plus parler', 'aliment bloque', 'objet dans la gorge'], 'actions' => ['Verifier si la personne peut parler ou tousser efficacement.', 'Ne pas effectuer de manoeuvre de desobstruction si la toux reste efficace.', 'Contacter immediatement les urgences si la personne ne peut plus parler ou respirer correctement.']],
        ['label' => 'Intoxication suspectee', 'level' => 'ELEVE', 'keywords' => ['intoxication', 'produit avale', 'medicament avale', 'pesticide', 'produit menager', 'poison'], 'actions' => ['Conserver le produit ou son emballage si cela est possible sans danger.', 'Ne pas faire vomir la personne sans consigne specialisee.', 'Contacter rapidement un professionnel de sante ou les urgences.']],
        ['label' => 'Reaction allergique severe', 'level' => 'CRITIQUE', 'keywords' => ['gonflement langue', 'gonflement visage', 'reaction allergique severe', 'allergie avec difficulte respiratoire', 'choc anaphylactique'], 'actions' => ['Surveiller la respiration et l etat de conscience.', 'Ne pas retarder l appel en cas de difficulte respiratoire ou de malaise.', 'Contacter immediatement les urgences.']],
        ['label' => 'Traumatisme grave', 'level' => 'ELEVE', 'keywords' => ['traumatisme tete', 'choc a la tete', 'douleur cervicale', 'os casse', 'fracture', 'objet plante'], 'actions' => ['Maintenir la personne au repos et limiter les mouvements douloureux.', 'Ne pas tenter de remettre un os ou une articulation en place.', 'Consulter en urgence en cas de trouble de conscience, douleur cervicale, deformation ou saignement important.']],
        ['label' => 'Plaie potentiellement grave', 'level' => 'ELEVE', 'keywords' => ['plaie profonde', 'morsure profonde', 'morsure humaine', 'morsure animale', 'objet plante', 'plaie tres sale'], 'actions' => ['Proteger la plaie avec un materiel propre sans retirer un objet plante.', 'Ne pas appliquer de produit irritant dans une plaie profonde.', 'Consulter rapidement pour une plaie profonde, une morsure ou un objet plante.']],
        ['label' => 'Arret cardiorespiratoire suspecte', 'level' => 'CRITIQUE', 'keywords' => ['ne respire plus', 'absence de respiration', 'respiration anormale avec inconscience', 'aucun signe de vie', 'arret cardiaque'], 'actions' => ['Verifier rapidement la respiration sans retarder l alerte.', 'Commencer les compressions thoraciques si la personne ne respire pas normalement et utiliser un defibrillateur s il est disponible.', 'Faire appeler immediatement les urgences et suivre les consignes du regulateur.']],
        ['label' => 'Accident vasculaire cerebral suspecte', 'level' => 'CRITIQUE', 'keywords' => ['visage deforme', 'bouche deviee', 'faiblesse soudaine bras', 'paralysie soudaine', 'parole incomprehensible', 'trouble soudain de la parole'], 'actions' => ['Noter l heure de debut des signes ou la derniere heure connue sans symptome.', 'Installer la personne au repos sans lui donner a boire ni a manger.', 'Contacter immediatement les urgences, meme si les signes disparaissent.']],
        ['label' => 'Choc circulatoire', 'level' => 'CRITIQUE', 'keywords' => ['peau pale froide moite', 'pouls tres rapide', 'malaise apres hemorragie', 'extremites froides avec faiblesse', 'etat de choc'], 'actions' => ['Allonger la personne si cela ne gene pas sa respiration et la proteger du froid.', 'Controler tout saignement visible sans lui donner a boire.', 'Contacter immediatement les urgences et surveiller la respiration.']],
        ['label' => 'Noyade ou submersion', 'level' => 'CRITIQUE', 'keywords' => ['noyade', 'a bu la tasse et respire mal', 'sorti de l eau inconscient', 'submersion', 'retrouve dans l eau'], 'actions' => ['Ne pas entrer dans l eau si le sauvetage vous met en danger.', 'Verifier la respiration des la sortie de l eau et commencer la reanimation si elle est absente ou anormale.', 'Appeler immediatement les urgences et proteger la personne du froid.']],
        ['label' => 'Coup de chaleur', 'level' => 'CRITIQUE', 'keywords' => ['coup de chaleur', 'temperature tres elevee apres chaleur', 'confusion apres exposition chaleur', 'peau tres chaude avec malaise', 'inconscient apres chaleur'], 'actions' => ['Deplacer la personne vers un endroit frais et retirer les vetements superflus.', 'Commencer un refroidissement actif avec de l eau fraiche et de l air en mouvement.', 'Contacter immediatement les urgences, surtout en cas de confusion ou de perte de connaissance.']],
        ['label' => 'Hypothermie', 'level' => 'ELEVE', 'keywords' => ['hypothermie', 'tres froid et somnolent', 'temperature corporelle basse', 'frissons puis arret des frissons', 'exposition prolongee au froid'], 'actions' => ['Mettre la personne a l abri, retirer les vetements mouilles et la couvrir progressivement.', 'Manipuler doucement et ne pas appliquer de chaleur intense directement sur la peau.', 'Consulter en urgence en cas de somnolence, confusion ou respiration anormale.']],
        ['label' => 'Accident electrique', 'level' => 'CRITIQUE', 'keywords' => ['electrocution', 'choc electrique', 'courant electrique traverse le corps', 'contact haute tension', 'frappe par la foudre'], 'actions' => ['Couper la source electrique avant de toucher la victime et ne pas approcher une ligne haute tension.', 'Verifier la respiration et commencer la reanimation si necessaire.', 'Contacter les urgences, meme si les lesions visibles semblent minimes.']],
        ['label' => 'Morsure de serpent', 'level' => 'CRITIQUE', 'keywords' => ['morsure de serpent', 'serpent venimeux', 'crochets de serpent', 'gonflement apres morsure serpent'], 'actions' => ['Eloigner la personne du serpent sans tenter de le capturer.', 'Maintenir le membre immobile, retirer bagues et bracelets, et garder la personne au repos.', 'Ne pas inciser, aspirer ni poser de garrot et rejoindre rapidement un centre de sante.']],
        ['label' => 'Exposition possible a la rage', 'level' => 'ELEVE', 'keywords' => ['morsure de chien inconnu', 'morsure animal suspect de rage', 'griffure de chauve souris', 'salive animal sur plaie', 'animal enrage'], 'actions' => ['Laver immediatement la plaie avec beaucoup d eau et du savon pendant environ 15 minutes.', 'Appliquer un antiseptique disponible sans fermer hermetiquement la plaie.', 'Consulter le jour meme pour evaluer la prophylaxie antirabique.']],
        ['label' => 'Douleur abdominale intense', 'level' => 'ELEVE', 'keywords' => ['douleur abdominale intense', 'ventre tres dur', 'douleur ventre insupportable', 'douleur abdominale avec malaise', 'douleur ventre avec vomissements persistants'], 'actions' => ['Installer la personne au repos dans la position la moins douloureuse.', 'Ne pas donner de nourriture ni de medicament non prescrit avant l evaluation.', 'Consulter rapidement, surtout en cas de ventre dur, malaise, grossesse ou saignement.']],
        ['label' => 'Cephalee soudaine ou signes meninges', 'level' => 'CRITIQUE', 'keywords' => ['pire mal de tete de ma vie', 'mal de tete brutal', 'cephalee soudaine intense', 'fievre avec raideur de nuque', 'mal de tete avec confusion'], 'actions' => ['Installer la personne au repos dans un environnement calme.', 'Ne pas la laisser conduire et surveiller la conscience, la parole et les mouvements.', 'Contacter immediatement les urgences en cas de debut brutal, raideur de nuque, confusion ou deficit neurologique.']],
        ['label' => 'Projection chimique dans l oeil', 'level' => 'ELEVE', 'keywords' => ['produit chimique dans l oeil', 'acide dans l oeil', 'javel dans l oeil', 'projection caustique oeil', 'brulure chimique oeil'], 'actions' => ['Rincer immediatement l oeil avec beaucoup d eau propre pendant au moins 20 minutes.', 'Retirer les lentilles si elles se detachent facilement sans retarder le rincage.', 'Ne pas neutraliser avec un autre produit et consulter en urgence.']],
        ['label' => 'Plaie ou traumatisme oculaire grave', 'level' => 'ELEVE', 'keywords' => ['objet plante dans l oeil', 'plaie de l oeil', 'oeil perce', 'perte brutale de vision apres choc', 'sang dans l oeil apres traumatisme'], 'actions' => ['Ne pas appuyer sur l oeil et ne pas retirer un objet plante.', 'Proteger sans pression avec un dispositif propre et limiter les mouvements des yeux.', 'Consulter immediatement dans un service capable de prendre en charge les urgences oculaires.']],
        ['label' => 'Traumatisme de la colonne', 'level' => 'CRITIQUE', 'keywords' => ['douleur colonne apres accident', 'douleur cervicale apres chute', 'ne sent plus ses jambes apres choc', 'paralysie apres accident', 'traumatisme colonne'], 'actions' => ['Demander a la personne de ne pas bouger et maintenir la tete dans l axe sans traction.', 'Ne pas la relever sauf danger immediat.', 'Contacter les urgences et surveiller la respiration jusqu a leur arrivee.']],
        ['label' => 'Amputation traumatique', 'level' => 'CRITIQUE', 'keywords' => ['doigt coupe', 'main arrachee', 'membre ampute', 'amputation accidentelle', 'partie du corps sectionnee'], 'actions' => ['Controler le saignement par compression directe avec un tissu propre.', 'Emballer la partie sectionnee dans un linge propre puis dans un sac et garder ce sac au frais sans contact direct avec la glace.', 'Contacter immediatement les urgences et envoyer la partie sectionnee avec la victime.']],
        ['label' => 'Ecrasement grave d un membre', 'level' => 'CRITIQUE', 'keywords' => ['membre ecrase', 'coince sous un poids', 'ecrasement prolonge', 'jambe ecrasee', 'bras ecrase'], 'actions' => ['Securiser la zone et ne pas deplacer une charge lourde sans moyens adaptes.', 'Controler les saignements visibles et garder la personne immobile et au chaud.', 'Contacter immediatement les secours, surtout si la compression a ete prolongee.']],
        ['label' => 'Hypoglycemie severe', 'level' => 'CRITIQUE', 'keywords' => ['diabetique inconscient', 'hypoglycemie severe', 'sucre tres bas avec confusion', 'malaise diabetique avec convulsion', 'diabetique ne repond pas'], 'actions' => ['Si la personne est inconsciente ou avale mal, ne rien donner par la bouche.', 'Verifier la respiration et la placer sur le cote si elle respire.', 'Contacter immediatement les urgences et utiliser le traitement de secours prescrit uniquement si une personne formee sait le faire.']],
        ['label' => 'Hyperglycemie avec signes de gravite', 'level' => 'ELEVE', 'keywords' => ['glycemie tres elevee', 'hyperglycemie grave', 'diabete avec vomissements', 'haleine fruitee diabetique', 'respiration profonde diabetique'], 'actions' => ['Laisser la personne au repos et lui permettre de boire de l eau seulement si elle est pleinement consciente et ne vomit pas.', 'Ne pas improviser une dose d insuline.', 'Consulter rapidement, et appeler les urgences en cas de confusion, respiration anormale ou vomissements.']],
        ['label' => 'Crise d asthme severe', 'level' => 'CRITIQUE', 'keywords' => ['crise asthme severe', 'asthme inhalateur inefficace', 'asthmatique ne peut pas parler', 'sifflement avec grande difficulte respiratoire', 'crise asthme qui empire'], 'actions' => ['Installer la personne assise et l aider a utiliser uniquement son inhalateur de secours prescrit.', 'Ne pas l allonger et ne pas la laisser seule.', 'Contacter immediatement les urgences si elle parle difficilement, bleuit ou ne s ameliore pas rapidement.']],
        ['label' => 'Detresse respiratoire de l enfant', 'level' => 'CRITIQUE', 'keywords' => ['enfant respire tres vite', 'tirage thoracique enfant', 'creusement des cotes enfant', 'enfant geint en respirant', 'enfant bleu autour des levres'], 'actions' => ['Garder l enfant calme, assis ou dans les bras dans la position ou il respire le mieux.', 'Ne pas forcer a boire ou a manger si la respiration est difficile.', 'Contacter immediatement les urgences ou rejoindre le centre de sante le plus proche.']],
        ['label' => 'Nouveau ne ne respirant pas normalement', 'level' => 'CRITIQUE', 'keywords' => ['nouveau ne ne respire pas', 'bebe ne respire pas apres naissance', 'nouveau ne bleu et mou', 'bebe ne crie pas et ne respire pas'], 'actions' => ['Secher et stimuler doucement le nouveau ne tout en le gardant au chaud.', 'Degager seulement les secretions visibles sans exploration profonde de la bouche.', 'Appeler immediatement une personne formee a la reanimation neonatale et les urgences.']],
        ['label' => 'Fievre du nourrisson', 'level' => 'ELEVE', 'keywords' => ['fievre nourrisson moins de trois mois', 'bebe moins de 3 mois avec fievre', 'nouveau ne avec fievre', 'nourrisson chaud et somnolent'], 'actions' => ['Ne pas couvrir excessivement le nourrisson et surveiller sa respiration et son eveil.', 'Proposer l allaitement ou les apports habituels s il peut boire normalement.', 'Faire evaluer rapidement tout nourrisson de moins de trois mois ayant de la fievre.']],
        ['label' => 'Saignement pendant la grossesse', 'level' => 'ELEVE', 'keywords' => ['saignement pendant grossesse', 'femme enceinte perd du sang', 'sang vaginal grossesse', 'hemorragie grossesse'], 'actions' => ['Installer la personne au repos et utiliser une protection externe pour estimer le saignement.', 'Ne rien introduire dans le vagin et ne pas donner de medicament non prescrit.', 'Consulter immediatement, et appeler les urgences si le saignement est abondant, douloureux ou accompagne de malaise.']],
        ['label' => 'Eclampsie ou preeclampsie severe suspectee', 'level' => 'CRITIQUE', 'keywords' => ['convulsion femme enceinte', 'grossesse avec mal de tete intense et vision trouble', 'grossesse tension tres elevee', 'douleur epigastrique grossesse avec mal de tete', 'eclampsie'], 'actions' => ['En cas de convulsion, proteger la tete, eloigner les objets et placer la personne sur le cote des que possible.', 'Ne rien mettre dans la bouche et ne pas retenir les mouvements.', 'Contacter immediatement les urgences et signaler la grossesse.']],
        ['label' => 'Hemorragie apres accouchement', 'level' => 'CRITIQUE', 'keywords' => ['saignement abondant apres accouchement', 'hemorragie postpartum', 'perd beaucoup de sang apres naissance', 'malaise apres accouchement avec saignement'], 'actions' => ['Allonger la personne, la garder au chaud et surveiller sa respiration.', 'Utiliser des linges propres externes pour absorber le sang sans rien introduire dans le vagin.', 'Contacter immediatement les urgences et ne pas laisser la personne seule.']],
        ['label' => 'Douleur intense pendant la grossesse', 'level' => 'ELEVE', 'keywords' => ['douleur grossesse intense', 'douleur bas ventre grossesse avec malaise', 'douleur un cote grossesse', 'douleur grossesse avec douleur epaule', 'contractions douloureuses prematurees'], 'actions' => ['Installer la personne au repos dans une position confortable, de preference sur le cote.', 'Ne pas donner de medicament non prescrit et surveiller tout saignement ou malaise.', 'Consulter immediatement, surtout si la douleur est brutale, unilaterale ou accompagnee de saignement.']],
        ['label' => 'Vomissements persistants avec signes d alerte', 'level' => 'ELEVE', 'keywords' => ['vomit tout', 'vomissements persistants', 'vomissements repetes sans pouvoir boire', 'vomissements avec somnolence', 'vomissements verts'], 'actions' => ['Si la personne est consciente, proposer de tres petites quantites de solution de rehydratation.', 'La placer sur le cote si elle est somnolente afin de limiter le risque d inhalation.', 'Consulter rapidement en cas d impossibilite de boire, de vomissements verts, de sang ou de signes de deshydratation.']],
        ['label' => 'Diarrhee aigue avec signes d alerte', 'level' => 'ELEVE', 'keywords' => ['diarrhee avec sang', 'selles sanglantes', 'diarrhee tres frequente avec faiblesse', 'diarrhee avec somnolence', 'diarrhee enfant ne boit pas'], 'actions' => ['Donner une solution de rehydratation orale par petites prises si la personne peut boire.', 'Poursuivre l allaitement et les apports adaptes chez l enfant.', 'Consulter rapidement en cas de sang, somnolence, impossibilite de boire ou aggravation.']],
        ['label' => 'Diarrhee aqueuse abondante suspecte de cholera', 'level' => 'CRITIQUE', 'keywords' => ['diarrhee eau de riz', 'diarrhee aqueuse abondante', 'selles liquides tres nombreuses', 'diarrhee avec deshydratation rapide', 'suspicion cholera'], 'actions' => ['Commencer immediatement une solution de rehydratation orale si la personne peut boire.', 'Appliquer une hygiene stricte des mains et isoler les souillures sans retarder les soins.', 'Rejoindre sans attendre un centre de traitement ou appeler les urgences en cas de faiblesse majeure.']],
        ['label' => 'Paludisme avec signes de gravite', 'level' => 'CRITIQUE', 'keywords' => ['paludisme avec convulsion', 'fievre zone tropicale avec confusion', 'paludisme severe', 'fievre avec urines foncees et faiblesse', 'fievre avec difficulte respiratoire en zone tropicale'], 'actions' => ['Surveiller la respiration et placer la personne sur le cote si elle est inconsciente mais respire.', 'Ne rien donner par la bouche en cas de trouble de conscience ou de vomissements importants.', 'Rejoindre immediatement un centre de sante capable de traiter un paludisme grave.']],
        ['label' => 'Intoxication au monoxyde de carbone', 'level' => 'CRITIQUE', 'keywords' => ['monoxyde de carbone', 'plusieurs personnes malades dans une piece', 'malaise avec groupe electrogene', 'fumee charbon dans piece fermee', 'maux de tete chauffage avec confusion'], 'actions' => ['Sortir a l air libre uniquement si cela peut etre fait sans entrer dans une zone dangereuse.', 'Ne pas retourner dans le local avant sa securisation par des professionnels.', 'Contacter immediatement les urgences, meme si les symptomes diminuent dehors.']],
        ['label' => 'Inhalation de fumee', 'level' => 'CRITIQUE', 'keywords' => ['inhalation de fumee', 'a respire fumee incendie', 'suie autour de la bouche', 'voix rauque apres incendie', 'toux noire apres fumee'], 'actions' => ['Eloigner la personne de la fumee sans vous exposer et l installer au repos a l air libre.', 'Surveiller la respiration et ne pas lui donner a manger ou a boire si elle respire mal.', 'Contacter immediatement les urgences car les difficultes respiratoires peuvent s aggraver secondairement.']],
        ['label' => 'Inhalation de produit chimique', 'level' => 'CRITIQUE', 'keywords' => ['gaz toxique inhale', 'inhalation produit chimique', 'chlore inhale', 'vapeur pesticide respiree', 'melange javel acide respire'], 'actions' => ['Quitter la zone contaminee sans vous exposer et aller a l air libre.', 'Retirer les vetements contamines seulement si cela peut etre fait sans contact secondaire.', 'Contacter immediatement les urgences et conserver le nom du produit si possible.']],
        ['label' => 'Surdosage medicamenteux', 'level' => 'CRITIQUE', 'keywords' => ['surdosage medicament', 'trop de comprimes avales', 'overdose medicamenteuse', 'dose excessive de medicament', 'medicaments avales volontairement'], 'actions' => ['Conserver les boites, ordonnances et quantites supposees sans provoquer de vomissement.', 'Surveiller la respiration et placer la personne sur le cote si elle est somnolente et respire.', 'Contacter immediatement les urgences ou un centre antipoison et ne pas laisser la personne seule.']],
        ['label' => 'Piqure de scorpion', 'level' => 'ELEVE', 'keywords' => ['piqure de scorpion', 'scorpion a pique', 'douleur intense apres scorpion', 'malaise apres piqure scorpion'], 'actions' => ['Eloigner la personne du danger, nettoyer doucement la zone et retirer bijoux ou objets serrants.', 'Maintenir le membre au repos sans incision, aspiration ni garrot.', 'Consulter rapidement, immediatement pour un enfant ou en cas de malaise, vomissements ou difficulte respiratoire.']],
        ['label' => 'Piqure d insecte avec signes generaux', 'level' => 'ELEVE', 'keywords' => ['nombreuses piqures abeilles', 'piqure insecte dans la bouche', 'malaise apres piqure insecte', 'urticaire generalise apres piqure', 'vomissements apres piqure abeille'], 'actions' => ['Eloigner la personne de la zone et retirer un dard visible en le raclant sans presser le sac a venin.', 'Surveiller la respiration, le gonflement du visage et l etat de conscience.', 'Consulter en urgence pour une piqure dans la bouche, de nombreuses piqures ou des signes generaux.']],
        ['label' => 'Crise drepanocytaire severe', 'level' => 'ELEVE', 'keywords' => ['crise drepanocytaire', 'drepanocytaire douleur intense', 'drepanocytose avec douleur thoracique', 'drepanocytose avec fievre', 'drepanocytose avec difficulte respiratoire'], 'actions' => ['Installer la personne au repos, au chaud, et favoriser une hydratation habituelle si elle peut boire.', 'Utiliser uniquement les traitements deja prescrits pour ses crises selon son plan de soins.', 'Consulter rapidement, immediatement en cas de douleur thoracique, fievre, faiblesse soudaine ou difficulte respiratoire.']],
    ];

    private const EMERGENCY_RULES_EN = [
        ['label' => 'Difficulty breathing', 'level' => 'CRITIQUE', 'keywords' => ['difficulte respiratoire', 'respire mal', 'essoufflement severe', 'suffocation', 'detresse respiratoire', 'levres bleues'], 'actions' => ['Seat the person upright or semi-upright and loosen clothing.', 'Do not give them to drink if they are breathing very badly.', 'Contact emergency services or the nearest health center immediately.']],
        ['label' => 'Loss of consciousness or severe confusion', 'level' => 'CRITIQUE', 'keywords' => ['perte de connaissance', 'inconscient', 'coma', 'confusion', 'desorientation', 'ne repond pas'], 'actions' => ['Check breathing and place the person on their side if they are breathing.', 'Do not put anything in the mouth.', 'Call emergency services immediately.']],
        ['label' => 'Seizures', 'level' => 'CRITIQUE', 'keywords' => ['convulsion', 'convulsions', 'crise epileptique', 'spasmes', 'tremblements incontroles'], 'actions' => ['Protect the head and remove dangerous objects.', 'Do not restrain movements and do not put anything in the mouth.', 'Seek emergency care if the seizure lasts more than 5 minutes, recurs, or occurs with fever.']],
        ['label' => 'Severe chest pain', 'level' => 'CRITIQUE', 'keywords' => ['douleur thoracique', 'douleur poitrine', 'oppression poitrine', 'serrement poitrine', 'douleur bras gauche'], 'actions' => ['Keep the person at complete rest in a comfortable position.', 'Avoid any effort and monitor breathing.', 'Contact emergency services or a doctor promptly.']],
        ['label' => 'Heavy bleeding', 'level' => 'CRITIQUE', 'keywords' => ['saignement abondant', 'hemorragie', 'perd beaucoup de sang', 'sang qui coule beaucoup'], 'actions' => ['Apply direct pressure to the wound with a clean cloth.', 'Maintain pressure without removing the first soaked dressing.', 'Go to a health center emergency department.']],
        ['label' => 'Severe dehydration', 'level' => 'ELEVE', 'keywords' => ['deshydratation', 'yeux creux', 'soif intense', 'urine rare', 'bouche seche', 'diarrhee severe', 'vomissements repetes'], 'actions' => ['Give oral rehydration solution in small sips if the person is conscious.', 'Continue after each liquid stool or vomiting.', 'Seek care quickly, especially in children, pregnant women, or the elderly.']],
        ['label' => 'Fever with warning signs', 'level' => 'ELEVE', 'keywords' => ['fievre tres elevee', 'fievre 40', 'raideur nuque', 'fievre persistante', 'prostration', 'sueurs nocturnes'], 'actions' => ['Ensure regular drinking if the person is conscious.', 'Avoid dangerous self-medication and monitor temperature.', 'Seek care quickly if fever persists, worsens, or is accompanied by confusion, seizures, or neck stiffness.']],
        ['label' => 'Severe or extensive burn', 'level' => 'ELEVE', 'keywords' => ['brulure grave', 'brulure etendue', 'cloque importante', 'brulure visage', 'brulure electrique', 'brulure chimique'], 'actions' => ['Cool the area with clean lukewarm water for 15 to 20 minutes.', 'Do not burst blisters and do not apply greasy products.', 'Cover with a clean cloth and seek care promptly.']],
        ['label' => 'Airway obstruction', 'level' => 'CRITIQUE', 'keywords' => ['etouffement', 's etouffe', 'ne peut plus parler', 'aliment bloque', 'objet dans la gorge'], 'actions' => ['Check whether the person can speak or cough effectively.', 'Do not perform obstruction clearance if coughing remains effective.', 'Contact emergency services immediately if the person can no longer speak or breathe properly.']],
        ['label' => 'Suspected poisoning', 'level' => 'ELEVE', 'keywords' => ['intoxication', 'produit avale', 'medicament avale', 'pesticide', 'produit menager', 'poison'], 'actions' => ['Keep the product or its packaging if safe to do so.', 'Do not induce vomiting without specialized guidance.', 'Contact a healthcare professional or emergency services promptly.']],
        ['label' => 'Severe allergic reaction', 'level' => 'CRITIQUE', 'keywords' => ['gonflement langue', 'gonflement visage', 'reaction allergique severe', 'allergie avec difficulte respiratoire', 'choc anaphylactique'], 'actions' => ['Monitor breathing and level of consciousness.', 'Do not delay calling if there is difficulty breathing or malaise.', 'Contact emergency services immediately.']],
        ['label' => 'Serious injury', 'level' => 'ELEVE', 'keywords' => ['traumatisme tete', 'choc a la tete', 'douleur cervicale', 'os casse', 'fracture', 'objet plante'], 'actions' => ['Keep the person at rest and limit painful movements.', 'Do not attempt to put a bone or joint back in place.', 'Seek emergency care if there is impaired consciousness, neck pain, deformity, or heavy bleeding.']],
        ['label' => 'Potentially serious wound', 'level' => 'ELEVE', 'keywords' => ['plaie profonde', 'morsure profonde', 'morsure humaine', 'morsure animale', 'objet plante', 'plaie tres sale'], 'actions' => ['Protect the wound with clean material without removing an embedded object.', 'Do not apply irritant products to a deep wound.', 'Seek care promptly for deep wounds, bites, or embedded objects.']],
        ['label' => 'Suspected cardiac arrest', 'level' => 'CRITIQUE', 'keywords' => ['ne respire plus', 'absence de respiration', 'respiration anormale avec inconscience', 'aucun signe de vie', 'arret cardiaque'], 'actions' => ['Quickly check breathing without delaying the alert.', 'Start chest compressions if the person is not breathing normally and use a defibrillator if available.', 'Call emergency services immediately and follow the dispatcher instructions.']],
        ['label' => 'Suspected stroke', 'level' => 'CRITIQUE', 'keywords' => ['visage deforme', 'bouche deviee', 'faiblesse soudaine bras', 'paralysie soudaine', 'parole incomprehensible', 'trouble soudain de la parole'], 'actions' => ['Note the time of onset of signs or last known time without symptoms.', 'Keep the person at rest without giving food or drink.', 'Contact emergency services immediately, even if symptoms disappear.']],
        ['label' => 'Circulatory shock', 'level' => 'CRITIQUE', 'keywords' => ['peau pale froide moite', 'pouls tres rapide', 'malaise apres hemorragie', 'extremites froides avec faiblesse', 'etat de choc'], 'actions' => ['Lay the person down if it does not interfere with breathing and protect from cold.', 'Control any visible bleeding without giving to drink.', 'Contact emergency services immediately and monitor breathing.']],
        ['label' => 'Drowning or submersion', 'level' => 'CRITIQUE', 'keywords' => ['noyade', 'a bu la tasse et respire mal', 'sorti de l eau inconscient', 'submersion', 'retrouve dans l eau'], 'actions' => ['Do not enter the water if the rescue puts you in danger.', 'Check breathing as soon as out of the water and start resuscitation if absent or abnormal.', 'Call emergency services immediately and protect the person from cold.']],
        ['label' => 'Heatstroke', 'level' => 'CRITIQUE', 'keywords' => ['coup de chaleur', 'temperature tres elevee apres chaleur', 'confusion apres exposition chaleur', 'peau tres chaude avec malaise', 'inconscient apres chaleur'], 'actions' => ['Move the person to a cool place and remove excess clothing.', 'Start active cooling with cool water and moving air.', 'Contact emergency services immediately, especially if there is confusion or loss of consciousness.']],
        ['label' => 'Hypothermia', 'level' => 'ELEVE', 'keywords' => ['hypothermie', 'tres froid et somnolent', 'temperature corporelle basse', 'frissons puis arret des frissons', 'exposition prolongee au froid'], 'actions' => ['Shelter the person, remove wet clothing and cover progressively.', 'Handle gently and do not apply intense direct heat to the skin.', 'Seek emergency care if there is drowsiness, confusion, or abnormal breathing.']],
        ['label' => 'Electric shock', 'level' => 'CRITIQUE', 'keywords' => ['electrocution', 'choc electrique', 'courant electrique traverse le corps', 'contact haute tension', 'frappe par la foudre'], 'actions' => ['Cut the power source before touching the victim and do not approach a high-voltage line.', 'Check breathing and start resuscitation if needed.', 'Contact emergency services even if visible injuries seem minor.']],
        ['label' => 'Snake bite', 'level' => 'CRITIQUE', 'keywords' => ['morsure de serpent', 'serpent venimeux', 'crochets de serpent', 'gonflement apres morsure serpent'], 'actions' => ['Move the person away from the snake without trying to capture it.', 'Keep the limb still, remove rings and bracelets, and keep the person at rest.', 'Do not incise, suck, or apply a tourniquet and reach a health center quickly.']],
        ['label' => 'Possible rabies exposure', 'level' => 'ELEVE', 'keywords' => ['morsure de chien inconnu', 'morsure animal suspect de rage', 'griffure de chauve souris', 'salive animal sur plaie', 'animal enrage'], 'actions' => ['Wash the wound immediately with plenty of water and soap for about 15 minutes.', 'Apply available antiseptic without sealing the wound tightly.', 'Seek same-day care to evaluate rabies prophylaxis.']],
        ['label' => 'Severe abdominal pain', 'level' => 'ELEVE', 'keywords' => ['douleur abdominale intense', 'ventre tres dur', 'douleur ventre insupportable', 'douleur abdominale avec malaise', 'douleur ventre avec vomissements persistants'], 'actions' => ['Keep the person at rest in the least painful position.', 'Do not give food or unprescribed medication before evaluation.', 'Seek care quickly, especially with a rigid abdomen, malaise, pregnancy, or bleeding.']],
        ['label' => 'Sudden headache or meningeal signs', 'level' => 'CRITIQUE', 'keywords' => ['pire mal de tete de ma vie', 'mal de tete brutal', 'cephalee soudaine intense', 'fievre avec raideur de nuque', 'mal de tete avec confusion'], 'actions' => ['Keep the person at rest in a calm environment.', 'Do not let them drive and monitor consciousness, speech, and movement.', 'Contact emergency services immediately if onset is sudden, with neck stiffness, confusion, or neurological deficit.']],
        ['label' => 'Chemical splash in eye', 'level' => 'ELEVE', 'keywords' => ['produit chimique dans l oeil', 'acide dans l oeil', 'javel dans l oeil', 'projection caustique oeil', 'brulure chimique oeil'], 'actions' => ['Rinse the eye immediately with plenty of clean water for at least 20 minutes.', 'Remove contact lenses if they come out easily without delaying the rinse.', 'Do not neutralize with another product and seek emergency care.']],
        ['label' => 'Serious eye wound or trauma', 'level' => 'ELEVE', 'keywords' => ['objet plante dans l oeil', 'plaie de l oeil', 'oeil perce', 'perte brutale de vision apres choc', 'sang dans l oeil apres traumatisme'], 'actions' => ['Do not press on the eye and do not remove an embedded object.', 'Protect without pressure with a clean device and limit eye movements.', 'Seek immediate care at a facility capable of handling eye emergencies.']],
        ['label' => 'Spinal injury', 'level' => 'CRITIQUE', 'keywords' => ['douleur colonne apres accident', 'douleur cervicale apres chute', 'ne sent plus ses jambes apres choc', 'paralysie apres accident', 'traumatisme colonne'], 'actions' => ['Ask the person not to move and keep the head in line without traction.', 'Do not lift them unless there is immediate danger.', 'Call emergency services and monitor breathing until they arrive.']],
        ['label' => 'Traumatic amputation', 'level' => 'CRITIQUE', 'keywords' => ['doigt coupe', 'main arrachee', 'membre ampute', 'amputation accidentelle', 'partie du corps sectionnee'], 'actions' => ['Control bleeding by direct compression with a clean cloth.', 'Wrap the severed part in a clean cloth then in a bag and keep the bag cool without direct contact with ice.', 'Contact emergency services immediately and send the severed part with the victim.']],
        ['label' => 'Severe limb crushing', 'level' => 'CRITIQUE', 'keywords' => ['membre ecrase', 'coince sous un poids', 'ecrasement prolonge', 'jambe ecrasee', 'bras ecrase'], 'actions' => ['Secure the area and do not move a heavy load without proper equipment.', 'Control visible bleeding and keep the person still and warm.', 'Contact emergency services immediately, especially if compression was prolonged.']],
        ['label' => 'Severe hypoglycemia', 'level' => 'CRITIQUE', 'keywords' => ['diabetique inconscient', 'hypoglycemie severe', 'sucre tres bas avec confusion', 'malaise diabetique avec convulsion', 'diabetique ne repond pas'], 'actions' => ['If the person is unconscious or cannot swallow, give nothing by mouth.', 'Check breathing and place on their side if breathing.', 'Contact emergency services immediately and use prescribed emergency treatment only if a trained person can do so.']],
        ['label' => 'Hyperglycemia with warning signs', 'level' => 'ELEVE', 'keywords' => ['glycemie tres elevee', 'hyperglycemie grave', 'diabete avec vomissements', 'haleine fruitee diabetique', 'respiration profonde diabetique'], 'actions' => ['Keep the person at rest and allow water only if fully conscious and not vomiting.', 'Do not improvise an insulin dose.', 'Seek care quickly, and call emergency services in case of confusion, abnormal breathing, or vomiting.']],
        ['label' => 'Severe asthma attack', 'level' => 'CRITIQUE', 'keywords' => ['crise asthme severe', 'asthme inhalateur inefficace', 'asthmatique ne peut pas parler', 'sifflement avec grande difficulte respiratoire', 'crise asthme qui empire'], 'actions' => ['Seat the person upright and help use only their prescribed rescue inhaler.', 'Do not lay them down and do not leave them alone.', 'Contact emergency services immediately if they have difficulty speaking, turn blue, or do not improve quickly.']],
        ['label' => 'Child in respiratory distress', 'level' => 'CRITIQUE', 'keywords' => ['enfant respire tres vite', 'tirage thoracique enfant', 'creusement des cotes enfant', 'enfant geint en respirant', 'enfant bleu autour des levres'], 'actions' => ['Keep the child calm, seated or held in the position where they breathe best.', 'Do not force food or drink if breathing is difficult.', 'Contact emergency services immediately or go to the nearest health center.']],
        ['label' => 'Newborn not breathing normally', 'level' => 'CRITIQUE', 'keywords' => ['nouveau ne ne respire pas', 'bebe ne respire pas apres naissance', 'nouveau ne bleu et mou', 'bebe ne crie pas et ne respire pas'], 'actions' => ['Dry and gently stimulate the newborn while keeping warm.', 'Clear only visible secretions without deep mouth exploration.', 'Call a person trained in neonatal resuscitation and emergency services immediately.']],
        ['label' => 'Infant fever', 'level' => 'ELEVE', 'keywords' => ['fievre nourrisson moins de trois mois', 'bebe moins de 3 mois avec fievre', 'nouveau ne avec fievre', 'nourrisson chaud et somnolent'], 'actions' => ['Do not over-cover the infant and monitor breathing and alertness.', 'Offer breastfeeding or usual intake if they can drink normally.', 'Have any infant under three months with fever evaluated quickly.']],
        ['label' => 'Bleeding during pregnancy', 'level' => 'ELEVE', 'keywords' => ['saignement pendant grossesse', 'femme enceinte perd du sang', 'sang vaginal grossesse', 'hemorragie grossesse'], 'actions' => ['Keep the person at rest and use external protection to estimate bleeding.', 'Insert nothing in the vagina and do not give unprescribed medication.', 'Seek immediate care, and call emergency services if bleeding is heavy, painful, or accompanied by malaise.']],
        ['label' => 'Suspected eclampsia or severe pre-eclampsia', 'level' => 'CRITIQUE', 'keywords' => ['convulsion femme enceinte', 'grossesse avec mal de tete intense et vision trouble', 'grossesse tension tres elevee', 'douleur epigastrique grossesse avec mal de tete', 'eclampsie'], 'actions' => ['In case of seizure, protect the head, remove objects and place the person on their side as soon as possible.', 'Put nothing in the mouth and do not restrain movements.', 'Contact emergency services immediately and report the pregnancy.']],
        ['label' => 'Postpartum hemorrhage', 'level' => 'CRITIQUE', 'keywords' => ['saignement abondant apres accouchement', 'hemorragie postpartum', 'perd beaucoup de sang apres naissance', 'malaise apres accouchement avec saignement'], 'actions' => ['Lay the person down, keep warm and monitor breathing.', 'Use clean external cloths to absorb blood without inserting anything in the vagina.', 'Contact emergency services immediately and do not leave the person alone.']],
        ['label' => 'Severe pain during pregnancy', 'level' => 'ELEVE', 'keywords' => ['douleur grossesse intense', 'douleur bas ventre grossesse avec malaise', 'douleur un cote grossesse', 'douleur grossesse avec douleur epaule', 'contractions douloureuses prematurees'], 'actions' => ['Keep the person at rest in a comfortable position, preferably on their side.', 'Do not give unprescribed medication and monitor any bleeding or malaise.', 'Seek immediate care, especially if pain is sudden, one-sided, or accompanied by bleeding.']],
        ['label' => 'Persistent vomiting with warning signs', 'level' => 'ELEVE', 'keywords' => ['vomit tout', 'vomissements persistants', 'vomissements repetes sans pouvoir boire', 'vomissements avec somnolence', 'vomissements verts'], 'actions' => ['If conscious, offer very small amounts of oral rehydration solution.', 'Place on their side if drowsy to reduce aspiration risk.', 'Seek care quickly if unable to drink, green vomit, blood, or signs of dehydration.']],
        ['label' => 'Acute diarrhea with warning signs', 'level' => 'ELEVE', 'keywords' => ['diarrhee avec sang', 'selles sanglantes', 'diarrhee tres frequente avec faiblesse', 'diarrhee avec somnolence', 'diarrhee enfant ne boit pas'], 'actions' => ['Give oral rehydration solution in small sips if the person can drink.', 'Continue breastfeeding and appropriate intake in children.', 'Seek care quickly if there is blood, drowsiness, inability to drink, or worsening.']],
        ['label' => 'Profuse watery diarrhea suspected cholera', 'level' => 'CRITIQUE', 'keywords' => ['diarrhee eau de riz', 'diarrhee aqueuse abondante', 'selles liquides tres nombreuses', 'diarrhee avec deshydratation rapide', 'suspicion cholera'], 'actions' => ['Start oral rehydration solution immediately if the person can drink.', 'Apply strict hand hygiene and isolate soiling without delaying care.', 'Reach a treatment center without delay or call emergency services if there is major weakness.']],
        ['label' => 'Malaria with warning signs', 'level' => 'CRITIQUE', 'keywords' => ['paludisme avec convulsion', 'fievre zone tropicale avec confusion', 'paludisme severe', 'fievre avec urines foncees et faiblesse', 'fievre avec difficulte respiratoire en zone tropicale'], 'actions' => ['Monitor breathing and place the person on their side if unconscious but breathing.', 'Give nothing by mouth if there is impaired consciousness or significant vomiting.', 'Reach immediately a health center capable of treating severe malaria.']],
        ['label' => 'Carbon monoxide poisoning', 'level' => 'CRITIQUE', 'keywords' => ['monoxyde de carbone', 'plusieurs personnes malades dans une piece', 'malaise avec groupe electrogene', 'fumee charbon dans piece fermee', 'maux de tete chauffage avec confusion'], 'actions' => ['Go outdoors only if it can be done without entering a dangerous area.', 'Do not return to the premises before it is secured by professionals.', 'Contact emergency services immediately, even if symptoms improve outside.']],
        ['label' => 'Smoke inhalation', 'level' => 'CRITIQUE', 'keywords' => ['inhalation de fumee', 'a respire fumee incendie', 'suie autour de la bouche', 'voix rauque apres incendie', 'toux noire apres fumee'], 'actions' => ['Move the person away from smoke without exposing yourself and rest them outdoors.', 'Monitor breathing and do not give food or drink if they are breathing badly.', 'Contact emergency services immediately as respiratory difficulties may worsen secondarily.']],
        ['label' => 'Chemical inhalation', 'level' => 'CRITIQUE', 'keywords' => ['gaz toxique inhale', 'inhalation produit chimique', 'chlore inhale', 'vapeur pesticide respiree', 'melange javel acide respire'], 'actions' => ['Leave the contaminated area without exposure and go to fresh air.', 'Remove contaminated clothing only if possible without secondary contact.', 'Contact emergency services immediately and keep the product name if possible.']],
        ['label' => 'Drug overdose', 'level' => 'CRITIQUE', 'keywords' => ['surdosage medicament', 'trop de comprimes avales', 'overdose medicamenteuse', 'dose excessive de medicament', 'medicaments avales volontairement'], 'actions' => ['Keep boxes, prescriptions and estimated quantities without inducing vomiting.', 'Monitor breathing and place the person on their side if drowsy and breathing.', 'Contact emergency services or a poison center immediately and do not leave the person alone.']],
        ['label' => 'Scorpion sting', 'level' => 'ELEVE', 'keywords' => ['piqure de scorpion', 'scorpion a pique', 'douleur intense apres scorpion', 'malaise apres piqure scorpion'], 'actions' => ['Move the person away from danger, gently clean the area and remove tight jewelry.', 'Keep the limb at rest without incision, suction, or tourniquet.', 'Seek care quickly, immediately for a child or if there is malaise, vomiting, or difficulty breathing.']],
        ['label' => 'Insect sting with systemic signs', 'level' => 'ELEVE', 'keywords' => ['nombreuses piqures abeilles', 'piqure insecte dans la bouche', 'malaise apres piqure insecte', 'urticaire generalise apres piqure', 'vomissements apres piqure abeille'], 'actions' => ['Move the person away from the area and remove a visible stinger by scraping without pressing the venom sac.', 'Monitor breathing, facial swelling, and consciousness.', 'Seek emergency care for a sting in the mouth, numerous stings, or systemic signs.']],
        ['label' => 'Severe sickle cell crisis', 'level' => 'ELEVE', 'keywords' => ['crise drepanocytaire', 'drepanocytaire douleur intense', 'drepanocytose avec douleur thoracique', 'drepanocytose avec fievre', 'drepanocytose avec difficulte respiratoire'], 'actions' => ['Keep the person at rest and warm, and encourage usual hydration if they can drink.', 'Use only previously prescribed treatments for crises according to their care plan.', 'Seek care quickly, immediately for chest pain, fever, sudden weakness, or difficulty breathing.']],
    ];

    /** @var array<string, string> */
    private const RULE_LABEL_MAP_EN = [
        'Difficulte respiratoire' => 'Difficulty breathing',
        'Perte de connaissance ou confusion importante' => 'Loss of consciousness or severe confusion',
        'Convulsions' => 'Seizures',
        'Douleur thoracique intense' => 'Severe chest pain',
        'Saignement important' => 'Heavy bleeding',
        'Deshydratation severe' => 'Severe dehydration',
        'Fievre avec signes de gravite' => 'Fever with warning signs',
        'Brulure grave ou etendue' => 'Severe or extensive burn',
        'Obstruction des voies aeriennes' => 'Airway obstruction',
        'Intoxication suspectee' => 'Suspected poisoning',
        'Reaction allergique severe' => 'Severe allergic reaction',
        'Traumatisme grave' => 'Serious injury',
        'Plaie potentiellement grave' => 'Potentially serious wound',
        'Arret cardiorespiratoire suspecte' => 'Suspected cardiac arrest',
        'Accident vasculaire cerebral suspecte' => 'Suspected stroke',
        'Choc circulatoire' => 'Circulatory shock',
        'Noyade ou submersion' => 'Drowning or submersion',
        'Coup de chaleur' => 'Heatstroke',
        'Hypothermie' => 'Hypothermia',
        'Accident electrique' => 'Electric shock',
        'Morsure de serpent' => 'Snake bite',
        'Exposition possible a la rage' => 'Possible rabies exposure',
        'Douleur abdominale intense' => 'Severe abdominal pain',
        'Cephalee soudaine ou signes meninges' => 'Sudden headache or meningeal signs',
        'Projection chimique dans l oeil' => 'Chemical splash in eye',
        'Plaie ou traumatisme oculaire grave' => 'Serious eye wound or trauma',
        'Traumatisme de la colonne' => 'Spinal injury',
        'Amputation traumatique' => 'Traumatic amputation',
        'Ecrasement grave d un membre' => 'Severe limb crushing',
        'Hypoglycemie severe' => 'Severe hypoglycemia',
        'Hyperglycemie avec signes de gravite' => 'Hyperglycemia with warning signs',
        'Crise d asthme severe' => 'Severe asthma attack',
        'Detresse respiratoire de l enfant' => 'Child in respiratory distress',
        'Nouveau ne ne respirant pas normalement' => 'Newborn not breathing normally',
        'Fievre du nourrisson' => 'Infant fever',
        'Saignement pendant la grossesse' => 'Bleeding during pregnancy',
        'Eclampsie ou preeclampsie severe suspectee' => 'Suspected eclampsia or severe pre-eclampsia',
        'Hemorragie apres accouchement' => 'Postpartum hemorrhage',
        'Douleur intense pendant la grossesse' => 'Severe pain during pregnancy',
        'Vomissements persistants avec signes d alerte' => 'Persistent vomiting with warning signs',
        'Diarrhee aigue avec signes d alerte' => 'Acute diarrhea with warning signs',
        'Diarrhee aqueuse abondante suspecte de cholera' => 'Profuse watery diarrhea suspected cholera',
        'Paludisme avec signes de gravite' => 'Malaria with warning signs',
        'Intoxication au monoxyde de carbone' => 'Carbon monoxide poisoning',
        'Inhalation de fumee' => 'Smoke inhalation',
        'Inhalation de produit chimique' => 'Chemical inhalation',
        'Surdosage medicamenteux' => 'Drug overdose',
        'Piqure de scorpion' => 'Scorpion sting',
        'Piqure d insecte avec signes generaux' => 'Insect sting with systemic signs',
        'Crise drepanocytaire severe' => 'Severe sickle cell crisis',
        'Fievre forte persistante' => 'Persistent high fever',
    ];

    public function __construct(
        private readonly MaladieRepository $maladieRepository,
        private readonly ProtocolePremiersGestesRepository $protocoleRepository,
        private readonly ContentLocalizer $localizer,
    )
    {
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function triage(array $payload): array
    {
        $selectedSymptoms = $this->extractSymptoms($payload);
        $freeText = (string) ($payload['texteLibre'] ?? $payload['query'] ?? '');
        $tokens = $this->uniqueNonEmpty(array_merge($selectedSymptoms, $this->splitTerms($freeText)));
        $contexts = $this->extractContexts($payload);
        $durationDays = isset($payload['dureeJours']) ? max(0, (int) $payload['dureeJours']) : null;
        $intensity = strtoupper((string) ($payload['intensite'] ?? ''));

        $orientation = $this->evaluateEmergencyOrientation($tokens, $contexts, $durationDays, $intensity);

        if (count($tokens) === 0) {
            return [
                'orientation' => $orientation,
                'fichesPremiersSecours' => $orientation['protocoles'],
                'causesAEvaluer' => [],
                'results' => [],
                'preparationConsultation' => $this->buildConsultationPreparation($tokens, $contexts, $durationDays, $intensity),
                'disclaimer' => $this->localizer->isEnglish()
                    ? 'This aid organizes first actions and care referral. It does not diagnose or prescribe treatment.'
                    : 'Cette aide organise les premiers gestes et le recours aux soins. Elle ne pose pas de diagnostic et ne propose aucun traitement.',
            ];
        }

        $maladies = $this->maladieRepository->findAllForPatientTriage();

        $scored = [];
        foreach ($maladies as $maladie) {
            $score = $this->scoreMaladie($maladie, $tokens, $contexts, $durationDays, $intensity);
            if ($score['_scoreInterne'] < 18) {
                continue;
            }
            $scored[] = $score;
        }

        usort($scored, static fn (array $a, array $b): int => $b['_scoreInterne'] <=> $a['_scoreInterne']);
        $causesToEvaluate = array_map(static function (array $result): array {
            unset($result['_scoreInterne']);
            return $result;
        }, array_slice($scored, 0, 5));

        return [
            'orientation' => $orientation,
            'fichesPremiersSecours' => $orientation['protocoles'],
            'causesAEvaluer' => $causesToEvaluate,
            'results' => $causesToEvaluate,
            'preparationConsultation' => $this->buildConsultationPreparation($tokens, $contexts, $durationDays, $intensity),
            'disclaimer' => $this->localizer->isEnglish()
                ? 'The listed causes are topics to evaluate with a professional. Only a doctor can diagnose, prescribe, or modify treatment.'
                : 'Les causes mentionnées sont des sujets à évaluer par un professionnel. Seul un médecin peut diagnostiquer, prescrire ou modifier un traitement.',
        ];
    }

    /** @param string[] $tokens @param string[] $contexts */
    private function scoreMaladie(Maladie $maladie, array $tokens, array $contexts, ?int $durationDays, string $intensity): array
    {
        $structures = $maladie->getSymptomesStructures();
        $matched = [];
        $missing = [];
        $factors = [];
        $score = 0.0;
        $maxScore = 0.0;

        if ($structures->count() > 0) {
            foreach ($structures as $structure) {
                if (!$structure instanceof MaladieSymptome || $structure->getSymptome() === null) {
                    continue;
                }

                $weight = max(1, min(10, $structure->getPoids()));
                $maxScore += $weight * 10;
                $names = array_merge([$structure->getSymptome()->getNom() ?? '', $structure->getSymptome()->getSlug() ?? ''], $structure->getSymptome()->getSynonymes());
                $label = $structure->getSymptome()->getNom() ?? '';
                $isMatched = $this->matchesAny($tokens, $names);

                if ($structure->isContradictoire() && $isMatched) {
                    $score -= $weight * 12;
                    continue;
                }

                if ($isMatched) {
                    $score += $weight * 10;
                    if ($structure->isObligatoire()) {
                        $score += 10;
                    }
                    $matched[] = $label;
                    continue;
                }

                if ($structure->isObligatoire()) {
                    $score -= 12;
                }
                if ($weight >= 4 && count($missing) < 5) {
                    $missing[] = $label;
                }
            }
        } else {
            [$textScore, $matched, $missing, $maxScore] = $this->scoreLegacySymptoms($maladie, $tokens);
            $score += $textScore;
        }

        $haystack = $this->normalize(implode(' ', [
            $maladie->getNom() ?? '',
            $maladie->getDescription() ?? '',
            $maladie->getSymptomes() ?? '',
            $maladie->getCauses() ?? '',
        ]));

        $useEn = $this->localizer->isEnglish();

        foreach ($contexts as $context) {
            $contextText = $useEn
                ? (self::CONTEXT_LABELS_EN[$context] ?? str_replace('_', ' ', $context))
                : (self::CONTEXT_LABELS[$context] ?? str_replace('_', ' ', $context));
            $haystackFr = $this->normalize(self::CONTEXT_LABELS[$context] ?? str_replace('_', ' ', $context));
            if (str_contains($haystack, $haystackFr)) {
                $score += 8;
                $factors[] = $contextText;
            }
        }

        $severity = $this->normalize($maladie->getNiveauGravite() ?? '');
        if ($intensity === 'FORTE' && ($maladie->isUrgence() || str_contains($severity, 'severe') || str_contains($severity, 'critique'))) {
            $score += 8;
        }
        if ($durationDays !== null && $durationDays >= 3 && (str_contains($haystack, 'fievre') || str_contains($haystack, 'infection'))) {
            $score += 5;
        }

        $ratio = $score / max(30.0, $maxScore);
        $coverageBoost = count($matched) / max(1, count($tokens));
        $confidence = (int) round(max(0, min(98, ($ratio * 78) + ($coverageBoost * 20))));

        return [
            '_scoreInterne' => $confidence,
            'id' => $maladie->getId(),
            'nom' => $useEn ? ($maladie->getNomEn() ?? $maladie->getNom()) : $maladie->getNom(),
            'categorie' => $useEn
                ? ($maladie->getCategorie()?->getNomEn() ?? $maladie->getCategorie()?->getNom())
                : $maladie->getCategorie()?->getNom(),
            'signesObserves' => array_values(array_unique(array_filter($matched))),
            'pointsAPreciser' => array_values(array_unique(array_filter($missing))),
            'facteursACommuniquer' => array_values(array_unique($factors)),
            'raisonOrientation' => $useEn
                ? 'This cause can be discussed with a professional based on the reported signs. It does not constitute a diagnosis.'
                : 'Cette cause peut être discutée avec un professionnel au regard des signes renseignés. Elle ne constitue pas un diagnostic.',
        ];
    }


    /** @param string[] $tokens @param string[] $contexts @return array<string, mixed> */
    private function evaluateEmergencyOrientation(array $tokens, array $contexts, ?int $durationDays, string $intensity): array
    {
        $normalizedInputs = array_values(array_filter(array_map(
            fn (string $value): string => $this->normalize($value),
            array_merge($tokens, $contexts)
        )));
        $normalizedText = implode(' ', $normalizedInputs);
        $matchedRules = [];
        $actions = [];
        $highestLevel = 'FAIBLE';

        foreach (self::EMERGENCY_RULES as $rule) {
            foreach ($rule['keywords'] as $keyword) {
                $normalizedKeyword = $this->normalize($keyword);
                $matched = array_filter(
                    $normalizedInputs,
                    fn (string $input): bool => $this->containsAffirmedKeyword($input, $normalizedKeyword)
                );
                if ($matched !== []) {
                    $matchedRules[] = ['label' => $rule['label'], 'niveau' => $rule['level'], 'motCle' => $keyword];
                    $actions = array_merge($actions, $rule['actions']);
                    $highestLevel = $this->maxEmergencyLevel($highestLevel, $rule['level']);
                    break;
                }
            }
        }

        if ($intensity === 'FORTE' && $durationDays !== null && $durationDays >= 3 && str_contains($normalizedText, 'fievre')) {
            $matchedRules[] = ['label' => 'Fievre forte persistante', 'niveau' => 'ELEVE', 'motCle' => 'fievre forte depuis plusieurs jours'];
            if ($this->localizer->isEnglish()) {
                $actions[] = 'Seek care quickly to look for an infection or complication.';
                $actions[] = 'Drink regularly if possible and monitor temperature.';
            } else {
                $actions[] = 'Consulter rapidement pour rechercher une infection ou une complication.';
                $actions[] = 'Boire regulierement si possible et surveiller la temperature.';
            }
            $highestLevel = $this->maxEmergencyLevel($highestLevel, 'ELEVE');
        }

        if (in_array('grossesse', $contexts, true) && $highestLevel !== 'FAIBLE') {
            if ($this->localizer->isEnglish()) {
                $actions[] = 'In a pregnant woman, seek medical advice quickly even if signs seem mild.';
            } else {
                $actions[] = 'Chez une femme enceinte, demander un avis medical rapidement meme si les signes semblent moderes.';
            }
            $highestLevel = $this->maxEmergencyLevel($highestLevel, 'ELEVE');
        }
        if ((in_array('enfant', $contexts, true) || in_array('personne_agee', $contexts, true)) && $highestLevel !== 'FAIBLE') {
            if ($this->localizer->isEnglish()) {
                $actions[] = 'For a child or elderly person, do not wait if signs persist or worsen.';
            } else {
                $actions[] = 'Pour un enfant ou une personne agee, ne pas attendre si les signes persistent ou s aggravent.';
            }
        }

        $careLevel = $this->resolveCareLevel($highestLevel, $tokens, $durationDays, $intensity);
        $destination = match ($careLevel) {
            'CRITIQUE' => 'URGENCES',
            'ELEVE', 'CONSULTATION_RAPIDE' => 'CENTRE_DE_SANTE',
            default => 'TELECONSULTATION',
        };
        $protocols = $this->loadPublishedProtocols($matchedRules);
        $uniqueActions = array_slice(array_values(array_unique($actions)), 0, 8);
        $useEn = $this->localizer->isEnglish();

        $localizedSignesUrgence = array_map(
            fn (array $rule) => [
                'label' => $useEn ? (self::RULE_LABEL_MAP_EN[$rule['label']] ?? $rule['label']) : $rule['label'],
                'niveau' => $rule['niveau'],
                'motCle' => $rule['motCle'],
            ],
            array_values(array_unique($matchedRules, SORT_REGULAR))
        );

        $localizedSurveillance = $useEn ? [
            'Monitor breathing, consciousness, and any worsening.',
            'Note the onset time of signs and any changes observed.',
            'Do not leave alone a person whose condition may worsen.',
        ] : [
            'Surveiller la respiration, la conscience et toute aggravation.',
            'Noter l heure de début des signes et les changements observés.',
            'Ne pas laisser seule une personne dont l état peut s aggraver.',
        ];

        return [
            'niveau' => $careLevel,
            'niveauUrgence' => $highestLevel,
            'urgenceDetectee' => in_array($careLevel, ['CRITIQUE', 'ELEVE'], true),
            'signesUrgence' => $localizedSignesUrgence,
            'signesDanger' => array_values(array_unique(array_column($localizedSignesUrgence, 'label'))),
            'premiersGestes' => $uniqueActions,
            'actionsImmediates' => $uniqueActions,
            'actionsInterdites' => $this->buildForbiddenActions($matchedRules),
            'surveillance' => $localizedSurveillance,
            'destination' => $destination,
            'messageOrientation' => $this->buildCareOrientationMessage($careLevel),
            'protocoles' => $protocols,
        ];
    }

    /** @param string[] $tokens */
    private function resolveCareLevel(string $emergencyLevel, array $tokens, ?int $durationDays, string $intensity): string
    {
        if ($emergencyLevel === 'CRITIQUE' || $emergencyLevel === 'ELEVE') {
            return $emergencyLevel;
        }
        if ($intensity === 'FORTE' || ($durationDays !== null && $durationDays >= 3)) {
            return 'CONSULTATION_RAPIDE';
        }

        return 'TELECONSULTATION_POSSIBLE';
    }

    /** @param array<int, array{label: string, niveau: string, motCle: string}> $matchedRules @return string[] */
    private function buildForbiddenActions(array $matchedRules): array
    {
        if ($this->localizer->isEnglish()) {
            $actions = [
                'Do not give medication, change a dose, or start treatment without a prescription.',
                'Do not give food or drink to an unconscious, very drowsy, or breathing-impaired person.',
            ];
            $labels = array_column($matchedRules, 'label');
            if (in_array('Intoxication suspectee', $labels, true) || in_array('Surdosage medicamenteux', $labels, true)) {
                $actions[] = 'Do not induce vomiting.';
            }
            if (in_array('Traumatisme grave', $labels, true) || in_array('Traumatisme de la colonne', $labels, true)) {
                $actions[] = 'Do not move the person unnecessarily and do not put a limb back in place.';
            }

            return array_values(array_unique($actions));
        }

        $actions = [
            'Ne pas donner de médicament, modifier une dose ou commencer un traitement sans prescription.',
            'Ne pas faire boire ou manger une personne inconsciente, très somnolente ou qui respire mal.',
        ];
        $labels = array_column($matchedRules, 'label');
        if (in_array('Intoxication suspectee', $labels, true) || in_array('Surdosage medicamenteux', $labels, true)) {
            $actions[] = 'Ne pas provoquer de vomissement.';
        }
        if (in_array('Traumatisme grave', $labels, true) || in_array('Traumatisme de la colonne', $labels, true)) {
            $actions[] = 'Ne pas déplacer inutilement la personne et ne pas remettre un membre en place.';
        }

        return array_values(array_unique($actions));
    }

    /** @param string[] $tokens @param string[] $contexts @return array<string, mixed> */
    private function buildConsultationPreparation(array $tokens, array $contexts, ?int $durationDays, string $intensity): array
    {
        $useEn = $this->localizer->isEnglish();

        return [
            'signesADecrire' => array_values($tokens),
            'dureeJours' => $durationDays,
            'intensite' => $intensity !== '' ? $intensity : null,
            'contextes' => array_map(
                fn (string $context): string => $useEn
                    ? (self::CONTEXT_LABELS_EN[$context] ?? str_replace('_', ' ', $context))
                    : (self::CONTEXT_LABELS[$context] ?? str_replace('_', ' ', $context)),
                $contexts
            ),
            'informationsUtiles' => $useEn ? [
                'Approximate age and possible pregnancy.',
                'Known conditions, allergies, and usual treatments.',
                'Onset time, progression, and actions already taken.',
            ] : [
                'Âge approximatif et grossesse éventuelle.',
                'Maladies connues, allergies et traitements habituels.',
                'Heure de début, évolution et gestes déjà effectués.',
            ],
        ];
    }

    private function buildCareOrientationMessage(string $level): string
    {
        if ($this->localizer->isEnglish()) {
            return self::CARE_ORIENTATION_MESSAGES_EN[$level] ?? self::CARE_ORIENTATION_MESSAGES_EN['TELECONSULTATION'];
        }

        return match ($level) {
            'CRITIQUE' => 'Danger potentiel immédiat : alertez les urgences et appliquez uniquement les gestes affichés.',
            'ELEVE' => 'Signes d alerte : organisez une prise en charge urgente dans un centre de santé.',
            'CONSULTATION_RAPIDE' => 'Une évaluation médicale rapide est recommandée, sans traitement autonome.',
            default => 'Aucun danger majeur détecté dans la saisie : une téléconsultation peut orienter la suite.',
        };
    }

    private function containsAffirmedKeyword(string $input, string $keyword): bool
    {
        if ($input === '' || $keyword === '') {
            return false;
        }

        $offset = 0;
        while (($position = strpos($input, $keyword, $offset)) !== false) {
            $prefix = substr($input, max(0, $position - 60), min(60, $position));
            $isNegated = preg_match(
                '~(?:^|\s)(?:pas(?:\s+du|\s+de|\s+d)?|sans|aucun|aucune|absence\s+de|n\s+(?:ai|a|avons|avez|ont)\s+pas(?:\s+de|\s+d)?|ne\s+(?:presente|signale)\s+pas(?:\s+de|\s+d)?)(?:\s+[a-z0-9]+){0,2}\s*$~',
                $prefix
            ) === 1;

            if (!$isNegated) {
                return true;
            }

            $offset = $position + strlen($keyword);
        }

        return false;
    }

    /** @param array<int, array{label: string, niveau: string, motCle: string}> $matchedRules */
    private function loadPublishedProtocols(array $matchedRules): array
    {
        $slugByLabel = [
            'Difficulte respiratoire' => 'difficulte_respiratoire',
            'Perte de connaissance ou confusion importante' => 'perte_de_connaissance',
            'Convulsions' => 'convulsion',
            'Douleur thoracique intense' => 'douleur_thoracique',
            'Saignement important' => 'saignement_externe_important',
            'Deshydratation severe' => 'deshydratation',
            'Fievre avec signes de gravite' => 'fievre',
            'Brulure grave ou etendue' => 'brulure',
            'Obstruction des voies aeriennes' => 'etouffement',
            'Intoxication suspectee' => 'intoxication',
            'Reaction allergique severe' => 'reaction_allergique',
            'Traumatisme grave' => 'traumatisme',
            'Plaie potentiellement grave' => 'plaie',
            'Arret cardiorespiratoire suspecte' => 'arret_cardiorespiratoire',
            'Accident vasculaire cerebral suspecte' => 'avc_suspecte',
            'Choc circulatoire' => 'choc_circulatoire',
            'Noyade ou submersion' => 'noyade',
            'Coup de chaleur' => 'coup_chaleur',
            'Hypothermie' => 'hypothermie',
            'Accident electrique' => 'electrocution',
            'Morsure de serpent' => 'morsure_serpent',
            'Exposition possible a la rage' => 'exposition_rage',
            'Douleur abdominale intense' => 'douleur_abdominale_intense',
            'Cephalee soudaine ou signes meninges' => 'meningite_signes_alerte',
            'Projection chimique dans l oeil' => 'brulure_oculaire_chimique',
            'Plaie ou traumatisme oculaire grave' => 'plaie_oculaire',
            'Traumatisme de la colonne' => 'traumatisme_colonne',
            'Amputation traumatique' => 'amputation',
            'Ecrasement grave d un membre' => 'ecrasement_membre',
            'Hypoglycemie severe' => 'hypoglycemie_inconsciente',
            'Hyperglycemie avec signes de gravite' => 'hyperglycemie_grave',
            'Crise d asthme severe' => 'crise_asthme',
            'Detresse respiratoire de l enfant' => 'detresse_respiratoire_enfant',
            'Nouveau ne ne respirant pas normalement' => 'nouveau_ne_ne_respire_pas',
            'Fievre du nourrisson' => 'fievre_nourrisson',
            'Saignement pendant la grossesse' => 'saignement_grossesse',
            'Eclampsie ou preeclampsie severe suspectee' => 'eclampsie_suspectee',
            'Hemorragie apres accouchement' => 'hemorragie_postpartum',
            'Douleur intense pendant la grossesse' => 'douleur_grossesse_intense',
            'Vomissements persistants avec signes d alerte' => 'vomissements_persistants',
            'Diarrhee aigue avec signes d alerte' => 'diarrhee_aigue',
            'Diarrhee aqueuse abondante suspecte de cholera' => 'diarrhee_cholera',
            'Paludisme avec signes de gravite' => 'paludisme_signes_graves',
            'Intoxication au monoxyde de carbone' => 'monoxyde_carbone',
            'Inhalation de fumee' => 'inhalation_fumee',
            'Inhalation de produit chimique' => 'inhalation_produit_chimique',
            'Surdosage medicamenteux' => 'surdosage_medicament',
            'Piqure de scorpion' => 'piqure_scorpion',
            'Piqure d insecte avec signes generaux' => 'piqure_insecte',
            'Crise drepanocytaire severe' => 'crise_drepanocytaire',
        ];
        $slugs = array_values(array_unique(array_filter(array_map(
            fn (array $rule): ?string => $slugByLabel[$rule['label']] ?? null,
            $matchedRules
        ))));
        if ($slugs === []) {
            return [];
        }

        $protocols = $this->protocoleRepository->findPublicBySlugs($slugs);
        $useEn = $this->localizer->isEnglish();

        return array_map(fn (ProtocolePremiersGestes $protocol): array => [
            'id' => $protocol->getId(),
            'slug' => $protocol->getSlug(),
            'titre' => $useEn ? ($protocol->getTitreEn() ?? $protocol->getTitre()) : $protocol->getTitre(),
            'niveauUrgence' => $protocol->getNiveauUrgence(),
            'version' => $protocol->getVersion(),
            'sourceClinique' => $useEn ? ($protocol->getSourceCliniqueEn() ?? $protocol->getSourceClinique()) : $protocol->getSourceClinique(),
            'etapes' => array_map(fn ($step): array => [
                    'position' => $step->getPosition(),
                    'type' => $step->getType(),
                    'titre' => $useEn ? ($step->getTitreEn() ?? $step->getTitre()) : $step->getTitre(),
                    'instruction' => $useEn ? ($step->getInstructionEn() ?? $step->getInstruction()) : $step->getInstruction(),
            ], $protocol->getEtapes()->toArray()),
        ], $protocols);
    }

    private function maxEmergencyLevel(string $current, string $candidate): string
    {
        $rank = ['FAIBLE' => 0, 'MOYEN' => 1, 'ELEVE' => 2, 'CRITIQUE' => 3];
        return ($rank[$candidate] ?? 0) > ($rank[$current] ?? 0) ? $candidate : $current;
    }

    private function buildOrientationMessage(string $level): string
    {
        return match ($level) {
            'CRITIQUE' => 'Signes potentiellement critiques : priorite aux urgences et aux premiers gestes immediats.',
            'ELEVE' => 'Signes d alerte detectes : une consultation rapide est recommandee.',
            'MOYEN' => 'Surveillance rapprochee recommandee si les symptomes persistent ou s aggravent.',
            default => 'Aucun signe d urgence majeur detecte dans les informations saisies.',
        };
    }
    /** @param string[] $tokens @return array{0: float, 1: string[], 2: string[], 3: float} */
    private function scoreLegacySymptoms(Maladie $maladie, array $tokens): array
    {
        $symptomsText = $this->normalize($maladie->getSymptomes() ?? '');
        $allText = $this->normalize(implode(' ', [$maladie->getNom(), $maladie->getDescription(), $maladie->getCauses(), $maladie->getSymptomes()]));
        $matched = [];
        $score = 0.0;

        foreach ($tokens as $token) {
            $normalized = $this->normalize($token);
            if ($normalized !== '' && str_contains($symptomsText, $normalized)) {
                $score += 18;
                $matched[] = $token;
            } elseif ($normalized !== '' && str_contains($allText, $normalized)) {
                $score += 6;
                $matched[] = $token;
            }
        }

        $missing = array_slice($this->splitTerms($maladie->getSymptomes() ?? ''), 0, 5);
        return [$score, $matched, $missing, max(60.0, count($tokens) * 18.0)];
    }

    /** @param array<string, mixed> $payload @return string[] */
    private function extractSymptoms(array $payload): array
    {
        $items = $payload['symptomes'] ?? [];
        if (!is_array($items)) {
            return [];
        }

        $result = [];
        foreach ($items as $item) {
            if (is_array($item)) {
                $value = $item['nom'] ?? $item['label'] ?? $item['slug'] ?? '';
            } else {
                $value = (string) $item;
            }
            if (trim((string) $value) !== '') {
                $result[] = (string) $value;
            }
        }

        return $result;
    }

    /** @param array<string, mixed> $payload @return string[] */
    private function extractContexts(array $payload): array
    {
        $contexts = $payload['contextes'] ?? [];
        if (!is_array($contexts)) {
            return [];
        }
        return $this->uniqueNonEmpty(array_map('strval', $contexts));
    }

    /** @return string[] */
    private function splitTerms(string $value): array
    {
        $parts = preg_split('/[,;\n\r]+|\s+et\s+|\s+avec\s+/iu', $value) ?: [];
        return $this->uniqueNonEmpty(array_map(static fn (string $part): string => trim($part), $parts));
    }

    /** @param string[] $values @return string[] */
    private function uniqueNonEmpty(array $values): array
    {
        $seen = [];
        foreach ($values as $value) {
            $label = trim((string) $value);
            if ($label === '') {
                continue;
            }
            $key = $this->normalize($label);
            if ($key !== '') {
                $seen[$key] = $label;
            }
        }
        return array_values($seen);
    }

    /** @param string[] $tokens @param string[] $names */
    private function matchesAny(array $tokens, array $names): bool
    {
        $normalizedNames = array_filter(array_map(fn (string $name): string => $this->normalize($name), $names));
        foreach ($tokens as $token) {
            $normalizedToken = $this->normalize($token);
            foreach ($normalizedNames as $name) {
                if ($normalizedToken !== '' && ($normalizedToken === $name || str_contains($normalizedToken, $name) || str_contains($name, $normalizedToken))) {
                    return true;
                }
            }
        }
        return false;
    }

    private function normalize(string $value): string
    {
        $value = trim(mb_strtolower($value));
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        $value = $ascii !== false ? $ascii : $value;
        $value = preg_replace('/[^a-z0-9]+/i', ' ', $value) ?? '';
        return trim(preg_replace('/\s+/', ' ', $value) ?? '');
    }

    /** @param string[] $matched @param string[] $missing @param string[] $factors */
    private function buildExplanation(int $confidence, array $matched, array $missing, array $factors): string
    {
        $level = $confidence >= 75 ? 'correspondance forte' : ($confidence >= 50 ? 'correspondance moyenne' : 'correspondance faible');
        $parts = ['Score base sur une ' . $level . ' avec les symptomes renseignes.'];
        if (count($matched) > 0) {
            $parts[] = 'Signes retrouves : ' . implode(', ', array_slice($matched, 0, 4)) . '.';
        }
        if (count($missing) > 0) {
            $parts[] = 'A confirmer : ' . implode(', ', array_slice($missing, 0, 3)) . '.';
        }
        if (count($factors) > 0) {
            $parts[] = 'Contexte pris en compte : ' . implode(', ', $factors) . '.';
        }
        return implode(' ', $parts);
    }

    private function buildAdvice(Maladie $maladie, int $confidence): string
    {
        if ($maladie->isUrgence() || $confidence >= 80) {
            return 'Consultez rapidement un professionnel de sante, surtout si les symptomes persistent ou s aggravent.';
        }
        return 'Surveillez l evolution et consultez un professionnel de sante en cas de doute, de douleur intense ou de persistance.';
    }
    /** @return array<int, array<string, mixed>> */
    private function serializePremiersSoins(Maladie $maladie): array
    {
        $useEn = $this->localizer->isEnglish();
        $items = [];
        foreach ($maladie->getPremiersSoins() as $premierSoin) {
            $items[] = [
                'id' => $premierSoin->getId(),
                'titre' => $useEn ? ($premierSoin->getTitreEn() ?? $premierSoin->getTitre()) : $premierSoin->getTitre(),
                'description' => $useEn ? ($premierSoin->getDescriptionEn() ?? $premierSoin->getDescription()) : $premierSoin->getDescription(),
                'symptomes' => $useEn ? ($premierSoin->getSymptomesEn() ?? $premierSoin->getSymptomes()) : $premierSoin->getSymptomes(),
                'niveauUrgence' => $premierSoin->getNiveauUrgence(),
                'note' => $useEn
                    ? 'Holding measures before consultation. If in doubt or worsening, contact a healthcare professional.'
                    : 'Gestes d attente avant consultation. En cas de doute ou aggravation, contactez un professionnel de sante.',
            ];
        }

        usort($items, static function (array $a, array $b): int {
            $rank = ['CRITIQUE' => 4, 'ÉLEVÉ' => 3, 'ELEVE' => 3, 'MOYEN' => 2, 'FAIBLE' => 1];
            return ($rank[$b['niveauUrgence'] ?? ''] ?? 0) <=> ($rank[$a['niveauUrgence'] ?? ''] ?? 0);
        });

        return array_slice($items, 0, 3);
    }
    /** @return array<string, mixed> */
    private function serializeMaladie(Maladie $maladie): array
    {
        $useEn = $this->localizer->isEnglish();

        return [
            'id' => $maladie->getId(),
            'nom' => $useEn ? ($maladie->getNomEn() ?? $maladie->getNom()) : $maladie->getNom(),
            'description' => $useEn ? ($maladie->getDescriptionEn() ?? $maladie->getDescription()) : $maladie->getDescription(),
            'symptomes' => $useEn ? ($maladie->getSymptomesEn() ?? $maladie->getSymptomes()) : $maladie->getSymptomes(),
            'niveauGravite' => $maladie->getNiveauGravite(),
            'urgence' => $maladie->isUrgence(),
            'contagieux' => $maladie->isContagieux(),
            'imageUrl' => $maladie->getImageUrl(),
            'categorie' => $maladie->getCategorie() ? [
                'id' => $maladie->getCategorie()->getId(),
                'nom' => $useEn ? ($maladie->getCategorie()->getNomEn() ?? $maladie->getCategorie()->getNom()) : $maladie->getCategorie()->getNom(),
            ] : null,
        ];
    }
}
