import React, { useState, useEffect } from 'react';
import { dataStore } from '../../services/dataStore';
import { VitalAlert } from '../../types';
import { useLanguage } from '../../i18n';
import { ShieldAlert, AlertTriangle, AlertOctagon, CheckCircle2, Clock, Filter } from 'lucide-react';

export const AdminAlertsPage: React.FC = () => {
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState<VitalAlert[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'attention'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'acknowledged'>('all');

  useEffect(() => {
    const refresh = () => setAlerts(dataStore.getAlerts());
    refresh();
    return dataStore.subscribe(refresh);
  }, []);

  const filteredAlerts = alerts.filter((a) => {
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    return true;
  });

  const activeCount = alerts.filter((a) => a.status === 'active').length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && a.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('alerts.adminTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('alerts.adminDescription')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-800 border border-red-200 rounded-full text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-600"></span>
              {criticalCount} Critical Active
            </span>
          )}
          <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-semibold">
            {activeCount} Active Episodes
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
          <span className="font-bold text-slate-700 mr-1">Severity:</span>
          <button
            type="button"
            onClick={() => setFilterSeverity('all')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              filterSeverity === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({alerts.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterSeverity('critical')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              filterSeverity === 'critical' ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Critical
          </button>
          <button
            type="button"
            onClick={() => setFilterSeverity('attention')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              filterSeverity === 'attention' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Attention
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-bold text-slate-700 mr-1">Status:</span>
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              filterStatus === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('active')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              filterStatus === 'active' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('acknowledged')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              filterStatus === 'acknowledged' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Acknowledged
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No telemetry alerts match the selected criteria.
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isCrit = alert.severity === 'critical';
            return (
              <div
                key={alert.id}
                className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                  alert.status === 'active' ? (isCrit ? 'bg-red-50/30' : 'bg-amber-50/20') : ''
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    isCrit ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-700 border border-amber-200'
                  }`}>
                    {isCrit ? <AlertOctagon className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900">{alert.patientName}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                        {alert.room}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        isCrit ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {alert.severity}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        alert.status === 'active' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {alert.status.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 font-medium">
                      {t('alerts.reviewNeeded')}
                    </p>

                    <div className="flex flex-col gap-1 pt-0.5 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:gap-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      {alert.status === 'active' && (
                        <span>{t('alerts.operationalNotice')}</span>
                      )}
                      {alert.acknowledgedBy && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-700 font-medium">
                            Acknowledged by {alert.acknowledgedBy}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                  {alert.status === 'active' && (
                    <span className="max-w-48 text-xs font-medium text-slate-600">
                      Clinical acknowledgement is for the assigned doctor or clinical staff.
                    </span>
                  )}
                  {alert.status === 'resolved' && (
                    <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Resolved
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
