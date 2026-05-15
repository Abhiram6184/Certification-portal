import React, { useRef, useState } from 'react';
import UploadIcon from '../icons/UploadIcon';
import FileTextIcon from '../icons/FileTextIcon';
import SparklesIcon from '../icons/SparklesIcon';
import AlertCircleIcon from '../icons/AlertCircleIcon';
import LinkIcon from '../icons/LinkIcon';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  onPdfUrlSelect: (url: string) => void;
  onWalletUrlSelect: (url: string) => void;
  dragActive: boolean;
  setDragActive: (isActive: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

export default function UploadZone({ onFileSelect, onPdfUrlSelect, onWalletUrlSelect, dragActive, setDragActive, error, setError }: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [walletUrl, setWalletUrl] = useState('');

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    const files = Array.from(e.dataTransfer.files);
    const supportedTypes = ["application/pdf", "image/jpeg", "image/png"];
    // FIX: Explicitly type `file` as `File` to resolve type inference issue.
    const validFile = files.find((file: File) => supportedTypes.includes(file.type));


    if (!validFile) {
      setError("Please upload a PDF, JPG, or PNG file.");
      return;
    }

    onFileSelect(validFile);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    
    if (!file) return;
    
    const supportedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!supportedTypes.includes(file.type)) {
      setError("Please upload a PDF, JPG, or PNG file.");
      return;
    }

    onFileSelect(file);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleUrlSubmit = (type: 'pdf' | 'wallet') => {
    const url = type === 'pdf' ? pdfUrl : walletUrl;
    if (!url.trim()) {
        setError("Please enter a valid URL.");
        return;
    }
    try {
        new URL(url);
    } catch (_) {
        setError("The entered URL is not valid. Please provide a full URL including http/https.");
        return;
    }
    setError(null);
    if (type === 'pdf') {
        onPdfUrlSelect(url);
    } else {
        onWalletUrlSelect(url);
    }
  };

  // Check if this is a name validation error (should be displayed larger)
  const isNameValidationError = error && error.includes('Name validation failed');

  return (
    <div className="relative">
      {error && (
        <>
          {isNameValidationError ? (
            // Large modal-style error for name validation
            <div className="mb-8 bg-red-50 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-500/50 text-red-900 dark:text-red-100 rounded-2xl shadow-2xl p-8">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center">
                    <AlertCircleIcon className="w-7 h-7 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-2xl font-bold text-red-900 dark:text-red-100 mb-3">
                    ⚠️ Name Validation Failed
                  </h3>
                  <p className="text-lg leading-relaxed text-red-800 dark:text-red-200 whitespace-pre-line">
                    {error}
                  </p>
                  <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-500/30">
                    <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                      Please verify you are using the correct Databricks wallet URL for your account.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Regular error display for other errors
            <div className="mb-6 bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg flex items-center">
              <AlertCircleIcon />
              <span className="ml-2">{error}</span>
            </div>
          )}
        </>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
          dragActive 
            ? 'border-red-400 bg-red-50/80 dark:bg-red-500/10 scale-[1.02]' 
            : 'border-gray-300 dark:border-slate-600 hover:border-red-300 dark:hover:border-red-500 hover:bg-red-50/30 dark:hover:bg-red-500/5'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="relative">
          <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center transition-all duration-300 ${
            dragActive 
              ? 'bg-red-100 dark:bg-red-500/20 shadow-lg' 
              : 'bg-gradient-to-br from-gray-100 to-gray-50 dark:from-slate-700 dark:to-slate-600 shadow-sm'
          }`}>
            <FileTextIcon className={`w-10 h-10 transition-colors duration-300 ${
              dragActive ? 'text-red-600' : 'text-gray-600 dark:text-gray-300'
            }`} />
          </div>

          {dragActive ? (
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-red-700 dark:text-red-400">Drop your certificate here</h3>
              <p className="text-red-600 dark:text-red-300 font-medium">Release to process your file</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Upload Certificate File</h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                Drag and drop your certificate file (PDF, JPG, PNG) here, or click to browse and select a file.
              </p>
              
              <button
                type="button" 
                onClick={handleBrowseClick}
                className="mt-6 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-medium inline-flex items-center"
              >
                <UploadIcon className="w-5 h-5 mr-2" />
                Choose File
              </button>
              
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500 dark:text-gray-400">
                <SparklesIcon />
                <span>AI-powered extraction for non-Databricks certs</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="relative flex py-5 items-center">
        <div className="flex-grow border-t border-gray-200 dark:border-slate-700"></div>
        <span className="flex-shrink mx-4 text-gray-400 text-sm font-medium">OR</span>
        <div className="flex-grow border-t border-gray-200 dark:border-slate-700"></div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div>
            <label htmlFor="wallet-url" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <img src="/components/images/databricks-logo.webp" alt="Databricks" className="w-5 h-5" />
                Add from Databricks Wallet
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
                <input
                    type="url"
                    id="wallet-url"
                    value={walletUrl}
                    onChange={(e) => { setWalletUrl(e.target.value); if (error) setError(null); }}
                    className="block w-full flex-1 rounded-none rounded-l-md border-gray-300 dark:border-slate-600 dark:bg-slate-700 focus:border-red-500 focus:ring-red-500 sm:text-sm px-3"
                    placeholder="https://credential.net/profile/..."
                />
                <button
                    type="button"
                    onClick={() => handleUrlSubmit('wallet')}
                    className="relative -ml-px inline-flex items-center space-x-2 rounded-r-md border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-600 dark:text-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                    <span>Scrape</span>
                </button>
            </div>
        </div>
        <div>
            <label htmlFor="cert-url" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <LinkIcon />
                Add from single PDF URL
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
                <input
                    type="url"
                    id="cert-url"
                    value={pdfUrl}
                    onChange={(e) => { setPdfUrl(e.target.value); if (error) setError(null); }}
                    className="block w-full flex-1 rounded-none rounded-l-md border-gray-300 dark:border-slate-600 dark:bg-slate-700 focus:border-red-500 focus:ring-red-500 sm:text-sm px-3"
                    placeholder="https://.../certificate.pdf"
                />
                <button
                    type="button"
                    onClick={() => handleUrlSubmit('pdf')}
                    className="relative -ml-px inline-flex items-center space-x-2 rounded-r-md border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-600 dark:text-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                    <span>Process</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}