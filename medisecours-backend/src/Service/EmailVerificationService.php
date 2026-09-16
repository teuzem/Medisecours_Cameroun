<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\User;
use Psr\Log\LoggerInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Gère l'envoi d'emails de vérification et de réinitialisation de mot de passe.
 *
 * En développement : configure MAILER_DSN=smtp://localhost:1025 (Mailpit/Mailtrap).
 * En production : MAILER_DSN=smtp://user:pass@smtp.provider.com:587
 */
class EmailVerificationService
{
    public function __construct(
        private readonly MailerInterface $mailer,
        private readonly EntityManagerInterface $entityManager,
        private readonly LoggerInterface $logger,
        private readonly string $appUrl,
        private readonly string $senderEmail,
        private readonly string $senderName,
    ) {
    }

    /**
     * Génère un token de vérification d'email et envoie l'email de confirmation.
     */
    public function sendVerificationEmail(User $user): void
    {
        $token = bin2hex(random_bytes(32));
        $user->setEmailVerificationToken(hash('sha256', $token));
        $user->setEmailVerificationTokenExpiresAt(new \DateTimeImmutable('+24 hours'));
        $user->setEmailVerified(false);

        $verificationUrl = sprintf('%s/verify-email?token=%s', rtrim($this->appUrl, '/'), $token);

        $email = (new Email())
            ->from(sprintf('%s <%s>', $this->senderName, $this->senderEmail))
            ->to((string) $user->getEmail())
            ->subject('MediSecours+ — Confirmez votre adresse email')
            ->html($this->buildVerificationEmailHtml($user, $verificationUrl))
            ->text($this->buildVerificationEmailText($user, $verificationUrl));

        try {
            $this->mailer->send($email);
            $this->logger->info('Email de vérification envoyé.', ['email' => $user->getEmail()]);
        } catch (\Throwable $e) {
            $this->logger->error('Échec envoi email de vérification.', [
                'email'   => $user->getEmail(),
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Envoie un email de validation du compte médecin (compte approuvé).
     */
    public function sendMedecinValidatedEmail(User $user): void
    {
        $prenom = htmlspecialchars($user->getPrenom() ?? 'Docteur', ENT_QUOTES);
        $nom    = htmlspecialchars($user->getNom() ?? '', ENT_QUOTES);
        $appUrl = rtrim($this->appUrl, '/');

        $html = <<<HTML
        <!DOCTYPE html>
        <html lang="fr">
        <head><meta charset="UTF-8"><title>Compte validé — MediSecours+</title></head>
        <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
          <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 12px; padding: 32px;">
            <h2 style="color: #1E3A5F;">MediSecours+ 🏥</h2>
            <div style="background: #D1FAE5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #065F46; font-weight: bold; font-size: 18px; margin: 0;">✅ Votre compte médecin a été validé !</p>
            </div>
            <p>Bonjour <strong>Dr {$prenom} {$nom}</strong>,</p>
            <p>Nous avons le plaisir de vous informer que votre compte médecin sur <strong>MediSecours+</strong> a été <strong>validé par notre équipe d'administration</strong>.</p>
            <p>Vous pouvez désormais :</p>
            <ul style="color: #374151; line-height: 1.8;">
              <li>Recevoir des messages de patients</li>
              <li>Gérer vos consultations</li>
              <li>Apparaître dans l'annuaire des médecins</li>
            </ul>
            <a href="{$appUrl}/login" style="display:inline-block; margin: 20px 0; padding: 14px 28px; background: #10B981; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Accéder à mon espace
            </a>
            <p style="color: #6B7280; font-size: 13px;">Merci de votre confiance et bienvenue dans la communauté MediSecours+.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            <p style="color: #9CA3AF; font-size: 12px;">
              Cet email a été envoyé à {$user->getEmail()} car vous avez créé un compte médecin sur MediSecours+.<br>
              MediSecours+ — Plateforme médicale d'urgence — Cameroun
            </p>
          </div>
        </body>
        </html>
        HTML;

        $text = "Bonjour Dr {$prenom} {$nom},\n\nVotre compte médecin MediSecours+ a été validé.\nVous pouvez vous connecter sur {$appUrl}/login\n\nCet email a été envoyé à {$user->getEmail()}.\nMediSecours+ — Plateforme médicale d'urgence — Cameroun";

        $email = (new Email())
            ->from(sprintf('%s <%s>', $this->senderName, $this->senderEmail))
            ->to((string) $user->getEmail())
            ->replyTo($this->senderEmail)
            ->subject('MediSecours+ — Votre compte médecin a été validé ✅')
            ->html($html)
            ->text($text)
            ->priority(Email::PRIORITY_HIGH);

        try {
            $this->mailer->send($email);
            $this->logger->info('Email validation médecin envoyé.', ['email' => $user->getEmail()]);
        } catch (\Throwable $e) {
            $this->logger->error('Échec envoi email validation médecin.', ['email' => $user->getEmail(), 'message' => $e->getMessage()]);
            throw $e;
        }
    }

    /**
     * Envoie un email de refus de validation du compte médecin avec motif.
     */
    public function sendMedecinRejectedEmail(User $user, string $motif): void
    {
        $prenom = htmlspecialchars($user->getPrenom() ?? 'Docteur', ENT_QUOTES);
        $nom    = htmlspecialchars($user->getNom() ?? '', ENT_QUOTES);
        $motifHtml = nl2br(htmlspecialchars($motif, ENT_QUOTES));
        $appUrl = rtrim($this->appUrl, '/');

        $html = <<<HTML
        <!DOCTYPE html>
        <html lang="fr">
        <head><meta charset="UTF-8"><title>Validation non accordée — MediSecours+</title></head>
        <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
          <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 12px; padding: 32px;">
            <h2 style="color: #1E3A5F;">MediSecours+ 🏥</h2>
            <div style="background: #FEE2E2; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #991B1B; font-weight: bold; font-size: 18px; margin: 0;">❌ Votre demande de validation n'a pas été accordée</p>
            </div>
            <p>Bonjour <strong>Dr {$prenom} {$nom}</strong>,</p>
            <p>Après examen de votre dossier, nous ne sommes pas en mesure de valider votre compte médecin pour le motif suivant :</p>
            <div style="background: #FFF7ED; border-left: 4px solid #F97316; border-radius: 0 8px 8px 0; padding: 16px; margin: 20px 0; color: #374151;">
              {$motifHtml}
            </div>
            <p>Si vous pensez que cette décision est une erreur ou si vous souhaitez fournir des informations complémentaires, vous pouvez :</p>
            <ul style="color: #374151; line-height: 1.8;">
              <li>Mettre à jour votre profil avec les informations manquantes</li>
              <li>Contacter notre équipe de support</li>
            </ul>
            <a href="{$appUrl}/profil" style="display:inline-block; margin: 20px 0; padding: 14px 28px; background: #1E3A5F; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Mettre à jour mon profil
            </a>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            <p style="color: #9CA3AF; font-size: 12px;">MediSecours+ — Plateforme médicale d'urgence — Cameroun</p>
          </div>
        </body>
        </html>
        HTML;

        $text = "Bonjour Dr {$prenom} {$nom},\n\nVotre demande de validation n'a pas été accordée.\n\nMotif : {$motif}\n\nVous pouvez mettre à jour votre profil sur {$appUrl}/profil\n\nMediSecours+ — Cameroun";

        $email = (new Email())
            ->from(sprintf('%s <%s>', $this->senderName, $this->senderEmail))
            ->to((string) $user->getEmail())
            ->replyTo($this->senderEmail)
            ->subject('MediSecours+ — Votre demande de validation médecin')
            ->html($html)
            ->text($text)
            ->priority(Email::PRIORITY_HIGH);

        try {
            $this->mailer->send($email);
            $this->logger->info('Email refus validation médecin envoyé.', ['email' => $user->getEmail()]);
        } catch (\Throwable $e) {
            $this->logger->error('Échec envoi email refus médecin.', ['email' => $user->getEmail(), 'message' => $e->getMessage()]);
        }
    }

    /**
     * Génère un token de réinitialisation de mot de passe (valide 1h) et envoie l'email.
     */
    public function sendPasswordResetEmail(User $user): void
    {
        $token = bin2hex(random_bytes(32));
        $user->setPasswordResetToken(hash('sha256', $token));
        $user->setPasswordResetTokenExpiresAt(new \DateTimeImmutable('+1 hour'));

        $resetUrl = sprintf('%s/reset-password?token=%s', rtrim($this->appUrl, '/'), $token);

        $email = (new Email())
            ->from(sprintf('%s <%s>', $this->senderName, $this->senderEmail))
            ->to((string) $user->getEmail())
            ->subject('MediSecours+ — Réinitialisation de votre mot de passe')
            ->html($this->buildPasswordResetEmailHtml($user, $resetUrl))
            ->text($this->buildPasswordResetEmailText($user, $resetUrl));

        try {
            $this->mailer->send($email);
            $this->logger->info('Email de réinitialisation envoyé.', ['email' => $user->getEmail()]);
        } catch (\Throwable $e) {
            $this->logger->error('Échec envoi email de réinitialisation.', [
                'email'   => $user->getEmail(),
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Templates email HTML (simples mais professionnels)
    // ─────────────────────────────────────────────────────────────────────────

    private function buildVerificationEmailHtml(User $user, string $url): string
    {
        $prenom = htmlspecialchars($user->getPrenom() ?? 'Utilisateur', ENT_QUOTES);

        return <<<HTML
        <!DOCTYPE html>
        <html lang="fr">
        <head><meta charset="UTF-8"><title>Confirmez votre email — MediSecours+</title></head>
        <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
          <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 12px; padding: 32px;">
            <h2 style="color: #1E3A5F;">MediSecours+ 🏥</h2>
            <p>Bonjour <strong>{$prenom}</strong>,</p>
            <p>Bienvenue sur MediSecours+, votre plateforme médicale d'urgence.</p>
            <p>Cliquez sur le bouton ci-dessous pour confirmer votre adresse email :</p>
            <a href="{$url}" style="display:inline-block; margin: 20px 0; padding: 14px 28px; background: #1E3A5F; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Confirmer mon email
            </a>
            <p style="color: #999; font-size: 13px;">Ce lien est valable 24 heures. Si vous n'avez pas créé de compte sur MediSecours+, ignorez cet email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            <p style="color: #999; font-size: 12px;">MediSecours+ — Application médicale d'urgence — Cameroun</p>
          </div>
        </body>
        </html>
        HTML;
    }

    private function buildVerificationEmailText(User $user, string $url): string
    {
        $prenom = $user->getPrenom() ?? 'Utilisateur';

        return "Bonjour {$prenom},\n\nConfirmez votre email MediSecours+ en cliquant sur ce lien :\n{$url}\n\nCe lien est valable 24 heures.\n\nMediSecours+ — Cameroun";
    }

    private function buildPasswordResetEmailHtml(User $user, string $url): string
    {
        $prenom = htmlspecialchars($user->getPrenom() ?? 'Utilisateur', ENT_QUOTES);

        return <<<HTML
        <!DOCTYPE html>
        <html lang="fr">
        <head><meta charset="UTF-8"><title>Réinitialisation de mot de passe — MediSecours+</title></head>
        <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
          <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 12px; padding: 32px;">
            <h2 style="color: #1E3A5F;">MediSecours+ 🏥</h2>
            <p>Bonjour <strong>{$prenom}</strong>,</p>
            <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
            <a href="{$url}" style="display:inline-block; margin: 20px 0; padding: 14px 28px; background: #EF4444; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Réinitialiser mon mot de passe
            </a>
            <p style="color: #999; font-size: 13px;">Ce lien expire dans <strong>1 heure</strong>. Si vous n'avez pas fait cette demande, ignorez cet email — votre mot de passe ne sera pas modifié.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            <p style="color: #999; font-size: 12px;">MediSecours+ — Application médicale d'urgence — Cameroun</p>
          </div>
        </body>
        </html>
        HTML;
    }

    private function buildPasswordResetEmailText(User $user, string $url): string
    {
        $prenom = $user->getPrenom() ?? 'Utilisateur';

        return "Bonjour {$prenom},\n\nRéinitialisez votre mot de passe MediSecours+ via ce lien (valable 1h) :\n{$url}\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.\n\nMediSecours+ — Cameroun";
    }
}
