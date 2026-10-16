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
    private const MAX_PREUVE_VIDEO_OCTETS = 20 * 1024 * 1024;

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
                // Le type se lit dans l'en-tête de la data-URL, pas dans la
                // charge utile : une liste de codecs contient des virgules
                // ("video/webm;codecs=vp9,opus"), ce qu'un regex naïf rejetait.
                [$mime, $sousType] = self::analyserDataUrl($preuve);
                $estVideo = str_starts_with($mime, 'video/');
                $estImage = str_starts_with($mime, 'image/');
                if (!$estVideo && !$estImage) {
                    throw new BadRequestHttpException('Format de preuve invalide (image ou vidéo attendu).');
                }

                // Le plafond porte sur la taille RÉELLE du fichier : une data-URL
                // base64 pèse ~4/3 de plus, la comparer telle quelle refusait
                // des vidéos pourtant sous la limite.
                $tailleReelle = self::tailleDecodee($preuve);
                $tailleMax = $estVideo ? self::MAX_PREUVE_VIDEO_OCTETS : self::MAX_PREUVE_OCTETS;
                if ($tailleReelle > $tailleMax) {
                    throw new BadRequestHttpException($estVideo
                        ? 'La preuve vidéo dépasse la taille maximale (20 Mo). Choisissez un fichier plus léger.'
                        : 'La preuve photo dépasse la taille maximale (1,5 Mo).');
                }
                if ($estVideo && !in_array($sousType, ['mp4', 'webm', 'quicktime', 'x-m4v', '3gpp', 'ogg'], true)) {
                    throw new BadRequestHttpException('Format de preuve vidéo invalide (MP4/WebM attendu).');
                }

                // Le type est persisté : l'interface affiche une <video> sans
                // avoir à deviner à partir de la chaîne base64.
                $data->setPreuveType($estVideo ? DemandeSos::PREUVE_VIDEO : DemandeSos::PREUVE_PHOTO);
            } elseif (!$data->isPreuveIndisponible()) {
                throw new BadRequestHttpException(
                    'La preuve photo (capture caméra) est requise. Déclarez preuveIndisponible si la caméra est inaccessible.'
                );
            } else {
                $data->setPreuvePhoto(null);
                $data->setPreuveType(null);
            }

            $data->setStatut('EN_COURS');
            $data->setSireneActive(false);
            $data->setSuiviToken(bin2hex(random_bytes(24)));

            // ── Triage automatique : urgence vitale déclarée, âge extrême
            // (<6 ou ≥65 ans) ou grossesse → URGENTE (médecins) ; sinon
            // LEGERE (ambulanciers). Le manager confirme/force à la
            // vérification (CRITIQUE réservé).
            $age = $data->getAgePatient();
            if ($age !== null && ($age < 0 || $age > 120)) {
                throw new BadRequestHttpException('Âge du patient invalide (0-120).');
            }
            $data->setGravite(
                ($data->isUrgenceVitale() || $data->isEnceinte() || ($age !== null && ($age < 6 || $age >= 65)))
                    ? DemandeSos::GRAVITE_URGENTE
                    : DemandeSos::GRAVITE_LEGERE
            );

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
                    'preuve' => $preuve !== '' ? ($data->getPreuveType() === DemandeSos::PREUVE_VIDEO ? 'capture_video' : 'capture_camera') : 'indisponible',
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

    /**
     * Type MIME et sous-type d'une data-URL.
     *
     * L'en-tête s'arrête à la première virgule : c'est le seul découpage
     * fiable, car la liste des codecs en contient elle-même
     * (« data:video/webm;codecs=vp9,opus;base64,… »).
     *
     * @return array{0: string, 1: string} [0] = type MIME, [1] = sous-type
     */
    private static function analyserDataUrl(string $dataUrl): array
    {
        if (!str_starts_with($dataUrl, 'data:')) {
            return ['', ''];
        }

        $virgule = strpos($dataUrl, ',');
        if ($virgule === false) {
            return ['', ''];
        }

        $entete = substr($dataUrl, 5, $virgule - 5);
        $parties = array_map('trim', explode(';', $entete));
        $mime = strtolower((string) array_shift($parties));
        $sousType = strtolower((string) (str_contains($mime, '/') ? substr($mime, strpos($mime, '/') + 1) : $mime));

        return [$mime, $sousType];
    }

    /**
     * Taille réelle, en octets, du fichier encodé dans une data-URL base64.
     * Sans décodage (le fichier n'a pas besoin d'être en mémoire : seule la
     * longueur du payload suffit à connaître sa taille).
     */
    private static function tailleDecodee(string $dataUrl): int
    {
        $virgule = strpos($dataUrl, ',');
        if ($virgule === false) {
            return 0;
        }

        $charge = substr($dataUrl, $virgule + 1);
        // Le format base64 encode 3 octets sur 4 caractères.
        return (int) (strlen(rtrim($charge, '=')) * 3 / 4);
    }
}
