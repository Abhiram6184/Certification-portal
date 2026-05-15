import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BulkUploadResult, BulkUploadError } from '../types';
import { bulkUploadCredentials } from '../services/api';

import EtlLoader from './EtlLoader';
import CloseIcon from './icons/CloseIcon';
import UploadIcon from './icons/UploadIcon';
import FileTextIcon from './icons/FileTextIcon';
import AlertCircleIcon from './icons/AlertCircleIcon';
import DownloadIcon from './icons/DownloadIcon';
import CheckIcon from './icons/CheckIcon';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Stage = 'upload' | 'processing' | 'results';

const BulkUploadModal = ({ isOpen, onClose, onComplete }: BulkUploadModalProps) => {
    const [stage, setStage] = useState<Stage>('upload');
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<BulkUploadResult | null>(null);
    const [dragActive, setDragActive] = useState(false);

    const resetAndClose = () => {
        if (result) {
            onComplete();
        }
        setStage('upload');
        setError(null);
        setResult(null);
        setDragActive(false);
        onClose();
    };
    
    const handleFileSelect = useCallback(async (file: File | null) => {
        if (!file) return;
        
        setError(null);
        if (file.type !== 'text/csv') {
            setError('Invalid file type. Please upload a .csv file.');
            return;
        }

        setStage('processing');
        try {
            const uploadResult = await bulkUploadCredentials(file);
            setResult(uploadResult);
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred during upload.");
        } finally {
            setStage('results');
        }
    }, []);
    
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };
    
    const downloadTemplate = () => {
        const headers = "credential_name,final_email,issued_on,expired_on";
        const exampleRow = "Databricks Certified Data Engineer Associate,employee.name@celebaltech.com,2023-10-25,2025-10-25";
        const csvContent = `${headers}\n${exampleRow}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'credential_upload_template.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadErrorCsv = () => {
        if (!result || result.errors.length === 0) return;
        const headers = "row,email,reason";
        const rows = result.errors.map(e => `${e.row},"${e.email}","${e.reason}"`);
        const csvContent = `${headers}\n${rows.join('\n')}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'upload_errors.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderContent = () => {
        switch (stage) {
            case 'processing':
                return (
                    <div className="flex justify-center py-16">
                        <div className="w-full max-w-md">
                            <EtlLoader label="Processing CSV file..." />
                        </div>
                    </div>
                );
            case 'results':
                if (error) {
                    return (
                        <div className="text-center py-12">
                             <div className="text-5xl mb-4">🚨</div>
                             <h3 className="text-xl font-bold text-red-800 dark:text-red-300">Upload Failed</h3>
                             <p className="mt-2 text-gray-600 dark:text-gray-400 bg-red-50 dark:bg-red-900/50 p-4 rounded-md">{error}</p>
                             <button onClick={() => setStage('upload')} className="mt-6 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md">Try Again</button>
                        </div>
                    );
                }
                if (result) {
                    return (
                        <div className="text-center py-8">
                            <div className="text-6xl mb-4">
                                {result.errors.length === 0 ? '🎉' : '🤔'}
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {result.errors.length === 0 ? 'Upload Successful!' : 'Upload Complete with Some Errors'}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mt-2">
                                Total rows processed from your file: {result.processed}
                            </p>
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                                <div className="bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-700 p-4 rounded-lg flex items-center">
                                    <CheckIcon />
                                    <div className="ml-3">
                                        <p className="font-bold text-green-800 dark:text-green-200">{result.success} records</p>
                                        <p className="text-sm text-green-700 dark:text-green-300">Successfully upserted</p>
                                    </div>
                                </div>
                                <div className={`p-4 rounded-lg flex items-center ${result.errors.length > 0 ? 'bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700' : 'bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600'}`}>
                                    <AlertCircleIcon />
                                    <div className="ml-3">
                                        <p className={`font-bold ${result.errors.length > 0 ? 'text-red-800 dark:text-red-200' : 'text-gray-800 dark:text-gray-200'}`}>{result.errors.length} errors</p>
                                        <p className={`text-sm ${result.errors.length > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'}`}>Rows with issues</p>
                                    </div>
                                </div>
                            </div>
                            {result.errors.length > 0 && (
                                <div className="mt-4">
                                    <button onClick={downloadErrorCsv} className="text-sm text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1">
                                        <DownloadIcon /> Download Error Report
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                }
                return null;
            case 'upload':
            default:
                return (
                    <div>
                         <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bulk Upload Credentials</h2>
                         <p className="text-gray-600 dark:text-gray-400 mt-1 mb-6">Upload a CSV file to add or update multiple employee credentials at once.</p>
                         
                         {error && <div className="mb-4 bg-red-50 dark:bg-red-500/20 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg flex items-center"><AlertCircleIcon /><span className="ml-2">{error}</span></div>}

                         <div onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDragEnter={() => setDragActive(true)} onDragLeave={() => setDragActive(false)} className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${ dragActive ? 'border-red-400 bg-red-50/80 dark:bg-red-500/10 scale-[1.02]' : 'border-gray-300 dark:border-slate-600 hover:border-red-300 dark:hover:border-red-500' }`}>
                            <input type="file" accept=".csv" onChange={(e) => handleFileSelect(e.target.files ? e.target.files[0] : null)} className="hidden" id="csv-upload-input" />
                             <div className={`w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center transition-all duration-300 ${ dragActive ? 'bg-red-100' : 'bg-gray-100 dark:bg-slate-700' }`}>
                                 <FileTextIcon className={`w-8 h-8 transition-colors duration-300 ${ dragActive ? 'text-red-600' : 'text-gray-600 dark:text-gray-300' }`} />
                             </div>
                             <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Drop your CSV here</h3>
                             <p className="text-gray-600 dark:text-gray-400 mt-1">or</p>
                             <button onClick={() => document.getElementById('csv-upload-input')?.click()} className="mt-2 text-red-600 font-semibold hover:underline">browse files</button>
                         </div>

                         <div className="mt-6 p-4 bg-gray-100 dark:bg-slate-700/50 rounded-lg">
                             <h4 className="font-semibold text-gray-800 dark:text-gray-200">Instructions & Template</h4>
                             <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                 Your CSV must have the following headers: <code className="font-mono bg-gray-200 dark:bg-slate-600 px-1 rounded">credential_name</code>, <code className="font-mono bg-gray-200 dark:bg-slate-600 px-1 rounded">final_email</code>, <code className="font-mono bg-gray-200 dark:bg-slate-600 px-1 rounded">issued_on</code>, <code className="font-mono bg-gray-200 dark:bg-slate-600 px-1 rounded">expired_on</code>.
                             </p>
                              <button onClick={downloadTemplate} className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1">
                                 <DownloadIcon /> Download CSV Template
                             </button>
                         </div>
                    </div>
                );
        }
    };


    return (
        <AnimatePresence>
        {isOpen && (
             <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-70 backdrop-blur-sm p-4"
                onClick={resetAndClose}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <motion.div
                    role="dialog"
                    aria-modal="true"
                    className="relative w-full max-w-2xl transform rounded-xl bg-gray-50 dark:bg-slate-800 text-left shadow-2xl transition-all m-4"
                    onClick={(e) => e.stopPropagation()}
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                >
                    <div className="absolute top-0 right-0 pt-4 pr-4 z-10">
                        <button type="button" className="rounded-full p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700" onClick={resetAndClose}>
                            <CloseIcon />
                        </button>
                    </div>
                    <div className="p-8">
                        {renderContent()}
                    </div>
                     {stage === 'results' && (
                        <div className="px-8 pb-6 text-right">
                             <button onClick={resetAndClose} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md">Close</button>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        )}
        </AnimatePresence>
    );
};

export default BulkUploadModal;