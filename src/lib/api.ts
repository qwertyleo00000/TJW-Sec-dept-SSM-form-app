import type {
  AiSearchResponse,
  AuthSessionResponse,
  CompanyAssignment,
  MissingFormSubmission,
  StatutoryDocument,
  UserRole,
} from '../types';

const TOKEN_STORAGE_KEY = 'cosec_vault_auth_token';

function getStoredToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restriction errors in sandboxed iframes
  }
}

function buildAuthHeaders(extra?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = {
    ...(extra ?? {}),
  };
  const token = getStoredToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function requestOtp(email: string): Promise<{
  message: string;
  email: string;
  fullName: string;
  expiresInSeconds: number;
}> {
  const res = await fetch('/api/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });
  return parseJsonResponse(res);
}

export async function verifyOtp(
  email: string,
  otp: string,
): Promise<AuthSessionResponse> {
  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, otp }),
  });
  const data = await parseJsonResponse<AuthSessionResponse>(res);
  if (data.token) {
    setStoredToken(data.token);
  }
  return data;
}

export async function fetchCurrentSession(): Promise<AuthSessionResponse | null> {
  const res = await fetch('/api/auth/me', {
    method: 'GET',
    headers: buildAuthHeaders(),
    credentials: 'include',
  });
  if (res.status === 401 || res.status === 403) {
    setStoredToken(null);
    return null;
  }
  return parseJsonResponse<AuthSessionResponse>(res);
}

export async function logoutSession(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: buildAuthHeaders(),
      credentials: 'include',
    });
  } finally {
    setStoredToken(null);
  }
}

export async function fetchCompanyDocuments(myCoId: string): Promise<{
  company: CompanyAssignment;
  documents: StatutoryDocument[];
}> {
  const res = await fetch(
    `/api/companies/${encodeURIComponent(myCoId)}/documents`,
    {
      method: 'GET',
      headers: buildAuthHeaders(),
      credentials: 'include',
    },
  );
  return parseJsonResponse(res);
}

export async function aiSearchCompanyDocuments(
  myCoId: string,
  query: string,
): Promise<AiSearchResponse> {
  const res = await fetch(
    `/api/companies/${encodeURIComponent(myCoId)}/ai-search`,
    {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ query }),
    },
  );
  return parseJsonResponse<AiSearchResponse>(res);
}

export async function downloadCompanyPdf(
  myCoId: string,
  fileId: string,
  fallbackFileName: string,
): Promise<string> {
  const res = await fetch(
    `/api/companies/${encodeURIComponent(myCoId)}/download/${encodeURIComponent(fileId)}`,
    {
      method: 'GET',
      headers: buildAuthHeaders(),
      credentials: 'include',
    },
  );

  if (!res.ok) {
    const errPayload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errPayload.error || `Failed to download document (${res.status})`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] || fallbackFileName;

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);

  return fileName;
}

export async function uploadStatutoryPdf(
  myCoId: string,
  file: File,
): Promise<StatutoryDocument> {
  const formData = new FormData();
  formData.append('myCoId', myCoId);
  formData.append('file', file);

  const res = await fetch('/api/admin/files/upload', {
    method: 'POST',
    headers: buildAuthHeaders(),
    credentials: 'include',
    body: formData,
  });
  const data = await parseJsonResponse<{ document: StatutoryDocument }>(res);
  return data.document;
}

export async function renameStatutoryFile(
  fileId: string,
  newFileName: string,
): Promise<void> {
  const res = await fetch(
    `/api/admin/files/${encodeURIComponent(fileId)}`,
    {
      method: 'PATCH',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ newFileName }),
    },
  );
  await parseJsonResponse(res);
}

export async function deleteStatutoryFile(fileId: string): Promise<void> {
  const res = await fetch(
    `/api/admin/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: buildAuthHeaders(),
      credentials: 'include',
    },
  );
  await parseJsonResponse(res);
}

export async function fetchAdminUsers(): Promise<
  Array<{
    email: string;
    fullName: string;
    role: UserRole;
    companies: CompanyAssignment[];
  }>
> {
  const res = await fetch('/api/admin/users', {
    method: 'GET',
    headers: buildAuthHeaders(),
    credentials: 'include',
  });
  const data = await parseJsonResponse<{
    users: Array<{
      email: string;
      fullName: string;
      role: UserRole;
      companies: CompanyAssignment[];
    }>;
  }>(res);
  return data.users;
}

export async function saveAdminUser(userData: {
  email: string;
  fullName: string;
  role: UserRole;
  companies: CompanyAssignment[];
  isEdit?: boolean;
}): Promise<void> {
  const endpoint = userData.isEdit
    ? `/api/admin/users/${encodeURIComponent(userData.email)}`
    : '/api/admin/users';
  const method = userData.isEdit ? 'PATCH' : 'POST';

  const res = await fetch(endpoint, {
    method,
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(userData),
  });
  await parseJsonResponse(res);
}

export async function deleteAdminUser(email: string): Promise<void> {
  const res = await fetch(
    `/api/admin/users/${encodeURIComponent(email)}`,
    {
      method: 'DELETE',
      headers: buildAuthHeaders(),
      credentials: 'include',
    },
  );
  await parseJsonResponse(res);
}

export async function submitMissingFormRequest(
  myCoId: string,
  formName: string,
  notes: string,
): Promise<MissingFormSubmission> {
  const res = await fetch(
    `/api/companies/${encodeURIComponent(myCoId)}/missing-request`,
    {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ formName, notes }),
    },
  );
  const data = await parseJsonResponse<{ submission: MissingFormSubmission }>(res);
  return data.submission;
}
