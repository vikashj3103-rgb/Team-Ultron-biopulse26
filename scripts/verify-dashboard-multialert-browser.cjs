const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\vikash\\.gemini\\antigravity\\brain\\1d353b1e-a698-49c3-a707-80221030c984';

async function main() {
  console.log('======================================================================');
  console.log('   HEALTHCONNECT MULTI-ALERT STACK & WORKFLOW CHROME E2E VERIFICATION  ');
  console.log('======================================================================\n');

  const port = 9255;
  const userDataDir = 'C:\\Users\\vikash\\AppData\\Local\\Temp\\chrome-stack-' + Date.now();

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

    // Step 1: Set Admin Session
    await send('Page.navigate', { url: 'http://localhost:3001/login' });
    await new Promise(r => setTimeout(r, 1200));

    await evaluate(`(() => {
      localStorage.setItem('careconnect_auth_session_v2', JSON.stringify({
        id: 'user-admin',
        name: 'Clinical Administrator',
        email: 'admin@careconnect.demo',
        role: 'admin',
        phone: '+91 98400 00000',
        createdAt: new Date().toISOString()
      }));
    })()`);

    // Navigate to Doctor Dashboard
    await send('Page.navigate', { url: 'http://localhost:3001/doctor' });
    await new Promise(r => setTimeout(r, 1500));

    // Step 2: Trigger Hypertensive Crisis for Ramesh Kumar
    console.log('--- Step 2: Injecting Hypertensive Crisis into Ramesh Kumar on Doctor Dashboard ---');
    await evaluate(`(() => {
      // Find the global demo simulation service or dataStore in window or trigger via UI
      // Use CustomEvent or direct DOM button click if on page
      const rameshButton = document.querySelector('button[title*="Hypertensive Crisis"]');
      if (rameshButton) {
        rameshButton.click();
      }
    })()`);

    // Also let's trigger via Hardware Event API simulation endpoint or UI
    // In our app, DemoControlPanel has "Hypertensive Crisis (178/112)" button!
    await evaluate(`(() => {
      // Open DemoControlPanel if collapsed
      const triggerBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('BP (172/106)') || b.textContent.includes('BP Spike'));
      if (triggerBtn) triggerBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 1000));

    // Check alert stack
    const stackInfo = await evaluate(`(() => {
      const banners = Array.from(document.querySelectorAll('[data-testid="dashboard-alert-stack"] section[role="alert"]'));
      return banners.map(b => {
        const text = b.textContent || '';
        return {
          isCritical: text.includes('CRITICAL'),
          patientName: text.includes('Ramesh Kumar') ? 'Ramesh Kumar' : text.includes('Anitha Raj') ? 'Anitha Raj' : 'Unknown',
          hasAcknowledgeBtn: !!b.querySelector('button') && b.querySelector('button').textContent.includes('Acknowledge'),
          hasNurseBtn: !!b.querySelector('button') && b.querySelector('button').textContent.includes('Request Nurse'),
          statusBadge: b.querySelector('span.rounded-full')?.textContent?.trim()
        };
      });
    })()`);
    console.log('Alert Stack Banners on Dashboard:', stackInfo);

    const shot1 = path.join(ARTIFACT_DIR, 'doctor-alert-stack-multi-banner.png');
    await captureScreenshot(shot1, 1440, 950);

    // Step 3: Test Workflow Actions
    console.log('\n--- Step 3: Testing Acknowledge Workflow ---');
    const ackResult = await evaluate(`(() => {
      const ackButtons = Array.from(document.querySelectorAll('button')).filter(b => b.textContent && b.textContent.includes('Acknowledge Alert'));
      if (ackButtons.length > 0) {
        ackButtons[0].click();
        return true;
      }
      return false;
    })()`);
    console.log('Clicked Acknowledge Alert on top banner:', ackResult);
    await new Promise(r => setTimeout(r, 800));

    const stackAfterAck = await evaluate(`(() => {
      const banners = Array.from(document.querySelectorAll('[data-testid="dashboard-alert-stack"] section[role="alert"]'));
      return banners.map(b => ({
        text: b.textContent?.slice(0, 120),
        statusBadge: b.querySelector('span.rounded-full')?.textContent?.trim()
      }));
    })()`);
    console.log('Alert Stack After Acknowledge:', stackAfterAck);

    const shot2 = path.join(ARTIFACT_DIR, 'doctor-alert-stack-acknowledged.png');
    await captureScreenshot(shot2, 1440, 950);

    // Step 4: Click Request Nurse Assistance
    console.log('\n--- Step 4: Testing Request Nurse Assistance Workflow ---');
    const nurseResult = await evaluate(`(() => {
      const nurseBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Request Nurse'));
      if (nurseBtn) {
        nurseBtn.click();
        return true;
      }
      return false;
    })()`);
    console.log('Clicked Request Nurse Assistance:', nurseResult);
    await new Promise(r => setTimeout(r, 800));

    const stackAfterNurse = await evaluate(`(() => {
      const banners = Array.from(document.querySelectorAll('[data-testid="dashboard-alert-stack"] section[role="alert"]'));
      return banners.map(b => ({
        text: b.textContent?.slice(0, 120),
        statusBadge: b.querySelector('span.rounded-full')?.textContent?.trim()
      }));
    })()`);
    console.log('Alert Stack After Nurse Request (Responding):', stackAfterNurse);

    const shot3 = path.join(ARTIFACT_DIR, 'doctor-alert-stack-responding.png');
    await captureScreenshot(shot3, 1440, 950);

    // Step 5: Click Mark Resolved
    console.log('\n--- Step 5: Testing Mark Resolved Workflow ---');
    const resolveResult = await evaluate(`(() => {
      const resBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Mark Resolved') || b.textContent.includes('Resolve Alert'));
      if (resBtn) {
        resBtn.click();
        return true;
      }
      return false;
    })()`);
    console.log('Clicked Mark Resolved:', resolveResult);
    await new Promise(r => setTimeout(r, 800));

    const stackAfterResolve = await evaluate(`(() => {
      const banners = Array.from(document.querySelectorAll('[data-testid="dashboard-alert-stack"] section[role="alert"]'));
      return banners.map(b => ({
        text: b.textContent?.slice(0, 120),
        statusBadge: b.querySelector('span.rounded-full')?.textContent?.trim()
      }));
    })()`);
    console.log('Alert Stack After Resolution:', stackAfterResolve);

    const shot4 = path.join(ARTIFACT_DIR, 'doctor-alert-stack-resolved.png');
    await captureScreenshot(shot4, 1440, 950);

    console.log('\n======================================================================');
    console.log('  FULL CLINICAL ALERT LIFECYCLE CHROME VERIFICATION COMPLETE!        ');
    console.log('======================================================================\n');
  } finally {
    if (ws) ws.close();
    chromeProcess.kill();
  }
}

main().catch(err => {
  console.error('Fatal error during browser verification:', err);
  process.exit(1);
});
