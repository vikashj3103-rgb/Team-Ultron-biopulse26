import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataStore } from '../../services/dataStore';
import { Patient, Medication } from '../../types';
import { MedicationList } from '../../components/medications/MedicationList';
import { Pill, HeartHandshake } from 'lucide-react';
import { useLanguage } from '../../i18n';

export const AttenderMedicationsPage: React.FC = () => {
  const { assignedAttenderId } = useAuth();
  const { t } = useLanguage();
  const [patient, setPatient] = useState<Patient | undefined>(undefined);
  const [medications, setMedications] = useState<Medication[]>([]);

  useEffect(() => {
    const refresh = () => {
      const p = assignedAttenderId ? dataStore.getPatientByAttender(assignedAttenderId) : undefined;
      setPatient(p);
      if (p) {
        setMedications(dataStore.getMedications(p.id));
      }
    };
    refresh();
    return dataStore.subscribe(refresh);
  }, [assignedAttenderId]);

  if (!patient) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto my-12">
        <HeartHandshake className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">{t('attender.noPatientAssigned')}</h3>
        <p className="text-xs text-slate-500 mt-1">{t('attender.pairAccountSupport')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('attender.medicationScheduleTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('attender.medicationScheduleDescription', { doctor: patient.assignedDoctorName || t('common.doctor'), patient: patient.name })}
          </p>
        </div>

        <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold self-start sm:self-center">
          {t('attender.prescribedMedicationCount', { count: medications.length })}
        </span>
      </div>

      {/* Medication List Component (Attender View) */}
      <MedicationList patientId={patient.id} medications={medications} isAttenderView={true} />
    </div>
  );
};
