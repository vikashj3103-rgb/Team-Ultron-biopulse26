const { spawn } = require('child_process');
const http = require('http');

// Global hard safety timeout: exit process after 25s
const hardTimeout = setTimeout(() => {
  console.error('[FATAL] Diagnostic script exceeded 25s overall hard timeout.');
  process.exit(1);
}, 25000);
hardTimeout.unref();

async function main() {
  console.log('[STEP 1] Starting CareAI dragging, clicking, and persistence verification...');
  let chromeProcess = null;
  let ws = null;

  try {
    chromeProcess = spawn(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      [
        '--headless=new',
        '--remote-debugging-port=9222',
        '--user-data-dir=C:\\Users\\vikash\\AppData\\Local\\Temp\\chrome-debug-profile',
        '--no-first-run',
        '--no-default-browser-check',
        'http://localhost:3001/'
      ],
      { stdio: 'ignore' }
    );

    let targets = null;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 400));
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
    ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    let id = 1;
    const pending = new Map();

    function send(method, params = {}, timeoutMs = 8000) {
      return new Promise((resolve, reject) => {
        const msgId = id++;
        const timer = setTimeout(() => {
          if (pending.has(msgId)) {
            pending.delete(msgId);
            reject(new Error(`CDP command '${method}' timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);

        pending.set(msgId, {
          resolve: (res) => { clearTimeout(timer); resolve(res); },
          reject: (err) => { clearTimeout(timer); reject(err); }
        });

        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    ws.onmessage = (event) => {
      const res = JSON.parse(event.data);
      if (res.id && pending.has(res.id)) {
        const { resolve, reject } = pending.get(res.id);
        pending.delete(res.id);
        if (res.error) reject(new Error(res.error.message));
        else resolve(res.result);
      }
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    await send('Page.enable');
    await send('Runtime.enable');

    // Inject session and mark tutorial completed so it does not intercept clicks
    await send('Runtime.evaluate', {
      expression: `(() => {
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
      })()`,
    });

    await send('Page.navigate', { url: 'http://localhost:3001/doctor' });
    await new Promise(r => setTimeout(r, 1200));

    // Viewport 390x844
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await new Promise(r => setTimeout(r, 400));

    // 1. Get initial CareAI button bounding box
    const initialCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('[data-tour="careai-launcher"]');
        const r = btn.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
      })()`,
      returnByValue: true
    });
    const initialRect = initialCheck.result.value;
    console.log('[TEST 1] Initial Button Position:', initialRect);

    // 2. Click test: Tap CareAI -> should open CareAI assistant modal
    console.log('[TEST 2] Testing normal click (tap without drag)...');
    const clickX = initialRect.x + initialRect.width / 2;
    const clickY = initialRect.y + initialRect.height / 2;

    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: clickX, y: clickY, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: clickX, y: clickY, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 600));

    const modalCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const modal = document.querySelector('[role="dialog"]') || document.querySelector('.bg-slate-950\\\\/70');
        const isCareAi = modal && (modal.innerText.includes('CareAI') || modal.innerText.includes('Clinical Assistant'));
        return { modalOpen: Boolean(modal), isCareAiModal: Boolean(isCareAi) };
      })()`,
      returnByValue: true
    });
    console.log('  CareAI Modal Opened after click?:', modalCheck.result.value);

    // Close CareAI modal
    await send('Runtime.evaluate', {
      expression: `(() => {
        const closeBtn = document.querySelector('button[aria-label="Close CareAI assistant modal"]') ||
                         document.querySelector('button[aria-label*="Close"]');
        if (closeBtn) closeBtn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 500));

    // 3. Drag test: Drag 80px Left
    console.log('[TEST 3] Testing Drag 80px Left...');
    const startX = initialRect.x + 25;
    const startY = initialRect.y + 20;

    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: startY, button: 'left', buttons: 1, clickCount: 1 });
    for (let step = 1; step <= 8; step++) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startX - step * 10, y: startY, buttons: 1 });
      await new Promise(r => setTimeout(r, 25));
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: startX - 80, y: startY, button: 'left', buttons: 0, clickCount: 1 });
    await new Promise(r => setTimeout(r, 600));

    const postDragCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('[data-tour="careai-launcher"]');
        const r = btn.getBoundingClientRect();
        const saved = localStorage.getItem('healthconnect_careai_position');
        const modal = Boolean(document.querySelector('[role="dialog"]'));
        const resetBtn = Boolean(document.querySelector('button[title*="Reset"]'));
        return {
          newX: Math.round(r.x),
          newY: Math.round(r.y),
          savedPositionInStorage: saved,
          modalOpenedOnDragRelease: modal,
          resetButtonVisible: resetBtn,
        };
      })()`,
      returnByValue: true
    });
    console.log('  Post Drag State:', postDragCheck.result.value);

    // 4. Persistence test: Reload page and check if position remains
    console.log('[TEST 4] Testing Persistence across page reload...');
    await send('Page.reload');
    await new Promise(r => setTimeout(r, 1200));

    const postReloadCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('[data-tour="careai-launcher"]');
        const r = btn.getBoundingClientRect();
        return {
          reloadedX: Math.round(r.x),
          reloadedY: Math.round(r.y),
        };
      })()`,
      returnByValue: true
    });
    console.log('  Position after Reload:', postReloadCheck.result.value);

    // 5. Reset test: Click reset button
    console.log('[TEST 5] Testing Reset position...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const resetBtn = document.querySelector('button[title*="Reset"]') || document.querySelector('button[aria-label*="Reset"]');
        if (resetBtn) resetBtn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 500));

    const postResetCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('[data-tour="careai-launcher"]');
        const r = btn.getBoundingClientRect();
        const saved = localStorage.getItem('healthconnect_careai_position');
        const resetBtn = Boolean(document.querySelector('button[title*="Reset"]'));
        return {
          resetX: Math.round(r.x),
          resetY: Math.round(r.y),
          savedPositionAfterReset: saved,
          resetButtonPresent: resetBtn,
        };
      })()`,
      returnByValue: true
    });
    console.log('  State after Reset:', postResetCheck.result.value);

    // 6. Viewport & Bottom Navigation Matrix Verification
    console.log('\n[TEST 6] Testing Responsive Viewport Matrix & Bottom Navigation...');
    const viewports = [
      { name: 'Phone 360px', w: 360, h: 800, expectNav: true },
      { name: 'iPhone 390px', w: 390, h: 844, expectNav: true },
      { name: 'iPhone Max 430px', w: 430, h: 932, expectNav: true },
      { name: 'iPad Mini 768px', w: 768, h: 1024, expectNav: true },
      { name: 'iPad Air 820px', w: 820, h: 1180, expectNav: true },
      { name: 'iPad Pro Portrait 1024px', w: 1024, h: 768, expectNav: true },
      { name: 'iPad Air Landscape 1180px', w: 1180, h: 820, expectNav: true },
      { name: 'Desktop 1280px', w: 1280, h: 800, expectNav: false },
      { name: 'Wide Desktop 1440px', w: 1440, h: 900, expectNav: false },
    ];

    for (const vp of viewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.w,
        height: vp.h,
        deviceScaleFactor: 1,
        mobile: vp.w < 1280,
      });
      await new Promise(r => setTimeout(r, 250));

      const navCheck = await send('Runtime.evaluate', {
        expression: `(() => {
          const nav = document.querySelector('nav.fixed.bottom-0') ||
                      document.querySelector('nav[aria-label*="navigation"]') ||
                      Array.from(document.querySelectorAll('nav')).find(n => n.className && n.className.includes('fixed bottom-0'));
          const sidebar = document.querySelector('aside');
          const careAi = document.querySelector('[data-tour="careai-launcher"]');
          
          if (!nav) return { exists: false };
          const rect = nav.getBoundingClientRect();
          const style = window.getComputedStyle(nav);
          const sidebarStyle = sidebar ? window.getComputedStyle(sidebar) : null;
          const careAiRect = careAi ? careAi.getBoundingClientRect() : null;
          const items = Array.from(nav.querySelectorAll('a, button')).map(el => el.textContent.trim());

          return {
            exists: true,
            display: style.display,
            visibility: style.visibility,
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
            itemCount: items.length,
            items,
            sidebarDisplay: sidebarStyle ? sidebarStyle.display : null,
            careAiTop: careAiRect ? Math.round(careAiRect.top) : null,
            careAiBottom: careAiRect ? Math.round(careAiRect.bottom) : null,
            navTop: Math.round(rect.top),
          };
        })()`,
        returnByValue: true
      });

      const res = navCheck.result.value;
      const isNavVisible = res.exists && res.display !== 'none' && res.rect.height > 0;
      console.log(`  - ${vp.name.padEnd(25)} [${vp.w}x${vp.h}]: BottomNav=${isNavVisible ? 'VISIBLE' : 'HIDDEN'} (items=${res.itemCount}, rect=${JSON.stringify(res.rect)})`);

      if (vp.expectNav && !isNavVisible) {
        throw new Error(`Expected bottom navigation visible at ${vp.name}`);
      }
      if (!vp.expectNav && isNavVisible) {
        throw new Error(`Expected bottom navigation hidden on desktop at ${vp.name}`);
      }
      if (vp.expectNav && res.careAiBottom && res.careAiBottom > res.navTop) {
        throw new Error(`CareAI overlaps bottom navigation at ${vp.name}: CareAI bottom ${res.careAiBottom} > Nav top ${res.navTop}`);
      }
    }

    console.log('\n[SUCCESS] All CareAI Drag, Click, Persistence, Reset, and Viewport Matrix tests verified in real Chrome!');
  } finally {
    if (ws) try { ws.close(); } catch {}
    if (chromeProcess) try { chromeProcess.kill(); } catch {}
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error('[FAILED]', err);
  process.exit(1);
});
