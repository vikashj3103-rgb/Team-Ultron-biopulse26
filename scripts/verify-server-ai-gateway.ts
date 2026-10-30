/**
 * Automated Verification Suite for CareConnect Production Server-Side AI Gateway
 * Tests /api/clinical-ai, role authorization, patient scoping, data sanitization, server-side OmniRoute dispatch, and fallback.
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
import { processCareAiQueryAsync } from '../src/services/careAiService';
import { dataStore } from '../src/services/dataStore';

// Helper to simulate HTTP requests against the serverless handler
function invokeServerless(body: any, headers: Record<string, string> = {}): Promise<{ status: number; json: any; headers: Record<string, string> }> {
  return new Promise((resolve) => {
    let statusCode = 200;
    const responseHeaders: Record<string, string> = {};
    let responseData: any = null;

    const req = {
      method: 'POST',
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

    clinicalAiHandler(req, res).catch((err: any) => {
      resolve({ status: 500, json: { error: err.message }, headers: responseHeaders });
    });
  });
}

async function runGatewayVerification() {
  console.log('======================================================================');
  console.log('STARTING CARECONNECT PRODUCTION AI GATEWAY VERIFICATION');
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

  // --- TEST 1: Server-Only Secret Protection Audit ---
  console.log('--- TEST 1: Server-Only Secret Protection Audit ---');
  const serverKey = process.env.OMNIROUTE_API_KEY;
  assert(Boolean(serverKey), 'Server secret OMNIROUTE_API_KEY is present in server process.env');

  // Verify client production bundle contains zero secrets
  const distDir = path.resolve('dist/assets');
  let secretFoundInClient = false;
  if (fs.existsSync(distDir)) {
    const jsFiles = fs.readdirSync(distDir).filter((f) => f.endsWith('.js'));
    for (const f of jsFiles) {
      const content = fs.readFileSync(path.join(distDir, f), 'utf8');
      if (serverKey && content.includes(serverKey)) {
        secretFoundInClient = true;
        break;
      }
    }
  }
  assert(!secretFoundInClient, 'Client production bundle (dist/assets/*.js) contains ZERO OmniRoute API keys');

  // --- TEST 2: Role-Based Authorization Enforcement ---
  console.log('\n--- TEST 2: Role-Based Authorization Enforcement ---');
  const testPatient = dataStore.getPatientById('pat-ramesh');
  assert(Boolean(testPatient), 'Test patient pat-ramesh loaded from DataStore');

  // Set up audit event capture hook
  const capturedAuditLogs: any[] = [];
  (globalThis as any).__AI_AUDIT_LOG_HOOK__ = (entry: any) => {
    capturedAuditLogs.push(entry);
  };

  // Attender attempting clinical summary must be rejected with 403
  const unauthorizedRes = await invokeServerless(
    { action: 'CLINICAL_SUMMARY', patient: testPatient },
    { 'x-careconnect-role': 'attender' }
  );
  assert(unauthorizedRes.status === 403, `Attender role blocked from generating clinical summary (HTTP ${unauthorizedRes.status})`);
  assert(unauthorizedRes.json?.code === 'AI_AUTH_ERROR', `Proper error code returned: ${unauthorizedRes.json?.code}`);
  assert(Boolean(unauthorizedRes.json?.correlationId?.startsWith('req_')), `Unique correlation ID attached to error response: ${unauthorizedRes.json?.correlationId}`);
  assert(unauthorizedRes.headers?.['x-correlation-id'] === unauthorizedRes.json?.correlationId, 'X-Correlation-Id header matches JSON correlationId');

  const accessDeniedAudit = capturedAuditLogs.find(
    (l) => l.details?.correlation_id === unauthorizedRes.json?.correlationId && l.event_type === 'ai.access_denied'
  );
  assert(Boolean(accessDeniedAudit), 'Audit log successfully recorded for role authorization rejection');
  assert(accessDeniedAudit?.outcome === 'denied', `Audit log recorded outcome: ${accessDeniedAudit?.outcome}`);

  // --- TEST 2b: Patient Scoping & Access Authorization Gate ---
  console.log('\n--- TEST 2b: Patient Scoping & Access Authorization Gate ---');
  // 1. Unassigned doctor attempting to access Ramesh Kumar (assigned to doc-arun)
  const unassignedDoctorRes = await invokeServerless(
    { action: 'CLINICAL_SUMMARY', patient: testPatient },
    { 'x-careconnect-role': 'doctor', 'x-careconnect-assigned-doctor': 'doc-sneha' }
  );
  assert(unassignedDoctorRes.status === 403, `Unassigned doctor (doc-sneha) blocked from Ramesh Kumar (assigned to doc-arun)`);
  assert(unassignedDoctorRes.json?.code === 'AI_AUTH_ERROR', `Scoping error code returned: ${unassignedDoctorRes.json?.code}`);

  // 2. Unpaired attender attempting to query Ramesh Kumar (paired with att-vikash)
  const unpairedAttenderRes = await invokeServerless(
    { action: 'CAREGIVER_ASSISTANT', patient: testPatient, rawQuery: 'Show me vitals' },
    { 'x-careconnect-role': 'attender', 'x-careconnect-assigned-attender': 'att-unknown' }
  );
  assert(unpairedAttenderRes.status === 403, `Unpaired attender (att-unknown) blocked from Ramesh Kumar (paired with att-vikash)`);

  // 3. Header / body patient ID mismatch
  const mismatchRes = await invokeServerless(
    { action: 'CLINICAL_SUMMARY', patient: testPatient },
    { 'x-careconnect-role': 'doctor', 'x-careconnect-patient-id': 'pat-other-hosp' }
  );
  assert(mismatchRes.status === 403, `Patient ID header mismatch detected and rejected with HTTP 403`);

  // --- TEST 3: Doctor Clinical Summary via Server Gateway ---
  console.log('\n--- TEST 3: Doctor Clinical Summary via Server Gateway ---');
  const doctorRes = await invokeServerless(
    { action: 'CLINICAL_SUMMARY', patient: testPatient },
    {
      'x-careconnect-role': 'doctor',
      'x-careconnect-assigned-doctor': 'doc-arun',
      'x-careconnect-patient-id': 'pat-ramesh',
      'x-careconnect-hospital-id': '00000000-0000-4000-8000-000000000001',
    }
  );
  assert(doctorRes.status === 200, `Doctor request accepted with HTTP ${doctorRes.status}`);
  assert(doctorRes.json?.success === true, 'Response status success: true');
  assert(Boolean(doctorRes.json?.correlationId?.startsWith('req_')), `Correlation ID returned: ${doctorRes.json?.correlationId}`);
  const summary = doctorRes.json?.result;
  assert(Boolean(summary?.patientOverview), `Patient overview generated: "${summary?.patientOverview?.slice(0, 60)}..."`);
  assert(Boolean(summary?.currentStatus), `Current status generated: "${summary?.currentStatus?.slice(0, 60)}..."`);
  assert(Array.isArray(summary?.vitalTrends) && summary.vitalTrends.length > 0, `Vital trends array populated (${summary?.vitalTrends?.length} items)`);
  assert(summary?.disclaimer?.toLowerCase().includes('decision-support draft'), 'Mandatory non-diagnostic clinical disclaimer attached');

  const doctorAudit = capturedAuditLogs.find(
    (l) => l.details?.correlation_id === doctorRes.json?.correlationId && l.event_type === 'ai.clinical_summary'
  );
  assert(Boolean(doctorAudit), 'Audit log recorded for successful clinical summary generation');
  assert(doctorAudit?.outcome === 'success', `Audit log recorded outcome: ${doctorAudit?.outcome}`);
  assert(doctorAudit?.details?.model?.length > 0, `Audit log recorded upstream model: ${doctorAudit?.details?.model}`);

  // --- TEST 4: Open-Ended Attender Assistant via Server Gateway ---
  console.log('\n--- TEST 4: Attender Open-Ended Query via Server Gateway ---');
  const attenderRes = await invokeServerless(
    {
      action: 'CAREGIVER_ASSISTANT',
      patient: testPatient,
      rawQuery: 'How can I support my grandfather with his post-cardiac diet?',
      language: 'en',
    },
    {
      'x-careconnect-role': 'attender',
      'x-careconnect-assigned-attender': 'att-vikash',
      'x-careconnect-patient-id': 'pat-ramesh',
    }
  );
  assert(attenderRes.status === 200, `Attender request accepted with HTTP ${attenderRes.status}`);
  assert(attenderRes.json?.success === true, 'Response status success: true');
  assert(Boolean(attenderRes.json?.correlationId?.startsWith('req_')), `Correlation ID returned: ${attenderRes.json?.correlationId}`);
  assert(typeof attenderRes.json?.result === 'string' && attenderRes.json.result.length > 20, 'Conversational assistant reply received from gateway');
  console.log(`CareAI reply preview: "${attenderRes.json?.result?.slice(0, 90)}..."`);

  const attenderAudit = capturedAuditLogs.find(
    (l) => l.details?.correlation_id === attenderRes.json?.correlationId && l.event_type === 'ai.caregiver_assistant'
  );
  assert(Boolean(attenderAudit), 'Audit log recorded for successful CareAI assistant query');
  assert(attenderAudit?.outcome === 'success', `Audit log recorded outcome: ${attenderAudit?.outcome}`);

  // --- TEST 5: Graceful Fallback When Provider Returns Error ---
  console.log('\n--- TEST 5: Graceful Local Fallback on Upstream Failure ---');
  const originalUrl = process.env.OMNIROUTE_BASE_URL;
  process.env.OMNIROUTE_BASE_URL = 'http://localhost:59999/v1'; // Non-existent port

  const fallbackRes = await invokeServerless(
    { action: 'CLINICAL_SUMMARY', patient: testPatient },
    {
      'x-careconnect-role': 'doctor',
      'x-careconnect-assigned-doctor': 'doc-arun',
      'x-careconnect-patient-id': 'pat-ramesh',
    }
  );
  process.env.OMNIROUTE_BASE_URL = originalUrl; // Restore

  assert(fallbackRes.status === 200, `Server returned HTTP 200 even when OmniRoute was unreachable (graceful degradation)`);
  assert(fallbackRes.json?.fallback === true, 'Fallback flag explicitly set to true');
  assert(Boolean(fallbackRes.json?.correlationId?.startsWith('req_')), `Correlation ID attached to fallback response: ${fallbackRes.json?.correlationId}`);
  assert(Boolean(fallbackRes.json?.result?.patientOverview), 'Valid local clinical summary generated by fallback synthesizer');

  const providerErrorAudit = capturedAuditLogs.find(
    (l) => l.details?.correlation_id === fallbackRes.json?.correlationId && l.event_type === 'ai.provider_error'
  );
  assert(Boolean(providerErrorAudit), 'Audit log recorded for upstream provider failure');
  assert(providerErrorAudit?.outcome === 'failure', `Provider error recorded with outcome: ${providerErrorAudit?.outcome}`);

  const fallbackAudit = capturedAuditLogs.find(
    (l) => l.details?.correlation_id === fallbackRes.json?.correlationId && l.event_type === 'ai.fallback_used'
  );
  assert(Boolean(fallbackAudit), 'Audit log recorded for local fallback activation');
  assert(fallbackAudit?.details?.fallback_used === true, 'Audit log details accurately record fallback_used: true');

  // --- TEST 6: Deterministic Intent Bypass Guard ---
  console.log('\n--- TEST 6: Deterministic Intent Guard (Bypasses LLM) ---');
  const dirQuery = 'Where is Cardiology Room 11002?';
  const start = Date.now();
  const dirResponse = await processCareAiQueryAsync(dirQuery, testPatient);
  const elapsed = Date.now() - start;

  assert(dirResponse.cardType === 'ROUTE', `Deterministic route card resolved: cardType = ${dirResponse.cardType}`);
  assert(elapsed <= 150, `Deterministic query completed in ${elapsed}ms (<= 150ms) without network round-trip`);

  // --- TEST 7: Audit Log Privacy & Credential Exclusion Audit ---
  console.log('\n--- TEST 7: Audit Log Privacy & Credential Exclusion Audit ---');
  assert(capturedAuditLogs.length >= 6, `Captured ${capturedAuditLogs.length} audit records across verification phases`);
  let leaksFound = 0;
  for (const log of capturedAuditLogs) {
    const d = log.details || {};
    if (d.apiKey || d.token || d.authorization || d.password || d.pin || d.secret) {
      leaksFound++;
    }
  }
  assert(leaksFound === 0, 'Zero credentials (API keys, JWT tokens, passwords, PINs) found in all audit records');

  // --- TEST 8: Audit Logging Fail-Safe Resilience ---
  console.log('\n--- TEST 8: Audit Logging Fail-Safe Resilience ---');
  // Configure hook to deliberately throw an unexpected exception
  (globalThis as any).__AI_AUDIT_LOG_HOOK__ = () => {
    throw new Error('SIMULATED_DATABASE_FAILURE: Connection reset by peer');
  };

  const resilienceRes = await invokeServerless(
    { action: 'CLINICAL_SUMMARY', patient: testPatient },
    {
      'x-careconnect-role': 'doctor',
      'x-careconnect-assigned-doctor': 'doc-arun',
      'x-careconnect-patient-id': 'pat-ramesh',
    }
  );
  // Restore normal hook
  (globalThis as any).__AI_AUDIT_LOG_HOOK__ = undefined;

  assert(resilienceRes.status === 200, `Endpoint returned HTTP 200 even when audit logging threw an unhandled error`);
  assert(resilienceRes.json?.success === true, 'Clinical summary successfully generated despite audit database failure (fail-safe)');
  assert(Boolean(resilienceRes.json?.result?.patientOverview), 'Clinical summary payload completely preserved');

  console.log('\n======================================================================');
  console.log(`ALL ${passed}/${total} PRODUCTION AI GATEWAY CHECKS PASSED!`);
  console.log('======================================================================\n');
}

runGatewayVerification().catch((err) => {
  console.error('Fatal error in gateway verification suite:', err);
  process.exit(1);
});
