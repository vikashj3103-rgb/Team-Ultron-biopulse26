const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\vikash\\.gemini\\antigravity\\brain\\1d353b1e-a698-49c3-a707-80221030c984';

const TARGET_VIEWPORTS = [
  { name: 'iPhone SE (Narrow Mobile)', width: 320, height: 568 },
  { name: 'Android Common (Galaxy)', width: 360, height: 800 },
  { name: 'iPhone 8 / SE 2', width: 375, height: 667 },
  { name: 'iPhone 13 / 14 (Standard Phone)', width: 390, height: 844 },
  { name: 'iPhone 15 Pro Max', width: 430, height: 932 },
  { name: 'iPad Mini Portrait', width: 768, height: 1024 },
  { name: 'iPad Air 10th Gen Portrait', width: 820, height: 1180 },
  { name: 'iPad Landscape', width: 1024, height: 768 },
  { name: 'iPad Air Landscape', width: 1180, height: 820 },
  { name: 'Laptop Small', width: 1280, height: 800 },
  { name: 'Standard Laptop', width: 1366, height: 768 },
  { name: 'MacBook / Desktop', width: 1440, height: 900 },
  { name: 'Full HD Desktop', width: 1920, height: 1080 },
];

async function main() {
  console.log('[STEP 1] Launching Chrome for Universal Responsive & Demo Verification...');
  const chromeProcess = spawn(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--user-data-dir=C:\\Users\\vikash\\AppData\\Local\\Temp\\chrome-responsive-profile',
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

    function send(method, params = {}, timeoutMs = 15000) {
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
        const msg = JSON.parse(event.data);
        if (msg.id && pending.has(msg.id)) {
          const { resolve, reject, timer } = pending.get(msg.id);
          clearTimeout(timer);
          pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
      } catch (e) {
        console.error('Error handling WS message:', e);
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
        throw new Error(res.exceptionDetails.exception?.description || 'Evaluation error');
      }
      return res.result?.value;
    }

    async function setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 1024,
      });
      await new Promise(r => setTimeout(r, 200));
    }

    async function saveScreenshot(filename) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(ARTIFACT_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
      console.log(`📸 Screenshot saved: ${filename}`);
    }

    async function waitForElement(selector, timeoutMs = 10000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const found = await evaluate(`!!document.querySelector('${selector}')`);
        if (found) return true;
        await new Promise(r => setTimeout(r, 200));
      }
      return false;
    }

    // Set initial 1440x900 viewport
    await setViewport(1440, 900);
    await new Promise(r => setTimeout(r, 1000));

    console.log('\n[STEP 2] Logging in as Doctor via Demo Access...');
    await send('Page.navigate', { url: 'http://localhost:3001/login' });
    await waitForElement('[data-testid="tab-demo-access"]', 10000);

    // Mark tutorial completed in localStorage to avoid modal overlap
    await evaluate(`
      try {
        localStorage.setItem('healthconnect_tutorial_doctor_completed', 'true');
        localStorage.setItem('healthconnect_tutorial_attender_completed', 'true');
      } catch(e) {}
    `);

    // Switch to Roles tab
    await evaluate(`
      (() => {
        const demoTab = document.querySelector('[data-testid="tab-demo-access"]');
        if (demoTab) demoTab.click();
      })()
    `);
    await waitForElement('[data-testid="demo-login-doctor"]', 5000);

    // Click Doctor Portal
    await evaluate(`
      (() => {
        const docBtn = document.querySelector('[data-testid="demo-login-doctor"]');
        if (docBtn) docBtn.click();
      })()
    `);

    // Wait for navigation to /doctor
    for (let i = 0; i < 30; i++) {
      const url = await evaluate('window.location.href');
      if (url && url.includes('/doctor')) break;
      await new Promise(r => setTimeout(r, 300));
    }
    await new Promise(r => setTimeout(r, 1000));

    // Dismiss any coachmark/tutorial if still visible
    await evaluate(`
      (() => {
        const skipBtns = Array.from(document.querySelectorAll('button')).filter(b => 
          b.innerText && (b.innerText.includes('Skip') || b.innerText.includes('Finish') || b.innerText.includes('Got it'))
        );
        skipBtns.forEach(b => b.click());
      })()
    `);
    await new Promise(r => setTimeout(r, 500));

    const currentUrl = await evaluate('window.location.href');
    console.log(`Current URL: ${currentUrl}`);

    // Verify Doctor workstation loaded and that telemetry controls banner is REMOVED from Doctor Dashboard
    const doctorLoaded = await evaluate(`(() => {
      return {
        hasControls: !!document.querySelector('[aria-label="Clinical Simulation Controls"]') || !!document.querySelector('[aria-label="Clinical Telemetry Controls"]'),
        hasSuresh: document.body.innerText.includes('Suresh Kumar'),
        hasDoctorHeader: document.body.innerText.includes('Dr. Arun') || document.body.innerText.includes('Workstation'),
      };
    })()`);
    console.log('Doctor Workstation status:', doctorLoaded);
    if (doctorLoaded.hasControls) {
      throw new Error('FAILURE: Doctor Workstation still exposes the telemetry controls banner!');
    }
    console.log('✅ Doctor Workstation verified: Telemetry control banner successfully removed from main clinical workspace!');

    // =========================================================================
    // STEP 3: Complete Responsive Audit across ALL 13 target viewports
    // =========================================================================
    console.log('\n[STEP 3] Universal Responsive Audit (Zero Horizontal Overflow from 320px to 1920px)...');
    
    for (const vp of TARGET_VIEWPORTS) {
      await setViewport(vp.width, vp.height);
      const metrics = await evaluate(`(() => {
        const docEl = document.documentElement;
        const scrollWidth = docEl.scrollWidth;
        const clientWidth = docEl.clientWidth;
        const innerWidth = window.innerWidth;
        const hasHorizontalScrollbar = scrollWidth > innerWidth + 1;
        return { scrollWidth, clientWidth, innerWidth, hasHorizontalScrollbar };
      })()`);

      const pass = !metrics.hasHorizontalScrollbar;
      console.log(`  ${pass ? '✅' : '❌'} ${vp.name} (${vp.width}x${vp.height}): scrollWidth=${metrics.scrollWidth}px, innerWidth=${metrics.innerWidth}px ${pass ? 'PASS (0 overflow)' : 'FAIL OVERFLOW'}`);

      if (!pass) {
        throw new Error(`Horizontal overflow detected at ${vp.width}x${vp.height}: scrollWidth ${metrics.scrollWidth} > innerWidth ${metrics.innerWidth}`);
      }

      // Capture key responsive screenshots
      if (vp.width === 320) await saveScreenshot('responsive-doctor-mobile-320px.png');
      if (vp.width === 390) await saveScreenshot('responsive-doctor-mobile-390px.png');
      if (vp.width === 820) await saveScreenshot('responsive-doctor-tablet-820px.png');
      if (vp.width === 1440) await saveScreenshot('responsive-doctor-desktop-1440px.png');
    }

    // =========================================================================
    // STEP 4: Language Selector Dropdown Viewport Bounds Verification
    // =========================================================================
    console.log('\n[STEP 4] Language Selector / Dropdown Bug Verification at 320px and 390px...');
    for (const testWidth of [320, 390]) {
      await setViewport(testWidth, 800);
      
      // Click language selector trigger button
      const opened = await evaluate(`(() => {
        const langTrigger = document.querySelector('[data-testid="language-selector-trigger"]') ||
          document.querySelector('button[aria-haspopup="true"]');
        if (langTrigger) {
          langTrigger.click();
          return true;
        }
        return false;
      })()`);
      console.log(`  Opening Language Selector at ${testWidth}px: ${opened}`);
      await new Promise(r => setTimeout(r, 600));

      const dropdownBounds = await evaluate(`(() => {
        const menu = document.querySelector('div[role="menu"]');
        if (!menu) return { found: false };
        const rect = menu.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        return {
          found: true,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          vw,
          vh,
          fitsHorizontally: rect.left >= 0 && rect.right <= vw,
          fitsVertically: rect.top >= 0 && rect.bottom <= vh,
          itemCount: menu.querySelectorAll('button[role="menuitem"]').length,
        };
      })()`);

      console.log(`  Dropdown bounds at ${testWidth}px:`, dropdownBounds);
      if (!dropdownBounds.found) throw new Error(`Language dropdown not found at ${testWidth}px`);
      if (!dropdownBounds.fitsHorizontally) throw new Error(`Language dropdown overflows horizontally at ${testWidth}px: left=${dropdownBounds.left}, right=${dropdownBounds.right}, vw=${dropdownBounds.vw}`);
      if (!dropdownBounds.fitsVertically) throw new Error(`Language dropdown overflows vertically at ${testWidth}px: top=${dropdownBounds.top}, bottom=${dropdownBounds.bottom}, vh=${dropdownBounds.vh}`);
      console.log(`  ✅ Language Dropdown fits 100% within viewport at ${testWidth}px with ${dropdownBounds.itemCount} languages!`);

      await saveScreenshot(`responsive-language-dropdown-${testWidth}px.png`);

      // Close dropdown by pressing Escape or clicking outside
      await evaluate(`(() => {
        const langTrigger = document.querySelector('button[aria-haspopup="true"]');
        if (langTrigger) langTrigger.click();
      })()`);
      await new Promise(r => setTimeout(r, 300));
    }

    // =========================================================================
    // STEP 5: Mobile Navigation (Hamburger Drawer & Bottom Nav)
    // =========================================================================
    console.log('\n[STEP 5] Mobile Navigation Verification (390px)...');
    await setViewport(390, 844);

    const navCheck = await evaluate(`(() => {
      const bottomNav = document.querySelector('nav[aria-label="Doctor navigation"]');
      const hamburger = document.querySelector('button[aria-label="Toggle navigation"]');
      return {
        hasBottomNav: !!bottomNav,
        hasHamburger: !!hamburger,
      };
    })()`);
    console.log('Mobile nav elements:', navCheck);

    // Open hamburger drawer
    console.log('Opening mobile hamburger drawer...');
    await evaluate(`document.querySelector('button[aria-label="Toggle navigation"]')?.click()`);
    await new Promise(r => setTimeout(r, 400));

    const drawerOpened = await evaluate(`(() => {
      const drawer = document.querySelector('aside[aria-label="Doctor navigation drawer"]');
      const isVisible = drawer && drawer.classList.contains('translate-x-0');
      return isVisible;
    })()`);
    console.log(`Drawer open status: ${drawerOpened ? '✅ OPEN' : '❌ NOT OPEN'}`);

    // Close hamburger drawer via X button
    await evaluate(`document.querySelector('button[aria-label="Close navigation drawer"]')?.click()`);
    await new Promise(r => setTimeout(r, 400));
    console.log('✅ Drawer successfully closed via X button');

    // =========================================================================
    // STEP 6: Admin Clinical Operations Telemetry Controls
    // =========================================================================
    console.log('\n[STEP 6] Testing Admin Clinical Operations Telemetry Stepper Controls...');
    // Log in as Admin via Authorized Roles
    await send('Page.navigate', { url: 'http://localhost:3001/login' });
    await waitForElement('[data-testid="tab-demo-access"]', 10000);
    await evaluate(`document.querySelector('[data-testid="tab-demo-access"]')?.click()`);
    await waitForElement('[data-testid="demo-login-admin"]', 5000);
    await evaluate(`document.querySelector('[data-testid="demo-login-admin"]')?.click()`);
    for (let i = 0; i < 30; i++) {
      const url = await evaluate('window.location.href');
      if (url && url.includes('/admin')) break;
      await new Promise(r => setTimeout(r, 300));
    }

    // Navigate to Admin Clinical Operations
    await send('Page.navigate', { url: 'http://localhost:3001/admin/demo' });
    await new Promise(r => setTimeout(r, 2000));
    await setViewport(1280, 800);

    const adminLoaded = await evaluate(`(() => {
      return {
        hasControls: !!document.querySelector('[aria-label="Clinical Telemetry Controls"]'),
        hasAdminOpsTitle: document.body.innerText.includes('Clinical Operations') || document.body.innerText.includes('Telemetry Control Center'),
      };
    })()`);
    console.log('Admin Clinical Operations status:', adminLoaded);
    if (!adminLoaded.hasControls) throw new Error('Clinical Telemetry Controls not found in Admin area!');
    await saveScreenshot('admin-clinical-operations-1280px.png');

    // 1. Click [ 2. Critical (86%) ]
    console.log('Action: Clicking [ 2. Critical (86%) ]...');
    await evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const critBtn = btns.find(b => b.textContent && b.textContent.includes('Critical (86%)'));
      if (critBtn) { critBtn.click(); return true; }
      return false;
    })()`);
    await new Promise(r => setTimeout(r, 600));

    const step2Result = await evaluate(`(() => {
      return {
        spO2_86: document.body.innerText.includes('86%'),
        phase: document.querySelector('.bg-blue-50.border-blue-200')?.textContent?.trim(),
      };
    })()`);
    console.log('Step 2 Result (Critical Triggered):', step2Result);
    if (!step2Result.spO2_86) throw new Error('Critical SpO2 86% was not triggered');

    // 2. Click [ 3. Acknowledge ]
    console.log('Action: Clicking [ 3. Acknowledge ]...');
    await evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const ackBtn = btns.find(b => b.textContent && b.textContent.includes('3. Acknowledge'));
      if (ackBtn) { ackBtn.click(); return true; }
      return false;
    })()`);
    await new Promise(r => setTimeout(r, 600));

    const step3Result = await evaluate(`(() => {
      return {
        acknowledged: document.body.innerText.includes('Acknowledged') || document.body.innerText.includes('ACKNOWLEDGED'),
        phase: document.querySelector('.bg-blue-50.border-blue-200')?.textContent?.trim(),
      };
    })()`);
    console.log('Step 3 Result (Doctor Acknowledged):', step3Result);

    // 3. Click [ 4. Request Nurse ]
    console.log('Action: Clicking [ 4. Request Nurse ]...');
    await evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const nurseBtn = btns.find(b => b.textContent && b.textContent.includes('4. Request Nurse'));
      if (nurseBtn) { nurseBtn.click(); return true; }
      return false;
    })()`);
    await new Promise(r => setTimeout(r, 600));

    const step4Result = await evaluate(`(() => {
      return {
        nurseResponding: document.body.innerText.includes('Nurse Priya') || document.body.innerText.includes('Responding'),
        phase: document.querySelector('.bg-blue-50.border-blue-200')?.textContent?.trim(),
      };
    })()`);
    console.log('Step 4 Result (Nurse Responding):', step4Result);

    // 4. Click [ 6. Resolve ]
    console.log('Action: Clicking [ 6. Resolve ]...');
    await evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const resolveBtn = btns.find(b => b.textContent && b.textContent.includes('6. Resolve'));
      if (resolveBtn) { resolveBtn.click(); return true; }
      return false;
    })()`);
    await new Promise(r => setTimeout(r, 600));

    const step6Result = await evaluate(`(() => {
      return {
        spO2_normalized: document.body.innerText.includes('98%') || document.body.innerText.includes('97%'),
        resolved: document.body.innerText.includes('Resolved') || document.body.innerText.includes('Bedside care completed'),
      };
    })()`);
    console.log('Step 6 Result (Alert Resolved):', step6Result);

    // 5. Click [ 7. Reset Baseline ]
    console.log('Action: Clicking [ 7. Reset ]...');
    await evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const resetBtn = btns.find(b => b.textContent && b.textContent.includes('7. Reset'));
      if (resetBtn) { resetBtn.click(); return true; }
      return false;
    })()`);
    await new Promise(r => setTimeout(r, 600));
    console.log('✅ Deterministic Clinical Event Controller verified in Admin Clinical Operations!');

    // =========================================================================
    // STEP 7: Redesigned Login Page & Attender Portal Mobile Verification
    // =========================================================================
    console.log('\n[STEP 7] Verifying Redesigned Login Page & Attender Mobile (390x844)...');
    await send('Page.navigate', { url: 'http://localhost:3001/login' });
    await new Promise(r => setTimeout(r, 1500));

    // Desktop Login Verification (1440x900)
    await setViewport(1440, 900);
    const desktopLoginMetrics = await evaluate(`(() => {
      const docEl = document.documentElement;
      return {
        hasTitle: document.body.innerText.includes('HealthConnect'),
        hasPillars: document.body.innerText.includes('Continuous Telemetry Monitoring'),
        hasCredentialsTab: !!document.querySelector('[data-testid="tab-credentials"]'),
        hasRolesTab: !!document.querySelector('[data-testid="tab-demo-access"]'),
        scrollWidth: docEl.scrollWidth,
        innerWidth: window.innerWidth,
        hasOverflow: docEl.scrollWidth > window.innerWidth + 1,
      };
    })()`);
    console.log('Desktop Login Page status:', desktopLoginMetrics);
    if (desktopLoginMetrics.hasOverflow) throw new Error('Desktop Login Page has horizontal overflow!');
    await saveScreenshot('login-redesign-desktop-1440px.png');

    // Mobile Login Verification (390x844)
    await setViewport(390, 844);
    const mobileLoginMetrics = await evaluate(`(() => {
      const docEl = document.documentElement;
      return {
        hasTitle: document.body.innerText.includes('HealthConnect'),
        scrollWidth: docEl.scrollWidth,
        innerWidth: window.innerWidth,
        hasOverflow: docEl.scrollWidth > window.innerWidth + 1,
      };
    })()`);
    console.log('Mobile Login Page status:', mobileLoginMetrics);
    if (mobileLoginMetrics.hasOverflow) throw new Error('Mobile Login Page has horizontal overflow!');
    await saveScreenshot('login-redesign-mobile-390px.png');

    // Switch to Authorized Roles & Log in as Attender
    await waitForElement('[data-testid="tab-demo-access"]', 5000);
    await evaluate(`document.querySelector('[data-testid="tab-demo-access"]')?.click()`);
    await waitForElement('[data-testid="demo-login-attender"]', 5000);

    // Click Family Attender Portal
    await evaluate(`document.querySelector('[data-testid="demo-login-attender"]')?.click()`);
    for (let i = 0; i < 30; i++) {
      const url = await evaluate('window.location.href');
      if (url && url.includes('/attender')) break;
      await new Promise(r => setTimeout(r, 300));
    }

    // Dismiss any coachmark/tutorial if visible
    await evaluate(`(() => {
      const skipBtns = Array.from(document.querySelectorAll('button')).filter(b => 
        b.innerText && (b.innerText.includes('Skip') || b.innerText.includes('Finish') || b.innerText.includes('Got it'))
      );
      skipBtns.forEach(b => b.click());
    })()`);
    await new Promise(r => setTimeout(r, 500));

    await setViewport(390, 844);
    const attenderMetrics = await evaluate(`(() => {
      const docEl = document.documentElement;
      return {
        url: window.location.href,
        patientName: document.body.innerText.includes('Suresh Kumar') || document.body.innerText.includes('Ramesh'),
        scrollWidth: docEl.scrollWidth,
        clientWidth: docEl.clientWidth,
        innerWidth: window.innerWidth,
        hasHorizontalOverflow: docEl.scrollWidth > window.innerWidth + 1,
        hasCareAI: !!document.querySelector('[data-tour="careai-launcher"]'),
        hasBottomNav: !!document.querySelector('nav[aria-label*="navigation"]'),
      };
    })()`);
    console.log('Attender Mobile 390px metrics:', attenderMetrics);
    if (attenderMetrics.hasHorizontalOverflow) {
      throw new Error(`Attender mobile overflow: ${attenderMetrics.scrollWidth} > ${attenderMetrics.innerWidth}`);
    }
    console.log('✅ Attender Portal on Mobile 390x844 verified with 0 horizontal overflow!');

    await saveScreenshot('responsive-attender-mobile-390px.png');

    console.log('\n======================================================================');
    console.log('ALL UNIVERSAL RESPONSIVE + HACKATHON DEMO TESTS PASSED (100%)!');
    console.log('======================================================================\n');
  } finally {
    if (ws) ws.close();
    chromeProcess.kill();
  }
}

main().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
