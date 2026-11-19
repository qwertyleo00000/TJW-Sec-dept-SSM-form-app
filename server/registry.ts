import fs from 'fs';
import path from 'path';
import type { AuthenticatedUser, PublicCompany } from '../src/types.ts';

export interface RegistryCompany extends PublicCompany {
  driveFolderId: string;
}

export interface RegistryUser extends AuthenticatedUser {
  authorizedCompanies: RegistryCompany[];
}

interface RegistryFile {
  users: RegistryUser[];
}

const REGISTRY_PATH = path.resolve(process.cwd(), 'data', 'registry.json');

export function loadRegistry(): RegistryFile {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
  return JSON.parse(raw) as RegistryFile;
}

export function findUserByEmail(email: string): RegistryUser | null {
  const normalized = email.trim().toLowerCase();
  const registry = loadRegistry();
  return (
    registry.users.find((u) => u.email.trim().toLowerCase() === normalized) ??
    null
  );
}

export function getAuthorizedCompany(
  email: string,
  companyId: string,
): { user: RegistryUser; company: RegistryCompany } | null {
  const user = findUserByEmail(email);
  if (!user) return null;
  const company = user.authorizedCompanies.find(
    (c) => c.companyId === companyId,
  );
  if (!company) return null;
  return { user, company };
}

export function toPublicCompanies(
  companies: RegistryCompany[],
): PublicCompany[] {
  return companies.map(({ companyId, companyName, registrationNo }) => ({
    companyId,
    companyName,
    registrationNo,
  }));
}
