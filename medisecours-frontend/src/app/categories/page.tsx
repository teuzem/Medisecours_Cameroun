'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, LayoutGrid, Loader2 } from 'lucide-react'
import useSWR from 'swr'
import api from '../../api/axios'
import CategoryCard from '../../components/cards/CategoryCard'
import { CategoryIcon } from '../../components/ui/CategoryIcon'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { useTranslation } from 'react-i18next'

const ITEMS_PER_PAGE = 12

/* ─── SWR fetcher compatible avec l'instance axios configurée ─── */
const fetcher = (url: string) => api.get(url).then((res) => res.data)

export default function CategoriesPage() {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<any>(null)
  const [page, setPage] = useState(1)
  const toast = useToast()

  /* ─── 1. Chargement initial des catégories uniquement ─── */
  useEffect(() => {
    let active = true
    api.get('/api/categories')
      .then((res: any) => {
        if (!active) return
        const cats = res.data?.['hydra:member'] ?? res.data?.member ?? res.data
        setCategories(Array.isArray(cats) ? cats : [])
      })
      .catch(() => toast.error(t('visitor.categories.loadError')))
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [toast, t])

  /* ─── 2. SWR conditionnel : requête serveur ─── */
  const categoryId = selectedCategory?.id ?? selectedCategory?.['@id'] ?? null

  // Fetching sans les paramètres de pagination pour laisser le frontend gérer le découpage
  const swrKey = categoryId
    ? `/api/public/conditions?category=${encodeURIComponent(String(categoryId).split('/').pop() ?? '')}&itemsPerPage=30`
    : null // SWR ne fetch pas si la clé est null

  const { data: maladiesData, isLoading: maladiesLoading } = useSWR(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  )

  /* ─── 3. Extraction du DTO public assaini ─── */
  const maladies: any[] = maladiesData?.items ?? []
  const totalItems: number = maladiesData?.total ?? maladies.length
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE))

  /* ─── Handlers ─── */
  const handleExplore = useCallback((cat: any) => {
    setSelectedCategory(cat)
    setPage(1)
  }, [])

  const closeModal = useCallback(() => {
    setSelectedCategory(null)
    setPage(1)
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-3">
        <LayoutGrid className="w-8 h-8 text-mint-500" />
        <h1 className="font-display font-bold text-4xl text-primary-900 dark:text-sable">{t('visitor.categories.title')}</h1>
      </div>
      <p className="text-primary-400 dark:text-primary-300 text-lg mb-12">{t('visitor.categories.subtitle')}</p>

      {loading ? (
        <LoadingSpinner label={t('visitor.categories.loading')} />
      ) : categories.length === 0 ? (
        <EmptyState title={t('visitor.categories.emptyTitle')} description={t('visitor.categories.emptyDesc')} />
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {categories.map((c: any) => (
            <motion.div
              key={c.id}
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}
            >
              <CategoryCard category={c} onExplore={handleExplore} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ═══ Modal asynchrone avec SWR ═══ */}
      <AnimatePresence>
        {selectedCategory && (
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          >
            <motion.div
              key="modal-panel"
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#162032] border border-slate-100 dark:border-white/[0.06] shadow-2xl p-8"
            >
              {/* Close button */}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.12] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                {selectedCategory.icone && (
                  <CategoryIcon iconName={selectedCategory.icone} categoryName={selectedCategory.nom} size="md" />
                )}
                <div>
                  <h2 className="font-display font-bold text-2xl text-slate-900 dark:text-white">
                    {selectedCategory.nom}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('visitor.categories.diseasesCount', { count: totalItems })}
                  </p>
                </div>
              </div>

              {/* Contenu de la modale */}
              {maladiesLoading && maladies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <p className="text-sm text-slate-400">{t('visitor.categories.loadingDiseases')}</p>
                </div>
              ) : maladies.length === 0 ? (
                <EmptyState title={t('visitor.categories.diseasesEmptyTitle')} description={t('visitor.categories.diseasesEmptyDesc')} />
              ) : (
                <div className={`space-y-3 transition-opacity duration-200 ${maladiesLoading ? 'opacity-50' : 'opacity-100'}`}>
                  {maladies.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map((m: any) => (
                    <div
                      key={m.id}
                      className="rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.05] p-4 hover:border-indigo-200 dark:hover:border-indigo-800/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-slate-900 dark:text-white mb-1">{m.nom}</h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {m.symptomes || m.description}
                          </p>
                        </div>
                        {m.niveauGravite && (
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/30">
                            {m.niveauGravite}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination serveur — masquée si tout tient sur une seule page */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                  <div>
                    {page > 1 && (
                      <button
                        onClick={() => setPage((p) => p - 1)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" /> {t('visitor.categories.previous')}
                      </button>
                    )}
                  </div>

                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    {t('visitor.categories.pageIndicator', { page, total: totalPages })}
                  </span>

                  <div>
                    {page < totalPages && (
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                      >
                        {t('visitor.categories.next')} <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
