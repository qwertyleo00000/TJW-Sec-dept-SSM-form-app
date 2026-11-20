import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FilePlus2, Loader2, ShieldCheck } from 'lucide-react';
import type {
  AiSearchResponse,
  AuthSessionResponse,
  CompanyAssignment,
  StatutoryDocument,
} from './types';
import {
  aiSearchCompanyDocuments,
  deleteStatutoryFile,
  downloadCompanyPdf,
  fetchCompanyDocuments,
  fetchCurrentSession,
  logoutSession,
  recordCtcClick,
  renameStatutoryFile,
  uploadStatutoryPdf,
} from './lib/api';
import {
  DEFAULT_COSEC_WHATSAPP_NUMBER,
  buildMissingFormWhatsappUrl,
  formatFilingDate,
} from './lib/whatsapp';
import { AiConciergePanel } from './components/AiConciergePanel';
import { AuditTrailPanel } from './components/AuditTrailPanel';
import { WhatsAppIcon } from './components/BrandMark';
import { DocumentTable } from './components/DocumentTable';
import { LoginScreen } from './components/LoginScreen';
import { MissingFormModal } from './components/MissingFormModal';
import { Toast } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { TopNav } from './components/TopNav';
import { UserManagementPanel } from './components/UserManagementPanel';

