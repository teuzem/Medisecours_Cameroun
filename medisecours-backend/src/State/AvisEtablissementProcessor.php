<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\AvisEtablissement;
use App\Entity\User;
use App\Repository\AvisEtablissementRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

/**
 * Publication d'un avis sur un établissement.
 *
 * - À la création (Post) : injecte l'utilisateur connecté comme auteur et
 *   force le statut PUBLIE (les signaux modération arrivent ensuite).
 * - Après chaque écriture (Post, Patch, Delete) : recalcule la note moyenne
 *   et le total d'avis de l'établissement, pour que la fiche n'affiche
 *   jamais des agrégats divergents de la liste.
 */
class AvisEtablissementProcessor implements ProcessorInterface
{
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private readonly ProcessorInterface $persistProcessor,
        private readonly Security $security,
        private readonly AvisEtablissementRepository $repository
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if (!$data instanceof AvisEtablissement) {
            return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
        }

        $user = $this->security->getUser();
        if (!$user instanceof User) {
            throw new AccessDeniedHttpException('Un compte est requis pour laisser un avis.');
        }

        if ($operation instanceof Post) {
            $etablissement = $data->getEtablissement();
            if (!$etablissement) {
                throw new BadRequestHttpException("L'établissement évalué est obligatoire.");
            }

            $data->setUser($user);
            $data->setStatut('PUBLIE');
            $data->setUpdatedAt(new \DateTimeImmutable());
        } elseif ($operation instanceof Patch) {
            $data->setUpdatedAt(new \DateTimeImmutable());
        }

        // L'établissement est capturé avant l'écriture : après une
        // suppression, l'entité retournée est détachée/sans rattachement.
        $centre = $data->getEtablissement();

        $result = $this->persistProcessor->process($data, $operation, $uriVariables, $context);

        if ($operation instanceof Delete) {
            if ($centre) {
                $this->repository->refreshAggregates($centre);
            }

            return $result;
        }

        $target = $result instanceof AvisEtablissement ? $result->getEtablissement() : null;
        if ($target) {
            $this->repository->refreshAggregates($target);
        }
        // Un avis déplacé vers un autre établissement (Patch) doit aussi
        // décrémenter les compteurs de son établissement d'origine.
        if ($target && $centre && $centre->getId() !== $target->getId()) {
            $this->repository->refreshAggregates($centre);
        }

        return $result;
    }
}