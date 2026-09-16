'use client'

import { type ReactNode, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'

const VARIANTS: Record<string, string> = {
  primary: 'bg-mint-500 hover:bg-mint-700 text-white',
  secondary: 'bg-white dark:bg-primary-800 border border-primary-100 dark:border-white/5 text-primary-700 dark:text-sable hover:bg-primary-50 dark:hover:bg-primary-700',
  danger: 'bg-urgence-500 hover:bg-urgence-700 text-white',
  'danger-outline': 'bg-white dark:bg-primary-800 border border-urgence-200 dark:border-urgence-500/30 text-urgence-700 hover:bg-urgence-50 dark:hover:bg-urgence-500/10',
}

const SIZES: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  ...props
}: {
  children: ReactNode
  variant?: string
  size?: string
  isLoading?: boolean
  disabled?: boolean
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const isDisabled = disabled || isLoading

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all
        ${VARIANTS[variant]}
        ${SIZES[size]}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}
