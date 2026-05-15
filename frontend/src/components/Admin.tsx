import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { User, AdminEmployee, CredentialSummary, CertificationRequest, RequestStatus, CredentialReportItem } from '../types';
import { getAdminEmployees, getCredentialSummary, getCompleteCredentialsReport } from '../services/api';
import { BADGE_IMAGES, DATABRICKS_CERTIFICATION_TITLES } from '../constants';
import { normalizeTitle, getIssuerFromTitle, NORMALIZED_CERTIFICATION_TITLES, AVAILABLE_ISSUERS as ISSUERS, KNOWN_ISSUERS, AVAILABLE_COLLECTIONS as COLLECTIONS } from '../utils';
import Logo from './Logo';
import EmployeeCredentialsModal from './EmployeeCredentialsModal';
import CredentialHoldersModal from './CredentialHoldersModal';
import AwardIcon from './icons/AwardIcon';
import AdminRequestTable from './AdminRequestTable';
import EtlLoader from './EtlLoader';
import DownloadIcon from './icons/DownloadIcon';
import Loader2Icon from './icons/Loader2Icon';
import BulkUploadPage from './BulkUploadPage';

interface AdminProps {
  onLogin?: (username: string, password: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onBack?: () => void;
  currentUser?: User;
  requests?: CertificationRequest[];
  onApprove?: (request: CertificationRequest) => void;
  onDeny?: (request: CertificationRequest) => void;
  // FIX: Add theme prop to satisfy Logo component requirements
  theme: 'light' | 'dark';
}



import FilterSection from './FilterSection';

const Admin = ({ onLogin, isLoading, error, onBack, currentUser, requests = [], onApprove, onDeny, theme }: AdminProps) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTab, setCurrentTab] = useState<'employees' | 'credentials' | 'requests' | 'upload'>('employees');

  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<AdminEmployee | null>(null);

  const [credentialSummary, setCredentialSummary] = useState<CredentialSummary[]>([]);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<CredentialSummary | null>(null);
  const [selectedIssuer, setSelectedIssuer] = useState('All');
  const [selectedCollection, setSelectedCollection] = useState('Certificates');
  const [isDownloadingCredentials, setIsDownloadingCredentials] = useState(false);
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('All');


  // Effect to sync component state with URL hash for navigation
  useEffect(() => {
    const handleAdminHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/#admin\/(employees|credentials|requests|upload)/);
      if (match && match[1]) {
        setCurrentTab(match[1] as 'employees' | 'credentials' | 'requests' | 'upload');
      }
    };

    window.addEventListener('hashchange', handleAdminHashChange);
    handleAdminHashChange(); // Set initial tab from URL if present

    return () => {
      window.removeEventListener('hashchange', handleAdminHashChange);
    };
  }, []); // Empty dependency array ensures this runs only on mount/unmount.


  useEffect(() => {
    if (!currentUser) return;

    setSearchTerm(''); // Reset search term when tab changes for better UX

    if (currentTab === 'employees') {
      fetchEmployees();
    }

    if (currentTab === 'credentials') {
      fetchCredentialSummary();
    }

  }, [currentUser, currentTab]);

  // Ensure data is fetched if not present when switching tabs that might need it
  useEffect(() => {
    // If we are in employees tab, we MIGHT need credential summary for filtering logic
    // if the user uses Issuer/Collection filters.
    if (currentTab === 'employees' && credentialSummary.length === 0 && !isLoadingCredentials) {
      fetchCredentialSummary();
    }
  }, [currentTab, credentialSummary.length]);

  const fetchEmployees = async () => {
    setIsLoadingEmployees(true);
    try {
      const employeeData = await getAdminEmployees();
      setEmployees(employeeData);
    } catch (error) {
      console.error("Failed to fetch employees:", error);
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  const fetchCredentialSummary = async () => {
    setSelectedIssuer('All'); // Reset filter on tab switch
    setIsLoadingCredentials(true);
    try {
      const summaryData = await getCredentialSummary();
      setCredentialSummary(summaryData);
    } catch (error) {
      console.error("Failed to fetch credential summary:", error);
    } finally {
      setIsLoadingCredentials(false);
    }
  };


  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onLogin) onLogin(username, password);
  };

  const credentialIssuerCounts = useMemo(() => {
    const counts: Record<string, number> = { All: credentialSummary.length, Databricks: 0, Microsoft: 0, Google: 0, Others: 0 };
    credentialSummary.forEach(cred => {
      const issuer = getIssuerFromTitle(cred.credential_title);
      if (KNOWN_ISSUERS.includes(issuer)) {
        counts[issuer]++;
      } else {
        counts.Others++;
      }
    });
    return counts;
  }, [credentialSummary]);

  const credentialCollectionCounts = useMemo(() => {
    const counts: Record<string, number> = { All: 0, Certificates: 0, Badges: 0 };

    // Base filter by issuer
    const filteredByIssuer = credentialSummary.filter(cred => {
      if (selectedIssuer === 'All') return true;
      const issuer = getIssuerFromTitle(cred.credential_title);
      if (selectedIssuer === 'Others') return !KNOWN_ISSUERS.includes(issuer);
      return issuer === selectedIssuer;
    });

    // Certificates Count: matches the 10 mandatory Databricks certificates (aggregated)
    if (selectedIssuer === 'All' || selectedIssuer === 'Databricks') {
      counts.Certificates = 10;
    } else {
      counts.Certificates = 0;
    }

    // Badges Count: any credential NOT in the mandatory list
    const badges = filteredByIssuer.filter(cred => !NORMALIZED_CERTIFICATION_TITLES.has(normalizeTitle(cred.credential_title)));
    counts.Badges = badges.length;

    // All Count
    counts.All = counts.Certificates + counts.Badges;

    return counts;
  }, [credentialSummary, selectedIssuer]);

  /* New Location Filter State */
  const [selectedLocation, setSelectedLocation] = useState<string>('All');

  // Compute unique locations and their counts from the employee list
  const locationCounts = useMemo(() => {
    const counts: Record<string, number> = { All: employees.length };

    employees.forEach(emp => {
      if (emp.City && emp.City.trim() !== '') {
        const city = emp.City;
        counts[city] = (counts[city] || 0) + 1;
      }
    });

    return counts;
  }, [employees]);

  const LOCATIONS = useMemo(() => {
    const cities = Object.keys(locationCounts).filter(k => k !== 'All').sort();
    return ['All', ...cities];
  }, [locationCounts]);

  const filteredEmployees = useMemo(() => {
    if (!searchTerm && selectedLocation === 'All') return employees;

    let result = employees;

    // Filter by Location
    if (selectedLocation !== 'All') {
      result = result.filter(emp => emp.City === selectedLocation);
    }

    // Filter by Search Term
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(emp =>
        (emp.Emp_name || '').toLowerCase().includes(lowerTerm) ||
        (emp.emp_code || '').toLowerCase().includes(lowerTerm)
      );
    }

    return result;
  }, [employees, searchTerm, selectedLocation]);

  /** 
   * NEW: Filtered Employee Counts & Intersection Logic 
   * Requirement: 
   * 1. Display only employees that match ALL filters (Location AND Issuer AND Collection)
   * 2. The credential count displayed for each employee should be the count of credentials matching the filtered criteria.
   */
  const { filteredEmployeeMap, finalFilteredEmployees } = useMemo(() => {
    // 1. Start with Location-filtered employees (from previous memo)
    let baseEmployees = filteredEmployees;

    // If no extra filters, return base
    if (selectedIssuer === 'All' && selectedCollection === 'All') {
      return {
        filteredEmployeeMap: null, // null implies "use original total count"
        finalFilteredEmployees: baseEmployees
      };
    }

    // 2. Identify relevant credentials based on Issuer & Collection filters
    const relevantCredentials = credentialSummary.filter(cred => {
      // Issuer Filter
      if (selectedIssuer !== 'All') {
        const issuer = getIssuerFromTitle(cred.credential_title);
        if (selectedIssuer === 'Others') {
          if (KNOWN_ISSUERS.includes(issuer)) return false;
        } else {
          if (issuer !== selectedIssuer) return false;
        }
      }

      // Collection Filter
      if (selectedCollection === 'Certificates') {
        // Must be in mandatory normalized list
        if ((selectedIssuer === 'All' || selectedIssuer === 'Databricks') && !NORMALIZED_CERTIFICATION_TITLES.has(normalizeTitle(cred.credential_title))) return false;
        // If issuer is not databricks/all, certificates is empty anyway
        if (selectedIssuer !== 'All' && selectedIssuer !== 'Databricks') return false;
      }
      if (selectedCollection === 'Badges') {
        // Must NOT be in mandatory list
        if (NORMALIZED_CERTIFICATION_TITLES.has(normalizeTitle(cred.credential_title))) return false;
      }

      return true;
    });

    // 3. Build a map of EmpCode -> Filtered Count
    // And simultaneously determine which employees have > 0 relevant credentials
    const empCountMap = new Map<string, number>();

    relevantCredentials.forEach(cred => {
      if (cred.emp_codes) {
        cred.emp_codes.forEach(empCode => {
          empCountMap.set(empCode, (empCountMap.get(empCode) || 0) + 1);
        });
      }
    });

    // 4. Filter the employee list to only those present in the map (count > 0)
    let finalEmployees = baseEmployees.filter(emp => empCountMap.has(emp.emp_code));

    // 5. SORT: Sort by the filtered count in descending order
    finalEmployees = finalEmployees.sort((a, b) => {
      const countA = empCountMap.get(a.emp_code) || 0;
      const countB = empCountMap.get(b.emp_code) || 0;

      // Primary Sort: Count Descending
      if (countB !== countA) {
        return countB - countA;
      }

      // Secondary Sort: Name Ascending (for stability)
      return a.Emp_name.localeCompare(b.Emp_name);
    });

    return {
      filteredEmployeeMap: empCountMap,
      finalFilteredEmployees: finalEmployees
    };

  }, [filteredEmployees, credentialSummary, selectedIssuer, selectedCollection]);

  // Use the new final list for pagination
  const activeEmployeeList = finalFilteredEmployees;

  /* Create a Set of filtered Emp Codes for O(1) lookup in credential summary logic */
  const filteredEmployeeCodes = useMemo(() => {
    // If Location is 'All', we don't need to filter by emp code intersection (optimization)
    // UNLESS we want to support other future filters. For now, just Location.
    if (selectedLocation === 'All') return null; // null means "no filter"
    return new Set(filteredEmployees.map(e => e.emp_code));
  }, [filteredEmployees, selectedLocation]);

  /* Pagination Logic for Employees */
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedLocation]);

  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return activeEmployeeList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [activeEmployeeList, currentPage]);

  const totalPages = Math.ceil(activeEmployeeList.length / ITEMS_PER_PAGE);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // Scroll to top of list container if possible, or just the top of the component
      // In Admin, the layout is intricate, so maybe just window scroll or find the container
      const container = document.querySelector('main');
      if (container) container.scrollTop = 0;
      else window.scrollTo({ top: 0, behavior: 'smooth' });

    }
  };

  const filteredCredentialSummary = useMemo(() => {
    // 0. Base Filter: Issuer
    let baseData = credentialSummary.filter(cred => {
      if (selectedIssuer === 'All') return true;
      const issuer = getIssuerFromTitle(cred.credential_title);
      if (selectedIssuer === 'Others') return !KNOWN_ISSUERS.includes(issuer);
      return issuer === selectedIssuer;
    });

    // Helper to calculate filtered count for a single credential item
    const getFilteredCount = (cred: CredentialSummary): number => {
      if (!filteredEmployeeCodes) return cred.employee_count;
      if (!cred.emp_codes) return cred.employee_count; // Fallback if no emp_codes provided (e.g. older API response)

      // Count how many holders are in the filtered location set
      return cred.emp_codes.filter(code => filteredEmployeeCodes.has(code)).length;
    };

    // 1. Aggregation Logic for "Certificates" Collection
    // The user wants strictly the 10 specific certificates, identifying them by normalized title,
    // and merging all matching DB entries into one sum.
    if (selectedCollection === 'Certificates') {
      // Only run this strict logic if we are supposed to show Certificates (and issuer allows Databricks)
      if (selectedIssuer === 'All' || selectedIssuer === 'Databricks') {
        const aggregatedMap = new Map<string, CredentialSummary>();

        // Initialize with default values for ALL mandatory certificates
        DATABRICKS_CERTIFICATION_TITLES.forEach(title => {
          aggregatedMap.set(normalizeTitle(title), {
            credential_title: title,
            employee_count: 0,
            emp_codes: []
          });
        });

        // Sum up counts from incoming data that match our list
        baseData.forEach(cred => {
          const norm = normalizeTitle(cred.credential_title);
          if (aggregatedMap.has(norm)) {
            const existing = aggregatedMap.get(norm)!;

            // For aggregation, we need to merge matching emp_codes to calculate unique count correctly
            // But getFilteredCount logic works per item.
            // Let's first aggregate the raw items, THEN apply filtering to the aggregated result.

            // Merge emp_codes lists if available
            const mergedCodes = [...(existing.emp_codes || []), ...(cred.emp_codes || [])];
            // Distinct codes
            const uniqueCodes = Array.from(new Set(mergedCodes));

            // Recalculate count based on location filter
            // Ideally we calculate filtered count at the END. 
            // Here we just aggregate the raw data structures.

            aggregatedMap.set(norm, {
              ...existing,
              employee_count: 0, // Placeholder, will set later
              emp_codes: uniqueCodes
            });
          }
        });

        // Return exactly the 10 rows with filtered counts
        let result = Array.from(aggregatedMap.values()).map(item => ({
          ...item,
          employee_count: filteredEmployeeCodes
            ? (item.emp_codes?.filter(code => filteredEmployeeCodes.has(code)).length || 0)
            : (item.emp_codes?.length || 0)
        }));

        // Apply Search Filter on top
        return result.filter(cred =>
          (cred.credential_title || '').toLowerCase().includes((searchTerm || '').toLowerCase())
        );
      } else {
        return [];
      }
    }

    // 2. Logic for "Badges" Collection
    if (selectedCollection === 'Badges') {
      // Exclude any that match the Certificate list
      let result = baseData.filter(cred => !NORMALIZED_CERTIFICATION_TITLES.has(normalizeTitle(cred.credential_title)));

      // Apply Location Filter
      result = result.map(cred => ({
        ...cred,
        employee_count: getFilteredCount(cred)
      })).filter(cred => cred.employee_count > 0); // Hide badges with 0 count in this location

      // Apply Search Filter
      return result.filter(cred =>
        (cred.credential_title || '').toLowerCase().includes((searchTerm || '').toLowerCase())
      );
    }

    // 3. Logic for "All"
    // Map to hold final unique items
    const allMap = new Map<string, CredentialSummary>();

    // Start with base data
    baseData.forEach(cred => {
      const norm = normalizeTitle(cred.credential_title);
      // If it's one of the 10 special ones, we consolidate it by normalized key
      if (NORMALIZED_CERTIFICATION_TITLES.has(norm)) {
        const canonical = DATABRICKS_CERTIFICATION_TITLES.find(t => normalizeTitle(t) === norm) || cred.credential_title;

        if (allMap.has(norm)) {
          const existing = allMap.get(norm)!;
          const mergedCodes = Array.from(new Set([...(existing.emp_codes || []), ...(cred.emp_codes || [])]));
          allMap.set(norm, { ...existing, emp_codes: mergedCodes }); // Count updated later
        } else {
          allMap.set(norm, { credential_title: canonical, employee_count: 0, emp_codes: cred.emp_codes || [] });
        }
      } else {
        const key = cred.credential_title; // Exact match for others
        if (allMap.has(key)) {
          const existing = allMap.get(key)!;
          const mergedCodes = Array.from(new Set([...(existing.emp_codes || []), ...(cred.emp_codes || [])]));
          allMap.set(key, { ...existing, emp_codes: mergedCodes });
        } else {
          allMap.set(key, cred);
        }
      }
    });

    // Synthesize missing 0-counts for "All" view ONLY if needed
    if (selectedIssuer === 'All' || selectedIssuer === 'Databricks') {
      DATABRICKS_CERTIFICATION_TITLES.forEach(title => {
        const norm = normalizeTitle(title);
        if (!allMap.has(norm)) {
          allMap.set(norm, { credential_title: title, employee_count: 0, emp_codes: [] });
        }
      });
    }

    let result = Array.from(allMap.values()).map(cred => ({
      ...cred,
      employee_count: filteredEmployeeCodes
        ? (cred.emp_codes?.filter(code => filteredEmployeeCodes.has(code)).length || 0)
        : (cred.emp_codes?.length || (cred?.employee_count) || 0) // Fallback to existing count if no filter
    }));

    // If filtering by location, hide items with 0 count (optional for 'All', but typically good practice unless it's a mandatory cert)
    // Wait, requirement: "display the credentials of employees that are from filtered city"
    // This implies if count is 0, don't show it? 
    // BUT for "Certificates", we show 0 count. For others, maybe hide?
    // Let's stick to existing logic: Always show Certs, others hide if 0?
    // Current logic shows all synthesized.

    return result.filter(cred =>
      (cred.credential_title || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    );

  }, [credentialSummary, searchTerm, selectedIssuer, selectedCollection, filteredEmployeeCodes]);

  /* Pagination Logic for Credentials */
  const [currentCredentialPage, setCurrentCredentialPage] = useState(1);
  const CREDENTIALS_PER_PAGE = 20;

  // Reset page when filters change
  useEffect(() => {
    setCurrentCredentialPage(1);
  }, [searchTerm, selectedIssuer, selectedCollection, selectedLocation]);

  const paginatedCredentials = useMemo(() => {
    const startIndex = (currentCredentialPage - 1) * CREDENTIALS_PER_PAGE;
    return filteredCredentialSummary.slice(startIndex, startIndex + CREDENTIALS_PER_PAGE);
  }, [filteredCredentialSummary, currentCredentialPage]);

  const totalCredentialPages = Math.ceil(filteredCredentialSummary.length / CREDENTIALS_PER_PAGE);

  const handleCredentialPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalCredentialPages) {
      setCurrentCredentialPage(newPage);
      // Scroll to top of list container if possible, or just the top of the component
      const container = document.querySelector('main');
      if (container) container.scrollTop = 0;
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };


  const credentialsWithBadges = useMemo(() =>
    filteredCredentialSummary.filter(cred => BADGE_IMAGES[cred.credential_title]),
    [filteredCredentialSummary]
  );


  const credentialsWithoutBadges = useMemo(() =>
    filteredCredentialSummary.filter(cred => !BADGE_IMAGES[cred.credential_title]),
    [filteredCredentialSummary]
  );

  const issuerLogos: Record<string, string> = {
    'Databricks': '/components/images/databricks-logo.webp',
    'Microsoft': '/components/images/microsoft-logo.png',
    'Google': '/components/images/google-logo.png', // Using existing path for consistency
  };

  const filteredRequests = useMemo(() => {
    // DEBUG: Log initial state
    console.log('[FILTER] Active filter:', requestStatusFilter);
    console.log('[FILTER] Total requests:', requests.length);

    // Start with all requests
    let filteredList = requests;

    // Helper: Get status as string (handles both enum and string)
    const getStatusString = (status: any): string => {
      if (!status) return '';
      // If it's an enum, get its value; otherwise convert to string
      return String(status).trim();
    };

    // Helper: Check if status matches (case-insensitive, handles enum and string)
    const isStatusMatch = (reqStatus: any, targetStatus: string): boolean => {
      const reqStatusStr = getStatusString(reqStatus).toLowerCase();
      const targetStatusStr = targetStatus.toLowerCase();
      return reqStatusStr === targetStatusStr;
    };

    // Apply status filter based on the status column from voucher_requests table
    // Database column: voucher_requests.status
    // Possible values: 'Pending', 'Approved', 'Fulfilled', 'Rejected', 'Exam Scheduled'
    if (requestStatusFilter === 'Pending') {
      // Filter: ONLY show requests where status is 'Pending'
      filteredList = requests.filter(req => {
        const statusStr = getStatusString(req.status);
        const matches = isStatusMatch(req.status, 'Pending');
        // DEBUG first match
        if (filteredList.length === requests.length && matches) {
          console.log('[FILTER] Pending match:', { id: req.id, status: statusStr, matches });
        }
        return matches;
      });
      console.log('[FILTER] After Pending: showing', filteredList.length, 'of', requests.length);
    } else if (requestStatusFilter === 'Approved / Fulfilled') {
      // Filter: ONLY show requests where status is 'Approved' OR 'Fulfilled'
      filteredList = requests.filter(req => {
        const isApproved = isStatusMatch(req.status, 'Approved');
        const isFulfilled = isStatusMatch(req.status, 'Fulfilled');
        return isApproved || isFulfilled;
      });
      console.log('[FILTER] After Approved/Fulfilled: showing', filteredList.length, 'of', requests.length);
    } else if (requestStatusFilter === 'Rejected') {
      // Filter: ONLY show requests where status is 'Rejected'
      filteredList = requests.filter(req => {
        const statusStr = getStatusString(req.status);
        const matches = isStatusMatch(req.status, 'Rejected');
        // DEBUG: Log all statuses when filtering for Rejected
        if (requests.indexOf(req) < 10) {
          console.log('[FILTER] Checking request:', { id: req.id, status: statusStr, statusType: typeof req.status, matches });
        }
        return matches;
      });
      console.log('[FILTER] After Rejected: showing', filteredList.length, 'of', requests.length);
      if (filteredList.length > 0) {
        console.log('[FILTER] Rejected request IDs:', filteredList.map(r => ({ id: r.id, status: getStatusString(r.status) })));
      }
    }
    // If 'All', filteredList remains the full requests array (no filtering)

    // Apply search filter on top of the status-filtered list
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      filteredList = filteredList.filter(req =>
        (req.user?.name || '').toLowerCase().includes(lowercasedFilter) ||
        (req.certification?.name || '').toLowerCase().includes(lowercasedFilter) ||
        (req.user?.email || '').toLowerCase().includes(lowercasedFilter)
      );
    }

    return filteredList;
  }, [requests, searchTerm, requestStatusFilter]);

  const escapeCsvField = (field: string | number | null | undefined): string => {
    if (field === null || field === undefined) return '""';
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
  };


  const downloadEmployeeCSV = (data: AdminEmployee[], filename: string, countsMap?: Map<string, number> | null) => {
    if (!data || data.length === 0) {
      alert("No data to download.");
      return;
    }

    const headers = ["Emp_Code", "Employee_Name", "Employee_EmailID", "Designation", "Total_Credentials"];

    const rows = data.map(emp => [
      escapeCsvField(emp.emp_code),
      escapeCsvField(emp.Emp_name),
      escapeCsvField(emp.Employee_EmailID),
      escapeCsvField(emp.Designation),
      escapeCsvField(countsMap ? (countsMap.get(emp.emp_code) || 0) : emp.credential_count)
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCredentialReport = async () => {
    setIsDownloadingCredentials(true);
    try {
      const fullReport = await getCompleteCredentialsReport();

      const filteredReport = fullReport.filter(item => {
        if (selectedIssuer === 'All') return true;
        const issuer = getIssuerFromTitle(item.CredentialName);
        if (selectedIssuer === 'Others') return !KNOWN_ISSUERS.includes(issuer);
        return issuer === selectedIssuer;
      });

      if (filteredReport.length === 0) {
        alert("No data to download for the current filter.");
        return;
      }

      const headers = ["CredentialName", "Emp_Code", "Employee_Name", "Employee_EmailID", "Designation"];

      const rows = filteredReport.map(item => [
        escapeCsvField(item.CredentialName),
        escapeCsvField(item.Emp_Code),
        escapeCsvField(item.Employee_Name),
        escapeCsvField(item.Employee_EmailID),
        escapeCsvField(item.Designation),
      ].join(','));

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');

      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);

      const filename = `all_${selectedIssuer}_credentials.csv`.toLowerCase().replace(/\s+/g, '_');
      link.setAttribute('download', filename);

      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Failed to download credential report:", err);
      alert("An error occurred while preparing the download. Please try again.");
    } finally {
      setIsDownloadingCredentials(false);
    }
  };


  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900">
        <div className="w-full max-w-md p-8 space-y-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700">
          <div className="flex flex-col items-center">
            {/* FIX: Pass theme prop to Logo component */}
            <Logo theme={theme} />
            <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mt-4">CT L&D Admin Portal</h1>
            <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">Sign in with administrator credentials</p>
          </div>
          {error && <p className="text-sm text-center text-red-600 bg-red-50 dark:bg-red-500/20 dark:text-red-300 p-3 rounded-md">{error}</p>}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="mt-1 block w-full appearance-none rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-gray-900 dark:text-gray-100 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500 sm:text-sm" required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full appearance-none rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-gray-900 dark:text-gray-100 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500 sm:text-sm" required />
            </div>
            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={onBack} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-slate-600 dark:text-gray-200 dark:hover:bg-slate-500 rounded-md">Back</button>
              <button type="submit" disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 flex items-center">{isLoading ? 'Signing In...' : 'Sign In'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <LayoutGroup>
      <div>
        <div className="mb-6 md:flex md:items-center md:justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
          {currentTab !== 'upload' && (
            <div className="mt-4 md:mt-0 flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
              />
              {currentTab === 'employees' && (
                <button
                  onClick={() => downloadEmployeeCSV(activeEmployeeList, 'employee_directory.csv', filteredEmployeeMap)}
                  disabled={activeEmployeeList.length === 0}
                  className="p-2 rounded-md bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Download Employee Directory as CSV"
                >
                  <DownloadIcon />
                </button>
              )}
              {currentTab === 'credentials' && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleDownloadCredentialReport}
                    disabled={isDownloadingCredentials}
                    className="p-2 rounded-md bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Download Credential Directory as CSV"
                  >
                    {isDownloadingCredentials ? <Loader2Icon className="h-5 w-5 animate-spin" /> : <DownloadIcon />}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="flex space-x-2 border-b border-gray-200 dark:border-slate-700">
            <button
              onClick={() => (window.location.hash = 'admin/employees')}
              className={`px-3 py-2 text-sm font-medium rounded-t-md ${currentTab === 'employees'
                ? 'border-b-2 border-red-600 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800/50'
                }`}
            >
              Employee Directory
            </button>
            <button
              onClick={() => (window.location.hash = 'admin/credentials')}
              className={`px-3 py-2 text-sm font-medium rounded-t-md ${currentTab === 'credentials'
                ? 'border-b-2 border-red-600 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800/50'
                }`}
            >
              Credential Directory
            </button>
            <button
              onClick={() => (window.location.hash = 'admin/requests')}
              className={`px-3 py-2 text-sm font-medium rounded-t-md ${currentTab === 'requests'
                ? 'border-b-2 border-red-600 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800/50'
                }`}
            >
              Voucher Requests
            </button>
            <button
              onClick={() => (window.location.hash = 'admin/upload')}
              className={`px-3 py-2 text-sm font-medium rounded-t-md ${currentTab === 'upload'
                ? 'border-b-2 border-red-600 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800/50'
                }`}
            >
              Bulk Upload
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Shared Sidebar for Employees and Credentials */}
          {(currentTab === 'employees' || currentTab === 'credentials') && (
            <aside className="lg:col-span-3 xl:col-span-2 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 h-fit mb-6 lg:mb-0">
              <FilterSection title="ISSUERS" isFiltered={selectedIssuer !== 'All'}>
                <nav className="flex flex-col space-y-2" role="navigation">
                  {ISSUERS.map(issuer => (
                    <button
                      key={issuer}
                      onClick={() => setSelectedIssuer(issuer)}
                      className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 flex items-center group ${selectedIssuer === issuer
                        ? 'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 shadow-inner'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                        }`}
                    >
                      <span className="flex-1 text-left">{issuer}</span>
                      <span className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${selectedIssuer === issuer ? 'bg-red-200 text-red-800 dark:bg-red-500/30 dark:text-red-200' : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200'
                        }`}>{credentialIssuerCounts[issuer as keyof typeof credentialIssuerCounts]}</span>
                    </button>
                  ))}
                </nav>
              </FilterSection>

              <FilterSection title="COLLECTIONS" isFiltered={selectedCollection !== 'All'}>
                <nav className="flex flex-col space-y-2" role="navigation">
                  {COLLECTIONS.map(collection => (
                    <button
                      key={collection}
                      onClick={() => setSelectedCollection(collection)}
                      className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 flex items-center group ${selectedCollection === collection
                        ? 'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 shadow-inner'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                        }`}
                    >
                      <span className="flex-1 text-left">{collection}</span>
                      <span className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${selectedCollection === collection ? 'bg-red-200 text-red-800 dark:bg-red-500/30 dark:text-red-200' : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200'
                        }`}>{credentialCollectionCounts[collection as keyof typeof credentialCollectionCounts]}</span>
                    </button>
                  ))}
                </nav>
              </FilterSection>

              <FilterSection title="LOCATIONS" isFiltered={selectedLocation !== 'All'}>
                <nav className="flex flex-col space-y-2" role="navigation">
                  {LOCATIONS.map(location => (
                    <button
                      key={location}
                      onClick={() => setSelectedLocation(location)}
                      className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 flex items-center group ${selectedLocation === location
                        ? 'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 shadow-inner'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                        }`}
                    >
                      <span className="flex-1 text-left">{location}</span>
                      <span className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${selectedLocation === location ? 'bg-red-200 text-red-800 dark:bg-red-500/30 dark:text-red-200' : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200'
                        }`}>{locationCounts[location]}</span>
                    </button>
                  ))}
                </nav>
              </FilterSection>
            </aside>
          )}

          {currentTab === 'employees' && (
            <div className="lg:col-span-9 xl:col-span-10">
              {isLoadingEmployees ? (
                <div className="flex justify-center items-center py-16 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
                  <EtlLoader label="Loading employee directory..." size={300} />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-3">
                    {paginatedEmployees.map(employee => (
                      <div
                        key={employee.emp_code}
                        onClick={() => setSelectedEmployee(employee)}
                        className="group relative overflow-hidden rounded-2xl cursor-pointer bg-white dark:bg-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 border border-gray-200 dark:border-slate-700 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                        <div className="relative flex items-center justify-between px-5 py-4">
                          <div className="flex items-center gap-5 min-w-0 flex-1">
                            {/* Use a generic avatar or icon if RankIndicator is not desired/available, or just layout without it */}
                            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-lg font-bold text-gray-500 dark:text-gray-400">
                              {employee.Emp_name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-lg text-gray-900 dark:text-gray-100 truncate mb-1">
                                {employee.Emp_name}
                              </p>
                              <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 truncate">
                                <span>{employee.Designation || `Emp Code: ${employee.emp_code}`}</span>
                                {employee.Department && (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                                    <span>{employee.Department}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right ml-6">
                            <p className="text-2xl font-extrabold bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400 bg-clip-text text-transparent transform group-hover:scale-110 transition-transform duration-300">
                              {filteredEmployeeMap ? filteredEmployeeMap.get(employee.emp_code) : employee.credential_count}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Credentials</p>
                          </div>
                          <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:translate-x-0 translate-x-2">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </div>
                        </div>
                      </div>
                    ))}
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
              )}
            </div>
          )}

          {currentTab === 'credentials' && (
            <div className="lg:col-span-9 xl:col-span-10">
              {isLoadingCredentials ? (
                <div className="flex justify-center items-center py-16 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
                  <EtlLoader label="Loading credential directory..." size={300} />
                </div>
              ) : filteredCredentialSummary.length > 0 ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    {paginatedCredentials.map(credential => (
                      <div
                        key={credential.credential_title}
                        onClick={() => setSelectedCredential(credential)}
                        className="group relative overflow-hidden rounded-2xl cursor-pointer bg-white dark:bg-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 border border-gray-200 dark:border-slate-700 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                        <div className="relative flex items-center justify-between px-5 py-6">
                          <div className="flex items-center gap-5 min-w-0 flex-1">
                            <div className="w-24 h-24 flex-shrink-0 flex items-center justify-center bg-gray-50 dark:bg-slate-700/50 rounded-lg p-1">
                              {BADGE_IMAGES[credential.credential_title] ? (
                                <motion.img
                                  layoutId={`badge-image-${credential.credential_title}`}
                                  src={BADGE_IMAGES[credential.credential_title]}
                                  alt="Badge"
                                  className="w-full h-full object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                              ) : (
                                <AwardIcon className="w-8 h-8 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 truncate mb-1">
                                {credential.credential_title}
                              </h3>
                              <div className="flex items-center gap-2">
                                {ISSUERS.includes(getIssuerFromTitle(credential.credential_title)) && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                    {getIssuerFromTitle(credential.credential_title)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right ml-6">
                            <p className="text-2xl font-extrabold bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400 bg-clip-text text-transparent transform group-hover:scale-110 transition-transform duration-300">
                              {credential.employee_count}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Holders</p>
                          </div>
                          <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:translate-x-0 translate-x-2">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {totalCredentialPages > 1 && (
                    <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-slate-700">
                      <button
                        onClick={() => handleCredentialPageChange(currentCredentialPage - 1)}
                        disabled={currentCredentialPage === 1}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Page <span className="font-semibold text-gray-900 dark:text-gray-100">{currentCredentialPage}</span> of <span className="font-semibold text-gray-900 dark:text-gray-100">{totalCredentialPages}</span>
                      </span>
                      <button
                        onClick={() => handleCredentialPageChange(currentCredentialPage + 1)}
                        disabled={currentCredentialPage === totalCredentialPages}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 bg-gray-50/50 dark:bg-slate-800/50 rounded-lg border border-dashed dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">No Credentials Found</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">No credentials match your current filter and search criteria.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {
          currentTab === 'requests' && (
            <div>
              <div className="sticky top-16 z-40 bg-gray-50 dark:bg-slate-900 flex items-center space-x-2 mb-4 py-4 border-b border-gray-200 dark:border-slate-700">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Filter by status:</span>
                {['All', 'Pending', 'Approved / Fulfilled', 'Rejected'].map(status => (
                  <button
                    key={status}
                    onClick={() => setRequestStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${requestStatusFilter === status
                      ? 'bg-red-600 text-white shadow'
                      : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600'
                      }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
              {isLoading ? (
                <div className="flex justify-center items-center py-16 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
                  <EtlLoader label="Loading voucher requests..." size={300} />
                </div>
              ) : (
                <AdminRequestTable
                  requests={filteredRequests}
                  onApprove={onApprove}
                  onDeny={onDeny}
                />
              )}
            </div>
          )
        }

        {
          currentTab === 'upload' && (
            <BulkUploadPage
              onComplete={() => {
                // Refresh data in other tabs after a successful upload
                fetchCredentialSummary();
                fetchEmployees();
              }}
            />
          )
        }

        {
          selectedEmployee && (
            <EmployeeCredentialsModal
              employee={selectedEmployee}
              onClose={() => setSelectedEmployee(null)}
              selectedIssuer={selectedIssuer}
              selectedCollection={selectedCollection}
            />
          )
        }
      </div >

      <AnimatePresence>
        {selectedCredential && (
          <CredentialHoldersModal
            credential={selectedCredential}
            onClose={() => setSelectedCredential(null)}
            validEmpCodes={filteredEmployeeCodes}
            selectedLocation={selectedLocation}
          />
        )}
      </AnimatePresence>
    </LayoutGroup >
  );
};
export default Admin;