'use client'

import { useTranslation } from 'react-i18next'
import SectionHeader from '../../../components/ui/SectionHeader'
import SignatureSettings from '../../../components/medecin/SignatureSettings'
import PersonnelCouverture from './PersonnelCouverture'

/**
 * Paramètres du personnel de santé : la signature numérique enregistrée
 * ici pré-remplit le pad de signature des soins réalisés et accompagne les
 * documents du circuit hospitalier (non-répudiation).
 */
export default function PersonnelParametresPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 px-3 py-6 sm:px-6">
      <SectionHeader
        title={t('personnel.parametres.titre')}
        description={t('personnel.parametres.description')}
      />
      <div className="mt-5 space-y-5">
        <PersonnelCouverture />
        <SignatureSettings />
      </div>
    </div>
  )
}
