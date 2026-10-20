'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowLeft, Building2, LoaderCircle, MapPin, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import api from '@/api/axios'
import { resolveImgPath } from '@/lib/config'

type PersonnelPublic = {
  id: string
  nom: string
  prenom: string
  photoProfil: string | null
  photoCouverture: string | null
  typePersonnel: string
  fonction: string | null
  numeroOrdre: string | null
  noteMoyenne: number
  totalAvis: number
  etablissement: {
    id: number
    nom: string
    ville: string | null
    logoUrl: string | null
  } | null
}

function Stars({ note }: { note: number }) {
  return (
    <span className="flex gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`h-3.5 w-3.5 ${
            value <= Math.round(note) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'
          }`}
        />
      ))}
    </span>
  )
}

/**
 * Annuaire public des personnels de santé.
 *
 * Point d'entrée de la notation : un patient retrouve le soignant qu'il a
 * rencontré, consulte son profil professionnel et le note.
 */
export default function PersonnelsPublicsPage() {
  const { t } = useTranslation()
  const [centreId, setCentreId] = useState<string>('')

  const { data, isLoading, error } = useSWR<PersonnelPublic[]>(
    '/api/personnels-publics',
    async (url: string) => {
      const res = await api.get(url)
      return res.data?.items ?? []
    },
    { revalidateOnFocus: false },
  )

  const items = useMemo(() => data ?? [], [data])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/carte"
        className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950 dark:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('personnel.profil.retourCarte')}
      </Link>

      <h1 className="mt-4 font-display text-2xl font-bold text-slate-950 dark:text-white">
        {t('personnel.annuaire.titre')}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('personnel.annuaire.sousTitre')}</p>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <LoaderCircle className="h-7 w-7 animate-spin text-primary-700" />
        </div>
      ) : error ? (
        <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">{t('personnel.commun.erreur')}</p>
      ) : items.length === 0 ? (
        <p className="mt-10 border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          {t('personnel.annuaire.vide')}
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {items.map((personnel) => {
            const fullName = `${personnel.prenom ?? ''} ${personnel.nom ?? ''}`.trim()
            const photo = personnel.photoProfil ? resolveImgPath(personnel.photoProfil) : null
            const initiales = `${personnel.prenom?.[0] ?? ''}${personnel.nom?.[0] ?? ''}`.toUpperCase() || 'P'

            return (
              <li key={personnel.id}>
                <Link
                  href={`/personnel/${personnel.id}`}
                  className="block overflow-hidden border border-slate-200 bg-white transition hover:border-primary-300 hover:shadow-md dark:border-white/10 dark:bg-slate-900 dark:hover:border-white/25"
                >
                  <div className="relative h-20 w-full overflow-hidden bg-gradient-to-br from-primary-800 via-primary-700 to-emerald-700">
                    {personnel.photoCouverture ? (
                      <Image
                        src={resolveImgPath(personnel.photoCouverture) ?? ''}
                        alt=""
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="flex gap-3 p-4">
                    <div className="-mt-8 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-emerald-100 text-lg font-black text-emerald-800 dark:border-slate-900 dark:bg-emerald-500/15 dark:text-emerald-200">
                      {photo ? (
                        <Image src={photo} alt={fullName} width={64} height={64} unoptimized className="h-full w-full object-cover" />
                      ) : (
                        initiales
                      )}
                    </div>

                    <div className="min-w-0 flex-1 pt-1">
                      <p className="truncate font-display text-base font-bold text-slate-950 dark:text-white">
                        {fullName}
                      </p>
                      <p className="truncate text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        {personnel.fonction || t(`personnel.layout.poste.${personnel.typePersonnel}`)}
                      </p>

                      {personnel.etablissement && (
                        <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                          <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {personnel.etablissement.nom}
                        </p>
                      )}
                      {personnel.etablissement?.ville && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {personnel.etablissement.ville}
                        </p>
                      )}

                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <Stars note={personnel.noteMoyenne} />
                        {personnel.totalAvis > 0
                          ? `${personnel.noteMoyenne.toFixed(1)} · ${t('personnel.profil.avisCount', { count: personnel.totalAvis })}`
                          : t('personnel.profil.aucunAvis')}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
