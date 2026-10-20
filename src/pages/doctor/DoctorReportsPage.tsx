import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getClinicalWorkspacePatients } from '../../services/patientScopeService';
import { dataStore } from '../../services/dataStore';
import { MedicalReport } from '../../types';
import { MedicalReportsList } from '../../components/reports/MedicalReportsList';
import { FileText } from 'lucide-react';
import { useLanguage } from '../../i18n';

export const DoctorReportsPage: React.FC = () => {
  const { assignedDoctorId, currentUser } = useAuth();
  const { t } = useLanguage();
  const [reports, setReports] = useState<MedicalReport[]>([]);

  useEffect(() => {
    const refresh = () => {
      const docPatients = getClinicalWorkspacePatients(currentUser?.role, assignedDoctorId);
      const patientIds = new Set(docPatients.map((p) => p.id));
      const repList = patientIds.size > 0 
        ? Array.from(patientIds).flatMap((pid) => dataStore.getReports(pid))
        : [];
      repList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setReports(repList);
    };

    refresh();
    return dataStore.subscribe(refresh);
  }, [assignedDoctorId, currentUser?.role]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('reports.diagnosticTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('reports.doctorDiagnosticSubtitle')}
          </p>
        </div>

        <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-semibold self-start sm:self-center">
          {t('reports.verifiedCount', { count: reports.length })}
        </span>
      </div>

      {/* Reports List */}
      <MedicalReportsList reports={reports} />
    </div>
  );
};
