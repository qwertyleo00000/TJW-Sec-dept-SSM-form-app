import 'dotenv/config';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import express from 'express';
import path from 'path';
import type { MissingFormSubmission } from './src/types.ts';
import {
  clearSessionCookie,
  createSessionToken,
  issueOtpForEmail,
  requireAuth,
  setSessionCookie,
  verifyOtpForEmail,
} from './server/auth.ts';
import type { AuthenticatedRequest } from './server/auth.ts';
import { getDownloadableFile, listDocumentsForFolder } from './server/drive.ts';
import { searchCompanyDocumentsWithGemini } from './server/gemini.ts';
import {
  findUserByEmail,
  getAuthorizedCompany,
  toPublicCompanies,
} from './server/registry.ts';

const PORT = Number(process.env.PORT ?? 3000);
const COSEC_WHATSAPP_NUMBER =
  (process.env.COSEC_WHATSAPP_NUMBER ?? '601136768398').replace(/\D/g, '') ||
  '601136768398';

const missingFormRequests: MissingFormSubmission[] = [];

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // 1. POST /api/auth/request-otp
  app.post('/api/auth/request-otp', (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    if (!email) {
      res.status(400).json({ error: 'Please enter your registered corporate email address.' });
      return;
    }

    const user = findUserByEmail(email);
    if (!user) {
      res.status(403).json({
        error:
          'This email address is not registered in the CoSec Vault Client Access Registry. Please contact your Company Secretary.',
      });
      return;
    }

    const issued = issueOtpForEmail(user.email);
    res.json({
      message: `A 6-digit verification code has been dispatched to ${user.email}.`,
      email: user.email,
      fullName: user.fullName,
      expiresInSeconds: issued.expiresInSeconds,
      ...(issued.isDemo ? { demoOtp: issued.code } : {}),
    });
  });

  // 2. POST /api/auth/verify-otp
  app.post('/api/auth/verify-otp', (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';

    if (!email || !otp) {
      res.status(400).json({ error: 'Both email address and 6-digit OTP are required.' });
      return;
    }

    const user = findUserByEmail(email);
    if (!user) {
      res.status(403).json({ error: 'Email not authorized in Client Access Registry.' });
      return;
    }

    const validOtp = verifyOtpForEmail(user.email, otp);
    if (!validOtp) {
      res.status(401).json({
        error: 'Invalid or expired verification code. Please check the 6-digit OTP and try again.',
      });
      return;
    }

    const token = createSessionToken(user.email);
    setSessionCookie(req, res, token);

    res.json({
      user: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      authorizedCompanies: toPublicCompanies(user.authorizedCompanies),
      cosecWhatsappNumber: COSEC_WHATSAPP_NUMBER,
      token,
    });
  });

  // Session inspection & logout
  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    res.json({
      user: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      authorizedCompanies: toPublicCompanies(user.authorizedCompanies),
      cosecWhatsappNumber: COSEC_WHATSAPP_NUMBER,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ success: true });
  });

  // 3. GET /api/companies/:companyId/documents
  app.get(
    '/api/companies/:companyId/documents',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const companyId = String(req.params.companyId);
        const access = getAuthorizedCompany(req.authUser!.email, companyId);
        if (!access) {
          res.status(403).json({
            error: 'Access denied. You are not authorized to access documents for this company.',
          });
          return;
        }

        const documents = await listDocumentsForFolder(access.company.driveFolderId);
        res.json({
          company: {
            companyId: access.company.companyId,
            companyName: access.company.companyName,
            registrationNo: access.company.registrationNo,
          },
          documents,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to load statutory documents.';
        res.status(500).json({ error: message });
      }
    },
  );

  // 4. POST /api/companies/:companyId/ai-search
  app.post(
    '/api/companies/:companyId/ai-search',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const companyId = String(req.params.companyId);
        const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';

        if (!query) {
          res.status(400).json({ error: 'Please enter a question or describe the statutory form you need.' });
          return;
        }

        const access = getAuthorizedCompany(req.authUser!.email, companyId);
        if (!access) {
          res.status(403).json({
            error: 'Access denied. You are not authorized to query this company vault.',
          });
          return;
        }

        // Strict tenant isolation: load ONLY this company's verified document metadata
        const documents = await listDocumentsForFolder(access.company.driveFolderId);
        const aiResult = await searchCompanyDocumentsWithGemini(
          access.company.companyName,
          documents,
          query,
        );

        res.json(aiResult);
      } catch (err) {
        console.error('Gemini AI search error:', err);
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to reach Gemini AI assistant. Please try again shortly.';
        res.status(502).json({ error: message });
      }
    },
  );

  // 5. GET /api/companies/:companyId/download/:fileId
  app.get(
    '/api/companies/:companyId/download/:fileId',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const companyId = String(req.params.companyId);
        const fileId = String(req.params.fileId);

        const access = getAuthorizedCompany(req.authUser!.email, companyId);
        if (!access) {
          res.status(403).json({
            error: 'Access denied. You are not authorized to download files for this company.',
          });
          return;
        }

        const file = await getDownloadableFile(access.company, fileId);
        if (!file) {
          res.status(404).json({
            error: 'Document not found within your authorized company vault.',
          });
          return;
        }

        const sanitizedFileName = file.fileName.replace(/["\r\n]/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${sanitizedFileName}"`,
        );
        res.setHeader('Cache-Control', 'private, no-store');

        if (file.kind === 'buffer') {
          res.setHeader('Content-Length', String(file.buffer.length));
          res.send(file.buffer);
          return;
        }

        file.stream.on('error', (streamErr) => {
          console.error('PDF stream error:', streamErr);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed while streaming PDF document.' });
          } else {
            res.end();
          }
        });
        file.stream.pipe(res);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to download statutory PDF.';
        res.status(500).json({ error: message });
      }
    },
  );

  // 6. POST /api/companies/:companyId/missing-request (in-app missing form ticket)
  app.post(
    '/api/companies/:companyId/missing-request',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const companyId = String(req.params.companyId);
      const access = getAuthorizedCompany(req.authUser!.email, companyId);
      if (!access) {
        res.status(403).json({ error: 'Access denied for this company.' });
        return;
      }

      const formName =
        typeof req.body?.formName === 'string' ? req.body.formName.trim() : '';
      const notes =
        typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';

      if (!formName) {
        res.status(400).json({ error: 'Please specify the statutory form or resolution needed.' });
        return;
      }

      const submission: MissingFormSubmission = {
        id: `REQ-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        companyId: access.company.companyId,
        companyName: access.company.companyName,
        formName,
        notes,
        submittedAt: new Date().toISOString(),
      };

      missingFormRequests.unshift(submission);
      res.status(201).json({ submission });
    },
  );

  // Vite middleware in development, static dist serving in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CoSec Vault server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CoSec Vault server:', err);
  process.exit(1);
});
