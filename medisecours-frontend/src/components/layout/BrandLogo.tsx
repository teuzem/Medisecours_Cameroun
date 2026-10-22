'use client'

import Image from 'next/image'

/**
 * Logotype officiel MediSecours.
 *
 * L'identité visuelle de la plateforme repose sur le logo officiel
 * (fichier image unique, maîtrisé par la marque) : il est rendu ici pour
 * que la navigation, le pied de page et la landing page partagent
 * exactement le même traitement — même image, mêmes dimensions, mêmes
 * proportions, sans duplication.
 */
export default function BrandLogo({
  size = 'md',
  className = '',
  priority = false,
}: {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Priorité de chargement (above-the-fold). */
  priority?: boolean
}) {
  const largeurs = {
    sm: 108,
    md: 132,
    lg: 168,
  } as const

  return (
    <Image
      src="/brand/medisecours-logo.png"
      alt="MediSecours"
      width={853}
      height={299}
      priority={priority}
      className={`h-auto object-contain ${className}`}
      style={{ width: largeurs[size], maxWidth: '100%' }}
    />
  )
}
