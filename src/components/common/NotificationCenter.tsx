import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataStore } from '../../services/dataStore';
import { Bell, CheckCheck, Clock, ShieldAlert, AlertTriangle, Info, BellRing } from 'lucide-react';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const { role, assignedAttenderId } = useAuth();
  const [browserPerm, setBrowserPerm] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  });

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const assignedPt = role === 'attender' && assignedAttenderId ? dataStore.getPatientByAttender(assignedAttenderId) : undefined;
  const notifications = dataStore.getNotifications(role || undefined, assignedPt?.id);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleRequestBrowserPerm = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setBrowserPerm(perm);
    }
  };

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

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-center-title"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 id="notification-center-title" className="text-sm font-bold text-slate-900">Notification Center</h3>
              <p className="text-xs text-slate-500">{unreadCount} unread alerts & calls</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label="Close notification center"
          >
            ✕
          </button>
        </div>

        {/* Browser Push Permission Banner */}
        {browserPerm !== 'granted' && (
          <div className="p-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Enable browser notifications for audio/visual popups</span>
            </div>
            <button
              type="button"
              onClick={handleRequestBrowserPerm}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-[11px] shrink-0"
            >
              Enable
            </button>
          </div>
        )}

        {/* List of Notifications */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No recent notifications logged.
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => dataStore.markNotificationRead(item.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  !item.read
                    ? item.severity === 'critical'
                      ? 'bg-red-50/70 border-red-200 ring-1 ring-red-300'
                      : 'bg-amber-50/60 border-amber-200'
                    : 'bg-white border-slate-200 opacity-75'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">{getSeverityIcon(item.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{item.title}</h4>
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTimestamp(item.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.message}</p>
                  </div>
                  {!item.read && <span className="w-2 h-2 rounded-full bg-blue-600 mt-1 shrink-0"></span>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={() => dataStore.markAllNotificationsRead(role || undefined)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all as read
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
