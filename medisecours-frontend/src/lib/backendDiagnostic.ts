import api from '@/api/axios'

/**
 * Diagnostic d'un backend qui ne répond pas correctement.
 *
 * La sonde `/api/health` distingue les deux causes réelles d'un échec de
 * chargement :
 *  - base injoignable (503, « database unreachable ») ;
 *  - base joignable mais schéma incomplet (200 « degraded », liste des objets
 *    manquants) — c'est la cause qui produit un « Impossible de charger les
 *    centres de santé » alors que la base répond.
 *
 * Le message renvoyé est directement exploitable par un exploitant, sans
 * ouvrir les journaux du serveur.
 */
export async function diagnostiquerBackend(): Promise<string> {
  try {
    const { data } = await api.get('/api/health', { timeout: 8000 })

    if (data?.status === 'ok') {
      return 'Erreur de chargement des centres de santé. Réessayez dans un instant.'
    }

    const problems: string[] = Array.isArray(data?.problems) ? data.problems : []

    if (data?.services?.database === 'error' || problems.includes('database unreachable')) {
      return 'Base de données injoignable : le service est temporairement indisponible. Réessayez dans quelques instants.'
    }

    if (problems.length > 0) {
      return `Base de données en service mais schéma incomplet (${problems.join(', ')}). L'équipe technique doit exécuter : php bin/console app:repair-schema --env=prod`
    }

    return 'Le service répond avec une erreur. Réessayez dans un instant.'
  } catch {
    return 'Service indisponible : le backend ne répond pas. Réessayez dans quelques instants.'
  }
}
