import { TelemetrySource, TelemetryReadingPayload } from './telemetrySource';
import { simulationTelemetrySource, SimulationState } from './simulationTelemetrySource';
import { demoSimulationService } from './demoSimulationService';
import { dataStore } from './dataStore';
import { VitalReading, SimulationScenario } from '../types';
import { telemetryDiagnosticService } from './telemetryDiagnosticService';

/**
 * ==============================================================================
 * HEALTHCONNECT CLINICAL MONITORING SERVICE
 * ==============================================================================
 *
 * Central coordinator for real-time bedside telemetry ingestion, threshold
 * evaluation, and clinical alert dispatching.
 *
 * Sits between incoming TelemetrySource (simulation or hardware) and
 * the HealthConnect DataStore.
 *
 * Guarantees:
 * 1. Every telemetry event belongs strictly to payload.patientId.
 * 2. Patient-scoped subscribers receive only readings matching their patientId.
 * 3. Incoming telemetry immediately triggers vital updates, threshold alerts,
 *    and audio announcements.
 * ==============================================================================
 */

export class ClinicalMonitoringService {
  private activeSource: TelemetrySource;
  private unsubscribeSource: (() => void) | null = null;
  private patientSubscribers: Map<string, Set<(reading: VitalReading) => void>> = new Map();

  constructor(initialSource: TelemetrySource = simulationTelemetrySource) {
    this.activeSource = initialSource;
    this.bindSource(this.activeSource);

    // Listen to canonical DataStore vital records (local or remote SSE sync)
    dataStore.onVitalRecorded((patientId: string, reading: VitalReading) => {
      this.notifyPatientSubscribers(patientId, reading);
    });
  }

  /**
   * Register a subscriber for real-time telemetry updates for a specific patient.
   */
  public subscribePatientTelemetry(patientId: string, listener: (reading: VitalReading) => void): () => void {
    if (!this.patientSubscribers.has(patientId)) {
      this.patientSubscribers.set(patientId, new Set());
    }
    this.patientSubscribers.get(patientId)!.add(listener);
    return () => {
      this.patientSubscribers.get(patientId)?.delete(listener);
    };
  }

  public notifyPatientSubscribers(patientId: string, readingOverride?: VitalReading) {
    const patient = dataStore.getPatientById(patientId);
    const reading = readingOverride || patient?.latestVitals;
    if (!reading) return;

    telemetryDiagnosticService.recordPacketApplied(reading, undefined, patientId);

    const listeners = this.patientSubscribers.get(patientId);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(reading);
        } catch (err) {
          console.error('Error in patient telemetry subscriber:', err);
        }
      });
    }
  }

  /**
   * Switch the active telemetry input source (e.g. from simulation to hardware)
   */
  public setSource(newSource: TelemetrySource): void {
    if (this.unsubscribeSource) {
      this.unsubscribeSource();
      this.unsubscribeSource = null;
    }
    this.activeSource = newSource;
    this.bindSource(newSource);
  }

  public getActiveSource(): TelemetrySource {
    return this.activeSource;
  }

  private bindSource(source: TelemetrySource) {
    this.unsubscribeSource = source.subscribe((payload: TelemetryReadingPayload) => {
      this.processTelemetryReading(payload);
    });
  }

  /**
   * Dispatches incoming reading into DataStore for threshold evaluation,
   * alert deduplication, and subscriber notification.
   */
  public processTelemetryReading(payload: TelemetryReadingPayload): VitalReading | undefined {
    return dataStore.recordVitals(payload.patientId, {
      systolicBP: payload.systolicBP,
      diastolicBP: payload.diastolicBP,
      pulse: payload.heartRate,
      spO2: payload.spO2,
      temperature: payload.temperature,
      respiratoryRate: payload.respiratoryRate,
      timestamp: payload.timestamp || new Date().toISOString(),
    });
  }

  // --- Real-time Simulation Controls ---

  public startSimulation(patientId = 'pat-ramesh', scenario?: SimulationScenario): void {
    demoSimulationService.start(patientId, scenario);
  }

  public stopSimulation(patientId?: string): void {
    demoSimulationService.stop(patientId);
  }

  public toggleSimulation(patientId?: string, scenario?: SimulationScenario): boolean {
    return demoSimulationService.toggleRunning(patientId, scenario);
  }

  public isSimulationRunning(patientId?: string): boolean {
    return demoSimulationService.getIsRunning(patientId);
  }

  public getTargetPatient(): string {
    return demoSimulationService.getTargetPatient();
  }

  public setTargetPatient(patientId: string): void {
    demoSimulationService.setTargetPatient(patientId);
  }

  // --- Scenario Controls (delegated to active simulation source) ---

  public startDeteriorationScenario(patientId = 'pat-suresh'): void {
    simulationTelemetrySource.startScenario(patientId);
  }

  public pauseScenario(): void {
    simulationTelemetrySource.pause();
  }

  public resumeScenario(): void {
    simulationTelemetrySource.resume();
  }

  public resetScenario(): void {
    simulationTelemetrySource.resetScenario();
  }

  public getScenarioState(): SimulationState {
    return simulationTelemetrySource.getState();
  }

  public subscribeScenarioState(listener: (state: SimulationState) => void): () => void {
    return simulationTelemetrySource.subscribeState(listener);
  }
}

export const clinicalMonitoringService = new ClinicalMonitoringService();
