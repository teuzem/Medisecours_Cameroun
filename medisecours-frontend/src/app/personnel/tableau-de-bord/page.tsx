'use client'

import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import { ClipboardList, Package, Activity, Users } from 'lucide-react'
import api from '../../../api/axios'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import GlassCard from '../../../components/ui/GlassCard'
import StatCard from '../../../components/ui/StatCard'

async function dashboardFetcher(url: string) {
  const res = await api.get(url)
  return res.data
}

function ReceptionStats({ stats }: { stats: Record<string, number> }) {
  const { t } = useTranslation()
  return (
    <>
      <StatCard label={t('personnel.dashboard.dossiersOuverts')} value={stats?.dossiersOuverts ?? 0} icon={ClipboardList} />
      <StatCard label={t('personnel.dashboard.admissionsJour')} value={stats?.admissionsJour ?? 0} icon={Users} />
    </>
  )
}

function CareStats({ stats }: { stats: any }) {
  const { t } = useTranslation()
  return (
    <>
      <StatCard label={t('personnel.dashboard.soinsPlanifies')} value={stats?.soins?.PLANIFIE ?? 0} icon={Activity} />
      <StatCard label={t('personnel.dashboard.soinsRealisesJour')} value={stats?.realisesJour ?? 0} icon={ClipboardList} />
    </>
  )
}

function PharmacyStats({ stats }: { stats: any }) {
  const { t } = useTranslation()
  return (
    <>
      <StatCard label={t('personnel.dashboard.ordonnancesRecues')} value={stats?.ordonnances?.RECUE ?? 0} icon={Package} />
      <StatCard label={t('personnel.dashboard.enAttentePaiement')} value={stats?.ordonnances?.FACTUREE ?? 0} icon={ClipboardList} />
      <StatCard label={t('personnel.dashboard.aAdministrer')} value={stats?.ordonnances?.A_ADMINISTRER ?? 0} icon={Activity} />
    </>
  )
}

export default function PersonnelDashboardPage() {
  const { t } = useTranslation()
  const { data, isLoading, error } = useSWR('/api/personnel/dashboard', dashboardFetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  if (isLoading) {
    return <div className="flex justify-center py-24"><LoadingSpinner /></div>
  }

  if (error) {
    return (
      <div className="p-6">
        <GlassCard className="p-6 text-center text-sm text-[#6B7280] dark:text-[#9CA3AF]">
          {t('personnel.commun.erreur')}
        </GlassCard>
      </div>
    )
  }

  const type = data?.typePersonnel as string | undefined
  const stats = data?.stats ?? {}

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h2 className="font-display text-lg font-bold text-[#0F2C52] dark:text-white">
        {t('personnel.dashboard.titre')}
      </h2>
      <p className="mt-1 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
        {type ? t(`personnel.layout.poste.${type}`) : ''} · {data?.etablissement?.nom ?? ''}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {type === 'RECEPTIONNISTE' && <ReceptionStats stats={stats} />}
        {(type === 'INFIRMIER' || type === 'AIDE_SOIGNANT') && <CareStats stats={stats} />}
        {type === 'PHARMACIEN' && <PharmacyStats stats={stats} />}
      </div>
    </div>
  )
}
