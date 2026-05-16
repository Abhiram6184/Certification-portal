import React, { useState } from 'react';
import { extractCertificateData, extractCertificateDataFromUrl } from '../services/api';
import { ExtractedCertificate, User, CertificationRequest } from '../types';

import UploadZone from './upload/UploadZone';
import ProcessingStatus from './upload/ProcessingStatus';
import CertificatePreview from './upload/CertificatePreview';
import CloseIcon from './icons/CloseIcon';
import EtlLoader from './EtlLoader';

interface UploadCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (certificateData: ExtractedCertificate) => Promise<void>;
  currentUser: User;
}

type Stage = 'upload' | 'processing' | 'preview' | 'saving';

export default function UploadCertificateModal({ isOpen, onClose, onSave, currentUser }: UploadCertificateModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [stage, setStage] = useState<Stage>('upload');
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingSource, setProcessingSource] = useState<string>('your file');
  const [extractedData, setExtractedData] = useState<ExtractedCertificate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setDragActive(false);
    setStage('upload');
    setProgress(0);
    setSelectedFile(null);
    setExtractedData(null);
    setError(null);
    setProcessingSource('your file');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handlePdfUrlSelect = async (url: string) => {
    setSelectedFile(null);
    setError(null);
    setStage('processing');
    setProgress(0);
    setProcessingSource(url);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 95));
      }, 300);

      const result = await extractCertificateDataFromUrl(url);

      clearInterval(progressInterval);
      setProgress(100);

      if (result) {
        setTimeout(() => {
          const dataWithFileName: ExtractedCertificate = {
            ...result,
            file_name: url
          };
          setExtractedData(dataWithFileName);
          setStage('preview');
        }, 500);
      } else {
        throw new Error("Could not extract certificate data from the URL.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to process from URL. Please ensure the link points to a public PDF and try again.");
      console.error("Error processing certificate from URL:", err);
      setStage('upload');
    }
  };


  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setError(null);
    setStage('processing');
    setProgress(0);
    setProcessingSource(file.name);

    try {
      // Simulate initial upload/prep
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 300);

      const result = await extractCertificateData(file);

      clearInterval(progressInterval);
      setProgress(100);

      if (result) {
        setTimeout(() => {
          setExtractedData(result);
          setStage('preview');
        }, 500);
      } else {
        throw new Error("Could not extract certificate data from the PDF.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to process the certificate. Please ensure the file is a valid certificate PDF and try again.");
      console.error("Error processing certificate:", err);
      setStage('upload'); // Go back to upload stage on error
    }
  };

  const handleSaveCertificate = async (certificateData: ExtractedCertificate) => {
    setStage('saving');
    setError(null);
    try {
      await onSave(certificateData);
      // On success, the parent component will close the modal.
    } catch (err: any) {
      setError("Failed to save certificate. Please try again.");
      console.error("Error saving certificate:", err);
      setStage('preview'); // Go back to preview on save error
    }
  };

  const handleCancelPreview = () => {
    resetState();
  };

  if (!isOpen) return null;

  const renderContent = () => {
    switch (stage) {
      case 'processing':
        return (
          <div className="flex justify-center py-16">
            <div className="w-full max-w-md">
              <ProcessingStatus
                fileName={processingSource}
                progress={progress}
              />
            </div>
          </div>
        );
      case 'saving':
      case 'preview':
        if (extractedData) {
          return (
            <CertificatePreview
              extractedData={extractedData}
              onSave={handleSaveCertificate}
              onCancel={handleCancelPreview}
              isProcessing={stage === 'saving'}
              error={error}
            />
          );
        }
        return null;
      case 'upload':
      default:
        return (
          <UploadZone
            onFileSelect={handleFileSelect}
            onPdfUrlSelect={handlePdfUrlSelect}
            dragActive={dragActive}
            setDragActive={setDragActive}
            error={error}
            setError={setError}
          />
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-70 backdrop-blur-sm"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl transform rounded-xl bg-gray-50 dark:bg-slate-800 text-left shadow-2xl transition-all m-4">
        <div className="absolute top-0 right-0 pt-4 pr-4 z-10">
            <button
                type="button"
                className="rounded-md bg-gray-100 dark:bg-slate-700 p-2 text-gray-400 dark:text-gray-400 hover:text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                onClick={handleClose}
            >
                <span className="sr-only">Close</span>
                <CloseIcon />
            </button>
        </div>
        <div className="p-8 sm:p-12">
            {renderContent()}
        </div>
      </div>
    </div>
  );
}