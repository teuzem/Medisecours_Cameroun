'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { renderIcon, getIconNameForCategory } from '../../lib/iconMapping'

const iconStyles: Record<string, string> = {
  'heart': 'bg-rose-600',
  'heart-pulse': 'bg-rose-600',
  'air-vent': 'bg-sky-600',
  'brain': 'bg-violet-600',
  'bone': 'bg-amber-600',
  'utensils-crossed': 'bg-amber-600',
  'eye': 'bg-emerald-600',
  'ear': 'bg-pink-600',
  'scan-face': 'bg-indigo-600',
  'bug': 'bg-lime-600',
  'baby': 'bg-cyan-600',
  'ribbon': 'bg-rose-600',
  'ambulance': 'bg-red-600',
  'bandage': 'bg-orange-600',
  'stethoscope': 'bg-emerald-600',
  'flame': 'bg-orange-600',
  'sparkles': 'bg-yellow-600',
  'shield': 'bg-slate-600',
  'droplet': 'bg-blue-600',
}

const defaultStyle = 'bg-emerald-600'

export function CategoryIcon({ iconName, categoryName = '', size = 'md', className = '' }: {
  iconName?: string
  categoryName?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const resolved = useMemo(() => {
    return iconName || getIconNameForCategory(categoryName)
  }, [iconName, categoryName])

  const bg = iconStyles[resolved] || defaultStyle

  const sizes: Record<string, string> = { sm: 'w-8 h-8', md: 'w-11 h-11', lg: 'w-14 h-14' }
  const iconSizes: Record<string, number> = { sm: 20, md: 26, lg: 32 }

  const iconEl = useMemo(() => renderIcon(resolved, { width: iconSizes[size] || iconSizes.md, height: iconSizes[size] || iconSizes.md, color: 'white' }), [resolved, size])

  return (
    <motion.span
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-xl text-white ${sizes[size] || sizes.md} ${bg} ${className}`}
      whileHover={{
        scale: 1.15,
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        transition: { type: 'spring', stiffness: 350, damping: 12 },
      }}
      whileTap={{ scale: 0.92 }}
    >
      {iconEl}
    </motion.span>
  )
}
