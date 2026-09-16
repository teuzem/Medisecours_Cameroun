// @ts-nocheck
'use client'
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, X, AlertTriangle, ChevronsUpDown, Check } from 'lucide-react'
import { Combobox } from '@headlessui/react'
import { createPortal } from 'react-dom'
import useSWR from 'swr'
import api from '../../api/axios'
import { fetcher } from '../../lib/fetcher'

const URGENCE_OPTIONS = ['FAIBLE', 'MOYEN', 'ÉLEVÉ', 'CRITIQUE']

export default function PremierSoinEditModal({
  editing,
  maladie,
  fieldErrors,
  saving,
  onFieldChange,
  onSave,
  onClose,
}) {
  const [localData, setLocalData] = useState(null)
  const [localSaving, setLocalSaving] = useState(false)
  const [localErrors, setLocalErrors] = useState({})
  const [query, setQuery] = useState('')
  const { t } = useTranslation()
  const isNew = !editing?.id
  const isControlled = !!onFieldChange

  const { data: maladies = [] } = useSWR('/api/maladies', fetcher, { revalidateOnFocus: false })

  const getValue = (key) => {
    if (isControlled) return editing?.[key] ?? ''
    return localData?.[key] ?? ''
  }

  const setValue = (key, value) => {
    if (isControlled) {
      onFieldChange(key, value)
    } else {
      setLocalData((prev) => ({ ...prev, [key]: value }))
      if (localErrors[key]) setLocalErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  const getErrors = () => isControlled ? (fieldErrors || {}) : localErrors

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isControlled) {
      onSave()
      return
    }
    setLocalSaving(true)
    setLocalErrors({})
    try {
      const payload = {
        titre: localData?.titre || '',
        description: localData?.description || '',
        symptomes: localData?.symptomes || null,
        niveauUrgence: localData?.niveauUrgence || 'MOYEN',
      }
      if (localData?.id) {
        await api.patch(`/api/admin/premiers-soins/${localData.id}`, payload, {
          headers: { 'Content-Type': 'application/merge-patch+json' },
        })
      } else {
        const targetMaladie = maladie || localData?.maladie
        const iri = typeof targetMaladie === 'string' ? targetMaladie : targetMaladie?.['@id'] || (targetMaladie?.id && `/api/maladies/${targetMaladie.id}`)
        const maladieId = iri?.split('/').pop()
        if (maladieId) {
          await api.post(`/api/admin/maladies/${maladieId}/premiers-soins`, payload)
        }
      }
      if (onSave) onSave()
      onClose()
    } catch (err) {
      const violations = err?.response?.data?.violations
      if (Array.isArray(violations) && violations.length > 0) {
        const map = {}
        violations.forEach((v) => { map[v.field || v.propertyPath] = v.message })
        setLocalErrors(map)
      } else {
        alert(err?.response?.data?.error || t('admin.premierSoinModal.toastSaveError'))
      }
    } finally {
      setLocalSaving(false)
    }
  }

  const currentMaladieIri = useMemo(() => {
    const src = maladie || editing?.maladie || localData?.maladie
    if (!src) return null
    if (typeof src === 'string') return src
    return src['@id'] || `/api/maladies/${src.id}`
  }, [maladie, editing, localData])

  const currentMaladie = useMemo(() => {
    if (!currentMaladieIri) return null
    return maladies.find((m) => m['@id'] === currentMaladieIri) || null
  }, [currentMaladieIri, maladies])

  const filteredMaladies = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return maladies
    return maladies.filter((m) =>
      m.nom.toLowerCase().includes(q) || (m.symptomes || '').toLowerCase().includes(q)
    )
  }, [maladies, query])

  const isSaving = isControlled ? saving : localSaving
  const errs = getErrors()

  return createPortal(
    <div
      className="dashboard-theme fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col bg-white rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 bg-[linear-gradient(135deg,#09170f_0%,#0f2418_60%,#183626_100%)] px-6 pb-5 pt-7">
          <button onClick={onClose} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <span className="text-xl leading-none text-white font-bold">+</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{isNew ? t('admin.premierSoinModal.titleNew') : t('admin.premierSoinModal.titleEdit')}</h2>
              {currentMaladie && (
                <p className="mt-0.5 text-sm text-white/60">{currentMaladie.nom}</p>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.premierSoinModal.titre')}</label>
              <input
                type="text"
                value={getValue('titre')}
                onChange={(e) => setValue('titre', e.target.value)}
                placeholder={t('admin.premierSoinModal.placeholderTitre')}
                className={`w-full rounded-2xl border px-4 py-3 text-sm text-[#223023] outline-none transition focus:bg-white ${errs.titre ? 'border-[#d9534f] bg-[#fef2f2] focus:border-[#d9534f]' : 'border-[#dfe5db] bg-[#f8faf6] focus:border-[#bfd0bd]'}`}
              />
              {errs.titre && <p className="mt-1.5 flex items-center gap-1 text-xs text-[#d9534f]"><AlertTriangle className="h-3 w-3 shrink-0" /> {errs.titre}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.premierSoinModal.maladieLiee')}</label>
              <Combobox
                value={currentMaladie}
                onChange={(m) => setValue('maladie', m?.['@id'] || '')}
              >
                <div className="relative">
                  <div className="flex items-center w-full rounded-2xl border border-[#dfe5db] bg-[#f8faf6] transition focus-within:border-[#bfd0bd] focus-within:bg-white">
                    <Combobox.Input
                      onChange={(e) => setQuery(e.target.value)}
                      displayValue={(m) => m?.nom || ''}
                      className="w-full border-none bg-transparent px-4 py-3 text-sm text-[#223023] outline-none placeholder:text-[#aab3a8]"
                      placeholder={t('admin.premierSoinModal.rechercherMaladie')}
                    />
                    <Combobox.Button className="px-2 py-3 shrink-0">
                      <ChevronsUpDown className="h-4 w-4 text-[#7a8578]" />
                    </Combobox.Button>
                  </div>
                  <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-2xl border border-[#dfe5db] bg-white shadow-lg">
                    {filteredMaladies.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-[#aab3a8]">
                        {t('admin.premierSoinModal.aucuneMaladie')}
                      </div>
                    ) : (
                      filteredMaladies.map((m) => (
                        <Combobox.Option
                          key={m['@id'] || m.id}
                          value={m}
                          className={({ active, selected }) =>
                            `flex items-center gap-3 px-4 py-3 text-sm cursor-pointer transition ${
                              active ? 'bg-[#f3f9f1]' : ''
                            } ${selected ? 'font-semibold text-[#2f6b45]' : 'text-[#223023]'}`
                          }
                        >
                          {({ selected }) => (
                            <>
                              <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                selected ? 'border-[#2f6b45] bg-[#2f6b45]' : 'border-[#dfe5db]'
                              }`}>
                                {selected && <Check className="h-3 w-3 text-white" />}
                              </span>
                              <span className="line-clamp-1">{m.nom}</span>
                            </>
                          )}
                        </Combobox.Option>
                      ))
                    )}
                  </Combobox.Options>
                </div>
              </Combobox>
              {errs.maladie && <p className="mt-1.5 flex items-center gap-1 text-xs text-[#d9534f]"><AlertTriangle className="h-3 w-3 shrink-0" /> {errs.maladie}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.premierSoinModal.niveauUrgence')}</label>
              <select
                value={getValue('niveauUrgence')}
                onChange={(e) => setValue('niveauUrgence', e.target.value)}
                className={`w-full rounded-2xl border px-4 py-3 text-sm text-[#223023] outline-none transition focus:bg-white ${errs.niveauUrgence ? 'border-[#d9534f] bg-[#fef2f2] focus:border-[#d9534f]' : 'border-[#dfe5db] bg-[#f8faf6] focus:border-[#bfd0bd]'}`}
              >
                <option value="">-</option>
                {URGENCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {errs.niveauUrgence && <p className="mt-1.5 flex items-center gap-1 text-xs text-[#d9534f]"><AlertTriangle className="h-3 w-3 shrink-0" /> {errs.niveauUrgence}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.premierSoinModal.description')}</label>
              <textarea
                value={getValue('description')}
                onChange={(e) => setValue('description', e.target.value)}
                rows={4}
                placeholder={t('admin.premierSoinModal.placeholderDescription')}
                className={`w-full rounded-2xl border px-4 py-3 text-sm text-[#223023] outline-none transition focus:bg-white ${errs.description ? 'border-[#d9534f] bg-[#fef2f2] focus:border-[#d9534f]' : 'border-[#dfe5db] bg-[#f8faf6] focus:border-[#bfd0bd]'}`}
              />
              {errs.description && <p className="mt-1.5 flex items-center gap-1 text-xs text-[#d9534f]"><AlertTriangle className="h-3 w-3 shrink-0" /> {errs.description}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.premierSoinModal.symptomesOptionnel')}</label>
              <textarea
                value={getValue('symptomes') || ''}
                onChange={(e) => setValue('symptomes', e.target.value)}
                rows={3}
                placeholder={t('admin.premierSoinModal.symptomesAssocies')}
                className="w-full rounded-2xl border border-[#dfe5db] bg-[#f8faf6] px-4 py-3 text-sm text-[#223023] outline-none transition focus:border-[#bfd0bd] focus:bg-white"
              />
            </div>
          </div>

          <div className="shrink-0 border-t border-[#dfe5db] px-6 py-4">
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-[#dfe5db] bg-white px-5 py-2.5 text-sm font-semibold text-[#566355] transition hover:bg-[#edf2ea]"
              >
                {t('admin.premierSoinModal.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#2f6b45] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f4a2e] disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSaving ? t('admin.premierSoinModal.saving') : t('admin.premierSoinModal.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
