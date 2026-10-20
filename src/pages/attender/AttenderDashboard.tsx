import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dataStore } from '../../services/dataStore';
import { clinicalMonitoringService } from '../../services/clinicalMonitoringService';
import { telemetryDiagnosticService, TelemetryDiagnosticState } from '../../services/telemetryDiagnosticService';
import { Patient, PatientRequest, VitalAlert, Medication, DoctorNote, CallRequest, MedicalReport, PatientCareTeamMember } from '../../types';
import { formatTemperatureVal } from '../../utils/temperature';
import { StatusBadge } from '../../components/common/Badge';
import { LiveCamera } from '../../components/camera/LiveCamera';
import { MedicationList } from '../../components/medications/MedicationList';
import { HospitalMapView } from '../../components/navigation/HospitalMapView';
import { hospitalMapService } from '../../services/hospitalMapService';
import { AttenderPatientStatusBanner } from '../../components/alerts/AttenderPatientStatusBanner';
import { useLanguage } from '../../i18n';
import { getLocalizedRelation } from '../../utils/relationTranslator';
import { 
  BedDouble, HeartHandshake, Bell, 
  Activity, Clock, Pill, Stethoscope, Video, CheckCircle2, 
  AlertOctagon, Droplets, Utensils, Zap, HelpCircle, 
  ArrowRight, Heart, Wind, Thermometer,
  Users, FileText 
} from 'lucide-react';

