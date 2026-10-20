import React, { useState, useEffect } from 'react';
import { clinicalMonitoringService } from '../../services/clinicalMonitoringService';
import { simulationTelemetrySource, SimulationState, SURESH_SCENARIO_STEPS } from '../../services/simulationTelemetrySource';
import { dataStore } from '../../services/dataStore';
import { VitalAlert } from '../../types';
import { formatTemperatureVal } from '../../utils/temperature';
import { 
  Play, Pause, RotateCcw, AlertTriangle, AlertOctagon, 
  CheckCircle2, ChevronDown, ChevronUp, Radio, PhoneCall,
  UserCheck, ShieldAlert
} from 'lucide-react';

interface ClinicalSimulationControlProps {
  compact?: boolean;
  onNavigateToPatient?: (patientId: string) => void;
}

export const ClinicalSimulationControl: React.FC<ClinicalSimulationControlProps> = ({
  compact = false,
  onNavigateToPatient,
}) => {
  const [simState, setSimState] = useState<SimulationState>(() => clinicalMonitoringService.getScenarioState());
  const [alerts, setAlerts] = useState<VitalAlert[]>(() => dataStore.getAlerts('pat-suresh'));
  const [isExpanded, setIsExpanded] = useState<boolean>(!compact);

  useEffect(() => {
    const unsubScenario = clinicalMonitoringService.subscribeScenarioState((state) => {
      setSimState(state);
    });
    const unsubStore = dataStore.subscribe(() => {
      setAlerts(dataStore.getAlerts('pat-suresh'));
    });

    return () => {
      unsubScenario();
      unsubStore();
    };
  }, []);

  const handleStart = () => {
    clinicalMonitoringService.startDeteriorationScenario('pat-suresh');
  };

  const handlePause = () => {
    clinicalMonitoringService.pauseScenario();
  };

  const handleResume = () => {
    clinicalMonitoringService.resumeScenario();
  };

  const handleReset = () => {
    clinicalMonitoringService.resetScenario();
    dataStore.updatePatient('pat-suresh', { status: 'stable' });
    dataStore.recordVitals('pat-suresh', {
      spO2: 97,
      pulse: 72,
      systolicBP: 122,
      diastolicBP: 78,
      temperature: 36.9,
      respiratoryRate: 16,
      timestamp: new Date().toISOString(),
    });
  };

  // Deterministic 1-click step triggers for Hackathon presentation
  const activeAlert = alerts.find((a) => a.status === 'active');
  const ackAlert = alerts.find((a) => a.status === 'acknowledged');
  const respAlert = alerts.find((a) => a.status === 'responding');
  const currentAlert = activeAlert || ackAlert || respAlert;

  const handleTriggerCritical = () => {
    simulationTelemetrySource.emitManualStep(4);
  };

  const handleAcknowledge = () => {
    if (activeAlert) {
      dataStore.acknowledgeAlert(activeAlert.id, 'Dr. Arun Kumar', 'doctor');
    }
  };

  const handleRequestNurse = () => {
    const target = ackAlert || activeAlert;
    if (target) {
      dataStore.requestNurseForAlert(target.id, 'Dr. Arun Kumar', 'doctor');
    }
  };

  const handleNurseResponding = () => {
    const target = respAlert || ackAlert || activeAlert;
    if (target) {
      dataStore.markAlertResponding(target.id, 'Nurse Priya');
    }
  };

  const handleResolveAlert = () => {
    const target = respAlert || ackAlert || activeAlert;
    if (target) {
      dataStore.resolveAlert(
        target.id,
        'Nurse Priya',
        'Bedside care completed. Clinical telemetry normalized and verified.',
        'doctor'
      );
    }
    simulationTelemetrySource.resetScenario();
    dataStore.updatePatient('pat-suresh', { status: 'stable' });
    dataStore.recordVitals('pat-suresh', {
      spO2: 98,
      pulse: 72,
      systolicBP: 122,
      diastolicBP: 78,
      temperature: 36.9,
      respiratoryRate: 16,
      timestamp: new Date().toISOString(),
    });
  };

  const handleResetDemo = () => {
    handleReset();
    // Resolve any remaining active/acknowledged alerts
    alerts
      .filter((a) => a.status !== 'resolved')
      .forEach((a) => {
        dataStore.resolveAlert(a.id, 'System Reset', 'Demo reset to baseline', 'doctor');
      });
  };

  const isRunning = simState.mode === 'running_scenario';
  const isPaused = simState.mode === 'paused';
  const isPausedCritical = simState.mode === 'paused_critical';
  const curStep = simState.currentStep;

  // Derive workflow step for indicator
  const workflowStep = currentAlert
    ? currentAlert.status === 'active'
      ? 2
      : currentAlert.status === 'acknowledged'
      ? 3
      : currentAlert.status === 'responding'
      ? 4
      : 5
    : curStep.spO2 <= 86
    ? 2
    : 1;

  return (
    <div className="rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-xs space-y-3" role="region" aria-label="Clinical Telemetry Controls">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#12304A] text-white">
            <Radio className="h-4 w-4 text-white animate-pulse" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-800 shrink-0">
                ACTIVE TELEMETRY STREAM
              </span>
              <span className="text-xs font-bold text-slate-900 truncate">
                Suresh Kumar — Post Thyroidectomy
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              Continuous telemetry stream with cross-device state synchronization (Laptop, Tablet, Phone).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Status Badge */}
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
            isRunning 
              ? 'bg-blue-100 text-blue-900 border border-blue-300' 
              : isPausedCritical
              ? 'bg-red-100 text-red-900 border border-red-300'
              : isPaused
              ? 'bg-amber-100 text-amber-900 border border-amber-300'
              : 'bg-slate-100 text-slate-700 border border-slate-200'
          }`}>
            <span className={`h-2 w-2 rounded-full ${
              isRunning ? 'bg-blue-600 animate-pulse' : isPausedCritical ? 'bg-red-600' : 'bg-slate-400'
            }`} />
            {isRunning 
              ? 'Streaming Telemetry' 
              : isPausedCritical 
              ? 'Alert Held (Critical Desaturation)' 
              : isPaused 
              ? 'Telemetry Paused' 
              : 'Telemetry Active'}
          </span>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
            aria-label={isExpanded ? 'Collapse controls' : 'Expand controls'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3 pt-1">
          {/* Step Sequence Visualization */}
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {SURESH_SCENARIO_STEPS.map((step, idx) => {
              const isCurrent = idx === simState.currentStepIndex;
              const isPast = idx < simState.currentStepIndex;
              const isCrit = step.spO2 <= 86;
              const isWarn = step.spO2 <= 90 && !isCrit;

              return (
                <div
                  key={step.stepIndex}
                  onClick={() => simulationTelemetrySource.emitManualStep(idx)}
                  title={`Click to set Step ${idx + 1}`}
                  className={`p-2 rounded-xl border text-xs transition-all cursor-pointer ${
                    isCurrent
                      ? isCrit
                        ? 'bg-red-50 border-red-500 ring-2 ring-red-400 font-bold'
                        : isWarn
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400 font-bold'
                        : 'bg-blue-50 border-blue-500 ring-2 ring-blue-400 font-bold'
                      : isPast
                      ? 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                      : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-[10px] uppercase font-bold text-slate-600">
                    Step {idx + 1}
                  </span>
                  <span className={`block text-sm font-extrabold font-mono mt-0.5 ${
                    isCrit ? 'text-red-700' : isWarn ? 'text-amber-700' : 'text-slate-900'
                  }`}>
                    {step.spO2}%
                  </span>
                  <span className="block text-[9px] font-semibold text-slate-500 truncate">
                    {step.clinicalState}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Current Live Values Ribbon */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              <span className="text-slate-600 font-semibold">Active Reading:</span>
              <span>SpO₂: <strong className={`font-mono ${curStep.spO2 <= 86 ? 'text-red-700 font-bold' : curStep.spO2 <= 90 ? 'text-amber-700 font-bold' : 'text-slate-900'}`}>{curStep.spO2}%</strong></span>
              <span>Pulse: <strong className="font-mono text-slate-900">{curStep.pulse} bpm</strong></span>
              <span>BP: <strong className="font-mono text-slate-900">{curStep.systolicBP}/{curStep.diastolicBP} mmHg</strong></span>
              <span>RR: <strong className="font-mono text-slate-900">{curStep.respiratoryRate} /min</strong></span>
              <span>Temp: <strong className="font-mono text-slate-900">{formatTemperatureVal(curStep.temperature)} °F</strong></span>
            </div>

            <span className="text-[11px] text-slate-500 italic truncate max-w-full">
              {curStep.description}
            </span>
          </div>

          {/* Primary Simulation Controls */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-b border-slate-100 pb-3">
            {!isRunning ? (
              <button
                type="button"
                onClick={isPaused || isPausedCritical ? handleResume : handleStart}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#2563EB] px-4 text-xs font-bold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{isPaused || isPausedCritical ? 'Resume Scenario' : 'Start Deterioration Scenario'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePause}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-800 shadow-xs transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <Pause className="h-3.5 w-3.5" />
                <span>Pause</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Vitals</span>
            </button>

            {isPausedCritical && (
              <span className="text-xs font-semibold text-red-700 sm:ml-auto flex items-center gap-1.5 animate-pulse">
                <AlertOctagon className="w-4 h-4 shrink-0" />
                Critical 86% reached — Auto-paused for clinician response
              </span>
            )}
          </div>

          {/* Deterministic Clinical Event Controller: Instant 1-Click State Transitions */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Clinical Event Controller — 1-Click Workflow Stepper
              </span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                Phase {workflowStep} of 5 Active
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
              {/* 1. Start */}
              <button
                type="button"
                onClick={handleStart}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 p-2 text-xs font-bold text-blue-800 hover:bg-blue-100 transition-colors cursor-pointer"
                title="Start automatic 3s deterioration sequence"
              >
                <Play className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">1. Start</span>
              </button>

              {/* 2. Critical Alert */}
              <button
                type="button"
                onClick={handleTriggerCritical}
                className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-colors cursor-pointer ${
                  activeAlert || curStep.spO2 <= 86
                    ? 'border-red-500 bg-red-100 text-red-900 ring-2 ring-red-400'
                    : 'border-red-200 bg-red-50/70 text-red-800 hover:bg-red-100'
                }`}
                title="Immediately force SpO2 86% and generate critical alert"
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-red-600" />
                <span className="truncate">2. Critical (86%)</span>
              </button>

              {/* 3. Acknowledge */}
              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={!activeAlert}
                className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  ackAlert
                    ? 'border-amber-500 bg-amber-100 text-amber-900 ring-2 ring-amber-400'
                    : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
                title="Doctor acknowledges critical alert"
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span className="truncate">3. Acknowledge</span>
              </button>

              {/* 4. Request Nurse */}
              <button
                type="button"
                onClick={handleRequestNurse}
                disabled={!activeAlert && !ackAlert}
                className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  respAlert
                    ? 'border-blue-500 bg-blue-100 text-blue-900 ring-2 ring-blue-400'
                    : 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
                }`}
                title="Doctor dispatches bedside nurse assistance"
              >
                <PhoneCall className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                <span className="truncate">4. Request Nurse</span>
              </button>

              {/* 5. Nurse Responding */}
              <button
                type="button"
                onClick={handleNurseResponding}
                disabled={!respAlert && !ackAlert && !activeAlert}
                className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  respAlert
                    ? 'border-blue-500 bg-blue-100 text-blue-900 font-extrabold'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
                title="Nurse Priya accepts and attends bedside"
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                <span className="truncate">5. Responding</span>
              </button>

              {/* 6. Resolve */}
              <button
                type="button"
                onClick={handleResolveAlert}
                disabled={!currentAlert}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 p-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Resolve alert and restore normal patient SpO2 (98%)"
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <span className="truncate">6. Resolve</span>
              </button>

              {/* 7. Reset Demo */}
              <button
                type="button"
                onClick={handleResetDemo}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 p-2 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                title="Full reset of patient telemetry to baseline state"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0 text-slate-600" />
                <span className="truncate">7. Reset Baseline</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
