const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\vikash\\.gemini\\antigravity\\brain\\1d353b1e-a698-49c3-a707-80221030c984';

async function main() {
  console.log('[STEP 1] Launching Chrome...');
  const chromeProcess = spawn(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--user-data-dir=C:\\Users\\vikash\\AppData\\Local\\Temp\\chrome-visual-profile',
      '--no-first-run',
      '--no-default-browser-check',
      'http://localhost:3001/doctor'
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

    function send(method, params = {}, timeoutMs = 8000) {
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

    // Force hard reload
    await send('Page.reload', { ignoreCache: true });
    await new Promise(r => setTimeout(r, 1500));

    // Authenticate as doctor
    await send('Runtime.evaluate', {
      expression: `
        try {
          const authUser = {
            id: 'user-doc-arun',
            name: 'Dr. Arun Kumar',
            email: 'doctor.cardio@careconnect.demo',
            role: 'doctor',
            phone: '+91 98401 23456',
            assignedDoctorId: 'doc-arun'
          };
          localStorage.setItem('careconnect_auth_session_v2', JSON.stringify(authUser));
          localStorage.setItem('healthconnect_tutorial_doctor_completed', 'true');
          localStorage.removeItem('healthconnect_careai_position');
        } catch(e) {}
      `
    });

    await send('Page.navigate', { url: 'http://localhost:3001/doctor' });
    await new Promise(r => setTimeout(r, 1500));

    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await new Promise(r => setTimeout(r, 500));

    // Get mascot rect
    const res = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const mascot = document.querySelector('[data-tour="careai-mascot"]');
          if (!mascot) return null;
          const rect = mascot.getBoundingClientRect();
          return {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            outerHTML: mascot.outerHTML
          };
        })()
      `,
      returnByValue: true
    });

    console.log('[MASCOT EVAL]:', JSON.stringify(res.result.value, null, 2));

    const m = res.result.value;
    if (m) {
      // Capture zoomed crop of mascot
      const clip = {
        x: Math.max(0, m.x - 30),
        y: Math.max(0, m.y - 30),
        width: m.width + 60,
        height: m.height + 60,
        scale: 2
      };
      const crop = await send('Page.captureScreenshot', {
        format: 'png',
        clip: clip
      });
      const cropPath = path.join(ARTIFACT_DIR, 'mascot-zoom-crop.png');
      fs.writeFileSync(cropPath, Buffer.from(crop.data, 'base64'));
      console.log('[SAVED CROP]:', cropPath);
    }

    // Also full screenshot
    const full = await send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(ARTIFACT_DIR, 'screenshot-desktop-1440.png');
    fs.writeFileSync(fullPath, Buffer.from(full.data, 'base64'));
    console.log('[SAVED FULL]:', fullPath);

  } finally {
    if (ws) ws.close();
    if (chromeProcess) chromeProcess.kill();
  }
}

main().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
