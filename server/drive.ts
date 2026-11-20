import { Readable } from 'stream';
import type { DocumentCategory, StatutoryDocument, CompanyAssignment } from '../src/types.ts';

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

export function extractDriveFolderId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const matchUrl = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (matchUrl && matchUrl[1]) {
    return matchUrl[1];
  }
  const matchParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchParam && matchParam[1]) {
    return matchParam[1];
  }
  return trimmed;
}

export async function listDocumentsForFolder(
  folderLinkOrId: string,
): Promise<StatutoryDocument[]> {
  const folderId = extractDriveFolderId(folderLinkOrId);
  if (!folderId) {
    throw new Error('Invalid Google Drive folder link or ID.');
  }

  const url = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(
      `Unable to access Google Drive folder (${res.status}). Please ensure folder sharing is set to "Anyone with the link -> Viewer".`,
    );
  }

  const html = await res.text();
  if (html.includes('Restricted') || html.includes('Sign in') || html.includes('You need access')) {
    throw new Error(
      'Google Drive folder access is Restricted. Please set folder access to "Anyone with the link (Viewer)" in Google Drive.',
    );
  }

  const documents: StatutoryDocument[] = [];
  const itemRegex = /<div class="folder-item[^"]*"[^>]*>[\s\S]*?href="[^"]*\/file\/d\/([a-zA-Z0-9_-]+)\/view"[^>]*>[\s\S]*?class="filename"[^>]*>([^<]+)<\/div>/g;

  let match;
  while ((match = itemRegex.exec(html)) !== null) {
    const fileId = match[1];
    const fileName = match[2].trim();
    if (fileId && fileName && (fileName.toLowerCase().endsWith('.pdf') || fileName.toLowerCase().includes('.pdf'))) {
      const { statutorySection, category } = classifyStatutoryFile(fileName);
      documents.push({
        fileId,
        fileName,
        statutorySection,
        category,
        lastUpdated: new Date().toISOString(),
        fileSizeKB: 250,
      });
    }
  }

  if (documents.length === 0) {
    const altRegex = /href="[^"]*drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/[^"]*"[^>]*>([^<]+)</g;
    let altMatch;
    const seen = new Set<string>();
    while ((altMatch = altRegex.exec(html)) !== null) {
      const fileId = altMatch[1];
      const rawName = altMatch[2].trim();
      if (fileId && rawName && !seen.has(fileId)) {
        seen.add(fileId);
        const fileName = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`;
        const { statutorySection, category } = classifyStatutoryFile(fileName);
        documents.push({
          fileId,
          fileName,
          statutorySection,
          category,
          lastUpdated: new Date().toISOString(),
          fileSizeKB: 250,
        });
      }
    }
  }

  return documents;
}

export async function getDownloadableFile(
  _company: CompanyAssignment,
  fileId: string,
): Promise<{ kind: 'stream'; fileName: string; stream: Readable } | null> {
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  const res = await fetch(downloadUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!res.ok || !res.body) {
    return null;
  }

  const nodeStream = Readable.fromWeb(res.body as any);
  return {
    kind: 'stream',
    fileName: `${fileId}.pdf`,
    stream: nodeStream,
  };
}

export async function uploadFileToFolder(
  _folderId: string,
  _fileBuffer: Buffer,
  _fileName: string,
): Promise<StatutoryDocument> {
  throw new Error('Managed via linked Google Drive folder. Please add, rename, or remove PDFs directly inside your shared Google Drive folder.');
}

export async function renameFile(): Promise<void> {
  throw new Error('Managed via linked Google Drive folder. Please add, rename, or remove PDFs directly inside your shared Google Drive folder.');
}

export async function deleteFile(): Promise<void> {
  throw new Error('Managed via linked Google Drive folder. Please add, rename, or remove PDFs directly inside your shared Google Drive folder.');
}
