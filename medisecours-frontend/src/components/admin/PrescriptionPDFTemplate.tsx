'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Phone, Globe, MapPin, HeartPulse } from 'lucide-react'
import type { EstablishmentSeal, MySignature } from '../../lib/documentSeals'

const T = '#0A4A5C'
const L = '#E5EFEF'

export default function PrescriptionPDFTemplate({
  diagnostic,
  medicaments,
  recommandations,
  consultation,
  medecin,
  seal,
  signature,
}) {
  const { t } = useTranslation()
  const patient = consultation?.patient || {}
  const sealData = seal as EstablishmentSeal | null | undefined
  const signatureData = signature as MySignature | null | undefined
  const doctorGrade = signatureData?.grade ? `${signatureData.grade} ` : ''
  const etablissementNom = sealData?.nom || t('admin.pdfTemplate.clinicName')

  return (
    <div
      id="prescription-pdf-content"
      style={{
        width: '794px', height: '1123px', fontFamily: "'Inter', sans-serif",
        background: '#fff', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div style={{ background: '#F8F9FA', padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid ' + T }}>
        <div>
          <h1 style={{ color: '#2B838A', fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>{etablissementNom}</h1>
          <h2 style={{ color: T, fontSize: '28px', fontWeight: 800, marginBottom: '4px' }}>{doctorGrade}Dr. {medecin?.prenom} {medecin?.nom}</h2>
          <p style={{ color: '#888', fontSize: '12px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '2px' }}>{medecin?.specialite || t('admin.pdfTemplate.specialiteFallback')}</p>
          <p style={{ color: '#555', fontSize: '12px' }}>{t('admin.pdfTemplate.registrationNo', { id: medecin?.id ? `MS-${medecin.id.toString().padStart(6, '0')}` : 'MS-000000' })}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#206277', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HeartPulse style={{ width: '32px', height: '32px', color: '#fff' }} />
          </div>
          <span style={{ color: T, fontSize: '24px', fontWeight: 700 }}>MediSecours+</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: '1', position: 'relative' }}>
        {/* Left column */}
        <div style={{ width: '30%', height: '100%', background: L, borderRight: '1px solid ' + T, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px' }}>
          <span style={{ color: '#206277', fontSize: '64px', fontWeight: 700 }}>Rx</span>
        </div>

        {/* Right column */}
        <div style={{ width: '70%', height: '100%', position: 'relative' }}>

          {/* Patient info */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
              <div style={{ display: 'flex', flex: '1', alignItems: 'flex-end' }}>
                <span style={{ color: '#555', fontSize: '11px', fontWeight: 700, marginRight: '8px', whiteSpace: 'nowrap' }}>{t('admin.pdfTemplate.patientName')}</span>
                <div style={{ flex: '1', borderBottom: '1px solid #999', fontSize: '13px', fontWeight: 500, paddingBottom: '3px', color: '#111' }}>{patient.prenom} {patient.nom}</div>
              </div>
              <div style={{ width: '128px', display: 'flex', alignItems: 'flex-end', marginLeft: '16px' }}>
                <span style={{ color: '#555', fontSize: '11px', fontWeight: 700, marginRight: '8px', whiteSpace: 'nowrap' }}>{t('admin.pdfTemplate.age')}:</span>
                <div style={{ flex: '1', borderBottom: '1px solid #999', fontSize: '13px', fontWeight: 500, paddingBottom: '3px', textAlign: 'center', color: '#111' }}>{patient.age ? t('admin.pdfTemplate.years', { count: patient.age }) : '-'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flex: '1', alignItems: 'flex-end' }}>
                <span style={{ color: '#555', fontSize: '11px', fontWeight: 700, marginRight: '8px', whiteSpace: 'nowrap' }}>{t('admin.pdfTemplate.address')}:</span>
                <div style={{ flex: '1', borderBottom: '1px solid #999', fontSize: '13px', fontWeight: 500, paddingBottom: '3px', color: '#111' }}>{patient.quartier || patient.adresse || '\u2014'}</div>
              </div>
              <div style={{ width: '192px', display: 'flex', alignItems: 'flex-end', marginLeft: '16px' }}>
                <span style={{ color: '#555', fontSize: '11px', fontWeight: 700, marginRight: '8px', whiteSpace: 'nowrap' }}>{t('admin.pdfTemplate.date')}:</span>
                <div style={{ flex: '1', borderBottom: '1px solid #999', fontSize: '13px', fontWeight: 500, paddingBottom: '3px', textAlign: 'center', color: '#111' }}>{new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
              </div>
            </div>
          </div>

          {/* Grid bg */}
          <div style={{
            position: 'absolute', top: '110px', bottom: '100px', left: 0, right: 0, zIndex: 0, opacity: 0.4, pointerEvents: 'none',
            backgroundImage: 'linear-gradient(to right, #d1d5db 1px, transparent 1px), linear-gradient(to bottom, #d1d5db 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }} />

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 10, padding: '24px 32px', height: '100%' }}>
            {/* Diagnostic */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: T, borderBottom: '2px solid ' + T, fontSize: '18px', fontWeight: 700, display: 'inline-block', paddingBottom: '3px', marginBottom: '12px' }}>{t('admin.pdfTemplate.diagnostic')}</h3>
              <p style={{ color: '#333', fontSize: '13px', lineHeight: '1.6', fontWeight: 500 }}>{diagnostic}</p>
            </div>

            {/* Medications */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: T, borderBottom: '2px solid ' + T, fontSize: '18px', fontWeight: 700, display: 'inline-block', paddingBottom: '3px', marginBottom: '16px' }}>{t('admin.pdfTemplate.medicationsPrescribed')}</h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {medicaments.map((med, idx) => (
                  <li key={idx} style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#206277', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>{idx + 1}</span>
                      <strong style={{ color: '#111', fontSize: '14px' }}>{med.nom}</strong>
                    </div>
                    <div style={{ marginLeft: '32px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '24px', fontSize: '12px', color: '#555' }}>
                      <span><span style={{ fontWeight: 600, color: '#666' }}>{t('admin.pdfTemplate.posologie')}</span> {med.posologie}</span>
                      <span><span style={{ fontWeight: 600, color: '#666' }}>{t('admin.pdfTemplate.duree')}</span> {med.duree}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            {recommandations && (
              <div>
                <h3 style={{ color: T, borderBottom: '2px solid ' + T, fontSize: '18px', fontWeight: 700, display: 'inline-block', paddingBottom: '3px', marginBottom: '12px' }}>{t('admin.pdfTemplate.recommandations')}</h3>
                <p style={{ color: '#333', fontSize: '13px', lineHeight: '1.6', fontWeight: 500 }}>{recommandations}</p>
              </div>
            )}

            {/* Signature + cachet officiel (positionnement papier réel) */}
            <div style={{ position: 'absolute', bottom: '20px', left: '32px', right: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px' }}>
              {/* Cachet / logo établissement — gauche */}
              <div style={{ textAlign: 'left' }}>
                {sealData?.cachetUrl ? (
                  <img src={sealData.cachetUrl} alt="" style={{ maxHeight: '100px', maxWidth: '150px', display: 'block' }} />
                ) : sealData?.logoUrl && sealData.logoUrl.startsWith('data:') ? (
                  <img src={sealData.logoUrl} alt="" style={{ maxHeight: '72px', maxWidth: '120px', display: 'block' }} />
                ) : null}
                {sealData?.nom && (
                  <>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: T, marginTop: '4px' }}>{sealData.nom}</div>
                    {sealData.ville && <div style={{ fontSize: '10px', color: '#6B7280' }}>{sealData.ville}</div>}
                    <div style={{ fontSize: '9px', color: '#9CA3AF' }}>{t('admin.pdfTemplate.officialStamp')}</div>
                  </>
                )}
              </div>

              {/* Signature médecin — droite */}
              <div style={{ textAlign: 'center' }}>
                {signatureData?.imageData && (
                  <img src={signatureData.imageData} alt="" style={{ maxHeight: '56px', maxWidth: '180px', display: 'block', margin: '0 0 4px auto' }} />
                )}
                <div style={{ width: '160px', borderTop: '1px solid #333', margin: '0 0 4px auto' }}></div>
                <span style={{ color: '#555', fontSize: '11px', fontWeight: 700 }}>{t('admin.pdfTemplate.signatureMedecin')}</span>
                <div style={{ color: '#333', fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>{doctorGrade}Dr. {medecin?.prenom} {medecin?.nom}</div>
                {signatureData && (
                  <div style={{ color: '#9CA3AF', fontSize: '9px', marginTop: '2px' }}>
                    {t('admin.pdfTemplate.electronicallySigned')} — {signatureData.hashShort}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ height: '80px', background: T, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '48px', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '11px' }}>
          <div style={{ padding: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Phone style={{ width: '16px', height: '16px', color: '#fff' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span>{medecin?.telephone || t('admin.pdfTemplate.phoneFallback')}</span>
            <span>{medecin?.telephoneUrgences || t('admin.pdfTemplate.phoneFallback')}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '11px' }}>
          <div style={{ padding: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe style={{ width: '16px', height: '16px', color: '#fff' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span>{medecin?.email || t('admin.pdfTemplate.emailFallback')}</span>
            <span>{t('admin.pdfTemplate.website')}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '11px' }}>
          <div style={{ padding: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin style={{ width: '16px', height: '16px', color: '#fff' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span>{medecin?.hopital || t('admin.pdfTemplate.hopitalFallback')}</span>
            <span>{medecin?.quartier || t('admin.pdfTemplate.quartierFallback')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
