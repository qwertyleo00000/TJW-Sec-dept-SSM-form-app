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

export interface PublicCompany {
  companyId: string;
  companyName: string;
  registrationNo: string;
}

export interface AuthenticatedUser {
  email: string;
  fullName: string;
  role: string;
}

export interface AuthSessionResponse {
  user: AuthenticatedUser;
  authorizedCompanies: PublicCompany[];
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
