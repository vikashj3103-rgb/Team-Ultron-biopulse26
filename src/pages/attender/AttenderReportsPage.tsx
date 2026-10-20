import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataStore } from '../../services/dataStore';
import { Patient, MedicalReport } from '../../types';
import { MedicalReportsList } from '../../components/reports/MedicalReportsList';
import { FileText, HeartHandshake, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../i18n';

export const AttenderReportsPage: React.FC = () => {
  const { assignedAttenderId } = useAuth();
  const { t } = useLanguage();
  const [patient, setPatient] = useState<Patient | undefined>(undefined);
  const [reports, setReports] = useState<MedicalReport[]>([]);

  useEffect(() => {
    const refresh = () => {
      const p = assignedAttenderId ? dataStore.getPatientByAttender(assignedAttenderId) : undefined;
      setPatient(p);
      if (p) {
        setReports(dataStore.getReports(p.id));
      }
    };
    refresh();
    return dataStore.subscribe(refresh);
  }, [assignedAttenderId]);

  if (!patient) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto my-12">
        <HeartHandshake className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">{t('reports.noReportsLinked')}</h3>
        <p className="text-xs text-slate-500 mt-1">{t('reports.noReportsLinkedDesc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider">
              Caregiver Reference
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('reports.diagnosticTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('reports.diagnosticSubtitle', { name: patient.name, doctor: patient.assignedDoctorName || 'Dr. Arun Kumar' })}
          </p>
        </div>

        <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-semibold self-start sm:self-center">
          {t('reports.verifiedCount', { count: reports.length })}
        </span>
      </div>

      {/* Info Notice for Attender */}
      <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-emerald-800 leading-relaxed mt-0.5">
            {t('reports.caregiverNotice')}
          </p>
        </div>
      </div>

      {/* Reports List (Read-only for Attender) */}
      <MedicalReportsList reports={reports} patientId={patient.id} allowAdd={false} />
    </div>
  );
};
