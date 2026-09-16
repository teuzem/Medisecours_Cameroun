// @ts-nocheck
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2, XCircle, Eye, Mail, Phone, Shield,
  Stethoscope, Users, Clock, AlertCircle, X, Upload,
  Download, FileCheck2, FileWarning, ImageIcon, LoaderCircle,
  ChevronRight, UserCheck,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import api from '../../../api/axios'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import EmptyState from '../../../components/ui/EmptyState'
import Avatar from '../../../components/ui/Avatar'
import { useToast } from '../../../components/ui/Toast'

export default function MedecinsPage() {
  const { t } = useTranslation()
  const TABS = [
    { key: 'tous',       label: t('admin.medecins.tabTous'),       icon: Users },
    { key: 'valides',    label: t('admin.medecins.tabValides'),    icon: CheckCircle2 },
    { key: 'en_attente', label: t('admin.medecins.tabEnAttente'),  icon: Clock },
  ]
  const [medecins,     setMedecins]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState('tous')
  const [viewModal,    setViewModal]    = useState(null)
  const [rejectModal,  setRejectModal]  = useState(null)   // { medecin }
  const [motif,        setMotif]        = useState('')
  const [actionId,     setActionId]     = useState(null)   // id en cours de traitement
  const [reviewChecks, setReviewChecks] = useState({
    documentsLisibles: false,
    identiteCorrespondante: false,
    ordreVerifie: false,
  })
  const toast = useToast()

  // ── Chargement ──────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    api.get('/api/admin/medecins')
      .then((res) => {
        const data = res.data?.medecins ?? []
        setMedecins(Array.isArray(data) ? data : [])
      })
      .catch(() => toast.error(t('admin.medecins.toastLoadError')))
      .finally(() => setLoading(false))
  }, [toast, t])

  useEffect(() => { load() }, [load])

  // ── Dérivés ─────────────────────────────────────────────────────────────────
  const valides    = useMemo(() => medecins.filter((m) =>  m.estValide), [medecins])
  const enAttente  = useMemo(() => medecins.filter((m) => !m.estValide), [medecins])

  const displayed = useMemo(() => {
    if (tab === 'valides')    return valides
    if (tab === 'en_attente') return enAttente
    return medecins
  }, [tab, medecins, valides, enAttente])

  const openReviewModal = (med) => {
    setReviewChecks({
      documentsLisibles: false,
      identiteCorrespondante: false,
      ordreVerifie: false,
    })
    setViewModal(med)
  }

  const reviewCompleted = Object.values(reviewChecks).every(Boolean)

  // ── Validation ──────────────────────────────────────────────────────────────
  const handleValidate = async (med) => {
    if (!med.verificationIdentite?.complet || !reviewCompleted) {
      toast.error(t('admin.medecins.toastChecklist'))
      return
    }
    setActionId(med.id)
    try {
      await api.patch(
        `/api/admin/medecins/${med.id}/validation`,
        { estValide: true },
        { headers: { 'Content-Type': 'application/json' } }
      )
      setMedecins((prev) => prev.map((m) => m.id === med.id ? { ...m, estValide: true } : m))
      setViewModal((prev) => prev?.id === med.id ? { ...prev, estValide: true } : prev)
      toast.success(t('admin.medecins.toastValidateSuccess', { nom: `${med.prenom} ${med.nom}` }))
    } catch (error) {
      toast.error(error.response?.data?.error || t('admin.medecins.toastValidateError'))
    } finally {
      setActionId(null)
    }
  }

  // ── Ouverture modal de refus ────────────────────────────────────────────────
  const openRejectModal = (med) => {
    setMotif('')
    setRejectModal(med)
  }

  // ── Envoi refus avec motif ──────────────────────────────────────────────────
  const handleReject = async () => {
    if (!rejectModal) return
    if (!motif.trim()) {
      toast.error(t('admin.medecins.toastMotif'))
      return
    }
    const med = rejectModal
    setActionId(med.id)
    try {
      await api.patch(
        `/api/admin/medecins/${med.id}/validation`,
        { estValide: false, motif: motif.trim() },
        { headers: { 'Content-Type': 'application/json' } }
      )
      setMedecins((prev) => prev.map((m) => m.id === med.id ? { ...m, estValide: false } : m))
      setViewModal((prev) => prev?.id === med.id ? { ...prev, estValide: false } : prev)
      toast.success(t('admin.medecins.toastRejectSuccess', { nom: `${med.prenom} ${med.nom}` }))
      setRejectModal(null)
      setMotif('')
    } catch {
      toast.error(t('admin.medecins.toastRejectError'))
    } finally {
      setActionId(null)
    }
  }

  if (loading) return <LoadingSpinner label={t('admin.medecins.loading')} />

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label={t('admin.medecins.statTotal')} value={medecins.length}   color="#1E3A5F" icon={Users} />
        <StatCard label={t('admin.medecins.statValides')} value={valides.length}  color="#10B981" icon={CheckCircle2} />
        <StatCard label={t('admin.medecins.statEnAttente')} value={enAttente.length} color="#F59E0B" icon={Clock} badge={enAttente.length > 0} />
      </div>

      {/* Bouton import */}
      <div className="flex justify-end">
        <Link
          href="/admin/medecins/import"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition"
        >
          <Upload className="w-4 h-4" /> {t('admin.medecins.importCsv')}
        </Link>
      </div>

      {/* Onglets */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              tab === key
                ? 'bg-primary-500 text-white shadow-lg'
                : 'bg-white dark:bg-primary-800 text-primary-700 dark:text-sable border border-primary-100 dark:border-white/10 hover:border-mint-500'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              tab === key ? 'bg-white/20 text-white' : 'bg-primary-100 dark:bg-primary-700 text-primary-500'
            }`}>
              {key === 'tous' ? medecins.length : key === 'valides' ? valides.length : enAttente.length}
            </span>
          </button>
        ))}
      </div>

      {/* Liste */}
      {displayed.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title={t('admin.medecins.emptyTitle')}
          description={t('admin.medecins.emptyDesc')}
        />
      ) : (
        <div className="rounded-2xl bg-white dark:bg-primary-800 border border-primary-100 dark:border-white/5 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-sable">
                <tr>
                  <th className="text-left px-6 py-4 font-semibold">{t('admin.medecins.thMedecin')}</th>
                  <th className="text-left px-6 py-4 font-semibold">{t('admin.medecins.thSpecialite')}</th>
                  <th className="text-left px-6 py-4 font-semibold">{t('admin.medecins.thNumeroOrdre')}</th>
                  <th className="text-left px-6 py-4 font-semibold">{t('admin.medecins.thContact')}</th>
                  <th className="text-left px-6 py-4 font-semibold">{t('admin.medecins.thStatut')}</th>
                  <th className="px-6 py-4 text-right font-semibold">{t('admin.medecins.thActions')}</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {displayed.map((med, i) => (
                    <motion.tr
                      key={med.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-t border-primary-100 dark:border-white/5 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={`${med.prenom || ''} ${med.nom || ''}`} size="sm" />
                          <div>
                            <p className="font-semibold text-primary-900 dark:text-sable">
                              Dr {med.prenom} {med.nom}
                            </p>
                            <p className="text-xs text-primary-300">{med.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-primary-700 dark:text-primary-300">
                        {med.specialite || '—'}
                      </td>
                      <td className="px-6 py-4 text-primary-700 dark:text-primary-300 font-mono text-xs">
                        {med.numeroOrdre || '—'}
                      </td>
                      <td className="px-6 py-4 text-primary-700 dark:text-primary-300">
                        {med.telephone || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1.5">
                          {med.estValide ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-mint-100 text-mint-700">
                              <CheckCircle2 className="w-3 h-3" /> {t('admin.medecins.valide')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                              <Clock className="w-3 h-3" /> {t('admin.medecins.enAttente')}
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                            med.verificationIdentite?.complet ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {med.verificationIdentite?.complet
                              ? <FileCheck2 className="h-3 w-3" />
                              : <FileWarning className="h-3 w-3" />}
                            {med.verificationIdentite?.complet ? t('admin.medecins.dossierComplet') : t('admin.medecins.dossierIncomplet')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Voir détails */}
                          <button
                            onClick={() => openReviewModal(med)}
                            className="p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-700 text-primary-500 transition"
                            title={t('admin.medecins.voirProfil')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {/* Valider */}
                          {!med.estValide && (
                            <button
                              onClick={() => openReviewModal(med)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-500 hover:bg-primary-700 text-white text-xs font-semibold transition"
                              title={t('admin.medecins.ouvrirDossier')}
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              {t('admin.medecins.verifier')}
                            </button>
                          )}
                          {/* Invalider */}
                          {med.estValide ? (
                            <button
                              onClick={() => openRejectModal(med)}
                              disabled={actionId === med.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-urgence-500/10 hover:bg-urgence-500/20 text-urgence-500 text-xs font-semibold disabled:opacity-60 transition"
                              title={t('admin.medecins.rejectTitle', { action: t('admin.medecins.invalider') })}
                            >
                              <XCircle className="w-3.5 h-3.5" /> {t('admin.medecins.invalider')}
                            </button>
                          ) : (
                            <button
                              onClick={() => openRejectModal(med)}
                              disabled={actionId === med.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-urgence-200 text-urgence-500 text-xs font-semibold hover:bg-urgence-50 disabled:opacity-60 transition"
                              title={t('admin.medecins.rejectTitle', { action: t('admin.medecins.refuser') })}
                            >
                              <XCircle className="w-3.5 h-3.5" /> {t('admin.medecins.refuser')}
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Espace de vérification médecin */}
      <AnimatePresence>
        {viewModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewModal(null)}
              className="fixed inset-0 z-50 bg-primary-950/75 backdrop-blur-sm"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-0 pointer-events-none sm:p-4">
              <motion.section
                role="dialog"
                aria-modal="true"
                aria-label={t('admin.medecins.reviewTitle')}
                initial={{ opacity: 0, scale: 0.97, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 16 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-auto flex h-full w-full max-w-7xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-primary-900 sm:h-[92vh] sm:rounded-2xl sm:border sm:border-white/10"
              >
                <header className="flex shrink-0 items-center justify-between gap-4 border-b border-primary-100 px-4 py-3 dark:border-white/10 sm:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={`${viewModal.prenom || ''} ${viewModal.nom || ''}`} size="sm" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-display text-lg font-bold text-primary-900 dark:text-sable">
                          Dr {viewModal.prenom} {viewModal.nom}
                        </h3>
                        {viewModal.estValide ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-mint-100 px-2.5 py-1 text-[10px] font-bold text-mint-700">
                            <CheckCircle2 className="h-3 w-3" /> {t('admin.medecins.valide')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                            <Clock className="h-3 w-3" /> {t('admin.medecins.aVerifier')}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-primary-300">
                        {viewModal.specialite || t('admin.medecins.specialiteNonRenseignee')} · {viewModal.email}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewModal(null)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-primary-300 transition hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-800 dark:hover:text-white"
                    aria-label={t('admin.medecins.closeReview')}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="grid min-h-full lg:grid-cols-[320px_minmax(0,1fr)]">
                    <aside className="border-b border-primary-100 bg-primary-50/70 p-4 dark:border-white/10 dark:bg-primary-950/30 sm:p-6 lg:border-b-0 lg:border-r">
                      <p className="mb-3 text-[11px] font-bold uppercase text-primary-300">
                        {t('admin.medecins.infoDeclarees')}
                      </p>
                      <dl className="divide-y divide-primary-100 border-y border-primary-100 dark:divide-white/10 dark:border-white/10">
                        {[
                          { icon: Stethoscope, label: t('admin.medecins.specialite'), value: viewModal.specialite },
                          { icon: Shield, label: t('admin.medecins.numeroOrdre'), value: viewModal.numeroOrdre },
                          { icon: Mail, label: t('admin.medecins.email'), value: viewModal.email },
                          { icon: Phone, label: t('admin.medecins.telephone'), value: viewModal.telephone },
                        ].map(({ icon: Icon, label, value }) => (
                          <div key={label} className="flex gap-3 py-3">
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" />
                            <div className="min-w-0">
                              <dt className="text-[10px] font-bold uppercase text-primary-300">{label}</dt>
                              <dd className="mt-0.5 break-words text-sm font-semibold text-primary-900 dark:text-sable">
                                {value || t('admin.medecins.nonRenseigne')}
                              </dd>
                            </div>
                          </div>
                        ))}
                      </dl>

                      {!viewModal.estValide && viewModal.verificationIdentite?.complet && (
                        <div className="mt-6">
                          <div className="mb-3 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-primary-900 dark:text-sable">{t('admin.medecins.checklistTitle')}</p>
                              <p className="text-[11px] text-primary-300">{t('admin.medecins.checklistSubtitle')}</p>
                            </div>
                            <span className="text-xs font-bold text-primary-500">
                              {Object.values(reviewChecks).filter(Boolean).length}/3
                            </span>
                          </div>
                          <div className="space-y-2">
                            <ReviewCheck
                              checked={reviewChecks.documentsLisibles}
                              onChange={(checked) => setReviewChecks((current) => ({ ...current, documentsLisibles: checked }))}
                              title={t('admin.medecins.reviewDocsTitle')}
                              description={t('admin.medecins.reviewDocsDesc')}
                            />
                            <ReviewCheck
                              checked={reviewChecks.identiteCorrespondante}
                              onChange={(checked) => setReviewChecks((current) => ({ ...current, identiteCorrespondante: checked }))}
                              title={t('admin.medecins.reviewIdentiteTitle')}
                              description={t('admin.medecins.reviewIdentiteDesc')}
                            />
                            <ReviewCheck
                              checked={reviewChecks.ordreVerifie}
                              onChange={(checked) => setReviewChecks((current) => ({ ...current, ordreVerifie: checked }))}
                              title={t('admin.medecins.reviewOrdreTitle')}
                              description={t('admin.medecins.reviewOrdreDesc')}
                            />
                          </div>
                        </div>
                      )}
                    </aside>

                    <main className="p-4 sm:p-6">
                      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="font-display text-lg font-bold text-primary-900 dark:text-sable">
                            {t('admin.medecins.comparaisonTitle')}
                          </h4>
                          <p className="mt-1 max-w-2xl text-xs leading-5 text-primary-300">
                            {t('admin.medecins.comparaisonDesc')}
                          </p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                          viewModal.verificationIdentite?.complet
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {viewModal.verificationIdentite?.complet
                            ? <FileCheck2 className="h-3.5 w-3.5" />
                            : <FileWarning className="h-3.5 w-3.5" />}
                          {viewModal.verificationIdentite?.complet ? t('admin.medecins.dossierComplet') : t('admin.medecins.dossierIncomplet')}
                        </span>
                      </div>

                      {viewModal.verificationIdentite?.complet ? (
                        <div className="grid items-start gap-4 xl:grid-cols-2">
                          <ProtectedIdentityMedia
                            label={viewModal.verificationIdentite.typePiece === 'CNI' ? t('admin.medecins.rectoCNI') : t('admin.medecins.passeport')}
                            media={viewModal.verificationIdentite.recto}
                          />
                          {viewModal.verificationIdentite.typePiece === 'CNI' && (
                            <ProtectedIdentityMedia
                              label={t('admin.medecins.versoCNI')}
                              media={viewModal.verificationIdentite.verso}
                            />
                          )}
                          <ProtectedIdentityMedia
                            label={t('admin.medecins.photoRecente')}
                            media={viewModal.verificationIdentite.photo}
                            portrait
                          />
                        </div>
                      ) : (
                        <div className="flex min-h-64 flex-col items-center justify-center border border-dashed border-rose-300 bg-rose-50 p-8 text-center dark:border-rose-900 dark:bg-rose-950/20">
                          <FileWarning className="mb-3 h-8 w-8 text-rose-500" />
                          <p className="font-bold text-rose-800 dark:text-rose-200">{t('admin.medecins.justificatifsManquants')}</p>
                          <p className="mt-1 max-w-md text-sm text-rose-700 dark:text-rose-300">
                            {t('admin.medecins.justificatifsManquantsDesc')}
                          </p>
                        </div>
                      )}
                    </main>
                  </div>
                </div>

                <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-primary-100 bg-white px-4 py-3 dark:border-white/10 dark:bg-primary-900 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <p className="text-[11px] text-primary-300">
                    {t('admin.medecins.footerValidationNote')}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { openRejectModal(viewModal); setViewModal(null) }}
                      className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-urgence-200 px-4 text-sm font-bold text-urgence-500 transition hover:bg-urgence-50 sm:flex-none"
                    >
                      <XCircle className="h-4 w-4" />
                      {viewModal.estValide ? t('admin.medecins.invalider') : t('admin.medecins.refuser')}
                    </button>
                    {!viewModal.estValide && (
                      <button
                        type="button"
                        onClick={() => handleValidate(viewModal)}
                        disabled={!viewModal.verificationIdentite?.complet || !reviewCompleted || actionId === viewModal.id}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-mint-500 px-5 text-sm font-bold text-white transition hover:bg-mint-700 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
                      >
                        {actionId === viewModal.id
                          ? <LoaderCircle className="h-4 w-4 animate-spin" />
                          : <CheckCircle2 className="h-4 w-4" />}
                        {actionId === viewModal.id ? t('admin.medecins.validationProgress') : t('admin.medecins.validateBtn')}
                        {actionId !== viewModal.id && <ChevronRight className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </footer>
              </motion.section>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Modal — Motif de refus/invalidation */}
      <AnimatePresence>
        {rejectModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setRejectModal(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="fixed inset-0 z-50 flex items-center justify-center p-6"
            >
              <div className="w-full max-w-md bg-white dark:bg-primary-800 rounded-2xl shadow-glass p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-urgence-100 flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-urgence-500" />
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-primary-900 dark:text-sable">
                        {t('admin.medecins.rejectTitle', { action: rejectModal.estValide ? t('admin.medecins.invalider') : t('admin.medecins.refuser') })}
                      </h4>
                      <p className="text-xs text-primary-300">
                        Dr {rejectModal.prenom} {rejectModal.nom}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setRejectModal(null)} className="text-primary-300 hover:text-primary-700">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-5">
                  <label className="text-sm font-semibold text-primary-700 dark:text-sable block mb-2">
                    {t('admin.medecins.motifLabel')} <span className="text-urgence-500">*</span>
                  </label>
                  <textarea
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    placeholder={t('admin.medecins.motifPlaceholder')}
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-primary-100 dark:border-white/10 bg-white/80 dark:bg-primary-900/40 focus:outline-none focus:ring-2 focus:ring-urgence-500 text-sm resize-none"
                  />
                  <p className="text-xs text-primary-300 mt-1">
                    {t('admin.medecins.motifHint')}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setRejectModal(null); setMotif('') }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-primary-100 dark:border-white/10 text-primary-700 dark:text-sable font-semibold hover:bg-primary-50 transition text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!motif.trim() || actionId === rejectModal.id}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-urgence-500 hover:bg-urgence-700 text-white font-semibold disabled:opacity-60 transition text-sm"
                  >
                    <Mail className="w-4 h-4" />
                    {actionId === rejectModal.id ? t('admin.medecins.sendingRefus') : t('admin.medecins.sendRefus')}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sous-composants ──────────────────────────────────────────────────────────

function ReviewCheck({ checked, onChange, title, description }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 border p-3 transition ${
      checked
        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20'
        : 'border-primary-100 bg-white hover:border-primary-300 dark:border-white/10 dark:bg-primary-900 dark:hover:border-white/20'
    }`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
      />
      <span>
        <span className="block text-xs font-bold text-primary-900 dark:text-sable">{title}</span>
        <span className="mt-0.5 block text-[10px] leading-4 text-primary-300">{description}</span>
      </span>
    </label>
  )
}

