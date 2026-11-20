export type DocumentCategory =
  | 'Incorporation'
  | 'Directors & Officers'
  | 'Share Capital'
  | 'Annual Compliance'
  | 'Constitution'
  | 'Other';

export interface StatutoryDocument {
  fileId: string;
  fileName: string;
  statutorySection: string;
  category: DocumentCategory;
  lastUpdated: string;
  fileSizeKB: number;
}

export interface CompanyAssignment {
  myCoId: string;
  companyName: string;
  driveFolderId: string;
  registrationNo?: string;
  companyId?: string;
}

export type PublicCompany = CompanyAssignment;

export type UserRole = 'administrator' | 'manager' | 'user';
export type UserStatus = 'active' | 'pending';

export interface RequestedCompanyInfo {
  companyName: string;
  myCoId: string;
}

export interface AuthenticatedUser {
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  companies: CompanyAssignment[];
  requestedCompany?: RequestedCompanyInfo;
}

export interface AuthSessionResponse {
  user: AuthenticatedUser;
  authorizedCompanies: CompanyAssignment[];
  cosecWhatsappNumber: string;
  token?: string;
}

export interface AiSearchResponse {
  explanation: string;
  matchedFileIds: string[];
  missingForms: string[];
}

export interface MissingFormSubmission {
  id: string;
  companyId: string;
  companyName: string;
  formName: string;
  notes: string;
  submittedAt: string;
}

export type AuditActionType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'VAULT_VISIT'
  | 'DOCUMENT_DOWNLOAD'
  | 'CTC_WHATSAPP_REQUEST'
  | 'MISSING_FORM_REQUEST'
  | 'FILE_UPLOAD'
  | 'FILE_RENAME'
  | 'FILE_DELETE'
  | 'USER_REGISTERED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'PASSWORD_CHANGED';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO 8601 UTC timestamp
  userEmail: string;
  userName: string;
  userRole: 'administrator' | 'manager' | 'user';
  action: AuditActionType;
  companyName?: string;
  myCoId?: string;
  documentName?: string;
  details?: string;
  ipAddress?: string;
}

