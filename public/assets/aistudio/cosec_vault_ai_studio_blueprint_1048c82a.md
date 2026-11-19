# Project Blueprint: CoSec Vault — Corporate Statutory Document Portal

**Target Platform:** Google AI Studio (Build Mode) / Full-Stack TypeScript (React + Node.js/Next.js)  
**Primary AI Model:** `gemini-3-flash-preview` (with Structured JSON Outputs)  
**Domain:** Malaysian Corporate Secretarial Services (Companies Act 2016 / SSM)  

---

## 1. Executive Summary & Objective

Build **CoSec Vault**, a secure, multi-tenant self-service web application for a Malaysian Company Secretary (CoSec) firm.

* **Business Goal:** Eliminate repetitive client emails asking for statutory forms by allowing authorized clients/directors to view, search (using plain English via Gemini), download their company's latest SSM statutory PDFs directly, and request Certified True Copies (CTC) via a one-click WhatsApp button.
* **File Sync Context:** The CoSec team maintains and updates client PDFs on a local office server, which automatically mirrors to a restricted, private Google Drive repository organized by company folder.
* **WhatsApp CTC Integration:** Clients can click a **"Request CTC"** button on any document to immediately launch a pre-filled WhatsApp message to the CoSec team (`+60 11-3676 8398`) for manual certification and signing.

---

## 2. Critical Security & Multi-Tenant Isolation Rules

**MANDATORY ARCHITECTURAL CONSTRAINTS:**

1. **Strict Tenant Isolation:** A logged-in client MUST ONLY view, query, or download files inside the specific Google Drive Folder ID(s) explicitly mapped to their authenticated email address.
2. **Backend-Enforced Filtering:** Never pass Google Drive Folder IDs from the frontend URL or client state without verifying them against the authenticated user's session and access registry on the server side.
3. **Zero Cross-Company Leakage:** When invoking Gemini 3 Flash, the system prompt and context window MUST ONLY receive the file metadata (`fileId`, `fileName`, `lastModified`, `mimeType`) of the *currently active* company folder belonging to the logged-in user.
4. **Proxy Downloads (IDOR Prevention):** Do not expose raw, publicly shareable Google Drive links. Stream file downloads through an authenticated backend endpoint (`/api/companies/:companyId/download/:fileId`) that verifies the `fileId` resides inside the user's authorized `driveFolderId` before serving the PDF.
5. **Multi-Company Director Support:** A single client email (e.g., a serial entrepreneur or group CFO) may be authorized for multiple Sdn. Bhd. entities. The UI must support switching between authorized companies seamlessly.

---

## 3. System Architecture & Tech Stack

* **Frontend:** React (TypeScript), Tailwind CSS, Lucide Icons (Clean, corporate fintech/legal aesthetic: slate, deep navy `#0F172A`, emerald `#059669` badges, and WhatsApp green `#25D366` accents for CTC requests).
* **Backend / API Layer:** Node.js / Express (or Next.js App Router API routes) deployable to Google Cloud Run.
* **Authentication:** Email + 6-digit One-Time Passcode (OTP) or Google OAuth 2.0, validated against the **Client Access Registry**.
* **Storage Integration:** Google Drive API v3 (using a Service Account with Read-Only access to the root `CoSec_Clients` mirrored folder).
* **AI Engine:** `@google/genai` SDK using `gemini-3-flash-preview` with Structured Outputs (`responseSchema`).

---

## 4. Data Models & Client Access Registry

### A. Client Access Registry (`registry.json` / Firestore / Google Sheet)

Maps authenticated client emails to one or more Malaysian corporate entities:

