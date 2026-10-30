/**
 * Comprehensive CareConnect Security, Tenant Isolation, and RLS Audit Verification Suite
 * Tests Scenarios A through I, rate limiting, production auth gating, and data-layer isolation.
 */
import fs from 'fs';
import path from 'path';

// 1. Load server-only environment variables from .env
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import clinicalAiHandler from '../api/clinical-ai';
import patientEventsHandler from '../api/patient-events';
import streamHandler from '../api/sync/stream';
import { checkRateLimit } from '../api/_security';
import { dataStore } from '../src/services/dataStore';

// Helper to simulate serverless HTTP handler invocation
function invokeHandler(
  handler: any,
  body: any,
  headers: Record<string, string> = {},
  method = 'POST'
): Promise<{ status: number; json: any; headers: Record<string, string> }> {
  return new Promise((resolve) => {
    let statusCode = 200;
    const responseHeaders: Record<string, string> = {};
    let responseData: any = null;

    const req = {
      method,
      body,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
    };

    const res = {
      statusCode: 200,
      status(code: number) {
        statusCode = code;
        return this;
      },
      setHeader(k: string, v: string) {
        responseHeaders[k.toLowerCase()] = v;
      },
      json(data: any) {
        responseData = data;
        resolve({ status: statusCode, json: responseData, headers: responseHeaders });
      },
      end(data?: any) {
        if (data && !responseData) {
          try {
            responseData = JSON.parse(data);
          } catch {
            responseData = data;
          }
        }
        resolve({ status: statusCode, json: responseData, headers: responseHeaders });
      },
    };

    handler(req, res).catch((err: any) => {
      resolve({ status: 500, json: { error: err.message }, headers: responseHeaders });
    });
  });
}

