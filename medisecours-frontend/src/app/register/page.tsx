'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { GoogleLogin } from '@react-oauth/google'
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Camera,
  Check,
  Circle,
  Eye,
  EyeOff,
  FileText,
  HeartPulse,
  LoaderCircle,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Stethoscope,
  UploadCloud,
  User,
} from 'lucide-react'
import AuthLayout from '../../components/auth/AuthLayout'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/ui/Toast'
import { destinationForUser } from '../../lib/auth-routing'
import { useTranslation } from 'react-i18next'

type AccountType = 'patient' | 'medecin'
type IdentityDocumentType = 'CNI' | 'PASSPORT'

type RegisterForm = {
  email: string
  password: string
  confirmPassword: string
  nom: string
  prenom: string
  telephone: string
  quartier: string
  groupeSanguin: string
  allergies: string
  contactsUrgence: string
  specialite: string
  numeroOrdre: string
}

type FieldErrors = Partial<Record<
  keyof RegisterForm | 'terms' | 'type' | 'typePieceIdentite' | 'pieceIdentite' | 'pieceIdentiteVerso' | 'photoVerification',
  string
>>

const emptyForm: RegisterForm = {
  email: '',
  password: '',
  confirmPassword: '',
  nom: '',
  prenom: '',
  telephone: '',
  quartier: '',
  groupeSanguin: '',
  allergies: '',
  contactsUrgence: '',
  specialite: '',
  numeroOrdre: '',
}

const steps = ['visitor.register.stepProfile', 'visitor.register.stepIdentity', 'visitor.register.stepDetails']
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/
const maxIdentityFileSize = 5 * 1024 * 1024
const inputClass =
  'auth-field min-h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 aria-invalid:border-red-500 aria-invalid:ring-4 aria-invalid:ring-red-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:bg-slate-900 dark:aria-invalid:border-red-400'

function isValidPhone(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return true

  const compact = trimmed.replace(/[\s().-]/g, '')
  if (compact.startsWith('+')) return /^\+[1-9]\d{7,14}$/.test(compact)

  return /^(?:237)?[26]\d{8}$/.test(compact)
}

function isValidOrderNumber(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9 ./_-]{3,49}$/.test(value.trim())
}