```json
{
  "users": [
    {
      "email": "director@alphatrading.com.my",
      "fullName": "Tan Sri Ahmad Razak",
      "role": "Director",
      "authorizedCompanies": [
        {
          "companyId": "alpha-tech",
          "companyName": "ALPHA TECH SOLUTIONS SDN. BHD.",
          "registrationNo": "202301018899 (1512345-A)",
          "driveFolderId": "1A2B3C4D5E6F7G8H9I0J_ALPHA"
        },
        {
          "companyId": "beta-logistics",
          "companyName": "BETA LOGISTICS (M) SDN. BHD.",
          "registrationNo": "202101004422 (1401122-K)",
          "driveFolderId": "9Z8Y7X6W5V4U3T2S1R0Q_BETA"
        }
      ]
    }
  ]
}
```

### B. Statutory Document Metadata Object

Returned by the backend after querying Google Drive API for the active `driveFolderId`:

```typescript
export interface StatutoryDocument {
  fileId: string;
  fileName: string;
  statutorySection: string; // e.g., "Section 14", "Section 58", "Section 17"
  category: "Incorporation" | "Directors & Officers" | "Share Capital" | "Annual Compliance" | "Constitution" | "Other";
  lastUpdated: string; // ISO 8601 date string
  fileSizeKB: number;
}
```

### C. Built-In Demo Seed Data (For Immediate AI Studio Preview)

Include realistic Malaysian corporate mock data out-of-the-box when `USE_MOCK_DRIVE=true` (or when Google Drive credentials are not yet configured) so the entire flow works immediately in AI Studio preview:

* **Demo User:** `director@alphatrading.com.my` (Name: `Tan Sri Ahmad Razak`, Demo OTP: `123456`)
* **Company 1:** `ALPHA TECH SOLUTIONS SDN. BHD.` (`202301018899 (1512345-A)`)
  * `Section_14_Superform_AlphaTech_2023.pdf` (Section 14 | Incorporation | 2023-05-12)
  * `Section_17_Certificate_of_Incorporation_AlphaTech.pdf` (Section 17 | Incorporation | 2023-05-12)
  * `Section_58_Register_of_Directors_Latest_2026.pdf` (Section 58 | Directors & Officers | 2026-02-18)
  * `Section_78_Return_of_Allotment_Shares.pdf` (Section 78 | Share Capital | 2024-08-10)
  * `Section_68_Annual_Return_2025.pdf` (Section 68 | Annual Compliance | 2025-06-01)
  * `Company_Constitution_AlphaTech.pdf` (Section 32 | Constitution | 2023-05-12)
* **Company 2:** `BETA LOGISTICS (M) SDN. BHD.` (`202101004422 (1401122-K)`)
  * `Section_14_Superform_BetaLogistics.pdf` (Section 14 | Incorporation | 2021-03-15)
  * `Section_17_Cert_Of_Incorp_BetaLogistics.pdf` (Section 17 | Incorporation | 2021-03-15)
  * `Section_58_Directors_Change_2025.pdf` (Section 58 | Directors & Officers | 2025-11-20)

---

## 5. Malaysian Companies Act 2016 Domain Knowledge (For AI Mapping)

Configure the Gemini 3 Flash assistant to understand standard Malaysian SSM (Suruhanjaya Syarikat Malaysia) terminology and map plain-English client queries to official forms:

* **Section 14 (Superform):** Application for Registration of a Company (Company profile, initial directors, shareholders, registered address, business nature).
* **Section 17:** Certificate of Incorporation of Private Company (Business registration certificate, birth certificate of the company).
* **Section 58:** Notification of Change in the Register of Directors, Managers and Secretaries (Current director list, appointment/resignation of directors or CoSec).
* **Section 78:** Return of Allotment of Shares (Share issuance, paid-up capital increase).
* **Section 51:** Register of Members (Shareholder list, shareholding percentages).
* **Section 46:** Notification of Change in the Registered Address.
* **Section 68:** Annual Return of a Company Having a Share Capital.
* **Section 32 / Constitution:** Company Constitution (formerly Memorandum & Articles of Association / M&A).
* **Board Resolutions / Minutes:** Certified True Copy (CTC) resolutions (e.g., Bank Account Opening Resolution).

---

## 6. Built-In WhatsApp CTC (Certified True Copy) Request Feature

