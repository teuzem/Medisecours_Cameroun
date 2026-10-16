'use client'

import { useCallback, useEffect, useState } from 'react'
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
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  Camera,
  Clock,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Siren,
  Timer,
  Video,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/axios'
import { useNotification } from '../../contexts/NotificationContext'

interface SosStats {
  total: number
  ouvertes: number
  parStatut: Record<string, number>
  sirenesActives: number
  tauxPreuvePhoto: number | null
  tauxFrauduleuses: number | null
  delaiMoyenVerificationSec: number | null
  delaiMoyenPriseEnChargeSec: number | null
  delaiMoyenResolutionSec: number | null
  serieJour: { jour: string; total: number }[]
  parGravite: Record<string, number>
  parHeure: { heure: string; total: number }[]
  parIntervenant: Record<string, number>
  preuves: { PHOTO: number; VIDEO: number; AUCUNE: number }
  delaiMoyenArriveeSec: number | null
}

const STATUTS = ['EN_COURS', 'VERIFIEE', 'EN_PRISE_EN_CHARGE', 'TRAITEE', 'FRAUDULEUSE', 'CLOTUREE'] as const

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

function formatDelai(secondes: number | null, uniteS: string, uniteMin: string): string {
  if (secondes == null) return '—'
  if (secondes < 60) return `${secondes} ${uniteS}`
  return `${Math.round(secondes / 60)} ${uniteMin}`
}

function formatTaux(taux: number | null): string {
  if (taux == null) return '—'
  return `${Math.round(taux * 100)} %`
}

function jourCourt(iso: string): string {
  const [, mois, jour] = iso.split('-')
  return `${jour}/${mois}`
}

const AXE = { stroke: '#94a3b8', fontSize: 11 }
const GRILLE = '#e2e8f0'

/**
 * Panneau « Pilotage SOS » — analytique temps réel de l'établissement.
 *
 * La vue d'ensemble est une série journalière sur 30 jours : elle répond à
 * la seule question qui compte pour un poste d'alerte — « ça se calme ? ».
 * Les diagrammes secondaires détaillent le pourquoi : gravité, répartition
 * horaire (renforts), nature des preuves, délai moyen par étape, répartition
 * médecin / ambulancier.
 */
