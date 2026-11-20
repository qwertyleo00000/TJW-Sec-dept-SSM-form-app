import { useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, Loader2, Send, X } from 'lucide-react';
import type {
  AuthenticatedUser,
  MissingFormSubmission,
  PublicCompany,
} from '../types';
import { submitMissingFormRequest } from '../lib/api';
import { buildMissingFormWhatsappUrl } from '../lib/whatsapp';
import { WhatsAppIcon } from './BrandMark';

interface MissingFormModalProps {
  open: boolean;
  company: PublicCompany;
  user: AuthenticatedUser;
  whatsappNumber: string;
  onClose: () => void;
  onSubmitted: (submission: MissingFormSubmission) => void;
  onWhatsappLaunched: () => void;
}

const COMMON_MISSING_FORMS = [
  'Section 51 — Register of Members (Shareholder List)',
  'Section 46 — Notification of Change in Registered Address',
  'Board Resolution — Bank Account Opening (CTC)',
  'Section 68 — Latest Annual Return',
  'Section 58 — Recent Director Appointment / Resignation',
];

export function MissingFormModal({
  open,
  company,
  user,
  whatsappNumber,
  onClose,
  onSubmitted,
  onWhatsappLaunched,
}: MissingFormModalProps) {
  const [formName, setFormName] = useState(COMMON_MISSING_FORMS[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] =
    useState<MissingFormSubmission | null>(null);

  if (!open) return null;

  const regNo = company.registrationNo || company.myCoId;
  const companyKey = company.myCoId || company.registrationNo || '';

  const whatsappUrl = buildMissingFormWhatsappUrl({
    whatsappNumber,
    company,
    missingForms: [formName.trim() || 'Statutory Document Request'],
    user,
    notes,
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const submission = await submitMissingFormRequest(
        companyKey,
        formName.trim(),
        notes.trim(),
      );
      setConfirmation(submission);
      onSubmitted(submission);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to submit form request.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setConfirmation(null);
    setError(null);
    setNotes('');
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="missing-form-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h3
              id="missing-form-modal-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              Request Missing Statutory Form
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {company.companyName} ·{' '}
              <span className="font-mono tabular-nums">{regNo}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {confirmation ? (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Request logged with our Company Secretary desk
                </p>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                  Reference{' '}
                  <span className="font-mono font-semibold text-slate-900">
                    {confirmation.id}
                  </span>{' '}
                  for <span className="font-medium">{confirmation.formName}</span>.
                  Need urgent turnaround or wet-ink certification? Follow up directly on WhatsApp.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onWhatsappLaunched}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#25D366]/60 bg-white text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors"
              >
                <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                <span>Send via WhatsApp</span>
              </a>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="missing-form-name"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Required Statutory Form or Resolution
              </label>
              <input
                id="missing-form-name"
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Section 51 Register of Members"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              />
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {COMMON_MISSING_FORMS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFormName(preset)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                      formName === preset
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    {preset.split(' — ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="missing-form-notes"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Purpose or Certification Notes{' '}
                <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <textarea
                id="missing-form-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Required for Maybank corporate account opening, 2 physical CTC sets."
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 resize-none"
              />
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onWhatsappLaunched}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#25D366]/60 bg-white text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors whitespace-nowrap"
              >
                <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                <span>Send via WhatsApp Instead</span>
              </a>

              <button
                type="submit"
                disabled={submitting || !formName.trim()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Portal Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
