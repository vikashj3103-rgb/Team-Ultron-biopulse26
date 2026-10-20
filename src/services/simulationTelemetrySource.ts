import { TelemetryReadingPayload, TelemetrySource, TelemetryListener } from './telemetrySource';

/**
 * ==============================================================================
 * HEALTHCONNECT SIMULATION TELEMETRY SOURCE
 * ==============================================================================
 *
 * Implements a software-only, clinically realistic bedside telemetry generator
 * behind the TelemetrySource abstraction.
 *
 * Supports:
 * - Suresh Kumar Post-Thyroidectomy controlled deterioration scenario:
 *   SpO₂ 97% → 95% → 92% → 89% (Warning) → 86% (Critical Alert)
 * - Automatic pause at Critical step so clinicians can demonstrate alert
 *   acknowledgement, nurse dispatch, and bedside resolution.
 * - Manual controls: Start, Pause, Resume, Reset.
 * ==============================================================================
 */

export interface DeteriorationStep {
  stepIndex: number;
  spO2: number;
  pulse: number;
  systolicBP: number;
  diastolicBP: number;
  temperature: number; // Celsius (36.9°C = 98.4°F)
  respiratoryRate: number;
  clinicalState: 'Normal' | 'Normal' | 'Attention' | 'Warning' | 'Critical';
  description: string;
}

export const SURESH_SCENARIO_STEPS: readonly DeteriorationStep[] = [
  {
    stepIndex: 0,
    spO2: 97,
    pulse: 72,
    systolicBP: 122,
    diastolicBP: 78,
    temperature: 36.9, // 98.4°F
    respiratoryRate: 16,
    clinicalState: 'Normal',
    description: 'Baseline: Stable spontaneous respiration on room air',
  },
  {
    stepIndex: 1,
    spO2: 95,
    pulse: 76,
    systolicBP: 124,
    diastolicBP: 80,
    temperature: 37.0, // 98.6°F
    respiratoryRate: 18,
    clinicalState: 'Normal',
    description: 'Post-op mucosal edema onset, mild compensatory rate increase',
  },
  {
    stepIndex: 2,
    spO2: 92,
    pulse: 84,
    systolicBP: 130,
    diastolicBP: 84,
    temperature: 37.1, // 98.8°F
    respiratoryRate: 20,
    clinicalState: 'Attention',
    description: 'Mild stridor detected, SpO₂ dropping into attention zone',
  },
  {
    stepIndex: 3,
    spO2: 89,
    pulse: 94,
    systolicBP: 138,
    diastolicBP: 88,
    temperature: 37.2, // 99.0°F
    respiratoryRate: 22,
    clinicalState: 'Warning',
    description: 'WARNING: Moderate hypoxemia, sympathetic compensation',
  },
  {
    stepIndex: 4,
    spO2: 86,
    pulse: 108,
    systolicBP: 148,
    diastolicBP: 94,
    temperature: 37.3, // 99.1°F
    respiratoryRate: 26,
    clinicalState: 'Critical',
    description: 'CRITICAL ALERT: Severe desaturation, airway compromise',
  },
];

export type SimulationMode = 'idle' | 'running_scenario' | 'paused_critical' | 'paused';

export interface SimulationState {
  mode: SimulationMode;
  patientId: string;
  patientName: string;
  currentStepIndex: number;
  currentStep: DeteriorationStep;
  totalSteps: number;
  lastEmittedAt: string | null;
}

export class SimulationTelemetrySource implements TelemetrySource {
  public readonly id = 'simulation-bedside-v1';
  public readonly name = 'HealthConnect Bedside Telemetry Simulator';
  public readonly sourceType = 'simulation' as const;

  private listeners: Set<TelemetryListener> = new Set();
  private stateListeners: Set<(state: SimulationState) => void> = new Set();
  private timer: number | null = null;
  private mode: SimulationMode = 'idle';
  private targetPatientId: string = 'pat-suresh';
  private targetPatientName: string = 'Suresh Kumar';
  private stepIndex: number = 0;
  private stepIntervalMs: number = 3000; // 3 seconds per transition
  private lastEmittedAt: string | null = null;

