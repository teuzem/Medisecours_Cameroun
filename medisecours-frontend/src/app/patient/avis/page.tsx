'use client'

import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { Building2, Loader2, MapPin, Star, Trash2 } from 'lucide-react'
import useSWR from 'swr'
import { mutate as globalMutate } from 'swr'
import api from '../../../api/axios'
import { useAuth } from '../../../hooks/useAuth'
import { fetcher } from '../../../lib/fetcher'
import { AVIS_ETABLISSEMENTS_KEY } from '../../../lib/keys'
import type { Avis } from '../../../lib/carte'
import GlassCard from '../../../components/ui/GlassCard'
import SectionHeader from '../../../components/ui/SectionHeader'
import { useToast } from '../../../components/ui/Toast'

export default function PatientAvisPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const { user, isAuthenticated } = useAuth()
  const toast = useToast()

  const { data, isLoading, error, mutate } = useSWR(
    isAuthenticated ? `${AVIS_ETABLISSEMENTS_KEY}?order[createdAt]=desc&itemsPerPage=100` : null,
    fetcher,
  )

  const myReviews = useMemo<Avis[]>(() => {
    if (!data) return []
    const raw = (data as any)['hydra:member'] ?? data
    if (!Array.isArray(raw)) return []
    const uid = (user as any)?.id
    if (!uid) return []
    return raw.filter((a: any) => a.user?.id === uid || a.userId === uid)
  }, [data, user])

  const removeReview = useCallback(
    async (id: number) => {
      if (!window.confirm(t('patient.avisPage.deleteConfirm'))) return
      try {
        await api.delete(`/api/avis_etablissements/${id}`)
        toast.success(t('patient.avisPage.delete'))
        await mutate()
        void globalMutate((key) => typeof key === 'string' && key.includes('/api/avis_etablissements'))
      } catch {
        toast.error(t('patient.avisPage.loadError'))
      }
    },
    [mutate, toast, t],
  )

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 px-3 py-6 sm:px-6">
      <SectionHeader
        title={t('patient.avisPage.title')}
        description={t('patient.avisPage.subtitle')}
        action={
          <Link
            href="/patient/etablissements"
            className="inline-flex min-h-8 items-center rounded-lg bg-primary-900 px-3 text-xs font-bold text-white transition hover:bg-primary-800 dark:bg-white dark:text-primary-900"
          >
            {t('patient.avisPage.explore')}
          </Link>
        }
      />

      {isLoading ? (
        <div className="mt-8 flex items-center justify-center gap-2 py-10 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : error ? (
        <GlassCard className="mt-4 p-8 text-center">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('patient.avisPage.loadError')}</p>
        </GlassCard>
      ) : myReviews.length === 0 ? (
        <GlassCard className="mt-4 p-8 text-center">
          <Star className="mx-auto h-6 w-6 text-slate-300 dark:text-slate-600" aria-hidden="true" />
          <p className="mt-2 text-xs font-bold text-slate-600 dark:text-slate-300">{t('patient.avisPage.emptyTitle')}</p>
          <p className="mt-1 text-[11px] text-slate-400">{t('patient.avisPage.emptyDesc')}</p>
          <Link
            href="/patient/etablissements"
            className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-primary-900 px-3 text-xs font-bold text-white transition hover:bg-primary-800 dark:bg-white dark:text-primary-900"
          >
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('patient.avisPage.explore')}
          </Link>
        </GlassCard>
      ) : (
        <ul className="mt-4 space-y-3">
          {myReviews.map((a: any) => (
            <li key={a.id}>
              <GlassCard className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                      {a.etablissement?.nom || t('patient.avisPage.notFound')}
                    </p>
                    {a.etablissement?.ville && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        {a.etablissement.ville}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeReview(a.id)}
                    aria-label={t('patient.avisPage.delete')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-300 hover:text-red-500 dark:border-slate-700 dark:hover:border-red-500/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-0.5" aria-label={`${a.note}/5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-3.5 w-3.5 ${n <= a.note ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'}`} />
                  ))}
                </div>
                {a.commentaire && <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{a.commentaire}</p>}
                <p className="mt-1.5 text-[10px] text-slate-400">
                  {t('patient.avisPage.published', {
                    date: new Date(a.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }),
                  })}
                </p>
              </GlassCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
