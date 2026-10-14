import api from '../api/axios'
import type { Avis } from './carte'

/**
 * Vote « J'aime » sur un avis d'établissement.
 *
 * L'état est renvoyé par l'API (`aime`, `nbJaime`) : le compteur affiché
 * vient toujours du serveur, jamais d'un calcul local, pour qu'un double
 * clic ou deux onglets ne puissent pas gonfler le total.
 */
export async function setAvisLike(avisId: number, aime: boolean): Promise<{ aime: boolean; nbJaime: number }> {
  const response = aime
    ? await api.post(`/api/avis/${avisId}/jaime`, { aime: true })
    : await api.delete(`/api/avis/${avisId}/jaime`)

  return {
    aime: Boolean(response.data?.aime),
    nbJaime: Number.isFinite(Number(response.data?.nbJaime)) ? Number(response.data?.nbJaime) : 0,
  }
}

/** État affiché du bouton « J'aime » : réponse serveur, ou optimiste si en vol. */
export function avisLikeState(
  review: Pick<Avis, 'nbJaime' | 'aimeParMoi'>,
  override?: { aime: boolean; nbJaime: number },
): { aime: boolean; nbJaime: number } {
  if (override) return override
  return {
    aime: Boolean(review.aimeParMoi),
    nbJaime: Number.isFinite(Number(review.nbJaime)) ? Number(review.nbJaime) : 0,
  }
}