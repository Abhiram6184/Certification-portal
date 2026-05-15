import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Certification } from '../types';
import Loader2Icon from './icons/Loader2Icon';
import CheckIcon from './icons/CheckIcon';

interface CertificationCardProps {
    certification: Certification;
    onRequest: () => Promise<void>;
    isRequested: boolean;
}

const CertificationCard: React.FC<CertificationCardProps> = ({ certification, onRequest, isRequested }) => {
    const [requestState, setRequestState] = useState<'idle' | 'requesting' | 'success'>('idle');

    const handleRequestClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (requestState !== 'idle' || isRequested) return;

        setRequestState('requesting');
        try {
            await onRequest();
            setRequestState('success');
        } catch (error) {
            // The parent component shows an alert. We just reset the button.
            setRequestState('idle');
        }
    };

    const cardContent = (
        <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 flex flex-col justify-between border border-gray-200 dark:border-slate-700 h-full transition-all duration-300 ${
            isRequested ? 'grayscale opacity-60' : 'hover:shadow-xl'
        }`}>
            <div>
                <span className="text-xs font-semibold text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-500/20 px-2 py-1 rounded-full">{certification.vendor}</span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-3">{certification.name}</h3>
                <div className="mt-4 flex flex-col space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center">
                        <span className="font-semibold w-24">Duration:</span>
                        <span>{certification.duration}</span>
                    </div>
                    <div className="flex items-center">
                        <span className="font-semibold w-24">Validity:</span>
                        <span>{certification.validityYears} Year{certification.validityYears > 1 ? 's' : ''}</span>
                    </div>
                </div>
            </div>
            <div className="mt-6">
                <button
                    onClick={handleRequestClick}
                    disabled={isRequested || requestState !== 'idle'}
                    className={`w-full justify-center rounded-md border border-transparent py-2 px-4 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 flex items-center h-9
                        ${isRequested ? 'bg-gray-400 dark:bg-slate-600 cursor-not-allowed' : ''}
                        ${!isRequested && requestState === 'idle' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : ''}
                        ${!isRequested && requestState === 'requesting' ? 'bg-yellow-500 cursor-wait' : ''}
                        ${!isRequested && requestState === 'success' ? 'bg-green-600 cursor-not-allowed' : ''}
                    `}
                >
                    <AnimatePresence mode="wait" initial={false}>
                        {isRequested ? (
                            <motion.span key="requested" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                Already Requested
                            </motion.span>
                        ) : requestState === 'idle' ? (
                            <motion.span key="idle" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }}>
                                Request Voucher
                            </motion.span>
                        ) : requestState === 'requesting' ? (
                            <motion.span key="requesting" className="flex items-center" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }}>
                                <Loader2Icon className="animate-spin -ml-1 mr-3 h-5 w-5" />
                                Requesting...
                            </motion.span>
                        ) : ( // success
                             <motion.span key="success" className="flex items-center" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }}>
                                <CheckIcon />
                                <span className="ml-2">Request Sent!</span>
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>
            </div>
        </div>
    );

    if (certification.url) {
        return (
            <a href={certification.url} target="_blank" rel="noopener noreferrer" className="block h-full no-underline text-current">
                {cardContent}
            </a>
        );
    }

    return cardContent;
};

export default CertificationCard;