# CoSec Vault — Setup & Deployment Guide

**CoSec Vault** is a multi-tenant corporate secretarial statutory document portal designed for Malaysian Company Secretary (CoSec) firms operating under the **Companies Act 2016 (SSM)**.

---

## 1. Quick Start (Demo / Preview Mode)

By default (`USE_MOCK_DRIVE=true` or when Google Drive Service Account credentials are not configured), CoSec Vault loads realistic Malaysian corporate seed data immediately:

- **Demo Email:** `director@alphatrading.com.my`
- **Demo Director:** Tan Sri Ahmad Razak
- **Demo OTP Code:** `123456`
- **Authorized Companies:**
  1. `ALPHA TECH SOLUTIONS SDN. BHD.` — `202301018899 (1512345-A)` (6 SSM filings)
  2. `BETA LOGISTICS (M) SDN. BHD.` — `202101004422 (1401122-K)` (3 SSM filings)

---

## 2. Environment Variables

Configure the following environment variables in your deployment environment (e.g., Google Cloud Run secrets or `.env` locally):

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Google AI Studio API key used server-side with `gemini-3-flash-preview` for plain-English SSM form mapping. |
| `USE_MOCK_DRIVE` | No (default `true`) | Set to `false` in production to list and stream real PDFs from Google Drive API v3. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | When `USE_MOCK_DRIVE=false` | Google Cloud Service Account email granted **Viewer** (Read-Only) access to the root `CoSec_Clients` folder. |
| `GOOGLE_PRIVATE_KEY` | When `USE_MOCK_DRIVE=false` | Private key string from the Service Account JSON key (preserve `\n` escapes). |
| `COSEC_WHATSAPP_NUMBER` | No (default `601136768398`) | Malaysian WhatsApp number in international digits-only format for CTC requests (`+60 11-3676 8398`). |
| `SESSION_SECRET` | Recommended in production | HMAC secret used to sign authenticated HTTP-only session tokens. |

---

## 3. Connecting Live Google Drive Mirror

1. In Google Cloud Console, enable the **Google Drive API**.
2. Create a **Service Account** and generate a JSON key.
3. Share your office-mirrored root folder (`CoSec_Clients`) or individual company folders with `GOOGLE_SERVICE_ACCOUNT_EMAIL` using **Viewer (Read-Only)** permission.
4. Update `data/registry.json` with each authorized director's corporate email and their mapped `driveFolderId` values.
5. Set `USE_MOCK_DRIVE=false`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_PRIVATE_KEY`.

---

## 4. Security & Multi-Tenant Isolation Model

- **Server-Side Registry Enforcement:** `driveFolderId` values are never exposed to the browser. Every `/api/companies/:companyId/*` request verifies the authenticated user's session and checks ownership in `data/registry.json`.
- **Zero Cross-Company AI Leakage:** `/api/companies/:companyId/ai-search` sends strictly the active company's verified document metadata to `gemini-3-flash-preview`.
- **IDOR-Proof Proxy Downloads:** `/api/companies/:companyId/download/:fileId` verifies that `fileId` belongs inside the company's authorized `driveFolderId` before streaming the PDF binary with `Content-Disposition: attachment`.

---

## 5. Production Deployment (Google Cloud Run)

```bash
npm install
npm run build
npm start
```

The server listens on `PORT` (default `3000`) and serves both the `/api/*` backend and the compiled React SPA from `dist/`.
