import React, { useState, useEffect } from 'react';
import { dataStore } from '../../services/dataStore';
import { TimelineEvent } from '../../types';
import { History, Clock, Activity, Bell, UserCheck, ShieldAlert, CheckCircle2, Filter } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { adminActivityTitleKeys } from './adminActivityPresentation';

export const AdminActivityPage: React.FC = () => {
  const { t } = useLanguage();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    const refresh = () => {
      const patients = dataStore.getPatients();
      setPatientNames(Object.fromEntries(patients.map((patient) => [patient.id, patient.name])));
      const allEvents = patients.flatMap((p) => dataStore.getTimeline(p.id));
      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEvents(allEvents);
    };
    refresh();
    return dataStore.subscribe(refresh);
  }, []);

  const filteredEvents = filterCategory === 'all'
    ? events
    : events.filter((e) => e.category === filterCategory);

  const getCategoryBadge = (category: string, severity?: TimelineEvent['severity']) => {
    switch (category) {
      case 'ADMISSION':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ALERT':
        return severity === 'critical'
          ? 'bg-red-100 text-red-800 border-red-200'
          : 'bg-amber-100 text-amber-800 border-amber-200';
      case 'ALERT_ACKNOWLEDGED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ALERT_RESOLVED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'PATIENT_REQUEST':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'ASSIGNMENT':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DISCHARGE':
        return 'bg-slate-200 text-slate-800 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Hospital Activity Audit Log</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Complete Trail
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Unified chronological audit trail tracking admissions, assignments, hardware glove triggers, biometrics, and discharges.
          </p>
        </div>

        <span className="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200 self-start sm:self-center">
          {events.length} Recorded Events
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs text-xs">
        <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
        <span className="font-bold text-slate-700 mr-1">Filter by Channel:</span>
        <button
          type="button"
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filterCategory === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Activity
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('ADMISSION')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filterCategory === 'ADMISSION' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Admissions
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('ALERT')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filterCategory === 'ALERT' ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Alerts
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('PATIENT_REQUEST')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filterCategory === 'PATIENT_REQUEST' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Glove Requests
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('ASSIGNMENT')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filterCategory === 'ASSIGNMENT' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Doctor/Attender
        </button>
      </div>

      {/* Activity Timeline List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No activity log events match this filter.
          </div>
        ) : (
          filteredEvents.map((evt) => (
            <div key={evt.id} className="p-4 sm:p-5 flex items-start gap-4 hover:bg-slate-50/60 transition-colors">
              <div className="mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 block ring-4 ring-blue-100"></span>
              </div>

              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{t(adminActivityTitleKeys[evt.category])}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getCategoryBadge(evt.category, evt.severity)}`}>
                      {evt.category}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{new Date(evt.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-sans">
                  {t('admin.activity.operationalEntry', {
                    patient: patientNames[evt.patientId] || t('admin.unknownPatient'),
                  })}
                </p>

                {evt.actor && (
                  <div className="text-[11px] text-slate-400 pt-0.5">
                    Triggered by: <strong className="text-slate-600">{evt.actor}</strong>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
