'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PenLine, Upload, Eraser, RotateCcw } from 'lucide-react'
import { removeImageBackground } from '../../lib/imageBackground'

type SignaturePadProps = {
  /** Data URI PNG courant (édition ou prévisualisation). */
  value?: string | null
  /** Appelé avec le data URI PNG finalisé (canvas nettoyé, fond transparent). */
  onChange: (dataUri: string) => void
  /** Masque les contrôles (mode aperçu seul). */
  readOnly?: boolean
  className?: string
}

const PAD_W = 560
const PAD_H = 180

/**
 * Pad de signature manuscrite (pointeur/souris/tactile) + import d'image.
 * Exporte un PNG transparent prêt pour les documents administratifs.
 */
export default function SignaturePad({ value, onChange, readOnly = false, className = '' }: SignaturePadProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const lastRef = useRef<{ x: number; y: number } | null>(null)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [processing, setProcessing] = useState(false)

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    onChange('')
  }, [onChange])

  const commit = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !hasDrawn) return
    // Fond transparent natif : le PNG garde l'alpha du canvas.
    onChange(canvas.toDataURL('image/png'))
  }, [hasDrawn, onChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineWidth = 2.6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1E3A5F'

    if (value) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        setHasDrawn(true)
      }
      img.src = value
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pointerPos = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    lastRef.current = pointerPos(event)
  }

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || readOnly) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const point = pointerPos(event)
    const last = lastRef.current ?? point
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastRef.current = point
    if (!hasDrawn) setHasDrawn(true)
  }

  const end = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastRef.current = null
    commit()
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setProcessing(true)
    try {
      const processed = await removeImageBackground(file, { tolerance: 60, maxDimension: 800 })
      onChange(processed)
      setHasDrawn(true)
    } catch {
      // repli : image originale
      const reader = new FileReader()
      reader.onload = () => {
        onChange(String(reader.result))
        setHasDrawn(true)
      }
      reader.readAsDataURL(file)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700">
        {/* Ligne de signature (référence papier) */}
        <div className="pointer-events-none absolute bottom-10 left-6 right-6 border-b border-dashed border-slate-300 dark:border-slate-600" />
        <canvas
          ref={canvasRef}
          width={PAD_W}
          height={PAD_H}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          className={`block w-full touch-none ${readOnly ? '' : 'cursor-crosshair'}`}
          aria-label={t('signature.padAria')}
        />
        {!hasDrawn && !value && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-slate-400">
            <PenLine className="h-3.5 w-3.5" />
            {t('signature.padPlaceholder')}
          </span>
        )}
      </div>

      {!readOnly && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">
            <Upload className="h-3.5 w-3.5" />
            {processing ? t('signature.processing') : t('signature.upload')}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleUpload} disabled={processing} />
          </label>
          <button
            type="button"
            onClick={clear}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('signature.clear')}
          </button>
          {processing && <Eraser className="h-3.5 w-3.5 animate-pulse text-mint-500" />}
        </div>
      )}
    </div>
  )
}
