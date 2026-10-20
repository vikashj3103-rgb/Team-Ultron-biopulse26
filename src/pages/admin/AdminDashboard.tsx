import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertCircle, BedDouble, Bell, CalendarDays, CheckCircle2, ClipboardList, PhoneCall, Search, Stethoscope, UserPlus, Users, X } from 'lucide-react';
import { dataStore } from '../../services/dataStore';
import { Patient, TimelineEvent } from '../../types';
import { StatusBadge } from '../../components/common/Badge';
import { EmptyState, MetricCard, PageHeader, SectionHeader } from '../../components/common/ClinicalUI';
import { useLanguage } from '../../i18n';
import { adminActivityTitleKeys } from './adminActivityPresentation';

const isSameLocalDay = (value: string | undefined, date: Date): boolean => {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toDateString() === date.toDateString();
};

const acuityRank: Record<Patient['status'], number> = {
  critical: 0,
  high: 1,
  attention: 2,
  stable: 3,
};

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [recentTimeline, setRecentTimeline] = useState<TimelineEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const refreshData = () => {
      const currentPatients = dataStore.getPatients();
      setPatients(currentPatients);
      const allEvents = currentPatients.flatMap((patient) => dataStore.getTimeline(patient.id));
      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentTimeline(allEvents.slice(0, 6));
    };

    refreshData();
    return dataStore.subscribe(refreshData);
  }, []);

  const activePatients = useMemo(() => patients.filter((patient) => !patient.dischargeDate), [patients]);
  const now = new Date();
  const occupiedBedCount = new Set(
    activePatients.map((patient) => {
      const location = patient.currentLocation;
      return `${location?.room || patient.room}|${location?.bed || patient.bed}`;
    }),
  ).size;
  const activeAlertsCount = dataStore.getAlerts().filter((alert) => alert.status === 'active').length;
  const criticalAlertCount = dataStore.getAlerts().filter((alert) => alert.status === 'active' && alert.severity === 'critical').length;
  const activeCallCount = dataStore.getCallRequests().filter((call) =>
    ['WAITING', 'ACKNOWLEDGED', 'ASSIGNED', 'RESPONDING', 'ARRIVED'].includes(call.status),
  ).length;
  const proceduresToday = dataStore.getProcedures().filter(
    (procedure) => isSameLocalDay(procedure.scheduledAt, now) && procedure.status !== 'CANCELLED',
  ).length;
  const admissionsToday = activePatients.filter((patient) => isSameLocalDay(patient.admissionDate, now)).length;
  const dischargesToday = patients.filter((patient) => isSameLocalDay(patient.dischargeDate, now)).length;
  const doctors = dataStore.getDoctors();
  const assignedPatientCount = activePatients.filter((patient) => patient.assignedDoctorId).length;
  const unassignedPatientCount = activePatients.length - assignedPatientCount;
  const doctorWorkload = doctors
    .map((doctor) => ({
      doctor,
      patientCount: activePatients.filter((patient) => patient.assignedDoctorId === doctor.id).length,
    }))
    .sort((a, b) => b.patientCount - a.patientCount || a.doctor.name.localeCompare(b.doctor.name));
  const pendingClinicalReviews = activePatients.flatMap((patient) => [
    ...dataStore.getInvestigations(patient.id)
      .filter((investigation) => investigation.status === 'RESULTED')
      .map((investigation) => ({
        id: investigation.id,
        patientName: patient.name,
        mrn: patient.mrn,
        title: investigation.name,
        type: 'Investigation result',
        timestamp: investigation.resultedAt || investigation.orderedAt,
      })),
    ...dataStore.getReports(patient.id)
      .filter((report) => report.status === 'Pending Review')
      .map((report) => ({
        id: report.id,
        patientName: patient.name,
        mrn: patient.mrn,
        title: report.title,
        type: 'Clinical report',
        timestamp: report.date,
      })),
  ]).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const openOperationalWork = activeCallCount + criticalAlertCount + pendingClinicalReviews.length;

  const filteredPatients = activePatients
    .filter((patient) => {
      const query = searchQuery.trim().toLocaleLowerCase();
      if (!query) return true;
      const location = patient.currentLocation;
      return [
        patient.name,
        patient.mrn,
        patient.room,
        patient.bed,
        location?.room,
        location?.bed,
        patient.department,
        patient.assignedDoctorName,
        patient.primaryCondition,
      ].some((value) => value?.toLocaleLowerCase().includes(query));
    })
    .sort((a, b) => acuityRank[a.status] - acuityRank[b.status]);

  const metrics = [
    {
      label: t('admin.activeInpatients'),
      value: activePatients.length,
      detail: t('admin.currentAdmissions'),
      icon: Users,
      tone: 'neutral' as const,
      onClick: () => navigate('/admin/patients'),
    },
    {
      label: t('doctor.criticalAlerts'),
      value: criticalAlertCount,
      detail: activeAlertsCount > criticalAlertCount ? t('admin.otherActiveAlerts', { count: activeAlertsCount - criticalAlertCount }) : t('admin.immediateReview'),
      icon: AlertCircle,
      tone: criticalAlertCount ? 'critical' as const : 'success' as const,
      onClick: () => navigate('/admin/alerts'),
    },
    {
      label: t('admin.openNurseCalls'),
      value: activeCallCount,
      detail: t('admin.awaitingResponse'),
      icon: PhoneCall,
      tone: activeCallCount ? 'urgent' as const : 'success' as const,
      onClick: () => navigate('/admin/call-service'),
    },
    {
      label: t('admin.clinicalReviewsPending'),
      value: pendingClinicalReviews.length,
      detail: t('admin.resultsReportsAwaiting'),
      icon: ClipboardList,
      tone: pendingClinicalReviews.length ? 'warning' as const : 'success' as const,
      onClick: () => navigate('/admin/patients'),
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-7">
      <PageHeader
        eyebrow={t('role.admin')}
        title={t('admin.hospitalOperations')}
        description={t('admin.dashboardDescription')}
        aside={
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-[var(--shadow-panel)]">
            <Activity className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <span><strong className="text-slate-950">{openOperationalWork}</strong> {t('admin.openOperationalItems')}</span>
          </div>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/admin/patients')}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {t('admin.admitPatient')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/assignments')}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
            >
              {t('admin.careTeamAssignments')}
            </button>
          </>
        }
      />

      <section aria-label={t('admin.operationalPriorities')} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <nav aria-label={t('admin.additionalWorkload')} className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-200 pb-3">
        <button type="button" onClick={() => navigate('/admin/patients')} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-slate-700 transition-colors hover:bg-white hover:text-slate-950">
          <BedDouble className="h-4 w-4 text-blue-700" aria-hidden="true" />
          <span>{t('admin.occupiedBeds')} <strong className="ml-1 text-slate-950">{occupiedBedCount}</strong></span>
        </button>
        <button type="button" onClick={() => navigate('/admin/patients')} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-slate-700 transition-colors hover:bg-white hover:text-slate-950">
          <CalendarDays className="h-4 w-4 text-blue-700" aria-hidden="true" />
          <span>{t('admin.admissionsDischarges')} <strong className="ml-1 text-slate-950">{admissionsToday} / {dischargesToday}</strong></span>
        </button>
        <button type="button" onClick={() => navigate('/admin/patients')} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-slate-700 transition-colors hover:bg-white hover:text-slate-950">
          <ClipboardList className="h-4 w-4 text-blue-700" aria-hidden="true" />
          <span>{t('admin.proceduresToday')} <strong className="ml-1 text-slate-950">{proceduresToday}</strong></span>
        </button>
        <button type="button" onClick={() => navigate('/admin/assignments')} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-slate-700 transition-colors hover:bg-white hover:text-slate-950">
          <Stethoscope className="h-4 w-4 text-blue-700" aria-hidden="true" />
          <span>{t('admin.doctorAssignments')} <strong className="ml-1 text-slate-950">{assignedPatientCount} / {activePatients.length}</strong>{unassignedPatientCount > 0 && <span className="ml-1 text-amber-800">({t('admin.unassignedCount', { count: unassignedPatientCount })})</span>}</span>
        </button>
      </nav>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="clinical-surface min-w-0 p-4 sm:p-5">
          <SectionHeader
            title={t('admin.doctorAssignmentWorkload')}
            description={t('admin.assignmentCounts', { assigned: assignedPatientCount, unassigned: unassignedPatientCount })}
            actions={
              <button
                type="button"
                onClick={() => navigate('/admin/assignments')}
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-blue-800 hover:bg-blue-50"
              >
                {t('admin.manageAssignments')}
              </button>
            }
          />
          {doctorWorkload.length ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {doctorWorkload.slice(0, 4).map(({ doctor, patientCount }) => (
                <li key={doctor.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{doctor.name}</p>
                    <p className="text-xs text-slate-600">{doctor.specialty}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {patientCount === 1 ? t('admin.activePatientCountSingular') : t('admin.activePatientCount', { count: patientCount })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Stethoscope} title={t('admin.noDoctorsListed')} description={t('admin.doctorsAppearWhenConfigured')} />
          )}
          {unassignedPatientCount > 0 && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              {unassignedPatientCount === 1 ? t('admin.unassignedNeedsDoctor') : t('admin.unassignedNeedDoctor', { count: unassignedPatientCount })}
            </p>
          )}
        </section>

        <section className="clinical-surface min-w-0 p-4 sm:p-5">
          <SectionHeader
            title={t('admin.clinicalReviewQueue')}
            description={t('admin.recordedResultsAwaitingReview')}
            actions={
              <button
                type="button"
                onClick={() => navigate('/admin/patients')}
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-blue-800 hover:bg-blue-50"
              >
                {t('admin.openCensus')}
              </button>
            }
          />
          {pendingClinicalReviews.length ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {pendingClinicalReviews.slice(0, 4).map((item) => (
                <li key={item.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="truncate text-xs text-slate-600">{item.patientName} · {item.mrn} · {item.type}</p>
                  </div>
                  <time className="shrink-0 text-xs text-amber-800" dateTime={item.timestamp}>
                    {t('admin.review')}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CheckCircle2} title={t('admin.noReviewsPending')} description={t('admin.noResultsAwaiting')} />
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="overflow-hidden rounded-[var(--radius-panel)] border border-slate-200 bg-white shadow-[var(--shadow-panel)] xl:col-span-7">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <SectionHeader
              title={t('admin.currentInpatientCensus')}
              description={t('admin.activeAdmissionCount', { count: activePatients.length })}
              actions={
                <button
                  type="button"
                  onClick={() => navigate('/admin/patients')}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  {t('admin.openPatientDirectory')}
                </button>
              }
            />
            <label className="relative mt-4 block max-w-lg">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <span className="sr-only">{t('admin.searchHospitalCensus')}</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('admin.censusSearchPlaceholder')}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label={t('admin.clearCensusSearch')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
          </div>

          <div className="divide-y divide-slate-200">
            {filteredPatients.length === 0 ? (
              <EmptyState
                icon={Search}
                title={searchQuery ? t('admin.noCensusMatches', { query: searchQuery }) : t('admin.noActiveAdmissions')}
                description={searchQuery ? t('admin.checkNameLocation') : t('admin.newAdmissionsAppear')}
                action={searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t('doctor.clearPatientSearch')}
                  </button>
                ) : undefined}
              />
            ) : (
              filteredPatients.map((patient) => {
                const location = patient.currentLocation;
                return (
                  <article key={patient.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-slate-950">{patient.name}</h3>
                        <StatusBadge status={patient.status} size="sm" />
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        MRN <span className="font-mono font-medium text-slate-800">{patient.mrn}</span>
                        <span aria-hidden="true"> · </span>{patient.primaryCondition}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-sm sm:justify-end">
                      <div>
                        <p className="font-medium text-slate-900">{location?.department || patient.department}</p>
                        <p className="text-xs text-slate-600">{t('common.room')} {location?.room || patient.room} · {t('common.bed')} {location?.bed || patient.bed}</p>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-xs text-slate-500">{t('admin.attendingPhysician')}</p>
                        <p className="text-sm font-medium text-slate-800">{patient.assignedDoctorName || t('doctor.unassigned')}</p>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-[var(--radius-panel)] border border-slate-200 bg-white p-4 shadow-[var(--shadow-panel)] sm:p-5 xl:col-span-5">
          <SectionHeader
            title={t('admin.recentHospitalActivity')}
            description={t('admin.latestRecordedEvents')}
          />
          {recentTimeline.length === 0 ? (
            <EmptyState icon={Activity} title={t('admin.noActivityRecorded')} description={t('admin.patientCareEventsAppear')} />
          ) : (
            <ol className="mt-4 divide-y divide-slate-100">
              {recentTimeline.map((event) => (
                <li key={event.id} className="grid grid-cols-[1fr_auto] gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{t(adminActivityTitleKeys[event.category])}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {t('admin.activity.operationalEntry', {
                        patient: patients.find((patient) => patient.id === event.patientId)?.name || t('admin.unknownPatient'),
                      })}
                    </p>
                    {event.actor && <p className="mt-1 text-xs text-slate-500">{t('admin.recordedBy')} {event.actor}</p>}
                  </div>
                  <time className="whitespace-nowrap text-xs text-slate-500" dateTime={event.timestamp}>
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </time>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-5 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={() => navigate('/admin/activity')}
              className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              {t('admin.viewActivityLog')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
