'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Plus, Trash2, Loader2, ChevronRight, ChevronLeft, AlertTriangle,
  User, Stethoscope, Pill, CheckCircle, PenLine, Save, ClipboardList,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import useSWR from 'swr'
import api from '../../api/axios'
import { fetcher } from '../../lib/fetcher'
import { useToast } from '../ui/Toast'
import { useAuth } from '../../hooks/useAuth'
import Avatar from '../ui/Avatar'
import { imgUrl } from '../../lib/config'
import { CONSULTATIONS_KEY } from '../../lib/keys'
import type { Prescription, PrescriptionMedicament } from '../../types/api'

type Step = 'choisir' | 'contexte' | 'diagnostic' | 'medicaments' | 'verification' | 'signature'

const makeSteps = (hasConsultation: boolean): { key: Step; labelKey: string; icon: any }[] => {
  const steps: { key: Step; labelKey: string; icon: any }[] = []
  if (!hasConsultation) steps.push({ key: 'choisir', labelKey: 'stepConsultation', icon: ClipboardList })
  steps.push(
    { key: 'contexte', labelKey: 'stepPatient', icon: User },
    { key: 'diagnostic', labelKey: 'stepDiagnostic', icon: Stethoscope },
    { key: 'medicaments', labelKey: 'stepMedicaments', icon: Pill },
    { key: 'verification', labelKey: 'stepVerification', icon: CheckCircle },
    { key: 'signature', labelKey: 'stepSignature', icon: PenLine },
  )
  return steps
}

const emptyMed: PrescriptionMedicament = {
  nom: '', posologie: '', duree: '', forme: '', dosage: null,
  unite: '', voieAdministration: '', frequence: '', momentPrise: '',
  dureeJours: null, quantite: null, instructions: '', siBesoin: false,
}

