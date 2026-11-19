import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Download,
  FileText,
  Filter,
  Loader2,
  Search,
} from 'lucide-react';
import type {
  AuthenticatedUser,
  DocumentCategory,
  PublicCompany,
  StatutoryDocument,
} from '../types';
import {
  buildCtcWhatsappUrl,
  formatDocumentTitle,
  formatFileSize,
  formatFilingDate,
} from '../lib/whatsapp';
import { WhatsAppIcon } from './BrandMark';

interface DocumentTableProps {
  company: PublicCompany;
  user: AuthenticatedUser;
  whatsappNumber: string;
  documents: StatutoryDocument[];
  loading: boolean;
  error: string | null;
  downloadingFileId: string | null;
  onRetry: () => void;
  onDownload: (doc: StatutoryDocument) => void;
  onCtcClick: (doc: StatutoryDocument) => void;
  onOpenMissingModal: () => void;
}

type FilterTab = 'All Documents' | DocumentCategory;

const FILTER_TABS: FilterTab[] = [
  'All Documents',
  'Incorporation',
  'Directors & Officers',
  'Share Capital',
  'Annual Compliance',
  'Constitution',
];

export function DocumentTable({
  company,
  user,
  whatsappNumber,
  documents,
  loading,
  error,
  downloadingFileId,
  onRetry,
  onDownload,
  onCtcClick,
  onOpenMissingModal,
}: DocumentTableProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('All Documents');
  const [searchTerm, setSearchTerm] = useState('');

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 'All Documents': documents.length };
    for (const doc of documents) {
      counts[doc.category] = (counts[doc.category] ?? 0) + 1;
    }
    return counts;
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return documents.filter((doc) => {
      const matchesTab =
        activeTab === 'All Documents' || doc.category === activeTab;
      if (!matchesTab) return false;
      if (!q) return true;
      return (
        doc.fileName.toLowerCase().includes(q) ||
        doc.statutorySection.toLowerCase().includes(q) ||
        doc.category.toLowerCase().includes(q)
      );
    });
  }, [documents, activeTab, searchTerm]);

  return (
    <section aria-labelledby="repository-heading" className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2
            id="repository-heading"
            className="font-display text-lg sm:text-xl font-bold text-slate-900 tracking-tight"
          >
            Statutory Document Repository
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Mirrored SSM filings for {company.companyName} ·{' '}
            <span className="font-mono tabular-nums text-slate-700">
              {documents.length} PDF{documents.length === 1 ? '' : 's'}
            </span>
          </p>
        </div>

        {/* Live client-side filter */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by filename or section..."
            aria-label="Filter documents by filename or section"
            className="w-full pl-9 pr-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
          />
        </div>
      </div>

      {/* Interactive Category Filter Tabs */}
      <div
        role="tablist"
        aria-label="Document categories"
        className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto"
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeTab === tab;
          const count = categoryCounts[tab] ?? 0;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{tab}</span>
              <span
                className={`font-mono tabular-nums text-[11px] ${
                  isActive ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100 p-4 space-y-2">
            {[1, 2, 3, 4].map((row) => (
              <div
                key={row}
                className="h-14 flex items-center justify-between gap-4 px-2"
              >
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-44 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="h-8 w-52 bg-slate-100 rounded animate-pulse hidden sm:block" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="mt-3 text-sm font-semibold text-slate-900">
              Unable to load statutory documents
            </p>
            <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">
              {error}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-5 px-4 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Retry Loading Vault
            </button>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-10 text-center">
            <Filter className="w-7 h-7 text-slate-400 mx-auto" />
            <p className="mt-3 text-sm font-semibold text-slate-900">
              No statutory documents match this filter
            </p>
            <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">
              {activeTab !== 'All Documents' || searchTerm.trim()
                ? 'Try resetting your category filter or search term, or request a missing form from your Company Secretary.'
                : 'No filings are uploaded in this folder yet. Request a form from your Company Secretary below.'}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {(activeTab !== 'All Documents' || searchTerm.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('All Documents');
                    setSearchTerm('');
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
              <button
                type="button"
                onClick={onOpenMissingModal}
                className="px-4 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Request Missing Form
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 pl-5 pr-4 font-medium">Document Name</th>
                  <th className="py-3 px-4 font-medium whitespace-nowrap">
                    SSM Section
                  </th>
                  <th className="py-3 px-4 font-medium whitespace-nowrap hidden lg:table-cell">
                    Category
                  </th>
                  <th className="py-3 px-4 font-medium whitespace-nowrap hidden sm:table-cell">
                    Last Updated
                  </th>
                  <th className="py-3 pl-4 pr-5 font-medium text-right whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-sm">
                {filteredDocuments.map((doc) => {
                  const isDownloading = downloadingFileId === doc.fileId;
                  const ctcUrl = buildCtcWhatsappUrl({
                    whatsappNumber,
                    company,
                    document: doc,
                    user,
                  });

                  return (
                    <tr
                      key={doc.fileId}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 pl-5 pr-4 align-middle">
                        <div className="flex items-start gap-3 min-w-[220px]">
                          <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 leading-snug">
                              {formatDocumentTitle(doc.fileName)}
                            </p>
                            <p className="text-xs font-mono text-slate-500 truncate mt-0.5">
                              {doc.fileName}
                              <span className="sm:hidden">
                                {' '}
                                · {formatFilingDate(doc.lastUpdated)}
                              </span>
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-emerald-700">
                          {doc.statutorySection}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 align-middle text-slate-600 whitespace-nowrap hidden lg:table-cell">
                        {doc.category}
                      </td>

                      <td className="py-3.5 px-4 align-middle whitespace-nowrap hidden sm:table-cell">
                        <div className="text-slate-700 font-mono text-xs tabular-nums">
                          {formatFilingDate(doc.lastUpdated)}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-0.5">
                          {formatFileSize(doc.fileSizeKB)}
                        </div>
                      </td>

                      <td className="py-3.5 pl-4 pr-5 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isDownloading}
                            onClick={() => onDownload(doc)}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {isDownloading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Downloading...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" />
                                <span>Download PDF</span>
                              </>
                            )}
                          </button>

                          <a
                            href={ctcUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => onCtcClick(doc)}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#25D366]/60 bg-white text-xs font-semibold text-emerald-800 hover:bg-emerald-50 hover:border-[#25D366] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 transition-colors whitespace-nowrap shrink-0"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                            <span>Request CTC</span>
                          </a>
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
    </section>
  );
}
