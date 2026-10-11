'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Search, ShieldCheck } from 'lucide-react'
import api from '../../../api/axios'
import GlassCard from '../../../components/ui/GlassCard'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

type DossierLite = {
  id: number
  numero: string
  statut: string
  createdAt: string
  patient: { id: string; nom: string; prenom: string; telephone?: string; email?: string } | null
}

type Evenement = {
  id: number
  type: string
  titre: string
  details?: Record<string, unknown> | null
  auteur?: string | null
  signatureHash?: string | null
  createdAt: string
}

export default function PersonnelDossiersPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'

  const [query, setQuery] = useState('')
  const [dossiers, setDossiers] = useState<DossierLite[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DossierLite | null>(null)
  const [evenements, setEvenements] = useState<Evenement[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback((q: string) => {
    api.get('/api/personnel/dossiers', { params: q ? { q } : {} })
      .then((res) => setDossiers(res.data?.dossiers ?? []))
      .catch(() => setDossiers([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load('')
  }, [load])

  const onSearch = (value: string) => {
    setQuery(value)
    setLoading(true)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => load(value.trim()), 300)
  }

  const openTimeline = async (dossier: DossierLite) => {
    setSelected(dossier)
    setTimelineLoading(true)
    setEvenements([])
    try {
      const res = await api.get(`/api/personnel/dossiers/${dossier.id}`)
      setEvenements(res.data?.evenements ?? [])
    } catch {
      setEvenements([])
    } finally {
      setTimelineLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <h2 className="font-display text-lg font-bold text-[#0F2C52] dark:text-white">
        {t('personnel.dossiers.titre')}
      </h2>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" aria-hidden />
        <input
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t('personnel.dossiers.rechercher')}
          className="w-full rounded-lg border border-[#E5E7EB] bg-white py-2.5 pl-9 pr-3.5 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
        />
      </div>

      <GlassCard className="mt-4 p-2">
        {loading ? (
          <div className="py-10"><LoadingSpinner /></div>
        ) : dossiers.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#6B7280] dark:text-[#9CA3AF]">{t('personnel.dossiers.aucun')}</p>
        ) : (
          <ul className="divide-y divide-[#F3F4F6] dark:divide-white/5">
            {dossiers.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => openTimeline(d)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm hover:bg-[#F9FAFB] dark:hover:bg-white/5 ${
                    selected?.id === d.id ? 'bg-[#F3F4F6] dark:bg-white/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-4 w-4 shrink-0 text-[#9CA3AF]" aria-hidden />
                    <div>
                      <p className="font-semibold text-[#111827] dark:text-white">
                        {d.patient ? `${d.patient.prenom} ${d.patient.nom}` : '—'}
                      </p>
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                        {t('personnel.dossiers.numero')} {d.numero} · {t('personnel.dossiers.ouvertLe')} {new Date(d.createdAt).toLocaleDateString(locale)}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    d.statut === 'OUVERT'
                      ? 'bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-400'
                      : 'bg-[#F3F4F6] text-[#6B7280] dark:bg-white/5 dark:text-[#9CA3AF]'
                  }`}>
                    {d.statut === 'OUVERT' ? t('personnel.dossiers.ouvert') : t('personnel.dossiers.clos')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {selected && (
        <section className="mt-6">
          <h3 className="font-display text-sm font-bold text-[#0F2C52] dark:text-white">
            {t('personnel.dossiers.timeline')} — {selected.patient ? `${selected.patient.prenom} ${selected.patient.nom}` : selected.numero}
          </h3>
          <GlassCard className="mt-3 p-4">
            {timelineLoading ? (
              <div className="py-8"><LoadingSpinner /></div>
            ) : evenements.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#6B7280] dark:text-[#9CA3AF]">{t('personnel.dossiers.aucunEvenement')}</p>
            ) : (
              <ol className="space-y-4">
                {evenements.map((ev) => (
                  <li key={ev.id} className="relative border-l-2 border-[#E5E7EB] pl-4 dark:border-white/10">
                    <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-[#0F2C52] dark:bg-mint-500" aria-hidden />
                    <p className="text-sm font-semibold text-[#111827] dark:text-white">{ev.titre}</p>
                    <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      {t(`personnel.dossiers.types.${ev.type}`)}
                      {ev.auteur ? ` · ${ev.auteur}` : ''} · {new Date(ev.createdAt).toLocaleString(locale)}
                    </p>
                    {ev.details && (
                      <ul className="mt-1.5 space-y-0.5">
                        {Object.entries(ev.details)
                          .filter(([, value]) => value !== null && value !== undefined && value !== '')
                          .slice(0, 8)
                          .map(([key, value]) => (
                            <li key={key} className="text-xs text-[#374151] dark:text-[#D1D5DB]">
                              <span className="font-medium">{key}</span> : {String(value)}
                            </li>
                          ))}
                      </ul>
                    )}
                    {ev.signatureHash && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-mint-700 dark:text-mint-400">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                        {t('personnel.dossiers.signe')} · <code className="text-[10px]">{ev.signatureHash.slice(0, 16)}…</code>
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </GlassCard>
        </section>
      )}
    </div>
  )
}
