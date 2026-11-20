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
  hashPassword,
  removeActiveSession,
  requireAuth,
  requireRole,
  setSessionCookie,
  validatePasswordStrength,
  verifyPassword,
} from './server/auth.ts';
import type { AuthenticatedRequest } from './server/auth.ts';
import {
  deleteFile,
  getDownloadableFile,
  listDocumentsForFolder,
  renameFile,
  uploadFileToFolder,
} from './server/drive.ts';
import {
  sendRecoveryEmail,
  sendRegistrationEmails,
  sendAccountApprovedEmail,
  sendNewDocumentUploadedEmails,
} from './server/mailer.ts';
import { searchCompanyDocumentsWithGemini } from './server/gemini.ts';
import {
  deleteUser,
  findUserByEmail,
  getAllAccessibleCompanies,
  getAllUsers,
  getAuthorizedCompany,
  loadRegistry,
  registerUser,
  saveRegistry,
  upsertUser,
} from './server/registry.ts';
import { recordAuditEvent, readAuditLogs } from './server/audit.ts';

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

  // 1. Authentication & Registration APIs
  app.post('/api/auth/login', async (req, res) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!email || !password) {
        res.status(400).json({ error: 'Email address and password are required.' });
        return;
      }

      const user = findUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: 'Invalid email address or password.' });
        return;
      }

      if (user.status === 'pending') {
        res.status(403).json({
          error:
            'Your account registration is pending verification by our Company Secretary department.',
        });
        return;
      }

      const isValid = verifyPassword(password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ error: 'Invalid email address or password.' });
        return;
      }

      const token = createSessionToken(user.email);
      setSessionCookie(req, res, token);

      recordAuditEvent({
        userEmail: user.email,
        userName: user.fullName,
        userRole: user.role,
        action: 'LOGIN',
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
      });

      res.json({
        ok: true,
        user: {
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status,
          companies: user.companies,
        },
        authorizedCompanies: await getAllAccessibleCompanies(user),
        cosecWhatsappNumber: COSEC_WHATSAPP_NUMBER,
        token,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const fullName =
        typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const confirmPassword =
        typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';
      const companyName =
        typeof req.body?.companyName === 'string' ? req.body.companyName.trim() : '';
      const myCoId =
        typeof req.body?.myCoId === 'string' ? req.body.myCoId.trim() : '';

      if (!fullName || !email || !password || !confirmPassword || !companyName || !myCoId) {
        res.status(400).json({
          error: 'All registration fields are required.',
        });
        return;
      }

      if (password !== confirmPassword) {
        res.status(400).json({ error: 'Passwords do not match.' });
        return;
      }

      const strength = validatePasswordStrength(password);
      if (!strength.valid) {
        res.status(400).json({ error: strength.message });
        return;
      }

      const existing = findUserByEmail(email);
      if (existing) {
        res.status(409).json({
          error: 'An account with this email address already exists. Please sign in.',
        });
        return;
      }

      const passwordHash = hashPassword(password);
      const newUser = registerUser({
        fullName,
        email,
        passwordHash,
        companyName,
        myCoId,
      });

      try {
        await sendRegistrationEmails(newUser, getAllUsers(), companyName, myCoId);
      } catch (mailErr) {
        console.error('Failed to send registration emails:', mailErr);
      }

      recordAuditEvent({
        userEmail: email,
        userName: fullName,
        userRole: 'user',
        action: 'USER_REGISTERED',
        companyName,
        myCoId,
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
      });

      res.status(201).json({
        message: 'Registration submitted successfully. Pending Company Secretary verification.',
        user: newUser,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed.';
      res.status(400).json({ error: message });
    }
  });

  // Forgot Password
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!email) {
        res.status(400).json({ error: 'Email address is required.' });
        return;
      }

      const user = findUserByEmail(email);
      if (user && user.status === 'active') {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = Date.now() + 1000 * 60 * 30; // 30 mins

        upsertUser({
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status,
          passwordHash: user.passwordHash,
          companies: user.companies,
          requestedCompany: user.requestedCompany,
        });

        const registry = await import('./server/registry.ts');
        const reg = registry.loadRegistry();
        const idx = reg.users.findIndex((u: { email: string }) => u.email.toLowerCase() === email);
        if (idx >= 0) {
          reg.users[idx].recoveryToken = { tokenHash, expiresAt };
          registry.saveRegistry(reg);
        }

        await sendRecoveryEmail(user.email, rawToken);
      }

      res.json({
        message: 'If an active account exists for that email, recovery instructions have been sent.',
      });
    } catch (err) {
      res.json({
        message: 'If an active account exists for that email, recovery instructions have been sent.',
      });
    }
  });

  // Reset Password
  app.post('/api/auth/reset-password', (req, res) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const recoveryToken = typeof req.body?.recoveryToken === 'string' ? req.body.recoveryToken.trim() : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      const confirmPassword = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

      if (!email || !recoveryToken || !newPassword || !confirmPassword) {
        res.status(400).json({ error: 'All fields are required.' });
        return;
      }

      if (newPassword !== confirmPassword) {
        res.status(400).json({ error: 'Passwords do not match.' });
        return;
      }

      const strength = validatePasswordStrength(newPassword);
      if (!strength.valid) {
        res.status(400).json({ error: strength.message });
        return;
      }

      const user = findUserByEmail(email);
      if (!user || !user.recoveryToken) {
        res.status(400).json({ error: 'Invalid or expired recovery token.' });
        return;
      }

      if (Date.now() > user.recoveryToken.expiresAt) {
        res.status(400).json({ error: 'Recovery token has expired. Please request a new one.' });
        return;
      }

      const providedHash = crypto.createHash('sha256').update(recoveryToken).digest('hex');
      if (
        providedHash.length !== user.recoveryToken.tokenHash.length ||
        !crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(user.recoveryToken.tokenHash))
      ) {
        res.status(400).json({ error: 'Invalid recovery token.' });
        return;
      }

      const passwordHash = hashPassword(newPassword);
      upsertUser({
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        passwordHash,
        companies: user.companies,
        requestedCompany: user.requestedCompany,
      });

      const registry = require('./server/registry.ts');
      const reg = registry.loadRegistry();
      const idx = reg.users.findIndex((u: { email: string }) => u.email.toLowerCase() === email);
      if (idx >= 0) {
        reg.users[idx].passwordHash = passwordHash;
        delete reg.users[idx].recoveryToken;
        registry.saveRegistry(reg);
      }

      res.json({ message: 'Password has been reset successfully. You can now sign in.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password reset failed.';
      res.status(400).json({ error: message });
    }
  });

  // Change Password (Logged-in user)
  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const user = req.authUser!;
      const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      const confirmPassword = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

      if (!currentPassword || !newPassword || !confirmPassword) {
        res.status(400).json({ error: 'All password fields are required.' });
        return;
      }

      const isValid = verifyPassword(currentPassword, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ error: 'Current password is incorrect.' });
        return;
      }

      if (newPassword !== confirmPassword) {
        res.status(400).json({ error: 'New passwords do not match.' });
        return;
      }

      const strength = validatePasswordStrength(newPassword);
      if (!strength.valid) {
        res.status(400).json({ error: strength.message });
        return;
      }

      const passwordHash = hashPassword(newPassword);
      const registry = require('./server/registry.ts');
      const reg = registry.loadRegistry();
      const idx = reg.users.findIndex((u: { email: string }) => u.email.toLowerCase() === user.email.toLowerCase());
      if (idx >= 0) {
        reg.users[idx].passwordHash = passwordHash;
        registry.saveRegistry(reg);
      }

      recordAuditEvent({
        userEmail: user.email,
        userName: user.fullName,
        userRole: user.role,
        action: 'PASSWORD_CHANGED',
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
      });

      res.json({ message: 'Password changed successfully.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change password.';
      res.status(400).json({ error: message });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    res.json({
      user: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        companies: user.companies,
      },
      authorizedCompanies: await getAllAccessibleCompanies(user),
      cosecWhatsappNumber: COSEC_WHATSAPP_NUMBER,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    try {
      const token =
        req.cookies?.cosec_vault_session ||
        req.cookies?.cosec_vault_auth_token ||
        req.headers.authorization?.replace(/^Bearer\s+/i, '');
      const reason =
        typeof req.body?.reason === 'string' ? req.body.reason : 'manual';
      if (token) {
        removeActiveSession(
          token,
          reason as any,
          req.ip || (req.headers['x-forwarded-for'] as string),
        );
      }
    } catch {}
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
        const company = await getAuthorizedCompany(user, myCoId);
        if (!company) {
          res.status(403).json({
            error: 'Access denied. You are not authorized to access documents for this company.',
          });
          return;
        }

        const documents = listDocumentsForFolder(company.myCoId);
        recordAuditEvent({
          userEmail: user.email,
          userName: user.fullName,
          userRole: user.role,
          action: 'VAULT_VISIT',
          companyName: company.companyName,
          myCoId: company.myCoId,
          ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
        });

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
        const company = await getAuthorizedCompany(user, myCoId);
        if (!company) {
          res.status(403).json({
            error: 'Access denied. You are not authorized to query this company vault.',
          });
          return;
        }

        const documents = listDocumentsForFolder(company.myCoId);
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
        const company = await getAuthorizedCompany(user, myCoId);
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

        recordAuditEvent({
          userEmail: user.email,
          userName: user.fullName,
          userRole: user.role,
          action: 'DOCUMENT_DOWNLOAD',
          companyName: company.companyName,
          myCoId: company.myCoId,
          documentName: file.fileName,
          ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
        });

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
        const file = req.file;
        const myCoId = typeof req.body?.myCoId === 'string' ? req.body.myCoId.trim() : '';
        const companyName = typeof req.body?.companyName === 'string' ? req.body.companyName.trim() : myCoId;

        if (!file) {
          res.status(400).json({ error: 'Please select a PDF file to upload.' });
          return;
        }
        if (!myCoId) {
          res.status(400).json({ error: 'Company registration number (MyCoID) is required.' });
          return;
        }

        const document = await uploadFileToFolder(myCoId, file.buffer, file.originalname);
        const company = { myCoId, companyName };
        const notifiedCount = await sendNewDocumentUploadedEmails(
          company,
          document,
          getAllUsers(),
          req.authUser!.email,
        );

        recordAuditEvent({
          userEmail: req.authUser!.email,
          userName: req.authUser!.fullName,
          userRole: req.authUser!.role,
          action: 'FILE_UPLOAD',
          companyName,
          myCoId,
          documentName: document.fileName,
          details: `Uploaded ${document.fileName} and notified ${notifiedCount} user(s).`,
          ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
        });

        res.status(201).json({
          success: true,
          document,
          notifiedCount,
          message: `Uploaded ${document.fileName} and notified ${notifiedCount} registered user(s) for ${companyName}.`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'File upload failed.';
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
        const myCoId = typeof req.body?.myCoId === 'string' ? req.body.myCoId.trim() : '';
        const newFileName = typeof req.body?.newFileName === 'string' ? req.body.newFileName.trim() : '';

        if (!myCoId || !newFileName) {
          res.status(400).json({ error: 'Company MyCoID and new filename are required.' });
          return;
        }

        await renameFile(myCoId, fileId, newFileName);
        recordAuditEvent({
          userEmail: req.authUser!.email,
          userName: req.authUser!.fullName,
          userRole: req.authUser!.role,
          action: 'FILE_RENAME',
          myCoId,
          documentName: newFileName,
          ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
        });

        res.json({ success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Rename failed.';
        res.status(400).json({ error: message });
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
        const myCoId =
          typeof req.query.myCoId === 'string'
            ? req.query.myCoId.trim()
            : typeof req.body?.myCoId === 'string'
              ? req.body.myCoId.trim()
              : '';

        if (!myCoId) {
          res.status(400).json({ error: 'Company MyCoID is required.' });
          return;
        }

        await deleteFile(myCoId, fileId);
        recordAuditEvent({
          userEmail: req.authUser!.email,
          userName: req.authUser!.fullName,
          userRole: req.authUser!.role,
          action: 'FILE_DELETE',
          myCoId,
          documentName: fileId,
          ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
        });

        res.json({ success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Delete failed.';
        res.status(400).json({ error: message });
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
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const fullName =
        typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
      const role = typeof req.body?.role === 'string' ? req.body.role.trim() : 'user';
      const status = typeof req.body?.status === 'string' ? req.body.status.trim() : 'active';
      const companies = Array.isArray(req.body?.companies) ? req.body.companies : [];
      const newPassword = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!email || !fullName) {
        res.status(400).json({ error: 'Email and full name are required.' });
        return;
      }

      if (caller.role === 'manager' && role !== 'user') {
        res.status(403).json({ error: 'Managers can only create or manage standard user accounts.' });
        return;
      }

      let passwordHash: string | undefined = undefined;
      if (newPassword) {
        const strength = validatePasswordStrength(newPassword);
        if (!strength.valid) {
          res.status(400).json({ error: strength.message });
          return;
        }
        passwordHash = hashPassword(newPassword);
      }

      const existing = findUserByEmail(email);
      const updated = upsertUser({
        email,
        fullName,
        role: role as any,
        status: status as any,
        passwordHash: passwordHash ?? existing?.passwordHash,
        companies,
        requestedCompany: existing?.requestedCompany,
      });

      recordAuditEvent({
        userEmail: caller.email,
        userName: caller.fullName,
        userRole: caller.role,
        action: 'USER_REGISTERED',
        details: `Created / Upserted user account: ${email} (Role: ${role})`,
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
      });

      res.status(201).json({ user: updated });
    },
  );

  app.patch(
    '/api/admin/users/:email',
    requireAuth,
    requireRole('administrator', 'manager'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const caller = req.authUser!;
        const targetEmail = decodeURIComponent(req.params.email).trim().toLowerCase();
        const existing = findUserByEmail(targetEmail);

        if (!existing) {
          res.status(404).json({ error: 'User not found in registry.' });
          return;
        }

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
        const status =
          typeof req.body?.status === 'string' ? req.body.status.trim() : existing.status;
        const companies = Array.isArray(req.body?.companies)
          ? req.body.companies
          : existing.companies;
        const newPassword = typeof req.body?.password === 'string' ? req.body.password : '';

        if (caller.role === 'manager' && role !== 'user') {
          res.status(403).json({ error: 'Managers cannot assign manager or administrator roles.' });
          return;
        }

        let passwordHash = existing.passwordHash;
        if (newPassword) {
          const strength = validatePasswordStrength(newPassword);
          if (!strength.valid) {
            res.status(400).json({ error: strength.message });
            return;
          }
          passwordHash = hashPassword(newPassword);
        }

        const updated = upsertUser({
          email: targetEmail,
          fullName,
          role: role as any,
          status: status as any,
          passwordHash,
          companies,
          requestedCompany: existing.requestedCompany,
        });

        if (existing.status === 'pending' && updated.status === 'active') {
          try {
            await sendAccountApprovedEmail(updated);
          } catch (mailErr) {
            console.error('Failed to send account approval email:', mailErr);
          }
        }

        recordAuditEvent({
          userEmail: caller.email,
          userName: caller.fullName,
          userRole: caller.role,
          action: 'USER_UPDATED',
          details: `Updated user account: ${targetEmail} (Role: ${role}, Status: ${status})`,
          ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
        });

        res.json({ user: updated });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update user.';
        res.status(400).json({ error: message });
      }
    },
  );

  // Missing Form Request
  app.post(
    '/api/companies/:myCoId/missing-request',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const myCoId = String(req.params.myCoId);
      const user = req.authUser!;
      const company = await getAuthorizedCompany(user, myCoId);
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

      recordAuditEvent({
        userEmail: user.email,
        userName: user.fullName,
        userRole: user.role,
        action: 'MISSING_FORM_REQUEST',
        companyName: company.companyName,
        myCoId: company.myCoId,
        documentName: formName,
        details: notes || undefined,
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
      });

      res.status(201).json({ submission });
    },
  );

  // 5. Activity & Audit Trail APIs
  app.post('/api/audit/ctc-click', requireAuth, async (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const myCoId = typeof req.body?.myCoId === 'string' ? req.body.myCoId.trim() : '';
    const documentName = typeof req.body?.documentName === 'string' ? req.body.documentName.trim() : '';
    const companyName = typeof req.body?.companyName === 'string' ? req.body.companyName.trim() : undefined;
    const company = await getAuthorizedCompany(user, myCoId);

    recordAuditEvent({
      userEmail: user.email,
      userName: user.fullName,
      userRole: user.role,
      action: 'CTC_WHATSAPP_REQUEST',
      companyName: company ? company.companyName : companyName,
      myCoId: myCoId || undefined,
      documentName: documentName || undefined,
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
    });
    res.json({ success: true });
  });

  function formatMalaysiaTime(isoString: string): string {
    try {
      const date = new Date(isoString);
      return (
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Kuala_Lumpur',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(date) + ' MYT'
      );
    } catch {
      return isoString;
    }
  }

  app.get('/api/audit/logs', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const user = req.authUser!;
      const logs = readAuditLogs();

      const emailFilter = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
      const myCoIdFilter = typeof req.query.myCoId === 'string' ? req.query.myCoId.trim().toLowerCase() : '';
      const actionFilter = typeof req.query.action === 'string' ? req.query.action.trim().toUpperCase() : '';
      const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate.trim() : '';
      const toDate = typeof req.query.toDate === 'string' ? req.query.toDate.trim() : '';

      let filtered = [...logs];

      if (user.role === 'user') {
        const allowedActions = [
          'LOGIN',
          'LOGOUT',
          'VAULT_VISIT',
          'DOCUMENT_DOWNLOAD',
          'CTC_WHATSAPP_REQUEST',
          'MISSING_FORM_REQUEST',
          'PASSWORD_CHANGED',
        ];
        filtered = filtered.filter(
          (l) =>
            l.userEmail.toLowerCase() === user.email.toLowerCase() &&
            allowedActions.includes(l.action)
        );
      } else {
        if (emailFilter) {
          filtered = filtered.filter((l) => l.userEmail.toLowerCase().includes(emailFilter));
        }
        if (myCoIdFilter) {
          filtered = filtered.filter((l) => l.myCoId && l.myCoId.toLowerCase().includes(myCoIdFilter));
        }
        if (actionFilter) {
          filtered = filtered.filter((l) => l.action === actionFilter);
        }
        if (fromDate) {
          const fromMs = new Date(fromDate).getTime();
          if (!isNaN(fromMs)) {
            filtered = filtered.filter((l) => new Date(l.timestamp).getTime() >= fromMs);
          }
        }
        if (toDate) {
          const toMs = new Date(toDate).getTime() + 86399999;
          if (!isNaN(toMs)) {
            filtered = filtered.filter((l) => new Date(l.timestamp).getTime() <= toMs);
          }
        }
      }

      filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({ logs: filtered });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load audit logs.';
      res.status(500).json({ error: message });
    }
  });

  app.get(
    '/api/audit/export.csv',
    (req, res, next) => {
      const token = typeof req.query.token === 'string' ? req.query.token : undefined;
      if (token && !req.headers.authorization) {
        req.headers.authorization = `Bearer ${token}`;
      }
      next();
    },
    requireAuth,
    requireRole('administrator', 'manager'),
    (req: AuthenticatedRequest, res) => {
      try {
        const logs = readAuditLogs();
        const emailFilter = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
        const myCoIdFilter = typeof req.query.myCoId === 'string' ? req.query.myCoId.trim().toLowerCase() : '';
        const actionFilter = typeof req.query.action === 'string' ? req.query.action.trim().toUpperCase() : '';
        const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate.trim() : '';
        const toDate = typeof req.query.toDate === 'string' ? req.query.toDate.trim() : '';

        let filtered = [...logs];
        if (emailFilter) {
          filtered = filtered.filter((l) => l.userEmail.toLowerCase().includes(emailFilter));
        }
        if (myCoIdFilter) {
          filtered = filtered.filter((l) => l.myCoId && l.myCoId.toLowerCase().includes(myCoIdFilter));
        }
        if (actionFilter) {
          filtered = filtered.filter((l) => l.action === actionFilter);
        }
        if (fromDate) {
          const fromMs = new Date(fromDate).getTime();
          if (!isNaN(fromMs)) {
            filtered = filtered.filter((l) => new Date(l.timestamp).getTime() >= fromMs);
          }
        }
        if (toDate) {
          const toMs = new Date(toDate).getTime() + 86399999;
          if (!isNaN(toMs)) {
            filtered = filtered.filter((l) => new Date(l.timestamp).getTime() <= toMs);
          }
        }

        filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const headers = [
          'Timestamp (ISO)',
          'Timestamp (Malaysia Time)',
          'User Name',
          'User Email',
          'Role',
          'Action',
          'Company Name',
          'SSM No. (myCoId)',
          'Document Name',
          'Details',
          'IP Address',
        ];

        const escapeCsv = (val: string | undefined) => {
          if (val == null) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        };

        const rows = filtered.map((l) => [
          escapeCsv(l.timestamp),
          escapeCsv(formatMalaysiaTime(l.timestamp)),
          escapeCsv(l.userName),
          escapeCsv(l.userEmail),
          escapeCsv(l.userRole),
          escapeCsv(l.action),
          escapeCsv(l.companyName),
          escapeCsv(l.myCoId),
          escapeCsv(l.documentName),
          escapeCsv(l.details),
          escapeCsv(l.ipAddress),
        ]);

        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const todayStr = new Date().toISOString().slice(0, 10);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="cosec-audit-trail-${todayStr}.csv"`);
        res.send(csvContent);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to export CSV.';
        res.status(500).json({ error: message });
      }
    }
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
    console.log(`CoSec Vault Auth Token server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CoSec Vault server:', err);
  process.exit(1);
});
