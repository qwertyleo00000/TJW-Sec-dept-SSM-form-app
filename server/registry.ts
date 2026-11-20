import fs from 'fs';
import path from 'path';
import type { AuthenticatedUser, CompanyAssignment, UserRole } from '../src/types.ts';

export interface RegistryUser extends AuthenticatedUser {
  email: string;
  fullName: string;
  role: UserRole;
  companies: CompanyAssignment[];
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
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) return;

  const registry = loadRegistry();
  const existingAdmin = registry.users.find(
    (u) =>
      u.email.trim().toLowerCase() === adminEmail && u.role === 'administrator',
  );

  if (!existingAdmin) {
    const userIndex = registry.users.findIndex(
      (u) => u.email.trim().toLowerCase() === adminEmail,
    );
    const adminUser: RegistryUser = {
      email: adminEmail,
      fullName: 'System Administrator',
      role: 'administrator',
      companies:
        userIndex >= 0
          ? registry.users[userIndex].companies
          : [
              {
                myCoId: '202601000001 (999999-X)',
                companyName: 'MASTER HOLDINGS SDN. BHD.',
                driveFolderId: 'ROOT_COSEC_VAULT_FOLDER',
              },
            ],
    };

    if (userIndex >= 0) {
      registry.users[userIndex] = adminUser;
    } else {
      registry.users.push(adminUser);
    }
    saveRegistry(registry);
    console.log(`[CoSec Vault] Bootstrap administrator registered: ${adminEmail}`);
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

export function upsertUser(userData: {
  email: string;
  fullName: string;
  role: UserRole;
  companies: CompanyAssignment[];
}): RegistryUser {
  const registry = loadRegistry();
  const normalizedEmail = userData.email.trim().toLowerCase();
  const existingIdx = registry.users.findIndex(
    (u) => u.email.trim().toLowerCase() === normalizedEmail,
  );

  const cleaned: RegistryUser = {
    email: normalizedEmail,
    fullName: userData.fullName.trim() || 'Valued User',
    role: userData.role,
    companies: Array.isArray(userData.companies)
      ? userData.companies.map((c) => ({
          myCoId: c.myCoId.trim(),
          companyName: c.companyName.trim(),
          driveFolderId: c.driveFolderId.trim(),
        }))
      : [],
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
    // Admins and managers can access any company in registry or their assigned list
    const registry = loadRegistry();
    for (const u of registry.users) {
      const found = u.companies.find((c) => c.myCoId === myCoId);
      if (found) return found;
    }
  }
  return user.companies.find((c) => c.myCoId === myCoId) ?? null;
}

export function getAllAccessibleCompanies(user: RegistryUser): CompanyAssignment[] {
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
    // Also include user's own
    for (const c of user.companies) {
      if (c.myCoId) {
        map.set(c.myCoId, c);
      }
    }
    return Array.from(map.values());
  }
  return user.companies;
}
