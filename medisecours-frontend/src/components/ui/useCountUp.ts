'use client'

import { useEffect, useRef, useState } from 'react'

/** Animate a number from its previous value to `target` (respects reduced motion). */
export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || Number.isNaN(target)) {
      fromRef.current = target
      const id = requestAnimationFrame(() => setValue(target))
      return () => cancelAnimationFrame(id)
    }

    const from = Number.isNaN(fromRef.current) ? 0 : fromRef.current
    const start = performance.now()
    let raf = 0

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(from + (target - from) * eased)
      if (progress < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = target
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      fromRef.current = target
    }
  }, [target, duration])

  return value
}