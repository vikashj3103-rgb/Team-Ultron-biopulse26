/**
 * CareConnect Unified Platform Capability Verification Suite
 */
import assert from 'node:assert';
import { platform, inspectPlatformCapabilities } from '../src/platform';

async function main() {
  console.log('======================================================================');
  console.log('  CARECONNECT PLATFORM CAPABILITY ADAPTER VERIFICATION SUITE');
  console.log('======================================================================\n');

  // TEST 1: Platform Detection & Capability Inspection
  console.log('--- TEST 1: Platform Target & Capability Inspection ---');
  const target = platform.target;
  const capabilities = platform.capabilities;
  console.log(`Detected Platform Target: ${target}`);
  console.log('Capabilities Inspection:', JSON.stringify(capabilities, null, 2));

  assert(['windows-tauri', 'web', 'mobile-capacitor'].includes(target), 'Target must be a recognized platform target');
  assert.strictEqual(typeof capabilities.isDesktop, 'boolean');
  assert.strictEqual(typeof capabilities.isWeb, 'boolean');
  assert.strictEqual(typeof capabilities.hasHardwareCamera, 'boolean');
  assert.strictEqual(typeof capabilities.hasSpeechSynthesis, 'boolean');
  console.log('✅ PASSED: Platform target detection and capability introspection verified\n');

  // TEST 2: Platform Audio Synthesizer (Web Audio API)
  console.log('--- TEST 2: Platform Audio Synthesizer & Clinical Alarms ---');
  assert.strictEqual(typeof platform.audio.playAlert, 'function');
  assert.strictEqual(typeof platform.audio.stopAll, 'function');
  assert.strictEqual(typeof platform.audio.setMasterVolume, 'function');

  platform.audio.setMasterVolume(0.8);
  const stopFn = await platform.audio.playAlert({ type: 'chime' });
  assert.strictEqual(typeof stopFn, 'function', 'playAlert should return a cleanup/stop function');
  stopFn();
  platform.audio.stopAll();
  console.log('✅ PASSED: Platform Audio Synthesizer verified\n');

  // TEST 3: Platform Storage Adapter
  console.log('--- TEST 3: Platform Storage Adapter (Set, Get, Remove, Clear) ---');
  const testKey = 'test_patient_filter';
  const testVal = { department: 'Cardiology', activeOnly: true, timestamp: Date.now() };

  await platform.storage.setItem(testKey, testVal);
  const retrieved = await platform.storage.getItem<typeof testVal>(testKey);
  assert.deepStrictEqual(retrieved, testVal, 'Stored value must match retrieved value');

  await platform.storage.removeItem(testKey);
  const afterRemove = await platform.storage.getItem(testKey);
  assert.strictEqual(afterRemove, null, 'Value must be null after removal');

  await platform.storage.setItem('temp_key_1', 123);
  await platform.storage.setItem('temp_key_2', 456);
  await platform.storage.clear();
  const cleared1 = await platform.storage.getItem('temp_key_1');
  assert.strictEqual(cleared1, null, 'Cleared storage must return null');
  console.log('✅ PASSED: Platform Storage Adapter operations verified\n');

  // TEST 4: Platform Notifications Fallback
  console.log('--- TEST 4: Platform Notifications Adapter ---');
  assert.strictEqual(typeof platform.notifications.isSupported, 'function');
  assert.strictEqual(typeof platform.notifications.showNotification, 'function');
  assert.strictEqual(typeof platform.notifications.setBadgeCount, 'function');

  const notifSupported = platform.notifications.isSupported();
  console.log(`Notification capability supported: ${notifSupported}`);
  const notifResult = await platform.notifications.showNotification({
    title: 'Clinical Alert: Bedside Check',
    body: 'Patient Suresh Kumar SpO2 stabilized at 98%',
    urgency: 'normal',
  });
  console.log(`Notification dispatch result: ${notifResult}`);
  console.log('✅ PASSED: Platform Notifications Adapter verified\n');

  // TEST 5: Platform Camera Adapter
  console.log('--- TEST 5: Platform Camera Adapter ---');
  assert.strictEqual(typeof platform.camera.isSupported, 'function');
  assert.strictEqual(typeof platform.camera.getAvailableCameras, 'function');
  const camSupported = platform.camera.isSupported();
  console.log(`Camera supported: ${camSupported}`);
  const cameras = await platform.camera.getAvailableCameras();
  console.log(`Available cameras enumerated: ${cameras.length}`);
  console.log('✅ PASSED: Platform Camera Adapter verified\n');

  // TEST 6: Platform Speech Adapter
  console.log('--- TEST 6: Platform Speech Adapter ---');
  assert.strictEqual(typeof platform.speech.isRecognitionSupported, 'function');
  assert.strictEqual(typeof platform.speech.isSynthesisSupported, 'function');
  assert.strictEqual(typeof platform.speech.speak, 'function');
  assert.strictEqual(typeof platform.speech.startListening, 'function');
  console.log(`Speech Recognition supported: ${platform.speech.isRecognitionSupported()}`);
  console.log(`Speech Synthesis supported: ${platform.speech.isSynthesisSupported()}`);
  console.log('✅ PASSED: Platform Speech Adapter verified\n');

  // TEST 7: Platform Lifecycle & Window Control Adapter
  console.log('--- TEST 7: Platform Lifecycle & Window Controls ---');
  assert.strictEqual(typeof platform.lifecycle.minimize, 'function');
  assert.strictEqual(typeof platform.lifecycle.maximize, 'function');
  assert.strictEqual(typeof platform.lifecycle.toggleMaximize, 'function');
  assert.strictEqual(typeof platform.lifecycle.close, 'function');
  assert.strictEqual(typeof platform.lifecycle.setFullscreen, 'function');
  assert.strictEqual(typeof platform.lifecycle.isFullscreen, 'function');

  const unsubscribeFocus = platform.lifecycle.onWindowFocus(() => {});
  assert.strictEqual(typeof unsubscribeFocus, 'function');
  unsubscribeFocus();
  console.log('✅ PASSED: Platform Lifecycle & Window Controls verified\n');

  console.log('======================================================================');
  console.log('  ALL PLATFORM ADAPTER VERIFICATIONS PASSED (100%)!');
  console.log('======================================================================');
}

main().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
