import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dataStore } from '../../services/dataStore';
import { clinicalMonitoringService } from '../../services/clinicalMonitoringService';
import { demoSimulationService } from '../../services/demoSimulationService';
import { HardwareEventService } from '../../services/hardwareEventService';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n';
import { 
  Patient, VitalAlert, PatientRequest, Medication, MedicalReport, DoctorNote, TimelineEvent,
  PatientCareTeamMember, Procedure, Investigation, DischargePlan, InpatientAdmission
} from '../../types';
import { StatusBadge } from '../../components/common/Badge';
import { VitalCard } from '../../components/vitals/VitalCard';
import { VitalHistoryChart } from '../../components/vitals/VitalHistoryChart';
import { formatTemperatureVal, FAHRENHEIT_NORMAL_RANGE_TEXT } from '../../utils/temperature';
import { LiveCamera } from '../../components/camera/LiveCamera';
import { HardwareRequestCard } from '../../components/requests/HardwareRequestCard';
import { AlertList } from '../../components/alerts/AlertList';
import { MedicationList } from '../../components/medications/MedicationList';
import { MedicalReportsList } from '../../components/reports/MedicalReportsList';
import { DoctorNotesList } from '../../components/notes/DoctorNotesList';
import { PatientTimeline } from '../../components/timeline/PatientTimeline';
import { PatientSummaryTab } from '../../components/patient/PatientSummaryTab';
import { ClinicalReportModal } from '../../components/reports/ClinicalReportModal';
import { AiClinicalSummaryModal } from '../../components/patient/AiClinicalSummaryModal';
import { 
  ArrowLeft, BedDouble, UserCheck, Stethoscope, Clock, ShieldAlert, 
  Video, Activity, Pill, FileText, Bell, Sparkles, CheckCircle2, 
  LayoutDashboard, User, AlertTriangle, Printer, Users, Calendar, 
  CheckSquare, ClipboardList, MapPin, HeartHandshake, Play, Pause, Zap, RefreshCw
} from 'lucide-react';

