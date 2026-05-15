import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getLeaderboardData } from '../services/api';
import { LeaderboardEntry, User, LeaderboardResponse } from '../types';
import EtlLoader from './EtlLoader';
import EmployeeCredentialsModal from './EmployeeCredentialsModal';
import CloseIcon from './icons/CloseIcon';
import LeaderboardIcon from './icons/LeaderboardIcon';

interface LeaderboardModalProps {
    currentUser: User;
    onClose: () => void;
}

const RankIndicator: React.FC<{ rank: number }> = ({ rank }) => {
    const medals: { [key: number]: string } = {
        1: '🥇',
        2: '🥈',
        3: '🥉',
    };

    if (rank in medals) {
        return <span className="text-3xl">{medals[rank]}</span>;
    }

    return (
        <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            {rank}
        </span>
    );
};

const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ currentUser, onClose }) => {
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<LeaderboardEntry | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [data] = await Promise.all([
                    getLeaderboardData(),
                    new Promise(resolve => setTimeout(resolve, 1500))
                ]);
                // FIX: Destructure the 'leaderboard' property from the API response before setting the state, as the API returns a 'LeaderboardResponse' object, not an array of 'LeaderboardEntry'.
                setLeaderboardData(data.leaderboard);
            } catch (err) {
                setError("Could not load leaderboard data. Please try again later.");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredData = useMemo(() => {
        if (!searchTerm) return leaderboardData;
        return leaderboardData.filter(entry =>
            entry.Emp_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.emp_code.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [leaderboardData, searchTerm]);

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center h-96"><EtlLoader label="Calculating ranks..." /></div>;
        }

        if (error) {
            return <div className="text-center text-red-500 p-8">{error}</div>;
        }

        return (
            <ul className="space-y-3">
                <AnimatePresence>
                    {filteredData.map((entry) => (
                        <motion.li
                            key={entry.emp_code}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            onClick={() => setSelectedEmployee(entry)}
                            className={`flex items-center p-4 rounded-xl shadow-sm transition-all duration-300 cursor-pointer border ${
                                currentUser.id === entry.emp_code
                                    ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 scale-105 shadow-lg'
                                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:shadow-md'
                            }`}
                        >
                            <div className="w-16 flex-shrink-0 flex items-center justify-center">
                                <RankIndicator rank={entry.rank} />
                            </div>
                            <div className="flex-1 min-w-0 mx-4">
                                <p className="font-bold text-gray-900 dark:text-gray-100 truncate">{entry.Emp_name}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{entry.Designation || `Emp Code: ${entry.emp_code}`}</p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                                <p className="text-lg font-extrabold text-red-600 dark:text-red-400">{entry.credential_count}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Credentials</p>
                            </div>
                        </motion.li>
                    ))}
                </AnimatePresence>
            </ul>
        );
    };

    return (
        <>
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
                    className="relative w-full max-w-2xl transform rounded-2xl bg-gray-50 dark:bg-slate-900 text-left shadow-2xl transition-all max-h-[90vh] flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                    initial={{ scale: 0.95, opacity: 0, y: 50 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 50 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                >
                    <header className="p-6 border-b border-gray-200 dark:border-slate-700 flex-shrink-0 sticky top-0 bg-gray-50 dark:bg-slate-900 z-10">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <LeaderboardIcon className="w-8 h-8 text-red-500" />
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Leaderboard</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Company-wide Certification Rankings</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400"><CloseIcon /></button>
                        </div>
                        <div className="mt-4">
                            <input
                                type="text"
                                placeholder="Search by name or employee code..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
                            />
                        </div>
                    </header>
                    <main className="p-6 overflow-y-auto">
                        {renderContent()}
                    </main>
                </motion.div>
            </motion.div>

            <AnimatePresence>
                {selectedEmployee && (
                    <EmployeeCredentialsModal
                        employee={selectedEmployee}
                        onClose={() => setSelectedEmployee(null)}
                        showDownloadButton={false}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default LeaderboardModal;
