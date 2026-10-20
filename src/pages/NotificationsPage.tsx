import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../services/dataStore';
import { NotificationItem } from '../types';
import { Bell, CheckCheck, ShieldAlert, AlertTriangle, Info, Clock, CheckCircle2 } from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { role, assignedAttenderId } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'critical' | 'unread'>('all');

  useEffect(() => {
    const refresh = () => {
      const assignedPt = role === 'attender' && assignedAttenderId ? dataStore.getPatientByAttender(assignedAttenderId) : undefined;
      setNotifications(dataStore.getNotifications(role || undefined, assignedPt?.id));
    };
    refresh();
    return dataStore.subscribe(refresh);
  }, [role, assignedAttenderId]);

  const filtered = notifications.filter((n) => {
    if (filter === 'critical') return n.severity === 'critical';
    if (filter === 'unread') return !n.read;
    return true;
  });

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'critical':
        return <ShieldAlert className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Notification Center</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time biometric alerts, smart glove patient calls, and clinical escalations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => dataStore.markAllNotificationsRead(role || undefined)}
          className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-blue-200 self-start sm:self-center"
        >
          <CheckCheck className="w-4 h-4" />
          Mark All As Read
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit text-xs font-semibold">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            filter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            filter === 'unread' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Unread ({notifications.filter((n) => !n.read).length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('critical')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            filter === 'critical' ? 'bg-white text-red-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Critical ({notifications.filter((n) => n.severity === 'critical').length})
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs">
            No notifications matching this filter.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => dataStore.markNotificationRead(item.id)}
              className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                !item.read
                  ? item.severity === 'critical'
                    ? 'bg-red-50/40'
                    : 'bg-amber-50/30'
                  : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getSeverityIcon(item.severity)}</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-900">{item.title}</h3>
                    {!item.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.message}</p>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" />
                <span>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
