import 'dotenv/config';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import express from 'express';
import multer from 'multer';
import path from 'path';
import type { MissingFormSubmission } from './src/types.ts';
import {
  clearSessionCookie,
  createSessionToken,
  issueOtpForEmail,
  requireAuth,
  requireRole,
  setSessionCookie,
  verifyOtpForEmail,
} from './server/auth.ts';
import type { AuthenticatedRequest } from './server/auth.ts';
import {
  deleteFile,
  getDownloadableFile,
  listDocumentsForFolder,
  renameFile,
  uploadFileToFolder,
} from './server/drive.ts';
import { searchCompanyDocumentsWithGemini } from './server/gemini.ts';
import {
  deleteUser,
  findUserByEmail,
  getAllAccessibleCompanies,
  getAllUsers,
  getAuthorizedCompany,
  upsertUser,
} from './server/registry.ts';

const PORT = Number(process.env.PORT ?? 3000);
const COSEC_WHATSAPP_NUMBER =
  (process.env.COSEC_WHATSAPP_NUMBER ?? '601136768398').replace(/\D/g, '') ||
  '601136768398';

const missingFormRequests: MissingFormSubmission[] = [];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max PDF
});

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // 1. Auth APIs
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
    });
  });

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
        companies: user.companies,
      },
      authorizedCompanies: getAllAccessibleCompanies(user),
      cosecWhatsappNumber: COSEC_WHATSAPP_NUMBER,
      token,
    });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    res.json({
      user: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companies: user.companies,
      },
      authorizedCompanies: getAllAccessibleCompanies(user),
      cosecWhatsappNumber: COSEC_WHATSAPP_NUMBER,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ success: true });
  });

  // 2. Vault Document APIs
  app.get(
    '/api/companies/:myCoId/documents',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const myCoId = String(req.params.myCoId);
        const user = req.authUser!;
        const company = getAuthorizedCompany(user, myCoId);
        if (!company) {
          res.status(403).json({
            error: 'Access denied. You are not authorized to access documents for this company.',
          });
          return;
        }

        const documents = await listDocumentsForFolder(company.driveFolderId);
        res.json({
          company: {
            myCoId: company.myCoId,
            companyName: company.companyName,
            registrationNo: company.myCoId,
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

  app.post(
    '/api/companies/:myCoId/ai-search',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const myCoId = String(req.params.myCoId);
        const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';

        if (!query) {
          res.status(400).json({ error: 'Please enter a question or describe the statutory form you need.' });
          return;
        }

        const user = req.authUser!;
        const company = getAuthorizedCompany(user, myCoId);
        if (!company) {
          res.status(403).json({
            error: 'Access denied. You are not authorized to query this company vault.',
          });
          return;
        }

        const documents = await listDocumentsForFolder(company.driveFolderId);
        const aiResult = await searchCompanyDocumentsWithGemini(
          company.companyName,
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

  app.get(
    '/api/companies/:myCoId/download/:fileId',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const myCoId = String(req.params.myCoId);
        const fileId = String(req.params.fileId);

        const user = req.authUser!;
        const company = getAuthorizedCompany(user, myCoId);
        if (!company) {
          res.status(403).json({
            error: 'Access denied. You are not authorized to download files for this company.',
          });
          return;
        }

        const file = await getDownloadableFile(company, fileId);
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

  // 3. Admin & Manager File Management Routes
  app.post(
    '/api/admin/files/upload',
    requireAuth,
    requireRole('administrator', 'manager'),
    upload.single('file'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const myCoId = typeof req.body?.myCoId === 'string' ? req.body.myCoId.trim() : '';
        const file = req.file;

        if (!myCoId || !file) {
          res.status(400).json({ error: 'Company ID and PDF file are required for upload.' });
          return;
        }

        const user = req.authUser!;
        const company = getAuthorizedCompany(user, myCoId);
        if (!company) {
          res.status(403).json({ error: 'Access denied to target company folder.' });
          return;
        }

        const newDoc = await uploadFileToFolder(
          company.driveFolderId,
          file.buffer,
          file.originalname || 'Statutory_Filing.pdf',
          file.mimetype || 'application/pdf',
        );

        res.status(201).json({ document: newDoc });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to upload statutory document.';
        res.status(500).json({ error: message });
      }
    },
  );

  app.patch(
    '/api/admin/files/:fileId',
    requireAuth,
    requireRole('administrator', 'manager'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const fileId = String(req.params.fileId);
        const newFileName =
          typeof req.body?.newFileName === 'string'
            ? req.body.newFileName.trim()
            : '';

        if (!newFileName) {
          res.status(400).json({ error: 'New file name is required.' });
          return;
        }

        await renameFile(fileId, newFileName);
        res.json({ success: true });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to rename statutory document.';
        res.status(500).json({ error: message });
      }
    },
  );

  app.delete(
    '/api/admin/files/:fileId',
    requireAuth,
    requireRole('administrator', 'manager'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const fileId = String(req.params.fileId);
        await deleteFile(fileId);
        res.json({ success: true });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete statutory document.';
        res.status(500).json({ error: message });
      }
    },
  );

  // 4. User & Access Rights Management APIs
  app.get(
    '/api/admin/users',
    requireAuth,
    requireRole('administrator', 'manager'),
    (req: AuthenticatedRequest, res) => {
      const users = getAllUsers();
      res.json({ users });
    },
  );

  app.post(
    '/api/admin/users',
    requireAuth,
    requireRole('administrator', 'manager'),
    (req: AuthenticatedRequest, res) => {
      const caller = req.authUser!;
      const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
      const fullName =
        typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
      const role = typeof req.body?.role === 'string' ? req.body.role.trim() : 'user';
      const companies = Array.isArray(req.body?.companies) ? req.body.companies : [];

      if (!email || !fullName) {
        res.status(400).json({ error: 'Email and full name are required.' });
        return;
      }

      if (role !== 'user' && role !== 'manager' && role !== 'administrator') {
        res.status(400).json({ error: 'Invalid role specified.' });
        return;
      }

      // If caller is manager, they can only create/manage 'user' accounts
      if (caller.role === 'manager' && role !== 'user') {
        res.status(403).json({ error: 'Managers can only create or manage standard user accounts.' });
        return;
      }

      const updated = upsertUser({ email, fullName, role, companies });
      res.status(201).json({ user: updated });
    },
  );

  app.patch(
    '/api/admin/users/:email',
    requireAuth,
    requireRole('administrator', 'manager'),
    (req: AuthenticatedRequest, res) => {
      const caller = req.authUser!;
      const targetEmail = decodeURIComponent(req.params.email).trim().toLowerCase();
      const existing = findUserByEmail(targetEmail);

      if (!existing) {
        res.status(404).json({ error: 'User not found in registry.' });
        return;
      }

      // If caller is manager, they cannot modify managers or administrators
      if (caller.role === 'manager' && existing.role !== 'user') {
        res.status(403).json({ error: 'Managers cannot modify administrator or manager accounts.' });
        return;
      }

      const fullName =
        typeof req.body?.fullName === 'string'
          ? req.body.fullName.trim()
          : existing.fullName;
      const role =
        typeof req.body?.role === 'string' ? req.body.role.trim() : existing.role;
      const companies = Array.isArray(req.body?.companies)
        ? req.body.companies
        : existing.companies;

      if (caller.role === 'manager' && role !== 'user') {
        res.status(403).json({ error: 'Managers cannot assign manager or administrator roles.' });
        return;
      }

      const updated = upsertUser({ email: targetEmail, fullName, role, companies });
      res.json({ user: updated });
    },
  );

  app.delete(
    '/api/admin/users/:email',
    requireAuth,
    requireRole('administrator', 'manager'),
    (req: AuthenticatedRequest, res) => {
      const caller = req.authUser!;
      const targetEmail = decodeURIComponent(req.params.email).trim().toLowerCase();
      const existing = findUserByEmail(targetEmail);

      if (!existing) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      if (caller.role === 'manager' && existing.role !== 'user') {
        res.status(403).json({ error: 'Managers can only delete standard user accounts.' });
        return;
      }

      if (caller.email.toLowerCase() === targetEmail) {
        res.status(400).json({ error: 'You cannot delete your own account.' });
        return;
      }

      const success = deleteUser(targetEmail);
      if (!success) {
        res.status(404).json({ error: 'User could not be deleted.' });
        return;
      }

      res.json({ success: true });
    },
  );

  // Missing Form Request
  app.post(
    '/api/companies/:myCoId/missing-request',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const myCoId = String(req.params.myCoId);
      const user = req.authUser!;
      const company = getAuthorizedCompany(user, myCoId);
      if (!company) {
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
        companyId: company.myCoId,
        companyName: company.companyName,
        formName,
        notes,
        submittedAt: new Date().toISOString(),
      };

      missingFormRequests.unshift(submission);
      res.status(201).json({ submission });
    },
  );

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
    console.log(`CoSec Vault RBAC server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CoSec Vault server:', err);
  process.exit(1);
});
