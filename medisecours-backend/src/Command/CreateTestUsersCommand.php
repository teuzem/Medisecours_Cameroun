<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\Admin;
use App\Entity\Medecin;
use App\Entity\Patient;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

#[AsCommand(
    name: 'app:create-test-users',
    description: 'Crée des utilisateurs de test (patient, médecin, admin)',
)]
class CreateTestUsersCommand extends Command
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly UserPasswordHasherInterface $passwordHasher,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        // Admin
        $admin = $this->entityManager->getRepository(User::class)->findOneBy(['email' => 'admin@medisecours.com']);
        if (!$admin) {
          $admin = new Admin();
          $admin->setEmail('admin@medisecours.com');
          $admin->setNom('Admin');
          $admin->setPrenom('Super');
          $admin->setTelephone('+237 690000000');
          $admin->setQuartier('Bastos');
          $admin->setEmailVerified(true);
          $io->info('Creating admin user...');
        } else if (!($admin instanceof Admin)) {
          $io->warning('admin@medisecours.com exists but is not an Admin, skipping...');
          $admin = null;
        }
        if ($admin) {
          $admin->setPassword($this->passwordHasher->hashPassword($admin, 'Admin@2026!'));
          $admin->setRoles(['ROLE_ADMIN', 'ROLE_USER']);
          $this->entityManager->persist($admin);
        }

        // Patient
        $patient = $this->entityManager->getRepository(User::class)->findOneBy(['email' => 'patient@test.com']);
        if (!$patient) {
          $patient = new Patient();
          $patient->setEmail('patient@test.com');
          $patient->setNom('Test');
          $patient->setPrenom('Patient');
          $patient->setTelephone('+237 612345678');
          $patient->setQuartier('Akwa');
          $patient->setEmailVerified(true);
          $patient->setGroupeSanguin('O+');
          $patient->setAllergies(['Pénicilline']);
          $patient->setContactsUrgence([
            ['nom' => 'Marie Test', 'telephone' => '+237 687654321', 'lien' => 'Mère'],
          ]);
          $io->info('Creating patient user...');
        } else if (!($patient instanceof Patient)) {
          $io->warning('patient@test.com exists but is not a Patient, skipping...');
          $patient = null;
        }
        if ($patient) {
          $patient->setPassword($this->passwordHasher->hashPassword($patient, 'Patient@2026!'));
          $this->entityManager->persist($patient);
        }

        // Medecin (validé)
        $medecin = $this->entityManager->getRepository(User::class)->findOneBy(['email' => 'medecin@test.com']);
        if (!$medecin) {
          $medecin = new Medecin();
          $medecin->setEmail('medecin@test.com');
          $medecin->setNom('Test');
          $medecin->setPrenom('Medecin');
          $medecin->setTelephone('+237 687654321');
          $medecin->setQuartier('Bonanjo');
          $medecin->setSpecialite('Médecine générale');
          $medecin->setNumeroOrdre('CM-ORD-12345');
          $medecin->setEstValide(true);
          $medecin->setEmailVerified(true);
          $medecin->setDisponibilites([
            ['jour' => 'lundi', 'debut' => '08:00', 'fin' => '17:00'],
            ['jour' => 'mardi', 'debut' => '08:00', 'fin' => '17:00'],
            ['jour' => 'mercredi', 'debut' => '08:00', 'fin' => '17:00'],
          ]);
          $io->info('Creating medecin user...');
        } else if (!($medecin instanceof Medecin)) {
          $io->warning('medecin@test.com exists but is not a Medecin, skipping...');
          $medecin = null;
        }
        if ($medecin) {
          $medecin->setPassword($this->passwordHasher->hashPassword($medecin, 'Medecin@2026!'));
          $this->entityManager->persist($medecin);
        }

        $this->entityManager->flush();

        $io->success('Utilisateurs de test créés avec succès !');
        $io->listing([
            'Admin: admin@medisecours.com / Admin@2026!',
            'Patient: patient@test.com / Patient@2026!',
            'Médecin: medecin@test.com / Medecin@2026!',
        ]);

        return Command::SUCCESS;
    }
}
