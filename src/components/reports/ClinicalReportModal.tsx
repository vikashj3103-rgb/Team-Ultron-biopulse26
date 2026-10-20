import React, { useRef } from 'react';
import { Patient, Medication, MedicalReport, DoctorNote, TimelineEvent } from '../../types';
import { formatTemperatureF, celsiusToFahrenheit } from '../../utils/temperature';
import { 
  Building2, Printer, Download, X, Stethoscope, 
  BedDouble, HeartHandshake, ShieldAlert, Sparkles, 
  FileText, CheckCircle2, AlertTriangle, Pill, Clock, Activity 
} from 'lucide-react';

interface ClinicalReportModalProps {
  patient: Patient;
  medications: Medication[];
  reports: MedicalReport[];
  notes: DoctorNote[];
  timeline: TimelineEvent[];
  isOpen: boolean;
  onClose: () => void;
}

export const ClinicalReportModal: React.FC<ClinicalReportModalProps> = ({
  patient,
  medications,
  reports,
  notes,
  timeline,
  isOpen,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

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

  const v = patient.latestVitals;
  const activeMeds = medications.filter((m) => m.status === 'Pending' || m.status === 'Given');
  const recentTimeline = timeline.slice(0, 8);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadText = () => {
    const reportText = `
================================================================================
HEALTHCONNECT INPATIENT CLINICAL SUMMARY REPORT
================================================================================
Generated: ${new Date().toLocaleString()}
Hospital: HealthConnect Advanced Inpatient Care Center, Level 4
MRN: ${patient.mrn}
Patient Name: ${patient.name}
Demographics: ${patient.age}y ${patient.gender} | Blood Group: ${patient.bloodGroup}
Admission Date: ${new Date(patient.admissionDate).toLocaleDateString()}
Bed Location: Room ${patient.room} (${patient.bed})
Primary Diagnosis: ${patient.currentDiagnosis || patient.primaryCondition}
Attending Doctor: ${patient.assignedDoctorName} (${patient.assignedDoctorSpecialty})
Bedside Attender: ${patient.assignedAttenderName || 'None'} (${patient.assignedAttenderRelation || 'N/A'})

--------------------------------------------------------------------------------
1. LATEST BIOMETRIC VITALS TELEMETRY
--------------------------------------------------------------------------------
Blood Pressure: ${v.systolicBP}/${v.diastolicBP} mmHg (${v.bpStatus})
Heart Rate: ${v.pulse} bpm (${v.pulseStatus})
Oxygen Saturation: ${v.spO2}% (${v.spO2Status})
Body Temperature: ${formatTemperatureF(v.temperature)} (${v.tempStatus})
Last Telemetry Timestamp: ${v.timestamp}

--------------------------------------------------------------------------------
2. ACTIVE MEDICATIONS (${activeMeds.length})
--------------------------------------------------------------------------------
${activeMeds.map((m) => `• ${m.name} ${m.dosage} - ${m.route} (${m.frequency}) | Time: ${m.scheduledTime} | Status: ${m.status} | Prescribed By: ${m.prescribedBy}`).join('\n')}

--------------------------------------------------------------------------------
3. ALLERGIES & CARE INSTRUCTIONS
--------------------------------------------------------------------------------
Allergies: ${(patient.allergies || []).join(', ') || 'No Known Drug Allergies (NKDA)'}
Care Instructions: ${patient.careInstructions || 'Standard inpatient care.'}
Medical History: ${patient.medicalHistory || 'None documented.'}
Treatment Plan: ${patient.treatmentPlan || 'None documented.'}

--------------------------------------------------------------------------------
4. CLINICAL DOCTOR NOTES
--------------------------------------------------------------------------------
${notes.map((n) => `[${new Date(n.timestamp).toLocaleDateString()}] ${n.doctorName} (${n.category}): ${n.content}`).join('\n\n') || 'No clinical notes logged.'}

--------------------------------------------------------------------------------
5. RECENT TIMELINE ACTIVITY
--------------------------------------------------------------------------------
${recentTimeline.map((t) => `• [${new Date(t.timestamp).toLocaleTimeString()}] ${t.title}: ${t.description}`).join('\n')}

================================================================================
DISCLAIMER: This document is an assistive clinical report compiled from bedside 
IoT smart glove monitoring, vital sensors, and electronic health records. It is 
provided to support licensed healthcare practitioners and does not substitute for 
independent clinical assessment.
================================================================================
`;
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Clinical_Report_${patient.mrn}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="clinical-report-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/70 p-2 backdrop-blur-xs sm:p-4 print:static print:bg-white print:p-0"
      onClick={onClose}
    >
      <div
        className="clinical-report-document w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl print:max-w-none print:rounded-none print:border-none print:shadow-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clinical-report-modal-title"
      >
        {/* Modal Top Bar (hidden during printing) */}
        <div className="flex items-center justify-between gap-3 bg-slate-950 p-4 text-white print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h2 id="clinical-report-modal-title" className="text-sm font-bold">Standard Inpatient Clinical Summary Workspace</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-700 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Generate PDF</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadText}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              <Download className="w-4 h-4" />
              <span>Download Text</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close clinical report modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Report Document Body */}
        <div ref={printRef} className="p-6 sm:p-8 space-y-6 text-slate-900 bg-white">
          {/* Hospital Header & Branding */}
          <div className="flex items-start justify-between pb-6 border-b-2 border-slate-900">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center font-black text-sm">
                  CC
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                    HealthConnect Health System
                  </h1>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Advanced Inpatient Telemetry & Assistive Monitoring Center
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 pt-1">
                400 Healthcare Way, Medical Center Tower, Floor 4 • Ward Telemetry Unit
              </p>
            </div>

            <div className="text-right space-y-1">
              <span className="inline-block px-3 py-1 rounded bg-blue-100 text-blue-900 font-extrabold text-xs tracking-wider uppercase border border-blue-200">
                Official Clinical Summary
              </span>
              <div className="text-xs text-slate-500 font-mono">
                Date: {new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Generated: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Patient Demographics & Identification Grid */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Patient Name</span>
              <strong className="text-sm font-extrabold text-slate-900 block mt-0.5">{patient.name}</strong>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">MRN</span>
              <span className="font-mono font-bold text-slate-800 block mt-0.5">{patient.mrn}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Age / Gender</span>
              <span className="font-bold text-slate-800 block mt-0.5">{patient.age}y • {patient.gender}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Blood Group</span>
              <span className="font-extrabold text-red-600 block mt-0.5">{patient.bloodGroup}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Bed Location</span>
              <span className="font-bold text-slate-800 block mt-0.5">{patient.room} ({patient.bed})</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Admission Date</span>
              <span className="font-medium text-slate-800 block mt-0.5">
                {new Date(patient.admissionDate).toLocaleDateString()}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Attending Physician</span>
              <span className="font-bold text-blue-900 block mt-0.5">{patient.assignedDoctorName}</span>
              <span className="text-[10px] text-slate-500">({patient.assignedDoctorSpecialty})</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Bedside Attender</span>
              <span className="font-bold text-pink-900 block mt-0.5">{patient.assignedAttenderName || 'None'}</span>
              <span className="text-[10px] text-slate-500">({patient.assignedAttenderRelation || 'Family'})</span>
            </div>
          </div>

          {/* Primary Diagnosis & Clinical Cautions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 block mb-1">
                Primary Diagnosis & Admission Condition
              </span>
              <p className="font-bold text-slate-900 leading-snug">
                {patient.currentDiagnosis || patient.primaryCondition}
              </p>
              {patient.notes && (
                <p className="text-[11px] text-slate-600 mt-1">
                  <strong>Notes:</strong> {patient.notes}
                </p>
              )}
            </div>

            <div className="p-3.5 bg-red-50/50 rounded-xl border border-red-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-900 block mb-1">
                Known Drug Allergies & Safety Precautions
              </span>
              <p className="font-bold text-red-900 leading-snug">
                {(patient.allergies || []).join(', ') || 'No Known Drug Allergies (NKDA)'}
              </p>
              <p className="text-[11px] text-slate-600 mt-1">
                <strong>Emergency Contact:</strong> {patient.emergencyContact || 'Family Caregiver'}
              </p>
            </div>
          </div>

          {/* Latest Biometric Vitals in Fahrenheit */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                Latest Biometric Telemetry (Recorded at {new Date(v.timestamp).toLocaleTimeString()})
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">Sensors: Smart Glove & Bedside Monitor</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Blood Pressure</span>
                <span className="text-lg font-black font-mono text-slate-900 block">{v.systolicBP}/{v.diastolicBP} mmHg</span>
                <span className="text-[10px] font-bold uppercase text-slate-600">Status: {v.bpStatus}</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Pulse / Heart Rate</span>
                <span className="text-lg font-black font-mono text-slate-900 block">{v.pulse} bpm</span>
                <span className="text-[10px] font-bold uppercase text-slate-600">Status: {v.pulseStatus}</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Oxygen (SpO2)</span>
                <span className="text-lg font-black font-mono text-slate-900 block">{v.spO2}%</span>
                <span className="text-[10px] font-bold uppercase text-slate-600">Status: {v.spO2Status}</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Core Temperature</span>
                <span className="text-lg font-black font-mono text-slate-900 block">{formatTemperatureF(v.temperature)}</span>
                <span className="text-[10px] font-bold uppercase text-slate-600">Status: {v.tempStatus}</span>
              </div>
            </div>

            {/* Vital Trends Overview */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs break-inside-avoid">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">
                Vital Telemetry Longitudinal Trends
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-700">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>Pulse: {v.pulse >= 60 && v.pulse <= 100 ? 'Normocardic & steady' : v.pulse > 100 ? 'Elevated / Tachycardic trend' : 'Low / Bradycardic trend'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                  <span>SpO2: {v.spO2 >= 95 ? 'Adequate oxygenation (stable)' : 'Suboptimal oxygenation (monitored)'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Temp: {v.temperature > 37.8 ? 'Febrile episode noted' : 'Afebrile / euthermic'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Medications Roster */}
          <div className="space-y-2 break-inside-avoid">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-1 border-b border-slate-200 flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5 text-blue-600" />
              Active Medication Schedule ({activeMeds.length})
            </h3>

            {activeMeds.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No active medications scheduled.</p>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Medication & Dosage</th>
                      <th className="py-2 px-3">Route / Frequency</th>
                      <th className="py-2 px-3">Scheduled Time</th>
                      <th className="py-2 px-3">Instructions</th>
                      <th className="py-2 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeMeds.map((med) => (
                      <tr key={med.id}>
                        <td className="py-2 px-3 font-bold text-slate-900">{med.name} {med.dosage}</td>
                        <td className="py-2 px-3 text-slate-600">{med.route} • {med.frequency}</td>
                        <td className="py-2 px-3 font-mono text-slate-700">{med.scheduledTime}</td>
                        <td className="py-2 px-3 text-slate-500">{med.instructions}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            med.status === 'Given' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {med.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Clinical Doctor Notes & Observations */}
          <div className="space-y-2 break-inside-avoid">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-1 border-b border-slate-200 flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
              Clinical Doctor Notes & Orders
            </h3>
            {notes.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No clinical progress notes filed.</p>
            ) : (
              <div className="space-y-2">
                {notes.map((n) => (
                  <div key={n.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <strong className="text-slate-900">{n.doctorName} ({n.category})</strong>
                      <span className="font-mono text-[11px]">{new Date(n.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed font-medium">{n.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Timeline Activity */}
          <div className="space-y-2 break-inside-avoid">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-1 border-b border-slate-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Recent Timeline Activity ({recentTimeline.length})
            </h3>
            {recentTimeline.length === 0 ? (
              <p className="text-xs text-slate-400 py-1">No recent timeline events recorded.</p>
            ) : (
              <div className="space-y-1.5">
                {recentTimeline.map((item) => (
                  <div key={item.id} className="p-2 bg-slate-50/70 rounded-lg border border-slate-200/80 text-xs flex items-center justify-between gap-2">
                    <div>
                      <strong className="text-slate-900">{item.title}</strong>
                      <span className="text-slate-500 text-[11px] ml-2">{item.description}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI-Assisted Clinical Summary Snapshot (Strictly Separated from Source Data) */}
          <div className="p-4 bg-blue-50/70 rounded-xl border-2 border-blue-200 space-y-2 text-xs break-inside-avoid">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-blue-900 font-extrabold uppercase tracking-wide text-[11px]">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>HealthConnect AI Clinical Summary Draft (Decision-Support Only)</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-200/60 text-blue-900">
                AI SYNTHESIS
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed font-medium">
              Patient <strong>{patient.name}</strong> is currently admitted in <strong>{patient.room} ({patient.bed})</strong> under <strong>{patient.assignedDoctorName}</strong>. 
              Core vitals present currently at BP {v.systolicBP}/{v.diastolicBP} mmHg, pulse {v.pulse} bpm, SpO2 {v.spO2}%, and temperature {formatTemperatureF(v.temperature)}. 
              Active medications include {activeMeds.length} prescription(s). Bedside assistive smart glove is paired with attender <strong>{patient.assignedAttenderName}</strong> for continuous mobility support.
            </p>
            <div className="p-2 bg-blue-100/70 rounded-lg border border-blue-200 text-[10px] text-blue-950 font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <span>AI-generated clinical summary — verify against the patient's medical record. This decision-support draft does not replace physician clinical judgment.</span>
            </div>
          </div>

          {/* Legal / Clinical Disclaimer */}
          <div className="p-3 bg-slate-100 rounded-lg border border-slate-200 text-[10px] text-slate-500 space-y-1">
            <strong>NOTICE & CLINICAL DISCLAIMER:</strong>
            <p className="leading-normal">
              This clinical summary is generated as an assistive reference based on bedside sensor telemetry, 
              smart glove event logs, and electronic healthcare records. It is designed to assist hospital clinicians, 
              nurses, and care teams and does NOT replace autonomous clinical examination, physical assessment, 
              or licensed diagnostic judgment.
            </p>
          </div>

          {/* Signatures Footer */}
          <div className="pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs text-slate-600">
            <div>
              <div className="h-10 border-b border-dashed border-slate-400"></div>
              <p className="pt-1 font-bold text-slate-900">{patient.assignedDoctorName}</p>
              <p className="text-[11px] text-slate-500">Attending Physician • License Verified</p>
            </div>
            <div>
              <div className="h-10 border-b border-dashed border-slate-400"></div>
              <p className="pt-1 font-bold text-slate-900">Hospital Inpatient Nursing Desk</p>
              <p className="text-[11px] text-slate-500">Ward Unit Supervisor Verification</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
