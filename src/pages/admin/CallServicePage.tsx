import React, { useState, useEffect } from 'react';
import { dataStore } from '../../services/dataStore';
import { CallRequest, CallServiceStaff, CallStatus, CallPriority } from '../../types';
import { 
  PhoneCall, AlertOctagon, UserCheck, Clock, CheckCircle2, 
  XCircle, ArrowRight, UserPlus, RefreshCw, Volume2, VolumeX,
  ShieldAlert, Radio, Activity, MapPin, Building2, User
} from 'lucide-react';
import { useLanguage } from '../../i18n';

export const CallServicePage: React.FC = () => {
  const { t } = useLanguage();
  const [calls, setCalls] = useState<CallRequest[]>([]);
  const [staffList, setStaffList] = useState<CallServiceStaff[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [soundEnabled, setSoundEnabled] = useState(dataStore.getSoundEnabled());
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [reassignModalCall, setReassignModalCall] = useState<CallRequest | null>(null);

  // New Staff form state
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'Nurse' | 'Support Staff' | 'Ward Assistant' | 'Duty Physician'>('Nurse');
  const [newStaffDept, setNewStaffDept] = useState('Critical Care');
  const [newStaffWard, setNewStaffWard] = useState('ICU-Floor 1');
  const [newStaffFloor, setNewStaffFloor] = useState<number>(1);
  const [newStaffPhone, setNewStaffPhone] = useState('+91 98401 11000');

  useEffect(() => {
    const update = () => {
      setCalls(dataStore.getCallRequests());
      setStaffList(dataStore.getCallStaff());
      setSoundEnabled(dataStore.getSoundEnabled());
    };
    update();
    const unsub = dataStore.subscribe(update);
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!showAddStaffModal && !reassignModalCall) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        setShowAddStaffModal(false);
        setReassignModalCall(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddStaffModal, reassignModalCall]);

  const waitingCalls = calls.filter((c) => c.status === 'WAITING' || c.status === 'ASSIGNED');
  const criticalCalls = calls.filter((c) => c.priority === 'CRITICAL' && c.status !== 'RESOLVED' && c.status !== 'CANCELLED');
  const activeStaff = staffList.filter((s) => s.status === 'AVAILABLE');

  // Filtered list
  const filteredCalls = calls.filter((c) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return c.status !== 'RESOLVED' && c.status !== 'CANCELLED';
    if (filterStatus === 'CRITICAL') return c.priority === 'CRITICAL' && c.status !== 'RESOLVED' && c.status !== 'CANCELLED';
    if (filterStatus === 'RESPONDING') return c.status === 'RESPONDING' || c.status === 'ARRIVED';
    return c.status === filterStatus;
  });

  const getElapsedTime = (createdIso: string) => {
    const elapsedSec = Math.max(0, Math.floor((currentTime - new Date(createdIso).getTime()) / 1000));
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getResponseTime = (call: CallRequest) => {
    const end = call.arrivedAt || call.respondingAt || call.resolvedAt;
    if (!end) return null;
    const diffSec = Math.max(0, Math.floor((new Date(end).getTime() - new Date(call.createdAt).getTime()) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const handleUpdateStatus = (callId: string, status: CallStatus) => {
    dataStore.updateCallStatus(callId, status);
  };

  const handleEscalate = (callId: string) => {
    dataStore.escalateCall(callId, 'Emergency priority escalation requested by dispatch admin', 'Dispatch Admin');
  };

  const handleCancelCall = (callId: string) => {
    dataStore.updateCallStatus(callId, 'CANCELLED', 'Cancelled by dispatch admin');
  };

  const handleToggleStaffStatus = (staffId: string, currentStatus: 'AVAILABLE' | 'BUSY' | 'OFFLINE') => {
    const nextStatus = currentStatus === 'AVAILABLE' ? 'BUSY' : currentStatus === 'BUSY' ? 'OFFLINE' : 'AVAILABLE';
    dataStore.updateStaffStatus(staffId, nextStatus);
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    dataStore.addCallStaffMember({
      name: newStaffName.trim(),
      role: newStaffRole,
      department: newStaffDept.trim(),
      ward: newStaffWard.trim(),
      floor: Number(newStaffFloor),
      status: 'AVAILABLE',
      phone: newStaffPhone.trim(),
    });
    setNewStaffName('');
    setShowAddStaffModal(false);
  };

  const handleReassign = (callId: string, staffId: string) => {
    dataStore.updateCallStatus(callId, 'ASSIGNED', staffId, 'Manually reassigned by dispatch admin');
    setReassignModalCall(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-700 text-white shadow-sm">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {t('callService.title')}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {t('callService.badge')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('callService.description')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              dataStore.setSoundEnabled(next);
              setSoundEnabled(next);
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              soundEnabled
                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            <span>Sound Alert: {soundEnabled ? 'ON' : 'MUTED'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddStaffModal(true)}
            className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('callService.addStaff')}</span>
          </button>
        </div>
      </div>

      {/* 2. Urgent Live Banner if critical calls are waiting */}
      {criticalCalls.length > 0 && (
        <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-4.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-900 font-extrabold text-sm uppercase tracking-wide">
              <AlertOctagon className="w-5 h-5 text-red-600" />
              <span>CRITICAL BEDSIDE CALL WAITING ({criticalCalls.length})</span>
            </div>
            <span className="text-xs text-red-700 font-bold font-mono">IMMEDIATE ATTENTION REQUIRED</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {criticalCalls.map((call) => (
              <div key={call.id} className="bg-white p-3.5 rounded-xl border border-red-300 shadow-xs flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-red-900 flex items-center gap-1.5">
                    <span>{call.patientName}</span>
                    <span className="font-mono text-slate-600 font-normal">({call.room} • {call.bed})</span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5 font-medium">{call.reason}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Called by: {call.attenderName} ({call.attenderRelation}) • Waiting: <strong className="text-red-600 font-mono">{getElapsedTime(call.createdAt)}</strong>
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(call.id, 'RESPONDING')}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs"
                  >
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    onClick={() => setReassignModalCall(call)}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold"
                  >
                    Reassign
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Pending Queue</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">{waitingCalls.length}</span>
            <span className="text-xs text-slate-500">Calls waiting</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Available Staff</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">{activeStaff.length}</span>
            <span className="text-xs text-slate-500">of {staffList.length} ready</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Critical Acuity</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-red-600">{criticalCalls.length}</span>
            <span className="text-xs text-slate-500">High priority</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Requests</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-700">{calls.length}</span>
            <span className="text-xs text-slate-500">Logged</span>
          </div>
        </div>
      </div>

      {/* 4. Two Columns: Live Call Queue (7 cols) + Duty Staff Roster (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Call Queue (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-700" />
                Call Queue & Response Timing
              </h3>
              <p className="text-xs text-slate-500">Bedside attender and patient assistance queue</p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  filterStatus === 'all' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t('callService.tabAll')} ({calls.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('active')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  filterStatus === 'active' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t('callService.tabActive')} ({calls.filter(c => c.status !== 'RESOLVED' && c.status !== 'CANCELLED').length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('WAITING')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  filterStatus === 'WAITING' ? 'bg-amber-600 text-white' : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                {t('callService.tabWaiting')} ({calls.filter(c => c.status === 'WAITING').length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('RESPONDING')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  filterStatus === 'RESPONDING' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t('callService.tabResponding')} ({calls.filter(c => c.status === 'RESPONDING' || c.status === 'ARRIVED').length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('RESOLVED')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  filterStatus === 'RESOLVED' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t('callService.tabResolved')} ({calls.filter(c => c.status === 'RESOLVED').length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('CRITICAL')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  filterStatus === 'CRITICAL' ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'
                }`}
              >
                {t('callService.tabCritical')} ({criticalCalls.length})
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[600px]">
            {filteredCalls.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                No calls match the selected filter.
              </div>
            ) : (
              filteredCalls.map((call) => {
                const isWaiting = call.status === 'WAITING' || call.status === 'ASSIGNED';
                const isCritical = call.priority === 'CRITICAL';
                return (
                  <div
                    key={call.id}
                    className={`p-4 rounded-xl border transition-all text-xs space-y-2.5 ${
                      call.status === 'RESOLVED'
                        ? 'border-slate-200 bg-slate-50/60 opacity-80'
                        : isCritical
                        ? 'border-red-400 bg-red-50/40 ring-1 ring-red-400/30'
                        : isWaiting
                        ? 'border-amber-300 bg-amber-50/30'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCritical
                              ? 'bg-red-600 text-white'
                              : call.priority === 'URGENT'
                              ? 'bg-amber-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {call.priority}
                        </span>
                        <span className="font-extrabold text-slate-900 text-sm">
                          {call.patientName}
                        </span>
                        <span className="text-slate-500 font-medium">
                          • Room {call.room} ({call.bed}) • Floor {call.floor ?? 1}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px]">
                          Req: {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>

                      {/* Status & SLA Timer */}
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        {isWaiting && (
                          <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Waiting {getElapsedTime(call.createdAt)}</span>
                          </div>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            call.status === 'RESOLVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : call.status === 'ARRIVED'
                              ? 'bg-teal-100 text-teal-800'
                              : call.status === 'RESPONDING'
                              ? 'bg-blue-100 text-blue-800'
                              : call.status === 'ASSIGNED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {call.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-700 font-medium leading-relaxed">
                      {call.reason}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <div className="space-y-0.5">
                        <div>
                          <span>Attender: <strong>{call.attenderName}</strong> ({call.attenderRelation})</span>
                          {call.assignedStaffName && (
                            <span className="ml-2 pl-2 border-l border-slate-200">
                              Assigned Staff: <strong className="text-blue-700">{call.assignedStaffName}</strong> ({call.assignedStaffRole})
                              {call.assignedStaffContact && (
                                <span className="font-mono text-slate-600 text-[10px] ml-1">
                                  [Internal Staff Tel: {call.assignedStaffContact}]
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        {getResponseTime(call) && (
                          <div className="text-[10px] text-emerald-700 font-medium">
                            Response time: <strong>{getResponseTime(call)}</strong>
                          </div>
                        )}
                      </div>

                      {/* Call Action Workflow Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {call.status === 'WAITING' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(call.id, 'ACKNOWLEDGED')}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold"
                          >
                            {t('callService.actionAcknowledge')}
                          </button>
                        )}
                        {(call.status === 'WAITING' || call.status === 'ACKNOWLEDGED') && (
                          <button
                            type="button"
                            onClick={() => setReassignModalCall(call)}
                            className="px-2.5 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded-lg font-bold"
                          >
                            {t('callService.actionAssign')}
                          </button>
                        )}
                        {(call.status === 'ASSIGNED' || call.status === 'ACKNOWLEDGED') && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(call.id, 'RESPONDING')}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
                          >
                            {t('callService.actionResponding')}
                          </button>
                        )}
                        {(call.status === 'ASSIGNED' || call.status === 'RESPONDING') && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(call.id, 'ARRIVED')}
                            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold"
                          >
                            {t('callService.actionArrived')}
                          </button>
                        )}
                        {call.status !== 'RESOLVED' && call.status !== 'CANCELLED' && call.priority !== 'CRITICAL' && (
                          <button
                            type="button"
                            onClick={() => handleEscalate(call.id)}
                            className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold"
                          >
                            {t('callService.actionEscalate')}
                          </button>
                        )}
                        {call.status !== 'RESOLVED' && call.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(call.id, 'RESOLVED')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold"
                          >
                            {t('callService.actionResolve')}
                          </button>
                        )}
                        {call.status !== 'RESOLVED' && call.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            onClick={() => setReassignModalCall(call)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                          >
                            {t('callService.reassign')}
                          </button>
                        )}
                        {call.status !== 'RESOLVED' && call.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            onClick={() => handleCancelCall(call.id)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg"
                          >
                            {t('callService.actionCancel')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Duty Staff Management Roster (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-700" />
                {t('callService.dutyStaffRoster')} ({staffList.length})
              </h3>
              <p className="text-xs text-slate-500">Floor duty availability and workload allocation</p>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {activeStaff.length} {t('callService.available')}
            </span>
          </div>

          <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[600px]">
            {staffList.map((staff) => (
              <div
                key={staff.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-xs space-y-2 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                      {staff.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{staff.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {staff.role} • Floor {staff.floor} ({staff.ward})
                      </div>
                    </div>
                  </div>

                  {/* Availability Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleStaffStatus(staff.id, staff.status)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                      staff.status === 'AVAILABLE'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : staff.status === 'BUSY'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-slate-200 text-slate-600 border border-slate-300'
                    }`}
                    title="Click to change availability status"
                  >
                    {staff.status === 'AVAILABLE' ? t('callService.available') : staff.status === 'BUSY' ? t('callService.busy') : t('callService.offline')}
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                  <span className="font-mono">{staff.phone || '+91 98401 11000'}</span>
                  <span className="font-semibold text-slate-700">
                    Active Calls: <strong className="text-blue-700">{staff.activeCallCount}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. ADD STAFF MODAL */}
      {showAddStaffModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setShowAddStaffModal(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-staff-modal-title"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 id="add-staff-modal-title" className="text-base font-bold text-slate-900">Add Duty Staff Member</h3>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="e.g. Nurse Anjali Menon"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Role</label>
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium bg-white"
                  >
                    <option value="Nurse">Nurse</option>
                    <option value="Support Staff">Support Staff</option>
                    <option value="Ward Assistant">Ward Assistant</option>
                    <option value="Duty Physician">Duty Physician</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Floor</label>
                  <select
                    value={newStaffFloor}
                    onChange={(e) => setNewStaffFloor(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium bg-white"
                  >
                    <option value={0}>Floor 0 (Ground)</option>
                    <option value={1}>Floor 1 (ICU/Inpatient)</option>
                    <option value={2}>Floor 2 (Cardiology)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ward Location</label>
                <input
                  type="text"
                  required
                  value={newStaffWard}
                  onChange={(e) => setNewStaffWard(e.target.value)}
                  placeholder="e.g. ICU-Floor 1 or Cardiology-Floor 2"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  placeholder="+91 98401 11000"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-xl font-bold shadow-xs"
                >
                  Register Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. REASSIGN MODAL */}
      {reassignModalCall && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setReassignModalCall(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reassign-call-title"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 id="reassign-call-title" className="text-base font-bold text-slate-900">Reassign Bedside Call</h3>
                <p className="text-[11px] text-slate-500">
                  {reassignModalCall.patientName} (Room {reassignModalCall.room})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReassignModalCall(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <span className="font-semibold text-slate-700 block">Select Staff Member:</span>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {staffList.map((staff) => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => handleReassign(reassignModalCall.id, staff.id)}
                    className="w-full p-2.5 text-left rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-between transition-all"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{staff.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {staff.role} • Floor {staff.floor} ({staff.ward})
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        staff.status === 'AVAILABLE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {staff.status} ({staff.activeCallCount} active)
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setReassignModalCall(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
