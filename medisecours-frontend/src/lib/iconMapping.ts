import { createElement } from 'react'
import {
  Heart,
  HeartCardiogram,
  Lungs,
  Neurology,
  Skeleton,
  Eye,
  Ear,
  Stethoscope,
  Ambulance,
  Pill1,
  Syringe,
  Thermometer,
  Microscope,
  GeneralSurgery,
  BandageAdhesive,
  Baby0203m,
  Burn,
  BloodDrop,
  PpeFaceShield,
  People,
  PulseOximeter,
  Calendar,
  Bacteria,
  Stomach,
  SkinCancer,
  Dna,
  Ribbon,
  Hospital,
  PrescriptionDocument,
  AlertTriangle,
  Allergies,
  MedicalSearch,
  Happy,
  Sad,
  Neutral,
  AwardRibbon,
  Head,
} from 'healthicons-react'

export const iconComponents: Record<string, any> = {
  'heart': Heart,
  'heart-pulse': HeartCardiogram,
  'brain': Neurology,
  'bone': Skeleton,
  'eye': Eye,
  'ear': Ear,
  'stethoscope': Stethoscope,
  'ambulance': Ambulance,
  'pill': Pill1,
  'syringe': Syringe,
  'thermometer': Thermometer,
  'microscope': Microscope,
  'scissors': GeneralSurgery,
  'bandage': BandageAdhesive,
  'baby': Baby0203m,
  'flame': Burn,
  'droplet': BloodDrop,
  'shield': PpeFaceShield,
  'users': People,
  'activity': PulseOximeter,
  'clock': Calendar,
  'bug': Bacteria,
  'air-vent': Lungs,
  'utensils-crossed': Stomach,
  'scan-face': SkinCancer,
  'dna': Dna,
  'ribbon': Ribbon,
  'hospital': Hospital,
  'clipboard-plus': PrescriptionDocument,
  'alert-triangle': AlertTriangle,
  'sparkles': Allergies,
  'search': MedicalSearch,
  'smile': Happy,
  'frown': Sad,
  'meh': Neutral,
  'circle': AwardRibbon,
  'head': Head,
}

export const defaultCategoryIcons: Record<string, string> = {
  'Cardiologie': 'heart',
  'Pneumologie': 'air-vent',
  'Neurologie': 'brain',
  'Gastroentérologie': 'utensils-crossed',
  'Gastro-entérologie': 'utensils-crossed',
  'Orthopédie': 'bone',
  'Ophtalmologie': 'eye',
  'ORL': 'ear',
  'Dermatologie': 'scan-face',
  'Allergologie': 'sparkles',
  'Toxicologie': 'flame',
  'Infectiologie': 'bug',
  'Pédiatrie': 'baby',
  'Médecine générale': 'stethoscope',
  'Urgences vitales': 'ambulance',
  'Traumatologie': 'bandage',
  'Santé maternelle': 'ribbon',
}

export const getIconNameForCategory = (categoryName: string) => {
  if (!categoryName) return 'stethoscope'
  if (defaultCategoryIcons[categoryName]) return defaultCategoryIcons[categoryName]
  const lower = categoryName.toLowerCase()
  for (const [key, value] of Object.entries(defaultCategoryIcons)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return value
  }
  return 'stethoscope'
}

export const getIconComponent = (iconName: string) => {
  if (!iconName) return Stethoscope
  return iconComponents[iconName.toLowerCase()] || Stethoscope
}

export function renderIcon(iconName: string, props: Record<string, any>) {
  return createElement(getIconComponent(iconName), props)
}

export const availableIcons = Object.keys(iconComponents).sort()
