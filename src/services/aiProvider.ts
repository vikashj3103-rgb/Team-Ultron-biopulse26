import { supabase } from '../lib/supabase';
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

function getEnvVar(key: string): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const val = (import.meta.env as Record<string, string | undefined>)[key];
    if (val !== undefined && val !== '') return val;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;
  return proc?.env?.[key];
}

/**
 * Robust cross-platform API URL resolver.
 * Handles localhost, HTTPS dev tunnels (e.g. devtunnels.ms), remote Wi-Fi IPs,
 * desktop schemes (tauri://), and Node.js server/test environments without CORS/mixed-content blocks.
 */
export function resolveApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const configuredBase = (getEnvVar('VITE_API_BASE_URL') || '').replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const isCustomScheme = protocol === 'tauri:' || protocol === 'capacitor:';
    if (isCustomScheme) {
      return `${configuredBase || 'http://localhost:3001'}${cleanEndpoint}`;
    }
    const isHttps = protocol === 'https:';
    const isRemote = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    // When running in browser over HTTPS dev tunnel or remote host, never prepend http://localhost (mixed content / cross-origin block)
    if (configuredBase && (!isHttps || configuredBase.startsWith('https:')) && (!isRemote || !configuredBase.includes('localhost'))) {
      return `${configuredBase}${cleanEndpoint}`;
    }
    return cleanEndpoint;
  }

  const nodeBase = configuredBase || 'http://localhost:3001';
  return `${nodeBase}${cleanEndpoint}`;
}

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


/**
 * Production Server-Side AI Gateway Provider
 * Communicates with /api/clinical-ai; client never receives or stores provider secrets.
 */
export class ServerGatewayClinicalAiProvider implements AiProvider {
  public readonly name = 'CareConnect Server AI Gateway (OmniRoute)';
  public readonly isExternal = true;
  private fallbackProvider = new LocalClinicalAiProvider();
  private endpoint: string;
  private timeoutMs: number;

  constructor(endpoint = '/api/clinical-ai', options?: { timeoutMs?: number }) {
    this.endpoint = endpoint;
    this.timeoutMs = options?.timeoutMs || 18000;
  }

  public summarizePatient(context: SanitizedPatientContext): ClinicalSummaryResult {
    return this.fallbackProvider.summarizePatient(context);
  }

  public async summarizePatientAsync(context: SanitizedPatientContext): Promise<ClinicalSummaryResult> {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      let token = '';
      if (typeof window !== 'undefined') {
        try {
          const { data } = await supabase.auth.getSession();
          token = data?.session?.access_token || '';
        } catch {
          // ignore
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        headers['X-CareConnect-Role'] = 'doctor';
      headers['X-CareConnect-Patient-Id'] = context.id;
      }

      const url = resolveApiUrl(this.endpoint);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'CLINICAL_SUMMARY',
          patient: context,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutTimer);

      if (!response.ok) {
        console.warn(`[CareConnect AI Gateway] HTTP ${response.status} — using local fallback`);
        return this.fallbackProvider.summarizePatient(context);
      }

      const json = (await response.json()) as any;
      if (!json.success || !json.result) {
        console.warn('[CareConnect AI Gateway] Invalid server response payload — using local fallback');
        return this.fallbackProvider.summarizePatient(context);
      }

      return json.result as ClinicalSummaryResult;
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      if (err?.name === 'AbortError') {
        console.warn(`[CareConnect AI Gateway] Request timed out after ${this.timeoutMs}ms — using local fallback`);
      } else {
        console.warn('[CareConnect AI Gateway] Network or fetch error — using local fallback');
      }
      return this.fallbackProvider.summarizePatient(context);
    }
  }
}

export type ClinicalAiProviderType = 'server-gateway' | 'local' | 'gemini' | 'openai' | 'medical-gateway';

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
 * OpenAI-Compatible Provider via OmniRoute Gateway
 */
export class OpenAiClinicalAiProvider implements AiProvider {
  public readonly name = 'OpenAI Clinical Assistant (OmniRoute Gateway)';
  public readonly isExternal = true;
  private fallbackProvider = new LocalClinicalAiProvider();
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private timeoutMs: number;

