import { SimulationScenario } from '../types';
import { TelemetryReadingPayload } from './telemetrySource';
import { dataStore } from './dataStore';

/**
 * ==============================================================================
 * HEALTHCONNECT REAL-TIME PATIENT-SCOPED DEMO SIMULATION ENGINE
 * ==============================================================================
 * 
 * Provides smooth, clinically plausible vital telemetry fluctuations over time
 * strictly scoped to the active target patient.
 * 
 * Guarantees:
 * 1. Telemetry events only belong to the selected patientId.
 * 2. Unselected patients (e.g. Anitha Raj when Ramesh is active) receive zero events.
 * 3. When stopped, timer terminates and no new points are generated.
 * 4. When started, new points resume with current timestamps.
 * 5. Active alerts are never auto-resolved on simulation ticks.
 * ==============================================================================
 */

export interface PatientSimInstance {
  patientId: string;
  timer: ReturnType<typeof setInterval> | null;
  scenario: SimulationScenario;
  isRunning: boolean;
  stepIntervalMs: number;
}

class DemoSimulationService {
  private instances: Map<string, PatientSimInstance> = new Map();
  private defaultIntervalMs: number = 3500; // 3.5s update cadence
  private targetPatientId: string = 'pat-ramesh';
  private defaultScenario: SimulationScenario = 'normal';
  private statusListeners: Set<(running: boolean, patientId: string) => void> = new Set();
  private readingListeners: Set<(payload: TelemetryReadingPayload) => void> = new Set();

  // Baseline targets per scenario
  private targets: Record<SimulationScenario, { sys: number; dia: number; pulse: number; spo2: number; temp: number }> = {
    normal: { sys: 120, dia: 80, pulse: 74, spo2: 98, temp: 36.8 },
    attention: { sys: 135, dia: 88, pulse: 86, spo2: 95, temp: 37.6 },
    critical: { sys: 178, dia: 112, pulse: 116, spo2: 88, temp: 39.4 },
    deterioration: { sys: 142, dia: 92, pulse: 104, spo2: 86, temp: 37.9 },
  };

  constructor() {
    if (typeof window !== 'undefined') {
      // In browser runtime, initialize continuous background telemetry simulation
      setTimeout(() => {
        this.initContinuousBackgroundTelemetry();
      }, 1000);
    }
  }

  public initContinuousBackgroundTelemetry() {
    if (typeof window === 'undefined') return;

    const demoPatients = ['pat-ramesh', 'pat-anitha', 'pat-karthik', 'pat-suresh'];
    demoPatients.forEach((pid, index) => {
      const inst = this.getOrCreateInstance(pid);
      if (!inst.isRunning) {
        inst.stepIntervalMs = 2800 + index * 300;
        setTimeout(() => {
          if (!inst.isRunning) {
            this.start(pid, inst.scenario || 'normal');
          }
        }, index * 350);
      }
    });
  }

  private getOrCreateInstance(patientId: string): PatientSimInstance {
    let inst = this.instances.get(patientId);
    if (!inst) {
      inst = {
        patientId,
        timer: null,
        scenario: this.defaultScenario,
        isRunning: false,
        stepIntervalMs: this.defaultIntervalMs,
      };
      this.instances.set(patientId, inst);
    }
    return inst;
  }

