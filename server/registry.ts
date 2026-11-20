import fs from 'fs';
import path from 'path';
import type {
  AuthenticatedUser,
  CompanyAssignment,
  RequestedCompanyInfo,
  UserRole,
  UserStatus,
} from '../src/types.ts';

export interface RegistryUser extends AuthenticatedUser {
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
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
    // Normalize users (ensure status exists, default to 'active')
    data.users = data.users.map((u) => ({
      ...u,
      status: u.status === 'pending' ? 'pending' : 'active',
      companies: Array.isArray(u.companies) ? u.companies : [],
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

  for (const adminEmail of adminEmails) {
    const existingIndex = registry.users.findIndex(
      (u) => u.email.trim().toLowerCase() === adminEmail,
    );

    if (existingIndex >= 0) {
      const existing = registry.users[existingIndex];
      if (existing.role !== 'administrator' || existing.status !== 'active') {
        registry.users[existingIndex] = {
          ...existing,
          role: 'administrator',
          status: 'active',
        };
        modified = true;
      }
    } else {
      registry.users.push({
        email: adminEmail,
        fullName: adminEmail === 'qwertyleo00000@gmail.com' ? 'Administrator' : 'System Administrator',
        role: 'administrator',
        status: 'active',
        companies: [],
      });
      modified = true;
    }
  }

  if (modified) {
    saveRegistry(registry);
    console.log('[CoSec Vault] Bootstrap administrator accounts verified/activated.');
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

  const newUser: RegistryUser = {
    email: normalizedEmail,
    fullName: userData.fullName.trim(),
    role: 'user',
    status: 'pending',
    companies: [],
    requestedCompany: {
      companyName: userData.companyName.trim(),
      myCoId: userData.myCoId.trim(),
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
  companies: CompanyAssignment[];
  requestedCompany?: RequestedCompanyInfo;
}): RegistryUser {
  const registry = loadRegistry();
  const normalizedEmail = userData.email.trim().toLowerCase();
  const existingIdx = registry.users.findIndex(
    (u) => u.email.trim().toLowerCase() === normalizedEmail,
  );

  const existing = existingIdx >= 0 ? registry.users[existingIdx] : null;

  const cleaned: RegistryUser = {
    email: normalizedEmail,
    fullName: userData.fullName.trim() || 'Valued User',
    role: userData.role,
    status: userData.status ?? existing?.status ?? 'active',
    companies: Array.isArray(userData.companies)
      ? userData.companies.map((c) => ({
          myCoId: c.myCoId.trim(),
          companyName: c.companyName.trim(),
          driveFolderId: c.driveFolderId.trim(),
        }))
      : existing?.companies ?? [],
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

export function getAuthorizedCompany(
  user: RegistryUser,
  myCoId: string,
): CompanyAssignment | null {
  if (user.role === 'administrator' || user.role === 'manager') {
    const registry = loadRegistry();
    for (const u of registry.users) {
      const found = u.companies.find((c) => c.myCoId === myCoId);
      if (found) return found;
    }
  }
  return user.companies.find((c) => c.myCoId === myCoId) ?? null;
}

export function getAllAccessibleCompanies(
  user: RegistryUser,
): CompanyAssignment[] {
  if (user.role === 'administrator' || user.role === 'manager') {
    const registry = loadRegistry();
    const map = new Map<string, CompanyAssignment>();
    for (const u of registry.users) {
      for (const c of u.companies) {
        if (c.myCoId) {
          map.set(c.myCoId, c);
        }
      }
    }
    for (const c of user.companies) {
      if (c.myCoId) {
        map.set(c.myCoId, c);
      }
    }
    return Array.from(map.values());
  }
  return user.companies;
}
