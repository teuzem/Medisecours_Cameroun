<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\CentreDeSante;
use App\Entity\DemandeSos;
use App\Entity\SosTrace;
use App\Entity\User;
use App\Message\WebSocketNotification;
use App\Repository\CentreDeSanteRepository;
use App\Repository\EtablissementEquipeRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Messenger\MessageBusInterface;

/**
 * Envoi d'une alerte SOS.
 *
 * - Accessible sans authentification (SOS d'un visiteur).
 * - Si l'utilisateur est connecté, son compte, nom et téléphone sont pré-remplis.
 * - Calcule les 8 établissements les plus proches dans un rayon de 50 km
 *   et les retourne dans la réponse (champ `proches`) pour une action immédiate.
 * - Cible : `etablissementId` fourni par le client (fiche établissement),
 *   sinon l'établissement le plus proche devient la cible officielle.
 * - Preuve caméra : `preuvePhoto` (JPEG base64) — obligatoire sauf si le
 *   client déclare `preuveIndisponible` (aucun accès caméra), auquel cas
 *   l'absence est tracée.
 * - Journalise la création dans `sos_trace` et notifie l'équipe cible
 *   (temps réel, WebSocket ciblé sur les membres ACTIF).
 */
class DemandeSosProcessor implements ProcessorInterface
{
    private const MAX_PREUVE_OCTETS = 1_500_000;

    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private readonly ProcessorInterface $persistProcessor,
        private readonly Security $security,
        private readonly CentreDeSanteRepository $centreRepository,
        private readonly EtablissementEquipeRepository $equipeRepository,
        private readonly MessageBusInterface $messageBus,
        private readonly EntityManagerInterface $em,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if ($data instanceof DemandeSos) {
            $lat = $data->getLatitude();
            $lng = $data->getLongitude();
            if ($lat === null || $lng === null) {
                throw new BadRequestHttpException('La position (lat/lng) est obligatoire.');
            }

            $user = $this->security->getUser();
            if ($user instanceof User) {
                $data->setUser($user);

                if (!$data->getNom() && ($user->getPrenom() || $user->getNom())) {
                    $data->setNom(trim(($user->getPrenom() ?? '') . ' ' . ($user->getNom() ?? '')));
                }

                if (!$data->getTelephone() && $user->getTelephone()) {
                    $data->setTelephone($user->getTelephone());
                }
            }

            $preuve = trim((string) ($data->getPreuvePhoto() ?? ''));
            if ($preuve !== '') {
                if (strlen($preuve) > self::MAX_PREUVE_OCTETS) {
                    throw new BadRequestHttpException('La preuve photo dépasse la taille maximale (1,5 Mo).');
                }
                if (!str_starts_with($preuve, 'data:image/')) {
                    throw new BadRequestHttpException('Format de preuve photo invalide.');
                }
            } elseif (!$data->isPreuveIndisponible()) {
                throw new BadRequestHttpException(
                    'La preuve photo (capture caméra) est requise. Déclarez preuveIndisponible si la caméra est inaccessible.'
                );
            } else {
                $data->setPreuvePhoto(null);
            }

            $data->setStatut('EN_COURS');
            $data->setSireneActive(false);
            $data->setSuiviToken(bin2hex(random_bytes(24)));

            $proches = array_map(
                static function (CentreDeSante $centre): array {
                    return [
                        'id' => $centre->getId(),
                        'nom' => $centre->getNom(),
                        'distance' => $centre->getDistance() ?? 0,
                        'telephone' => $centre->getTelephone(),
                        'type' => $centre->getType(),
                        'ville' => $centre->getVille(),
                        'adresse' => $centre->getAdresse(),
                        'urgences24h' => $centre->isUrgences24h(),
                    ];
                },
                $this->centreRepository->findProches($lat, $lng, 50, 8)
            );

            $data->setProches($proches);

            // ── Cible : établissement choisi sinon le plus proche ──────────
            $cible = null;
            $cibleSource = 'proximite';
            if ($data->getEtablissementId()) {
                $cible = $this->centreRepository->find($data->getEtablissementId());
                if (!$cible) {
                    throw new BadRequestHttpException("Établissement introuvable (id {$data->getEtablissementId()}).");
                }
                $cibleSource = 'fiche';
            } elseif ($proches !== []) {
                $cible = $this->centreRepository->find((int) $proches[0]['id']);
            }
            $data->setEtablissement($cible);
            $data->setEtablissementId($cible ? $cible->getId() : null);

            $this->em->persist($data);
            $this->persistProcessor->process($data, $operation, $uriVariables, $context);

            // ── Traçabilité : création + notification équipe ───────────────
            $ip = null;
            if (isset($context['request']) && method_exists($context['request'], 'getClientIp')) {
                $ip = $context['request']->getClientIp();
            }

            $trace = (new SosTrace())
                ->setSos($data)
                ->setAction(SosTrace::ACTION_CREEE)
                ->setAuteur($user instanceof User ? $user : null)
                ->setDetails([
                    'source' => $cibleSource,
                    'etablissementId' => $cible?->getId(),
                    'preuve' => $preuve !== '' ? 'capture_camera' : 'indisponible',
                    'ip' => $ip,
                ]);
            $this->em->persist($trace);

            if ($cible) {
                $this->em->persist(
                    (new SosTrace())
                        ->setSos($data)
                        ->setAction(SosTrace::ACTION_ENVOYEE)
                        ->setDetails(['etablissementId' => $cible->getId(), 'destinataires' => 'equipe'])
                );
            }
            $this->em->flush();

            $this->notifyCreation($data, $cible);

            return $data;
        }

        return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
    }

    /**
     * Événement temps réel vers l'équipe de l'établissement ciblé.
     * (Le demandeur suit son alerte via le jeton — /api/sos/{id}/suivi.)
     */
    private function notifyCreation(DemandeSos $sos, ?CentreDeSante $cible): void
    {
        $targets = [];
        if ($cible) {
            foreach ($this->equipeRepository->findActiveByCentre($cible->getId()) as $membre) {
                if ($membre->getUser()) {
                    $targets[] = (string) $membre->getUser()->getId();
                }
            }
        }
        $targets = array_values(array_unique($targets));
        if ($targets === []) {
            return;
        }

        $this->messageBus->dispatch(new WebSocketNotification(
            'sos_creee',
            [
                'id' => $sos->getId(),
                'statut' => $sos->getStatut(),
                'nom' => $sos->getNom(),
                'telephone' => $sos->getTelephone(),
                'description' => mb_substr((string) $sos->getDescription(), 0, 200),
                'latitude' => $sos->getLatitude(),
                'longitude' => $sos->getLongitude(),
                'createdAt' => $sos->getCreatedAt()->format('c'),
                'preuve' => $sos->getPreuvePhoto() !== null,
                'etablissement' => $cible ? ['id' => $cible->getId(), 'nom' => $cible->getNom()] : null,
            ],
            $targets
        ));
    }
}