export const AttenderDashboard: React.FC = () => {
  const { assignedAttenderId, currentUser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [patient, setPatient] = useState<Patient | undefined>(undefined);
  const [requests, setRequests] = useState<PatientRequest[]>([]);
  const [alerts, setAlerts] = useState<VitalAlert[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [careTeam, setCareTeam] = useState<PatientCareTeamMember[]>([]);
  const [notes, setNotes] = useState<DoctorNote[]>([]);
  const [calls, setCalls] = useState<CallRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'vitals' | 'requests' | 'medications' | 'camera'>('vitals');
  const [showVitalsGuide, setShowVitalsGuide] = useState<boolean>(false);

  // Hospital map remains dashboard-specific; shared assistance dialogs live in AttenderLayout.
  const [showHospitalMapModal, setShowHospitalMapModal] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [telemetryDiag, setTelemetryDiag] = useState<TelemetryDiagnosticState>(() => telemetryDiagnosticService.getState());

  useEffect(() => {
    return telemetryDiagnosticService.subscribe((diag) => {
      setTelemetryDiag(diag);
    });
  }, []);

  useEffect(() => {
    const refreshData = () => {
      // Attender strictly sees their assigned patient
      let p: Patient | undefined;
      const explicitPatientId = searchParams.get('patientId') || (typeof window !== 'undefined' ? localStorage.getItem('careconnect_active_patient_id') : null);
      if (explicitPatientId) {
        const candidate = dataStore.getPatientById(explicitPatientId);
        if (candidate && !candidate.dischargeDate && (
          candidate.assignedAttenderId === assignedAttenderId ||
          candidate.assignedAttenders?.some((a) => a.attenderId === assignedAttenderId && a.status === 'active')
        )) {
          p = candidate;
        }
      }
      if (!p && assignedAttenderId) {
        const assignedPatients = dataStore.getPatientsByAttender(assignedAttenderId);
        p = assignedPatients.find((pt) => {
          const pAlerts = dataStore.getAlerts(pt.id);
          const hasActiveAlert = pAlerts.some((a) => a.status === 'active' || a.status === 'acknowledged' || a.status === 'responding');
          const hasRecentResolved = pAlerts.some((a) => a.status === 'resolved' && a.resolvedAt && (Date.now() - new Date(a.resolvedAt).getTime() < 300000));
          return hasActiveAlert || hasRecentResolved || pt.status === 'critical' || pt.status === 'attention';
        }) || assignedPatients[0];
      }
      setPatient(p ? { ...p } : undefined);

      if (p) {
        setRequests(dataStore.getRequests(p.id));
        setAlerts(dataStore.getAlerts(p.id));
        setMedications(dataStore.getMedications(p.id));
        setReports(dataStore.getReports(p.id));
        setCareTeam(dataStore.getPatientCareTeam(p.id));
        setNotes(dataStore.getNotes(p.id));
        setCalls(dataStore.getCallRequests(p.id));
      }
    };

    refreshData();
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    const unsub = dataStore.subscribe(refreshData);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [assignedAttenderId]);

  useEffect(() => {
    if (!patient?.id) return;
    const unsubTelemetry = clinicalMonitoringService.subscribePatientTelemetry(patient.id, (newReading) => {
      setPatient((prev) => {
        if (!prev || prev.id !== patient.id) return prev;
        return {
          ...prev,
          latestVitals: { ...newReading },
          status: newReading.status,
          lastVitalUpdate: newReading.timestamp,
        };
      });
      setAlerts(dataStore.getAlerts(patient.id));
    });
    return () => unsubTelemetry();
  }, [patient?.id]);

  if (!patient) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto my-12 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
          <HeartHandshake className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">{t('attender.noPatientAssigned')}</h2>
        <p className="text-xs text-slate-600 leading-relaxed mb-4">
          {t('attender.noPatientLinkedDescription', { name: currentUser?.name || t('role.attender') })}
        </p>
      </div>
    );
  }

  const v = patient.latestVitals;
  const lastUpdateMs = patient?.lastVitalUpdate ? new Date(patient.lastVitalUpdate).getTime() : 0;
  const elapsedSec = Math.max(0, Math.floor((currentTime - lastUpdateMs) / 1000));
  const isTelemetryLive = lastUpdateMs > 0 && elapsedSec <= 15;
  const formattedVitalTime = lastUpdateMs > 0
    ? new Date(lastUpdateMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
    : 'Pending';
  const newRequests = requests
    .filter((r) => r.status === 'NEW')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const inProgressRequests = requests
    .filter((r) => r.status === 'ACKNOWLEDGED')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const attendingDoc = careTeam.find((m) => m.role === 'ATTENDING_PHYSICIAN');
  const surgeon = careTeam.find((m) => m.role === 'SURGEON');
  const anesthesiologist = careTeam.find((m) => m.role === 'ANESTHESIOLOGIST');
  const consultant = careTeam.find((m) => m.role === 'CONSULTANT');
  const nursingTeam = careTeam.find((m) => m.role === 'NURSE');
  const activeMeds = medications.filter((m) => m.status === 'Pending' || m.status === 'Given');
  const verifiedReports = reports.filter((r) => r.status === 'Reviewed' || r.status === 'Final');

  // Determine current active caregiver link
  const currentAttenderLink = patient?.assignedAttenders?.find(
    (a) => a.attenderId === assignedAttenderId || a.attenderName.toLowerCase() === currentUser?.name?.toLowerCase()
  );
  const attenderDisplayName = currentUser?.name || currentAttenderLink?.attenderName || t('nav.familyAttender');
  const attenderRelationRaw = currentAttenderLink?.relation || patient?.assignedAttenderRelation || 'Caregiver';
  const attenderRelation = getLocalizedRelation(attenderRelationRaw, t);

  const handleAcknowledge = (reqId: string) => {
    dataStore.acknowledgeRequest(reqId, `${attenderDisplayName} (${attenderRelation})`);
  };

  const handleResolve = (reqId: string) => {
    dataStore.resolveRequest(reqId, `${attenderDisplayName} (${attenderRelation})`);
  };

  const activeCalls = calls.filter((c) => c.status !== 'RESOLVED' && c.status !== 'CANCELLED');

  const handleCancelCall = (callId: string) => {
    dataStore.updateCallStatus(callId, 'CANCELLED', 'Cancelled by family attender');
  };

  const handleResolveCall = (callId: string) => {
    dataStore.updateCallStatus(callId, 'RESOLVED', 'Assistance received / resolved at bedside');
  };

  const getCallElapsedSeconds = (createdAtIso: string) => {
    return Math.max(0, Math.floor((currentTime - new Date(createdAtIso).getTime()) / 1000));
  };

  const getCallElapsedTime = (createdAtIso: string) => {
    const diffSec = getCallElapsedSeconds(createdAtIso);
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  // Helper for request icons & friendly text
  const getRequestMeta = (type: string) => {
    switch (type) {
      case 'WATER':
        return { label: t('attender.requestWater'), icon: Droplets, color: 'text-cyan-600 bg-cyan-100 border-cyan-300' };
      case 'FOOD':
        return { label: t('attender.requestFood'), icon: Utensils, color: 'text-emerald-600 bg-emerald-100 border-emerald-300' };
      case 'MEDICINE':
        return { label: t('attender.requestMedication'), icon: Pill, color: 'text-blue-600 bg-blue-100 border-blue-300' };
      case 'NURSE':
        return { label: t('attender.requestNurse'), icon: Zap, color: 'text-blue-600 bg-blue-100 border-blue-300' };
      case 'EMERGENCY':
        return { label: t('attender.requestEmergency'), icon: AlertOctagon, color: 'text-red-600 bg-red-100 border-red-300' };
      default:
        return { label: t('attender.requestAssistance'), icon: Bell, color: 'text-amber-600 bg-amber-100 border-amber-300' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time clinical status monitoring banner (Respectful, non-technical, family reassurance) */}
      {(() => {
        const activeAlert = alerts.find((a) => a.status === 'active' || a.status === 'acknowledged' || a.status === 'responding');
        const resolvedAlert = alerts.find((a) => a.status === 'resolved' && a.resolvedAt && (currentTime - new Date(a.resolvedAt).getTime() < 300000));
        const currentAlert = activeAlert || resolvedAlert;
        const linkedCall = calls.find((c) => (currentAlert?.callRequestId && c.id === currentAlert.callRequestId) || c.status === 'RESPONDING');

        if (!currentAlert && !linkedCall && patient.status !== 'critical' && patient.status !== 'attention') {
          return null;
        }

        return (
          <AttenderPatientStatusBanner
            patientName={patient.name}
            room={patient.room}
            bed={patient.bed}
            alert={currentAlert}
            callRequest={linkedCall}
            attenderName={attenderDisplayName}
          />
        );
      })()}

      {/* ACTIVE CALL WAITING / IN-PROGRESS BANNER */}
      {activeCalls.length > 0 && (
        <div className="space-y-3">
          {activeCalls.map((call) => {
            const isWaiting = call.status === 'WAITING';
            const isAssigned = call.status === 'ASSIGNED';
            const isResponding = call.status === 'RESPONDING';
            const isArrived = call.status === 'ARRIVED';
            const elapsed = getCallElapsedTime(call.createdAt);
            const elapsedSec = getCallElapsedSeconds(call.createdAt);

            return (
              <div
                key={call.id}
                className={`rounded-lg border border-l-4 p-4 sm:p-5 ${
                  isWaiting
                    ? 'border-amber-200 border-l-amber-600 bg-amber-50 text-amber-950'
                    : (isAssigned || isResponding)
                    ? 'border-blue-200 border-l-blue-600 bg-blue-50 text-blue-950'
                    : isArrived
                    ? 'border-emerald-200 border-l-emerald-600 bg-emerald-50 text-emerald-950'
                    : 'border-blue-200 border-l-blue-600 bg-blue-50 text-blue-950'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-1.5 ${
                        isWaiting
                          ? 'bg-amber-200 text-amber-900'
                          : (isAssigned || isResponding)
                          ? 'bg-blue-200 text-blue-900'
                          : isArrived
                          ? 'bg-emerald-200 text-emerald-900'
                          : 'bg-blue-200 text-blue-900'
                      }`}>
                        <span className="h-2 w-2 rounded-full bg-current" />
                        {isWaiting
                          ? (elapsedSec >= 10 ? t('attender.staffNotified') : t('attender.requestSent'))
                          : isAssigned
                          ? t('attender.staffResponding')
                          : isArrived
                          ? t('attender.staffArrived')
                          : t('attender.staffResponding')}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/70 border border-slate-300 text-xs font-mono font-bold text-slate-700">
                        {t('attender.priority')}: {t(`call.priority.${call.priority.toLowerCase()}`)}
                      </span>
                      <span className="text-xs text-slate-600 font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {t('attender.elapsed')}: {elapsed}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        {call.reason}
                      </h3>
                      <p className="text-xs text-slate-600">
                        {t('attender.callingForBed')} <strong className="text-slate-900">{call.bed}</strong> ({t('common.room')} {call.room})
                      </p>
                    </div>

                    {/* Assigned staff details - Privacy Preserving: ZERO private phone numbers exposed */}
                    {call.assignedStaffName ? (
                      <div className="p-3 bg-white/80 rounded-xl border border-slate-200 text-xs space-y-1">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>{t('attender.respondingStaff')}: <strong>{call.assignedStaffName}</strong> ({call.assignedStaffRole || t('attender.dutyNurse')})</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {isArrived ? t('attender.staffAtBedside') : t('attender.staffEnRoute')}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-amber-900 font-medium">
                          {t('attender.requestSentAssigningNurse')}
                        </p>
                        {isWaiting && elapsedSec >= 10 && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-950 space-y-2 animate-in fade-in">
                            <div className="flex items-start gap-2.5">
                              <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <p className="font-bold text-red-900">{t('attender.staffNotResponded')}</p>
                                <p className="text-[11px] text-red-800 leading-relaxed">
                                  {t('attender.emergencyDeskMessage')} <strong className="font-mono text-red-950">+91 44 2800 0000</strong> {t('attender.emergencyDeskExtension')} {t('attender.notifyNursingStation')}
                                </p>
                              </div>
                            </div>
                            <div className="pt-1 flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-600 text-white">
                                {t('attender.emergencyAssistance')}
                              </span>
                              <span className="text-[11px] text-red-800">{t('attender.emergencyHotlineActive')}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleResolveCall(call.id)}
                      className="flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {t('attender.nurseArrivedDone')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelCall(call.id)}
                      className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      {t('attender.cancelCall')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 1. REASSURING PATIENT OVERVIEW CARD */}
      <section className="space-y-4 rounded-[var(--radius-panel)] border border-slate-200 bg-white p-4 shadow-[var(--shadow-panel)] sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                {t('attender.caregiver')}: {attenderDisplayName} ({attenderRelation})
              </span>
              {patient.hardwareDeviceId && (
                <span className="text-xs font-medium text-emerald-700">{t('attender.bedsideCallConnected')}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{patient.name}</h1>
              <StatusBadge status={patient.status} size="md" />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600 pt-0.5">
              <span className="flex items-center gap-1 font-medium text-slate-900">
                <BedDouble className="w-3.5 h-3.5 text-blue-600" />
                {t('common.room')} {patient.room} ({patient.bed})
              </span>
              <span>•</span>
              <span>{t('attender.ageYears', { age: patient.age })}</span>
              <span>•</span>
              <span className="text-blue-700 font-medium">{patient.primaryCondition}</span>
            </div>
          </div>

          {/* Attending Physician Card */}
          <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 sm:text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">{t('attender.attendingDoctor')}</span>
            <div className="font-bold text-slate-900 flex items-center sm:justify-end gap-1.5">
              <Stethoscope className="w-4 h-4 text-blue-600" />
              {patient.assignedDoctorName}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">{patient.assignedDoctorSpecialty}</div>
          </div>
        </div>

        {/* 2. URGENT / ACTIVE HARDWARE REQUEST PROMPT (BEDSIDE GLOVE) */}
        {(newRequests.length > 0 || inProgressRequests.length > 0) && (
          <div className="space-y-3 pt-2">
            {newRequests.map((req) => {
              const meta = getRequestMeta(req.requestType);
              const Icon = meta.icon;
              const isEmerg = req.requestType === 'EMERGENCY';
              return (
                <div
                  key={req.id}
                  className={`space-y-3 rounded-lg border p-4 sm:p-5 ${
                    isEmerg
                      ? 'border-red-300 border-l-4 border-l-red-700 bg-red-50'
                      : 'border-amber-200 border-l-4 border-l-amber-600 bg-amber-50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-3 rounded-xl border shrink-0 ${isEmerg ? 'bg-red-600 text-white border-red-700' : meta.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                            isEmerg ? 'bg-red-700 text-white' : 'bg-amber-700 text-white'
                          }`}>
                            {isEmerg ? t('attender.criticalEmergencyCall') : t('attender.newGestureCall')}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h3 className="mt-0.5 truncate text-base font-semibold text-slate-950">
                          {isEmerg ? t('attender.emergencyAssistanceRequest') : `${patient.name} ${meta.label}`}
                        </h3>
                        {isEmerg ? (
                          <div className="text-xs text-red-900 font-medium space-y-0.5">
                            <div><strong>{t('attender.action')}:</strong> {t('attender.nursingTeamRequired')}</div>
                            <div><strong>{t('common.status')}:</strong> {t('attender.escalatedAttendNow', { name: patient.name })}</div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-600">
                            {t('attender.smartGloveRequest')}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAcknowledge(req.id)}
                      className={`min-h-11 w-full shrink-0 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-colors sm:w-auto ${
                        isEmerg ? 'bg-red-600 hover:bg-red-500 ring-2 ring-red-400' : 'bg-blue-600 hover:bg-blue-500'
                      }`}
                    >
                      {isEmerg ? t('attender.acknowledgeEmergency') : t('attender.acknowledgeCall')}
                    </button>
                  </div>
                </div>
              );
            })}

            {inProgressRequests.map((req) => {
              const meta = getRequestMeta(req.requestType);
              const Icon = meta.icon;
              return (
                <div
                  key={req.id}
                  className="bg-blue-50/80 border border-blue-300 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-full shrink-0">
                          {t('attender.inProgress')}
                        </span>
                        <span className="text-xs text-slate-500">
                          {t('attender.acknowledgedBy', { name: req.acknowledgedBy || t('role.attender') })}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5 truncate">
                        {meta.label}
                      </h4>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleResolve(req.id)}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
                  >
                    {t('attender.markHandled')}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. CALM FAMILY-FRIENDLY ALERT BANNER */}
        {activeAlerts.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wide">
                <AlertOctagon className="w-4 h-4 text-amber-600" />
                <span>{t('attender.bedsideCareReminder')}</span>
              </div>
              <span className="text-[11px] text-amber-700 font-semibold">{t('attender.doctorNotified')}</span>
            </div>

            <div className="space-y-1.5">
              {activeAlerts.map((a) => (
                <div key={a.id} className="text-xs text-amber-900 bg-white/80 p-3 rounded-lg border border-amber-200">
                  <p className="font-semibold text-slate-900">{a.familyMessage || a.message}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t('attender.sensor')}: {a.trigger} • {t('attender.nursingStationReceived')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 2. CARE TEAM (CLINICAL CARE TEAM VS AUTHORIZED FAMILY CAREGIVER) */}
      <section className="space-y-3 rounded-[var(--radius-panel)] border border-slate-200 bg-white p-4 shadow-[var(--shadow-panel)] sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">{t('attender.clinicalCareTeam')}</h2>
              <p className="text-xs text-slate-500">{t('attender.careTeamDescription', { name: patient.name })}</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider self-start sm:self-auto">
            {t('attender.hospitalClinicalStaff')}
          </span>
        </div>

        {/* Clinical Care Team Cards - Show ONLY applicable roles (Primary Attending, Surgeon, Anesthesiologist, Consultant, Nurse) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Primary Attending */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">{t('attender.primaryAttending')}</span>
            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
              <span>{attendingDoc?.name || patient.assignedDoctorName}</span>
            </div>
            <div className="text-[11px] text-blue-700 font-medium">
              {attendingDoc?.specialty || patient.assignedDoctorSpecialty || t('attender.internalMedicine')}
            </div>
            {attendingDoc?.department && (
              <div className="text-[10px] text-slate-500">{attendingDoc.department} {t('common.department')}</div>
            )}
          </div>

          {/* Operating Surgeon - only if applicable */}
          {surgeon && (
            <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 space-y-1">
              <span className="text-[10px] uppercase font-bold text-blue-500 block tracking-wider">{t('attender.operatingSurgeon')}</span>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                <span>{surgeon.name}</span>
              </div>
              <div className="text-[11px] text-blue-700 font-medium">
                {surgeon.specialty || t('attender.surgery')}
              </div>
              {surgeon.notes && (
                <div className="text-[10px] text-slate-600 italic">{surgeon.notes}</div>
              )}
            </div>
          )}

          {/* Anesthesiologist - only if applicable */}
          {anesthesiologist && (
            <div className="p-3 rounded-xl border border-teal-200 bg-teal-50/50 space-y-1">
              <span className="text-[10px] uppercase font-bold text-teal-600 block tracking-wider">{t('attender.anesthesiologist')}</span>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                <span>{anesthesiologist.name}</span>
              </div>
              <div className="text-[11px] text-teal-700 font-medium">
                {anesthesiologist.specialty || t('attender.anesthesiology')}
              </div>
              {anesthesiologist.notes && (
                <div className="text-[10px] text-slate-600 italic">{anesthesiologist.notes}</div>
              )}
            </div>
          )}

          {/* Specialist Consultant - only if applicable */}
          {consultant && (
            <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 space-y-1">
              <span className="text-[10px] uppercase font-bold text-blue-600 block tracking-wider">{t('attender.specialistConsultant')}</span>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                <span>{consultant.name}</span>
              </div>
              <div className="text-[11px] text-blue-700 font-medium">
                {consultant.specialty || consultant.department || t('attender.consultant')}
              </div>
            </div>
          )}

          {/* Ward Nursing Team - only if applicable */}
          {nursingTeam && (
            <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-600 block tracking-wider">{t('attender.wardNursingTeam')}</span>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
                <span>{nursingTeam.name}</span>
              </div>
              <div className="text-[11px] text-emerald-700 font-medium">
                {nursingTeam.department || t('attender.inpatientNursingStation')}
              </div>
            </div>
          )}
        </div>

        {/* Distinct Authorized Family Caregiver (Non-Clinical Role) */}
        <div className="mt-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t('attender.authorizedFamilyCaregiver')}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {t('attender.nonClinicalSupport')}
              </span>
            </div>
            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4 text-emerald-600" />
              <span>{attenderDisplayName}</span>
              <span className="text-xs font-normal text-slate-500">({attenderRelation})</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 max-w-md sm:text-right">
            {t('attender.familySupportScope')}
          </p>
        </div>
      </section>

      {/* 3. CURRENT HEALTH OVERVIEW */}
      <section className="space-y-4 rounded-[var(--radius-panel)] border border-slate-200 bg-white p-4 shadow-[var(--shadow-panel)] sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">{t('attender.currentHealthOverview')}</h2>
              <p className="text-xs text-slate-500">
                {t('attender.overviewDescription')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              {t('attender.activeMonitoring')}
            </span>
            <button
              type="button"
              onClick={() => setShowVitalsGuide(true)}
              className="flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 hover:text-blue-900"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{t('common.guide')}</span>
            </button>
          </div>
        </div>

        {/* Development Telemetry Diagnostic Bar */}
        {import.meta.env.DEV && (
          <div
            data-testid="telemetry-diagnostic-panel"
            className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs font-mono text-blue-900 shadow-xs flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-md bg-blue-600 text-white">
                DEV DIAGNOSTIC
              </span>
              <span>
                Telemetry source: <strong className={telemetryDiag.source === 'CONNECTED' ? 'text-emerald-700 font-bold' : 'text-amber-700'}>{telemetryDiag.source}</strong>
              </span>
              <span>•</span>
              <span>
                Patient: <strong className="font-bold text-slate-900">{patient.id} ({patient.name})</strong>
              </span>
              <span>•</span>
              <span>
                Last Event ID: <strong className="font-bold text-blue-800">#{telemetryDiag.lastEventId || 0}</strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Packets Rx: <strong className="font-bold text-blue-900">{telemetryDiag.packetsReceived}</strong>
              </span>
              <span>•</span>
              <span>
                Packets Applied: <strong className="font-bold text-emerald-800">{telemetryDiag.packetsApplied}</strong>
              </span>
              <span>•</span>
              <span className="font-semibold text-slate-700">
                Last packet: <strong>{telemetryDiag.lastPacketTime ? `${Math.max(0, Math.floor((currentTime - telemetryDiag.lastPacketTime) / 100) / 10)}s ago` : 'None'}</strong>
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* A. Vitals Snapshot */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3" data-tour="attender-vitals">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                {t('attender.latestVitals')}
              </span>
              <div className="flex items-center gap-2">
                <span
                  data-testid="attender-telemetry-status-badge"
                  className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    isTelemetryLive
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-amber-700 bg-amber-50 border-amber-200'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isTelemetryLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  {isTelemetryLive
                    ? `LIVE · ${elapsedSec < 2 ? 'just now' : `${elapsedSec}s ago`}`
                    : `STALE · ${elapsedSec}s ago`}
                </span>
                <span className="text-[10px] text-slate-400 font-mono" data-testid="attender-vitals-time">
                  {formattedVitalTime}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-white border border-slate-200/80" data-testid="attender-vital-card-pulse">
                <span className="text-[10px] text-slate-400 block font-medium">{t('attender.heartRate')}</span>
                <span className="text-sm font-extrabold text-slate-900" data-testid="attender-vital-pulse">{v.pulse} bpm</span>
                <span className="text-[10px] text-slate-500 block">{t('attender.normalHeartRate')}</span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-slate-200/80" data-testid="attender-vital-card-bp">
                <span className="text-[10px] text-slate-400 block font-medium">{t('attender.bloodPressure')}</span>
                <span className="text-sm font-extrabold text-slate-900" data-testid="attender-vital-bp">{v.systolicBP}/{v.diastolicBP}</span>
                <span className="text-[10px] text-slate-500 block">mmHg</span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-slate-200/80" data-testid="attender-vital-card-spo2">
                <span className="text-[10px] text-slate-400 block font-medium">{t('attender.oxygen')}</span>
                <span className="text-sm font-extrabold text-slate-900" data-testid="attender-vital-spo2">{v.spO2}%</span>
                <span className="text-[10px] text-slate-500 block">{t('attender.oxygenTarget')}</span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-slate-200/80" data-testid="attender-vital-card-temp">
                <span className="text-[10px] text-slate-400 block font-medium">{t('attender.temperature')}</span>
                <span className="text-sm font-extrabold text-slate-900" data-testid="attender-vital-temp">{formatTemperatureVal(v.temperature)} °F</span>
                <span className="text-[10px] text-slate-500 block">{t('attender.normalTemperature')}</span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-slate-200/80 col-span-2 sm:col-span-1" data-testid="attender-vital-card-rr">
                <span className="text-[10px] text-slate-400 block font-medium">{t('vitals.respiratoryRate')}</span>
                <span className="text-sm font-extrabold text-slate-900" data-testid="attender-vital-rr">{v.respiratoryRate ?? 18} {t('vitals.breathsPerMin')}</span>
                <span className="text-[10px] text-slate-500 block">{t('vitals.normalRR')}</span>
              </div>
            </div>
          </div>

          {/* B. Medication Schedule Summary */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5 text-blue-600" />
                {t('attender.todaysMedications', { count: activeMeds.length })}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('medications')}
                className="flex min-h-11 items-center gap-0.5 rounded-md px-2 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-50 hover:text-blue-900"
              >
                <span>{t('common.viewAll')}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs max-h-36 overflow-y-auto pr-1">
              {activeMeds.slice(0, 3).map((med) => (
                <div key={med.id} className="p-2 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 truncate block">{med.name} {med.dosage}</span>
                    <span className="text-[10px] text-slate-500">{med.scheduledTime || med.frequency} • {med.route}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    med.status === 'Given' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {med.status === 'Given' ? t('medication.statusGiven') : t('medication.statusPending')}
                  </span>
                </div>
              ))}
              {activeMeds.length === 0 && (
                <p className="text-[11px] text-slate-500 p-2">{t('attender.noActiveMedicationsToday')}</p>
              )}
            </div>
          </div>

          {/* C. Recent Verified Reports */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                {t('attender.verifiedReports', { count: verifiedReports.length })}
              </span>
              <button
                type="button"
                onClick={() => navigate('/attender/reports')}
                className="flex min-h-11 items-center gap-0.5 rounded-md px-2 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-50 hover:text-blue-900"
              >
                <span>{t('attender.allReports')}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {verifiedReports.length === 0 ? (
              <div className="p-2.5 rounded-lg bg-white border border-dashed border-slate-200 text-center text-xs text-slate-500">
                <p className="font-medium text-slate-700">{t('attender.noVerifiedReports')}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {t('attender.reportsAppearAfterReview')}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 text-xs max-h-36 overflow-y-auto pr-1">
                {verifiedReports.slice(0, 3).map((rep) => (
                  <div key={rep.id} className="p-2 rounded-lg bg-white border border-slate-200/80 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-slate-900 truncate">{rep.title}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                        {t('attender.verified')}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center justify-between">
                      <span>{rep.reportType}</span>
                      <span>{new Date(rep.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. MOBILE-FRIENDLY TABS */}
      <div className="flex border-b border-slate-200 bg-white p-1 rounded-xl gap-1 shadow-2xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('vitals')}
          className={`flex min-h-11 flex-1 min-w-[110px] items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors ${
            activeTab === 'vitals'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          {t('attender.healthNumbers')}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`relative flex min-h-11 flex-1 min-w-[110px] items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors ${
            activeTab === 'requests'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          {t('attender.gloveCalls', { count: requests.length })}
          {newRequests.length > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-600"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('medications')}
          className={`flex min-h-11 flex-1 min-w-[110px] items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors ${
            activeTab === 'medications'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Pill className="w-3.5 h-3.5" />
          {t('attender.medications')}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('camera')}
          className={`flex min-h-11 flex-1 min-w-[110px] items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors ${
            activeTab === 'camera'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          {t('attender.liveCamera')}
        </button>
      </div>

      {/* TAB 1: HEALTH NUMBERS (VITALS) WITH "WHAT DOES THIS MEAN?" */}
      {activeTab === 'vitals' && (
        <div className="space-y-6">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-panel)] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-950">{t('attender.currentVitals')}</h2>
                  <span
                    data-testid="attender-current-vitals-badge"
                    className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                      isTelemetryLive
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : 'text-amber-700 bg-amber-50 border-amber-200'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isTelemetryLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    {isTelemetryLive
                      ? `LIVE · ${elapsedSec < 2 ? 'just now' : `${elapsedSec}s ago`}`
                      : `STALE · ${elapsedSec}s ago`}
                  </span>
                </div>
                <p className="text-sm text-slate-600" data-testid="attender-bedside-readings-subtitle">
                  {t('attender.latestBedsideReadings')} · <span className="font-mono font-medium text-slate-800">{formattedVitalTime}</span>
                </p>
              </div>

              {/* "What Does This Mean?" Explainer Trigger Button */}
              <button
                type="button"
                onClick={() => setShowVitalsGuide(true)}
                className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
              >
                <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                <span>{t('attender.whatDoTheseMean')}</span>
              </button>
            </div>

            {/* 4 Friendly Vital Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Pulse */}
              <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <span>{t('attender.heartRate')}</span>
                </div>
                <div className="text-2xl font-black font-mono text-slate-900" data-testid="attender-current-pulse">
                  {v.pulse} <span className="text-xs font-normal text-slate-500">bpm</span>
                </div>
                <div className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{v.pulse >= 60 && v.pulse <= 100 ? t('attender.steadyBeat') : t('attender.mildVariation')}</span>
                </div>
              </div>

              {/* BP */}
              <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <span>{t('attender.bloodPressure')}</span>
                </div>
                <div className="text-2xl font-black font-mono text-slate-900" data-testid="attender-current-bp">
                  {v.systolicBP}/{v.diastolicBP}
                </div>
                <div className="text-[11px] font-medium text-slate-600">
                  {v.systolicBP > 140 ? t('attender.slightlyHigh') : t('attender.normalRange')}
                </div>
              </div>

              {/* SpO2 */}
              <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-700">
                  <Wind className="w-4 h-4 text-cyan-500" />
                  <span>{t('attender.oxygen')}</span>
                </div>
                <div className="text-2xl font-black font-mono text-slate-900" data-testid="attender-current-spo2">
                  {v.spO2}%
                </div>
                <div className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{v.spO2 >= 95 ? t('attender.healthyOxygen') : t('attender.nurseMonitoring')}</span>
                </div>
              </div>

              {/* Temp */}
              <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                  <Thermometer className="w-4 h-4 text-amber-500" />
                  <span>{t('attender.temperature')}</span>
                </div>
                <div className="text-2xl font-black font-mono text-slate-900" data-testid="attender-current-temp">
                  {formatTemperatureVal(v.temperature)} <span className="text-xs font-normal text-slate-500">°F</span>
                </div>
                <div className="text-[11px] font-medium text-slate-600">
                  {v.temperature >= 39
                    ? t('attender.temperatureHighFever', { value: formatTemperatureVal(v.temperature) })
                    : v.temperature >= 37.8
                    ? t('attender.temperatureElevated', { value: formatTemperatureVal(v.temperature) })
                    : v.temperature < 35.5
                    ? t('attender.temperatureLow', { value: formatTemperatureVal(v.temperature) })
                    : t('attender.temperatureTarget', { value: formatTemperatureVal(v.temperature) })}
                </div>
              </div>
            </div>
          </div>

          {/* Doctor Bedside Guidance for Family */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-panel)] sm:p-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Stethoscope className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">{t('attender.doctorGuidance')}</h3>
            </div>

            {notes.length === 0 ? (
              <div className="py-3 text-sm text-slate-600">{t('attender.noGuidanceShared')}</div>
            ) : (
              <div className="space-y-2.5">
                {notes.map((n) => (
                  <div key={n.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-bold text-slate-800">{n.doctorName}</span>
                      <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed font-medium">{n.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: HARDWARE GESTURE CALLS */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">{t('attender.bedsideAssistanceLog')}</h3>
              <p className="text-xs text-slate-500">{t('attender.gestureCallHistory')}</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800">
              {t('attender.totalCalls', { count: requests.length })}
            </span>
          </div>

          {requests.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400">
              {t('attender.noGloveCallsToday')}
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const meta = getRequestMeta(req.requestType);
                const Icon = meta.icon;
                return (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${meta.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{meta.label}</div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {(req.acknowledgedBy || req.resolvedBy) && ` • Handled by ${req.acknowledgedBy || req.resolvedBy}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {req.status === 'NEW' && (
                        <button
                          type="button"
                          onClick={() => handleAcknowledge(req.id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
                        >
                          {t('requests.actionAcknowledge')}
                        </button>
                      )}
                      {req.status === 'ACKNOWLEDGED' && (
                        <button
                          type="button"
                          onClick={() => handleResolve(req.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold"
                        >
                          {t('requests.actionResolve')}
                        </button>
                      )}
                      {req.status === 'RESOLVED' && (
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 font-semibold text-[11px]">
                          {t('requests.statusResolved')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MEDICATION SCHEDULE */}
      {activeTab === 'medications' && (
        <MedicationList patientId={patient.id} medications={medications} isAttenderView={true} />
      )}

      {/* TAB 4: BEDSIDE LIVE CAMERA */}
      {activeTab === 'camera' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">{t('camera.title')}</h3>
            <p className="text-xs text-slate-500">
              {t('camera.guidance', { room: patient.room, bed: patient.bed })}
            </p>
          </div>

          <LiveCamera
            patientName={patient.name}
            roomNumber={patient.room}
            bedNumber={patient.bed}
          />
        </div>
      )}

      {/* "WHAT DOES THIS MEAN?" REASSURING MODAL */}
      {showVitalsGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">{t('attender.vitalsGuide.title')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowVitalsGuide(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-slate-600 leading-relaxed">
              {t('attender.vitalsGuide.intro')}
            </p>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200/80">
                <strong className="text-rose-900 block font-bold mb-0.5">{t('attender.vitalsGuide.heartRateTitle')}</strong>
                <p className="text-slate-700">
                  {t('attender.vitalsGuide.heartRateDesc')}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80">
                <strong className="text-blue-900 block font-bold mb-0.5">{t('attender.vitalsGuide.bpTitle')}</strong>
                <p className="text-slate-700">
                  {t('attender.vitalsGuide.bpDesc')}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-cyan-50/60 border border-cyan-200/80">
                <strong className="text-cyan-900 block font-bold mb-0.5">{t('attender.vitalsGuide.spO2Title')}</strong>
                <p className="text-slate-700">
                  {t('attender.vitalsGuide.spO2Desc')}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80">
                <strong className="text-amber-900 block font-bold mb-0.5">{t('attender.vitalsGuide.tempTitle')}</strong>
                <p className="text-slate-700">
                  {t('attender.vitalsGuide.tempDesc')}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowVitalsGuide(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold cursor-pointer"
              >
                {t('attender.vitalsGuide.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE 2D HOSPITAL MAP MODAL */}
      {showHospitalMapModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-5xl my-auto">
            <HospitalMapView
              initialOriginId={patient?.room ? (hospitalMapService.findNodeByQuery(patient.room)?.id || 'ROOM_ICU_204') : 'ROOM_ICU_204'}
              initialDestinationId="ROOM_11002"
              onClose={() => setShowHospitalMapModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
