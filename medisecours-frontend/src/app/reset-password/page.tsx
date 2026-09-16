// @ts-nocheck
'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { HeartPulse, Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import api from '../../api/axios'
import { useTranslation } from 'react-i18next'

/**
 * Page de réinitialisation de mot de passe.
 * Appelée via le lien reçu par email :
 *   http://localhost:3000/reset-password?token=xxxxx
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}

// Regex identique à la validation backend — force le même standard
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t } = useTranslation()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('form') // 'form' | 'success' | 'expired'

  const validate = () => {
    const e = {}
    if (!PASSWORD_REGEX.test(password)) {
      e.password = t('visitor.resetPassword.pwCriteriaError')
    }
    if (password !== confirm) {
      e.confirm = t('visitor.resetPassword.pwMismatch')
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    if (!token) {
      setErrors({ general: t('visitor.resetPassword.missingToken') })
      return
    }

    setLoading(true)
    try {
      await api.post('/api/auth/reset-password', { token, password })
      setStatus('success')
      setTimeout(() => router.push('/login'), 4000)
    } catch (err) {
      const status = err.response?.status
      if (status === 404) {
        setErrors({ general: t('visitor.resetPassword.invalidToken') })
      } else if (status === 410) {
        setStatus('expired')
      } else if (status === 422) {
        setErrors({ password: t('visitor.resetPassword.pwSecurityError') })
      } else {
        setErrors({ general: t('visitor.resetPassword.genericError') })
      }
    } finally {
      setLoading(false)
    }
  }

  if (status === 'success') {
    return <StatusScreen
      icon={<CheckCircle className="w-14 h-14 text-mint-500 mx-auto mb-4" />}
      title={t('visitor.resetPassword.successTitle')}
      message={t('visitor.resetPassword.successMessage')}
      action={<Link href="/login" className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-mint-500 hover:bg-mint-700 text-white font-semibold text-sm">{t('visitor.resetPassword.login')}</Link>}
    />
  }

  if (status === 'expired') {
    return <StatusScreen
      icon={<XCircle className="w-14 h-14 text-urgence-500 mx-auto mb-4" />}
      title={t('visitor.resetPassword.expiredTitle')}
      message={t('visitor.resetPassword.expiredMessage')}
      action={<Link href="/forgot-password" className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-700 text-white font-semibold text-sm">{t('visitor.resetPassword.newRequest')}</Link>}
    />
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-12 bg-linear-to-br from-sable to-primary-50 dark:from-primary-900 dark:to-primary-700">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white/80 dark:bg-primary-700/50 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-2xl shadow-glass p-8"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary-500 flex items-center justify-center mb-3">
            <HeartPulse className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-display font-bold text-2xl text-primary-900 dark:text-sable">
            {t('visitor.resetPassword.title')}
          </h1>
          <p className="text-sm text-primary-300 text-center mt-1">
            {t('visitor.resetPassword.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Nouveau mot de passe */}
          <div>
            <label className="text-sm font-medium text-primary-700 dark:text-sable">
              {t('visitor.resetPassword.newPasswordLabel')}
            </label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-300" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-primary-100 dark:border-white/10 bg-white/80 dark:bg-primary-900/40 focus:outline-none focus:ring-2 focus:ring-mint-500"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-300"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-urgence-500 mt-1">{errors.password}</p>}
            <p className="text-xs text-primary-300 mt-1">
              {t('visitor.resetPassword.pwStrengthHint')}
            </p>
          </div>

          {/* Confirmation */}
          <div>
            <label className="text-sm font-medium text-primary-700 dark:text-sable">
              {t('visitor.resetPassword.confirmLabel')}
            </label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-300" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-primary-100 dark:border-white/10 bg-white/80 dark:bg-primary-900/40 focus:outline-none focus:ring-2 focus:ring-mint-500"
              />
            </div>
            {errors.confirm && <p className="text-xs text-urgence-500 mt-1">{errors.confirm}</p>}
          </div>

          {errors.general && (
            <p className="text-sm text-urgence-500 bg-urgence-50 dark:bg-urgence-900/20 rounded-xl px-3 py-2">
              {errors.general}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-mint-500 hover:bg-mint-700 text-white font-semibold shadow-lg transition disabled:opacity-60"
          >
            {loading ? t('visitor.resetPassword.updating') : t('visitor.resetPassword.submit')}
          </button>
        </form>

        <p className="text-center text-sm text-primary-300 mt-5">
          <Link href="/login" className="text-primary-400 hover:text-primary-700 underline underline-offset-2">
            {t('visitor.resetPassword.backToLogin')}
          </Link>
        </p>
      </motion.div>
    </div>
  )
}

function StatusScreen({ icon, title, message, action }) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-12 bg-linear-to-br from-sable to-primary-50 dark:from-primary-900 dark:to-primary-700">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white/80 dark:bg-primary-700/50 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-2xl shadow-glass p-8 text-center"
      >
        {icon}
        <h1 className="font-display font-bold text-2xl text-primary-900 dark:text-sable mb-2">{title}</h1>
        <p className="text-primary-400 text-sm">{message}</p>
        {action}
      </motion.div>
    </div>
  )
}
