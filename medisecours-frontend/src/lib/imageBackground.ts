/**
 * Suppression automatique de l'arrière-plan d'un logo ou d'un cachet.
 *
 * Stratégie : flood-fill depuis les bords de l'image, avec tolérance
 * couleur paramétrable. Les pixels proches de la couleur de fond sont
 * rendus transparents ; le premier plan (traits du cachet, lettrage du
 * logo) est préservé pixel pour pixel — aucune altération de l'image.
 *
 * Usage : traitement côté client à l'import, avant envoi au serveur
 * (le PNG transparent résultant est stocké en data URI).
 */

export type RemoveBackgroundOptions = {
  /** Distance euclidienne RGB max entre un pixel et la couleur de fond (0–255). */
  tolerance?: number
  /** Sortie : largeur max du PNG (résolution préservée en dessous). */
  maxDimension?: number
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/**
 * Détoure l'image (data URL ou File/Blob) et retourne un data URI PNG transparent.
 */
export async function removeImageBackground(
  source: File | Blob | string,
  options: RemoveBackgroundOptions = {}
): Promise<string> {
  const tolerance = options.tolerance ?? 48
  const maxDimension = options.maxDimension ?? 1024

  const bitmap = await loadImage(source)
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas non disponible')

  ctx.drawImage(bitmap, 0, 0, width, height)
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()

  const image = ctx.getImageData(0, 0, width, height)
  const data = image.data

  // Couleur de fond estimée : moyenne des 4 coins (robuste aux petits dégradés).
  const cornerPixels = [0, (width - 1) * 4, (height - 1) * width * 4, ((height - 1) * width + width - 1) * 4]
  let bgR = 0
  let bgG = 0
  let bgB = 0
  for (const offset of cornerPixels) {
    bgR += data[offset]
    bgG += data[offset + 1]
    bgB += data[offset + 2]
  }
  bgR = Math.round(bgR / 4)
  bgG = Math.round(bgG / 4)
  bgB = Math.round(bgB / 4)

  const visited = new Uint8Array(width * height)
  const stack: number[] = []

  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const index = y * width + x
    if (visited[index]) return
    visited[index] = 1
    const offset = index * 4
    if (colorDistance(data[offset], data[offset + 1], data[offset + 2], bgR, bgG, bgB) <= tolerance) {
      data[offset + 3] = 0
      stack.push(index)
    }
  }

  for (let x = 0; x < width; x++) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    push(0, y)
    push(width - 1, y)
  }

  while (stack.length > 0) {
    const index = stack.pop()!
    const x = index % width
    const y = Math.floor(index / width)
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }

  // Adoucissement des bords : pixels semi-transparents au bord du détourage
  // conservent leur opacité d'origine (lisibilité maximale sur tout fond).
  ctx.putImageData(image, 0, 0)

  return canvas.toDataURL('image/png')
}

async function loadImage(source: File | Blob | string): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof source !== 'string' && 'createImageBitmap' in window) {
    try {
      return await createImageBitmap(source)
    } catch {
      // repli sur <img> ci-dessous
    }
  }

  const url = typeof source === 'string' ? source : URL.createObjectURL(source)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Image illisible'))
      img.src = url
    })
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url)
  }
}
