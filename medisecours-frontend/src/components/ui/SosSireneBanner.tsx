'use client'

import { BellRing, Siren, VolumeX, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface SosSireneBannerProps {
  alerte: {
    id?: number
    type?: string
    statut?: string
    sireneActive?: boolean
    description?: string | null
    nom?: string | null
    verifiePar?: string | null
    prisEnChargePar?: string | null
  } | null
  sireneActivee: boolean
  couperSirene: () => void
  dismiss: () => void
}

/**
 * Bannière globale d'alerte SOS — rendue par NotificationContext.
 *  - sirène active (urgence confirmée) → bandeau rouge plein écran sonore ;
 *  - simple création → bandeau ambre discret avec bip sonore unique.
 * Réservée aux postes de l'établissement : le routage WebSocket n'envoie
 * ces événements qu'à l'équipe ciblée.
 */
export default function SosSireneBanner({ alerte, sireneActivee, couperSirene, dismiss }: SosSireneBannerProps) {
  const { t } = useTranslation()

  if (!sireneActivee && !alerte) return null

  const enSirene = sireneActivee
  const titre = enSirene ? t('sos.banniereSirene') : t('sos.banniereNouvelle')
  const desc = enSirene
    ? alerte?.description || t('sos.banniereSireneDesc')
    : alerte?.description || t('sos.banniereNouvelleDesc')

  const fermer = () => {
    couperSirene()
    dismiss()
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed inset-x-0 top-0 z-[3000] shadow-2xl ${
        enSirene
          ? 'bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white'
          : 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 ${enSirene ? 'animate-pulse' : ''}`}
        >
          {enSirene ? <Siren className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black uppercase tracking-[0.12em]">{titre}</p>
          <p className="truncate text-xs font-medium text-white/85">{desc}</p>
        </div>
        {enSirene && (
          <button
            type="button"
            onClick={couperSirene}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50"
          >
            <VolumeX className="h-3.5 w-3.5" />
            {t('sos.couperSon')}
          </button>
        )}
        <button
          type="button"
          onClick={fermer}
          aria-label={t('sos.fermerBanniere')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
