'use client'

import { useEffect } from 'react'

export default function ThemeInit() {
  useEffect(() => {
    try {
      const theme = localStorage.getItem('medisecours_theme')
      document.documentElement.classList.toggle('dark', theme === 'dark')
    } catch {}
  }, [])

  return null
}
