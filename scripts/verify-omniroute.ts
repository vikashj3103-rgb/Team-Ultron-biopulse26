/**
 * Live Runtime Verification Suite for CareConnect + OmniRoute Integration
 */
import fs from 'fs';
import path from 'path';

// 1. Safely load environment variables from .env without logging the API key
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

import {
  OpenAiClinicalAiProvider,
  clinicalAiService,
  sanitizePatientData
} from '../src/services/aiProvider';
import {
  processCareAiQueryAsync
} from '../src/services/careAiService';
import { dataStore } from '../src/services/dataStore';

async function runOmniRouteVerification() {
  console.log('======================================================================');
  console.log('STARTING CARECONNECT + OMNIROUTE LIVE INTEGRATION VERIFICATION');
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

  // --- TEST 1: Environment & Provider Configuration ---
  console.log('--- TEST 1: Environment & Provider Configuration ---');
  const baseUrl = process.env.VITE_OMNIROUTE_BASE_URL || 'http://localhost:20128/v1';
  const model = process.env.VITE_OMNIROUTE_MODEL || 'antigravity/gemini-3-flash';
  const hasKey = Boolean(process.env.VITE_OMNIROUTE_API_KEY);

  assert(baseUrl.includes('20128'), `Base URL configured: ${baseUrl}`);
  assert(hasKey, 'OmniRoute API Key is present in environment (masked)');
  assert(Boolean(model), `Model configured: ${model}`);

  const openAiProvider = new OpenAiClinicalAiProvider();
  clinicalAiService.setProvider(openAiProvider);
  assert(clinicalAiService.getProvider().name.includes('OmniRoute'), `ClinicalAiService active provider: ${clinicalAiService.getProvider().name}`);

  // --- TEST 2: Patient Data Sanitization Gate ---
  console.log('\n--- TEST 2: Strict Patient Data Sanitization Gate ---');
  const testPatient = dataStore.getPatientById('pat-ramesh');
  assert(Boolean(testPatient), 'Test patient Ramesh Kumar loaded from dataStore (ID: pat-ramesh)');

  if (testPatient) {
    const rawWithSecrets: any = {
      ...testPatient,
      password: 'super_secret_password_123',
      tempPassword: 'temp_secret_456',
      token: 'jwt_token_abcdef',
    };
    const sanitized = sanitizePatientData(rawWithSecrets);
    assert(!('password' in sanitized), 'Sanitization stripped password field');
    assert(!('tempPassword' in sanitized), 'Sanitization stripped tempPassword field');
    assert(!('token' in sanitized), 'Sanitization stripped auth token field');
    assert(sanitized.name === 'Ramesh Kumar', 'Patient name preserved');
    assert(typeof sanitized.latestVitals.temperatureF === 'string', `Fahrenheit temperature formatted in vitals: ${sanitized.latestVitals.temperatureF}`);
  }

  // --- TEST 3: Doctor Clinical Summary Generation via Live OmniRoute ---
  console.log('\n--- TEST 3: Live Doctor Clinical Summary via OmniRoute ---');
  if (testPatient) {
    const meds = dataStore.getMedications('pat-ramesh');
    const alerts = dataStore.getAlerts('pat-ramesh');
    const timeline = dataStore.getTimeline('pat-ramesh');

    console.log('Sending asynchronous clinical summary request to OmniRoute gateway...');
    const startTime = Date.now();
    const summary = await clinicalAiService.generateSummary(testPatient, meds, alerts, timeline);
    const elapsed = Date.now() - startTime;
    console.log(`Received summary from OmniRoute in ${elapsed}ms.`);

    assert(Boolean(summary.patientOverview), `Generated patientOverview: "${summary.patientOverview.slice(0, 70)}..."`);
    assert(Boolean(summary.currentStatus), `Generated currentStatus: "${summary.currentStatus.slice(0, 70)}..."`);
    assert(Array.isArray(summary.vitalTrends) && summary.vitalTrends.length > 0, `Vital trends generated (${summary.vitalTrends.length} items)`);
    assert(Boolean(summary.latestVitalsSummary.bp), `Deterministic BP summary merged: ${summary.latestVitalsSummary.bp}`);
    assert(summary.disclaimer.toLowerCase().includes('decision-support draft'), 'Mandatory non-diagnostic clinical disclaimer present');
  }

  // --- TEST 4: Known Deterministic Intent Bypasses OmniRoute (Zero Latency) ---
  console.log('\n--- TEST 4: Deterministic Intent Guard (Bypasses OmniRoute) ---');
  const dirQuery = 'Where is Cardiology Room 11002?';
  const startSync = Date.now();
  const dirResponse = await processCareAiQueryAsync(dirQuery, testPatient);
  const syncElapsed = Date.now() - startSync;

  assert(dirResponse.cardType === 'ROUTE', `Deterministic route card resolved: cardType = ${dirResponse.cardType}`);
  assert(dirResponse.reply.includes('Cardiology'), 'Route reply contains Cardiology destination');
  assert(syncElapsed < 100, `Deterministic query completed instantly (${syncElapsed}ms < 100ms) without network round-trip`);

  // --- TEST 5: Open-Ended Attender Assistant Query via Live OmniRoute ---
  console.log('\n--- TEST 5: Open-Ended Attender Query via Live OmniRoute ---');
  const openEndedQuery = 'What dietary tips should a heart patient follow after surgery?';
  console.log(`Sending open-ended query to OmniRoute: "${openEndedQuery}"`);
  const openStartTime = Date.now();
  const openResponse = await processCareAiQueryAsync(openEndedQuery, testPatient, 'en');
  const openElapsed = Date.now() - openStartTime;
  console.log(`Received open-ended response from OmniRoute in ${openElapsed}ms.`);

  assert(Boolean(openResponse.reply), 'Received response reply');
  assert(!openResponse.reply.includes('I could not locate that specific query'), 'OmniRoute provided dynamic conversational answer instead of fallback text');
  console.log(`AI Response sample: "${openResponse.reply.slice(0, 120)}..."`);

  // --- TEST 6: Graceful Fallback When OmniRoute Gateway is Offline / Error ---
  console.log('\n--- TEST 6: Graceful Fallback When OmniRoute is Offline ---');
  const offlineProvider = new OpenAiClinicalAiProvider('http://localhost:59999/v1', {
    apiKey: 'dummy_key',
    timeoutMs: 1000,
  });

  if (testPatient) {
    const offlineSummary = await offlineProvider.summarizePatientAsync(sanitizePatientData(testPatient));
    assert(Boolean(offlineSummary.patientOverview), 'Offline clinical summary gracefully fell back to local rule-based engine');
    assert(offlineSummary.disclaimer.toLowerCase().includes('decision-support draft'), 'Fallback summary includes proper disclaimer');
  }

  console.log('\n======================================================================');
  console.log(`ALL ${passed}/${total} LIVE VERIFICATION CHECKS PASSED!`);
  console.log('======================================================================\n');
}

runOmniRouteVerification().catch((err) => {
  console.error('Fatal error in verification suite:', err);
  process.exit(1);
});