function ProtectedIdentityMedia({ label, media, portrait = false }) {
  const { t } = useTranslation()
  const [objectUrl, setObjectUrl] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let localUrl = null

    api.get(media.url, { responseType: 'blob' })
      .then(({ data }) => {
        if (!active) return
        localUrl = URL.createObjectURL(data)
        setObjectUrl(localUrl)
      })
      .catch(() => {
        if (active) setFailed(true)
      })

    return () => {
      active = false
      if (localUrl) URL.revokeObjectURL(localUrl)
    }
  }, [media.url])

  const isImage = media.mimeType?.startsWith('image/')

  return (
    <figure className="overflow-hidden rounded-lg border border-primary-100 bg-primary-50 dark:border-white/10 dark:bg-primary-900/40">
      <div className="flex items-center justify-between gap-3 border-b border-primary-100 px-3 py-2 dark:border-white/10">
        <div className="min-w-0">
          <p className="text-xs font-bold text-primary-900 dark:text-sable">{label}</p>
          <p className="truncate text-[10px] text-primary-300">{media.nom}</p>
        </div>
        {objectUrl && (
          <a
            href={objectUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary-500 hover:bg-primary-100 dark:hover:bg-primary-700"
            title={t('admin.medecins.openJustificatif')}
          >
            <Download className="h-4 w-4" />
          </a>
        )}
      </div>
      <div className={`flex items-center justify-center p-3 ${portrait ? 'min-h-72' : 'min-h-60'}`}>
        {!objectUrl && !failed && <LoaderCircle className="h-6 w-6 animate-spin text-primary-300" />}
        {failed && <p className="text-xs font-semibold text-rose-600">{t('admin.medecins.loadError')}</p>}
        {objectUrl && isImage && (
          <div className={`relative w-full ${portrait ? 'h-80' : 'h-64'}`}>
            <Image
              src={objectUrl}
              alt={label}
              fill
              unoptimized
              className="rounded-lg object-contain"
            />
          </div>
        )}
        {objectUrl && !isImage && (
          <a
            href={objectUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <ImageIcon className="h-4 w-4" />
            {t('admin.medecins.openPdf')}
          </a>
        )}
      </div>
    </figure>
  )
}

function StatCard({ label, value, color, icon: Icon, badge }) {
  return (
    <div className="relative rounded-2xl bg-white dark:bg-primary-800 border border-primary-100 dark:border-white/5 p-5 shadow-sm">
      {badge && value > 0 && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }} />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: color }} />
        </span>
      )}
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${color}1A` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <p className="text-xs text-primary-300 mb-1">{label}</p>
      <p className="font-display font-bold text-3xl text-primary-900 dark:text-sable">{value}</p>
    </div>
  )
}