export const PatientDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canAccessPatient, role } = useAuth();
  const { t } = useLanguage();

  const [patient, setPatient] = useState<Patient | undefined>(() => (id ? dataStore.getPatientById(id) : undefined));
  const [alerts, setAlerts] = useState<VitalAlert[]>([]);
  const [requests, setRequests] = useState<PatientRequest[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [notes, setNotes] = useState<DoctorNote[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [careTeam, setCareTeam] = useState<PatientCareTeamMember[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [admissions, setAdmissions] = useState<InpatientAdmission[]>([]);
  const [dischargePlan, setDischargePlan] = useState<DischargePlan | undefined>(undefined);
  
  // Dedicated Patient Workspace Tabs as specified by requirements
  const [activeTab, setActiveTab] = useState<'overview' | 'summary' | 'careteam' | 'reports' | 'medications' | 'vitals' | 'timeline' | 'procedures' | 'investigations' | 'discharge' | 'careai'>('overview');
  const [showClinicalReportModal, setShowClinicalReportModal] = useState<boolean>(false);
  const [showAiSummaryModal, setShowAiSummaryModal] = useState<boolean>(false);
  const [isSimRunning, setIsSimRunning] = useState<boolean>(() => 
    id ? clinicalMonitoringService.isSimulationRunning(id) : false
  );

  useEffect(() => {
    if (!id) return;

    // Strict access control check
    if (!canAccessPatient(id) && role !== 'admin') {
      return;
    }

    const refreshData = () => {
      const p = dataStore.getPatientById(id);
      setPatient(p);
      setAlerts(dataStore.getAlerts(id));
      setRequests(dataStore.getRequests(id));
      setMedications(dataStore.getMedications(id));
      setReports(dataStore.getReports(id));
      setNotes(dataStore.getNotes(id));
      setTimeline(dataStore.getTimeline(id));
      setCareTeam(dataStore.getPatientCareTeam(id));
      setProcedures(dataStore.getProcedures(id));
      setInvestigations(dataStore.getInvestigations(id));
      setAdmissions(dataStore.getInpatientAdmissions(id));
      setDischargePlan(dataStore.getDischargePlan(id));
    };

    refreshData();
    const unsubStore = dataStore.subscribe(refreshData);

    // Sync simulation status for this specific patient
    const unsubSimStatus = demoSimulationService.subscribeStatus(() => {
      if (id) {
        setIsSimRunning(demoSimulationService.isPatientRunning(id));
      }
    });

    // Real-time patient telemetry subscription (appends incoming reading smoothly to chart & updates vitals)
    const unsubTelemetry = clinicalMonitoringService.subscribePatientTelemetry(id, (newReading) => {
      setPatient((prev) => {
        if (!prev || prev.id !== id) return prev;
        const updatedHistory = [...(prev.vitalsHistory || []), newReading].slice(-30);
        return {
          ...prev,
          latestVitals: newReading,
          status: newReading.status,
          lastVitalUpdate: newReading.timestamp,
          vitalsHistory: updatedHistory,
        };
      });
      setAlerts(dataStore.getAlerts(id));
      setTimeline(dataStore.getTimeline(id));
    });

    return () => {
      unsubStore();
      unsubSimStatus();
      unsubTelemetry();
    };
  }, [id, canAccessPatient, role]);

  const handleToggleStream = () => {
    if (!id) return;
    if (isSimRunning) {
      clinicalMonitoringService.stopSimulation(id);
      setIsSimRunning(false);
    } else {
      clinicalMonitoringService.startSimulation(id);
      setIsSimRunning(true);
    }
  };

  const handleSimulateVitals = async (scenario: 'normal' | 'critical_bp' | 'low_spo2') => {
    if (!id) return;
    let payload = {};
    switch (scenario) {
      case 'normal':
        payload = { systolic: 120, diastolic: 80, pulse: 74, spO2: 98, temperature: 36.8 };
        break;
      case 'critical_bp':
        payload = { systolic: 178, diastolic: 112, pulse: 116, spO2: 94, temperature: 37.9 };
        break;
      case 'low_spo2':
        payload = { systolic: 130, diastolic: 85, pulse: 104, spO2: 88, temperature: 37.2 };
        break;
    }
    await HardwareEventService.simulateVitalChange(id, payload);
  };

  const handleStatusChange = (newStatus: 'stable' | 'attention' | 'critical' | 'high') => {
    if (!id) return;
    dataStore.updatePatient(id, { status: newStatus });
  };

  const handleDischarge = () => {
    if (!patient || !id) return;
    if (confirm(t('patient.confirmDischarge', { name: patient.name, room: patient.room, bed: patient.bed }))) {
      dataStore.dischargePatient(id);
      navigate('/doctor');
    }
  };

  if (!id || (!canAccessPatient(id) && role !== 'admin')) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center max-w-lg mx-auto my-12 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">{t('patient.accessRestricted')}</h2>
        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          {t('patient.accessRestrictedDescription')}
        </p>
        <button
          type="button"
          onClick={() => navigate(role === 'attender' ? '/attender' : '/doctor')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
        >
          {t('patient.returnToPortal')}
        </button>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-16 text-slate-400 text-sm">
        {t('patient.recordNotFound')}
      </div>
    );
  }

  const v = patient.latestVitals;
  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const pendingRequests = requests.filter((r) => r.status !== 'RESOLVED');

  const renderTelemetryControlBar = () => {
    if (!patient) return null;
    const formattedLastUpdate = (() => {
      try {
        const d = new Date(patient.latestVitals.timestamp);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      } catch {
        return patient.latestVitals.timestamp;
      }
    })();

    return (
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm"
        data-testid="bedside-telemetry-bar"
      >
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className={`w-3 h-3 rounded-full ${isSimRunning ? 'bg-emerald-500 animate-ping' : 'bg-amber-400'}`} />
            <span className={`absolute w-2.5 h-2.5 rounded-full ${isSimRunning ? 'bg-emerald-400' : 'bg-amber-500'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Bedside Telemetry Stream
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/60 font-semibold">
                {patient.hardwareDeviceId || 'GLOVE-ESP32-DEV01'}
              </span>
              <span
                data-testid="stream-status-badge"
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  isSimRunning
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isSimRunning ? 'LIVE STREAMING' : 'STANDBY'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Telemetry scoped to <strong className="text-slate-200">{patient.name}</strong> ({patient.room} / {patient.bed}) • Last packet: <span className="font-mono text-slate-300" data-testid="last-telemetry-packet">{formattedLastUpdate}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            data-testid="toggle-telemetry-stream-btn"
            onClick={handleToggleStream}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
              isSimRunning
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
            }`}
          >
            {isSimRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" /> Pause Stream
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Resume Stream
              </>
            )}
          </button>

          <div className="h-5 w-px bg-slate-700 hidden sm:block" />

          <span className="text-[10px] font-bold uppercase text-slate-400 hidden lg:inline">Inject Event:</span>

          <button
            type="button"
            data-testid="inject-critical-bp-btn"
            onClick={() => handleSimulateVitals('critical_bp')}
            className="px-2.5 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800/80 font-semibold text-[11px] flex items-center gap-1 transition-colors"
            title="Inject Hypertensive Crisis (178/112 mmHg)"
          >
            <Zap className="w-3 h-3 text-red-400" />
            BP Spike (178/112)
          </button>

          <button
            type="button"
            data-testid="inject-low-spo2-btn"
            onClick={() => handleSimulateVitals('low_spo2')}
            className="px-2.5 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-200 border border-cyan-800/80 font-semibold text-[11px] flex items-center gap-1 transition-colors"
            title="Inject Hypoxemia / Desaturation (SpO2 88%)"
          >
            <Zap className="w-3 h-3 text-cyan-400" />
            SpO2 Drop (88%)
          </button>

          <button
            type="button"
            data-testid="inject-normal-vitals-btn"
            onClick={() => handleSimulateVitals('normal')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-[11px] flex items-center gap-1 transition-colors"
            title="Restore Normal Baseline (120/80 mmHg)"
          >
            <RefreshCw className="w-3 h-3 text-slate-400" />
            Normal
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Back button & Clinical Alert Status Indicators */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/doctor')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('patient.backToRegistry')}</span>
        </button>

        <div className="flex items-center gap-2">
          {activeAlerts.length > 0 && (
            <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
              <ShieldAlert className="w-3.5 h-3.5" />
              {t('patient.activeAlertCount', { count: activeAlerts.length })}
            </span>
          )}
          {pendingRequests.length > 0 && (
            <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
              <Bell className="w-3.5 h-3.5" />
              {t('patient.pendingAssistanceCount', { count: pendingRequests.length })}
            </span>
          )}
        </div>
      </div>

      <div className="sticky top-0 z-20 -mx-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-y border-slate-200 bg-white/95 px-3 py-2 shadow-2xs backdrop-blur-sm sm:-mx-3 sm:px-4" aria-label={t('patient.currentIdentity')}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="max-w-full truncate text-base font-bold text-slate-950 sm:text-lg">{patient.name}</h1>
          <StatusBadge status={patient.status} size="sm" />
          <span className="font-mono text-xs font-semibold text-slate-600">MRN {patient.mrn}</span>
          <span className="text-xs text-slate-600">{patient.age}y · {patient.gender} · {patient.currentLocation?.ward || patient.department} · {t('common.room')} {patient.room}, {patient.bed}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="font-medium">{patient.assignedDoctorName}</span>
          <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-700">{admissions[0]?.status || t('patient.admitted')}</span>
        </div>
      </div>

      {/* 1. PATIENT WORKSPACE HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-700">
            <span className="w-full text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('patient.operationalInformation')}</span>
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('patient.attendingPhysician')}</span>
              <span className="font-semibold text-slate-900 flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                {patient.assignedDoctorName}
              </span>
            </div>
            {careTeam.some((m) => m.role === 'SURGEON') && (
              <>
                <div className="h-6 w-px bg-slate-200 hidden sm:block" />
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-blue-500 block">{t('patient.surgeon')}</span>
                  <span className="font-semibold text-slate-900 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    {careTeam.find((m) => m.role === 'SURGEON')?.name}
                  </span>
                </div>
              </>
            )}
            {careTeam.some((m) => m.role === 'ANESTHESIOLOGIST') && (
              <>
                <div className="h-6 w-px bg-slate-200 hidden sm:block" />
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-teal-600 block">{t('patient.anesthesiologist')}</span>
                  <span className="font-semibold text-slate-900 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-teal-600" />
                    {careTeam.find((m) => m.role === 'ANESTHESIOLOGIST')?.name}
                  </span>
                </div>
              </>
            )}
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('patient.bedsideAttender')}</span>
              <span className="font-semibold text-slate-900 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                {patient.assignedAttenderName} ({patient.assignedAttenderRelation || t('role.attender')})
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('patient.gloveHardwareId')}</span>
              <span className="font-mono text-xs font-bold text-blue-700">
                {patient.hardwareDeviceId || t('patient.notLinked')}
              </span>
            </div>
          </div>
        </div>

        {patient.notes && (
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
            <strong>{t('patient.clinicalContext')}:</strong> {patient.notes}
          </div>
        )}

        {/* Doctor Clinical Actions Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">{t('patient.setPatientAcuity')}:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => handleStatusChange('stable')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  patient.status === 'stable'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('common.stable')}
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('attention')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  patient.status === 'attention'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('common.attention')}
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('critical')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  patient.status === 'critical' || patient.status === 'high'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('common.critical')}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('medications')}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold border border-blue-200 transition-colors flex items-center gap-1"
            >
              <Pill className="w-3.5 h-3.5" />
              <span>{t('patient.prescribeRx')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold border border-blue-200 transition-colors flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{t('patient.addReport')}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowClinicalReportModal(true)}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold border border-blue-200 transition-colors flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t('patient.clinicalSummaryReport')}</span>
            </button>
            <button
              type="button"
              onClick={handleDischarge}
              className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 rounded-lg font-semibold border border-slate-200 transition-colors"
            >
              {t('patient.dischargePatient')}
            </button>
          </div>
        </div>
      </div>

      {/* 2. DEDICATED PATIENT WORKSPACE TAB NAVIGATION */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Patient workspace navigation */}
        <div className="border-b border-slate-200 bg-white p-3">
          <label className="block sm:hidden">
            <span className="mb-1 block text-xs font-semibold text-slate-600">{t('patient.section')}</span>
            <select
              aria-label={t('patient.recordSection')}
              value={activeTab}
              onChange={(event) => setActiveTab(event.target.value as typeof activeTab)}
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="overview">{t('patient.tabOverview')}</option>
              <option value="vitals">{t('patient.tabVitals')}</option>
              <option value="medications">{t('patient.tabMedications')}</option>
              <option value="investigations">{t('patient.tabInvestigations')}</option>
              <option value="procedures">{t('patient.tabProcedures')}</option>
              <option value="careteam">{t('patient.tabCareTeam')}</option>
              <option value="timeline">{t('patient.tabTimeline')}</option>
              <option value="reports">{t('patient.tabReports')}</option>
              <option value="discharge">{t('patient.tabDischarge')}</option>
              <option value="careai">{t('patient.tabCareAI')}</option>
              <option value="summary">{t('patient.tabVerifiedClinicalRecord')}</option>
            </select>
          </label>
          <div aria-label="Patient record sections" className="hidden sm:flex sm:flex-wrap gap-1.5">
            {([
              { id: 'overview', label: t('patient.tabOverview'), icon: <LayoutDashboard className="h-4 w-4" /> },
              { id: 'vitals', label: t('patient.tabVitals'), icon: <Activity className="h-4 w-4" /> },
              { id: 'medications', label: `${t('patient.tabMedications')} (${medications.length})`, icon: <Pill className="h-4 w-4" /> },
              { id: 'investigations', label: `${t('patient.tabInvestigations')} (${investigations.length})`, icon: <FileText className="h-4 w-4" /> },
              { id: 'procedures', label: `${t('patient.tabProcedures')} (${procedures.length})`, icon: <ClipboardList className="h-4 w-4" /> },
              { id: 'careteam', label: t('patient.tabCareTeam'), icon: <Users className="h-4 w-4" /> },
              { id: 'timeline', label: `${t('patient.tabTimeline')} (${timeline.length})`, icon: <Clock className="h-4 w-4" /> },
              { id: 'reports', label: `${t('patient.tabReports')} (${reports.length})`, icon: <FileText className="h-4 w-4" /> },
              { id: 'discharge', label: t('patient.tabDischarge'), icon: <CheckSquare className="h-4 w-4" /> },
              { id: 'careai', label: t('patient.tabCareAI'), icon: <Sparkles className="h-4 w-4" /> },
              { id: 'summary', label: t('patient.tabVerifiedClinicalRecord'), icon: <ShieldAlert className="h-4 w-4" /> },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-800 ring-1 ring-blue-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.icon}<span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. TAB CONTENT DISPLAY */}        {/* 3. TAB CONTENT DISPLAY */}
        <div className="p-4 sm:p-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Bedside Real-time Telemetry Stream Bar */}
              {renderTelemetryControlBar()}

              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">{t('patient.verifiedClinicalData')}</p>
              {/* Vitals Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <VitalCard
                  type="BP"
                  title="Blood Pressure"
                  value={`${v.systolicBP}/${v.diastolicBP}`}
                  unit="mmHg"
                  status={v.bpStatus}
                  timestamp={v.timestamp}
                  normalRangeText="90/60 - 120/80"
                  trend={v.systolicBP > 130 ? 'up' : 'stable'}
                />

                <VitalCard
                  type="PULSE"
                  title="Heart Rate"
                  value={`${v.pulse}`}
                  unit="bpm"
                  status={v.pulseStatus}
                  timestamp={v.timestamp}
                  normalRangeText="60 - 100 bpm"
                  trend={v.pulse > 90 ? 'up' : 'stable'}
                />

                <VitalCard
                  type="SPO2"
                  title="Oxygen Saturation"
                  value={`${v.spO2}`}
                  unit="%"
                  status={v.spO2Status}
                  timestamp={v.timestamp}
                  normalRangeText="95-100%"
                  trend={v.spO2 < 93 ? 'down' : 'stable'}
                />

                <VitalCard
                  type="TEMP"
                  title="Body Temperature"
                  value={formatTemperatureVal(v.temperature)}
                  unit="°F"
                  status={v.tempStatus}
                  timestamp={v.timestamp}
                  normalRangeText={FAHRENHEIT_NORMAL_RANGE_TEXT}
                  trend={v.temperature > 37.8 ? 'up' : 'stable'}
                />

                <VitalCard
                  type="RR"
                  title="Respiratory Rate"
                  value={`${v.respiratoryRate ?? 18}`}
                  unit="breaths/min"
                  status={v.rrStatus ?? 'stable'}
                  timestamp={v.timestamp}
                  normalRangeText="12 - 20 bpm"
                  trend="stable"
                />
              </div>

              {/* Two Column Layout: Charts + Camera/Alerts */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Vital History Chart (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <VitalHistoryChart history={patient.vitalsHistory} />

                  {/* Active Patient Requests originated from Smart Glove */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-amber-500" />
                        <h3 className="text-base font-bold text-slate-900">Bedside Smart Glove Requests</h3>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        {requests.filter((r) => r.status === 'NEW').length} New
                      </span>
                    </div>

                    {requests.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400">
                        No active hardware requests from glove sensors.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {requests.slice(0, 3).map((req) => (
                          <HardwareRequestCard key={req.id} request={req} showPatientDetails={false} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Doctor Notes in Overview */}
                  <DoctorNotesList patientId={patient.id} notes={notes} readOnly={false} />
                </div>

                {/* Right Column: Live Camera & Clinical Alerts (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-blue-600" />
                        Bedside Visual Verification
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono">Stream: Encrypted</span>
                    </div>

                    <LiveCamera
                      patientName={patient.name}
                      roomNumber={patient.room}
                      bedNumber={patient.bed}
                    />
                  </div>

                  <AlertList alerts={alerts} showPatientRoom={false} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PATIENT SUMMARY (Section 7) */}
          {activeTab === 'summary' && (
            <PatientSummaryTab
              patient={patient}
              medications={medications}
              reports={reports}
              timeline={timeline}
              onSelectTab={setActiveTab}
            />
          )}

          {/* TAB: CARE TEAM & CLINICAL WORKFLOW */}
          {['careteam', 'procedures', 'investigations', 'discharge'].includes(activeTab) && (
            <div className="space-y-6">
              {activeTab === 'careteam' && <>
              {/* Section 1: Multidisciplinary Clinical Care Team Roster */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Multidisciplinary Clinical Care Team</h3>
                      <p className="text-xs text-slate-500">Authorized medical personnel assigned to active inpatient care.</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {careTeam.length} Active Staff
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {careTeam.map((member) => (
                    <div
                      key={member.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-300 transition-all space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-bold text-sm text-slate-900 block">{member.name}</span>
                          <span className="text-xs text-slate-600 font-medium">
                            {member.specialty || member.department || 'Clinical Staff'}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            member.role === 'ATTENDING_PHYSICIAN'
                              ? 'bg-blue-100 text-blue-800'
                              : member.role === 'SURGEON'
                              ? 'bg-blue-100 text-blue-800'
                              : member.role === 'ANESTHESIOLOGIST'
                              ? 'bg-teal-100 text-teal-800'
                              : member.role === 'NURSE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {member.role.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {member.notes && (
                        <p className="text-xs text-slate-500 italic bg-white p-2 rounded-lg border border-slate-100">
                          {member.notes}
                        </p>
                      )}
                      {member.phone && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                          <span>Contact:</span>
                          <span className="font-semibold text-slate-700">{member.phone}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 1.5: Authorized Family Caregivers (Non-Clinical Role) */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <HeartHandshake className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Authorized Family Caregivers</h3>
                      <p className="text-xs text-slate-500">Registered bedside family attenders (Non-clinical support role).</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    FAMILY ATTENDER
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900">{patient.assignedAttenderName || 'Not Linked'}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-100 text-emerald-800">
                        Active
                      </span>
                    </div>
                    <p className="text-slate-600 font-medium">
                      Relationship: <strong>{patient.assignedAttenderRelation || 'Family Caregiver'}</strong>
                    </p>
                    <p className="text-slate-500">
                      Emergency Contact: <span className="font-mono">{patient.assignedAttenderPhone || patient.emergencyContact || 'None on record'}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 italic">
                      Attenders provide emotional support and comfort. Clinical orders and treatment are strictly physician and nursing responsibilities.
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 2: Inpatient Admission & Structural Hospital Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900">Structural Bed & Location Model</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Building</span>
                      <span className="font-bold text-slate-800">{patient.currentLocation?.building || 'Main Hospital'}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Floor & Wing</span>
                      <span className="font-bold text-slate-800">
                        Floor {patient.currentLocation?.floor ?? 1} • Wing {patient.currentLocation?.wing || 'Central'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Ward</span>
                      <span className="font-bold text-slate-800">{patient.currentLocation?.ward || patient.department}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Room & Bed</span>
                      <span className="font-bold text-blue-700">Room {patient.room} • {patient.bed}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-900">Hospital Encounter & Admission</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Encounter Type</span>
                      <span className="font-bold text-blue-700">
                        {admissions.length > 0 ? admissions[0].admissionType : 'INPATIENT'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Admitting Service</span>
                      <span className="font-bold text-slate-800">
                        {admissions.length > 0 ? admissions[0].admittingService : patient.department}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Admission Date</span>
                      <span className="font-bold text-slate-800">
                        {new Date(patient.admissionDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Admission Status</span>
                      <span className="font-bold text-emerald-700">
                        {admissions.length > 0 ? admissions[0].status : 'ADMITTED'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              </>}

              {/* Section 3: Surgical Procedures */}
              {activeTab === 'procedures' && procedures.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-slate-900">Surgical & Interventional Procedures</h3>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      {procedures.length} Procedure(s)
                    </span>
                  </div>

                  <div className="space-y-3">
                    {procedures.map((proc) => (
                      <div key={proc.id} className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-base text-slate-900">{proc.procedureName}</span>
                            <span className="text-xs text-blue-700 font-semibold block">{proc.specialty}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                              {proc.status}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                          <div className="bg-white p-2 rounded-lg border border-blue-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Surgeon</span>
                            <span className="font-bold text-slate-800">{proc.surgeonName}</span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-blue-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Anesthesiologist</span>
                            <span className="font-bold text-slate-800">{proc.anesthesiologistName}</span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-blue-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Operating Room</span>
                            <span className="font-bold text-slate-800">{proc.operatingRoom}</span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-blue-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pre-Op Verified</span>
                            <span className="font-bold text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Verified
                            </span>
                          </div>
                        </div>

                        {proc.notes && (
                          <p className="text-xs text-slate-600 bg-white p-2 rounded-lg border border-blue-100">
                            <strong>Clinical Notes:</strong> {proc.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === 'procedures' && procedures.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No procedures are recorded for this admission.</div>
              )}

              {/* Section 4: Diagnostic & Lab Investigations */}
              {activeTab === 'investigations' && investigations.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-slate-900">Diagnostic & Laboratory Investigations</h3>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      {investigations.length} Lab/Radiology Test(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {investigations.map((inv) => (
                      <div key={inv.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-sm text-slate-900 block">{inv.name}</span>
                            <span className="text-[11px] text-slate-500 font-medium">Type: {inv.type} • Ordered by {inv.orderedBy}</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-100 text-emerald-800">
                            {inv.status}
                          </span>
                        </div>
                        {inv.result && (
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                            <span className="font-bold text-slate-700">Result: </span>
                            <span className="font-mono font-bold text-blue-700">{inv.result}</span>
                            {inv.normalRange && (
                              <span className="text-slate-400 block text-[11px]">Normal Range: {inv.normalRange}</span>
                            )}
                            {inv.reviewedBy && (
                              <span className="text-emerald-700 block text-[11px] font-medium pt-0.5">
                                ✓ Reviewed by {inv.reviewedBy}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === 'investigations' && investigations.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No investigations are recorded for this admission.</div>
              )}

              {/* Section 5: Structured Discharge Workflow */}
              {activeTab === 'discharge' && <>
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900">Discharge Planning & Medication Reconciliation</h3>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {dischargePlan?.status || 'PLANNING'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center gap-2">
                    <CheckCircle2 className={`w-4 h-4 ${dischargePlan?.medicationsReconciled ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <div>
                      <span className="font-bold text-slate-800 block">Medication Reconciliation</span>
                      <span className="text-[11px] text-slate-500">{dischargePlan?.medicationsReconciled ? 'Completed' : 'Pending Review'}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center gap-2">
                    <CheckCircle2 className={`w-4 h-4 ${dischargePlan?.pendingResultsReviewed ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <div>
                      <span className="font-bold text-slate-800 block">Pending Lab Review</span>
                      <span className="text-[11px] text-slate-500">{dischargePlan?.pendingResultsReviewed ? 'All Results Reviewed' : 'Awaiting Lab'}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center gap-2">
                    <CheckCircle2 className={`w-4 h-4 ${dischargePlan?.nursingDischargeCompleted ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <div>
                      <span className="font-bold text-slate-800 block">Nursing Discharge</span>
                      <span className="text-[11px] text-slate-500">{dischargePlan?.nursingDischargeCompleted ? 'Cleared' : 'Pending Clearance'}</span>
                    </div>
                  </div>
                </div>

                {dischargePlan?.dischargeInstructions && dischargePlan.dischargeInstructions.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-xs font-bold text-slate-700 block">Discharge Instructions & Follow-up:</span>
                    <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                      {dischargePlan.dischargeInstructions.map((inst, idx) => (
                        <li key={idx}>{inst}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              </>}
            </div>
          )}

          {activeTab === 'careai' && (
            <section className="max-w-3xl rounded-xl border border-blue-200 bg-blue-50/60 p-5 sm:p-6" aria-labelledby="careai-clinical-summary-title">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-blue-100 p-2 text-blue-800"><Sparkles className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-800">AI-generated clinical synthesis</p>
                  <h2 id="careai-clinical-summary-title" className="mt-1 text-lg font-bold text-slate-900">CareAI for {patient.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-700">This assistant can summarize the scoped patient record. Verify every AI-generated statement against the verified clinical record before acting.</p>
                  <button type="button" onClick={() => setShowAiSummaryModal(true)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                    <Sparkles className="h-4 w-4" /> Generate patient summary
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* TAB 3: REPORTS (Section 8) */}
          {activeTab === 'reports' && (
            <MedicalReportsList reports={reports} patientId={patient.id} allowAdd={true} />
          )}

          {/* TAB 4: MEDICATIONS (Section 5) */}
          {activeTab === 'medications' && (
            <MedicationList patientId={patient.id} medications={medications} isAttenderView={false} />
          )}

          {/* TAB 5: VITALS */}
          {activeTab === 'vitals' && (
            <div className="space-y-6">
              {/* Bedside Real-time Telemetry Stream Bar */}
              {renderTelemetryControlBar()}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <VitalCard
                  type="BP"
                  title="Blood Pressure"
                  value={`${v.systolicBP}/${v.diastolicBP}`}
                  unit="mmHg"
                  status={v.bpStatus}
                  timestamp={v.timestamp}
                  normalRangeText="90/60 - 120/80"
                  trend={v.systolicBP > 130 ? 'up' : 'stable'}
                />

                <VitalCard
                  type="PULSE"
                  title="Heart Rate"
                  value={`${v.pulse}`}
                  unit="bpm"
                  status={v.pulseStatus}
                  timestamp={v.timestamp}
                  normalRangeText="60 - 100 bpm"
                  trend={v.pulse > 90 ? 'up' : 'stable'}
                />

                <VitalCard
                  type="SPO2"
                  title="Oxygen Saturation"
                  value={`${v.spO2}`}
                  unit="%"
                  status={v.spO2Status}
                  timestamp={v.timestamp}
                  normalRangeText="95-100%"
                  trend={v.spO2 < 93 ? 'down' : 'stable'}
                />

                <VitalCard
                  type="TEMP"
                  title="Body Temperature"
                  value={formatTemperatureVal(v.temperature)}
                  unit="°F"
                  status={v.tempStatus}
                  timestamp={v.timestamp}
                  normalRangeText={FAHRENHEIT_NORMAL_RANGE_TEXT}
                  trend={v.temperature > 37.8 ? 'up' : 'stable'}
                />

                <VitalCard
                  type="RR"
                  title="Respiratory Rate"
                  value={`${v.respiratoryRate ?? 18}`}
                  unit="breaths/min"
                  status={v.rrStatus ?? 'stable'}
                  timestamp={v.timestamp}
                  normalRangeText="12 - 20 bpm"
                  trend="stable"
                />
              </div>

              <VitalHistoryChart history={patient.vitalsHistory} />
            </div>
          )}

          {/* TAB 6: TIMELINE (Unified Patient Timeline, Section 6 & 13) */}
          {activeTab === 'timeline' && (
            <PatientTimeline events={timeline} />
          )}
        </div>
      </div>

      {/* Clinical Summary Report Modal & Print View */}
      <ClinicalReportModal
        patient={patient}
        medications={medications}
        reports={reports}
        notes={notes}
        timeline={timeline}
        isOpen={showClinicalReportModal}
        onClose={() => setShowClinicalReportModal(false)}
      />

      {/* AI Clinical Summary Modal */}
      <AiClinicalSummaryModal
        patient={patient}
        isOpen={showAiSummaryModal}
        onClose={() => setShowAiSummaryModal(false)}
      />
    </div>
  );
};