export default function App() {
  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [activeMyCoId, setActiveMyCoId] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<'vault' | 'users' | 'audit'>('vault');
  const [idleLogoutNotice, setIdleLogoutNotice] = useState<string | undefined>(undefined);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [idleSecondsRemaining, setIdleSecondsRemaining] = useState(60);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!session) return;

    lastActivityRef.current = Date.now();
    try {
      localStorage.setItem('cosec_vault_last_activity', String(lastActivityRef.current));
    } catch {}

    const handleUserActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      try {
        localStorage.setItem('cosec_vault_last_activity', String(now));
      } catch {}
      if (showIdleWarning) {
        setShowIdleWarning(false);
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'cosec_vault_last_activity' && e.newValue) {
        const val = Number(e.newValue);
        if (!isNaN(val) && val > lastActivityRef.current) {
          lastActivityRef.current = val;
          if (showIdleWarning) {
            setShowIdleWarning(false);
          }
        }
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    for (const ev of events) {
      window.addEventListener(ev, handleUserActivity, { passive: true });
    }
    window.addEventListener('storage', handleStorageEvent);

    const interval = window.setInterval(async () => {
      const idleMs = Date.now() - lastActivityRef.current;
      const IDLE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes
      const WARNING_THRESHOLD_MS = 9 * 60 * 1000; // 9 minutes (60s warning)

      if (idleMs >= IDLE_LIMIT_MS) {
        try {
          await logoutSession('inactivity');
        } catch {}
        setSession(null);
        setIdleLogoutNotice('You were automatically logged out after 10 minutes of inactivity for security.');
        setShowIdleWarning(false);
        return;
      }

      if (idleMs >= WARNING_THRESHOLD_MS) {
        setShowIdleWarning(true);
        const remaining = Math.max(0, Math.ceil((IDLE_LIMIT_MS - idleMs) / 1000));
        setIdleSecondsRemaining(remaining);
      } else {
        if (showIdleWarning) {
          setShowIdleWarning(false);
        }
      }
    }, 1000);

    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, handleUserActivity);
      }
      window.removeEventListener('storage', handleStorageEvent);
      window.clearInterval(interval);
    };
  }, [session, showIdleWarning]);

  const handleStaySignedIn = async () => {
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem('cosec_vault_last_activity', String(now));
    } catch {}
    setShowIdleWarning(false);
    try {
      await fetchCurrentSession();
    } catch {}
  };

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

  useEffect(() => {
    let cancelled = false;
    fetchCurrentSession()
      .then((existing) => {
        if (cancelled) return;
        if (existing && existing.user) {
          setSession(existing);
          setActiveMyCoId(existing.authorizedCompanies[0]?.myCoId ?? '');
          if (
            (existing.user.role === 'administrator' ||
              existing.user.role === 'manager') &&
            existing.authorizedCompanies.length === 0
          ) {
            setCurrentTab('users');
          }
        }
      })
      .catch(() => {
        // Unauthenticated fallback
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCompany: CompanyAssignment | null = useMemo(() => {
    if (!session) return null;
    return (
      session.authorizedCompanies.find((c) => c.myCoId === activeMyCoId) ??
      session.authorizedCompanies[0] ??
      null
    );
  }, [session, activeMyCoId]);

  const loadDocuments = useCallback(async (myCoId: string) => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const data = await fetchCompanyDocuments(myCoId);
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
    loadDocuments(activeCompany.myCoId);
  }, [activeCompany, loadDocuments]);

  function handleAuthenticated(newSession: AuthSessionResponse) {
    setSession(newSession);
    setActiveMyCoId(newSession.authorizedCompanies[0]?.myCoId ?? '');
    if (
      newSession.authorizedCompanies.length === 0 &&
      (newSession.user.role === 'administrator' ||
        newSession.user.role === 'manager')
    ) {
      setCurrentTab('users');
    } else {
      setCurrentTab('vault');
    }
    setAiQuery('');
    setAiResult(null);
    setAiError(null);
  }

  function handleSelectCompany(company: CompanyAssignment) {
    setActiveMyCoId(company.myCoId);
    setAiQuery('');
    setAiResult(null);
    setAiError(null);
  }

  async function handleLogout() {
    await logoutSession();
    setSession(null);
    setActiveMyCoId('');
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
        activeCompany.myCoId,
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
        activeCompany.myCoId,
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

  async function handleUploadFile(file: File) {
    if (!activeCompany) return;
    const res = (await uploadStatutoryPdf(activeCompany.myCoId, file)) as any;
    const newDoc = res.document ?? res;
    const notifiedCount = res.notifiedCount ?? 0;
    await loadDocuments(activeCompany.myCoId);
    showToast(
      `Uploaded ${newDoc.fileName} and notified ${notifiedCount} registered user(s) for ${activeCompany.companyName}.`,
      'success',
    );
  }

  async function handleRenameFile(fileId: string, newName: string) {
    if (!activeCompany) return;
    await renameStatutoryFile(activeCompany.myCoId, fileId, newName);
    await loadDocuments(activeCompany.myCoId);
    showToast('Document renamed successfully', 'success');
  }

  async function handleDeleteFile(fileId: string) {
    if (!activeCompany) return;
    await deleteStatutoryFile(activeCompany.myCoId, fileId);
    await loadDocuments(activeCompany.myCoId);
    showToast('Document deleted successfully', 'success');
  }

  function handleCtcClick(doc: StatutoryDocument) {
    if (activeCompany) {
      recordCtcClick(activeCompany.myCoId, activeCompany.companyName, doc.fileName);
    }
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
          <span>Verifying CoSec Vault RBAC session...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <LoginScreen onAuthenticated={handleAuthenticated} idleLogoutNotice={idleLogoutNotice} />
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </>
    );
  }

  const whatsappNumber =
    session.cosecWhatsappNumber || DEFAULT_COSEC_WHATSAPP_NUMBER;
  const isAdminOrManager =
    session.user.role === 'administrator' || session.user.role === 'manager';

  const footerWhatsappUrl = buildMissingFormWhatsappUrl({
    whatsappNumber,
    company: activeCompany ?? {
      myCoId: '000000-X',
      companyName: 'Unassigned Company',
    },
    missingForms: ['General Statutory Form Inquiry'],
    user: session.user,
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {showIdleWarning && (
        <div role="alert" className="bg-amber-600 text-white px-4 py-3 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 z-50 sticky top-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span>⚠️ Your session will expire in <strong className="font-mono">{idleSecondsRemaining}s</strong> due to inactivity.</span>
          </div>
          <button
            type="button"
            onClick={handleStaySignedIn}
            className="px-4 py-1.5 rounded-lg bg-white text-amber-900 text-xs font-bold hover:bg-amber-50 transition-colors cursor-pointer shadow-xs"
          >
            Stay Signed In
          </button>
        </div>
      )}
      <TopNav
        user={session.user}
        companies={session.authorizedCompanies}
        activeCompany={activeCompany}
        onSelectCompany={handleSelectCompany}
        onLogout={handleLogout}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
      />

      <main className="flex-1 max-w-[1240px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {currentTab === 'users' && isAdminOrManager ? (
          <UserManagementPanel currentUser={session.user} />
        ) : currentTab === 'audit' ? (
          <AuditTrailPanel currentUser={session.user} />
        ) : !activeCompany ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center max-w-xl mx-auto my-12 shadow-xs space-y-4">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              No Company Assigned Yet
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {isAdminOrManager ? (
                <>
                  Your account does not currently have any companies linked or assigned. As an administrator or manager, you can switch to the Access Rights & Users panel to assign companies and manage user access.
                </>
              ) : (
                <>
                  Your account is active, but no company folder has been assigned to your profile yet. Please contact your Company Secretary team or system administrator to link your company vault.
                </>
              )}
            </p>
            {isAdminOrManager ? (
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setCurrentTab('users')}
                  className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer shadow-sm"
                >
                  Manage Users & Assign Companies
                </button>
              </div>
            ) : (
              <div className="pt-3">
                <a
                  href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Hello CoSec Team, my account (${session.user.email}) is currently not assigned to any company vault. Please assist in linking my access.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#25D366]/60 bg-white text-sm font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors shadow-xs"
                >
                  <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                  <span>Contact CoSec Support via WhatsApp</span>
                </a>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Active Company Summary Header */}
            <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-200">
              <div className="min-w-0">
                <h1 className="font-display text-2xl sm:text-[1.75rem] font-bold text-slate-900 tracking-tight leading-tight">
                  {activeCompany.companyName}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-slate-600">
                  <span className="font-mono tabular-nums font-medium text-slate-800">
                    SSM {activeCompany.myCoId}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="capitalize">{session.user.role}</span>
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
              onRetry={() => loadDocuments(activeCompany.myCoId)}
              onDownload={handleDownload}
              onCtcClick={handleCtcClick}
              onOpenMissingModal={() => setMissingModalOpen(true)}
              onUploadFile={handleUploadFile}
              onRenameFile={handleRenameFile}
              onDeleteFile={handleDeleteFile}
            />
          </>
        )}
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
        company={activeCompany ?? { myCoId: '000000-X', companyName: 'Unassigned Company' }}
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