  constructor(gatewayEndpoint?: string, options?: { apiKey?: string; model?: string; timeoutMs?: number }) {
    const envBase = getEnvVar('OMNIROUTE_BASE_URL');
    const envKey = getEnvVar('OMNIROUTE_API_KEY');
    const envModel = getEnvVar('OMNIROUTE_MODEL');

    if (gatewayEndpoint && (gatewayEndpoint.startsWith('http://') || gatewayEndpoint.startsWith('https://'))) {
      this.baseUrl = gatewayEndpoint.replace(/\/+$/, '');
    } else {
      this.baseUrl = (envBase || gatewayEndpoint || 'http://localhost:20128/v1').replace(/\/+$/, '');
    }
    this.apiKey = options?.apiKey || envKey || '';
    this.model = options?.model || envModel || 'antigravity/gemini-3-flash';
    this.timeoutMs = options?.timeoutMs || 12000;
  }

  public summarizePatient(context: SanitizedPatientContext): ClinicalSummaryResult {
    return this.fallbackProvider.summarizePatient(context);
  }

  public async summarizePatientAsync(context: SanitizedPatientContext): Promise<ClinicalSummaryResult> {
    // If no API key configured, use local fallback immediately
    if (!this.apiKey) {
      return this.fallbackProvider.summarizePatient(context);
    }

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const systemInstruction = `You are an expert clinical AI decision-support assistant for the CareConnect hospital platform.
Analyze the provided sanitized patient telemetry, vitals, medications, and timeline events.
Generate a structured clinical summary.
CRITICAL SAFETY & MEDICAL INTEGRITY CONSTRAINTS:
1. You must not invent or extrapolate unverified clinical data, vital numbers, or diagnoses.
2. Rely strictly on the provided patient context.
3. You must not prescribe medications, recommend changing doses, or make final diagnostic claims.
4. You must format your response as strict valid JSON conforming to the following keys:
{
  "patientOverview": "Concise summary of patient admission, age, sex, primary condition, and attending team",
  "currentStatus": "Clinical assessment of current physiological stability from telemetry",
  "vitalTrends": ["Array of strings summarizing trends in BP, Pulse, SpO2, and Temp"],
  "medicationsOverview": ["Array of strings reviewing active medication schedule and statuses"],
  "recentClinicalEvents": ["Array of strings highlighting recent alerts or acute episodes"],
  "importantTimelineChanges": ["Array of strings noting notable timeline transitions"],
  "potentialItemsForReview": ["Array of strings identifying pending items, allergies, or observations requiring clinician review"]
}`;

      const userPrompt = `Patient Record (Sanitized Context):
Name: ${context.name}
MRN: ${context.mrn}
Age: ${context.age} | Gender: ${context.gender} | Blood: ${context.bloodGroup}
Location: ${context.department} (${context.room}, Bed ${context.bed})
Primary Condition: ${context.primaryCondition}
Current Diagnosis: ${context.currentDiagnosis || 'N/A'}
Admission Date: ${context.admissionDate}
Attending Doctor: ${context.assignedDoctorName} (${context.assignedDoctorSpecialty || 'General'})
Allergies: ${context.allergies?.join(', ') || 'None documented'}
Latest Vitals: BP ${context.latestVitals.systolicBP}/${context.latestVitals.diastolicBP} mmHg (${context.latestVitals.bpStatus}), Pulse ${context.latestVitals.pulse} bpm (${context.latestVitals.pulseStatus}), SpO2 ${context.latestVitals.spO2}% (${context.latestVitals.spO2Status}), Temp ${context.latestVitals.temperatureF} (${context.latestVitals.tempStatus})
Active Medications: ${JSON.stringify(context.medications)}
Recent Alerts: ${JSON.stringify(context.alerts)}
Recent Timeline: ${JSON.stringify(context.recentTimeline)}`;

      const endpoint = this.baseUrl.endsWith('/chat/completions')
        ? this.baseUrl
        : `${this.baseUrl}/chat/completions`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 1500,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutTimer);

