import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getClinicalWorkspacePatients } from '../../services/patientScopeService';
import { dataStore } from '../../services/dataStore';
import { Patient, VitalStatus, VitalAlert } from '../../types';
import { formatTemperatureVal } from '../../utils/temperature';
import { StatusBadge } from '../../components/common/Badge';
import { EmptyState, PageHeader, SectionHeader } from '../../components/common/ClinicalUI';
import { CriticalAlertWorkflowBanner } from '../../components/alerts/CriticalAlertWorkflowBanner';
import { useLanguage } from '../../i18n';
import {
  Users, CheckCircle2, AlertTriangle, AlertOctagon,
  Activity, Heart, Wind, Thermometer, Clock, ArrowRight,
  Search, X, ClipboardList, Pill, CalendarDays,
} from 'lucide-react';

const isSameLocalDay = (value: string | undefined, date: Date): boolean => {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toDateString() === date.toDateString();
};

export const DoctorDashboard: React.FC = () => {
  const { assignedDoctorId, currentUser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFilter = (searchParams.get('status') as VitalStatus) || 'all';
  const [patients, setPatients] = useState<Patient[]>([]);
  const [alerts, setAlerts] = useState<VitalAlert[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | VitalStatus>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [acknowledgingPatientId, setAcknowledgingPatientId] = useState<string | null>(null);

  useEffect(() => {
    const updatePatients = () => {
      // Doctor sees ONLY assigned patients
      const assigned = getClinicalWorkspacePatients(currentUser?.role, assignedDoctorId);
      setPatients(assigned);
      const pIds = new Set(assigned.map((p) => p.id));
      setAlerts(dataStore.getAlerts().filter((a) => pIds.has(a.patientId)));
    };

    updatePatients();
    return dataStore.subscribe(updatePatients);
  }, [assignedDoctorId, currentUser?.role]);

  // Status summaries
  const totalCount = patients.length;
  const stableCount = patients.filter((p) => p.status === 'stable').length;
  const attentionCount = patients.filter((p) => p.status === 'attention').length;
  const criticalCount = patients.filter((p) => p.status === 'critical' || p.status === 'high').length;
  const patientIds = new Set(patients.map((patient) => patient.id));
  const activeCriticalAlertCount = dataStore.getAlerts().filter((alert) =>
    patientIds.has(alert.patientId) && alert.status === 'active' && alert.severity === 'critical',
  ).length;
  const today = new Date();
  const proceduresToday = dataStore.getProcedures().filter((procedure) =>
    patientIds.has(procedure.patientId)
      && isSameLocalDay(procedure.scheduledAt, today)
      && procedure.status !== 'CANCELLED',
  );
  const pendingInvestigations = patients.flatMap((patient) =>
    dataStore.getInvestigations(patient.id).filter((investigation) =>
      investigation.status !== 'REVIEWED' && investigation.status !== 'CANCELLED',
    ).map((investigation) => ({ investigation, patient })),
  );
  const medicationReviewItems = patients.flatMap((patient) =>
    dataStore.getMedications(patient.id).filter((medication) => medication.status === 'Missed' || medication.status === 'Pending')
      .map((medication) => ({ medication, patient })),
  );
  const recentClinicalEvents = patients.flatMap((patient) =>
    dataStore.getTimeline(patient.id).map((event) => ({ event, patient })),
  ).sort((a, b) => new Date(b.event.timestamp).getTime() - new Date(a.event.timestamp).getTime()).slice(0, 4);

  const acuityPriority: Record<string, number> = {
    critical: 0,
    high: 1,
    attention: 2,
    stable: 3,
  };
  const priorityPatients = patients.filter((p) => p.status === 'critical' || p.status === 'high' || p.status === 'attention')
    .sort((a, b) => (acuityPriority[a.status] ?? 4) - (acuityPriority[b.status] ?? 4));

  // Strict scoped search (operates solely on doctor's assigned patients)
  const searchedPatients = patients.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      p.mrn.toLowerCase().includes(q) ||
      p.room.toLowerCase().includes(q) ||
      p.bed.toLowerCase().includes(q) ||
      p.primaryCondition.toLowerCase().includes(q) ||
      (p.department && p.department.toLowerCase().includes(q))
    );
  });

  const filteredPatients = statusFilter === 'all'
    ? searchedPatients
    : statusFilter === 'critical'
      ? searchedPatients.filter((p) => p.status === 'critical' || p.status === 'high')
      : searchedPatients.filter((p) => p.status === statusFilter);

  // Clinical triage order: critical, high, attention, then stable.
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    const pA = acuityPriority[a.status] ?? 4;
    const pB = acuityPriority[b.status] ?? 4;
    return pA - pB;
  });

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('doctor.greetingMorning');
    if (h < 17) return t('doctor.greetingAfternoon');
    return t('doctor.greetingEvening');
  };

  const statusRank: Record<string, number> = {
    active: 0,
    acknowledged: 1,
    responding: 2,
    resolved: 3,
  };
  const severityRank: Record<string, number> = {
    critical: 0,
    high: 1,
    attention: 2,
  };

  const activeWorkflowAlerts = alerts
    .filter((a) => {
      if (a.status === 'active' || a.status === 'acknowledged' || a.status === 'responding') return true;
      if (a.status === 'resolved' && a.resolvedAt) {
        return Date.now() - new Date(a.resolvedAt).getTime() < 60000;
      }
      return false;
    })
    .sort((a, b) => {
      const sA = statusRank[a.status] ?? 4;
      const sB = statusRank[b.status] ?? 4;
      if (sA !== sB) return sA - sB;

      const vA = severityRank[a.severity] ?? 3;
      const vB = severityRank[b.severity] ?? 3;
      if (vA !== vB) return vA - vB;

      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  // Group active workflow alerts by patient for clean clinical worklist summarization
  const activeAlertsByPatient = React.useMemo(() => {
    const map = new Map<string, { patient: Patient | undefined; alerts: VitalAlert[] }>();
    activeWorkflowAlerts.forEach((alert) => {
      const entry = map.get(alert.patientId) || {
        patient: patients.find((p) => p.id === alert.patientId),
        alerts: [],
      };
      entry.alerts.push(alert);
      map.set(alert.patientId, entry);
    });
    return Array.from(map.values());
  }, [activeWorkflowAlerts, patients]);

  return (
    <div className="space-y-6 sm:space-y-7">
      <PageHeader
        eyebrow={t('doctor.workspace')}
        title={`${getGreeting()}, ${currentUser?.name || 'Dr. Arun'}`}
        description={t('doctor.dashboardDescription')}
      />

      {/* Interactive Clinical Alert & Escalation Workflow Stack */}
      {activeWorkflowAlerts.length > 0 && (
        <section aria-label="Active clinical alert workflow" className="space-y-4" data-testid="dashboard-alert-stack">
          {activeAlertsByPatient.map((group) => {
            const pId = group.patient?.id || group.alerts[0].patientId;
            const pName = group.patient?.name || group.alerts[0].patientName;
            const pRoom = group.patient?.room || group.alerts[0].room;
            const pBed = group.patient?.bed || group.alerts[0].bed;

            if (group.alerts.length === 1) {
              return (
                <CriticalAlertWorkflowBanner
                  key={group.alerts[0].id}
                  alert={group.alerts[0]}
                  onViewPatient={(patientId: string) => navigate(`/doctor/patients/${patientId}`)}
                />
              );
            }

            // Multi-condition clinical episode summary card for this patient
            return (
              <div
                key={pId}
                className="rounded-2xl border-2 border-red-300 bg-red-50/70 p-4 sm:p-5 shadow-xs space-y-4 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/10">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white bg-[#DC2626]">
                      <AlertOctagon className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-red-700 text-white">
                          {group.alerts.some((a) => a.severity === 'critical') ? 'CRITICAL CLINICAL EPISODES' : 'WARNING CLINICAL EPISODES'}
                        </span>
                        <span className="text-xs font-bold text-slate-800 bg-white/90 px-2 py-0.5 rounded border border-slate-300">
                          {group.alerts.length} active conditions
                        </span>
                        <span className="text-xs font-semibold text-slate-600">
                          Updated {new Date(Math.max(...group.alerts.map((a) => new Date(a.lastUpdatedAt || a.timestamp).getTime()))).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-950 mt-1">
                        Patient: <span className="font-extrabold">{pName}</span> <span className="text-sm font-normal text-slate-600">({pRoom}{pBed ? ` / ${pBed}` : ''})</span>
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {group.alerts.some((a) => a.status === 'active') && (
                      <button
                        type="button"
                        disabled={acknowledgingPatientId === pId}
                        onClick={() => {
                          setAcknowledgingPatientId(pId);
                          dataStore.acknowledgeAllAlertsForPatient(
                            pId,
                            currentUser?.name || 'Dr. Arun Kumar',
                            currentUser?.role || 'doctor'
                          );
                          setTimeout(() => setAcknowledgingPatientId(null), 300);
                        }}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-700 text-white hover:bg-red-800 disabled:opacity-60 transition-colors shadow-xs"
                      >
                        {acknowledgingPatientId === pId ? 'Acknowledging...' : 'Acknowledge All'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(`/doctor/patients/${pId}`)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      View Chart
                    </button>
                  </div>
                </div>

                {/* Condition Summary Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {group.alerts.map((a) => (
                    <div key={a.id} className="bg-white rounded-xl p-3 border border-slate-200 text-xs space-y-1 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {a.conditionType || a.vitalType}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          a.severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {a.status}
                        </span>
                      </div>
                      <div className="text-sm font-black text-slate-900 font-mono">
                        {a.currentValue || a.valueRecorded}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between">
                        <span>{a.occurrenceCount && a.occurrenceCount > 1 ? `Updated ${a.occurrenceCount}x` : '1 reading'}</span>
                        <span>{new Date(a.lastUpdatedAt || a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Individual Condition Workflows */}
                <div className="space-y-3 pt-1">
                  {group.alerts.map((workflowAlert) => (
                    <CriticalAlertWorkflowBanner
                      key={workflowAlert.id}
                      alert={workflowAlert}
                      onViewPatient={(patientId: string) => navigate(`/doctor/patients/${patientId}`)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section aria-label={t('doctor.workloadSummary')} className="clinical-surface grid grid-cols-2 divide-x divide-y divide-slate-200 overflow-hidden sm:grid-cols-4 sm:divide-y-0">
        <button type="button" onClick={() => setStatusFilter('all')} aria-pressed={statusFilter === 'all'} className="min-h-[76px] p-3 text-left transition-colors hover:bg-slate-50 sm:p-4">
          <span className="block text-xs font-medium text-slate-600">{t('doctor.assignedPatients')}</span>
          <span className="mt-1 flex items-center gap-2 text-xl font-semibold text-slate-950"><Users className="h-4 w-4 text-slate-500" aria-hidden="true" />{totalCount}</span>
        </button>
        <button type="button" onClick={() => setStatusFilter('critical')} aria-pressed={statusFilter === 'critical'} className="min-h-[76px] p-3 text-left transition-colors hover:bg-red-50 sm:p-4">
          <span className="block text-xs font-medium text-slate-600">{t('doctor.criticalAlerts')}</span>
          <span className={`mt-1 flex items-center gap-2 text-xl font-semibold ${activeCriticalAlertCount ? 'text-red-800' : 'text-slate-950'}`}><AlertOctagon className="h-4 w-4" aria-hidden="true" />{activeCriticalAlertCount}</span>
        </button>
        <button type="button" onClick={() => setStatusFilter('attention')} aria-pressed={statusFilter === 'attention'} className="min-h-[76px] p-3 text-left transition-colors hover:bg-amber-50 sm:p-4">
          <span className="block text-xs font-medium text-slate-600">{t('doctor.requireReview')}</span>
          <span className={`mt-1 flex items-center gap-2 text-xl font-semibold ${attentionCount ? 'text-amber-800' : 'text-slate-950'}`}><AlertTriangle className="h-4 w-4" aria-hidden="true" />{attentionCount}</span>
        </button>
        <button type="button" onClick={() => setStatusFilter('stable')} aria-pressed={statusFilter === 'stable'} className="min-h-[76px] p-3 text-left transition-colors hover:bg-emerald-50 sm:p-4">
          <span className="block text-xs font-medium text-slate-600">{t('common.stable')}</span>
          <span className="mt-1 flex items-center gap-2 text-xl font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{stableCount}</span>
        </button>
      </section>

      <section className={`clinical-surface overflow-hidden ${priorityPatients.some((patient) => patient.status === 'critical' || patient.status === 'high') ? 'border-red-200' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${priorityPatients.some((patient) => patient.status === 'critical' || patient.status === 'high') ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                {priorityPatients.some((patient) => patient.status === 'critical' || patient.status === 'high') ? <AlertOctagon className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-950">{t('doctor.patientsRequiringAttention')}</h2>
                <p className="text-sm text-slate-600">{t('doctor.reviewCriticalFirst')}</p>
              </div>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {priorityPatients.length === 1 ? t('doctor.patientCountSingular') : t('doctor.patientCount', { count: priorityPatients.length })}
            </span>
          </div>

          <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {priorityPatients.length ? priorityPatients.map((patient) => {
              const v = patient.latestVitals;
              const latestEvent = [...dataStore.getTimeline(patient.id)].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
              const isCritical = patient.status === 'critical' || patient.status === 'high';
              return (
                <article
                  key={patient.id}
                  className="grid min-w-0 gap-3 p-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)_auto] lg:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-slate-950">{patient.name}</span>
                      <StatusBadge status={patient.status} size="sm" />
                    </div>
                    <div className="text-sm text-slate-700">
                      {patient.age}y · {patient.gender} <span aria-hidden="true">·</span> {t('common.room')} {patient.room} / {t('common.bed')} {patient.bed}
                    </div>
                    <div className="truncate text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{patient.primaryCondition}</span> <span aria-hidden="true">·</span> MRN {patient.mrn}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 rounded-lg bg-slate-50 p-2.5 text-xs font-mono lg:gap-3">
                    <div className="text-center">
                      <span className="block font-sans text-[10px] text-slate-500">BP</span>
                      <span className={`font-bold ${v.bpStatus === 'critical' ? 'text-red-700' : 'text-slate-800'}`}>
                        {v.systolicBP}/{v.diastolicBP}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="block font-sans text-[10px] text-slate-500">Pulse</span>
                      <span className={`font-bold ${v.pulseStatus === 'critical' ? 'text-red-700' : 'text-slate-800'}`}>
                        {v.pulse} bpm
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="block font-sans text-[10px] text-slate-500">SpO₂</span>
                      <span className={`font-bold ${v.spO2Status === 'critical' ? 'text-red-700' : 'text-slate-800'}`}>
                        {v.spO2}%
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="block font-sans text-[10px] text-slate-500">Temp</span>
                      <span className="font-bold text-slate-800">{formatTemperatureVal(v.temperature)} °F</span>
                    </div>
                  </div>

                  <div className="flex min-w-0 items-center justify-between gap-3 lg:flex-col lg:items-end lg:justify-center">
                    <p className={`min-w-0 truncate text-xs ${isCritical ? 'font-medium text-red-800' : 'text-slate-600'}`}>
                      {latestEvent ? `${t('doctor.latest')}: ${latestEvent.title}` : t('doctor.noRecentEvent')}
                    </p>
                    <button type="button" onClick={() => navigate(`/doctor/patients/${patient.id}`)} className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-white transition-colors ${isCritical ? 'bg-red-700 hover:bg-red-800' : 'bg-slate-800 hover:bg-slate-900'}`}>
                      {t('doctor.openRecord')} <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              );
            }) : <EmptyState icon={CheckCircle2} title={t('doctor.noCriticalPatients')} description={t('doctor.allPatientsStable')} />}
          </div>
      </section>

      <section className="clinical-surface overflow-hidden">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <SectionHeader title={t('doctor.todaysClinicalWork')} description={t('doctor.todaysClinicalWorkDescription')} />
        </div>
        <div className="grid divide-y divide-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="min-w-0 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ClipboardList className="h-4 w-4 text-blue-700" aria-hidden="true" />{t('doctor.investigations')}</h3><span className="text-xs font-semibold text-amber-800">{t('doctor.pendingCount', { count: pendingInvestigations.length })}</span></div>
            {pendingInvestigations.length ? <ul className="divide-y divide-slate-100">{pendingInvestigations.slice(0, 4).map(({ investigation, patient }) => <li key={investigation.id} className="py-2.5 first:pt-0 last:pb-0"><button type="button" onClick={() => navigate(`/doctor/patients/${patient.id}`)} className="min-h-11 w-full text-left"><span className="block truncate text-sm font-medium text-slate-900">{investigation.name}{investigation.criticalFlag ? <span className="ml-2 text-xs font-semibold text-red-700">{t('doctor.criticalFlag')}</span> : null}</span><span className="block truncate text-xs text-slate-600">{patient.name} · {patient.room}/{patient.bed} · {investigation.status.replace('_', ' ')}</span></button></li>)}</ul> : <p className="text-sm text-slate-600">{t('doctor.noInvestigationsAwaitingReview')}</p>}
          </div>
          <div className="min-w-0 p-4 sm:p-5" data-tour="doctor-medications">
            <div className="mb-3 flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Pill className="h-4 w-4 text-blue-700" aria-hidden="true" />{t('doctor.medicationReview')}</h3><span className="text-xs font-semibold text-amber-800">{t('doctor.dueCount', { count: medicationReviewItems.length })}</span></div>
            {medicationReviewItems.length ? <ul className="divide-y divide-slate-100">{medicationReviewItems.slice(0, 4).map(({ medication, patient }) => <li key={medication.id} className="py-2.5 first:pt-0 last:pb-0"><button type="button" onClick={() => navigate(`/doctor/patients/${patient.id}`)} className="min-h-11 w-full text-left"><span className="block truncate text-sm font-medium text-slate-900">{medication.name} · {medication.status}</span><span className="block truncate text-xs text-slate-600">{patient.name} · {patient.room}/{patient.bed} · {medication.scheduledTime}</span></button></li>)}</ul> : <p className="text-sm text-slate-600">{t('doctor.noPendingAdministrations')}</p>}
          </div>
          <div className="min-w-0 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CalendarDays className="h-4 w-4 text-blue-700" aria-hidden="true" />{t('doctor.todaysProcedures')}</h3><span className="text-xs font-semibold text-slate-700">{t('doctor.scheduledCount', { count: proceduresToday.length })}</span></div>
            {proceduresToday.length ? <ul className="divide-y divide-slate-100">{proceduresToday.slice(0, 4).map((procedure) => { const patient = patients.find((item) => item.id === procedure.patientId); return <li key={procedure.id} className="py-2.5 first:pt-0 last:pb-0"><button type="button" onClick={() => patient && navigate(`/doctor/patients/${patient.id}`)} className="min-h-11 w-full text-left"><span className="block truncate text-sm font-medium text-slate-900">{procedure.procedureName}</span><span className="block truncate text-xs text-slate-600">{patient?.name || t('doctor.assignedPatient')} · {procedure.status.replace('_', ' ')} · {new Date(procedure.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></button></li>; })}</ul> : <p className="text-sm text-slate-600">{t('doctor.noProceduresToday')}</p>}
          </div>
        </div>
      </section>

      {/* Assigned inpatient worklist, followed by recent events. */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <SectionHeader title={t('doctor.myPatients')} description={t('doctor.assignedRecordsDescription')} />

          <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <label className="relative block w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <span className="sr-only">{t('doctor.searchAssignedPatients')}</span>
              <input
                type="search"
                placeholder={t('doctor.searchPatientPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                  aria-label={t('doctor.clearPatientSearch')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>

            <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t('doctor.filterByAcuity')}>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                aria-pressed={statusFilter === 'all'}
                className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors ${
                  statusFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {t('doctor.all')} ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('critical')}
                aria-pressed={statusFilter === 'critical'}
                className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors ${
                  statusFilter === 'critical' ? 'bg-red-700 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {t('common.critical')} ({criticalCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('attention')}
                aria-pressed={statusFilter === 'attention'}
                className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors ${
                  statusFilter === 'attention' ? 'bg-amber-700 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {t('common.attention')} ({attentionCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('stable')}
                aria-pressed={statusFilter === 'stable'}
                className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors ${
                  statusFilter === 'stable' ? 'bg-emerald-700 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {t('common.stable')} ({stableCount})
              </button>
            </div>
          </div>
        </div>

        {/* Patient Cards / Rows */}
        <div className="divide-y divide-slate-100">
          {sortedPatients.length === 0 ? (
              <EmptyState
                icon={Users}
                title={patients.length === 0 ? t('doctor.noAssignedPatients') : t('doctor.noPatientsMatchFilters')}
                description={patients.length === 0 ? t('doctor.assignedRecordsWillAppear') : t('doctor.tryAnotherFilter')}
                action={(searchQuery || statusFilter !== 'all') ? (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                    className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t('doctor.resetFilters')}
                  </button>
                ) : undefined}
              />
          ) : (
            sortedPatients.map((patient) => {
              const v = patient.latestVitals;
              const isCrit = patient.status === 'critical' || patient.status === 'high';

              return (
                <button
                  type="button"
                  key={patient.id}
                  onClick={() => navigate(`/doctor/patients/${patient.id}`)}
                  data-tour="doctor-patient-item"
                  className={`w-full p-4 text-left transition-colors hover:bg-slate-50 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    isCrit ? 'bg-red-50/20' : ''
                  }`}
                >
                  {/* Left Patient Summary */}
                  <div className="space-y-1.5 min-w-0 sm:min-w-[240px]">
                    <div className="flex items-center gap-2.5">
                      <h4 className="text-base font-extrabold text-slate-900 hover:text-blue-600 transition-colors">
                        {patient.name}
                      </h4>
                      <StatusBadge status={patient.status} size="sm" />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                        {patient.room} • {patient.bed}
                      </span>
                      <span>{patient.age}y • {patient.gender}</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-800">{patient.primaryCondition}</span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      MRN: <strong className="font-mono text-slate-600">{patient.mrn}</strong> • {t('doctor.attender')}: {patient.assignedAttenderName || t('doctor.unassigned')}
                    </div>
                  </div>

                  {/* Glanceable Vital Numbers */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80" data-tour="doctor-vitals">
                    {/* BP */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                        <Activity className="w-3 h-3 text-blue-600" /> BP
                      </div>
                      <div className="text-sm font-black font-mono text-slate-900">
                        {v.systolicBP}/{v.diastolicBP}
                      </div>
                      <StatusBadge status={v.bpStatus} size="sm" showIcon={false} />
                    </div>

                    {/* Pulse */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                        <Heart className="w-3 h-3 text-rose-600" /> Pulse
                      </div>
                      <div className="text-sm font-black font-mono text-slate-900">
                        {v.pulse} <span className="text-[10px] text-slate-400 font-normal">bpm</span>
                      </div>
                      <StatusBadge status={v.pulseStatus} size="sm" showIcon={false} />
                    </div>

                    {/* SpO2 */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                        <Wind className="w-3 h-3 text-cyan-600" /> SpO2
                      </div>
                      <div className="text-sm font-black font-mono text-slate-900">
                        {v.spO2}%
                      </div>
                      <StatusBadge status={v.spO2Status} size="sm" showIcon={false} />
                    </div>

                    {/* Temp */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                        <Thermometer className="w-3 h-3 text-amber-600" /> Temp
                      </div>
                      <div className="text-sm font-black font-mono text-slate-900">
                        {formatTemperatureVal(v.temperature)} °F
                      </div>
                      <StatusBadge status={v.tempStatus} size="sm" showIcon={false} />
                    </div>
                  </div>

                  {/* Right Action */}
                  <div className="flex items-center justify-between lg:justify-end gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatTimestamp(patient.lastVitalUpdate)}
                    </span>

                    <span
                      className="px-3.5 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-1 transition-all shadow-xs"
                    >
                      <span>{t('doctor.clinicalDetail')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <section className="clinical-surface overflow-hidden">
        <div className="border-b border-slate-200 p-4 sm:px-5 sm:py-4">
          <SectionHeader title={t('doctor.recentClinicalEvents')} description={t('doctor.recentClinicalEventsDescription')} />
        </div>
        {recentClinicalEvents.length ? (
          <ol className="divide-y divide-slate-100 px-4 sm:px-5">
            {recentClinicalEvents.map(({ event, patient }) => (
              <li key={`${patient.id}-${event.id}`} className="flex min-h-14 items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{event.title}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-600">{patient.name} · {patient.mrn} · {patient.room} / {patient.bed}</p>
                </div>
                <time className="shrink-0 text-xs text-slate-500" dateTime={event.timestamp}>{formatTimestamp(event.timestamp)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState icon={Activity} title={t('doctor.noRecentEvents')} description={t('doctor.noRecentEventsDescription')} />
        )}
      </section>
    </div>
  );
};
