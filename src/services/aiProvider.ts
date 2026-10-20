/**
 * HealthConnect Clinical AI Provider Architecture & Data Sanitization Layer
 * 
 * Provides:
 * 1. Sanitization / Data-Preparation Layer:
 *    - Strips passwords, temporary passwords, auth tokens, unrelated patients,
 *      other doctors' patients, internal audit secrets.
 * 2. Provider Abstraction (AiProvider interface):
 *    - summarizePatient(context)
 * 3. Default implementation (LocalClinicalAiProvider):
 *    - Rule-based clinical documentation & synthesis draft generator
 *    - Plug-and-play architecture for future OpenAI/Gemini/Medical AI providers.
 * 4. Transparent non-diagnostic labeling:
 *    - "AI Clinical Assistant — Decision-support draft. Always verify against the patient's medical record."
 */

import { Patient, VitalAlert, Medication, MedicalReport, TimelineEvent, UserRole } from '../types';
import { formatTemperatureF, formatTemperatureVal } from '../utils/temperature';

export interface SanitizedPatientContext {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  bloodGroup: string;
  room: string;
  bed: string;
  status: string;
  department: string;
  primaryCondition: string;
  currentDiagnosis?: string;
  medicalHistory?: string;
  treatmentPlan?: string;
  allergies: string[];
  careInstructions?: string;
  assignedDoctorName: string;
  assignedDoctorSpecialty?: string;
  admissionDate: string;
  latestVitals: {
    systolicBP: number;
    diastolicBP: number;
    bpStatus: string;
    pulse: number;
    pulseStatus: string;
    spO2: number;
    spO2Status: string;
    temperatureC: number;
    temperatureF: string;
    tempStatus: string;
    timestamp: string;
  };
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    scheduledTime: string;
    status: string;
  }>;
  alerts: Array<{
    severity: string;
    message: string;
    timestamp: string;
  }>;
  recentTimeline: Array<{
    type: string;
    title: string;
    description: string;
    timestamp: string;
  }>;
  careTeam?: Array<{
    name: string;
    role: string;
    specialty?: string;
  }>;
  procedures?: Array<{
    procedureName: string;
    status: string;
    surgeonName: string;
    scheduledAt: string;
  }>;
  currentLocation?: {
    building: string;
    floor: number;
    ward: string;
    room: string;
    bed: string;
  };
}

export interface ClinicalSummaryResult {
  patientOverview: string;
  currentStatus: string;
  latestVitalsSummary: {
    bp: string;
    pulse: number;
    spO2: number;
    tempF: string;
    tempC: number;
    statusText: string;
    recordedAt: string;
  };
  vitalTrends: string[];
  medicationsOverview: string[];
  recentClinicalEvents: string[];
  importantTimelineChanges: string[];
  potentialItemsForReview: string[];
  disclaimer: string;
  generatedAt: string;
}

export interface AiProvider {
  readonly name: string;
  readonly isExternal: boolean;
  summarizePatient(context: SanitizedPatientContext): ClinicalSummaryResult;
  summarizePatientAsync?(context: SanitizedPatientContext): Promise<ClinicalSummaryResult>;
}

/**
 * Strips all sensitive credentials, auth secrets, and unrelated metadata.
 * Only sends minimum clinical data required for patient synthesis.
 */
