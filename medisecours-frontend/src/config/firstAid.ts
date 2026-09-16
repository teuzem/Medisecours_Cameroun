export const EMERGENCY_NUMBER = process.env.NEXT_PUBLIC_EMERGENCY_NUMBER || '119'
export const EMERGENCY_NUMBER_LABEL = process.env.NEXT_PUBLIC_EMERGENCY_NUMBER_LABEL || 'Numéro d\u2019urgence'

/** Durée de validité du cache hors-ligne des premiers soins (en ms). */
export const FIRST_AID_OFFLINE_TTL = 1000 * 60 * 60 * 24 // 24 h

export function emergencyCallHref(number: string = EMERGENCY_NUMBER): string {
  return `tel:${number.replace(/[^0-9+]/g, '')}`
}
