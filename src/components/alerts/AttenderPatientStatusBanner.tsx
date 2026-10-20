import React, { useState, useEffect } from 'react';
import { VitalAlert, CallRequest } from '../../types';
import { dataStore } from '../../services/dataStore';
import { getClinicalPresentationState } from '../../utils/clinicalPresentation';
import { AlertTriangle, AlertOctagon, CheckCircle2, UserCheck, Heart } from 'lucide-react';

interface AttenderPatientStatusBannerProps {
  patientName: string;
  room: string;
  bed: string;
  alert?: VitalAlert;
  callRequest?: CallRequest;
  attenderName?: string;
}

export const AttenderPatientStatusBanner: React.FC<AttenderPatientStatusBannerProps> = ({
  patientName,
  room,
  bed,
  alert,
  callRequest,
  attenderName,
}) => {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!alert && !callRequest) return null;

  const timeoutSec = dataStore.getDemoAlertTimeoutSeconds?.() || 30;
  const presentation = getClinicalPresentationState(alert, timeoutSec, now);

  // Determine stage based on alert or linked call request with strict precedence
  const isResolved = presentation.isResolved || (callRequest && callRequest.status === 'RESOLVED');
  const isResponding = !isResolved && (presentation.isResponding || (callRequest && callRequest.status === 'RESPONDING'));
  const isAcknowledged = !isResolved && !isResponding && (presentation.isAcknowledged || (callRequest && callRequest.status === 'ASSIGNED'));
  const isActive = !isResolved && !isResponding && !isAcknowledged && (presentation.isActive || (callRequest && (callRequest.status === 'WAITING' || callRequest.status === 'ACKNOWLEDGED')));

  const isEscalated = presentation.isEscalated;
  const isTimeoutExceeded = presentation.isEmergencyTimeoutExceeded;
  const canEscalate = presentation.emergencyEscalationAllowed;

  const handleEmergencyEscalate = () => {
    if (alert) {
      dataStore.escalateAlertToEmergency(
        alert.id,
        attenderName || 'Vikash Kumar (Family Caregiver)',
        `Attender escalated unacknowledged critical alert (${alert.vitalType})`
      );
    }
  };

  return (
    <section
      role="status"
      aria-live="polite"
      className={`rounded-2xl border p-4 sm:p-5 shadow-xs space-y-3 transition-all ${
        isResolved
          ? 'border-emerald-300 bg-emerald-50/80 text-emerald-950'
          : isResponding
          ? 'border-blue-300 bg-blue-50/80 text-blue-950'
          : isAcknowledged
          ? 'border-amber-300 bg-amber-50/80 text-amber-950'
          : isEscalated || isTimeoutExceeded
          ? 'border-red-300 bg-red-50/90 text-red-950'
          : 'border-amber-300 bg-amber-50/80 text-amber-950'
      }`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-black/10">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 block">
            PATIENT STATUS
          </span>
          <h2 className="text-base sm:text-lg font-bold text-slate-950">
            {patientName} <span className="text-xs font-normal text-slate-600">({room} / {bed})</span>
          </h2>
        </div>

        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
          isResolved
            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
            : isResponding
            ? 'bg-blue-100 text-blue-900 border-blue-300'
            : isAcknowledged
            ? 'bg-amber-100 text-amber-900 border-amber-300'
            : isEscalated
            ? 'bg-red-600 text-white border-red-700'
            : isTimeoutExceeded
            ? 'bg-red-100 text-red-900 border-red-300'
            : 'bg-amber-100 text-amber-900 border-amber-300'
        }`}>
          {isResolved
            ? 'Care Completed'
            : isResponding
            ? 'Staff Responding'
            : isAcknowledged
            ? 'Reviewed by Physician'
            : isEscalated
            ? '🚨 Escalated to Emergency'
            : isTimeoutExceeded
            ? '⚠️ Unacknowledged'
            : 'Under Active Care'}
        </span>
      </div>

      {/* Stage: ACTIVE -> Medical team notified */}
      {isActive && (
        <div className="space-y-3">
          {/* Default active notification */}
          {!isTimeoutExceeded && !isEscalated && (
            <div className="p-3.5 rounded-xl bg-white border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-extrabold text-sm text-slate-900">
                  ⚠️ Medical team has been notified.
                </p>
                <p className="text-slate-600">
                  The hospital clinical team has been automatically alerted and is reviewing your loved one’s room.
                </p>
                {presentation.isCritical && (
                  <p className="text-[11px] text-amber-800 pt-1">
                    Waiting for clinician acknowledgement ({presentation.elapsedSeconds}s / {timeoutSec}s demo timeout)...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Unacknowledged timeout exceeded -> Emergency escalation button */}
          {canEscalate && (
            <div className="p-4 rounded-xl bg-red-100/90 border border-red-300 text-xs text-red-950 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertOctagon className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold text-sm text-red-950">
                    ⚠️ Medical team has not acknowledged this critical alert.
                  </p>
                  <p className="text-red-900 text-[11px] leading-relaxed">
                    The clinical team has been notified but has not acknowledged the alert within the expected response window ({timeoutSec}s).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleEmergencyEscalate}
                className="w-full py-3 px-4 bg-[#DC2626] hover:bg-red-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>Call Hospital Emergency</span>
              </button>
            </div>
          )}

          {/* Already Escalated */}
          {isEscalated && (
            <div className="p-4 rounded-xl bg-red-600 text-white text-xs space-y-1.5 shadow-xs">
              <div className="flex items-center gap-2 font-black text-sm">
                <AlertOctagon className="w-5 h-5 text-white" />
                <span>🚨 Emergency Escalation Requested</span>
              </div>
              <p className="text-[11px] text-red-100 leading-relaxed pl-7">
                Emergency response team has been alerted for Room {room} ({bed}). Immediate bedside intervention is initiated.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stage: ACKNOWLEDGED -> Doctor reviewed, assistance initiated */}
      {isAcknowledged && (
        <div className="p-3.5 rounded-xl bg-white border border-amber-200 text-xs text-slate-800 space-y-2">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-slate-900">
                Attending physician has reviewed the patient status.
              </p>
              <p className="text-slate-600">
                Nurse assistance has been coordinated for bedside care.
              </p>
            </div>
          </div>
          {presentation.escalatedBeforeAcknowledgement && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-900 font-medium">
              Note: Emergency escalation was requested before clinician acknowledgement. Medical staff has now reviewed and taken charge.
            </div>
          )}
        </div>
      )}

      {/* Stage: RESPONDING -> Nurse assistance: Responding */}
      {isResponding && (
        <div className="p-3.5 rounded-xl bg-white border border-blue-200 text-xs text-blue-950 space-y-1.5">
          <div className="flex items-center gap-2 font-extrabold text-sm text-blue-950">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse" />
            <span>Nurse assistance: Responding</span>
          </div>
          <div className="flex items-center gap-2 text-blue-900 font-semibold pl-4">
            <UserCheck className="w-4 h-4 text-blue-700 shrink-0" />
            <span>
              {alert?.respondingBy || callRequest?.assignedStaffName || 'Nurse Priya'} is on the way to {room} to attend to {patientName}.
            </span>
          </div>
        </div>
      )}

      {/* Stage: RESOLVED -> Nurse is attending the patient */}
      {isResolved && (
        <div className="p-3.5 rounded-xl bg-white border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-extrabold text-sm text-emerald-950">
              ✓ Nurse is attending the patient.
            </p>
            <p className="text-slate-600">
              Bedside care has been provided. All vital signs are stable and continuously monitored by the clinical team.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
