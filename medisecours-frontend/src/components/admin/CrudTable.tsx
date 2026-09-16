'use client'

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Save, Search, Trash2, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Upload, X, Eye } from 'lucide-react'
import useSWR from 'swr'
import api from '../../api/axios'
import { paginatedFetcher, fetcher } from '../../lib/fetcher'
import LoadingSpinner from '../ui/LoadingSpinner'
import EmptyState from '../ui/EmptyState'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import ConfirmModal from '../ui/ConfirmModal'
import { useToast } from '../ui/Toast'
import { availableIcons, getIconNameForCategory } from '../../lib/iconMapping'
import { CategoryIcon } from '../ui/CategoryIcon'
import { API_BASE } from '../../lib/config'

function MetricCard({ label, value, tone = 'neutral' }: { label: string; value: any; tone?: string }) {
  const tones: Record<string, string> = {
    neutral: 'bg-white text-[#152116]',
    green: 'bg-[#f3f9f1] text-[#2f6b45]',
    blue: 'bg-[#f3f6fb] text-[#285074]',
  }
  return (
    <div className={`rounded-[24px] border border-[#e3e7df] p-5 shadow-[0_18px_45px_rgba(15,36,24,0.05)] ${tones[tone] || tones.neutral}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7c8778]">{label}</p>
      <p className="mt-3 font-display text-3xl font-extrabold tracking-tight">{value}</p>
    </div>
  )
}

function SortIcon({ fieldKey, sortKey, sortOrder }: { fieldKey: string; sortKey: string | null; sortOrder: string }) {
  if (sortKey !== fieldKey) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />
  return sortOrder === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
}

function highlightText(text: any, query: string) {
  if (!query || !text) return text
  const q = query.trim().toLowerCase()
  if (!q || typeof text !== 'string') return text
  const idx = text.toLowerCase().indexOf(q)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-[#fef08a] px-0.5 text-[#223023]">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

function CellValue({ field, value, search, item }: { field: any; value: any; search: string; item: any }) {
  const { t } = useTranslation()
  if (field.render) return field.render(value, item, search)
  if (field.type === 'checkbox') return value ? t('common.yes') : t('common.no')

  if (field.type === 'color' && value) {
    return (
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 rounded-full border border-[#dfe5db]" style={{ backgroundColor: value }} />
        <span className="line-clamp-2">{highlightText(String(value), search)}</span>
      </div>
    )
  }

  if (field.type === 'select-api') {
    const display = value?.nom || value?.titre || String(value ?? '-')
    return <span className="line-clamp-2">{highlightText(display, search)}</span>
  }

  if (field.type === 'icon-picker') {
    return <CellIconField iconName={value} categoryName={item?.nom} />
  }

  if (field.type === 'image') {
    if (!value) return <span className="text-[#aab3a8]">-</span>
    return <img src={value} alt="" className="h-10 w-10 rounded-lg object-cover border border-[#dfe5db]" />

  }

  return <span className="line-clamp-2">{highlightText(String(value ?? '-'), search)}</span>
}

function FieldEditor({ field, value, onChange, error }: { field: any; value: any; onChange: (v: any) => void; error?: string }) {
  const { t } = useTranslation()
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">
        {field.label}
      </label>
      {field.type === 'textarea' ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={`w-full rounded-2xl border px-4 py-3 text-sm text-[#223023] outline-none transition focus:bg-white ${
            error ? 'border-[#d9534f] bg-[#fef2f2] focus:border-[#d9534f]' : 'border-[#dfe5db] bg-[#f8faf6] focus:border-[#bfd0bd]'
          }`}
        />
      ) : field.type === 'checkbox' ? (
        <label className="inline-flex items-center gap-3 rounded-2xl border border-[#dfe5db] bg-[#f8faf6] px-4 py-3 text-sm font-medium text-[#223023]">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 accent-[#2f6b45]"
          />
          {t('admin.crudTable.activateField')}
        </label>
      ) : field.type === 'select' ? (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-2xl border px-4 py-3 text-sm text-[#223023] outline-none transition focus:bg-white ${
            error ? 'border-[#d9534f] bg-[#fef2f2] focus:border-[#d9534f]' : 'border-[#dfe5db] bg-[#f8faf6] focus:border-[#bfd0bd]'
          }`}
        >
          <option value="">-</option>
          {field.options.map((option: string) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : field.type === 'select-api' ? (
        <SelectApiField field={field} value={value} onChange={onChange} error={error} />
      ) : field.type === 'icon-picker' ? (
        <IconPickerField value={value} onChange={onChange} error={error} />
      ) : field.type === 'image' ? (
        <div className="flex items-center gap-3">
          {value && (
            <img src={value} alt="" className="h-12 w-12 rounded-lg object-cover border border-[#dfe5db]" />
          )}
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('admin.crudTable.imageUrlPlaceholder')}
            className={`flex-1 rounded-2xl border px-4 py-3 text-sm text-[#223023] outline-none transition focus:bg-white ${
              error ? 'border-[#d9534f] bg-[#fef2f2] focus:border-[#d9534f]' : 'border-[#dfe5db] bg-[#f8faf6] focus:border-[#bfd0bd]'
            }`}
          />
        </div>
      ) : (
        <input
          type={field.type === 'color' ? 'color' : 'text'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-2xl border px-4 py-3 text-sm text-[#223023] outline-none transition focus:bg-white ${
            error ? 'border-[#d9534f] bg-[#fef2f2] focus:border-[#d9534f]' : 'border-[#dfe5db] bg-[#f8faf6] focus:border-[#bfd0bd]'
          }`}
        />
      )}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-[#d9534f]">
          <AlertTriangle className="h-3 w-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}

function SelectApiField({ field, value, onChange, error }: { field: any; value: any; onChange: (v: any) => void; error?: string }) {
  const { data, isLoading } = useSWR(field.endpoint, fetcher, { revalidateOnFocus: false })
  const { t } = useTranslation()
  const options = useMemo(() => (Array.isArray(data) ? data : []), [data])
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={`w-full rounded-2xl border px-4 py-3 text-sm text-[#223023] outline-none transition focus:bg-white ${
        error ? 'border-[#d9534f] bg-[#fef2f2] focus:border-[#d9534f]' : 'border-[#dfe5db] bg-[#f8faf6] focus:border-[#bfd0bd]'
      }`}
    >
      <option value="">{isLoading ? t('admin.crudTable.loading') : '-'}</option>
      {options.map((opt: any) => (
        <option key={opt['@id'] || opt.id} value={opt['@id'] || opt.id}>
          {field.displayKey ? opt[field.displayKey] : (opt.nom || opt.titre || opt['@id'])}
        </option>
      ))}
    </select>
  )
}

function CellIconField({ iconName, categoryName }: { iconName?: string; categoryName?: string }) {
  const resolved = iconName || (categoryName ? getIconNameForCategory(categoryName) : null)
  if (!resolved) return <span className="text-[#aab3a8]">-</span>
  return <CategoryIcon iconName={resolved} size="md" />
}

function IconPickerField({ value, onChange, error }: { value?: string; onChange: (v: string) => void; error?: string }) {
  const { t } = useTranslation()
  return (
    <div className={`rounded-2xl border p-3 ${error ? 'border-[#d9534f] bg-[#fef2f2]' : 'border-[#dfe5db] bg-[#f8faf6]'}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm text-[#7a8578]">{t('admin.crudTable.iconSelected')}</span>
        {value ? <CategoryIcon iconName={value} size="md" /> : <span className="text-xs text-[#aab3a8]">{t('admin.crudTable.iconNone')}</span>}
      </div>
      <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto py-1">
        {availableIcons.map((name: string) => (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            className={`rounded-xl border-2 p-1.5 transition hover:scale-110 ${
              value === name ? 'border-[#2f6b45] bg-[#edf2ea] shadow-sm' : 'border-transparent bg-white/50 hover:border-[#bfd0bd] hover:bg-white'
            }`}
          >
            <CategoryIcon iconName={name} size="md" />
          </button>
        ))}
      </div>
    </div>
  )
}

function IconButton({ children, onClick, tone = 'neutral' }: { children: ReactNode; onClick: () => void; tone?: string }) {
  const tones: Record<string, string> = {
    neutral: 'border-[#dfe5db] bg-white text-[#566355] hover:bg-[#edf2ea]',
    red: 'border-[#efd8d8] bg-[#fdf2f2] text-[#b44949] hover:bg-[#fde8e8]',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition ${tones[tone] || tones.neutral}`}
    >
      {children}
    </button>
  )
}

function imgUrl(image: any) {
  const path = image?.contentUrl || image?.url || (image?.id ? `/api/media_objects/${image.id}/download` : null)
  if (!path) return undefined
  return path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

function ImageGallery({ endpoint, entityId, images, onMutate, entityType = 'maladies' }: {
  endpoint: string
  entityId: any
  images: any
  onMutate: any
  entityType?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const { t } = useTranslation()

  const imageList = useMemo(() => (Array.isArray(images) ? images : []), [images])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    try {
      const form = new FormData()
      Array.from(files).forEach((f: File) => form.append('files[]', f))
      await api.post(`/api/admin/${entityType}/${entityId}/images`, form)
      onMutate()
      toast.success(t('admin.crudTable.toastUploadSuccess'))
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('admin.crudTable.toastUploadError'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async (imageId: number) => {
    setDeletingId(imageId)
    try {
      await api.delete(`/api/admin/${entityType}/${entityId}/images/${imageId}`)
      onMutate()
      toast.success(t('admin.maladieDetail.toastDeleteImageSuccess'))
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('admin.maladieDetail.toastDeleteImageError'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-2xl border border-[#dfe5db] bg-[#f8faf6] p-4">
      <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">
        {t('admin.crudTable.imagesIcones')}
      </label>
      {imageList.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {imageList.map((img: any) => (
            <div key={img.id} className="group relative">
              <img
                src={imgUrl(img)}
                alt={img.originalName || ''}
                className="h-16 w-16 rounded-xl border border-[#dfe5db] object-cover"
              />
              <button
                onClick={() => handleDelete(img.id)}
                disabled={deletingId === img.id}
                className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-[#d9534f] text-white text-xs group-hover:flex disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleUpload}
          className="hidden"
          id="image-upload-input"
        />
        <label
          htmlFor="image-upload-input"
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#dfe5db] bg-white px-4 py-2 text-sm font-semibold text-[#566355] transition hover:bg-[#edf2ea]"
        >
          <Upload className="h-4 w-4" />
          {uploading ? t('admin.crudTable.uploading') : t('admin.crudTable.addImages')}
        </label>
      </div>
    </div>
  )
}

export default function CrudTable({
  endpoint,
  fields,
  title,
  description = '',
  createLabel = undefined,
  previewKeys,
  searchEndpoint = undefined,
  imageUploadEndpoint = undefined,
  itemsPerPage: perPage = 30,
  editModal,
  detailModal = undefined,
}: {
  endpoint: string
  fields: any[]
  title: string
  description?: string
  createLabel?: string
  previewKeys?: string[]
  searchEndpoint?: string
  imageUploadEndpoint?: string
  itemsPerPage?: number
  editModal?: any
  detailModal?: any
}) {
  const [editing, setEditing] = useState<any>(null)
  const [viewing, setViewing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; itemId: any }>({ isOpen: false, itemId: null })
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [fieldErrors, setFieldErrors] = useState<any>({})
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState('asc')
  const toast = useToast()
  const { t } = useTranslation()

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('itemsPerPage', String(perPage))
    if (sortKey) params.set(`order[${sortKey}]`, sortOrder)
    if (search.trim() && searchEndpoint) {
      params.set('q', search.trim())
      return `${searchEndpoint}?${params.toString()}`
    }
    return `${endpoint}?${params.toString()}`
  }, [endpoint, page, sortKey, sortOrder, search, searchEndpoint, perPage])

  const { data, isLoading, mutate } = useSWR(apiUrl, paginatedFetcher, { revalidateOnFocus: false })

  const items = useMemo(() => data?.items ?? [], [data])
  const totalItems = data?.totalItems ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage))

  const previewFields = useMemo(() => {
    if (previewKeys) {
      return previewKeys.map((k: string) => fields.find((f: any) => f.key === k)).filter(Boolean)
    }
    return fields.slice(0, 3)
  }, [fields, previewKeys])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') setSortOrder('desc')
      else if (sortOrder === 'desc') { setSortKey(null); setSortOrder('asc') }
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
    setPage(1)
  }

  const startCreate = () => {
    setEditing(Object.fromEntries(fields.map((field: any) => [field.key, field.type === 'checkbox' ? false : field.type === 'select-api' ? null : ''])))
    setFieldErrors({})
  }

  const startEdit = (item: any) => {
    setEditing({ ...item })
    setFieldErrors({})
  }

  const handleDelete = async () => {
    setDeleteLoading(true)
    try {
      await api.delete(`${endpoint}/${confirmModal.itemId}`)
      mutate()
      toast.success(t('admin.crudTable.toastDeleted'))
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.response?.data?.error || t('admin.crudTable.toastDeleteError'))
    } finally {
      setDeleteLoading(false)
      setConfirmModal({ isOpen: false, itemId: null })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setFieldErrors({})
    const payload: Record<string, any> = Object.fromEntries(
      fields.map((field: any) => [field.key, editing[field.key]])
    )
    if (editModal) {
      if (editing.categorie) {
        payload.categorie = typeof editing.categorie === 'string' ? editing.categorie : editing.categorie['@id'] || `/api/categories/${editing.categorie.id}`
      }
    }
    try {
      if (editing.id) {
        await api.patch(`${endpoint}/${editing.id}`, payload, {
          headers: { 'Content-Type': 'application/merge-patch+json' },
        })
        mutate()
        toast.success(t('admin.crudTable.toastUpdated'))
        setEditing(null)
      } else {
        await api.post(endpoint, payload)
        mutate()
        toast.success(t('admin.crudTable.toastCreated'))
        setEditing(null)
      }
    } catch (err: any) {
      const violations = err?.response?.data?.violations
      if (Array.isArray(violations) && violations.length > 0) {
        const map: Record<string, string> = {}
        violations.forEach((v: any) => { map[v.propertyPath] = v.message })
        setFieldErrors(map)
        toast.error(t('admin.crudTable.toastValidationError'))
      } else {
        toast.error(err?.response?.data?.detail || err?.response?.data?.error || t('admin.crudTable.toastSaveError'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, itemId: null })}
        onConfirm={handleDelete}
        isLoading={deleteLoading}
        type="danger"
        title={t('admin.crudTable.deleteConfirmTitle')}
        message={t('admin.crudTable.deleteConfirmMessage')}
        confirmText={t('admin.crudTable.deleteConfirm')}
      />

      <section className="rounded-[28px] border border-[#e3e7df] bg-white p-5 shadow-[0_18px_45px_rgba(15,36,24,0.05)] sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-lg font-bold text-[#152116]">{title}</p>
            <p className="mt-1 text-sm text-[#6f796c]">
              {description || t('admin.crudTable.descriptionFallback', { title })}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-[260px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8678]" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder={t('admin.crudTable.searchIn', { name: title.toLowerCase() })}
                className="w-full rounded-full border border-[#dfe5db] bg-[#f8faf6] py-3 pl-11 pr-4 text-sm text-[#233024] outline-none transition focus:border-[#bfd0bd] focus:bg-white"
              />
            </div>
            <Button onClick={startCreate} variant="primary">
              <Plus className="h-4 w-4" /> {createLabel || t('admin.crudTable.actionAdd')}
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label={t('admin.crudTable.metricTotal')} value={totalItems} />
        <MetricCard label={t('admin.crudTable.metricThisPage')} value={items.length} tone="green" />
        <MetricCard label={t('admin.crudTable.metricPages')} value={totalPages} tone="blue" />
      </section>

      <section className="rounded-[28px] border border-[#e3e7df] bg-white p-2 shadow-[0_18px_45px_rgba(15,36,24,0.05)] sm:p-3">
        {isLoading ? (
          <div className="p-8">
            <LoadingSpinner size="sm" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState title={t('admin.crudTable.emptyTitle')} description={search ? t('admin.crudTable.emptySearch') : t('admin.crudTable.emptyAdd', { name: title })} />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[24px]">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-[#7a8578]">
                  {previewFields.map((field: any) => (
                    <th key={field.key} className="px-5 py-4 font-semibold">
                      <button
                        onClick={() => handleSort(field.key)}
                        className="inline-flex items-center gap-0.5 hover:text-[#2f6b45] transition"
                      >
                        {field.label}
                        <SortIcon fieldKey={field.key} sortKey={sortKey} sortOrder={sortOrder} />
                      </button>
                    </th>
                  ))}
                  <th className="px-5 py-4 text-right font-semibold">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => (
                  <tr key={item.id} className="border-t border-[#edf1eb]">
                    {previewFields.map((field: any) => (
                      <td key={field.key} className="px-5 py-4 text-[#223023]">
                        <CellValue field={field} value={item[field.key]} search={search} item={item} />
                      </td>
                    ))}
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {detailModal && (
                          <IconButton onClick={() => setViewing(item)} tone="neutral">
                            <Eye className="h-4 w-4" />
                          </IconButton>
                        )}
                        <IconButton onClick={() => startEdit(item)} tone="neutral">
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          onClick={() => setConfirmModal({ isOpen: true, itemId: item.id })}
                          tone="red"
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#edf1eb] px-4 py-3">
            <p className="text-xs text-[#6f796c]">
              {t('admin.crudTable.pageInfo', { page, totalPages, totalItems })}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#dfe5db] bg-white text-[#566355] transition hover:bg-[#edf2ea] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let p
                if (totalPages <= 5) p = i + 1
                else if (page <= 3) p = i + 1
                else if (page >= totalPages - 2) p = totalPages - 4 + i
                else p = page - 2 + i
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`inline-flex h-9 min-w-[36px] items-center justify-center rounded-xl px-2 text-xs font-semibold transition ${
                      p === page ? 'bg-[#0f2418] text-white' : 'border border-[#dfe5db] bg-white text-[#566355] hover:bg-[#edf2ea]'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#dfe5db] bg-white text-[#566355] transition hover:bg-[#edf2ea] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {editing && (editModal ? editModal({
        editing,
        fields,
        fieldErrors,
        saving,
        onFieldChange: (key: string, value: any) => {
          setEditing((current: any) => ({ ...current, [key]: value }))
          if (fieldErrors[key]) setFieldErrors((prev: any) => ({ ...prev, [key]: undefined }))
        },
        onSave: handleSave,
        onClose: () => setEditing(null),
      }) : (
        <Modal isOpen onClose={() => setEditing(null)} title={t('admin.crudTable.editAddTitle', { action: editing.id ? t('admin.crudTable.actionEdit') : t('admin.crudTable.actionAdd'), title })}>
          <div className="space-y-4">
            {fields.map((field: any) => (
              <FieldEditor
                key={field.key}
                field={field}
                value={editing[field.key]}
                error={fieldErrors[field.key]}
                onChange={(value: any) => {
                  setEditing((current: any) => ({ ...current, [field.key]: value }))
                  if (fieldErrors[field.key]) setFieldErrors((prev: any) => ({ ...prev, [field.key]: undefined }))
                }}
              />
            ))}
            {editing.id && imageUploadEndpoint && (
              <ImageGallery
                endpoint={imageUploadEndpoint}
                entityId={editing.id}
                images={editing.images}
                onMutate={mutate}
              />
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {t('admin.crudTable.cancel')}
            </Button>
            <Button onClick={handleSave} variant="primary" isLoading={saving}>
              <Save className="h-4 w-4" /> {saving ? t('admin.crudTable.saving') : t('admin.crudTable.save')}
            </Button>
          </div>
        </Modal>
      ))}

      {viewing && detailModal && detailModal({
        item: viewing,
        onClose: () => setViewing(null),
        onMutate: mutate,
      })}
    </div>
  )
}
