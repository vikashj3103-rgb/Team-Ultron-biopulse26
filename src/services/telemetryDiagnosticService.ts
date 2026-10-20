import { VitalReading } from '../types';

export interface TelemetryDiagnosticState {
  source: 'CONNECTED' | 'RECONNECTING' | 'OFFLINE';
  lastPacketTime: number | null;
  packetsReceived: number;
  packetsApplied: number;
  lastEventId: number;
  patientId: string;
  latestReading?: VitalReading;
}

class TelemetryDiagnosticService {
  private state: TelemetryDiagnosticState = {
    source: 'OFFLINE',
    lastPacketTime: null,
    packetsReceived: 0,
    packetsApplied: 0,
    lastEventId: 0,
    patientId: 'pat-ramesh',
  };

  private listeners: Set<(state: TelemetryDiagnosticState) => void> = new Set();

  public getState(): TelemetryDiagnosticState {
    return { ...this.state };
  }

  public subscribe(listener: (state: TelemetryDiagnosticState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  public setConnectionState(source: 'CONNECTED' | 'RECONNECTING' | 'OFFLINE') {
    if (this.state.source !== source) {
      this.state.source = source;
      this.notify();
    }
  }

  public recordPacketReceived(eventId?: number, patientId?: string) {
    this.state.packetsReceived++;
    if (eventId) {
      this.state.lastEventId = Math.max(this.state.lastEventId, eventId);
    }
    if (patientId) {
      this.state.patientId = patientId;
    }
    this.notify();
  }

  public recordPacketApplied(reading: VitalReading, eventId?: number, patientId?: string) {
    this.state.packetsApplied++;
    this.state.lastPacketTime = Date.now();
    this.state.latestReading = reading;
    if (eventId) {
      this.state.lastEventId = Math.max(this.state.lastEventId, eventId);
    }
    if (patientId) {
      this.state.patientId = patientId;
    }
    this.notify();
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(s);
      } catch (err) {
        console.error('Error in telemetry diagnostic listener:', err);
      }
    });
  }
}

export const telemetryDiagnosticService = new TelemetryDiagnosticService();

if (typeof window !== 'undefined') {
  (window as any).__TELEMETRY_DIAGNOSTICS__ = telemetryDiagnosticService;
}
