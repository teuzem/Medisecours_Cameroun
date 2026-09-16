import api from './axios'

export const importMedecins = (formData: FormData, onUploadProgress?: (progressEvent: any) => void) => {
  return api.post('/api/admin/import/medecins', formData, {
    onUploadProgress,
  })
}

export const getImportTemplate = () => {
  return api.get('/api/admin/import/medecins/template', { responseType: 'blob' })
}

export const importCentres = (formData: FormData, onUploadProgress?: (progressEvent: any) => void) => {
  return api.post('/api/admin/import/centres', formData, {
    onUploadProgress,
  })
}

export const getCentreImportTemplate = () => {
  return api.get('/api/admin/import/centres/template', { responseType: 'blob' })
}

export const uploadCentreImages = (centreId: number, files: FileList, onUploadProgress?: (progressEvent: any) => void) => {
  const formData = new FormData()
  Array.from(files).forEach((f: File) => formData.append('files[]', f))
  return api.post(`/api/admin/centres/${centreId}/images`, formData, {
    onUploadProgress,
  })
}

export const deleteCentreImage = (centreId: number, imageId: number) => {
  return api.delete(`/api/admin/centres/${centreId}/images/${imageId}`)
}

export const updateCentre = (id: number, data: Record<string, unknown>) => {
  return api.patch(`/api/centre_de_santes/${id}`, data)
}

export const deleteCentre = (id: number) => {
  return api.delete(`/api/centre_de_santes/${id}`)
}

export const getAdminProtocols = (params?: {
  page?: number
  itemsPerPage?: number
  q?: string
  status?: 'BROUILLON' | 'EN_REVUE' | 'PUBLIE' | 'RETIRE'
}) => {
  return api.get('/api/admin/protocoles', { params })
}

export const updateProtocolStatus = (
  id: number,
  data: {
    statut: 'BROUILLON' | 'EN_REVUE' | 'PUBLIE' | 'RETIRE'
    sourceClinique?: string
    commentaire?: string
  }
) => {
  return api.patch(`/api/admin/protocoles/${id}/statut`, data)
}

export const getProtocolVersions = (slug: string) => {
  return api.get(`/api/admin/protocoles/versions/by-slug/${encodeURIComponent(slug)}`)
}

export const createNextProtocolVersion = (id: number) => {
  return api.post(`/api/admin/protocoles/${id}/versions`)
}

export const getProtocolObservability = () => {
  return api.get('/api/admin/protocoles/observabilite')
}
