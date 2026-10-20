import React from 'react';
import { PatientRequest } from '../../types';
import { RequestTypeBadge, RequestStatusBadge } from '../common/Badge';
import { Clock, CheckCircle2, UserCheck, AlertCircle, Sparkles } from 'lucide-react';
import { dataStore } from '../../services/dataStore';
import { useAuth } from '../../context/AuthContext';

interface HardwareRequestCardProps {
  request: PatientRequest;
  onUpdated?: () => void;
  showPatientDetails?: boolean;
}

export const HardwareRequestCard: React.FC<HardwareRequestCardProps> = ({
  request,
  onUpdated,
  showPatientDetails = true,
}) => {
  const { currentUser } = useAuth();

  const formattedTime = (() => {
    try {
      const d = new Date(request.timestamp);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return request.timestamp;
    }
  })();

  const handleAcknowledge = () => {
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Assigned Attender';
    dataStore.acknowledgeRequest(request.id, actorName);
    onUpdated?.();
  };

  const handleResolve = () => {
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Assigned Attender';
    dataStore.resolveRequest(request.id, actorName);
    onUpdated?.();
  };

  const isEmergency = request.requestType === 'EMERGENCY';

  return (
    <div
      className={`rounded-xl border p-4 shadow-sm transition-all ${
        isEmergency
          ? 'bg-red-50/70 border-red-300 ring-2 ring-red-400/40'
          : request.status === 'NEW'
          ? 'bg-amber-50/50 border-amber-300 shadow-amber-100/50'
          : request.status === 'ACKNOWLEDGED'
          ? 'bg-blue-50/30 border-blue-200'
          : 'bg-white border-slate-200 opacity-90'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RequestTypeBadge type={request.requestType} size="md" />
          {request.status === 'NEW' && !isEmergency && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> Incoming Hardware Trigger
            </span>
          )}
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      {/* Emergency Escalation High-Priority Banner (Section 11) */}
      {isEmergency && (
        <div className="bg-red-600 text-white p-3.5 rounded-xl mb-3 shadow-md border border-red-700">
          <div className="flex items-center gap-2 font-black text-sm tracking-wide">
            <span className="text-base">🚨</span> EMERGENCY ASSISTANCE REQUEST
          </div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium">
            <div>Patient: <strong className="text-white underline">{request.patientName}</strong></div>
            <div>Room: <strong>{request.room} ({request.bed})</strong></div>
            <div>Action: <span className="bg-white text-red-700 px-2 py-0.5 rounded font-black text-[11px]">NURSING TEAM REQUIRED</span></div>
            <div>Status: <span className="bg-red-950 text-white px-2 py-0.5 rounded font-bold uppercase text-[11px] border border-red-800">ESCALATED</span></div>
          </div>
        </div>
      )}

      {/* Main Info */}
      <div className="space-y-1 mb-3">
        {showPatientDetails && (
          <div className="flex items-baseline justify-between">
            <h4 className="text-base font-bold text-slate-900">{request.patientName}</h4>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
              {request.room} • {request.bed}
            </span>
          </div>
        )}
        <p className="text-xs text-slate-600 leading-relaxed">
          {request.notes || `Patient requested ${request.requestType} via smart glove residual gesture.`}
        </p>
      </div>

      {/* Timestamp & Workflow Tracking */}
      <div className="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-100 mb-3">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>Requested: <strong>{formattedTime}</strong></span>
        </div>

        {request.acknowledgedAt && (
          <div className="flex items-center gap-1 text-blue-700">
            <UserCheck className="w-3 h-3 text-blue-600" />
            <span>Acknowledged by {request.acknowledgedBy}</span>
          </div>
        )}

        {request.resolvedAt && (
          <div className="flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Resolved by {request.resolvedBy}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {request.status === 'NEW' && (
          <>
            <button
              type="button"
              onClick={handleAcknowledge}
              className="flex-1 min-h-11 py-2 px-3 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <UserCheck className="w-4 h-4" />
              ACKNOWLEDGE
            </button>
            <button
              type="button"
              onClick={handleResolve}
              className="min-h-11 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-all"
            >
              Resolve
            </button>
          </>
        )}

        {request.status === 'ACKNOWLEDGED' && (
          <button
            type="button"
            onClick={handleResolve}
            className="w-full min-h-11 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <CheckCircle2 className="w-4 h-4" />
            RESOLVE REQUEST
          </button>
        )}

        {request.status === 'RESOLVED' && (
          <div className="w-full py-1 text-center text-xs text-emerald-700 font-medium flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Assistance complete
          </div>
        )}
      </div>
    </div>
  );
};
