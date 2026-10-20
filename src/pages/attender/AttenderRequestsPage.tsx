import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataStore } from '../../services/dataStore';
import { Patient, PatientRequest } from '../../types';
import { 
  Bell, Droplets, Utensils, Pill, Zap, AlertOctagon, 
  CheckCircle2, Clock, HeartHandshake 
} from 'lucide-react';
import { useLanguage } from '../../i18n';

export const AttenderRequestsPage: React.FC = () => {
  const { assignedAttenderId, currentUser } = useAuth();
  const { t } = useLanguage();
  const [patient, setPatient] = useState<Patient | undefined>(undefined);
  const [requests, setRequests] = useState<PatientRequest[]>([]);

  useEffect(() => {
    const refresh = () => {
      const p = assignedAttenderId ? dataStore.getPatientByAttender(assignedAttenderId) : undefined;
      setPatient(p);
      if (p) {
        setRequests(
          dataStore.getRequests(p.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        );
      }
    };
    refresh();
    return dataStore.subscribe(refresh);
  }, [assignedAttenderId]);

  const handleAcknowledge = (id: string) => {
    dataStore.acknowledgeRequest(id, currentUser?.name || 'Vikash Kumar');
  };

  const handleResolve = (id: string) => {
    dataStore.resolveRequest(id, currentUser?.name || 'Vikash Kumar');
  };

  const getRequestMeta = (type: string) => {
    switch (type) {
      case 'WATER':
        return { label: 'Needs Water', icon: Droplets, color: 'text-cyan-600 bg-cyan-100 border-cyan-300' };
      case 'FOOD':
        return { label: 'Needs Food / Meal', icon: Utensils, color: 'text-emerald-600 bg-emerald-100 border-emerald-300' };
      case 'MEDICINE':
        return { label: 'Needs Medication', icon: Pill, color: 'text-blue-600 bg-blue-100 border-blue-300' };
      case 'NURSE':
        return { label: 'Nurse Assistance Requested', icon: Zap, color: 'text-blue-600 bg-blue-100 border-blue-300' };
      case 'EMERGENCY':
        return { label: 'URGENT ASSISTANCE NEEDED', icon: AlertOctagon, color: 'text-red-600 bg-red-100 border-red-300' };
      default:
        return { label: 'Assistance Call', icon: Bell, color: 'text-amber-600 bg-amber-100 border-amber-300' };
    }
  };

  if (!patient) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto my-12">
        <HeartHandshake className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">{t('reports.noReportsLinked')}</h3>
        <p className="text-xs text-slate-500 mt-1">{t('reports.noReportsLinkedDesc')}</p>
      </div>
    );
  }

  const activeCalls = requests.filter((r) => r.status !== 'RESOLVED');

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('requests.smartGloveTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('requests.attenderSmartGloveSubtitle', { room: patient.room })}
          </p>
        </div>

        <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold self-start sm:self-center">
          {t('requests.pendingBadge', { count: activeCalls.length })} • {t('requests.totalBadge', { count: requests.length })}
        </span>
      </div>

      {/* Requests Feed */}
      {requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400">
          {t('requests.noRequests')}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const meta = getRequestMeta(req.requestType);
            const Icon = meta.icon;
            const isNew = req.status === 'NEW';
            const isAck = req.status === 'ACKNOWLEDGED';

            return (
              <div
                key={req.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  isNew
                    ? 'bg-amber-50/90 border-amber-400 shadow-sm'
                    : isAck
                    ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className={`p-3 rounded-xl border shrink-0 ${meta.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isNew ? 'bg-red-600 text-white' : isAck ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {req.status}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-slate-900">
                        {patient.name} {meta.label}
                      </h3>

                      <p className="text-xs text-slate-600">
                        {req.notes || 'Smart glove finger movement detected at bedside.'}
                      </p>

                      {(req.acknowledgedBy || req.resolvedBy) && (
                        <div className="text-[11px] text-slate-400 pt-1">
                          {req.acknowledgedBy && <span>Acknowledged by {req.acknowledgedBy} • </span>}
                          {req.resolvedBy && <span>Resolved by {req.resolvedBy}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    {isNew && (
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(req.id)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                      >
                        {t('requests.actionAcknowledge')}
                      </button>
                    )}

                    {isAck && (
                      <button
                        type="button"
                        onClick={() => handleResolve(req.id)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                      >
                        {t('requests.actionResolve')}
                      </button>
                    )}

                    {req.status === 'RESOLVED' && (
                      <span className="text-xs font-bold text-slate-500 px-3 py-1.5 rounded-lg bg-slate-100 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        {t('requests.statusResolved')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
