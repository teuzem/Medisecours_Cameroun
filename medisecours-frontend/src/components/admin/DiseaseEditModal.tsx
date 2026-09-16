// @ts-nocheck
'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, X, Upload } from 'lucide-react'
import { createPortal } from 'react-dom'
import api from '../../api/axios'
import { API_BASE } from '../../lib/config'
import { CategoryIcon } from '../ui/CategoryIcon'
import { useToast } from '../ui/Toast'

function CategorySelect({ value, onChange }) {
  const { t } = useTranslation()
  const [categories, setCategories] = useState([])
  useEffect(() => {
    api.get('/api/categories?itemsPerPage=100').then((res) => {
      setCategories(res.data['hydra:member'] || res.data.member || [])
    }).catch(() => {})
  }, [])
  const selectedIri = typeof value === 'object' && value ? value['@id'] || `/api/categories/${value.id}` : value || ''
  return (
    <select
      value={selectedIri}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-2xl border border-[#dfe5db] bg-[#f8faf6] px-4 py-3 text-sm text-[#223023] outline-none transition focus:border-[#bfd0bd] focus:bg-white"
    >
      <option value="">{t('admin.maladieModal.selectCategorie')}</option>
      {categories.map((cat) => (
        <option key={cat['@id'] || cat.id} value={cat['@id'] || `/api/categories/${cat.id}`}>
          {cat.nom}
        </option>
      ))}
    </select>
  )
}

const GRAVITE_STYLES = {
  LÉGÈRE: 'bg-emerald-100 text-emerald-700',
  MODÉRÉE: 'bg-amber-100 text-amber-700',
  SÉVÈRE: 'bg-orange-100 text-orange-700',
  CRITIQUE: 'bg-red-100 text-red-700',
  VARIABLE: 'bg-gray-100 text-gray-700',
}

export default function DiseaseEditModal({
  editing,
  onFieldChange,
  onSave,
  onClose,
  saving,
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadedUrls, setUploadedUrls] = useState([])
  const fileInputRef = useRef(null)
  const toast = useToast()
  const { t } = useTranslation()
  const isNew = !editing.id

  const existingImages = Array.isArray(editing.images) ? editing.images : []

  const resolveImgSrc = (img) => {
    if (typeof img === 'string') return img.startsWith('http') ? img : `${API_BASE}${img}`
    if (img.contentUrl) return img.contentUrl.startsWith('http') ? img.contentUrl : `${API_BASE}${img.contentUrl}`
    if (img.url) return img.url.startsWith('http') ? img.url : `${API_BASE}${img.url}`
    if (img.id) return `${API_BASE}/api/media_objects/${img.id}/download`
    return null
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave()
  }

  const handleUpload = async (files) => {
    if (!files.length) return
    setUploading(true)
    try {
      const formData = new FormData()
      Array.from(files).forEach((f) => formData.append('files[]', f))
      const res = await api.post(`/api/admin/maladies/${editing.id}/images`, formData, {
        headers: { 'Content-Type': undefined },
      })
      const uploaded = res.data.images || []
      const urls = uploaded.map((img) => img.url)
      setUploadedUrls((prev) => [...prev, ...urls])
      toast.success(res.data.message || t('admin.maladieModal.toastUploadSuccess'))
    } catch (err) {
      console.error('Upload failed', err)
      toast.error(t('admin.maladieModal.toastUploadError'))
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (index) => {
    setUploadedUrls((prev) => prev.filter((_, i) => i !== index))
  }

  return createPortal(
    <div
      className="dashboard-theme fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col bg-white rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 bg-[linear-gradient(135deg,#09170f_0%,#0f2418_60%,#183626_100%)] px-6 pb-5 pt-7">
          <button onClick={onClose} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-4">
            <CategoryIcon iconName={editing.categorie?.icone} categoryName={editing.categorie?.nom} size="lg" />
            <div>
              <h2 className="text-lg font-bold text-white">{isNew ? t('admin.maladieModal.titleNew') : t('admin.maladieModal.titleEdit')}</h2>
              <p className="mt-0.5 text-sm text-white/60">{isNew ? t('admin.maladieModal.subtitleNew') : t('admin.maladieModal.subtitleEdit')}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.maladieModal.nom')}</label>
                  <input
                    type="text"
                    value={editing.nom || ''}
                    onChange={(e) => onFieldChange('nom', e.target.value)}
                    placeholder={t('admin.maladieModal.placeholderNom')}
                    className="w-full rounded-2xl border border-[#dfe5db] bg-[#f8faf6] px-4 py-3 text-sm text-[#223023] outline-none transition focus:border-[#bfd0bd] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.maladieModal.gravite')}</label>
                  <select
                    value={editing.niveauGravite || ''}
                    onChange={(e) => onFieldChange('niveauGravite', e.target.value)}
                    className="w-full rounded-2xl border border-[#dfe5db] bg-[#f8faf6] px-4 py-3 text-sm text-[#223023] outline-none transition focus:border-[#bfd0bd] focus:bg-white"
                  >
                    <option value="">-</option>
                    {['LÉGÈRE', 'MODÉRÉE', 'SÉVÈRE', 'CRITIQUE', 'VARIABLE'].map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.maladieModal.categorie')}</label>
                <CategorySelect value={editing.categorie} onChange={(iri) => onFieldChange('categorie', iri)} />
              </div>

              <div className="flex gap-6">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.urgence)}
                    onChange={(e) => onFieldChange('urgence', e.target.checked)}
                    className="h-4 w-4 accent-[#2f6b45]"
                  />
                  <span className="text-sm font-medium text-[#223023]">{t('admin.maladieModal.urgence')}</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.contagieux)}
                    onChange={(e) => onFieldChange('contagieux', e.target.checked)}
                    className="h-4 w-4 accent-[#2f6b45]"
                  />
                  <span className="text-sm font-medium text-[#223023]">{t('admin.maladieModal.contagieux')}</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.isAccident)}
                    onChange={(e) => onFieldChange('isAccident', e.target.checked)}
                    className="h-4 w-4 accent-[#2f6b45]"
                  />
                  <span className="text-sm font-medium text-[#223023]">{t('admin.maladieModal.accident')}</span>
                </label>
              </div>

              {editing.isAccident && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.maladieModal.typeAccident')}</label>
                  <input
                    type="text"
                    value={editing.typeAccident || ''}
                    onChange={(e) => onFieldChange('typeAccident', e.target.value)}
                    placeholder={t('admin.maladieModal.placeholderTypeAccident')}
                    className="w-full rounded-2xl border border-[#dfe5db] bg-[#f8faf6] px-4 py-3 text-sm text-[#223023] outline-none transition focus:border-[#bfd0bd] focus:bg-white"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.maladieModal.description')}</label>
                <textarea
                  value={editing.description || ''}
                  onChange={(e) => onFieldChange('description', e.target.value)}
                  rows={2}
                  placeholder={t('admin.maladieModal.placeholderDescription')}
                  className="w-full rounded-2xl border border-[#dfe5db] bg-[#f8faf6] px-4 py-3 text-sm text-[#223023] outline-none transition focus:border-[#bfd0bd] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.maladieModal.symptomes')}</label>
                <textarea
                  value={editing.symptomes || ''}
                  onChange={(e) => onFieldChange('symptomes', e.target.value)}
                  rows={2}
                  placeholder={t('admin.maladieModal.placeholderSymptomes')}
                  className="w-full rounded-2xl border border-[#dfe5db] bg-[#f8faf6] px-4 py-3 text-sm text-[#223023] outline-none transition focus:border-[#bfd0bd] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.maladieModal.causes')}</label>
                <textarea
                  value={editing.causes || ''}
                  onChange={(e) => onFieldChange('causes', e.target.value)}
                  rows={2}
                  placeholder={t('admin.maladieModal.placeholderCauses')}
                  className="w-full rounded-2xl border border-[#dfe5db] bg-[#f8faf6] px-4 py-3 text-sm text-[#223023] outline-none transition focus:border-[#bfd0bd] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.maladieModal.traitement')}</label>
                <textarea
                  value={editing.traitement || ''}
                  onChange={(e) => onFieldChange('traitement', e.target.value)}
                  rows={2}
                  placeholder={t('admin.maladieModal.placeholderTraitement')}
                  className="w-full rounded-2xl border border-[#dfe5db] bg-[#f8faf6] px-4 py-3 text-sm text-[#223023] outline-none transition focus:border-[#bfd0bd] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.maladieModal.precautions')}</label>
                <textarea
                  value={editing.precautions || ''}
                  onChange={(e) => onFieldChange('precautions', e.target.value)}
                  rows={2}
                  placeholder={t('admin.maladieModal.placeholderPrecautions')}
                  className="w-full rounded-2xl border border-[#dfe5db] bg-[#f8faf6] px-4 py-3 text-sm text-[#223023] outline-none transition focus:border-[#bfd0bd] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.maladieModal.imageUrlExternal')}</label>
                <div className="flex items-center gap-3">
                  {editing.imageUrl && (
                    <img
                      src={editing.imageUrl}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-xl border border-[#dfe5db] bg-[#f8faf6] object-cover"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                  )}
                  <input
                    type="url"
                    value={editing.imageUrl || ''}
                    onChange={(e) => onFieldChange('imageUrl', e.target.value)}
                    placeholder={t('admin.maladieModal.placeholderImageUrl')}
                    className="flex-1 rounded-2xl border border-[#dfe5db] bg-[#f8faf6] px-4 py-3 text-sm text-[#223023] outline-none transition focus:border-[#bfd0bd] focus:bg-white"
                  />
                </div>
              </div>

              <div className="border-t border-[#dfe5db] pt-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.maladieModal.photos')}</label>
                <div className="flex flex-wrap gap-3" id="disease-images">
                  {existingImages.map((img, idx) => (
                    <div key={`existing-${idx}`} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-[#dfe5db] bg-[#f8faf6]">
                      <img src={resolveImgSrc(img)} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                  {uploadedUrls.map((url, idx) => (
                    <div key={`uploaded-${idx}`} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-[#dfe5db] bg-[#f8faf6]">
                      <img src={resolveImgSrc(url)} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!editing.id || uploading}
                    className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-[#dfe5db] text-[#aab3a8] transition hover:border-[#bfd0bd] hover:text-[#566355] disabled:opacity-40"
                  >
                    {uploading ? (
                      <span className="text-xs">{t('admin.maladieModal.upload')}</span>
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => { handleUpload(e.target.files); e.target.value = '' }}
                  />
                </div>
                {!editing.id && (
                  <p className="mt-1.5 text-xs text-[#aab3a8]">{t('admin.maladieModal.saveFirst')}</p>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-[#dfe5db] px-6 py-4">
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-[#dfe5db] bg-white px-5 py-2.5 text-sm font-semibold text-[#566355] transition hover:bg-[#edf2ea]"
              >
                {t('admin.maladieModal.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#2f6b45] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f4a2e] disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? t('admin.maladieModal.saving') : t('admin.maladieModal.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
