'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  CircleSlash,
  Clock,
  Loader2,
  LocateFixed,
  Phone,
  RotateCcw,
  Send,
  ShieldCheck,
  Siren,
  Stethoscope,
  VideoOff,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/axios'
import { useAuth } from '../../hooks/useAuth'
import type { Position } from '../../hooks/useWayfinding'
import { formatDistanceKm, type SosResult, type SosProche } from '../../lib/carte'

interface SosModalProps {
  open: boolean
  onClose: () => void
  position: Position | null
  onLocate: () => void
  etablissementId?: number | null
  etablissementNom?: string | null
}

type CameraState = 'idle' | 'live' | 'captured' | 'denied' | 'unsupported'

interface SuiviSos {
  id: number
  statut: string
  sireneActive: boolean
  etablissement: { id: number; nom: string; telephone?: string | null } | null
  prisEnChargePar: string | null
  verifieAt: string | null
  resoluAt: string | null
  createdAt: string
}

const STATUTS_TERMINAUX = ['TRAITEE', 'FRAUDULEUSE', 'CLOTUREE']

export default function SosModal({ open, onClose, position, onLocate, etablissementId, etablissementNom }: SosModalProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [telephone, setTelephone] = useState('')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Preuve caméra ────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraAttemptedRef = useRef(false)
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [preuve, setPreuve] = useState<string | null>(null)
  const [sansCamera, setSansCamera] = useState(false)

  // ── Suivi temps réel ─────────────────────────────────────────────────────
  const [sos, setSos] = useState<{ id: number; token: string } | null>(null)
  const [suivi, setSuivi] = useState<SuiviSos | null>(null)
  const [result, setResult] = useState<SosResult | null>(null)

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
        audio: false,
      })
      streamRef.current = stream
      setCameraState('live')
    } catch {
      setCameraState('denied')
    }
  }, [])

  const reset = useCallback(() => {
    stopStream()
    setPreuve(null)
    setSansCamera(false)
    setCameraState('idle')
    setSos(null)
    setSuivi(null)
    setError(null)
    setSending(false)
    setDescription('')
    cameraAttemptedRef.current = false
  }, [stopStream])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  // Auto-démarrage de la caméra à l'ouverture du formulaire.
  useEffect(() => {
    if (!open) {
      cameraAttemptedRef.current = false
      return
    }
    if (cameraAttemptedRef.current || preuve || sansCamera) return
    cameraAttemptedRef.current = true
    void startCamera()
  }, [open, preuve, sansCamera, startCamera])

  // Rattachement du flux vidéo au <video> une fois « live ».
  useEffect(() => {
    if (cameraState === 'live' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      void videoRef.current.play().catch(() => undefined)
    }
  }, [cameraState])

  // Nettoyage à la fermeture / démontage.
  useEffect(() => {
    if (!open) stopStream()
    return () => stopStream()
  }, [open, stopStream])

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return
    const scale = Math.min(1, 960 / video.videoWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    setPreuve(canvas.toDataURL('image/jpeg', 0.72))
    setCameraState('captured')
    stopStream()
  }

  const retakePhoto = () => {
    setPreuve(null)
    setCameraState('idle')
    cameraAttemptedRef.current = false
    void startCamera()
  }

  const cameraBloquee = cameraState === 'denied' || cameraState === 'unsupported'
  const preuveOk = Boolean(preuve) || sansCamera || cameraBloquee

  // ── Envoi ────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!position || !preuveOk) return
    setSending(true)
    setError(null)
    try {
      const { data } = await api.post('/api/demande_sos', {
        latitude: position.lat,
        longitude: position.lng,
        nom: user ? `${user.prenom ?? ''} ${user.nom ?? ''}`.trim() || null : null,
        telephone: telephone.trim() || null,
        description: description.trim() || null,
        etablissementId: etablissementId ?? undefined,
        preuvePhoto: preuve ?? undefined,
        preuveIndisponible: preuve ? undefined : true,
      })
      const brut = data as SosResult & { suiviToken?: string }
      if (brut?.id && brut?.suiviToken) {
        setSos({ id: brut.id, token: brut.suiviToken })
      } else {
        setResult(brut)
      }
    } catch {
      setError(t('visitor.carte.sos.sendError'))
    } finally {
      setSending(false)
    }
  }

  // ── Suivi : sondage léger tant que l'alerte est active ───────────────────
  const terminal = suivi != null && STATUTS_TERMINAUX.includes(suivi.statut)
  useEffect(() => {
    if (!sos || terminal) return
    let annule = false
    const sonder = async () => {
      try {
        const { data } = await api.get(`/api/sos/${sos.id}/suivi`, { params: { token: sos.token } })
        if (!annule && data?.sos) setSuivi(data.sos as SuiviSos)
      } catch {
        // réseau indisponible : on retentera au prochain tour
      }
    }
    void sonder()
    const iv = setInterval(() => void sonder(), 4000)
    return () => {
      annule = true
      clearInterval(iv)
    }
  }, [sos, terminal])

  if (!open) return null

  const afficherSuivi = sos != null
  const statut = suivi?.statut ?? 'EN_COURS'

  const etapes = [
    { cle: 'tlEnvoyee', fait: true, icone: Send },
    {
      cle: 'tlVerification',
      fait: statut !== 'EN_COURS',
      icone: ShieldCheck,
      encours: statut === 'EN_COURS',
    },
    {
      cle: 'tlConfirmee',
      fait: ['VERIFIEE', 'EN_PRISE_EN_CHARGE', 'TRAITEE'].includes(statut),
      icone: Siren,
      encours: false,
      ignore: ['FRAUDULEUSE', 'CLOTUREE'].includes(statut),
    },
    {
      cle: 'tlPrise',
      fait: ['EN_PRISE_EN_CHARGE', 'TRAITEE'].includes(statut),
      icone: Stethoscope,
      encours: statut === 'EN_PRISE_EN_CHARGE',
      ignore: ['FRAUDULEUSE', 'CLOTUREE', 'VERIFIEE'].includes(statut),
    },
    {
      cle: 'tlTerminee',
      fait: statut === 'TRAITEE',
      icone: CheckCircle2,
      encours: false,
      variante: statut === 'FRAUDULEUSE' ? 'erreur' : statut === 'CLOTUREE' ? 'neutre' : undefined,
      ignore: !STATUTS_TERMINAUX.includes(statut) && statut !== 'TRAITEE',
    },
  ]

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('visitor.carte.sos.title')}
    >
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl">
        {/* ── En-tête ─────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-600 dark:text-red-400">
                {t('visitor.carte.sos.eyebrow')}
              </p>
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                {t('visitor.carte.sos.title')}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t('visitor.carte.sos.close')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* ═══ Résultat (sans suivi jeton — repli) ═══ */}
          {result ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/10">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="font-bold text-slate-950 dark:text-white">{t('visitor.carte.sos.successTitle')}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{t('visitor.carte.sos.successDesc')}</p>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                  {t('visitor.carte.sos.nearestTitle')}
                </h3>
                <div className="space-y-2">
                  {(result.proches ?? []).map((proche: SosProche) => (
                    <div
                      key={proche.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-800"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{proche.nom}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {proche.distance != null && `${formatDistanceKm(proche.distance)} · `}
                          {proche.ville || proche.adresse}
                        </p>
                      </div>
                      {proche.telephone && (
                        <a
                          href={`tel:${proche.telephone}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
                          aria-label={t('visitor.carte.sos.callTitle')}
                          title={t('visitor.carte.sos.callTitle')}
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {t('visitor.carte.sos.callNumber', { emergency: '119' })}
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700"
              >
                {t('visitor.carte.sos.newAlerte')}
              </button>
            </div>
          ) : afficherSuivi ? (
            /* ═══ Suivi temps réel ═══ */
            <div className="space-y-4">
              <div
                className={`flex items-start gap-3 rounded-2xl border p-4 ${
                  statut === 'TRAITEE'
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/10'
                    : statut === 'FRAUDULEUSE'
                      ? 'border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10'
                      : 'border-red-200 bg-red-50 dark:border-red-500/25 dark:bg-red-500/10'
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${
                    statut === 'TRAITEE' ? 'bg-emerald-600' : statut === 'FRAUDULEUSE' ? 'bg-amber-500' : 'bg-red-600'
                  }`}
                >
                  {statut === 'TRAITEE' ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : statut === 'FRAUDULEUSE' ? (
                    <CircleSlash className="h-5 w-5" />
                  ) : (
                    <Siren className="h-5 w-5 animate-pulse" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                    {t('visitor.carte.sos.suiviTitle')}
                  </p>
                  <p className="font-bold text-slate-950 dark:text-white">
                    {statut === 'EN_COURS' && t('visitor.carte.sos.suiviWait')}
                    {statut === 'VERIFIEE' && t('visitor.carte.sos.suiviConfirmed')}
                    {statut === 'EN_PRISE_EN_CHARGE' && t('visitor.carte.sos.suiviInProgress')}
                    {statut === 'TRAITEE' && t('visitor.carte.sos.suiviDone')}
                    {statut === 'FRAUDULEUSE' && t('visitor.carte.sos.suiviFake')}
                    {statut === 'CLOTUREE' && t('visitor.carte.sos.suiviClosed')}
                  </p>
                  {suivi?.prisEnChargePar && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {t('visitor.carte.sos.suiviResponder', { nom: suivi.prisEnChargePar })}
                    </p>
                  )}
                  {statut !== 'TRAITEE' && statut !== 'FRAUDULEUSE' && statut !== 'CLOTUREE' && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t('visitor.carte.sos.suiviLive')}
                    </p>
                  )}
                </div>
              </div>

              {/* Frise de progression */}
              <ol className="space-y-0">
                {etapes
                  .filter((etape) => !etape.ignore)
                  .map((etape, index, liste) => {
                    const Icone = etape.icone
                    return (
                      <li key={etape.cle} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                              etape.fait
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : etape.encours
                                  ? 'border-red-500 bg-red-50 text-red-600 animate-pulse'
                                  : 'border-slate-200 bg-white text-slate-400 dark:border-white/15 dark:bg-slate-900'
                            } ${etape.variante === 'erreur' ? 'border-amber-500 bg-amber-500 text-white' : ''}`}
                          >
                            <Icone className="h-4 w-4" />
                          </span>
                          {index < liste.length - 1 && (
                            <span
                              className={`my-1 w-0.5 flex-1 ${etape.fait ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-white/10'}`}
                            />
                          )}
                        </div>
                        <p
                          className={`pb-3 text-sm ${
                            etape.fait
                              ? 'font-semibold text-slate-800 dark:text-slate-100'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {t(`visitor.carte.sos.${etape.cle}`)}
                        </p>
                      </li>
                    )
                  })}
              </ol>

              {/* Contact établissement */}
              {suivi?.etablissement && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-800">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {suivi.etablissement.nom}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('visitor.carte.sos.targetLabel')}</p>
                  </div>
                  {suivi.etablissement.telephone && (
                    <a
                      href={`tel:${suivi.etablissement.telephone}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
                      aria-label={t('visitor.carte.sos.callTitle')}
                      title={t('visitor.carte.sos.callTitle')}
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}

              <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                {t('visitor.carte.sos.callNumber', { emergency: '119' })}
              </p>

              <button
                type="button"
                onClick={reset}
                className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700"
              >
                {t('visitor.carte.sos.newAlerte')}
              </button>
            </div>
          ) : !position ? (
            /* ═══ Pas de position ═══ */
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                <LocateFixed className="h-8 w-8" />
              </span>
              <div>
                <p className="font-bold text-slate-950 dark:text-white">{t('visitor.carte.sos.noPositionTitle')}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('visitor.carte.sos.noPositionDesc')}</p>
              </div>
              <button
                type="button"
                onClick={onLocate}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-700"
              >
                <LocateFixed className="h-4 w-4" />
                {t('visitor.carte.sos.locateCta')}
              </button>
            </div>
          ) : (
            /* ═══ Formulaire + preuve caméra ═══ */
            <div className="space-y-4">
              {/* Établissement ciblé */}
              <div className="rounded-xl border border-primary-100 bg-primary-50/60 px-3 py-2.5 dark:border-primary-400/20 dark:bg-primary-400/10">
                <p className="text-[11px] font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                  {t('visitor.carte.sos.targetLabel')}
                </p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {etablissementNom ?? t('visitor.carte.sos.targetAuto')}
                </p>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300">{t('visitor.carte.sos.description')}</p>

              {/* Preuve caméra */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-800/60">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      <Camera className="mr-1 inline h-3.5 w-3.5" />
                      {t('visitor.carte.sos.cameraTitle')}
                    </p>
                    <p className="text-xs leading-4 text-slate-500 dark:text-slate-400">
                      {t('visitor.carte.sos.cameraDesc')}
                    </p>
                  </div>
                  {preuve && (
                    <button
                      type="button"
                      onClick={retakePhoto}
                      className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t('visitor.carte.sos.cameraRetake')}
                    </button>
                  )}
                </div>

                {preuve ? (
                  <div className="relative overflow-hidden rounded-xl border border-emerald-300 dark:border-emerald-500/40">
                    {/* eslint-disable-next-line @next/next/no-img-element -- aperçu base64 de la capture caméra */}
                    <img src={preuve} alt={t('visitor.carte.sos.cameraCaptured')} className="max-h-48 w-full object-cover" />
                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold uppercase text-white">
                      <CheckCircle2 className="h-3 w-3" />
                      {t('visitor.carte.sos.cameraCaptured')}
                    </span>
                  </div>
                ) : cameraState === 'live' ? (
                  <div className="relative overflow-hidden rounded-xl border border-slate-300 dark:border-white/15">
                    <video ref={videoRef} playsInline muted autoPlay className="max-h-48 w-full bg-black object-cover" />
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-900 shadow-lg transition hover:bg-slate-100"
                    >
                      <Camera className="h-4 w-4" />
                      {t('visitor.carte.sos.cameraCapture')}
                    </button>
                  </div>
                ) : cameraBloquee || sansCamera ? (
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-dashed border-slate-300 bg-white p-3 dark:border-white/15 dark:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={sansCamera}
                      onChange={(event) => setSansCamera(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                        <VideoOff className="h-3.5 w-3.5" />
                        {cameraBloquee ? t('visitor.carte.sos.cameraDenied') : t('visitor.carte.sos.noCameraLabel')}
                      </span>
                      {cameraState === 'denied' && <>{t('visitor.carte.sos.cameraDeniedDesc')}</>}
                      {cameraState === 'unsupported' && <>{t('visitor.carte.sos.cameraUnsupported')}</>}
                      {!cameraBloquee && <>{t('visitor.carte.sos.noCameraHint')}</>}
                    </span>
                  </label>
                ) : (
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Camera className="h-4 w-4" />
                    {t('visitor.carte.sos.cameraEnable')}
                  </button>
                )}
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('visitor.carte.sos.telephoneLabel')}
                </span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={telephone}
                  onChange={(event) => setTelephone(event.target.value)}
                  placeholder={user?.telephone || '+237 …'}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('visitor.carte.sos.descriptionLabel')}
                </span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t('visitor.carte.sos.descriptionPlaceholder')}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                />
              </label>

              {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !preuveOk}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? t('visitor.carte.sos.sending') : t('visitor.carte.sos.send')}
              </button>
              {!preuveOk && (
                <p className="-mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
                  {t('visitor.carte.sos.cameraRequired')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
