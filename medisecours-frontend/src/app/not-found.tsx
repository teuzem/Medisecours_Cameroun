'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { HeartCrack, Home } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
        <HeartCrack className="w-20 h-20 text-urgence-500 mx-auto mb-6" />
      </motion.div>
      <h1 className="font-display font-extrabold text-5xl text-primary-900 dark:text-sable mb-2">404</h1>
      <p className="text-lg font-semibold text-primary-700 dark:text-sable mb-1">{t('visitor.notFound.title')}</p>
      <p className="text-primary-300 max-w-sm mb-8">
        {t('visitor.notFound.description')}
      </p>
      <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-mint-500 hover:bg-mint-700 text-white font-semibold shadow-lg transition">
        <Home className="w-5 h-5" /> {t('visitor.notFound.backHome')}
      </Link>
    </div>
  )
}
