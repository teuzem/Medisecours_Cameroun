/**
 * Génération PDF d'une ordonnance — partagée entre PrescriptionModal (création)
 * et PrescriptionDetailModal (ordonnance existante).
 *
 * Le template A4 (#prescription-pdf-content) est cloné hors écran, capturé via
 * html2canvas puis converti en PDF A4 via jsPDF.
 */
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export async function downloadPrescriptionPDF(element: HTMLElement, fileName: string): Promise<void> {
  const clone = element.cloneNode(true) as HTMLElement
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
    backgroundColor: '#ffffff',
  })

  document.body.removeChild(clone)

  const imgData = canvas.toDataURL('image/png')

  const pdf = new jsPDF('p', 'mm', 'a4')
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
  pdf.save(fileName)
}