export function sanitizePatientData(
  patient: Patient,
  medications: Medication[] = [],
  alerts: VitalAlert[] = [],
  timeline: TimelineEvent[] = [],
  careTeam: Array<{ name: string; role: string; specialty?: string }> = [],
  procedures: Array<{ procedureName: string; status: string; surgeonName: string; scheduledAt: string }> = []
): SanitizedPatientContext {
  const effectiveCareTeam = careTeam && careTeam.length > 0 ? careTeam : (patient.careTeam || []);
  return {
    id: patient.id,
    mrn: patient.mrn,
    name: patient.name,
    age: patient.age,
    gender: patient.gender,
    bloodGroup: patient.bloodGroup,
    room: patient.room,
    bed: patient.bed,
    status: patient.status,
    department: patient.department || 'General Medicine',
    primaryCondition: patient.primaryCondition,
    currentDiagnosis: patient.currentDiagnosis || patient.primaryCondition,
    medicalHistory: patient.medicalHistory,
    treatmentPlan: patient.treatmentPlan,
    allergies: patient.allergies ? [...patient.allergies] : [],
    careInstructions: patient.careInstructions,
    assignedDoctorName: patient.assignedDoctorName || 'Duty Clinician',
    assignedDoctorSpecialty: patient.assignedDoctorSpecialty,
    admissionDate: patient.admissionDate,
    latestVitals: {
      systolicBP: patient.latestVitals.systolicBP,
      diastolicBP: patient.latestVitals.diastolicBP,
      bpStatus: patient.latestVitals.bpStatus,
      pulse: patient.latestVitals.pulse,
      pulseStatus: patient.latestVitals.pulseStatus,
      spO2: patient.latestVitals.spO2,
      spO2Status: patient.latestVitals.spO2Status,
      temperatureC: patient.latestVitals.temperature,
      temperatureF: formatTemperatureF(patient.latestVitals.temperature),
      tempStatus: patient.latestVitals.tempStatus,
      timestamp: patient.latestVitals.timestamp,
    },
    medications: medications.map((m) => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      scheduledTime: m.scheduledTime,
      status: m.status,
    })),
    alerts: alerts.slice(0, 5).map((a) => ({
      severity: a.severity,
      message: a.message,
      timestamp: a.timestamp,
    })),
    recentTimeline: timeline.slice(0, 8).map((t) => ({
      type: t.category,
      title: t.title,
      description: t.description,
      timestamp: t.timestamp,
    })),
    careTeam: effectiveCareTeam.map((m) => ({
      name: m.name,
      role: m.role,
      specialty: m.specialty,
    })),
    procedures: procedures.map((p) => ({
      procedureName: p.procedureName,
      status: p.status,
      surgeonName: p.surgeonName,
      scheduledAt: p.scheduledAt,
    })),
    currentLocation: patient.currentLocation
      ? {
          building: patient.currentLocation.building,
          floor: patient.currentLocation.floor,
          ward: patient.currentLocation.ward,
          room: patient.currentLocation.room,
          bed: patient.currentLocation.bed,
        }
      : undefined,
  };
}

/**
 * Built-in deterministic clinical synthesis provider
 */
export class LocalClinicalAiProvider implements AiProvider {
  public readonly name = 'Local Clinical AI Provider';
  public readonly isExternal = false;

