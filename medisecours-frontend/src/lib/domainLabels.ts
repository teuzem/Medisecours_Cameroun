/**
 * Libellés d'affichage pour les valeurs d'énumération métier.
 *
 * Les valeurs stockées/échangées avec l'API restent en français
 * (ex. « SÉVÈRE ») ; ce helper donne la clé i18n à utiliser pour
 * l'affichage, dans n'importe quelle locale.
 */
const SEVERITY_I18N: Record<string, string> = {
  'LÉGÈRE': 'common.severity.leger',
  'MODÉRÉE': 'common.severity.moderee',
  'SÉVÈRE': 'common.severity.severe',
  'CRITIQUE': 'common.severity.critique',
  'VARIABLE': 'common.severity.variable',
}

/** Clé i18n correspondant au niveau de gravité, ou `null` si inconnu. */
export function severityLabelKey(level?: string | null): string | null {
  if (!level) return null
  return SEVERITY_I18N[level.toUpperCase()] ?? null
}
