
import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
// FIX: Moved VoucherRequestData to be imported from './types' instead of './services/api'
import { User, CertificationRequest, Certification, UserRole, ExtractedCertificate, EmployeeRegistrationData, RequestStatus, VoucherRequestData, EmployeeDashboardTab } from './types';
// FIX: Import `requestVoucher` to be used in `handleRequestVoucher`.
import { approveAndAssignRequest, updateRequestProgress, adminLogin, updateCertificationStatus, submitVoucherRequest, saveNewCertificate, loginWithEmail, registerEmployee, getAllRequests, requestVoucher, scrapeAndAddByUrl } from './services/api';
import Header from './components/Header';
import EmployeeView from './components/EmployeeView';
import LoginWithEmail from './components/LoginwithEmail';
import Admin from './components/Admin';
import ApprovalDenialModal from './components/ApprovalDenialModal';
import UploadCertificateModal from './components/UploadCertificateModal';
import RequestVoucherPage from './components/RequestVoucherPage';


type AdminAction = {
  action: 'Approve' | 'Deny';
  request: CertificationRequest;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [acquired, setAcquired] = useState<CertificationRequest[]>([]);
  const [available, setAvailable] = useState<Certification[]>([]);
  const [requested, setRequested] = useState<CertificationRequest[]>([]);
  const [allRequests, setAllRequests] = useState<CertificationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminAction, setAdminAction] = useState<AdminAction | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [registrationInfo, setRegistrationInfo] = useState<{ email: string } | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'requestVoucher'>('dashboard');
  const [initialDashboardTab, setInitialDashboardTab] = useState<EmployeeDashboardTab>('Leaderboard');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('theme');
      if (storedTheme === 'dark' || storedTheme === 'light') {
        return storedTheme;
      }
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#requestVoucher')) {
        setCurrentView('requestVoucher');
      } else if (hash.startsWith('#leaderboard')) {
        setCurrentView('dashboard');
        setInitialDashboardTab('Leaderboard');
      } else {
        setCurrentView('dashboard');
        if (hash.startsWith('#available')) {
          setInitialDashboardTab('Available');
        } else if (hash.startsWith('#requested')) {
          setInitialDashboardTab('Requested');
        } else if (hash.startsWith('#acquired')) {
          setInitialDashboardTab('Acquired');
        } else {
          setInitialDashboardTab('Leaderboard');
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange, false);
    handleHashChange(); // Run on initial load

    return () => {
      window.removeEventListener('hashchange', handleHashChange, false);
    };
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      const savedUserJson = localStorage.getItem('currentUser');
      if (savedUserJson) {
        const savedUser: User = JSON.parse(savedUserJson);
        setIsLoading(true);
        try {
          // Re-running the login flow also fetches all necessary data
          if (savedUser.email) {
            await handleEmailLoginSubmit(savedUser.email, true);
          } else {
            // This handles old sessions from Databricks login. We log them out.
            console.log("Found old session without email. Logging out.");
            handleLogout();
          }
        } catch (err) {
          console.error("Failed to restore session", err);
          handleLogout(); // Clear invalid session
        } finally {
          setIsLoading(false);
        }
      }
      setIsInitializing(false);
    };
    restoreSession();
  }, []);


  useEffect(() => {
    if (currentUser?.role === UserRole.Admin) {
      const fetchAdminData = async () => {
        setIsLoading(true);
        try {
          const requests = await getAllRequests();
          setAllRequests(requests);
        } catch (error) {
          console.error("Failed to fetch all requests:", error);
          setError("Could not load voucher requests.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchAdminData();
    }
  }, [currentUser]);

  const handleNavigateToDashboard = (initialTab: EmployeeDashboardTab = 'Leaderboard') => {
    const newHash = initialTab.toLowerCase();
    window.location.hash = newHash === 'leaderboard' ? '' : newHash;
  };

  const handleEmailLoginSubmit = async (email: string, isSessionRestore = false) => {
    if (!isSessionRestore) {
      setIsLoading(true);
      setError(null);
      setRegistrationInfo(null);
    }
    try {
      const result = await loginWithEmail(email);
      if (result.newUser) {
        setRegistrationInfo({ email: result.email });
      } else {
        const { user, acquired, available, requested } = result;
        localStorage.setItem('currentUser', JSON.stringify(user));
        setCurrentUser(user);
        setAcquired(acquired);
        setAvailable(available);
        setRequested(requested);
        if (!isSessionRestore) handleNavigateToDashboard('Leaderboard');
      }
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred during email login.');
      throw err; // Re-throw to be caught by session restore
    } finally {
      if (!isSessionRestore) setIsLoading(false);
    }
  };

  const handleRegistration = async (formData: EmployeeRegistrationData) => {
    setIsLoading(true);
    setError(null);
    try {
      const { user, acquired, available, requested } = await registerEmployee(formData);

      let finalAcquired = acquired;
      if (formData.profile_url) {
        try {
          const newCerts = await scrapeAndAddByUrl(formData.profile_url, user);

          // Merge existing and new certificates
          const certMap = new Map<string, CertificationRequest>();
          acquired.forEach((cert: CertificationRequest) => certMap.set(cert.id, cert));
          newCerts.forEach((cert: CertificationRequest) => certMap.set(cert.id, cert));

          finalAcquired = Array.from(certMap.values()).sort((a: CertificationRequest, b: CertificationRequest) =>
            new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()
          );
        } catch (err: any) {
          console.error("Initial scraping failed:", err);
          alert("Registered successfully, but we couldn't automatically scrape your credentials right now. Error: " + err.message);
        }
      }

      localStorage.setItem('currentUser', JSON.stringify(user));
      setCurrentUser(user);
      setAcquired(finalAcquired);
      setAvailable(available);
      setRequested(requested);
      setRegistrationInfo(null); // Clear registration state
      handleNavigateToDashboard('Leaderboard');
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const adminUser = await adminLogin(username, password);
      localStorage.setItem('currentUser', JSON.stringify(adminUser));
      setCurrentUser(adminUser);
    } catch (err: any) {
      setError(err.message || 'Invalid admin credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    setAcquired([]);
    setAvailable([]);
    setRequested([]);
    setAllRequests([]);
    setError(null);
    setShowAdminLogin(false);
    setRegistrationInfo(null);
    handleNavigateToDashboard('Leaderboard');
  };

  const handleRequestVoucher = async (certificationId: string) => {
    if (!currentUser) return;
    try {
      const newRequest = await requestVoucher(currentUser, certificationId);
      setRequested(prev => [newRequest, ...prev]);
    } catch (error: any) {
      console.error("Failed to request voucher:", error);
      alert(error.message || "There was an error requesting the voucher. Please try again.");
      throw error;
    }
  };

  const handleNewVoucherRequest = async (formData: VoucherRequestData) => {
    if (!currentUser) return;
    try {
      const newRequest = await submitVoucherRequest(formData);
      setRequested(prev => [newRequest, ...prev]);
      if (currentUser.role === UserRole.Admin) {
        setAllRequests(prev => [newRequest, ...prev]);
      }
    } catch (error: any) {
      console.error("Failed to submit voucher:", error);
      alert(error.message || "There was an error submitting the request.");
      throw error;
    }
  };

  const handleUpdateRequest = async (requestId: string, updates: Partial<CertificationRequest>) => {
    try {
      const updatedRequest = await updateRequestProgress(requestId, updates);
      setRequested(prev => prev.map(req => req.id === requestId ? updatedRequest : req));
      setAllRequests(prev => prev.map(req => req.id === requestId ? updatedRequest : req));
    } catch (error) {
      console.error("Failed to update request:", error);
      alert("There was an error updating the request. Please try again.");
    }
  };

  const handleApproveRequest = async (request: CertificationRequest) => {
    if (!currentUser || currentUser.role !== UserRole.Admin) return;

    setIsLoading(true);
    try {
      const updatedRequest = await approveAndAssignRequest(request, currentUser.id);
      setAllRequests(prev => prev.map(r => r.id === updatedRequest.id ? updatedRequest : r));
    } catch (error: any) {
      console.error(`Failed to approve request:`, error);
      alert(error.message || "There was an error approving the request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  const handleDenyRequest = (request: CertificationRequest) => setAdminAction({ action: 'Deny', request });

  const handleAdminActionConfirm = async (updates: Partial<CertificationRequest>, emailContent: string) => {
    if (!currentUser || currentUser.role !== UserRole.Admin || !adminAction) return;

    setIsLoading(true);
    try {
      const status = adminAction.action === 'Approve' ? RequestStatus.Approved : RequestStatus.Rejected;
      const updatedRequest = await updateCertificationStatus(adminAction.request, status, currentUser.id, updates, emailContent);
      setAllRequests(prev => prev.map(r => r.id === updatedRequest.id ? updatedRequest : r));

    } catch (error) {
      console.error(`Failed to ${adminAction.action.toLowerCase()} request:`, error);
      alert(`There was an error. Please try again.`);
    } finally {
      setIsLoading(false);
      setAdminAction(null);
    }
  };

  const handleSaveCertificate = async (certificateData: ExtractedCertificate) => {
    if (!currentUser) return;
    try {
      const newCertificationRequest = await saveNewCertificate(certificateData, currentUser);

      setAcquired(prev => {
        // Use a Map to handle upserting, preventing duplicates in the UI state.
        const certMap = new Map(prev.map(cert => [cert.id, cert]));
        certMap.set(newCertificationRequest.id, newCertificationRequest);

        return Array.from(certMap.values()).sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
      });

      setShowUploadModal(false);
    } catch (error: any) {
      console.error("Failed to save certificate:", error);
      alert("Failed to save certificate: " + error.message);
      // Re-throw to keep modal open and show error
      throw error;
    }
  };

  const handleSaveManyCertificates = (newCerts: CertificationRequest[]) => {
    if (!currentUser) return;

    // Use a Map to handle potential duplicates and merge new with old
    const certMap = new Map<string, CertificationRequest>();
    acquired.forEach(cert => certMap.set(cert.id, cert));
    newCerts.forEach(cert => certMap.set(cert.id, cert));

    // FIX: Explicitly type sort callback parameters to fix 'Property 'requestDate' does not exist on type 'unknown'' error.
    const updatedAcquired = Array.from(certMap.values()).sort((a: CertificationRequest, b: CertificationRequest) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());

    setAcquired(updatedAcquired);
    setShowUploadModal(false);
  };


  const handleBackToLogin = () => { setRegistrationInfo(null); setError(null); };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!currentUser) {
    if (showAdminLogin) {
      // FIX: Pass theme prop to Admin component for login view
      return <Admin onLogin={handleAdminLogin} isLoading={isLoading} error={error} onBack={() => setShowAdminLogin(false)} theme={theme} />;
    }
    return (
      <LoginWithEmail
        onLogin={handleEmailLoginSubmit}
        onRegister={handleRegistration}
        isRegistration={!!registrationInfo}
        registrationEmail={registrationInfo?.email}
        isLoading={isLoading}
        error={error}
        onAdminLogin={() => setShowAdminLogin(true)}
        onBackToLogin={handleBackToLogin}
        // FIX: Pass theme prop to LoginWithEmail component
        theme={theme}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 font-sans text-gray-800 dark:text-gray-200">
      <Header
        currentUser={currentUser}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className="container mx-auto max-w-7xl px-4 py-8">
        {currentUser.role === UserRole.Admin ? (
          <Admin
            currentUser={currentUser}
            requests={allRequests}
            onApprove={handleApproveRequest}
            onDeny={handleDenyRequest}
            isLoading={isLoading}
            // FIX: Pass theme prop to Admin component for dashboard view
            theme={theme}
          />
        ) : currentView === 'requestVoucher' ? (
          <RequestVoucherPage
            currentUser={currentUser}
            onSubmit={handleNewVoucherRequest}
            onBack={() => handleNavigateToDashboard('Available')}
          />
        ) : (
          <EmployeeView
            currentUser={currentUser}
            acquired={acquired}
            available={available}
            requested={requested}
            onRequestVoucher={handleRequestVoucher}
            onUpdateRequest={handleUpdateRequest}
            initialTab={initialDashboardTab}
            onAddCertificate={() => setShowUploadModal(true)}
          />
        )}
      </main>
      <AnimatePresence>
        {adminAction && (
          <ApprovalDenialModal
            request={adminAction.request}
            action={adminAction.action}
            onClose={() => setAdminAction(null)}
            onConfirm={handleAdminActionConfirm}
          />
        )}
      </AnimatePresence>
      {showUploadModal && currentUser && (
        <UploadCertificateModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSave={handleSaveCertificate}
          onSaveMany={handleSaveManyCertificates}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
