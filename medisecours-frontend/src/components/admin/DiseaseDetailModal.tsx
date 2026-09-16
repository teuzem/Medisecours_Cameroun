// @ts-nocheck
'use client'
import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, AlertOctagon, Stethoscope, FlaskConical,
  ShieldAlert, Pill, X, Upload, Trash2, ChevronLeft, ChevronRight,
  Image as ImageIcon, Bug, Bone, HeartPulse, Baby, Pencil, Plus,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import api from '../../api/axios'
import { CategoryIcon } from '../ui/CategoryIcon'
import { useToast } from '../ui/Toast'
import PremierSoinEditModal from './PremierSoinEditModal'
import { API_BASE } from '../../lib/config'

const GRAVITY_STYLES = {
  LÉGÈRE: 'bg-emerald-100 text-emerald-700',
  MODÉRÉE: 'bg-amber-100 text-amber-700',
  SÉVÈRE: 'bg-orange-100 text-orange-700',
  CRITIQUE: 'bg-red-100 text-red-700',
  VARIABLE: 'bg-gray-100 text-gray-700',
}

const INFO_FIELDS = [
  { key: 'description', labelKey: 'infoDescription', icon: Stethoscope },
  { key: 'symptomes', labelKey: 'infoSymptomes', icon: AlertOctagon },
  { key: 'causes', labelKey: 'infoCauses', icon: FlaskConical },
  { key: 'traitement', labelKey: 'infoTraitement', icon: Pill },
  { key: 'precautions', labelKey: 'infoPrecautions', icon: ShieldAlert },
]

function imgUrl(img) {
  const path = img?.contentUrl || img?.url || (img?.id ? `/api/media_objects/${img.id}/download` : '')
  return path.startsWith('http') ? path : `${API_BASE}${path}`
}

