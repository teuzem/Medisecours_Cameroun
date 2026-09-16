// @ts-nocheck
'use client'

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'
import useSWR from 'swr'
import CrudTable from '../../../components/admin/CrudTable'
import { fetcher } from '../../../lib/fetcher'
import CategoryEditModal from '../../../components/admin/CategoryEditModal'
import DiseaseEditModal from '../../../components/admin/DiseaseEditModal'
import DiseaseDetailModal from '../../../components/admin/DiseaseDetailModal'
import PremierSoinEditModal from '../../../components/admin/PremierSoinEditModal'
import { ImportMaladiesModal } from '@/components/admin/ImportMaladiesModal'
import { ImportPremiersSoinsModal } from '@/components/admin/ImportPremiersSoinsModal'

const GRAVITES = ['LÉGÈRE', 'MODÉRÉE', 'SÉVÈRE', 'CRITIQUE', 'VARIABLE']
const URGENCES = ['FAIBLE', 'MOYEN', 'ÉLEVÉ', 'CRITIQUE']

export default function AdminCataloguePage() {
  const { t } = useTranslation()
  const TABS = [
    { key: 'categories',    label: t('admin.catalogue.tabCategories') },
    { key: 'maladies',      label: t('admin.catalogue.tabMaladies') },
    { key: 'premiersSoins', label: t('admin.catalogue.tabPremiersSoins') },
  ]
  const [tab, setTab] = useState('categories')
  const [showImportModal, setShowImportModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleImportSuccess = () => {
    setRefreshKey((k) => k + 1)
    setShowImportModal(false)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-[linear-gradient(135deg,#09170f_0%,#0f2418_60%,#183626_100%)] p-6 text-white shadow-[0_18px_45px_rgba(15,36,24,0.16)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">{t('admin.catalogue.eyebrow')}</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">{t('admin.catalogue.title')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
          {t('admin.catalogue.description')}
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tabDef) => (
          <button
            key={tabDef.key}
            onClick={() => setTab(tabDef.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === tabDef.key
                ? 'bg-[#0f2418] text-white'
                : 'border border-[#dfe5db] bg-white text-[#5f6c5d] hover:bg-[#edf2ea]'
            }`}
          >
            {tabDef.label}
          </button>
        ))}
      </div>

      {tab === 'categories' && (
        <CrudTable
          endpoint="/api/categories"
          title={t('admin.catalogue.categoriesTitle')}
          description={t('admin.catalogue.categoriesDesc')}
          createLabel={t('admin.catalogue.createCategorie')}
          previewKeys={['icone', 'nom']}
          fields={[
            { key: 'icone', label: t('admin.catalogue.fieldIcone'), type: 'icon-picker' },
            { key: 'nom', label: t('admin.catalogue.fieldNom'), type: 'text' },
            { key: 'couleur', label: t('admin.catalogue.fieldCouleur'), type: 'color' },
            { key: 'description', label: t('admin.catalogue.fieldDescription'), type: 'textarea' },
          ]}
          editModal={(props) => <CategoryEditModal {...props} />}
        />
      )}

      {tab === 'maladies' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{t('admin.catalogue.gestionMaladies')}</h2>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-mint-500 text-white rounded-md hover:bg-mint-600 inline-flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {t('admin.catalogue.importerMaladies')}
            </button>
          </div>

          <ImportMaladiesModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            onSuccess={handleImportSuccess}
          />

          <CrudTable
            key={refreshKey}
            endpoint="/api/maladies"
            title={t('admin.catalogue.maladiesTitle')}
            description={t('admin.catalogue.maladiesDesc')}
            createLabel={t('admin.catalogue.createMaladie')}
            previewKeys={['imageUrl', 'nom', 'niveauGravite', 'categorie']}
            searchEndpoint="/api/maladies/search"
            fields={[
              { key: 'nom', label: t('admin.catalogue.fieldNom'), type: 'text' },
              { key: 'niveauGravite', label: t('admin.catalogue.fieldNiveauGravite'), type: 'select', options: GRAVITES },
              { key: 'imageUrl', label: t('admin.catalogue.fieldImageUrl'), type: 'image' },
              { key: 'categorie', label: t('admin.catalogue.fieldCategorie'), type: 'select-api', endpoint: '/api/categories', displayKey: 'nom' },
              { key: 'urgence', label: t('admin.catalogue.fieldUrgence'), type: 'checkbox' },
              { key: 'contagieux', label: t('admin.catalogue.fieldContagieux'), type: 'checkbox' },
              { key: 'isAccident', label: t('admin.catalogue.fieldAccident'), type: 'checkbox' },
              { key: 'typeAccident', label: t('admin.catalogue.fieldTypeAccident'), type: 'text' },
              { key: 'description', label: t('admin.catalogue.fieldDescription'), type: 'textarea' },
              { key: 'symptomes', label: t('admin.catalogue.fieldSymptomes'), type: 'textarea' },
              { key: 'causes', label: t('admin.catalogue.fieldCauses'), type: 'textarea' },
              { key: 'precautions', label: t('admin.catalogue.fieldPrecautions'), type: 'textarea' },
              { key: 'traitement', label: t('admin.catalogue.fieldTraitement'), type: 'textarea' },
            ]}
            editModal={(props) => <DiseaseEditModal {...props} />}
            detailModal={({ item, onClose, onMutate }) => <DiseaseDetailModal maladie={item} onClose={onClose} onMutate={onMutate} />}
          />
        </div>
      )}

      {tab === 'premiersSoins' && <PremierSoinsTab />}
    </div>
  )
}

function PremierSoinsTab() {
  const { t } = useTranslation()
  const [showImportPSModal, setShowImportPSModal] = useState(false)
  const [refreshKeyPS, setRefreshKeyPS] = useState(0)
  const { data: maladies = [] } = useSWR('/api/maladies', fetcher, { revalidateOnFocus: false })
  const maladieMap = useMemo(() => {
    const map = {}
    maladies.forEach((m) => { map[m['@id']] = m.nom })
    return map
  }, [maladies])

  const handleImportPSSuccess = () => {
    setRefreshKeyPS((k) => k + 1)
    setShowImportPSModal(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">{t('admin.catalogue.gestionPremiersSoins')}</h2>
        <button
          onClick={() => setShowImportPSModal(true)}
          className="px-4 py-2 bg-mint-500 text-white rounded-md hover:bg-mint-600 inline-flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          {t('admin.catalogue.importerPremiersSoins')}
        </button>
      </div>

      <ImportPremiersSoinsModal
        isOpen={showImportPSModal}
        onClose={() => setShowImportPSModal(false)}
        onSuccess={handleImportPSSuccess}
      />

      <CrudTable
        key={refreshKeyPS}
        endpoint="/api/premier_soins"
        title={t('admin.catalogue.premiersSoinsTitle')}
        description={t('admin.catalogue.premiersSoinsDesc')}
        createLabel={t('admin.catalogue.createFiche')}
        previewKeys={['titre', 'niveauUrgence', 'maladie']}
        fields={[
          { key: 'titre', label: t('admin.catalogue.fieldTitre'), type: 'text' },
          { key: 'niveauUrgence', label: t('admin.catalogue.fieldNiveauUrgence'), type: 'select', options: URGENCES },
          { key: 'maladie', label: t('admin.catalogue.fieldMaladie'), type: 'select-api', endpoint: '/api/maladies', displayKey: 'nom',
            render: (value) => typeof value === 'string' ? (maladieMap[value] || value.split('/').pop()) : String(value ?? '-') },
          { key: 'description', label: t('admin.catalogue.fieldDescription'), type: 'textarea' },
          { key: 'symptomes', label: t('admin.catalogue.fieldSymptomes'), type: 'textarea' },
        ]}
        editModal={(props) => <PremierSoinEditModal {...props} />}
      />
    </div>
  )
}