export default function SosStatsPanel({ centreId }: { centreId: number }) {
  const { t } = useTranslation()
  const { subscribeToSos } = useNotification()
  const [stats, setStats] = useState<SosStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(false)

  const charger = useCallback(async (silencieux = false) => {
    try {
      const { data } = await api.get('/api/sos/stats', { params: { centre: centreId } })
      setStats(data)
      setErreur(false)
    } catch {
      if (!silencieux) setErreur(true)
    } finally {
      setLoading(false)
    }
  }, [centreId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStats(null)
    setLoading(true)
    void charger()
  }, [charger])

  // Rafraîchit à chaque événement WebSocket d'équipe, et par sécurité à
  // intervalle : une socket coupée ne doit pas figer un tableau de bord.
  useEffect(() => {
    return subscribeToSos(() => {
      void charger(true)
    })
  }, [subscribeToSos, charger])

  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void charger(true)
    }, 30_000)
    return () => clearInterval(timer)
  }, [charger])

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('sos.statsChargement')}
      </div>
    )
  }

  if (erreur || !stats) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
        {t('sos.statsErreur')}
      </div>
    )
  }

  const tuiles = [
    { icone: Activity, label: t('sos.statsTotal'), valeur: String(stats.total), accent: false },
    { icone: Siren, label: t('sos.statsOuvertes'), valeur: String(stats.ouvertes), accent: stats.ouvertes > 0 },
    { icone: Siren, label: t('sos.statsSirenes'), valeur: String(stats.sirenesActives), accent: stats.sirenesActives > 0 },
    { icone: Camera, label: t('sos.statsPreuve'), valeur: formatTaux(stats.tauxPreuvePhoto), accent: false },
    { icone: ShieldAlert, label: t('sos.statsFraude'), valeur: formatTaux(stats.tauxFrauduleuses), accent: (stats.tauxFrauduleuses ?? 0) > 0 },
  ]

  const delais = [
    { label: t('sos.statsDelaiVerification'), valeur: formatDelai(stats.delaiMoyenVerificationSec, t('sos.statsUniteSeconde'), t('sos.statsUniteMinute')) },
    { label: t('sos.statsDelaiPriseEnCharge'), valeur: formatDelai(stats.delaiMoyenPriseEnChargeSec, t('sos.statsUniteSeconde'), t('sos.statsUniteMinute')) },
    { label: t('sos.statsDelaiArrivee'), valeur: formatDelai(stats.delaiMoyenArriveeSec, t('sos.statsUniteSeconde'), t('sos.statsUniteMinute')) },
    { label: t('sos.statsDelaiResolution'), valeur: formatDelai(stats.delaiMoyenResolutionSec, t('sos.statsUniteSeconde'), t('sos.statsUniteMinute')) },
  ]

  const donneesStatut = STATUTS
    .map((statut) => ({ nom: t(`sos.statut.${statut}`), valeur: stats.parStatut[statut] ?? 0, couleur: COULEUR_STATUT[statut] }))
    .filter((entree) => entree.valeur > 0)

  const donneesGravite = Object.entries(stats.parGravite ?? {})
    .map(([cle, valeur]) => ({ nom: t(`sos.gravite.${cle}`), valeur, couleur: COULEUR_GRAVITE[cle] ?? '#64748b' }))
    .filter((entree) => entree.valeur > 0)

  const donneesPreuves = [
    { nom: t('sos.preuvePhoto'), valeur: stats.preuves?.PHOTO ?? 0, couleur: '#0ea5e9' },
    { nom: t('sos.preuveVideo'), valeur: stats.preuves?.VIDEO ?? 0, couleur: '#8b5cf6' },
    { nom: t('sos.preuveAbsente'), valeur: stats.preuves?.AUCUNE ?? 0, couleur: '#cbd5e1' },
  ].filter((entree) => entree.valeur > 0)

  const donneesDelais = delais.map(({ label, valeur }) => ({ label, valeur: valeur === '—' ? 0 : parseFloat(valeur) }))
  const donneesIntervenants = [
    { nom: t('sos.intervenantMedecin'), valeur: stats.parIntervenant?.MEDECIN ?? 0, couleur: '#0ea5e9' },
    { nom: t('sos.intervenantAmbulancier'), valeur: stats.parIntervenant?.AMBULANCIER ?? 0, couleur: '#10b981' },
  ].filter((entree) => entree.valeur > 0)

  const tauxPreuve = Math.round((stats.tauxPreuvePhoto ?? 0) * 100)

  return (
    <section aria-label={t('sos.statsTitre')} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('sos.statsTitre')}</h2>
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <RefreshCw className="h-3 w-3" />
          {t('sos.statsDesc')}
        </p>
      </div>

      {stats.total === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('sos.statsAucune')}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {tuiles.map((tuile) => {
              const Icone = tuile.icone
              return (
                <div
                  key={tuile.label}
                  className={`rounded-lg border p-3 ${tuile.accent ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10' : 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-800'}`}
                >
                  <p className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${tuile.accent ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    <Icone className="h-3.5 w-3.5" />
                    {tuile.label}
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{tuile.valeur}</p>
                </div>
              )
            })}
          </div>

          {/* ── Vue d'ensemble : alertes par jour (30 j) ── */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-800">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Activity className="h-3.5 w-3.5" />
              {t('sos.graphiqueJourTitre')}
            </p>
            <div className="mt-2 h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.serieJour ?? []} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sosJour" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRILLE} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="jour" tickFormatter={jourCourt} tick={AXE} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tick={AXE} allowDecimals={false} width={34} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                    labelFormatter={(jour: string) => new Date(jour).toLocaleDateString()}
                    formatter={(valeur: number) => [valeur, t('sos.graphiqueJourSerie')]}
                  />
                  <Area type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2} fill="url(#sosJour)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {/* ── Gravité ── */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-800">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Siren className="h-3.5 w-3.5" />
                {t('sos.graphiqueGraviteTitre')}
              </p>
              <div className="mt-2 h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donneesGravite} dataKey="valeur" nameKey="nom" innerRadius="52%" outerRadius="78%" paddingAngle={3}>
                      {donneesGravite.map((entree) => (
                        <Cell key={entree.nom} fill={entree.couleur} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Répartition horaire (renforts) ── */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-800">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                {t('sos.graphiqueHeureTitre')}
              </p>
              <div className="mt-2 h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.parHeure ?? []} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={GRILLE} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="heure" tick={AXE} interval={3} />
                    <YAxis tick={AXE} allowDecimals={false} width={30} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Nature des preuves ── */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-800">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {donneesPreuves.some((p) => p.nom === t('sos.preuveVideo')) ? <Video className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                {t('sos.graphiquePreuveTitre')}
              </p>
              <div className="mt-2 h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    data={[{ nom: t('sos.statsPreuve'), valeur: tauxPreuve, couleur: '#10b981' }]}
                    innerRadius="72%"
                    outerRadius="100%"
                    startAngle={90}
                    endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="valeur" cornerRadius={12} fill="#10b981" background={{ fill: '#e2e8f0' }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              {donneesPreuves.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {donneesPreuves.map((entree) => (
                    <li key={entree.nom} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-white/10">
                      <span className="h-2 w-2 rounded-full" style={{ background: entree.couleur }} aria-hidden="true" />
                      {entree.nom}
                      <span className="text-slate-900 dark:text-white">{entree.valeur}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {/* ── Délais moyens par étape ── */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-800">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Timer className="h-3.5 w-3.5" />
                {t('sos.statsDelaisTitre')}
              </p>
              <ul className="mt-2 space-y-1.5">
                {delais.map((delai) => (
                  <li key={delai.label} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{delai.label}</span>
                    <strong className="text-slate-800 dark:text-slate-100">{delai.valeur}</strong>
                  </li>
                ))}
              </ul>
              <div className="mt-2 h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={donneesDelais} layout="vertical" margin={{ top: 4, right: 16, left: 24, bottom: 4 }}>
                    <CartesianGrid stroke={GRILLE} strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={AXE} allowDecimals={false} />
                    <YAxis type="category" dataKey="label" tick={{ ...AXE, fontSize: 10 }} width={92} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Bar dataKey="valeur" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Statuts + intervenants ── */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-800">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Activity className="h-3.5 w-3.5" />
                {t('sos.statsParStatut')}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {STATUTS.map((statut) => (
                  <li
                    key={statut}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-white/10"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: COULEUR_STATUT[statut] }} aria-hidden="true" />
                    {t(`sos.statut.${statut}`)}
                    <span className="text-slate-900 dark:text-white">{stats.parStatut[statut] ?? 0}</span>
                  </li>
                ))}
              </ul>
              {donneesStatut.length > 0 && (
                <div className="mt-2 h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={donneesStatut} layout="vertical" margin={{ top: 4, right: 16, left: 24, bottom: 4 }}>
                      <CartesianGrid stroke={GRILLE} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={AXE} allowDecimals={false} />
                      <YAxis type="category" dataKey="nom" tick={{ ...AXE, fontSize: 10 }} width={92} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                      <Bar dataKey="valeur" radius={[0, 4, 4, 0]}>
                        {donneesStatut.map((entree) => (
                          <Cell key={entree.nom} fill={entree.couleur} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {donneesIntervenants.length > 0 && (
                <>
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('sos.graphiqueIntervenantTitre')}
                  </p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {donneesIntervenants.map((entree) => (
                      <li key={entree.nom} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-white/10">
                        <span className="h-2 w-2 rounded-full" style={{ background: entree.couleur }} aria-hidden="true" />
                        {entree.nom}
                        <span className="text-slate-900 dark:text-white">{entree.valeur}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}