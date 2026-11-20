import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  AlertCircle,
  Download,
  FilePenLine,
  FilePlus,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AuthenticatedUser,
  CompanyAssignment,
  DocumentCategory,
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
  company: CompanyAssignment;
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
  onUploadFile: (file: File) => Promise<void>;
  onRenameFile: (fileId: string, newName: string) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
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
  onUploadFile,
  onRenameFile,
  onDeleteFile,
}: DocumentTableProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('All Documents');
  const [searchTerm, setSearchTerm] = useState('');

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [renameModalDoc, setRenameModalDoc] = useState<StatutoryDocument | null>(null);
  const [newNameInput, setNewNameInput] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<StatutoryDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdminOrManager = user.role === 'administrator' || user.role === 'manager';

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

  async function handleUploadSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;
    setUploadError(null);
    setUploading(true);
    try {
      await onUploadFile(selectedFile);
      setSelectedFile(null);
      setUploadModalOpen(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleRenameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!renameModalDoc || !newNameInput.trim()) return;
    setRenaming(true);
    try {
      const finalName = newNameInput.trim().endsWith('.pdf')
        ? newNameInput.trim()
        : `${newNameInput.trim()}.pdf`;
      await onRenameFile(renameModalDoc.fileId, finalName);
      setRenameModalDoc(null);
      setNewNameInput('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Rename failed.');
    } finally {
      setRenaming(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirmDoc) return;
    setDeleting(true);
    try {
      await onDeleteFile(deleteConfirmDoc.fileId);
      setDeleteConfirmDoc(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

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

        <div className="flex items-center gap-3 w-full md:w-auto">
          {isAdminOrManager && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUploadModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
              >
                <FilePlus className="w-4 h-4" />
                <span>Upload Statutory Form (PDF)</span>
              </button>
            </div>
          )}

          <div className="relative w-full md:w-64">
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
                : 'No filings are uploaded in this folder yet.'}
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
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {isDownloading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Downloading...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" />
                                <span>Download</span>
                              </>
                            )}
                          </button>

                          <a
                            href={ctcUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => onCtcClick(doc)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#25D366]/60 bg-white text-xs font-semibold text-emerald-800 hover:bg-emerald-50 hover:border-[#25D366] transition-colors whitespace-nowrap shrink-0"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                            <span>Request CTC</span>
                          </a>

                          {isAdminOrManager && (
                            <>
                              <button
                                type="button"
                                title="Rename document"
                                onClick={() => {
                                  setRenameModalDoc(doc);
                                  setNewNameInput(doc.fileName);
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <FilePenLine className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                title="Delete document"
                                onClick={() => setDeleteConfirmDoc(doc)}
                                className="p-1.5 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
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

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900">
                Upload Statutory Form (PDF)
              </h3>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {uploadError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
                >
                  {uploadError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Select PDF File
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  required
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setSelectedFile(e.target.files?.[0] ?? null)
                  }
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Target folder: <span className="font-medium text-slate-800">{company.companyName}</span>
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <span>Upload to Vault</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModalDoc && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900">
                Rename Document
              </h3>
              <button
                type="button"
                onClick={() => setRenameModalDoc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenameSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  File Name
                </label>
                <input
                  type="text"
                  required
                  value={newNameInput}
                  onChange={(e) => setNewNameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModalDoc(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renaming || !newNameInput.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {renaming ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmDoc && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900">
              Confirm Document Deletion
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-900">{deleteConfirmDoc.fileName}</span>? This will remove the document from the company vault.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmDoc(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Delete PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
