import React, { useState, useEffect } from 'react';
import { dataStore } from '../../services/dataStore';
import { AuditLogEntry, UserRole } from '../../types';
import { 
  ShieldCheck, ShieldAlert, Search, Filter, Download, 
  Clock, CheckCircle2, AlertTriangle, XCircle, User, 
  FileText, Activity, RefreshCw 
} from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<string>('all');

  useEffect(() => {
    const update = () => {
      setLogs(dataStore.getAuditLogs());
    };
    update();
    return dataStore.subscribe(update);
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (roleFilter !== 'all' && log.userRole !== roleFilter) return false;
    if (resultFilter !== 'all' && log.result !== resultFilter) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase().trim();
    return (
      log.action.toLowerCase().includes(q) ||
      log.user.toLowerCase().includes(q) ||
      log.target.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q)
    );
  });

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'User', 'Role', 'Action', 'Target', 'Details', 'Result'];
    const rows = filteredLogs.map((l) => [
      `"${l.timestamp}"`,
      `"${l.user}"`,
      `"${l.userRole}"`,
      `"${l.action}"`,
      `"${l.target.replace(/"/g, '""')}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      `"${l.result}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `careconnect_audit_log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-700 text-white shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Security, Access & Clinical Audit Logs
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  COMPLIANCE LEDGER
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Immutable event stream for patient access, credential rotation, urgent alerts, and role scoping.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-950 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            type="text"
            aria-label="Search audit records"
            placeholder="Search action, user, target patient, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-semibold text-[11px]">Role:</span>
            <select
              aria-label="Filter audit records by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="min-h-10 rounded-xl border border-slate-300 bg-white px-2.5 font-medium"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="doctor">Doctor</option>
              <option value="attender">Attender</option>
              <option value="nurse">Nurse / Staff</option>
              <option value="system">System</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-semibold text-[11px]">Result:</span>
            <select
              aria-label="Filter audit records by outcome"
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="min-h-10 rounded-xl border border-slate-300 bg-white px-2.5 font-medium"
            >
              <option value="all">All Outcomes</option>
              <option value="SUCCESS">Success</option>
              <option value="WARNING">Warning</option>
              <option value="FAILURE">Failure</option>
            </select>
          </div>

          <span className="text-slate-400 font-mono text-[11px] ml-2">
            Showing {filteredLogs.length} of {logs.length}
          </span>
        </div>
      </div>

      {/* 3. Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="hidden overflow-x-auto 2xl:block">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">User & Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4 text-right">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No audit records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isSuccess = log.result === 'SUCCESS';
                  const isWarning = log.result === 'WARNING';
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{log.user}</div>
                        <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 inline-block mt-0.5">
                          {log.userRole}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs font-bold text-slate-800">
                        {log.action}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">
                        {log.target}
                      </td>

                      <td className="py-3 px-4 text-slate-600 max-w-md truncate">
                        {log.details}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isSuccess
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : isWarning
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}
                        >
                          {isSuccess && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {isWarning && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                          {!isSuccess && !isWarning && <XCircle className="w-3 h-3 text-red-600" />}
                          {log.result}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-3 2xl:hidden sm:p-4">
          {filteredLogs.map((log) => {
            const isSuccess = log.result === 'SUCCESS';
            const isWarning = log.result === 'WARNING';
            const outcomeClass = isSuccess
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : isWarning
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-red-200 bg-red-50 text-red-800';
            const OutcomeIcon = isSuccess ? CheckCircle2 : isWarning ? AlertTriangle : XCircle;
            return (
              <article key={log.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <time dateTime={log.timestamp} className="text-xs font-medium text-slate-600">
                    {new Date(log.timestamp).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </time>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${outcomeClass}`}>
                    <OutcomeIcon className="h-3 w-3" aria-hidden="true" />
                    {log.result}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-950">{log.user}</span>
                  <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-800">
                    {log.userRole}
                  </span>
                </div>
                <dl className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Action</dt>
                    <dd className="mt-0.5 break-all font-mono text-xs font-semibold text-slate-900">{log.action}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Target</dt>
                    <dd className="mt-0.5 break-words font-medium text-slate-900">{log.target}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Details</dt>
                    <dd className="mt-0.5 break-words leading-5 text-slate-700">{log.details}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
          {filteredLogs.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm font-semibold text-slate-900">No matching audit records</p>
              <p className="mt-1 text-sm text-slate-600">Adjust the search or filters to see more events.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
