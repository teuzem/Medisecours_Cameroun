'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Loader2, HeartPulse } from 'lucide-react'
import api from '../../api/axios'
import { useAuth } from '../../hooks/useAuth'
import { useTranslation } from 'react-i18next'

/**
 * Page de vérification d'email.
 * Appelée via le lien reçu par email :
 *   http://localhost:3000/verify-email?token=xxxxx
 */
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <VerifyEmailContent />
    </Suspense>
  )
}

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t } = useTranslation()
  const { updateUser, user } = useAuth()
  const token = searchParams.get('token')

  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) return   // status reste 'loading' — on gère via render

    api.get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (res.data?.user) {
          updateUser({ ...user, ...res.data.user, emailVerified: true })
        }
        setStatus('success')
        setMessage(t('visitor.verifyEmail.successMessage'))
        setTimeout(() => router.push('/'), 3000)
      })
      .catch((err: any) => {
        if (err.response?.status === 404) {
          setMessage(t('visitor.verifyEmail.invalidToken'))
        } else {
          setMessage(t('visitor.verifyEmail.genericError'))
        }
        setStatus('error')
      })
  }, [token, router, updateUser, t]) // eslint-disable-line react-hooks/exhaustive-deps

  // Token absent — afficher l'erreur directement au rendu sans setState
  if (!token && status === 'loading') {
    return (
      <StatusCard>
        <XCircle className="w-14 h-14 text-urgence-500 mx-auto mb-4" />
        <h1 className="font-display font-bold text-2xl text-primary-900 dark:text-sable mb-2">{t('visitor.verifyEmail.invalidTitle')}</h1>
        <p className="text-primary-400 mb-6">{t('visitor.verifyEmail.missingToken')}</p>
        <Link href="/login" className="inline-block px-6 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-700 text-white font-semibold text-sm transition">
          {t('visitor.verifyEmail.login')}
        </Link>
      </StatusCard>
    )
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-12 bg-linear-to-br from-sable to-primary-50 dark:from-primary-900 dark:to-primary-700">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/80 dark:bg-primary-700/50 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-2xl shadow-glass p-8 text-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-primary-500 flex items-center justify-center mx-auto mb-6">
          <HeartPulse className="w-6 h-6 text-white" />
        </div>

        {status === 'loading' && <LoadingState />}

        {status === 'success' && (
          <>
            <CheckCircle className="w-14 h-14 text-mint-500 mx-auto mb-4" />
            <h1 className="font-display font-bold text-2xl text-primary-900 dark:text-sable mb-2">{t('visitor.verifyEmail.successTitle')}</h1>
            <p className="text-primary-400 mb-6">{message}</p>
            <p className="text-sm text-primary-300 mb-4">{t('visitor.verifyEmail.redirecting')}</p>
            <Link href="/" className="inline-block px-6 py-2.5 rounded-xl bg-mint-500 hover:bg-mint-700 text-white font-semibold text-sm transition">
              {t('visitor.verifyEmail.goHome')}
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-14 h-14 text-urgence-500 mx-auto mb-4" />
            <h1 className="font-display font-bold text-2xl text-primary-900 dark:text-sable mb-2">{t('visitor.verifyEmail.invalidTitle')}</h1>
            <p className="text-primary-400 mb-6">{message}</p>
            <div className="flex flex-col gap-2">
              <Link href="/login" className="inline-block px-6 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-700 text-white font-semibold text-sm transition">
                {t('visitor.verifyEmail.login')}
              </Link>
              <Link href="/" className="inline-block px-6 py-2 rounded-xl text-primary-400 hover:text-primary-700 text-sm">
                {t('visitor.verifyEmail.backHome')}
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}

function StatusCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-12 bg-linear-to-br from-sable to-primary-50 dark:from-primary-900 dark:to-primary-700">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/80 dark:bg-primary-700/50 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-2xl shadow-glass p-8 text-center"
      >
        {children}
      </motion.div>
    </div>
  )
}

function LoadingState() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-10 h-10 text-mint-500 animate-spin" />
      <p className="text-primary-400">{t('visitor.verifyEmail.loading')}</p>
    </div>
  )
}
