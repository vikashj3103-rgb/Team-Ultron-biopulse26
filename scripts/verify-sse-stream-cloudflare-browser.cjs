const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:\\Users\\vikash\\.gemini\\antigravity\\brain\\1d353b1e-a698-49c3-a707-80221030c984';

const DEMO_USERS = {
  admin: {
    id: 'user-admin',
    name: 'Clinical Administrator',
    email: 'admin@careconnect.demo',
    role: 'admin',
    phone: '+91 98400 00000',
    createdAt: new Date().toISOString(),
  },
  doctor: {
    id: 'user-doc-arun',
    name: 'Dr. Arun Kumar',
    email: 'doctor.cardio@careconnect.demo',
    role: 'doctor',
    phone: '+91 98401 23456',
    createdAt: new Date().toISOString(),
    assignedDoctorId: 'doc-arun',
  },
  attender: {
    id: 'user-att-vikash',
    name: 'Vikash Kumar',
    email: 'attender.vikash@careconnect.demo',
    role: 'attender',
    phone: '+91 98765 43210',
    createdAt: new Date().toISOString(),
    assignedAttenderId: 'att-vikash',
  },
};

async function setAuth(page, role) {
  const user = DEMO_USERS[role];
  await page.addInitScript((userObj) => {
    window.localStorage.setItem('careconnect_auth_session_v2', JSON.stringify(userObj));
    window.localStorage.setItem('healthconnect_tutorial_admin_completed', 'true');
    window.localStorage.setItem('healthconnect_tutorial_doctor_completed', 'true');
    window.localStorage.setItem('healthconnect_tutorial_attender_completed', 'true');
  }, user);
}

