import type { AuthenticatedUser, PublicCompany, StatutoryDocument } from '../types';

export const DEFAULT_COSEC_WHATSAPP_NUMBER = '601136768398';

export function buildCtcWhatsappUrl(params: {
  whatsappNumber?: string;
  company: PublicCompany;
  document: Pick<StatutoryDocument, 'fileName' | 'statutorySection'>;
  user: AuthenticatedUser;
}): string {
  const targetNumber =
    (params.whatsappNumber ?? DEFAULT_COSEC_WHATSAPP_NUMBER).replace(/\D/g, '') ||
    DEFAULT_COSEC_WHATSAPP_NUMBER;

  const message = `Hello CoSec Team, I would like to request a Certified True Copy (CTC) signed by the Company Secretary for the following document:

*Company Name:* ${params.company.companyName}
*SSM Reg No:* ${params.company.registrationNo}
*Document:* ${params.document.fileName} (${params.document.statutorySection})
*Requested By:* ${params.user.fullName} (${params.user.email})

Please let me know once it is ready for collection/delivery. Thank you!`;

  return `https://wa.me/${targetNumber}?text=${encodeURIComponent(message)}`;
}

export function buildMissingFormWhatsappUrl(params: {
  whatsappNumber?: string;
  company: PublicCompany;
  missingForms: string[];
  user: AuthenticatedUser;
  notes?: string;
}): string {
  const targetNumber =
    (params.whatsappNumber ?? DEFAULT_COSEC_WHATSAPP_NUMBER).replace(/\D/g, '') ||
    DEFAULT_COSEC_WHATSAPP_NUMBER;

  const formsText =
    params.missingForms.length > 0
      ? params.missingForms.join(', ')
      : 'Statutory Document Inquiry';

  const notesBlock = params.notes?.trim()
    ? `\n*Additional Notes:* ${params.notes.trim()}`
    : '';

  const message = `Hello CoSec Team, I would like to request the following statutory form(s) that are not currently available in our CoSec Vault:

*Company Name:* ${params.company.companyName}
*SSM Reg No:* ${params.company.registrationNo}
*Requested Form(s):* ${formsText}${notesBlock}
*Requested By:* ${params.user.fullName} (${params.user.email})

Please assist to upload or prepare a Certified True Copy (CTC) once available. Thank you!`;

  return `https://wa.me/${targetNumber}?text=${encodeURIComponent(message)}`;
}

export function formatDocumentTitle(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatFilingDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatFileSize(sizeKB: number): string {
  if (sizeKB >= 1024) {
    return `${(sizeKB / 1024).toFixed(1)} MB`;
  }
  return `${sizeKB} KB`;
}
