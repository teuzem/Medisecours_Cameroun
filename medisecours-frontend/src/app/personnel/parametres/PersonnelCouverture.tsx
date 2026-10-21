'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ExternalLink, ImageUp, Loader2, Trash2 } from 'lucide-react'

import api from '../../../api/axios'
import { useAuth } from '../../../hooks/useAuth'
import { resolveImgPath } from '../../../lib/config'
import { useToast } from '../../../components/ui/Toast'
import GlassCard from '../../../components/ui/GlassCard'
import SectionHeader from '../../../components/ui/SectionHeader'

/**
 * Photo de couverture du profil public du personnel (page de profil
 * professionnelle).
 *
 * Le fond est retiré automatiquement comme pour les cachets : une couverture
 * nette, sans halo, qui s'intègre à l'interface.
 */
export default function PersonnelCouverture() {
  const { t } = useTranslation()
  const toast = useToast()
  const { user, updateUser } = useAuth()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)

  const couverture = (user as any)?.photoCouverture as string | undefined
  const url = couverture ? resolveImgPath(couverture) : null

  const upload = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error(t('personnel.dashboard.couvertureFormat'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('personnel.dashboard.couvertureTaille'))
      return
    }

    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post('/api/profile/couverture', form)
      updateUser({ ...user, photoCouverture: data.photoCouverture })
      toast.success(t('personnel.dashboard.couvertureEnregistree'))
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t('personnel.dashboard.couvertureEchec'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <GlassCard className="p-5">
      <SectionHeader title={t('personnel.dashboard.couverture')} description={t('personnel.dashboard.couvertureAide')} />

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="relative h-28 w-full max-w-md overflow-hidden rounded-xl bg-gradient-to-br from-primary-800 via-primary-700 to-emerald-700">
          {url ? (
            <Image src={url} alt="" fill unoptimized className="object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs font-bold uppercase tracking-wide text-white/70">
              {t('personnel.dashboard.couvertureVide')}
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-black/40">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void upload(file)
              event.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--accent,#1E3A5F)] px-4 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            <ImageUp className="h-4 w-4" aria-hidden="true" />
            {t('personnel.dashboard.modifierCouverture')}
          </button>

          {url && (
            <Link
              href={`/personnel/${(user as any)?.id ?? ''}`}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t('personnel.dashboard.voirMonProfil')}
            </Link>
          )}

          {url && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  // Suppression réelle : le média est retiré côté serveur,
                  // sinon la couverture réapparaît au rechargement.
                  await api.delete('/api/profile/couverture')
                  updateUser({ ...user, photoCouverture: null })
                  toast.success(t('personnel.dashboard.couvertureSupprimee'))
                } catch (error: any) {
                  toast.error(error?.response?.data?.error || t('personnel.dashboard.couvertureEchec'))
                } finally {
                  setBusy(false)
                }
              }}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 text-xs font-bold text-red-700 transition hover:bg-red-50 dark:border-red-500/25 dark:text-red-200"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t('personnel.dashboard.supprimerCouverture')}
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-white/5 dark:text-slate-300">
        {t('personnel.dashboard.profilPublieAvertissement')}
      </p>
    </GlassCard>
  )
}
