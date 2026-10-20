import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { User, Shield, Stethoscope, HeartHandshake, LogOut, CheckCircle2 } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { currentUser, role, logout } = useAuth();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">User Profile & Access Credentials</h1>
        <p className="text-xs text-slate-500 mt-1">
          Active clinical session, role authorization, and hospital security credentials.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-md shadow-blue-500/20">
            {currentUser?.name.charAt(0) || 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{currentUser?.name}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                {role}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{currentUser?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-slate-400 font-medium block text-[11px] uppercase">Access Level</span>
            <span className="font-bold text-slate-900 capitalize">{role} Authorization</span>
            <p className="text-[11px] text-slate-500">
              {role === 'doctor'
                ? 'Authorized for assigned patient charts, telemetry review, alert acknowledgements, and clinical notes.'
                : role === 'attender'
                ? 'Authorized for single assigned patient assistance calls, bed alerts, and camera observation.'
                : 'Full administrative rights for patient admissions, specialty rules, and physician pairing.'}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-slate-400 font-medium block text-[11px] uppercase">Authentication State</span>
            <span className="font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Authenticated Session
            </span>
            <p className="text-[11px] text-slate-500">
              Connected via HealthConnect session manager with Row Level Security enforcement.
            </p>
          </div>
        </div>

        {/* Account Security & Role Details */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Role & Security Context
          </h3>
          <p className="text-xs text-slate-600">
            You are signed in under authenticated credentials for role <strong className="text-slate-900 capitalize">{role}</strong>. To change roles or test other personas, please sign out and sign in with the desired persona from the secure login portal.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={logout}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors border border-red-200"
          >
            <LogOut className="w-4 h-4" />
            Sign Out of HealthConnect
          </button>
        </div>
      </div>
    </div>
  );
};
