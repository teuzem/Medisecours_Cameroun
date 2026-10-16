'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  AlarmClock,
  Building2,
  Filter,
  Loader2,
  MapPin,
  Phone,
  Radio,
  RefreshCw,
  ShieldAlert,
  Siren,
  TrendingUp,
  Video,
  Camera,
} from 'lucide-react'

import { fetcher } from '../../../lib/fetcher'
import { useNotification } from '../../../contexts/NotificationContext'
import { SosPosition } from '../../../components/sos/SosPosition'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

interface AlerteAdmin {
  id: number
  statut: string
  gravite: string
  urgenceVitale: boolean
  agePatient: number | null
  enceinte: boolean
  nom: string | null
  telephone: string | null
  description: string | null
  latitude: number | null
  longitude: number | null
  sireneActive: boolean
  preuveType: 'PHOTO' | 'VIDEO' | null
  etablissement: { id: number; nom: string; ville: string | null } | null
  prisEnChargePar: string | null
  priseEnChargeType: string | null
  departAt: string | null
  arriveeAt: string | null
  resoluAt: string | null
  createdAt: string
}

interface StatsAdmin {
  jours: number
  total: number
  ouvertes: number
  enRetard: number
  sirenesActives: number
  tauxPreuve: number | null
  tauxFrauduleuses: number | null
  tauxDemandeursConnectes: number | null
  serieJour: { jour: string; total: number }[]
  parStatut: Record<string, number>
  parGravite: Record<string, number>
  parHeure: { heure: string; total: number }[]
  parIntervenant: Record<string, number>
  preuves: { PHOTO: number; VIDEO: number; AUCUNE: number }
  delais: Record<string, number | null>
  topEtablissements: {
    id: number | null
    nom: string
    ville: string | null
    total: number
    ouvertes: number
    critiques: number
    delaiMoyenResolutionSec: number | null
  }[]
}

const COULEUR_STATUT: Record<string, string> = {
  EN_COURS: '#f59e0b',
  VERIFIEE: '#ef4444',
  EN_PRISE_EN_CHARGE: '#0ea5e9',
  TRAITEE: '#10b981',
  FRAUDULEUSE: '#8b5cf6',
  CLOTUREE: '#64748b',
}

const COULEUR_GRAVITE: Record<string, string> = {
  LEGERE: '#10b981',
  URGENTE: '#f59e0b',
  CRITIQUE: '#ef4444',
}

const AXE = { stroke: '#94a3b8', fontSize: 11 }
const GRILLE = '#e2e8f0'
const TOOLTIP = { contentStyle: { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 } }

const PERIODES = [
  { valeur: '7', jours: 7 },
  { valeur: '30', jours: 30 },
  { valeur: '90', jours: 90 },
]

function jourCourt(iso: string): string {
  const [, mois, jour] = iso.split('-')
  return `${jour}/${mois}`
}

