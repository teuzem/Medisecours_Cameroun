'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function ParametresPage() {
  const router = useRouter()
  const { t } = useTranslation()

  useEffect(() => {
    router.replace('/medecin/profil')
  }, [router])

  return <LoadingSpinner label={t('medecin.settings.redirecting')} />
}
