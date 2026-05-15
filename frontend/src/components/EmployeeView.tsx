import React, { useState, useEffect, useMemo } from 'react';
import { CertificationRequest, Certification, User, RequestStatus, EmployeeDashboardTab } from '../types';
import { certificationMap, BADGE_IMAGES } from '../constants';
import RequestTable from './RequestTable';
import CertificationCard from './CertificationCard';
import UpdateProgressModal from './UpdateProgressModal';
import WelcomeBanner from './WelcomeBanner';
import FloatingActionButton from './FloatingActionButton';
import PlusIcon from './icons/PlusIcon';
import LeaderboardPage from './LeaderboardPage';

interface EmployeeViewProps {
  currentUser: User;
  acquired: CertificationRequest[];
  available: Certification[];
  requested: CertificationRequest[];
  onRequestVoucher: (certificationId: string) => Promise<void>;
  onUpdateRequest: (requestId: string, updates: Partial<CertificationRequest>) => void;
  initialTab: EmployeeDashboardTab;
  onAddCertificate: () => void;
}

import FilterSection from './FilterSection';
import { AVAILABLE_ISSUERS as ISSUERS, AVAILABLE_COLLECTIONS as COLLECTIONS, KNOWN_ISSUERS } from '../utils';

// Function to format date to dd/mm/yyyy
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

const IssuerItem: React.FC<{
  issuer: string;
  selected: boolean;
  count?: number;
  onClick: () => void
}> = ({ issuer, selected, count, onClick }) => {
  const issuerLogos: Record<string, string> = {
    'Databricks': new URL('./images/databricks-logo.webp', import.meta.url).href,
    'Microsoft': new URL('./images/microsoft-logo.png', import.meta.url).href,
    'Google': new URL('./images/google-logo.png', import.meta.url).href,
  };

  if (issuer === 'All' || issuer === 'Others') {
    return (
      <button
        onClick={onClick}
        className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-300 flex items-center group ${selected
          ? 'bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 shadow-md'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 dark:hover:from-slate-700/50 dark:hover:to-slate-700 border-l-4 border-transparent hover:border-gray-300 dark:hover:border-slate-600'
          }`}
      >
        <span className="flex-1 text-left group-hover:translate-x-1 transition-transform duration-300">{issuer}</span>
        {count !== undefined && (
          <span className={`ml-2 px-2.5 py-1 rounded-full text-xs font-semibold ${selected ? 'bg-red-100 text-red-800 dark:bg-red-500/30 dark:text-red-200 shadow-inner' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 group-hover:bg-gray-200 dark:group-hover:bg-slate-600'
            }`}>{count}</span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 flex items-center justify-center rounded-lg transition-all duration-300 group ${selected
        ? 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-2 border-red-200 dark:border-red-700 shadow-lg'
        : 'hover:bg-gradient-to-br hover:from-gray-50 hover:to-gray-100 dark:hover:from-slate-800/50 dark:hover:to-slate-700 border-2 border-transparent hover:border-gray-200 dark:hover:border-slate-600'
        }`}
      aria-label={issuer}
    >
      <div className="relative">
        <img
          src={issuerLogos[issuer]}
          alt={`${issuer} logo`}
          className={`w-15 h-12 transition-all duration-300 ${selected ? 'scale-110 rotate-0 shadow-lg' : 'group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-md'}`}
        />
        {selected && (
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full"></div>
        )}
      </div>
    </button>
  );
};

