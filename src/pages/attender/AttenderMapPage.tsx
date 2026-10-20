import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataStore } from '../../services/dataStore';
import { hospitalMapService } from '../../services/hospitalMapService';
import { Patient } from '../../types';
import { HospitalMapView } from '../../components/navigation/HospitalMapView';
import { Compass, HeartHandshake } from 'lucide-react';
import { useLanguage } from '../../i18n';

export const AttenderMapPage: React.FC = () => {
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

  const patientOriginId = patient.room
    ? (hospitalMapService.findNodeByQuery(patient.room)?.id || 'ROOM_ICU_204')
    : 'ROOM_ICU_204';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('map.title')}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase">
              {t('map.routingBadge')}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t('map.subtitle', { name: patient.name, room: patient.room, bed: patient.bed })}
          </p>
        </div>

        <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-semibold self-start sm:self-center flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-blue-600" />
          <span>{t('map.originRoom', { room: patient.room })}</span>
        </span>
      </div>

      {/* Embedded 2D Map View */}
      <HospitalMapView
        initialOriginId={patientOriginId}
        initialDestinationId="ROOM_11002"
      />
    </div>
  );
};
