

export enum UserRole {
  Employee = 'Employee',
  Admin = 'Admin',
}

export enum RequestStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
  ExamScheduled = 'Exam Scheduled',
  Completed = 'Completed',
  Fulfilled = 'Fulfilled',
  Active = 'Active',
  Expired = 'Expired',
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  designation?: string;
  department?: string;
}

export interface Certification {
  id: string;
  name: string;
  vendor: string;
  duration: string;
  validityYears: number;
  url?: string;
}

export interface CertificationRequest {
  id: string;
  user: User;
  userId: string;
  certification: Certification;
  requestDate: string;
  status: RequestStatus;
  issuedOn?: string;
  examDate?: string;
  result?: 'Pass' | 'Fail';
  voucherId?: number | string;
  certificationExpiryDate?: string;
  denialReason?: string;
  reviewedBy?: string;
  personal_email?: string;
  credential_link?: string; // Link to the credential detail page
}

export interface ExtractedCertificate {
  issuer_name: string;
  credential_name: string;
  holder_full_name: string;
  issued_date?: string;
  expiry_date?: string;
  file_name: string;
}

export interface EmployeeRegistrationData {
  emp_code: string;
  employee_name: string;
  designation: string;
  email: string;
}

export interface VoucherRequestData {
  name: string;
  email: string;
  personal_email?: string;
  cert_provider: string;
  cert_type: string;
}

export interface AdminEmployee {
  emp_code: string;
  Emp_name: string;
  Designation: string | null;
  Department: string | null;
  City: string | null;
  credential_count: number;
  Employee_EmailID: string;
}

export interface CredentialSummary {
  credential_title: string;
  employee_count: number;
  emp_codes?: string[];
}

export interface CredentialHolder {
  Emp_Code: string;
  Employee_Name: string;
  Employee_EmailID: string;
  Designation: string | null;
}

export interface CredentialReportItem {
  CredentialName: string;
  Emp_Code: string;
  Employee_Name: string;
  Employee_EmailID: string;
  Designation: string | null;
}

export interface LeaderboardEntry extends AdminEmployee {
  rank: number;
}

export interface LeaderboardSummary {
  totalEmployees: number;
  totalCredentials: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  summary: LeaderboardSummary;
}

export interface IssuerLeaderboardEntry {
  rank: number;
  issuer_name: string;
  credential_count: number;
}

export type EmployeeDashboardTab = 'Leaderboard' | 'Acquired' | 'Available' | 'Requested';

export interface BulkUploadError {
  row: number;
  email: string;
  reason: string;
}

export interface BulkUploadResult {
  processed: number;
  success: number;
  errors: BulkUploadError[];
}

export interface VoucherBulkUploadError {
  row: number;
  voucherCode: string;
  reason: string;
}

export interface VoucherBulkUploadResult {
  processed: number;
  success: number;
  errors: VoucherBulkUploadError[];
}