export default function RegisterPage() {
  const [step, setStep] = useState(0)
  const [type, setType] = useState<AccountType | null>(null)
  const [form, setForm] = useState<RegisterForm>(emptyForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [typePieceIdentite, setTypePieceIdentite] = useState<IdentityDocumentType>('CNI')
  const [pieceIdentite, setPieceIdentite] = useState<File | null>(null)
  const [pieceIdentiteVerso, setPieceIdentiteVerso] = useState<File | null>(null)
  const [photoVerification, setPhotoVerification] = useState<File | null>(null)
  const { register, loginWithGoogle } = useAuth()
  const { t } = useTranslation()
  const toast = useToast()
  const router = useRouter()

  const setField = (key: keyof RegisterForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }))
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const validateField = (key: keyof RegisterForm) => {
    let error: string | undefined
    const value = form[key].trim()

    if (key === 'prenom' && value.length < 2) error = t('visitor.register.errFirstName')
    if (key === 'nom' && value.length < 2) error = t('visitor.register.errLastName')
    if (key === 'email' && !/^\S+@\S+\.\S+$/.test(value)) error = t('visitor.register.errEmailFormat')
    if (key === 'password' && !passwordPattern.test(form.password)) {
      error = t('visitor.register.errPasswordCriteria')
    }
    if (key === 'confirmPassword' && form.confirmPassword !== form.password) {
      error = t('visitor.register.errPasswordMatch')
    }
    if (key === 'telephone' && !isValidPhone(value)) {
      error = t('visitor.register.errPhone')
    }
    if (key === 'groupeSanguin' && value && !/^(A|B|AB|O)[+-]$/i.test(value)) {
      error = t('visitor.register.errBloodGroup')
    }
    if (key === 'specialite' && type === 'medecin' && value.length < 2) {
      error = t('visitor.register.errSpeciality')
    }
    if (key === 'numeroOrdre' && type === 'medecin' && !isValidOrderNumber(value)) {
      error = t('visitor.register.errOrderNumber')
    }

    setErrors((current) => ({ ...current, [key]: error }))
    return !error
  }

  const passwordChecks = [
    { label: t('visitor.register.pwMinLength'), valid: form.password.length >= 8 },
    { label: t('visitor.register.pwUppercase'), valid: /[A-Z]/.test(form.password) },
    { label: t('visitor.register.pwLowercase'), valid: /[a-z]/.test(form.password) },
    { label: t('visitor.register.pwDigit'), valid: /\d/.test(form.password) },
    { label: t('visitor.register.pwSymbol'), valid: /[\W_]/.test(form.password) },
  ]

  const validateIdentity = () => {
    const nextErrors: FieldErrors = {}

    if (form.prenom.trim().length < 2) nextErrors.prenom = t('visitor.register.errFirstName')
    if (form.nom.trim().length < 2) nextErrors.nom = t('visitor.register.errLastName')
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = t('visitor.register.errEmailFormat')
    if (!passwordPattern.test(form.password)) {
      nextErrors.password = t('visitor.register.errPasswordCriteria')
    }
    if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = t('visitor.register.errPasswordMatch')
    }
    if (!acceptedTerms) nextErrors.terms = t('visitor.register.errTerms')

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const validateDetails = () => {
    const nextErrors: FieldErrors = {}

    if (type === 'medecin') {
      if (form.specialite.trim().length < 2) {
        nextErrors.specialite = t('visitor.register.errSpeciality')
      }
      if (!isValidOrderNumber(form.numeroOrdre)) {
        nextErrors.numeroOrdre = t('visitor.register.errOrderNumber')
      }
      if (!pieceIdentite) {
        nextErrors.pieceIdentite = typePieceIdentite === 'CNI'
          ? t('visitor.register.errCniFront')
          : t('visitor.register.errPassportPage')
      }
      if (typePieceIdentite === 'CNI' && !pieceIdentiteVerso) {
        nextErrors.pieceIdentiteVerso = t('visitor.register.errCniBack')
      }
      if (!photoVerification) {
        nextErrors.photoVerification = t('visitor.register.errFacePhoto')
      }
    }

    if (!isValidPhone(form.telephone)) {
      nextErrors.telephone = t('visitor.register.errPhone')
    }

    if (form.groupeSanguin.trim() && !/^(A|B|AB|O)[+-]$/i.test(form.groupeSanguin.trim())) {
      nextErrors.groupeSanguin = t('visitor.register.errBloodGroupFormat')
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const chooseType = (accountType: AccountType) => {
    setType(accountType)
    setErrors({})
    setStep(1)
  }

  const selectIdentityFile = (
    field: 'pieceIdentite' | 'pieceIdentiteVerso' | 'photoVerification',
    file: File | undefined,
  ) => {
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      setErrors((current) => ({
        ...current,
        [field]: t('visitor.register.errImageType'),
      }))
      return
    }
    if (file.size > maxIdentityFileSize) {
      setErrors((current) => ({ ...current, [field]: t('visitor.register.errFileTooLarge') }))
      return
    }

    if (field === 'pieceIdentite') setPieceIdentite(file)
    else if (field === 'pieceIdentiteVerso') setPieceIdentiteVerso(file)
    else setPhotoVerification(file)
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const next = () => {
    if (step === 1 && !validateIdentity()) return
    setErrors({})
    setStep((current) => Math.min(current + 1, 2))
  }

  const back = () => {
    setErrors({})
    setStep((current) => Math.max(current - 1, 0))
  }

  const handleSubmit = async () => {
    if (!type || !validateDetails()) return

    setLoading(true)
    try {
      const common = {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        type,
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
      }

      const payload =
        type === 'patient'
          ? {
              ...common,
              telephone: form.telephone.trim(),
              quartier: form.quartier.trim(),
              groupeSanguin: form.groupeSanguin.trim().toUpperCase(),
              allergies: form.allergies.trim(),
              contactsUrgence: form.contactsUrgence.trim(),
            }
          : (() => {
              const data = new FormData()
              Object.entries({
                ...common,
                telephone: form.telephone.trim(),
                specialite: form.specialite.trim(),
                numeroOrdre: form.numeroOrdre.trim(),
                typePieceIdentite,
              }).forEach(([key, value]) => data.append(key, value))
              data.append('pieceIdentite', pieceIdentite as File)
              if (typePieceIdentite === 'CNI') {
                data.append('pieceIdentiteVerso', pieceIdentiteVerso as File)
              }
              data.append('photoVerification', photoVerification as File)
              return data
            })()

      await register(payload)
      toast.success(
        type === 'medecin'
          ? t('visitor.register.toastDoctorCreated')
          : t('visitor.register.toastPatientCreated'),
      )
      router.push('/login?registered=1')
    } catch (error: any) {
      const status = error.response?.status
      const serverMessage = error.response?.data?.error || error.response?.data?.message

      if (status === 409) {
        toast.error(serverMessage || t('visitor.register.toastEmailTaken'))
      } else if (status === 422) {
        toast.error(serverMessage || t('visitor.register.toastInvalidInfo'))
      } else if (status === 429) {
        toast.error(serverMessage || t('visitor.register.toastTooMany'))
      } else {
        toast.error(serverMessage || t('visitor.register.toastServiceDown'))
      }
    } finally {
      setLoading(false)
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
      router.push(destinationForUser(loggedUser))
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message
      toast.error(message || t('visitor.register.googleSignupFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow={t('visitor.register.eyebrow')}
      title={t('visitor.register.title')}
      description={t('visitor.register.description')}
    >
      <div className="mb-7 flex items-start">
        {steps.map((label, index) => {
          const completed = index < step
          const active = index === step

          return (
            <div key={label} className="flex min-w-0 flex-1 items-start last:flex-none">
              <div className="flex min-w-[58px] flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                    completed || active
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900'
                  }`}
                >
                  {completed ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <span
                  className={`mt-1.5 text-[10px] font-semibold sm:text-xs ${
                    active ? 'text-blue-700 dark:text-blue-400' : 'text-slate-400'
                  }`}
                >
                  {t(label)}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`mt-4 h-px min-w-4 flex-1 ${completed ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
              )}
            </div>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            className="space-y-5"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => chooseType('patient')}
                className="group min-h-[150px] rounded-lg border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-400 dark:hover:bg-blue-950/30"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950 dark:text-blue-300">
                  <User className="h-5 w-5" />
                </div>
                <span className="block font-display text-base font-bold text-slate-950 dark:text-white">{t('visitor.register.patientCardTitle')}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {t('visitor.register.patientCardDesc')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => chooseType('medecin')}
                className="group min-h-[150px] rounded-lg border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-400 dark:hover:bg-blue-950/30"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 group-hover:bg-cyan-600 group-hover:text-white dark:bg-cyan-950 dark:text-cyan-300">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <span className="block font-display text-base font-bold text-slate-950 dark:text-white">{t('visitor.register.doctorCardTitle')}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {t('visitor.register.doctorCardDesc')}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs font-medium text-slate-400">{t('visitor.register.or')}</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <div className={`flex flex-col items-center gap-2 ${loading ? 'pointer-events-none opacity-60' : ''}`}>
              <GoogleLogin
                onSuccess={handleGoogle}
                onError={() => toast.error(t('visitor.register.googleSignupFailed'))}
                text="signup_with"
                shape="rectangular"
              />
              <p className="text-center text-[11px] text-slate-400">
                {t('visitor.register.googlePatientNote')}
              </p>
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="identity"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            className="space-y-4"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('visitor.register.requiredFieldsNote')} <span className="font-bold text-red-500">*</span> {t('visitor.register.requiredFieldsNoteEnd')}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('visitor.register.firstNameLabel')} error={errors.prenom} hint={t('visitor.register.firstNameHint')} required>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.prenom}
                    onChange={setField('prenom')}
                    onBlur={() => validateField('prenom')}
                    autoComplete="given-name"
                    aria-invalid={Boolean(errors.prenom)}
                    className={`${inputClass} pl-10`}
                    placeholder={t('visitor.register.firstNamePlaceholder')}
                  />
                </div>
              </Field>
              <Field label={t('visitor.register.lastNameLabel')} error={errors.nom} hint={t('visitor.register.lastNameHint')} required>
                <input
                  value={form.nom}
                  onChange={setField('nom')}
                  onBlur={() => validateField('nom')}
                  autoComplete="family-name"
                  aria-invalid={Boolean(errors.nom)}
                  className={inputClass}
                  placeholder={t('visitor.register.lastNamePlaceholder')}
                />
              </Field>
            </div>

            <Field
              label={t('visitor.register.emailLabel')}
              error={errors.email}
              hint={t('visitor.register.emailHint')}
              required
            >
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={setField('email')}
                  onBlur={() => validateField('email')}
                  autoComplete="email"
                  inputMode="email"
                  aria-invalid={Boolean(errors.email)}
                  className={`${inputClass} pl-10`}
                  placeholder={t('visitor.register.emailPlaceholder')}
                />
              </div>
            </Field>

            <Field label={t('visitor.register.passwordLabel')} error={errors.password} required>
              <>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={setField('password')}
                    onBlur={() => validateField('password')}
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.password)}
                    className={`${inputClass} pl-10 pr-12`}
                    placeholder={t('visitor.register.passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                    aria-label={showPassword ? t('visitor.register.hidePasswordAria') : t('visitor.register.showPasswordAria')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-2" aria-label={t('visitor.register.pwCriteriaAria')}>
                  {passwordChecks.map((check) => (
                    <div
                      key={check.label}
                      className={`flex items-center gap-1.5 text-[11px] ${
                        check.valid ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                      }`}
                    >
                      {check.valid ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Circle className="h-3 w-3 shrink-0" />}
                      <span>{check.label}</span>
                    </div>
                  ))}
                </div>
              </>
            </Field>

            <Field
              label={t('visitor.register.confirmPasswordLabel')}
              error={errors.confirmPassword}
              hint={t('visitor.register.confirmPasswordHint')}
              required
            >
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={setField('confirmPassword')}
                onBlur={() => validateField('confirmPassword')}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmPassword)}
                className={inputClass}
                placeholder={t('visitor.register.confirmPasswordPlaceholder')}
              />
            </Field>

            <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => {
                  setAcceptedTerms(event.target.checked)
                  if (errors.terms) setErrors((current) => ({ ...current, terms: undefined }))
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
              />
              <span>
                {t('visitor.register.termsLabel')}
              </span>
            </label>
            {errors.terms && <p className="text-xs font-medium text-red-600 dark:text-red-400">{errors.terms}</p>}
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            className="space-y-4"
          >
            {type === 'patient' ? (
              <>
                <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                  <HeartPulse className="mt-0.5 h-4 w-4 shrink-0" />
                  {t('visitor.register.patientInfoNote')}
                </div>
                <Field
                  label={t('visitor.register.phoneOptionalLabel')}
                  error={errors.telephone}
                  hint={t('visitor.register.phoneHint')}
                >
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={form.telephone}
                      onChange={setField('telephone')}
                      onBlur={() => validateField('telephone')}
                      autoComplete="tel"
                      inputMode="tel"
                      aria-invalid={Boolean(errors.telephone)}
                      className={`${inputClass} pl-10`}
                      placeholder={t('visitor.register.phonePlaceholder')}
                    />
                  </div>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('visitor.register.quartierLabel')} hint={t('visitor.register.quartierHint')}>
                    <input
                      value={form.quartier}
                      onChange={setField('quartier')}
                      autoComplete="address-level3"
                      className={inputClass}
                      placeholder={t('visitor.register.quartierPlaceholder')}
                    />
                  </Field>
                  <Field label={t('visitor.register.bloodGroupLabel')} error={errors.groupeSanguin} hint={t('visitor.register.bloodGroupHint')}>
                    <input
                      value={form.groupeSanguin}
                      onChange={setField('groupeSanguin')}
                      onBlur={() => validateField('groupeSanguin')}
                      aria-invalid={Boolean(errors.groupeSanguin)}
                      className={inputClass}
                      placeholder={t('visitor.register.bloodGroupPlaceholder')}
                    />
                  </Field>
                </div>
                <Field
                  label={t('visitor.register.allergiesLabel')}
                  hint={t('visitor.register.allergiesHint')}
                >
                  <input
                    value={form.allergies}
                    onChange={setField('allergies')}
                    className={inputClass}
                    placeholder={t('visitor.register.allergiesPlaceholder')}
                  />
                </Field>
                <Field
                  label={t('visitor.register.emergencyContactLabel')}
                  hint={t('visitor.register.emergencyContactHint')}
                >
                  <input
                    value={form.contactsUrgence}
                    onChange={setField('contactsUrgence')}
                    className={inputClass}
                    placeholder={t('visitor.register.emergencyContactPlaceholder')}
                  />
                </Field>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  {t('visitor.register.doctorPendingNote')}
                </div>
                <Field
                  label={t('visitor.register.specialityLabel')}
                  error={errors.specialite}
                  hint={t('visitor.register.specialityHint')}
                  required
                >
                  <div className="relative">
                    <Stethoscope className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={form.specialite}
                      onChange={setField('specialite')}
                      onBlur={() => validateField('specialite')}
                      aria-invalid={Boolean(errors.specialite)}
                      className={`${inputClass} pl-10`}
                      placeholder={t('visitor.register.specialityPlaceholder')}
                    />
                  </div>
                </Field>
                <Field
                  label={t('visitor.register.phoneProLabel')}
                  error={errors.telephone}
                  hint={t('visitor.register.phoneProHint')}
                >
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={form.telephone}
                      onChange={setField('telephone')}
                      onBlur={() => validateField('telephone')}
                      autoComplete="tel"
                      inputMode="tel"
                      aria-invalid={Boolean(errors.telephone)}
                      className={`${inputClass} pl-10`}
                      placeholder={t('visitor.register.phonePlaceholder')}
                    />
                  </div>
                </Field>
                <Field
                  label={t('visitor.register.orderNumberLabel')}
                  error={errors.numeroOrdre}
                  hint={t('visitor.register.orderNumberHint')}
                  required
                >
                  <input
                    value={form.numeroOrdre}
                    onChange={setField('numeroOrdre')}
                    onBlur={() => validateField('numeroOrdre')}
                    aria-invalid={Boolean(errors.numeroOrdre)}
                    className={inputClass}
                    placeholder={t('visitor.register.orderNumberPlaceholder')}
                  />
                </Field>
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t('visitor.register.identityVerificationTitle')}
                    </h3>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                      {t('visitor.register.identityVerificationNote')}
                    </p>
                  </div>

                  <Field label={t('visitor.register.idTypeLabel')} error={errors.typePieceIdentite} required>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ['CNI', t('visitor.register.cni')],
                        ['PASSPORT', t('visitor.register.passport')],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setTypePieceIdentite(value)}
                          className={`min-h-11 rounded-lg border px-3 text-sm font-semibold transition ${
                            typePieceIdentite === value
                              ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                              : 'border-slate-200 text-slate-600 hover:border-blue-400 dark:border-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <IdentityFileField
                      label={typePieceIdentite === 'CNI' ? t('visitor.register.cniFrontLabel') : t('visitor.register.passportPageLabel')}
                      description={t('visitor.register.cniFrontDesc')}
                      accept="image/jpeg,image/png,image/webp"
                      file={pieceIdentite}
                      error={errors.pieceIdentite}
                      icon={FileText}
                      onChange={(file) => selectIdentityFile('pieceIdentite', file)}
                    />
                    {typePieceIdentite === 'CNI' && (
                      <IdentityFileField
                        label={t('visitor.register.cniBackLabel')}
                        description={t('visitor.register.cniBackDesc')}
                        accept="image/jpeg,image/png,image/webp"
                        file={pieceIdentiteVerso}
                        error={errors.pieceIdentiteVerso}
                        icon={FileText}
                        onChange={(file) => selectIdentityFile('pieceIdentiteVerso', file)}
                      />
                    )}
                    <IdentityFileField
                      label={t('visitor.register.facePhotoLabel')}
                      description={t('visitor.register.facePhotoDesc')}
                      accept="image/jpeg,image/png,image/webp"
                      file={photoVerification}
                      error={errors.photoVerification}
                      icon={Camera}
                      onChange={(file) => selectIdentityFile('photoVerification', file)}
                    />
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {step > 0 && (
        <div className="mt-7 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={back}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('visitor.register.back')}
          </button>
          {step < 2 ? (
            <button
              type="button"
              onClick={next}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
            >
              {t('visitor.register.continue')}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {loading ? t('visitor.register.creating') : t('visitor.register.createAccountButton')}
            </button>
          )}
        </div>
      )}

      <p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">
        {t('visitor.register.alreadyRegistered')}{' '}
        <Link href="/login" className="font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400">
          {t('visitor.register.login')}
        </Link>
      </p>
    </AuthLayout>
  )
}

function IdentityFileField({
  label,
  description,
  accept,
  file,
  error,
  icon: Icon,
  onChange,
}: {
  label: string
  description: string
  accept: string
  file: File | null
  error?: string
  icon: React.ComponentType<{ className?: string }>
  onChange: (file?: File) => void
}) {
  const { t } = useTranslation()
  return (
    <div>
      <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}<span className="ml-1 text-red-500">*</span>
      </span>
      <label className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-4 text-center transition ${
        error
          ? 'border-red-400 bg-red-50/60 dark:bg-red-950/20'
          : file
            ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20'
            : 'border-slate-300 bg-slate-50 hover:border-blue-500 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-400'
      }`}>
        <input
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(event) => onChange(event.target.files?.[0])}
        />
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400">
          {file ? <Check className="h-5 w-5 text-emerald-600" /> : <Icon className="h-5 w-5" />}
        </div>
        <span className="max-w-full break-all text-xs font-bold text-slate-800 dark:text-slate-100">
          {file?.name || t('visitor.register.chooseFile')}
        </span>
        <span className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
          {file ? `${(file.size / 1024 / 1024).toFixed(2)} ${t('visitor.register.megabytes')}` : description}
        </span>
        {!file && <UploadCloud className="mt-2 h-4 w-4 text-slate-400" />}
      </label>
      {error && (
        <p className="mt-1.5 flex gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

function Field({
  label,
  error,
  hint,
  required = false,
  children,
}: {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
        {required && (
          <>
            <span className="ml-1 text-red-500" aria-hidden="true">*</span>
            <span className="sr-only"> {t('visitor.register.required')}</span>
          </>
        )}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : (
        hint && <p className="mt-1.5 text-[11px] leading-4 text-slate-400 dark:text-slate-500">{hint}</p>
      )}
    </div>
  )
}
