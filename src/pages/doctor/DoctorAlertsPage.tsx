import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getClinicalWorkspacePatients } from '../../services/patientScopeService';
import { dataStore } from '../../services/dataStore';
import { VitalAlert } from '../../types';
import { getDemoVitalReferenceRange } from '../../services/alertEngine';
import { useLanguage } from '../../i18n';
import { ShieldAlert, AlertTriangle, AlertOctagon, CheckCircle2, Clock } from 'lucide-react';

export const DoctorAlertsPage: React.FC = () => {
  const { assignedDoctorId, currentUser } = useAuth();
  const { t, language } = useLanguage();
  const [alerts, setAlerts] = useState<VitalAlert[]>([]);

  useEffect(() => {
    const refresh = () => {
      const docPatients = getClinicalWorkspacePatients(currentUser?.role, assignedDoctorId);
      const patientIds = new Set(docPatients.map((p) => p.id));
      const filtered = dataStore.getAlerts().filter((a) => patientIds.has(a.patientId));
      setAlerts(filtered);
    };

    refresh();
    return dataStore.subscribe(refresh);
  }, [assignedDoctorId, currentUser?.role]);

  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const criticalAlerts = activeAlerts.filter((alert) => alert.severity === 'critical');

  const handleAcknowledge = (id: string) => {
    dataStore.acknowledgeAlert(id, currentUser?.name || 'Dr. Arun Kumar', currentUser?.role || 'doctor');
  };

  const handleResolve = (id: string) => {
    dataStore.resolveAlert(id, currentUser?.name || 'Dr. Arun Kumar', undefined, currentUser?.role || 'doctor');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('alerts.clinicalTelemetry')}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('alerts.demoReadingDescription')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeAlerts.length > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-800 border border-red-200 rounded-full text-xs font-bold">
              {activeAlerts.length} {t('alerts.activeAlarms')}
            </span>
          )}
          <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold">
            {alerts.length} {t('alerts.totalIncidents')}
          </span>
        </div>
      </div>

      {criticalAlerts.length > 0 && (
        <div className="space-y-4" data-testid="critical-alerts-stack">
          {criticalAlerts.map((criticalAlert) => (
            <section
              key={criticalAlert.id}
              role="alert"
              aria-live="assertive"
              className="rounded-xl border-2 border-red-300 bg-red-50 p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-red-700 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">Critical</span>
                    <h2 className="text-base font-bold text-red-950">
                      {criticalAlert.vitalType === 'PULSE' ? t('alerts.criticalHeartRate') : criticalAlert.message}
                    </h2>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {criticalAlert.patientName} · {criticalAlert.room}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-700">
                    {t('alerts.value')}: <strong className="font-mono">{criticalAlert.valueRecorded}</strong>
                    <span className="mx-2">•</span>
                    {t('alerts.demoReferenceRange')}: <strong>{getDemoVitalReferenceRange(criticalAlert.vitalType, language)}</strong>
                    <span className="mx-2">•</span>
                    {new Date(criticalAlert.timestamp).toLocaleString(language === 'ta' ? 'ta-IN' : 'en-IN')}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{t('alerts.demoOnly')}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleAcknowledge(criticalAlert.id)}
                    className="min-h-11 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  >
                    {t('alerts.acknowledge')}
                  </button>
                  <Link
                    to={`/doctor/patients/${criticalAlert.patientId}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-900 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  >
                    {t('alerts.openPatient')}
                  </Link>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Alerts Feed */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {alerts.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs">
            {t('alerts.noAssignedAlerts')}
          </div>
        ) : (
          alerts.map((alert) => {
            const isCrit = alert.severity === 'critical';
            return (
              <div
                key={alert.id}
                className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                  alert.status === 'active' ? (isCrit ? 'bg-red-50/40' : 'bg-amber-50/30') : ''
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

                    <p className="text-xs text-slate-700 font-semibold font-mono">
                      {alert.vitalType === 'PULSE' && isCrit
                        ? `${t('alerts.criticalHeartRate')} — ${alert.valueRecorded}`
                        : alert.message}
                    </p>

                    <p className="text-[11px] leading-5 text-slate-600">
                      {t('alerts.demoReferenceRange')}: {getDemoVitalReferenceRange(alert.vitalType, language)}
                    </p>

                    <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-0.5">
                      <span>Value: <strong className="font-mono text-slate-700">{alert.valueRecorded}</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(alert.timestamp).toLocaleTimeString(language === 'ta' ? 'ta-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      {alert.acknowledgedBy && (
                        <>
                          <span>•</span>
                          <span className="text-blue-700 font-medium">
                            {t('alerts.acknowledgedBy', { name: alert.acknowledgedBy })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                  {alert.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => handleAcknowledge(alert.id)}
                      className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                      Acknowledge
                    </button>
                  )}
                  {alert.status === 'acknowledged' && (
                    <button
                      type="button"
                      onClick={() => handleResolve(alert.id)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                    >
                      {t('alerts.resolveAlarm')}
                    </button>
                  )}
                  {alert.status === 'responding' && (
                    <button
                      type="button"
                      onClick={() => handleResolve(alert.id)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                    >
                      {t('alerts.resolveAlarm')}
                    </button>
                  )}
                  {alert.status === 'resolved' && (
                    <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {t('alerts.resolved')}
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
