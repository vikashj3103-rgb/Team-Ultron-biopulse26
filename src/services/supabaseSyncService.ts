/**
 * ==============================================================================
 * HealthConnect Supabase Sync Service (Cloud Database + Realtime Layer)
 * ==============================================================================
 * 
 * Provides live PostgreSQL table integration and Supabase Realtime WebSocket
 * synchronization across devices and browsers for production/cloud deployments.
 * ==============================================================================
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { networkSyncService } from './networkSyncService';
import { 
  Patient, PatientRequest, VitalReading, VitalAlert, 
  Medication, MedicalReport, DoctorNote, TimelineEvent 
} from '../types';

export class SupabaseSyncService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private channel: any = null;
  private isConfigured: boolean = false;
  private isConnected: boolean = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onRemoteEventCallback: ((table: string, eventType: string, payload: any) => void) | null = null;

  constructor() {
    this.isConfigured = isSupabaseConfigured();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public initialize(onRemoteEvent: (table: string, eventType: string, payload: any) => void) {
    this.onRemoteEventCallback = onRemoteEvent;

    if (!this.isConfigured) {
      return;
    }

    try {
      this.subscribeRealtime();
    } catch (err) {
      console.warn('[Supabase Realtime] Setup error:', err);
    }
  }

  private subscribeRealtime() {
    if (!this.isConfigured) return;

    // Create a unified multi-table Realtime channel
    this.channel = supabase
      .channel('careconnect_realtime_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patient_requests' },
        (payload) => {
          this.handleTableChange('patient_requests', payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patient_vitals' },
        (payload) => {
          this.handleTableChange('patient_vitals', payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        (payload) => {
          this.handleTableChange('alerts', payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medications' },
        (payload) => {
          this.handleTableChange('medications', payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medical_reports' },
        (payload) => {
          this.handleTableChange('medical_reports', payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'doctor_notes' },
        (payload) => {
          this.handleTableChange('doctor_notes', payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patient_timeline_events' },
        (payload) => {
          this.handleTableChange('patient_timeline_events', payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patients' },
        (payload) => {
          this.handleTableChange('patients', payload);
        }
      )
      .on('broadcast', { event: 'careconnect_event' }, (payload) => {
        if (payload?.payload && this.onRemoteEventCallback) {
          this.onRemoteEventCallback(payload.payload.table || 'broadcast', payload.payload.eventType || 'UPDATE', payload.payload.data);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          networkSyncService.setSupabaseActive(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.isConnected = false;
        }
      });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleTableChange(table: string, payload: any) {
    if (!this.onRemoteEventCallback) return;
    const eventType = payload.eventType; // 'INSERT' | 'UPDATE' | 'DELETE'
    const record = payload.new || payload.old;
    this.onRemoteEventCallback(table, eventType, record);
  }

  /**
   * Broadcast quick sub-50ms peer event via Supabase Broadcast
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async broadcast(event: { table: string; eventType: string; data: any }): Promise<void> {
    if (!this.isConnected || !this.channel) return;
    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'careconnect_event',
        payload: event,
      });
    } catch {
      // non-critical broadcast failure
    }
  }

  /**
   * Sync a patient request to Supabase
   */
  public async syncRequest(request: PatientRequest): Promise<void> {
    if (!this.isConfigured) return;
    try {
      await supabase.from('patient_requests').upsert({
        id: request.id,
        patient_id: request.patientId,
        request_type: request.requestType,
        status: request.status,
        timestamp: request.timestamp,
        acknowledged_at: request.acknowledgedAt,
        acknowledged_by: request.acknowledgedBy,
        resolved_at: request.resolvedAt,
        resolved_by: request.resolvedBy,
        notes: request.notes,
      });
      this.broadcast({ table: 'patient_requests', eventType: 'UPSERT', data: request });
    } catch (err) {
      console.warn('[Supabase Sync] Request sync error:', err);
    }
  }

  /**
   * Sync medication change to Supabase
   */
  public async syncMedication(med: Medication): Promise<void> {
    if (!this.isConfigured) return;
    try {
      await supabase.from('medications').upsert({
        id: med.id,
        patient_id: med.patientId,
        name: med.name,
        dosage: med.dosage,
        route: med.route,
        frequency: med.frequency,
        scheduled_time: med.scheduledTime,
        instructions: med.instructions,
        start_date: med.startDate,
        end_date: med.endDate,
        status: med.status,
        prescribed_by: med.prescribedBy,
        administered_at: med.administeredAt,
        administered_by: med.administeredBy,
      });
      this.broadcast({ table: 'medications', eventType: 'UPSERT', data: med });
    } catch (err) {
      console.warn('[Supabase Sync] Medication sync error:', err);
    }
  }

  /**
   * Sync vital reading to Supabase
   */
  public async syncVitalReading(patientId: string, vital: VitalReading): Promise<void> {
    if (!this.isConfigured) return;
    try {
      await supabase.from('patient_vitals').insert({
        patient_id: patientId,
        systolic_bp: vital.systolicBP,
        diastolic_bp: vital.diastolicBP,
        pulse: vital.pulse,
        spo2: vital.spO2,
        temperature: vital.temperature,
        status: vital.status,
        bp_status: vital.bpStatus,
        pulse_status: vital.pulseStatus,
        spo2_status: vital.spO2Status,
        temp_status: vital.tempStatus,
        timestamp: vital.timestamp,
      });
      this.broadcast({ table: 'patient_vitals', eventType: 'INSERT', data: { patientId, vital } });
    } catch (err) {
      console.warn('[Supabase Sync] Vital sync error:', err);
    }
  }

  /**
   * Sync alert to Supabase
   */
  public async syncAlert(alert: VitalAlert): Promise<void> {
    if (!this.isConfigured) return;
    try {
      await supabase.from('alerts').upsert({
        id: alert.id,
        patient_id: alert.patientId,
        severity: alert.severity,
        status: alert.status,
        trigger: alert.trigger,
        message: alert.message,
        vital_type: alert.vitalType,
        value_recorded: alert.valueRecorded,
        timestamp: alert.timestamp,
        acknowledged_at: alert.acknowledgedAt,
        acknowledged_by: alert.acknowledgedBy,
        resolved_at: alert.resolvedAt,
        resolved_by: alert.resolvedBy,
        notes: alert.notes,
      });
      this.broadcast({ table: 'alerts', eventType: 'UPSERT', data: alert });
    } catch (err) {
      console.warn('[Supabase Sync] Alert sync error:', err);
    }
  }

  /**
   * Sync timeline event to Supabase
   */
  public async syncTimelineEvent(evt: TimelineEvent): Promise<void> {
    if (!this.isConfigured) return;
    try {
      await supabase.from('patient_timeline_events').insert({
        id: evt.id,
        patient_id: evt.patientId,
        title: evt.title,
        description: evt.description,
        category: evt.category,
        timestamp: evt.timestamp,
        actor: evt.actor,
        severity: evt.severity,
      });
      this.broadcast({ table: 'patient_timeline_events', eventType: 'INSERT', data: evt });
    } catch (err) {
      console.warn('[Supabase Sync] Timeline sync error:', err);
    }
  }

  /**
   * Sync patient status to Supabase
   */
  public async syncPatient(patient: Patient): Promise<void> {
    if (!this.isConfigured) return;
    try {
      await supabase.from('patients').upsert({
        id: patient.id,
        mrn: patient.mrn,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        blood_group: patient.bloodGroup,
        room: patient.room,
        bed: patient.bed,
        primary_condition: patient.primaryCondition,
        current_diagnosis: patient.currentDiagnosis,
        allergies: patient.allergies,
        care_instructions: patient.careInstructions,
        department: patient.department,
        admission_date: patient.admissionDate,
        discharge_date: patient.dischargeDate,
        status: patient.status,
        assigned_doctor_id: patient.assignedDoctorId,
        assigned_attender_id: patient.assignedAttenderId,
        hardware_device_id: patient.hardwareDeviceId,
        last_vital_update: patient.lastVitalUpdate,
        notes: patient.notes,
      });
      this.broadcast({ table: 'patients', eventType: 'UPSERT', data: patient });
    } catch (err) {
      console.warn('[Supabase Sync] Patient sync error:', err);
    }
  }

  public cleanup() {
    if (this.channel) {
      supabase.removeChannel(this.channel).catch(() => {});
      this.channel = null;
    }
  }
}

export const supabaseSyncService = new SupabaseSyncService();
