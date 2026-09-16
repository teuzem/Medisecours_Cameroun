<?php

declare(strict_types=1);

namespace App\EventListener;

use App\Entity\MediaObject;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\PrePersistEventArgs;
use Doctrine\ORM\Event\PreUpdateEventArgs;

/**
 * Stocke le contenu binaire des fichiers uploadés dans la base de données.
 *
 * Le disque du conteneur Render est éphémère : les fichiers écrits dans
 * var/uploads/media sont perdus à chaque redéploiement. En copiant le contenu
 * dans MediaObject::$data (base64), les médias survivent aux redéploiements.
 */
#[AsDoctrineListener(event: 'prePersist', priority: 10)]
#[AsDoctrineListener(event: 'preUpdate', priority: 10)]
final class MediaDataListener
{
    public function prePersist(PrePersistEventArgs $args): void
    {
        $this->capture($args->getObject());
    }

    public function preUpdate(PreUpdateEventArgs $args): void
    {
        $this->capture($args->getObject());
    }

    private function capture(object $entity): void
    {
        if (!$entity instanceof MediaObject) {
            return;
        }

        $file = $entity->getFile();
        if ($file === null) {
            return;
        }

        $entity->setData($file->getContent());
    }
}
