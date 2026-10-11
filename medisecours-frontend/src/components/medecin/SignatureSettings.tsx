'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, ShieldCheck, Stamp, Loader2, BadgeCheck } from 'lucide-react'
import api from '../../api/axios'
import { useToast } from '../ui/Toast'
import GlassCard from '../ui/GlassCard'
import SignaturePad from '../ui/SignaturePad'
import { useMySignature, useDocumentSeals } from '../../lib/documentSeals'

/**
 * Signature numérique du médecin + cachets officiels de ses établissements
 * affiliés. La signature est injectée automatiquement dans toutes les
 * ordonnances et rapports générés (non-répudiation).
 */
export default function SignatureSettings() {
  const { t } = useTranslation()
  const toast = useToast()
  const { signature, mutate } = useMySignature()
  const { seaux } = useDocumentSeals()

  const [imageData, setImageData] = useState<string | null>(null)
  const [grade, setGrade] = useState(signature?.grade ?? '')
  const [saving, setSaving] = useState(false)

  const dirty = imageData !== null

  const save = async () => {
    if (!imageData) return
    setSaving(true)
    try {
      await api.post('/api/me/signature', {
        imageData,
        grade: grade.trim() || null,
      })
      await mutate()
      setImageData(null)
      toast.success(t('signature.saved'))
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('signature.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <GlassCard className="p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-mint-500" />
          <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">
            {t('medecin.settings.signatureTitle')}
          </p>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {t('medecin.settings.signatureDesc')}
        </p>

        <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_240px]">
          <div>
            <SignaturePad
              value={dirty ? imageData : signature?.imageData ?? null}
              onChange={setImageData}
            />
            <label className="mt-3 block">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {t('medecin.settings.gradeLabel')}
              </span>
              <input
                type="text"
                value={dirty ? grade : (signature?.grade ?? '')}
                onChange={(e) => setGrade(e.target.value)}
                placeholder={t('medecin.settings.gradePlaceholder')}
                maxLength={120}
                className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-mint-500 px-4 text-xs font-bold text-primary-900 transition hover:bg-mint-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? t('signature.saving') : t('signature.save')}
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-[10px] font-bold uppercase tracking-[0.04em] text-slate-400">
              {t('signature.registeredTitle')}
            </p>
            {signature ? (
              <div className="mt-3">
                <img
                  src={signature.imageData}
                  alt={t('signature.registeredTitle')}
                  className="mx-auto max-h-20 w-auto"
                />
                <p className="mt-3 text-xs font-bold text-slate-700 dark:text-slate-200">
                  {signature.grade ? `${signature.grade} ` : ''}{signature.prenom} {signature.nom}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {new Date(signature.signedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
                <p className="mt-2 flex items-center gap-1 text-[10px] text-mint-600 dark:text-mint-400">
                  <BadgeCheck className="h-3 w-3" />
                  {t('signature.fingerprint', { hash: signature.hashShort })}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">{t('signature.noneYet')}</p>
            )}
          </div>
        </div>
      </GlassCard>

      <GlassCard className="mt-4 p-5">
        <div className="flex items-center gap-2">
          <Stamp className="h-4 w-4 text-primary-500" />
          <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">
            {t('medecin.settings.affiliationStampsTitle')}
          </p>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {t('medecin.settings.affiliationStampsDesc')}
        </p>

        {seaux.length === 0 ? (
          <p className="mt-3 text-xs text-slate-400">{t('medecin.settings.noAffiliationStamps')}</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {seaux.map((seal) => (
              <div key={seal.centreId} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{seal.nom}</p>
                {seal.ville && <p className="text-[11px] text-slate-400">{seal.ville}</p>}
                <div className="mt-3 flex items-end gap-4">
                  {seal.cachetUrl ? (
                    <img src={seal.cachetUrl} alt={t('medecin.settings.affiliationStampsTitle')} className="max-h-20 w-auto" />
                  ) : (
                    <span className="text-[11px] text-slate-400">{t('medecin.settings.stampPending')}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    {seal.dirigeantNom && (
                      <p className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {seal.dirigeantNom}
                        {seal.dirigeantGrade ? <span className="text-slate-400"> — {seal.dirigeantGrade}</span> : null}
                      </p>
                    )}
                    {seal.dirigeantSignature ? (
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-mint-600 dark:text-mint-400">
                        <BadgeCheck className="h-3 w-3" />
                        {t('signature.directorSigned')}
                      </p>
                    ) : seal.dirigeantNom ? (
                      <p className="mt-1 text-[10px] text-amber-500">{t('signature.directorUnsigned')}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </>
  )
}
