export type FacilityOptionGroup =
  | 'accessibility'
  | 'payment'
  | 'insurance'
  | 'evacuation'
  | 'roadAccess'
  | 'parking'
  | 'languages'

export type FacilityOption = {
  id: string
  labelKey: string
}

export const FACILITY_OPTION_GROUPS: Record<FacilityOptionGroup, FacilityOption[]> = {
  accessibility: [
    { id: 'wheelchair_entrance', labelKey: 'etablissement.options.accessibility.wheelchairEntrance' },
    { id: 'wheelchair_parking', labelKey: 'etablissement.options.accessibility.wheelchairParking' },
    { id: 'accessible_toilets', labelKey: 'etablissement.options.accessibility.accessibleToilets' },
    { id: 'accessible_elevator', labelKey: 'etablissement.options.accessibility.accessibleElevator' },
    { id: 'ramps', labelKey: 'etablissement.options.accessibility.ramps' },
    { id: 'tactile_guidance', labelKey: 'etablissement.options.accessibility.tactileGuidance' },
    { id: 'braille_signage', labelKey: 'etablissement.options.accessibility.brailleSignage' },
    { id: 'hearing_loop', labelKey: 'etablissement.options.accessibility.hearingLoop' },
    { id: 'sign_language', labelKey: 'etablissement.options.accessibility.signLanguage' },
    { id: 'visual_guidance', labelKey: 'etablissement.options.accessibility.visualGuidance' },
    { id: 'priority_counter', labelKey: 'etablissement.options.accessibility.priorityCounter' },
    { id: 'assistance_animal', labelKey: 'etablissement.options.accessibility.assistanceAnimal' },
    { id: 'accessible_transport', labelKey: 'etablissement.options.accessibility.accessibleTransport' },
    { id: 'caregiver_support', labelKey: 'etablissement.options.accessibility.caregiverSupport' },
    { id: 'accessible_waiting_area', labelKey: 'etablissement.options.accessibility.accessibleWaitingArea' },
    { id: 'accessible_exam_room', labelKey: 'etablissement.options.accessibility.accessibleExamRoom' },
    { id: 'accessible_pharmacy', labelKey: 'etablissement.options.accessibility.accessiblePharmacy' },
    { id: 'accessible_signage', labelKey: 'etablissement.options.accessibility.accessibleSignage' },
    { id: 'accessible_emergency_entry', labelKey: 'etablissement.options.accessibility.accessibleEmergencyEntry' },
    { id: 'accessible_online_information', labelKey: 'etablissement.options.accessibility.accessibleOnlineInformation' },
  ],
  payment: [
    { id: 'cash', labelKey: 'etablissement.options.payment.cash' },
    { id: 'bank_card', labelKey: 'etablissement.options.payment.bankCard' },
    { id: 'mobile_money_mtn', labelKey: 'etablissement.options.payment.mobileMoneyMtn' },
    { id: 'mobile_money_orange', labelKey: 'etablissement.options.payment.mobileMoneyOrange' },
    { id: 'bank_transfer', labelKey: 'etablissement.options.payment.bankTransfer' },
    { id: 'online_payment', labelKey: 'etablissement.options.payment.onlinePayment' },
    { id: 'advance_payment', labelKey: 'etablissement.options.payment.advancePayment' },
    { id: 'installments', labelKey: 'etablissement.options.payment.installments' },
    { id: 'mobile_money_both', labelKey: 'etablissement.options.payment.mobileMoneyBoth' },
    { id: 'health_savings', labelKey: 'etablissement.options.payment.healthSavings' },
    { id: 'employer_sponsorship', labelKey: 'etablissement.options.payment.employerSponsorship' },
    { id: 'ngo_sponsorship', labelKey: 'etablissement.options.payment.ngoSponsorship' },
    { id: 'cashless_payment', labelKey: 'etablissement.options.payment.cashlessPayment' },
  ],
  insurance: [
    { id: 'public_insurance', labelKey: 'etablissement.options.insurance.publicInsurance' },
    { id: 'private_insurance', labelKey: 'etablissement.options.insurance.privateInsurance' },
    { id: 'mutual', labelKey: 'etablissement.options.insurance.mutual' },
    { id: 'third_party_payment', labelKey: 'etablissement.options.insurance.thirdPartyPayment' },
    { id: 'insurance_pre_authorization', labelKey: 'etablissement.options.insurance.preAuthorization' },
    { id: 'cnam_coverage', labelKey: 'etablissement.options.insurance.cnamCoverage' },
    { id: 'community_mutual', labelKey: 'etablissement.options.insurance.communityMutual' },
    { id: 'employer_coverage', labelKey: 'etablissement.options.insurance.employerCoverage' },
    { id: 'ngo_coverage', labelKey: 'etablissement.options.insurance.ngoCoverage' },
    { id: 'indigent_care', labelKey: 'etablissement.options.insurance.indigentCare' },
  ],
  evacuation: [
    { id: 'interfacility_transfer', labelKey: 'etablissement.options.evacuation.interfacilityTransfer' },
    { id: 'ambulance_transfer', labelKey: 'etablissement.options.evacuation.ambulanceTransfer' },
    { id: 'medical_escort', labelKey: 'etablissement.options.evacuation.medicalEscort' },
    { id: 'neonatal_transfer', labelKey: 'etablissement.options.evacuation.neonatalTransfer' },
    { id: 'maternal_transfer', labelKey: 'etablissement.options.evacuation.maternalTransfer' },
    { id: 'critical_care_transfer', labelKey: 'etablissement.options.evacuation.criticalCareTransfer' },
    { id: 'referral_network', labelKey: 'etablissement.options.evacuation.referralNetwork' },
    { id: 'air_medical_coordination', labelKey: 'etablissement.options.evacuation.airMedicalCoordination' },
    { id: 'ground_ambulance_24h', labelKey: 'etablissement.options.evacuation.groundAmbulance24h' },
    { id: 'interregional_transfer', labelKey: 'etablissement.options.evacuation.interregionalTransfer' },
    { id: 'cross_border_transfer', labelKey: 'etablissement.options.evacuation.crossBorderTransfer' },
    { id: 'helipad_coordination', labelKey: 'etablissement.options.evacuation.helipadCoordination' },
  ],
  roadAccess: [
    { id: 'paved_road', labelKey: 'etablissement.options.roadAccess.pavedRoad' },
    { id: 'all_weather_access', labelKey: 'etablissement.options.roadAccess.allWeatherAccess' },
    { id: 'public_transport_nearby', labelKey: 'etablissement.options.roadAccess.publicTransportNearby' },
    { id: 'emergency_vehicle_access', labelKey: 'etablissement.options.roadAccess.emergencyVehicleAccess' },
    { id: 'night_access', labelKey: 'etablissement.options.roadAccess.nightAccess' },
    { id: 'ambulance_dropoff', labelKey: 'etablissement.options.roadAccess.ambulanceDropoff' },
    { id: 'rainy_season_access', labelKey: 'etablissement.options.roadAccess.rainySeasonAccess' },
    { id: 'gps_signage', labelKey: 'etablissement.options.roadAccess.gpsSignage' },
    { id: 'helipad_road_link', labelKey: 'etablissement.options.roadAccess.helipadRoadLink' },
  ],
  parking: [
    { id: 'onsite_parking', labelKey: 'etablissement.options.parking.onsiteParking' },
    { id: 'free_parking', labelKey: 'etablissement.options.parking.freeParking' },
    { id: 'paid_parking', labelKey: 'etablissement.options.parking.paidParking' },
    { id: 'secure_parking', labelKey: 'etablissement.options.parking.secureParking' },
    { id: 'motorcycle_parking', labelKey: 'etablissement.options.parking.motorcycleParking' },
    { id: 'accessible_spaces', labelKey: 'etablissement.options.parking.accessibleSpaces' },
    { id: 'ambulance_bay', labelKey: 'etablissement.options.parking.ambulanceBay' },
    { id: 'patient_dropoff', labelKey: 'etablissement.options.parking.patientDropoff' },
    { id: 'bicycle_parking', labelKey: 'etablissement.options.parking.bicycleParking' },
  ],
  languages: [
    { id: 'french', labelKey: 'etablissement.options.languages.french' },
    { id: 'english', labelKey: 'etablissement.options.languages.english' },
    { id: 'fulfulde', labelKey: 'etablissement.options.languages.fulfulde' },
    { id: 'ewondo', labelKey: 'etablissement.options.languages.ewondo' },
    { id: 'duala', labelKey: 'etablissement.options.languages.duala' },
    { id: 'pidgin_english', labelKey: 'etablissement.options.languages.pidginEnglish' },
    { id: 'local_languages', labelKey: 'etablissement.options.languages.localLanguages' },
    { id: 'sign_language', labelKey: 'etablissement.options.languages.signLanguage' },
  ],
}

export function getFacilityOptions(group: FacilityOptionGroup): FacilityOption[] {
  return FACILITY_OPTION_GROUPS[group]
}

export function normalizeFacilityOptions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map(item => String(item).trim()).filter(Boolean))]
  }
  if (typeof value === 'string') {
    return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))]
  }
  return []
}
