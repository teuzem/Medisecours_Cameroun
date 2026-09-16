'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { GoogleLogin } from '@react-oauth/google'
import { AlertCircle, CheckCircle2, Eye, EyeOff, LoaderCircle, Lock, Mail, ShieldCheck } from 'lucide-react'
import AuthLayout from '../../components/auth/AuthLayout'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/ui/Toast'
import api from '../../api/axios'
import { destinationForUser } from '../../lib/auth-routing'
import { useTranslation } from 'react-i18next'

type FieldErrors = {
  email?: string
  password?: string
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resendingVerification, setResendingVerification] = useState(false)
  const { login, loginWithGoogle, user, isAuthenticated, mounted } = useAuth()
  const { t } = useTranslation()
  const toast = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedPath = searchParams.get('from')
  const from = requestedPath?.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : '/'
  const registered = searchParams.get('registered') === '1'

  useEffect(() => {
    if (mounted && isAuthenticated && user) {
      router.replace(destinationForUser(user, from))
    }
  }, [from, isAuthenticated, mounted, router, user])

  const validate = () => {
    const nextErrors: FieldErrors = {}
    const normalizedEmail = email.trim()

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      nextErrors.email = t('visitor.login.invalidEmail')
    }
    if (!password) {
      nextErrors.password = t('visitor.login.missingPassword')
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    setLoading(true)
    setNeedsVerification(false)
    try {
      const loggedUser = await login(email.trim().toLowerCase(), password)
      toast.success(t('visitor.login.successWelcome'))
      router.push(destinationForUser(loggedUser, from))
    } catch (error: any) {
      const status = error.response?.status
      const serverMessage = error.response?.data?.error || error.response?.data?.message

      if (status === 401) {
        setErrors({
          email: t('visitor.login.emailCheck'),
          password: t('visitor.login.passwordCheck'),
        })
        toast.error(t('visitor.login.badCredentials'))
      } else if (status === 403) {
        if (typeof serverMessage === 'string' && serverMessage.toLowerCase().includes('confirmez')) {
          setNeedsVerification(true)
        }
        toast.error(serverMessage || t('visitor.login.accessDenied'))
      } else if (status === 429) {
        toast.error(serverMessage || t('visitor.login.tooManyAttempts'))
      } else {
        toast.error(serverMessage || t('visitor.login.serviceUnavailable'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErrors((current) => ({ ...current, email: t('visitor.login.emailFirst') }))
      return
    }

    setResendingVerification(true)
    try {
      const { data } = await api.post('/api/auth/resend-verification', {
        email: email.trim().toLowerCase(),
      })
      toast.success(data?.message || t('visitor.login.resendRequested'))
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('visitor.login.resendFailed'))
    } finally {
      setResendingVerification(false)
    }
  }

  const handleGoogle = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      toast.error(t('visitor.login.googleNoToken'))
      return
    }

    setLoading(true)
    try {
      const loggedUser = await loginWithGoogle(credentialResponse.credential)
      toast.success(t('visitor.login.googleSuccess'))
      router.push(destinationForUser(loggedUser, from))
    } catch (error: any) {
      const status = error.response?.status
      const message = error.response?.data?.error || error.response?.data?.message

      if (status === 403 || status === 429) {
        toast.error(message || t('visitor.login.googleDenied'))
      } else {
        toast.error(message || t('visitor.login.googleFailed'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow={t('visitor.login.eyebrow')}
      title={t('visitor.login.title')}
      description={t('visitor.login.description')}
    >
      {registered && (
        <div
          role="status"
          className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {t('visitor.login.accountCreated')}
          </p>
        </div>
      )}

      {needsVerification && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-100">
          <p>{t('visitor.login.emailMustConfirm')}</p>
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resendingVerification}
            className="mt-2 font-semibold text-amber-800 underline underline-offset-2 disabled:cursor-wait disabled:opacity-60 dark:text-amber-200"
          >
            {resendingVerification ? t('visitor.login.resending') : t('visitor.login.resendConfirmation')}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="login-email" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {t('visitor.login.emailLabel')}
          </label>
          <div className="relative mt-2">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                if (errors.email) setErrors((current) => ({ ...current, email: undefined }))
              }}
              onBlur={() => {
                if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
                  setErrors((current) => ({ ...current, email: t('visitor.login.emailExample') }))
                }
              }}
              autoComplete="email"
              inputMode="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'login-email-error' : 'login-email-hint'}
              className="auth-field min-h-12 w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 aria-invalid:border-red-500 aria-invalid:ring-4 aria-invalid:ring-red-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:bg-slate-900 dark:aria-invalid:border-red-400"
              placeholder={t('visitor.login.emailPlaceholder')}
            />
          </div>
          {errors.email ? (
            <p
              id="login-email-error"
              className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-600 dark:text-red-400"
              role="alert"
            >
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{errors.email}</span>
            </p>
          ) : (
            <p id="login-email-hint" className="mt-1.5 text-[11px] leading-4 text-slate-400 dark:text-slate-500">
              {t('visitor.login.emailHint')}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="login-password" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t('visitor.login.passwordLabel')}
            </label>
            <Link href="/forgot-password" className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400">
              {t('visitor.login.forgotPassword')}
            </Link>
          </div>
          <div className="relative mt-2">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                if (errors.password) setErrors((current) => ({ ...current, password: undefined }))
              }}
              onBlur={() => {
                if (!password) {
                  setErrors((current) => ({ ...current, password: t('visitor.login.passwordMissing') }))
                }
              }}
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'login-password-error' : 'login-password-hint'}
              className="auth-field min-h-12 w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-12 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 aria-invalid:border-red-500 aria-invalid:ring-4 aria-invalid:ring-red-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:bg-slate-900 dark:aria-invalid:border-red-400"
              placeholder={t('visitor.login.passwordPlaceholder')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label={showPassword ? t('visitor.login.hidePasswordAria') : t('visitor.login.showPasswordAria')}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? (
            <p
              id="login-password-error"
              className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-600 dark:text-red-400"
              role="alert"
            >
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{errors.password}</span>
            </p>
          ) : (
            <p id="login-password-hint" className="mt-1.5 text-[11px] leading-4 text-slate-400 dark:text-slate-500">
              {t('visitor.login.passwordHint')}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {loading ? t('visitor.login.loggingIn') : t('visitor.login.loginButton')}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        <span className="text-xs font-medium text-slate-400">{t('visitor.login.orContinueWith')}</span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className={`flex min-h-10 justify-center ${loading ? 'pointer-events-none opacity-60' : ''}`}>
        <GoogleLogin
          onSuccess={handleGoogle}
          onError={() => toast.error(t('visitor.login.googleFailed'))}
          text="signin_with"
          shape="rectangular"
        />
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
        <ShieldCheck className="h-4 w-4" />
        <span>{t('visitor.login.secureConnection')}</span>
      </div>

      <p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">
        {t('visitor.login.noAccountYet')}{' '}
        <Link href="/register" className="font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400">
          {t('visitor.login.createAccount')}
        </Link>
      </p>
    </AuthLayout>
  )
}
