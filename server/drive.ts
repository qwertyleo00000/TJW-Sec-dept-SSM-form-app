import { google } from 'googleapis';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Readable } from 'stream';
import type { DocumentCategory, StatutoryDocument } from '../src/types.ts';
import type { RegistryCompany } from './registry.ts';

interface SeedDocument extends StatutoryDocument {
  summary: string;
}

const MOCK_DRIVE_FOLDERS: Record<string, SeedDocument[]> = {
  '1A2B3C4D5E6F7G8H9I0J_ALPHA': [
    {
      fileId: 'alpha-doc-sec14',
      fileName: 'Section_14_Superform_AlphaTech_2023.pdf',
      statutorySection: 'Section 14',
      category: 'Incorporation',
      lastUpdated: '2023-05-12T09:30:00.000Z',
      fileSizeKB: 482,
      summary:
        'Application for Registration of a Company (Superform) detailing company profile, initial directors, shareholders, registered office address, and principal business activities.',
    },
    {
      fileId: 'alpha-doc-sec17',
      fileName: 'Section_17_Certificate_of_Incorporation_AlphaTech.pdf',
      statutorySection: 'Section 17',
      category: 'Incorporation',
      lastUpdated: '2023-05-12T10:15:00.000Z',
      fileSizeKB: 214,
      summary:
        'Notice of Registration / Certificate of Incorporation of Private Company issued by Suruhanjaya Syarikat Malaysia (SSM) under the Companies Act 2016.',
    },
    {
      fileId: 'alpha-doc-sec58',
      fileName: 'Section_58_Register_of_Directors_Latest_2026.pdf',
      statutorySection: 'Section 58',
      category: 'Directors & Officers',
      lastUpdated: '2026-02-18T14:20:00.000Z',
      fileSizeKB: 318,
      summary:
        'Notification of Change in the Register of Directors, Managers and Secretaries reflecting the current Board of Directors and appointed Company Secretary.',
    },
    {
      fileId: 'alpha-doc-sec78',
      fileName: 'Section_78_Return_of_Allotment_Shares.pdf',
      statutorySection: 'Section 78',
      category: 'Share Capital',
      lastUpdated: '2024-08-10T11:05:00.000Z',
      fileSizeKB: 276,
      summary:
        'Return of Allotment of Shares confirming share capital issuance and updated issued and paid-up ordinary share capital.',
    },
    {
      fileId: 'alpha-doc-sec68',
      fileName: 'Section_68_Annual_Return_2025.pdf',
      statutorySection: 'Section 68',
      category: 'Annual Compliance',
      lastUpdated: '2025-06-01T16:40:00.000Z',
      fileSizeKB: 540,
      summary:
        'Annual Return of a Company Having a Share Capital lodged with SSM for the 2025 anniversary date.',
    },
    {
      fileId: 'alpha-doc-sec32',
      fileName: 'Company_Constitution_AlphaTech.pdf',
      statutorySection: 'Section 32',
      category: 'Constitution',
      lastUpdated: '2023-05-12T10:45:00.000Z',
      fileSizeKB: 892,
      summary:
        'Adopted Company Constitution under Section 32 of the Companies Act 2016 (formerly Memorandum & Articles of Association).',
    },
  ],
  '9Z8Y7X6W5V4U3T2S1R0Q_BETA': [
    {
      fileId: 'beta-doc-sec14',
      fileName: 'Section_14_Superform_BetaLogistics.pdf',
      statutorySection: 'Section 14',
      category: 'Incorporation',
      lastUpdated: '2021-03-15T08:45:00.000Z',
      fileSizeKB: 465,
      summary:
        'Application for Registration of a Company (Superform) for Beta Logistics (M) Sdn. Bhd. lodged under Section 14 of the Companies Act 2016.',
    },
    {
      fileId: 'beta-doc-sec17',
      fileName: 'Section_17_Cert_Of_Incorp_BetaLogistics.pdf',
      statutorySection: 'Section 17',
      category: 'Incorporation',
      lastUpdated: '2021-03-15T09:10:00.000Z',
      fileSizeKB: 198,
      summary:
        'Certificate of Incorporation of Private Company issued by Suruhanjaya Syarikat Malaysia (SSM).',
    },
    {
      fileId: 'beta-doc-sec58',
      fileName: 'Section_58_Directors_Change_2025.pdf',
      statutorySection: 'Section 58',
      category: 'Directors & Officers',
      lastUpdated: '2025-11-20T15:00:00.000Z',
      fileSizeKB: 294,
      summary:
        'Notification of Change in the Register of Directors, Managers and Secretaries lodged in November 2025.',
    },
  ],
  '5M6E7R8I9D0I1A2N3C4A_MERIDIAN': [
    {
      fileId: 'meridian-doc-sec14',
      fileName: 'Section_14_Superform_MeridianCapital.pdf',
      statutorySection: 'Section 14',
      category: 'Incorporation',
      lastUpdated: '2019-09-04T09:00:00.000Z',
      fileSizeKB: 512,
      summary: 'Application for Registration of Meridian Capital Holdings Sdn. Bhd.',
    },
    {
      fileId: 'meridian-doc-sec51',
      fileName: 'Section_51_Register_of_Members_2026.pdf',
      statutorySection: 'Section 51',
      category: 'Share Capital',
      lastUpdated: '2026-01-12T10:30:00.000Z',
      fileSizeKB: 360,
      summary: 'Updated Register of Members reflecting current shareholding structure.',
    },
  ],
};