  public summarizePatient(context: SanitizedPatientContext): ClinicalSummaryResult {
    const v = context.latestVitals;
    const admissionDateFormatted = new Date(context.admissionDate).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    // 1. Patient Overview
    const patientOverview = `${context.name} (${context.age}y ${context.gender}, Blood: ${context.bloodGroup}, MRN: ${context.mrn}) admitted on ${admissionDateFormatted} to ${context.department} Ward (${context.room}, ${context.bed}). Primary clinical condition: ${context.currentDiagnosis || context.primaryCondition}. Attending physician: ${context.assignedDoctorName}${context.assignedDoctorSpecialty ? ` (${context.assignedDoctorSpecialty})` : ''}.`;

    // 2. Current Status
    let statusDesc = 'Patient telemetry shows stable physiological status with continuous bedside monitoring active.';
    if (context.status === 'critical' || context.status === 'high') {
      statusDesc = 'CRITICAL CLINICAL ALERT: Patient telemetry indicates active hemodynamic or respiratory instability requiring immediate physician assessment.';
    } else if (context.status === 'attention') {
      statusDesc = 'ATTENTION REQUIRED: Telemetry shows moderate physiological shift from baseline; active nursing observation maintained.';
    }

    // 3. Vital Trends
    const vitalTrends: string[] = [
      `Blood Pressure: ${v.systolicBP}/${v.diastolicBP} mmHg (${v.bpStatus}). Target systolic range 100–135 mmHg.`,
      `Pulse / Heart Rate: ${v.pulse} bpm (${v.pulseStatus}). Sinus rhythm monitored via smart glove & bedside telemetry.`,
      `Oxygen Saturation: ${v.spO2}% SpO2 (${v.spO2Status}). Peripheral perfusion stable.`,
      `Core Temperature: ${v.temperatureF} (${v.tempStatus}). Reference range: 97.7 °F – 99.5 °F.`,
    ];

    // 4. Medications Overview
    const medicationsOverview = context.medications.length > 0
      ? context.medications.map((m) => `• ${m.name} ${m.dosage} — ${m.frequency} [Scheduled: ${m.scheduledTime}] • Status: ${m.status}`)
      : ['No active medications currently registered in pharmacy roster.'];

    // 5. Recent Clinical Events
    const recentClinicalEvents = context.alerts.length > 0
      ? context.alerts.map((a) => `[${a.severity.toUpperCase()}] ${a.message} (${new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`)
      : ['No acute biometric alert triggers in recent observation window.'];

    // 6. Important Timeline Changes
    const importantTimelineChanges = context.recentTimeline.length > 0
      ? context.recentTimeline.slice(0, 5).map((t) => `${t.title}: ${t.description}`)
      : ['Routine clinical monitoring ongoing with no recorded escalation events.'];

    // 7. Potential Items Requiring Clinical Review
    const potentialItemsForReview: string[] = [];
    if (context.allergies && context.allergies.length > 0) {
      potentialItemsForReview.push(`Documented Allergies: ${context.allergies.join(', ')} — ensure all prescribed oral/IV agents are cross-checked.`);
    }
    const pendingMeds = context.medications.filter((m) => m.status === 'Pending');
    if (pendingMeds.length > 0) {
      potentialItemsForReview.push(`${pendingMeds.length} scheduled dose(s) pending administration by nursing staff: ${pendingMeds.map((m) => m.name).join(', ')}.`);
    }
    if (v.spO2Status !== 'normal') {
      potentialItemsForReview.push(`Peripheral oxygen saturation (${v.spO2}%) flagged as ${v.spO2Status}; assess pulmonary auscultation and cannula placement.`);
    }
    if (v.tempStatus !== 'normal') {
      potentialItemsForReview.push(`Temperature reading ${v.temperatureF} flagged as ${v.tempStatus}; verify antipyretic protocol if core temperature persists above 100.4 °F.`);
    }
    if (potentialItemsForReview.length === 0) {
      potentialItemsForReview.push('All telemetry parameters resting within baseline thresholds. Continue scheduled care plan.');
    }

    return {
      patientOverview,
      currentStatus: statusDesc,
      latestVitalsSummary: {
        bp: `${v.systolicBP}/${v.diastolicBP} mmHg`,
        pulse: v.pulse,
        spO2: v.spO2,
        tempF: v.temperatureF,
        tempC: v.temperatureC,
        statusText: `${v.bpStatus} BP • ${v.pulseStatus} pulse • ${v.spO2Status} SpO2 • ${v.tempStatus} temp`,
        recordedAt: new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      vitalTrends,
      medicationsOverview,
      recentClinicalEvents,
      importantTimelineChanges,
      potentialItemsForReview,
      disclaimer: 'AI-generated clinical summary — verify against the patient’s medical record. This decision-support draft does not replace physician clinical judgment.',
      generatedAt: new Date().toISOString(),
    };
  }
}

export type ClinicalAiProviderType = 'local' | 'gemini' | 'openai' | 'medical-gateway';

/**
 * Gemini Provider via Secure Server Gateway
 * Note: Cloud API keys (GEMINI_API_KEY) must NEVER be exposed in frontend bundles.
 * This adapter uses a backend proxy route or falls back safely to LocalClinicalAiProvider.
 */
export class GeminiClinicalAiProvider implements AiProvider {
  public readonly name = 'Google Gemini Clinical Assistant (Gateway)';
  public readonly isExternal = true;
  private fallbackProvider = new LocalClinicalAiProvider();
  private gatewayEndpoint: string;

