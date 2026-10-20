'use client'

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import {
  Activity,
  Ambulance,
  Award,
  ClipboardList,
  Package,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import api from '../../../api/axios'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import GlassCard from '../../../components/ui/GlassCard'
import StatCard from '../../../components/ui/StatCard'

async function dashboardFetcher(url: string) {
  const res = await api.get(url)
  return res.data
}

const CHART_COLORS = ['#1E3A5F', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

type ActivitePoint = {
  date: string
  admissions: number
  soins: number
  consultations: number
  pharmacie: number
}

function ReceptionStats({ stats }: { stats: Record<string, number> }) {
  const { t } = useTranslation()
  return (
    <>
      <StatCard label={t('personnel.dashboard.dossiersOuverts')} value={stats?.dossiersOuverts ?? 0} icon={ClipboardList} tile="blue" />
      <StatCard label={t('personnel.dashboard.admissionsJour')} value={stats?.admissionsJour ?? 0} icon={Users} tile="mint" />
    </>
  )
}

function CareStats({ stats }: { stats: any }) {
  const { t } = useTranslation()
  return (
    <>
      <StatCard label={t('personnel.dashboard.soinsPlanifies')} value={stats?.soins?.PLANIFIE ?? 0} icon={Activity} tile="blue" />
      <StatCard label={t('personnel.dashboard.soinsRealisesJour')} value={stats?.realisesJour ?? 0} icon={ClipboardList} tile="mint" />
    </>
  )
}

function PharmacyStats({ stats }: { stats: any }) {
  const { t } = useTranslation()
  return (
    <>
      <StatCard label={t('personnel.dashboard.ordonnancesRecues')} value={stats?.ordonnances?.RECUE ?? 0} icon={Package} tile="blue" />
      <StatCard label={t('personnel.dashboard.enAttentePaiement')} value={stats?.ordonnances?.FACTUREE ?? 0} icon={ClipboardList} tile="amber" />
      <StatCard label={t('personnel.dashboard.aAdministrer')} value={stats?.ordonnances?.A_ADMINISTRER ?? 0} icon={Activity} tile="mint" />
    </>
  )
}

function AmbulanceStats({ stats }: { stats: any }) {
  const { t } = useTranslation()
  return (
    <>
      <StatCard label={t('personnel.dashboard.interventionsJour')} value={stats?.interventionsJour ?? 0} icon={Ambulance} tile="red" />
      <StatCard
        label={t('personnel.dashboard.sosEnCours')}
        value={stats?.sos?.EN_COURS ?? stats?.sos?.EN_COURSE ?? 0}
        icon={Activity}
        tile="amber"
      />
    </>
  )
}

/** Courbe d'activité des 14 derniers jours (admissions, soins, consultations). */
function ActiviteChart({ activite }: { activite: ActivitePoint[] }) {
  const { t, i18n } = useTranslation()

  const data = useMemo(
    () =>
      (activite ?? []).map((point) => ({
        ...point,
        jour: new Date(point.date).toLocaleDateString(i18n.language?.startsWith('en') ? 'en-GB' : 'fr-CM', {
          day: '2-digit',
          month: '2-digit',
        }),
      })),
    [activite, i18n.language],
  )

  if (data.length === 0) {
    return <p className="px-2 py-8 text-center text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t('personnel.dashboard.pasDeDonnees')}</p>
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="admGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1E3A5F" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#1E3A5F" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="soinGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="jour" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }}
            labelStyle={{ fontWeight: 700 }}
          />
          <Area
            type="monotone"
            dataKey="admissions"
            name={t('personnel.dashboard.admissions')}
            stroke="#1E3A5F"
            strokeWidth={2}
            fill="url(#admGradient)"
          />
          <Area
            type="monotone"
            dataKey="soins"
            name={t('personnel.dashboard.soins')}
            stroke="#10B981"
            strokeWidth={2}
            fill="url(#soinGradient)"
          />
          <Area
            type="monotone"
            dataKey="consultations"
            name={t('personnel.dashboard.consultations')}
            stroke="#F59E0B"
            strokeWidth={2}
            fillOpacity={0}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Répartition des dossiers (ouverts / clos) en anneau. */
function DossiersChart({ dossiers }: { dossiers: any }) {
  const { t } = useTranslation()

  const data = useMemo(
    () => [
      { name: t('personnel.dashboard.dossiersOuverts'), value: dossiers?.statuts?.OUVERT ?? 0 },
      { name: t('personnel.dashboard.dossiersClos'), value: dossiers?.statuts?.CLOS ?? 0 },
    ],
    [dossiers, t],
  )

  if ((dossiers?.total ?? 0) === 0) {
    return <p className="px-2 py-8 text-center text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t('personnel.dashboard.pasDeDonnees')}</p>
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="86%"
            paddingAngle={3}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }}
            labelStyle={{ fontWeight: 700 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Distribution des notes reçues par les patients (1 à 5 étoiles). */
function NotationChart({ notation }: { notation: any }) {
  const { t } = useTranslation()

  const data = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((note) => ({
        note: `${note}★`,
        total: notation?.distribution?.[note] ?? 0,
      })),
    [notation],
  )

  if ((notation?.totalAvis ?? 0) === 0) {
    return <p className="px-2 py-8 text-center text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t('personnel.dashboard.pasAvis')}</p>
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="note" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }}
            labelStyle={{ fontWeight: 700 }}
            cursor={{ fill: 'rgba(30,58,95,0.05)' }}
          />
          <Bar dataKey="total" name={t('personnel.dashboard.avis')} radius={[6, 6, 0, 0]} maxBarSize={38}>
            {data.map((entry, index) => (
              <Cell key={entry.note} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
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
  const notation = data?.notation ?? {}
  const identite = data?.identite ?? {}
  const noteMoyenne = Number(notation.noteMoyenne ?? 0)

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-[#0F2C52] dark:text-white">
            {t('personnel.dashboard.titre')}
          </h2>
          <p className="mt-1 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            {type ? t(`personnel.layout.poste.${type}`) : ''} · {data?.etablissement?.nom ?? ''}
          </p>
        </div>

        {/* Notation reçue par les patients : visible par le personnel, c'est
            la contrepartie mesurable de la confiance de la population. */}
        <GlassCard className="flex items-center gap-3 px-4 py-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/15 text-amber-500">
            <Award className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7280] dark:text-[#9CA3AF]">
              {t('personnel.dashboard.notationRecue')}
            </p>
            <p className="flex items-center gap-1 text-lg font-extrabold text-[#0F2C52] dark:text-white">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              {noteMoyenne > 0 ? noteMoyenne.toFixed(1) : '—'}
              <span className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
                ({notation.totalAvis ?? 0})
              </span>
            </p>
          </div>
        </GlassCard>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {type === 'RECEPTIONNISTE' && <ReceptionStats stats={stats} />}
        {(type === 'INFIRMIER' || type === 'AIDE_SOIGNANT') && <CareStats stats={stats} />}
        {type === 'PHARMACIEN' && <PharmacyStats stats={stats} />}
        {type === 'AMBULANCIER' && <AmbulanceStats stats={stats} />}
      </div>

      {/* Suivi de l'activité */}
      <GlassCard className="mt-4 p-4 sm:p-5">
        <header className="mb-3 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F2C52] dark:text-white">
            <TrendingUp className="h-4 w-4 text-[#1E3A5F] dark:text-white/70" />
            {t('personnel.dashboard.activite14j')}
          </h3>
          <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
            {t('personnel.dashboard.visitesTotales')} : {data?.dossiers?.visites ?? 0}
          </span>
        </header>
        <ActiviteChart activite={data?.activite ?? []} />
      </GlassCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-4 sm:p-5">
          <h3 className="mb-2 text-sm font-bold text-[#0F2C52] dark:text-white">
            {t('personnel.dashboard.repartitionDossiers')}
          </h3>
          <DossiersChart dossiers={data?.dossiers} />
        </GlassCard>

        <GlassCard className="p-4 sm:p-5">
          <h3 className="mb-2 text-sm font-bold text-[#0F2C52] dark:text-white">
            {t('personnel.dashboard.notesRecues')}
          </h3>
          <NotationChart notation={notation} />
        </GlassCard>
      </div>

      {identite?.fonction || identite?.numeroOrdre ? (
        <GlassCard className="mt-4 p-4 sm:p-5">
          <h3 className="mb-2 text-sm font-bold text-[#0F2C52] dark:text-white">
            {t('personnel.dashboard.identiteProfessionnelle')}
          </h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-[#6B7280] dark:text-[#9CA3AF]">
                {t('personnel.dashboard.fonction')}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-[#0F2C52] dark:text-white">
                {identite.fonction || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-[#6B7280] dark:text-[#9CA3AF]">
                {t('personnel.dashboard.numeroOrdre')}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-[#0F2C52] dark:text-white">
                {identite.numeroOrdre || '—'}
              </dd>
            </div>
          </dl>
        </GlassCard>
      ) : null}
    </div>
  )
}
