'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  RefreshCw,
  UserRound,
  XCircle,
} from 'lucide-react'
import api from '../../api/axios'

interface DocumentItem {
  id: number
  typeDocument: string
  titre: string
  statut: string
  motif: string | null
  createdAt: string
  validatedAt: string | null
  fichierData?: string | null
}

interface PersonnelItem {
  id: number
  nom: string
  prenom: string
  email: string
  telephone: string | null
  typePersonnel: string
  fonction: string | null
  numeroOrdre: string | null
  statutValidation: string
  validationMotif: string | null
  validatedAt: string | null
  createdAt: string
  documents: DocumentItem[]
}

const STATUT_COULEUR: Record<string, string> = {
  EN_ATTENTE: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  VALIDE: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  REJETE: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
}

const TYPE_LABEL: Record<string, string> = {
  RECEPTIONNISTE: 'personnel.layout.poste.RECEPTIONNISTE',
  INFIRMIER: 'personnel.layout.poste.INFIRMIER',
  AIDE_SOIGNANT: 'personnel.layout.poste.AIDE_SOIGNANT',
  PHARMACIEN: 'personnel.layout.poste.PHARMACIEN',
}

function initiales(prenom: string, nom: string): string {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || '?'
}

export default function PersonnelValidationPanel({ centreId }: { centreId: number }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'

  const [personnel, setPersonnel] = useState<PersonnelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filtre, setFiltre] = useState<'TOUS' | 'EN_ATTENTE' | 'VALIDE' | 'REJETE'>('TOUS')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [docsCache, setDocsCache] = useState<Record<number, DocumentItem[]>>({})
  const [docsLoading, setDocsLoading] = useState<number | null>(null)
  const [decisionId, setDecisionId] = useState<number | null>(null)
  const [motifRejet, setMotifRejet] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null)

  const load = useCallback(() => {
    api
      .get('/api/etablissement/personnel', { params: { centre: centreId } })
      .then((res) => {
        setError(false)
        setPersonnel(res.data?.personnel ?? [])
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [centreId])

  useEffect(() => {
    load()
  }, [load])

  const showToast = (kind: 'ok' | 'err', message: string) => {
    setToast({ kind, message })
    setTimeout(() => setToast(null), 4000)
  }

  const toggleDocs = async (p: PersonnelItem) => {
    if (expandedId === p.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(p.id)
    if (!docsCache[p.id]) {
      setDocsLoading(p.id)
      try {
        const res = await api.get(`/api/etablissement/personnel/${p.id}/documents`)
        setDocsCache((prev) => ({ ...prev, [p.id]: res.data?.documents ?? [] }))
      } catch {
        setDocsCache((prev) => ({ ...prev, [p.id]: p.documents }))
      } finally {
        setDocsLoading(null)
      }
    }
  }

  const decider = async (p: PersonnelItem, decision: 'VALIDE' | 'REJETE') => {
    if (decision === 'REJETE' && !motifRejet.trim()) {
      showToast('err', t('etablissement.personnelValidation.motifRejetRequis'))
      return
    }
    setBusyId(p.id)
    try {
      await api.post(`/api/etablissement/personnel/${p.id}/decision`, {
        decision,
        motif: decision === 'REJETE' ? motifRejet.trim() : undefined,
      })
      showToast('ok', t(decision === 'VALIDE' ? 'etablissement.personnelValidation.valideOk' : 'etablissement.personnelValidation.rejeteOk'))
      setDecisionId(null)
      setMotifRejet('')
      setExpandedId(null)
      setDocsCache((prev) => {
        const next = { ...prev }
        delete next[p.id]
        return next
      })
      load()
    } catch (err: any) {
      showToast('err', err?.response?.data?.error ?? t('etablissement.personnelValidation.erreur'))
    } finally {
      setBusyId(null)
    }
  }

  const affiches = personnel.filter((p) => filtre === 'TOUS' || p.statutValidation === filtre)
  const compteEnAttente = personnel.filter((p) => p.statutValidation === 'EN_ATTENTE').length

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-primary-900 dark:text-sable">
          {t('etablissement.personnelValidation.titre')}
        </h2>
        <p className="mt-1 text-sm text-primary-300">
          {t('etablissement.personnelValidation.intro')}
        </p>
      </div>

      {toast && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${
            toast.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['TOUS', 'EN_ATTENTE', 'VALIDE', 'REJETE'] as const).map((f) => {
          const count = f === 'TOUS' ? personnel.length : personnel.filter((p) => p.statutValidation === f).length
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFiltre(f)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                filtre === f
                  ? 'border-primary-900 bg-primary-900 text-white dark:border-mint-500 dark:bg-mint-600'
                  : 'border-primary-100 bg-white text-primary-700 hover:border-primary-200 dark:border-white/10 dark:bg-primary-800 dark:text-sable/80'
              }`}
            >
              {f === 'TOUS' ? '—' : t(`etablissement.personnelValidation.${f === 'EN_ATTENTE' ? 'enAttente' : f === 'VALIDE' ? 'valide' : 'rejete'}`)}
              <span className="ml-1.5 opacity-70">({count})</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => { setLoading(true); load() }}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-primary-100 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 hover:border-primary-200 dark:border-white/10 dark:bg-primary-800 dark:text-sable/80"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          {t('etablissement.refresh')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary-400" aria-hidden />
        </div>
      ) : error ? (
        <p className="py-10 text-center text-sm text-primary-300">{t('etablissement.loadError')}</p>
      ) : affiches.length === 0 ? (
        <p className="py-10 text-center text-sm text-primary-300">
          {filtre === 'EN_ATTENTE'
            ? t('etablissement.personnelValidation.aucunEnAttente')
            : t('etablissement.personnelValidation.aucun')}
        </p>
      ) : (
        <ul className="space-y-3">
          {affiches.map((p) => (
            <li key={p.id} className="rounded-2xl border border-primary-100 bg-white p-4 dark:border-white/5 dark:bg-primary-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 dark:bg-white/10 dark:text-sable">
                    {initiales(p.prenom, p.nom)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-primary-900 dark:text-sable">
                      {p.prenom} {p.nom}
                    </p>
                    <p className="mt-0.5 text-xs text-primary-300">
                      {t(TYPE_LABEL[p.typePersonnel] ?? '', p.typePersonnel)} · {p.email}
                    </p>
                    {p.numeroOrdre && (
                      <p className="mt-0.5 text-xs text-primary-300">{p.numeroOrdre}</p>
                    )}
                    {p.statutValidation === 'REJETE' && p.validationMotif && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{p.validationMotif}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUT_COULEUR[p.statutValidation] ?? STATUT_COULEUR.EN_ATTENTE}`}
                  >
                    {t(`etablissement.personnelValidation.${p.statutValidation === 'EN_ATTENTE' ? 'enAttente' : p.statutValidation === 'VALIDE' ? 'valide' : 'rejete'}`)}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleDocs(p)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary-100 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 hover:border-primary-200 dark:border-white/10 dark:bg-primary-800 dark:text-sable/80"
                    aria-expanded={expandedId === p.id}
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    {t('etablissement.personnelValidation.voirDocuments')}
                    {expandedId === p.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {p.statutValidation !== 'VALIDE' && (
                    <button
                      type="button"
                      onClick={() => { setDecisionId(p.id); setMotifRejet('') }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      {t('etablissement.personnelValidation.valider')}
                    </button>
                  )}
                </div>
              </div>

              {expandedId === p.id && (
                <div className="mt-3 border-t border-primary-100 pt-3 dark:border-white/10">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-400">
                    {t('etablissement.personnelValidation.documents')}
                  </p>
                  {docsLoading === p.id ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-primary-400" aria-hidden />
                    </div>
                  ) : (docsCache[p.id]?.length ?? 0) === 0 ? (
                    <p className="py-3 text-sm text-primary-300">{t('etablissement.personnelValidation.aucunDocument')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {(docsCache[p.id] ?? []).map((doc) => (
                        <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary-50 px-3 py-2 dark:bg-primary-900/40">
                          <div>
                            <p className="text-sm font-medium text-primary-900 dark:text-sable">{doc.titre}</p>
                            <p className="text-xs text-primary-300">
                              {t(`etablissement.personnelValidation.types.${doc.typeDocument}`, doc.typeDocument)} ·{' '}
                              {t(`etablissement.personnelValidation.statutsDocuments.${doc.statut}`, doc.statut)}
                            </p>
                          </div>
                          {doc.fichierData && (
                            <a
                              href={doc.fichierData}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-primary-100 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 hover:border-primary-200 dark:border-white/10 dark:bg-primary-800 dark:text-sable/80"
                            >
                              <UserRound className="h-3.5 w-3.5" aria-hidden />
                              {t('etablissement.personnelValidation.telecharger')}
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {decisionId === p.id && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                    {t('etablissement.personnelValidation.confirmerValider')}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => decider(p, 'VALIDE')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {busyId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" aria-hidden />}
                      {t('etablissement.personnelValidation.valider')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecisionId(null)}
                      className="rounded-lg border border-primary-100 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 hover:border-primary-200 dark:border-white/10 dark:bg-primary-800 dark:text-sable/80"
                    >
                      {t('personnel.commun.annuler')}
                    </button>
                  </div>
                  <div className="mt-2">
                    <label htmlFor={`rejet-${p.id}`} className="mb-1 block text-xs font-medium text-amber-900 dark:text-amber-200">
                      {t('etablissement.personnelValidation.motifRejet')}
                    </label>
                    <textarea
                      id={`rejet-${p.id}`}
                      rows={2}
                      value={motifRejet}
                      onChange={(e) => setMotifRejet(e.target.value)}
                      placeholder={t('etablissement.personnelValidation.motifRejetPlaceholder')}
                      className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm dark:border-amber-500/40 dark:bg-primary-900/60 dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={busyId === p.id || !motifRejet.trim()}
                      onClick={() => decider(p, 'REJETE')}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden />
                      {t('etablissement.personnelValidation.rejeter')}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
