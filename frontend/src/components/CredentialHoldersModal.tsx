import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CredentialSummary, CredentialHolder } from '../types';
import { getEmployeesByCredential } from '../services/api';
import { BADGE_IMAGES } from '../constants';
import CloseIcon from './icons/CloseIcon';
import AwardIcon from './icons/AwardIcon';
import EtlLoader from './EtlLoader';
import DownloadIcon from './icons/DownloadIcon';


interface CredentialHoldersModalProps {
  credential: CredentialSummary;
  onClose: () => void;
  validEmpCodes?: Set<string> | null;
  selectedLocation?: string;
}

const CredentialHoldersModal = ({ credential, onClose, validEmpCodes, selectedLocation }: CredentialHoldersModalProps) => {
  const [holders, setHolders] = useState<CredentialHolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const badgeImageSrc = BADGE_IMAGES[credential.credential_title];

  useEffect(() => {
    const fetchHolders = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await new Promise(resolve => setTimeout(resolve, 800)); // Slight delay for smoothness
        const data = await getEmployeesByCredential(credential.credential_title);
        setHolders(data);
      } catch (error) {
        console.error("Failed to fetch credential holders:", error);
        setError("Could not load employees for this credential.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchHolders();
  }, [credential.credential_title]);

  const filteredHolders = React.useMemo(() => {
    if (!validEmpCodes) return holders;
    return holders.filter(h => validEmpCodes.has(h.Emp_Code));
  }, [holders, validEmpCodes]);

  const escapeCsvField = (field: string | number | null | undefined): string => {
    if (field === null || field === undefined) return '""';
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
  };

  const downloadCSV = () => {
    if (isLoading || filteredHolders.length === 0) return;

    const headers = ["CredentialName", "Emp_Code", "Employee_Name", "Employee_EmailID", "Designation"];

    const rows = filteredHolders.map(holder => [
      escapeCsvField(credential.credential_title),
      escapeCsvField(holder.Emp_Code),
      escapeCsvField(holder.Employee_Name),
      escapeCsvField(holder.Employee_EmailID),
      escapeCsvField(holder.Designation),
    ].join(','));

    const footer = [`\nTotal Employees:,${filteredHolders.length}`];

    const csvContent = [headers.join(','), ...rows, ...footer].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const filename = `${credential.credential_title.replace(/[\s:]+/g, '_')}_holders.csv`;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      aria-hidden="true"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-title"
        className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* Header Section */}
        <div className="relative p-8 pb-6 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-br from-gray-50 to-white dark:from-slate-900 dark:to-slate-800/50 flex-shrink-0 z-10">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close modal"
          >
            <CloseIcon />
          </button>

          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
            <div className="flex-shrink-0 relative group">
              <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              {badgeImageSrc ? (
                <motion.img
                  src={badgeImageSrc}
                  alt={credential.credential_title}
                  layoutId={`badge-image-${credential.credential_title}`}
                  className="relative w-48 h-48 object-contain drop-shadow-xl"
                />
              ) : (
                <div className="relative w-48 h-48 flex items-center justify-center bg-gray-100 dark:bg-slate-800 rounded-2xl">
                  <AwardIcon className="w-16 h-16 text-gray-300" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pt-2">
              <h2 id="badge-title" className="text-3xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">
                {credential.credential_title}
              </h2>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full font-medium text-sm border border-blue-100 dark:border-blue-800">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  {/* Show Filtered Count vs Total? Usually showing filtered count is better context */}
                  {filteredHolders.length} {filteredHolders.length === 1 ? 'Holder' : 'Holders'}
                  {validEmpCodes && (
                    <span className="text-xs opacity-75 ml-1">(Filtered)</span>
                  )}
                </div>

                <button
                  onClick={downloadCSV}
                  disabled={isLoading || filteredHolders.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 rounded-full hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-300 dark:hover:border-slate-600 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <DownloadIcon className="w-4 h-4" />
                  Download CSV
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50 dark:bg-slate-900/50 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <EtlLoader label="Finding experts..." size={300} />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full mb-4">
                <span className="text-3xl">⚠️</span>
              </div>
              <p className="text-lg font-medium text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : filteredHolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-lg text-gray-500 dark:text-gray-400">
                {validEmpCodes ? "No employees match current filters for this credential." : "No employees listed for this credential yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredHolders.map((holder, index) => (
                <motion.div
                  key={holder.Emp_Code + index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="group relative bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700 hover:shadow-lg hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 flex items-center gap-4 cursor-default"
                >
                  {/* Horizontal Tile Content */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-lg font-bold text-gray-600 dark:text-gray-300 shadow-inner">
                      {holder.Employee_Name.charAt(0)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {holder.Employee_Name}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {holder.Designation}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 text-xs font-mono rounded-md">
                      {holder.Emp_Code}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CredentialHoldersModal;