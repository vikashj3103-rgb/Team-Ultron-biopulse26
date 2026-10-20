import React, { useState } from 'react';
import { HardwareEventService } from '../../services/hardwareEventService';
import { demoSimulationService } from '../../services/demoSimulationService';
import { dataStore } from '../../services/dataStore';
import { RequestType, SimulationScenario } from '../../types';
import { 
  Zap, Droplets, Utensils, AlertOctagon, Heart, RefreshCw, Terminal, 
  CheckCircle2, Flame, Wind, Play, Pause, Volume2, VolumeX, Pill, 
  Radio, Sliders, ShieldAlert, Activity, Clock 
} from 'lucide-react';
import { ClinicalSimulationControl } from '../../components/demo/ClinicalSimulationControl';

export const DemoSimulationPage: React.FC = () => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('pat-ramesh');
  const [lastActionMsg, setLastActionMsg] = useState<string | null>(null);
  const [showCurlModal, setShowCurlModal] = useState<boolean>(false);

  // Dynamic simulation controls (scoped to selected patient)
  const [simRunning, setSimRunning] = useState<boolean>(() => demoSimulationService.isPatientRunning(selectedPatientId));
  const [activeScenario, setActiveScenario] = useState<SimulationScenario>(() => demoSimulationService.getScenario(selectedPatientId));
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => dataStore.getSoundEnabled());
  const [demoTimeout, setDemoTimeout] = useState<number>(() => dataStore.getDemoAlertTimeoutSeconds?.() || 30);

  const patients = dataStore.getPatients();
  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  React.useEffect(() => {
    const unsub = demoSimulationService.subscribeStatus(() => {
      setSimRunning(demoSimulationService.isPatientRunning(selectedPatientId));
      setActiveScenario(demoSimulationService.getScenario(selectedPatientId));
    });
    return unsub;
  }, [selectedPatientId]);

  const handleToggleSimulation = () => {
    const running = demoSimulationService.toggleRunning(selectedPatientId, activeScenario);
    setSimRunning(running);
    setLastActionMsg(
      running
        ? `▶ Real-time continuous simulation resumed for ${selectedPatient?.name || selectedPatientId}`
        : `⏸ Simulation engine paused for ${selectedPatient?.name || selectedPatientId}`
    );
    setTimeout(() => setLastActionMsg(null), 3500);
  };

  const handleScenarioChange = (scenario: SimulationScenario) => {
    demoSimulationService.setScenario(scenario, selectedPatientId);
    setActiveScenario(scenario);
    setLastActionMsg(`🩺 Scenario shifted to: ${scenario.toUpperCase()} for ${selectedPatient?.name || selectedPatientId}`);
    setTimeout(() => setLastActionMsg(null), 3500);
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    dataStore.setSoundEnabled(next);
    setSoundEnabled(next);
    if (next) dataStore.playChime('info');
    setLastActionMsg(next ? '🔊 Alert chimes enabled' : '🔇 Alert chimes muted');
    setTimeout(() => setLastActionMsg(null), 3000);
  };

  const handleSimulateRequest = async (type: RequestType) => {
    await HardwareEventService.simulateGestureRequest(selectedPatientId, type);
    setLastActionMsg(`✅ Smart glove gesture triggered: ${type} for ${selectedPatient?.name}`);
    setTimeout(() => setLastActionMsg(null), 4000);
  };

  const handleSimulateVitals = async (scenario: 'normal' | 'attention' | 'critical_bp' | 'low_spo2' | 'fever') => {
    let payload = {};
    let desc = '';

    switch (scenario) {
      case 'normal':
        payload = { systolic: 120, diastolic: 80, pulse: 74, spO2: 98, temperature: 36.8 };
        desc = 'Normal vitals (120/80, 74 bpm, 98%)';
        break;
      case 'attention':
        payload = { systolic: 135, diastolic: 88, pulse: 86, spO2: 95, temperature: 37.6 };
        desc = 'Mild elevation / Attention state (135/88, 95%)';
        break;
      case 'critical_bp':
        payload = { systolic: 178, diastolic: 112, pulse: 76 };
        desc = 'Hypertensive Crisis / Critical BP (178/112 mmHg)';
        break;
      case 'low_spo2':
        payload = { pulse: 74, spO2: 88 };
        desc = 'Critical Hypoxia / SpO2 Drop (88%)';
        break;
      case 'fever':
        payload = { pulse: 76, temperature: 39.4 };
        desc = 'High Pyrexia / Critical Fever (102.9 °F / 39.4°C)';
        break;
    }

    await HardwareEventService.simulateVitalChange(selectedPatientId, payload);
    const activeAlert = dataStore.getAlerts(selectedPatientId).find(
      (a) => a.status === 'active' || a.status === 'acknowledged' || a.status === 'responding'
    );
    if (activeAlert) {
      if (activeAlert.occurrenceCount && activeAlert.occurrenceCount > 1) {
        setLastActionMsg(`⚡ Telemetry updated for ${activeAlert.conditionType || activeAlert.vitalType} episode (Occurrences: ${activeAlert.occurrenceCount}, Value: ${activeAlert.currentValue}) for ${selectedPatient?.name}`);
      } else {
        setLastActionMsg(`✓ ${activeAlert.conditionType || activeAlert.vitalType} episode created for ${selectedPatient?.name} (Episode ID: ${activeAlert.id}, Status: ${activeAlert.status.toUpperCase()}, Value: ${activeAlert.currentValue})`);
      }
    } else {
      setLastActionMsg(`⚡ Injected into ${selectedPatient?.name}: ${desc}`);
    }
    setTimeout(() => setLastActionMsg(null), 4000);
  };

  const handleResetData = () => {
    if (confirm('Reset clinical operational dataset to initial baseline?')) {
      dataStore.resetToDefaults();
      setLastActionMsg('🔄 Clinical operational data restored to baseline.');
      setTimeout(() => setLastActionMsg(null), 4000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Clinical Operations & Telemetry Control Center
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 tracking-wider uppercase">
              CLINICAL OPERATIONS
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            <strong>CLINICAL TELEMETRY OPERATIONS:</strong> Centrally manage patient biometric telemetry streams, smart glove micro-gestures, and test end-to-end alert propagation across devices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleSound}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
              soundEnabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundEnabled ? 'Chimes ON' : 'Chimes OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCurlModal(true)}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Terminal className="w-4 h-4 text-amber-400" />
            <span>ESP32 API Docs</span>
          </button>
        </div>
      </div>

      {/* Action Notification Toast */}
      {lastActionMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2 shadow-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{lastActionMsg}</span>
        </div>
      )}

      {/* Real-time Patient Telemetry Pipeline & Deterioration Controls */}
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <span>Patient Deterioration & Telemetry Event Controls (Suresh Kumar)</span>
        </h2>
        <ClinicalSimulationControl />
      </div>

      {/* CLINICAL TELEMETRY PROTOCOL GUIDE */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700 p-5 shadow-md text-white space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Play className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white">HealthConnect — Clinical Workflow & Telemetry Protocol</h3>
            <p className="text-[11px] text-slate-400">5-minute end-to-end clinical care demonstration protocol</p>
          </div>
          <span className="ml-auto px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-500/30">
            Protocol Guide
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              step: '01',
              color: 'text-blue-400',
              bg: 'bg-blue-500/10 border-blue-500/20',
              title: 'Login & Role Navigation',
              actions: [
                'Open login page → click "Authorized Roles"',
                'Access Doctor Portal (Dr. Arun Kumar — Cardiologist)',
                'Observe assigned patient list with live vitals',
                'Access Family Attender (Vikash Kumar — Bedside Caregiver)',
              ],
            },
            {
              step: '02',
              color: 'text-amber-400',
              bg: 'bg-amber-500/10 border-amber-500/20',
              title: 'Bedside Gesture Event Call',
              actions: [
                'On this page: select patient "Ramesh Kumar"',
                'Click "Water Request" button below → gesture fires',
                'Switch to Family Attender tab → see pulsing alert card',
                'Click "I\'m Coming" to acknowledge the request',
              ],
            },
            {
              step: '03',
              color: 'text-red-400',
              bg: 'bg-red-500/10 border-red-500/20',
              title: 'Critical Vitals Alert Flow',
              actions: [
                'Click "Hypertensive Crisis (178/112 mmHg)" below',
                'Doctor dashboard auto-shows patient as CRITICAL',
                'Open patient detail → see red vitals + alert card',
                'Click "Restore Normal Baseline" to stabilize',
              ],
            },
            {
              step: '04',
              color: 'text-emerald-400',
              bg: 'bg-emerald-500/10 border-emerald-500/20',
              title: 'Urgent Call Service',
              actions: [
                'Attender: click "🚨 Call Duty Nurse" (red button)',
                'Select priority: CRITICAL → submit urgent call',
                'Admin Call Service shows auto-assigned nurse',
                'Attender sees staff name & contact in banner',
              ],
            },
            {
              step: '05',
              color: 'text-blue-400',
              bg: 'bg-blue-500/10 border-blue-500/20',
              title: 'CareAI & Hospital Map',
              actions: [
                'Attender: click "✨ CareAI Assistant" (medical blue button)',
                'Type: "What is my patient\'s blood pressure?"',
                'Click "🗺 Hospital 2D Map" (dark button)',
                'Navigate: ICU-204 → Cardiology 11002',
              ],
            },
            {
              step: '06',
              color: 'text-cyan-400',
              bg: 'bg-cyan-500/10 border-cyan-500/20',
              title: 'Admin Ops & Reports',
              actions: [
                'Admin → Patient Census: admit new patient',
                'Assign 1-2 attenders with custom credentials',
                'Doctor → Patient Detail → Print Clinical Report',
                'Admin → Audit Logs: see full compliance trail',
              ],
            },
          ].map((s) => (
            <div key={s.step} className={`p-4 rounded-xl border ${s.bg} space-y-2`}>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-black ${s.color} font-mono`}>STEP {s.step}</span>
                <span className="text-xs font-bold text-white">{s.title}</span>
              </div>
              <ul className="space-y-1">
                {s.actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                    <span className={`font-bold ${s.color} shrink-0 mt-0.5`}>›</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-500 text-center pt-1">
          All controls below are live — every action propagates instantly across all open browser tabs (cross-device sync simulation).
        </p>
      </div>

      {/* Target Patient Selector Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
          Target Inpatient for Simulation & Injections:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {patients.map((p) => {
            const isSelected = p.id === selectedPatientId;
            return (
              <div
                key={p.id}
                data-testid={`demo-patient-${p.id}`}
                onClick={() => {
                  setSelectedPatientId(p.id);
                  demoSimulationService.setTargetPatient(p.id);
                  setSimRunning(demoSimulationService.isPatientRunning(p.id));
                  setActiveScenario(demoSimulationService.getScenario(p.id));
                }}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    p.status === 'critical' ? 'bg-red-100 text-red-800' :
                    p.status === 'attention' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {p.status}
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-medium">
                  {p.room} ({p.bed}) • {p.primaryCondition}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Doctor: {p.assignedDoctorName}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-Time Bounded Random Walk Engine Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Continuous Telemetry Engine</h3>
              <p className="text-xs text-slate-500">
                Smooth 3.5s bounded physiological drift without erratic jumps
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleSimulation}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs ${
              simRunning
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {simRunning ? (
              <>
                <Pause className="w-4 h-4" /> Pause Simulation Engine
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Resume Simulation Engine
              </>
            )}
          </button>
        </div>

        {/* Scenario Buttons */}
        <div className="pt-2">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-2">
            Active Continuous Scenario:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleScenarioChange('normal')}
              className={`p-4 rounded-xl border text-left transition-all ${
                activeScenario === 'normal'
                  ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-emerald-800 text-sm">
                <span>NORMAL</span>
                {activeScenario === 'normal' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                BP ~120/80, Pulse ~74 bpm, SpO2 ~98%, Temp ~98.2 °F (36.8°C). Stabilized recovery.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleScenarioChange('attention')}
              className={`p-4 rounded-xl border text-left transition-all ${
                activeScenario === 'attention'
                  ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20 shadow-xs'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-amber-800 text-sm">
                <span>ATTENTION</span>
                {activeScenario === 'attention' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                BP ~135/88, Pulse ~86 bpm, SpO2 ~95%, Temp ~99.7 °F (37.6°C). Mild deviation.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleScenarioChange('critical')}
              className={`p-4 rounded-xl border text-left transition-all ${
                activeScenario === 'critical'
                  ? 'border-red-500 bg-red-50/60 ring-2 ring-red-500/20 shadow-xs'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-red-800 text-sm">
                <span>CRITICAL</span>
                {activeScenario === 'critical' && <CheckCircle2 className="w-4 h-4 text-red-600" />}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                BP ~172/106, Pulse ~114 bpm, SpO2 ~89%, Temp ~102.6 °F (39.2°C). Triggers debounced alert.
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Section: Instant Vital Spikes & Smart Glove Micro-gestures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Smart Glove Micro-gesture Triggers */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Zap className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Simulate Glove Micro-Gestures</h3>
              <p className="text-xs text-slate-500">Triggers patient request for {selectedPatient?.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              data-testid="demo-water-request-btn"
              onClick={() => handleSimulateRequest('WATER')}
              className="p-3 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-xl text-xs font-bold flex items-center gap-2 border border-cyan-200 transition-colors"
            >
              <Droplets className="w-4 h-4 text-cyan-600" />
              <span>💧 Water Request</span>
            </button>

            <button
              type="button"
              data-testid="demo-food-request-btn"
              onClick={() => handleSimulateRequest('FOOD')}
              className="p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 border border-emerald-200 transition-colors"
            >
              <Utensils className="w-4 h-4 text-emerald-600" />
              <span>🍲 Food Request</span>
            </button>

            <button
              type="button"
              data-testid="demo-medicine-request-btn"
              onClick={() => handleSimulateRequest('MEDICINE')}
              className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-bold flex items-center gap-2 border border-blue-200 transition-colors"
            >
              <Pill className="w-4 h-4 text-blue-600" />
              <span>💊 Medicine Call</span>
            </button>

            <button
              type="button"
              data-testid="demo-nurse-request-btn"
              onClick={() => handleSimulateRequest('NURSE')}
              className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-bold flex items-center gap-2 border border-blue-200 transition-colors"
            >
              <Zap className="w-4 h-4 text-blue-600" />
              <span>👩‍⚕️ Nurse Call</span>
            </button>

            <button
              type="button"
              data-testid="demo-emergency-request-btn"
              onClick={() => handleSimulateRequest('EMERGENCY')}
              className="col-span-2 p-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-red-500/20"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>🚨 EMERGENCY CALL (Priority Escalation)</span>
            </button>
          </div>
        </div>

        {/* Right: Instant Vital Injections */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Heart className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Instant Telemetry Injections</h3>
              <p className="text-xs text-slate-500">Inject clinical threshold events directly into state</p>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              data-testid="demo-critical-bp-btn"
              onClick={() => handleSimulateVitals('critical_bp')}
              className="w-full p-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-900 rounded-xl text-xs font-bold flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-600" />
                <span>Hypertensive Crisis (BP 178/112 mmHg)</span>
              </div>
              <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded uppercase">
                Trigger Alert
              </span>
            </button>

            <button
              type="button"
              data-testid="demo-low-spo2-btn"
              onClick={() => handleSimulateVitals('low_spo2')}
              className="w-full p-3 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-900 rounded-xl text-xs font-bold flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-orange-600" />
                <span>Critical Hypoxia (SpO2 88%)</span>
              </div>
              <span className="text-[10px] bg-orange-600 text-white px-2 py-0.5 rounded uppercase">
                Trigger Alert
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSimulateVitals('fever')}
              className="w-full p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-600" />
                <span>High Pyrexia / Fever (102.9 °F / 39.4°C)</span>
              </div>
              <span className="text-[10px] bg-amber-600 text-white px-2 py-0.5 rounded uppercase">
                Attention
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSimulateVitals('normal')}
              className="w-full p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Restore Normal Baseline (120/80, 74 bpm)</span>
              </div>
              <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded uppercase">
                Stabilize
              </span>
            </button>
          </div>
        </div>
      </div>
 
      {/* Attender Escalation Demo Timeout Configuration */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-slate-900">Attender Emergency Escalation Timeout</span>
            <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
              {demoTimeout}s
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-0.5">
            Configurable window before unacknowledged critical alert shows "Call Hospital Emergency" on Attender dashboard
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {[10, 20, 30, 60].map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => {
                dataStore.setDemoAlertTimeoutSeconds(sec);
                setDemoTimeout(sec);
                setLastActionMsg(`⏱ Demo unacknowledged alert timeout set to ${sec}s`);
                setTimeout(() => setLastActionMsg(null), 3000);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs border transition-all ${
                demoTimeout === sec
                  ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>

      {/* Dataset Reset Utility */}
      <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
        <div>
          <span className="font-bold text-slate-800">Clinical Baseline Reset</span>
          <p className="text-slate-500 text-[11px]">Resets all inpatient records, vital telemetry, and alert states to standard hospital baseline</p>
        </div>
        <button
          type="button"
          onClick={handleResetData}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Baseline</span>
        </button>
      </div>

      {/* Hardware API Curl Modal */}
      {showCurlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">ESP32 Hardware Event API</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCurlModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              This is the proposed request format for a future secured device relay. Hardware ingestion is not configured in this demo; use the local simulation controls to create events.
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto">
                <span className="text-slate-500 block mb-1"># 1. Smart Glove Gesture Call (WATER)</span>
                <span className="text-amber-400">curl -X POST</span> http://localhost:5173/api/patient-events \<br />
                &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
                &nbsp;&nbsp;-d '{`{"patientId": "${selectedPatientId}", "eventType": "REQUEST", "requestType": "WATER"}`}'
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto">
                <span className="text-slate-500 block mb-1"># 2. Bedside Sensor Biometrics</span>
                <span className="text-amber-400">curl -X POST</span> http://localhost:5173/api/patient-events \<br />
                &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
                &nbsp;&nbsp;-d '{`{"patientId": "${selectedPatientId}", "eventType": "VITAL", "value": {"systolic": 178, "diastolic": 112, "pulse": 116}}`}'
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCurlModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
              >
                Close Documentation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
