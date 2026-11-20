import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, LogOut, Shield, Users, Vault } from 'lucide-react';
import type { AuthenticatedUser, CompanyAssignment } from '../types';
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

        {/* Zone 3: User Profile & Logout */}
        <div className="flex items-center gap-3 shrink-0">
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
            onClick={onLogout}
            aria-label="Sign Out"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
    </header>
  );
}
