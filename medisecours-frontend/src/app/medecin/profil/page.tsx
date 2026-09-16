// @ts-nocheck
'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Save, ShieldCheck, Star, ClipboardList, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { mutate as globalMutate } from 'swr'
import api from '../../../api/axios'
import { useAuth } from '../../../hooks/useAuth'
import { imgUrl } from '../../../lib/config'
import { useToast } from '../../../components/ui/Toast'
import Avatar from '../../../components/ui/Avatar'
import CertifiedBadge from '../../../components/ui/CertifiedBadge'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { CONVERSATIONS_KEY } from '../../../lib/keys'

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

export default function MedecinProfilPage() {
  const { user, updateUser } = useAuth()
  const toast = useToast()
  const { t } = useTranslation()
  const fileRef = useRef(null)
  const initializedProfileId = useRef(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [avis, setAvis] = useState([])
  const [consultationsCount, setConsultationsCount] = useState(0)
  const [messagesCount, setMessagesCount] = useState(0)
  const [loadingStats, setLoadingStats] = useState(true)

  const [form, setForm] = useState({
    prenom: user?.prenom || '',
    nom: user?.nom || '',
    email: user?.email || '',
    telephone: user?.telephone || '',
    specialite: user?.specialite || '',
  })
  const [dispo, setDispo] = useState(Array.isArray(user?.disponibilites) ? user.disponibilites : [])

  useEffect(() => {
    if (!user?.id) return
    if (initializedProfileId.current === user.id) return

    const timer = window.setTimeout(() => {
      initializedProfileId.current = user.id
      setForm({
        prenom: user.prenom || '',
        nom: user.nom || '',
        email: user.email || '',
        telephone: user.telephone || '',
        specialite: user.specialite || '',
      })
      setDispo(Array.isArray(user.disponibilites) ? user.disponibilites : [])
    }, 0)

    return () => window.clearTimeout(timer)
  }, [
    user?.id,
    user?.prenom,
    user?.nom,
    user?.email,
    user?.telephone,
    user?.specialite,
    user?.disponibilites,
  ])

  useEffect(() => {
    if (!user?.id) return
    // C2 corrigé : on ne charge PLUS /api/messages en bloc.
    // - avis : nécessaire (liste réelle pour la note moyenne)
    // - consultations : seul le compte nous intéresse → on récupère la collection
    // - messages : remplacé par le compteur léger /api/messages/unread-count
    Promise.allSettled([
      api.get(`/api/avis?medecin=${user.id}`),
      api.get('/api/consultations'),
      api.get('/api/messages/unread-count'),
    ])
      .then(([avisRes, consRes, msgRes]) => {
        const extract = (res) => {
          const raw = res.data?.['hydra:member'] ?? res.data?.member ?? res.data
          return Array.isArray(raw) ? raw : []
        }
        if (avisRes.status === 'fulfilled') setAvis(extract(avisRes.value))
        if (consRes.status === 'fulfilled') setConsultationsCount(extract(consRes.value).length)
        if (msgRes.status === 'fulfilled') {
          setMessagesCount(msgRes.value.data?.unreadCount ?? 0)
        }
      })
      .finally(() => setLoadingStats(false))
  }, [user?.id])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const toggleDay = (dayKey) => {
    setDispo((d) => {
      if (d.some((s) => s.jour === dayKey)) return d.filter((s) => s.jour !== dayKey)
      return [...d, { jour: dayKey, debut: '08:00', fin: '17:00' }]
    })
  }

  const updateSlot = (dayKey, field, value) => {
    setDispo((d) => d.map((s) => (s.jour === dayKey ? { ...s, [field]: value } : s)))
  }

  const handleSave = async () => {
    const invalidSlot = dispo.find((slot) => !slot.debut || !slot.fin || slot.debut >= slot.fin)
    if (invalidSlot) {
      toast.error(t('medecin.profil.verifyScheduleError', { day: t(`medecin.dayFull.${invalidSlot.jour}`) }))
      return
    }

    setSaving(true)
    try {
      const profilePayload = { ...form }
      delete profilePayload.email
      const { data } = await api.patch(`/api/users/${user.id}`, { ...profilePayload, disponibilites: dispo }, { headers: { 'Content-Type': 'application/merge-patch+json' } })
      updateUser({ ...user, ...data })
      globalMutate((key) => typeof key === 'string' && key.startsWith('/api/medecins-publics'))
      toast.success(t('medecin.profil.saved'))
    } catch (error) {
      const serverMessage = error?.response?.data?.detail || error?.response?.data?.message
      if (serverMessage) {
        toast.error(serverMessage)
        return
      }
      toast.error(t('medecin.profil.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error(t('medecin.profil.formatError'))
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('medecin.profil.sizeError'))
      e.target.value = ''
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/api/profile/photo', formData)
      const nextUser = { ...user, photoProfil: data.photoProfil }
      updateUser(nextUser)
      globalMutate(CONVERSATIONS_KEY)
      globalMutate((key) => typeof key === 'string' && key.startsWith('/api/medecins-publics'))
      toast.success(t('medecin.profil.photoUpdated'))
    } catch (err: any) {
      console.error('Upload error:', err?.response?.data || err)
      toast.error(
        err?.response?.data?.error
        || err?.response?.data?.detail
        || t('medecin.profil.photoError'),
      )
    } finally {
      setUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  if (!user) return null

  const noteMoyenne = avis.length ? (avis.reduce((s, a) => s + a.note, 0) / avis.length).toFixed(1) : 0

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left card */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl bg-white dark:bg-primary-800 border border-primary-100 dark:border-white/5 p-6 sticky top-20 text-center">
            <div className="relative inline-block mb-4">
              <div className="w-20 h-20 rounded-full bg-mint-500 text-white flex items-center justify-center text-2xl font-bold overflow-hidden mx-auto">
                {user.photoProfil ? <img src={imgUrl(user.photoProfil) || ''} alt="" className="w-full h-full object-cover" /> : `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.toUpperCase()}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-lg"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleUpload} />
            </div>
            <div className="flex items-center justify-center gap-2">
              <h2 className="font-display font-bold text-lg text-primary-900 dark:text-sable">Dr. {user.prenom} {user.nom}</h2>
              {user.estValide && <CertifiedBadge className="h-5 w-5" />}
            </div>
            <span className="inline-block mt-1 mb-3 text-xs font-semibold px-2.5 py-1 rounded-full bg-mint-100 text-mint-700">{user.specialite}</span>

            <div className="mb-4">
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full ${user.estValide ? 'bg-mint-100 text-mint-700' : 'bg-amber-100 text-amber-700'}`}>
                <ShieldCheck className="w-3.5 h-3.5" /> {user.estValide ? t('medecin.profil.accountValidated') : t('medecin.profil.pendingValidation')}
              </span>
            </div>

            <p className="text-xs text-primary-300 mb-4">{t('medecin.profil.ordreNumber', { number: user.numeroOrdre })}</p>

            <div className="flex items-center justify-center gap-1 mb-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className={`w-4 h-4 ${i <= Math.round(noteMoyenne) ? 'text-amber-400' : 'text-gray-200 dark:text-primary-700'}`} fill="currentColor" />
              ))}
            </div>
            <p className="text-xs text-primary-300 mb-4">{noteMoyenne}/5 · {t('medecin.profil.reviewsCount', { count: avis.length })}</p>

            {loadingStats ? <LoadingSpinner size="sm" /> : (
              <div className="grid grid-cols-2 gap-2 text-left">
                <div className="rounded-xl bg-primary-50 dark:bg-primary-900/40 p-3">
                  <ClipboardList className="w-4 h-4 text-primary-500 mb-1" />
                  <p className="font-display font-bold text-primary-900 dark:text-sable">{consultationsCount}</p>
                  <p className="text-[10px] text-primary-300">{t('medecin.profil.consultations')}</p>
                </div>
                <div className="rounded-xl bg-primary-50 dark:bg-primary-900/40 p-3">
                  <MessageSquare className="w-4 h-4 text-primary-500 mb-1" />
                  <p className="font-display font-bold text-primary-900 dark:text-sable">{messagesCount}</p>
                  <p className="text-[10px] text-primary-300">{t('medecin.profil.messages')}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl bg-white dark:bg-primary-800 border border-primary-100 dark:border-white/5 p-6">
            <h3 className="font-display font-bold text-lg text-primary-900 dark:text-sable mb-4">{t('medecin.profil.personalInfo')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('medecin.profil.firstName')} value={form.prenom} onChange={set('prenom')} />
              <Field label={t('medecin.profil.lastName')} value={form.nom} onChange={set('nom')} />
              <Field label={t('medecin.profil.email')} value={form.email} onChange={set('email')} readOnly />
              <Field label={t('medecin.profil.phone')} value={form.telephone} onChange={set('telephone')} />
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-primary-800 border border-primary-100 dark:border-white/5 p-6">
            <h3 className="font-display font-bold text-lg text-primary-900 dark:text-sable mb-4">{t('medecin.profil.professionalInfo')}</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Field label={t('medecin.profil.specialty')} value={form.specialite} onChange={set('specialite')} />
              <Field label={t('medecin.profil.ordreLabel')} value={user.numeroOrdre} readOnly />
            </div>

            <p className="text-sm font-semibold text-primary-900 dark:text-sable mb-3">{t('medecin.profil.weeklyAvailability')}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {DAYS.map((dayKey) => {
                const active = dispo.some((s) => s.jour === dayKey)
                return (
                  <button
                    key={dayKey}
                    onClick={() => toggleDay(dayKey)}
                    className={`w-12 h-10 rounded-xl text-xs font-bold transition ${active ? 'bg-mint-500 text-white' : 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-sable hover:bg-primary-200'}`}
                  >
                    {t(`medecin.dayShort.${dayKey}`)}
                  </button>
                )
              })}
            </div>

            {dispo.length > 0 && (
              <div className="space-y-2">
                {DAYS.filter((d) => dispo.some((s) => s.jour === d)).map((d) => {
                  const slot = dispo.find((s) => s.jour === d)
                  return (
                    <div key={d} className="flex items-center gap-2 p-2.5 rounded-xl bg-primary-50 dark:bg-primary-900/40">
                      <span className="text-xs font-semibold text-primary-700 dark:text-sable capitalize w-20">{t(`medecin.dayFull.${d}`)}</span>
                      <input
                        type="time"
                        value={slot.debut}
                        onChange={(e) => updateSlot(d, 'debut', e.target.value)}
                        className="px-2 py-1 rounded-lg border border-primary-100 dark:border-white/10 bg-white dark:bg-primary-900 text-sm"
                      />
                      <span className="text-primary-300 text-xs">{t('medecin.profil.to')}</span>
                      <input
                        type="time"
                        value={slot.fin}
                        onChange={(e) => updateSlot(d, 'fin', e.target.value)}
                        className="px-2 py-1 rounded-lg border border-primary-100 dark:border-white/10 bg-white dark:bg-primary-900 text-sm"
                      />
                      <button onClick={() => toggleDay(d)} className="ml-auto p-1.5 rounded-lg text-urgence-500 hover:bg-urgence-100"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-mint-500 hover:bg-mint-700 text-white font-semibold shadow-lg transition disabled:opacity-60"
          >
            <Save className="w-4 h-4" /> {saving ? t('medecin.profil.saving') : t('medecin.profil.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, readOnly }) {
  return (
    <div>
      <label className="text-xs font-semibold text-primary-300 uppercase tracking-wide">{label}</label>
      <input
        value={value || ''}
        onChange={onChange}
        readOnly={readOnly}
        className={`w-full mt-1 px-3 py-2.5 rounded-xl border border-primary-100 dark:border-white/10 bg-white dark:bg-primary-900/40 focus:outline-none focus:ring-2 focus:ring-mint-500 ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
    </div>
  )
}
