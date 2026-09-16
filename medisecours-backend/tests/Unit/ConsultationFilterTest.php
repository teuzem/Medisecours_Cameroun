<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use App\Entity\Consultation;
use PHPUnit\Framework\TestCase;

final class ConsultationFilterTest extends TestCase
{
    public function testConsultationStatusHasAnExactApiFilter(): void
    {
        $reflection = new \ReflectionClass(Consultation::class);
        $attributes = $reflection->getAttributes(ApiFilter::class);

        self::assertNotEmpty($attributes);

        $statusFilter = null;
        foreach ($attributes as $attribute) {
            $filter = $attribute->newInstance();
            if ($filter->filterClass === SearchFilter::class) {
                $statusFilter = $filter;
                break;
            }
        }

        self::assertNotNull($statusFilter);
        self::assertSame('exact', $statusFilter->properties['statut'] ?? null);
    }
}
