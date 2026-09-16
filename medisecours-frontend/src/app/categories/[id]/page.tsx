'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Filter } from 'lucide-react'
import api from '../../../api/axios'
import MaladieCard from '../../../components/cards/MaladieCard'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import EmptyState from '../../../components/ui/EmptyState'
import { useToast } from '../../../components/ui/Toast'
import { CategoryIcon } from '../../../components/ui/CategoryIcon'
import { useTranslation } from 'react-i18next'

const GRAVITES = ['LÉGÈRE', 'MODÉRÉE', 'SÉVÈRE', 'CRITIQUE', 'VARIABLE']

export default function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t } = useTranslation()
  const [category, setCategory] = useState<any>(null)
  const [maladies, setMaladies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [gravite, setGravite] = useState('')
  const [notFound, setNotFound] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const catRes = await api.get(`/api/categories/${id}`)
        if (!active) return
        setCategory(catRes.data)

        const malRes = await api.get(`/api/maladies?categorie=/api/categories/${id}`)
        if (!active) return
        const raw = malRes.data['hydra:member'] ?? malRes.data?.member ?? malRes.data
        setMaladies(Array.isArray(raw) ? raw : [])
      } catch (err: any) {
        if (!active) return
        if (err.response?.status === 404) setNotFound(true)
        else toast.error(t('visitor.categories.loadError'))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [id, toast])

  const filtered = gravite ? maladies.filter((m: any) => m.niveauGravite === gravite) : maladies

  if (loading) return <LoadingSpinner label={t('visitor.categories.loading')} />
  if (notFound || !category) {
    return (
      <EmptyState
        title={t('visitor.categories.emptyTitle')}
        description={t('visitor.categories.emptyDesc')}
        action={<Link href="/categories" className="text-mint-500 font-semibold text-sm"><ArrowLeft className="w-4 h-4 mr-1 inline" />{t('visitor.categories.previous')}</Link>}
      />
    )
  }

  return (
    <div>
      <div className="py-12 px-6" style={{ backgroundColor: `${category.couleur}14` }}>
        <div className="max-w-5xl mx-auto">
          <Link href="/categories" className="inline-flex items-center gap-1 text-sm text-primary-300 hover:text-mint-500 mb-4">
            <ArrowLeft className="w-4 h-4" /> {t('visitor.categories.title')}
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <CategoryIcon iconName={category.icone} categoryName={category.nom} size="md" />
            <h1 className="font-display font-bold text-3xl text-primary-900 dark:text-sable">{category.nom}</h1>
          </div>
          <p className="text-primary-300 max-w-2xl">{category.description}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Filter className="w-4 h-4 text-primary-300" />
          <button
            onClick={() => setGravite('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${!gravite ? 'bg-primary-500 text-white' : 'bg-primary-100 dark:bg-primary-700 text-primary-700 dark:text-sable'}`}
          >
            {t('common.all')}
          </button>
          {GRAVITES.map((g) => (
            <button
              key={g}
              onClick={() => setGravite(g)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${gravite === g ? 'bg-primary-500 text-white' : 'bg-primary-100 dark:bg-primary-700 text-primary-700 dark:text-sable'}`}
            >
              {g}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState title={t('visitor.categories.diseasesEmptyTitle')} description={t('visitor.categories.diseasesEmptyDesc')} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((m: any) => <MaladieCard key={m.id} maladie={m} />)}
          </div>
        )}
      </div>
    </div>
  )
}
