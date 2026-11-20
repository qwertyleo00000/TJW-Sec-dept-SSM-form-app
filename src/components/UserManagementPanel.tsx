import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  Edit,
  Loader2,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { AuthenticatedUser, CompanyAssignment, UserRole, UserStatus } from '../types';
import {
  deleteAdminUser,
  fetchAdminUsers,
  saveAdminUser,
  verifyDriveFolder,
} from '../lib/api';

interface UserManagementPanelProps {
  currentUser: AuthenticatedUser;
}

export function UserManagementPanel({ currentUser }: UserManagementPanelProps) {
  const [users, setUsers] = useState<
    Array<{
      email: string;
      fullName: string;
      role: UserRole;
      status: UserStatus;
      companies: CompanyAssignment[];
      requestedCompany?: { companyName: string; myCoId: string };
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  const [emailInput, setEmailInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');
  const [roleInput, setRoleInput] = useState<UserRole>('user');
  const [statusInput, setStatusInput] = useState<UserStatus>('active');
  const [passwordInput, setPasswordInput] = useState('');
  const [companiesInput, setCompaniesInput] = useState<CompanyAssignment[]>([
    { myCoId: '', companyName: '', driveFolderId: '' },
  ]);
  const [requestedCompanyInfo, setRequestedCompanyInfo] = useState<{
    companyName: string;
    myCoId: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [testingIdx, setTestingIdx] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<
    Record<number, { ok?: boolean; message?: string }>
  >({});

  const isAdmin = currentUser.role === 'administrator';

  async function handleTestFolder(idx: number, link: string) {
    if (!link.trim()) return;
    setTestingIdx(idx);
    setTestResult((prev) => ({ ...prev, [idx]: {} }));
    try {
      const res = await verifyDriveFolder(link);
      setTestResult((prev) => ({
        ...prev,
        [idx]: {
          ok: true,
          message: `Success! Detected ${res.count} PDF file(s) in shared folder.`,
        },
      }));
    } catch (err) {
      setTestResult((prev) => ({
        ...prev,
        [idx]: {
          ok: false,
          message: err instanceof Error ? err.message : 'Verification failed.',
        },
      }));
    } finally {
      setTestingIdx(null);
    }
  }

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function handleOpenCreate() {
    setIsEdit(false);
    setEmailInput('');
    setFullNameInput('');
    setRoleInput('user');
    setStatusInput('active');
    setPasswordInput('');
    setCompaniesInput([{ myCoId: '', companyName: '', driveFolderId: '' }]);
    setRequestedCompanyInfo(null);
    setFormError(null);
    setModalOpen(true);
  }

  function handleOpenEdit(u: {
    email: string;
    fullName: string;
    role: UserRole;
    status: UserStatus;
    companies: CompanyAssignment[];
    requestedCompany?: { companyName: string; myCoId: string };
  }) {
    setIsEdit(true);
    setEmailInput(u.email);
    setFullNameInput(u.fullName);
    setRoleInput(u.role);
    setStatusInput(u.status);
    setPasswordInput('');
    setRequestedCompanyInfo(u.requestedCompany ?? null);

    let initialCompanies = u.companies;
    if (
      initialCompanies.length === 0 &&
      u.requestedCompany?.companyName &&
      u.requestedCompany?.myCoId
    ) {
      initialCompanies = [
        {
          companyName: u.requestedCompany.companyName,
          myCoId: u.requestedCompany.myCoId,
          driveFolderId: '',
        },
      ];
    }

    setCompaniesInput(
      initialCompanies.length > 0
        ? JSON.parse(JSON.stringify(initialCompanies))
        : [{ myCoId: '', companyName: '', driveFolderId: '' }],
    );
    setFormError(null);
    setModalOpen(true);
  }

  function handleApprovePending(u: {
    email: string;
    fullName: string;
    role: UserRole;
    status: UserStatus;
    companies: CompanyAssignment[];
    requestedCompany?: { companyName: string; myCoId: string };
  }) {
    handleOpenEdit({
      ...u,
      status: 'active',
    });
  }

  function addCompanyRow() {
    setCompaniesInput((prev) => [
      ...prev,
      { myCoId: '', companyName: '', driveFolderId: '' },
    ]);
  }

  function removeCompanyRow(index: number) {
    setCompaniesInput((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateCompanyRow(
    index: number,
    field: keyof CompanyAssignment,
    value: string,
  ) {
    setCompaniesInput((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const cleanedCompanies = companiesInput.filter(
        (c) => c.myCoId.trim() && c.companyName.trim() && c.driveFolderId.trim(),
      );
      await saveAdminUser({
        email: emailInput,
        fullName: fullNameInput,
        role: roleInput,
        status: statusInput,
        password: passwordInput.trim() ? passwordInput : undefined,
        companies: cleanedCompanies,
        isEdit,
      });
      setModalOpen(false);
      await loadUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(email: string) {
    if (!window.confirm(`Are you sure you want to delete user ${email}?`)) return;
    try {
      await deleteAdminUser(email);
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Access Rights &amp; User Management
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {isAdmin
              ? 'Manage administrators, managers, and client users along with their authorized company folder mappings and registration approvals.'
              : 'Manage client user accounts, review pending registrations, and assign authorized company folder mappings.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F172A] text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New User</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-500" />
            <p className="mt-3 text-sm text-slate-600">Loading user directory...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-600 text-sm">{error}</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No users found in registry.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">User Details</th>
                  <th className="py-3 px-4">Role &amp; Status</th>
                  <th className="py-3 px-4">Authorized / Requested Company</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {users.map((u) => {
                  const isSelf =
                    u.email.toLowerCase() === currentUser.email.toLowerCase();
                  const isTargetAdminOrManager =
                    u.role === 'administrator' || u.role === 'manager';
                  const canModify = isAdmin || (!isTargetAdminOrManager && !isSelf);
                  const isPending = u.status === 'pending';

                  return (
                    <tr
                      key={u.email}
                      className={`hover:bg-slate-50/75 transition-colors ${
                        isPending ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{u.fullName}</div>
                        <div className="text-xs font-mono text-slate-500 mt-0.5">{u.email}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap space-y-1.5">
                        <div>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              u.role === 'administrator'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : u.role === 'manager'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <Shield className="w-3.5 h-3.5" />
                            <span className="capitalize">{u.role}</span>
                          </span>
                        </div>
                        <div>
                          {isPending ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-700" />
                              <span>Pending Approval</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Active</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1 max-w-md">
                          {isPending && u.requestedCompany ? (
                            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                              <p className="font-semibold text-amber-900">
                                Requested: {u.requestedCompany.companyName}
                              </p>
                              <p className="font-mono text-[11px] text-amber-800 mt-0.5">
                                MyCoID: {u.requestedCompany.myCoId}
                              </p>
                            </div>
                          ) : u.companies.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">No companies assigned</span>
                          ) : (
                            u.companies.map((c, idx) => (
                              <div
                                key={idx}
                                className="text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1 flex items-center justify-between gap-2"
                              >
                                <span className="font-semibold text-slate-800 truncate">
                                  {c.companyName}
                                </span>
                                <span className="font-mono text-[11px] text-slate-500 shrink-0">
                                  {c.myCoId}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {canModify ? (
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {isPending ? (
                              <button
                                type="button"
                                onClick={() => handleApprovePending(u)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Approve &amp; Assign Folder</span>
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(u)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Edit user & companies"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleDelete(u.email)}
                                className="p-1.5 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title="Delete user"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Protected</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Create/Edit/Approve Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="font-display text-lg font-bold text-slate-900">
                {isEdit ? 'Edit User & Access Rights' : 'Add New User'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
                >
                  {formError}
                </div>
              )}

              {requestedCompanyInfo && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                  <p className="font-semibold text-amber-900">
                    User Requested Company (Registration Form):
                  </p>
                  <p className="text-amber-800">
                    <span className="font-medium">Company:</span> {requestedCompanyInfo.companyName}
                  </p>
                  <p className="font-mono text-amber-800">
                    <span className="font-medium">MyCoID:</span> {requestedCompanyInfo.myCoId}
                  </p>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Corporate Email Address
                  </label>
                  <input
                    type="email"
                    required
                    disabled={isEdit}
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="director@company.com.my"
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullNameInput}
                    onChange={(e) => setFullNameInput(e.target.value)}
                    placeholder="Tan Sri Ahmad Razak"
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Access Role
                  </label>
                  <select
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="user">Client User</option>
                    <option value="manager">Manager</option>
                    {isAdmin && <option value="administrator">Administrator</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Account Status
                  </label>
                  <select
                    value={statusInput}
                    onChange={(e) => setStatusInput(e.target.value as UserStatus)}
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending Approval</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Reset Password <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Leave blank to keep"
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Authorized Company Mappings &amp; Google Drive Folders
                  </label>
                  <button
                    type="button"
                    onClick={addCompanyRow}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Company</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {companiesInput.map((comp, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative"
                    >
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Company Name
                          </label>
                          <input
                            type="text"
                            required
                            value={comp.companyName}
                            onChange={(e) =>
                              updateCompanyRow(idx, 'companyName', e.target.value)
                            }
                            placeholder="ALPHA TECH SOLUTIONS SDN. BHD."
                            className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            SSM MyCoID / Reg No.
                          </label>
                          <input
                            type="text"
                            required
                            value={comp.myCoId}
                            onChange={(e) =>
                              updateCompanyRow(idx, 'myCoId', e.target.value)
                            }
                            placeholder="202301018899 (1512345-A)"
                            className="w-full px-3 py-2 text-xs font-mono text-slate-900 bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-medium text-slate-600">
                            Google Drive Shared Folder Link
                          </label>
                          <button
                            type="button"
                            onClick={() => handleTestFolder(idx, comp.driveFolderId)}
                            disabled={testingIdx === idx || !comp.driveFolderId.trim()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-200 text-slate-800 text-[11px] font-semibold hover:bg-slate-300 disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            {testingIdx === idx ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Testing...</span>
                              </>
                            ) : (
                              <span>Test Folder Link</span>
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <input
                              type="text"
                              required
                              value={comp.driveFolderId}
                              onChange={(e) =>
                                updateCompanyRow(idx, 'driveFolderId', e.target.value)
                              }
                              placeholder="https://drive.google.com/drive/folders/... or Folder ID"
                              className="w-full px-3 py-2 text-xs font-mono text-slate-900 bg-white border border-slate-300 rounded-lg"
                            />
                          </div>
                          {companiesInput.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCompanyRow(idx)}
                              aria-label="Remove company"
                              className="self-end p-2 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          In Google Drive, set folder access to &quot;Anyone with the link (Viewer)&quot; and paste the link here.
                        </p>
                        {testResult[idx] && (
                          <div
                            role="alert"
                            className={`p-2 rounded text-[11px] ${
                              testResult[idx]?.ok
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                                : 'bg-red-50 border border-red-200 text-red-800'
                            }`}
                          >
                            {testResult[idx]?.message}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save User &amp; Assign Access</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
