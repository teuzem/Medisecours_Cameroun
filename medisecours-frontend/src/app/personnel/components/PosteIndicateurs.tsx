'use client'

import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import { Activity, Ambulance, ClipboardList, Package, Users } from 'lucide-react'

import api from '../../../api/axios'
import GlassCard from '../../../components/ui/GlassCard'
import StatCard from '../../../components/ui/StatCard'

type DashboardPayload = {
  typePersonnel?: string
  etablissement?: { id: number; nom: string }
  stats?: any
  dossiers?: { total: number; visites: number; statuts: Record<string, number> }
}

/**
 * Bandeau d'indicateurs du poste, commun aux pages opérationnelles
 * (accueil, soins, pharmacie, ambulance).
 *
 * Les chiffres proviennent du même endpoint que le tableau de bord : une
 * seule source de vérité, et chaque soignant voit l'état de son poste sans
 * quitter son outil de travail.
 */
export default function PosteIndicateurs() {
  const { t } = useTranslation()

  const { data } = useSWR<DashboardPayload>(
    '/api/personnel/dashboard',
    async (url: string) => {
      const res = await api.get(url)
      return res.data
    },
    { revalidateOnFocus: false, keepPreviousData: true },
  )

  if (!data) return null

  const type = data.typePersonnel
  const stats = data.stats ?? {}

  return (
    <GlassCard className="mb-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {type === 'RECEPTIONNISTE' && (
          <>
            <StatCard label={t('personnel.dashboard.dossiersOuverts')} value={stats?.dossiersOuverts ?? 0} icon={ClipboardList} tile="blue" />
            <StatCard label={t('personnel.dashboard.admissionsJour')} value={stats?.admissionsJour ?? 0} icon={Users} tile="mint" />
          </>
        )}
        {(type === 'INFIRMIER' || type === 'AIDE_SOIGNANT') && (
          <>
            <StatCard label={t('personnel.dashboard.soinsPlanifies')} value={stats?.soins?.PLANIFIE ?? 0} icon={Activity} tile="blue" />
            <StatCard label={t('personnel.dashboard.soinsRealisesJour')} value={stats?.realisesJour ?? 0} icon={ClipboardList} tile="mint" />
          </>
        )}
        {type === 'PHARMACIEN' && (
          <>
            <StatCard label={t('personnel.dashboard.ordonnancesRecues')} value={stats?.ordonnances?.RECUE ?? 0} icon={Package} tile="blue" />
            <StatCard label={t('personnel.dashboard.aAdministrer')} value={stats?.ordonnances?.A_ADMINISTRER ?? 0} icon={ClipboardList} tile="mint" />
          </>
        )}
        {type === 'AMBULANCIER' && (
          <>
            <StatCard label={t('personnel.dashboard.interventionsJour')} value={stats?.interventionsJour ?? 0} icon={Ambulance} tile="red" />
            <StatCard label={t('personnel.dashboard.sosEnCours')} value={stats?.sos?.EN_COURS ?? 0} icon={Activity} tile="amber" />
          </>
        )}

        {data.dossiers && (
          <>
            <StatCard label={t('personnel.dossier.visites')} value={data.dossiers.visites ?? 0} icon={ClipboardList} tile="violet" />
            <StatCard label={t('personnel.dashboard.repartitionDossiers')} value={data.dossiers.total ?? 0} icon={Users} tile="teal" />
          </>
        )}
      </div>
    </GlassCard>
  )
}