const StatusFilterItem: React.FC<{
  label: string;
  selected: boolean;
  onClick: () => void
}> = ({ label, selected, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-300 flex items-center group ${selected
      ? 'bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 shadow-md'
      : 'text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 dark:hover:from-slate-700/50 dark:hover:to-slate-700 border-l-4 border-transparent hover:border-gray-300 dark:hover:border-slate-600'
      }`}
  >
    <span className="flex-1 text-left group-hover:translate-x-1 transition-transform duration-300">{label}</span>
  </button>
);

const EmployeeView: React.FC<EmployeeViewProps> = ({
  currentUser,
  acquired,
  available,
  requested,
  onRequestVoucher,
  onUpdateRequest,
  initialTab,
  onAddCertificate,
}) => {
  const [activeTab, setActiveTab] = useState<EmployeeDashboardTab>(initialTab);
  const [selectedRequestToUpdate, setSelectedRequestToUpdate] = useState<CertificationRequest | null>(null);
  const [selectedIssuer, setSelectedIssuer] = useState<string>('All');
  const [selectedCollection, setSelectedCollection] = useState<string>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [availableLocations, setAvailableLocations] = useState<string[]>(['All']);
  const [selectedStatus, setSelectedStatus] = useState<'All' | 'Not Requested' | 'Already Requested'>('All');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const issuerCounts = useMemo(() => {
    const counts: Record<string, number> = { All: acquired.length, Databricks: 0, Microsoft: 0, Google: 0, Others: 0 };
    acquired.forEach(req => {
      const vendor = req.certification.vendor;
      if (KNOWN_ISSUERS.includes(vendor)) {
        counts[vendor] = (counts[vendor] || 0) + 1;
      } else {
        counts.Others = (counts.Others || 0) + 1;
      }
    });
    return counts;
  }, [acquired]);

  useEffect(() => {
    setSelectedIssuer('All');
    setSelectedCollection('All');
    setSelectedLocation('All');
    setSelectedStatus('All');
  }, [activeTab]);

  const showIssuerFilter = activeTab === 'Acquired' || activeTab === 'Available' || activeTab === 'Leaderboard';

  const requestedOrAcquiredCertNames = useMemo(() => {
    const names = new Set<string>();
    requested.forEach(req => names.add(req.certification.name));
    acquired.forEach(req => names.add(req.certification.name));
    return names;
  }, [requested, acquired]);

  const filterByIssuer = (items: (CertificationRequest[] | Certification[])) => {
    if (selectedIssuer === 'All') return items;
    return items.filter(item => {
      const vendor = 'certification' in item ? item.certification.vendor : item.vendor;
      if (selectedIssuer === 'Others') {
        return !KNOWN_ISSUERS.includes(vendor);
      }
      return vendor === selectedIssuer;
    });
  };

  const filteredAcquired = filterByIssuer(acquired) as CertificationRequest[];

  const filteredAvailable = useMemo(() => {
    return available
      .filter(cert => {
        if (selectedIssuer === 'All') return true;
        const vendor = cert.vendor;
        if (selectedIssuer === 'Others') {
          return !KNOWN_ISSUERS.includes(vendor);
        }
        return vendor === selectedIssuer;
      })
      .filter(cert => {
        if (selectedStatus === 'All') return true;
        const isRequested = requestedOrAcquiredCertNames.has(cert.name);
        if (selectedStatus === 'Not Requested') return !isRequested;
        if (selectedStatus === 'Already Requested') return isRequested;
        return true;
      });
  }, [available, selectedIssuer, selectedStatus, requestedOrAcquiredCertNames]);

  const certificationsWithBadges = filteredAcquired.filter(request => BADGE_IMAGES[request.certification.name]);
  const certificationsWithoutBadges = filteredAcquired.filter(request => !BADGE_IMAGES[request.certification.name]);

  const renderAcquiredWithBadges = () => {
    return (
      <div>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Showing credentials publicly available on your Databricks profile, filtered by the selected issuer.</p>
        {certificationsWithBadges.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {certificationsWithBadges.map(request => {
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
                  {request.credential_link && (
                    <a
                      href={request.credential_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-orange-500 rounded-lg hover:from-red-700 hover:to-orange-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View Credential
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {certificationsWithoutBadges.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Other Certifications</h3>
            <div className="space-y-4">
              {certificationsWithoutBadges.map(request => {
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
                      <div className="mt-3 flex items-center justify-between">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status === RequestStatus.Active ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300' : status === RequestStatus.Expired ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300' : 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-200'}`}>{status}</span>
                        {request.credential_link && (
                          <a
                            href={request.credential_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-red-600 to-orange-500 rounded-lg hover:from-red-700 hover:to-orange-600 transition-all duration-200 shadow-sm hover:shadow-md"
                          >
                            <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            View
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {filteredAcquired.length === 0 && (
          <div className="text-center py-16 bg-gray-50/50 dark:bg-slate-800/50 rounded-lg border border-dashed dark:border-slate-700">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">No Certifications Acquired</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">You haven't acquired any certifications for the selected issuer.</p>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Acquired':
        return renderAcquiredWithBadges();
      case 'Available':
        return (
          <div>
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-600 dark:text-gray-400">Browse the catalog and request a voucher for your next certification.</p>
              <a
                href="#requestVoucher"
                onClick={(e) => { e.preventDefault(); navigateTab('Available', true); }}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              >
                Request New Voucher
              </a>
            </div>
            {filteredAvailable.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredAvailable.map(cert => {
                  const isRequested = requestedOrAcquiredCertNames.has(cert.name);
                  return (
                    <CertificationCard
                      key={cert.id}
                      certification={cert}
                      onRequest={() => onRequestVoucher(cert.id)}
                      isRequested={isRequested}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-gray-50/50 dark:bg-slate-800/50 rounded-lg border border-dashed dark:border-slate-700">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">No Certifications Found</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">There are no available certifications for the selected filters.</p>
              </div>
            )}
          </div>
        );
      case 'Requested':
        return (
          <div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Track the status of your certification requests and update your progress.</p>
            <RequestTable requests={requested} view='requested' onUpdate={setSelectedRequestToUpdate} />
          </div>
        );
      case 'Leaderboard':
        return (
          <LeaderboardPage
            currentUser={currentUser}
            onBack={() => { }}
            isEmbedded={true}
            selectedIssuer={selectedIssuer}
            selectedCollection={selectedCollection}
            selectedLocation={selectedLocation}
            onLocationsAvailable={setAvailableLocations}
          />
        );
      default: return null;
    }
  };

  const tabs: EmployeeDashboardTab[] = ['Leaderboard', 'Acquired', 'Available', 'Requested'];

  const navigateTab = (tab: EmployeeDashboardTab, isRequestButton = false) => {
    if (isRequestButton) {
      window.open(window.location.pathname + '#requestVoucher', '_blank');
      return;
    }
    const newHash = tab.toLowerCase();
    window.location.hash = newHash;
  }

  return (
    <div className="space-y-8">
      <WelcomeBanner user={currentUser} />
      <div>
        <div className="border-b border-gray-200 dark:border-slate-700">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => navigateTab(tab)}
                className={`${activeTab === tab ? 'border-red-500 text-red-600 dark:text-red-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-slate-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >{tab}</button>
            ))}
          </nav>
        </div>
        <div className={`mt-8 ${showIssuerFilter ? 'grid grid-cols-1 lg:grid-cols-12 gap-8' : ''}`}>
          {showIssuerFilter && (
            <aside className="lg:col-span-2 xl:col-span-2 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 h-fit sticky top-24">
              <FilterSection title="Issuers" defaultOpen={true} isFiltered={selectedIssuer !== 'All'}>
                <nav className="flex flex-col space-y-4" role="navigation">
                  {ISSUERS.map(issuer => (
                    <IssuerItem
                      key={issuer}
                      issuer={issuer}
                      selected={selectedIssuer === issuer}
                      count={activeTab === 'Acquired' ? issuerCounts[issuer as keyof typeof issuerCounts] : undefined}
                      onClick={() => setSelectedIssuer(issuer)}
                    />
                  ))}
                </nav>
              </FilterSection>

              {activeTab === 'Available' && (
                <div className="mt-4">
                  <FilterSection title="Status" defaultOpen={true} isFiltered={selectedStatus !== 'All'}>
                    <nav className="flex flex-col space-y-2" role="navigation">
                      {(['All', 'Not Requested', 'Already Requested'] as const).map(status => (
                        <StatusFilterItem
                          key={status}
                          label={status}
                          selected={selectedStatus === status}
                          onClick={() => setSelectedStatus(status)}
                        />
                      ))}
                    </nav>
                  </FilterSection>
                </div>
              )}

              {activeTab === 'Leaderboard' && (
                <div className="mt-4 space-y-4">
                  <FilterSection title="Collection" defaultOpen={true} isFiltered={selectedCollection !== 'All'}>
                    <nav className="flex flex-col space-y-2" role="navigation">
                      {COLLECTIONS.map(collection => (
                        <button
                          key={collection}
                          onClick={() => setSelectedCollection(collection)}
                          className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-300 flex items-center group ${selectedCollection === collection
                            ? 'bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 shadow-md'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 dark:hover:from-slate-700/50 dark:hover:to-slate-700 border-l-4 border-transparent hover:border-gray-300 dark:hover:border-slate-600'
                            }`}
                        >
                          <span className="flex-1 text-left group-hover:translate-x-1 transition-transform duration-300">{collection}</span>
                        </button>
                      ))}
                    </nav>
                  </FilterSection>

                  {/* Location Filter */}
                  {availableLocations.length > 1 && (
                    <FilterSection title="Location" defaultOpen={true} isFiltered={selectedLocation !== 'All'}>
                      <nav className="flex flex-col space-y-2" role="navigation">
                        {availableLocations.map(location => (
                          <button
                            key={location}
                            onClick={() => setSelectedLocation(location)}
                            className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-300 flex items-center group ${selectedLocation === location
                              ? 'bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 shadow-md'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 dark:hover:from-slate-700/50 dark:hover:to-slate-700 border-l-4 border-transparent hover:border-gray-300 dark:hover:border-slate-600'
                              }`}
                          >
                            <span className="flex-1 text-left group-hover:translate-x-1 transition-transform duration-300">{location}</span>
                          </button>
                        ))}
                      </nav>
                    </FilterSection>
                  )}
                </div>
              )}
            </aside>
          )}
          <div className={showIssuerFilter ? 'lg:col-span-10 xl:col-span-10' : ''}>
            {renderContent()}
          </div>
        </div>
      </div>

      {selectedRequestToUpdate && (
        <UpdateProgressModal
          request={selectedRequestToUpdate}
          onClose={() => setSelectedRequestToUpdate(null)}
          onSave={(updates) => {
            onUpdateRequest(selectedRequestToUpdate.id, updates);
            setSelectedRequestToUpdate(null);
          }}
        />
      )}
      <FloatingActionButton onClick={onAddCertificate} ariaLabel="Add Certificate" position="bottom-8 right-8">
        <PlusIcon />
      </FloatingActionButton>
    </div>
  );
};

export default EmployeeView;