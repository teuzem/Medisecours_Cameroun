import reference from '../data/cameroon-administrative-divisions.json'

export type CameroonRegion = {
  id: string
  nameLocal: string
  nameEn: string
  lat?: number
  lon?: number
}

export type CameroonDepartment = CameroonRegion & {
  regionId: string
}

export type CameroonArrondissement = CameroonRegion & {
  departmentId: string
  regionId: string
}

type Reference = {
  regions: CameroonRegion[]
  departments: CameroonDepartment[]
  arrondissements: CameroonArrondissement[]
}

const data = reference as Reference

export const CAMEROON_REGIONS = data.regions
export const CAMEROON_DEPARTMENTS = data.departments
export const CAMEROON_ARRONDISSEMENTS = data.arrondissements

export const CAMEROON_BOUNDS = {
  minLatitude: 1.5,
  maxLatitude: 13.5,
  minLongitude: 8,
  maxLongitude: 16.5,
}

export function isCameroonCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= CAMEROON_BOUNDS.minLatitude
    && latitude <= CAMEROON_BOUNDS.maxLatitude
    && longitude >= CAMEROON_BOUNDS.minLongitude
    && longitude <= CAMEROON_BOUNDS.maxLongitude
}

export function normalizeGeographySearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
}

export function matchesGeography(item: { nameLocal: string; nameEn: string }, query: string) {
  const normalized = normalizeGeographySearch(query)
  if (!normalized) return true
  return normalizeGeographySearch(item.nameLocal).includes(normalized)
    || normalizeGeographySearch(item.nameEn).includes(normalized)
}

export function findRegion(value: string) {
  const normalized = normalizeGeographySearch(value)
  return CAMEROON_REGIONS.find((item) =>
    item.id === value
    || normalizeGeographySearch(item.nameLocal) === normalized
    || normalizeGeographySearch(item.nameEn) === normalized
  )
}

export function findDepartment(value: string, regionId?: string) {
  const normalized = normalizeGeographySearch(value)
  return CAMEROON_DEPARTMENTS.find((item) =>
    (!regionId || item.regionId === regionId)
    && (item.id === value
      || normalizeGeographySearch(item.nameLocal) === normalized
      || normalizeGeographySearch(item.nameEn) === normalized)
  )
}

export function findArrondissement(value: string, departmentId?: string) {
  const normalized = normalizeGeographySearch(value)
  return CAMEROON_ARRONDISSEMENTS.find((item) =>
    (!departmentId || item.departmentId === departmentId)
    && (item.id === value
      || normalizeGeographySearch(item.nameLocal) === normalized
      || normalizeGeographySearch(item.nameEn) === normalized)
  )
}

export function resolveGeographyNames(input: {
  region?: string
  department?: string
  arrondissement?: string
}) {
  const region = findRegion(input.region ?? '')
  const department = findDepartment(input.department ?? '', region?.id)
  const arrondissement = findArrondissement(input.arrondissement ?? '', department?.id)
  return {
    region,
    department,
    arrondissement,
  }
}

