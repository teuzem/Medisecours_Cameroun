'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Building2,
  ClipboardCheck,
  FileCheck,
  Lock,
  MapPin,
  MessageSquare,
  ShieldAlert,
  Siren,
  Stethoscope,
  User,
  UserCheck,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import api from '../api/axios'
import { extractArray } from '../lib/api'
import { imgUrl } from '../lib/config'
import { removeImageBackground } from '../lib/imageBackground'
import type { CarteCentre } from '../lib/carte'
import { emergencyCallHref, EMERGENCY_NUMBER } from '@/config/firstAid'

/**
 * Accueil MediSecours.
 *
 * Composition éditoriale inspirée des produits financiers modernes (hero
 * éditorial, maquette produit, mur de logos, sections courtes), mais
 * encodée dans la charte de la plateforme : palette navy / mint / sable et
 * logo officiel. Toutes les données affichées (établissements, compteurs)
 * sont charges en direct depuis l'API.
 */

const SOLUTION_ITEMS = [
  { key: 'sos', icon: Siren },
  { key: 'carte', icon: MapPin },
  { key: 'premiersSoins', icon: ShieldAlert },
  { key: 'maladies', icon: BookOpen },
  { key: 'medecins', icon: Stethoscope },
  { key: 'messagerie', icon: MessageSquare },
  { key: 'etablissement', icon: Building2 },
  { key: 'personnel', icon: ClipboardCheck },
] as const

const ROLE_ITEMS = [
  { key: 'patient', icon: User, href: '/register' },
  { key: 'medecin', icon: Stethoscope, href: '/register' },
  { key: 'personnel', icon: ClipboardCheck, href: '/personnel' },
  { key: 'etablissement', icon: Building2, href: '/espace-etablissement' },
] as const

const TRUST_ITEMS = [
  { key: 'signatures', icon: FileCheck },
  { key: 'validation', icon: UserCheck },
  { key: 'confidentialite', icon: Lock },
  { key: 'reference', icon: BookOpen },
] as const

const PARCOURS = [
  { key: 'accueil', icon: User },
  { key: 'dossier', icon: ClipboardCheck },
  { key: 'consultation', icon: Stethoscope },
  { key: 'soins', icon: BadgeCheck },
  { key: 'pharmacie', icon: FileCheck },
] as const

/**
 * Logo d'établissement déturé : le fond blanc du logo disparaît (traitement
 * d'image côté client). Sans cela, un logo sur fond blanc dessine un
 * rectangle visible au survol — l'effet « noir sur blanc » que le logo
 * officiel d'un établissement ne doit jamais montrer.
 */
function useLogoTransparent(logoUrl: string | null | undefined) {
  // La source détourée est mémorisée par URL : quand le logo change, la
  // nouvelle source est simply ignorée tant que son détourage n'est pas
  // terminé (pas de setState synchrone dans un effet).
  const [detournes, setDetournes] = useState<Record<string, string>>({})

  useEffect(() => {
    let annule = false
    if (!logoUrl) return

    // Seules les images same-origin peuvent être pixelisées (pas de CORS).
    if (!logoUrl.startsWith('/')) return
    if (detournes[logoUrl]) return

    removeImageBackground(logoUrl, { tolerance: 42, maxDimension: 512 })
      .then((dataUri) => {
        if (!annule) setDetournes((actuels) => ({ ...actuels, [logoUrl]: dataUri }))
      })
      .catch(() => undefined)

    return () => {
      annule = true
    }
  }, [logoUrl, detournes])

  return logoUrl ? detournes[logoUrl] ?? null : null
}

function LogoEtablissement({ centre }: { centre: CarteCentre }) {
  const brut = centre.logoUrl ?? null
  const transparent = useLogoTransparent(brut)
  const source = transparent ?? imgUrl(brut) ?? ''

  return (
    <Link
      href={`/carte?centre=${centre.id}`}
      className="ms-logo"
      title={centre.nom}
      aria-label={centre.nom}
    >
      {source ? (
        <img
          src={source}
          alt={centre.nom}
          loading="lazy"
          className={transparent ? 'ms-logo--transparent' : undefined}
        />
      ) : (
        <span className="px-2 text-center font-display text-sm font-bold text-[var(--color-ms-600)]">
          {centre.nom.slice(0, 22)}
        </span>
      )}
    </Link>
  )
}

