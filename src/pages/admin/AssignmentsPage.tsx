import React, { useState, useEffect } from 'react';
import { dataStore } from '../../services/dataStore';
import { recommendSpecialtyAndDoctor, SPECIALTY_RULES } from '../../services/assignmentEngine';
import { Patient, Doctor } from '../../types';
import { StatusBadge } from '../../components/common/Badge';
import { 
  Sparkles, Stethoscope, UserCheck, CheckCircle2, 
  ArrowRight, Shield, AlertCircle, Info, X, AlertTriangle, ArrowLeftRight 
} from 'lucide-react';

export const AssignmentsPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('pat-ramesh');
  const [overrideDoctorId, setOverrideDoctorId] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showReassignModal, setShowReassignModal] = useState<boolean>(false);
  const [reassignReason, setReassignReason] = useState<string>('');
  const [reassignError, setReassignError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      setPatients(dataStore.getPatients());
      setDoctors(dataStore.getDoctors());
    };
    refresh();
    return dataStore.subscribe(refresh);
  }, []);

  useEffect(() => {
    if (!showReassignModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        setShowReassignModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showReassignModal]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  // Calculate recommendation
  const recommendation = selectedPatient
    ? recommendSpecialtyAndDoctor(selectedPatient.primaryCondition, selectedPatient.department, doctors)
    : null;

  useEffect(() => {
    if (recommendation?.recommendedDoctor) {
      setOverrideDoctorId(recommendation.recommendedDoctor.id);
    }
  }, [selectedPatientId]);

  const targetDoctor = doctors.find((d) => d.id === overrideDoctorId);
  const isReassignment = Boolean(
    selectedPatient?.assignedDoctorId &&
    overrideDoctorId &&
    selectedPatient.assignedDoctorId !== overrideDoctorId
  );

  const handleInitiateAssign = () => {
    if (!selectedPatient || !overrideDoctorId) return;
    if (isReassignment) {
      setReassignError(null);
      setReassignReason('');
      setShowReassignModal(true);
    } else {
      dataStore.assignDoctor(selectedPatient.id, overrideDoctorId, 'Initial specialty allocation', 'Admin Desk');
      setSuccessMsg(`✓ Successfully assigned ${targetDoctor?.name || 'physician'} to ${selectedPatient.name}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleConfirmReassign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !overrideDoctorId) return;
    if (!reassignReason.trim()) {
      setReassignError('Mandatory reason required for reassigning attending physician.');
      return;
    }
    dataStore.assignDoctor(selectedPatient.id, overrideDoctorId, reassignReason.trim(), 'Admin Desk');
    setSuccessMsg(`✓ Reassigned attending doctor to ${targetDoctor?.name || 'new physician'} for ${selectedPatient.name}. Care team and audit trail updated.`);
    setShowReassignModal(false);
    setReassignReason('');
    setReassignError(null);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Rule-Based Specialty Assignment
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Deterministic Rules Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Standard medical discipline matcher allocating optimal available specialists without AI diagnostic hallucination.
          </p>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Two Column Layout: Patient Picker + Engine Rationale */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Select Patient (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Select Admitted Inpatient</h3>
            <p className="text-xs text-slate-500">Pick an inpatient to review diagnosis and physician matches</p>
          </div>

          <div className="space-y-2">
            {patients.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedPatientId(p.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedPatient?.id === p.id
                    ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-slate-900">{p.name}</span>
                  <StatusBadge status={p.status} size="sm" />
                </div>
                <div className="text-xs text-slate-600 mb-1">
                  <strong>{p.room}</strong> ({p.bed}) • {p.primaryCondition}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                  <span>Current: <strong>{p.assignedDoctorName || 'Unassigned'}</strong></span>
                  <span className="text-blue-700 font-medium">{p.department}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Recommendation Engine & Assignment Action (7 cols) */}
        {selectedPatient && recommendation && (
          <div className="lg:col-span-7 space-y-5">
            {/* Rule Match Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Rule-Based Clinical Match</h3>
                  <p className="text-xs text-slate-500">Deterministic keyword & department classification</p>
                </div>
              </div>

              {/* Rationale explanation */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 uppercase tracking-wide text-[11px]">
                    Matched Specialty Discipline:
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full font-bold bg-blue-600 text-white text-xs">
                    {recommendation.matchedSpecialty}
                  </span>
                </div>
                <p className="text-blue-800 leading-relaxed">
                  {recommendation.rationale}
                </p>
              </div>

              {/* Recommended Doctor Card */}
              {recommendation.recommendedDoctor ? (
                <div className="border border-emerald-300 bg-emerald-50/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Recommended Primary Attending Physician
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      Lowest Active Caseload
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-emerald-200">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                        {recommendation.recommendedDoctor.name.charAt(4)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {recommendation.recommendedDoctor.name}
                        </h4>
                        <div className="text-xs text-slate-500">
                          {recommendation.recommendedDoctor.specialty} • {recommendation.recommendedDoctor.phone}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900">
                        {recommendation.recommendedDoctor.activePatientCount} Active
                      </div>
                      <span className="text-[11px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {recommendation.recommendedDoctor.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  No registered doctor currently available under specialty "{recommendation.matchedSpecialty}". Manual physician override required.
                </div>
              )}

              {/* Manual Override Form */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Physician Assignment (Manual Override Supported)
                  </label>
                  <span className="text-[11px] text-slate-400">Admin privilege</span>
                </div>

                <select
                  value={overrideDoctorId}
                  onChange={(e) => setOverrideDoctorId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl bg-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Doctor</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.specialty} ({d.activePatientCount} active patients) {d.isOnline ? '• Online' : ''}
                    </option>
                  ))}
                </select>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleInitiateAssign}
                    className={`px-5 py-2.5 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                      isReassignment
                        ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
                        : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
                    }`}
                  >
                    {isReassignment ? <ArrowLeftRight className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    {isReassignment ? 'Reassign Attending Physician' : 'Confirm Specialty Assignment'}
                  </button>
                </div>
              </div>
            </div>

            {/* Specialty Rules Table Reference */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Info className="w-4 h-4 text-slate-500" />
                <span>Active Specialty Engine Rules</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Rules map symptoms and admission indications to hospital disciplines:
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {SPECIALTY_RULES.map((rule) => (
                  <div key={rule.specialty} className="bg-white p-2 rounded border border-slate-200">
                    <strong className="text-slate-900 block">{rule.specialty}</strong>
                    <span className="text-slate-500">{rule.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mandatory Reason Doctor Reassignment Modal */}
      {showReassignModal && selectedPatient && targetDoctor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={() => setShowReassignModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reassign-modal-title"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="reassign-modal-title" className="text-base font-extrabold text-slate-900">
                    Reassign Attending Physician
                  </h3>
                  <p className="text-xs text-slate-500">
                    Clinical handover for {selectedPatient.name} (Room {selectedPatient.room})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReassignModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Doctor Handover Comparison */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Previous Attending
                </span>
                <p className="font-bold text-slate-900">{selectedPatient.assignedDoctorName || 'None'}</p>
                <p className="text-[11px] text-slate-500">{selectedPatient.assignedDoctorSpecialty || 'Specialist'}</p>
              </div>

              <div className="space-y-1 pl-3 border-l border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                  New Attending Doctor
                </span>
                <p className="font-bold text-blue-900">{targetDoctor.name}</p>
                <p className="text-[11px] text-blue-700 font-semibold">{targetDoctor.specialty}</p>
              </div>
            </div>

            {/* Reason Form */}
            <form onSubmit={handleConfirmReassign} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mandatory Reassignment Reason <span className="text-red-500">*</span>:
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Shift handover',
                    'Doctor on leave',
                    'Specialty escalation',
                    'Workload balancing',
                    'Service/department change',
                    'Clinical requirement',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setReassignReason(chip);
                        setReassignError(null);
                      }}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                        reassignReason === chip
                          ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <textarea
                  value={reassignReason}
                  onChange={(e) => {
                    setReassignReason(e.target.value);
                    if (reassignError) setReassignError(null);
                  }}
                  required
                  placeholder="Enter specific clinical indication or administrative justification for this handover..."
                  rows={3}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900"
                />
                {reassignError && (
                  <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {reassignError}
                  </p>
                )}
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  This action updates the inpatient care team roster, emits a timeline handover event, and logs a permanent <code>DOCTOR_REASSIGNED</code> audit record.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-amber-600/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm & Audit Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