Clients frequently require physical or scanned copies of statutory forms **Certified True Copy (CTC)** signed by the Company Secretary (for bank account openings, loan applications, government tenders, or licensing).

### 6.1 Functional Specification
* **Button Placement:** Render a **"Request CTC"** button alongside the **"Download PDF"** button on **every row** of the Statutory Document Table AND on **every matched document card** returned by the Gemini AI assistant.
* **Visual Styling:** Secondary button styled with a subtle WhatsApp green border/icon (`#25D366` / `MessageCircle` or WhatsApp SVG icon) labeled **"Request CTC"**.
* **Target WhatsApp Number:** `601136768398` (Malaysian international format for `011-36768398`).
* **Click Behavior:**
  1. Dynamically construct a URL-encoded WhatsApp message pre-filled with the active company's exact details, document name, statutory section, and logged-in client details.
  2. Open `https://wa.me/601136768398?text=<ENCODED_MESSAGE>` in a new browser tab (`target="_blank"`, `rel="noopener noreferrer"`).
  3. Display a brief toast confirmation in the portal: *"Opening WhatsApp to send your CTC request to our Company Secretary team..."*

### 6.2 Exact WhatsApp Message Template

```text
Hello CoSec Team, I would like to request a Certified True Copy (CTC) signed by the Company Secretary for the following document:

*Company Name:* [ACTIVE_COMPANY_NAME]
*SSM Reg No:* [ACTIVE_REGISTRATION_NO]
*Document:* [DOCUMENT_NAME] ([STATUTORY_SECTION])
*Requested By:* [CLIENT_FULL_NAME] ([CLIENT_EMAIL])

Please let me know once it is ready for collection/delivery. Thank you!
```

*(Implementation Note: Always wrap the entire message string with `encodeURIComponent(...)` before appending it to `https://wa.me/601136768398?text=`.)*

---

## 7. UI/UX Screen Specifications

### Screen 1: Secure Client Login
* Minimalist, high-trust corporate login card centered on screen with **CoSec Vault** branding.
* Input field: **Registered Corporate Email Address**.
* Flow: User enters email $\rightarrow$ Backend validates email against `Client Access Registry` $\rightarrow$ Sends 6-digit OTP (in prototype/demo mode, display a mock OTP helper banner `Demo Code: 123456` and a quick one-click demo login button so testing works immediately) $\rightarrow$ Verifies and issues secure HTTP-only session cookie/token.

### Screen 2: Main Client Vault Dashboard
1. **Top Navigation Bar:**
   * Brand Logo: **CoSec Vault** (subtitle: *Corporate Secretarial Portal*).
   * **Company Switcher Dropdown:** Displays active `Company Name` and `SSM Registration No.`. Allows instant switching if the user is linked to multiple companies (switching reloads the document list and resets AI search results).
   * User Profile & **Logout** button.

2. **Gemini AI Smart Concierge (Hero Search & Assistant Panel):**
   * Prominent prompt input: *"Ask for any form in plain English... e.g., 'I need our latest director list and incorporation cert for bank account opening'"*
   * Quick-action suggestion chips:
     * `"Bank Opening Pack (Sec 14, 17, 58)"`
     * `"Latest Director List (Sec 58)"`
     * `"Shareholder & Capital Info (Sec 51 / 78)"`
     * `"Incorporation Certificate (Sec 17)"`
   * **AI Response Area:** Displays Gemini's concise explanation of which forms match the request, alongside direct document cards containing **both** **"Download PDF"** and **"Request CTC"** buttons. If a requested form is missing from the folder, displays a **"Request Missing Form via WhatsApp"** button.

3. **Categorized Statutory Document Table:**
   * Filter tabs: `All Documents`, `Incorporation`, `Directors & Officers`, `Share Capital`, `Annual Compliance`, `Constitution`.
   * Columns:
     * **Document Name** (PDF icon + clean filename)
     * **SSM Section Badge** (e.g., `Section 58`)
     * **Category**
     * **Last Updated** (formatted date)
     * **Actions:**
       * Primary Button: **"Download PDF"** (triggers authenticated download with loading spinner state)
       * Secondary Button: **"Request CTC"** (opens pre-filled WhatsApp message to `601136768398`)