export default function PrescriptionFormModal({ consultation, prescription, onClose, onSaved }: {
  consultation: any
  prescription?: Prescription | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const { user } = useAuth()
  const { t } = useTranslation()
  const isEdit = !!prescription && prescription.statut === 'BROUILLON'
  const needsPicker = !consultation && !isEdit

  const STEPS = useMemo(() => makeSteps(!needsPicker), [needsPicker])
  const [step, setStep] = useState<Step>(isEdit ? 'diagnostic' : needsPicker ? 'choisir' : 'contexte')
  const [saving, setSaving] = useState(false)

  const [selectedConsultation, setSelectedConsultation] = useState<any>(consultation || null)

  const { data: consultationsData, isLoading: consultationsLoading } = useSWR(
    needsPicker ? CONSULTATIONS_KEY : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  const enCoursConsultations = useMemo(() => {
    const list = Array.isArray(consultationsData) ? consultationsData : []
    return list.filter((c: any) => c.statut === 'EN_COURS')
  }, [consultationsData])

  const activeConsultation = selectedConsultation || consultation
  const patient = activeConsultation?.patient || prescription?.patient || {}
  const patientName = `${patient.prenom || ''} ${patient.nom || ''}`.trim() || t('admin.prescriptionForm.patientFallback')

  const [diagnostic, setDiagnostic] = useState(prescription?.diagnostic || '')
  const [medicaments, setMedicaments] = useState<PrescriptionMedicament[]>(
    prescription?.medicaments?.length
      ? prescription.medicaments.map((m: any) => ({ ...emptyMed, ...m }))
      : [{ ...emptyMed }]
  )
  const [recommandations, setRecommandations] = useState(prescription?.recommandations || '')

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  const addMedicament = () => setMedicaments((prev) => [...prev, { ...emptyMed }])
  const removeMedicament = (i: number) => setMedicaments((prev) => prev.filter((_, idx) => idx !== i))
  const updateMedicament = (i: number, field: string, value: any) =>
    setMedicaments((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m))

  const validMeds = medicaments.filter((m) => m.nom.trim())

  const canNext = useMemo(() => {
    if (step === 'choisir') return !!selectedConsultation
    if (step === 'contexte') return true
    if (step === 'diagnostic') return diagnostic.trim().length > 0
    if (step === 'medicaments') return validMeds.length > 0 && validMeds.every((m) => m.posologie.trim())
    if (step === 'verification') return true
    return true
  }, [step, selectedConsultation, diagnostic, validMeds])

  const handleSubmit = async (asDraft: boolean) => {
    setSaving(true)
    try {
      const payload = {
        consultation: activeConsultation?.['@id'] || `/api/consultations/${activeConsultation?.id}`,
        diagnostic: diagnostic.trim(),
        medicaments: validMeds,
        recommandations: recommandations.trim() || null,
        statut: asDraft ? 'BROUILLON' : undefined,
      }

      if (isEdit) {
        await api.patch(`/api/prescriptions/${prescription.id}`, payload, {
          headers: { 'Content-Type': 'application/merge-patch+json' },
        })
        if (!asDraft) {
          await api.post(`/api/prescriptions/${prescription.id}/sign`, {})
        }
      } else {
        const response = await api.post<Prescription>('/api/prescriptions', payload)
        if (!asDraft) {
          await api.post(`/api/prescriptions/${response.data.id}/sign`, {})
        }
      }

      toast.success(isEdit ? t('admin.prescriptionForm.toastDraftUpdated') : (asDraft ? t('admin.prescriptionForm.toastDraftSaved') : t('admin.prescriptionForm.toastCreated')))
      onSaved()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('admin.prescriptionForm.toastError'))
    } finally {
      setSaving(false)
    }
  }

  const goNext = () => {
    const idx = STEPS.findIndex((s) => s.key === step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].key)
  }
  const goPrev = () => {
    const idx = STEPS.findIndex((s) => s.key === step)
    if (idx > 0) setStep(STEPS[idx - 1].key)
  }

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="dashboard-theme fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-primary-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-primary-900 dark:text-sable">
              {isEdit ? t('admin.prescriptionForm.titleEdit') : t('admin.prescriptionForm.titleNew')}
            </h3>
            <p className="text-xs text-primary-300">{t('admin.prescriptionForm.patientColon', { name: patientName })}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-xl hover:bg-red-50 hover:text-red-500 text-primary-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex gap-1 px-4 pt-3 pb-2 overflow-x-auto shrink-0">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => {
                if (i <= stepIndex) setStep(s.key)
              }}
              disabled={i > stepIndex}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                s.key === step
                  ? 'bg-primary-500 text-white'
                  : i < stepIndex
                    ? 'bg-primary-100 text-primary-600 dark:bg-primary-700 dark:text-mint-500'
                    : 'bg-gray-100 text-gray-400 dark:bg-primary-900 dark:text-gray-500'
              } ${i <= stepIndex ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            >
              <s.icon className="w-3.5 h-3.5" />
              {t(`admin.prescriptionForm.${s.labelKey}`)}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            {/* Step 0: Consultation picker */}
            {step === 'choisir' && (
              <motion.div key="pick" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h4 className="font-semibold text-primary-900 dark:text-sable mb-4">{t('admin.prescriptionForm.chooseConsultation')}</h4>
                <p className="text-sm text-primary-400 mb-4">{t('admin.prescriptionForm.chooseConsultationDesc')}</p>
                {consultationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary-400" />
                  </div>
                ) : enCoursConsultations.length === 0 ? (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-400">
                    {t('admin.prescriptionForm.noConsultation')}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {enCoursConsultations.map((c: any) => {
                      const pat = c.patient || {}
                      const name = `${pat.prenom || ''} ${pat.nom || ''}`.trim() || t('admin.prescriptionForm.patientFallback')
                      const isSelected = selectedConsultation?.id === c.id
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedConsultation(c)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-700/30'
                              : 'border-primary-100 dark:border-white/10 hover:bg-primary-50 dark:hover:bg-primary-900/50'
                          }`}
                        >
                          <Avatar name={name} size="md" src={imgUrl(pat.photoProfil)} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-primary-900 dark:text-sable truncate">{name}</div>
                            <div className="text-xs text-primary-400 truncate">{c.motif || t('admin.prescriptionForm.consultationEnCours')}</div>
                          </div>
                          {isSelected && <CheckCircle className="w-5 h-5 text-primary-500 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}
            {/* Step 1: Contexte patient */}
            {step === 'contexte' && (
              <motion.div key="ctx" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h4 className="font-semibold text-primary-900 dark:text-sable mb-4">{t('admin.prescriptionForm.patientInfo')}</h4>
                <div className="bg-primary-50 dark:bg-primary-900/50 rounded-xl p-4 flex items-center gap-4 mb-4">
                  <Avatar name={patientName} size="lg" src={imgUrl(patient.photoProfil)} />
                  <div>
                    <div className="font-semibold text-primary-900 dark:text-sable">{patientName}</div>
                    <div className="text-sm text-primary-300">
                      {patient.age ? t('admin.prescriptionForm.years', { count: patient.age }) : ''} {patient.sexe ? `• ${patient.sexe}` : ''}
                    </div>
                    {patient.groupeSanguin && (
                      <div className="text-xs text-primary-400 mt-1">{t('admin.prescriptionForm.groupe', { value: patient.groupeSanguin })}</div>
                    )}
                  </div>
                </div>

                {patient.allergies?.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm mb-2">
                      <AlertTriangle className="w-4 h-4" /> {t('admin.prescriptionForm.allergiesConnues')}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {patient.allergies.map((a: string, i: number) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-medium">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeConsultation?.motif && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">{t('admin.prescriptionForm.motifConsultation')}</div>
                    <div className="text-sm text-primary-900 dark:text-sable">{activeConsultation.motif}</div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Diagnostic */}
            {step === 'diagnostic' && (
              <motion.div key="diag" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h4 className="font-semibold text-primary-900 dark:text-sable mb-4">{t('admin.prescriptionForm.diagnostic')}</h4>
                <div>
                  <label className="block text-sm font-medium text-primary-700 dark:text-sable mb-1.5">{t('admin.prescriptionForm.diagnosticPrincipal')} *</label>
                  <textarea
                    value={diagnostic}
                    onChange={(e) => setDiagnostic(e.target.value)}
                    placeholder={t('admin.prescriptionForm.diagnosticPlaceholder')}
                    rows={4}
                    disabled={saving}
                    className="w-full rounded-xl border border-primary-100 dark:border-white/10 bg-white dark:bg-primary-900 px-4 py-3 text-sm text-primary-900 dark:text-sable placeholder:text-primary-300 resize-none disabled:opacity-50"
                    required
                  />
                </div>
              </motion.div>
            )}

            {/* Step 3: Médicaments */}
            {step === 'medicaments' && (
              <motion.div key="meds" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-primary-900 dark:text-sable">{t('admin.prescriptionForm.medicaments')}</h4>
                  <button onClick={addMedicament} className="flex items-center gap-1 text-xs font-semibold text-primary-500 hover:text-primary-700">
                    <Plus className="w-3.5 h-3.5" /> {t('admin.prescriptionForm.add')}
                  </button>
                </div>

                <div className="space-y-4">
                  {medicaments.map((med, i) => (
                    <div key={i} className="border border-primary-100 dark:border-white/10 rounded-xl p-4 relative">
                      {medicaments.length > 1 && (
                        <button onClick={() => removeMedicament(i)} className="absolute top-2 right-2 p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input value={med.nom} onChange={(e) => updateMedicament(i, 'nom', e.target.value)}
                          placeholder={`${t('admin.prescriptionForm.nomMedicament')} *`} disabled={saving}
                          className="rounded-xl border border-primary-100 dark:border-white/10 bg-white dark:bg-primary-900 px-3 py-2 text-sm text-primary-900 dark:text-sable placeholder:text-primary-300" />
                        <input value={med.posologie} onChange={(e) => updateMedicament(i, 'posologie', e.target.value)}
                          placeholder={t('admin.prescriptionForm.posologiePlaceholder')} disabled={saving}
                          className="rounded-xl border border-primary-100 dark:border-white/10 bg-white dark:bg-primary-900 px-3 py-2 text-sm text-primary-900 dark:text-sable placeholder:text-primary-300" />
                        <input value={med.duree} onChange={(e) => updateMedicament(i, 'duree', e.target.value)}
                          placeholder={t('admin.prescriptionForm.dureePlaceholder')} disabled={saving}
                          className="rounded-xl border border-primary-100 dark:border-white/10 bg-white dark:bg-primary-900 px-3 py-2 text-sm text-primary-900 dark:text-sable placeholder:text-primary-300" />
                        <input value={med.voieAdministration || ''} onChange={(e) => updateMedicament(i, 'voieAdministration', e.target.value)}
                          placeholder={t('admin.prescriptionForm.voie')} disabled={saving}
                          className="rounded-xl border border-primary-100 dark:border-white/10 bg-white dark:bg-primary-900 px-3 py-2 text-sm text-primary-900 dark:text-sable placeholder:text-primary-300" />
                        <input value={med.instructions || ''} onChange={(e) => updateMedicament(i, 'instructions', e.target.value)}
                          placeholder={t('admin.prescriptionForm.instructions')} disabled={saving}
                          className="sm:col-span-2 rounded-xl border border-primary-100 dark:border-white/10 bg-white dark:bg-primary-900 px-3 py-2 text-sm text-primary-900 dark:text-sable placeholder:text-primary-300" />
                      </div>
                      <label className="flex items-center gap-2 mt-2 text-xs text-primary-400">
                        <input type="checkbox" checked={med.siBesoin || false}
                          onChange={(e) => updateMedicament(i, 'siBesoin', e.target.checked)}
                          className="rounded border-gray-300" />
                        {t('admin.prescriptionForm.siBesoin')}
                      </label>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 4: Vérification */}
            {step === 'verification' && (
              <motion.div key="verif" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h4 className="font-semibold text-primary-900 dark:text-sable mb-4">{t('admin.prescriptionForm.resumeTitle')}</h4>

                <div className="space-y-3">
                  <div className="bg-primary-50 dark:bg-primary-900/50 rounded-xl p-3">
                    <div className="text-xs font-semibold text-primary-400 mb-1">{t('admin.prescriptionForm.patient')}</div>
                    <div className="text-sm font-medium text-primary-900 dark:text-sable">{patientName}</div>
                  </div>

                  <div className="bg-primary-50 dark:bg-primary-900/50 rounded-xl p-3">
                    <div className="text-xs font-semibold text-primary-400 mb-1">{t('admin.prescriptionForm.diagnostic')}</div>
                    <div className="text-sm text-primary-900 dark:text-sable">{diagnostic}</div>
                  </div>

                  {patient.allergies?.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                      <div className="text-xs font-semibold text-amber-600 mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {t('admin.prescriptionForm.allergiesConnues')}
                      </div>
                      <div className="text-sm text-amber-700 dark:text-amber-400">{patient.allergies.join(', ')}</div>
                    </div>
                  )}

                  <div className="bg-primary-50 dark:bg-primary-900/50 rounded-xl p-3">
                    <div className="text-xs font-semibold text-primary-400 mb-2">{t('admin.prescriptionForm.medicamentsCount', { count: validMeds.length })}</div>
                    <div className="space-y-2">
                      {validMeds.map((m, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="w-5 h-5 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                          <div>
                            <span className="font-medium text-primary-900 dark:text-sable">{m.nom}</span>
                            <span className="text-primary-300"> — {m.posologie}</span>
                            {m.duree && <span className="text-primary-300"> • {m.duree}</span>}
                            {m.voieAdministration && <span className="text-primary-300"> • {m.voieAdministration}</span>}
                            {m.instructions && <span className="text-primary-300 block text-xs mt-0.5">{m.instructions}</span>}
                            {m.siBesoin && <span className="text-amber-500 text-xs ml-1">{t('admin.prescriptionForm.siBesoinShort')}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {recommandations && (
                    <div className="bg-primary-50 dark:bg-primary-900/50 rounded-xl p-3">
                      <div className="text-xs font-semibold text-primary-400 mb-1">{t('admin.prescriptionForm.recommandations')}</div>
                      <div className="text-sm text-primary-900 dark:text-sable">{recommandations}</div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 5: Signature */}
            {step === 'signature' && (
              <motion.div key="sign" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h4 className="font-semibold text-primary-900 dark:text-sable mb-4">{t('admin.prescriptionForm.enregistrement')}</h4>

                <div className="space-y-3 mb-6">
                  <div className="bg-primary-50 dark:bg-primary-900/50 rounded-xl p-3">
                    <div className="text-xs font-semibold text-primary-400 mb-1">{t('admin.prescriptionForm.recommandationsOptionnel')}</div>
                    <textarea
                      value={recommandations}
                      onChange={(e) => setRecommandations(e.target.value)}
                      placeholder={t('admin.prescriptionForm.recommandationsPlaceholder')}
                      rows={2}
                      disabled={saving}
                      className="w-full rounded-xl border border-primary-100 dark:border-white/10 bg-white dark:bg-primary-900 px-3 py-2 text-sm text-primary-900 dark:text-sable placeholder:text-primary-300 resize-none"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-400">
                  <p className="font-semibold mb-1">{t('admin.prescriptionForm.deuxOptions')}</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li><strong>{t('admin.prescriptionForm.draft')}</strong> — {t('admin.prescriptionForm.optionBrouillon')}</li>
                    <li><strong>{t('admin.prescriptionForm.signSave')}</strong> — {t('admin.prescriptionForm.optionSigner')}</li>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-100 shrink-0">
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button onClick={goPrev} disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-primary-100 dark:border-white/10 text-primary-700 dark:text-sable disabled:opacity-50 flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> {t('admin.prescriptionForm.retour')}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {step === 'signature' ? (
              <>
                <button onClick={() => handleSubmit(true)} disabled={saving}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-primary-100 dark:border-white/10 text-primary-700 dark:text-sable disabled:opacity-50 flex items-center gap-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? t('admin.prescriptionForm.draftSaving') : t('admin.prescriptionForm.draft')}
                </button>
                <button onClick={() => handleSubmit(false)} disabled={saving}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-700 text-white disabled:opacity-75 flex items-center gap-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
                  {saving ? t('admin.prescriptionForm.signSaving') : t('admin.prescriptionForm.signSave')}
                </button>
              </>
            ) : (
              <button onClick={goNext} disabled={!canNext || saving}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-700 text-white disabled:opacity-75 flex items-center gap-1">
                {t('admin.prescriptionForm.suivant')} <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )

  if (typeof window === 'undefined') return null
  return createPortal(content, document.body)
}
