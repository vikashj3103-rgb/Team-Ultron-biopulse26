import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataStore } from '../../services/dataStore';
import { Patient } from '../../types';
import { LiveCamera } from '../../components/camera/LiveCamera';
import { Video, HeartHandshake } from 'lucide-react';
import { useLanguage } from '../../i18n';

export const AttenderCameraPage: React.FC = () => {
  const { assignedAttenderId } = useAuth();
  const { t } = useLanguage();
  const [patient, setPatient] = useState<Patient | undefined>(undefined);

  useEffect(() => {
    const refresh = () => {
      const p = assignedAttenderId ? dataStore.getPatientByAttender(assignedAttenderId) : undefined;
      setPatient(p);
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
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('camera.title')}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('camera.description', { name: patient.name, room: patient.room, bed: patient.bed })}
          </p>
        </div>

        <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold self-start sm:self-center">
          {t('camera.badge')}
        </span>
      </div>

      {/* Embedded Live Camera Component */}
      <LiveCamera
        patientName={patient.name}
        roomNumber={patient.room}
        bedNumber={patient.bed}
      />
    </div>
  );
};
