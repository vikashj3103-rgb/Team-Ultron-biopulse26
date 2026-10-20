import React, { useState } from 'react';
import { VitalAlert } from '../../types';
import { StatusBadge } from '../common/Badge';
import { AlertOctagon, CheckCircle2, Clock, MessageSquare, ShieldAlert } from 'lucide-react';
import { dataStore } from '../../services/dataStore';
import { useAuth } from '../../context/AuthContext';

interface AlertListProps {
  alerts: VitalAlert[];
  onUpdated?: () => void;
  showPatientRoom?: boolean;
}

export const AlertList: React.FC<AlertListProps> = ({
  alerts,
  onUpdated,
  showPatientRoom = true,
}) => {
  const { currentUser } = useAuth();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState<string>('');

  const handleAcknowledge = (alertId: string) => {
    const actor = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Assigned Clinician';
    dataStore.acknowledgeAlert(alertId, actor, currentUser?.role || 'attender');
    onUpdated?.();
  };

  const handleResolveSubmit = (e: React.FormEvent, alertId: string) => {
    e.preventDefault();
    const actor = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Assigned Clinician';
    dataStore.resolveAlert(alertId, actor, resolveNote, currentUser?.role || 'attender');
    setResolvingId(null);
    setResolveNote('');
    onUpdated?.();
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            Vital & Telemetry Alerts
          </h3>
          <p className="text-xs text-slate-500">Automated threshold triggers requiring clinical assessment</p>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
          {alerts.filter((a) => a.status === 'active').length} Active
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-6 text-xs text-emerald-600 flex items-center justify-center gap-1.5 font-medium">
          <CheckCircle2 className="w-4 h-4" />
          All vitals currently within configured baseline thresholds.
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            return (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border transition-all ${
                  alert.status === 'active'
                    ? isCritical
                      ? 'bg-red-50/70 border-red-300 ring-2 ring-red-400/30'
                      : 'bg-amber-50/70 border-amber-300'
                    : 'bg-slate-50/60 border-slate-200 opacity-80'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={alert.severity} size="sm" />
                    {showPatientRoom && (
                      <span className="text-xs font-bold text-slate-900">
                        {alert.patientName} ({alert.room})
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {formatTimestamp(alert.timestamp)}
                  </span>
                </div>

                {/* Message */}
                <p className="text-xs font-medium text-slate-800 leading-relaxed mb-2">
                  {alert.message}
                </p>

                {/* Value Recorded & Notifications Dispatched */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mb-3 bg-white/70 p-2 rounded-lg border border-slate-200/60">
                  <span>
                    Value: <strong className="font-mono text-slate-800">{alert.valueRecorded}</strong>
                  </span>
                  <span>•</span>
                  <span className="text-blue-700 font-medium">Doctor Notified</span>
                  <span>•</span>
                  <span className="text-amber-700 font-medium">Attender Notified</span>
                </div>

                {/* Resolve note input if open */}
                {resolvingId === alert.id && (
                  <form
                    onSubmit={(e) => handleResolveSubmit(e, alert.id)}
                    className="mt-2 mb-3 bg-white p-3 rounded-lg border border-slate-300 space-y-2 animate-fadeIn"
                  >
                    <label className="block text-[11px] font-semibold text-slate-700">
                      Clinical Resolution Note:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Bedside assessment completed; anti-hypertensive administered..."
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                      required
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setResolvingId(null)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  </form>
                )}

                {/* Status and Action Buttons */}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-slate-500">
                    {alert.acknowledgedAt && (
                      <span className="text-blue-700 font-medium">
                        ✓ Acknowledged by {alert.acknowledgedBy}
                      </span>
                    )}
                    {alert.resolvedAt && (
                      <span className="text-emerald-700 font-medium ml-2">
                        ✓ Resolved ({alert.resolvedBy})
                      </span>
                    )}
                  </div>

                  {alert.status === 'active' && currentUser?.role === 'doctor' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(alert.id)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                      >
                        Acknowledge
                      </button>
                      <button
                        type="button"
                        onClick={() => setResolvingId(alert.id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Resolve & Note
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
