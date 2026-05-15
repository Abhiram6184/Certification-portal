import React, { useState, useRef } from 'react';
import { ExtractedCertificate } from '../../types';
import SaveIcon from '../icons/SaveIcon';
import CloseIcon from '../icons/CloseIcon';
import AwardIcon from '../icons/AwardIcon';
import BuildingIcon from '../icons/BuildingIcon';
import UserIcon from '../icons/UserIcon';
import CalendarIcon from '../icons/CalendarIcon';
import ClockIcon from '../icons/ClockIcon';
import AlertCircleIcon from '../icons/AlertCircleIcon';

interface CertificatePreviewProps {
  extractedData: ExtractedCertificate;
  onSave: (data: ExtractedCertificate) => void;
  onCancel: () => void;
  isProcessing: boolean;
  error: string | null;
}

export default function CertificatePreview({ 
  extractedData, 
  onSave, 
  onCancel, 
  isProcessing,
  error,
}: CertificatePreviewProps) {
  const [editedData, setEditedData] = useState(extractedData);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (field: keyof ExtractedCertificate, value: string) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    onSave(editedData);
  };
  
  const handleCalendarClick = () => {
    try {
        dateInputRef.current?.showPicker();
    } catch (e) {
        dateInputRef.current?.click();
    }
  };
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
        handleInputChange('expiry_date', e.target.value);
    }
  };

  return (
    <div className="border-0 shadow-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm overflow-hidden rounded-xl">
      <header className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200/60 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <AwardIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Review Certificate Data</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Verify and edit the AI-extracted information.</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-8">
         {error && (
          <div className="bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg flex items-center">
              <AlertCircleIcon />
              <span className="ml-2">{error}</span>
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="issuer_name" className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium text-sm">
              <BuildingIcon className="w-4 h-4" />
              Issuer Organization
            </label>
            <input
              id="issuer_name"
              value={editedData.issuer_name || ''}
              onChange={(e) => handleInputChange('issuer_name', e.target.value)}
              placeholder="e.g., Microsoft, Databricks"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 h-11"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="credential_name" className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium text-sm">
              <AwardIcon className="w-4 h-4" />
              Certificate Name
            </label>
            <input
              id="credential_name"
              value={editedData.credential_name || ''}
              onChange={(e) => handleInputChange('credential_name', e.target.value)}
              placeholder="e.g., Azure Fundamentals"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 h-11"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="holder_full_name" className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium text-sm">
              <UserIcon className="w-4 h-4" />
              Certificate Holder
            </label>
            <input
              id="holder_full_name"
              value={editedData.holder_full_name || ''}
              onChange={(e) => handleInputChange('holder_full_name', e.target.value)}
              placeholder="e.g., Alex Doe"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 h-11"
            />
          </div>

          <div className="space-y-2">
             <label htmlFor="issued_date" className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium text-sm">
                <CalendarIcon className="w-4 h-4" />
                Issue Date
            </label>
            <input
              id="issued_date"
              type="date"
              value={editedData.issued_date || ''}
              onChange={(e) => handleInputChange('issued_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 h-11"
            />
          </div>
        </div>

        <div className="space-y-2">
           <label htmlFor="expiry_date" className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium text-sm">
                <ClockIcon className="w-4 h-4" />
                Expiry Information
            </label>
          <div className="relative">
            <input
              id="expiry_date"
              type="text"
              value={editedData.expiry_date || ''}
              onChange={(e) => handleInputChange('expiry_date', e.target.value)}
              placeholder="YYYY-MM-DD or 'Does not expire'"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 h-11 pr-10"
            />
            {/* Hidden date input for the picker */}
            <input
                ref={dateInputRef}
                type="date"
                onChange={handleDateChange}
                className="absolute opacity-0 w-0 h-0 pointer-events-none"
                tabIndex={-1}
                aria-hidden="true"
            />
            <button
                type="button"
                onClick={handleCalendarClick}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-r-md"
                aria-label="Select expiry date from calendar"
            >
                <CalendarIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 border border-gray-200 dark:border-slate-600">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{editedData.file_name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Original uploaded file</p>
        </div>
      </div>

      <footer className="bg-gray-50/80 dark:bg-slate-700/50 border-t border-gray-200/60 dark:border-slate-700 p-6">
        <div className="flex justify-end gap-4 w-full">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="px-6 py-2 rounded-md border-gray-300 dark:border-slate-600 border bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 font-medium text-gray-800 dark:text-gray-200 inline-flex items-center gap-2"
          >
            <CloseIcon />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isProcessing}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-300 font-medium inline-flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <SaveIcon />
            {isProcessing ? 'Saving...' : 'Save Certificate'}
          </button>
        </div>
      </footer>
    </div>
  );
}