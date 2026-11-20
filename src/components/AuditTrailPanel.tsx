import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  User,
  Calendar,
} from 'lucide-react';
import type { AuditLogEntry, AuthenticatedUser } from '../types';
import { fetchAuditLogs, getAuditCsvDownloadUrl } from '../lib/api';

interface AuditTrailPanelProps {
  currentUser: AuthenticatedUser;
}

export function AuditTrailPanel({ currentUser }: AuditTrailPanelProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [emailFilter, setEmailFilter] = useState('');
  const [myCoIdFilter, setMyCoIdFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const isAdminOrManager =
    currentUser.role === 'administrator' || currentUser.role === 'manager';

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAuditLogs({
        email: isAdminOrManager ? emailFilter || undefined : undefined,
        myCoId: isAdminOrManager ? myCoIdFilter || undefined : undefined,
        action: isAdminOrManager ? actionFilter || undefined : undefined,
        fromDate: isAdminOrManager ? fromDate || undefined : undefined,
        toDate: isAdminOrManager ? toDate || undefined : undefined,
      });
      setLogs(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load activity and audit trail.',
      );
    } finally {
      setLoading(false);
    }
  }, [isAdminOrManager, emailFilter, myCoIdFilter, actionFilter, fromDate, toDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  function formatMalaysiaTime(isoString: string): string {
    try {
      const date = new Date(isoString);
      return (
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Kuala_Lumpur',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(date) + ' MYT'
      );
    } catch {
      return isoString;
    }
  }

  function getActionBadgeStyle(action: AuditLogEntry['action']): string {
    switch (action) {
      case 'LOGIN':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'LOGOUT':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'VAULT_VISIT':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'DOCUMENT_DOWNLOAD':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'CTC_WHATSAPP_REQUEST':
      case 'MISSING_FORM_REQUEST':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'FILE_UPLOAD':
      case 'USER_REGISTERED':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'FILE_RENAME':
      case 'USER_UPDATED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'FILE_DELETE':
      case 'USER_DELETED':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'PASSWORD_CHANGED':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }

  const csvUrl = getAuditCsvDownloadUrl({
    email: emailFilter || undefined,
    myCoId: myCoIdFilter || undefined,
    action: actionFilter || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {isAdminOrManager ? 'Activity & Audit Trail Portal' : 'My Activity & Download History'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAdminOrManager
                  ? 'Secure append-only system audit logs across all company vaults and user accounts (Companies Act 2016 compliance).'
                  : 'Track your sign-in timestamps, company vault visits, and statutory document download history.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={loadLogs}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {isAdminOrManager && (
            <a
              href={csvUrl}
              download
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </a>
          )}
        </div>
      </div>

      {/* Admin / Manager Filters */}
      {isAdminOrManager && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Audit Log Filters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Filter by Email
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={emailFilter}
                  onChange={(e) => setEmailFilter(e.target.value)}
                  placeholder="user@domain.com"
                  className="w-full pl-8 pr-3 py-1.5 text-xs text-slate-950 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                SSM No. / Company ID
              </label>
              <input
                type="text"
                value={myCoIdFilter}
                onChange={(e) => setMyCoIdFilter(e.target.value)}
                placeholder="202401000001"
                className="w-full px-3 py-1.5 text-xs text-slate-950 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Action Type
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-xs text-slate-950 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">All Actions</option>
                <option value="LOGIN">LOGIN</option>
                <option value="LOGOUT">LOGOUT</option>
                <option value="VAULT_VISIT">VAULT_VISIT</option>
                <option value="DOCUMENT_DOWNLOAD">DOCUMENT_DOWNLOAD</option>
                <option value="CTC_WHATSAPP_REQUEST">CTC_WHATSAPP_REQUEST</option>
                <option value="MISSING_FORM_REQUEST">MISSING_FORM_REQUEST</option>
                <option value="FILE_UPLOAD">FILE_UPLOAD</option>
                <option value="FILE_RENAME">FILE_RENAME</option>
                <option value="FILE_DELETE">FILE_DELETE</option>
                <option value="USER_REGISTERED">USER_REGISTERED</option>
                <option value="USER_UPDATED">USER_UPDATED</option>
                <option value="USER_DELETED">USER_DELETED</option>
                <option value="PASSWORD_CHANGED">PASSWORD_CHANGED</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                From Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs text-slate-950 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                To Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs text-slate-950 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Audit Event Records
            </h2>
            <p className="text-xs text-slate-500">
              Showing {logs.length} recorded event{logs.length === 1 ? '' : 's'} (Sorted newest first)
            </p>
          </div>
        </div>

        {error && (
          <div role="alert" className="p-4 bg-red-50 border-b border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 flex items-center justify-center gap-3 text-sm text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-slate-900" />
            <span>Loading audit log records...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Activity className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No activity logs found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Events such as sign-ins, document downloads, and vault visits will be recorded here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4 whitespace-nowrap">Timestamp (MYT)</th>
                  <th className="py-3 px-4 whitespace-nowrap">User</th>
                  <th className="py-3 px-4 whitespace-nowrap">Role</th>
                  <th className="py-3 px-4 whitespace-nowrap">Action</th>
                  <th className="py-3 px-4 whitespace-nowrap">Company / SSM No.</th>
                  <th className="py-3 px-4 whitespace-nowrap">Document / Details</th>
                  <th className="py-3 px-4 whitespace-nowrap">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700 tabular-nums">
                      {formatMalaysiaTime(log.timestamp)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-sans font-medium text-slate-900 truncate max-w-[180px]">
                        {log.userName}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                        {log.userEmail}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-700 border-slate-200 capitalize">
                        <Shield className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{log.userRole}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block font-sans text-[11px] font-bold px-2 py-0.5 rounded border ${getActionBadgeStyle(
                          log.action,
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {log.companyName ? (
                        <div>
                          <div className="font-sans font-semibold text-slate-900 truncate max-w-[160px]">
                            {log.companyName}
                          </div>
                          {log.myCoId && (
                            <div className="text-[11px] text-slate-500 tabular-nums">
                              {log.myCoId}
                            </div>
                          )}
                        </div>
                      ) : log.myCoId ? (
                        <span className="tabular-nums text-slate-600">{log.myCoId}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-sans text-slate-800 max-w-xs truncate">
                        {log.documentName || log.details || '—'}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap tabular-nums text-slate-500 text-[11px]">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
