import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import type { DocumentCategory, StatutoryDocument, CompanyAssignment } from '../src/types.ts';

export function normalizeMyCoId(myCoId: string): string {
  if (!myCoId) return 'GENERAL';
  return myCoId.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function classifyStatutoryFile(fileName: string): {
  statutorySection: string;
  category: DocumentCategory;
} {
  const lower = fileName.toLowerCase();

  if (
    /\b(f9|form\s*9|s14|sec\s*14|section\s*14|s15|s17|incorporation|superform|certificate\s*of\s*incorporation)\b/i.test(
      lower,
    )
  ) {
    return { statutorySection: 'Section 14 / Form 9', category: 'Incorporation' };
  }
  if (
    /\b(f49|form\s*49|s58|sec\s*58|section\s*58|f48a|s201|director|secretary|officer|register\s*of\s*directors)\b/i.test(
      lower,
    )
  ) {
    return {
      statutorySection: 'Section 58 / Form 49',
      category: 'Directors & Officers',
    };
  }
  if (
    /\b(f24|form\s*24|f32a|form\s*32a|s78|sec\s*78|section\s*78|s105|allotment|share|transfer|capital|register\s*of\s*members)\b/i.test(
      lower,
    )
  ) {
    return { statutorySection: 'Section 78 / Form 24', category: 'Share Capital' };
  }
  if (
    /\b(ar|annual\s*return|s68|sec\s*68|section\s*68|s258|financial\s*statement|audited|agm|f55)\b/i.test(
      lower,
    )
  ) {
    return {
      statutorySection: 'Section 68 / Annual Return',
      category: 'Annual Compliance',
    };
  }
  if (
    /\b(m&a|memorandum|articles|constitution|s31|s32|s35|s36|f11|form\s*11|special\s*resolution)\b/i.test(
      lower,
    )
  ) {
    return { statutorySection: 'Section 32 / Constitution', category: 'Constitution' };
  }
  return { statutorySection: 'General Statutory Filing', category: 'Incorporation' };
}

function getCompanyUploadDir(myCoId: string): string {
  const safeMyCoId = normalizeMyCoId(myCoId);
  const dir = path.resolve(process.cwd(), 'data', 'uploads', safeMyCoId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function cleanupUploadsDir(): void {
  try {
    const uploadsRoot = path.resolve(process.cwd(), 'data', 'uploads');
    if (!fs.existsSync(uploadsRoot)) return;
    const entries = fs.readdirSync(uploadsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        try {
          fs.unlinkSync(path.join(uploadsRoot, entry.name));
        } catch {}
      }
    }
  } catch {}
}

export function listFilesInFolder(myCoId: string): StatutoryDocument[] {
  cleanupUploadsDir();
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
        lastUpdated: stats.mtime
          ? stats.mtime.toISOString()
          : new Date().toISOString(),
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
    lastUpdated: stats.mtime
      ? stats.mtime.toISOString()
      : new Date().toISOString(),
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
    const found = entries.find(
      (e) => Buffer.from(e).toString('base64url') === fileId || e === fileId,
    );
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

export async function deleteFile(
  myCoId: string,
  fileId: string,
): Promise<void> {
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