export default function DiseaseDetailModal({ maladie, onClose, onMutate }) {
  const allImages = maladie.imageUrl ? [{ url: maladie.imageUrl, filePath: null, originalName: maladie.nom }] : []
  if (maladie.images?.length) allImages.push(...maladie.images)
  const [images, setImages] = useState(allImages)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [previewIndex, setPreviewIndex] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState(null)
  const [editingPs, setEditingPs] = useState(null)
  const [premiersSoins, setPremiersSoins] = useState(maladie.premiersSoins || [])
  const fileInputRef = useRef(null)
  const toast = useToast()
  const { t } = useTranslation()

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      Array.from(selectedFiles).forEach((f) => formData.append('files[]', f))
      const res = await api.post(`/api/admin/maladies/${maladie.id}/images`, formData, {
        headers: { 'Content-Type': undefined },
      })
      const newImages = res.data?.images ?? []
      setImages((prev) => [...prev, ...newImages])
      setSelectedFiles(null)
      toast.success(t('admin.maladieDetail.toastAdded', { count: newImages.length }))
      if (onMutate) onMutate()
    } catch (err) {
      toast.error(err?.response?.data?.error || t('admin.maladieDetail.toastUploadError'))
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteImage = async (imageId) => {
    try {
      await api.delete(`/api/admin/maladies/${maladie.id}/images/${imageId}`)
      setImages((prev) => prev.filter((img) => img.id !== imageId))
      if (carouselIndex >= images.length - 1) setCarouselIndex(Math.max(0, images.length - 2))
      toast.success(t('admin.maladieDetail.toastDeleteImageSuccess'))
      if (onMutate) onMutate()
    } catch {
      toast.error(t('admin.maladieDetail.toastDeleteImageError'))
    }
  }

  const handlePsSave = () => {
    setEditingPs(null)
    if (onMutate) onMutate()
  }

  const handleDeletePs = async (psId) => {
    if (!confirm(t('admin.maladieDetail.confirmDeletePs'))) return
    try {
      await api.delete(`/api/admin/premiers-soins/${psId}`)
      setPremiersSoins((prev) => prev.filter((ps) => ps.id !== psId))
      toast.success(t('admin.maladieDetail.toastPsDeleted'))
      if (onMutate) onMutate()
    } catch {
      toast.error(t('admin.maladieDetail.toastPsError'))
    }
  }

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />
      <div className="dashboard-theme fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Image carousel */}
          <div className="relative shrink-0 w-full h-72 sm:h-80 bg-[#e8eee4] overflow-hidden">
            {images.length > 0 ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-[#f0f5ed] via-[#e4ece0] to-[#dae3d5]" />
                <img
                  src={imgUrl(images[carouselIndex])}
                  alt={images[carouselIndex].originalName || ''}
                  className="relative w-full h-full object-contain cursor-pointer"
                  onClick={() => setPreviewIndex(carouselIndex)}
                />
                {images.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCarouselIndex((i) => (i === 0 ? images.length - 1 : i - 1)) }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCarouselIndex((i) => (i === images.length - 1 ? 0 : i + 1)) }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={(e) => { e.stopPropagation(); setCarouselIndex(i) }}
                          className={`w-2 h-2 rounded-full transition ${i === carouselIndex ? 'bg-white' : 'bg-white/40'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
                {images[carouselIndex].id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteImage(images[carouselIndex].id) }}
                    className="absolute top-3 right-3 p-2 rounded-full bg-black/40 text-white hover:bg-red-500 transition"
                    title={t('admin.maladieDetail.supprimerImage')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <ImageIcon className="w-10 h-10 mx-auto text-[#aab3a8] mb-2" />
                  <p className="text-sm text-[#aab3a8]">{t('admin.maladieDetail.aucuneImage')}</p>
                </div>
              </div>
            )}
            <button
              onClick={onClose}
              className="absolute top-3 left-3 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Title + badges */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                {maladie.categorie && (
                  <CategoryIcon iconName={maladie.categorie.icone} categoryName={maladie.categorie.nom} size="lg" />
                )}
                <div>
                  <h3 className="font-bold text-xl text-[#152116]">{maladie.nom}</h3>
                  {maladie.categorie && (
                    <p className="text-sm text-[#6f796c] mt-0.5">{maladie.categorie.nom}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {maladie.niveauGravite && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${GRAVITY_STYLES[maladie.niveauGravite] || 'bg-gray-100 text-gray-700'}`}>
                    <AlertTriangle className="w-3 h-3" /> {maladie.niveauGravite}
                  </span>
                )}
                {maladie.urgence && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                    <HeartPulse className="w-3 h-3" /> {t('admin.maladieDetail.urgence')}
                  </span>
                )}
                {maladie.contagieux && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                    <Bug className="w-3 h-3" /> {t('admin.maladieDetail.contagieux')}
                  </span>
                )}
                {maladie.isAccident && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                    <Bone className="w-3 h-3" /> {t('admin.maladieDetail.accident')}
                  </span>
                )}
              </div>
            </div>

            {/* Info sections */}
            <div className="space-y-3">
              {INFO_FIELDS.filter((f) => maladie[f.key]).map(({ key, labelKey, icon: Icon }) => (
                <div key={key} className="flex items-start gap-3 p-4 rounded-2xl bg-[#f8faf6] border border-[#eef2ec]">
                  <Icon className="w-5 h-5 text-[#2f6b45] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-semibold text-[#7a8578] uppercase tracking-[0.18em]">{t(`admin.maladieDetail.${labelKey}`)}</p>
                    <p className="mt-1 text-sm text-[#223023] leading-relaxed whitespace-pre-wrap">{maladie[key]}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Type d'accident */}
            {maladie.isAccident && maladie.typeAccident && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#f8faf6] border border-[#eef2ec] mt-3">
                <Bone className="w-5 h-5 text-[#2f6b45] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-semibold text-[#7a8578] uppercase tracking-[0.18em]">{t('admin.maladieDetail.typeAccident')}</p>
                  <p className="mt-1 text-sm text-[#223023]">{maladie.typeAccident}</p>
                </div>
              </div>
            )}

            {/* Premiers soins */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#f8faf6] border border-[#eef2ec] mt-3">
              <Baby className="w-5 h-5 text-[#2f6b45] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold text-[#7a8578] uppercase tracking-[0.18em]">{t('admin.maladieDetail.premiersSoins')}</p>
                  <button
                    onClick={() => setEditingPs({ titre: '', description: '', symptomes: null, niveauUrgence: 'MOYEN' })}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#2f6b45] hover:text-[#1f4a2e] transition shrink-0"
                  >
                    <Plus className="w-3 h-3" /> {t('admin.maladieDetail.ajouter')}
                  </button>
                </div>
                {premiersSoins.length > 0 ? (
                  <ol className="mt-2 space-y-2">
                    {premiersSoins.map((ps, i) => (
                      <li key={ps.id} className="group flex gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#2f6b45] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#223023] truncate">{ps.titre}</p>
                              <p className="text-xs text-[#6f796c] mt-0.5 line-clamp-2">{ps.description}</p>
                              {ps.niveauUrgence && (
                                <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2f6b45]">{ps.niveauUrgence}</span>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                              <button
                                onClick={() => setEditingPs({ ...ps })}
                                className="p-1 rounded-lg hover:bg-[#edf2ea] text-[#7a8578] hover:text-[#223023]"
                                title={t('admin.maladieDetail.modifier')}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePs(ps.id)}
                                className="p-1 rounded-lg hover:bg-red-50 text-[#7a8578] hover:text-red-500"
                                title={t('admin.maladieDetail.supprimer')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-xs text-[#aab3a8]">{t('admin.maladieDetail.aucunPremierSoin')}</p>
                )}
              </div>
            </div>

            {/* Upload */}
            <div className="mt-6 pt-6 border-t border-[#dfe5db]">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.gif"
                multiple
                onChange={(e) => {
                  setSelectedFiles(Array.from(e.target.files))
                  e.target.value = ''
                }}
                className="hidden"
              />
              {!selectedFiles ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-[#dfe5db] text-[#7a8578] hover:border-[#bfd0bd] hover:text-[#2f6b45] transition text-sm font-semibold"
                >
                  <Upload className="w-4 h-4" /> {t('admin.maladieDetail.ajouterImages')}
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#7a8578]">{t('admin.maladieDetail.selectedFiles', { count: selectedFiles.length })}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#2f6b45] hover:bg-[#1f4a2e] text-white text-sm font-semibold disabled:opacity-60 transition"
                    >
                      <Upload className="w-4 h-4" />
                      {isUploading ? t('admin.maladieDetail.uploading') : t('admin.maladieDetail.uploader')}
                    </button>
                    <button
                      onClick={() => { setSelectedFiles(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="px-4 py-2.5 rounded-2xl border border-[#dfe5db] text-[#7a8578] hover:text-red-500 transition text-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {editingPs && (
        <PremierSoinEditModal
          editing={editingPs}
          maladie={maladie}
          onClose={() => setEditingPs(null)}
          onSave={handlePsSave}
        />
      )}

      {/* Lightbox preview */}
      <AnimatePresence>
        {previewIndex !== null && images.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPreviewIndex(null)}
              className="fixed inset-0 bg-black/80 z-[60]"
            />
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
              <button
                onClick={() => setPreviewIndex(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
              >
                <X className="w-6 h-6" />
              </button>
              {previewIndex > 0 && (
                <button
                  onClick={() => setPreviewIndex(previewIndex - 1)}
                  className="absolute left-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              {previewIndex < images.length - 1 && (
                <button
                  onClick={() => setPreviewIndex(previewIndex + 1)}
                  className="absolute right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
              <motion.img
                key={previewIndex}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                src={imgUrl(images[previewIndex])}
                alt=""
                className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
              />
            </div>
          </>
        )}
      </AnimatePresence>
    </>,
    document.body
  )
}
