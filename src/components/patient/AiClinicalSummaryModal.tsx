import React, { useState, useEffect } from 'react';
import { Patient, Medication, VitalAlert, TimelineEvent } from '../../types';
import { clinicalAiService, ClinicalSummaryResult } from '../../services/aiProvider';
import { dataStore } from '../../services/dataStore';
import { 
  Sparkles, X, Copy, Check, ShieldAlert, Heart, Activity, 
  Pill, Clock, AlertTriangle, FileText, CheckCircle2 
} from 'lucide-react';

interface AiClinicalSummaryModalProps {
  patient: Patient;
  isOpen: boolean;
  onClose: () => void;
}

export const AiClinicalSummaryModal: React.FC<AiClinicalSummaryModalProps> = ({
  patient,
  isOpen,
  onClose,
}) => {
  const [summary, setSummary] = useState<ClinicalSummaryResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const meds = dataStore.getMedications(patient.id);
    const alerts = dataStore.getAlerts(patient.id);
    const timeline = dataStore.getTimeline(patient.id);

    clinicalAiService.generateSummary(patient, meds, alerts, timeline).then((res) => {
      setSummary(res);
    });
  }, [patient, isOpen]);

  useEffect(() => {
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

  const handleCopy = () => {
    if (!summary) return;
    const text = `HEALTHCONNECT AI CLINICAL SUMMARY DRAFT
Patient: ${patient.name} (MRN: ${patient.mrn})
Bed: ${patient.room} (${patient.bed})
Generated: ${new Date(summary.generatedAt).toLocaleString()}

--- PATIENT OVERVIEW ---
${summary.patientOverview}

--- CURRENT STATUS ---
${summary.currentStatus}

--- LATEST VITALS ---
${summary.latestVitalsSummary.bp} | HR: ${summary.latestVitalsSummary.pulse} bpm | SpO2: ${summary.latestVitalsSummary.spO2}% | Temp: ${summary.latestVitalsSummary.tempF}

--- VITAL TRENDS ---
${summary.vitalTrends.join('\n')}

--- MEDICATIONS OVERVIEW ---
${summary.medicationsOverview.join('\n')}

--- RECENT CLINICAL EVENTS ---
${summary.recentClinicalEvents.join('\n')}

--- IMPORTANT TIMELINE CHANGES ---
${summary.importantTimelineChanges.join('\n')}

--- ITEMS REQUIRING CLINICAL REVIEW ---
${summary.potentialItemsForReview.join('\n')}

Notice: ${summary.disclaimer}`;

    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-summary-modal-title"
      >
        
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 bg-slate-950 px-4 py-3 text-white sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="ai-summary-modal-title" className="text-base font-semibold tracking-tight sm:text-lg">AI clinical summary</h3>
                <span className="rounded-full border border-blue-300/30 bg-blue-300/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-100">
                  AI synthesis
                </span>
              </div>
              <p className="truncate text-xs text-slate-300">
                {patient.name} • MRN: {patient.mrn} • {patient.room} ({patient.bed})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/15"
              title="Copy Summary to Clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy summary'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close AI clinical summary modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mandatory Transparency Disclaimer */}
        <div className="flex shrink-0 items-start gap-2 border-b border-blue-200 border-l-4 border-l-blue-600 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100 sm:px-6">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
          <span className="font-medium leading-5">
            AI-generated clinical summary — verify against the patient's medical record. This decision-support draft does not replace physician clinical judgment.
          </span>
        </div>

        {/* Scrollable Summary Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-4 text-slate-800 dark:text-slate-200 sm:p-6">
          {!summary ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 rounded-full border-3 border-blue-600 border-t-transparent animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Synthesizing clinical documentation, vitals, and timeline...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                [AI SYNTHESIS]
              </div>
              {/* 1. Patient Overview */}
              <div className="space-y-1.5">
                <span className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Patient Overview
                </span>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs leading-relaxed font-medium">
                  {summary.patientOverview}
                </div>
              </div>

              {/* 2. Current Status */}
              <div className="space-y-1.5">
                <span className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  Current Status
                </span>
                <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-950 dark:text-blue-200 leading-relaxed font-medium">
                  {summary.currentStatus}
                </div>
              </div>

              {/* 3. Latest Vitals & 4. Vital Trends */}
              <div className="space-y-2">
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Heart className="w-4 h-4" />
                  Latest Vitals & Telemetry Trends
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block font-bold">BP</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-sm">{summary.latestVitalsSummary.bp}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block font-bold">Pulse</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-sm">{summary.latestVitalsSummary.pulse} bpm</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block font-bold">SpO2</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-sm">{summary.latestVitalsSummary.spO2}%</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block font-bold">Temp (°F)</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-sm">{summary.latestVitalsSummary.tempF}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">Synthesized Trends:</span>
                  <ul className="text-xs space-y-1 list-disc list-inside text-slate-700 dark:text-slate-300">
                    {summary.vitalTrends.map((trend, i) => (
                      <li key={i}>{trend}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 5. Medications Overview */}
              <div className="space-y-1.5">
                <span className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Pill className="w-4 h-4" />
                  Prescribed Medications
                </span>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1">
                  {summary.medicationsOverview.map((med, i) => (
                    <div key={i} className="text-xs text-slate-700 dark:text-slate-300">
                      {med}
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. Recent Clinical Events & 7. Timeline Changes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-500" />
                    Recent Clinical Events
                  </span>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1">
                    {summary.recentClinicalEvents.map((evt, i) => (
                      <div key={i} className="text-xs text-slate-600 dark:text-slate-300 leading-tight">
                        {evt}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-slate-500" />
                    Important Timeline Changes
                  </span>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1">
                    {summary.importantTimelineChanges.map((change, i) => (
                      <div key={i} className="text-xs text-slate-600 dark:text-slate-300 leading-tight">
                        • {change}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 8. Potential Items Requiring Clinical Review */}
              <div className="space-y-1.5">
                <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Potential Items Requiring Clinical Review
                </span>
                <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-950 dark:text-amber-200 space-y-1.5">
                  {summary.potentialItemsForReview.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 text-[11px]">CareAI · Clinical decision support</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
