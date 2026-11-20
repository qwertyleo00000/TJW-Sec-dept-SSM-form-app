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
    { myCoId: '', companyName: '' },
  ]);
  const [requestedCompanyInfo, setRequestedCompanyInfo] = useState<{
    companyName: string;
    myCoId: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'administrator';

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
    setCompaniesInput([{ myCoId: '', companyName: '' }]);
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
        },
      ];
    }

    setCompaniesInput(
      initialCompanies.length > 0
        ? JSON.parse(JSON.stringify(initialCompanies))
        : [{ myCoId: '', companyName: '' }],
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
      { myCoId: '', companyName: '' },
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
      const cleanedCompanies =
        roleInput === 'administrator' || roleInput === 'manager'
          ? []
          : companiesInput.filter(
              (c) => c.myCoId.trim() && c.companyName.trim(),
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
              ? 'Manage administrators, managers, and client users along with company vault access and registration approvals.'
              : 'Manage client user accounts, review pending registrations, and assign authorized company vault records.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New User</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-slate-900" />
            <span>Loading users and access rights...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600 bg-red-50/50">
            {error}
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No users found in the system registry.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">User &amp; Role</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Authorized Companies</th>
                  <th className="py-3.5 px-4">Requested Registration</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {users.map((u) => {
                  const isPending = u.status === 'pending';
                  const isSuperAdmin = u.email.toLowerCase() === 'qwertyleo00000@gmail.com';
                  return (
                    <tr
                      key={u.email}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isPending ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-900">
                          {u.fullName}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          {u.email}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              u.role === 'administrator'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : u.role === 'manager'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                            <span className="capitalize">{u.role}</span>
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            u.status === 'active'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {u.status === 'active' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          <span className="capitalize">{u.status}</span>
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {u.role === 'administrator' || u.role === 'manager' ? (
                          <span className="text-xs text-slate-700 font-medium italic">
                            Full system access (all companies)
                          </span>
                        ) : u.companies.length === 0 ? (
                          <span className="text-xs text-slate-400 italic">
                            No companies assigned
                          </span>
                        ) : (
                          <div className="space-y-1">
                            {u.companies.map((c, idx) => (
                              <div
                                key={idx}
                                className="text-xs font-medium text-slate-800 flex items-center gap-1.5"
                              >
                                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{c.companyName}</span>
                                <span className="font-mono text-slate-500">
                                  ({c.myCoId})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {u.requestedCompany ? (
                          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                            <div className="text-xs font-bold text-slate-900">
                              {u.requestedCompany.companyName}
                            </div>
                            <div className="text-[11px] font-mono text-slate-600">
                              SSM {u.requestedCompany.myCoId}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleApprovePending(u)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors shadow-xs cursor-pointer"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                            title="Edit user"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {!isSuperAdmin && (
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Create/Edit Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="font-display text-base font-bold text-slate-900">
                {isEdit ? 'Edit User & Access Rights' : 'Add New User'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
              {formError && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium">
                  {formError}
                </div>
              )}

              {requestedCompanyInfo && !isEdit && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                  <span className="font-bold">Pending Registration Request:</span>
                  <div>Company: {requestedCompanyInfo.companyName}</div>
                  <div>SSM MyCoID: {requestedCompanyInfo.myCoId}</div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullNameInput}
                    onChange={(e) => setFullNameInput(e.target.value)}
                    placeholder="Dato' Ahmad bin Tan"
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    disabled={isEdit}
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="user@company.my"
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Access Role
                  </label>
                  <select
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="user">Client User</option>
                    <option value="manager">Manager</option>
                    <option value="administrator">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Account Status
                  </label>
                  <select
                    value={statusInput}
                    onChange={(e) => setStatusInput(e.target.value as UserStatus)}
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Password {isEdit ? '(Leave blank to keep existing)' : ''}
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="At least 12 chars (upper, lower, number)"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                />
              </div>

              {roleInput === 'administrator' || roleInput === 'manager' ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-xs font-bold text-slate-900">
                    Full System Access Role
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Administrators and managers have full system access to upload and manage statutory forms for all companies.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Authorized Company Assignments
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
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                required
                                value={comp.myCoId}
                                onChange={(e) =>
                                  updateCompanyRow(idx, 'myCoId', e.target.value)
                                }
                                placeholder="202301018899"
                                className="w-full px-3 py-2 text-xs font-mono text-slate-900 bg-white border border-slate-300 rounded-lg"
                              />
                              {companiesInput.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeCompanyRow(idx)}
                                  aria-label="Remove company"
                                  className="p-2 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save User Account</span>
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
