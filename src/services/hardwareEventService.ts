import { HardwareEventPayload, RequestType } from '../types';
import { dataStore } from './dataStore';
import { clinicalMonitoringService } from './clinicalMonitoringService';

/**
 * ==============================================================================
 * HEALTHCONNECT HARDWARE EVENT SERVICE (ESP32 SMART GLOVE INTEGRATION LAYER)
 * ==============================================================================
 * 
 * Hardware-agnostic abstraction layer. Decouples the physical microcontroller /
 * smart glove sensor protocol from the HealthConnect frontend application.
 * 
 * In production / hardware testing:
 * ESP32 Smart Glove sends HTTP POST or WebSocket payload to `/api/patient-events`.
 * 
 * In hackathon prototype / judge evaluation:
 * HardwareEventService handles incoming events directly and dispatches them into
 * the data store, triggering the Alert Engine, timeline, and audio-visual alerts.
 * ==============================================================================
 */

export interface HardwareEventResult {
  success: boolean;
  message: string;
  eventId?: string;
  patientId: string;
  processedAt: string;
}

export class HardwareEventService {
  /**
   * Process incoming hardware payload (simulated or real HTTP / WebSocket stream)
   */
  public static async processEvent(payload: HardwareEventPayload): Promise<HardwareEventResult> {
    const timestamp = payload.timestamp || new Date().toISOString();

    if (!payload.patientId) {
      return {
        success: false,
        message: 'Missing required field: patientId',
        patientId: '',
        processedAt: timestamp,
      };
    }

    const patient = dataStore.getPatientById(payload.patientId);
    if (!patient) {
      return {
        success: false,
        message: `Patient with ID ${payload.patientId} not found.`,
        patientId: payload.patientId,
        processedAt: timestamp,
      };
    }

    // 1. Process Patient Assistance Request (e.g. smart glove gesture)
    const isRequestEvent = payload.eventType === 'REQUEST' || (
      !payload.eventType && Boolean(payload.requestType || (payload as any).type || (payload as any).action || (payload as any).gesture)
    );

    if (isRequestEvent) {
      const raw = (
        payload.requestType ||
        (payload as any).request ||
        (payload as any).type ||
        (payload as any).action ||
        (payload as any).gesture ||
        ''
      ).toString().trim().toUpperCase();

      let reqType: RequestType | null = null;
      if (raw === 'FOOD' || raw.includes('FOOD') || raw.includes('MEAL')) {
        reqType = 'FOOD';
      } else if (raw === 'WATER' || raw.includes('WATER') || raw.includes('DRINK')) {
        reqType = 'WATER';
      } else if (raw === 'MEDICINE' || raw.includes('MEDICINE') || raw.includes('MEDICATION') || raw.includes('PILL')) {
        reqType = 'MEDICINE';
      } else if (raw === 'NURSE' || raw.includes('NURSE') || raw.includes('STAFF')) {
        reqType = 'NURSE';
      } else if (raw === 'EMERGENCY' || raw.includes('EMERG') || raw.includes('URGENT')) {
        reqType = 'EMERGENCY';
      }

      if (!reqType) {
        return {
          success: false,
          message: `Invalid or missing requestType: "${payload.requestType || ''}". Must be one of: WATER, FOOD, MEDICINE, NURSE, EMERGENCY. No fallback allowed.`,
          patientId: payload.patientId,
          processedAt: timestamp,
        };
      }

      const created = dataStore.createPatientRequest(
        patient.id,
        reqType,
        `Originating from Smart Glove sensor device (${patient.hardwareDeviceId || 'Bedside ESP32'}).`
      );

      return {
        success: true,
        message: `Hardware request ${reqType} registered successfully for patient ${patient.name}.`,
        eventId: created?.id,
        patientId: patient.id,
        processedAt: timestamp,
      };
    }

    // 2. Process Bedside Sensor Vital Reading
    if (payload.eventType === 'VITAL') {
      const current = patient.latestVitals;
      const v = payload.value || {};

      const updatedReading = clinicalMonitoringService.processTelemetryReading({
        patientId: patient.id,
        systolicBP: v.systolic !== undefined ? v.systolic : current.systolicBP,
        diastolicBP: v.diastolic !== undefined ? v.diastolic : current.diastolicBP,
        heartRate: v.pulse !== undefined ? v.pulse : current.pulse,
        spO2: v.spO2 !== undefined ? v.spO2 : current.spO2,
        temperature: v.temperature !== undefined ? v.temperature : current.temperature,
        respiratoryRate: v.respiratoryRate !== undefined ? v.respiratoryRate : (current.respiratoryRate ?? 16),
        timestamp,
        sourceType: 'hardware',
        deviceId: patient.hardwareDeviceId || 'ESP32-SMART-GLOVE',
      });

      return {
        success: true,
        message: `Vital update processed for ${patient.name}. New status: ${updatedReading?.status.toUpperCase()}`,
        patientId: patient.id,
        processedAt: timestamp,
      };
    }

    return {
      success: false,
      message: `Unknown eventType: ${payload.eventType}`,
      patientId: payload.patientId,
      processedAt: timestamp,
    };
  }

  /**
   * Helper for quick gesture simulations during demo presentations
   */
  public static async simulateGestureRequest(patientId: string, gestureType: RequestType): Promise<HardwareEventResult> {
    return this.processEvent({
      patientId,
      eventType: 'REQUEST',
      requestType: gestureType,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Helper for vital simulation
   */
  public static async simulateVitalChange(
    patientId: string,
    vitals: { systolic?: number; diastolic?: number; pulse?: number; spO2?: number; temperature?: number }
  ): Promise<HardwareEventResult> {
    return this.processEvent({
      patientId,
      eventType: 'VITAL',
      value: vitals,
      timestamp: new Date().toISOString(),
    });
  }
}

if (typeof window !== 'undefined') {
  (window as any).__HARDWARE_EVENTS__ = HardwareEventService;
}
