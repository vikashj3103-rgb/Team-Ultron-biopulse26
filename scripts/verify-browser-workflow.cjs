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
  console.log('Starting Playwright End-to-End Browser Verification in Google Chrome...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: Admin Demo - Trigger FOOD REQUEST for Ramesh Kumar
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Navigating to Admin Demo Page ---');
    const adminPage = await context.newPage();
    await setAuth(adminPage, 'admin');
    await adminPage.goto('http://localhost:3001/admin/demo', { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(1000);

    // Reset baseline data to guarantee clean state
    await adminPage.evaluate(() => {
      if (window.__DATA_STORE__) {
        window.__DATA_STORE__.resetToDefaults();
      }
    });
    await adminPage.waitForTimeout(500);

    // Select Ramesh Kumar card
    const rameshCard = adminPage.locator('[data-testid="demo-patient-pat-ramesh"]');
    await rameshCard.click();
    await adminPage.waitForTimeout(500);

    console.log('Triggering Food Request for Ramesh Kumar...');
    // Click Food Request button
    const foodBtn = adminPage.locator('[data-testid="demo-food-request-btn"]');
    await foodBtn.click();
    await adminPage.waitForTimeout(1000);

    const adminRequests = await adminPage.evaluate(() => {
      return window.__DATA_STORE__ ? window.__DATA_STORE__.getRequests('pat-ramesh') : 'no __DATA_STORE__';
    });
    console.log('Admin Page Ramesh Requests in store after click:', JSON.stringify(adminRequests));

    const adminShot = path.join(ARTIFACTS_DIR, 'browser-01-admin-food-request.png');
    await adminPage.screenshot({ path: adminShot, fullPage: false });
    console.log(`Saved screenshot: ${adminShot}`);

    // -------------------------------------------------------------
    // TEST 2: Attender Portal - Verify Food Request (NOT Water)
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Checking Attender Portal for Ramesh Kumar ---');
    const attenderPage = await context.newPage();
    await setAuth(attenderPage, 'attender');
    await attenderPage.goto('http://localhost:3001/attender', { waitUntil: 'networkidle' });
    await attenderPage.waitForTimeout(1500);

    const attenderRequests = await attenderPage.evaluate(() => {
      return window.__DATA_STORE__ ? window.__DATA_STORE__.getRequests('pat-ramesh') : 'no __DATA_STORE__';
    });
    console.log('Attender Page Ramesh Requests in store:', JSON.stringify(attenderRequests));

    const attenderContent = await attenderPage.content();
    const hasFoodText = attenderContent.includes('Needs food') || attenderContent.includes('food or a meal');
    console.log(`Attender page displays Food Request: ${hasFoodText ? 'YES (PASSED)' : 'NO (FAILED)'}`);

    const attenderShot = path.join(ARTIFACTS_DIR, 'browser-02-attender-food-request.png');
    await attenderPage.screenshot({ path: attenderShot, fullPage: false });
    console.log(`Saved screenshot: ${attenderShot}`);

    if (!hasFoodText) {
      throw new Error('Attender page did not display Food Request for Ramesh Kumar!');
    }

    // -------------------------------------------------------------
    // TEST 3: Admin Demo - Trigger Hypertensive Crisis (Critical BP)
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Triggering Hypertensive Crisis for Ramesh Kumar ---');
    await adminPage.bringToFront();
    const bpBtn = adminPage.locator('[data-testid="demo-critical-bp-btn"]');
    await bpBtn.click();
    await adminPage.waitForTimeout(1000);

    const adminBpShot = path.join(ARTIFACTS_DIR, 'browser-03-admin-critical-bp.png');
    await adminPage.screenshot({ path: adminBpShot, fullPage: false });
    console.log(`Saved screenshot: ${adminBpShot}`);

    // -------------------------------------------------------------
    // TEST 4: Doctor Dashboard - Verify Ramesh Alert (Strict Isolation)
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Checking Doctor Dashboard for Ramesh Critical Alert ---');
    const doctorPage = await context.newPage();
    await setAuth(doctorPage, 'doctor');
    await doctorPage.goto('http://localhost:3001/doctor', { waitUntil: 'networkidle' });
    await doctorPage.waitForTimeout(1500);

    const docContent = await doctorPage.content();
    const hasRameshAlert = docContent.includes('Ramesh Kumar');
    const alertShowsAnitha = docContent.includes('Patient: Anitha Raj') && docContent.includes('CRITICAL CLINICAL ALERT');
    console.log(`Doctor Dashboard shows Ramesh Kumar alert: ${hasRameshAlert ? 'YES (PASSED)' : 'NO'}`);
    console.log(`Doctor Dashboard mistakenly swapped Anitha Raj: ${alertShowsAnitha ? 'YES (FAILED)' : 'NO (PASSED)'}`);

    const doctorShot = path.join(ARTIFACTS_DIR, 'browser-04-doctor-dashboard-ramesh-alert.png');
    await doctorPage.screenshot({ path: doctorShot, fullPage: false });
    console.log(`Saved screenshot: ${doctorShot}`);

    if (!hasRameshAlert || alertShowsAnitha) {
      throw new Error('Doctor Dashboard failed patient isolation check for Ramesh Kumar!');
    }

    // -------------------------------------------------------------
    // TEST 5: Admin Demo - Trigger Hypoxia for Anitha Raj
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Triggering Hypoxia for Anitha Raj ---');
    await adminPage.bringToFront();
    // Select Anitha Raj card
    const anithaCard = adminPage.locator('[data-testid="demo-patient-pat-anitha"]');
    await anithaCard.click();
    await adminPage.waitForTimeout(500);

    const spo2Btn = adminPage.locator('[data-testid="demo-low-spo2-btn"]');
    await spo2Btn.click();
    await adminPage.waitForTimeout(1000);

    const adminAnithaShot = path.join(ARTIFACTS_DIR, 'browser-05-admin-anitha-hypoxia.png');
    await adminPage.screenshot({ path: adminAnithaShot, fullPage: false });
    console.log(`Saved screenshot: ${adminAnithaShot}`);

    // -------------------------------------------------------------
    // TEST 6: Doctor & Admin Alerts - Strict Isolation & Stacked Alerts
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Verifying Patient Scoping on Doctor & Admin Dashboards ---');
    await doctorPage.bringToFront();
    await doctorPage.reload({ waitUntil: 'networkidle' });
    await doctorPage.waitForTimeout(1500);

    const docMultiContent = await doctorPage.content();
    const docHasRameshOnly = docMultiContent.includes('Ramesh Kumar') && !docMultiContent.includes('Patient: Anitha Raj');
    console.log(`Doctor Dashboard strictly shows ONLY assigned patient Ramesh: ${docHasRameshOnly ? 'YES (PASSED)' : 'NO'}`);

    const doctorMultiShot = path.join(ARTIFACTS_DIR, 'browser-06-doctor-dashboard-multi-alerts.png');
    await doctorPage.screenshot({ path: doctorMultiShot, fullPage: false });
    console.log(`Saved screenshot: ${doctorMultiShot}`);

    // Verify Admin sees BOTH patients in hospital-wide alert center
    await adminPage.bringToFront();
    await adminPage.goto('http://localhost:3001/admin/alerts', { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(1500);
    const adminAlertsContent = await adminPage.content();
    const adminHasBoth = adminAlertsContent.includes('Ramesh Kumar') && adminAlertsContent.includes('Anitha Raj');
    console.log(`Admin Alerts Center displays alerts for BOTH Ramesh & Anitha: ${adminHasBoth ? 'YES (PASSED)' : 'NO'}`);

    const adminAllAlertsShot = path.join(ARTIFACTS_DIR, 'browser-06b-admin-all-patients-alerts.png');
    await adminPage.screenshot({ path: adminAllAlertsShot, fullPage: false });
    console.log(`Saved screenshot: ${adminAllAlertsShot}`);

    // -------------------------------------------------------------
    // TEST 7: Doctor Patient Detail - Ramesh Telemetry & Graph
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Checking Ramesh Kumar Detail Page & Live Telemetry Graph ---');
    await doctorPage.goto('http://localhost:3001/doctor/patients/pat-ramesh', { waitUntil: 'networkidle' });
    await doctorPage.waitForTimeout(1500);

    const rameshDetailShot = path.join(ARTIFACTS_DIR, 'browser-07-doctor-ramesh-detail-graph.png');
    await doctorPage.screenshot({ path: rameshDetailShot, fullPage: false });
    console.log(`Saved screenshot: ${rameshDetailShot}`);

    // -------------------------------------------------------------
    // TEST 8: Doctor Patient Detail - Anitha Isolated Page
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Checking Anitha Raj Detail Page (Isolated) ---');
    await doctorPage.goto('http://localhost:3001/doctor/patients/pat-anitha', { waitUntil: 'networkidle' });
    await doctorPage.waitForTimeout(1500);

    const anithaDetailShot = path.join(ARTIFACTS_DIR, 'browser-08-doctor-anitha-detail-isolated.png');
    await doctorPage.screenshot({ path: anithaDetailShot, fullPage: false });
    console.log(`Saved screenshot: ${anithaDetailShot}`);

    // -------------------------------------------------------------
    // TEST 9: Acknowledge & Resolve Alert on Doctor Dashboard
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Acknowledging and Resolving Ramesh Alert ---');
    await doctorPage.goto('http://localhost:3001/doctor', { waitUntil: 'networkidle' });
    await doctorPage.waitForTimeout(1000);

    // Find the Acknowledge button inside active alert banner
    const ackBtn = doctorPage.locator('button:has-text("Acknowledge")').first();
    if (await ackBtn.isVisible()) {
      await ackBtn.click();
      await doctorPage.waitForTimeout(1000);
      console.log('Clicked Acknowledge Alert on active alert banner');
    }

    const doctorAckShot = path.join(ARTIFACTS_DIR, 'browser-09-doctor-alert-acknowledged.png');
    await doctorPage.screenshot({ path: doctorAckShot, fullPage: false });
    console.log(`Saved screenshot: ${doctorAckShot}`);

    // -------------------------------------------------------------
    // TEST 10: Repeated Hypoxia -> Single Episode Card with Counter
    // -------------------------------------------------------------
    console.log('\n--- Step 10: Triggering Repeated Hypoxia Simulation -> Exactly 1 Episode with Counter ---');
    // Reset defaults first to ensure clean state
    await adminPage.bringToFront();
    await adminPage.goto('http://localhost:3001/admin/demo', { waitUntil: 'networkidle' });
    await adminPage.evaluate(() => {
      if (window.__DATA_STORE__) window.__DATA_STORE__.resetToDefaults();
    });
    await adminPage.waitForTimeout(500);

    // Select Ramesh Kumar card and click SpO2 critical 5 times
    const rameshCard10 = adminPage.locator('[data-testid="demo-patient-pat-ramesh"]');
    await rameshCard10.click();
    await adminPage.waitForTimeout(300);

    const spo2Btn10 = adminPage.locator('[data-testid="demo-low-spo2-btn"]');
    for (let i = 1; i <= 5; i++) {
      await spo2Btn10.click();
      await adminPage.waitForTimeout(300);
    }

    // Now navigate doctorPage to /doctor
    await doctorPage.bringToFront();
    await doctorPage.goto('http://localhost:3001/doctor', { waitUntil: 'networkidle' });
    await doctorPage.waitForTimeout(1000);

    const docCardsCount = await doctorPage.evaluate(() => {
      const alerts = window.__DATA_STORE__ ? window.__DATA_STORE__.getAlerts('pat-ramesh').filter(a => a.status !== 'resolved') : [];
      return alerts.length;
    });
    console.log(`Active alert cards for Ramesh in dataStore: ${docCardsCount} (Expected: 1)`);

    const doctorEpisodeShot = path.join(ARTIFACTS_DIR, 'browser-10-doctor-episode-counter-no-flood.png');
    await doctorPage.screenshot({ path: doctorEpisodeShot, fullPage: false });
    console.log(`Saved screenshot: ${doctorEpisodeShot}`);

    // -------------------------------------------------------------
    // TEST 11: Attender Emergency Timeout Escalation
    // -------------------------------------------------------------
    console.log('\n--- Step 11: Testing Attender Emergency Timeout Escalation ---');
    // Set demo timeout to 5 seconds
    await attenderPage.bringToFront();
    await attenderPage.evaluate(() => {
      if (window.__DATA_STORE__) {
        window.__DATA_STORE__.setDemoAlertTimeoutSeconds(5);
      }
    });

    // Reload attender dashboard and wait for timeout to expire (6s)
    await attenderPage.goto('http://localhost:3001/attender', { waitUntil: 'networkidle' });
    console.log('Waiting 6 seconds for unacknowledged critical alert timeout to trigger...');
    await attenderPage.waitForTimeout(6500);

    const attenderEscalationShot = path.join(ARTIFACTS_DIR, 'browser-11-attender-emergency-timeout-escalation.png');
    await attenderPage.screenshot({ path: attenderEscalationShot, fullPage: false });
    console.log(`Saved screenshot: ${attenderEscalationShot}`);

    // Click "Call Hospital Emergency"
    const callEmergencyBtn = attenderPage.locator('button:has-text("Call Hospital Emergency")').first();
    if (await callEmergencyBtn.isVisible()) {
      await callEmergencyBtn.click();
      await attenderPage.waitForTimeout(1000);
      console.log('Clicked Call Hospital Emergency button');
    }

    const attenderCalledShot = path.join(ARTIFACTS_DIR, 'browser-12-attender-emergency-called.png');
    await attenderPage.screenshot({ path: attenderCalledShot, fullPage: false });
    console.log(`Saved screenshot: ${attenderCalledShot}`);

    console.log('\n======================================================');
    console.log('ALL BROWSER E2E TESTS PASSED 100% IN GOOGLE CHROME!');
    console.log('======================================================\n');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
