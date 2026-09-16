<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\ProtocoleEtape;
use App\Entity\ProtocolePremiersGestes;
use Doctrine\ORM\EntityManagerInterface;use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:seed-first-aid-protocols', description: 'Crée les protocoles d’urgence initiaux en statut EN_REVUE.')]
final class SeedFirstAidProtocolsCommand extends Command
{
    public function __construct(private readonly EntityManagerInterface $entityManager) { parent::__construct(); }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $protocols = [
            'difficulte_respiratoire' => ['Difficulté respiratoire', 'CRITIQUE', ['FAIRE|Installer la personne assise ou demi-assise et desserrer les vêtements.', 'EVITER|Ne pas donner à boire si la respiration est très difficile.', 'APPELER|Contacter immédiatement les urgences ou le centre de santé le plus proche.']],
            'perte_de_connaissance' => ['Perte de connaissance', 'CRITIQUE', ['FAIRE|Vérifier la respiration et placer la personne sur le côté si elle respire.', 'EVITER|Ne rien mettre dans la bouche.', 'APPELER|Appeler les urgences sans attendre.']],
            'convulsion' => ['Convulsions', 'CRITIQUE', ['FAIRE|Protéger la tête et éloigner les objets dangereux.', 'EVITER|Ne pas retenir les mouvements et ne rien mettre dans la bouche.', 'APPELER|Consulter en urgence si la crise dure plus de cinq minutes ou se répète.']],
            'saignement_externe_important' => ['Saignement important', 'CRITIQUE', ['FAIRE|Comprimer directement la plaie avec un tissu propre.', 'EVITER|Ne pas retirer le premier pansement imbibé.', 'APPELER|Aller en urgence dans un centre de santé.']],
            'brulure' => ['Brûlure grave ou étendue', 'ELEVE', ['FAIRE|Refroidir la zone avec de l’eau propre tempérée pendant quinze à vingt minutes.', 'EVITER|Ne pas percer les cloques et ne pas appliquer de produit gras.', 'APPELER|Couvrir avec un linge propre et consulter rapidement.']],
            'douleur_thoracique' => ['Douleur thoracique intense', 'CRITIQUE', ['FAIRE|Mettre la personne au repos dans une position confortable.', 'EVITER|Éviter tout effort physique.', 'APPELER|Contacter immédiatement les urgences ou un centre de santé.']],
            'deshydratation' => ['Déshydratation sévère', 'ELEVE', ['FAIRE|Donner une solution de réhydratation par petites gorgées si la personne est consciente.', 'SURVEILLER|Surveiller la capacité à boire et les urines.', 'APPELER|Consulter rapidement, surtout pour un enfant, une grossesse ou une personne âgée.']],
            'fievre' => ['Fièvre avec signes de gravité', 'ELEVE', ['FAIRE|Faire boire régulièrement si la personne est consciente.', 'SURVEILLER|Surveiller la température, la conscience et la respiration.', 'APPELER|Consulter rapidement en cas de confusion, convulsion ou aggravation.']],
            'etouffement' => ['Obstruction des voies aériennes', 'CRITIQUE', ['SURVEILLER|Vérifier si la personne peut parler ou tousser efficacement.', 'EVITER|Ne pas intervenir par manœuvre de désobstruction si la toux reste efficace.', 'APPELER|Contacter immédiatement les urgences si la personne ne peut plus parler ou respirer correctement.']],
            'intoxication' => ['Intoxication suspectée', 'ELEVE', ['FAIRE|Conserver le produit ou son emballage si cela est possible sans danger.', 'EVITER|Ne pas faire vomir la personne sans consigne spécialisée.', 'APPELER|Contacter rapidement un professionnel de santé ou les urgences.']],
            'reaction_allergique' => ['Réaction allergique', 'ELEVE', ['SURVEILLER|Surveiller le gonflement du visage, de la langue et la respiration.', 'EVITER|Ne pas retarder l’appel en cas de difficulté respiratoire ou malaise.', 'APPELER|Contacter immédiatement les urgences si des signes respiratoires apparaissent.']],
            'traumatisme' => ['Traumatisme tête, cou ou membre', 'ELEVE', ['FAIRE|Maintenir la personne au repos et limiter les mouvements douloureux.', 'EVITER|Ne pas tenter de remettre un os ou une articulation en place.', 'APPELER|Consulter en urgence en cas de trouble de conscience, douleur cervicale, déformation ou saignement important.']],
            'plaie' => ['Plaie simple', 'MOYEN', ['FAIRE|Protéger la plaie avec un matériel propre.', 'SURVEILLER|Rechercher douleur importante, souillure ou signes d’infection.', 'ORIENTER|Consulter rapidement en cas de plaie profonde, morsure ou objet planté.']],
        ];

        foreach ($protocols as $slug => [$title, $level, $steps]) {
            if ($this->entityManager->getRepository(ProtocolePremiersGestes::class)->findOneBy(['slug' => $slug, 'version' => '1.0'])) continue;
            $metadata = AssignProtocolCategoriesCommand::METADATA[$slug] ?? null;
            $protocol = (new ProtocolePremiersGestes())->setSlug($slug)->setTitre($title)->setNiveauUrgence($level)->setStatut('EN_REVUE')->setPopulation('TOUS')->setVersion('1.0')->setSourceClinique('À valider par un professionnel de santé avant publication.');
            if ($metadata !== null) {
                $protocol->setCategorie($metadata['categorie'])->setRestrictionsPopulations($metadata['restrictions']);
            }
            foreach ($steps as $index => $raw) {
                [$type, $instruction] = explode('|', $raw, 2);
                $protocol->addEtape((new ProtocoleEtape())->setPosition($index + 1)->setType($type)->setInstruction($instruction));
            }
            $this->entityManager->persist($protocol);
            $output->writeln("Créé : {$slug} (EN_REVUE)");
        }
        $this->entityManager->flush();
        return Command::SUCCESS;
    }
}
