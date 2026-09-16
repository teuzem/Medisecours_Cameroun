// @ts-nocheck
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ZoomIn, ZoomOut, Download, Loader2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import PrescriptionPDFTemplate from '../admin/PrescriptionPDFTemplate'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { useToast } from '../ui/Toast'

export default function PrescriptionPreview({ prescription, consultation, medecin, onClose }) {
  const [zoom, setZoom] = useState(0.8)
  const [downloading, setDownloading] = useState(false)
  const toast = useToast()

  const generatePDF = async () => {
    try {
      setDownloading(true)
      const element = document.getElementById('prescription-pdf-preview-content')
      if (!element) return
      
      // Clone element to body to avoid scroll and scale artifacts
      const clone = element.cloneNode(true)
      clone.style.position = 'fixed'
      clone.style.top = '0'
      clone.style.left = '0'
      clone.style.zIndex = '-9999'
      clone.style.transform = 'none'
      document.body.appendChild(clone)
      
      const canvas = await html2canvas(clone, { 
        scale: 2, 
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })
      
      document.body.removeChild(clone)
      
      const imgData = canvas.toDataURL('image/png')
      
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      
      const patientName = `${consultation?.patient?.prenom || ''}_${consultation?.patient?.nom || ''}`.trim()
      pdf.save(`Ordonnance_${patientName || 'Patient'}.pdf`)
    } catch (err) {
      console.error('Erreur PDF:', err)
      toast.error('La génération du PDF a échoué.')
    } finally {
      setDownloading(false)
    }
  }

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
            <h3 className="font-display text-base font-bold text-[#0F2C52]">Ordonnance médicale</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={generatePDF}
                disabled={downloading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E5ECEC] hover:bg-[#D1E0E0] text-[#0F4C5C] font-semibold text-sm transition-colors disabled:opacity-50"
                title="Télécharger en PDF"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span className="hidden sm:inline">{downloading ? 'Génération...' : 'Télécharger'}</span>
              </button>
              
              <div className="w-px h-5 bg-gray-200 mx-1" />

              <button
                onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                title="Zoom arrière"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-500 w-12 text-center font-medium">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                title="Zoom avant"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              
              <div className="w-px h-5 bg-gray-200 mx-1" />
              
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 text-gray-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Preview Container */}
          <div className="flex-1 overflow-auto bg-[#F3F4F6] p-8 flex justify-center items-start">
            <div 
              style={{ 
                transform: `scale(${zoom})`, 
                transformOrigin: 'top center',
                transition: 'transform 0.2s ease-out'
              }}
            >
              <div style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid rgba(0,0,0,0.05)' }} id="prescription-pdf-preview-content">
                <PrescriptionPDFTemplate
                  diagnostic={prescription.diagnostic || ''}
                  medicaments={prescription.medicaments || []}
                  recommandations={prescription.recommandations || ''}
                  consultation={consultation}
                  medecin={medecin}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )

  if (typeof window === 'undefined') return null
  return createPortal(content, document.body)
}
