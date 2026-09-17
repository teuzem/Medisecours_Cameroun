'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, LocateFixed, Phone, Send, CheckCircle2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/axios'
import { useAuth } from '../../hooks/useAuth'
import type { Position } from '../../hooks/useWayfinding'
import { formatDistanceKm, type SosResult, type SosProche } from '../../lib/carte'

interface SosModalProps {
  open: boolean
  onClose: () => void
  position: Position | null
  onLocate: () => void
}

export default function SosModal({ open, onClose, position, onLocate }: SosModalProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [telephone, setTelephone] = useState('')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SosResult | null>(null)

  if (!open) return null

  const reset = () => {
    setResult(null)
    setError(null)
    setSending(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSend = async () => {
    if (!position) return
    setSending(true)
    setError(null)
    try {
      const { data } = await api.post('/api/demande_sos', {
        latitude: position.lat,
        longitude: position.lng,
        nom: user ? `${user.prenom ?? ''} ${user.nom ?? ''}`.trim() || null : null,
        telephone: telephone.trim() || null,
        description: description.trim() || null,
      })
      setResult(data as SosResult)
    } catch {
      setError(t('visitor.carte.sos.sendError'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('visitor.carte.sos.title')}
    >
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-600 dark:text-red-400">
                {t('visitor.carte.sos.eyebrow')}
              </p>
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                {t('visitor.carte.sos.title')}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t('visitor.carte.sos.close')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {result ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-mint-200 bg-mint-50 p-4 dark:border-mint-500/25 dark:bg-mint-500/10">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-mint-600 dark:text-mint-400" />
                <div>
                  <p className="font-bold text-slate-950 dark:text-white">{t('visitor.carte.sos.successTitle')}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{t('visitor.carte.sos.successDesc')}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                  {t('visitor.carte.sos.nearestTitle')}
                </h3>
                <div className="space-y-2">
                  {(result.proches ?? []).map((proche: SosProche) => (
                    <div
                      key={proche.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-800"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{proche.nom}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {proche.distance != null && `${formatDistanceKm(proche.distance)} · `}
                          {proche.ville || proche.adresse}
                        </p>
                      </div>
                      {proche.telephone && (
                        <a
                          href={`tel:${proche.telephone}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
                          aria-label={t('visitor.carte.sos.callTitle')}
                          title={t('visitor.carte.sos.callTitle')}
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {t('visitor.carte.sos.callNumber', { emergency: '119' })}
                </p>
              </div>

              <button
                type="button"
                onClick={reset}
                className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700"
              >
                {t('visitor.carte.sos.newAlerte')}
              </button>
            </div>
          ) : !position ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                <LocateFixed className="h-8 w-8" />
              </span>
              <div>
                <p className="font-bold text-slate-950 dark:text-white">{t('visitor.carte.sos.noPositionTitle')}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('visitor.carte.sos.noPositionDesc')}</p>
              </div>
              <button
                type="button"
                onClick={onLocate}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-700"
              >
                <LocateFixed className="h-4 w-4" />
                {t('visitor.carte.sos.locateCta')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">{t('visitor.carte.sos.description')}</p>

              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('visitor.carte.sos.telephoneLabel')}
                </span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={telephone}
                  onChange={(event) => setTelephone(event.target.value)}
                  placeholder={user?.telephone || '+237 …'}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('visitor.carte.sos.descriptionLabel')}
                </span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t('visitor.carte.sos.descriptionPlaceholder')}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                />
              </label>

              {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? t('visitor.carte.sos.sending') : t('visitor.carte.sos.send')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}