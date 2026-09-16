export type FirstAidUrgency = 'FAIBLE' | 'MOYEN' | 'ELEVE' | 'CRITIQUE'

export interface FirstAidStep {
  position: number
  type: string
  titre: string | null
  instruction: string
}

export interface FirstAidCategory {
  slug: string
  label: string
  count: number
}

/** DTO public expose par /api/public/first-aid-protocols. */
export interface FirstAidProtocol {
  slug: string
  titre: string
  categorie: string | null
  masterSlug: string | null
  variantKey: string | null
  niveauUrgence: FirstAidUrgency
  population: string
  version: string
  sourceClinique: string | null
  restrictionsPopulations: string | null
  etapes: FirstAidStep[]
}

export interface FirstAidSearchResponse {
  query: string
  results: FirstAidProtocol[]
  suggestions: string[]
}

export interface FirstAidPaginatedResponse {
  items: FirstAidProtocol[]
  total: number
  page: number
  itemsPerPage: number
  totalPages: number
}
