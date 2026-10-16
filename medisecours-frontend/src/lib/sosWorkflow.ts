import api from '../api/axios'

export type EtapeIntervention = 'DEPART' | 'SUR_PLACE' | 'TRANSPORT'

export interface AlerteSos {
  id: number
  statut: string
  gravite: string
  agePatient: number | null
  enceinte: boolean
  urgenceVitale?: boolean
  nom: string | null
  telephone: string | null
  description: string | null
  latitude: number | number[] | null
  longitude: number | number[] | null
  sireneActive: boolean
  preuvePhoto: string | null
  /** Nature de la preuve renvoyée par l'API : évite de renifler la data-URL. */
  preuveType?: 'PHOTO' | 'VIDEO' | null
  etablissement: { id: number; nom: string } | null
  prisEnChargePar: { id: string; nom: string } | null
  prisEnChargeAt?: string | null
  priseEnChargeType?: string | null
  departAt?: string | null
  arriveeAt?: string | null
  patientEmbarqueAt?: string | null
  noteIntervention?: string | null
  resoluAt?: string | null
  createdAt: string
  habilitation?: string
}

export interface SosStatsMoi {
  total: number
  enCours: number
  traitees: number
  parGravite: Record<string, number>
  delaiMoyenPriseEnChargeSec: number | null
  delaiMoyenDepartSec: number | null
  delaiMoyenArriveeSec: number | null
}

export interface SosTraceRow {
  id: number
  action: string
  auteur: { id: string; nom: string; prenom: string | null } | null
  details: Record<string, unknown> | null
  createdAt: string
}

/** Étape suivante attendue d'un intervenant, ou null si l'intervention est finie. */
export function etapeSuivante(sos: Pick<AlerteSos, 'departAt' | 'arriveeAt' | 'patientEmbarqueAt'>): EtapeIntervention | null {
  if (!sos.departAt) return 'DEPART'
  if (!sos.arriveeAt) return 'SUR_PLACE'
  if (!sos.patientEmbarqueAt) return 'TRANSPORT'
  return null
}

export function messageErreur(err: unknown, defaut: string): string {
  const data = (err as { response?: { data?: { detail?: string; message?: string; error?: string } } })?.response?.data
  return data?.detail || data?.message || data?.error || defaut
}

/** Fait avancer l'intervention d'une étape (départ, arrivée, transport). */
export async function avancerIntervention(sosId: number, etape: EtapeIntervention, note?: string): Promise<AlerteSos> {
  const { data } = await api.post(`/api/sos/${sosId}/avancement`, note ? { etape, note } : { etape })
  return data?.sos as AlerteSos
}

export async function cloturerAlerte(sosId: number, motif?: string): Promise<AlerteSos> {
  const { data } = await api.post(`/api/sos/${sosId}/cloturer`, motif ? { motif } : {})
  return data?.sos as AlerteSos
}

/** Durée écoulée depuis une date ISO, en unités lisibles (45 s, 3 min, 2 h 10). */
export function duree(iso: string | null | undefined, maintenant = Date.now()): string | null {
  if (!iso) return null
  const debut = new Date(iso).getTime()
  if (Number.isNaN(debut)) return null
  const secondes = Math.max(0, Math.round((maintenant - debut) / 1000))
  if (secondes < 60) return `${secondes} s`
  const minutes = Math.floor(secondes / 60)
  if (minutes < 60) return `${minutes} min`
  const heures = Math.floor(minutes / 60)
  return `${heures} h ${String(minutes % 60).padStart(2, '0')}`
}

/** Secondes → format lisible, pour les délais moyens du tableau de bord. */
export function secondesLisible(secondes: number | null | undefined): string | null {
  if (secondes == null || !Number.isFinite(secondes)) return null
  if (secondes < 60) return `${Math.round(secondes)} s`
  const minutes = Math.round(secondes / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}