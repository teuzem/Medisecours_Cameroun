'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Download, FileText, Send, Ban, RefreshCw, AlertTriangle } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../ui/Toast'
import PrescriptionPDFTemplate from './PrescriptionPDFTemplate'
import { downloadPrescriptionPDF } from '../../lib/prescriptionPdf'
import api from '../../api/axios'
import type { Prescription, StatutPrescription } from '../../types/api'

const STATUT_LABEL: Record<StatutPrescription, string> = {
  BROUILLON: 'prescriptions.statut_draft',
  SIGNEE: 'prescriptions.statut_signed',
  TRANSMISE: 'prescriptions.statut_transmitted',
  ANNULEE: 'prescriptions.statut_cancelled',
  EXPIREE: 'prescriptions.statut_expired',
  REMPLACEE: 'prescriptions.statut_replaced',
}

export default function PrescriptionDetailModal({ prescription, onClose, onAction }: {
  prescription: Prescription
  onClose: () => void
  onAction?: () => void
}) {
  const toast = useToast()
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const [downloading, setDownloading] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const patient = (prescription.patient as any) || {}
  const patientName = `${patient.prenom || ''} ${patient.nom || ''}`.trim() || t('admin.prescriptionDetail.fallback')
  const consultation = (prescription.consultation as any) || {}

  const handleDownload = async () => {
    try {
      setDownloading(true)
      const element = document.getElementById('prescription-pdf-content')
      if (!element) return
      const safeName = patientName.replace(/\s+/g, '_')
      await downloadPrescriptionPDF(element, t('admin.prescriptionDetail.pdfName', { name: safeName }))
    } catch {
      toast.error(t('admin.prescriptionDetail.toastPdfError'))
    } finally {
      setDownloading(false)
    }
  }

  const callAction = async (url: string, payload?: any) => {
    try {
      setLoading(url)
      await api.post(url, payload || {})
      toast.success(t('admin.prescriptionDetail.toastActionDone'))
      onAction?.()
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('admin.prescriptionDetail.toastActionFailed'))
    } finally {
      setLoading(null)
    }
  }

  return createPortal(
    <AnimatePresence>
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
          className="bg-white dark:bg-primary-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
            <div>
              <h3 className="font-semibold text-primary-900 dark:text-sable flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-400" />
                {prescription.reference || t('admin.prescriptionDetail.fallback')}
                <span className="text-xs font-normal text-primary-300">v{prescription.version}</span>
              </h3>
              <p className="text-xs text-primary-300">
                {t('admin.prescriptionDetail.patientColon', { name: patientName })}
                {prescription.signedAt && (
                  <> — {t('admin.prescriptionDetail.signedOn')} {new Date(prescription.signedAt).toLocaleDateString(i18n.language?.startsWith('en') ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                disabled={downloading || prescription.statut === 'BROUILLON'}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {downloading ? t('admin.prescriptionDetail.downloading') : t('admin.prescriptionDetail.pdf')}
              </button>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-red-50 hover:text-red-500 text-primary-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-auto p-6 bg-[#F3F4F6] flex justify-center items-start max-h-[calc(90vh-8rem)]">
            <div style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid rgba(0,0,0,0.05)' }} className="shrink-0" id="prescription-pdf-content">
              <PrescriptionPDFTemplate
                diagnostic={prescription.diagnostic || ''}
                medicaments={(prescription.medicaments || []).map((m: any) => ({
                  nom: m.nom,
                  posologie: m.posologie,
                  duree: m.duree || '',
                }))}
                recommandations={
                  prescription.statut === 'ANNULEE'
                    ? t('admin.prescriptionDetail.cancelled', { reason: prescription.cancelReason || t('admin.prescriptionDetail.cancelledByDoctor') })
                    : prescription.recommandations || ''
                }
                consultation={{ ...consultation, patient }}
                medecin={prescription.medecin || user}
              />
            </div>
          </div>

          {/* Cancel reason banner */}
          {prescription.statut === 'ANNULEE' && prescription.cancelReason && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 shrink-0">
              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-semibold">{t('admin.prescriptionDetail.cancelBanner')}</span>
                {prescription.cancelReason}
              </div>
            </div>
          )}

          {prescription.statut === 'REMPLACEE' && prescription.supersededBy && (
            <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border-t border-purple-200 dark:border-purple-800 shrink-0">
              <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-400">
                <RefreshCw className="w-4 h-4" />
                <span>{t('admin.prescriptionDetail.replacedBanner')}</span>
              </div>
            </div>
          )}

          {/* Status actions */}
          {user?.discriminatorType === 'medecin' && (prescription.statut === 'SIGNEE' || prescription.statut === 'TRANSMISE') && (
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 shrink-0">
              {prescription.statut === 'SIGNEE' && (
                <button
                  onClick={() => callAction(`/api/prescriptions/${prescription.id}/send`)}
                  disabled={!!loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold"
                >
                  {loading?.includes('/send') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {t('admin.prescriptionDetail.transmitToPatient')}
                </button>
              )}
              <button
                onClick={() => callAction(`/api/prescriptions/${prescription.id}/cancel`, { cancelReason: t('admin.prescriptionDetail.cancelledByDoctor') })}
                disabled={!!loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold"
              >
                {loading?.includes('/cancel') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                {t('admin.prescriptionDetail.cancelAction')}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
