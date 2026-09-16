// @ts-nocheck
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import {
  Users, UserCog, HeartPulse, CalendarCheck,
  ClipboardList, AlertTriangle, Search,
  ChevronRight, Star, Calendar, Clock,
  Stethoscope, MessageSquare, Phone,
  ShieldCheck, ArrowRight, Activity,
  RefreshCw, ChevronLeft,
} from 'lucide-react'
import api from '../../api/axios'
import { useAuth } from '../../hooks/useAuth'
import { useWebSocket } from '../../hooks/useWebSocket'
import { imgUrl } from '../../lib/config'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Avatar from '../../components/ui/Avatar'
import CertifiedBadge from '../../components/ui/CertifiedBadge'
import DashboardAnalytics from '../../components/medecin/dashboard/DashboardAnalytics'
import { DASHBOARD_KEY } from '../../lib/keys'
import type { DashboardData, Consultation, Patient } from '../../types/api'

async function dashboardFetcher(url: string): Promise<DashboardData> {
  try {
    const res = await api.get(url)
    return res.data as DashboardData
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
    throw err
  }
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function getGreeting(t: (key: string) => string): string {
  const h = new Date().getHours()
  if (h < 12) return t('medecin.overview.greetingMorning')
  if (h < 18) return t('medecin.overview.greetingAfternoon')
  return t('medecin.overview.greetingEvening')
}

const CAL_LABEL_KEYS = [
  'medecin.dayShort.dimanche',
  'medecin.dayShort.lundi',
  'medecin.dayShort.mardi',
  'medecin.dayShort.mercredi',
  'medecin.dayShort.jeudi',
  'medecin.dayShort.vendredi',
  'medecin.dayShort.samedi',
]

function getCalendarDays(t: (key: string) => string) {
  const today = new Date()
  const days: { day: number; label: string; isToday: boolean; date: Date }[] = []
  for (let i = -2; i <= 4; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    days.push({ day: d.getDate(), label: t(CAL_LABEL_KEYS[d.getDay()]), isToday: i === 0, date: d })
  }
  return days
}

const STATUT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'OUVERTE': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  'En attente': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  'EN_COURS': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  'En cours': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  'TERMINEE': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  'Terminée': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  'ANNULEE': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
}

const PRIORITE_BADGE: Record<string, { bg: string; text: string }> = {
  CRITIQUE: { bg: 'bg-red-100', text: 'text-red-700' },
  URGENTE: { bg: 'bg-amber-100', text: 'text-amber-700' },
  NORMALE: { bg: 'bg-slate-100', text: 'text-slate-600' },
}

/* ── Main Dashboard ──────────────────────────────────────────────── */

