import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type AuditActionType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'VAULT_VISIT'
  | 'DOCUMENT_DOWNLOAD'
  | 'CTC_WHATSAPP_REQUEST'
  | 'MISSING_FORM_REQUEST'
  | 'FILE_UPLOAD'
  | 'FILE_RENAME'
  | 'FILE_DELETE'
  | 'USER_REGISTERED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'PASSWORD_CHANGED'
  | 'EMAIL_NOTIFICATION_SENT'
  | 'AUTO_LOGOUT_INACTIVITY';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO 8601 UTC timestamp
  userEmail: string;
  userName: string;
  userRole: 'administrator' | 'manager' | 'user';
  action: AuditActionType;
  companyName?: string;
  myCoId?: string;
  documentName?: string;
  details?: string;
  ipAddress?: string;
}

const AUDIT_FILE = path.join(process.cwd(), 'data', 'audit_logs.json');

export function readAuditLogs(): AuditLogEntry[] {
  try {
    if (!fs.existsSync(AUDIT_FILE)) {
      const initial = { logs: [] };
      fs.mkdirSync(path.dirname(AUDIT_FILE), { recursive: true });
      fs.writeFileSync(AUDIT_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(AUDIT_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data.logs) ? data.logs : [];
  } catch {
    return [];
  }
}

export function writeAuditLogs(logs: AuditLogEntry[]): void {
  try {
    fs.mkdirSync(path.dirname(AUDIT_FILE), { recursive: true });
    fs.writeFileSync(
      AUDIT_FILE,
      JSON.stringify({ logs }, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.error('Failed to write audit logs:', err);
  }
}

export function recordAuditEvent(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
): AuditLogEntry {
  const logs = readAuditLogs();
  const newEntry: AuditLogEntry = {
    id: `aud_${crypto.randomBytes(6).toString('hex')}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  logs.push(newEntry);
  writeAuditLogs(logs);
  return newEntry;
}
