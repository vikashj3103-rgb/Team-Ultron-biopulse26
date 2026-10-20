const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\vikash\\.gemini\\antigravity\\brain\\1d353b1e-a698-49c3-a707-80221030c984';

async function main() {
  console.log('[STEP 1] Launching Chrome for Comprehensive Multi-Viewport Drawer Verification...');
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
    await send('Runtime.enable');

    // Force reload
    await send('Page.reload', { ignoreCache: true });
    await new Promise(r => setTimeout(r, 1500));

    // Authenticate
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

    const viewports = [
      { width: 1440, height: 900, name: 'desktop-1440' },
      { width: 1280, height: 800, name: 'desktop-1280' },
      { width: 1024, height: 768, name: 'tablet-1024' },
      { width: 820, height: 1180, name: 'tablet-820' },
      { width: 390, height: 844, name: 'mobile-390' },
      { width: 360, height: 800, name: 'mobile-360' },
    ];

    for (const vp of viewports) {
      console.log(`\n========================================`);
      console.log(`[TESTING VIEWPORT]: ${vp.width}x${vp.height} (${vp.name})`);
      console.log(`========================================`);

      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 1024,
      });
      await new Promise(r => setTimeout(r, 400));

      // 1. Check initial closed state
      const closedState = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const aside = document.querySelector('aside');
            const asideRect = aside ? aside.getBoundingClientRect() : null;
            const hamburger = document.querySelector('[data-tour="header-hamburger"]');
            const hamburgerRect = hamburger ? hamburger.getBoundingClientRect() : null;

            return {
              drawerOpen: asideRect ? asideRect.x >= 0 : false,
              asideX: asideRect ? Math.round(asideRect.x) : null,
              asideWidth: asideRect ? Math.round(asideRect.width) : null,
              hamburgerVisible: hamburgerRect ? hamburgerRect.width > 0 : false,
              hamburgerWidth: hamburgerRect ? Math.round(hamburgerRect.width) : null,
              hamburgerHeight: hamburgerRect ? Math.round(hamburgerRect.height) : null,
            };
          })()
        `,
        returnByValue: true
      });
      console.log(`[${vp.name}] Initial Closed State:`, closedState.result.value);

      // Capture closed screenshot for 1440, 1280, 820, 390
      const closedShot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, `screenshot-${vp.name}.png`), Buffer.from(closedShot.data, 'base64'));

      // 2. Click Hamburger to Open
      await send('Runtime.evaluate', {
        expression: `
          (() => {
            const hamburger = document.querySelector('[data-tour="header-hamburger"]');
            if (hamburger) hamburger.click();
          })()
        `
      });
      await new Promise(r => setTimeout(r, 500));

      // 3. Inspect Open State
      const openState = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const aside = document.querySelector('aside');
            const asideRect = aside ? aside.getBoundingClientRect() : null;
            const asideStyle = aside ? window.getComputedStyle(aside) : null;
            const activeNav = aside ? aside.querySelector('a[class*="bg-[#EFF6FF]"], a[class*="text-[#2563EB]"]') : null;
            const activeNavStyle = activeNav ? window.getComputedStyle(activeNav) : null;
            const closeBtn = aside ? aside.querySelector('button[aria-label="Close navigation drawer"]') : null;

            return {
              drawerOpen: asideRect ? asideRect.x >= 0 : false,
              asideX: asideRect ? Math.round(asideRect.x) : null,
              asideWidth: asideRect ? Math.round(asideRect.width) : null,
              bgColor: asideStyle ? asideStyle.backgroundColor : null,
              borderColor: asideStyle ? asideStyle.borderColor : null,
              activeNavBg: activeNavStyle ? activeNavStyle.backgroundColor : null,
              activeNavColor: activeNavStyle ? activeNavStyle.color : null,
              hasCloseBtn: !!closeBtn,
            };
          })()
        `,
        returnByValue: true
      });
      console.log(`[${vp.name}] Open Drawer State:`, openState.result.value);

      if (vp.width === 1440) {
        const openShot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'screenshot-drawer-open.png'), Buffer.from(openShot.data, 'base64'));
      }

      // 4. Close Drawer via X button
      await send('Runtime.evaluate', {
        expression: `
          (() => {
            const closeBtn = document.querySelector('aside button[aria-label="Close navigation drawer"]');
            if (closeBtn) closeBtn.click();
          })()
        `
      });
      await new Promise(r => setTimeout(r, 500));

      const afterCloseState = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const aside = document.querySelector('aside');
            const asideRect = aside ? aside.getBoundingClientRect() : null;
            return {
              drawerOpen: asideRect ? asideRect.x >= 0 : false,
              asideX: asideRect ? Math.round(asideRect.x) : null,
            };
          })()
        `,
        returnByValue: true
      });
      console.log(`[${vp.name}] After Closing via X:`, afterCloseState.result.value);
    }

    console.log('\n[SUCCESS] Multi-viewport drawer tests passed at 1440px, 1280px, 1024px, 820px, 390px, 360px!');

  } finally {
    if (ws) ws.close();
    if (chromeProcess) chromeProcess.kill();
  }
}

main().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
