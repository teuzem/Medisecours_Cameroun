'use client';

import { useState, useRef, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Transition } from '@headlessui/react';
import {
    Upload,
    X,
    FileSpreadsheet,
    AlertCircle,
    CheckCircle,
    Download,
    AlertTriangle,
    RefreshCw
} from 'lucide-react';
import api from '../../api/axios';

export function ImportPremiersSoinsModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
    const [file, setFile] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<any>(null);
    const [updateExisting, setUpdateExisting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            validateAndSetFile(droppedFile);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            validateAndSetFile(selectedFile);
        }
    };

    const validateAndSetFile = (file: File) => {
        const validTypes = [
            'text/csv',
            'text/plain',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];

        if (!validTypes.includes(file.type)) {
            alert(t('admin.import.formatError'));
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            alert(t('admin.import.max10'));
            return;
        }

        setFile(file);
        setResults(null);
    };

    const handleImport = async () => {
        if (!file) {
            alert(t('admin.import.selectFile'));
            return;
        }

        setIsUploading(true);
        setProgress(0);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await api.post(`/api/admin/import/premiers-soins?updateExisting=${updateExisting}`, formData, {
                headers: { 'Content-Type': undefined },
            });

            const data = response.data;

            setResults(data.data);

            const { imported, updated, errors, warnings } = data.data;
            let message = t('admin.import.importedPremiersSoins', { count: imported });
            if (updated > 0) message += t('admin.import.updatedCountFem', { count: updated });
            if (errors > 0) message += t('admin.import.errorCountPlain', { count: errors });
            if (warnings?.length > 0) message += t('admin.import.warningCount', { count: warnings.length });

            alert(t('admin.import.importSuccess', { message }));

            if (imported > 0 || updated > 0) {
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 2000);
            }
        } catch (error: any) {
            const msg = error?.response?.data?.error || error.message || t('admin.import.importError');
            alert(msg);
        } finally {
            setIsUploading(false);
        }
    };

    const downloadTemplate = async () => {
        try {
            const response = await api.get('/api/admin/import/premiers-soins/template');
            const data = response.data;

            const blob = new Blob([data.template], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            alert(t('admin.import.templateError'));
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="dashboard-theme w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <Dialog.Title className="text-xl font-semibold text-gray-900">
                                        {t('admin.import.titlePremiersSoins')}
                                    </Dialog.Title>
                                    <button
                                        onClick={onClose}
                                        className="text-gray-400 hover:text-gray-500"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <div className="flex items-start">
                                            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                                            <div className="text-sm text-blue-800">
                                                <p className="font-medium">{t('admin.import.infoImportant')}</p>
                                                <ul className="list-disc pl-4 mt-1 space-y-1">
                                                    <li>{t('admin.import.infoPremiersSoins1')}</li>
                                                    <li>{t('admin.import.infoPremiersSoins2')}</li>
                                                    <li>{t('admin.import.infoPremiersSoins3')}</li>
                                                    <li>{t('admin.import.infoPremiersSoins4')}</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Zone de téléchargement */}
                                    <div
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={handleFileDrop}
                                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                                            file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-primary-500'
                                        }`}
                                    >
                                        {!file ? (
                                            <>
                                                <Upload className="h-12 w-12 mx-auto text-gray-400" />
                                                <p className="mt-2 text-sm text-gray-600">
                                                    {t('admin.import.dropHereOr')}
                                                </p>
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="mt-2 inline-flex items-center px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600"
                                                >
                                                    {t('admin.import.browse')}
                                                </button>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept=".csv,.xlsx,.xls"
                                                    onChange={handleFileSelect}
                                                    className="hidden"
                                                />
                                                <p className="mt-2 text-xs text-gray-500">
                                                    {t('admin.import.formatsSupportes')}
                                                </p>
                                            </>
                                        ) : (
                                            <div className="flex items-center justify-center space-x-3">
                                                <FileSpreadsheet className="h-8 w-8 text-green-600" />
                                                <div className="text-left">
                                                    <p className="font-medium text-gray-900">{file.name}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {(file.size / 1024).toFixed(0)} KB
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => setFile(null)}
                                                    className="text-gray-400 hover:text-red-500"
                                                >
                                                    <X className="h-5 w-5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Options d'import */}
                                    <div className="flex items-center space-x-4 bg-gray-50 p-4 rounded-lg">
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={updateExisting}
                                                onChange={(e) => setUpdateExisting(e.target.checked)}
                                                className="rounded text-primary-500 focus:ring-primary-500"
                                            />
                                            <span className="text-sm text-gray-700">
                                                {t('admin.import.updateExistingPremiersSoins')}
                                            </span>
                                        </label>
                                        <button
                                            onClick={downloadTemplate}
                                            className="ml-auto flex items-center space-x-2 text-sm text-primary-500 hover:text-primary-600"
                                        >
                                            <Download className="h-4 w-4" />
                                            <span>{t('admin.import.downloadTemplate')}</span>
                                        </button>
                                    </div>

                                    {/* Barre de progression */}
                                    {isUploading && (
                                        <div className="space-y-2">
                                            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className="bg-primary-500 h-2.5 rounded-full transition-all duration-300"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <p className="text-sm text-gray-600 text-center">
                                                {t('admin.import.importing', { progress })}
                                            </p>
                                        </div>
                                    )}

                                    {/* Résultats */}
                                    {results && !isUploading && (
                                        <div className={`rounded-lg p-4 border ${
                                            results.errors === 0 && results.warnings?.length === 0
                                                ? 'bg-green-50 border-green-200'
                                                : results.errors > 0
                                                    ? 'bg-red-50 border-red-200'
                                                    : 'bg-yellow-50 border-yellow-200'
                                        }`}>
                                            <div className="flex items-start space-x-3">
                                                {results.errors === 0 && results.warnings?.length === 0 ? (
                                                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                                ) : results.errors > 0 ? (
                                                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                                ) : (
                                                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                                                )}
                                                <div className="flex-1">
                                                    <p className="font-medium">
                                                        {t('admin.import.importedPremiersSoins', { count: results.imported })}
                                                        {results.updated > 0 && t('admin.import.updatedCountFem', { count: results.updated })}
                                                        {results.errors > 0 && t('admin.import.errorCountPlain', { count: results.errors })}
                                                        {results.warnings?.length > 0 &&
                                                            t('admin.import.warningCount', { count: results.warnings.length })
                                                        }
                                                    </p>

                                                    {(results.errorLog?.length > 0 || results.warnings?.length > 0) && (
                                                        <details className="mt-2">
                                                            <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                                                                {t('admin.import.detailsPlain', { count: results.errorLog?.length || 0, count2: results.warnings?.length || 0 })}
                                                            </summary>
                                                            <div className="mt-2 max-h-60 overflow-y-auto text-sm space-y-1">
                                                                {results.errorLog?.map((error: any, index: number) => (
                                                                    <div key={`error-${index}`} className="text-red-600 bg-red-50 p-2 rounded">
                                                                        <strong>{t('admin.import.rowError', { row: error.row, error: error.error })}</strong>
                                                                    </div>
                                                                ))}
                                                                {results.warnings?.map((warning: any, index: number) => (
                                                                    <div key={`warning-${index}`} className="text-yellow-600 bg-yellow-50 p-2 rounded">
                                                                        <strong>{t('admin.import.rowError', { row: warning.row, error: warning.message })}</strong>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    )}
                                                </div>
                                                {results.imported > 0 && (
                                                    <RefreshCw className="h-5 w-5 text-green-600 animate-spin" />
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex justify-end space-x-3 pt-4 border-t">
                                        <button
                                            onClick={onClose}
                                            className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                        >
                                            {t('admin.import.cancel')}
                                        </button>
                                        <button
                                            onClick={handleImport}
                                            disabled={!file || isUploading}
                                            className="px-6 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isUploading ? t('admin.import.importingDots') : t('admin.import.importer')}
                                        </button>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
