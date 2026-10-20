'use client'

import { use, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarClock,
  LoaderCircle,
  MessageSquareText,
  Star,
  Stethoscope,
  UserRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import api from '@/api/axios'
import { useAuth } from '@/hooks/useAuth'
import { resolveImgPath } from '@/lib/config'
import { ReviewAvatar } from '@/components/carte/ReviewMedia'
import { useToast } from '@/components/ui/Toast'

type AvisPersonnelPublic = {
  id: number
  note: number
  commentaire: string | null
  createdAt: string
  auteurNom: string | null
  auteurPhoto: string | null
}

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
  estValide: boolean
  etablissement: {
    id: number
    nom: string
    type: string
    ville: string | null
    logoUrl: string | null
    imageUrl: string | null
  } | null
  avis?: AvisPersonnelPublic[]
  distribution?: Record<string, number>
}

function Stars({ note, size = 'h-4 w-4' }: { note: number; size?: string }) {
  const { t } = useTranslation()
  return (
    <span className="flex gap-0.5" aria-label={t('personnel.profil.noteAria', { note })}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`${size} ${
            value <= Math.round(note) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'
          }`}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

/**
 * Page de profil publique d'un personnel de santé.
 *
 * Format « page de profil professionnelle » : bandeau de couverture, photo
 * de profil en médaillon, identité, poste, établissement, notation par les
 * patients et avis publiés.
 */
export default function PersonnelPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t } = useTranslation()
  const toast = useToast()
  const { user, isAuthenticated } = useAuth()

  const [note, setNote] = useState(0)
  const [commentaire, setCommentaire] = useState('')
  const [sending, setSending] = useState(false)

  const { data, isLoading, error, mutate } = useSWR<PersonnelPublic>(
    `/api/personnels-publics/${id}`,
    async (url: string) => {
      const res = await api.get(url)
      return res.data
    },
    { revalidateOnFocus: false },
  )

  const isPatient = Boolean((user as any)?.type === 'patient' || (user as any)?.roles?.includes?.('ROLE_PATIENT'))

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary-700" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-bold text-slate-900 dark:text-white">{t('personnel.profil.introuvable')}</p>
        <Link href="/carte" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary-700">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('personnel.profil.retourCarte')}
        </Link>
      </div>
    )
  }

  const fullName = `${data.prenom ?? ''} ${data.nom ?? ''}`.replace(/\s+/g, ' ').trim()
  const initiales = `${data.prenom?.[0] ?? ''}${data.nom?.[0] ?? ''}`.toUpperCase() || 'P'
  const cover = data.photoCouverture ? resolveImgPath(data.photoCouverture) : null
  const photo = data.photoProfil ? resolveImgPath(data.photoProfil) : null

  const submitAvis = async (event: React.FormEvent) => {
    event.preventDefault()
    if (note < 1) {
      toast.error(t('personnel.profil.noteObligatoire'))
      return
    }
    setSending(true)
    try {
      await api.post('/api/avis-personnel', {
        personnelId: data.id,
        note,
        commentaire: commentaire.trim(),
      })
      setNote(0)
      setCommentaire('')
      await mutate()
      toast.success(t('personnel.profil.avisPublie'))
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.response?.data?.error || t('personnel.profil.avisEchec'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/carte"
        className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950 dark:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('personnel.profil.retourCarte')}
      </Link>

      {/* ── Couverture + identité ─────────────────────────────────────── */}
      <section className="mt-4 overflow-hidden border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
        <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-primary-800 via-primary-700 to-emerald-700 sm:h-56">
          {cover ? (
            <Image src={cover} alt="" fill unoptimized className="object-cover" />
          ) : (
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 30%, rgba(255,255,255,.45) 0, transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,.35) 0, transparent 45%)',
              }}
            />
          )}
        </div>

        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-wrap items-end gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-emerald-100 text-2xl font-black text-emerald-800 dark:border-slate-900 dark:bg-emerald-500/15 dark:text-emerald-200">
              {photo ? (
                <Image src={photo} alt={fullName} width={96} height={96} unoptimized className="h-full w-full object-cover" />
              ) : (
                initiales
              )}
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words font-display text-2xl font-bold text-slate-950 dark:text-white sm:text-3xl">
                  {fullName}
                </h1>
                {data.estValide && (
                  <span className="inline-flex items-center gap-1.5 bg-mint-100 px-2 py-1 text-[11px] font-bold text-primary-700 dark:bg-[#1DA1F2]/15 dark:text-[#60A5FA]">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('personnel.profil.compteCertifie')}
                  </span>
                )}
              </div>
              <p className="mt-1 font-semibold text-emerald-700 dark:text-emerald-300">
                {data.fonction || t(`personnel.layout.poste.${data.typePersonnel}`)}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Stars note={data.noteMoyenne || 0} size="h-5 w-5" />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {data.totalAvis > 0
                  ? `${data.noteMoyenne.toFixed(1)} · ${t('personnel.profil.avisCount', { count: data.totalAvis })}`
                  : t('personnel.profil.aucunAvis')}
              </span>
            </div>
            {data.numeroOrdre && (
              <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                <Stethoscope className="h-4 w-4" aria-hidden="true" />
                {t('personnel.profil.numeroOrdre', { value: data.numeroOrdre })}
              </span>
            )}
          </div>

          {data.etablissement && (
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5 dark:border-white/10">
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-slate-100 dark:bg-white/5">
                {data.etablissement.logoUrl ? (
                  <Image
                    src={resolveImgPath(data.etablissement.logoUrl) ?? ''}
                    alt=""
                    width={44}
                    height={44}
                    unoptimized
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Building2 className="h-5 w-5 text-slate-500" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {t('personnel.profil.etablissement')}
                </p>
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{data.etablissement.nom}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {[data.etablissement.ville, data.etablissement.type?.replaceAll('_', ' ')].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Notation par les patients ─────────────────────────────────── */}
      <section className="mt-8" aria-labelledby="avis-title">
        <h2 id="avis-title" className="font-display text-xl font-bold text-slate-950 dark:text-white">
          {t('personnel.avisRecus.titre')}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('personnel.avisRecus.sousTitre')}</p>

        {isPatient && (
          <form onSubmit={submitAvis} className="mt-4 border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setNote(value)}
                  aria-label={t('personnel.profil.noteAria', { note: value })}
                  className="p-1"
                >
                  <Star
                    className={`h-7 w-7 ${
                      value <= note ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
            <textarea
              value={commentaire}
              onChange={(event) => setCommentaire(event.target.value)}
              minLength={5}
              maxLength={2000}
              placeholder={t('personnel.profil.commentairePlaceholder')}
              className="mt-3 w-full border border-slate-300 bg-white p-3 text-sm dark:border-white/15 dark:bg-slate-950 dark:text-white"
            />
            <button
              type="submit"
              disabled={sending}
              className="mt-3 inline-flex min-h-11 items-center gap-2 bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />
              {sending ? t('personnel.profil.envoi') : t('personnel.profil.publier')}
            </button>
          </form>
        )}

        <div className="mt-4 space-y-3">
          {(data.avis ?? []).length === 0 ? (
            <p className="border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              {t('personnel.avisRecus.aucun')}
            </p>
          ) : (
            (data.avis ?? []).map((avis) => (
              <article
                key={avis.id}
                className="border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900"
              >
                <div className="flex items-center gap-3">
                  <ReviewAvatar nom={avis.auteurNom ?? 'P'} photo={avis.auteurPhoto} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {avis.auteurNom ?? t('personnel.profil.patientAnonyme')}
                    </p>
                    <Stars note={avis.note} />
                  </div>
                  <time
                    dateTime={avis.createdAt}
                    className="ml-auto shrink-0 text-xs text-slate-400"
                  >
                    {new Date(avis.createdAt).toLocaleDateString('fr-CM', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </time>
                </div>
                {avis.commentaire && (
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{avis.commentaire}</p>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      {!isAuthenticated && (
        <p className="mt-8 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <UserRound className="h-4 w-4" aria-hidden="true" />
          {t('personnel.profil.connectezPourNoter')}
        </p>
      )}
    </div>
  )
}
