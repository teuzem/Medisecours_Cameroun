'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, MapPin, Phone, Mail, Globe, Clock, Stethoscope,
  AlertCircle, CheckCircle, Star, X, Upload, Trash2, Eye,
  ChevronLeft, ChevronRight, ChevronDown, Image as ImageIcon,
  Search, Filter, Pencil, Save,
} from 'lucide-react'
import Link from 'next/link'
import api from '../../../api/axios'
import { uploadCentreImages, deleteCentreImage, updateCentre, deleteCentre } from '../../../api/admin'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import EmptyState from '../../../components/ui/EmptyState'
import { useToast } from '../../../components/ui/Toast'
import { API_BASE } from '../../../lib/config'

function imgUrl(img: any) {
  const path = img?.contentUrl || img?.url || (img?.id ? `/api/media_objects/${img.id}/download` : '')
  return path.startsWith('http') ? path : `${API_BASE}${path}`
}

const TYPE_ORDER = [
  'chu', 'hopital_general', 'hopital_de_district', 'cma', 'csi',
  'clinique_privee', 'pharmacie', 'laboratoire', 'centre_specialise',
]

const REGIONS = [
  'Adamaoua', 'Centre', 'Est', 'Extrême-Nord', 'Littoral',
  'Nord', 'Nord-Ouest', 'Ouest', 'Sud', 'Sud-Ouest',
]

function getTypeColor(type: string): string {
  const map: Record<string, string> = {
    chu: '#1E3A5F',
    hopital_general: '#0F2418',
    hopital_de_district: '#2F6B45',
    cma: '#52713F',
    csi: '#7D887A',
    clinique_privee: '#B96B6B',
    pharmacie: '#8B5CF6',
    laboratoire: '#D97706',
    centre_specialise: '#0891B2',
  }
  return map[type] || '#6D786A'
}

function getTypeCount(total: number, t: any): string {
  if (total === 0) return t('admin.centres.countZero')
  if (total === 1) return t('admin.centres.countOne')
  return t('admin.centres.countMany', { count: total })
}

