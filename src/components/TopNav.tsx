import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, LogOut } from 'lucide-react';
import type { AuthenticatedUser, PublicCompany } from '../types';
import { VaultEmblem } from './BrandMark';

interface TopNavProps {
  user: AuthenticatedUser;
  companies: PublicCompany[];
  activeCompany: PublicCompany;
  onSelectCompany: (company: PublicCompany) => void;
  onLogout: () => void;
}

export function TopNav({
  user,
  companies,
  activeCompany,
  onSelectCompany,
  onLogout,
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

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 lg:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <VaultEmblem className="w-8 h-8 shrink-0" />
          <div className="leading-none">
            <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap block">
              CoSec Vault
            </span>
            <span className="hidden sm:block text-[11px] text-slate-500 mt-0.5 whitespace-nowrap">
              Corporate Secretarial Portal
            </span>
          </div>
        </div>

        {/* Zone 2: Company Switcher Dropdown */}
        <div ref={dropdownRef} className="relative min-w-0 flex-1 max-w-md">
          <button
            type="button"
            onClick={() => hasMultipleCompanies && setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            disabled={!hasMultipleCompanies}
            className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg border text-left transition-colors ${
              hasMultipleCompanies
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
                  SSM {activeCompany.registrationNo}
                </p>
              </div>
            </div>
            {hasMultipleCompanies && (
              <ChevronDown
                className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-150 ${
                  menuOpen ? 'rotate-180' : ''
                }`}
              />
            )}
          </button>

          {menuOpen && hasMultipleCompanies && (
            <div
              role="listbox"
              aria-label="Authorized companies"
              className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-40"
            >
              <div className="px-3.5 py-2 border-b border-slate-100">
                <p className="text-xs font-medium text-slate-500">
                  Authorized Entities ({companies.length})
                </p>
              </div>
              {companies.map((company) => {
                const isSelected = company.companyId === activeCompany.companyId;
                return (
                  <button
                    key={company.companyId}
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
                        {company.registrationNo}
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

        {/* Zone 3: User Profile & Logout */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="hidden md:block text-right leading-tight">
            <p className="text-sm font-medium text-slate-900 whitespace-nowrap">
              {user.fullName}
            </p>
            <p className="text-xs text-slate-500 whitespace-nowrap mt-0.5">
              {user.role} · {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
