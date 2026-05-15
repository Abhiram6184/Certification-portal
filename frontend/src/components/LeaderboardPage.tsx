import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getLeaderboardData, getIssuerLeaderboard, getCredentialSummary, getAdminEmployees } from '../services/api';
import { LeaderboardEntry, User, IssuerLeaderboardEntry, CredentialSummary } from '../types';
import { BADGE_IMAGES } from '../constants';
import { normalizeTitle, getIssuerFromTitle, NORMALIZED_CERTIFICATION_TITLES } from '../utils';
import EtlLoader from './EtlLoader';
import EmployeeCredentialsModal from './EmployeeCredentialsModal';
import CloseIcon from './icons/CloseIcon';
import LeaderboardIcon from './icons/LeaderboardIcon';
import AwardIcon from './icons/AwardIcon';

interface LeaderboardPageProps {
    currentUser: User;
    onBack: () => void;
    // New optional props for embedded mode with filters
    selectedIssuer?: string;
    selectedCollection?: string;
    selectedLocation?: string;
    onLocationsAvailable?: (locations: string[]) => void;
}
// ... RankIndicator component ... (omitted for brevity, assume unchanged or handle if needed)

const RankIndicator: React.FC<{ rank: number }> = ({ rank }) => {
    const rankStyles: { [key: number]: { bg: string; text: string; icon: string; glow: string } } = {
        1: {
            bg: 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500',
            text: 'text-yellow-900',
            icon: '🏆',
            glow: 'shadow-lg shadow-yellow-400/50'
        },
        2: {
            bg: 'bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500',
            text: 'text-gray-900',
            icon: '🥈',
            glow: 'shadow-lg shadow-gray-400/50'
        },
        3: {
            bg: 'bg-gradient-to-br from-orange-400 via-amber-600 to-orange-700',
            text: 'text-orange-900',
            icon: '🥉',
            glow: 'shadow-lg shadow-orange-400/50'
        },
    };

    if (rank in rankStyles) {
        const style = rankStyles[rank];
        return (
            <motion.div
                className={`relative ${style.bg} ${style.glow} rounded-2xl w-14 h-14 flex items-center justify-center`}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: rank * 0.1 }}
            >
                <span className="text-2xl">{style.icon}</span>
                <motion.div
                    className="absolute inset-0 bg-white/30 rounded-2xl"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
            </motion.div>
        );
    }

    return (
        <motion.div
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center border border-gray-300 dark:border-slate-600"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
            <span className="text-xl font-bold text-gray-700 dark:text-gray-300">
                {rank}
            </span>
        </motion.div>
    );
};


