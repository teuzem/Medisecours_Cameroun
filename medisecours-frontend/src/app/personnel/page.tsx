'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import {
  Activity, ClipboardList, FileText, Package, Plus, Search, Trash2, X,
} from 'lucide-react'
import api from '../../api/axios'
import { useAuth } from '../../hooks/useAuth'
import GlassCard from '../../components/ui/GlassCard'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { ToastProvider, useToast } from '../../components/ui/Toast'
import { destinationForUser } from '../../lib/auth-routing'

type CentreLite = { id: number; nom: string; ville?: string | null; type?: string | null }

type DocDraft = { key: string; typeDocument: string; titre: string; fichierData: string | null; fileName: string }

const TYPES_DOC = ['DIPLOME', 'ATTESTATION_FONCTION', 'CARMED', 'CERTIFICAT', 'AUTRE']

function PersonnelLandingInner() {
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const { login } = useAuth()

  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion')

  // Connexion
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  // Inscription — étapes
  const [step, setStep] = useState(1)
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [typePersonnel, setTypePersonnel] = useState('RECEPTIONNISTE')
  const [centreQuery, setCentreQuery] = useState('')
  const [centres, setCentres] = useState<CentreLite[]>([])
  const [centre, setCentre] = useState<CentreLite | null>(null)
  const [searching, setSearching] = useState(false)
  const [docs, setDocs] = useState<DocDraft[]>([])
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerError, setRegisterError] = useState('')
  const [registerDone, setRegisterDone] = useState(false)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      const user = await login(email.trim(), password)
      router.replace(destinationForUser(user, '/personnel/tableau-de-bord'))
    } catch {
      setLoginError(t('personnel.landing.erreurConnexion'))
    } finally {
      setLoginLoading(false)
    }
  }

  const searchCentres = useCallback((query: string) => {
    setCentreQuery(query)
    setCentre(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (query.trim().length < 2) {
      setCentres([])
      return
    }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get('/api/carte/etablissements', { params: { q: query.trim() } })
        const items = res.data?.centres ?? res.data?.results ?? res.data ?? []
        setCentres(Array.isArray(items) ? items.slice(0, 8) : [])
      } catch {
        setCentres([])
      } finally {
        setSearching(false)
      }
    }, 250)
  }, [])

  const addDoc = () => {
    setDocs((prev) => [
      ...prev,
      { key: `${Date.now()}-${prev.length}`, typeDocument: 'DIPLOME', titre: '', fichierData: null, fileName: '' },
    ])
  }

  const removeDoc = (key: string) => {
    setDocs((prev) => prev.filter((d) => d.key !== key))
  }

  const patchDoc = (key: string, patch: Partial<DocDraft>) => {
    setDocs((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  }

  const pickFile = (key: string, file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error(t('personnel.inscription.erreurFichier'))
      return
    }
    if (file.size > 3_145_728) {
      toast.error(t('personnel.inscription.erreurFichier'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => patchDoc(key, { fichierData: String(reader.result), fileName: file.name })
    reader.readAsDataURL(file)
  }

  const canSubmit = useMemo(
    () => nom.trim() !== '' && prenom.trim() !== '' && centre !== null && docs.length > 0 && docs.every((d) => d.fichierData),
    [nom, prenom, centre, docs]
  )

  const handleRegister = async () => {
    setRegisterLoading(true)
    setRegisterError('')
    try {
      await api.post('/api/personnel/register', {
        email,
        password,
        nom: nom.trim(),
        prenom: prenom.trim(),
        telephone: telephone.trim(),
        typePersonnel,
        etablissementId: centre?.id,
        documents: docs.map((d) => ({ typeDocument: d.typeDocument, titre: d.titre || undefined, fichierData: d.fichierData })),
      })
      setRegisterDone(true)
      toast.success(t('personnel.inscription.succes'))
    } catch (err: any) {
      setRegisterError(err?.response?.data?.error ?? t('personnel.inscription.erreur'))
    } finally {
      setRegisterLoading(false)
    }
  }

  if (registerDone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4 dark:bg-[#071225]">
        <GlassCard className="w-full max-w-lg p-8 text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-mint-600" aria-hidden />
          <h1 className="mt-4 font-display text-xl font-bold text-[#0F2C52] dark:text-white">
            {t('personnel.inscription.succes')}
          </h1>
          <p className="mt-3 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            {t('personnel.attente.intro', { etablissement: centre?.nom ?? '' })}
          </p>
          <button
            type="button"
            onClick={() => { setMode('connexion'); setRegisterDone(false); setStep(1) }}
            className="mt-6 rounded-lg bg-[#0F2C52] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#16395F] dark:bg-mint-600 dark:hover:bg-mint-500"
          >
            {t('personnel.landing.seConnecter')}
          </button>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#071225]">
      <header className="border-b border-[#E5E7EB] bg-white dark:border-white/10 dark:bg-[#0B1A33]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <p className="font-display text-base font-bold text-[#0F2C52] dark:text-white">MediSecours+</p>
          <nav className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('connexion')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                mode === 'connexion'
                  ? 'bg-[#0F2C52] text-white dark:bg-mint-600'
                  : 'text-[#6B7280] hover:bg-[#F3F4F6] dark:text-[#9CA3AF] dark:hover:bg-white/5'
              }`}
            >
              {t('personnel.landing.ctaConnexion')}
            </button>
            <button
              type="button"
              onClick={() => setMode('inscription')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                mode === 'inscription'
                  ? 'bg-[#0F2C52] text-white dark:bg-mint-600'
                  : 'text-[#6B7280] hover:bg-[#F3F4F6] dark:text-[#9CA3AF] dark:hover:bg-white/5'
              }`}
            >
              {t('personnel.landing.ctaInscription')}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <section className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-[#0F2C52] dark:text-white">
            {t('personnel.landing.titre')}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-[#6B7280] dark:text-[#9CA3AF]">
            {t('personnel.landing.intro')}
          </p>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { icon: ClipboardList, title: 'personnel.landing.roles.reception', desc: 'personnel.landing.roles.receptionDesc' },
            { icon: Activity, title: 'personnel.landing.roles.soins', desc: 'personnel.landing.roles.soinsDesc' },
            { icon: Package, title: 'personnel.landing.roles.pharmacie', desc: 'personnel.landing.roles.pharmacieDesc' },
          ].map((card) => {
            const Icon = card.icon
            return (
              <GlassCard key={card.title} className="p-5 text-left">
                <Icon className="h-6 w-6 text-[#0F2C52] dark:text-mint-500" aria-hidden />
                <h2 className="mt-3 font-display text-sm font-bold text-[#0F2C52] dark:text-white">
                  {t(card.title)}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[#6B7280] dark:text-[#9CA3AF]">
                  {t(card.desc)}
                </p>
              </GlassCard>
            )
          })}
        </section>

        <section className="mx-auto mt-12 max-w-xl">
          {mode === 'connexion' ? (
            <GlassCard className="p-6 sm:p-8">
              <h2 className="font-display text-lg font-bold text-[#0F2C52] dark:text-white">
                {t('personnel.landing.connexionTitre')}
              </h2>
              <form onSubmit={handleLogin} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="personnel-email" className="mb-1.5 block text-sm font-medium text-[#374151] dark:text-[#D1D5DB]">
                    {t('personnel.landing.email')}
                  </label>
                  <input
                    id="personnel-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#111827] outline-none focus:border-[#0F2C52] dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="personnel-password" className="mb-1.5 block text-sm font-medium text-[#374151] dark:text-[#D1D5DB]">
                    {t('personnel.landing.motDePasse')}
                  </label>
                  <input
                    id="personnel-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#111827] outline-none focus:border-[#0F2C52] dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
                  />
                </div>
                {loginError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                    {loginError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F2C52] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#16395F] disabled:opacity-60 dark:bg-mint-600 dark:hover:bg-mint-500"
                >
                  {loginLoading && <LoadingSpinner size="sm" />}
                  {t('personnel.landing.seConnecter')}
                </button>
              </form>
              <p className="mt-4 text-center text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                {t('personnel.landing.pasDeCompte')}{' '}
                <button type="button" onClick={() => setMode('inscription')} className="font-semibold text-[#0F2C52] underline dark:text-mint-500">
                  {t('personnel.landing.ctaInscription')}
                </button>
              </p>
            </GlassCard>
          ) : (
            <GlassCard className="p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-[#0F2C52] dark:text-white">
                  {t('personnel.landing.inscriptionTitre')}
                </h2>
                <ol className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
                  {[1, 2, 3].map((n) => (
                    <li
                      key={n}
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${
                        step >= n ? 'bg-[#0F2C52] text-white dark:bg-mint-600' : 'bg-[#F3F4F6] dark:bg-white/5'
                      }`}
                    >
                      {n}
                    </li>
                  ))}
                </ol>
              </div>

              {step === 1 && (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="p-nom" className="mb-1.5 block text-sm font-medium text-[#374151] dark:text-[#D1D5DB]">
                        {t('personnel.inscription.nom')}
                      </label>
                      <input id="p-nom" value={nom} onChange={(e) => setNom(e.target.value)} required
                        className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white" />
                    </div>
                    <div>
                      <label htmlFor="p-prenom" className="mb-1.5 block text-sm font-medium text-[#374151] dark:text-[#D1D5DB]">
                        {t('personnel.inscription.prenom')}
                      </label>
                      <input id="p-prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} required
                        className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="p-tel" className="mb-1.5 block text-sm font-medium text-[#374151] dark:text-[#D1D5DB]">
                      {t('personnel.inscription.telephone')}
                    </label>
                    <input id="p-tel" value={telephone} onChange={(e) => setTelephone(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white" />
                  </div>
                  <div>
                    <label htmlFor="p-type" className="mb-1.5 block text-sm font-medium text-[#374151] dark:text-[#D1D5DB]">
                      {t('personnel.inscription.typePersonnel')}
                    </label>
                    <select
                      id="p-type"
                      value={typePersonnel}
                      onChange={(e) => setTypePersonnel(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
                    >
                      <option value="RECEPTIONNISTE">{t('personnel.inscription.typeReceptionniste')}</option>
                      <option value="INFIRMIER">{t('personnel.inscription.typeInfirmier')}</option>
                      <option value="AIDE_SOIGNANT">{t('personnel.inscription.typeAideSoignant')}</option>
                      <option value="PHARMACIEN">{t('personnel.inscription.typePharmacien')}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="p-email" className="mb-1.5 block text-sm font-medium text-[#374151] dark:text-[#D1D5DB]">
                      {t('personnel.landing.email')}
                    </label>
                    <input id="p-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white" />
                  </div>
                  <div>
                    <label htmlFor="p-pass" className="mb-1.5 block text-sm font-medium text-[#374151] dark:text-[#D1D5DB]">
                      {t('personnel.landing.motDePasse')}
                    </label>
                    <input id="p-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={nom.trim() === '' || prenom.trim() === '' || !email.includes('@') || password.length < 8}
                    className="w-full rounded-lg bg-[#0F2C52] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#16395F] disabled:opacity-60 dark:bg-mint-600"
                  >
                    {t('personnel.inscription.suivant')}
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="mt-5 space-y-4">
                  <div className="relative">
                    <label htmlFor="p-centre" className="mb-1.5 block text-sm font-medium text-[#374151] dark:text-[#D1D5DB]">
                      {t('personnel.inscription.selectionnerEtablissement')}
                    </label>
                    <Search className="pointer-events-none absolute left-3 top-[42px] h-4 w-4 text-[#9CA3AF]" aria-hidden />
                    <input
                      id="p-centre"
                      value={centre ? `${centre.nom}${centre.ville ? ` — ${centre.ville}` : ''}` : centreQuery}
                      onChange={(e) => searchCentres(e.target.value)}
                      placeholder={t('personnel.inscription.rechercherEtablissement')}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white py-2.5 pl-9 pr-3.5 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
                    />
                    {!centre && centres.length > 0 && (
                      <ul className="mt-1.5 max-h-52 overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white dark:border-white/10 dark:bg-[#0B1A33]">
                        {centres.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => { setCentre(c); setCentres([]) }}
                              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm hover:bg-[#F3F4F6] dark:hover:bg-white/5"
                            >
                              <span className="font-medium text-[#111827] dark:text-white">{c.nom}</span>
                              <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{c.ville}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!centre && searching && (
                      <p className="mt-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t('personnel.commun.rechercheEnCours')}</p>
                    )}
                    {!centre && !searching && centreQuery.trim().length >= 2 && centres.length === 0 && (
                      <p className="mt-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t('personnel.inscription.aucunEtablissement')}</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="rounded-lg border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#6B7280] hover:bg-[#F3F4F6] dark:border-white/10 dark:text-[#9CA3AF]"
                    >
                      {t('personnel.inscription.precedent')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={!centre}
                      className="flex-1 rounded-lg bg-[#0F2C52] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#16395F] disabled:opacity-60 dark:bg-mint-600"
                    >
                      {t('personnel.inscription.suivant')}
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="mt-5 space-y-4">
                  <p className="text-sm leading-relaxed text-[#6B7280] dark:text-[#9CA3AF]">
                    {t('personnel.inscription.documentsIntro')}
                  </p>
                  {docs.map((doc) => (
                    <div key={doc.key} className="rounded-lg border border-[#E5E7EB] p-4 dark:border-white/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="grid flex-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-[#374151] dark:text-[#D1D5DB]">
                              {t('personnel.inscription.typeDocument')}
                            </label>
                            <select
                              value={doc.typeDocument}
                              onChange={(e) => patchDoc(doc.key, { typeDocument: e.target.value })}
                              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
                            >
                              {TYPES_DOC.map((type) => (
                                <option key={type} value={type}>
                                  {t(`personnel.inscription.document${type === 'DIPLOME' ? 'Diplome' : type === 'ATTESTATION_FONCTION' ? 'Attestation' : type === 'CARMED' ? 'Carmed' : type === 'CERTIFICAT' ? 'Certificat' : 'Autre'}`)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-[#374151] dark:text-[#D1D5DB]">
                              {t('personnel.inscription.titreDocument')}
                            </label>
                            <input
                              value={doc.titre}
                              onChange={(e) => patchDoc(doc.key, { titre: e.target.value })}
                              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDoc(doc.key)}
                          className="mt-6 rounded-lg p-2 text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-red-600 dark:hover:bg-white/5"
                          aria-label={t('personnel.commun.annuler')}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                      <div className="mt-3">
                        <input
                          ref={(el) => { fileRefs.current[doc.key] = el }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => pickFile(doc.key, e.target.files?.[0])}
                        />
                        <button
                          type="button"
                          onClick={() => fileRefs.current[doc.key]?.click()}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#D1D5DB] px-3 py-3 text-sm text-[#6B7280] hover:border-[#0F2C52] hover:text-[#0F2C52] dark:border-white/15 dark:text-[#9CA3AF]"
                        >
                          <FileText className="h-4 w-4" aria-hidden />
                          {doc.fileName || t('personnel.inscription.fichier')}
                          {doc.fichierData && <span className="text-mint-600">✓</span>}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addDoc}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm font-semibold text-[#0F2C52] hover:bg-[#F3F4F6] dark:border-white/10 dark:text-mint-500 dark:hover:bg-white/5"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    {t('personnel.inscription.ajouterDocument')}
                  </button>
                  {registerError && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                      {registerError}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="rounded-lg border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#6B7280] hover:bg-[#F3F4F6] dark:border-white/10 dark:text-[#9CA3AF]"
                    >
                      {t('personnel.inscription.precedent')}
                    </button>
                    <button
                      type="button"
                      onClick={handleRegister}
                      disabled={!canSubmit || registerLoading}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0F2C52] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#16395F] disabled:opacity-60 dark:bg-mint-600"
                    >
                      {registerLoading ? <LoadingSpinner size="sm" /> : <X className="hidden" aria-hidden />}
                      {registerLoading ? t('personnel.inscription.envoiEnCours') : t('personnel.inscription.envoyer')}
                    </button>
                  </div>
                </div>
              )}

              <p className="mt-4 text-center text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                {t('personnel.landing.dejaCompte')}{' '}
                <button type="button" onClick={() => setMode('connexion')} className="font-semibold text-[#0F2C52] underline dark:text-mint-500">
                  {t('personnel.landing.seConnecter')}
                </button>
              </p>
            </GlassCard>
          )}
        </section>
      </main>
    </div>
  )
}

export default function PersonnelLandingPage() {
  return (
    <ToastProvider>
      <PersonnelLandingInner />
    </ToastProvider>
  )
}
