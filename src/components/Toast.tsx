import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  tone: 'success' | 'info' | 'error';
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  if (!toast) return null;

  const isError = toast.tone === 'error';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 max-w-md w-[calc(100vw-2.5rem)] sm:w-auto"
    >
      <div
        className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border shadow-lg transition-all duration-150 ${
          isError
            ? 'bg-white border-red-200 text-slate-900'
            : 'bg-slate-900 border-slate-800 text-white'
        }`}
      >
        {isError ? (
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        )}
        <p className="text-sm leading-snug font-medium pr-2">{toast.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className={`ml-auto p-1 rounded-md transition-colors shrink-0 ${
            isError
              ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
