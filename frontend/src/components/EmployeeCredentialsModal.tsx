import React, { useState, useEffect } from 'react';
import { AdminEmployee, CertificationRequest, RequestStatus } from '../types';
import { getEmployeeCredentials } from '../services/api';
import { BADGE_IMAGES } from '../constants';
import CloseIcon from './icons/CloseIcon';
import EtlLoader from './EtlLoader';
import DownloadIcon from './icons/DownloadIcon';
import { normalizeTitle, getIssuerFromTitle, NORMALIZED_CERTIFICATION_TITLES } from '../utils';

// Copied from EmployeeView.tsx for date formatting
const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return dateString;
  }
};

interface EmployeeCredentialsModalProps {
  employee: AdminEmployee;
  onClose: () => void;
  showDownloadButton?: boolean;
  selectedIssuer?: string;
  selectedCollection?: string;
}

const EmployeeCredentialsModal: React.FC<EmployeeCredentialsModalProps> = ({
  employee,
  onClose,
  showDownloadButton = true,
  selectedIssuer = 'All',
  selectedCollection = 'All'
}) => {
  const [credentials, setCredentials] = useState<CertificationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCredentials = async () => {
      setIsLoading(true);
      try {
        // Add a minimum display time for the loader to ensure animation is visible
        const [data] = await Promise.all([
          getEmployeeCredentials(employee),
          new Promise(resolve => setTimeout(resolve, 1500)) // Ensures a minimum 1.5s load time
        ]);
        setCredentials(data);
      } catch (error) {
        console.error("Failed to fetch employee credentials:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCredentials();
  }, [employee]);

  // Filter credentials based on selected issuer and collection
  const filteredCredentials = React.useMemo(() => {
    return credentials.filter(cred => {
      const title = cred.certification.name;
      const issuer = getIssuerFromTitle(title);

      // Issuer Filter
      if (selectedIssuer !== 'All' && issuer !== selectedIssuer) {
        return false;
      }

      // Collection Filter
      if (selectedCollection === 'Certificates') {
        const isDatabricks = issuer === 'Databricks';
        if (isDatabricks && !NORMALIZED_CERTIFICATION_TITLES.has(normalizeTitle(title))) return false;
        // If not Databricks, it's not in the strict "Certificates" list (assuming only Databricks has strict list)
        // But logic in Admin.tsx was: if not Databricks/All, return false for "Certificates" collection?
        // Let's replicate Admin.tsx logic for consistency:
        // "Certificates" collection only includes items in NORMALIZED_CERTIFICATION_TITLES (which are all Databricks)
        if (!NORMALIZED_CERTIFICATION_TITLES.has(normalizeTitle(title))) return false;
      }

      if (selectedCollection === 'Badges') {
        // "Badges" are anything NOT in the "Certificates" list
        if (NORMALIZED_CERTIFICATION_TITLES.has(normalizeTitle(title))) return false;
      }

      return true;
    });
  }, [credentials, selectedIssuer, selectedCollection]);

  const downloadCSV = () => {
    if (!filteredCredentials || filteredCredentials.length === 0) {
      alert("No matching credentials to download.");
      return;
    }

    const headers = [
      "Emp_Code",
      "Employee_Name",
      "Employee_EmailID",
      "Designation",
      "Credential Name",
      "Issued_on",
      "Expiry date",
      "Status"
    ];

    const escapeCsvField = (field: string | number | null | undefined): string => {
      if (field === null || field === undefined) return '""';
      const stringField = String(field);
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };

    const rows = filteredCredentials.map(cred => {
      const status = cred.status;
      return [
        escapeCsvField(employee.emp_code),
        escapeCsvField(employee.Emp_name),
        escapeCsvField(employee.Employee_EmailID),
        escapeCsvField(employee.Designation),
        escapeCsvField(cred.certification.name),
        escapeCsvField(formatDate(cred.issuedOn)),
        escapeCsvField(cred.certificationExpiryDate && cred.certificationExpiryDate.toLowerCase() !== 'does not expire' ? formatDate(cred.certificationExpiryDate) : 'Does not expire'),
        escapeCsvField(status)
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const filename = `${employee.Emp_name.replace(/\s+/g, '_')}_credentials_filtered.csv`;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-20">
          <EtlLoader label="Fetching credentials..." />
        </div>
      );
    }

    if (credentials.length === 0) {
      return (
        <div className="text-center py-20">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">No Credentials Found</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">This employee has no credentials recorded in the system.</p>
        </div>
      );
    }

    if (filteredCredentials.length === 0) {
      return (
        <div className="text-center py-20">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">No Matching Credentials</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">No credentials match the selected filters.</p>
        </div>
      );
    }

    const credentialsWithBadges = filteredCredentials.filter(request => BADGE_IMAGES[request.certification.name]);
    const credentialsWithoutBadges = filteredCredentials.filter(request => !BADGE_IMAGES[request.certification.name]);

    return (
      <div>
        {credentialsWithBadges.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {credentialsWithBadges.map(request => {
              const badgeImage = BADGE_IMAGES[request.certification.name];
              const status = request.status;
              return (
                <div key={request.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-slate-700 text-center hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 relative">
                  <div className="absolute top-3 right-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${status === RequestStatus.Active ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300' : status === RequestStatus.Expired ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300' : 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-200'}`}>{status}</span>
                  </div>
                  <div className="flex justify-center mb-4 transition-transform duration-300 hover:scale-105 h-32 items-center">
                    <img src={badgeImage} alt={`${request.certification.name} badge`} className="max-w-full max-h-full object-contain" />
                  </div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-lg mb-4">{request.certification.name}</h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-4">
                    <div className="flex justify-between"><span className="font-medium">Issued on:</span> <span>{formatDate(request.issuedOn)}</span></div>
                    {request.certificationExpiryDate && (
                      <div className="flex justify-between"><span className="font-medium">Expires on:</span> <span>{formatDate(request.certificationExpiryDate)}</span></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {credentialsWithoutBadges.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Other Certifications</h3>
            <div className="space-y-4">
              {credentialsWithoutBadges.map(request => {
                const status = request.status;
                return (
                  <div key={request.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 border border-gray-100 dark:border-slate-700">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100">{request.certification.name}</h3>
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <div className="flex justify-between"><span className="font-medium">Issued on:</span> <span>{formatDate(request.issuedOn)}</span></div>
                        {request.certificationExpiryDate && (
                          <div className="flex justify-between"><span className="font-medium">Expires on:</span> <span>{formatDate(request.certificationExpiryDate)}</span></div>
                        )}
                      </div>
                      <div className="mt-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status === RequestStatus.Active ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300' : status === RequestStatus.Expired ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300' : 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-200'}`}>{status}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-70 backdrop-blur-sm"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-6xl transform rounded-xl bg-gray-50 dark:bg-slate-900 text-left shadow-2xl transition-all m-4 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 sticky top-0 bg-gray-50 dark:bg-slate-900 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100" id="modal-title">
                {employee.Emp_name}'s Credentials
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Emp Code: {employee.emp_code}</p>

              {/* Active Filters Display */}
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedCollection && selectedCollection !== 'All' && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium border border-purple-100 dark:border-purple-800">
                    <span>Collection: {selectedCollection}</span>
                  </div>
                )}

                {selectedIssuer && selectedIssuer !== 'All' && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-full text-xs font-medium border border-orange-100 dark:border-orange-800">
                    <span>Issuer: {selectedIssuer}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {showDownloadButton && (
                <button
                  onClick={downloadCSV}
                  disabled={isLoading || credentials.length === 0}
                  className="px-3 py-2 text-sm font-medium rounded-md flex items-center gap-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Download Credentials as CSV"
                >
                  <DownloadIcon />
                  <span>Download CSV</span>
                </button>
              )}
              <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400"><CloseIcon /></button>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto bg-white dark:bg-slate-800">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default EmployeeCredentialsModal;