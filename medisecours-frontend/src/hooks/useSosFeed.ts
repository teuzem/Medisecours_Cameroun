'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import api from '../api/axios'
import { useNotification } from '../contexts/NotificationContext'
import { messageErreur, type AlerteSos, type SosStatsMoi } from '../lib/sosWorkflow'

/**
 * Source de vérité temps réel des tableaux de bord ambulance et médecin.
 *
 * Deux niveaux de fraîcheur :
 *  1. WebSocket (`subscribeToSos`) — pushed à chaque transition ;
 *  2. Polling de secours — une connexion socket coupée ne doit jamais laisser
 *     une ambulance devant une liste périmée.
 */
const INTERVALLE_MS = 20_000

export function useSosFeed(url: string) {
  const { subscribeToSos } = useNotification()
  const [ouvertes, setOuvertes] = useState<AlerteSos[]>([])
  const [mesPrises, setMesPrises] = useState<AlerteSos[]>([])
  const [stats, setStats] = useState<SosStatsMoi | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(false)
  const [rafraichissement, setRafraichissement] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const charger = useCallback(
    async (silencieux = false) => {
      if (silencieux) setRafraichissement(true)
      try {
        const { data } = await api.get(url)
        if (!mounted.current) return
        setOuvertes(Array.isArray(data?.ouvertes) ? data.ouvertes : [])
        setMesPrises(Array.isArray(data?.mesPrises) ? data.mesPrises : [])
        setErreur(false)
      } catch {
        if (mounted.current) setErreur(true)
      } finally {
        if (mounted.current) {
          setLoading(false)
          setRafraichissement(false)
        }
      }
    },
    [url],
  )

  const chargerStats = useCallback(async () => {
    try {
      const { data } = await api.get('/api/sos/stats/moi')
      if (mounted.current) setStats(data as SosStatsMoi)
    } catch {
      // Un tableau de bord partiel vaut mieux qu'un écran vide : les compteurs
      // restent à zéro, les alertes s'affichent toujours.
    }
  }, [])

  useEffect(() => {
    // Chargement initial : la sortie de l'état « loading » est le seul setState
    // synchrone ici, il n'a pas d'autre moyen d'être déclenché.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger()
    void chargerStats()
  }, [charger, chargerStats])

  useEffect(() => {
    return subscribeToSos(() => {
      void charger(true)
      void chargerStats()
    })
  }, [subscribeToSos, charger, chargerStats])

  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void charger(true)
      void chargerStats()
    }, INTERVALLE_MS)

    const onVisible = () => {
      if (typeof document === 'undefined' || document.hidden) return
      void charger(true)
      void chargerStats()
    }
    document?.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(timer)
      document?.removeEventListener('visibilitychange', onVisible)
    }
  }, [charger, chargerStats])

  const rafraichir = useCallback(async () => {
    await Promise.all([charger(), chargerStats()])
  }, [charger, chargerStats])

  return { ouvertes, mesPrises, stats, loading, erreur, rafraichissement, rafraichir }
}

/** Messages d'erreur et de succès d'une action, avec traduction. */
export function useSosFeedback() {
  const { t } = useTranslation()
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)

  const signalerErreur = useCallback(
    (err: unknown, cle: string) => setErreur(messageErreur(err, t(cle))),
    [t],
  )
  const signalerSucces = useCallback((message: string | null) => {
    setErreur(null)
    setSucces(message)
  }, [])
  const reinitialiser = useCallback(() => {
    setErreur(null)
    setSucces(null)
  }, [])

  return { erreur, succes, signalerErreur, signalerSucces, reinitialiser }
}