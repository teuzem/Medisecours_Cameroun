'use client'

import { useState } from 'react'

const COLORS = ['bg-primary-500', 'bg-mint-500', 'bg-purple-500', 'bg-orange-400', 'bg-pink-500']

export default function Avatar({ name, size = 'md', src }: {
  name?: string
  size?: 'sm' | 'md' | 'lg'
  src?: string | null
}) {
  const [imgError, setImgError] = useState(false)
  const initials = name?.split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  const colorIndex = name ? name.charCodeAt(0) % COLORS.length : 0
  const sizeClasses: Record<string, string> = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
  }
  const baseClass = `${sizeClasses[size]} rounded-full shrink-0`

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name || ''}
        onError={() => setImgError(true)}
        className={`${baseClass} object-cover ring-2 ring-white shadow-sm`}
      />
    )
  }

  return (
    <div className={`${COLORS[colorIndex]} ${baseClass} flex items-center justify-center text-white font-bold`}>
      {initials}
    </div>
  )
}