export default function MedecinDashboard() {
  const { user, token } = useAuth()
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'

  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    DASHBOARD_KEY,
    dashboardFetcher,
    { revalidateOnFocus: false, errorRetryCount: 3, keepPreviousData: true }
  )

  const wsHandlers = {
    onConsultationCreated: () => mutate(),
    onConsultationAccepted: () => mutate(),
    onConsultationClosed: () => mutate(),
  }
  useWebSocket(user?.id || '', token || '', wsHandlers, user?.roles?.[0])

  const kpis = data?.kpis ?? { totalPatients: 0, casActifs: 0, consultations: 0, enAttente: 0, terminees: 0 }
  const noteMoyenne = data?.noteMoyenne ?? 0
  const totalAvis = data?.totalAvis ?? 0
  const activeConsultations = (data?.activeConsultations ?? []) as Consultation[]
  const riskConsultations = (data?.riskConsultations ?? []) as Consultation[]
  const upcomingAppointments = (data?.upcomingAppointments ?? []) as Consultation[]
  const recentPatients = (data?.recentPatients ?? []) as Patient[]
  const calDays = getCalendarDays(t)

  if (isLoading) return <LoadingSpinner label={t('medecin.overview.loading')} />

  return (
    <div className="medecin-overview flex gap-0 min-h-[calc(100vh-64px)]">

      {/* ═══════════════ LEFT (Main Content) ═══════════════ */}
      <div className="medecin-overview-main flex-1 min-w-0 p-5 space-y-6 overflow-y-auto">

        {error && !data && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{t('medecin.overview.dataUnavailable')} <button onClick={() => mutate()} className="font-semibold underline">{t('medecin.overview.retry')}</button>.</span>
          </div>
        )}

        {/* ── Hero Banner (like the image) ──────────────── */}
        <div className="medecin-overview-intro relative overflow-hidden rounded-xl p-6">
          <div className="absolute right-0 top-0 bottom-0 w-[280px] opacity-70 pointer-events-none hidden lg:block">
            <img
              src="/images/doctor_illustration.png"
              alt=""
              className="h-full w-full object-contain object-right-bottom"
            />
          </div>
          <div className="relative z-10 max-w-[68%]">
            <p className="medecin-overview-eyebrow">{t('medecin.overview.eyebrow')}</p>
            <h2 className="text-2xl font-bold mb-1">
              {getGreeting(t)}, Dr. {user?.prenom} {user?.estValide && <CertifiedBadge className="inline-block h-5 w-5 align-middle" />} 👋
            </h2>
            <p className="mb-4 text-sm leading-relaxed">
              {t('medecin.overview.statsLead')}{' '}
              <span className="font-semibold">{t('medecin.overview.pendingConsultations', { count: kpis.enAttente })}</span>{' '}
              {t('medecin.overview.statsAnd')}{' '}
              <span className="font-semibold">{t('medecin.overview.activeCases', { count: kpis.casActifs })}</span>{' '}
              {t('medecin.overview.statsToday')}
              {riskConsultations.length > 0 && (
                <> {t('medecin.overview.statsIncluding')} <span className="font-semibold text-amber-700 dark:text-amber-300">{t('medecin.overview.urgentCases', { count: riskConsultations.length })}</span>.</>
              )}
            </p>
            <Link
              href="/medecin/consultations"
              className="medecin-overview-primary-action inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition"
            >
              {t('medecin.overview.seeConsultations')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="medecin-overview-intro-rule absolute bottom-0 left-0 right-0 h-1" />
        </div>

        {/* ── Category Cards (like "You Need to hire" section) ─── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#0F2C52]">{t('medecin.overview.patientsDistribution')}</h3>
            <Link href="/medecin/patients" className="medecin-overview-link text-xs font-semibold hover:underline flex items-center gap-1">
              {t('medecin.overview.seeAll')} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { value: kpis.totalPatients, labelKey: 'medecin.overview.kpiPatients', icon: Users, tone: 'blue' },
              { value: kpis.casActifs, labelKey: 'medecin.overview.kpiActiveCases', icon: Activity, tone: 'orange' },
              { value: kpis.consultations, labelKey: 'medecin.overview.kpiConsultations', icon: HeartPulse, tone: 'pink' },
              { value: kpis.enAttente, labelKey: 'medecin.overview.kpiPending', icon: CalendarCheck, tone: 'teal' },
            ].map(({ value, labelKey, icon: Icon, tone }, i) => (
              <div key={i} className={`medecin-overview-kpi medecin-overview-kpi-${tone} flex min-h-[142px] flex-col rounded-xl p-4 transition`}>
                <div className="mb-4 flex items-center justify-between">
                  <span className="medecin-overview-kpi-icon flex h-9 w-9 items-center justify-center rounded-lg">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{t('medecin.overview.period30days')}</span>
                </div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="mt-1 text-[11px] font-medium opacity-70">{t(labelKey)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Animated Analytics Charts ─────────────────── */}
        <DashboardAnalytics data={data} />

        {/* ── Consultation Progress Table (like "Recruitment Progress") ─── */}
        <div className="dashboard-panel rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#0F2C52]">{t('medecin.overview.trackingTitle')}</h3>
            <Link href="/medecin/consultations" className="medecin-overview-link text-xs font-semibold hover:underline flex items-center gap-1">
              {t('medecin.overview.seeAll')} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {activeConsultations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">
                    <th className="pb-3 pr-4">{t('medecin.overview.tablePatient')}</th>
                    <th className="pb-3 pr-4">{t('medecin.overview.tableMotif')}</th>
                    <th className="pb-3 pr-4">{t('medecin.overview.tablePriority')}</th>
                    <th className="pb-3 pr-4">{t('medecin.overview.tableStatus')}</th>
                    <th className="pb-3">{t('medecin.overview.tableAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeConsultations.slice(0, 6).map((c, idx) => {
                    const patient = typeof c.patient === 'object' ? c.patient : null
                    const sc = STATUT_COLORS[c.statut] || STATUT_COLORS['EN_COURS']
                    const pb = PRIORITE_BADGE[c.priorite] || PRIORITE_BADGE['NORMALE']
                    const isHighlighted = c.priorite === 'CRITIQUE' || c.priorite === 'URGENTE'

                    return (
                      <tr
                        key={c.id}
                        className={`border-b border-gray-50 text-sm transition ${isHighlighted ? 'medecin-overview-row-risk' : 'hover:bg-[#F9FAFB]'}`}
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={`${patient?.prenom || ''} ${patient?.nom || ''}`} size="sm" src={patient?.photoProfil ? imgUrl(patient.photoProfil) : null} />
                            <div>
                              <p className="font-semibold text-[#0F2C52] text-[13px]">{patient?.prenom} {patient?.nom}</p>
                              <p className="text-[10px] text-[#9CA3AF]">{patient?.telephone || patient?.email || ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-[13px] text-[#374151] max-w-[160px] truncate">{c.motif || t('common.none')}</td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${pb.bg} ${pb.text}`}>
                            {c.priorite}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${sc.bg} ${sc.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                            {c.statut}
                          </span>
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => router.push(`/medecin/consultations?id=${c.id}`)}
                            className="flex items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:text-[#4338CA] transition"
                          >
                            {t('medecin.overview.view')} <ChevronRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-[180px] flex-col items-center justify-center">
              <ClipboardList className="mb-2 h-8 w-8 text-[#D1D5DB]" />
              <p className="text-sm text-[#9CA3AF]">{t('medecin.overview.noActiveConsultations')}</p>
            </div>
          )}
        </div>

        {/* ── Risk Patients (urgent cases) ──────────────────── */}
        {riskConsultations.length > 0 && (
          <div className="dashboard-panel rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#0F2C52]">⚠️ {t('medecin.overview.riskPatients')}</h3>
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold text-red-600">
                {t('medecin.overview.cases', { count: riskConsultations.length })}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {riskConsultations.slice(0, 4).map((c) => {
                const patient = typeof c.patient === 'object' ? c.patient : null
                const isCritique = c.priorite === 'CRITIQUE'
                return (
                  <button
                    key={c.id}
                    onClick={() => router.push(`/medecin/consultations?id=${c.id}`)}
                    className={`flex items-center gap-3 rounded-xl p-3 text-left transition hover:shadow-sm ${isCritique ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'}`}
                  >
                    <Avatar name={`${patient?.prenom || ''} ${patient?.nom || ''}`} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0F2C52] truncate">{patient?.prenom} {patient?.nom}</p>
                      <p className="text-[11px] text-[#6B7280] truncate">{c.motif || '—'}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${isCritique ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>
                      {c.priorite}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ RIGHT SIDEBAR ═══════════════ */}
      <aside className="medecin-overview-aside hidden xl:block w-[300px] border-l p-5 overflow-y-auto space-y-5">

        {/* ── Doctor Profile Card ────────────────────── */}
        <div className="text-center">
          <div className="relative inline-block mb-2">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#818CF8] text-white flex items-center justify-center text-xl font-bold overflow-hidden mx-auto shadow-lg ring-3 ring-indigo-100">
              {user?.photoProfil
                ? <img src={imgUrl(user.photoProfil) || ''} alt="" className="w-full h-full object-cover" />
                : `${user?.prenom?.[0] || ''}${user?.nom?.[0] || ''}`.toUpperCase()
              }
            </div>
            <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white" />
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <h4 className="font-bold text-[#0F2C52] text-sm">Dr. {user?.prenom} {user?.nom}</h4>
            {user?.estValide && <CertifiedBadge className="h-3.5 w-3.5" />}
          </div>
          <p className="text-[11px] text-[#6B7280] mb-1">{user?.specialite || t('medecin.overview.doctorFallback')}</p>
          <Link href="/medecin/profil" className="text-[11px] text-[#4F46E5] font-semibold hover:underline">
            {t('medecin.overview.viewProfile')}
          </Link>

          {/* Rating */}
          <div className="flex items-center justify-center gap-0.5 mt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(noteMoyenne) ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" />
            ))}
            <span className="ml-1 text-[11px] text-[#6B7280]">{noteMoyenne.toFixed(1)} ({totalAvis})</span>
          </div>
        </div>

        <hr className="border-[#F3F4F6]" />

        {/* ── Schedule Calendar ──────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-[#0F2C52]">{t('medecin.overview.schedule')}</h4>
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-[#4F46E5]" />
              <span className="text-[11px] font-semibold text-[#4F46E5]">
                {new Date().toLocaleDateString(locale, { month: 'long' })}
              </span>
            </div>
          </div>
          <div className="flex gap-1.5">
            {calDays.map((d, i) => (
              <button
                key={i}
                className={`flex-1 flex flex-col items-center py-2 rounded-xl text-center transition ${
                  d.isToday
                    ? 'bg-[#4F46E5] text-white shadow-md shadow-indigo-200'
                    : 'bg-[#F9FAFB] text-[#374151] hover:bg-[#F3F4F6]'
                }`}
              >
                <span className={`text-[9px] font-medium ${d.isToday ? 'text-white/70' : 'text-[#9CA3AF]'}`}>{d.label}</span>
                <span className="text-sm font-bold">{d.day}</span>
              </button>
            ))}
          </div>
        </div>

        <hr className="border-[#F3F4F6]" />

        {/* ── Upcoming Appointments (sidebar) ──────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-[#0F2C52]">{t('medecin.overview.upcomingAppointments')}</h4>
            <Link href="/medecin/consultations" className="text-[11px] text-[#4F46E5] font-semibold hover:underline">{t('medecin.overview.all')}</Link>
          </div>
          {upcomingAppointments.length > 0 ? (
            <div className="space-y-2">
              {upcomingAppointments.slice(0, 4).map((c) => {
                const patient = typeof c.patient === 'object' ? c.patient : null
                const d = new Date(c.dateConsultation || c.createdAt)
                return (
                  <button
                    key={c.id}
                    onClick={() => router.push(`/medecin/consultations?id=${c.id}`)}
                    className="flex items-center gap-2.5 w-full rounded-xl p-2 hover:bg-[#F9FAFB] transition text-left"
                  >
                    <Avatar name={`${patient?.prenom || ''} ${patient?.nom || ''}`} size="sm" src={patient?.photoProfil ? imgUrl(patient.photoProfil) : null} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#0F2C52] truncate">{patient?.prenom} {patient?.nom}</p>
                      <p className="text-[10px] text-[#9CA3AF] truncate">{c.motif || t('medecin.overview.motifFallback')}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-semibold text-[#374151]">
                        {d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-[9px] text-[#9CA3AF]">
                        {d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-[12px] text-[#9CA3AF] text-center py-4">{t('medecin.overview.noAppointments')}</p>
          )}
        </div>

        <hr className="border-[#F3F4F6]" />

        {/* ── Recent Patients (like "New Applicants") ──── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-[#0F2C52]">{t('medecin.overview.recentPatients')}</h4>
            <Link href="/medecin/patients" className="text-[11px] text-[#4F46E5] font-semibold hover:underline">{t('medecin.overview.all')}</Link>
          </div>
          {recentPatients.length > 0 ? (
            <div className="space-y-2">
              {recentPatients.slice(0, 5).map((p) => {
                const pid = p.id || p['@id']?.split('/').pop()
                return (
                  <div
                    key={pid}
                    className="flex items-center gap-2.5 rounded-xl p-2 hover:bg-[#F9FAFB] transition"
                  >
                    <Avatar name={`${p.prenom || ''} ${p.nom || ''}`} size="sm" src={p.photoProfil ? imgUrl(p.photoProfil) : null} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#0F2C52] truncate">{p.prenom} {p.nom}</p>
                      <p className="text-[10px] text-[#9CA3AF]">{p.telephone || p.email || '—'}</p>
                    </div>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => router.push(`/medecin/messages?patient=${pid}`)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-[#4F46E5] hover:bg-indigo-100 transition"
                        title={t('medecin.overview.message')}
                      >
                        <MessageSquare className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => router.push(`/medecin/consultations?patient=${pid}`)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                        title={t('medecin.overview.consultation')}
                      >
                        <Stethoscope className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-[12px] text-[#9CA3AF] text-center py-4">{t('medecin.overview.noRecentPatients')}</p>
          )}
        </div>

        <hr className="border-[#F3F4F6]" />

        {/* ── Quick Stats (like "Ready For Training") ──── */}
        <div>
          <h4 className="text-sm font-bold text-[#0F2C52] mb-3">{t('medecin.overview.quickSummary')}</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-indigo-50 p-3 text-center">
              <p className="text-lg font-bold text-[#4F46E5]">{kpis.terminees}</p>
              <p className="text-[10px] text-[#6B7280] font-medium">{t('medecin.overview.finished')}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <p className="text-lg font-bold text-emerald-600">{totalAvis}</p>
              <p className="text-[10px] text-[#6B7280] font-medium">{t('medecin.overview.receivedReviews')}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-center">
              <p className="text-lg font-bold text-amber-600">{kpis.enAttente}</p>
              <p className="text-[10px] text-[#6B7280] font-medium">{t('medecin.overview.pending')}</p>
            </div>
            <div className="rounded-xl bg-pink-50 p-3 text-center">
              <p className="text-lg font-bold text-pink-600">{riskConsultations.length}</p>
              <p className="text-[10px] text-[#6B7280] font-medium">{t('medecin.overview.urgent')}</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
