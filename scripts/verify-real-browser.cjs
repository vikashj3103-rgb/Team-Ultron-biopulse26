const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let msgId = 100;
const pending = new Map();

function cdpSend(ws, method, params = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP method "${method}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    pending.set(id, {
      resolve: (val) => { clearTimeout(timer); resolve(val); },
      reject: (err) => { clearTimeout(timer); reject(err); },
    });

    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalInPage(ws, expression) {
  const result = await cdpSend(ws, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result?.result?.value;
}

async function main() {
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const chromePath = chromePaths.find(p => p && fs.existsSync(p));
  if (!chromePath) {
    console.error('Chrome executable not found on disk');
    process.exit(1);
  }

  const port = 9333;
  const userDataDir = path.join(process.cwd(), '.chrome-real-verify');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  console.log('1. Launching Chrome with remote debugging on port', port);
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    'http://localhost:3001/doctor',
  ], { stdio: 'ignore' });

  // Safety hard timeout (35s)
  const hardTimeout = setTimeout(() => {
    console.error('Hard test timeout reached (35s). Terminating process.');
    try { chromeProc.kill(); } catch {}
    process.exit(1);
  }, 35000);
  hardTimeout.unref();

  try {
    // Wait for Chrome endpoint
    let pageWsUrl = null;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        const targets = await new Promise((res, rej) => {
          http.get(`http://127.0.0.1:${port}/json`, (r) => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => {
              try { res(JSON.parse(d)); } catch (e) { rej(e); }
            });
          }).on('error', rej);
        });
        const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) {
          pageWsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {}
    }

    if (!pageWsUrl) throw new Error('Could not find active page target');
    console.log('2. Connected to Chrome browser page endpoint.');

    const pageWs = new WebSocket(pageWsUrl);
    pageWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && pending.has(msg.id)) {
          const { resolve, reject } = pending.get(msg.id);
          pending.delete(msg.id);
          if (msg.error) reject(new Error(`CDP Error: ${JSON.stringify(msg.error)}`));
          else resolve(msg.result);
        }
      } catch (e) {
        // ignore
      }
    };

    await new Promise((res, rej) => {
      pageWs.onopen = res;
      pageWs.onerror = rej;
    });
    console.log('3. Opened target page: http://localhost:3001/doctor');

    await cdpSend(pageWs, 'Page.enable');
    await cdpSend(pageWs, 'DOM.enable');
    await cdpSend(pageWs, 'Runtime.enable');

    // Inject session and navigate to /doctor
    await evalInPage(pageWs, `
      (() => {
        const docUser = {
          id: 'user-doc-arun',
          name: 'Dr. Arun Kumar',
          email: 'doctor.cardio@careconnect.demo',
          role: 'doctor',
          phone: '+91 98401 23456',
          createdAt: new Date().toISOString(),
          assignedDoctorId: 'doc-arun'
        };
        localStorage.setItem('careconnect_auth_session_v2', JSON.stringify(docUser));
        localStorage.setItem('careconnect_user', JSON.stringify(docUser));
        localStorage.setItem('healthconnect_tutorial_doctor_completed', 'true');
        localStorage.removeItem('healthconnect_careai_position');
        return 'ready';
      })()
    `);

    await cdpSend(pageWs, 'Page.navigate', { url: 'http://localhost:3001/doctor' });
    await sleep(2000);

    console.log('\n============================================================');
    console.log('4. TESTING VIEWPORT MATRIX (360, 390, 430, 768, 820, 1024, 1180, 1280, 1440px)');
    console.log('============================================================');

    const currentUrl = await evalInPage(pageWs, 'window.location.href');
    console.log('Current Browser URL:', currentUrl);
    const bodySample = await evalInPage(pageWs, 'document.body.innerText.slice(0, 200)');
    console.log('Page Text Sample:', bodySample);

    const viewports = [
      { name: 'Phone 360px', w: 360, h: 800, expectNav: true, screenshot: null },
      { name: 'iPhone 390px', w: 390, h: 844, expectNav: true, screenshot: 'scripts/verify-phone-390.png' },
      { name: 'iPhone Max 430px', w: 430, h: 932, expectNav: true, screenshot: null },
      { name: 'iPad Mini 768px', w: 768, h: 1024, expectNav: true, screenshot: null },
      { name: 'iPad Air 820px', w: 820, h: 1180, expectNav: true, screenshot: 'scripts/verify-tablet-820.png' },
      { name: 'iPad Pro Portrait 1024px', w: 1024, h: 768, expectNav: true, screenshot: 'scripts/verify-tablet-1024.png' },
      { name: 'iPad Air Landscape 1180px', w: 1180, h: 820, expectNav: true, screenshot: null },
      { name: 'Desktop 1280px', w: 1280, h: 800, expectNav: false, screenshot: null },
      { name: 'Wide Desktop 1440px', w: 1440, h: 900, expectNav: false, screenshot: 'scripts/verify-desktop-1440.png' },
    ];

    for (const vp of viewports) {
      await cdpSend(pageWs, 'Emulation.setDeviceMetricsOverride', {
        width: vp.w,
        height: vp.h,
        deviceScaleFactor: 1,
        mobile: vp.w < 1280,
      });
      await sleep(350);

      const navInfo = await evalInPage(pageWs, `
        (() => {
          const nav = document.querySelector('nav[aria-label*="navigation"]') ||
                      document.querySelector('nav.fixed.bottom-0') ||
                      document.querySelector('nav[aria-label="Doctor navigation"]');
          if (!nav) return { exists: false };
          const rect = nav.getBoundingClientRect();
          const style = window.getComputedStyle(nav);
          const items = Array.from(nav.querySelectorAll('a, button')).map(el => el.textContent.trim());
          const careAi = document.querySelector('button[data-tour="careai-launcher"]');
          const careAiRect = careAi ? careAi.getBoundingClientRect() : null;
          return {
            exists: true,
            display: style.display,
            visibility: style.visibility,
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
            itemCount: items.length,
            items,
            careAiTop: careAiRect ? Math.round(careAiRect.top) : null,
            careAiBottom: careAiRect ? Math.round(careAiRect.bottom) : null,
            navTop: Math.round(rect.top),
          };
        })()
      `);

      const isNavVisible = navInfo && navInfo.exists && navInfo.display !== 'none' && navInfo.rect.h > 0;
      console.log('DEBUG navInfo:', JSON.stringify(navInfo));
      console.log(`- ${vp.name.padEnd(26)} [${vp.w}x${vp.h}]: BottomNav=${isNavVisible ? 'VISIBLE' : 'HIDDEN'} (expected ${vp.expectNav ? 'VISIBLE' : 'HIDDEN'})`);

      if (vp.expectNav) {
        if (!isNavVisible) throw new Error(`Expected bottom navigation visible at ${vp.name}`);
        if (navInfo.itemCount !== 5) throw new Error(`Expected 5 nav destinations, found ${navInfo.itemCount}`);
        if (navInfo.careAiBottom && navInfo.careAiBottom > navInfo.navTop) {
          throw new Error(`CareAI overlapping bottom navigation: CareAI bottom ${navInfo.careAiBottom} > Nav top ${navInfo.navTop}`);
        }
      }

      if (vp.screenshot) {
        const shot = await cdpSend(pageWs, 'Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(process.cwd(), vp.screenshot), Buffer.from(shot.data, 'base64'));
        console.log(`  -> Saved screenshot to ${vp.screenshot}`);
      }
    }

    console.log('\n============================================================');
    console.log('5. TESTING CLICK VS DRAG DISAMBIGUATION & PERSISTENCE (390px)');
    console.log('============================================================');

    await cdpSend(pageWs, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await sleep(300);

    // Get CareAI button bounding box
    const initialCareAi = await evalInPage(pageWs, `
      (() => {
        const btn = document.querySelector('button[data-tour="careai-launcher"]');
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        return {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          centerX: Math.round(rect.left + rect.width / 2),
          centerY: Math.round(rect.top + rect.height / 2),
        };
      })()
    `);
    console.log('Initial CareAI Position:', initialCareAi);

    // 5A. CLICK TEST: Pointer down and up at same coordinate (<= 6px)
    console.log('\n[TEST 5A: Single Click / Tap -> Opens Modal]');
    await cdpSend(pageWs, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: initialCareAi.centerX,
      y: initialCareAi.centerY,
      button: 'left',
      buttons: 1,
      clickCount: 1,
    });
    await sleep(50);
    await cdpSend(pageWs, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: initialCareAi.centerX,
      y: initialCareAi.centerY,
      button: 'left',
      buttons: 0,
      clickCount: 1,
    });
    await sleep(500);

    const isModalOpenAfterClick = await evalInPage(pageWs, `
      Boolean(document.querySelector('div[role="dialog"]'))
    `);
    console.log('Modal opened on click:', isModalOpenAfterClick);
    if (!isModalOpenAfterClick) throw new Error('CareAI modal failed to open on single click');

    // Close modal via close button or escape
    await evalInPage(pageWs, `
      const closeBtn = document.querySelector('button[aria-label="Close dialog"]') ||
                       document.querySelector('button[aria-label="Close"]') ||
                       document.querySelector('div[role="dialog"] button');
      if (closeBtn) closeBtn.click();
    `);
    await sleep(500);

    // 5B. DRAG TEST: Pointer down, move 120px to the left, pointer up (> 6px)
    console.log('\n[TEST 5B: Mouse Drag (> 6px displacement) -> Moves Button, Suppresses Modal]');
    const startX = initialCareAi.centerX;
    const startY = initialCareAi.centerY;
    const targetX = startX - 120;
    const targetY = startY;

    // Press down
    await cdpSend(pageWs, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: startX,
      y: startY,
      button: 'left',
      buttons: 1,
      clickCount: 1,
    });
    await sleep(30);

    // Move in intermediate steps to simulate realistic mouse dragging
    for (let i = 1; i <= 6; i++) {
      const curX = Math.round(startX + ((targetX - startX) * i) / 6);
      const curY = Math.round(startY + ((targetY - startY) * i) / 6);
      await cdpSend(pageWs, 'Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: curX,
        y: curY,
        buttons: 1,
      });
      await sleep(25);
    }

    // Release mouse
    await cdpSend(pageWs, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: targetX,
      y: targetY,
      button: 'left',
      buttons: 0,
      clickCount: 1,
    });
    await sleep(500);

    const dragResult = await evalInPage(pageWs, `
      (() => {
        const btn = document.querySelector('button[data-tour="careai-launcher"]');
        const modal = document.querySelector('div[role="dialog"]');
        const resetBtn = document.querySelector('button[aria-label="Reset CareAI button position to default"]');
        const savedStorage = localStorage.getItem('healthconnect_careai_position');
        const rect = btn ? btn.getBoundingClientRect() : null;
        return {
          modalOpen: Boolean(modal),
          resetVisible: Boolean(resetBtn),
          savedStorage,
          newLeft: rect ? Math.round(rect.left) : null,
          newTop: rect ? Math.round(rect.top) : null,
        };
      })()
    `);

    console.log('After Drag Status:', dragResult);
    if (dragResult.modalOpen) throw new Error('CareAI modal opened on drag release! Expected suppressed.');
    if (!dragResult.savedStorage) throw new Error('Position was not saved to localStorage on drag release!');
    if (!dragResult.resetVisible) throw new Error('Reset button is not visible after custom position set!');
    console.log('Drag verified: button moved from', initialCareAi.left, 'to', dragResult.newLeft, '; modal remained closed.');

    // 5C. PERSISTENCE TEST ACROSS PAGE RELOAD
    console.log('\n[TEST 5C: Persistence Across Page Reload]');
    await cdpSend(pageWs, 'Page.reload');
    await sleep(2000);

    const reloadedResult = await evalInPage(pageWs, `
      (() => {
        const btn = document.querySelector('button[data-tour="careai-launcher"]');
        const rect = btn ? btn.getBoundingClientRect() : null;
        const savedStorage = localStorage.getItem('healthconnect_careai_position');
        return {
          left: rect ? Math.round(rect.left) : null,
          top: rect ? Math.round(rect.top) : null,
          savedStorage,
        };
      })()
    `);
    console.log('Reloaded Position:', reloadedResult);
    if (Math.abs(reloadedResult.left - dragResult.newLeft) > 5) {
      throw new Error(`Position was not retained after reload: expected ~${dragResult.newLeft}, got ${reloadedResult.left}`);
    }

    // 5D. RESET TEST
    console.log('\n[TEST 5D: Position Reset]');
    await evalInPage(pageWs, `
      const resetBtn = document.querySelector('button[aria-label="Reset CareAI button position to default"]');
      if (resetBtn) resetBtn.click();
    `);
    await sleep(500);

    const postResetResult = await evalInPage(pageWs, `
      (() => {
        const btn = document.querySelector('button[data-tour="careai-launcher"]');
        const rect = btn ? btn.getBoundingClientRect() : null;
        const savedStorage = localStorage.getItem('healthconnect_careai_position');
        const resetBtn = document.querySelector('button[aria-label="Reset CareAI button position to default"]');
        return {
          left: rect ? Math.round(rect.left) : null,
          top: rect ? Math.round(rect.top) : null,
          savedStorage,
          resetVisible: Boolean(resetBtn),
        };
      })()
    `);
    console.log('Post-Reset Position:', postResetResult);
    if (postResetResult.savedStorage) throw new Error('localStorage key was not cleared on reset!');
    if (postResetResult.resetVisible) throw new Error('Reset button still visible after reset!');
    if (Math.abs(postResetResult.left - initialCareAi.left) > 5) {
      throw new Error(`Position did not return to default: expected ~${initialCareAi.left}, got ${postResetResult.left}`);
    }

    console.log('\n============================================================');
    console.log('ALL REAL BROWSER VERIFICATIONS COMPLETED SUCCESSFULLY 100%!');
    console.log('============================================================\n');

  } finally {
    clearTimeout(hardTimeout);
    try { chromeProc.kill(); } catch {}
  }
}

main().catch((err) => {
  console.error('\n❌ Real Browser Verification Failed:', err);
  process.exit(1);
});