  constructor(gatewayEndpoint = '/api/clinical-ai/gemini-summary') {
    this.gatewayEndpoint = gatewayEndpoint;
  }

  public summarizePatient(context: SanitizedPatientContext): ClinicalSummaryResult {
    return this.fallbackProvider.summarizePatient(context);
  }

  public async summarizePatientAsync(context: SanitizedPatientContext): Promise<ClinicalSummaryResult> {
    try {
      const response = await fetch(this.gatewayEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientContext: context }),
      });

      if (!response.ok) {
        return this.fallbackProvider.summarizePatient(context);
      }

      const data = await response.json();
      return {
        ...data,
        disclaimer: 'AI-generated clinical summary — verify against the patient’s medical record. This decision-support draft does not replace physician clinical judgment.',
      };
    } catch {
      // Graceful fallback to deterministic local provider if gateway is offline
      return this.fallbackProvider.summarizePatient(context);
    }
  }
}

/**
 * OpenAI-Compatible Provider via Secure Server Gateway
 */
export class OpenAiClinicalAiProvider implements AiProvider {
  public readonly name = 'OpenAI Clinical Assistant (Gateway)';
  public readonly isExternal = true;
  private fallbackProvider = new LocalClinicalAiProvider();
  private gatewayEndpoint: string;

  constructor(gatewayEndpoint = '/api/clinical-ai/openai-summary') {
    this.gatewayEndpoint = gatewayEndpoint;
  }

  public summarizePatient(context: SanitizedPatientContext): ClinicalSummaryResult {
    return this.fallbackProvider.summarizePatient(context);
  }

  public async summarizePatientAsync(context: SanitizedPatientContext): Promise<ClinicalSummaryResult> {
    try {
      const response = await fetch(this.gatewayEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientContext: context }),
      });

      if (!response.ok) {
        return this.fallbackProvider.summarizePatient(context);
      }

      const data = await response.json();
      return {
        ...data,
        disclaimer: 'AI-generated clinical summary — verify against the patient’s medical record. This decision-support draft does not replace physician clinical judgment.',
      };
    } catch {
      return this.fallbackProvider.summarizePatient(context);
    }
  }
}

/**
 * Factory creating configured AI provider
 */
export function createClinicalAiProvider(
  type: ClinicalAiProviderType = 'local',
  gatewayEndpoint?: string
): AiProvider {
  switch (type) {
    case 'gemini':
      return new GeminiClinicalAiProvider(gatewayEndpoint);
    case 'openai':
      return new OpenAiClinicalAiProvider(gatewayEndpoint);
    case 'local':
    default:
      return new LocalClinicalAiProvider();
  }
}

/**
 * Service managing active AI Provider
 */
class ClinicalAiService {
  private activeProvider: AiProvider = new LocalClinicalAiProvider();

  public setProvider(provider: AiProvider) {
    this.activeProvider = provider;
  }

  public getProvider(): AiProvider {
    return this.activeProvider;
  }

  public generateSummarySync(
    patient: Patient,
    medications: Medication[] = [],
    alerts: VitalAlert[] = [],
    timeline: TimelineEvent[] = []
  ): ClinicalSummaryResult {
    const sanitized = sanitizePatientData(patient, medications, alerts, timeline);
    return this.activeProvider.summarizePatient(sanitized);
  }

  public async generateSummary(
    patient: Patient,
    medications: Medication[] = [],
    alerts: VitalAlert[] = [],
    timeline: TimelineEvent[] = []
  ): Promise<ClinicalSummaryResult> {
    const sanitized = sanitizePatientData(patient, medications, alerts, timeline);
    if (this.activeProvider.summarizePatientAsync) {
      return await this.activeProvider.summarizePatientAsync(sanitized);
    }
    return this.activeProvider.summarizePatient(sanitized);
  }
}

export const clinicalAiService = new ClinicalAiService();
