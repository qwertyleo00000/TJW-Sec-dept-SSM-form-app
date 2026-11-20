import { google } from 'googleapis';
import type { Readable } from 'stream';
import type { DocumentCategory, StatutoryDocument } from '../src/types.ts';
import type { RegistryCompany } from './registry.ts';

export function classifyStatutoryFile(fileName: string): {
  statutorySection: string;
  category: DocumentCategory;
} {
  const lower = fileName.toLowerCase();

  if (/sec(tion)?[_\s-]*14|superform/.test(lower)) {
    return { statutorySection: 'Section 14', category: 'Incorporation' };
  }
  if (/sec(tion)?[_\s-]*17|cert.*incorp|incorporation/.test(lower)) {
    return { statutorySection: 'Section 17', category: 'Incorporation' };
  }
  if (/sec(tion)?[_\s-]*58|director|officer|secretary/.test(lower)) {
    return { statutorySection: 'Section 58', category: 'Directors & Officers' };
  }
  if (/sec(tion)?[_\s-]*78|allotment/.test(lower)) {
    return { statutorySection: 'Section 78', category: 'Share Capital' };
  }
  if (/sec(tion)?[_\s-]*51|member|shareholder/.test(lower)) {
    return { statutorySection: 'Section 51', category: 'Share Capital' };
  }
  if (/sec(tion)?[_\s-]*68|annual[_\s-]*return/.test(lower)) {
    return { statutorySection: 'Section 68', category: 'Annual Compliance' };
  }
  if (/sec(tion)?[_\s-]*46|registered[_\s-]*address/.test(lower)) {
    return { statutorySection: 'Section 46', category: 'Annual Compliance' };
  }
  if (/sec(tion)?[_\s-]*32|constitution|m&a|memorandum/.test(lower)) {
    return { statutorySection: 'Section 32', category: 'Constitution' };
  }
  if (/resolution|minutes|board/.test(lower)) {
    return { statutorySection: 'Board Resolution', category: 'Directors & Officers' };
  }
  return { statutorySection: 'Statutory Filing', category: 'Other' };
}

function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_PRIVATE_KEY?.trim();
  if (!email || !rawKey) {
    throw new Error(
      'Google Drive Service Account credentials (GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY) are missing. Please configure them in your environment variables.',
    );
  }
  const privateKey = rawKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

export async function listDocumentsForFolder(
  driveFolderId: string,
): Promise<StatutoryDocument[]> {
  const drive = getDriveClient();
  const safeFolderId = driveFolderId.replace(/'/g, "\\'");
  const response = await drive.files.list({
    q: `'${safeFolderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
    fields: 'files(id, name, modifiedTime, size)',
    orderBy: 'modifiedTime desc',
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = response.data.files ?? [];
  return files
    .filter(
      (
        f,
      ): f is {
        id: string;
        name: string;
        modifiedTime?: string | null;
        size?: string | null;
      } => Boolean(f.id && f.name),
    )
    .map((file) => {
      const { statutorySection, category } = classifyStatutoryFile(file.name);
      const sizeBytes = file.size ? Number(file.size) : 0;
      return {
        fileId: file.id,
        fileName: file.name,
        statutorySection,
        category,
        lastUpdated: file.modifiedTime ?? new Date().toISOString(),
        fileSizeKB: Math.max(1, Math.round(sizeBytes / 1024)),
      };
    });
}

export async function getDownloadableFile(
  company: RegistryCompany,
  fileId: string,
): Promise<
  | { kind: 'stream'; fileName: string; stream: Readable }
  | null
> {
  const drive = getDriveClient();
  // Strict IDOR check: verify file metadata and confirm it lives inside company.driveFolderId
  const meta = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, parents, trashed',
    supportsAllDrives: true,
  });

  const file = meta.data;
  if (
    !file ||
    file.trashed ||
    !file.parents ||
    !file.parents.includes(company.driveFolderId)
  ) {
    return null;
  }

  const mediaRes = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' },
  );

  return {
    kind: 'stream',
    fileName: file.name ?? `${fileId}.pdf`,
    stream: mediaRes.data as Readable,
  };
}
