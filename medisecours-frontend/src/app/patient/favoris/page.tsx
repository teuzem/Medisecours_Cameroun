'use client'

import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { Heart, Loader2, MapPin } from 'lucide-react'
import useSWR from 'swr'
import { mutate as globalMutate } from 'swr'
import api from '../../../api/axios'
import { useAuth } from '../../../hooks/useAuth'
import { fetcher } from '../../../lib/fetcher'
import { ETABLISSEMENTS_KEY, FAVORIS_KEY } from '../../../lib/keys'
import { extractArray } from '../../../lib/api'
import type { CarteCentre } from '../../../lib/carte'
import GlassCard from '../../../components/ui/GlassCard'
import SectionHeader from '../../../components/ui/SectionHeader'
import EstablishmentCard from '../../../components/patient/EstablishmentCard'

export default function PatientFavorisPage() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()

  const { data: favoris, isLoading: loadingFavoris, mutate: mutateFavoris } = useSWR<number[]>(
    isAuthenticated ? FAVORIS_KEY : null,
    fetcher,
  )
  const favoriteIds = Array.isArray(favoris) ? favoris : []

  const { data, isLoading } = useSWR(
    favoriteIds.length > 0 ? `${ETABLISSEMENTS_KEY}?estActif=true&itemsPerPage=100` : null,
    fetcher,
  )

  const centres = useMemo(() => {
    const all = extractArray(data as any) as CarteCentre[]
    return all.filter((c) => favoriteIds.includes(c.id))
  }, [data, favoriteIds])

  const toggleFavorite = useCallback(
    async (id: number) => {
      try {
        await api.delete(`/api/carte/saved/${id}`)
        await mutateFavoris()
        void globalMutate((key) => typeof key === 'string' && key.startsWith('/api/centre_de_santes'), undefined, { revalidate: false })
      } catch {
        // silencieux
      }
    },
    [mutateFavoris],
  )

  const loading = loadingFavoris || isLoading

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 px-3 py-6 sm:px-6">
      <SectionHeader
        title={t('patient.favoris.title')}
        description={t('patient.favoris.subtitle')}
        action={
          <Link
            href="/patient/etablissements"
            className="inline-flex min-h-8 items-center rounded-lg bg-primary-900 px-3 text-xs font-bold text-white transition hover:bg-primary-800 dark:bg-white dark:text-primary-900"
          >
            {t('patient.favoris.explore')}
          </Link>
        }
      />

      {loading ? (
        <div className="mt-8 flex items-center justify-center gap-2 py-10 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : centres.length === 0 ? (
        <GlassCard className="mt-4 p-8 text-center">
          <Heart className="mx-auto h-6 w-6 text-slate-300 dark:text-slate-600" aria-hidden="true" />
          <p className="mt-2 text-xs font-bold text-slate-600 dark:text-slate-300">{t('patient.favoris.emptyTitle')}</p>
          <p className="mt-1 text-[11px] text-slate-400">{t('patient.favoris.emptyDesc')}</p>
          <Link
            href="/patient/etablissements"
            className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-primary-900 px-3 text-xs font-bold text-white transition hover:bg-primary-800 dark:bg-white dark:text-primary-900"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {t('patient.favoris.explore')}
          </Link>
        </GlassCard>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {centres.map((centre) => (
            <EstablishmentCard key={centre.id} centre={centre} isFavorite onToggleFavorite={toggleFavorite} />
          ))}
        </div>
      )}
    </div>
  )
}
