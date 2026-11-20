import fs from 'fs';
import path from 'path';
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

function getCompanyUploadDir(myCoId: string): string {
  const safeMyCoId = (myCoId || 'GENERAL').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.resolve(process.cwd(), 'data', 'uploads', safeMyCoId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function listFilesInFolder(myCoId: string): StatutoryDocument[] {
  const dir = getCompanyUploadDir(myCoId);
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const documents: StatutoryDocument[] = [];

  for (const entry of entries) {
    if (entry.isFile()) {
      const fileName = entry.name;
      const filePath = path.join(dir, fileName);
      let stats;
      try {
        stats = fs.statSync(filePath);
      } catch {
        stats = { size: 250000, mtime: new Date() };
      }
      const { statutorySection, category } = classifyStatutoryFile(fileName);
      const fileId = Buffer.from(fileName).toString('base64url');

      documents.push({
        fileId,
        fileName,
        statutorySection,
        category,
        lastUpdated: stats.mtime ? stats.mtime.toISOString() : new Date().toISOString(),
        fileSizeKB: Math.max(1, Math.round((stats.size || 250000) / 1024)),
      });
    }
  }

  documents.sort((a, b) =>
    a.fileName.localeCompare(b.fileName, undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  );

  return documents;
}

export const listDocumentsForFolder = listFilesInFolder;

export async function uploadFileToFolder(
  myCoId: string,
  fileBuffer: Buffer,
  fileName: string,
): Promise<StatutoryDocument> {
  const dir = getCompanyUploadDir(myCoId);
  const safeFileName = path.basename(fileName);
  const filePath = path.join(dir, safeFileName);

  fs.writeFileSync(filePath, fileBuffer);
  const stats = fs.statSync(filePath);
  const { statutorySection, category } = classifyStatutoryFile(safeFileName);
  const fileId = Buffer.from(safeFileName).toString('base64url');

  return {
    fileId,
    fileName: safeFileName,
    statutorySection,
    category,
    lastUpdated: stats.mtime ? stats.mtime.toISOString() : new Date().toISOString(),
    fileSizeKB: Math.max(1, Math.round(stats.size / 1024)),
  };
}

export async function getDownloadableFile(
  company: CompanyAssignment,
  fileId: string,
): Promise<{ kind: 'stream'; fileName: string; stream: Readable } | null> {
  const dir = getCompanyUploadDir(company.myCoId);
  let fileName = '';
  try {
    fileName = Buffer.from(fileId, 'base64url').toString('utf-8');
  } catch {
    fileName = fileId;
  }
  const safeFileName = path.basename(fileName);
  const filePath = path.join(dir, safeFileName);

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    const entries = fs.readdirSync(dir);
    const found = entries.find((e) => Buffer.from(e).toString('base64url') === fileId || e === fileId);
    if (!found) return null;
    const matchPath = path.join(dir, found);
    const stream = fs.createReadStream(matchPath);
    return { kind: 'stream', fileName: found, stream };
  }

  const stream = fs.createReadStream(filePath);
  return { kind: 'stream', fileName: safeFileName, stream };
}

export async function renameFile(
  myCoId: string,
  fileId: string,
  newFileName: string,
): Promise<void> {
  const dir = getCompanyUploadDir(myCoId);
  let oldFileName = '';
  try {
    oldFileName = Buffer.from(fileId, 'base64url').toString('utf-8');
  } catch {
    oldFileName = fileId;
  }
  const safeOld = path.basename(oldFileName);
  const safeNew = path.basename(newFileName);
  const oldPath = path.join(dir, safeOld);
  const newPath = path.join(dir, safeNew);

  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
  }
}

export async function deleteFile(myCoId: string, fileId: string): Promise<void> {
  const dir = getCompanyUploadDir(myCoId);
  let fileName = '';
  try {
    fileName = Buffer.from(fileId, 'base64url').toString('utf-8');
  } catch {
    fileName = fileId;
  }
  const safeName = path.basename(fileName);
  const filePath = path.join(dir, safeName);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