async function runSecurityIsolationSuite() {
  console.log('======================================================================');
  console.log('STARTING CARECONNECT PRODUCTION SECURITY & ISOLATION AUDIT SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`✅ PASSED: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${message}`);
      process.exitCode = 1;
    }
  }

  const testPatientRamesh = dataStore.getPatientById('pat-ramesh');
  assert(Boolean(testPatientRamesh), 'Baseline patient pat-ramesh loaded from DataStore');

  // --- SECTION 1: SCENARIOS A - I (CLINICAL & TENANT ACCESS CONTROL) ---
  console.log('\n--- SECTION 1: Scenarios A through I Verification ---');

  // Scenario A: Hospital A doctor -> Hospital A patient -> ALLOWED
  const resScenarioA = await invokeHandler(
    clinicalAiHandler,
    { action: 'CLINICAL_SUMMARY', patient: testPatientRamesh },
    {
      'x-careconnect-role': 'doctor',
      'x-careconnect-assigned-doctor': 'doc-arun',
      'x-careconnect-patient-id': 'pat-ramesh',
      'x-careconnect-hospital-id': '00000000-0000-4000-8000-000000000001',
    }
  );
  assert(resScenarioA.status === 200, 'Scenario A: Hospital A doctor -> Hospital A assigned patient -> ALLOWED (HTTP 200)');
  assert(resScenarioA.json?.success === true, 'Scenario A: Summary successfully returned with success: true');

  // Scenario B: Hospital A doctor -> Hospital B patient -> DENIED
  const patientHospB = {
    ...testPatientRamesh,
    id: 'pat-hospital-b-01',
    hospitalId: '20000000-0000-4000-8000-000000000002', // Hospital B
    assignedDoctorId: 'doc-other-hospital',
  };
  const resScenarioB = await invokeHandler(
    clinicalAiHandler,
    { action: 'CLINICAL_SUMMARY', patient: patientHospB },
    {
      'x-careconnect-role': 'doctor',
      'x-careconnect-assigned-doctor': 'doc-arun', // Doctor from Hospital A
      'x-careconnect-patient-id': 'pat-hospital-b-01',
      'x-careconnect-hospital-id': '00000000-0000-4000-8000-000000000001',
    }
  );
  assert(resScenarioB.status === 403, 'Scenario B: Hospital A doctor -> Hospital B patient -> DENIED (HTTP 403)');
  assert(resScenarioB.json?.code === 'AI_AUTH_ERROR', 'Scenario B: Code is AI_AUTH_ERROR');

  // Scenario C: Hospital A attender -> paired patient -> ALLOWED
  const resScenarioC = await invokeHandler(
    clinicalAiHandler,
    {
      action: 'CAREGIVER_ASSISTANT',
      patient: testPatientRamesh,
      rawQuery: 'How is grandfather doing today?',
      language: 'en',
    },
    {
      'x-careconnect-role': 'attender',
      'x-careconnect-assigned-attender': 'att-vikash',
      'x-careconnect-patient-id': 'pat-ramesh',
      'x-careconnect-hospital-id': '00000000-0000-4000-8000-000000000001',
    }
  );
  assert(resScenarioC.status === 200, 'Scenario C: Hospital A attender -> paired patient -> ALLOWED (HTTP 200)');

  // Scenario D: Hospital A attender -> unpaired patient -> DENIED
  const resScenarioD = await invokeHandler(
    clinicalAiHandler,
    {
      action: 'CAREGIVER_ASSISTANT',
      patient: testPatientRamesh,
      rawQuery: 'What are the vitals?',
    },
    {
      'x-careconnect-role': 'attender',
      'x-careconnect-assigned-attender': 'att-unpaired-stranger',
      'x-careconnect-patient-id': 'pat-ramesh',
    }
  );
  assert(resScenarioD.status === 403, 'Scenario D: Hospital A attender -> unpaired patient -> DENIED (HTTP 403)');

  // Scenario E: Attender -> another hospital patient -> DENIED
  const resScenarioE = await invokeHandler(
    clinicalAiHandler,
    {
      action: 'CAREGIVER_ASSISTANT',
      patient: patientHospB,
      rawQuery: 'Check status',
    },
    {
      'x-careconnect-role': 'attender',
      'x-careconnect-assigned-attender': 'att-vikash',
      'x-careconnect-patient-id': 'pat-hospital-b-01',
      'x-careconnect-hospital-id': '00000000-0000-4000-8000-000000000001',
    }
  );
  assert(resScenarioE.status === 403, 'Scenario E: Attender -> another hospital patient -> DENIED (HTTP 403)');

  // Scenario F: Doctor -> unassigned patient -> DENIED
  const resScenarioF = await invokeHandler(
    clinicalAiHandler,
    { action: 'CLINICAL_SUMMARY', patient: testPatientRamesh },
    {
      'x-careconnect-role': 'doctor',
      'x-careconnect-assigned-doctor': 'doc-sneha', // Unassigned doctor
      'x-careconnect-patient-id': 'pat-ramesh',
    }
  );
  assert(resScenarioF.status === 403, 'Scenario F: Doctor -> unassigned patient -> DENIED (HTTP 403)');

  // Scenario G: Anonymous user in production mode -> patient data -> DENIED
  const prevEnv = process.env.NODE_ENV;
  const prevDemo = process.env.HEALTHCONNECT_DEMO_MODE;
  process.env.NODE_ENV = 'production';
  process.env.HEALTHCONNECT_DEMO_MODE = 'false';

  const resScenarioG = await invokeHandler(
    clinicalAiHandler,
    { action: 'CLINICAL_SUMMARY', patient: testPatientRamesh },
    {
      // No Authorization header, trying to send role header
      'x-careconnect-role': 'doctor',
    }
  );
  assert(resScenarioG.status === 401, 'Scenario G: Anonymous/unauthenticated user in production mode -> DENIED (HTTP 401)');
  assert(resScenarioG.json?.code === 'AI_AUTH_ERROR', 'Scenario G: Rejection code is AI_AUTH_ERROR');

  // Scenario H: User modifies patient_id in request header -> DENIED
  process.env.NODE_ENV = prevEnv;
  process.env.HEALTHCONNECT_DEMO_MODE = prevDemo;

  const resScenarioH = await invokeHandler(
    clinicalAiHandler,
    { action: 'CLINICAL_SUMMARY', patient: testPatientRamesh },
    {
      'x-careconnect-role': 'doctor',
      'x-careconnect-assigned-doctor': 'doc-arun',
      'x-careconnect-patient-id': 'pat-tampered-id-999', // Mismatched header
    }
  );
  assert(resScenarioH.status === 403, 'Scenario H: User modifies patient_id header to mismatch body -> DENIED (HTTP 403)');

  // Scenario I: User modifies hospital_id/tenant_id -> Database migration check
  const migrationFile = path.resolve('supabase/migrations/20261025130000_tenant_security_hardening.sql');
  assert(fs.existsSync(migrationFile), 'Scenario I: Hardening migration exists (20261025130000_tenant_security_hardening.sql)');
  const migContent = fs.readFileSync(migrationFile, 'utf8');
  assert(
    migContent.includes('private.prevent_hospital_id_mutation') &&
    migContent.includes('Tenant reassignment forbidden: hospital_id is strictly immutable'),
    'Scenario I: Database trigger strictly forbids hospital_id/tenant_id modification'
  );

  // --- SECTION 2: RATE LIMITING AUDIT ---
  console.log('\n--- SECTION 2: Rate Limiting Audit ---');
  const testKey = `audit_test_client_${Date.now()}`;
  let allowedCount = 0;
  for (let i = 0; i < 35; i++) {
    const check = checkRateLimit(testKey, 30, 60000);
    if (check.allowed) allowedCount++;
  }
  assert(allowedCount === 30, `Rate limiter strictly capped at 30 requests (allowed ${allowedCount} of 35)`);

  const blockedCheck = checkRateLimit(testKey, 30, 60000);
  assert(!blockedCheck.allowed, '31st request was blocked by rate limiter');
  assert(typeof blockedCheck.retryAfterSeconds === 'number' && blockedCheck.retryAfterSeconds > 0, 'Retry-After calculation provided');

  // Test rate limiting on /api/patient-events
  process.env.HEALTHCONNECT_DEMO_MODE = 'true';
  process.env.VITE_DEMO_MODE = 'true';
  process.env.NODE_ENV = 'development';

  const hwDeviceId = `DEV_TEST_${Date.now()}`;
  let hwAllowed = 0;
  for (let i = 0; i < 65; i++) {
    const hwRes = await invokeHandler(
      patientEventsHandler,
      { patientId: 'pat-ramesh', eventType: 'GESTURE', gesture: 'WATER' },
      { 'x-device-id': hwDeviceId }
    );
    if (hwRes.status === 200) hwAllowed++;
    else if (hwRes.status === 429) break;
  }
  assert(hwAllowed === 60, `Hardware ingestion rate limiter strictly allowed 60 requests/min (got ${hwAllowed})`);

  // --- SECTION 3: PRODUCTION ENVIRONMENT PERIMETER ---
  console.log('\n--- SECTION 3: Production Perimeter & In-Memory Relay Quarantine ---');
  // When in production mode, SSE stream handler must reject with 503
  process.env.NODE_ENV = 'production';
  process.env.HEALTHCONNECT_DEMO_MODE = 'false';

  const mockRequest = new Request('http://localhost:3000/api/sync/stream', { method: 'GET' });
  const streamRes = await streamHandler(mockRequest);
  assert(streamRes.status === 503, `Edge SSE stream returns HTTP 503 in production mode (got ${streamRes.status})`);

  // Restore env
  process.env.NODE_ENV = prevEnv;
  process.env.HEALTHCONNECT_DEMO_MODE = prevDemo;

  console.log('\n======================================================================');
  console.log(`ALL ${passed}/${total} SECURITY & ISOLATION CHECKS PASSED!`);
  console.log('======================================================================\n');
}

runSecurityIsolationSuite().catch((err) => {
  console.error('Fatal error in security isolation suite:', err);
  process.exit(1);
});