  public subscribeStatus(listener: (running: boolean, patientId: string) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.getIsRunning(), this.targetPatientId);
    return () => this.statusListeners.delete(listener);
  }

  public onReading(listener: (payload: TelemetryReadingPayload) => void): () => void {
    this.readingListeners.add(listener);
    return () => this.readingListeners.delete(listener);
  }

  private notifyStatus(patientId?: string) {
    const pid = patientId || this.targetPatientId;
    const running = this.getIsRunning(pid);
    this.statusListeners.forEach((l) => {
      try {
        l(running, pid);
      } catch (err) {
        console.error('Error in simulation status listener:', err);
      }
    });
  }

  public start(patientId = 'pat-ramesh', scenario?: SimulationScenario) {
    this.targetPatientId = patientId;
    const inst = this.getOrCreateInstance(patientId);
    if (scenario) {
      inst.scenario = scenario;
    }
    if (inst.timer) {
      clearInterval(inst.timer);
      inst.timer = null;
    }
    inst.isRunning = true;
    this.notifyStatus(patientId);

    // Emit initial reading step immediately on start
    this.tick(patientId);

    inst.timer = setInterval(() => {
      this.tick(patientId);
    }, inst.stepIntervalMs);
  }

  public stop(patientId?: string) {
    if (patientId) {
      const inst = this.instances.get(patientId);
      if (inst) {
        if (inst.timer) {
          clearInterval(inst.timer);
          inst.timer = null;
        }
        inst.isRunning = false;
      }
      this.notifyStatus(patientId);
    } else {
      this.stopAll();
    }
  }

  public stopAll() {
    this.instances.forEach((inst) => {
      if (inst.timer) {
        clearInterval(inst.timer);
        inst.timer = null;
      }
      inst.isRunning = false;
    });
    this.notifyStatus();
  }

  public toggleRunning(patientId?: string, scenario?: SimulationScenario): boolean {
    const pid = patientId || this.targetPatientId || 'pat-ramesh';
    if (this.isPatientRunning(pid)) {
      this.stop(pid);
      return false;
    } else {
      this.start(pid, scenario);
      return true;
    }
  }

  public getIsRunning(patientId?: string): boolean {
    if (patientId) {
      return this.isPatientRunning(patientId);
    }
    return Array.from(this.instances.values()).some((i) => i.isRunning);
  }

  public isPatientRunning(patientId: string): boolean {
    return !!this.instances.get(patientId)?.isRunning;
  }

  public getRunningPatientIds(): string[] {
    const ids: string[] = [];
    this.instances.forEach((inst, id) => {
      if (inst.isRunning) ids.push(id);
    });
    return ids;
  }

  public getTargetPatient(): string {
    return this.targetPatientId;
  }

  public setTargetPatient(patientId: string) {
    const changed = this.targetPatientId !== patientId;
    this.targetPatientId = patientId;
    if (changed) {
      this.notifyStatus(patientId);
    }
  }

  public getScenario(patientId?: string): SimulationScenario {
    const pid = patientId || this.targetPatientId;
    return this.instances.get(pid)?.scenario || this.defaultScenario;
  }

  public setScenario(newScenario: SimulationScenario, patientId?: string) {
    const pid = patientId || this.targetPatientId;
    const inst = this.getOrCreateInstance(pid);
    inst.scenario = newScenario;
    if (inst.isRunning) {
      this.tick(pid);
    }
  }

  /**
   * Performs a bounded, smooth physiological drift strictly for the target patient.
   * Other patients are completely untouched.
   */
  public tick(patientId?: string) {
    const pid = patientId || this.targetPatientId;
    const inst = this.instances.get(pid);
    if (!inst || !inst.isRunning) return;

    const patient = dataStore.getPatientById(pid);
    if (!patient || patient.dischargeDate) return;

    const cur = patient.latestVitals;

    // Check if patient has an active or unresolved clinical alert.
    // If so, maintain their clinical state with minor noise rather than dragging back to normal!
    const activeAlerts = dataStore.getAlerts(patient.id).filter(
      (a) => a.status === 'active' || a.status === 'acknowledged' || a.status === 'responding'
    );

    const bpAlert = activeAlerts.find((a) => a.conditionType === 'HYPERTENSION' || a.vitalType === 'BP');
    const isCriticalHypertension = (bpAlert && bpAlert.severity === 'critical') || inst.scenario === 'critical';
    const isAttentionHypertension = (bpAlert && bpAlert.severity === 'attention') || inst.scenario === 'attention';

    const spo2Alert = activeAlerts.find((a) => a.conditionType === 'HYPOXIA' || a.vitalType === 'SPO2');
    const isCriticalHypoxia = (spo2Alert && spo2Alert.severity === 'critical') || inst.scenario === 'critical' || inst.scenario === 'deterioration';

    const tempAlert = activeAlerts.find((a) => a.conditionType === 'FEVER' || a.conditionType === 'HYPERPYREXIA' || a.vitalType === 'TEMP');
    const isFever = !!tempAlert || inst.scenario === 'critical';

    const pulseAlert = activeAlerts.find((a) => a.conditionType === 'TACHYCARDIA' || a.vitalType === 'PULSE');
    const isCriticalPulse = (pulseAlert && pulseAlert.severity === 'critical') || inst.scenario === 'critical';
    const isAttentionPulse = (pulseAlert && pulseAlert.severity === 'attention') || inst.scenario === 'attention';

    const target = this.targets[inst.scenario];

    let newSys: number;
    let newDia: number;
    let newPulse: number;
    let newSpO2: number;
    let newTemp: number;

    // 1. Blood Pressure:
    // - Critical Hypertension: drift around 174-182 / 108-114 mmHg
    // - Attention Hypertension: drift around 132-138 / 86-89 mmHg
    // - Normal: bounded drift around 117-124 / 78-83 mmHg
    if (isCriticalHypertension) {
      const stepSys = Math.random() < 0.4 ? 0 : (Math.random() < 0.5 ? 1 : -1);
      const stepDia = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? 1 : -1);
      const baseSys = cur.systolicBP < 172 ? 178 : cur.systolicBP;
      const baseDia = cur.diastolicBP < 106 ? 112 : cur.diastolicBP;
      newSys = Math.max(172, Math.min(184, baseSys + stepSys));
      newDia = Math.max(106, Math.min(116, baseDia + stepDia));
    } else if (isAttentionHypertension) {
      const stepSys = Math.random() < 0.4 ? 0 : (Math.random() < 0.5 ? 1 : -1);
      const stepDia = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? 1 : -1);
      const baseSys = (cur.systolicBP > 139 || cur.systolicBP < 130) ? 135 : cur.systolicBP;
      const baseDia = (cur.diastolicBP > 89 || cur.diastolicBP < 85) ? 88 : cur.diastolicBP;
      newSys = Math.max(130, Math.min(139, baseSys + stepSys));
      newDia = Math.max(85, Math.min(89, baseDia + stepDia));
    } else {
      const baseSysTarget = target.sys;
      const baseDiaTarget = target.dia;
      const driftSys = Math.random() < 0.4 ? 0 : (cur.systolicBP > baseSysTarget + 3 ? -1 : cur.systolicBP < baseSysTarget - 3 ? 1 : (Math.random() < 0.5 ? 1 : -1));
      const driftDia = Math.random() < 0.4 ? 0 : (cur.diastolicBP > baseDiaTarget + 2 ? -1 : cur.diastolicBP < baseDiaTarget - 2 ? 1 : (Math.random() < 0.5 ? 1 : -1));
      newSys = Math.max(116, Math.min(125, cur.systolicBP + driftSys));
      newDia = Math.max(77, Math.min(84, cur.diastolicBP + driftDia));
    }

    // 2. Pulse / Heart Rate
    if (isCriticalPulse) {
      const stepPulse = Math.random() < 0.4 ? 0 : (Math.random() < 0.5 ? 1 : -1);
      const basePulse = cur.pulse < 112 ? 116 : cur.pulse;
      newPulse = Math.max(112, Math.min(124, basePulse + stepPulse));
    } else if (isAttentionPulse) {
      const stepPulse = Math.random() < 0.4 ? 0 : (Math.random() < 0.5 ? 1 : -1);
      const basePulse = (cur.pulse > 92 || cur.pulse < 84) ? 86 : cur.pulse;
      newPulse = Math.max(84, Math.min(92, basePulse + stepPulse));
    } else {
      const pulseTarget = target.pulse;
      const driftPulse = Math.random() < 0.45 ? 0 : (cur.pulse > pulseTarget + 2 ? -1 : cur.pulse < pulseTarget - 2 ? 1 : (Math.random() < 0.5 ? 1 : -1));
      newPulse = Math.max(68, Math.min(85, cur.pulse + driftPulse));
    }

    // 3. SpO2: If hypoxia active, stay critical (86-89%). Else normal drift (97-99%).
    if (isCriticalHypoxia) {
      const stepSpo2 = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? 1 : -1);
      const baseSpo2 = cur.spO2 > 89 ? 88 : cur.spO2;
      newSpO2 = Math.max(86, Math.min(89, baseSpo2 + stepSpo2));
    } else {
      const spo2Target = target.spo2;
      const stepSpo2 = Math.random() < 0.6 ? 0 : (cur.spO2 > spo2Target ? -1 : cur.spO2 < spo2Target ? 1 : (Math.random() < 0.5 ? 1 : -1));
      newSpO2 = Math.max(97, Math.min(99, cur.spO2 + stepSpo2));
    }

    // 4. Core Temperature: Bounded drift between 36.7°C (98.1°F) and 37.1°C (98.8°F)
    if (isFever) {
      const stepTemp = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? 0.1 : -0.1);
      const baseTemp = cur.temperature < 38.8 ? 39.4 : cur.temperature;
      newTemp = Number(Math.max(38.8, Math.min(39.8, baseTemp + stepTemp)).toFixed(1));
    } else {
      const stepTemp = Math.random() < 0.55 ? 0 : (cur.temperature >= 37.0 ? -0.1 : cur.temperature <= 36.7 ? 0.1 : (Math.random() < 0.5 ? 0.1 : -0.1));
      newTemp = Number(Math.max(36.7, Math.min(37.1, cur.temperature + stepTemp)).toFixed(1));
    }

    // 5. Respiratory Rate: 16-19 breaths/min
    const curRR = cur.respiratoryRate ?? 16;
    const stepRR = Math.random() < 0.6 ? 0 : (curRR > 18 ? -1 : curRR < 16 ? 1 : (Math.random() < 0.5 ? 1 : -1));
    const newRR = Math.max(15, Math.min(20, curRR + stepRR));

    const payload: TelemetryReadingPayload = {
      patientId: patient.id,
      systolicBP: newSys,
      diastolicBP: newDia,
      heartRate: newPulse,
      spO2: newSpO2,
      temperature: newTemp,
      respiratoryRate: newRR,
      timestamp: new Date().toISOString(),
      sourceType: 'simulation',
      deviceId: patient.hardwareDeviceId || 'GLOVE-ESP32-DEV01',
    };

    if (import.meta.env?.DEV) {
      console.log(`[TELEMETRY] patientId=${patient.id} timestamp=${payload.timestamp} HR=${newPulse} BP=${newSys}/${newDia} SpO2=${newSpO2} TEMP=${newTemp}°C`);
    }

    // 1. Record vitals in dataStore first to update patient state & alert engine
    dataStore.recordVitals(patient.id, {
      systolicBP: newSys,
      diastolicBP: newDia,
      pulse: newPulse,
      spO2: newSpO2,
      temperature: newTemp,
      respiratoryRate: newRR,
      timestamp: payload.timestamp,
    });

    // 2. Dispatch reading to listeners
    this.readingListeners.forEach((l) => {
      try {
        l(payload);
      } catch (err) {
        console.error('Error dispatching simulation reading:', err);
      }
    });
  }
}

export const demoSimulationService = new DemoSimulationService();

if (typeof window !== 'undefined') {
  (window as any).__DEMO_SIMULATION__ = demoSimulationService;
}
