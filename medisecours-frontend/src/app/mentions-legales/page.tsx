'use client'

import { useTranslation } from 'react-i18next'

import LegalPage from '../../components/legal/LegalPage'

const SECTIONS = [
  { id: 'editeur', label: 'visitor.legal.editor' },
  { id: 'hebergement', label: 'visitor.legal.hosting' },
  { id: 'contact', label: 'visitor.legal.contact' },
  { id: 'propriete', label: 'visitor.legal.property' },
  { id: 'responsabilite', label: 'visitor.legal.liability' },
  { id: 'signalement', label: 'visitor.legal.report' },
]

/** Mentions légales de la plateforme. */
export default function MentionsLegalesPage() {
  const { t } = useTranslation()

  return (
    <LegalPage
      slug="mentions"
      sections={SECTIONS}
      updatedAt={t('visitor.legal.updatedAt', { date: t('visitor.legal.updatedDate') })}
    />
  )
}
