'use client'

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ClipboardList,
  Heart,
  MessageSquare,
  MapPin,
  Settings,
  Siren,
  Star,
} from 'lucide-react'
import useSWR from 'swr'
import { useAuth } from '../../hooks/useAuth'
import { fetcher } from '../../lib/fetcher'
import {
  AVIS_ETABLISSEMENTS_KEY,
  CONSULTATIONS_KEY,
  ETABLISSEMENTS_KEY,
  FAVORIS_KEY,
  PATIENT_CONSULTATIONS_STATS_KEY,
  UNREAD_MESSAGES_KEY,
  UNREAD_NOTIFICATIONS_KEY,
} from '../../lib/keys'
import GlassCard from '../../components/ui/GlassCard'
import SectionHeader from '../../components/ui/SectionHeader'
import StatCard from '../../components/ui/StatCard'
import EstablishmentCard from '../../components/patient/EstablishmentCard'
import type { CarteCentre } from '../../lib/carte'
import { extractArray } from '../../lib/api'

type ConsultationStats = { total: number; pending: number; inProgress: number; finished: number; cancelled: number }

export default function PatientHomePage() {
  const { user } = useAuth()
  const { t } = useTranslation()

  const { data: stats } = useSWR<ConsultationStats>(PATIENT_CONSULTATIONS_STATS_KEY, fetcher)
  const { data: favoris } = useSWR<number[]>(FAVORIS_KEY, fetcher)
  const { data: unreadMessages } = useSWR<{ count: number }>(UNREAD_MESSAGES_KEY, fetcher)
  const { data: unreadNotifs } = useSWR<{ count: number }>(UNREAD_NOTIFICATIONS_KEY, fetcher)
  const { data: recentConsultations } = useSWR(`${CONSULTATIONS_KEY}?itemsPerPage=3&order[createdAt]=desc`, fetcher)
  const { data: nearby } = useSWR(`${ETABLISSEMENTS_KEY}?estActif=true&itemsPerPage=3`, fetcher)

  const { data: myReviews } = useSWR(AVIS_ETABLISSEMENTS_KEY, (url: string) =>
    fetcher(`${url}?itemsPerPage=100&statut=PUBLIE`).catch(() => []),
  )

  const consultationList = useMemo(() => {
    if (!recentConsultations) return []
    const raw = (recentConsultations as any)['hydra:member'] ?? recentConsultations
    return Array.isArray(raw) ? raw : []
  }, [recentConsultations])

  const nearbyList = useMemo(() => (extractArray(nearby as any) as CarteCentre[]).slice(0, 3), [nearby])
  const favoriteCount = Array.isArray(favoris) ? favoris.length : 0
  const reviewCount = Array.isArray(myReviews) ? myReviews.length : 0
  const firstName = (user as any)?.prenom || (user as any)?.nom || ''

  const quickActions = [
    { href: '/patient/etablissements', icon: Building2, title: t('patient.home.actionFindEstablishment'), desc: t('patient.home.actionFindEstablishmentDesc') },
    { href: '/patient/consultations?new=1', icon: ClipboardList, title: t('patient.home.actionNewConsultation'), desc: t('patient.home.actionNewConsultationDesc') },
    { href: '/carte#sos', icon: Siren, title: t('patient.home.actionSos'), desc: t('patient.home.actionSosDesc'), urgent: true },
    { href: '/patient/avis', icon: Star, title: t('patient.home.actionMyReviews'), desc: t('patient.home.actionMyReviewsDesc') },
    { href: '/patient/favoris', icon: Heart, title: t('patient.home.actionFavorites'), desc: t('patient.home.actionFavoritesDesc') },
    { href: '/patient/parametres', icon: Settings, title: t('patient.home.actionSettings'), desc: t('patient.home.actionSettingsDesc') },
  ]

  const statConsultations = stats?.total ?? 0
  const statUnreadMessages = unreadMessages?.count ?? 0
  const statUnreadNotifs = unreadNotifs?.count ?? 0

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 px-3 py-6 sm:px-6">
      <SectionHeader
        title={firstName ? t('patient.home.welcome', { name: firstName }) : t('patient.home.title')}
        description={t('patient.home.subtitle')}
      />

      {/* SOS banner */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/25 dark:bg-red-500/10">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white">
            <Siren className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-red-900 dark:text-red-100">{t('patient.home.sosBanner')}</p>
            <p className="text-xs text-red-700 dark:text-red-300">{t('patient.home.sosBannerDesc')}</p>
          </div>
        </div>
        <Link
          href="/carte#sos"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-bold text-white transition hover:bg-red-700"
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          {t('patient.home.sosTrigger')}
        </Link>
      </div>

      {/* KPI band */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={ClipboardList} label={t('patient.home.statConsultations')} value={statConsultations} tile="accent" delay={0} />
        <StatCard icon={Heart} label={t('patient.home.statFavorites')} value={favoriteCount} tile="red" delay={60} />
        <StatCard icon={MessageSquare} label={t('patient.home.statUnreadMessages')} value={statUnreadMessages} tile="mint" delay={120} />
        <StatCard icon={MapPin} label={t('patient.home.statUnreadNotifications')} value={statUnreadNotifs} tile="amber" delay={180} />
      </div>

      {/* Quick actions */}
      <GlassCard className="mt-4 p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">{t('patient.home.quickActions')}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-primary-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-500/40 dark:hover:bg-slate-900/60"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  action.urgent
                    ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
                    : 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-mint-200'
                }`}
              >
                <action.icon className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-100">{action.title}</span>
                <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">{action.desc}</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-primary-500 dark:text-slate-600" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </GlassCard>

      {/* Recent consultations */}
      <GlassCard className="mt-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">{t('patient.home.recentConsultations')}</p>
          <Link href="/patient/consultations" className="text-xs font-bold text-primary-600 hover:text-primary-500 dark:text-mint-200">
            {t('patient.home.viewAll')}
          </Link>
        </div>
        {consultationList.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-slate-200 p-5 text-center dark:border-slate-700">
            <ClipboardList className="mx-auto h-6 w-6 text-slate-300 dark:text-slate-600" aria-hidden="true" />
            <p className="mt-2 text-xs font-bold text-slate-600 dark:text-slate-300">{t('patient.home.emptyConsultations')}</p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{t('patient.home.emptyConsultationsDesc')}</p>
            <Link
              href="/patient/consultations?new=1"
              className="mt-3 inline-flex min-h-8 items-center rounded-lg bg-primary-900 px-3 text-xs font-bold text-white transition hover:bg-primary-800 dark:bg-white dark:text-primary-900"
            >
              {t('patient.home.startConsultation')}
            </Link>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {consultationList.map((c: any) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{c.motif || t('patient.consultations.fallbackTitle')}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {new Date(c.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    {c.etablissement?.nom ? ` · ${c.etablissement.nom}` : ''}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                    c.statut === 'OUVERTE'
                      ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200'
                      : c.statut === 'EN_COURS'
                        ? 'border-mint-200 bg-mint-50 text-primary-700 dark:border-primary-500/25 dark:bg-primary-500/10 dark:text-mint-200'
                        : c.statut === 'TERMINEE'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200'
                          : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                  }`}
                >
                  {t(`consultations.${c.statut === 'OUVERTE' ? 'pending' : c.statut === 'EN_COURS' ? 'inProgress' : c.statut === 'TERMINEE' ? 'finished' : 'cancelled'}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {/* Nearby establishments */}
      <GlassCard className="mt-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">{t('patient.home.recentEstablishments')}</p>
          <Link href="/patient/etablissements" className="text-xs font-bold text-primary-600 hover:text-primary-500 dark:text-mint-200">
            {t('patient.home.viewAll')}
          </Link>
        </div>
        {nearbyList.length === 0 ? (
          <p className="mt-3 text-xs text-slate-400">{t('patient.etablissements.emptyTitle')}</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {nearbyList.map((centre) => (
              <EstablishmentCard key={centre.id} centre={centre} />
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
