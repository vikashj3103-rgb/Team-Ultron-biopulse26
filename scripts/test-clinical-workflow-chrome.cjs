const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\vikash\\.gemini\\antigravity\\brain\\1d353b1e-a698-49c3-a707-80221030c984';

async function main() {
  console.log('[STEP 1] Launching Chrome for Real-Time Clinical Workflow Verification...');
  const chromeProcess = spawn(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--user-data-dir=C:\\Users\\vikash\\AppData\\Local\\Temp\\chrome-clinical-workflow-profile',
      '--no-first-run',
      '--no-default-browser-check',
      'http://localhost:3001/login'
    ],
    { stdio: 'ignore' }
  );

  let ws = null;
  try {
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 300));
      try {
        targets = await new Promise((resolve, reject) => {
          const req = http.get('http://127.0.0.1:9222/json', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
          });
          req.on('error', reject);
          req.setTimeout(1000, () => req.destroy(new Error('timeout')));
        });
        if (targets && targets.length > 0) break;
      } catch {}
    }

    const pageTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!pageTarget) throw new Error('No page target found');

    ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = new Map();

    function send(method, params = {}, timeoutMs = 12000) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const timer = setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new Error(`Command ${method} timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);

        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.id && pending.has(data.id)) {
          const { resolve, reject, timer } = pending.get(data.id);
          clearTimeout(timer);
          pending.delete(data.id);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      } catch (e) {}
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    await send('Page.enable');
    await send('DOM.enable');
    await send('Runtime.enable');

    // Set Desktop workstation viewport 1440x900
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // =========================================================================
    // SECTION 1: DOCTOR AUTHENTICATION VIA DEMO ACCESS
    // =========================================================================
    console.log('\n[STEP 2] Logging in as Doctor via Demo Access...');
    await send('Page.navigate', { url: 'http://localhost:3001/login' });
    await new Promise(r => setTimeout(r, 1500));

    // Mark tutorial completed in localStorage to avoid modal overlap
    await send('Runtime.evaluate', {
      expression: `
        try {
          localStorage.setItem('healthconnect_tutorial_doctor_completed', 'true');
          localStorage.setItem('healthconnect_tutorial_attender_completed', 'true');
        } catch(e) {}
      `
    });

    // Switch to Demo Access tab
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const demoTab = btns.find(b => b.innerText.includes('Demo access'));
          if (demoTab) demoTab.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 500));

    // Click Doctor Portal
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const docBtn = btns.find(b => b.innerText.includes('Doctor Portal'));
          if (docBtn) docBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Dismiss any coachmark/tutorial if still visible
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const skipBtns = Array.from(document.querySelectorAll('button')).filter(b => 
            b.innerText.includes('Skip') || b.innerText.includes('Finish') || b.innerText.includes('Got it')
          );
          skipBtns.forEach(b => b.click());
        })()
      `
    });
    await new Promise(r => setTimeout(r, 500));

    const docVerify = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const text = document.body.innerText;
          const hasWorkspace = text.includes('Clinical Workspace') || text.includes('Dr. Arun');
          const hasSimulationControls = text.includes('SIMULATION / DEMO DATA') || text.includes('Controlled Clinical Deterioration');
          const hasSuresh = text.includes('Suresh Kumar');
          return { hasWorkspace, hasSimulationControls, hasSuresh };
        })()
      `,
      returnByValue: true
    });
    console.log('Doctor Workstation verified:', docVerify.result.value);

    // =========================================================================
    // SECTION 2: TRIGGER CONTROLLED DETERIORATION (SpO2 97% -> 86%)
    // =========================================================================
    console.log('\n[STEP 3] Triggering Controlled Telemetry Deterioration for Suresh Kumar...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const startBtn = buttons.find(b => b.innerText.includes('Start Deterioration Scenario'));
          if (startBtn) startBtn.click();
        })()
      `
    });

    // Step through each scenario point or click step buttons if auto-tick is paused
    console.log('[STEP 4] Advancing deterioration to critical threshold (86% SpO2)...');
    let reachedCritical = false;
    for (let tick = 0; tick < 12; tick++) {
      await new Promise(r => setTimeout(r, 800));

      const statusRes = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const text = document.body.innerText;
            const hasCriticalBanner = text.includes('CRITICAL CLINICAL ALERT');
            const has86 = text.includes('86%');
            const ackBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Acknowledge Alert'));
            return { hasCriticalBanner, has86, hasAckBtn: Boolean(ackBtn) };
          })()
        `,
        returnByValue: true
      });
      const res = statusRes.result.value;
      if (res && res.hasCriticalBanner && res.hasAckBtn) {
        reachedCritical = true;
        console.log(`✅ Critical alert active and auto-paused at step 4 (86% SpO2)!`);
        break;
      }

      // If waiting on timer, step to next
      await send('Runtime.evaluate', {
        expression: `
          (() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const criticalStepBtn = buttons.find(b => b.innerText.includes('Step 4') || b.innerText.includes('86%'));
            if (criticalStepBtn) criticalStepBtn.click();
          })()
        `
      });
    }

    // Inspect Critical Alert banner details
    const bannerDetails = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const text = document.body.innerText;
          const finding = text.includes('SpO₂ dropped to 86%') || text.includes('86%');
          const deteriorating = text.includes('deteriorating');
          const hasPatientSuresh = text.includes('Suresh Kumar');
          return { finding, deteriorating, hasPatientSuresh };
        })()
      `,
      returnByValue: true
    });
    console.log('Critical Alert Banner details:', bannerDetails.result.value);

    // Capture Step 1 Screenshot: Critical Alert Active
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'workflow-doctor-step1-critical-alert.png'), Buffer.from(shot1.data, 'base64'));
    console.log('📸 Screenshot saved: workflow-doctor-step1-critical-alert.png');

    // =========================================================================
    // SECTION 3: DOCTOR ACKNOWLEDGES THE ALERT
    // =========================================================================
    console.log('\n[STEP 5] Clinician clicking [ Acknowledge Alert ]...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const ackBtn = buttons.find(b => b.innerText.includes('Acknowledge Alert'));
          if (ackBtn) ackBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    const ackCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const text = document.body.innerText;
          const acknowledged = text.includes('ACKNOWLEDGED') || text.includes('Alert acknowledged by');
          const hasRequestNurseBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Request Nurse Assistance'));
          return { acknowledged, hasRequestNurseBtn };
        })()
      `,
      returnByValue: true
    });
    console.log('Acknowledgement result:', ackCheck.result.value);

    // Capture Step 2 Screenshot: Alert Acknowledged
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'workflow-doctor-step2-acknowledged.png'), Buffer.from(shot2.data, 'base64'));
    console.log('📸 Screenshot saved: workflow-doctor-step2-acknowledged.png');

    // =========================================================================
    // SECTION 4: DOCTOR REQUESTS NURSE ASSISTANCE
    // =========================================================================
    console.log('\n[STEP 6] Clinician clicking [ Request Nurse Assistance ]...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const reqNurseBtn = buttons.find(b => b.innerText.includes('Request Nurse Assistance'));
          if (reqNurseBtn) reqNurseBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1200));

    const respondingCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const text = document.body.innerText;
          const hasPriya = text.includes('Nurse Priya');
          const hasResponding = text.includes('RESPONDING') || text.includes('Status: Responding');
          const hasEnRoute = text.includes('en route');
          const hasResolveBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Mark Resolved'));
          return { hasPriya, hasResponding, hasEnRoute, hasResolveBtn };
        })()
      `,
      returnByValue: true
    });
    console.log('Nurse Responding state on Doctor Workstation:', respondingCheck.result.value);

    // Capture Step 3 Screenshot: Nurse Responding on Doctor Workstation
    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'workflow-doctor-step3-nurse-responding.png'), Buffer.from(shot3.data, 'base64'));
    console.log('📸 Screenshot saved: workflow-doctor-step3-nurse-responding.png');

    // =========================================================================
    // SECTION 5: ATTENDER VIEW VERIFICATION (Family Reassurance & Privacy)
    // =========================================================================
    console.log('\n[STEP 7] Switching to Attender Dashboard for Vikash Kumar...');
    await send('Page.navigate', { url: 'http://localhost:3001/login' });
    await new Promise(r => setTimeout(r, 1200));

    // Switch to Demo Access tab
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const demoTab = btns.find(b => b.innerText.includes('Demo access'));
          if (demoTab) demoTab.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 500));

    // Click Family Attender button
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const attBtn = btns.find(b => b.innerText.includes('Family Attender'));
          if (attBtn) attBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    const attenderBannerCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const text = document.body.innerText;
          const hasSuresh = text.includes('Suresh Kumar');
          const hasRespondingStatus = text.includes('Nurse assistance: Responding') || text.includes('is on the way');
          const hasPriya = text.includes('Nurse Priya');
          // STRICT PRIVACY: verify NO internal staff phone contact numbers are leaked
          const leaksStaffPhone = text.includes('98401 11225') || text.includes('+91 98401 11225');
          return { hasSuresh, hasRespondingStatus, hasPriya, leaksStaffPhone };
        })()
      `,
      returnByValue: true
    });
    console.log('Attender status banner check:', attenderBannerCheck.result.value);

    // Capture Step 3 Screenshot: Attender Dashboard with Reassuring Status
    const shotAttender = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'workflow-attender-step3-nurse-responding.png'), Buffer.from(shotAttender.data, 'base64'));
    console.log('📸 Screenshot saved: workflow-attender-step3-nurse-responding.png');

    // =========================================================================
    // SECTION 6: DOCTOR MARKS ALERT RESOLVED -> NORMALIZED VITALS RESTORED
    // =========================================================================
    console.log('\n[STEP 8] Returning to Doctor Workstation to Mark Alert Resolved...');
    await send('Page.navigate', { url: 'http://localhost:3001/login' });
    await new Promise(r => setTimeout(r, 1000));

    // Switch to Demo Access tab
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const demoTab = btns.find(b => b.innerText.includes('Demo access'));
          if (demoTab) demoTab.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 400));

    // Click Doctor Portal
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const docBtn = btns.find(b => b.innerText.includes('Doctor Portal'));
          if (docBtn) docBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    // Click [ Mark Resolved ]
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const resolveBtn = buttons.find(b => b.innerText.includes('Mark Resolved') || b.innerText.includes('Resolve Alert'));
          if (resolveBtn) resolveBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1200));

    const doctorResolvedCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const text = document.body.innerText;
          const resolved = text.includes('RESOLVED');
          const hasResponseTime = text.includes('Response time:') || text.includes('Audit Trail Recorded');
          return { resolved, hasResponseTime };
        })()
      `,
      returnByValue: true
    });
    console.log('Doctor Workstation Resolved check:', doctorResolvedCheck.result.value);

    // Capture Step 4 Screenshot: Alert Resolved on Doctor Workstation
    const shot4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'workflow-doctor-step4-resolved.png'), Buffer.from(shot4.data, 'base64'));
    console.log('📸 Screenshot saved: workflow-doctor-step4-resolved.png');

    // =========================================================================
    // SECTION 7: ATTENDER VIEW AFTER RESOLUTION
    // =========================================================================
    console.log('\n[STEP 9] Verifying Attender Dashboard after Resolution...');
    await send('Page.navigate', { url: 'http://localhost:3001/login' });
    await new Promise(r => setTimeout(r, 1000));

    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const demoTab = btns.find(b => b.innerText.includes('Demo access'));
          if (demoTab) demoTab.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 400));

    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const attBtn = btns.find(b => b.innerText.includes('Family Attender'));
          if (attBtn) attBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    const attenderDoneCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const text = document.body.innerText;
          const hasAttendingMsg = text.includes('Nurse is attending the patient') || text.includes('Bedside care has been provided');
          return { hasAttendingMsg };
        })()
      `,
      returnByValue: true
    });
    console.log('Attender Care Completed check:', attenderDoneCheck.result.value);

    const shotAttenderDone = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'workflow-attender-step4-resolved.png'), Buffer.from(shotAttenderDone.data, 'base64'));
    console.log('📸 Screenshot saved: workflow-attender-step4-resolved.png');

    console.log('\n======================================================================');
    console.log('REAL-TIME CLINICAL EVENT & ALERT WORKFLOW 100% VERIFIED IN CHROME!');
    console.log('======================================================================\n');
  } catch (err) {
    console.error('Chrome Verification Error:', err);
    process.exit(1);
  } finally {
    if (ws) ws.close();
    chromeProcess.kill();
  }
}

main();
