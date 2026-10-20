'use client'

import { useState } from 'react'

import { imgSrcCandidates, pickPhotoSrc } from '../lib/config'

/**
 * Source d'image avec repli progressif : même origine via le proxy Next
 * (toujours joignable), puis l'URL API directe. Les initiales ne s'affichent
 * que lorsqu'aucune URL de photo n'est disponible ou que chaque tentative a
 * échoué — jamais quand une photo est réellement disponible.
 */
export function usePhotoSrc(photo?: string | null) {
  const candidates = imgSrcCandidates(photo)
  const [failed, setFailed] = useState<string[]>([])
  const src = pickPhotoSrc(candidates, failed)

  const onError = () => {
    if (!src) return
    setFailed((current) =>
      current.includes(src) ? current : [...current, src],
    )
    // Trace exploitable dans la console du navigateur : donne l'URL exacte
    // qui n'a pas pu être chargée (404, 403, CORS, contenu mixed).
    console.warn('[avatar] image non chargée :', src)
  }

  return { src, onError, hasPhoto: candidates.length > 0 }
}
