<?php

namespace App\Command;

use App\Entity\Admin;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

#[AsCommand(
    name: 'app:create-admin',
    description: 'Cree ou met a jour un compte administrateur local.'
)]
class CreateAdminCommand extends Command
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly UserPasswordHasherInterface $passwordHasher,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('email', InputArgument::REQUIRED, 'Email de connexion admin')
            ->addArgument('password', InputArgument::REQUIRED, 'Mot de passe admin')
            ->addOption('nom', null, InputOption::VALUE_REQUIRED, 'Nom de l\'admin', 'Admin')
            ->addOption('prenom', null, InputOption::VALUE_REQUIRED, 'Prenom de l\'admin', 'MediSecours')
            ->addOption('telephone', null, InputOption::VALUE_REQUIRED, 'Telephone de l\'admin')
            ->addOption('quartier', null, InputOption::VALUE_REQUIRED, 'Quartier de l\'admin');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $email = strtolower(trim((string) $input->getArgument('email')));
        $password = (string) $input->getArgument('password');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $io->error('Email invalide.');
            return Command::INVALID;
        }

        if (strlen($password) < 8) {
            $io->error('Le mot de passe doit contenir au moins 8 caracteres.');
            return Command::INVALID;
        }

        $user = $this->entityManager->getRepository(User::class)->findOneBy(['email' => $email]);
        $created = false;

        if (!$user) {
            // L'admin est maintenant créé correctement avec l'entité Admin
            $user = new Admin();
            $user->setEmail($email);
            // L'email de l'admin créé en CLI est considéré comme vérifié
            $user->setEmailVerified(true);
            $created = true;
        }

        $roles = $user->getRoles();
        $roles[] = 'ROLE_ADMIN';
        $user->setRoles(array_values(array_unique($roles)));
        $user->setPassword($this->passwordHasher->hashPassword($user, $password));
        $user->setNom((string) $input->getOption('nom'));
        $user->setPrenom((string) $input->getOption('prenom'));

        if ($input->getOption('telephone')) {
            $user->setTelephone((string) $input->getOption('telephone'));
        }
        if ($input->getOption('quartier')) {
            $user->setQuartier((string) $input->getOption('quartier'));
        }

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        $io->success(sprintf(
            $created ? 'Administrateur cree : %s' : 'Administrateur mis a jour : %s',
            $email
        ));

        return Command::SUCCESS;
    }
}