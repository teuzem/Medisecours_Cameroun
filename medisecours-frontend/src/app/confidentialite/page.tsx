'use client'

import { useTranslation } from 'react-i18next'

import LegalPage from '../../components/legal/LegalPage'

const SECTIONS = [
  { id: 'responsable', label: 'visitor.legal.dataController' },
  { id: 'donnees', label: 'visitor.legal.dataCollected' },
  { id: 'finalites', label: 'visitor.legal.purposes' },
  { id: 'destinataires', label: 'visitor.legal.recipients' },
  { id: 'durees', label: 'visitor.legal.retention' },
  { id: 'droits', label: 'visitor.legal.rights' },
  { id: 'securite', label: 'visitor.legal.security' },
  { id: 'cookies', label: 'visitor.legal.cookies' },
]

/** Politique de protection des données personnelles. */
export default function ConfidentialitePage() {
  const { t } = useTranslation()

  return (
    <LegalPage
      slug="privacy"
      sections={SECTIONS}
      updatedAt={t('visitor.legal.updatedAt', { date: t('visitor.legal.updatedDate') })}
    />
  )
}
