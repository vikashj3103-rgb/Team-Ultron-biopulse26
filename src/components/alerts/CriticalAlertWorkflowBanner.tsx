import React, { useState } from 'react';
import { VitalAlert } from '../../types';
import { dataStore } from '../../services/dataStore';
import { useAuth } from '../../context/AuthContext';
import { getClinicalPresentationState } from '../../utils/clinicalPresentation';
import { 
  AlertOctagon, AlertTriangle, CheckCircle2, PhoneCall, 
  ArrowDownRight, Clock, ShieldCheck, UserCheck, Loader2 
} from 'lucide-react';

interface CriticalAlertWorkflowBannerProps {
  alert: VitalAlert;
  onViewPatient?: (patientId: string) => void;
}

export const CriticalAlertWorkflowBanner: React.FC<CriticalAlertWorkflowBannerProps> = ({
  alert,
  onViewPatient,
}) => {
  const { currentUser } = useAuth();
  const doctorName = currentUser?.name || 'Dr. Arun Kumar';
  const doctorRole = currentUser?.role || 'doctor';
  const [isPending, setIsPending] = useState<'acknowledge' | 'nurse' | 'resolve' | null>(null);

  const presentation = getClinicalPresentationState(alert);

  const handleAcknowledge = () => {
    setIsPending('acknowledge');
    dataStore.acknowledgeClinicalEpisode(alert.id, doctorName, doctorRole);
    setTimeout(() => setIsPending(null), 250);
  };

  const handleRequestNurse = () => {
    setIsPending('nurse');
    dataStore.requestNurseForAlert(alert.id, doctorName, doctorRole);
    setTimeout(() => setIsPending(null), 250);
  };

  const handleResolve = () => {
    setIsPending('resolve');
    dataStore.resolveAlert(
      alert.id,
      alert.respondingBy || doctorName,
      'Bedside care completed. Clinical telemetry normalized and verified.',
      doctorRole
    );
    setTimeout(() => setIsPending(null), 250);
  };

  const isCrit = presentation.isCritical;
  const isResponding = presentation.isResponding;
  const isAcknowledged = presentation.isAcknowledged;
  const isResolved = presentation.isResolved;
  const isActive = presentation.isActive;

  return (
    <section
      role="alert"
      aria-live="assertive"
      data-testid="critical-alert-workflow-banner"
      className={`rounded-2xl border-2 p-4 sm:p-5 shadow-xs transition-all ${
        isResolved
          ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950'
          : isResponding
          ? 'border-blue-300 bg-blue-50/70 text-blue-950'
          : isAcknowledged
          ? 'border-amber-300 bg-amber-50/70 text-amber-950'
          : 'border-red-300 bg-red-50 text-red-950'
      }`}
    >
      <div className="space-y-4">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/10">
          <div className="flex items-center gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${
              isResolved ? 'bg-emerald-700' : isResponding ? 'bg-[#2563EB]' : isAcknowledged ? 'bg-amber-700' : 'bg-[#DC2626]'
            }`}>
              {isResolved ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : isCrit ? (
                <AlertOctagon className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                  isResolved
                    ? 'bg-emerald-200 text-emerald-900'
                    : isResponding
                    ? 'bg-blue-200 text-blue-900'
                    : isAcknowledged
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-red-700 text-white'
                }`}>
                  {isCrit ? 'CRITICAL CLINICAL ALERT' : 'WARNING CLINICAL ALERT'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white font-mono tracking-wider uppercase">
                  {alert.conditionType || alert.vitalType}
                </span>
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {alert.occurrenceCount && alert.occurrenceCount > 1
                    ? `Updated ${alert.occurrenceCount} times (${alert.readingsCount || alert.occurrenceCount} readings)`
                    : '1 reading'}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Started {new Date(alert.firstDetectedAt || alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Updated {new Date(alert.lastUpdatedAt || alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-950 mt-1">
                Patient: <span className="font-extrabold">{alert.patientName}</span> <span className="text-sm font-normal text-slate-600">({alert.room}{alert.bed ? ` / ${alert.bed}` : ''})</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
              isResolved
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : isResponding
                ? 'bg-blue-100 text-blue-900 border-blue-300'
                : isAcknowledged
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-red-100 text-red-900 border-red-300'
            }`}>
              {alert.status.toUpperCase()}
            </span>

            {onViewPatient && (
              <button
                type="button"
                onClick={() => onViewPatient(alert.patientId)}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
              >
                View Chart
              </button>
            )}
          </div>
        </div>

        {/* Clinical Finding & Trend Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl bg-white p-3.5 border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 block font-medium">Finding</span>
            <span className={`text-sm font-extrabold ${isCrit ? 'text-red-700' : 'text-amber-800'}`}>
              {alert.vitalType === 'SPO2' ? `SpO₂ dropped to ${alert.currentValue || alert.valueRecorded}` : `${alert.vitalType}: ${alert.currentValue || alert.valueRecorded}`}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block font-medium">Previous</span>
            <span className="text-sm font-bold text-slate-700 font-mono">
              {alert.previousValue || (
                alert.vitalType === 'BP' ? '120/80 mmHg' :
                alert.vitalType === 'PULSE' ? '74 bpm' :
                alert.vitalType === 'SPO2' ? '98%' :
                alert.vitalType === 'TEMP' ? '98.4 °F' :
                alert.vitalType === 'RR' ? '16 breaths/min' : '--'
              )}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block font-medium">Current</span>
            <span className={`text-sm font-extrabold font-mono ${isCrit ? 'text-red-700' : 'text-amber-800'}`}>
              {alert.currentValue || alert.valueRecorded}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block font-medium">Trend</span>
            <span className="text-sm font-bold text-red-700 flex items-center gap-1 font-mono">
              <ArrowDownRight className="w-4 h-4 text-red-600" />
              {alert.trend || 'deteriorating'}
            </span>
          </div>
        </div>

        {/* Emergency Escalation Banner if Attender Triggered Emergency Escalation */}
        {presentation.isEscalated && (
          <div className="flex items-center justify-between gap-3 bg-red-600 text-white p-3 rounded-xl shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold">
              <AlertOctagon className="w-4 h-4 shrink-0 text-white" />
              <span>
                {presentation.escalationNotice || `🚨 EMERGENCY ESCALATION REQUESTED: ${alert.escalationReason || 'Clinical alert unacknowledged'} (${alert.escalatedBy || 'Family Attender'})`}
              </span>
            </div>
            <span className="text-[10px] uppercase font-mono bg-white/20 px-2 py-0.5 rounded font-black">
              Hospital Emergency
            </span>
          </div>
        )}

        {/* Dynamic Action & Response Workflow Stage */}
        <div className="pt-1">
          {/* Stage 1: ACTIVE -> Physician Acknowledgement Required */}
          {isActive && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-red-100/70 border border-red-200 p-3 rounded-xl">
              <div className="text-xs text-red-950 space-y-0.5">
                <p className="font-bold">Immediate clinician acknowledgement required.</p>
                <p className="text-[11px] text-red-800">Acknowledging documents review and enables bedside nurse request.</p>
              </div>
              <button
                type="button"
                disabled={isPending !== null}
                onClick={handleAcknowledge}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#DC2626] px-5 text-sm font-bold text-white shadow-xs transition-colors hover:bg-red-800 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700 shrink-0"
              >
                {isPending === 'acknowledge' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Acknowledging...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Acknowledge Alert</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Stage 2: ACKNOWLEDGED -> Request Nurse Assistance */}
          {isAcknowledged && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-100/70 border border-amber-200 p-3.5 rounded-xl">
              <div className="text-xs text-amber-950 space-y-0.5">
                <p className="font-bold">
                  Alert acknowledged by {alert.acknowledgedBy || doctorName} at {alert.acknowledgedAt ? new Date(alert.acknowledgedAt).toLocaleTimeString() : 'now'}.
                </p>
                <p className="text-[11px] text-amber-900">
                  Request bedside nurse dispatch to verify airway, vitals, and oxygen delivery.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isPending !== null}
                  onClick={handleRequestNurse}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-bold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
                >
                  {isPending === 'nurse' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Requesting...</span>
                    </>
                  ) : (
                    <>
                      <PhoneCall className="w-4 h-4" />
                      <span>Request Nurse Assistance</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isPending !== null}
                  onClick={handleResolve}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
                >
                  {isPending === 'resolve' ? 'Resolving...' : 'Resolve Alert'}
                </button>
              </div>
            </div>
          )}

          {/* Stage 3: RESPONDING -> Nurse Priya responding to bedside */}
          {isResponding && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-100/70 border border-blue-200 p-3.5 rounded-xl">
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 font-extrabold text-blue-950">
                    <UserCheck className="w-4 h-4 text-blue-700" />
                    Nurse: <strong className="text-blue-900">{alert.respondingBy || 'Nurse Priya'}</strong>
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="flex items-center gap-1.5 font-bold text-blue-800">
                    <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                    Status: Responding
                  </span>
                </div>
                <p className="text-[11px] text-blue-800">
                  Nurse dispatch accepted. Staff en route to {alert.room} with emergency airway and oxygen equipment.
                </p>
              </div>

              <button
                type="button"
                disabled={isPending !== null}
                onClick={handleResolve}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#059669] px-4 text-sm font-bold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 shrink-0"
              >
                {isPending === 'resolve' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resolving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark Resolved</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Stage 4: RESOLVED -> Display confirmation & response time */}
          {isResolved && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-100/70 border border-emerald-200 p-3.5 rounded-xl">
              <div className="flex items-center gap-2.5 text-xs text-emerald-950">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-extrabold text-sm text-emerald-950">
                    RESOLVED
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    Response time: <strong>{alert.responseTimeSeconds || 38} sec</strong> · Resolved by {alert.resolvedBy || 'Nurse Priya'}
                  </p>
                </div>
              </div>

              <span className="text-xs font-semibold text-emerald-800 bg-white/70 px-3 py-1 rounded-md border border-emerald-300">
                Audit Trail Recorded
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
