'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

/**
 * Coque des pages légales (mentions légales, confidentialité, conditions).
 *
 * Sommaire ancré à gauche, contenu à droite, mise en page lisible sur
 * téléphone comme sur grand écran. Le contenu vient de l'i18n : aucune
 * chaîne en dur.
 */
export default function LegalPage({
  slug,
  sections,
  updatedAt,
}: {
  /** Identifiant de la page dans l'i18n : visitor.legal.<slug>. */
  slug: string
  /** Sommaire affiché : identifiants de section et titres traduits. */
  sections: Array<{ id: string; label: string }>
  /** Date de dernière révision (chaîne traduite). */
  updatedAt: string
}) {
  const { t } = useTranslation()

  const sommaire = useMemo(
    () => sections.map((section) => ({ ...section, label: t(section.label) })),
    [sections, t],
  )

  return (
    <div className="ms-page">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[var(--color-ms-600)] hover:text-[var(--color-ms-800)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('visitor.legal.back')}
        </Link>

        <header className="mt-6 max-w-3xl">
          <h1 className="ms-display text-3xl sm:text-4xl">{t(`visitor.legal.${slug}.title`)}</h1>
          <p className="ms-lede mt-4">{t(`visitor.legal.${slug}.intro`)}</p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--color-ms-100)] px-3 py-1.5 text-xs font-bold text-[var(--color-ms-600)]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {updatedAt}
          </p>
        </header>

        <div className="mt-12 grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav aria-label={t('visitor.legal.summary')} className="lg:sticky lg:top-28 lg:self-start">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-[var(--color-ms-400)]">
              {t('visitor.legal.summary')}
            </p>
            <ul className="space-y-2">
              {sommaire.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block rounded-md px-3 py-1.5 text-sm font-semibold text-[var(--color-ms-500)] transition hover:bg-white hover:text-[var(--color-ms-800)]"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <article className="min-w-0 space-y-10">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-28">
                <h2 className="font-display text-xl font-bold text-[var(--color-ms-800)]">
                  {t(section.label)}
                </h2>
                <div className="mt-3 space-y-4 text-[15px] leading-7 text-[var(--color-ms-500)]">
                  {(t(`visitor.legal.${slug}.sections.${section.id}`) as unknown as string[]).map(
                    (paragraphe, index) => (
                      <p key={index}>{paragraphe}</p>
                    ),
                  )}
                </div>
              </section>
            ))}
          </article>
        </div>
      </div>
    </div>
  )
}
