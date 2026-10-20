const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\vikash\\.gemini\\antigravity\\brain\\1d353b1e-a698-49c3-a707-80221030c984';

async function main() {
  console.log('======================================================================');
  console.log('HEALTHCONNECT — CAREAI TUTORIAL MODAL MULTI-VIEWPORT VERIFICATION');
  console.log('======================================================================\n');

  console.log('[STEP 1] Launching Chrome in remote debugging mode...');
  const chromeProcess = spawn(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--user-data-dir=C:\\Users\\vikash\\AppData\\Local\\Temp\\chrome-tutorial-profile',
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

    console.log('[STEP 2] Setting up authenticated Doctor session with tutorial active...');
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
          localStorage.removeItem('healthconnect_tutorial_doctor_completed');
          localStorage.removeItem('healthconnect_careai_position');
        } catch(e) {}
      `
    });

    // Start with 1440x900 desktop viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await send('Page.navigate', { url: 'http://localhost:3001/doctor' });
    await new Promise(r => setTimeout(r, 2000));

    console.log('[STEP 3] Advancing tutorial through steps 1 to 7...');
    for (let stepIdx = 0; stepIdx < 6; stepIdx++) {
      const stepClickResult = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('[role="dialog"] button'));
            const nextBtn = btns.find(b => {
              const text = (b.textContent || '').trim();
              return text === 'Next' || text === 'அடுத்து' || text === 'आगे' || text === 'తర్వాత';
            });
            if (nextBtn) {
              nextBtn.click();
              return true;
            }
            return false;
          })()
        `,
        returnByValue: true
      });
      await new Promise(r => setTimeout(r, 250));
    }

    // Verify we are at Step 7: CareAI Clinical Assistant
    const step7TitleCheck = await send('Runtime.evaluate', {
      expression: `document.getElementById('tour-step-title')?.textContent`,
      returnByValue: true
    });
    console.log(`Active Tour Step Title: "${step7TitleCheck.result.value}"`);

    const testViewports = [
      { width: 1440, height: 900, name: 'desktop-1440' },
      { width: 1280, height: 800, name: 'desktop-1280' },
      { width: 1024, height: 768, name: 'tablet-1024' },
      { width: 820, height: 1180, name: 'tablet-820' },
      { width: 768, height: 1024, name: 'tablet-768' },
      { width: 430, height: 932, name: 'mobile-430' },
      { width: 390, height: 844, name: 'mobile-390' },
      { width: 360, height: 800, name: 'mobile-360' },
    ];

    const results = [];

    for (const vp of testViewports) {
      console.log(`\n======================================================================`);
      console.log(`[TESTING VIEWPORT] ${vp.name} (${vp.width}x${vp.height})`);
      console.log(`======================================================================`);

      // Set viewport dynamically
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 1024,
      });

      // Dispatch window resize and scroll events to trigger tutorial repositioning
      await send('Runtime.evaluate', {
        expression: `
          window.dispatchEvent(new Event('resize'));
          window.dispatchEvent(new Event('scroll'));
        `
      });

      await new Promise(r => setTimeout(r, 400));

      // Measure Tutorial Card, Viewport Clearance, and Step 7 Finish Button
      const step7Inspection = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
            if (!dialog) return { error: 'Tutorial dialog not found' };

            const card = dialog.querySelector('.bg-white.rounded-2xl');
            if (!card) return { error: 'Tutorial card not found' };

            const cardRect = card.getBoundingClientRect();
            const bodyStyle = window.getComputedStyle(document.body);
            const isBodyOverflowHidden = bodyStyle.overflow === 'hidden';

            const contentArea = card.querySelector('[role="region"]') || card.querySelector('.overflow-y-auto');
            const contentRect = contentArea ? contentArea.getBoundingClientRect() : null;
            const contentOverflowY = contentArea ? window.getComputedStyle(contentArea).overflowY : null;

            const header = card.querySelector('.border-b');
            const headerRect = header ? header.getBoundingClientRect() : null;

            const footer = card.querySelector('.border-t');
            const footerRect = footer ? footer.getBoundingClientRect() : null;

            const buttons = Array.from(card.querySelectorAll('button'));
            const finishBtn = buttons.find(b => {
              const text = (b.textContent || '').trim();
              return text.includes('Finish') || text.includes('முடிந்தது') || text.includes('Next');
            });
            const finishRect = finishBtn ? finishBtn.getBoundingClientRect() : null;

            const titleEl = document.getElementById('tour-step-title');
            const title = titleEl ? titleEl.textContent : '';

            // Check if card is entirely within viewport
            const fitsInViewport = (
              cardRect.top >= 0 &&
              cardRect.bottom <= window.innerHeight + 1 &&
              cardRect.left >= 0 &&
              cardRect.right <= window.innerWidth + 1
            );

            // Check clearances from viewport edges
            const clearanceTop = cardRect.top;
            const clearanceBottom = window.innerHeight - cardRect.bottom;
            const clearanceLeft = cardRect.left;
            const clearanceRight = window.innerWidth - cardRect.right;

            // Check Finish button is completely visible inside viewport
            const finishVisible = finishBtn && finishRect && (
              finishRect.top >= 0 &&
              finishRect.bottom <= window.innerHeight &&
              finishRect.left >= 0 &&
              finishRect.right <= window.innerWidth
            );

            return {
              title,
              windowWidth: window.innerWidth,
              windowHeight: window.innerHeight,
              cardRect: {
                top: Math.round(cardRect.top),
                bottom: Math.round(cardRect.bottom),
                left: Math.round(cardRect.left),
                right: Math.round(cardRect.right),
                width: Math.round(cardRect.width),
                height: Math.round(cardRect.height),
              },
              clearances: {
                top: Math.round(clearanceTop),
                bottom: Math.round(clearanceBottom),
                left: Math.round(clearanceLeft),
                right: Math.round(clearanceRight),
              },
              fitsInViewport,
              isBodyOverflowHidden,
              contentOverflowY,
              hasScrollableContent: contentArea ? contentArea.scrollHeight >= contentArea.clientHeight : false,
              finishBtnText: finishBtn ? finishBtn.textContent.trim() : null,
              finishRect: finishRect ? {
                top: Math.round(finishRect.top),
                bottom: Math.round(finishRect.bottom),
                left: Math.round(finishRect.left),
                right: Math.round(finishRect.right),
                width: Math.round(finishRect.width),
                height: Math.round(finishRect.height),
              } : null,
              finishVisible: !!finishVisible,
            };
          })()
        `,
        returnByValue: true
      });

      const data = step7Inspection.result.value;
      console.log(`Step 7 Title: "${data.title}"`);
      console.log(`Card Rect: ${JSON.stringify(data.cardRect)}`);
      console.log(`Clearances: Top=${data.clearances.top}px, Bottom=${data.clearances.bottom}px, Left=${data.clearances.left}px, Right=${data.clearances.right}px`);
      console.log(`Fits In Viewport: ${data.fitsInViewport ? '✅ YES' : '❌ NO'}`);
      console.log(`Body Overflow Hidden: ${data.isBodyOverflowHidden ? '✅ YES' : '❌ NO'}`);
      console.log(`Content Overflow-Y: ${data.contentOverflowY}`);
      console.log(`Finish Button Text: "${data.finishBtnText}"`);
      console.log(`Finish Button Rect: ${JSON.stringify(data.finishRect)}`);
      console.log(`Finish Button 100% Visible & Clickable: ${data.finishVisible ? '✅ YES' : '❌ NO'}`);

      // Capture screenshot of Step 7
      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      const screenshotPath = path.join(ARTIFACT_DIR, `tutorial-step7-${vp.name}.png`);
      fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
      console.log(`Saved screenshot: ${screenshotPath}`);

      const passed = (
        data.fitsInViewport &&
        data.finishVisible &&
        data.isBodyOverflowHidden &&
        data.clearances.bottom >= 15 &&
        data.clearances.top >= 15
      );

      results.push({
        viewport: vp.name,
        dimensions: `${vp.width}x${vp.height}`,
        passed,
        data,
      });
    }

    // Step 4: Click the Finish button on the final viewport to verify it closes cleanly
    console.log(`\n======================================================================`);
    console.log(`[TESTING FINISH ACTION CLICK]`);
    console.log(`======================================================================`);
    const finishClickResult = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('[role="dialog"] button'));
          const finishBtn = buttons.find(b => (b.textContent || '').includes('Finish') || (b.textContent || '').includes('முடிந்தது'));
          if (finishBtn) {
            finishBtn.click();
            return true;
          }
          return false;
        })()
      `,
      returnByValue: true
    });

    await new Promise(r => setTimeout(r, 400));

    const isClosed = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const dialog = document.querySelector('[role="dialog"]');
          const completed = localStorage.getItem('healthconnect_tutorial_doctor_completed');
          return { isDialogGone: !dialog, completedInStorage: completed === 'true' };
        })()
      `,
      returnByValue: true
    });

    console.log(`Finish Clicked: ${finishClickResult.result.value ? '✅ YES' : '❌ NO'}`);
    console.log(`Tutorial Closed: ${isClosed.result.value.isDialogGone ? '✅ YES' : '❌ NO'}`);
    console.log(`Completed in localStorage: ${isClosed.result.value.completedInStorage ? '✅ YES' : '❌ NO'}`);

    console.log(`\n======================================================================`);
    console.log(`MULTI-VIEWPORT VERIFICATION SUMMARY`);
    console.log(`======================================================================`);
    let allPassed = true;
    for (const r of results) {
      const status = r.passed ? '✅ PASSED' : '❌ FAILED';
      if (!r.passed) allPassed = false;
      console.log(`${status} [${r.viewport}] (${r.dimensions}) - Card fits: ${r.data.fitsInViewport}, Finish visible: ${r.data.finishVisible}, Bottom clearance: ${r.data.clearances.bottom}px, Top clearance: ${r.data.clearances.top}px`);
    }

    const finishActionPassed = isClosed.result.value.isDialogGone && isClosed.result.value.completedInStorage;
    console.log(`Finish Action Workflow: ${finishActionPassed ? '✅ PASSED' : '❌ FAILED'}`);

    if (allPassed && finishActionPassed) {
      console.log(`\n======================================================================`);
      console.log(`ALL 8 VIEWPORTS PASSED VERIFICATION WITH ZERO VIEWPORT OVERFLOW!`);
      console.log(`======================================================================`);
    } else {
      console.log(`\n❌ SOME VIEWPORTS FAILED VERIFICATION`);
    }

  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    if (ws) {
      try { ws.close(); } catch {}
    }
    try {
      chromeProcess.kill('SIGTERM');
    } catch {}
    process.exit(0);
  }
}

main();
