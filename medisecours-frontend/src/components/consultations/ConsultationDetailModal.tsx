// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, Clock, AlertTriangle, User, Phone, FileText, Activity, CheckCircle, Stethoscope, Eye } from 'lucide-react'
import PrescriptionPreview from './PrescriptionPreview'
import { createPortal } from 'react-dom'
import api from '../../api/axios'
import { API_BASE } from '../../lib/config'

const STATUT_LABEL = {
  OUVERTE: 'En attente',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  ANNULEE: 'Annulée',
}

const STATUT_COLOR = {
  OUVERTE: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-500/30',
  EN_COURS: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-500/30',
  TERMINEE: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-500/30',
  ANNULEE: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 ring-1 ring-gray-200 dark:ring-gray-700',
}

const PRIORITE_CONFIG = {
  NORMALE: null,
  URGENTE: { label: 'Urgent', class: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 ring-1 ring-amber-200 dark:ring-amber-500/30' },
  CRITIQUE: { label: 'Critique', class: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 ring-1 ring-red-200 dark:ring-red-500/30' },
}

function imgUrl(path) {
  if (!path) return null
  return path.startsWith('http') ? path : `${API_BASE}${path}`
}

export default function ConsultationDetailModal({ consultationId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [previewPrescription, setPreviewPrescription] = useState(null)

  useEffect(() => {
    if (!consultationId) return
    setLoading(true)
    api.get(`/api/consultations/${consultationId}`)
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [consultationId])

  const c = data

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-primary-900 shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-primary-900">
            <h2 className="font-display text-lg font-bold text-[#0F2C52] dark:text-sable">Détails de la consultation</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-primary-800 text-gray-400 dark:text-primary-300 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#3B6EF8] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !c ? (
            <div className="text-center py-16 text-gray-500 dark:text-primary-300 text-sm">Impossible de charger les détails.</div>
          ) : (
            <div className="p-5 space-y-6">
              {/* Statut + Priorité */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUT_COLOR[c.statut] || STATUT_COLOR.OUVERTE}`}>
                  {STATUT_LABEL[c.statut] || c.statut}
                </span>
                {PRIORITE_CONFIG[c.priorite] && (
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${PRIORITE_CONFIG[c.priorite].class}`}>
                    {PRIORITE_CONFIG[c.priorite].label}
                  </span>
                )}
              </div>

              {/* Motif */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-primary-400 mb-1.5">Motif</h3>
                <p className="text-sm text-[#374151] dark:text-sable/90 leading-relaxed">{c.motif || 'Motif non précisé'}</p>
              </div>

              {/* Patient */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-primary-400 mb-2">Patient</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#3B6EF8] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {c.patient?.prenom?.[0]}{c.patient?.nom?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0F2C52] dark:text-sable">{c.patient?.prenom} {c.patient?.nom}</p>
                    {c.patient?.telephone && (
                      <p className="text-xs text-gray-500 dark:text-primary-300 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {c.patient.telephone}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Médecin */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-primary-400 mb-2">Médecin</h3>
                {c.medecin ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {c.medecin?.prenom?.[0]}{c.medecin?.nom?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0F2C52] dark:text-sable">Dr {c.medecin.prenom} {c.medecin.nom}</p>
                      {c.medecin?.telephone && (
                        <p className="text-xs text-gray-500 dark:text-primary-300 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {c.medecin.telephone}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-primary-400 italic">Aucun médecin assigné</p>
                )}
              </div>

              {/* Chronologie */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-primary-400 mb-3">Chronologie</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0 mt-0.5">
                      <Calendar className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-primary-300">Créée le</p>
                      <p className="text-sm text-[#374151] dark:text-sable/90">
                        {new Date(c.createdAt).toLocaleDateString('fr-FR', {
                          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  {c.dateConsultation && (
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 mt-0.5">
                        <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-primary-300">Rendez-vous prévu le</p>
                        <p className="text-sm text-[#374151] dark:text-sable/90">
                          {new Date(c.dateConsultation).toLocaleDateString('fr-FR', {
                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                  {c.closedAt && (
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-primary-300">Clôturée le</p>
                        <p className="text-sm text-[#374151] dark:text-sable/90">
                          {new Date(c.closedAt).toLocaleDateString('fr-FR', {
                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Prescriptions */}
              {c.prescriptions?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-primary-400 mb-3">Prescriptions</h3>
                  <div className="space-y-2">
                    {c.prescriptions.map((p) => (
                      <div key={p.id} className="p-3 rounded-xl bg-gray-50 dark:bg-primary-800 border border-gray-100 dark:border-white/10">
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-[#3B6EF8] dark:text-blue-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#0F2C52] dark:text-sable">{p.diagnostic || 'Prescription'}</p>
                            {p.medicaments?.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {p.medicaments.map((m, i) => (
                                  <li key={i} className="text-xs text-gray-600 dark:text-primary-300">
                                    {m.nom}{m.posologie ? ` — ${m.posologie}` : ''}{m.duree ? ` (${m.duree})` : ''}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {p.recommandations && (
                              <p className="text-xs text-gray-500 dark:text-primary-400 mt-1 italic">{p.recommandations}</p>
                            )}
                          </div>
                          <button
                            onClick={() => setPreviewPrescription(p)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#3B6EF8] text-white hover:bg-[#2D5CD8] transition shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Voir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )

  return createPortal(
    <>
      {content}
      {previewPrescription && c && (
        <PrescriptionPreview
          prescription={previewPrescription}
          consultation={c}
          medecin={c.medecin}
          onClose={() => setPreviewPrescription(null)}
        />
      )}
    </>,
    document.body
  )
}
