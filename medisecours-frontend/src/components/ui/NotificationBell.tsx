// @ts-nocheck
'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Bell } from 'lucide-react'
import Link from 'next/link'

const spring = { type: 'spring', stiffness: 400, damping: 12, mass: 0.8 }

export default function NotificationBell({ count = 0, href, className = '', badgeColor = '#ef4444', dotColor = '#59c56c', icon: Icon = Bell }) {
  return (
    <Link
      href={href || '#'}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full border border-[#dfe5db] bg-white/80 text-[#445244] backdrop-blur-lg transition-all hover:bg-[#edf2ea] active:scale-95 ${className}`}
      aria-label="Notifications"
      style={{ transition: 'transform 0.1s ease-out, background 0.2s ease-out' }}
    >
      <Icon className="h-4 w-4" />
      <AnimatePresence mode="popLayout">
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={spring}
            className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full px-1 text-center text-[10px] font-bold leading-[18px] text-white shadow-lg"
            style={{ backgroundColor: badgeColor, boxShadow: `0 2px 8px ${badgeColor}40` }}
          >
            {count > 99 ? '99+' : count}
          </motion.span>
        )}
      </AnimatePresence>
      {count === 0 && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-white" style={{ backgroundColor: dotColor }} />
      )}
    </Link>
  )
}
