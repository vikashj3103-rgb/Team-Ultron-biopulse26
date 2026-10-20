/**
 * ==============================================================================
 * HEALTHCONNECT TELEMETRY SOURCE ABSTRACTION
 * ==============================================================================
 *
 * Decouples the clinical monitoring and threshold evaluation pipeline from
 * specific underlying data sources.
 *
 * Current implementation: SimulationTelemetrySource
 * Future extension: HardwareTelemetrySource (ESP32 Smart Glove, MQTT, BLE)
 * ==============================================================================
 */

export interface TelemetryReadingPayload {
  patientId: string;
  heartRate: number; // bpm
  spO2: number; // %
  temperature: number; // Celsius
  systolicBP: number; // mmHg
  diastolicBP: number; // mmHg
  respiratoryRate?: number; // breaths/min
  timestamp?: string;
  sourceType: 'simulation' | 'hardware';
  deviceId?: string;
  notes?: string;
}

export type TelemetryListener = (payload: TelemetryReadingPayload) => void;

export interface TelemetrySource {
  readonly id: string;
  readonly name: string;
  readonly sourceType: 'simulation' | 'hardware';

  /** Register subscriber for real-time telemetry readings */
  subscribe(listener: TelemetryListener): () => void;

  /** Start telemetry emission */
  start(): void;

  /** Stop/pause telemetry emission */
  stop(): void;

  /** Current execution state */
  isRunning(): boolean;
}
