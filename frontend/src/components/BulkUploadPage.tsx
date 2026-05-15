import React, { useState, useCallback } from 'react';
import { BulkUploadResult, VoucherBulkUploadResult } from '../types';
import { bulkUploadCredentials, bulkUploadVouchers } from '../services/api';

import EtlLoader from './EtlLoader';
import DownloadIcon from './icons/DownloadIcon';
import FileTextIcon from './icons/FileTextIcon';
import AlertCircleIcon from './icons/AlertCircleIcon';
import CheckIcon from './icons/CheckIcon';
import AwardIcon from './icons/AwardIcon';
import UserIcon from './icons/UserIcon';


interface BulkUploadPageProps {
  onComplete: () => void;
}

type UploadType = 'credentials' | 'vouchers';

const BulkUploadSection: React.FC<{
    title: string;
    description: string;
    templateInstructions: React.ReactNode;
    onDownloadTemplate: () => void;
    // FIX: Change the return type of onFileSelect to allow returning upload results.
    onFileSelect: (file: File) => Promise<BulkUploadResult | VoucherBulkUploadResult>;
    uploadType: UploadType;
}> = ({ title, description, templateInstructions, onDownloadTemplate, onFileSelect, uploadType }) => {
    const [stage, setStage] = useState<'upload' | 'processing' | 'results'>('upload');
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<BulkUploadResult | VoucherBulkUploadResult | null>(null);
    const [dragActive, setDragActive] = useState(false);

    const resetForNewUpload = () => {
        setStage('upload');
        setError(null);
        setResult(null);
        setDragActive(false);
    };
    
    const handleFileSelectInternal = useCallback(async (file: File | null) => {
        if (!file) return;
        
        setError(null);
        if (file.type !== 'text/csv') {
            setError('Invalid file type. Please upload a .csv file.');
            return;
        }

        setStage('processing');
        try {
            const uploadResult = await onFileSelect(file);
            // FIX: Remove 'as any' cast as the prop type is now correct.
            setResult(uploadResult);
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred during upload.");
        } finally {
            setStage('results');
        }
    }, [onFileSelect]);
    
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelectInternal(e.dataTransfer.files[0]);
        }
    };
    
    const downloadErrorCsv = () => {
        if (!result || result.errors.length === 0) return;
        
        let headers: string, rows: string[];
        if (uploadType === 'credentials') {
            headers = "row,email,reason";
            rows = (result.errors as any[]).map(e => `${e.row},"${e.email}","${e.reason}"`);
        } else {
            headers = "row,voucherCode,reason";
            rows = (result.errors as any[]).map(e => `${e.row},"${e.voucherCode}","${e.reason}"`);
        }

        const csvContent = `${headers}\n${rows.join('\n')}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${uploadType}_upload_errors.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    const renderContent = () => {
        switch (stage) {
            case 'processing':
                return <div className="flex justify-center py-16"><div className="w-full max-w-md"><EtlLoader label="Processing CSV file..." /></div></div>;
            case 'results':
                if (error) {
                    return <div className="text-center py-12"><div className="text-5xl mb-4">🚨</div><h3 className="text-xl font-bold text-red-800 dark:text-red-300">Upload Failed</h3><p className="mt-2 text-gray-600 dark:text-gray-400 bg-red-50 dark:bg-red-900/50 p-4 rounded-md">{error}</p></div>;
                }
                if (result) {
                    return (
                        <div className="text-center py-8">
                            <div className="text-6xl mb-4">{result.errors.length === 0 ? '🎉' : '🤔'}</div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{result.errors.length === 0 ? 'Upload Successful!' : 'Upload Complete with Some Errors'}</h3>
                            <p className="text-gray-600 dark:text-gray-400 mt-2">Total rows processed from your file: {result.processed}</p>
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                                <div className="bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-700 p-4 rounded-lg flex items-center"><CheckIcon /><div className="ml-3"><p className="font-bold text-green-800 dark:text-green-200">{result.success} records</p><p className="text-sm text-green-700 dark:text-green-300">Successfully upserted</p></div></div>
                                <div className={`p-4 rounded-lg flex items-center ${result.errors.length > 0 ? 'bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700' : 'bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600'}`}><AlertCircleIcon /><div className="ml-3"><p className={`font-bold ${result.errors.length > 0 ? 'text-red-800 dark:text-red-200' : 'text-gray-800 dark:text-gray-200'}`}>{result.errors.length} errors</p><p className={`text-sm ${result.errors.length > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'}`}>Rows with issues</p></div></div>
                            </div>
                            {result.errors.length > 0 && (<div className="mt-4"><button onClick={downloadErrorCsv} className="text-sm text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1"><DownloadIcon /> Download Error Report</button></div>)}
                        </div>
                    );
                }
                return null;
            case 'upload':
            default:
                return (
                    <div>
                         {error && <div className="mb-4 bg-red-50 dark:bg-red-500/20 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg flex items-center"><AlertCircleIcon /><span className="ml-2">{error}</span></div>}
                         <div onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDragEnter={() => setDragActive(true)} onDragLeave={() => setDragActive(false)} className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${ dragActive ? 'border-red-400 bg-red-50/80 dark:bg-red-500/10 scale-[1.02]' : 'border-gray-300 dark:border-slate-600 hover:border-red-300 dark:hover:border-red-500' }`}>
                            <input type="file" accept=".csv" onChange={(e) => handleFileSelectInternal(e.target.files ? e.target.files[0] : null)} className="hidden" id={`csv-upload-input-${uploadType}`} />
                             <div className={`w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center transition-all duration-300 ${ dragActive ? 'bg-red-100' : 'bg-gray-100 dark:bg-slate-700' }`}><FileTextIcon className={`w-8 h-8 transition-colors duration-300 ${ dragActive ? 'text-red-600' : 'text-gray-600 dark:text-gray-300' }`} /></div>
                             <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Drop your CSV here</h3>
                             <p className="text-gray-600 dark:text-gray-400 mt-1">or</p>
                             <button onClick={() => document.getElementById(`csv-upload-input-${uploadType}`)?.click()} className="mt-2 text-red-600 font-semibold hover:underline">browse files</button>
                         </div>
                         <div className="mt-6 p-4 bg-gray-100 dark:bg-slate-700/50 rounded-lg">
                             <h4 className="font-semibold text-gray-800 dark:text-gray-200">Instructions & Template</h4>
                             <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{templateInstructions}</div>
                             <button onClick={onDownloadTemplate} className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1"><DownloadIcon /> Download CSV Template</button>
                         </div>
                    </div>
                );
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700">
            <div className="flex items-start gap-4 mb-6">
                <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${uploadType === 'credentials' ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-green-100 dark:bg-green-900/50'}`}>
                    {uploadType === 'credentials' ? <UserIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" /> : <AwardIcon className="w-6 h-6 text-green-600 dark:text-green-400" />}
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">{description}</p>
                </div>
            </div>
            {renderContent()}
            {stage === 'results' && (<div className="mt-8 text-center"><button onClick={resetForNewUpload} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-md font-semibold transition-transform hover:scale-105">Upload Another File</button></div>)}
        </div>
    );
}

const BulkUploadPage: React.FC<BulkUploadPageProps> = ({ onComplete }) => {
    
    const handleCredentialUpload = async (file: File) => {
        const result = await bulkUploadCredentials(file);
        if (result.success > 0) onComplete();
        return result;
    };
    
    const handleVoucherUpload = async (file: File) => {
        return await bulkUploadVouchers(file);
    };

    const downloadCredentialTemplate = () => {
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

    const downloadVoucherTemplate = () => {
        const headers = "Credential_Name,Voucher_Code,Expiry_Date";
        const exampleRow = "Databricks Certified Data Engineer Associate,DB-VOUCHER-123,2025-12-31";
        const csvContent = `${headers}\n${exampleRow}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'voucher_upload_template.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-12">
            <BulkUploadSection
                title="Bulk Upload Credentials"
                description="Upload a CSV to add or update multiple employee credentials at once."
                templateInstructions={<p>Your CSV must have the headers: <code className="font-mono bg-gray-200 dark:bg-slate-600 px-1 rounded">credential_name</code>, <code className="font-mono bg-gray-200 dark:bg-slate-600 px-1 rounded">final_email</code>, <code className="font-mono bg-gray-200 dark:bg-slate-600 px-1 rounded">issued_on</code>, <code className="font-mono bg-gray-200 dark:bg-slate-600 px-1 rounded">expired_on</code>.</p>}
                onDownloadTemplate={downloadCredentialTemplate}
                onFileSelect={handleCredentialUpload}
                uploadType="credentials"
            />
            <BulkUploadSection
                title="Bulk Upload Vouchers"
                description="Upload a CSV file containing available voucher codes and their expiry dates."
                templateInstructions={<p>Your CSV must have the headers: <code className="font-mono bg-gray-200 dark:bg-slate-600 px-1 rounded">Credential_Name</code>, <code className="font-mono bg-gray-200 dark:bg-slate-600 px-1 rounded">Voucher_Code</code>, <code className="font-mono bg-gray-200 dark:bg-slate-600 px-1 rounded">Expiry_Date</code>.</p>}
                onDownloadTemplate={downloadVoucherTemplate}
                onFileSelect={handleVoucherUpload}
                uploadType="vouchers"
            />
        </div>
    );
};

export default BulkUploadPage;
