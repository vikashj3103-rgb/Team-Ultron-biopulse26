import React, { useState, useEffect } from 'react';
import { HardwareEventService } from '../../services/hardwareEventService';
import { demoSimulationService } from '../../services/demoSimulationService';
import { dataStore } from '../../services/dataStore';
import { RequestType, SimulationScenario } from '../../types';
import { 
  Zap, Droplets, Utensils, AlertOctagon, Heart, RefreshCw, Terminal, 
  ChevronUp, ChevronDown, CheckCircle2, Flame, Wind, Play, Pause, 
  Volume2, VolumeX, Pill 
} from 'lucide-react';

export const DemoControlPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [showCurlModal, setShowCurlModal] = useState<boolean>(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('pat-ramesh');
  const [lastActionMsg, setLastActionMsg] = useState<string | null>(null);

  // Dynamic simulation controls (scoped to selected patient)
  const [simRunning, setSimRunning] = useState<boolean>(() => demoSimulationService.isPatientRunning(selectedPatientId));
  const [activeScenario, setActiveScenario] = useState<SimulationScenario>(() => demoSimulationService.getScenario(selectedPatientId));
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => dataStore.getSoundEnabled());

  const patients = dataStore.getPatients();
  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  useEffect(() => {
    return demoSimulationService.subscribeStatus(() => {
      setSimRunning(demoSimulationService.isPatientRunning(selectedPatientId));
      setActiveScenario(demoSimulationService.getScenario(selectedPatientId));
    });
  }, [selectedPatientId]);

  const handleToggleSimulation = () => {
    const running = demoSimulationService.toggleRunning(selectedPatientId, activeScenario);
    setSimRunning(running);
    setLastActionMsg(running ? `▶ Real-time simulation resumed (${selectedPatient?.name || selectedPatientId})` : `⏸ Simulation paused (${selectedPatient?.name || selectedPatientId})`);
    setTimeout(() => setLastActionMsg(null), 3000);
  };

  const handleScenarioChange = (scenario: SimulationScenario) => {
    demoSimulationService.setScenario(scenario, selectedPatientId);
    setActiveScenario(scenario);
    setLastActionMsg(`🩺 Scenario switched to: ${scenario.toUpperCase()} (${selectedPatient?.name || selectedPatientId})`);
    setTimeout(() => setLastActionMsg(null), 3000);
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    dataStore.setSoundEnabled(next);
    setSoundEnabled(next);
    if (next) dataStore.playChime('info');
    setLastActionMsg(next ? '🔊 Audio chimes enabled' : '🔇 Audio chimes muted');
    setTimeout(() => setLastActionMsg(null), 3000);
  };

  const handleSimulateRequest = async (type: RequestType) => {
    await HardwareEventService.simulateGestureRequest(selectedPatientId, type);
    setLastActionMsg(`✅ Glove gesture triggered: ${type}`);
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
        payload = { systolic: 172, diastolic: 106, pulse: 114 };
        desc = 'Hypertensive Crisis / Critical BP (172/106 mmHg)';
        break;
      case 'low_spo2':
        payload = { pulse: 104, spO2: 89 };
        desc = 'Critical Hypoxia / SpO2 Drop (89%)';
        break;
      case 'fever':
        payload = { pulse: 116, temperature: 39.2 };
        desc = 'High Pyrexia / Critical Fever (102.6 °F / 39.2°C)';
        break;
    }

    await HardwareEventService.simulateVitalChange(selectedPatientId, payload);
    setLastActionMsg(`⚡ Injected: ${desc}`);
    setTimeout(() => setLastActionMsg(null), 4000);
  };

  const handleResetData = () => {
    if (confirm('Reset synthetic demo dataset to clean initial state?')) {
      dataStore.resetToDefaults();
      setLastActionMsg('🔄 Demo dataset reset to factory defaults.');
      setTimeout(() => setLastActionMsg(null), 4000);
    }
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 max-w-sm w-full transition-all">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl text-white overflow-hidden">
          {/* Header Bar */}
          <div
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center justify-between p-3.5 bg-slate-800/90 hover:bg-slate-800 cursor-pointer transition-colors border-b border-slate-700 select-none"
          >
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Zap className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black tracking-wider text-amber-400 uppercase">DEMO CONTROLLER</h4>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-600/80 text-blue-100">
                    HACKATHON
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Target: {selectedPatient?.name} ({selectedPatient?.room})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleSound();
                }}
                className={`p-1 rounded-md text-xs ${soundEnabled ? 'text-emerald-400' : 'text-slate-500'}`}
                title={soundEnabled ? 'Mute sound' : 'Enable sound'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button type="button" className="text-slate-400 hover:text-white p-1">
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action Notification Toast */}
          {lastActionMsg && (
            <div className="bg-emerald-950/90 border-b border-emerald-800 text-emerald-200 text-xs px-3.5 py-1.5 flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{lastActionMsg}</span>
            </div>
          )}

          {/* Expandable Body */}
          {isOpen && (
            <div className="p-3.5 space-y-3.5 max-h-[75vh] overflow-y-auto text-xs">
              {/* Dynamic Real-time Simulation Engine Mode */}
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                      Real-Time Walk Engine
                    </span>
                    <span className={`w-2 h-2 rounded-full ${simRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleSimulation}
                    className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-[11px] font-semibold text-slate-200 flex items-center gap-1 transition-colors"
                  >
                    {simRunning ? (
                      <>
                        <Pause className="w-3 h-3 text-amber-400" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 text-emerald-400" /> Resume
                      </>
                    )}
                  </button>
                </div>

                {/* Scenario Selector Pills */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleScenarioChange('normal')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all border ${
                      activeScenario === 'normal'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScenarioChange('attention')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all border ${
                      activeScenario === 'attention'
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    Attention
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScenarioChange('critical')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all border ${
                      activeScenario === 'critical'
                        ? 'bg-red-600 text-white border-red-500'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    Critical
                  </button>
                </div>
              </div>

              {/* Target Patient Selector */}
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Target Inpatient for Direct Trigger:
                </label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedPatientId(nextId);
                    demoSimulationService.setTargetPatient(nextId);
                    setSimRunning(demoSimulationService.isPatientRunning(nextId));
                    setActiveScenario(demoSimulationService.getScenario(nextId));
                  }}
                  className="w-full text-xs bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-400 font-medium"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.room} • {p.primaryCondition})
                    </option>
                  ))}
                </select>
              </div>

              {/* Hardware Glove Gesture Triggers */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                    Simulate Glove Gestures
                  </span>
                  <span className="text-[10px] text-slate-400">Bedside residual triggers</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSimulateRequest('WATER')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                    Water Call
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSimulateRequest('FOOD')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <Utensils className="w-3.5 h-3.5 text-emerald-400" />
                    Food Call
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSimulateRequest('MEDICINE')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <Pill className="w-3.5 h-3.5 text-blue-400" />
                    Medicine Call
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSimulateRequest('NURSE')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <Zap className="w-3.5 h-3.5 text-indigo-400" />
                    Nurse Call
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSimulateRequest('EMERGENCY')}
                    className="col-span-2 p-2 bg-red-950/80 hover:bg-red-900 text-red-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-red-800 animate-pulse"
                  >
                    <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
                    Emergency Call (Escalated)
                  </button>
                </div>
              </div>

              {/* Instant Vital Telemetry Injections */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                    Instant Vital Spikes
                  </span>
                  <span className="text-[10px] text-slate-400">Threshold alerts</span>
                </div>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => handleSimulateVitals('critical_bp')}
                    className="w-full p-2 bg-red-950/60 hover:bg-red-900/80 text-red-300 rounded-lg text-xs font-medium flex items-center justify-between border border-red-800/80 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-red-400" />
                      Critical BP (172/106 mmHg)
                    </span>
                    <span className="text-[10px] font-bold uppercase bg-red-800 text-red-100 px-1.5 py-0.5 rounded">
                      Alert
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSimulateVitals('low_spo2')}
                    className="w-full p-2 bg-orange-950/60 hover:bg-orange-900/80 text-orange-300 rounded-lg text-xs font-medium flex items-center justify-between border border-orange-800/80 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <Wind className="w-3.5 h-3.5 text-orange-400" />
                      Critical Hypoxia (SpO2 89%)
                    </span>
                    <span className="text-[10px] font-bold uppercase bg-orange-800 text-orange-100 px-1.5 py-0.5 rounded">
                      Alert
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSimulateVitals('fever')}
                    className="w-full p-2 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 rounded-lg text-xs font-medium flex items-center justify-between border border-amber-800/80 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      High Pyrexia / Fever (102.6 °F)
                    </span>
                    <span className="text-[10px] font-bold uppercase bg-amber-800 text-amber-100 px-1.5 py-0.5 rounded">
                      High Alert
                    </span>
                  </button>
                </div>
              </div>

              {/* Hardware API & Reset Utilities */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowCurlModal(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  Hardware API Docs
                </button>

                <button
                  type="button"
                  onClick={handleResetData}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  Reset Defaults
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hardware API Curl Modal */}
      {showCurlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">ESP32 Hardware API Integration</h3>
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
              Microcontroller or Python test harness transmits JSON payloads to the HealthConnect event service:
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto">
                <span className="text-slate-500 block mb-1"># 1. Thumb Gesture Event (Water Assistance)</span>
                <span className="text-amber-400">curl -X POST</span> http://localhost:3001/api/patient-events \<br />
                &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
                &nbsp;&nbsp;-d '{`{"patientId": "${selectedPatientId}", "eventType": "REQUEST", "requestType": "WATER"}`}'
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto">
                <span className="text-slate-500 block mb-1"># 2. Bedside Sensor Vitals Event</span>
                <span className="text-amber-400">curl -X POST</span> http://localhost:3001/api/patient-events \<br />
                &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
                &nbsp;&nbsp;-d '{`{"patientId": "${selectedPatientId}", "eventType": "VITAL", "value": {"systolic": 172, "diastolic": 106, "pulse": 114}}`}'
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
    </>
  );
};
