// @ts-nocheck
'use client'

import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog } from '@headlessui/react'
import { motion } from 'framer-motion'
import { Upload, X, FileSpreadsheet, AlertCircle, CheckCircle, Download, AlertTriangle, RefreshCw } from 'lucide-react'
import { importCentres, getCentreImportTemplate } from '@/api/admin'
import { useToast } from '@/components/ui/Toast'

export function ImportCentresModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState(null)
  const [updateExisting, setUpdateExisting] = useState(false)
  const fileInputRef = useRef(null)
  const toast = useToast()
  const { t } = useTranslation()

  const handleFileDrop = (e) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) validateAndSetFile(dropped)
  }

  const handleFileSelect = (e) => {
    const selected = e.target.files[0]
    if (selected) validateAndSetFile(selected)
  }

  const validateAndSetFile = (f) => {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      toast.error(t('admin.import.formatError'))
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error(t('admin.import.max10'))
      return
    }
    setFile(f)
    setResults(null)
  }

  const handleImport = async () => {
    if (!file) { toast.error(t('admin.import.selectFile')); return }

    setIsUploading(true)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const params = updateExisting ? { params: { updateExisting: 'true' } } : {}
      const response = await importCentres(formData, (evt) => {
        if (evt.total) setProgress(Math.round((evt.loaded * 100) / evt.total))
      })

      const data = response.data?.data ?? response.data
      setResults(data)

      const { imported, updated, errors } = data
      let msg = t('admin.import.importedCentres', { count: imported })
      if (updated > 0) msg += t('admin.import.updatedCount', { count: updated })
      if (errors > 0) msg += t('admin.import.errorCount', { count: errors })

      errors === 0
        ? toast.success(msg)
        : toast.success(t('admin.import.importSuccessCentres', { imported, updated, errors }))

      if (imported > 0 || updated > 0) {
        setTimeout(() => { onSuccess?.(); onClose() }, 3000)
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin.import.importError'))
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await getCentreImportTemplate()
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'template_import_centres.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t('admin.import.templateError'))
    }
  }

  const handleClose = () => {
    setFile(null); setResults(null); setProgress(0)
    onClose()
  }

  const statusIcon = () => {
    if (!results) return null
    if (results.errors === 0 && (!results.warnings || results.warnings.length === 0))
      return <CheckCircle className="w-5 h-5 text-mint-500 shrink-0 mt-0.5" />
    if (results.errors > 0)
      return <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
    return <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
  }

  const statusBorder = () => {
    if (!results) return 'border-primary-100 dark:border-white/5'
    if (results.errors === 0 && (!results.warnings || results.warnings.length === 0))
      return 'bg-mint-50 dark:bg-mint-900/10 border-mint-200'
    if (results.errors > 0)
      return 'bg-amber-50 dark:bg-amber-900/10 border-amber-200'
    return 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200'
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel
          as={motion.div}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl rounded-2xl bg-white dark:bg-primary-800 shadow-glass p-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="font-display font-bold text-xl text-primary-900 dark:text-sable">
              {t('admin.import.titleCentres')}
            </Dialog.Title>
            <button onClick={handleClose} className="text-primary-300 hover:text-primary-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Zone drop */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-8 text-center transition cursor-pointer ${
                file
                  ? 'border-mint-500 bg-mint-50 dark:bg-mint-900/10'
                  : 'border-primary-200 dark:border-white/20 hover:border-mint-500 hover:bg-primary-50'
              }`}
            >
              {!file ? (
                <>
                  <Upload className="w-10 h-10 mx-auto text-primary-300 mb-3" />
                  <p className="text-sm font-semibold text-primary-700 dark:text-sable">
                    {t('admin.import.dropHere')}
                  </p>
                  <p className="text-xs text-primary-300 mt-1">
                    {t('admin.import.clickBrowse')}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <p className="text-xs text-primary-300 mt-3">
                    {t('admin.import.formats')}
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-mint-500 shrink-0" />
                  <div className="text-left min-w-0">
                    <p className="font-semibold text-primary-900 dark:text-sable truncate">{file.name}</p>
                    <p className="text-xs text-primary-300">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); setResults(null) }}
                    className="text-primary-300 hover:text-urgence-500 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Options */}
            <div className="flex items-center gap-4 rounded-xl bg-primary-50 dark:bg-primary-900/40 p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="rounded text-mint-500 focus:ring-mint-500"
                />
                <span className="text-sm text-primary-700 dark:text-sable">
                  {t('admin.import.updateExistingCentres')}
                </span>
              </label>
            </div>

            {/* Barre de progression */}
            {isUploading && (
              <div className="space-y-1">
                <div className="w-full h-2 rounded-full bg-primary-100 dark:bg-primary-700 overflow-hidden">
                  <div
                    className="h-full bg-mint-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-primary-300 text-center">{t('admin.import.importing', { progress })}</p>
              </div>
            )}

            {/* Résultats */}
            {results && !isUploading && (
              <div className={`rounded-xl p-4 border ${statusBorder()}`}>
                <div className="flex items-start gap-3">
                  {statusIcon()}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary-900 dark:text-sable text-sm">
                      {t('admin.import.importedCentres', { count: results.imported })}
                      {results.updated > 0 && t('admin.import.updatedCount', { count: results.updated })}
                      {results.errors > 0 && t('admin.import.errorCount', { count: results.errors })}
                      {t('admin.import.linesProcessed', { count: results.total })}
                    </p>

                    {(results.errorLog?.length > 0 || results.warnings?.length > 0) && (
                      <details className="mt-2">
                        <summary className="text-xs text-urgence-500 cursor-pointer font-semibold">
                          {t('admin.import.details', { count: results.errorLog?.length || 0, count2: results.warnings?.length || 0 })}
                        </summary>
                        <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
                          {results.errorLog?.map((err, i) => (
                            <div key={i} className="text-xs text-urgence-600 bg-urgence-50 px-2 py-1 rounded">
                              {t('admin.import.rowError', { row: err.row, error: err.error })}
                            </div>
                          ))}
                          {results.warnings?.map((w, i) => (
                            <div key={i} className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                              {t('admin.import.rowError', { row: w.row, error: w.message })}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  {(results.imported > 0 || results.updated > 0) && (
                    <RefreshCw className="w-5 h-5 text-mint-500 animate-spin shrink-0" />
                  )}
                </div>
              </div>
            )}

            {/* Colonnes attendues */}
            <div className="rounded-xl bg-primary-50 dark:bg-primary-900/40 p-3">
              <p className="text-xs font-semibold text-primary-500 dark:text-sable mb-1">
                {t('admin.import.colonnesFichier')}
              </p>
              <p className="text-xs text-primary-400 font-mono">
                nom, type, region, ville, quartier, adresse, telephone, email, siteWeb, latitude, longitude, horaires, description, statut, estActif, specialites
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-primary-100 dark:border-white/5">
              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 text-sm text-mint-500 hover:text-mint-700 font-semibold"
              >
                <Download className="w-4 h-4" /> {t('admin.import.templateCsv')}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm text-primary-500 dark:text-sable hover:text-primary-700 font-medium"
                >
                  {t('admin.import.cancel')}
                </button>
                <button
                  onClick={handleImport}
                  disabled={!file || isUploading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-mint-500 hover:bg-mint-700 text-white text-sm font-semibold disabled:opacity-60 transition"
                >
                  <Upload className="w-4 h-4" />
                  {isUploading ? t('admin.import.importingDots') : t('admin.import.importer')}
                </button>
              </div>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}
