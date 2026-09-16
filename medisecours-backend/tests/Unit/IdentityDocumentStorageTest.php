<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\Medecin;
use App\Entity\MediaObject;
use App\Service\IdentityDocumentStorage;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

final class IdentityDocumentStorageTest extends TestCase
{
    /** @var list<string> */
    private array $temporaryFiles = [];

    protected function tearDown(): void
    {
        foreach ($this->temporaryFiles as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }
    }

    public function testVerificationPhotoIsStoredAsPrivateIdentityMedia(): void
    {
        $file = $this->uploadedPng('portrait.png');
        $doctor = new Medecin();

        $media = (new IdentityDocumentStorage())->createVerificationPhoto($file, $doctor);

        self::assertFalse($media->isPublic());
        self::assertTrue($media->isIdentityVerificationMedia());
        self::assertSame(MediaObject::PURPOSE_IDENTITY_PHOTO, $media->getPurpose());
        self::assertSame($doctor, $media->getUploadedBy());
        self::assertSame('image/png', $media->getMimeType());
        self::assertNotNull($media->getData());
    }

    public function testPdfCannotBeUsedAsVerificationPhoto(): void
    {
        $path = $this->temporaryFile('%PDF-1.4 test');
        $file = new UploadedFile($path, 'document.pdf', 'application/pdf', null, true);

        $this->expectException(UnprocessableEntityHttpException::class);
        (new IdentityDocumentStorage())->createVerificationPhoto($file, new Medecin());
    }

    public function testDoctorIdentityFileIsCompleteOnlyWithBothFilesAndAValidType(): void
    {
        $doctor = (new Medecin())
            ->setTypePieceIdentite('CNI')
            ->setPieceIdentite((new MediaObject())->setPurpose(MediaObject::PURPOSE_IDENTITY_DOCUMENT));

        self::assertFalse($doctor->hasCompleteIdentityVerificationFile());

        $doctor->setPhotoVerificationIdentite(
            (new MediaObject())->setPurpose(MediaObject::PURPOSE_IDENTITY_PHOTO)
        );

        self::assertFalse($doctor->hasCompleteIdentityVerificationFile());
        $doctor->setPieceIdentiteVerso(
            (new MediaObject())->setPurpose(MediaObject::PURPOSE_IDENTITY_DOCUMENT)
        );
        self::assertTrue($doctor->hasCompleteIdentityVerificationFile());
        $doctor->setTypePieceIdentite('PERMIS');
        self::assertFalse($doctor->hasCompleteIdentityVerificationFile());
    }

    public function testPassportDoesNotRequireABackSide(): void
    {
        $doctor = (new Medecin())
            ->setTypePieceIdentite('PASSPORT')
            ->setPieceIdentite((new MediaObject())->setPurpose(MediaObject::PURPOSE_IDENTITY_DOCUMENT))
            ->setPhotoVerificationIdentite((new MediaObject())->setPurpose(MediaObject::PURPOSE_IDENTITY_PHOTO));

        self::assertTrue($doctor->hasCompleteIdentityVerificationFile());
    }

    private function uploadedPng(string $name): UploadedFile
    {
        $png = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            true
        );
        self::assertIsString($png);

        return new UploadedFile($this->temporaryFile($png), $name, 'image/png', null, true);
    }

    private function temporaryFile(string $contents): string
    {
        $path = tempnam(sys_get_temp_dir(), 'medisecours-identity-');
        self::assertIsString($path);
        file_put_contents($path, $contents);
        $this->temporaryFiles[] = $path;

        return $path;
    }
}
