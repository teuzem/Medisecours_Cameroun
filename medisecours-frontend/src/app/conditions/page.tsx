'use client'

import { useTranslation } from 'react-i18next'

import LegalPage from '../../components/legal/LegalPage'

const SECTIONS = [
  { id: 'objet', label: 'visitor.legal.purpose' },
  { id: 'comptes', label: 'visitor.legal.accounts' },
  { id: 'obligations', label: 'visitor.legal.obligations' },
  { id: 'sante', label: 'visitor.legal.medical' },
  { id: 'suspension', label: 'visitor.legal.suspension' },
  { id: 'responsabilite', label: 'visitor.legal.liability' },
  { id: 'donnees', label: 'visitor.legal.userData' },
  { id: 'litiges', label: 'visitor.legal.disputes' },
]

/** Conditions générales d'utilisation de la plateforme. */
export default function ConditionsPage() {
  const { t } = useTranslation()

  return (
    <LegalPage
      slug="terms"
      sections={SECTIONS}
      updatedAt={t('visitor.legal.updatedAt', { date: t('visitor.legal.updatedDate') })}
    />
  )
}