4. **Missing Document Request Footer / Modal:**
   * Allows the client to request a form not yet listed in their vault either via an in-app request modal or a pre-filled WhatsApp inquiry to `601136768398`.

---

## 8. Backend API Endpoints Specification

Implement the following REST endpoints:

1. `POST /api/auth/request-otp` — Validates email against `Client Access Registry`.
2. `POST /api/auth/verify-otp` — Authenticates user, sets session cookie/JWT, and returns `user` + `authorizedCompanies`.
3. `GET /api/companies/:companyId/documents` — Verifies user owns `companyId`, fetches PDF files from `driveFolderId` via Google Drive API v3 (or mock seed data if `USE_MOCK_DRIVE=true`), auto-categorizes them by SSM section, and returns `StatutoryDocument[]`.
4. `POST /api/companies/:companyId/ai-search` —
   * **Input:** `{ query: string }`
   * **Process:** Fetches the verified `StatutoryDocument[]` for `companyId`, sends ONLY that company's file list + user `query` to `gemini-3-flash-preview` using Structured JSON Output.
   * **Output:** `{ explanation: string, matchedFileIds: string[], missingForms: string[] }`.
5. `GET /api/companies/:companyId/download/:fileId` — Verifies `fileId` belongs to `companyId`'s `driveFolderId`, streams the PDF binary with `Content-Disposition: attachment` (in demo mode, generates/streams a clean placeholder PDF with the document title and company details so download testing works end-to-end).

---

## 9. Gemini 3 Flash System Instruction & Structured Schema

Use this exact configuration for the `/api/companies/:companyId/ai-search` endpoint:

**System Instruction:**
```text
You are the CoSec Vault AI Assistant for a Malaysian Company Secretary firm. 
Your role is to help an authenticated company director or officer locate the exact SSM statutory PDFs from their company's secure digital vault.

Rules:
1. Analyze the user's plain-English request and map it to Malaysian Companies Act 2016 forms (Section 14, 17, 58, 78, 51, 46, 68, 32/Constitution, Resolutions).
2. Inspect ONLY the provided JSON array of available files in this company's folder.
3. Return the exact `fileId`s of all matching documents in `matchedFileIds`.
4. If the user asks for a standard statutory form that is NOT present in the available files list, list its name in `missingForms` so the user can request it from their Company Secretary.
5. Keep `explanation` brief, polite, professional, and clear. Never mention or speculate about any other company.
```

**Response JSON Schema (`responseSchema`):**
```json
{
  "type": "OBJECT",
  "properties": {
    "explanation": {
      "type": "STRING",
      "description": "Concise, helpful summary explaining which statutory forms match the client's request."
    },
    "matchedFileIds": {
      "type": "ARRAY",
      "items": { "type": "STRING" },
      "description": "Exact fileId values from the provided company folder list that satisfy the request."
    },
    "missingForms": {
      "type": "ARRAY",
      "items": { "type": "STRING" },
      "description": "Names of requested statutory forms that are not currently available in the folder."
    }
  },
  "required": ["explanation", "matchedFileIds", "missingForms"]
}
```

---

## 10. Environment Variables & Deployment Guide

Include a `.env.example` and `SETUP_GUIDE.md` in the generated codebase documenting:
* `GEMINI_API_KEY`: API key from Google AI Studio.
* `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Service account email given "Viewer" access to the mirrored Google Drive root folder.
* `GOOGLE_PRIVATE_KEY`: Service account private key.
* `COSEC_WHATSAPP_NUMBER`: `601136768398`
* `USE_MOCK_DRIVE`: `true` (for immediate AI Studio preview) / `false` (for live Google Drive sync in production).