'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImportMedecinsModal } from '@/components/admin/ImportMedecinsModal'

export default function ImportMedecinsPage() {
  const router = useRouter()

  return (
    <ImportMedecinsModal
      isOpen
      onClose={() => router.push('/admin/medecins')}
      onSuccess={() => router.push('/admin/medecins')}
    />
  )
}