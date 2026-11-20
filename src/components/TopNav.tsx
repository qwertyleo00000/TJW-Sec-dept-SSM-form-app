import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  KeyRound,
  LogOut,
  Shield,
  Users,
  Vault,
  X,
} from 'lucide-react';
import type { AuthenticatedUser, CompanyAssignment } from '../types';
import { changePassword } from '../lib/api';
import { VaultEmblem } from './BrandMark';

interface TopNavProps {
  user: AuthenticatedUser;
  companies: CompanyAssignment[];
  activeCompany: CompanyAssignment;
  onSelectCompany: (company: CompanyAssignment) => void;
  onLogout: () => void;
  currentTab: 'vault' | 'users';
  onTabChange: (tab: 'vault' | 'users') => void;
}

export function TopNav({
  user,
  companies,
  activeCompany,
  onSelectCompany,
  onLogout,
  currentTab,
  onTabChange,
}: TopNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setPasswordModalOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const hasMultipleCompanies = companies.length > 1;
  const isAdminOrManager = user.role === 'administrator' || user.role === 'manager';

  const roleBadgeText =
    user.role === 'administrator'
      ? 'Administrator'
      : user.role === 'manager'
      ? 'Manager'
      : 'Client User';

  const roleBadgeStyle =
    user.role === 'administrator'
      ? 'bg-purple-50 text-purple-700 border-purple-200'
      : user.role === 'manager'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      window.setTimeout(() => {
        setPasswordModalOpen(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 lg:gap-6">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <VaultEmblem className="w-8 h-8 shrink-0" />
          <div className="leading-none">
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap block">
                CoSec Vault
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleBadgeStyle}`}
              >
                {roleBadgeText}
              </span>
            </div>
            <span className="hidden sm:block text-[11px] text-slate-500 mt-1 whitespace-nowrap">
              Corporate Secretarial Portal
            </span>
          </div>
        </div>

        {/* Admin/Manager Tab Switcher or Company Switcher */}
        <div className="flex items-center gap-4 flex-1 max-w-xl justify-center">
          {isAdminOrManager && (
            <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => onTabChange('vault')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  currentTab === 'vault'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Vault className="w-3.5 h-3.5" />
                <span>Statutory Vault</span>
              </button>
              <button
                type="button"
                onClick={() => onTabChange('users')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  currentTab === 'users'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Access Rights &amp; Users</span>
              </button>
            </div>
          )}

          {currentTab === 'vault' && activeCompany && (
            <div ref={dropdownRef} className="relative min-w-0 w-full max-w-sm">
              <button
                type="button"
                onClick={() => hasMultipleCompanies && setMenuOpen((prev) => !prev)}
                aria-expanded={menuOpen}
                aria-haspopup="listbox"
                disabled={!hasMultipleCompanies && !isAdminOrManager}
                className={`w-full flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg border text-left transition-colors ${
                  hasMultipleCompanies || isAdminOrManager
                    ? 'border-slate-200 bg-slate-50/80 hover:bg-slate-100/80 hover:border-slate-300 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900'
                    : 'border-slate-200 bg-slate-50/50 cursor-default'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-[13px] font-semibold text-slate-900 truncate leading-tight">
                      {activeCompany.companyName}
                    </p>
                    <p className="text-[11px] font-mono tabular-nums text-slate-500 truncate mt-0.5">
                      SSM {activeCompany.myCoId}
                    </p>
                  </div>
                </div>
                {(hasMultipleCompanies || isAdminOrManager) && (
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-150 ${
                      menuOpen ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </button>

              {menuOpen && (hasMultipleCompanies || isAdminOrManager) && (
                <div
                  role="listbox"
                  aria-label="Authorized companies"
                  className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-40 max-h-72 overflow-y-auto"
                >
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="text-xs font-medium text-slate-500">
                      Select Company Entity ({companies.length})
                    </p>
                  </div>
                  {companies.map((company) => {
                    const isSelected = company.myCoId === activeCompany.myCoId;
                    return (
                      <button
                        key={company.myCoId}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setMenuOpen(false);
                          if (!isSelected) {
                            onSelectCompany(company);
                          }
                        }}
                        className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-slate-50 text-slate-900'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-900 truncate">
                            {company.companyName}
                          </p>
                          <p className="text-xs font-mono tabular-nums text-slate-500 mt-0.5">
                            {company.myCoId}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Zone 3: User Profile, Change Password & Logout */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden lg:block text-right leading-tight">
            <p className="text-sm font-medium text-slate-900 whitespace-nowrap">
              {user.fullName}
            </p>
            <p className="text-xs text-slate-500 whitespace-nowrap mt-0.5">
              {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPasswordError(null);
              setPasswordSuccess(false);
              setPasswordModalOpen(true);
            }}
            aria-label="Change Password"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Security</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign Out"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Mobile Tab bar for admin/manager */}
      {isAdminOrManager && (
        <div className="flex md:hidden border-t border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => onTabChange('vault')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold ${
              currentTab === 'vault' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600'
            }`}
          >
            <Vault className="w-3.5 h-3.5" />
            <span>Vault</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('users')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold ${
              currentTab === 'users' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users &amp; Access</span>
          </button>
        </div>
      )}

      {/* Change Password Modal */}
      {passwordModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display text-base font-bold text-slate-900">
                Change Account Password
              </h3>
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {passwordError}
              </div>
            )}

            {passwordSuccess ? (
              <div className="py-4 text-center space-y-3">
                <Check className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-900">Password updated successfully!</p>
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    New Password (min 12 chars, upper &amp; lower case)
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setPasswordModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="px-4 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                  >
                    {savingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
