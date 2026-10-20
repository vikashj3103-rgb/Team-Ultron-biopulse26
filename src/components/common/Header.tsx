import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { dataStore } from '../../services/dataStore';
import { 
  HeartHandshake, Bell, LogOut, User, Activity, 
  ShieldAlert, Menu, Sparkles 
} from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';
import { LanguageSelector } from './LanguageSelector';

interface HeaderProps {
  onMenuToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const { currentUser, role, logout, assignedAttenderId } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);

  useEffect(() => {
    const updateCount = () => {
      const assignedPt = role === 'attender' && assignedAttenderId ? dataStore.getPatientByAttender(assignedAttenderId) : undefined;
      const notifs = dataStore.getNotifications(role || undefined, assignedPt?.id);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    };
    updateCount();
    return dataStore.subscribe(updateCount);
  }, [role, assignedAttenderId]);

  const roleColors: Record<UserRole, string> = {
    admin: 'bg-blue-100 text-blue-800 border-blue-200',
    doctor: 'bg-blue-100 text-blue-800 border-blue-200',
    attender: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Mobile Menu + Brand Logo */}
          <div className="flex items-center gap-3">
            {onMenuToggle && (
              <button
                type="button"
                onClick={onMenuToggle}
                className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-none"
                aria-label="Toggle navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-extrabold tracking-tight text-slate-900">HealthConnect</span>
                  <span className="hidden sm:inline-block text-[10px] font-bold px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                    CLINICAL v1.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden md:block">
                  Connecting patients, caregivers and clinicians in real time
                </p>
              </div>
            </div>
          </div>



          {/* Right: Notifications, Online Indicator & User Profile */}
          <div className="flex items-center gap-3">
            {/* Realtime Telemetry Pulse */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Realtime Active
            </div>

            {/* Global Language Selector */}
            <LanguageSelector />

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => setIsNotifOpen(true)}
              className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              aria-label="Open notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Current User Pill */}
            {currentUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">
                    {currentUser.name}
                  </div>
                  <span
                    className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                      role ? roleColors[role] : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {role}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={logout}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
                  title="Sign out of HealthConnect"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Notification Center Slideover */}
      <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </>
  );
};
