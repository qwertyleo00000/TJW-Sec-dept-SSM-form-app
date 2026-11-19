import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FilePlus2, Loader2, ShieldCheck } from 'lucide-react';
import type {
  AiSearchResponse,
  AuthSessionResponse,
  PublicCompany,
  StatutoryDocument,
} from './types';
import {
  aiSearchCompanyDocuments,
  downloadCompanyPdf,
  fetchCompanyDocuments,
  fetchCurrentSession,
  logoutSession,
} from './lib/api';
import {
  DEFAULT_COSEC_WHATSAPP_NUMBER,
  buildMissingFormWhatsappUrl,
  formatFilingDate,
} from './lib/whatsapp';
import { AiConciergePanel } from './components/AiConciergePanel';
import { WhatsAppIcon } from './components/BrandMark';
import { DocumentTable } from './components/DocumentTable';
import { LoginScreen } from './components/LoginScreen';
import { MissingFormModal } from './components/MissingFormModal';
import { Toast } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { TopNav } from './components/TopNav';

export default function App() {
  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');

  const [documents, setDocuments] = useState<StatutoryDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  const [aiQuery, setAiQuery] = useState('');
  const [aiResult, setAiResult] = useState<AiSearchResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(
    null,
  );
  const [missingModalOpen, setMissingModalOpen] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback(
    (message: string, tone: ToastMessage['tone'] = 'info') => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      setToast({ id: String(Date.now()), tone, message });
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, 4500);
    },
    [],
  );

  // Restore existing authenticated session on boot
  useEffect(() => {
    let cancelled = false;
    fetchCurrentSession()
      .then((existing) => {
        if (cancelled) return;
        if (existing && existing.authorizedCompanies.length > 0) {
          setSession(existing);
          setActiveCompanyId(existing.authorizedCompanies[0].companyId);
        }
      })
      .catch(() => {
        // Unauthenticated fallback to login screen
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCompany: PublicCompany | null = useMemo(() => {
    if (!session) return null;
    return (
      session.authorizedCompanies.find(
        (c) => c.companyId === activeCompanyId,
      ) ??
      session.authorizedCompanies[0] ??
      null
    );
  }, [session, activeCompanyId]);

  const loadDocuments = useCallback(async (companyId: string) => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const data = await fetchCompanyDocuments(companyId);
      setDocuments(data.documents);
    } catch (err) {
      setDocuments([]);
      setDocsError(
        err instanceof Error
          ? err.message
          : 'Unable to fetch statutory documents.',
      );
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeCompany) return;
    loadDocuments(activeCompany.companyId);
  }, [activeCompany, loadDocuments]);

  function handleAuthenticated(newSession: AuthSessionResponse) {
    setSession(newSession);
    setActiveCompanyId(newSession.authorizedCompanies[0]?.companyId ?? '');
    setAiQuery('');
    setAiResult(null);
    setAiError(null);
  }

  function handleSelectCompany(company: PublicCompany) {
    setActiveCompanyId(company.companyId);
    // Reset AI search state immediately on company switch to preserve strict visual isolation
    setAiQuery('');
    setAiResult(null);
    setAiError(null);
  }

  async function handleLogout() {
    await logoutSession();
    setSession(null);
    setActiveCompanyId('');
    setDocuments([]);
    setAiQuery('');
    setAiResult(null);
    setAiError(null);
    showToast('You have been signed out of CoSec Vault.');
  }

  async function handleAiSearch(queryText: string) {
    if (!activeCompany) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await aiSearchCompanyDocuments(
        activeCompany.companyId,
        queryText,
      );
      setAiResult(result);
    } catch (err) {
      setAiResult(null);
      setAiError(
        err instanceof Error
          ? err.message
          : 'Unable to complete AI document search.',
      );
    } finally {
      setAiLoading(false);
    }
  }

  async function handleDownload(doc: StatutoryDocument) {
    if (!activeCompany) return;
    setDownloadingFileId(doc.fileId);
    try {
      const downloadedName = await downloadCompanyPdf(
        activeCompany.companyId,
        doc.fileId,
        doc.fileName,
      );
      showToast(`Downloaded ${downloadedName}`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'PDF download failed.',
        'error',
      );
    } finally {
      setDownloadingFileId(null);
    }
  }

  function handleCtcClick(_doc: StatutoryDocument) {
    showToast(
      'Opening WhatsApp to send your CTC request to our Company Secretary team...',
      'info',
    );
  }

  function handleMissingWhatsappClick() {
    showToast(
      'Opening WhatsApp to send your missing form inquiry to our Company Secretary team...',
      'info',
    );
  }

  const latestUpdateDate = useMemo(() => {
    if (documents.length === 0) return null;
    const sorted = [...documents].sort(
      (a, b) =>
        new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
    );
    return formatFilingDate(sorted[0].lastUpdated);
  }, [documents]);

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-slate-900" />
          <span>Verifying CoSec Vault session...</span>
        </div>
      </div>
    );
  }

  if (!session || !activeCompany) {
    return (
      <>
        <LoginScreen onAuthenticated={handleAuthenticated} />
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </>
    );
  }

  const whatsappNumber =
    session.cosecWhatsappNumber || DEFAULT_COSEC_WHATSAPP_NUMBER;

  const footerWhatsappUrl = buildMissingFormWhatsappUrl({
    whatsappNumber,
    company: activeCompany,
    missingForms: ['General Statutory Form Inquiry'],
    user: session.user,
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopNav
        user={session.user}
        companies={session.authorizedCompanies}
        activeCompany={activeCompany}
        onSelectCompany={handleSelectCompany}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-[1240px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Active Company Summary Header */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-200">
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-[1.75rem] font-bold text-slate-900 tracking-tight leading-tight">
              {activeCompany.companyName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-slate-600">
              <span className="font-mono tabular-nums font-medium text-slate-800">
                SSM {activeCompany.registrationNo}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Authorized {session.user.role}</span>
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="font-mono tabular-nums">
                {documents.length} statutory filing
                {documents.length === 1 ? '' : 's'}
              </span>
              {latestUpdateDate && (
                <>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="font-mono tabular-nums">
                    Latest update {latestUpdateDate}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMissingModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4 text-slate-500" />
              <span>Request Missing Form</span>
            </button>
          </div>
        </section>

        {/* Gemini AI Smart Concierge */}
        <AiConciergePanel
          company={activeCompany}
          user={session.user}
          whatsappNumber={whatsappNumber}
          documents={documents}
          query={aiQuery}
          onQueryChange={setAiQuery}
          result={aiResult}
          loading={aiLoading}
          error={aiError}
          downloadingFileId={downloadingFileId}
          onSearch={handleAiSearch}
          onReset={() => {
            setAiQuery('');
            setAiResult(null);
            setAiError(null);
          }}
          onDownload={handleDownload}
          onCtcClick={handleCtcClick}
          onMissingWhatsappClick={() => handleMissingWhatsappClick()}
        />

        {/* Categorized Statutory Document Table */}
        <DocumentTable
          company={activeCompany}
          user={session.user}
          whatsappNumber={whatsappNumber}
          documents={documents}
          loading={docsLoading}
          error={docsError}
          downloadingFileId={downloadingFileId}
          onRetry={() => loadDocuments(activeCompany.companyId)}
          onDownload={handleDownload}
          onCtcClick={handleCtcClick}
          onOpenMissingModal={() => setMissingModalOpen(true)}
        />
      </main>

      {/* Missing Document Request Footer */}
      <footer className="mt-12 border-t border-slate-200 bg-white">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            <p className="font-medium text-slate-700">
              Need a statutory filing or board resolution not listed in your vault?
            </p>
            <p className="mt-0.5">
              CoSec Vault · Companies Act 2016 (SSM) Statutory Portal · CoSec Desk:{' '}
              <span className="font-mono text-slate-700">+60 11-3676 8398</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMissingModalOpen(true)}
              className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              Submit Missing Form Request
            </button>
            <a
              href={footerWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleMissingWhatsappClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#25D366]/60 bg-white text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors whitespace-nowrap"
            >
              <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
              <span>WhatsApp CoSec Team</span>
            </a>
          </div>
        </div>
      </footer>

      <MissingFormModal
        open={missingModalOpen}
        company={activeCompany}
        user={session.user}
        whatsappNumber={whatsappNumber}
        onClose={() => setMissingModalOpen(false)}
        onSubmitted={(submission) => {
          showToast(
            `Request ${submission.id} submitted for ${submission.formName}.`,
            'success',
          );
        }}
        onWhatsappLaunched={handleMissingWhatsappClick}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