      if (!response.ok) {
        console.warn(`[OmniRoute] Request failed with HTTP ${response.status} — using local AI fallback`);
        return this.fallbackProvider.summarizePatient(context);
      }

      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        console.warn('[OmniRoute] Empty or invalid response payload — using local AI fallback');
        return this.fallbackProvider.summarizePatient(context);
      }

      // Parse JSON from model content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any;
      try {
        const cleanContent = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        parsed = JSON.parse(cleanContent);
      } catch {
        console.warn('[OmniRoute] Failed to parse model JSON — using local AI fallback');
        return this.fallbackProvider.summarizePatient(context);
      }

      // Merge verified clinical latest vitals summary (deterministic truth) with OmniRoute clinical synthesis
      const v = context.latestVitals;
      return {
        patientOverview: parsed.patientOverview || `${context.name} (${context.age}y ${context.gender}) admitted to ${context.room}.`,
        currentStatus: parsed.currentStatus || 'Stable under continuous clinical observation.',
        latestVitalsSummary: {
          bp: `${v.systolicBP}/${v.diastolicBP} mmHg`,
          pulse: v.pulse,
          spO2: v.spO2,
          tempF: v.temperatureF,
          tempC: v.temperatureC,
          statusText: `${v.bpStatus} BP • ${v.pulseStatus} pulse • ${v.spO2Status} SpO2 • ${v.tempStatus} temp`,
          recordedAt: new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        vitalTrends: Array.isArray(parsed.vitalTrends) && parsed.vitalTrends.length > 0
          ? parsed.vitalTrends
          : [
              `Blood Pressure: ${v.systolicBP}/${v.diastolicBP} mmHg (${v.bpStatus})`,
              `Pulse: ${v.pulse} bpm (${v.pulseStatus})`,
              `SpO2: ${v.spO2}% (${v.spO2Status})`,
              `Core Temperature: ${v.temperatureF} (${v.tempStatus})`,
            ],
        medicationsOverview: Array.isArray(parsed.medicationsOverview) && parsed.medicationsOverview.length > 0
          ? parsed.medicationsOverview
          : context.medications.map((m) => `• ${m.name} ${m.dosage} (${m.frequency}) - Status: ${m.status}`),
        recentClinicalEvents: Array.isArray(parsed.recentClinicalEvents) && parsed.recentClinicalEvents.length > 0
          ? parsed.recentClinicalEvents
          : ['No acute biometric alert triggers in recent observation window.'],
        importantTimelineChanges: Array.isArray(parsed.importantTimelineChanges) && parsed.importantTimelineChanges.length > 0
          ? parsed.importantTimelineChanges
          : ['Routine clinical monitoring ongoing.'],
        potentialItemsForReview: Array.isArray(parsed.potentialItemsForReview) && parsed.potentialItemsForReview.length > 0
          ? parsed.potentialItemsForReview
          : ['All telemetry parameters resting within baseline thresholds.'],
        disclaimer: 'AI-generated clinical summary via OmniRoute — verify against the patient’s medical record. This decision-support draft does not replace physician clinical judgment.',
        generatedAt: new Date().toISOString(),
      };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      if (err?.name === 'AbortError') {
        console.warn(`[OmniRoute] Request timed out after ${this.timeoutMs}ms — using local AI fallback`);
      } else {
        console.warn('[OmniRoute] Network / fetch error — using local AI fallback');
      }
      return this.fallbackProvider.summarizePatient(context);
    }
  }
}

/**
 * Factory creating configured AI provider
 */
export function createClinicalAiProvider(
  type: ClinicalAiProviderType = 'server-gateway',
  gatewayEndpoint?: string
): AiProvider {
  switch (type) {
    case 'server-gateway':
      return new ServerGatewayClinicalAiProvider(gatewayEndpoint);
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
  private activeProvider: AiProvider;

  constructor() {
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser) {
      // In production browser, always use the secure server gateway (no secrets in browser bundle)
      this.activeProvider = new ServerGatewayClinicalAiProvider();
    } else {
      // In Node / serverless / test runner environment with direct key, support direct OmniRoute
      const hasDirectKey = Boolean(getEnvVar('OMNIROUTE_API_KEY'));
      this.activeProvider = hasDirectKey ? new OpenAiClinicalAiProvider() : new ServerGatewayClinicalAiProvider();
    }
  }

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
