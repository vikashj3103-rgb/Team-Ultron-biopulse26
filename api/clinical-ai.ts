/**
 * CareConnect Production Clinical AI Gateway Endpoint
 * Route: POST /api/clinical-ai
 * 
 * Provides:
 * 1. Server-side mediated AI gateway: clients never hold or send provider API keys.
 * 2. Role-based access validation (Doctor/Admin for clinical summaries; Attender/Doctor/Admin for CareAI).
 * 3. Server-side patient data sanitization gate (strips tokens, passwords, PINs, unrelated PII).
 * 4. Internal routing to OmniRoute (antigravity/gemini-3-flash or configured model).
 * 5. Strict response validation with seamless local clinical fallback.
 * 6. Audit logging without sensitive credentials or complete patient transcripts.
 */

import { checkRateLimit } from './_security.js';

// Ambient declaration for Serverless environment
declare const process: any;

function isValidUuid(val: any): boolean {
  return typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

interface AiAuditParams {
  hospitalId?: string | null;
  actorId?: string | null;
  eventType: string;
  resourceType?: string;
  resourceId?: string | null;
  outcome: 'success' | 'failure' | 'denied';
  details: {
    correlation_id: string;
    action: string;
    role: string;
    latency_ms: number;
    model?: string;
    fallback_used: boolean;
    error_category?: string | null;
    reason?: string;
    [key: string]: any;
  };
}

/**
 * Fail-Safe Server-Side AI Audit Logging
 * Writes to Supabase public.audit_logs when available.
 * Strips all tokens, keys, passwords, and sensitive credentials.
 * Ensures audit write exceptions NEVER disrupt the clinical AI response.
 */
async function recordAiAudit(params: AiAuditParams): Promise<void> {
  try {
    const { hospitalId, actorId, eventType, resourceType = 'patient', resourceId = null, outcome, details } = params;

    // Security check: strictly scrub any credential or secret fields
    const sanitizedDetails: Record<string, any> = { ...details };
    delete sanitizedDetails.token;
    delete sanitizedDetails.apiKey;
    delete sanitizedDetails.authorization;
    delete sanitizedDetails.password;
    delete sanitizedDetails.pin;
    delete sanitizedDetails.secret;

    // Structured operational console log
    console.log(
      `[AI AUDIT] correlation_id=${details.correlation_id} event=${eventType} outcome=${outcome} latency=${details.latency_ms}ms role=${details.role} action=${details.action}${details.model ? ` model=${details.model}` : ''}${details.fallback_used ? ' (fallback)' : ''}`
    );

    // Call test hook if registered (for automated test assertion of audit records)
    if (typeof (globalThis as any).__AI_AUDIT_LOG_HOOK__ === 'function') {
      try {
        (globalThis as any).__AI_AUDIT_LOG_HOOK__({
          hospital_id: hospitalId,
          actor_id: actorId,
          event_type: eventType,
          resource_type: resourceType,
          resource_id: resourceId,
          outcome,
          details: sanitizedDetails,
        });
      } catch {
        // test hook error ignored
      }
    }

    // Persistent Supabase Insertion
    const supabaseUrl = process.env?.SUPABASE_URL || process.env?.VITE_SUPABASE_URL;
    const supabaseKey =
      process.env?.SUPABASE_SERVICE_ROLE_KEY ||
      process.env?.SUPABASE_ANON_KEY ||
      process.env?.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const auditRow = {
        hospital_id: isValidUuid(hospitalId) ? hospitalId : null,
        actor_id: isValidUuid(actorId) ? actorId : null,
        event_type: eventType,
        resource_type: resourceType,
        resource_id: resourceId || null,
        outcome,
        details: {
          ...sanitizedDetails,
          hospital_identifier: hospitalId && !isValidUuid(hospitalId) ? hospitalId : undefined,
          actor_identifier: actorId && !isValidUuid(actorId) ? actorId : undefined,
          recorded_at: new Date().toISOString(),
        },
      };

      const auditRes = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/audit_logs`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(auditRow),
      });

      if (!auditRes.ok) {
        console.warn(`[AI AUDIT] Supabase audit write returned HTTP ${auditRes.status}`);
      }
    }
  } catch (err: any) {
    // Fail-safe: Audit failure must NEVER crash or abort the clinical AI pipeline
    console.warn('[AI AUDIT FAILSAFE] Non-blocking audit log error:', err?.message || err);
  }
}

interface SanitizedVitals {
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
}

interface SanitizedContext {
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
  allergies: string[];
  assignedDoctorName: string;
  admissionDate: string;
  latestVitals: SanitizedVitals;
  medications: Array<{ name: string; dosage: string; frequency: string; status: string }>;
  alerts: Array<{ severity: string; message: string; timestamp: string }>;
  recentTimeline: Array<{ type: string; title: string; description: string; timestamp: string }>;
}

function sanitizeServerPatientData(raw: any): SanitizedContext {
  if (!raw || typeof raw !== 'object') {
    return {
      id: 'unknown',
      mrn: 'MRN-000000',
      name: 'Patient',
      age: 0,
      gender: 'Unknown',
      bloodGroup: 'Unknown',
      room: 'Unassigned',
      bed: 'Unassigned',
      status: 'stable',
      department: 'General',
      primaryCondition: 'Clinical Observation',
      allergies: [],
      assignedDoctorName: 'Attending Clinician',
      admissionDate: new Date().toISOString(),
      latestVitals: {
        systolicBP: 120,
        diastolicBP: 80,
        bpStatus: 'normal',
        pulse: 72,
        pulseStatus: 'normal',
        spO2: 98,
        spO2Status: 'normal',
        temperatureC: 37,
        temperatureF: '98.6 °F',
        tempStatus: 'normal',
        timestamp: new Date().toISOString(),
      },
      medications: [],
      alerts: [],
      recentTimeline: [],
    };
  }

  const v = raw.latestVitals || {};
  const tempC = typeof v.temperature === 'number' ? v.temperature : (typeof v.temperatureC === 'number' ? v.temperatureC : 37);
  const tempF = v.temperatureF || `${(tempC * 9 / 5 + 32).toFixed(1)} °F`;

  return {
    id: String(raw.id || 'pat-unknown'),
    mrn: String(raw.mrn || 'MRN-UNKNOWN'),
    name: String(raw.name || 'Anonymous Patient'),
    age: Number(raw.age) || 0,
    gender: String(raw.gender || 'Unknown'),
    bloodGroup: String(raw.bloodGroup || 'Unknown'),
    room: String(raw.room || 'Bedside'),
    bed: String(raw.bed || 'A'),
    status: String(raw.status || 'stable'),
    department: String(raw.department || 'Inpatient'),
    primaryCondition: String(raw.primaryCondition || 'Under Observation'),
    currentDiagnosis: raw.currentDiagnosis ? String(raw.currentDiagnosis) : undefined,
    allergies: Array.isArray(raw.allergies) ? raw.allergies.map(String) : [],
    assignedDoctorName: String(raw.assignedDoctorName || 'Dr. Attending'),
    admissionDate: String(raw.admissionDate || new Date().toISOString()),
    latestVitals: {
      systolicBP: Number(v.systolicBP) || 120,
      diastolicBP: Number(v.diastolicBP) || 80,
      bpStatus: String(v.bpStatus || 'normal'),
      pulse: Number(v.pulse) || 72,
      pulseStatus: String(v.pulseStatus || 'normal'),
      spO2: Number(v.spO2) || 98,
      spO2Status: String(v.spO2Status || 'normal'),
      temperatureC: tempC,
      temperatureF: String(tempF),
      tempStatus: String(v.tempStatus || 'normal'),
      timestamp: String(v.timestamp || new Date().toISOString()),
    },
    medications: Array.isArray(raw.medications)
      ? raw.medications.slice(0, 10).map((m: any) => ({
          name: String(m.name || 'Medication'),
          dosage: String(m.dosage || ''),
          frequency: String(m.frequency || ''),
          status: String(m.status || 'Scheduled'),
        }))
      : [],
    alerts: Array.isArray(raw.alerts)
      ? raw.alerts.slice(0, 5).map((a: any) => ({
          severity: String(a.severity || 'low'),
          message: String(a.message || ''),
          timestamp: String(a.timestamp || ''),
        }))
      : [],
    recentTimeline: Array.isArray(raw.timeline || raw.recentTimeline)
      ? (raw.timeline || raw.recentTimeline).slice(0, 5).map((t: any) => ({
          type: String(t.type || 'NOTE'),
          title: String(t.title || ''),
          description: String(t.description || ''),
          timestamp: String(t.timestamp || ''),
        }))
      : [],
  };
}

function generateLocalFallbackSummary(context: SanitizedContext) {
  const v = context.latestVitals;
  const admissionFormatted = new Date(context.admissionDate).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  let statusDesc = 'Patient telemetry shows stable physiological status with continuous bedside monitoring active.';
  if (context.status === 'critical' || context.status === 'high') {
    statusDesc = 'CRITICAL CLINICAL ALERT: Patient telemetry indicates active hemodynamic or respiratory instability requiring immediate physician assessment.';
  } else if (context.status === 'attention') {
    statusDesc = 'ATTENTION REQUIRED: Telemetry shows moderate physiological shift from baseline; active nursing observation maintained.';
  }

  return {
    patientOverview: `${context.name} (${context.age}y ${context.gender}, Blood: ${context.bloodGroup}, MRN: ${context.mrn}) admitted on ${admissionFormatted} to ${context.department} Ward (${context.room}, ${context.bed}). Primary clinical condition: ${context.currentDiagnosis || context.primaryCondition}. Attending physician: ${context.assignedDoctorName}.`,
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
    vitalTrends: [
      `Blood Pressure: ${v.systolicBP}/${v.diastolicBP} mmHg (${v.bpStatus})`,
      `Pulse: ${v.pulse} bpm (${v.pulseStatus})`,
      `SpO2: ${v.spO2}% (${v.spO2Status})`,
      `Core Temperature: ${v.temperatureF} (${v.tempStatus})`,
    ],
    medicationsOverview: context.medications.length > 0
      ? context.medications.map((m) => `• ${m.name} ${m.dosage} (${m.frequency}) - Status: ${m.status}`)
      : ['No active medications currently scheduled.'],
    recentClinicalEvents: context.alerts.length > 0
      ? context.alerts.map((a) => `• [${a.severity.toUpperCase()}] ${a.message}`)
      : ['No acute biometric alert triggers in recent observation window.'],
    importantTimelineChanges: context.recentTimeline.length > 0
      ? context.recentTimeline.map((t) => `• ${t.title}: ${t.description}`)
      : ['Routine clinical monitoring ongoing.'],
    potentialItemsForReview: [
      context.allergies.length > 0
        ? `Documented allergies: ${context.allergies.join(', ')}. Verify all newly administered agents.`
        : 'No adverse drug reactions or allergies documented.',
      'Correlate latest vital trends with scheduled bedside medication administration.',
    ],
    disclaimer: 'AI-generated clinical summary — verify against the patient’s medical record. This decision-support draft does not replace physician clinical judgment.',
    generatedAt: new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  const correlationId = 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);

  const origin = req.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  const reqHeaders = req.headers?.['access-control-request-headers'];
  res.setHeader(
    'Access-Control-Allow-Headers',
    reqHeaders || 'Content-Type, Authorization, X-CareConnect-Role, X-CareConnect-Patient-Id, X-CareConnect-Assigned-Doctor, X-CareConnect-Assigned-Attender, X-CareConnect-Hospital-Id'
  );
  res.setHeader('X-Correlation-Id', correlationId);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      code: 'AI_INVALID_RESPONSE',
      error: 'Method not allowed. Use POST.',
      correlationId,
    });
  }

  // In development, ensure server-side environment variables from .env are available if not yet populated
  if (process.env?.NODE_ENV !== 'production' && !process.env?.OMNIROUTE_API_KEY) {
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const k = trimmed.slice(0, idx).trim();
            const v = trimmed.slice(idx + 1).trim();
            if (!process.env[k]) {
              process.env[k] = v;
            }
          }
        }
      }
    } catch {
      // Non-blocking in environments without filesystem access
    }
  }

  let action = '';
  let role = 'unauthenticated';
  let userId = 'anonymous';
  let hospitalId: string | null = null;
  let sanitized: SanitizedContext | null = null;

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    action = payload.action;
    const { patient, rawQuery, language } = payload;

    if (!action || (action !== 'CLINICAL_SUMMARY' && action !== 'CAREGIVER_ASSISTANT')) {
      return res.status(400).json({
        success: false,
        code: 'AI_INVALID_RESPONSE',
        error: 'Invalid AI action. Must be CLINICAL_SUMMARY or CAREGIVER_ASSISTANT.',
        correlationId,
      });
    }

    // Resolve tenant / hospital identifier
    const hospitalHeader = req.headers?.['x-careconnect-hospital-id'] || req.headers?.['x-hospital-id'];
    hospitalId = hospitalHeader ? String(hospitalHeader).trim() : (patient?.hospitalId || null);

    // --- 1. Authenticate & Authorize Role ---
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    const roleHeader = req.headers?.['x-careconnect-role'] || req.headers?.['X-CareConnect-Role'];

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const supabaseUrl = process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL;
      const anonKey = process.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY;

      if (supabaseUrl && anonKey && token && token !== 'local-mock-token') {
        try {
          const authRes = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'apikey': anonKey,
            },
          });
          if (authRes.ok) {
            const userData = (await authRes.json()) as any;
            userId = userData.id || userId;
            role = userData.user_metadata?.role || userData.app_metadata?.role || role;

            // Load verified hospital membership role per Phase 1 RBAC architecture
            try {
              const membershipRes = await fetch(
                `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/hospital_memberships?user_id=eq.${userId}&status=eq.active&select=role,hospital_id`,
                {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'apikey': anonKey,
                  },
                }
              );
              if (membershipRes.ok) {
                const memberships = (await membershipRes.json()) as any[];
                if (Array.isArray(memberships) && memberships.length > 0) {
                  role = memberships[0].role || role;
                  if (memberships[0].hospital_id) {
                    hospitalId = memberships[0].hospital_id;
                  }
                }
              }
            } catch {
              // Non-blocking membership check
            }
          }
        } catch {
          // Fall through to role header check
        }
      }
    }

    // Rate limit: 30 clinical AI requests per minute per client IP / user
    const clientIp = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'client-unknown';
    const rateLimitKey = `ai_${userId !== 'anonymous' ? userId : clientIp}`;
    const rateCheck = checkRateLimit(rateLimitKey, 30, 60000);
    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', String(rateCheck.retryAfterSeconds || 60));
      return res.status(429).json({
        success: false,
        code: 'AI_RATE_LIMIT_EXCEEDED',
        error: 'Too many clinical AI requests. Please slow down and try again shortly.',
        correlationId,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      });
    }

    const isDemo =
      process.env?.NODE_ENV !== 'production' &&
      (process.env?.HEALTHCONNECT_DEMO_MODE === 'true' || process.env?.VITE_DEMO_MODE === 'true');

    // In production mode, authentication is strictly required and client headers are never trusted
    if (!isDemo) {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          code: 'AI_AUTH_ERROR',
          error: 'Authentication required. A valid Supabase authorization token must be provided.',
          correlationId,
        });
      }
      if (role === 'unauthenticated' || userId === 'anonymous') {
        return res.status(401).json({
          success: false,
          code: 'AI_AUTH_ERROR',
          error: 'Invalid or expired authentication session.',
          correlationId,
        });
      }
    } else {
      // Allow role header for demo session / local evaluation
      if (roleHeader && (role === 'unauthenticated' || role === 'doctor' || role === 'attender' || role === 'admin')) {
        const cleanRole = String(roleHeader).toLowerCase().trim();
        if (['doctor', 'attender', 'admin'].includes(cleanRole)) {
          role = cleanRole;
        }
      }

      // Default to doctor in demo mode if unauthenticated
      if (role === 'unauthenticated') {
        role = action === 'CLINICAL_SUMMARY' ? 'doctor' : 'attender';
      }
      if (!hospitalId) {
        hospitalId = '00000000-0000-4000-8000-000000000001';
      }
    }

    const model = (process.env?.OMNIROUTE_MODEL || process.env?.VITE_OMNIROUTE_MODEL || 'antigravity/gemini-3-flash').trim();

    // Role-based authorization gate
    if (action === 'CLINICAL_SUMMARY' && role !== 'doctor' && role !== 'admin') {
      console.warn(`[AI SECURITY] Blocked unauthorized clinical summary attempt by role=${role}`);
      await recordAiAudit({
        hospitalId,
        actorId: userId,
        eventType: 'ai.access_denied',
        resourceType: 'patient',
        resourceId: patient?.id || null,
        outcome: 'denied',
        details: {
          correlation_id: correlationId,
          action,
          role,
          latency_ms: Date.now() - startTime,
          model,
          fallback_used: false,
          error_category: 'AI_AUTH_ERROR',
          reason: 'Clinical summaries require physician or clinical administrator authorization',
        },
      });

      return res.status(403).json({
        success: false,
        code: 'AI_AUTH_ERROR',
        error: 'Clinical summaries require physician or clinical administrator authorization.',
        correlationId,
      });
    }

    // --- 2. Server-Side Patient Sanitization ---
    sanitized = sanitizeServerPatientData(patient);
    // --- 2b. Patient Access Authorization & ID Validation ---
    const patientId = sanitized.id;

    // Cross-Hospital Tenant Isolation Gate: Patient must belong to the caller's hospital tenant
    if (hospitalId && patient?.hospitalId && patient.hospitalId !== hospitalId) {
      console.warn(`[AI SECURITY] Cross-hospital tenant mismatch: hospital=${hospitalId} patient=${patient.hospitalId}`);
      await recordAiAudit({
        hospitalId,
        actorId: userId,
        eventType: 'ai.access_denied',
        resourceType: 'patient',
        resourceId: patientId,
        outcome: 'denied',
        details: {
          correlation_id: correlationId,
          action,
          role,
          latency_ms: Date.now() - startTime,
          model,
          fallback_used: false,
          error_category: 'AI_AUTH_ERROR',
          reason: 'Cross-hospital access violation: patient belongs to a different hospital tenant',
        },
      });

      return res.status(403).json({
        success: false,
        code: 'AI_AUTH_ERROR',
        error: 'Access denied: Cross-hospital access violation.',
        correlationId,
      });
    }
    const requestedPatientId = req.headers?.['x-careconnect-patient-id'];
    if (requestedPatientId && requestedPatientId !== 'pat-unknown' && requestedPatientId !== patientId) {
      console.warn(`[AI SECURITY] Patient ID mismatch in request: header=${requestedPatientId} body=${patientId}`);
      await recordAiAudit({
        hospitalId,
        actorId: userId,
        eventType: 'ai.access_denied',
        resourceType: 'patient',
        resourceId: patientId,
        outcome: 'denied',
        details: {
          correlation_id: correlationId,
          action,
          role,
          latency_ms: Date.now() - startTime,
          model,
          fallback_used: false,
          error_category: 'AI_AUTH_ERROR',
          reason: 'Patient identifier mismatch between header and payload',
        },
      });

      return res.status(403).json({
        success: false,
        code: 'AI_AUTH_ERROR',
        error: 'Security alert: Patient identifier mismatch between header and clinical payload.',
        correlationId,
      });
    }

    const assignedDoctorHeader = req.headers?.['x-careconnect-assigned-doctor'];
    const assignedAttenderHeader = req.headers?.['x-careconnect-assigned-attender'];

    // Scoping check for Doctor
    if (role === 'doctor' && assignedDoctorHeader && patient?.assignedDoctorId) {
      if (patient.assignedDoctorId !== assignedDoctorHeader) {
        console.warn(`[AI SECURITY] Doctor ${assignedDoctorHeader} denied clinical summary for unassigned patient ${patientId}`);
        await recordAiAudit({
          hospitalId,
          actorId: userId,
          eventType: 'ai.access_denied',
          resourceType: 'patient',
          resourceId: patientId,
          outcome: 'denied',
          details: {
            correlation_id: correlationId,
            action,
            role,
            latency_ms: Date.now() - startTime,
            model,
            fallback_used: false,
            error_category: 'AI_AUTH_ERROR',
            reason: 'Clinician is not assigned to this patient',
          },
        });

        return res.status(403).json({
          success: false,
          code: 'AI_AUTH_ERROR',
          error: 'Access denied: Clinician is not assigned to this patient.',
          correlationId,
        });
      }
    }

    // Scoping check for Attender
    if (role === 'attender' && assignedAttenderHeader && patient?.assignedAttenderId) {
      if (patient.assignedAttenderId !== assignedAttenderHeader) {
        console.warn(`[AI SECURITY] Attender ${assignedAttenderHeader} denied access for unpaired patient ${patientId}`);
        await recordAiAudit({
          hospitalId,
          actorId: userId,
          eventType: 'ai.access_denied',
          resourceType: 'patient',
          resourceId: patientId,
          outcome: 'denied',
          details: {
            correlation_id: correlationId,
            action,
            role,
            latency_ms: Date.now() - startTime,
            model,
            fallback_used: false,
            error_category: 'AI_AUTH_ERROR',
            reason: 'Attender is not paired with this patient',
          },
        });

        return res.status(403).json({
          success: false,
          code: 'AI_AUTH_ERROR',
          error: 'Access denied: Attender is not paired with this patient.',
          correlationId,
        });
      }
    }

    // --- 3. OmniRoute Server Gateway Dispatch ---
    const baseUrl = (process.env?.OMNIROUTE_BASE_URL || process.env?.VITE_OMNIROUTE_BASE_URL || 'http://localhost:20128/v1').replace(/\/+$/, '');
    const apiKey = (process.env?.OMNIROUTE_API_KEY || process.env?.VITE_OMNIROUTE_API_KEY || '').trim();

    // If OmniRoute API key is not configured, silently fall back to local rule-based synthesizer
    if (!apiKey) {
      console.log(`[AI GATEWAY] No OmniRoute API key on server — using local fallback (${action})`);
      const fallbackResult = action === 'CLINICAL_SUMMARY'
        ? generateLocalFallbackSummary(sanitized)
        : `I could not locate that specific query. Please consult the duty nurse or attending physician for clinical assistance.`;

      await recordAiAudit({
        hospitalId,
        actorId: userId,
        eventType: 'ai.fallback_used',
        resourceType: 'patient',
        resourceId: sanitized.id,
        outcome: 'success',
        details: {
          correlation_id: correlationId,
          action,
          role,
          latency_ms: Date.now() - startTime,
          model: 'local-fallback',
          fallback_used: true,
          error_category: null,
          reason: 'No OmniRoute API key configured on server',
        },
      });

      return res.status(200).json({
        success: true,
        result: fallbackResult,
        fallback: true,
        code: 'AI_UNAVAILABLE',
        correlationId,
      });
    }

    // Construct prompts with strict non-diagnostic and medical safety boundaries
    let messages: Array<{ role: string; content: string }> = [];
    let responseFormat: any = undefined;

    if (action === 'CLINICAL_SUMMARY') {
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
Name: ${sanitized.name} | MRN: ${sanitized.mrn}
Age: ${sanitized.age} | Gender: ${sanitized.gender} | Blood: ${sanitized.bloodGroup}
Location: ${sanitized.department} (${sanitized.room}, Bed ${sanitized.bed})
Primary Condition: ${sanitized.primaryCondition}
Current Diagnosis: ${sanitized.currentDiagnosis || 'N/A'}
Admission Date: ${sanitized.admissionDate}
Attending Doctor: ${sanitized.assignedDoctorName}
Allergies: ${sanitized.allergies.join(', ') || 'None documented'}
Latest Vitals: BP ${sanitized.latestVitals.systolicBP}/${sanitized.latestVitals.diastolicBP} mmHg (${sanitized.latestVitals.bpStatus}), Pulse ${sanitized.latestVitals.pulse} bpm (${sanitized.latestVitals.pulseStatus}), SpO2 ${sanitized.latestVitals.spO2}% (${sanitized.latestVitals.spO2Status}), Temp ${sanitized.latestVitals.temperatureF} (${sanitized.latestVitals.tempStatus})
Active Medications: ${JSON.stringify(sanitized.medications)}
Recent Alerts: ${JSON.stringify(sanitized.alerts)}
Recent Timeline: ${JSON.stringify(sanitized.recentTimeline)}`;

      messages = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ];
      responseFormat = { type: 'json_object' };
    } else {
      // CAREGIVER_ASSISTANT
      const systemInstruction = `You are CareAI, an empathetic, supportive, and safe clinical hospital assistant for the CareConnect healthcare system.
CRITICAL SAFETY BOUNDARIES:
1. You must NOT prescribe medications, recommend changing doses, or provide definitive medical diagnoses.
2. Direct patients and attenders to their attending doctor or nursing team for any clinical decisions.
3. If the user mentions acute symptoms (e.g. severe pain, difficulty breathing, chest tightness, falling), urgently advise them to use the Nurse Call button or seek immediate on-duty medical help.
4. Keep answers concise, clear, comforting, and direct (max 2-3 short paragraphs).
5. Respond in language: ${language || 'en'}.
6. Do not fabricate hospital records or clinical data.`;

      const contextPrompt = `Patient Bedside Context (Sanitized):
- Room: ${sanitized.room}, Bed: ${sanitized.bed}
- Ward / Dept: ${sanitized.department}
- Condition: ${sanitized.primaryCondition}
- Attending Doctor: ${sanitized.assignedDoctorName}
- Telemetry: BP ${sanitized.latestVitals.systolicBP}/${sanitized.latestVitals.diastolicBP} mmHg, Pulse ${sanitized.latestVitals.pulse} bpm, SpO2 ${sanitized.latestVitals.spO2}%, Temp ${sanitized.latestVitals.temperatureF}`;

      messages = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: `${contextPrompt}\n\nUser Question: ${rawQuery || 'General Guidance'}` },
      ];
    }

    const controller = new AbortController();
    const timeoutMs = 15000;
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const endpoint = `${baseUrl}/chat/completions`;
      const omniRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: responseFormat,
          temperature: action === 'CLINICAL_SUMMARY' ? 0.2 : 0.3,
          max_tokens: action === 'CLINICAL_SUMMARY' ? 1500 : 500,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutTimer);

      if (!omniRes.ok) {
        console.warn(`[AI GATEWAY] OmniRoute returned HTTP ${omniRes.status} — using fallback`);
        const fallbackResult = action === 'CLINICAL_SUMMARY'
          ? generateLocalFallbackSummary(sanitized)
          : `I could not locate that specific query. Please consult the duty nurse or attending physician for clinical assistance.`;

        await recordAiAudit({
          hospitalId,
          actorId: userId,
          eventType: 'ai.provider_error',
          resourceType: 'patient',
          resourceId: sanitized.id,
          outcome: 'failure',
          details: {
            correlation_id: correlationId,
            action,
            role,
            latency_ms: Date.now() - startTime,
            model,
            fallback_used: true,
            error_category: 'AI_PROVIDER_ERROR',
            http_status: omniRes.status,
          },
        });

        await recordAiAudit({
          hospitalId,
          actorId: userId,
          eventType: 'ai.fallback_used',
          resourceType: 'patient',
          resourceId: sanitized.id,
          outcome: 'success',
          details: {
            correlation_id: correlationId,
            action,
            role,
            latency_ms: Date.now() - startTime,
            model: 'local-fallback',
            fallback_used: true,
            error_category: null,
          },
        });

        return res.status(200).json({
          success: true,
          result: fallbackResult,
          fallback: true,
          code: 'AI_PROVIDER_ERROR',
          correlationId,
        });
      }

      const omniJson = (await omniRes.json()) as any;
      const content = omniJson.choices?.[0]?.message?.content;

      if (!content || typeof content !== 'string') {
        console.warn('[AI GATEWAY] Empty response content from OmniRoute — using fallback');
        const fallbackResult = action === 'CLINICAL_SUMMARY'
          ? generateLocalFallbackSummary(sanitized)
          : `I could not locate that specific query. Please consult the duty nurse or attending physician for clinical assistance.`;

        await recordAiAudit({
          hospitalId,
          actorId: userId,
          eventType: 'ai.validation_error',
          resourceType: 'patient',
          resourceId: sanitized.id,
          outcome: 'failure',
          details: {
            correlation_id: correlationId,
            action,
            role,
            latency_ms: Date.now() - startTime,
            model,
            fallback_used: true,
            error_category: 'AI_INVALID_RESPONSE',
            reason: 'Empty response content from upstream provider',
          },
        });

        await recordAiAudit({
          hospitalId,
          actorId: userId,
          eventType: 'ai.fallback_used',
          resourceType: 'patient',
          resourceId: sanitized.id,
          outcome: 'success',
          details: {
            correlation_id: correlationId,
            action,
            role,
            latency_ms: Date.now() - startTime,
            model: 'local-fallback',
            fallback_used: true,
            error_category: null,
          },
        });

        return res.status(200).json({
          success: true,
          result: fallbackResult,
          fallback: true,
          code: 'AI_INVALID_RESPONSE',
          correlationId,
        });
      }

      if (action === 'CLINICAL_SUMMARY') {
        let parsed: any;
        try {
          const clean = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
          parsed = JSON.parse(clean);
        } catch {
          console.warn('[AI GATEWAY] Failed to parse model JSON — using fallback');
          await recordAiAudit({
            hospitalId,
            actorId: userId,
            eventType: 'ai.validation_error',
            resourceType: 'patient',
            resourceId: sanitized.id,
            outcome: 'failure',
            details: {
              correlation_id: correlationId,
              action,
              role,
              latency_ms: Date.now() - startTime,
              model,
              fallback_used: true,
              error_category: 'AI_INVALID_RESPONSE',
              reason: 'Model output failed JSON parsing',
            },
          });

          await recordAiAudit({
            hospitalId,
            actorId: userId,
            eventType: 'ai.fallback_used',
            resourceType: 'patient',
            resourceId: sanitized.id,
            outcome: 'success',
            details: {
              correlation_id: correlationId,
              action,
              role,
              latency_ms: Date.now() - startTime,
              model: 'local-fallback',
              fallback_used: true,
              error_category: null,
            },
          });

          return res.status(200).json({
            success: true,
            result: generateLocalFallbackSummary(sanitized),
            fallback: true,
            code: 'AI_INVALID_RESPONSE',
            correlationId,
          });
        }

        const v = sanitized.latestVitals;
        const verifiedResult = {
          patientOverview: parsed.patientOverview || `${sanitized.name} (${sanitized.age}y ${sanitized.gender}) admitted to ${sanitized.room}.`,
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
            : sanitized.medications.map((m) => `• ${m.name} ${m.dosage} (${m.frequency}) - Status: ${m.status}`),
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

        const duration = Date.now() - startTime;
        await recordAiAudit({
          hospitalId,
          actorId: userId,
          eventType: 'ai.clinical_summary',
          resourceType: 'patient',
          resourceId: sanitized.id,
          outcome: 'success',
          details: {
            correlation_id: correlationId,
            action,
            role,
            latency_ms: duration,
            model,
            fallback_used: false,
            error_category: null,
          },
        });

        return res.status(200).json({
          success: true,
          result: verifiedResult,
          fallback: false,
          correlationId,
        });
      } else {
        // CAREGIVER_ASSISTANT
        const duration = Date.now() - startTime;
        await recordAiAudit({
          hospitalId,
          actorId: userId,
          eventType: 'ai.caregiver_assistant',
          resourceType: 'patient',
          resourceId: sanitized.id,
          outcome: 'success',
          details: {
            correlation_id: correlationId,
            action,
            role,
            latency_ms: duration,
            model,
            fallback_used: false,
            error_category: null,
            language: language || 'en',
            query_length: rawQuery ? rawQuery.length : 0,
          },
        });

        return res.status(200).json({
          success: true,
          result: content.trim(),
          fallback: false,
          correlationId,
        });
      }
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      const isTimeout = err?.name === 'AbortError';
      console.warn(`[AI GATEWAY] ${isTimeout ? 'Request timed out' : 'Fetch/network error'} — using fallback`);
      const fallbackResult = action === 'CLINICAL_SUMMARY'
        ? generateLocalFallbackSummary(sanitized)
        : `I could not locate that specific query. Please consult the duty nurse or attending physician for clinical assistance.`;

      await recordAiAudit({
        hospitalId,
        actorId: userId,
        eventType: 'ai.provider_error',
        resourceType: 'patient',
        resourceId: sanitized.id,
        outcome: 'failure',
        details: {
          correlation_id: correlationId,
          action,
          role,
          latency_ms: Date.now() - startTime,
          model,
          fallback_used: true,
          error_category: isTimeout ? 'AI_TIMEOUT' : 'AI_NETWORK_ERROR',
        },
      });

      await recordAiAudit({
        hospitalId,
        actorId: userId,
        eventType: 'ai.fallback_used',
        resourceType: 'patient',
        resourceId: sanitized.id,
        outcome: 'success',
        details: {
          correlation_id: correlationId,
          action,
          role,
          latency_ms: Date.now() - startTime,
          model: 'local-fallback',
          fallback_used: true,
          error_category: null,
        },
      });

      return res.status(200).json({
        success: true,
        result: fallbackResult,
        fallback: true,
        code: isTimeout ? 'AI_TIMEOUT' : 'AI_NETWORK_ERROR',
        correlationId,
      });
    }
  } catch (err: any) {
    console.error('[AI GATEWAY] Unexpected error:', err?.message || err);
    await recordAiAudit({
      hospitalId,
      actorId: userId,
      eventType: 'ai.server_error',
      resourceType: 'patient',
      resourceId: sanitized?.id || null,
      outcome: 'failure',
      details: {
        correlation_id: correlationId,
        action: action || 'UNKNOWN',
        role: role || 'unknown',
        latency_ms: Date.now() - startTime,
        fallback_used: false,
        error_category: 'AI_SERVER_ERROR',
        error_message: String(err?.message || err).slice(0, 200),
      },
    });

    return res.status(500).json({
      success: false,
      code: 'AI_PROVIDER_ERROR',
      error: 'An internal server error occurred while processing the clinical AI request.',
      correlationId,
    });
  }
}
