const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\vikash\\.gemini\\antigravity\\brain\\1d353b1e-a698-49c3-a707-80221030c984';

async function main() {
  console.log('[STEP 1] Launching Chrome for Attender Header Verification...');
  const port = 9225;
  const userDataDir = 'C:\\Users\\vikash\\AppData\\Local\\Temp\\chrome-attender-header-' + Date.now();

  const chromeProcess = spawn(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      'http://localhost:3001/attender'
    ],
    { stdio: 'ignore' }
  );

  let ws = null;
  try {
    let targets = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 300));
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

    // Authenticate as Attender
    await send('Runtime.evaluate', {
      expression: `
        try {
          const authUser = {
            id: 'user-att-vikash',
            name: 'Vikash Kumar',
            email: 'attender.vikash@careconnect.demo',
            role: 'attender',
            phone: '+91 98765 43210',
            assignedAttenderId: 'att-vikash'
          };
          localStorage.setItem('careconnect_auth_session_v2', JSON.stringify(authUser));
          localStorage.setItem('healthconnect_tutorial_attender_completed', 'true');
          true;
        } catch(e) { e.message; }
      `,
      returnByValue: true
    });

    // Reload page to reflect authenticated attender state
    await send('Page.navigate', { url: 'http://localhost:3001/attender' });
    await new Promise(r => setTimeout(r, 2000));

    const viewports = [
      { name: 'desktop-1440', width: 1440, height: 900 },
      { name: 'desktop-1024', width: 1024, height: 768 },
      { name: 'tablet-820', width: 820, height: 1180 },
      { name: 'tablet-768', width: 768, height: 1024 },
      { name: 'mobile-390', width: 390, height: 844 },
      { name: 'mobile-320', width: 320, height: 568 }
    ];

    let allPassed = true;

    for (const vp of viewports) {
      console.log(`\n--- Testing Attender Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 1024
      });
      await new Promise(r => setTimeout(r, 600));

      const audit = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const header = document.querySelector('header');
            const hamburger = document.querySelector('[data-tour="header-hamburger"]');
            const lang = document.querySelector('[data-tour="language-selector"]');
            const callNurse = document.querySelector('[data-tour="attender-nurse-call"]');
            
            // Check for obsolete horizontal pills inside header
            const headerNavs = header ? Array.from(header.querySelectorAll('nav')) : [];
            const hasHorizontalNav = headerNavs.some(n => {
              const text = n.textContent || '';
              return text.includes('Home') && text.includes('Requests') && text.includes('Medications');
            });

            // Overflow check
            const docWidth = document.documentElement.scrollWidth;
            const clientWidth = document.documentElement.clientWidth;
            const hasHorizontalScroll = docWidth > clientWidth;

            // Check elements visibility
            const hamburgerRect = hamburger ? hamburger.getBoundingClientRect() : null;
            const headerRect = header ? header.getBoundingClientRect() : null;

            return {
              hasHeader: !!header,
              hasHamburger: !!hamburger,
              hamburgerVisible: hamburgerRect && hamburgerRect.width > 0 && hamburgerRect.height > 0,
              hasHorizontalNav,
              hasLanguage: !!lang,
              hasCallNurse: !!callNurse,
              docWidth,
              clientWidth,
              hasHorizontalScroll,
              headerHeight: headerRect ? headerRect.height : 0
            };
          })()
        `,
        returnByValue: true
      });

      const res = audit.result.value;
      console.log(`Results for ${vp.name}:`, JSON.stringify(res, null, 2));

      if (!res.hasHeader) {
        console.error(`❌ FAIL: Header not found in ${vp.name}`);
        allPassed = false;
      }
      if (!res.hasHamburger || !res.hamburgerVisible) {
        console.error(`❌ FAIL: Hamburger menu not found/visible in ${vp.name}`);
        allPassed = false;
      } else {
        console.log(`✅ Hamburger menu visible on left`);
      }
      if (res.hasHorizontalNav) {
        console.error(`❌ FAIL: Obsolete horizontal navigation pills still found in header in ${vp.name}!`);
        allPassed = false;
      } else {
        console.log(`✅ Obsolete horizontal navigation pills REMOVED from header`);
      }
      if (res.hasHorizontalScroll) {
        console.error(`❌ FAIL: Horizontal scroll detected in ${vp.name} (${res.docWidth}px > ${res.clientWidth}px)`);
        allPassed = false;
      } else {
        console.log(`✅ Zero horizontal scrolling (clientWidth: ${res.clientWidth}px)`);
      }

      // Take header screenshot for desktop, tablet, and mobile
      if (['desktop-1440', 'tablet-820', 'mobile-390'].includes(vp.name)) {
        const screenshotData = await send('Page.captureScreenshot', { format: 'png' });
        const filePath = path.join(ARTIFACT_DIR, `attender-header-${vp.name}.png`);
        fs.writeFileSync(filePath, Buffer.from(screenshotData.data, 'base64'));
        console.log(`📸 Saved screenshot to ${filePath}`);
      }

      // Test drawer interaction on desktop-1440 and mobile-390
      if (['desktop-1440', 'mobile-390'].includes(vp.name)) {
        console.log(`Testing Hamburger Drawer interaction on ${vp.name}...`);
        await send('Runtime.evaluate', {
          expression: `
            (() => {
              const hamburger = document.querySelector('[data-tour="header-hamburger"]');
              if (hamburger) hamburger.click();
            })()
          `
        });
        await new Promise(r => setTimeout(r, 500));

        const drawerCheck = await send('Runtime.evaluate', {
          expression: `
            (() => {
              const drawer = document.querySelector('aside[aria-label="Family attender navigation drawer"]');
              const drawerNav = drawer ? drawer.querySelector('nav') : null;
              const text = drawerNav ? drawerNav.textContent : '';
              const links = drawerNav ? Array.from(drawerNav.querySelectorAll('a, button')).map(el => el.textContent.trim()) : [];
              const isVisible = drawer && !drawer.className.includes('-translate-x-full');
              return {
                drawerFound: !!drawer,
                drawerOpen: isVisible,
                links
              };
            })()
          `,
          returnByValue: true
        });

        const dRes = drawerCheck.result.value;
        console.log(`Drawer state on ${vp.name}:`, JSON.stringify(dRes, null, 2));

        if (!dRes.drawerFound || !dRes.drawerOpen) {
          console.error(`❌ FAIL: Drawer did not open when clicking hamburger on ${vp.name}`);
          allPassed = false;
        } else {
          console.log(`✅ Drawer opened cleanly with items:`, dRes.links.join(', '));
        }

        // Take drawer screenshot
        const drawerScreenshot = await send('Page.captureScreenshot', { format: 'png' });
        const drawerPath = path.join(ARTIFACT_DIR, `attender-drawer-${vp.name}.png`);
        fs.writeFileSync(drawerPath, Buffer.from(drawerScreenshot.data, 'base64'));
        console.log(`📸 Saved drawer screenshot to ${drawerPath}`);

        // Close drawer
        await send('Runtime.evaluate', {
          expression: `
            (() => {
              const closeBtn = document.querySelector('button[aria-label="Close navigation drawer"]');
              if (closeBtn) closeBtn.click();
            })()
          `
        });
        await new Promise(r => setTimeout(r, 400));
      }
    }

    if (allPassed) {
      console.log('\n======================================================');
      console.log('✅ ALL ATTENDER HEADER VERIFICATION CHECKS PASSED 100%!');
      console.log('======================================================\n');
      process.exit(0);
    } else {
      console.error('\n❌ SOME CHECKS FAILED. See log above.');
      process.exit(1);
    }

  } catch (err) {
    console.error('Test script exception:', err);
    process.exit(1);
  } finally {
    if (ws) {
      try { ws.close(); } catch {}
    }
    try {
      chromeProcess.kill();
    } catch {}
  }
}

main();
