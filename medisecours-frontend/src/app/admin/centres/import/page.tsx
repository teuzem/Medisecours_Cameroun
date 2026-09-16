'use client'

import { useRouter } from 'next/navigation'
import { ImportCentresModal } from '@/components/admin/ImportCentresModal'

export default function ImportCentresPage() {
  const router = useRouter()

  return (
    <ImportCentresModal
      isOpen
      onClose={() => router.push('/admin/centres')}
      onSuccess={() => router.push('/admin/centres')}
    />
  )
}
