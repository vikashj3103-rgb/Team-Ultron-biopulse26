const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\vikash\\.gemini\\antigravity\\brain\\1d353b1e-a698-49c3-a707-80221030c984';

// Safety timeout: 30s
const hardTimeout = setTimeout(() => {
  console.error('[FATAL] Visual inspection script exceeded 30s timeout');
  process.exit(1);
}, 30000);
hardTimeout.unref();

async function main() {
  console.log('[STEP 1] Launching Chrome for visual verification...');
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
      } catch (e) {
        console.error('Error handling WS msg:', e);
      }
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    await send('Page.enable');
    await send('DOM.enable');
    await send('CSS.enable');

    // Make sure we are at /doctor
    await send('Page.navigate', { url: 'http://localhost:3001/doctor' });
    await new Promise(r => setTimeout(r, 1500));

    // Ensure session is set to doctor so we see the actual clinical layout
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

    async function captureViewport(width, height, filename) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 1024,
      });
      await new Promise(r => setTimeout(r, 500));

      const screenshotResult = await send('Page.captureScreenshot', { format: 'png' });
      const buffer = Buffer.from(screenshotResult.data, 'base64');
      const outPath = path.join(ARTIFACT_DIR, filename);
      fs.writeFileSync(outPath, buffer);
      console.log(`[CAPTURE] Saved screenshot: ${outPath} (${width}x${height})`);

      // Evaluate visual styles of key elements
      const inspect = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const btn = document.querySelector('[data-tour="careai-launcher"]');
            const btnRect = btn ? btn.getBoundingClientRect() : null;
            const btnComputed = btn ? window.getComputedStyle(btn) : null;
            const bottomNav = document.querySelector('nav[aria-label="Doctor navigation"]');
            const bottomNavRect = bottomNav ? bottomNav.getBoundingClientRect() : null;
            const sidebar = document.querySelector('aside');
            const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
            const sidebarComputed = sidebar ? window.getComputedStyle(sidebar) : null;
            const header = document.querySelector('header');
            const activeNav = document.querySelector('aside a[class*="bg-[#2563EB]"], aside a[class*="bg-blue"]');

            return {
              viewport: { width: window.innerWidth, height: window.innerHeight },
              careAi: {
                exists: !!btn,
                x: btnRect ? Math.round(btnRect.x) : null,
                y: btnRect ? Math.round(btnRect.y) : null,
                width: btnRect ? Math.round(btnRect.width) : null,
                height: btnRect ? Math.round(btnRect.height) : null,
                bgColor: btnComputed ? btnComputed.backgroundColor : null,
                borderColor: btnComputed ? btnComputed.borderColor : null,
                color: btnComputed ? btnComputed.color : null,
                boxShadow: btnComputed ? btnComputed.boxShadow : null,
              },
              bottomNav: {
                exists: !!bottomNav,
                visible: bottomNavRect ? (bottomNavRect.width > 0 && bottomNavRect.height > 0) : false,
                rect: bottomNavRect ? {
                  x: Math.round(bottomNavRect.x),
                  y: Math.round(bottomNavRect.y),
                  width: Math.round(bottomNavRect.width),
                  height: Math.round(bottomNavRect.height),
                } : null,
              },
              sidebar: {
                exists: !!sidebar,
                visible: sidebarRect ? (sidebarRect.width > 0 && sidebarRect.right > 0) : false,
                width: sidebarRect ? Math.round(sidebarRect.width) : null,
                bgColor: sidebarComputed ? sidebarComputed.backgroundColor : null,
              },
              activeNav: {
                exists: !!activeNav,
                bgColor: activeNav ? window.getComputedStyle(activeNav).backgroundColor : null,
              },
              mascot: {
                exists: !!document.querySelector('[data-tour="careai-mascot"]'),
                rect: document.querySelector('[data-tour="careai-mascot"]')?.getBoundingClientRect() ? {
                  x: Math.round(document.querySelector('[data-tour="careai-mascot"]').getBoundingClientRect().x),
                  y: Math.round(document.querySelector('[data-tour="careai-mascot"]').getBoundingClientRect().y),
                  width: Math.round(document.querySelector('[data-tour="careai-mascot"]').getBoundingClientRect().width),
                  height: Math.round(document.querySelector('[data-tour="careai-mascot"]').getBoundingClientRect().height),
                } : null,
                svgElements: Array.from(document.querySelectorAll('[data-tour="careai-mascot"] svg *')).map(el => ({
                  tag: el.tagName,
                  fill: el.getAttribute('fill'),
                  stroke: el.getAttribute('stroke')
                }))
              }
            };
          })()
        `,
        returnByValue: true
      });

      console.log(`[INSPECT ${width}x${height}]:`, JSON.stringify(inspect.result.value, null, 2));
      return inspect.result.value;
    }

    console.log('[STEP 2] Inspecting Desktop 1440px...');
    const d1440 = await captureViewport(1440, 900, 'screenshot-desktop-1440.png');

    console.log('[STEP 3] Inspecting Desktop 1280px...');
    const d1280 = await captureViewport(1280, 800, 'screenshot-desktop-1280.png');

    console.log('[STEP 4] Inspecting Tablet 820px...');
    const t820 = await captureViewport(820, 1180, 'screenshot-tablet-820.png');

    console.log('[STEP 5] Inspecting Mobile 390px...');
    const m390 = await captureViewport(390, 844, 'screenshot-mobile-390.png');

    console.log('[SUCCESS] All real-browser visual captures and inspections completed successfully!');
  } finally {
    if (ws) ws.close();
    if (chromeProcess) chromeProcess.kill();
  }
}

main().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
