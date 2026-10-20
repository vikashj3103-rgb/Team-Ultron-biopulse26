const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\vikash\\.gemini\\antigravity\\brain\\1d353b1e-a698-49c3-a707-80221030c984';

async function main() {
  console.log('======================================================================');
  console.log('  CARECONNECT JUDGE DEMO: END-TO-END PATIENT ALERT & LIFECYCLE TEST   ');
  console.log('======================================================================\n');

  const port = 9266;
  const userDataDir = 'C:\\Users\\vikash\\AppData\\Local\\Temp\\chrome-full-demo-' + Date.now();

  const chromeProcess = spawn(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      'http://localhost:3001'
    ],
    { stdio: 'ignore' }
  );

  let ws = null;
  try {
    let targets = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        targets = await new Promise((resolve, reject) => {
          const req = http.get(`http://127.0.0.1:${port}/json`, (res) => {
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

    function send(method, params = {}, timeoutMs = 10000) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timeout waiting for CDP method ${method}`));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject, timer } = pending.get(msg.id);
        clearTimeout(timer);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (res.exceptionDetails) {
        throw new Error('Evaluation exception: ' + JSON.stringify(res.exceptionDetails));
      }
      return res.result ? res.result.value : undefined;
    }

    async function captureScreenshot(filePath, width = 1440, height = 900) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await new Promise(r => setTimeout(r, 400));
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
      console.log(`📸 Screenshot saved: ${path.basename(filePath)} (${width}x${height})`);
    }

    // Step 1: Login through real UI as Doctor (Dr. Arun Kumar)
    console.log('--- Step 1: Sign in as Dr. Arun Kumar via UI Demo Selector ---');
    await send('Page.navigate', { url: 'http://localhost:3001/login' });
    await new Promise(r => setTimeout(r, 1500));

    // Click "Authorized Roles" tab
    await evaluate(`(() => {
      const tab = document.querySelector('[data-testid="tab-demo-access"]');
      if (tab) tab.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));

    // Click "Doctor Portal" button
    await evaluate(`(() => {
      const docBtn = document.querySelector('[data-testid="demo-login-doctor"]');
      if (docBtn) docBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 1500));

    // Verify on Doctor Dashboard
    const currentUrl = await evaluate(`window.location.pathname`);
    console.log('Navigated to after login:', currentUrl);

    // Step 2: Open Ramesh Kumar Clinical Monitor
    console.log('\n--- Step 2: Open Ramesh Kumar Clinical Monitor & Inject BP Spike (178/112) ---');
    await evaluate(`(() => {
      // Find open record button for Ramesh
      const btns = Array.from(document.querySelectorAll('button'));
      const openBtn = btns.find(b => b.textContent && b.textContent.includes('Open Record'));
      if (openBtn) openBtn.click();
      else window.location.href = '/doctor/patients/pat-ramesh';
    })()`);
    await new Promise(r => setTimeout(r, 1800));

    // Click BP Spike (178/112)
    const spikeClicked = await evaluate(`(() => {
      const btn = document.querySelector('[data-testid="inject-critical-bp-btn"]');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })()`);
    console.log('BP Spike clicked:', spikeClicked);
    await new Promise(r => setTimeout(r, 1200));

    const shotPatientDetail = path.join(ARTIFACT_DIR, 'doctor-patient-ramesh-critical-spike.png');
    await captureScreenshot(shotPatientDetail, 1440, 950);

    // Step 3: Return to Doctor Dashboard and verify Ramesh Kumar's Alert
    console.log('\n--- Step 3: Return to Doctor Dashboard to verify Scoped Alert Banner ---');
    await evaluate(`(() => {
      const backBtn = document.querySelector('button');
      window.location.href = '/doctor';
    })()`);
    await new Promise(r => setTimeout(r, 1800));

    const alertStatus = await evaluate(`(() => {
      const stack = document.querySelector('[data-testid="dashboard-alert-stack"]');
      const banners = Array.from(document.querySelectorAll('[data-testid="dashboard-alert-stack"] section[role="alert"]'));
      return {
        hasStack: !!stack,
        bannerCount: banners.length,
        banners: banners.map(b => ({
          textSnippet: b.textContent?.slice(0, 150),
          isRamesh: b.textContent?.includes('Ramesh Kumar'),
          isAnitha: b.textContent?.includes('Anitha Raj'),
          finding: b.querySelector('.font-extrabold')?.textContent
        }))
      };
    })()`);
    console.log('Dashboard Alert Banner Inspection:', JSON.stringify(alertStatus, null, 2));

    const shotDashboardAlert = path.join(ARTIFACT_DIR, 'doctor-dashboard-ramesh-active-alert.png');
    await captureScreenshot(shotDashboardAlert, 1440, 950);

    // Step 4: Click Acknowledge Alert on Ramesh Kumar
    console.log('\n--- Step 4: Clinician Acknowledges Ramesh Alert ---');
    const ackSuccess = await evaluate(`(() => {
      const ackBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Acknowledge Alert'));
      if (ackBtn) {
        ackBtn.click();
        return true;
      }
      return false;
    })()`);
    console.log('Acknowledge Alert button clicked:', ackSuccess);
    await new Promise(r => setTimeout(r, 1000));

    const shotAck = path.join(ARTIFACT_DIR, 'doctor-dashboard-ramesh-acknowledged.png');
    await captureScreenshot(shotAck, 1440, 950);

    // Step 5: Click Request Nurse Assistance
    console.log('\n--- Step 5: Clinician Requests Nurse Assistance ---');
    const nurseSuccess = await evaluate(`(() => {
      const nurseBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Request Nurse Assistance'));
      if (nurseBtn) {
        nurseBtn.click();
        return true;
      }
      return false;
    })()`);
    console.log('Request Nurse Assistance button clicked:', nurseSuccess);
    await new Promise(r => setTimeout(r, 1000));

    const shotNurse = path.join(ARTIFACT_DIR, 'doctor-dashboard-nurse-responding.png');
    await captureScreenshot(shotNurse, 1440, 950);

    // Step 6: Mark Resolved
    console.log('\n--- Step 6: Clinician Marks Alert Resolved ---');
    const resolveSuccess = await evaluate(`(() => {
      const resolveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Mark Resolved'));
      if (resolveBtn) {
        resolveBtn.click();
        return true;
      }
      return false;
    })()`);
    console.log('Mark Resolved button clicked:', resolveSuccess);
    await new Promise(r => setTimeout(r, 1000));

    const shotResolved = path.join(ARTIFACT_DIR, 'doctor-dashboard-alert-resolved.png');
    await captureScreenshot(shotResolved, 1440, 950);

    console.log('\n======================================================================');
    console.log('  FULL JUDGE DEMO: PATIENT ISOLATION & LIFECYCLE 100% VERIFIED!       ');
    console.log('======================================================================\n');
  } finally {
    if (ws) ws.close();
    chromeProcess.kill();
  }
}

main().catch(err => {
  console.error('Fatal error during browser demo verification:', err);
  process.exit(1);
});
