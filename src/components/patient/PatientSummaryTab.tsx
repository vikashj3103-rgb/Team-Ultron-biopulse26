import React, { useState } from 'react';
import { Patient, Medication, MedicalReport, TimelineEvent } from '../../types';
import { StatusBadge } from '../common/Badge';
import { dataStore } from '../../services/dataStore';
import { formatTemperatureVal, FAHRENHEIT_NORMAL_RANGE_TEXT } from '../../utils/temperature';
import { 
  User, BedDouble, Stethoscope, HeartHandshake, ShieldAlert, 
  Activity, Pill, FileText, Clock, AlertTriangle, CheckCircle2, 
  Zap, Heart, Wind, Thermometer, Sparkles, Edit3, X, Save, 
  ClipboardList, BookOpen 
} from 'lucide-react';

interface PatientSummaryTabProps {
  patient: Patient;
  medications: Medication[];
  reports: MedicalReport[];
  timeline: TimelineEvent[];
  onSelectTab: (tab: 'overview' | 'summary' | 'reports' | 'medications' | 'vitals' | 'timeline') => void;
}

export const PatientSummaryTab: React.FC<PatientSummaryTabProps> = ({
  patient,
  medications,
  reports,
  timeline,
  onSelectTab,
}) => {
  const v = patient.latestVitals;
  const activeMeds = medications.filter((m) => m.status === 'Pending' || m.status === 'Given');
  const recentEvents = timeline.slice(0, 4);

  // Clinical Summary Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [diagnosis, setDiagnosis] = useState(patient.currentDiagnosis || patient.primaryCondition || '');
  const [careInstructions, setCareInstructions] = useState(patient.careInstructions || '');
  const [medicalHistory, setMedicalHistory] = useState(patient.medicalHistory || '');
  const [treatmentPlan, setTreatmentPlan] = useState(patient.treatmentPlan || '');
  const [allergiesInput, setAllergiesInput] = useState((patient.allergies || []).join(', '));
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveSummary = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedAllergies = allergiesInput
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    dataStore.updatePatient(patient.id, {
      currentDiagnosis: diagnosis,
      careInstructions,
      medicalHistory,
      treatmentPlan,
      allergies: updatedAllergies,
    });

    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Save Success Banner */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-bold">Verified clinical record saved.</span>
          </div>
        </div>
      )}

      {/* 1. Header Snapshot Banner */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 text-white shadow-sm">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 tracking-wider uppercase">
                Verified Clinical Record
              </span>
              <span className="text-xs text-slate-300 font-mono">MRN: {patient.mrn}</span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{patient.name}</h2>
              <StatusBadge status={patient.status} size="md" />
            </div>

            <p className="text-xs text-blue-200/90 font-medium">
              {patient.age}y {patient.gender} • Blood Group: <strong className="text-white">{patient.bloodGroup}</strong> • Admitted: {new Date(patient.admissionDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          {/* Location & Team Badges + Edit Button */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10">
              <span className="text-[10px] uppercase font-bold text-blue-200 block">Bed Location</span>
              <span className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                <BedDouble className="w-3.5 h-3.5 text-blue-400" />
                {patient.room} • {patient.bed}
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10">
              <span className="text-[10px] uppercase font-bold text-blue-200 block">Attending Doctor</span>
              <span className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />
                {patient.assignedDoctorName}
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10">
              <span className="text-[10px] uppercase font-bold text-blue-200 block">Bedside Caregiver</span>
              <span className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                <HeartHandshake className="w-3.5 h-3.5 text-pink-400" />
                {patient.assignedAttenderName} ({patient.assignedAttenderRelation || 'Attender'})
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Record</span>
            </button>
          </div>
        </div>

        {/* Primary Diagnosis Callout */}
        <div className="mt-4 pt-3 border-t border-white/10 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-slate-400 font-semibold">Diagnosis / Indication: </span>
            <span className="font-bold text-white">{patient.currentDiagnosis || patient.primaryCondition}</span>
          </div>
          <div className="text-[11px] text-slate-300 font-mono">
            Last Updated: {new Date(patient.lastVitalUpdate || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </div>

      {/* 2. Grid: Vitals Snapshot + Allergies / Cautions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 4 Vital Numbers & Bedside Instructions (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Latest Physiological Telemetry
            </h3>
            <button
              type="button"
              onClick={() => onSelectTab('vitals')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              View Trends →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {/* BP */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Blood Pressure</span>
              <span className="text-lg font-black font-mono text-slate-900 mt-1 block">
                {v.systolicBP}/{v.diastolicBP}
              </span>
              <span className="text-[10px] text-slate-400">mmHg (120/80)</span>
            </div>

            {/* Pulse */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Pulse Rate</span>
              <span className="text-lg font-black font-mono text-slate-900 mt-1 block">
                {v.pulse}
              </span>
              <span className="text-[10px] text-slate-400">bpm (60-100)</span>
            </div>

            {/* SpO2 */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Oxygen (SpO2)</span>
              <span className={`text-lg font-black font-mono mt-1 block ${v.spO2 < 93 ? 'text-red-600' : 'text-slate-900'}`}>
                {v.spO2}%
              </span>
              <span className="text-[10px] text-slate-400">(95-100%)</span>
            </div>

            {/* Temp */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Temperature</span>
              <span className="text-lg font-black font-mono text-slate-900 mt-1 block">
                {formatTemperatureVal(v.temperature)} °F
              </span>
              <span className="text-[10px] text-slate-400">({FAHRENHEIT_NORMAL_RANGE_TEXT})</span>
            </div>
          </div>

          {/* Current Bedside Care Instructions */}
          <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/70 text-xs text-blue-950 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-blue-900">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Active Care Instructions for Attender & Nursing:
            </span>
            <p className="leading-relaxed">
              {patient.careInstructions || 'No bedside care instructions documented.'}
            </p>
          </div>
        </div>

        {/* Right: Known Allergies & Clinical Cautions (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-bold text-slate-900">Known Drug Allergies</h3>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Safety Check</span>
          </div>

          {patient.allergies && patient.allergies.length > 0 ? (
            <div className="space-y-2">
              {patient.allergies.map((allergy, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 font-semibold"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>{allergy}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 text-center">
              No drug allergies documented.
            </div>
          )}

          <div className="pt-2 text-[11px] text-slate-500 space-y-1 border-t border-slate-100">
            <div className="flex justify-between">
              <span>Emergency Contact:</span>
              <span className="font-medium text-slate-800">{patient.emergencyContact || 'None on record'}</span>
            </div>
            <div className="flex justify-between">
              <span>Hardware Device:</span>
              <span className="font-mono font-medium text-slate-800">{patient.hardwareDeviceId || 'Not linked'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Medical History & Treatment Plan Strip (Section 5 requirement) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Important Medical History */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 text-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Important Medical History</h3>
          </div>
          <p className="text-slate-700 leading-relaxed font-medium">
            {patient.medicalHistory || 'No prior chronic conditions recorded. Review baseline admission workup.'}
          </p>
        </div>

        {/* Current Treatment Plan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 text-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <ClipboardList className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Current Clinical Treatment Plan</h3>
          </div>
          <p className="text-slate-700 leading-relaxed font-medium">
            {patient.treatmentPlan || 'Maintain continuous vitals observation, follow medication schedule, and evaluate for physical therapy.'}
          </p>
        </div>
      </div>

      {/* 4. Two Columns: Active Medications & Recent Reports / Events */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Medications (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Pill className="w-4 h-4 text-blue-600" />
              Active Medications ({activeMeds.length})
            </h3>
            <button
              type="button"
              onClick={() => onSelectTab('medications')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Manage Rx →
            </button>
          </div>

          {activeMeds.length === 0 ? (
            <div className="text-xs text-slate-400 py-6 text-center">
              No active medications prescribed.
            </div>
          ) : (
            <div className="space-y-2">
              {activeMeds.map((med) => (
                <div
                  key={med.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs gap-2"
                >
                  <div>
                    <div className="font-bold text-slate-900">{med.name} {med.dosage}</div>
                    <div className="text-[11px] text-slate-500">
                      {med.scheduledTime} • {med.instructions}
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      med.status === 'Given'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {med.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest Reports & Timeline Events (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              Recent Important Timeline Events
            </h3>
            <button
              type="button"
              onClick={() => onSelectTab('timeline')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800"
            >
              Full History →
            </button>
          </div>

          {recentEvents.length === 0 ? (
            <div className="text-xs text-slate-400 py-6 text-center">
              No recent timeline activity.
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 text-xs flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 block">{evt.title}</span>
                    <span className="text-[11px] text-slate-600 block line-clamp-1">{evt.description}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Latest Reports preview */}
          {reports.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Latest Diagnostic Report
                </span>
                <button
                  type="button"
                  onClick={() => onSelectTab('reports')}
                  className="text-[11px] font-semibold text-blue-600"
                >
                  View All ({reports.length}) →
                </button>
              </div>

              <div className="p-2.5 bg-blue-50/40 rounded-xl border border-blue-100 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{reports[0].title}</span>
                  <span className="text-[10px] text-slate-500">{reports[0].date}</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{reports[0].summary}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. CLINICAL RECORD EDIT MODAL (Doctor Persistent Updates) */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Update Clinical Summary & Care Instructions</h3>
                  <p className="text-[11px] text-slate-500">Changes persist to patient record and sync immediately across all devices.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSummary} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Clinical Diagnosis
                </label>
                <input
                  type="text"
                  required
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Acute Anterior Wall MI"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Active Care Instructions (Visible to Family Attender & Nursing)
                </label>
                <textarea
                  rows={3}
                  value={careInstructions}
                  onChange={(e) => setCareInstructions(e.target.value)}
                  placeholder="e.g. Elevate head of bed 30°. Assist with repositioning..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Important Medical History
                </label>
                <textarea
                  rows={2}
                  value={medicalHistory}
                  onChange={(e) => setMedicalHistory(e.target.value)}
                  placeholder="e.g. Type 2 Diabetes, Hypertension..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Clinical Treatment Plan
                </label>
                <textarea
                  rows={2}
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  placeholder="e.g. DAPT, Beta-blocker titration, daily telemetry..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Known Drug Allergies (Comma-separated)
                </label>
                <input
                  type="text"
                  value={allergiesInput}
                  onChange={(e) => setAllergiesInput(e.target.value)}
                  placeholder="e.g. Penicillin, Sulfonamides"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save & Sync Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
