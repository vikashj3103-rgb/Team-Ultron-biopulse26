import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getClinicalWorkspacePatients } from '../../services/patientScopeService';
import { dataStore } from '../../services/dataStore';
import { PatientRequest } from '../../types';
import { HardwareRequestCard } from '../../components/requests/HardwareRequestCard';
import { Bell, CheckCircle2, Clock } from 'lucide-react';
import { useLanguage } from '../../i18n';

export const DoctorRequestsPage: React.FC = () => {
  const { assignedDoctorId, currentUser } = useAuth();
  const { t } = useLanguage();
  const [requests, setRequests] = useState<PatientRequest[]>([]);

  useEffect(() => {
    const refresh = () => {
      const docPatients = getClinicalWorkspacePatients(currentUser?.role, assignedDoctorId);
      const patientIds = new Set(docPatients.map((p) => p.id));
      const reqList = patientIds.size > 0 
        ? Array.from(patientIds).flatMap((pid) => dataStore.getRequests(pid))
        : [];
      reqList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRequests(reqList);
    };

    refresh();
    return dataStore.subscribe(refresh);
  }, [assignedDoctorId, currentUser?.role]);

  const newRequests = requests.filter((r) => r.status === 'NEW');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('requests.smartGloveTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('requests.doctorSmartGloveSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {newRequests.length > 0 && (
            <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-xs font-bold">
              {t('requests.pendingBadge', { count: newRequests.length })}
            </span>
          )}
          <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-semibold">
            {t('requests.totalBadge', { count: requests.length })}
          </span>
        </div>
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400">
          {t('requests.noRequests')}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <HardwareRequestCard key={req.id} request={req} showPatientDetails={true} />
          ))}
        </div>
      )}
    </div>
  );
};
