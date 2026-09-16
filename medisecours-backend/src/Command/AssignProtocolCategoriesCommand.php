<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\ProtocolePremiersGestes;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Attribue les catégories d'interface (validation d'organisation uniquement,
 * sans toucher au contenu médical) et les restrictions de population aux
 * protocoles connus.
 */
#[AsCommand(name: 'app:assign-protocol-categories', description: 'Attribue catégories d interface et restrictions de population aux protocoles.')]
final class AssignProtocolCategoriesCommand extends Command
{
    /** @var array<string, array{categorie: string, restrictions: string}> */
    public const METADATA = [
        'difficulte_respiratoire' => [
            'categorie' => 'respiration',
            'restrictions' => 'Enfant : toute difficulté respiratoire est grave, consulter sans attendre. Femme enceinte : avis médical rapide. Personne âgée : surveillance rapprochée de la conscience et des lèvres.',
        ],
        'etouffement' => [
            'categorie' => 'respiration',
            'restrictions' => 'Enfant de moins d un an : ne jamais effectuer la manœuvre abdominale, gestes adaptés uniquement. Femme enceinte : manœuvre thoracique au lieu de la manœuvre abdominale.',
        ],
        'perte_de_connaissance' => [
            'categorie' => 'inconscience',
            'restrictions' => 'Femme enceinte : allonger sur le côté gauche. Personne âgée sous anticoagulant : chute avec perte de connaissance, urgence.',
        ],
        'convulsion' => [
            'categorie' => 'inconscience',
            'restrictions' => 'Enfant : consulter en urgence si la crise dure plus de 3 minutes. Femme enceinte : convulsion = urgence absolue (éclampsie possible).',
        ],
        'saignement_externe_important' => [
            'categorie' => 'saignements',
            'restrictions' => 'Enfant : sang en petite quantité peut déjà être grave, ne pas attendre. Personne âgée sous anticoagulant : hémorragie à traiter en urgence.',
        ],
        'plaie' => [
            'categorie' => 'saignements',
            'restrictions' => 'Grossesse et personnes âgées : vaccin antitétanique à vérifier. Morsure humaine ou animale : consulter systématiquement.',
        ],
        'brulure' => [
            'categorie' => 'brulures',
            'restrictions' => 'Enfant : brûlure même modérée = consultation rapide. Femme enceinte et personne âgée : risque de déshydratation et d infection accru, surveiller.',
        ],
        'intoxication' => [
            'categorie' => 'intoxications',
            'restrictions' => 'Enfant : ne jamais faire vomir, conserver l emballage et consulter en urgence. Femme enceinte : préciser la grossesse au professionnel. Ne rien donner à boire sans consigne.',
        ],
        'traumatisme' => [
            'categorie' => 'traumatismes',
            'restrictions' => 'Femme enceinte : tout traumatisme abdominal impose une consultation. Personne âgée sous anticoagulant : chute avec douleur = bilan médical. Enfant : surveiller 48h après choc à la tête.',
        ],
        'reaction_allergique' => [
            'categorie' => 'allergies',
            'restrictions' => 'Grossesse : certains antihistaminiques sont contre-indiqués, avis médical. Enfant : gonflement rapide = urgence. Réaction après une piqûre au Cameroun : rechercher un signe d anaphylaxie.',
        ],
        'deshydratation' => [
            'categorie' => 'fievre',
            'restrictions' => 'Enfant de moins de 5 ans et personne âgée : risque élevé, consulter rapidement. Femme enceinte : vomissements et diarrhée = consultation rapide. Ne jamais forcer à boire en cas de trouble de conscience.',
        ],
        'fievre' => [
            'categorie' => 'fievre',
            'restrictions' => 'Enfant de moins de 3 mois : toute fièvre impose une consultation. Femme enceinte : fièvre persistante = consultation. Personne âgée : confusion, chute ou raideur de nuque = urgence.',
        ],
        'douleur_thoracique' => [
            'categorie' => 'respiration',
            'restrictions' => 'Femme enceinte : douleur thoracique soudaine avec essoufflement = urgence (embolie possible). Personne âgée : douleur thoracique toujours considérée comme grave.',
        ],
    ];

    public function __construct(private readonly EntityManagerInterface $entityManager) { parent::__construct(); }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $count = 0;
        foreach (self::METADATA as $slug => $metadata) {            $protocol = $this->entityManager->getRepository(ProtocolePremiersGestes::class)
                ->findOneBy(['slug' => $slug, 'version' => '1.0']);
            if (!$protocol instanceof ProtocolePremiersGestes) {
                $output->writeln(sprintf('<comment>Absent : %s</comment>', $slug));
                continue;
            }
            $protocol
                ->setCategorie($metadata['categorie'])
                ->setRestrictionsPopulations($metadata['restrictions']);
            ++$count;
        }

        $this->entityManager->flush();
        $output->writeln(sprintf('<info>Catégories et restrictions attribuées à %d protocoles.</info>', $count));

        return Command::SUCCESS;
    }
}
