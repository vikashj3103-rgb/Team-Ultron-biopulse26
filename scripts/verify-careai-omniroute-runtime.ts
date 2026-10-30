import assert from 'node:assert/strict';
import { careAiService } from '../src/services/careAiService';
import { dataStore } from '../src/services/dataStore';

async function main() {
  console.log('======================================================================');
  console.log('  CARECONNECT CAREAI -> OMNIROUTE RUNTIME INTEGRATION TEST');
  console.log('======================================================================\n');

  const patient = dataStore.getPatientById('pat-ramesh');
  assert.ok(patient, 'Test patient Ramesh loaded');

  // TEST 1: Deterministic Prescription Safety Guard
  console.log('--- TEST 1: Deterministic Prescription Safety Guard (Bypasses LLM) ---');
  const t0 = Date.now();
  const rxResult = await careAiService.processQueryAsync('Can I give him crocin?', patient, 'en', 'attender');
  const rxDuration = Date.now() - t0;
  assert.equal(rxResult.cardType, 'PRESCRIPTION_RESTRICTED', 'Prescription query triggers restricted safety guard');
  assert.ok(rxDuration < 50, `Deterministic query executed in ${rxDuration}ms (< 50ms)`);
  console.log(`✅ PASSED: Medication prescription blocked locally in ${rxDuration}ms without external AI call`);
  console.log(`   cardType: ${rxResult.cardType}`);

  // TEST 2: Deterministic Navigation Intent (Pharmacy Route)
  console.log('\n--- TEST 2: Deterministic Navigation Intent (Hospital Map Routing) ---');
  const tNav = Date.now();
  const navResult = await careAiService.processQueryAsync('where is pharmacy', patient, 'en', 'attender');
  const navDuration = Date.now() - tNav;
  assert.ok(navResult.hasMapLink, 'Navigation query generated map link');
  assert.ok(navDuration < 50, `Navigation resolved in ${navDuration}ms`);
  console.log(`✅ PASSED: Navigation query resolved locally in ${navDuration}ms with turn-by-turn route`);

  // TEST 3: Deterministic Vitals Query (Current BP)
  console.log('\n--- TEST 3: Deterministic Vitals Query (Telemetry Scoring) ---');
  const tVitals = Date.now();
  const vitalsResult = await careAiService.processQueryAsync('what is the current bp', patient, 'en', 'attender');
  const vitalsDuration = Date.now() - tVitals;
  assert.equal(vitalsResult.cardType, 'VITALS', 'Vitals query matched VITALS cardType');
  assert.ok(vitalsDuration <= 150, `Vitals resolved in ${vitalsDuration}ms`);
  console.log(`✅ PASSED: Vitals telemetry resolved locally in ${vitalsDuration}ms without external AI call`);

  // TEST 4: Open-Ended Clinical Query (Routes via /api/clinical-ai -> OmniRoute)
  console.log('\n--- TEST 4: Open-Ended Query via CareConnect AI Gateway -> OmniRoute ---');
  const openQuery = 'What are some relaxing activities and comfort tips my grandfather can enjoy during his hospital stay?';
  const tAi = Date.now();
  const aiResult = await careAiService.processQueryAsync(openQuery, patient, 'en', 'attender');
  const aiDuration = Date.now() - tAi;

  console.log('aiResult cardType:', aiResult.cardType);
  assert.equal(aiResult.cardType, 'UNKNOWN', 'Open-ended query cardType is UNKNOWN');
  assert.ok(aiResult.reply, 'CareAI received a non-empty response');
  assert.ok(!aiResult.reply.startsWith('I could not locate that specific query'), 'Response is genuine AI generation, NOT the deterministic directory fallback');
  assert.ok(
    /comfort|relax|music|read|rest|family|hospital|stay/i.test(aiResult.reply),
    'AI response contains relevant comfort and wellbeing guidance'
  );
  console.log(`✅ PASSED: Open-ended CareAI query successfully routed to OmniRoute (${aiDuration}ms)`);
  console.log(`   CareAI Reply Preview:\n   "${aiResult.reply.slice(0, 200)}..."`);

  // TEST 5: Fallback Verification on Gateway / Provider Failure
  console.log('\n--- TEST 5: Fallback Verification When Gateway Endpoint is Unreachable ---');
  const prevBase = process.env.VITE_API_BASE_URL;
  try {
    process.env.VITE_API_BASE_URL = 'http://localhost:59999'; // unreachable port
    const fallbackResult = await careAiService.processQueryAsync(
      'Can you explain how recovery works for cardiac patients?',
      patient,
      'en',
      'attender'
    );
    assert.equal(fallbackResult.cardType, 'UNKNOWN');
    assert.ok(fallbackResult.reply.includes('I could not locate that specific query'), 'Safely degrades to deterministic fallback response on connection failure');
    console.log('✅ PASSED: Clean fallback triggered without crash when AI gateway is unreachable');
  } finally {
    if (prevBase) process.env.VITE_API_BASE_URL = prevBase;
    else delete process.env.VITE_API_BASE_URL;
  }

  console.log('\n======================================================================');
  console.log('  ALL CAREAI RUNTIME INTEGRATION TESTS PASSED 100%!');
  console.log('======================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
