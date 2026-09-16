'use client'
import { Save, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { availableIcons, getIconNameForCategory } from '../../lib/iconMapping'
import { CategoryIcon } from '../ui/CategoryIcon'

const colorOptions = [
  '#dc2626', '#ea580c', '#d97706', '#65a30d', '#16a34a', '#059669',
  '#0d9488', '#0891b2', '#0284c7', '#2563eb', '#4f46e5', '#7c3aed',
  '#9333ea', '#c026d3', '#db2777', '#e11d48',
]

export default function CategoryEditModal({
  editing,
  onFieldChange,
  onSave,
  onClose,
  saving,
}: {
  editing: any;
  onFieldChange: (key: string, value: any) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation()
  const isNew = !editing.id

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    onSave()
  }

  return createPortal(
    <div
      className="dashboard-theme fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col bg-white rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 bg-[linear-gradient(135deg,#09170f_0%,#0f2418_60%,#183626_100%)] px-6 pb-5 pt-7">
          <button onClick={onClose} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white">
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-4">
            <CategoryIcon iconName={editing.icone || undefined} categoryName={editing.nom || undefined} size="lg" />
            <div>
              <h2 className="text-lg font-bold text-white">{isNew ? t('admin.categorieModal.titleNew') : t('admin.categorieModal.titleEdit')}</h2>
              <p className="mt-0.5 text-sm text-white/60">{isNew ? t('admin.categorieModal.subtitleNew') : t('admin.categorieModal.subtitleEdit')}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.categorieModal.icone')}</label>
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-2xl border border-[#dfe5db] bg-[#f8faf6] p-2">
                  {availableIcons.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => onFieldChange('icone', name)}
                      className={`rounded-xl border-2 p-1 transition hover:scale-110 ${
                        editing.icone === name
                          ? 'border-[#2f6b45] bg-[#edf2ea] shadow-sm'
                          : 'border-transparent hover:border-[#bfd0bd]'
                      }`}
                    >
                      <CategoryIcon iconName={name} size="sm" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.categorieModal.nom')}</label>
                <input
                  type="text"
                  value={editing.nom || ''}
                  onChange={(e) => onFieldChange('nom', e.target.value)}
                  placeholder={t('admin.categorieModal.placeholderNom')}
                  className="w-full rounded-2xl border border-[#dfe5db] bg-[#f8faf6] px-4 py-3 text-sm text-[#223023] outline-none transition focus:border-[#bfd0bd] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.categorieModal.couleur')}</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onFieldChange('couleur', c)}
                      className={`h-8 w-8 rounded-xl transition hover:scale-110 ${
                        editing.couleur === c ? 'ring-2 ring-[#2f6b45] ring-offset-2' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8578]">{t('admin.categorieModal.description')}</label>
                <textarea
                  value={editing.description || ''}
                  onChange={(e) => onFieldChange('description', e.target.value)}
                  rows={2}
                  placeholder={t('admin.categorieModal.placeholderDescription')}
                  className="w-full rounded-2xl border border-[#dfe5db] bg-[#f8faf6] px-4 py-3 text-sm text-[#223023] outline-none transition focus:border-[#bfd0bd] focus:bg-white"
                />
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
                {t('admin.categorieModal.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#2f6b45] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f4a2e] disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? t('admin.categorieModal.saving') : t('admin.categorieModal.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
