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

export interface AuthenticatedUser {
  email: string;
  fullName: string;
  role: UserRole;
  companies: CompanyAssignment[];
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
