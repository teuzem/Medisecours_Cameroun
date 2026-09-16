<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\Medecin;
use App\Entity\User;
use App\Service\EmailVerificationService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Commande de test d'envoi d'email de validation médecin.
 * Usage : php bin/console app:test-email albertngaba@gmail.com
 *
 * À supprimer après validation en production.
 */
#[AsCommand(name: 'app:test-email', description: 'Teste l\'envoi d\'email de validation médecin')]
class TestEmailCommand extends Command
{
    public function __construct(
        private readonly EmailVerificationService $emailService,
        private readonly EntityManagerInterface $entityManager,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('email', InputArgument::REQUIRED, 'Email du destinataire');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io    = new SymfonyStyle($input, $output);
        $email = $input->getArgument('email');

        $io->title('Test email MediSecours+');
        $io->text("Destinataire : {$email}");

        // Chercher un médecin existant avec cet email, ou créer un fake en mémoire
        $user = $this->entityManager->getRepository(User::class)->findOneBy(['email' => $email]);

        if (!$user instanceof Medecin) {
            // Créer un Medecin factice non persisté pour le test
            $user = new Medecin();
            $user->setEmail($email);
            $user->setNom('Ngaba');
            $user->setPrenom('Albert');
            $user->setSpecialite('Cardiologie');
            $io->note('Médecin non trouvé en base — utilisation d\'un profil fictif pour le test.');
        } else {
            $io->text("Médecin trouvé : Dr {$user->getPrenom()} {$user->getNom()}");
        }

        // Test email de validation
        $io->section('Envoi de l\'email de validation...');
        try {
            $this->emailService->sendMedecinValidatedEmail($user);
            $io->success("Email de validation envoyé à {$email}");
        } catch (\Throwable $e) {
            $io->error("Échec email validation : " . $e->getMessage());
            $io->text('Trace : ' . $e->getTraceAsString());
            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }
}