function enLigne(secondes: number | null): string {
  if (secondes == null) return '—'
  if (secondes < 60) return `${Math.round(secondes)} s`
  const minutes = Math.round(secondes / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

function pourcentage(valeur: number | null): string {
  return valeur == null ? '—' : `${Math.round(valeur * 100)} %`
}

/* ──────────────────────────────────────────────────────────────────────────
 * Centre de contrôle SOS — administration centrale.
 *
 * Vue nationale temps réel : toutes les structures, toutes les alertes et
 * toutes les interventions. Les filtres (période, statut, gravité) et le
 * classement des établissements servent à la fois au pilotage quotidien et
 * à l'identification des structures à risque.
 * ────────────────────────────────────────────────────────────────────────── */
export default function AdminSosPage() {
  const { t, i18n } = useTranslation()
  const { subscribeToSos } = useNotification()
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR'

  const [jours, setJours] = useState(30)
  const [statuts, setStatuts] = useState<string[]>(['EN_COURS', 'VERIFIEE', 'EN_PRISE_EN_CHARGE'])
  const [gravites, setGravites] = useState<string[]>([])
  const [filOuvert, setFilOuvert] = useState(false)

  const params = useMemo(() => {
    const query = new URLSearchParams({ jours: String(jours), limit: '120' })
    if (statuts.length) query.set('statut', statuts.join(','))
    if (gravites.length) query.set('gravite', gravites.join(','))
    return query.toString()
  }, [jours, statuts, gravites])

  const { data: stats, mutate: mutateStats } = useSWR<StatsAdmin>(`/api/admin/sos/stats?jours=${jours}`, fetcher, {
    refreshInterval: 30000,
    dedupingInterval: 0,
  })
  const { data: fil, isLoading, mutate: mutateFil } = useSWR<{
    ouvertes: number
    enRetard: number
    alertes: AlerteAdmin[]
  }>(`/api/admin/sos/alertes?${params}`, fetcher, { refreshInterval: 15000, dedupingInterval: 0 })

  const rafraichir = useCallback(() => {
    void mutateStats()
    void mutateFil()
  }, [mutateStats, mutateFil])

  // Temps réel : chaque transition SOS reçue sur le canal admin rafraîchit
  // le fil et les agrégats. Aucun rechargement de page.
  useEffect(() => {
    return subscribeToSos((type) => {
      if (type === 'sos_admin') rafraichir()
    })
  }, [subscribeToSos, rafraichir])

  const basculer = (liste: string[], valeur: string,Setter: (v: string[]) => void) => {
    Setter(liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur])
  }

  if (isLoading && !fil) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label={t('sos.statsChargement')} />
      </div>
    )
  }

  const alertes = fil?.alertes ?? []
  const parStatut = Object.entries(stats?.parStatut ?? {}).map(([cle, valeur]) => ({
    nom: t(`sos.statut.${cle}`),
    valeur,
    couleur: COULEUR_STATUT[cle] ?? '#64748b',
  })).filter((entree) => entree.valeur > 0)

  const parGravite = Object.entries(stats?.parGravite ?? {}).map(([cle, valeur]) => ({
    nom: t(`sos.gravite.${cle}`),
    valeur,
    couleur: COULEUR_GRAVITE[cle] ?? '#64748b',
  })).filter((entree) => entree.valeur > 0)

  const donneesDelais = [
    { label: t('sos.statsDelaiVerification'), valeur: stats?.delais?.verification ?? null },
    { label: t('sos.statsDelaiPriseEnCharge'), valeur: stats?.delais?.priseEnCharge ?? null },
    { label: t('sos.statsDelaiArrivee'), valeur: stats?.delais?.arrivee ?? null },
    { label: t('sos.statsDelaiResolution'), valeur: stats?.delais?.resolution ?? null },
  ]

  const tuiles = [
    { icone: Activity, label: t('admin.sos.tuileTotal'), valeur: String(stats?.total ?? 0), accent: false },
    { icone: Siren, label: t('admin.sos.tuileOuvertes'), valeur: String(stats?.ouvertes ?? 0), accent: (stats?.ouvertes ?? 0) > 0 },
    { icone: AlarmClock, label: t('admin.sos.tuileRetard'), valeur: String(stats?.enRetard ?? 0), accent: (stats?.enRetard ?? 0) > 0 },
    { icone: ShieldAlert, label: t('sos.statsFraude'), valeur: pourcentage(stats?.tauxFrauduleuses), accent: (stats?.tauxFrauduleuses ?? 0) > 0.2 },
    { icone: Camera, label: t('sos.statsPreuve'), valeur: pourcentage(stats?.tauxPreuve), accent: false },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600 text-white shadow-sm">
          <Siren className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-black text-slate-950 dark:text-white">{t('admin.sos.titre')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('admin.sos.intro')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={jours}
            onChange={(event) => setJours(Number(event.target.value))}
            aria-label={t('admin.sos.periode')}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
          >
            {PERIODES.map((periode) => (
              <option key={periode.valeur} value={periode.valeur}>
                {t('admin.sos.periode', { count: periode.jours })}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={rafraichir}
            aria-label={t('sos.actualiser')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setFilOuvert((v) => !v)}
            aria-expanded={filOuvert}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <Filter className="h-3.5 w-3.5" />
            {t('admin.sos.filtres')}
          </button>
        </div>
      </header>

      {filOuvert && (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('sos.statut.EN_COURS')} · {t('sos.graviteLabel')}
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.keys(COULEUR_STATUT).map((statut) => (
              <button
                key={statut}
                type="button"
                onClick={() => basculer(statuts, statut, setStatuts)}
                aria-pressed={statuts.includes(statut)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                  statuts.includes(statut) ? 'text-white' : 'text-slate-600 ring-1 ring-inset ring-slate-200 dark:text-slate-300 dark:ring-white/10'
                }`}
                style={statuts.includes(statut) ? { background: COULEUR_STATUT[statut] } : undefined}
              >
                {t(`sos.statut.${statut}`)}
              </button>
            ))}
            <span className="mx-2 w-px bg-slate-200 dark:bg-white/10" aria-hidden="true" />
            {Object.keys(COULEUR_GRAVITE).map((gravite) => (
              <button
                key={gravite}
                type="button"
                onClick={() => basculer(gravites, gravite, setGravites)}
                aria-pressed={gravites.includes(gravite)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                  gravites.includes(gravite) ? 'text-white' : 'text-slate-600 ring-1 ring-inset ring-slate-200 dark:text-slate-300 dark:ring-white/10'
                }`}
                style={gravites.includes(gravite) ? { background: COULEUR_GRAVITE[gravite] } : undefined}
              >
                {t(`sos.gravite.${gravite}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tuiles.map((tuile) => {
          const Icone = tuile.icone
          return (
            <div
              key={tuile.label}
              className={`rounded-2xl border p-4 ${
                tuile.accent
                  ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'
                  : 'border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900'
              }`}
            >
              <p className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${tuile.accent ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                <Icone className="h-3.5 w-3.5" />
                {tuile.label}
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{tuile.valeur}</p>
            </div>
          )
        })}
      </div>

      {/* ── Tendance nationale ── */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <TrendingUp className="h-3.5 w-3.5" />
          {t('admin.sos.graphiqueTendance')}
        </p>
        <div className="mt-2 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats?.serieJour ?? []} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="adminSosJour" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRILLE} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="jour" tickFormatter={jourCourt} tick={AXE} interval="preserveStartEnd" minTickGap={28} />
              <YAxis tick={AXE} allowDecimals={false} width={34} />
              <Tooltip
                {...TOOLTIP}
                labelFormatter={(jour: string) => new Date(jour).toLocaleDateString(locale)}
                formatter={(valeur: number) => [valeur, t('sos.graphiqueJourSerie')]}
              />
              <Area type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2} fill="url(#adminSosJour)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Siren className="h-3.5 w-3.5" />
            {t('sos.graphiqueGraviteTitre')}
          </p>
          <div className="mt-2 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={parGravite} dataKey="valeur" nameKey="nom" innerRadius="54%" outerRadius="80%" paddingAngle={3}>
                  {parGravite.map((entree) => (
                    <Cell key={entree.nom} fill={entree.couleur} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Radio className="h-3.5 w-3.5" />
            {t('sos.graphiqueHeureTitre')}
          </p>
          <div className="mt-2 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.parHeure ?? []} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={GRILLE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="heure" tick={AXE} interval={3} />
                <YAxis tick={AXE} allowDecimals={false} width={30} />
                <Tooltip {...TOOLTIP} />
                <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Activity className="h-3.5 w-3.5" />
            {t('sos.statsParStatut')}
          </p>
          <div className="mt-2 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={parStatut} layout="vertical" margin={{ top: 4, right: 16, left: 30, bottom: 4 }}>
                <CartesianGrid stroke={GRILLE} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={AXE} allowDecimals={false} />
                <YAxis type="category" dataKey="nom" tick={{ ...AXE, fontSize: 10 }} width={92} />
                <Tooltip {...TOOLTIP} />
                <Bar dataKey="valeur" radius={[0, 4, 4, 0]}>
                  {parStatut.map((entree) => (
                    <Cell key={entree.nom} fill={entree.couleur} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <AlarmClock className="h-3.5 w-3.5" />
            {t('sos.statsDelaisTitre')}
          </p>
          <div className="mt-2 h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={donneesDelais} layout="vertical" margin={{ top: 4, right: 24, left: 40, bottom: 4 }}>
                <CartesianGrid stroke={GRILLE} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={AXE} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ ...AXE, fontSize: 10 }} width={112} />
                <Tooltip {...TOOLTIP} formatter={(valeur: number | null) => [enLigne(valeur ?? null), t('sos.statsDelaisTitre')]} />
                <Bar dataKey="valeur" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <li>
              {t('admin.sos.equipeMedecin')}{' '}
              <strong className="text-slate-800 dark:text-slate-100">{stats?.parIntervenant?.MEDECIN ?? 0}</strong>
            </li>
            <li>
              {t('sos.intervenantAmbulancier')}{' '}
              <strong className="text-slate-800 dark:text-slate-100">{stats?.parIntervenant?.AMBULANCIER ?? 0}</strong>
            </li>
            <li>
              {t('admin.sos.proofVideo')}{' '}
              <strong className="text-slate-800 dark:text-slate-100">{stats?.preuves?.VIDEO ?? 0}</strong>
            </li>
            <li>
              {t('admin.sos.connectes')}{' '}
              <strong className="text-slate-800 dark:text-slate-100">{pourcentage(stats?.tauxDemandeursConnectes)}</strong>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Building2 className="h-3.5 w-3.5" />
            {t('admin.sos.topEtablissements')}
          </p>
          {(stats?.topEtablissements ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">{t('sos.statsAucune')}</p>
          ) : (
            <div className="mt-2 h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(stats?.topEtablissements ?? []).slice(0, 6).map((ligne) => ({ nom: ligne.nom, total: ligne.total }))}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 60, bottom: 4 }}
                >
                  <CartesianGrid stroke={GRILLE} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={AXE} allowDecimals={false} />
                  <YAxis type="category" dataKey="nom" tick={{ ...AXE, fontSize: 10 }} width={124} />
                  <Tooltip {...TOOLTIP} />
                  <Bar dataKey="total" fill="#1e3a5f" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="mt-2 space-y-1">
            {(stats?.topEtablissements ?? []).slice(0, 4).map((ligne) => (
              <li key={String(ligne.id ?? ligne.nom)} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <span className="min-w-0 flex-1 truncate font-semibold">{ligne.nom}</span>
                {ligne.ouvertes > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                    {ligne.ouvertes}
                  </span>
                )}
                {ligne.critiques > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 font-bold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                    <Siren className="h-3 w-3" />
                    {ligne.critiques}
                  </span>
                )}
                <span className="tabular-nums text-slate-400">{enLigne(ligne.delaiMoyenResolutionSec)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Fil temps réel ── */}
      <section className="mt-6" aria-label={t('admin.sos.filTitre')}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-display text-lg font-black text-slate-900 dark:text-white">{t('admin.sos.filTitre')}</h2>
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-black text-red-700 dark:bg-red-500/15 dark:text-red-400">
            {fil?.ouvertes ?? 0}
          </span>
          {(fil?.enRetard ?? 0) > 0 && (
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-black text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
              {t('admin.sos.enRetard', { count: fil?.enRetard ?? 0 })}
            </span>
          )}
        </div>

        {alertes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-white/10">
            {t('sos.statsAucune')}
          </p>
        ) : (
          <ul className="space-y-3">
            {alertes.map((alerte) => (
              <li
                key={alerte.id}
                className={`rounded-2xl border bg-white p-4 dark:bg-slate-900 ${
                  alerte.sireneActive
                    ? 'border-red-300 dark:border-red-500/40'
                    : 'border-slate-200 dark:border-white/10'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-white"
                    style={{ background: COULEUR_GRAVITE[alerte.gravite] ?? '#64748b' }}
                  >
                    {t(`sos.gravite.${alerte.gravite}`)}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                    style={{ background: `${COULEUR_STATUT[alerte.statut] ?? '#64748b'}22`, color: COULEUR_STATUT[alerte.statut] ?? '#64748b' }}
                  >
                    {t(`sos.statut.${alerte.statut}`)}
                  </span>
                  {alerte.sireneActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-black text-white">
                      <Siren className="h-3 w-3 animate-pulse" />
                      {t('sos.sireneActiveLabel')}
                    </span>
                  )}
                  {alerte.preuveType && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {alerte.preuveType === 'VIDEO' ? <Video className="h-3 w-3" /> : <Camera className="h-3 w-3" />}
                      {alerte.preuveType === 'VIDEO' ? t('sos.preuveVideo') : t('sos.preuve')}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
                    {new Date(alerte.createdAt).toLocaleString(locale)}
                  </span>
                </div>

                <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {alerte.description || t('sos.pasDescription')}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {alerte.etablissement?.nom ?? t('admin.sos.sansCible')}
                  </span>
                  {alerte.telephone && (
                    <a href={`tel:${alerte.telephone}`} className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:underline dark:text-mint-300">
                      <Phone className="h-3 w-3" />
                      {alerte.nom || alerte.telephone}
                    </a>
                  )}
                  {alerte.prisEnChargePar && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {alerte.prisEnChargePar}
                      {alerte.priseEnChargeType ? ` · ${t(`sos.intervenant${alerte.priseEnChargeType === 'MEDECIN' ? 'Medecin' : 'Ambulancier'}`)}` : ''}
                    </span>
                  )}
                  {alerte.agePatient != null && <span>{t('sos.agePatient', { age: alerte.agePatient })}</span>}
                  {alerte.enceinte && <span className="font-bold text-pink-600 dark:text-pink-400">{t('sos.enceinteBadge')}</span>}
                  {alerte.urgenceVitale && <span className="font-bold text-red-600 dark:text-red-400">{t('admin.sos.urgenceVitale')}</span>}
                </div>

                <SosPosition latitude={alerte.latitude} longitude={alerte.longitude} nom={alerte.nom} telephone={alerte.telephone} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {isLoading && (
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('sos.statsChargement')}
        </p>
      )}
    </div>
  )
}