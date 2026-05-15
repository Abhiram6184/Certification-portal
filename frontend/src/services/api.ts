

import { User, CertificationRequest, UserRole, RequestStatus, Certification, ExtractedCertificate, AdminEmployee, CredentialSummary, CredentialHolder, EmployeeRegistrationData, VoucherRequestData, CredentialReportItem, LeaderboardEntry, LeaderboardResponse, IssuerLeaderboardEntry, BulkUploadResult, VoucherBulkUploadResult } from '../types';
// FIX: Removed import of non-existent `MOCK_ONGOING_REQUESTS` from `../constants` and removed the unused `fetchPortalData` function which depended on it to resolve the module error.
import { AVAILABLE_CERTIFICATIONS } from '../constants';

const MOCK_ADMIN_USER: User = { id: 'admin', name: 'Admin User', role: UserRole.Admin, email: 'admin@celebaltech.com' };

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // remove the "data:mime/type;base64," prefix
            resolve(result.split(',')[1]);
        };
        reader.onerror = error => reject(error);
    });
};

async function handleApiResponse(response: Response) {
    // Read the body as text ONCE to avoid "body stream already read" errors.
    const responseText = await response.text();

    if (!response.ok) {
        let errorMessage;
        try {
            // Try to parse the text as JSON to get a structured error message.
            const errorJson = JSON.parse(responseText);
            errorMessage = errorJson.error || `Request failed with status ${response.status}`;
        } catch (e) {
            // If parsing fails, it's not a JSON error. Use the raw text.
            errorMessage = responseText || `Request failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
    }

    try {
        // If the response was OK, parse the text as JSON for the successful result.
        return JSON.parse(responseText);
    } catch (e) {
        console.error("Successful API response was not valid JSON:", responseText);
        throw new Error("The server sent an unexpected successful response. Check the console for details.");
    }
}


export const extractCertificateData = async (file: File): Promise<ExtractedCertificate> => {
    const base64File = await fileToBase64(file);
    const response = await fetch('/api/extract-from-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64File, mimeType: file.type, fileName: file.name }),
    });

    const extracted = await handleApiResponse(response);
    return { ...extracted, file_name: file.name };
};

const toISOOrPassThrough = (dateStr: string | null): string | undefined => {
    if (!dateStr || dateStr.toLowerCase() === 'n/a' || dateStr.toLowerCase() === 'null') return undefined;
    // Attempt to parse and re-format to ISO string
    try {
        return new Date(dateStr).toISOString();
    } catch {
        return dateStr;
    }
};

const mapRawCredentialToRequest = (cred: any, user: User, vendor: string = 'Databricks'): CertificationRequest => {
    return {
        id: cred.credential_id,
        user: user,
        userId: user.id,
        certification: {
            id: `cert-${cred.credential_id}`,
            name: cred.title || cred.credential_title,
            vendor: vendor,
            duration: 'N/A',
            validityYears: 0,
        },
        requestDate: toISOOrPassThrough(cred.issuedOn || cred.issued_on) || new Date().toISOString(),
        issuedOn: toISOOrPassThrough(cred.issuedOn || cred.issued_on),
        status: (cred.status as RequestStatus) || RequestStatus.Active,
        result: 'Pass',
        certificationExpiryDate: toISOOrPassThrough(cred.expiryDate || cred.expiry_date),
        credential_link: cred.credential_link || undefined, // Include credential link if available
    };
};

export const extractCertificateDataFromUrl = async (url: string): Promise<Omit<ExtractedCertificate, 'file_name'>> => {
    const response = await fetch('/api/extract-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
    });
    return handleApiResponse(response);
};

export const loginWithEmail = async (email: string) => {
    const response = await fetch('/api/email-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    const emailLoginData = await handleApiResponse(response);
    
    if (emailLoginData.newUser) {
        return emailLoginData; // Return the new user flag and email
    }

    const requestedData = await getEmployeeRequests(emailLoginData.user.id);
    
    const mappedAcquired = emailLoginData.acquired.map((cred: any) => {
        const title = cred.title || cred.credential_title || '';
        const lowerTitle = title.toLowerCase();
        let vendor = 'Others'; // Default for email-login credentials

        if (lowerTitle.includes('databricks') || lowerTitle.includes('partner academy')) {
            vendor = 'Databricks';
        } else if (lowerTitle.includes('microsoft') || lowerTitle.includes('azure')) {
            vendor = 'Microsoft';
        } else if (lowerTitle.includes('google')) {
            vendor = 'Google';
        }

        const mapped = mapRawCredentialToRequest(cred, emailLoginData.user, vendor);
        // Include credential_link if available
        if (cred.credential_link) {
            mapped.credential_link = cred.credential_link;
        }
        return mapped;
    });

    return {
        user: emailLoginData.user,
        acquired: mappedAcquired,
        available: AVAILABLE_CERTIFICATIONS,
        requested: requestedData,
    };
};

export const registerEmployee = async (formData: EmployeeRegistrationData) => {
    const response = await fetch('/api/register-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
    });
    const registrationData = await handleApiResponse(response);

    return {
        user: registrationData.user,
        acquired: [], // New users have no credentials
        available: AVAILABLE_CERTIFICATIONS,
        requested: [], // New users have no requests
    };
};

export const scrapeAndAddByUrl = async (url: string, user: User): Promise<CertificationRequest[]> => {
    const response = await fetch('/api/scrape-and-add-by-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, user }),
    });
    const newCredentialsRaw = await handleApiResponse(response);
    // The backend returns an array of credentials, map them for the frontend
    return newCredentialsRaw.map((cred: any) => mapRawCredentialToRequest(cred, user));
};

export const saveNewCertificate = async (certificateData: ExtractedCertificate, user: User): Promise<CertificationRequest> => {
    const response = await fetch('/api/add-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificateData, user }),
    });

    const savedCert = await handleApiResponse(response);
    
    // Construct a CertificationRequest object for the frontend
    return {
      id: savedCert.credential_id,
      user: user,
      userId: user.id,
      certification: {
        id: `cert-${savedCert.credential_id}`,
        name: savedCert.credential_title,
        vendor: certificateData.issuer_name, // Use extracted issuer name for display
        duration: 'N/A',
        validityYears: 0,
      },
      requestDate: new Date(savedCert.issued_on).toISOString(),
      issuedOn: new Date(savedCert.issued_on).toISOString(),
      status: (savedCert.status as RequestStatus) || RequestStatus.Active,
      result: 'Pass',
      certificationExpiryDate: savedCert.expiry_date && savedCert.expiry_date.toLowerCase() !== 'does not expire'
          ? new Date(savedCert.expiry_date).toISOString()
          : undefined,
    };
};

export const bulkUploadCredentials = async (file: File): Promise<BulkUploadResult> => {
    const csvData = await fileToBase64(file);
    const response = await fetch('/api/admin/bulk-upload-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData }),
    });
    return handleApiResponse(response);
};

export const bulkUploadVouchers = async (file: File): Promise<VoucherBulkUploadResult> => {
    const csvData = await fileToBase64(file);
    const response = await fetch('/api/admin/bulk-upload-vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData }),
    });
    return handleApiResponse(response);
};

export const submitVoucherRequest = async (formData: VoucherRequestData): Promise<CertificationRequest> => {
    const response = await fetch('/api/request-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
    });

    const backendRequest = await handleApiResponse(response);

    // The backend returns a partial Certification object. We need to complete it
    // to match the frontend's CertificationRequest type definition to prevent render errors.
    const completeRequest: CertificationRequest = {
        ...backendRequest,
        personal_email: backendRequest.personal_email,
        certification: {
            id: `cert-req-${backendRequest.id}`, // Create a synthetic ID
            name: backendRequest.certification.name,
            vendor: backendRequest.certification.vendor,
            duration: 'N/A', // Add default value
            validityYears: 0, // Add default value
        },
    };
    
    return completeRequest;
};

export const requestVoucher = async (user: User, certificationId: string): Promise<CertificationRequest> => {
    const certification = AVAILABLE_CERTIFICATIONS.find(c => c.id === certificationId);
    if (!certification) {
        throw new Error("Certification not found");
    }

    if (!user.email) {
        throw new Error("Current user's email is not available for this request.");
    }

    const formData: VoucherRequestData = {
        name: user.name,
        email: user.email,
        cert_provider: certification.vendor,
        cert_type: certification.name
    };
    
    // Reuse the existing API call function to ensure consistency
    return submitVoucherRequest(formData);
};

export const updateRequestProgress = async (requestId: string, updates: Partial<CertificationRequest>): Promise<CertificationRequest> => {
    const response = await fetch('/api/employee/update-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ req_id: requestId, updates }),
    });
    const dbRequest = await handleApiResponse(response);
    
    // Reconstruct the full object, mirroring the logic in getEmployeeRequests
    const certDetails = AVAILABLE_CERTIFICATIONS.find(c => c.name.includes(dbRequest.cert_type)) || {
        id: `cert-${dbRequest.request_id}`,
        name: dbRequest.cert_type,
        vendor: dbRequest.cert_provider,
        duration: "N/A",
        validityYears: 2
    };

    return {
        id: String(dbRequest.request_id),
        userId: dbRequest.user_id,
        personal_email: dbRequest.personal_email,
        user: { id: dbRequest.user_id, name: dbRequest.user_name || `User (${dbRequest.user_id})`, role: UserRole.Employee, email: dbRequest.user_email },
        certification: certDetails,
        requestDate: dbRequest.request_date,
        status: dbRequest.status,
        voucherId: dbRequest.voucher_id,
        examDate: dbRequest.exam_date,
        result: dbRequest.result,
    };
};

export const adminLogin = async (username: string, password: string): Promise<User> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (username.toLowerCase() === 'admin' && password === 'password') {
                resolve(MOCK_ADMIN_USER);
            } else {
                reject(new Error('Invalid admin credentials'));
            }
        }, 500);
    });
};

// Helper function to normalize status values from database to match RequestStatus enum
// Database column: voucher_requests.status
// Database values: 'Pending', 'Approved', 'Fulfilled', 'Rejected'
// These match the RequestStatus enum values exactly
const normalizeStatus = (status: string): RequestStatus => {
    if (!status || status.trim() === '') return RequestStatus.Pending;
    
    const normalized = status.trim();
    const lowerNormalized = normalized.toLowerCase();
    
    // Case-insensitive mapping from database values to enum
    const statusMap: Record<string, RequestStatus> = {
        'pending': RequestStatus.Pending,      // 'Pending' -> RequestStatus.Pending
        'approved': RequestStatus.Approved,     // 'Approved' -> RequestStatus.Approved
        'rejected': RequestStatus.Rejected,    // 'Rejected' -> RequestStatus.Rejected
        'fulfilled': RequestStatus.Fulfilled,  // 'Fulfilled' -> RequestStatus.Fulfilled
        'exam scheduled': RequestStatus.ExamScheduled,
        'completed': RequestStatus.Completed,
        'active': RequestStatus.Active,
        'expired': RequestStatus.Expired,
    };
    
    // Check case-insensitive match first
    if (statusMap[lowerNormalized]) {
        return statusMap[lowerNormalized];
    }
    
    // Check exact case-sensitive match with enum values
    const enumValues = Object.values(RequestStatus);
    for (const enumVal of enumValues) {
        if (enumVal === normalized) {
            return enumVal;
        }
    }
    
    // Unknown status - log warning and default to Pending
    console.warn(`[Status Normalization] Unknown status: "${normalized}". Defaulting to Pending.`);
    return RequestStatus.Pending;
};

export const getAllRequests = async (): Promise<CertificationRequest[]> => {
    const response = await fetch('/api/admin/all-requests');
    const dbRequests = await handleApiResponse(response);

    return dbRequests.map((dbRequest: any) => {
        const certDetails = AVAILABLE_CERTIFICATIONS.find(c => c.name.includes(dbRequest.cert_type)) || {
            id: `cert-${dbRequest.request_id}`,
            name: dbRequest.cert_type,
            vendor: dbRequest.cert_provider,
            duration: "N/A",
            validityYears: 2
        };

        return {
            id: String(dbRequest.request_id),
            userId: dbRequest.user_id,
            personal_email: dbRequest.personal_email,
            user: { id: dbRequest.user_id, name: dbRequest.user_name || `User (${dbRequest.user_id})`, role: UserRole.Employee, email: dbRequest.user_email },
            certification: certDetails,
            requestDate: dbRequest.request_date,
            status: normalizeStatus(dbRequest.status),
            voucherId: dbRequest.voucher_id,
            examDate: dbRequest.exam_date,
            result: dbRequest.result,
            denialReason: dbRequest.denial_reason,
            reviewedBy: dbRequest.reviewed_by
        };
    });
};

export const getEmployeeRequests = async (emp_code: string): Promise<CertificationRequest[]> => {
    const response = await fetch(`/api/employee/requests/${emp_code}`);
    const dbRequests = await handleApiResponse(response);

    return dbRequests.map((dbRequest: any) => {
        const certDetails = AVAILABLE_CERTIFICATIONS.find(c => c.name.includes(dbRequest.cert_type)) || {
            id: `cert-${dbRequest.request_id}`,
            name: dbRequest.cert_type,
            vendor: dbRequest.cert_provider,
            duration: "N/A",
            validityYears: 2
        };

        return {
            id: String(dbRequest.request_id),
            userId: dbRequest.user_id,
            personal_email: dbRequest.personal_email,
            user: { id: dbRequest.user_id, name: dbRequest.user_name || `User (${dbRequest.user_id})`, role: UserRole.Employee, email: dbRequest.user_email },
            certification: certDetails,
            requestDate: dbRequest.request_date,
            status: normalizeStatus(dbRequest.status),
            voucherId: dbRequest.voucher_id,
            examDate: dbRequest.exam_date,
            result: dbRequest.result,
        };
    });
};

export const getAdminEmployees = async (): Promise<AdminEmployee[]> => {
    const response = await fetch('/api/admin/employees');
    return handleApiResponse(response);
};

export const getLeaderboardData = async (): Promise<LeaderboardResponse> => {
    const response = await fetch('/api/leaderboard');
    return handleApiResponse(response);
};

export const getIssuerLeaderboard = async (): Promise<IssuerLeaderboardEntry[]> => {
    const response = await fetch('/api/leaderboard/by-issuer');
    return handleApiResponse(response);
};

export const getEmployeeCredentials = async (employee: AdminEmployee): Promise<CertificationRequest[]> => {
    const response = await fetch(`/api/admin/credentials/by-emp-code/${employee.emp_code}`);
    const rawCredentials = await handleApiResponse(response);

    const user: User = {
        id: employee.emp_code,
        name: employee.Emp_name,
        role: UserRole.Employee,
        designation: employee.Designation || undefined
    };
    
    // The backend returns an array of credentials, map them for the frontend
    return rawCredentials.map((cred: any) => mapRawCredentialToRequest(cred, user));
};

export const getCredentialSummary = async (): Promise<CredentialSummary[]> => {
    const response = await fetch('/api/admin/credentials-summary');
    return handleApiResponse(response);
};

export const getEmployeesByCredential = async (title: string): Promise<CredentialHolder[]> => {
    const response = await fetch(`/api/admin/employees-by-credential?title=${encodeURIComponent(title)}`);
    return handleApiResponse(response);
};

export const getCompleteCredentialsReport = async (): Promise<CredentialReportItem[]> => {
    const response = await fetch('/api/admin/all-credentials-report');
    return handleApiResponse(response);
};


const mapDbRequestToFrontend = (dbRequest: any, originalRequest: CertificationRequest): CertificationRequest => {
    // Re-construct the user object from the fresh DB data to prevent staleness and rendering errors.
    const user = {
        id: dbRequest.user_id || originalRequest.user.id,
        name: dbRequest.user_name || originalRequest.user.name,
        role: UserRole.Employee,
        email: dbRequest.user_email || originalRequest.user.email,
    };

    return {
        ...originalRequest,
        id: String(dbRequest.request_id),
        user: user,
        userId: user.id,
        personal_email: dbRequest.personal_email,
        status: dbRequest.status,
        reviewedBy: dbRequest.reviewed_by,
        denialReason: dbRequest.denial_reason,
        voucherId: dbRequest.voucher_id,
        examDate: dbRequest.exam_date,
        result: dbRequest.result,
        requestDate: dbRequest.request_date || originalRequest.requestDate,
    };
}

export const approveAndAssignRequest = async (request: CertificationRequest, adminId: string): Promise<CertificationRequest> => {
    const response = await fetch('/api/approve-and-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ req_id: request.id, adminId }),
    });

    const result = await handleApiResponse(response); // Expects { updatedRequest: {...}, message: "..." }
    
    // Show message to admin
    alert(result.message);

    return mapDbRequestToFrontend(result.updatedRequest, request);
};

export const updateCertificationStatus = async (
    request: CertificationRequest,
    status: RequestStatus,
    adminId: string,
    details: any,
    emailContent: string
): Promise<CertificationRequest> => {
    let endpoint = '';
    const recipientEmail = request.personal_email || request.user.email;
    const body: any = { 
        req_id: request.id,
        adminId: adminId,
        details: details,
        employeeEmail: recipientEmail,
        emailContent: emailContent,
    };

    switch (status) {
        case RequestStatus.Approved:
            // This is now handled by approveAndAssignRequest
            throw new Error("Direct 'Approved' status update is deprecated. Use auto-assignment flow.");
        case RequestStatus.Rejected:
            endpoint = '/api/reject-request';
            body.reason = details?.denialReason;
            break;
        case RequestStatus.Fulfilled:
             // This is now handled by approveAndAssignRequest
             throw new Error("Direct 'Fulfilled' status update is deprecated. Use auto-assignment flow.");
        default:
            throw new Error(`Status update for "${status}" is not handled.`);
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const updatedDbRequest = await handleApiResponse(response);
    // Use the robust mapper to prevent crashes from incomplete data
    return mapDbRequestToFrontend(updatedDbRequest, request);
};

// FIX: Add missing generateFulfillmentEmail function to be used by AssignVoucherModal.
export const generateFulfillmentEmail = async (
  employeeName: string,
  certificationName: string,
  voucherId: number | string
): Promise<string> => {
  const response = await fetch('/api/generate-fulfillment-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeName, certificationName, voucherId }),
  });
  const data = await handleApiResponse(response);
  return data.email;
};

export const generateApprovalEmail = async (
  employeeName: string,
  certificationName: string
): Promise<string> => {
  const response = await fetch('/api/generate-approval-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeName, certificationName }),
  });
  const data = await handleApiResponse(response);
  return data.email;
};

export const generateDenialEmail = async (
  employeeName: string,
  certificationName: string,
  reason: string
): Promise<string> => {
  const response = await fetch('/api/generate-denial-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeName, certificationName, reason }),
  });
  const data = await handleApiResponse(response);
  return data.email;
};
