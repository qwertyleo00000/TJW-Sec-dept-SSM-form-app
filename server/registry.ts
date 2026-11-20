import fs from 'fs';
import path from 'path';
import type {
  AuthenticatedUser,
  CompanyAssignment,
  RequestedCompanyInfo,
  UserRole,
  UserStatus,
} from '../src/types.ts';
import { hashPassword } from './auth.ts';
import { normalizeMyCoId } from './drive.ts';

export interface RegistryUser extends AuthenticatedUser {
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  passwordHash: string;
  recoveryToken?: {
    tokenHash: string;
    expiresAt: number;
  };
  companies: CompanyAssignment[];
  requestedCompany?: RequestedCompanyInfo;
}

interface RegistryFile {
  users: RegistryUser[];
}

const REGISTRY_PATH = path.resolve(process.cwd(), 'data', 'registry.json');

export function loadRegistry(): RegistryFile {
  try {
    if (!fs.existsSync(REGISTRY_PATH)) {
      const initial: RegistryFile = { users: [] };
      fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
      fs.writeFileSync(REGISTRY_PATH, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
    const data = JSON.parse(raw) as RegistryFile;
    if (!data || !Array.isArray(data.users)) {
      return { users: [] };
    }
    const defaultPasswordHash = hashPassword('Mycorporate50');
    data.users = data.users.map((u) => ({
      ...u,
      status: u.status === 'pending' ? 'pending' : 'active',
      passwordHash:
        u.passwordHash && u.passwordHash.includes(':')
          ? u.passwordHash
          : defaultPasswordHash,
      companies: Array.isArray(u.companies)
        ? u.companies.map((c) => ({
            myCoId: c.myCoId?.trim() || '',
            companyName: c.companyName?.trim() || c.myCoId?.trim() || 'Company',
          }))
        : [],
    }));
    return data;
  } catch {
    return { users: [] };
  }
}

export function saveRegistry(registry: RegistryFile): void {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  const tempPath = `${REGISTRY_PATH}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(registry, null, 2), 'utf-8');
  fs.renameSync(tempPath, REGISTRY_PATH);
}

export function bootstrapAdmin(): void {
  const adminEmails = ['qwertyleo00000@gmail.com'];
  const envAdmin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (envAdmin && !adminEmails.includes(envAdmin)) {
    adminEmails.push(envAdmin);
  }

  const registry = loadRegistry();
  let modified = false;
  const defaultPasswordHash = hashPassword('Mycorporate50');

  for (const adminEmail of adminEmails) {
    const existingIndex = registry.users.findIndex(
      (u) => u.email.trim().toLowerCase() === adminEmail,
    );

    if (existingIndex >= 0) {
      const existing = registry.users[existingIndex];
      let needsUpdate = false;
      const updatedUser = { ...existing };

      if (existing.role !== 'administrator') {
        updatedUser.role = 'administrator';
        needsUpdate = true;
      }
      if (existing.status !== 'active') {
        updatedUser.status = 'active';
        needsUpdate = true;
      }
      if (!existing.passwordHash || !existing.passwordHash.includes(':')) {
        updatedUser.passwordHash = defaultPasswordHash;
        needsUpdate = true;
      }

      if (needsUpdate) {
        registry.users[existingIndex] = updatedUser;
        modified = true;
      }
    } else {
      registry.users.push({
        email: adminEmail,
        fullName: 'Administrator',
        role: 'administrator',
        status: 'active',
        passwordHash: defaultPasswordHash,
        companies: [],
      });
      modified = true;
    }
  }

  if (modified) {
    saveRegistry(registry);
    console.log('[CoSec Vault] Bootstrap administrator accounts verified and seeded.');
  }
}

export function findUserByEmail(email: string): RegistryUser | null {
  bootstrapAdmin();
  const normalized = email.trim().toLowerCase();
  const registry = loadRegistry();
  return (
    registry.users.find((u) => u.email.trim().toLowerCase() === normalized) ??
    null
  );
}

export function getAllUsers(): RegistryUser[] {
  bootstrapAdmin();
  const registry = loadRegistry();
  return registry.users;
}

export function registerUser(userData: {
  email: string;
  fullName: string;
  passwordHash: string;
  companyName: string;
  myCoId: string;
}): RegistryUser {
  bootstrapAdmin();
  const registry = loadRegistry();
  const normalizedEmail = userData.email.trim().toLowerCase();

  const existing = registry.users.find(
    (u) => u.email.trim().toLowerCase() === normalizedEmail,
  );
  if (existing) {
    throw new Error('An account with this email address already exists.');
  }

  const cleanMyCoId = userData.myCoId.trim();
  const cleanCompanyName = userData.companyName.trim();

  const newUser: RegistryUser = {
    email: normalizedEmail,
    fullName: userData.fullName.trim(),
    role: 'user',
    status: 'pending',
    passwordHash: userData.passwordHash,
    companies: [
      {
        myCoId: cleanMyCoId,
        companyName: cleanCompanyName,
      },
    ],
    requestedCompany: {
      companyName: cleanCompanyName,
      myCoId: cleanMyCoId,
    },
  };

  registry.users.push(newUser);
  saveRegistry(registry);
  return newUser;
}

export function upsertUser(userData: {
  email: string;
  fullName: string;
  role: UserRole;
  status?: UserStatus;
  passwordHash?: string;
  companies: CompanyAssignment[];
  requestedCompany?: RequestedCompanyInfo;
}): RegistryUser {
  const registry = loadRegistry();
  const normalizedEmail = userData.email.trim().toLowerCase();
  const existingIdx = registry.users.findIndex(
    (u) => u.email.trim().toLowerCase() === normalizedEmail,
  );

  const existing = existingIdx >= 0 ? registry.users[existingIdx] : null;
  const defaultPasswordHash = hashPassword('Mycorporate50');

  const role = userData.role;
  // Administrators and managers have empty companies array since they access all companies
  const companies =
    role === 'administrator' || role === 'manager'
      ? []
      : Array.isArray(userData.companies)
        ? userData.companies.map((c) => ({
            myCoId: c.myCoId.trim(),
            companyName: c.companyName.trim() || c.myCoId.trim(),
          }))
        : existing?.companies ?? [];

  const cleaned: RegistryUser = {
    email: normalizedEmail,
    fullName: userData.fullName.trim() || 'Valued User',
    role,
    status: userData.status ?? existing?.status ?? 'active',
    passwordHash:
      userData.passwordHash ?? existing?.passwordHash ?? defaultPasswordHash,
    companies,
    requestedCompany:
      userData.requestedCompany !== undefined
        ? userData.requestedCompany
        : existing?.requestedCompany,
  };

  if (existingIdx >= 0) {
    registry.users[existingIdx] = cleaned;
  } else {
    registry.users.push(cleaned);
  }

  saveRegistry(registry);
  return cleaned;
}

export function deleteUser(email: string): boolean {
  const registry = loadRegistry();
  const normalized = email.trim().toLowerCase();
  const initialLength = registry.users.length;
  registry.users = registry.users.filter(
    (u) => u.email.trim().toLowerCase() !== normalized,
  );
  if (registry.users.length !== initialLength) {
    saveRegistry(registry);
    return true;
  }
  return false;
}

export async function getAuthorizedCompany(
  user: RegistryUser,
  myCoId: string,
): Promise<CompanyAssignment | null> {
  const accessible = await getAllAccessibleCompanies(user);
  const norm = normalizeMyCoId(myCoId);
  return accessible.find((c) => normalizeMyCoId(c.myCoId) === norm) ?? null;
}

export async function getAllAccessibleCompanies(
  user: RegistryUser,
): Promise<CompanyAssignment[]> {
  const registry = loadRegistry();
  const map = new Map<string, CompanyAssignment>();

  // Collect companies from all registered users
  for (const u of registry.users) {
    if (Array.isArray(u.companies)) {
      for (const c of u.companies) {
        if (c.myCoId) {
          map.set(c.myCoId, {
            myCoId: c.myCoId,
            companyName: c.companyName || c.myCoId,
          });
        }
      }
    }
    if (u.requestedCompany?.myCoId) {
      const rId = u.requestedCompany.myCoId;
      if (!map.has(rId)) {
        map.set(rId, {
          myCoId: rId,
          companyName: u.requestedCompany.companyName || rId,
        });
      }
    }
  }

  // Also scan data/uploads directory for any local folders
  try {
    const uploadsDir = path.resolve(process.cwd(), 'data', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const subdirs = fs.readdirSync(uploadsDir, { withFileTypes: true });
      for (const sub of subdirs) {
        if (sub.isDirectory()) {
          const myCoId = sub.name;
          if (!map.has(myCoId)) {
            map.set(myCoId, {
              myCoId,
              companyName: myCoId.replace(/_/g, ' '),
            });
          }
        }
      }
    }
  } catch {}

  if (user.role === 'administrator' || user.role === 'manager') {
    return Array.from(map.values()).sort((a, b) =>
      a.companyName.localeCompare(b.companyName, undefined, {
        sensitivity: 'base',
      }),
    );
  }

  // Regular client user: only return companies assigned to them
  const userCompanies: CompanyAssignment[] = [];
  if (Array.isArray(user.companies)) {
    for (const c of user.companies) {
      if (c.myCoId && map.has(c.myCoId)) {
        userCompanies.push(map.get(c.myCoId)!);
      } else if (c.myCoId) {
        userCompanies.push({
          myCoId: c.myCoId,
          companyName: c.companyName || c.myCoId,
        });
      }
    }
  }
  return userCompanies;
}
