import { GoogleGenAI, Type } from '@google/genai';
import type { AiSearchResponse, StatutoryDocument } from '../src/types.ts';

const SYSTEM_INSTRUCTION = `You are the CoSec Vault AI Assistant for a Malaysian Company Secretary firm. 
Your role is to help an authenticated company director or officer locate the exact SSM statutory PDFs from their company's secure digital vault.

Malaysian Companies Act 2016 (SSM) Reference Mapping:
- Section 14 (Superform): Application for Registration of a Company (Company profile, initial directors, shareholders, registered address, business nature).
- Section 17: Certificate of Incorporation of Private Company (Business registration certificate, birth certificate of the company).
- Section 58: Notification of Change in the Register of Directors, Managers and Secretaries (Current director list, appointment/resignation of directors or CoSec).
- Section 78: Return of Allotment of Shares (Share issuance, paid-up capital increase).
- Section 51: Register of Members (Shareholder list, shareholding percentages).
- Section 46: Notification of Change in the Registered Address.
- Section 68: Annual Return of a Company Having a Share Capital.
- Section 32 / Constitution: Company Constitution (formerly Memorandum & Articles of Association / M&A).
- Board Resolutions / Minutes: Certified True Copy (CTC) resolutions (e.g., Bank Account Opening Resolution).

Rules:
1. Analyze the user's plain-English request and map it to Malaysian Companies Act 2016 forms (Section 14, 17, 58, 78, 51, 46, 68, 32/Constitution, Resolutions).
2. Inspect ONLY the provided JSON array of available files in this company's folder.
3. Return the exact \`fileId\`s of all matching documents in \`matchedFileIds\`.
4. If the user asks for a standard statutory form that is NOT present in the available files list, list its name in \`missingForms\` so the user can request it from their Company Secretary.
5. Keep \`explanation\` brief, polite, professional, and clear. Never mention or speculate about any other company.`;

let cachedClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Please configure your API key in Settings > Secrets.',
    );
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export async function searchCompanyDocumentsWithGemini(
  companyName: string,
  documents: StatutoryDocument[],
  query: string,
): Promise<AiSearchResponse> {
  const ai = getGeminiClient();

  // Strictly scope context window to ONLY the active company's verified metadata
  const scopedFileList = documents.map((doc) => ({
    fileId: doc.fileId,
    fileName: doc.fileName,
    statutorySection: doc.statutorySection,
    category: doc.category,
    lastModified: doc.lastUpdated,
    mimeType: 'application/pdf',
  }));

  const userPrompt = `Active Company: ${companyName}

Available files in this company's secure vault:
${JSON.stringify(scopedFileList, null, 2)}

Client Request:
"${query.trim()}"`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: userPrompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          explanation: {
            type: Type.STRING,
            description:
              "Concise, helpful summary explaining which statutory forms match the client's request.",
          },
          matchedFileIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              'Exact fileId values from the provided company folder list that satisfy the request.',
          },
          missingForms: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              'Names of requested statutory forms that are not currently available in the folder.',
          },
        },
        required: ['explanation', 'matchedFileIds', 'missingForms'],
      },
    },
  });

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error('Gemini returned an empty response. Please try your query again.');
  }

  const parsed = JSON.parse(rawText) as Partial<AiSearchResponse>;

  // Defense-in-depth: strictly filter matchedFileIds against this company's verified file IDs
  const allowedIds = new Set(documents.map((d) => d.fileId));
  const verifiedMatchedIds = Array.isArray(parsed.matchedFileIds)
    ? Array.from(new Set(parsed.matchedFileIds.filter((id) => allowedIds.has(id))))
    : [];

  const missingForms = Array.isArray(parsed.missingForms)
    ? parsed.missingForms.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
    : [];

  return {
    explanation:
      typeof parsed.explanation === 'string' && parsed.explanation.trim().length > 0
        ? parsed.explanation.trim()
        : 'Here are the matching statutory documents found in your company vault.',
    matchedFileIds: verifiedMatchedIds,
    missingForms,
  };
}
