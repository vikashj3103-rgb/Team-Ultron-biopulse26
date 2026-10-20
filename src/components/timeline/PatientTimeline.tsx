import React from 'react';
import { TimelineEvent } from '../../types';
import { 
  UserPlus, UserCheck, Activity, Pill, Bell, AlertOctagon, 
  FileText, LogOut, Clock 
} from 'lucide-react';

interface PatientTimelineProps {
  events: TimelineEvent[];
}

export const PatientTimeline: React.FC<PatientTimelineProps> = ({ events }) => {
  const getCategoryConfig = (category: TimelineEvent['category'], severity?: string) => {
    switch (category) {
      case 'ADMISSION':
        return {
          icon: <UserPlus className="w-4 h-4 text-blue-600" />,
          bg: 'bg-blue-100 border-blue-200',
        };
      case 'ASSIGNMENT':
        return {
          icon: <UserCheck className="w-4 h-4 text-blue-600" />,
          bg: 'bg-blue-100 border-blue-200',
        };
      case 'VITAL_CHANGE':
        return {
          icon: <Activity className="w-4 h-4 text-emerald-600" />,
          bg: 'bg-emerald-100 border-emerald-200',
        };
      case 'MEDICATION':
        return {
          icon: <Pill className="w-4 h-4 text-blue-600" />,
          bg: 'bg-blue-100 border-blue-200',
        };
      case 'PATIENT_REQUEST':
      case 'GLOVE_REQUEST':
        return {
          icon: <Bell className="w-4 h-4 text-amber-600" />,
          bg: 'bg-amber-100 border-amber-200',
        };
      case 'ALERT':
        return {
          icon: <AlertOctagon className={`w-4 h-4 ${severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`} />,
          bg: severity === 'critical' ? 'bg-red-100 border-red-300' : 'bg-amber-100 border-amber-200',
        };
      case 'ALERT_ACKNOWLEDGED':
      case 'ALERT_RESOLVED':
        return {
          icon: <Activity className="w-4 h-4 text-emerald-600" />,
          bg: 'bg-emerald-50 border-emerald-200',
        };
      case 'REPORT':
        return {
          icon: <FileText className="w-4 h-4 text-blue-600" />,
          bg: 'bg-blue-100 border-blue-200',
        };
      case 'DOCTOR_NOTE':
        return {
          icon: <FileText className="w-4 h-4 text-slate-700" />,
          bg: 'bg-slate-100 border-slate-300',
        };
      case 'ATTENDER_ACTION':
        return {
          icon: <Pill className="w-4 h-4 text-emerald-600" />,
          bg: 'bg-emerald-100 border-emerald-200',
        };
      case 'NURSE_CALL':
        return {
          icon: <Bell className="w-4 h-4 text-blue-600" />,
          bg: 'bg-blue-100 border-blue-200',
        };
      case 'TRANSFER':
        return {
          icon: <UserCheck className="w-4 h-4 text-blue-600" />,
          bg: 'bg-blue-100 border-blue-200',
        };
      case 'DISCHARGE':
        return {
          icon: <LogOut className="w-4 h-4 text-slate-600" />,
          bg: 'bg-slate-100 border-slate-300',
        };
      default:
        return {
          icon: <Clock className="w-4 h-4 text-slate-600" />,
          bg: 'bg-slate-100 border-slate-200',
        };
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  if (!events || events.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400 text-sm">
        No clinical timeline records registered yet.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900">Unified Clinical Timeline</h3>
          <p className="text-xs text-slate-500">Chronological history of patient events, vitals, and assistance calls</p>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
          {events.length} Events
        </span>
      </div>

      <div className="relative pl-6 space-y-5 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {events.map((evt) => {
          const config = getCategoryConfig(evt.category, evt.severity);
          return (
            <div key={evt.id} className="relative group">
              {/* Event Icon Node */}
              <div
                className={`absolute -left-6 top-0.5 w-6 h-6 rounded-full border flex items-center justify-center shadow-xs transition-transform group-hover:scale-110 ${config.bg}`}
              >
                {config.icon}
              </div>

              {/* Event Content */}
              <div className="bg-slate-50/70 hover:bg-slate-50 p-3 rounded-lg border border-slate-200/80 transition-colors">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-xs font-bold text-slate-900">{evt.title}</h4>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{formatTimestamp(evt.timestamp)}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{evt.description}</p>

                {evt.actor && (
                  <div className="mt-2 text-[10px] text-slate-400 font-medium">
                    Logged by: <span className="text-slate-600">{evt.actor}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