const LeaderboardPage: React.FC<LeaderboardPageProps & { isEmbedded?: boolean }> = ({
    currentUser,
    onBack,
    isEmbedded = false,
    selectedIssuer = 'All',
    selectedCollection = 'All',
    selectedLocation = 'All',
    onLocationsAvailable
}) => {
    const [leaderboardType, setLeaderboardType] = useState<'employee' | 'issuer'>('employee');
    // We will now calculate leaderboard data client-side based on credential summary
    const [credentialSummary, setCredentialSummary] = useState<CredentialSummary[]>([]);
    const [employees, setEmployees] = useState<any[]>([]); // To map code to name/designation

    // Computed states
    const [employeeLeaderboard, setEmployeeLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [issuerLeaderboard, setIssuerLeaderboard] = useState<IssuerLeaderboardEntry[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<LeaderboardEntry | null>(null);

    const issuerLogos: Record<string, string> = {
        'Databricks': new URL('./images/databricks-logo.webp', import.meta.url).href,
        'Microsoft': new URL('./images/microsoft-logo.png', import.meta.url).href,
        'Google': new URL('./images/google-logo.png', import.meta.url).href,
        // 'AWS': new URL('./images/aws-logo.png', import.meta.url).href,
    };

    // 1. Fetch Request: Get Raw Data (Credential Summary & Employees)
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [summaryData, employeeData] = await Promise.all([
                    getCredentialSummary(),
                    getAdminEmployees() // Or getLeaderboardData purely for names if admin api restricted? Admin API usually fine for names.
                    // If currentUser is not admin, getAdminEmployees might fail? 
                    // Let's use getLeaderboardData to get base employee list with names/designations safely
                ]);

                setCredentialSummary(summaryData);
                setEmployees(employeeData); // Assuming getAdminEmployees works, else fallback
            } catch (err) {
                // Fallback: try getLeaderboardData for employee info
                try {
                    const [lbData, summaryData] = await Promise.all([
                        getLeaderboardData(),
                        getCredentialSummary()
                    ]);
                    setEmployees(lbData.leaderboard.map(e => ({ ...e, emp_code: e.emp_code, Emp_name: e.Emp_name, Designation: e.Designation, City: e.City })));
                    setCredentialSummary(summaryData);
                } catch (fallbackErr) {
                    setError("Could not load leaderboard data.");
                    console.error(fallbackErr);
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // 1.5 Extract Locations and Notify Parent
    useEffect(() => {
        if (!employees.length || !onLocationsAvailable) return;

        const cities = new Set<string>();
        employees.forEach(emp => {
            if (emp.City && emp.City.trim() !== '') {
                cities.add(emp.City);
            }
        });
        const sortedCities = ['All', ...Array.from(cities).sort()];
        onLocationsAvailable(sortedCities);
    }, [employees, onLocationsAvailable]);


    // 2. Calculation Logic: Recompute both leaderboards when Data OR Filters change
    useEffect(() => {
        if (!credentialSummary.length || !employees.length) return;

        // --- A. Employee Leaderboard Calculation ---

        // Step 0: Filter Employees by Location first
        const locationFilteredEmployees = employees.filter(emp => {
            if (selectedLocation === 'All') return true;
            return emp.City === selectedLocation;
        });

        // Create a Set of valid employee codes for O(1) lookup
        const validEmpCodes = new Set(locationFilteredEmployees.map(e => e.emp_code));


        // Step 1: Filter Credentials based on Issuer/Collection
        const relevantCredentials = credentialSummary.filter(cred => {
            // Issuer Filter
            if (selectedIssuer !== 'All') {
                const issuer = getIssuerFromTitle(cred.credential_title);
                if (selectedIssuer === 'Others') {
                    // Check against KNOWN_ISSUERS from utils if possible, or duplicate checks here
                    if (['Databricks', 'Microsoft', 'Google'].includes(issuer)) return false;
                } else {
                    if (issuer !== selectedIssuer) return false;
                }
            }

            // Collection Filter (Logic from Admin.tsx)
            if (selectedCollection === 'Certificates') {
                if ((selectedIssuer === 'All' || selectedIssuer === 'Databricks') && !NORMALIZED_CERTIFICATION_TITLES.has(normalizeTitle(cred.credential_title))) return false;
                if (selectedIssuer !== 'All' && selectedIssuer !== 'Databricks') return false;
            }
            if (selectedCollection === 'Badges') {
                if (NORMALIZED_CERTIFICATION_TITLES.has(normalizeTitle(cred.credential_title))) return false;
            }
            return true;
        });

        // Step 2: Aggregate Counts per Employee
        const empCountMap = new Map<string, number>();
        relevantCredentials.forEach(cred => {
            if (cred.emp_codes) {
                cred.emp_codes.forEach(empCode => {
                    // Only count if employee is in the valid location set
                    if (validEmpCodes.has(empCode)) {
                        empCountMap.set(empCode, (empCountMap.get(empCode) || 0) + 1);
                    }
                });
            }
        });

        // Step 3: Map to LeaderboardEntry array
        let newEmployeeLeaderboard: LeaderboardEntry[] = [];

        // Iterate over filtered employees
        // If they have > 0 count, include them. 
        // If filter is active, only include those with > 0 count? Or show 0? 
        // Usually leaderboards hide 0s or rank them last. Let's hide 0s for cleaner filtered view.

        locationFilteredEmployees.forEach(emp => {
            const count = empCountMap.get(emp.emp_code) || 0;
            // Include everyone, even with 0 count, to match server-side LEFT JOIN logic and ensure Rank is always generated.
            newEmployeeLeaderboard.push({
                emp_code: emp.emp_code,
                Emp_name: emp.Emp_name,
                Designation: emp.Designation,
                Department: emp.Department || null,
                City: emp.City || null,
                Employee_EmailID: emp.Employee_EmailID || '',
                credential_count: count,
                rank: 0 // Calc later
            });
        });

        // Step 4: Sort and Rank
        newEmployeeLeaderboard.sort((a, b) => b.credential_count - a.credential_count);

        // Assign Ranks (handling ties)
        let currentRank = 1;
        for (let i = 0; i < newEmployeeLeaderboard.length; i++) {
            if (i > 0 && newEmployeeLeaderboard[i].credential_count < newEmployeeLeaderboard[i - 1].credential_count) {
                currentRank = i + 1;
            }
            newEmployeeLeaderboard[i].rank = currentRank;
        }

        setEmployeeLeaderboard(newEmployeeLeaderboard);


        // --- B. Issuer Leaderboard Calculation ---
        // Aggregating counts by Issuer based on the *filtered* credentials?
        // Or should Issuer Leaderboard ALWAYS show total counts regardless of Employee/Collection filter?
        // Usually "By Issuer" tab implies seeing which issuer is most popular.
        // If we filter by "Databricks", showing "Microsoft" with 0 makes sense or hide it.
        // Let's apply the SAME filters to be consistent.

        const issuerMap = new Map<string, number>();
        relevantCredentials.forEach(cred => {
            const issuer = getIssuerFromTitle(cred.credential_title);
            // We count the *unique holders*? or *total credentials*? 
            // Previous API likely counted total credentials held.
            // cred.employee_count is the number of holders for THAT specific cert.
            // But one employee can hold multiple certs from same issuer.
            // If we want "Total Credentials Issued by Issuer", we sum (holders * 1) for each cert.

            // However, cred.emp_codes length provides accurate count.
            let count = 0;
            if (cred.emp_codes) {
                count = cred.emp_codes.filter(code => validEmpCodes.has(code)).length;
            } else {
                // Fallback if no emp_codes (shouldn't happen with new API)
                // If we filter by location but don't have codes, we can't accurately count.
                // We will assume 0 or keep total (risky). 
                // Let's assume 0 to be safe/consistent with "filtered view".
                count = 0;
            }

            if (count > 0) {
                issuerMap.set(issuer, (issuerMap.get(issuer) || 0) + count);
            }
        });

        const newIssuerLeaderboard: IssuerLeaderboardEntry[] = [];
        issuerMap.forEach((count, issuer) => {
            if (count > 0) {
                newIssuerLeaderboard.push({
                    issuer_name: issuer,
                    credential_count: count,
                    rank: 0
                });
            }
        });

        newIssuerLeaderboard.sort((a, b) => b.credential_count - a.credential_count);
        let iRank = 1;
        for (let i = 0; i < newIssuerLeaderboard.length; i++) {
            if (i > 0 && newIssuerLeaderboard[i].credential_count < newIssuerLeaderboard[i - 1].credential_count) {
                iRank = i + 1;
            }
            newIssuerLeaderboard[i].rank = iRank;
        }

        setIssuerLeaderboard(newIssuerLeaderboard);

    }, [credentialSummary, employees, selectedIssuer, selectedCollection, selectedLocation]);

    const filteredEmployeeData = useMemo(() => {
        if (!searchTerm) return employeeLeaderboard;
        const term = searchTerm.toLowerCase();
        return employeeLeaderboard.filter(entry =>
            (entry.Emp_name && String(entry.Emp_name).toLowerCase().includes(term)) ||
            (entry.emp_code && String(entry.emp_code).toLowerCase().includes(term))
        );
    }, [employeeLeaderboard, searchTerm]);

    const filteredIssuerData = useMemo(() => {
        if (!searchTerm) return issuerLeaderboard;
        const term = searchTerm.toLowerCase();
        return issuerLeaderboard.filter(entry =>
            (entry.issuer_name && String(entry.issuer_name).toLowerCase().includes(term))
        );
    }, [issuerLeaderboard, searchTerm]);

    const totalCredentials = useMemo(() =>
        employeeLeaderboard.reduce((sum, entry) => sum + entry.credential_count, 0),
        [employeeLeaderboard]
    );


    const userRank = useMemo(() =>
        employeeLeaderboard.find(e => e.emp_code === currentUser.id)?.rank || 'N/A',
        [employeeLeaderboard, currentUser.id]
    );

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    // Reset page when search or type changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, leaderboardType]);

    const paginatedData = useMemo(() => {
        const data = leaderboardType === 'employee' ? filteredEmployeeData : filteredIssuerData;
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return data.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredEmployeeData, filteredIssuerData, currentPage, leaderboardType]);

    const totalPages = Math.ceil((leaderboardType === 'employee' ? filteredEmployeeData.length : filteredIssuerData.length) / ITEMS_PER_PAGE);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            // Scroll to top of list container if possible, or just the top of the component
            const mainContainer = document.querySelector('main');
            if (mainContainer) mainContainer.scrollTop = 0;
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center h-96"><EtlLoader label="Calculating ranks..." /></div>;
        }

        if (error) {
            return <motion.div className="text-center p-12" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}><div className="text-6xl mb-4">⚠️</div><p className="text-red-500 dark:text-red-400 font-semibold">{error}</p></motion.div>;
        }

        const noResults = leaderboardType === 'employee' ? filteredEmployeeData.length === 0 : filteredIssuerData.length === 0;

        if (noResults) {
            return (
                <motion.div className="text-center py-16" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                    <motion.div className="text-7xl mb-4" animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>🔍</motion.div>
                    <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">No results found</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Try adjusting your search terms</p>
                </motion.div>
            );
        }

        return (
            <div className="space-y-6">
                <div className="space-y-3">
                    {leaderboardType === 'employee' ? (
                        (paginatedData as LeaderboardEntry[]).map((entry, index) => (
                            <div key={entry.emp_code} onClick={() => setSelectedEmployee(entry)} className={`group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 ${currentUser.id === entry.emp_code ? 'bg-gradient-to-r from-red-50 via-orange-50 to-red-50 dark:from-red-900/20 dark:via-orange-900/20 dark:to-red-900/20 ring-2 ring-red-400 dark:ring-red-500 shadow-lg shadow-red-200 dark:shadow-red-900/30' : 'bg-white dark:bg-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 border border-gray-200 dark:border-slate-700 hover:shadow-lg hover:-translate-y-1'}`}>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                <div className="relative flex items-center justify-between px-5 py-4">
                                    <div className="flex items-center gap-5 min-w-0 flex-1">
                                        <RankIndicator rank={entry.rank} />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-lg text-gray-900 dark:text-gray-100 truncate mb-1">
                                                {entry.Emp_name}
                                                {currentUser.id === entry.emp_code && (<span className="ml-2 text-xs bg-red-500 text-white px-2 py-1 rounded-full">You</span>)}
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{entry.Designation || `Emp Code: ${entry.emp_code}`}</p>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 text-right ml-6">
                                        <p className="text-2xl font-extrabold bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400 bg-clip-text text-transparent transform group-hover:scale-110 transition-transform duration-300">{entry.credential_count}</p>
                                        <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Credentials</p>
                                    </div>
                                    <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:translate-x-0 translate-x-2">
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        (paginatedData as IssuerLeaderboardEntry[]).map((entry, index) => (
                            <div key={entry.issuer_name} className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 border border-gray-200 dark:border-slate-700 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                                <div className="relative flex items-center justify-between px-5 py-4">
                                    <div className="flex items-center gap-5 min-w-0 flex-1">
                                        <RankIndicator rank={entry.rank} />
                                        <div className="flex-1 min-w-0 flex items-center gap-4">
                                            {issuerLogos[entry.issuer_name] ? (
                                                <img src={issuerLogos[entry.issuer_name]} alt={`${entry.issuer_name} logo`} className="w-10 h-10 object-contain" />
                                            ) : (
                                                <div className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-slate-700 rounded-lg"><AwardIcon className="w-6 h-6 text-gray-400" /></div>
                                            )}
                                            <p className="font-bold text-lg text-gray-900 dark:text-gray-100 truncate">{entry.issuer_name}</p>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 text-right ml-6">
                                        <p className="text-2xl font-extrabold bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400 bg-clip-text text-transparent transform group-hover:scale-110 transition-transform duration-300">{entry.credential_count}</p>
                                        <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Total Credentials</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-slate-700">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="px-4 py-2 text-sm font-medium rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            Page <span className="font-semibold text-gray-900 dark:text-gray-100">{currentPage}</span> of <span className="font-semibold text-gray-900 dark:text-gray-100">{totalPages}</span>
                        </span>
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 text-sm font-medium rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const LeaderboardToggle = () => {
        return (
            <div className="relative p-1 bg-gray-200/80 dark:bg-slate-700/80 rounded-xl flex items-center backdrop-blur-sm">
                <button onClick={() => setLeaderboardType('employee')} className={`relative w-1/2 py-2 text-sm font-semibold z-10 transition-colors duration-300 ${leaderboardType === 'employee' ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>By Employee</button>
                <button onClick={() => setLeaderboardType('issuer')} className={`relative w-1/2 py-2 text-sm font-semibold z-10 transition-colors duration-300 ${leaderboardType === 'issuer' ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>By Issuer</button>
                <motion.div
                    layoutId="leaderboard-toggle-active"
                    className="absolute top-1 bottom-1 rounded-lg shadow-md bg-gradient-to-r from-red-600 to-orange-500"
                    style={{ width: 'calc(50% - 0.25rem)' }}
                    animate={{
                        left: leaderboardType === 'employee' ? '0.25rem' : '50%'
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
            </div>
        );
    };

    const containerClasses = isEmbedded
        ? "w-full space-y-8"
        : "w-full max-w-5xl mx-auto rounded-3xl bg-white dark:bg-slate-900 text-left shadow-2xl transition-all max-h-[90vh] flex flex-col overflow-hidden";

    return (
        <>
            <motion.div
                className={containerClasses}
                initial={isEmbedded ? { opacity: 0 } : { scale: 0.9, opacity: 0, y: 50 }}
                animate={isEmbedded ? { opacity: 1 } : { scale: 1, opacity: 1, y: 0 }}
                exit={isEmbedded ? { opacity: 0 } : { scale: 0.9, opacity: 0, y: 50 }}
                onClick={(e) => !isEmbedded && e.stopPropagation()}
            >
                <header className={`relative ${isEmbedded ? 'mb-8' : 'p-8 border-b border-gray-200 dark:border-slate-700 flex-shrink-0 bg-gradient-to-br from-gray-50 to-white dark:from-slate-900 dark:to-slate-800'}`}>
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            {!isEmbedded && (
                                <motion.div className="flex items-center gap-3 mb-2" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
                                    <LeaderboardIcon className="w-8 h-8 text-red-500" />
                                    <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">Leaderboard</h2>
                                </motion.div>
                            )}
                            <motion.p className={`text-sm text-gray-500 dark:text-gray-400 mb-4 ${isEmbedded ? 'mb-6' : ''}`} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
                                {isEmbedded ? "See how you verify against your colleagues." : "Company-wide Certification Rankings"}
                            </motion.p>
                            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <LeaderboardToggle />
                                <div className="relative">
                                    <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-3 pl-11 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 focus:ring-2 focus:ring-red-500 focus:border-transparent focus:outline-none transition-all duration-200" />
                                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                            </motion.div>
                        </div>
                        {!isEmbedded && (
                            <motion.button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 transition-colors ml-4" whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} aria-label="Back to dashboard"><CloseIcon /></motion.button>
                        )}
                    </div>
                </header>
                <AnimatePresence mode="wait">
                    <motion.div key={leaderboardType}>
                        {!isLoading && !error && leaderboardType === 'employee' && (
                            <motion.div className={`px-8 py-5 ${isEmbedded ? 'rounded-xl border border-gray-100 dark:border-slate-700' : 'border-b border-gray-200 dark:border-slate-700'} bg-gradient-to-r from-red-50 via-orange-50 to-red-50 dark:from-red-900/10 dark:via-orange-900/10 dark:to-red-900/10`} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
                                <div className="flex items-center justify-around text-center">
                                    <motion.div whileHover={{ scale: 1.05 }} className="flex flex-col items-center"><p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{employeeLeaderboard.length}</p><p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Celebalites</p></motion.div>
                                    <div className="h-10 w-px bg-gray-300 dark:bg-slate-600"></div>
                                    <motion.div whileHover={{ scale: 1.05 }} className="flex flex-col items-center"><motion.p className="text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400 bg-clip-text text-transparent" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}>{totalCredentials}</motion.p><p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total Credentials</p></motion.div>
                                    <div className="h-10 w-px bg-gray-300 dark:bg-slate-600"></div>
                                    <motion.div whileHover={{ scale: 1.05 }} className="flex flex-col items-center"><p className="text-3xl font-bold text-gray-900 dark:text-gray-100">#{userRank}</p><p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Your Rank</p></motion.div>
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                </AnimatePresence>
                <main className={`${isEmbedded ? 'mt-8' : 'p-8 overflow-y-auto custom-scrollbar'}`}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={leaderboardType}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {renderContent()}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </motion.div>

            <AnimatePresence>
                {selectedEmployee && (
                    <EmployeeCredentialsModal
                        employee={selectedEmployee}
                        onClose={() => setSelectedEmployee(null)}
                        showDownloadButton={false}
                        selectedIssuer={selectedIssuer}
                        selectedCollection={selectedCollection}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default LeaderboardPage;