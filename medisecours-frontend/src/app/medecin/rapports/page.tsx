// @ts-nocheck
'use client'

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import { ArrowLeft, FileText, Save, Printer, CheckCircle2, ChevronRight, Search, Stethoscope, User } from 'lucide-react'
import api from '../../../api/axios'
import { fetcher } from '../../../lib/fetcher'
import { useAuth } from '../../../hooks/useAuth'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import EmptyState from '../../../components/ui/EmptyState'
import { CONSULTATIONS_KEY } from '../../../lib/keys'
import { idStrFromRelation } from '../../../types/api'

function idFromRelation(r) {
  if (!r) return null
  if (typeof r === 'object') return r.id
  if (typeof r === 'string') return r.split('/').pop()
  return r
}

function formatDate(d, locale) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function MedecinRapportsPage() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const { data: consData, mutate: mutateCons } = useSWR(CONSULTATIONS_KEY, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  const consultations = useMemo(() => {
    const raw = Array.isArray(consData) ? consData : consData?.['hydra:member'] ?? consData?.member ?? []
    return raw.filter((c) => c.statut === 'TERMINEE' || c.statut === 'EN_COURS' || c.statut === 'OUVERTE')
  }, [consData])

  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [observations, setObservations] = useState('')
  const [conclusions, setConclusions] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const selected = useMemo(
    () => consultations.find((c) => String(c.id) === String(selectedId)),
    [consultations, selectedId]
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return consultations
    const q = search.toLowerCase()
    return consultations.filter((c) => {
      const patientName = `${c.patient?.prenom || ''} ${c.patient?.nom || ''}`.toLowerCase()
      const motif = (c.motif || '').toLowerCase()
      return patientName.includes(q) || motif.includes(q)
    })
  }, [consultations, search])

  function handleSelect(c) {
    setSelectedId(c.id)
    setSaved(false)
    const existing = c.compteRendu || ''
    const parts = existing.split('\n---\n')
    if (parts.length === 2) {
      setObservations(parts[0])
      setConclusions(parts[1])
    } else {
      setObservations(existing)
      setConclusions('')
    }
  }

  async function handleSave() {
    if (!selectedId) return
    setSaving(true)
    try {
      const compteRendu = [observations.trim(), conclusions.trim()].filter(Boolean).join('\n---\n')
      await api.patch(`/api/consultations/${selectedId}`, { compteRendu }, {
        headers: { 'Content-Type': 'application/merge-patch+json' },
      })
      setSaved(true)
      mutateCons()
    } catch {
    } finally {
      setSaving(false)
    }
  }

  function handlePrint() {
    const patientName = selected?.patient ? `${selected.patient.prenom || ''} ${selected.patient.nom || ''}`.trim() : '—'
    const content = `
      <html><head><title>${t('medecin.rapports.printTitle', { name: patientName })}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
        h1 { color: #1D4E89; font-size: 20px; border-bottom: 2px solid #1D4E89; padding-bottom: 8px; }
        h2 { color: #3B6EF8; font-size: 14px; margin-top: 24px; }
        .meta { font-size: 13px; color: #666; margin-bottom: 20px; }
        .section { margin-bottom: 16px; white-space: pre-wrap; font-size: 13px; line-height: 1.6; }
        .footer { margin-top: 40px; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
      </style></head><body>
        <h1>${t('medecin.rapports.printDocTitle')}</h1>
        <div class="meta">
          <p><strong>${t('medecin.rapports.printPatient')}</strong> ${patientName}</p>
          <p><strong>${t('medecin.rapports.printDate')}</strong> ${formatDate(selected?.createdAt, locale)}</p>
          <p><strong>${t('medecin.rapports.printMotif')}</strong> ${selected?.motif || '—'}</p>
          <p><strong>${t('medecin.rapports.printStatus')}</strong> ${selected?.statut || '—'}</p>
        </div>
        <h2>${t('medecin.rapports.observations')}</h2>
        <div class="section">${observations || t('medecin.rapports.noObservations')}</div>
        <h2>${t('medecin.rapports.conclusions')}</h2>
        <div class="section">${conclusions || t('medecin.rapports.noConclusions')}</div>
        <div class="footer">${t('medecin.rapports.printFooter', { date: new Date().toLocaleDateString(locale), name: `${user?.prenom || ''} ${user?.nom || ''}` })}</div>
      </body></html>
    `
    const win = window.open('', '_blank')
    win.document.write(content)
    win.document.close()
    win.print()
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden">
      <div className={`mx-auto w-full max-w-7xl shrink-0 px-4 pb-4 pt-5 sm:px-6 lg:pb-6 lg:pt-8 ${
        selectedId ? 'hidden lg:block' : 'block'
      }`}>
        <h2 className="font-display text-xl font-bold text-[#0F2C52] sm:text-2xl">{t('medecin.rapports.pageTitle')}</h2>
        <p className="mt-1 text-sm text-[#6B7280]">{t('medecin.rapports.pageDesc')}</p>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 lg:gap-6 lg:px-6 lg:pb-8">
        {/* Left panel — consultation list */}
        <div className={`h-full w-full shrink-0 lg:w-[380px] ${
          selectedId ? 'hidden lg:block' : 'block'
        }`}>
          <div className="flex h-full flex-col overflow-hidden border-y border-[#E5E7EB] bg-white lg:rounded-2xl lg:border">
            <div className="border-b border-[#E5E7EB] px-4 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('medecin.rapports.searchPlaceholder')}
                  className="w-full rounded-xl bg-[#F3F4F6] py-2 pl-9 pr-3 text-sm text-[#374151] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#3B6EF8]/20"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <EmptyState icon={Stethoscope} title={t('medecin.rapports.emptyTitle')} description={t('medecin.rapports.emptyDesc')} />
              ) : (
                filtered.map((c) => {
                  const patientName = c.patient ? `${c.patient.prenom || ''} ${c.patient.nom || ''}`.trim() : t('medecin.rapports.unknown')
                  const isActive = String(c.id) === String(selectedId)
                  const hasReport = !!c.compteRendu
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelect(c)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition border-b border-[#F3F4F6] last:border-0 ${
                        isActive ? 'bg-[#F0F4FF]' : 'hover:bg-[#F9FAFB]'
                      }`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        hasReport ? 'bg-emerald-100' : 'bg-[#F3F4F6]'
                      }`}>
                        {hasReport ? (
                          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                        ) : (
                          <FileText className="h-4.5 w-4.5 text-[#9CA3AF]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${isActive ? 'text-[#3B6EF8]' : 'text-[#0F2C52]'}`}>
                          {patientName}
                        </p>
                        <p className="text-xs text-[#9CA3AF] truncate">{c.motif || t('medecin.rapports.noMotif')}</p>
                        <p className="text-[10px] text-[#9CA3AF]">{formatDate(c.createdAt, locale)}</p>
                      </div>
                      <ChevronRight className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#3B6EF8]' : 'text-[#D1D5DB]'}`} />
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Right panel — report editor */}
        <div className={`min-w-0 flex-1 overflow-y-auto ${
          selectedId ? 'block' : 'hidden lg:block'
        }`}>
          {!selected ? (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white flex flex-col items-center justify-center py-20 px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F3F4F6] mb-4">
                <FileText className="h-8 w-8 text-[#D1D5DB]" />
              </div>
              <p className="text-base font-semibold text-[#374151] mb-1">{t('medecin.rapports.selectConsultation')}</p>
              <p className="text-sm text-[#9CA3AF] text-center max-w-xs">
                {t('medecin.rapports.selectConsultationDesc')}
              </p>
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 lg:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#6B7280] transition hover:bg-[#F3F4F6]"
                  aria-label={t('medecin.rapports.backToList')}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#3B6EF8]/10">
                  <FileText className="h-4 w-4 text-[#3B6EF8]" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#0F2C52]">
                    {selected.patient?.prenom || ''} {selected.patient?.nom || ''}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF]">{t('medecin.rapports.medicalReport')}</p>
                </div>
              </div>

              <div className="overflow-hidden border-y border-[#E5E7EB] bg-white lg:rounded-2xl lg:border">
              {/* Patient info header */}
              <div className="border-b border-[#E5E7EB] bg-[#F8FAFF] px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3B6EF8]/10">
                      <User className="h-5 w-5 text-[#3B6EF8]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#0F2C52]">
                        {selected.patient?.prenom || ''} {selected.patient?.nom || ''}
                      </p>
                      <p className="break-words text-xs text-[#6B7280]">
                        {t('medecin.rapports.consultationDate', { date: formatDate(selected.createdAt, locale) })} {selected.motif ? `· ${selected.motif}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                      selected.statut === 'TERMINEE' ? 'bg-emerald-100 text-emerald-700' :
                      selected.statut === 'EN_COURS' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {selected.statut}
                    </span>
                    {selected.compteRendu && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> {t('medecin.rapports.written')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-5 px-4 py-5 sm:px-6">
                <div>
                  <label className="block text-sm font-semibold text-[#0F2C52] mb-1.5">
                    {t('medecin.rapports.observations')}
                  </label>
                  <textarea
                    value={observations}
                    onChange={(e) => { setObservations(e.target.value); setSaved(false) }}
                    placeholder={t('medecin.rapports.observationsPlaceholder')}
                    rows={8}
                    className="w-full rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] px-4 py-3 text-sm text-[#374151] placeholder-[#9CA3AF] outline-none transition focus:border-[#3B6EF8] focus:ring-2 focus:ring-[#3B6EF8]/10 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#0F2C52] mb-1.5">
                    {t('medecin.rapports.conclusions')}
                  </label>
                  <textarea
                    value={conclusions}
                    onChange={(e) => { setConclusions(e.target.value); setSaved(false) }}
                    placeholder={t('medecin.rapports.conclusionsPlaceholder')}
                    rows={6}
                    className="w-full rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] px-4 py-3 text-sm text-[#374151] placeholder-[#9CA3AF] outline-none transition focus:border-[#3B6EF8] focus:ring-2 focus:ring-[#3B6EF8]/10 resize-none"
                  />
                </div>
              </div>

              {/* Action bar */}
              <div className="sticky bottom-0 flex flex-col gap-3 border-t border-[#E5E7EB] bg-[#FAFBFC] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-h-5 items-center gap-2">
                  {saved && (
                    <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                      <CheckCircle2 className="h-4 w-4" /> {t('medecin.rapports.saved')}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-3">
                  <button
                    onClick={handlePrint}
                    disabled={!selected.compteRendu && !observations.trim() && !conclusions.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] transition hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Printer className="h-4 w-4" />
                    {t('medecin.rapports.print')}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || (!observations.trim() && !conclusions.trim())}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3B6EF8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2D5CD8] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {t('medecin.rapports.saveReport')}
                  </button>
                </div>
              </div>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