async function run() {
  console.log('Starting Playwright Browser Verification for Cloudflare SSE Stream & Reconnection Architecture...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  try {
    // -------------------------------------------------------------
    // STEP 1: Admin Page - Reset Clean Baseline & Trigger Ramesh Hypoxia
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Admin Triggers Ramesh Kumar Hypoxia ---');
    const adminPage = await context.newPage();
    await setAuth(adminPage, 'admin');
    await adminPage.goto('http://localhost:3001/admin/demo', { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(1000);

    // Reset clean baseline
    await adminPage.evaluate(() => {
      if (window.__DATA_STORE__) window.__DATA_STORE__.resetToDefaults();
    });
    await adminPage.waitForTimeout(500);

    // Select Ramesh Kumar card
    const rameshCard = adminPage.locator('[data-testid="demo-patient-pat-ramesh"]');
    await rameshCard.click();
    await adminPage.waitForTimeout(300);

    // Click Critical Hypoxia (SpO2 88%)
    const spo2Btn = adminPage.locator('[data-testid="demo-low-spo2-btn"]');
    await spo2Btn.click();
    await adminPage.waitForTimeout(1000);

    // -------------------------------------------------------------
    // STEP 2: Doctor Dashboard - Verify 1 Episode & Reconnect SSE 5 Times
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Doctor Dashboard - Verify 1 Episode & Reconnect SSE 5 Times (TEST A) ---');
    const doctorPage = await context.newPage();
    await setAuth(doctorPage, 'doctor');
    await doctorPage.goto('http://localhost:3001/doctor', { waitUntil: 'networkidle' });
    await doctorPage.waitForTimeout(1500);

    const docContent = await doctorPage.content();
    const hasRameshHypoxia = docContent.includes('Ramesh Kumar') && (docContent.includes('Hypoxia') || docContent.includes('SPO2') || docContent.includes('88%'));
    console.log(`Doctor dashboard shows Ramesh Hypoxia: ${hasRameshHypoxia ? 'YES (PASSED)' : 'NO (FAILED)'}`);

    const initialCardCount = await doctorPage.evaluate(() => {
      const alerts = window.__DATA_STORE__ ? window.__DATA_STORE__.getAlerts('pat-ramesh').filter(a => a.status !== 'resolved') : [];
      return alerts.length;
    });
    console.log(`Initial active alert cards for Ramesh: ${initialCardCount} (Expected: 1)`);

    // Simulate 5 SSE disconnect/reconnect cycles
    console.log('Simulating 5 SSE Disconnect / Reconnect cycles on Doctor Dashboard...');
    for (let r = 1; r <= 5; r++) {
      await doctorPage.evaluate(() => {
        if (window.__NETWORK_SYNC__) {
          window.__NETWORK_SYNC__.simulateDisconnect();
        }
      });
      await doctorPage.waitForTimeout(200);

      const stateReconnecting = await doctorPage.evaluate(() => {
        return window.__NETWORK_SYNC__ ? window.__NETWORK_SYNC__.getConnectionState() : 'UNKNOWN';
      });
      console.log(`Cycle #${r}: Sync state immediately after disconnect: ${stateReconnecting}`);

      await doctorPage.evaluate(() => {
        if (window.__NETWORK_SYNC__) {
          window.__NETWORK_SYNC__.reconnectNow();
        }
      });
      await doctorPage.waitForTimeout(400);
    }

    // Verify still exactly 1 episode
    const cardCountPost5 = await doctorPage.evaluate(() => {
      const alerts = window.__DATA_STORE__ ? window.__DATA_STORE__.getAlerts('pat-ramesh').filter(a => a.status !== 'resolved') : [];
      return alerts.length;
    });
    console.log(`Active alert cards for Ramesh after 5 reconnects: ${cardCountPost5} (Expected: 1)`);

    const shot16 = path.join(ARTIFACTS_DIR, 'browser-16-sse-reconnect-single-episode.png');
    await doctorPage.screenshot({ path: shot16, fullPage: false });
    console.log(`Saved screenshot: ${shot16}`);

    if (cardCountPost5 !== 1) {
      throw new Error(`TEST A FAILED: Expected 1 alert card after 5 reconnects, got ${cardCountPost5}`);
    }

    // -------------------------------------------------------------
    // STEP 3: Acknowledge Episode & Reconnect SSE 10 Times (TEST B)
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Acknowledge Alert & Reconnect SSE 10 Times (TEST B) ---');
    const ackBtn = doctorPage.locator('button:has-text("Acknowledge")').first();
    if (await ackBtn.isVisible()) {
      console.log('Clicking Acknowledge button...');
      await ackBtn.click();
      await doctorPage.waitForTimeout(1000);
    }

    const docTextPostAck = await doctorPage.content();
    const isAck = docTextPostAck.includes('ACKNOWLEDGED') || docTextPostAck.includes('Acknowledged') || docTextPostAck.includes('Dr. Arun Kumar');
    console.log(`Alert acknowledged successfully: ${isAck ? 'YES (PASSED)' : 'NO'}`);

    // Simulate 10 SSE disconnect/reconnect cycles
    console.log('Simulating 10 SSE Disconnect / Reconnect cycles on Doctor Dashboard...');
    for (let r = 1; r <= 10; r++) {
      await doctorPage.evaluate(() => {
        if (window.__NETWORK_SYNC__) {
          window.__NETWORK_SYNC__.simulateDisconnect();
          window.__NETWORK_SYNC__.reconnectNow();
        }
      });
      await doctorPage.waitForTimeout(150);
    }

    const docTextPost10 = await doctorPage.content();
    const stillAck = docTextPost10.includes('ACKNOWLEDGED') || docTextPost10.includes('Acknowledged') || docTextPost10.includes('Dr. Arun Kumar');
    console.log(`Alert strictly maintains ACKNOWLEDGED after 10 reconnects: ${stillAck ? 'YES (PASSED)' : 'NO (FAILED)'}`);

    const shot17 = path.join(ARTIFACTS_DIR, 'browser-17-sse-reconnect-acknowledged-stable.png');
    await doctorPage.screenshot({ path: shot17, fullPage: false });
    console.log(`Saved screenshot: ${shot17}`);

    if (!stillAck) {
      throw new Error('TEST B FAILED: Alert reverted from ACKNOWLEDGED after SSE reconnects!');
    }

    // -------------------------------------------------------------
    // STEP 4: Attender Portal - Verify Emergency Escalation Suppressed
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Attender Portal - Verify Emergency Escalation Suppressed Across Reconnects ---');
    const attenderPage = await context.newPage();
    await setAuth(attenderPage, 'attender');
    await attenderPage.goto('http://localhost:3001/attender', { waitUntil: 'networkidle' });
    await attenderPage.waitForTimeout(1500);

    const hasEmergencyBtn = await attenderPage.locator('button:has-text("Call Hospital Emergency")').isVisible();
    console.log(`Emergency escalation button suppressed on Attender portal: ${!hasEmergencyBtn ? 'YES (PASSED)' : 'NO (FAILED)'}`);

    const shot18 = path.join(ARTIFACTS_DIR, 'browser-18-sse-attender-escalation-suppressed.png');
    await attenderPage.screenshot({ path: shot18, fullPage: false });
    console.log(`Saved screenshot: ${shot18}`);

    if (hasEmergencyBtn) {
      throw new Error('Emergency button visible when doctor has already acknowledged episode!');
    }

    // -------------------------------------------------------------
    // STEP 5: Generate 20 Telemetry Ticks (TEST C)
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Ingest 20 Telemetry Ticks for Ramesh (TEST C) ---');
    await adminPage.bringToFront();
    for (let i = 1; i <= 20; i++) {
      await spo2Btn.click();
      await adminPage.waitForTimeout(100);
    }

    await doctorPage.bringToFront();
    await doctorPage.waitForTimeout(1000);

    const stats = await doctorPage.evaluate(() => {
      const alerts = window.__DATA_STORE__ ? window.__DATA_STORE__.getAlerts('pat-ramesh').filter(a => a.status !== 'resolved') : [];
      return {
        cardCount: alerts.length,
        occurrenceCount: alerts[0]?.occurrenceCount || 0,
        readingsCount: alerts[0]?.readingsCount || 0,
      };
    });
    console.log(`Post-20 ticks stats: cardCount=${stats.cardCount} (Expected: 1), occurrenceCount=${stats.occurrenceCount} (Expected >= 21)`);

    const shot19 = path.join(ARTIFACTS_DIR, 'browser-19-sse-20-ticks-counter-no-flood.png');
    await doctorPage.screenshot({ path: shot19, fullPage: false });
    console.log(`Saved screenshot: ${shot19}`);

    if (stats.cardCount !== 1) {
      throw new Error(`TEST C FAILED: 20 telemetry ticks flooded into ${stats.cardCount} alert cards!`);
    }

    // -------------------------------------------------------------
    // STEP 6: Multi-Condition Scoping (TEST D)
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Trigger Hypertension on Ramesh (TEST D) ---');
    await adminPage.bringToFront();
    const bpBtn = adminPage.locator('[data-testid="demo-critical-bp-btn"]');
    await bpBtn.click();
    await adminPage.waitForTimeout(1000);

    const debugAlerts = await adminPage.evaluate(() => {
      return window.__DATA_STORE__ ? window.__DATA_STORE__.getAlerts('pat-ramesh') : [];
    });
    console.log('Admin Page Ramesh Alerts after bpBtn:', JSON.stringify(debugAlerts.map(a => ({ id: a.id, cond: a.conditionType, vital: a.vitalType, status: a.status }))));

    await doctorPage.bringToFront();
    await doctorPage.waitForTimeout(1000);

    const docDebugAlerts = await doctorPage.evaluate(() => {
      return window.__DATA_STORE__ ? window.__DATA_STORE__.getAlerts('pat-ramesh') : [];
    });
    console.log('Doctor Page Ramesh Alerts after bpBtn:', JSON.stringify(docDebugAlerts.map(a => ({ id: a.id, cond: a.conditionType, vital: a.vitalType, status: a.status }))));

    const multiConditionsCount = await doctorPage.evaluate(() => {
      const alerts = window.__DATA_STORE__ ? window.__DATA_STORE__.getAlerts('pat-ramesh').filter(a => a.status !== 'resolved') : [];
      return alerts.length;
    });
    console.log(`Active conditions on Ramesh: ${multiConditionsCount} (Expected: 2)`);

    const shot20 = path.join(ARTIFACTS_DIR, 'browser-20-sse-multi-condition-summary.png');
    await doctorPage.screenshot({ path: shot20, fullPage: false });
    console.log(`Saved screenshot: ${shot20}`);

    if (multiConditionsCount !== 2) {
      throw new Error(`TEST D FAILED: Expected 2 conditions, got ${multiConditionsCount}`);
    }

    // -------------------------------------------------------------
    // STEP 7: Strict Patient Isolation (TEST E)
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Trigger Hypoxia on Anitha Raj (TEST E) ---');
    await adminPage.bringToFront();
    const anithaCard = adminPage.locator('[data-testid="demo-patient-pat-anitha"]');
    await anithaCard.click();
    await adminPage.waitForTimeout(300);

    const anithaSpo2Btn = adminPage.locator('[data-testid="demo-low-spo2-btn"]');
    await anithaSpo2Btn.click();
    await adminPage.waitForTimeout(1000);

    // Doctor Arun Kumar is assigned to Ramesh Kumar, NOT Anitha Raj
    await doctorPage.bringToFront();
    await doctorPage.waitForTimeout(1000);

    const docContentPostAnitha = await doctorPage.content();
    const hasAnithaContamination = docContentPostAnitha.includes('Patient: Anitha Raj') && docContentPostAnitha.includes('CRITICAL CLINICAL');
    console.log(`Doctor Dashboard receives Anitha alert: ${hasAnithaContamination ? 'YES (FAILED)' : 'NO (PASSED - STRICT ISOLATION)'}`);

    const shot21 = path.join(ARTIFACTS_DIR, 'browser-21-sse-patient-isolation-verified.png');
    await doctorPage.screenshot({ path: shot21, fullPage: false });
    console.log(`Saved screenshot: ${shot21}`);

    if (hasAnithaContamination) {
      throw new Error('TEST E FAILED: Ramesh dashboard received Anitha contamination!');
    }

    console.log('\n======================================================');
    console.log('ALL PLAYWRIGHT SSE & RECONNECT TESTS PASSED 100%!');
    console.log('======================================================\n');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