export default function AdminCentresPage() {
  const { t } = useTranslation()
  const TYPE_LABELS: Record<string, string> = {
    hopital_general: t('admin.centres.typeHopitalGeneral'),
    hopital_de_district: t('admin.centres.typeHopitalDistrict'),
    chu: t('admin.centres.typeChu'),
    cma: t('admin.centres.typeCma'),
    csi: t('admin.centres.typeCsi'),
    clinique_privee: t('admin.centres.typeCliniquePrivee'),
    pharmacie: t('admin.centres.typePharmacie'),
    laboratoire: t('admin.centres.typeLaboratoire'),
    centre_specialise: t('admin.centres.typeCentreSpecialise'),
  }
  const STATUT_LABELS: Record<string, string> = {
    public: t('admin.centres.statutPublic'),
    prive: t('admin.centres.statutPrive'),
    associatif: t('admin.centres.statutAssociatif'),
  }
  const [centres, setCentres] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [viewCentre, setViewCentre] = useState<any>(null)
  const [centreImages, setCentreImages] = useState<any[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<any>(null)
  const [previewIndex, setPreviewIndex] = useState<any>(null)
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(TYPE_ORDER))
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const load = useCallback(() => {
    api.get('/api/centre_de_santes')
      .then((res: any) => {
        const data = res.data?.['hydra:member'] ?? res.data?.member ?? res.data ?? []
        setCentres(Array.isArray(data) ? data : [])
      })
      .catch(() => toast.error(t('admin.centres.toastLoadError')))
      .finally(() => setLoading(false))
  }, [toast, t])

  useEffect(() => { load() }, [load])

  const filteredCentres = useMemo(() => {
    let result = centres
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((c: any) =>
        (c.nom?.toLowerCase() || '').includes(q) ||
        (c.ville?.toLowerCase() || '').includes(q) ||
        (c.adresse?.toLowerCase() || '').includes(q)
      )
    }
    if (filterRegion) {
      result = result.filter((c: any) => c.region === filterRegion)
    }
    return result
  }, [centres, searchQuery, filterRegion])

  const groupedByType = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const type of TYPE_ORDER) {
      map[type] = []
    }
    for (const c of filteredCentres) {
      const t = c.type as string
      if (!map[t]) map[t] = []
      map[t].push(c)
    }
    return Object.entries(map).filter(([, items]) => items.length > 0)
  }, [filteredCentres])

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const [carouselIndex, setCarouselIndex] = useState(0)
  const [editCentre, setEditCentre] = useState<any>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [allImgs, setAllImgs] = useState<any[]>([])

  const openModal = (centre: any) => {
    setViewCentre(centre)
    const imgs = centre.images || []
    setCentreImages(imgs)
    setAllImgs(centre.imageUrl ? [{ url: centre.imageUrl, originalName: centre.nom, id: 'external' }, ...imgs] : imgs)
    setSelectedFiles(null)
    setPreviewIndex(null)
    setCarouselIndex(0)
  }

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return
    setIsUploading(true)
    try {
      const res = await uploadCentreImages(viewCentre.id, selectedFiles)
      const newImages = res.data?.images ?? []
      setCentreImages((prev: any[]) => [...prev, ...newImages])
      setCentres((prev: any[]) => prev.map((c: any) => c.id === viewCentre.id ? { ...c, images: [...(c.images || []), ...newImages] } : c))
      setViewCentre((prev: any) => ({ ...prev, images: [...(prev.images || []), ...newImages] }))
      setSelectedFiles(null)
      toast.success(t('admin.centres.toastUploadSuccess', { count: newImages.length }))
    } catch (err: any) {
      const msg = err.response?.data?.error || t('admin.centres.toastUploadError')
      toast.error(msg)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteImage = async (imageId: any) => {
    try {
      await deleteCentreImage(viewCentre.id, imageId)
      setCentreImages((prev: any[]) => prev.filter((img: any) => img.id !== imageId))
      setCentres((prev: any[]) => prev.map((c: any) => c.id === viewCentre.id ? { ...c, images: (c.images || []).filter((img: any) => img.id !== imageId) } : c))
      setViewCentre((prev: any) => ({ ...prev, images: (prev.images || []).filter((img: any) => img.id !== imageId) }))
      toast.success(t('admin.centres.toastDeleteImageSuccess'))
    } catch {
      toast.error(t('admin.centres.toastDeleteImageError'))
    }
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editCentre) return
    setSaving(true)
    try {
      const payload = { ...editCentre }
      delete payload.images
      delete payload['hydra:member']
      delete payload['@id']
      delete payload['@type']
      await updateCentre(editCentre.id, payload)
      setCentres((prev: any[]) => prev.map((c: any) => c.id === editCentre.id ? { ...c, ...payload } : c))
      setViewCentre((prev: any) => prev?.id === editCentre.id ? { ...prev, ...payload } : prev)
      setEditCentre(null)
      toast.success(t('admin.centres.toastUpdateSuccess'))
    } catch {
      toast.error(t('admin.centres.toastUpdateError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (deleteConfirmId === null) return
    try {
      await deleteCentre(deleteConfirmId)
      setCentres((prev: any[]) => prev.filter((c: any) => c.id !== deleteConfirmId))
      if (viewCentre?.id === deleteConfirmId) setViewCentre(null)
      toast.success(t('admin.centres.toastDeleteSuccess'))
    } catch {
      toast.error(t('admin.centres.toastDeleteError'))
    } finally {
      setDeleteConfirmId(null)
    }
  }

  if (loading) return <LoadingSpinner label={t('admin.centres.loading')} />

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <section className="rounded-[28px] bg-[linear-gradient(135deg,#09170f_0%,#0f2418_60%,#183626_100%)] p-6 text-white shadow-[0_18px_45px_rgba(15,36,24,0.16)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">{t('admin.centres.eyebrow')}</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">{t('admin.centres.title')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
          {t('admin.centres.description')}
        </p>
      </section>

      {/* Filtres et recherche */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-300" />
          <input
            type="text"
            placeholder={t('admin.centres.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-primary-800 border border-primary-100 dark:border-white/10 text-sm text-primary-900 dark:text-sable placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-mint-500/40 transition"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-300 hover:text-primary-500">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-300 pointer-events-none" />
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="appearance-none pl-10 pr-8 py-2.5 rounded-xl bg-white dark:bg-primary-800 border border-primary-100 dark:border-white/10 text-sm text-primary-900 dark:text-sable focus:outline-none focus:ring-2 focus:ring-mint-500/40 transition cursor-pointer"
          >
            <option value="">{t('admin.centres.allRegions')}</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary-300 pointer-events-none" />
        </div>
        <Link
          href="/admin/centres/import"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition"
        >
          <Upload className="w-4 h-4" /> {t('admin.centres.importer')}
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label={t('admin.centres.statTotal')} value={filteredCentres.length} color="#1E3A5F" icon={Building2} />
        <StatCard label={t('admin.centres.statActifs')} value={filteredCentres.filter((c: any) => c.estActif).length} color="#10B981" icon={CheckCircle} />
        <StatCard label={t('admin.centres.statUrgences24h')} value={filteredCentres.filter((c: any) => c.urgences24h).length} color="#EF4444" icon={AlertCircle} />
      </div>

      {/* Groupes par type */}
      {filteredCentres.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t('admin.centres.emptyTitle')}
          description={searchQuery || filterRegion ? t('admin.centres.emptyNoFilter') : t('admin.centres.emptyBase')}
        />
      ) : (
        <div className="space-y-4">
          {groupedByType.map(([type, items]: [string, any[]]) => {
            const isOpen = expandedTypes.has(type)
            const color = getTypeColor(type)
            return (
              <div key={type} className="rounded-2xl bg-white dark:bg-primary-800 border border-primary-100 dark:border-white/5 overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleType(type)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-primary-50 dark:hover:bg-primary-900/20"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-display font-bold text-lg text-primary-900 dark:text-sable">
                      {TYPE_LABELS[type] || type}
                    </span>
                    <span className="text-sm text-primary-400 font-medium">{getTypeCount(items.length, t)}</span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-primary-300 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-primary-100 dark:border-white/5">
                        <table className="w-full text-sm">
                          <thead className="bg-primary-50/80 dark:bg-primary-900/40 text-primary-700 dark:text-sable">
                            <tr>
                              <th className="text-left px-5 py-3 font-semibold">{t('admin.centres.thCentre')}</th>
                              <th className="text-left px-5 py-3 font-semibold">{t('admin.centres.thVille')}</th>
                              <th className="text-left px-5 py-3 font-semibold">{t('admin.centres.thRegion')}</th>
                              <th className="text-left px-5 py-3 font-semibold">{t('admin.centres.thContact')}</th>
                              <th className="text-left px-5 py-3 font-semibold">{t('admin.centres.thStatut')}</th>
                              <th className="px-5 py-3 text-right font-semibold">{t('admin.centres.thActions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((c: any) => (
                              <tr
                                key={c.id}
                                className="border-t border-primary-100 dark:border-white/5 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition"
                              >
                                <td className="px-5 py-3.5">
                                  <div>
                                    <p className="font-semibold text-primary-900 dark:text-sable">{c.nom}</p>
                                    <p className="text-xs text-primary-400 mt-0.5">{c.adresse}</p>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-primary-700 dark:text-primary-300">{c.ville}</td>
                                <td className="px-5 py-3.5 text-primary-700 dark:text-primary-300">{c.region}</td>
                                <td className="px-5 py-3.5 text-primary-700 dark:text-primary-300 text-xs">
                                  {c.telephone && <p>{c.telephone}</p>}
                                </td>
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-2">
                                    {c.estActif ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-mint-100 text-mint-700">
                                        <CheckCircle className="w-2.5 h-2.5" /> {t('admin.centres.actif')}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                        <AlertCircle className="w-2.5 h-2.5" /> {t('admin.centres.inactif')}
                                      </span>
                                    )}
                                    {c.urgences24h && (
                                      <span className="text-xs text-urgence-500 font-semibold" title={t('admin.centres.urgences24h')}>24h</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => openModal(c)}
                                      className="p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-700 text-primary-500 transition"
                                      title={t('admin.centres.viewDetails')}
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setEditCentre({ ...c })}
                                      className="p-2 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 transition"
                                      title={t('admin.centres.modifier')}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmId(c.id)}
                                      className="p-2 rounded-lg hover:bg-urgence-100 dark:hover:bg-urgence-900/30 text-urgence-500 transition"
                                      title={t('admin.centres.supprimer')}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal centré détail centre */}
      <AnimatePresence>
        {viewCentre && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setViewCentre(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                className="bg-white dark:bg-primary-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              >
                {/* Carousel images en haut */}
                {(function() {
                  const curr = allImgs[carouselIndex]
                  if (allImgs.length === 0) return (
                    <div className="relative w-full h-48 bg-primary-100 dark:bg-primary-900 rounded-t-xl flex items-center justify-center">
                      <div className="text-center">
                        <ImageIcon className="w-10 h-10 mx-auto text-primary-300 mb-2" />
                        <p className="text-sm text-primary-400">{t('admin.centres.aucuneImage')}</p>
                      </div>
                      <button onClick={() => setViewCentre(null)}
                        className="absolute top-3 right-3 p-2 rounded-full bg-black/20 text-primary-400 hover:bg-black/40 transition">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )
                  return (
                    <div className="relative w-full h-64 sm:h-80 bg-primary-100 dark:bg-primary-900 rounded-t-xl overflow-hidden">
                      <img src={imgUrl(curr)} alt={curr.originalName || ''}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => curr.id !== 'external' && setPreviewIndex(carouselIndex)} />
                      {allImgs.length > 1 && (<>
                        <button onClick={(e) => { e.stopPropagation(); setCarouselIndex(i => i === 0 ? allImgs.length - 1 : i - 1) }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition">
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setCarouselIndex(i => i === allImgs.length - 1 ? 0 : i + 1) }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition">
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {allImgs.map((_: any, i: number) => (
                            <button key={i} onClick={() => setCarouselIndex(i)}
                              className={`w-2 h-2 rounded-full transition ${i === carouselIndex ? 'bg-white' : 'bg-white/40'}`} />
                          ))}
                        </div>
                      </>)}
                      {curr?.id !== 'external' && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteImage(curr.id) }}
                          className="absolute top-3 right-3 p-2 rounded-full bg-black/40 text-white hover:bg-urgence-500 transition"
                          title={t('admin.centres.supprimerImage')}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => setViewCentre(null)}
                        className="absolute top-3 left-3 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })()}

                {/* Infos */}
                <div className="p-6">
                  {/* Titre + badges */}
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <h3 className="font-display font-bold text-xl text-primary-900 dark:text-sable">
                        {viewCentre.nom}
                      </h3>
                      <p className="text-sm text-primary-400 mt-0.5">{TYPE_LABELS[viewCentre.type as keyof typeof TYPE_LABELS] || viewCentre.type}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {viewCentre.estActif ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-mint-100 text-mint-700">
                          <CheckCircle className="w-3 h-3" /> {t('admin.centres.actif')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                          <AlertCircle className="w-3 h-3" /> {t('admin.centres.inactif')}
                        </span>
                      )}
                      {viewCentre.urgences24h && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-urgence-100 text-urgence-500">
                          <AlertCircle className="w-3 h-3" /> {t('admin.centres.urgences24h')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Grille infos 2 colonnes */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: MapPin, label: t('admin.centres.detailAdresse'), value: [viewCentre.adresse, viewCentre.quartier, viewCentre.ville, viewCentre.region].filter(Boolean).join(', ') },
                      { icon: Phone, label: t('admin.centres.detailTelephone'), value: viewCentre.telephone },
                      { icon: Mail, label: t('admin.centres.detailEmail'), value: viewCentre.email },
                      { icon: Globe, label: t('admin.centres.detailSiteWeb'), value: viewCentre.siteWeb },
                      { icon: Clock, label: t('admin.centres.detailHoraires'), value: viewCentre.horaires },
                      { icon: Star, label: t('admin.centres.detailStatut'), value: STATUT_LABELS[viewCentre.statut as keyof typeof STATUT_LABELS] || viewCentre.statut },
                      { icon: Building2, label: t('admin.centres.detailCoordonnees'), value: `${viewCentre.latitude}, ${viewCentre.longitude}` },
                    ].filter((f: any) => f.value).map(({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
                      <div key={label} className="flex items-start gap-3 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/40">
                        <Icon className="w-4 h-4 text-primary-300 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-primary-300 uppercase tracking-wide">{label}</p>
                          <p className="text-sm text-primary-900 dark:text-sable break-words">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Spécialités */}
                  {(viewCentre.specialites?.length > 0) && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/40 mt-3">
                      <Stethoscope className="w-4 h-4 text-primary-300 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-semibold text-primary-300 uppercase tracking-wide">{t('admin.centres.detailSpecialites')}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {viewCentre.specialites.map((s: string) => (
                            <span key={s} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-mint-100 text-mint-700">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {viewCentre.description && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/40 mt-3">
                      <AlertCircle className="w-4 h-4 text-primary-300 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-semibold text-primary-300 uppercase tracking-wide">{t('admin.centres.detailDescription')}</p>
                        <p className="text-sm text-primary-900 dark:text-sable">{viewCentre.description}</p>
                      </div>
                    </div>
                  )}

                  {/* Upload */}
                  <div className="mt-6 pt-6 border-t border-primary-100 dark:border-white/5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.gif"
                      multiple
                      onChange={(e) => {
                        setSelectedFiles(Array.from(e.target.files || []))
                        e.target.value = ''
                      }}
                      className="hidden"
                    />
                    {!selectedFiles ? (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-primary-200 dark:border-white/20 text-primary-500 hover:border-mint-500 hover:text-mint-500 transition text-sm font-semibold"
                      >
                        <Upload className="w-4 h-4" /> {t('admin.centres.ajouterImages')}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-primary-400">{t('admin.centres.selectedFiles', { count: selectedFiles.length })}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleUpload}
                            disabled={isUploading}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-mint-500 hover:bg-mint-700 text-white text-sm font-semibold disabled:opacity-60 transition"
                          >
                            <Upload className="w-4 h-4" />
                            {isUploading ? t('admin.centres.uploading') : t('admin.centres.uploader')}
                          </button>
                          <button
                            onClick={() => { setSelectedFiles(null); if (fileInputRef.current) (fileInputRef.current as HTMLInputElement).value = '' }}
                            className="px-4 py-2.5 rounded-lg border border-primary-100 dark:border-white/10 text-primary-500 hover:text-urgence-500 transition text-sm"
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
          </>
        )}
      </AnimatePresence>

      {/* Lightbox preview */}
      <AnimatePresence>
        {previewIndex !== null && allImgs.length > 0 && (
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
              {previewIndex < allImgs.length - 1 && (
                <button
                  onClick={() => setPreviewIndex(previewIndex + 1)}
                  className="absolute right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
              {allImgs[previewIndex]?.id !== 'external' && (
                <motion.img
                  key={previewIndex}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  src={imgUrl(allImgs[previewIndex])}
                  alt=""
                  className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
                />
              )}
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Modal édition */}
      <AnimatePresence>
        {editCentre && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditCentre(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.form onSubmit={handleEditSave}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                className="bg-white dark:bg-primary-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-primary-100 dark:border-white/5">
                  <h3 className="font-display font-bold text-lg text-primary-900 dark:text-sable">{t('admin.centres.editTitle')}</h3>
                  <button type="button" onClick={() => setEditCentre(null)}
                    className="p-1.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-700 text-primary-400 transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label={t('admin.centres.fieldNom')} value={editCentre.nom} onChange={(v: string) => setEditCentre((p: any) => ({ ...p, nom: v }))} required />
                    <div>
                      <label className="block text-xs font-semibold text-primary-300 uppercase tracking-wide mb-1">{t('admin.centres.fieldType')}</label>
                      <select value={editCentre.type} onChange={(e) => setEditCentre((p: any) => ({ ...p, type: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/40 border border-primary-100 dark:border-white/10 text-sm text-primary-900 dark:text-sable focus:outline-none focus:ring-2 focus:ring-mint-500/40">
                        {TYPE_ORDER.map((t) => (
                          <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Field label={t('admin.centres.fieldAdresse')} value={editCentre.adresse} onChange={(v: string) => setEditCentre((p: any) => ({ ...p, adresse: v }))} />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label={t('admin.centres.fieldVille')} value={editCentre.ville} onChange={(v: string) => setEditCentre((p: any) => ({ ...p, ville: v }))} />
                    <div>
                      <label className="block text-xs font-semibold text-primary-300 uppercase tracking-wide mb-1">{t('admin.centres.fieldRegion')}</label>
                      <select value={editCentre.region} onChange={(e) => setEditCentre((p: any) => ({ ...p, region: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/40 border border-primary-100 dark:border-white/10 text-sm text-primary-900 dark:text-sable focus:outline-none focus:ring-2 focus:ring-mint-500/40">
                        {REGIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label={t('admin.centres.fieldTelephone')} value={editCentre.telephone || ''} onChange={(v: string) => setEditCentre((p: any) => ({ ...p, telephone: v || null }))} />
                    <Field label={t('admin.centres.fieldEmail')} value={editCentre.email || ''} onChange={(v: string) => setEditCentre((p: any) => ({ ...p, email: v || null }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label={t('admin.centres.fieldSiteWeb')} value={editCentre.siteWeb || ''} onChange={(v: string) => setEditCentre((p: any) => ({ ...p, siteWeb: v || null }))} />
                    <Field label={t('admin.centres.fieldQuartier')} value={editCentre.quartier || ''} onChange={(v: string) => setEditCentre((p: any) => ({ ...p, quartier: v || null }))} />
                  </div>
                  <Field label={t('admin.centres.fieldHoraires')} value={editCentre.horaires || ''} onChange={(v: string) => setEditCentre((p: any) => ({ ...p, horaires: v }))} />
                  <div>
                    <label className="block text-xs font-semibold text-primary-300 uppercase tracking-wide mb-1">{t('admin.centres.fieldStatut')}</label>
                    <select value={editCentre.statut} onChange={(e) => setEditCentre((p: any) => ({ ...p, statut: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/40 border border-primary-100 dark:border-white/10 text-sm text-primary-900 dark:text-sable focus:outline-none focus:ring-2 focus:ring-mint-500/40">
                      {Object.entries(STATUT_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editCentre.estActif}
                        onChange={(e) => setEditCentre((p: any) => ({ ...p, estActif: e.target.checked }))}
                        className="w-4 h-4 rounded border-primary-300 text-mint-500 focus:ring-mint-500/40" />
                      <span className="text-sm text-primary-900 dark:text-sable">{t('admin.centres.activerCentre')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editCentre.urgences24h}
                        onChange={(e) => setEditCentre((p: any) => ({ ...p, urgences24h: e.target.checked }))}
                        className="w-4 h-4 rounded border-primary-300 text-urgence-500 focus:ring-urgence-500/40" />
                      <span className="text-sm text-primary-900 dark:text-sable">{t('admin.centres.urgences24hCheck')}</span>
                    </label>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-primary-100 dark:border-white/5">
                  <button type="button" onClick={() => setEditCentre(null)}
                    className="px-4 py-2 rounded-lg border border-primary-100 dark:border-white/10 text-primary-500 hover:text-primary-700 transition text-sm">
                    {t('admin.centres.cancel')}
                  </button>
                  <button type="submit" disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-mint-500 hover:bg-mint-700 text-white text-sm font-semibold disabled:opacity-60 transition">
                    <Save className="w-4 h-4" /> {saving ? t('admin.centres.saving') : t('admin.centres.save')}
                  </button>
                </div>
              </motion.form>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Confirmation suppression */}
      <AnimatePresence>
        {deleteConfirmId !== null && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-primary-800 rounded-xl shadow-2xl w-full max-w-sm p-6 text-center"
              >
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-urgence-100 dark:bg-urgence-900/30 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-urgence-500" />
                </div>
                <h3 className="font-display font-bold text-lg text-primary-900 dark:text-sable mb-2">{t('admin.centres.deleteConfirmTitle')}</h3>
                <p className="text-sm text-primary-500 mb-6">
                  {t('admin.centres.deleteConfirmMessage')}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => setDeleteConfirmId(null)}
                    className="px-5 py-2.5 rounded-lg border border-primary-100 dark:border-white/10 text-primary-500 hover:text-primary-700 transition text-sm font-semibold">
                    {t('admin.centres.cancel')}
                  </button>
                  <button onClick={handleDeleteConfirm}
                    className="px-5 py-2.5 rounded-lg bg-urgence-500 hover:bg-urgence-700 text-white text-sm font-semibold transition">
                    {t('admin.centres.delete')}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-primary-300 uppercase tracking-wide mb-1">{label}{required && ' *'}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/40 border border-primary-100 dark:border-white/10 text-sm text-primary-900 dark:text-sable placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-mint-500/40 transition" />
    </div>
  )
}

function StatCard({ label, value, color, icon: Icon }: { label: string; value: any; color: string; icon: any }) {
  return (
    <div className="relative rounded-2xl bg-white dark:bg-primary-800 border border-primary-100 dark:border-white/5 p-5 shadow-sm">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${color}1A` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <p className="text-xs text-primary-300 mb-1">{label}</p>
      <p className="font-display font-bold text-3xl text-primary-900 dark:text-sable">{value}</p>
    </div>
  )
}