  constructor() {}

  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public subscribeState(listener: (state: SimulationState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => this.stateListeners.delete(listener);
  }

  private notifyState() {
    const s = this.getState();
    this.stateListeners.forEach((l) => l(s));
  }

  public getState(): SimulationState {
    const step = SURESH_SCENARIO_STEPS[this.stepIndex] || SURESH_SCENARIO_STEPS[0];
    return {
      mode: this.mode,
      patientId: this.targetPatientId,
      patientName: this.targetPatientName,
      currentStepIndex: this.stepIndex,
      currentStep: step,
      totalSteps: SURESH_SCENARIO_STEPS.length,
      lastEmittedAt: this.lastEmittedAt,
    };
  }

  public start(): void {
    this.startScenario();
  }

  public stop(): void {
    this.pause();
  }

  public isRunning(): boolean {
    return this.mode === 'running_scenario';
  }

  /**
   * Starts or restarts the Suresh Kumar post-thyroidectomy deterioration scenario.
   */
  public startScenario(patientId = 'pat-suresh'): void {
    this.clearTimer();
    this.targetPatientId = patientId;
    this.mode = 'running_scenario';
    this.stepIndex = 0;
    this.notifyState();

    // Emit initial baseline step immediately
    this.emitCurrentStep();

    // Schedule subsequent steps
    this.scheduleNextStep();
  }

  /**
   * Pauses the simulation timer.
   */
  public pause(): void {
    this.clearTimer();
    this.mode = 'paused';
    this.notifyState();
  }

  /**
   * Resumes the scenario from current step if not already at the end.
   */
  public resume(): void {
    if (this.mode === 'running_scenario') return;
    this.mode = 'running_scenario';
    this.notifyState();

    if (this.stepIndex < SURESH_SCENARIO_STEPS.length - 1) {
      this.stepIndex++;
      this.emitCurrentStep();
      this.scheduleNextStep();
    }
  }

  /**
   * Resets the patient back to normal baseline (SpO₂ 97%, HR 72, BP 122/78, Temp 98.4°F, RR 16).
   */
  public resetScenario(): void {
    this.clearTimer();
    this.mode = 'idle';
    this.stepIndex = 0;
    this.emitCurrentStep();
    this.notifyState();
  }

  /**
   * Directly emits a specific scenario step index (useful for testing and deterministic workflows).
   */
  public emitManualStep(index: number): void {
    if (index >= 0 && index < SURESH_SCENARIO_STEPS.length) {
      this.stepIndex = index;
      if (this.stepIndex === SURESH_SCENARIO_STEPS.length - 1) {
        this.clearTimer();
        this.mode = 'paused_critical';
      }
      this.emitCurrentStep();
    }
  }

  private clearTimer() {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private scheduleNextStep() {
    this.clearTimer();
    this.timer = window.setInterval(() => {
      if (this.mode !== 'running_scenario') return;

      if (this.stepIndex < SURESH_SCENARIO_STEPS.length - 1) {
        this.stepIndex++;
        this.emitCurrentStep();

        // Check if we just reached the critical step (Step 4, SpO₂ 86%)
        if (this.stepIndex === SURESH_SCENARIO_STEPS.length - 1) {
          // Auto-pause at critical event so user can demonstrate workflow
          this.clearTimer();
          this.mode = 'paused_critical';
          this.notifyState();
        }
      } else {
        this.clearTimer();
        this.mode = 'paused_critical';
        this.notifyState();
      }
    }, this.stepIntervalMs);
  }

  private emitCurrentStep() {
    const step = SURESH_SCENARIO_STEPS[this.stepIndex] || SURESH_SCENARIO_STEPS[0];
    const timestamp = new Date().toISOString();
    this.lastEmittedAt = timestamp;

    const payload: TelemetryReadingPayload = {
      patientId: this.targetPatientId,
      spO2: step.spO2,
      heartRate: step.pulse,
      systolicBP: step.systolicBP,
      diastolicBP: step.diastolicBP,
      temperature: step.temperature,
      respiratoryRate: step.respiratoryRate,
      timestamp,
      sourceType: 'simulation',
      deviceId: 'SIM-BEDSIDE-01',
      notes: step.description,
    };

    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error('Error in telemetry listener:', err);
      }
    });

    this.notifyState();
  }
}

export const simulationTelemetrySource = new SimulationTelemetrySource();
