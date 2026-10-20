import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataStore } from '../../services/dataStore';
import { Patient } from '../../types';
import { StatusBadge } from '../../components/common/Badge';
import { 
  User, BedDouble, Stethoscope, Phone, Calendar, 
  HeartHandshake, ShieldCheck, CheckCircle2, CircleHelp 
} from 'lucide-react';
import { useLanguage } from '../../i18n';

export const AttenderPatientInfoPage: React.FC = () => {
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
        <p className="text-sm text-slate-600 mt-1">{t('reports.noReportsLinkedDesc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('attender.patientInfo.title')}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('attender.patientInfo.subtitle', { name: patient.name })}
          </p>
        </div>

        <StatusBadge status={patient.status} size="md" />
      </div>

      {/* Main Info Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        {/* Top Demographics */}
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xl border border-emerald-200">
            {patient.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">{patient.name}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>MRN: <strong className="font-mono text-slate-700">{patient.mrn}</strong></span>
              <span>•</span>
              <span>{t('attender.patientInfo.yearsOld', { age: patient.age })}</span>
              <span>•</span>
              <span>{patient.gender}</span>
              <span>•</span>
              <span>{t('attender.patientInfo.bloodGroup', { group: patient.bloodGroup })}</span>
            </div>
          </div>
        </div>

        {/* Grid Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Room & Bed */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              {t('attender.patientInfo.locationTitle')}
            </span>
            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <BedDouble className="w-4 h-4 text-blue-600" />
              <span>{t('attender.patientInfo.roomBed', { room: patient.room, bed: patient.bed })}</span>
            </div>
            <p className="text-slate-500 text-[11px]">{t('attender.patientInfo.ward', { dept: patient.department })}</p>
          </div>

          {/* Patient condition */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              {t('attender.patientInfo.conditionTitle')}
            </span>
            <div className="font-bold text-slate-900 text-sm">
              {patient.primaryCondition}
            </div>
            <p className="text-slate-500 text-[11px]">{t('attender.patientInfo.telemetryActive')}</p>
          </div>

          {/* Attending Physician */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              {t('attender.patientInfo.attendingDoctorTitle')}
            </span>
            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4 text-blue-600" />
              <span>{patient.assignedDoctorName}</span>
            </div>
            <p className="text-blue-700 text-[11px] font-semibold">{patient.assignedDoctorSpecialty}</p>
          </div>

          {/* Bedside assistance status */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              {t('attender.patientInfo.callButtonTitle')}
            </span>
            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              {patient.hardwareDeviceId
                ? <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                : <CircleHelp className="w-4 h-4 text-amber-700" />}
              <span>{patient.hardwareDeviceId ? t('attender.patientInfo.callButtonConnected') : t('attender.patientInfo.callButtonNotLinked')}</span>
            </div>
            <p className="text-slate-600 text-[11px]">{t('attender.patientInfo.callButtonHelp')}</p>
          </div>
        </div>

        {/* Clinical Care Team Roster */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-blue-600" />
                {t('attender.patientInfo.multidisciplinaryTitle')}
              </h3>
              <p className="text-[11px] text-slate-500">
                {t('attender.patientInfo.multidisciplinaryDesc', { name: patient.name })}
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {t('attender.patientInfo.clinicalTeamBadge')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {dataStore.getPatientCareTeam(patient.id).map((member) => (
              <div
                key={member.id}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">{member.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      member.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {member.status}
                  </span>
                </div>
                <div className="text-blue-700 font-semibold text-[11px]">
                  {member.role === 'ATTENDING_PHYSICIAN'
                    ? 'Primary Attending Physician'
                    : member.role === 'SURGEON'
                    ? 'Operating Surgeon'
                    : member.role === 'ANESTHESIOLOGIST'
                    ? 'Anesthesiologist'
                    : member.role === 'CONSULTANT'
                    ? 'Specialist Consultant'
                    : member.role === 'NURSE'
                    ? 'Ward Nursing Team'
                    : member.role.replace(/_/g, ' ')}
                </div>
                <div className="text-[11px] text-slate-500">
                  {member.specialty ? `${member.specialty} • ` : ''}
                  {member.department || patient.department}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clinical Context / Doctor Notes */}
        {patient.notes && (
          <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/80 text-xs text-blue-900 leading-relaxed">
            <strong className="block mb-0.5">{t('attender.patientInfo.recoveryContext')}</strong>
            {patient.notes}
          </div>
        )}

        {/* Distinct Non-Clinical Family Attenders & Caregivers */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              {t('attender.patientInfo.familyCaregiverTitle')}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {t('attender.patientInfo.familyAttenderBadge')}
            </span>
          </div>

          <div className="space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
              <HeartHandshake className="w-4 h-4 text-emerald-600" />
              <span>{patient.assignedAttenderName || 'Vikash Kumar'}</span>
              <span className="text-xs font-normal text-slate-500">
                ({patient.assignedAttenderRelation || 'Family Caregiver'})
              </span>
            </div>
            <p className="text-slate-600 text-[11px]">
              {t('attender.patientInfo.emergencyContact', { contact: patient.emergencyContact || '+91 98765 43210' })}
            </p>
            <p className="text-slate-600 text-[11px]">
              {t('attender.patientInfo.emergencyDesk', { phone: '+91 44 2800 0000 (Ext 108)' })}
            </p>
            <p className="text-[11px] text-slate-400">
              {t('attender.patientInfo.familyScope')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
