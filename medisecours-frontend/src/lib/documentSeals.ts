/**
 * Sceaux officiels des documents administratifs.
 *
 * - MySignature : signature numérique de l'utilisateur connecté (médecin ou dirigeant).
 * - EstablishmentSeal : logo + cachet + dirigeant d'un établissement.
 * - buildPrintSealsHtml : bloc HTML (cachet + signature) pour l'impression
 *   des rapports de consultation — même positionnement que le monde réel :
 *   cachet à gauche, signature à droite au-dessus de la ligne.
 */
import useSWR from 'swr'
import { fetcher } from './fetcher'
import { ME_SIGNATURE_KEY, DOCUMENT_SEAUX_KEY } from './keys'

export type MySignature = {
  id: number
  imageData: string
  hash: string
  hashShort: string
  grade: string | null
  signedAt: string
  prenom: string | null
  nom: string | null
}

export type DirigeantSignature = {
  imageData: string
  hashShort: string
  signedAt: string
}

export type EstablishmentSeal = {
  centreId: number
  nom: string
  type?: string
  ville?: string | null
  telephone?: string | null
  logoUrl?: string | null
  cachetUrl?: string | null
  dirigeantNom?: string | null
  dirigeantGrade?: string | null
  dirigeantSignature?: DirigeantSignature | null
}

export function useMySignature() {
  const { data, mutate } = useSWR<MySignature | null>(ME_SIGNATURE_KEY, fetcher, {
    revalidateOnFocus: false,
  })
  return { signature: data ?? null, mutate }
}

export function useDocumentSeals(centreId?: number | null) {
  const key = centreId ? `${DOCUMENT_SEAUX_KEY}?centre=${centreId}` : DOCUMENT_SEAUX_KEY
  const { data } = useSWR<{ seaux: EstablishmentSeal[] }>(key, fetcher, {
    revalidateOnFocus: false,
  })
  const seaux = data?.seaux ?? []
  return { seaux, seal: centreId ? seaux[0] ?? null : null }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Bloc HTML des sceaux pour l'impression (rapport de consultation).
 * Cachet/logo à gauche, signature médecin à droite, cadre dirigeant
 * centré en dessous quand la signature officielle est enregistrée.
 */
export function buildPrintSealsHtml(options: {
  medecinPrenom?: string | null
  medecinNom?: string | null
  medecinSignature?: MySignature | null
  seal?: EstablishmentSeal | null
  labels: {
    signatureMedecin: string
    cachetOfficiel: string
    signeElectroniquement: string
    dirigeant: string
  }
}): string {
  const { medecinPrenom, medecinNom, medecinSignature, seal, labels } = options
  const doctorName = `Dr. ${medecinPrenom ?? ''} ${medecinNom ?? ''}`.trim()

  const cachet = seal?.cachetUrl
    ? `<img src="${seal.cachetUrl}" alt="Cachet" style="max-height:100px;max-width:150px;">`
    : seal?.logoUrl && seal.logoUrl.startsWith('data:')
      ? `<img src="${seal.logoUrl}" alt="Logo" style="max-height:72px;max-width:120px;">`
      : ''
  const etabBlock = seal
    ? `<div style="font-size:12px;font-weight:700;color:#1E3A5F;margin-top:4px;">${escapeHtml(seal.nom ?? '')}</div>
       ${seal.ville ? `<div style="font-size:10px;color:#6B7280;">${escapeHtml(seal.ville)}</div>` : ''}
       <div style="font-size:9px;color:#9CA3AF;">${labels.cachetOfficiel}</div>`
    : ''

  const signatureImg = medecinSignature?.imageData
    ? `<img src="${medecinSignature.imageData}" alt="Signature" style="max-height:56px;max-width:180px;">`
    : ''
  const grade = medecinSignature?.grade ? `${escapeHtml(medecinSignature.grade)} ` : ''
  const hashLine = medecinSignature
    ? `<div style="font-size:9px;color:#9CA3AF;margin-top:2px;">${labels.signeElectroniquement} — ${escapeHtml(medecinSignature.hashShort)}</div>`
    : ''

  const dirigeantBlock =
    seal?.dirigeantNom && seal.dirigeantSignature
      ? `<div style="margin-top:28px;text-align:center;">
          ${seal.dirigeantSignature.imageData ? `<img src="${seal.dirigeantSignature.imageData}" alt="" style="max-height:48px;max-width:160px;">` : ''}
          <div style="width:180px;border-top:1px solid #333;margin:4px auto;"></div>
          <div style="font-size:11px;font-weight:700;color:#555;">${labels.dirigeant}</div>
          <div style="font-size:12px;font-weight:700;color:#333;">${escapeHtml(seal.dirigeantNom)}${seal.dirigeantGrade ? ` — ${escapeHtml(seal.dirigeantGrade)}` : ''}</div>
        </div>`
      : ''

  return `<div style="margin-top:36px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px;">
    <div style="text-align:left;">${cachet}${etabBlock}</div>
    <div style="text-align:right;">
      ${signatureImg}
      <div style="width:180px;border-top:1px solid #333;margin:4px 0 4px auto;"></div>
      <div style="font-size:11px;font-weight:700;color:#555;">${labels.signatureMedecin}</div>
      <div style="font-size:12px;font-weight:700;color:#333;">${grade}${escapeHtml(doctorName)}</div>
      ${hashLine}
    </div>
  </div>${dirigeantBlock}`
}
