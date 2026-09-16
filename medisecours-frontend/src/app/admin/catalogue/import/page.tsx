// src/app/admin/catalogue/import/page.jsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImportMaladiesModal } from '@/components/admin/ImportMaladiesModal';

export default function ImportMaladiesPage() {
    const [isOpen, setIsOpen] = useState(true);
    const router = useRouter();

    const handleSuccess = () => {
        router.push('/admin/catalogue');
    };

    return (
        <ImportMaladiesModal
            isOpen={isOpen}
            onClose={() => {
                setIsOpen(false);
                router.push('/admin/catalogue');
            }}
            onSuccess={handleSuccess}
        />
    );
}