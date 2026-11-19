import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import type {
  AiSearchResponse,
  AuthenticatedUser,
  PublicCompany,
  StatutoryDocument,
} from '../types';
import {
  buildCtcWhatsappUrl,
  buildMissingFormWhatsappUrl,
  formatDocumentTitle,
  formatFileSize,
  formatFilingDate,
} from '../lib/whatsapp';
import { WhatsAppIcon } from './BrandMark';

interface AiConciergePanelProps {
  company: PublicCompany;
  user: AuthenticatedUser;
  whatsappNumber: string;
  documents: StatutoryDocument[];
  query: string;
  onQueryChange: (value: string) => void;
  result: AiSearchResponse | null;
  loading: boolean;
  error: string | null;
  downloadingFileId: string | null;
  onSearch: (queryText: string) => void;
  onReset: () => void;
  onDownload: (doc: StatutoryDocument) => void;
  onCtcClick: (doc: StatutoryDocument) => void;
  onMissingWhatsappClick: (forms: string[]) => void;
}

const SUGGESTION_PROMPTS = [
  {
    label: 'Bank Opening Pack (Sec 14, 17, 58)',
    query:
      'I need our Bank Opening Pack including Superform Section 14, Certificate of Incorporation Section 17, and our latest Register of Directors Section 58.',
  },
  {
    label: 'Latest Director List (Sec 58)',
    query: 'Give me the latest register of directors and officers (Section 58).',
  },
  {
    label: 'Shareholder & Capital Info (Sec 51 / 78)',
    query:
      'I need our shareholder list (Section 51) and share allotment / paid-up capital records (Section 78).',
  },
  {
    label: 'Incorporation Certificate (Sec 17)',
    query: 'I need our company certificate of incorporation (Section 17).',
  },
];

export function AiConciergePanel({
  company,
  user,
  whatsappNumber,
  documents,
  query,
  onQueryChange,
  result,
  loading,
  error,
  downloadingFileId,
  onSearch,
  onReset,
  onDownload,
  onCtcClick,
  onMissingWhatsappClick,
}: AiConciergePanelProps) {
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || loading) return;
    setLastSubmittedQuery(trimmed);
    onSearch(trimmed);
  }

  function handleChipClick(chipQuery: string) {
    if (loading) return;
    onQueryChange(chipQuery);
    setLastSubmittedQuery(chipQuery);
    onSearch(chipQuery);
  }

  const matchedDocs = result
    ? result.matchedFileIds
        .map((id) => documents.find((d) => d.fileId === id))
        .filter((d): d is StatutoryDocument => Boolean(d))
    : [];

  const missingWhatsappUrl =
    result && result.missingForms.length > 0
      ? buildMissingFormWhatsappUrl({
          whatsappNumber,
          company,
          missingForms: result.missingForms,
          user,
        })
      : '';

  return (
    <section
      aria-labelledby="ai-concierge-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2
            id="ai-concierge-heading"
            className="font-display text-lg sm:text-xl font-bold text-slate-900 tracking-tight"
          >
            Statutory Document Assistant
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Describe what you need in plain English. Search is strictly scoped to{' '}
            <span className="font-medium text-slate-900">{company.companyName}</span>.
          </p>
        </div>

        {(result || error) && (
          <button
            type="button"
            onClick={() => {
              setLastSubmittedQuery('');
              onReset();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 self-start cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Results</span>
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Ask for any form in plain English... e.g., 'I need our latest director list and incorporation cert for bank account opening'"
              aria-label="Ask for any statutory form in plain English"
              className="w-full pl-10 pr-4 py-3 text-sm text-slate-900 bg-slate-50/70 border border-slate-300 rounded-lg placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Finding Forms...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Find Documents</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Quick-action suggestion buttons */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 mr-1">Common requests:</span>
        {SUGGESTION_PROMPTS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            disabled={loading}
            onClick={() => handleChipClick(chip.query)}
            className="px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div
          aria-live="polite"
          className="mt-6 pt-6 border-t border-slate-200 space-y-3"
        >
          <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-slate-100 rounded animate-pulse" />
          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <div className="h-24 bg-slate-50 border border-slate-200 rounded-lg animate-pulse" />
            <div className="h-24 bg-slate-50 border border-slate-200 rounded-lg animate-pulse" />
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div
          role="alert"
          className="mt-6 pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Assistant lookup could not be completed
              </p>
              <p className="text-sm text-slate-600 mt-0.5">{error}</p>
            </div>
          </div>
          {lastSubmittedQuery && (
            <button
              type="button"
              onClick={() => onSearch(lastSubmittedQuery)}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {/* AI Response Results */}
      {!loading && result && (
        <div className="mt-6 pt-6 border-t border-slate-200 space-y-5">
          <div>
            <p className="text-sm leading-relaxed text-slate-800">
              {result.explanation}
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              {matchedDocs.length} matching{' '}
              {matchedDocs.length === 1 ? 'document' : 'documents'} found in{' '}
              {company.companyName}
              {result.missingForms.length > 0 &&
                ` · ${result.missingForms.length} not currently in vault`}
            </p>
          </div>

          {matchedDocs.length > 0 && (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-slate-50/40">
              {matchedDocs.map((doc) => {
                const isDownloading = downloadingFileId === doc.fileId;
                const ctcUrl = buildCtcWhatsappUrl({
                  whatsappNumber,
                  company,
                  document: doc,
                  user,
                });

                return (
                  <div
                    key={doc.fileId}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white first:rounded-t-lg last:rounded-b-lg"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <FileText className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {formatDocumentTitle(doc.fileName)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                          <span className="font-mono font-medium text-emerald-700">
                            {doc.statutorySection}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{doc.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            Updated {formatFilingDate(doc.lastUpdated)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatFileSize(doc.fileSizeKB)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        disabled={isDownloading}
                        onClick={() => onDownload(doc)}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#25D366]/60 bg-white text-xs font-semibold text-emerald-800 hover:bg-emerald-50 hover:border-[#25D366] transition-colors whitespace-nowrap shrink-0"
                      >
                        <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                        <span>Request CTC</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {result.missingForms.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-950">
                  Not currently uploaded in this company&apos;s vault
                </p>
                <p className="mt-1 text-xs text-amber-900 leading-relaxed">
                  Missing form{result.missingForms.length > 1 ? 's' : ''}:{' '}
                  <span className="font-medium">
                    {result.missingForms.join(', ')}
                  </span>
                </p>
              </div>
              <a
                href={missingWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onMissingWhatsappClick(result.missingForms)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#25D366]/70 bg-white text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors whitespace-nowrap shrink-0"
              >
                <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                <span>Request Missing Form via WhatsApp</span>
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