export default function LandingPage() {
  const { t } = useTranslation()
  const [centres, setCentres] = useState<CarteCentre[]>([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    let annule = false
    api
      .get('/api/carte/etablissements', { params: { limit: 12 } })
      .then((response) => {
        if (annule) return
        const items = extractArray(response.data) as CarteCentre[]
        setCentres(items.filter((centre) => centre.logoUrl || centre.nom))
      })
      .catch(() => undefined)
      .finally(() => {
        if (!annule) setChargement(false)
      })
    return () => {
      annule = true
    }
  }, [])

  const partenaires = useMemo(() => centres.slice(0, 12), [centres])

  return (
    <div className="ms-page">
      <h1 className="sr-only">{t('visitor.landing.ariaLabel')}</h1>

      {/* ═══ Hero ═══════════════════════════════════════════════════════ */}
      <section className="ms-mesh relative overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div className="min-w-0">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-[var(--color-ms-600)] shadow-[var(--shadow-ms-sm)] backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-mint-500)]" />
              {t('visitor.landing.hero.badge')}
            </p>

            <h2 className="ms-display text-[2.6rem] leading-[1.03] sm:text-[3.4rem] lg:text-[3.9rem]">
              {t('visitor.landing.hero.title')}
            </h2>

            <p className="ms-lede mt-6 max-w-xl">
              {t('visitor.landing.hero.subtitle')}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register" className="ms-btn ms-btn--primary">
                {t('visitor.landing.hero.primaryCta')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/carte" className="ms-btn ms-btn--ghost">
                {t('visitor.landing.hero.secondaryCta')}
              </Link>
            </div>

            <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--color-ms-500)]">
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-[var(--color-mint-600)]" aria-hidden="true" />
                {t('visitor.landing.hero.point1')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-[var(--color-mint-600)]" aria-hidden="true" />
                {t('visitor.landing.hero.point2')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-[var(--color-mint-600)]" aria-hidden="true" />
                {t('visitor.landing.hero.point3')}
              </span>
            </p>
          </div>

          {/* Maquette produit : la plateforme en action. */}
          <div className="min-w-0">
            <div className="ms-code">
              <div className="ms-code__bar">
                <span className="ms-code__dot bg-[#ff5f57]" />
                <span className="ms-code__dot bg-[#febc2e]" />
                <span className="ms-code__dot bg-[#28c840]" />
                <span className="ml-2 text-[11px] text-white/40">medisecours.app/dossier</span>
              </div>
              <div className="p-5 sm:p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/40">
                  {t('visitor.landing.hero.mock.label')}
                </p>
                <p className="mt-2 text-lg font-bold text-white">
                  {t('visitor.landing.hero.mock.title')}
                </p>
                <div className="mt-4 space-y-2.5">
                  {[
                    { k: 'accueil', tone: 'bg-[#10B981]' },
                    { k: 'consultation', tone: 'bg-[#4C5FD5]' },
                    { k: 'soins', tone: 'bg-[#1E3A5F]' },
                    { k: 'pharmacie', tone: 'bg-[#0EA274]' },
                  ].map((ligne) => (
                    <div key={ligne.k} className="flex items-center gap-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${ligne.tone}`} />
                      <span className="text-white/75">{t(`visitor.landing.hero.mock.steps.${ligne.k}`)}</span>
                      <span className="ml-auto h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                        <span className="block h-full w-3/4 rounded-full bg-white/35" />
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-white/50">
                  <span>{t('visitor.landing.hero.mock.signed')}</span>
                  <span className="rounded bg-white/10 px-2 py-1">{t('visitor.landing.hero.mock.sealed')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Urgence ════════════════════════════════════════════════════ */}
      <section className="bg-[var(--color-urgence-500)] text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <p className="flex items-center gap-2.5 text-sm font-bold">
            <Siren className="h-5 w-5" aria-hidden="true" />
            {t('visitor.landing.emergency.title')}
          </p>
          <a
            href={emergencyCallHref()}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-4 text-sm font-bold text-[var(--color-urgence-600)] transition hover:bg-white/90"
          >
            {EMERGENCY_NUMBER}
          </a>
        </div>
      </section>

      {/* ═══ Les 4 postes ═══════════════════════════════════════════════ */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6" id="postes">
        <p className="text-sm font-bold text-[var(--color-ms-500)]">{t('visitor.landing.roles.eyebrow')}</p>
        <h2 className="ms-display mt-3 max-w-2xl text-3xl sm:text-4xl">{t('visitor.landing.roles.title')}</h2>
        <p className="ms-lede mt-4 max-w-2xl">{t('visitor.landing.roles.subtitle')}</p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ROLE_ITEMS.map((role) => (
            <Link key={role.key} href={role.href} className="ms-card ms-card--hover group p-6">
              <span className="grid h-11 w-11 place-items-center rounded-[var(--radius-ms-md)] bg-[var(--color-ms-100)] text-[var(--color-ms-600)] transition group-hover:bg-[var(--color-ms-500)] group-hover:text-white">
                <role.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold text-[var(--color-ms-800)]">
                {t(`visitor.landing.roles.items.${role.key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-ms-500)]">
                {t(`visitor.landing.roles.items.${role.key}.description`)}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-ms-600)]">
                {t('visitor.landing.roles.discover')}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══ Une chaîne, pas des silos ═════════════════════════════════ */}
      <section className="bg-[var(--color-sable)] py-20" id="parcours">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <h2 className="ms-display max-w-2xl text-3xl sm:text-4xl">{t('visitor.landing.journey.title')}</h2>
          <p className="ms-lede mt-4 max-w-2xl">{t('visitor.landing.journey.subtitle')}</p>

          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {PARCOURS.map((etape, index) => (
              <li key={etape.key} className="relative">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-ms-500)] text-xs font-black text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-display text-base font-bold text-[var(--color-ms-800)]">
                  {t(`visitor.landing.journey.steps.${etape.key}.title`)}
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-[var(--color-ms-500)]">
                  {t(`visitor.landing.journey.steps.${etape.key}.description`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══ Établissements qui nous font confiance ═════════════════════ */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6" id="confiance">
        <h2 className="ms-display max-w-2xl text-3xl sm:text-4xl">{t('visitor.landing.partners.title')}</h2>
        <p className="ms-lede mt-4 max-w-2xl">{t('visitor.landing.partners.subtitle')}</p>

        {chargement ? (
          <div className="ms-logo-wall mt-10">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="ms-logo animate-pulse bg-[var(--color-ms-100)]" />
            ))}
          </div>
        ) : partenaires.length === 0 ? (
          <p className="mt-10 rounded-xl border border-dashed border-[var(--color-ms-200)] p-8 text-center text-sm text-[var(--color-ms-500)]">
            {t('visitor.landing.partners.empty')}
          </p>
        ) : (
          <div className="ms-logo-wall mt-10">
            {partenaires.map((centre) => (
              <LogoEtablissement key={centre.id} centre={centre} />
            ))}
          </div>
        )}

        <Link
          href="/centres"
          className="ms-btn ms-btn--ghost mt-8"
        >
          {t('visitor.landing.partners.seeAll')}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      {/* ═══ La solution en détail ═════════════════════════════════════ */}
      <section className="bg-[var(--color-ms-900)] py-20 text-white">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <h2 className="ms-display max-w-2xl text-3xl sm:text-4xl !text-white">
            {t('visitor.landing.solution.title')}
          </h2>
          <p className="ms-lede mt-4 max-w-2xl !text-white/60">{t('visitor.landing.solution.subtitle')}</p>

          <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {SOLUTION_ITEMS.map((item) => (
              <div key={item.key}>
                <item.icon className="h-6 w-6 text-[var(--color-mint-400)]" aria-hidden="true" />
                <h3 className="mt-3 font-display text-base font-bold">
                  {t(`visitor.landing.solution.items.${item.key}.title`)}
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-white/60">
                  {t(`visitor.landing.solution.items.${item.key}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Confiance / preuves ════════════════════════════════════════ */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <h2 className="ms-display text-3xl sm:text-4xl">{t('visitor.landing.trust.title')}</h2>
            <p className="ms-lede mt-4">{t('visitor.landing.trust.subtitle')}</p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {TRUST_ITEMS.map((item) => (
                <div key={item.key} className="flex gap-3">
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-mint-600)]" aria-hidden="true" />
                  <div>
                    <h3 className="font-display text-sm font-bold text-[var(--color-ms-800)]">
                      {t(`visitor.landing.trust.items.${item.key}.title`)}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--color-ms-500)]">
                      {t(`visitor.landing.trust.items.${item.key}.description`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ms-card overflow-hidden">
            <Image
              src="/images/landing/soins-kangourou.jpg"
              alt={t('visitor.landing.trust.imageAlt')}
              width={1200}
              height={800}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* ═══ Clôture ════════════════════════════════════════════════════ */}
      <section className="ms-mesh ms-mesh--dark bg-[var(--color-ms-900)] py-20 text-white">
        <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
          <h2 className="ms-display text-3xl sm:text-4xl !text-white">{t('visitor.landing.closing.title')}</h2>
          <p className="ms-lede mx-auto mt-4 max-w-2xl !text-white/65">
            {t('visitor.landing.closing.subtitle')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register" className="ms-btn ms-btn--primary">
              {t('visitor.landing.closing.primaryCta')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/espace-etablissement"
              className="ms-btn border border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              {t('visitor.landing.closing.secondaryCta')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
