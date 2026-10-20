import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, UserCheck, HeartHandshake, ShieldAlert, Activity, 
  Settings, UserPlus, Stethoscope, Video, Pill, Bell, Home, BedDouble
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { role, currentUser } = useAuth();

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
      isActive
        ? 'bg-blue-600 text-white shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed lg:static top-16 bottom-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 space-y-6 overflow-y-auto">
          {/* Role Status Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Active Portal
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 capitalize">
                {role} Workspace
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate">
              {currentUser?.email}
            </p>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {role === 'admin' && (
              <>
                <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Administration
                </div>
                <NavLink to="/admin" end className={navClass} onClick={onClose}>
                  <Home className="w-4 h-4" />
                  <span>Overview Dashboard</span>
                </NavLink>
                <NavLink to="/admin/patients" className={navClass} onClick={onClose}>
                  <Users className="w-4 h-4" />
                  <span>Patient Admissions</span>
                </NavLink>
                <NavLink to="/admin/doctors" className={navClass} onClick={onClose}>
                  <Stethoscope className="w-4 h-4" />
                  <span>Doctor Directory</span>
                </NavLink>
                <NavLink to="/admin/attenders" className={navClass} onClick={onClose}>
                  <HeartHandshake className="w-4 h-4" />
                  <span>Attender Management</span>
                </NavLink>
                <NavLink to="/admin/assignments" className={navClass} onClick={onClose}>
                  <UserCheck className="w-4 h-4" />
                  <span>Rule-Based Assignments</span>
                </NavLink>
              </>
            )}

            {role === 'doctor' && (
              <>
                <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Clinical Care
                </div>
                <NavLink to="/doctor" end className={navClass} onClick={onClose}>
                  <Activity className="w-4 h-4" />
                  <span>Assigned Patients</span>
                </NavLink>
                <NavLink to="/notifications" className={navClass} onClick={onClose}>
                  <ShieldAlert className="w-4 h-4" />
                  <span>Alerts & Telemetry</span>
                </NavLink>
                <NavLink to="/profile" className={navClass} onClick={onClose}>
                  <Settings className="w-4 h-4" />
                  <span>Physician Settings</span>
                </NavLink>
              </>
            )}

            {role === 'attender' && (
              <>
                <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Bedside Assistance
                </div>
                <NavLink to="/attender" end className={navClass} onClick={onClose}>
                  <BedDouble className="w-4 h-4" />
                  <span>My Assigned Patient</span>
                </NavLink>
                <NavLink to="/notifications" className={navClass} onClick={onClose}>
                  <Bell className="w-4 h-4" />
                  <span>Assistance Alerts</span>
                </NavLink>
                <NavLink to="/profile" className={navClass} onClick={onClose}>
                  <Settings className="w-4 h-4" />
                  <span>Attender Profile</span>
                </NavLink>
              </>
            )}
          </nav>
        </div>

        {/* System Footer Notice */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center justify-between font-semibold text-slate-700">
              <span>Smart Glove Link</span>
              <span className="text-emerald-600 font-mono">ONLINE</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Residual gesture recognition engine active on local WebSocket/HTTP pipeline.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