export function isUsingMockDrive(): boolean {
  if (process.env.USE_MOCK_DRIVE === 'true') return true;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_PRIVATE_KEY?.trim();
  return !email || !key;
}

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
    throw new Error('Google Drive Service Account credentials are not configured.');
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
  if (isUsingMockDrive()) {
    const docs = MOCK_DRIVE_FOLDERS[driveFolderId] ?? [];
    return docs.map(({ summary: _summary, ...doc }) => doc);
  }

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
    .filter((f): f is { id: string; name: string; modifiedTime?: string | null; size?: string | null } =>
      Boolean(f.id && f.name),
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

async function generateDemoStatutoryPdf(
  company: RegistryCompany,
  doc: SeedDocument,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const navy = rgb(15 / 255, 23 / 255, 42 / 255);
  const slate = rgb(71 / 255, 85 / 255, 105 / 255);
  const muted = rgb(100 / 255, 116 / 255, 139 / 255);
  const emerald = rgb(5 / 255, 150 / 255, 105 / 255);
  const line = rgb(226 / 255, 232 / 255, 240 / 255);

  // Header band
  page.drawRectangle({
    x: 0,
    y: height - 110,
    width,
    height: 110,
    color: navy,
  });

  page.drawText('COSEC VAULT  |  STATUTORY DOCUMENT EXTRACT', {
    x: 48,
    y: height - 46,
    size: 10,
    font: fontBold,
    color: rgb(148 / 255, 163 / 255, 184 / 255),
  });

  page.drawText('COMPANIES ACT 2016 (MALAYSIA)', {
    x: 48,
    y: height - 74,
    size: 18,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('Suruhanjaya Syarikat Malaysia (SSM) Statutory Repository Copy', {
    x: 48,
    y: height - 94,
    size: 10,
    font: fontRegular,
    color: rgb(203 / 255, 213 / 255, 225 / 255),
  });

  // Document Section & Title
  let y = height - 156;
  page.drawText(doc.statutorySection.toUpperCase(), {
    x: 48,
    y,
    size: 11,
    font: fontBold,
    color: emerald,
  });

  y -= 24;
  page.drawText(doc.fileName.replace(/\.pdf$/i, '').replace(/_/g, ' '), {
    x: 48,
    y,
    size: 16,
    font: fontBold,
    color: navy,
  });

  y -= 18;
  page.drawLine({
    start: { x: 48, y },
    end: { x: width - 48, y },
    thickness: 1,
    color: line,
  });

  // Metadata rows
  const formattedDate = new Date(doc.lastUpdated).toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const rows: Array<[string, string]> = [
    ['Company Name', company.companyName],
    ['SSM Registration No.', company.registrationNo],
    ['Statutory Provision', `${doc.statutorySection} — Companies Act 2016`],
    ['Filing Category', doc.category],
    ['Source Filename', doc.fileName],
    ['Last Updated Date', formattedDate],
    ['Vault Reference ID', doc.fileId],
  ];

  y -= 28;
  for (const [label, value] of rows) {
    page.drawText(label, {
      x: 48,
      y,
      size: 10,
      font: fontBold,
      color: muted,
    });
    page.drawText(value, {
      x: 200,
      y,
      size: 10,
      font: label === 'SSM Registration No.' || label === 'Vault Reference ID' ? fontMono : fontRegular,
      color: navy,
    });
    y -= 24;
  }

  y -= 12;
  page.drawLine({
    start: { x: 48, y },
    end: { x: width - 48, y },
    thickness: 1,
    color: line,
  });

  // Summary block
  y -= 28;
  page.drawText('DOCUMENT SUMMARY', {
    x: 48,
    y,
    size: 10,
    font: fontBold,
    color: muted,
  });

  y -= 20;
  const words = doc.summary.split(' ');
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (fontRegular.widthOfTextAtSize(testLine, 11) > width - 96) {
      page.drawText(currentLine, {
        x: 48,
        y,
        size: 11,
        font: fontRegular,
        color: slate,
      });
      y -= 17;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    page.drawText(currentLine, {
      x: 48,
      y,
      size: 11,
      font: fontRegular,
      color: slate,
    });
    y -= 28;
  }

  // Certification Notice Box
  page.drawRectangle({
    x: 48,
    y: y - 76,
    width: width - 96,
    height: 76,
    color: rgb(248 / 255, 250 / 255, 252 / 255),
    borderColor: line,
    borderWidth: 1,
  });

  page.drawText('CERTIFIED TRUE COPY (CTC) NOTICE', {
    x: 64,
    y: y - 24,
    size: 9.5,
    font: fontBold,
    color: navy,
  });

  page.drawText(
    'This digital copy is retrieved from your company statutory vault for reference and review.',
    {
      x: 64,
      y: y - 42,
      size: 9.5,
      font: fontRegular,
      color: slate,
    },
  );
  page.drawText(
    'For bank account openings or tenders requiring wet-ink CoSec certification, use "Request CTC" in CoSec Vault.',
    {
      x: 64,
      y: y - 58,
      size: 9.5,
      font: fontRegular,
      color: slate,
    },
  );

  // Footer
  page.drawLine({
    start: { x: 48, y: 64 },
    end: { x: width - 48, y: 64 },
    thickness: 0.75,
    color: line,
  });
  page.drawText(
    `Generated via CoSec Vault Secure Proxy  ·  Authorized Entity: ${company.companyName}`,
    {
      x: 48,
      y: 44,
      size: 8.5,
      font: fontRegular,
      color: muted,
    },
  );

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function getDownloadableFile(
  company: RegistryCompany,
  fileId: string,
): Promise<
  | { kind: 'buffer'; fileName: string; buffer: Buffer }
  | { kind: 'stream'; fileName: string; stream: Readable }
  | null
> {
  if (isUsingMockDrive()) {
    const folderDocs = MOCK_DRIVE_FOLDERS[company.driveFolderId] ?? [];
    const targetDoc = folderDocs.find((d) => d.fileId === fileId);
    if (!targetDoc) {
      return null;
    }
    const buffer = await generateDemoStatutoryPdf(company, targetDoc);
    return { kind: 'buffer', fileName: targetDoc.fileName, buffer };
  }

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
