import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CertificationRequest, RequestStatus } from '../types';
import { generateFulfillmentEmail } from '../services/api';
import SparklesIcon from './icons/SparklesIcon';

interface AssignVoucherModalProps {
  request: CertificationRequest;
  onClose: () => void;
  onConfirm: (updates: Partial<CertificationRequest>, emailContent: string) => void;
}

const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateString;
    }
};

const DetailItem = ({ label, value }: { label: string; value?: string }) => (
    <div>
        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-semibold">{value || 'N/A'}</dd>
    </div>
);

const AssignVoucherModal = ({ request, onClose, onConfirm }: AssignVoucherModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [voucherId, setVoucherId] = useState('');
  const [isDetailsSubmitted, setIsDetailsSubmitted] = useState(false);

  const handleGenerateEmail = useCallback(async () => {
    if (!voucherId) return;
    
    setIsLoading(true);
    setGeneratedEmail('');
    setIsDetailsSubmitted(true);
    try {
      const email = await generateFulfillmentEmail(request.user.name, request.certification.name, parseInt(voucherId, 10));
      setGeneratedEmail(email);
    } catch (error) {
      console.error('Failed to generate fulfillment email:', error);
      setGeneratedEmail('Could not generate email content. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [voucherId, request]);

  const handleConfirm = () => {
    onConfirm({ 
        status: RequestStatus.Fulfilled,
        voucherId: parseInt(voucherId, 10),
    }, generatedEmail);
  };
  
  const showVoucherInput = !isDetailsSubmitted;
  const showEmailPreview = generatedEmail && !isLoading;

  return (
    <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-70 backdrop-blur-sm p-4"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
    >
        <motion.div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-4xl transform rounded-xl bg-white dark:bg-slate-800 text-left shadow-2xl transition-all max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
                <h3 className="text-lg font-bold leading-6 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <SparklesIcon />
                    Assign Voucher
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Enter voucher details for {request.user.name}'s request and notify them.
                </p>
            </div>
            
            {/* Main Content Area */}
            <div className="flex-grow grid md:grid-cols-2 gap-x-8 overflow-hidden">
                {/* Left Column: Details */}
                <div className="p-6 border-r border-gray-200 dark:border-slate-700 overflow-y-auto">
                    <h4 className="text-base font-bold text-gray-900 dark:text-gray-100 border-b dark:border-slate-600 pb-2 mb-4">Request Details</h4>
                    <dl className="space-y-4">
                        <DetailItem label="Employee Name" value={request.user.name} />
                        <DetailItem label="Employee Email" value={request.user.email} />
                        <DetailItem label="Employee Code" value={request.userId} />
                        <DetailItem label="Credential Requested" value={request.certification.name} />
                        <DetailItem label="Requested Date" value={formatDate(request.requestDate)} />
                    </dl>
                </div>

                {/* Right Column: Email Generator */}
                <div className="p-6 flex flex-col space-y-4 overflow-y-auto">
                    {showVoucherInput && (
                        <div>
                            <label htmlFor="voucherId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Voucher ID / Code
                            </label>
                            <input
                                id="voucherId"
                                type="text"
                                value={voucherId}
                                onChange={(e) => setVoucherId(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm p-2"
                                placeholder="Enter voucher ID or code"
                            />
                            <button
                                onClick={handleGenerateEmail}
                                disabled={!voucherId || isLoading}
                                className="mt-2 inline-flex items-center justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Generating...' : 'Generate Fulfillment Email'}
                            </button>
                        </div>
                    )}
                
                    {isLoading && isDetailsSubmitted && (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto"></div>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Generating email content...</p>
                        </div>
                    )}

                    {showEmailPreview && (
                        <div className="flex-grow flex flex-col min-h-0">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex-shrink-0">Generated Email Preview</label>
                            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 border border-gray-200 dark:border-slate-600 whitespace-pre-wrap text-gray-700 dark:text-gray-300 text-sm overflow-y-auto flex-grow">
                                {generatedEmail}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Fixed Footer */}
            <div className="bg-gray-50 dark:bg-slate-700/50 px-6 py-4 sm:flex sm:flex-row-reverse rounded-b-xl border-t border-gray-200 dark:border-slate-700 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isLoading || !generatedEmail}
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Confirm Assignment
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
            </div>
        </motion.div>
    </motion.div>
  );
};

export default AssignVoucherModal;