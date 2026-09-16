<?php

namespace App\Controller;

use App\Entity\CentreDeSante;
use App\Entity\Consultation;
use App\Entity\Maladie;
use App\Entity\Message;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/search', name: 'api_search')]
class SearchController extends AbstractController
{
    #[Route('', methods: ['GET'])]
    public function search(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $currentUser = $this->getUser();
        if (!$currentUser instanceof User) {
            throw $this->createAccessDeniedException();
        }

        $q = trim($request->query->get('q', ''));
        if (strlen($q) < 2) {
            return $this->json([]);
        }
        if (mb_strlen($q) > 100) {
            return $this->json(['error' => 'La recherche ne peut pas dépasser 100 caractères.'], 422);
        }

        $results = [];
        $isAdmin = $this->isGranted('ROLE_ADMIN');
        $isMedecin = $this->isGranted('ROLE_MEDECIN');

        // Les données personnelles sont limitées à la relation de soins.
        $patientRepo = $em->getRepository(User::class);
        $patientQuery = $patientRepo->createQueryBuilder('u')
            ->where("u INSTANCE OF App\Entity\Patient")
            ->andWhere('(LOWER(u.nom) LIKE :q OR LOWER(u.prenom) LIKE :q OR u.telephone LIKE :q OR LOWER(u.email) LIKE :q)')
            ->setParameter('q', '%' . mb_strtolower($q) . '%')
            ->setMaxResults(5);

        if (!$isAdmin && $isMedecin) {
            $patientIds = $em->getRepository(Consultation::class)
                ->createQueryBuilder('patientConsultation')
                ->select('DISTINCT IDENTITY(patientConsultation.patient)')
                ->where('patientConsultation.medecin = :currentUser')
                ->setParameter('currentUser', $currentUser)
                ->getQuery()
                ->getSingleColumnResult();

            if ($patientIds === []) {
                $patientQuery->andWhere('1 = 0');
            } else {
                $patientQuery
                    ->andWhere('u.id IN (:patientIds)')
                    ->setParameter('patientIds', $patientIds);
            }
        } elseif (!$isAdmin) {
            $patientQuery
                ->andWhere('u = :currentUser')
                ->setParameter('currentUser', $currentUser);
        }

        $patients = $patientQuery
            ->getQuery()
            ->getResult();

        if (!empty($patients)) {
            $results['patients'] = array_map(fn(User $p) => [
                'id' => $p->getId(),
                'nom' => $p->getNom(),
                'prenom' => $p->getPrenom(),
                'telephone' => $p->getTelephone(),
                'email' => $p->getEmail(),
            ], $patients);
        }

        $consultRepo = $em->getRepository(Consultation::class);
        $consultationQuery = $consultRepo->createQueryBuilder('c')
            ->leftJoin('c.patient', 'p')
            ->where('LOWER(c.motif) LIKE :q OR LOWER(p.nom) LIKE :q OR LOWER(p.prenom) LIKE :q')
            ->setParameter('q', '%' . mb_strtolower($q) . '%')
            ->setMaxResults(5);

        if (!$isAdmin && $isMedecin) {
            $consultationQuery
                ->andWhere('c.medecin = :currentUser')
                ->setParameter('currentUser', $currentUser);
        } elseif (!$isAdmin) {
            $consultationQuery
                ->andWhere('c.patient = :currentUser')
                ->setParameter('currentUser', $currentUser);
        }

        $consultations = $consultationQuery
            ->getQuery()
            ->getResult();

        if (!empty($consultations)) {
            $results['consultations'] = array_map(fn(Consultation $c) => [
                'id' => $c->getId(),
                'motif' => $c->getMotif(),
                'statut' => $c->getStatut(),
                'patient_nom' => $c->getPatient()?->getNom(),
                'patient_prenom' => $c->getPatient()?->getPrenom(),
            ], $consultations);
        }

        $messageRepo = $em->getRepository(Message::class);
        $messageQuery = $messageRepo->createQueryBuilder('m')
            ->leftJoin('m.expediteur', 'e')
            ->where('LOWER(m.contenu) LIKE :q')
            ->setParameter('q', '%' . mb_strtolower($q) . '%')
            ->setMaxResults(5);

        if (!$isAdmin) {
            $messageQuery
                ->innerJoin('m.conversation', 'messageConversation')
                ->innerJoin('messageConversation.participants', 'messageParticipant')
                ->andWhere('messageParticipant = :currentUser')
                ->setParameter('currentUser', $currentUser);
        }

        $messages = $messageQuery
            ->getQuery()
            ->getResult();

        if (!empty($messages)) {
            $results['messages'] = array_map(fn(Message $m) => [
                'id' => $m->getId(),
                'contenu' => mb_substr($m->getContenu() ?? '', 0, 120),
                'expediteur_nom' => $m->getExpediteur()?->getNom(),
                'expediteur_prenom' => $m->getExpediteur()?->getPrenom(),
                'createdAt' => $m->getCreatedAt()?->format('Y-m-d H:i'),
            ], $messages);
        }

        // Maladies
        $maladieRepo = $em->getRepository(Maladie::class);
        $maladies = $maladieRepo->createQueryBuilder('m')
            ->where('LOWER(m.nom) LIKE :q OR LOWER(m.symptomes) LIKE :q')
            ->setParameter('q', '%' . mb_strtolower($q) . '%')
            ->setMaxResults(5)
            ->getQuery()
            ->getResult();

        if (!empty($maladies)) {
            $results['maladies'] = array_map(fn(Maladie $m) => [
                'id' => $m->getId(),
                'nom' => $m->getNom(),
                'niveauGravite' => $m->getNiveauGravite(),
                'urgence' => $m->isUrgence(),
            ], $maladies);
        }

        // Centres de santé
        $centreRepo = $em->getRepository(CentreDeSante::class);
        $centres = $centreRepo->createQueryBuilder('c')
            ->where('LOWER(c.nom) LIKE :q OR LOWER(c.ville) LIKE :q OR LOWER(c.quartier) LIKE :q OR LOWER(c.adresse) LIKE :q')
            ->setParameter('q', '%' . mb_strtolower($q) . '%')
            ->setMaxResults(5)
            ->getQuery()
            ->getResult();

        if (!empty($centres)) {
            $results['centres'] = array_map(fn(CentreDeSante $c) => [
                'id' => $c->getId(),
                'nom' => $c->getNom(),
                'type' => $c->getType(),
                'ville' => $c->getVille(),
                'telephone' => $c->getTelephone(),
            ], $centres);
        }

        return $this->json($results);
    }
}
