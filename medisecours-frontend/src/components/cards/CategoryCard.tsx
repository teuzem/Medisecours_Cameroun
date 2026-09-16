'use client'

import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CategoryIcon } from '../ui/CategoryIcon'

export default function CategoryCard({ category, onExplore }: { category: any; onExplore: (cat: any) => void }) {
  const { t } = useTranslation()
  const count = category.maladies?.length ?? 0
  const color = category.couleur || '#10B981'

  return (
    <div className="group flex flex-col justify-between h-full rounded-3xl bg-white dark:bg-[#162032] border border-slate-100 dark:border-white/[0.06] p-7 hover:border-slate-200 dark:hover:border-white/[0.12] transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.2)] hover:-translate-y-1">
      <div>
        <div className="flex items-start justify-between mb-5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-105"
            style={{ backgroundColor: `${color}1A`, color: color }}
          >
            <CategoryIcon iconName={category.icone} categoryName={category.nom} size="md" />
          </div>
          <span className="text-[11px] font-bold tracking-wide uppercase px-3 py-1.5 rounded-full bg-slate-50 dark:bg-white/[0.03] text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-white/[0.05]">
            {t('visitor.components.categoryCard.diseaseCount', { count })}
          </span>
        </div>

        <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {category.nom}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
          {category.description}
        </p>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onExplore(category) }}
        className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors cursor-pointer"
      >
        {t('visitor.components.categoryCard.explore')}
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  )
}
