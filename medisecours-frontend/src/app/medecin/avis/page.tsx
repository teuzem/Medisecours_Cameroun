'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Star, Flag } from 'lucide-react'
import useSWR, { mutate as globalMutate } from 'swr'
import api from '../../../api/axios'
import { useAuth } from '../../../hooks/useAuth'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import EmptyState from '../../../components/ui/EmptyState'
import Avatar from '../../../components/ui/Avatar'
import { useToast } from '../../../components/ui/Toast'
import { fetcher } from '../../../lib/fetcher'
import type { Avis } from '../../../types/api'

function patientName(patient: Avis['patient'] | undefined, t: (key: string) => string): string {
  if (!patient || typeof patient === 'string') return t('medecin.avis.patientFallback')
  return [patient.prenom, patient.nom].filter(Boolean).join(' ').trim() || t('medecin.avis.patientFallback')
}

export default function MedecinAvisPage() {
  const { user } = useAuth()
  const toast = useToast()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const { data: avis = [], isLoading } = useSWR<Avis[]>(
    user?.id ? `/api/avis?medecin=${user.id}` : null,
    fetcher,
    { keepPreviousData: true }
  )
  const [reportTarget, setReportTarget] = useState<Avis | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)

  const sorted = useMemo(
    () => [...avis].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [avis]
  )

  const noteMoyenne = avis.length ? (avis.reduce((s, a) => s + a.note, 0) / avis.length).toFixed(1) : 0
  const cinqEtoiles = avis.filter((a) => a.note === 5).length
  const signales = avis.filter((a) => a.signale).length

  const distribution = useMemo(() => {
    const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    avis.forEach((a) => { dist[a.note] = (dist[a.note] || 0) + 1 })
    return dist
  }, [avis])

  const submitReport = async () => {
    if (!reportTarget) return
    setSubmittingReport(true)
    try {
      await api.post(`/api/avis/${reportTarget.id}/signaler`, { raison: reportReason })
      const swrKey = `/api/avis?medecin=${user?.id}`
      globalMutate<Avis[]>(swrKey, (prev) => {
        const arr = prev ?? []
        return arr.map((x) => (x.id === reportTarget.id ? { ...x, signale: true, raisonSignalement: reportReason } : x))
      }, { revalidate: false })
      toast.success(t('medecin.avis.reported'))
      setReportTarget(null)
      setReportReason('')
    } catch {
      toast.error(t('medecin.avis.reportFailed'))
    } finally {
      setSubmittingReport(false)
    }
  }



  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header card */}
      <div className="rounded-2xl bg-white dark:bg-primary-800 border border-primary-100 dark:border-white/5 p-8">
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="text-center shrink-0">
            <p className="font-display font-extrabold text-6xl text-primary-900 dark:text-sable">{noteMoyenne}<span className="text-2xl text-primary-300">/5</span></p>
            <div className="flex items-center justify-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className={`w-5 h-5 ${i <= Math.round(Number(noteMoyenne)) ? 'text-amber-400' : 'text-gray-200 dark:text-primary-700'}`} fill="currentColor" />
              ))}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-primary-300 justify-center">
              <span>{t('medecin.avis.totalReviews', { count: avis.length })}</span>
              <span>{t('medecin.avis.fiveStars', { count: cinqEtoiles })}</span>
              <span>{t('medecin.avis.reportedCount', { count: signales })}</span>
            </div>
          </div>

          <div className="flex-1 w-full space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = distribution[star] || 0
              const pct = avis.length ? (count / avis.length) * 100 : 0
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-xs text-primary-300 w-3">{star}</span>
                  <Star className="w-3 h-3 text-amber-400" fill="currentColor" />
                  <div className="flex-1 h-2 rounded-full bg-primary-100 dark:bg-primary-900/60 overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-primary-300 w-6 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Reviews list */}
      {isLoading ? (
        <LoadingSpinner label={t('medecin.avis.loading')} />
      ) : sorted.length === 0 ? (
        <EmptyState icon={Star} title={t('medecin.avis.emptyTitle')} description={t('medecin.avis.emptyDesc')} />
      ) : (
        <div className="space-y-3">
          {sorted.map((a) => (
            <div key={a.id} className="rounded-2xl bg-white dark:bg-primary-800 border border-primary-100 dark:border-white/5 p-5">
              {a.signale && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-amber-100 text-amber-700 text-xs font-semibold">
                  {t('medecin.avis.reportedBanner')}{a.raisonSignalement ? ` : ${a.raisonSignalement}` : ''}
                </div>
              )}
              <div className="flex items-start gap-3">
                <Avatar name={patientName(a.patient, t)} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-primary-900 dark:text-sable">{patientName(a.patient, t)}</p>
                    <p className="text-xs text-primary-300">
                      {new Date(a.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 my-1.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i <= a.note ? 'text-amber-400' : 'text-gray-200 dark:text-primary-700'}`} fill="currentColor" />
                    ))}
                  </div>
                  {a.commentaire && <p className="text-sm text-primary-700 dark:text-sable">{a.commentaire}</p>}

                  {!a.signale && (
                    <button
                      onClick={() => setReportTarget(a)}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-urgence-500 hover:text-urgence-700"
                    >
                      <Flag className="w-3.5 h-3.5" /> {t('medecin.avis.reportInappropriate')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report modal */}
      {reportTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setReportTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-primary-800 rounded-2xl shadow-glass w-full max-w-sm p-5">
            <h3 className="font-display font-bold text-primary-900 dark:text-sable mb-3">{t('medecin.avis.reportTitle')}</h3>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder={t('medecin.avis.reportPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-white/10 bg-white dark:bg-primary-900/40 focus:outline-none focus:ring-2 focus:ring-mint-500 text-sm"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => setReportTarget(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-primary-500 dark:text-sable hover:bg-primary-100 dark:hover:bg-primary-700">{t('common.cancel')}</button>
              <button
                onClick={submitReport}
                disabled={submittingReport || !reportReason.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-urgence-500 hover:bg-urgence-700 text-white disabled:opacity-60"
              >
                {submittingReport ? t('medecin.avis.sending') : t('medecin.avis.report')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
