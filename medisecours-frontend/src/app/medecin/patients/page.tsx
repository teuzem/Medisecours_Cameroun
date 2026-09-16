// @ts-nocheck
'use client'

import { useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Search, Phone, Mail, MessageSquare, Stethoscope, Droplets, AlertTriangle, ChevronRight, Calendar, Clock, User, Shield, HeartPulse, FileText, RefreshCw } from 'lucide-react'
import useSWR from 'swr'
import { useAuth } from '../../../hooks/useAuth'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import Avatar from '../../../components/ui/Avatar'
import { imgUrl } from '../../../lib/config'
import { fetcher } from '../../../lib/fetcher'
import {
  STATUT_BADGE_BORDER as STATUT_BADGE,
  STATUT_CONSULTATION_LABEL as STATUT_LABEL,
} from '../../../lib/consultations'
import { CONSULTATIONS_KEY, PATIENTS_KEY } from '../../../lib/keys'
import { idStrFromRelation } from '../../../types/api'

export default function MedecinPatientsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const doctorId = user?.id ? String(user.id) : null
  // Le scope utilisateur empêche SWR de réutiliser les données d'un autre médecin.
  const patientScopeKey = doctorId
    ? `${PATIENTS_KEY}?scope=${encodeURIComponent(doctorId)}`
    : null
  const consultationScopeKey = doctorId
    ? `${CONSULTATIONS_KEY}?scope=${encodeURIComponent(doctorId)}`
    : null
  const {
    data: patients = [],
    isLoading,
    error: patientsError,
    mutate: reloadPatients,
  } = useSWR(patientScopeKey, fetcher, { keepPreviousData: false })
  const { data: consultations = [] } = useSWR(consultationScopeKey, fetcher, {
    keepPreviousData: false,
  })
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const doctorConsultations = useMemo(() => {
    if (!doctorId) return []
    return consultations.filter(
      (consultation) => idStrFromRelation(consultation.medecin) === doctorId
    )
  }, [consultations, doctorId])

  const filteredPatients = useMemo(() => {
    if (!search.trim()) return patients
    const q = search.toLowerCase()
    return patients.filter((p) =>
      `${p.prenom || ''} ${p.nom || ''}`.toLowerCase().includes(q) ||
      p.telephone?.includes(q) ||
      p.email?.toLowerCase().includes(q)
    )
  }, [patients, search])

  const selectedPatient = useMemo(() => {
    if (!selectedId) return null
    return patients.find((p) => p.id === selectedId) || null
  }, [patients, selectedId])

  const patientConsults = useMemo(() => {
    if (!selectedPatient) return []
    return doctorConsultations
      .filter((c) => idStrFromRelation(c.patient) === String(selectedPatient.id))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  }, [doctorConsultations, selectedPatient])

  return (
    <div className="medecin-patients-page flex h-[calc(100dvh-4rem)] min-h-0 overflow-hidden">
      {/* ── Left Panel: Patient List ── */}
      <div className={`medecin-patients-list w-full lg:w-[360px] shrink-0 border-r flex-col ${
        selectedId ? 'hidden lg:flex' : 'flex'
      }`}>
        <div className="medecin-patients-list-header p-4 border-b">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="medecin-patients-eyebrow">{t('medecin.patients.eyebrow')}</p>
              <h2 className="text-base font-bold">{t('medecin.patients.title')}</h2>
            </div>
            <span className="medecin-patients-count">{patients.length}</span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('medecin.patients.searchPlaceholder')}
              className="medecin-patients-search w-full rounded-lg py-2.5 pl-9 pr-3 text-sm outline-none transition"
            />
          </div>
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {patientsError ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <AlertTriangle className="mb-3 h-10 w-10 text-amber-500" />
              <p className="text-sm font-semibold text-[#374151]">{t('medecin.patients.loadErrorTitle')}</p>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                {t('medecin.patients.loadErrorDesc')}
              </p>
              <button
                type="button"
                onClick={() => reloadPatients()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#3B6EF8] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2D5BD4]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t('medecin.patients.retry')}
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex h-full items-center justify-center px-6">
              <LoadingSpinner label={t('medecin.patients.loading')} />
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <User className="h-10 w-10 text-[#D1D5DB] mb-3" />
              <p className="text-sm font-medium text-[#6B7280]">
                {search ? t('medecin.patients.noResult') : t('medecin.patients.noPatients')}
              </p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                {search ? t('medecin.patients.tryAnotherTerm') : t('medecin.patients.willAppearHere')}
              </p>
            </div>
          ) : (
            filteredPatients.map((p) => {
              const consCount = doctorConsultations.filter(
                (c) => idStrFromRelation(c.patient) === String(p.id)
              ).length
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`medecin-patient-row flex w-full items-center gap-3 px-4 py-3 text-left transition border-b last:border-0 ${
                    selectedId === p.id ? 'medecin-patient-row-active' : ''
                  }`}
                >
                  <Avatar
                    name={`${p.prenom || ''} ${p.nom || ''}`.trim()}
                    size="sm"
                    src={imgUrl(p.photoProfil)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${selectedId === p.id ? 'font-bold' : 'font-semibold'}`}>
                      {p.prenom} {p.nom}
                    </p>
                    <p className="medecin-patient-meta text-[11px] truncate">
                      {p.telephone || p.email || '—'}
                    </p>
                    {consCount > 0 && (
                      <p className="medecin-patient-consults text-[10px] mt-0.5">{t('medecin.patients.consultationsCount', { count: consCount })}</p>
                    )}
                  </div>
                  <ChevronRight className={`h-4 w-4 ${selectedId === p.id ? 'text-[#3B6EF8]' : 'text-[#D1D5DB]'}`} />
                </button>
              )
            })
          )}
        </div>
        <div className="p-3 border-t border-[#E5E7EB] text-center text-[10px] text-[#9CA3AF]">
          {t('medecin.patients.footerCount', { total: patients.length, shown: filteredPatients.length })}
        </div>
      </div>

      {/* ── Right Panel: Patient Profile ── */}
      <div className={`medecin-patients-detail min-w-0 flex-1 overflow-y-auto ${
        selectedId ? 'block' : 'hidden lg:block'
      }`}>
        {selectedPatient ? (
          <>
            <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 lg:hidden">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#6B7280] transition hover:bg-[#F3F4F6]"
                aria-label={t('medecin.patients.backToList')}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Avatar
                name={`${selectedPatient.prenom || ''} ${selectedPatient.nom || ''}`.trim()}
                size="sm"
                src={imgUrl(selectedPatient.photoProfil)}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#0F2C52]">
                  {selectedPatient.prenom} {selectedPatient.nom}
                </p>
                <p className="text-[11px] text-[#9CA3AF]">{t('medecin.patients.record')}</p>
              </div>
            </div>

            <div className="mx-auto max-w-5xl space-y-4 p-4 sm:space-y-5 sm:p-7">
            {/* Profile Header */}
            <div className="medecin-patient-panel flex flex-col items-start gap-4 rounded-xl p-4 sm:flex-row sm:gap-5 sm:p-5">
              <div className="shrink-0">
                <Avatar
                  name={`${selectedPatient.prenom || ''} ${selectedPatient.nom || ''}`.trim()}
                  size="lg"
                  src={imgUrl(selectedPatient.photoProfil)}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex min-w-0 items-start justify-between gap-4">
                  <div>
                    <h1 className="break-words text-lg font-bold text-[#0F2C52] sm:text-xl">
                      {selectedPatient.prenom} {selectedPatient.nom}
                    </h1>
                    <p className="text-sm text-[#6B7280] mt-0.5">{t('medecin.patients.role')} · {selectedPatient.quartier || t('medecin.patients.addressFallback')}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  {selectedPatient.telephone && (
                    <a href={`tel:${selectedPatient.telephone}`} className="flex min-w-0 items-center gap-1.5 rounded-lg bg-[#F3F4F6] px-3 py-2 text-xs text-[#374151] transition hover:bg-[#E5E7EB]">
                      <Phone className="h-3.5 w-3.5 text-[#3B6EF8]" /> {selectedPatient.telephone}
                    </a>
                  )}
                  {selectedPatient.email && (
                    <span className="flex min-w-0 items-center gap-1.5 rounded-lg bg-[#F3F4F6] px-3 py-2 text-xs text-[#374151]">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
                      <span className="truncate">{selectedPatient.email}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 rounded-lg bg-[#F3F4F6] px-3 py-2 text-xs text-[#374151]">
                    <Calendar className="h-3.5 w-3.5 text-[#9CA3AF]" /> {t('medecin.patients.consultationsCount', { count: patientConsults.length })}
                  </span>
                </div>
              </div>
            </div>

            {/* Health Summary */}
            <div className="medecin-patient-panel rounded-xl p-5">
              <h3 className="text-sm font-bold text-[#0F2C52] flex items-center gap-2 mb-4">
                <HeartPulse className="h-4 w-4 text-[#EF4444]" /> {t('medecin.patients.healthSummary')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Blood Type */}
                <div className={`medecin-health-card rounded-lg p-4 ${selectedPatient.groupeSanguin ? 'medecin-health-card-blue' : ''}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Droplets className="h-4 w-4 text-[#3B6EF8]" />
                    <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">{t('medecin.patients.bloodGroup')}</span>
                  </div>
                  {selectedPatient.groupeSanguin ? (
                    <p className="text-2xl font-bold text-[#0F2C52]">{selectedPatient.groupeSanguin}</p>
                  ) : (
                    <p className="text-sm text-[#9CA3AF]">{t('medecin.patients.notProvided')}</p>
                  )}
                </div>

                {/* Allergies */}
                <div className={`medecin-health-card rounded-lg p-4 ${selectedPatient.allergies?.length ? 'medecin-health-card-red' : ''}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className={`h-4 w-4 ${selectedPatient.allergies?.length ? 'text-[#EF4444]' : 'text-[#9CA3AF]'}`} />
                    <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">{t('medecin.patients.allergies')}</span>
                  </div>
                  {selectedPatient.allergies?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedPatient.allergies.map((a: string) => (
                        <span key={a} className="px-2 py-0.5 rounded-full bg-red-100 text-[11px] font-medium text-red-700">{a}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#9CA3AF]">{t('medecin.patients.noneKnown')}</p>
                  )}
                </div>

                {/* Emergency Contacts */}
                <div className={`medecin-health-card rounded-lg p-4 ${selectedPatient.contactsUrgence?.length ? 'medecin-health-card-amber' : ''}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className={`h-4 w-4 ${selectedPatient.contactsUrgence?.length ? 'text-[#F59E0B]' : 'text-[#9CA3AF]'}`} />
                    <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">{t('medecin.patients.emergencyContact')}</span>
                  </div>
                  {selectedPatient.contactsUrgence?.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedPatient.contactsUrgence.map((c: any, i: number) => (
                        <div key={i} className="text-sm">
                          <p className="font-medium text-[#374151]">{c.nom}</p>
                          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                            <span>{c.telephone}</span>
                            {c.lien && <span className="text-[#F59E0B]">· {c.lien}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#9CA3AF]">{t('medecin.patients.noContact')}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="medecin-patient-panel rounded-xl p-5">
              <h3 className="text-sm font-bold text-[#0F2C52] mb-3">{t('medecin.patients.quickActions')}</h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  onClick={() => router.push(`/medecin/messages?patient=${selectedPatient.id}`)}
                  className="medecin-patient-action medecin-patient-action-primary flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition"
                >
                  <MessageSquare className="h-4 w-4" /> {t('medecin.patients.message')}
                </button>
                <button
                  onClick={() => router.push(`/medecin/consultations?patient=${selectedPatient.id}`)}
                  className="medecin-patient-action medecin-patient-action-success flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition"
                >
                  <Stethoscope className="h-4 w-4" /> {t('medecin.patients.newConsultation')}
                </button>

              </div>
            </div>

            {/* Consultation History */}
            <div className="medecin-patient-panel rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex min-w-0 items-center gap-2 text-sm font-bold text-[#0F2C52]">
                  <FileText className="h-4 w-4 text-[#3B6EF8]" /> {t('medecin.patients.historyTitle')}
                </h3>
                <span className="ml-3 shrink-0 text-xs text-[#9CA3AF]">{t('medecin.patients.totalCount', { count: patientConsults.length })}</span>
              </div>
              {patientConsults.length > 0 ? (
                <div className="space-y-2">
                  {patientConsults.map((c) => (
                    <div key={c.id} className="medecin-consultation-row flex items-start gap-3 rounded-lg border p-3 transition sm:gap-4 sm:p-4">
                      <div className="flex flex-col items-center min-w-[44px]">
                        <span className="text-xs font-bold text-[#0F2C52]">
                          {new Date(c.createdAt).toLocaleDateString(locale, { day: 'numeric' })}
                        </span>
                        <span className="text-[10px] text-[#9CA3AF]">
                          {new Date(c.createdAt).toLocaleDateString(locale, { month: 'short' })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="break-words text-sm font-semibold text-[#374151]">{c.motif || t('medecin.patients.noMotif')}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUT_BADGE[c.statut] || ''}`}>
                            {STATUT_LABEL[c.statut] || c.statut}
                          </span>
                          <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(c.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[#D1D5DB] mt-1" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <FileText className="h-10 w-10 text-[#D1D5DB] mb-3" />
                  <p className="text-sm font-medium text-[#6B7280]">{t('medecin.patients.noConsultations')}</p>
                  <p className="text-xs text-[#9CA3AF] mt-1">{t('medecin.patients.notConsultedYet')}</p>
                </div>
              )}
            </div>
          </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <User className="mx-auto h-16 w-16 text-[#D1D5DB] mb-4" />
              <h3 className="text-lg font-bold text-[#0F2C52] mb-1">{t('medecin.patients.selectPatient')}</h3>
              <p className="text-sm text-[#9CA3AF]">{t('medecin.patients.selectPatientDesc')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
