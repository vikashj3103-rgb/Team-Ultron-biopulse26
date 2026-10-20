const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function main() {
  console.log('Launching headless Chrome for DOM & visual inspection...');
  const chromeProcess = spawn(
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
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 300));
    try {
      targets = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
          });
        }).on('error', reject);
      });
      if (targets && targets.length > 0) break;
    } catch {}
  }

  const pageTarget = targets?.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!pageTarget) {
    console.error('No page target found.');
    chromeProcess.kill();
    return;
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const res = JSON.parse(event.data);
    if (res.id && pending.has(res.id)) {
      const { resolve, reject } = pending.get(res.id);
      pending.delete(res.id);
      if (res.error) reject(res.error);
      else resolve(res.result);
    }
  };

  await new Promise((resolve) => ws.onopen = resolve);
  console.log('Connected to CDP!');

  await send('Page.enable');
  await send('DOM.enable');
  await send('Runtime.enable');

  // Set doctor session
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
      return 'ok';
    })()`,
  });

  await send('Page.navigate', { url: 'http://localhost:3001/doctor' });
  await new Promise(r => setTimeout(r, 1200));

  const viewports = [
    { name: '360', width: 360, height: 740 },
    { name: '390', width: 390, height: 844 },
    { name: '430', width: 430, height: 932 },
    { name: '768', width: 768, height: 1024 },
    { name: '820', width: 820, height: 1180 },
    { name: '1024', width: 1024, height: 768 },
    { name: '1280', width: 1280, height: 800 },
    { name: '1440', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.width < 1024,
    });

    await new Promise(r => setTimeout(r, 400));

    const evalResult = await send('Runtime.evaluate', {
      expression: `(() => {
        const toObj = (r) => r ? ({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) }) : null;

        // Mobile Bottom Nav
        const fixedNav = document.querySelector('nav[aria-label*="navigation"]');
        const bottomNav = document.querySelector('nav.fixed.bottom-0') || fixedNav;

        // Header
        const header = document.querySelector('header');
        // Aside
        const aside = document.querySelector('aside');
        // Main
        const main = document.querySelector('main');
        // CareAI Button
        const careAiBtn = document.querySelector('[data-tour="careai-launcher"]');
        const careAiContainer = careAiBtn ? careAiBtn.parentElement : null;

        // Check if bottom nav is in visible viewport
        let bottomNavInViewport = false;
        if (bottomNav) {
          const r = bottomNav.getBoundingClientRect();
          const cs = window.getComputedStyle(bottomNav);
          bottomNavInViewport = cs.display !== 'none' && cs.visibility !== 'hidden' && r.height > 0 && r.bottom <= window.innerHeight && r.top >= 0;
        }

        // Check if CareAI button is in visible viewport
        let careAiInViewport = false;
        if (careAiBtn) {
          const r = careAiBtn.getBoundingClientRect();
          const cs = window.getComputedStyle(careAiBtn);
          careAiInViewport = cs.display !== 'none' && cs.visibility !== 'hidden' && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
        }

        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          header: header ? {
            rect: toObj(header.getBoundingClientRect()),
            display: window.getComputedStyle(header).display,
          } : null,
          aside: aside ? {
            rect: toObj(aside.getBoundingClientRect()),
            display: window.getComputedStyle(aside).display,
            visibility: window.getComputedStyle(aside).visibility,
            transform: window.getComputedStyle(aside).transform,
          } : null,
          bottomNav: bottomNav ? {
            rect: toObj(bottomNav.getBoundingClientRect()),
            display: window.getComputedStyle(bottomNav).display,
            visibility: window.getComputedStyle(bottomNav).visibility,
            position: window.getComputedStyle(bottomNav).position,
            bottom: window.getComputedStyle(bottomNav).bottom,
            zIndex: window.getComputedStyle(bottomNav).zIndex,
            inViewport: bottomNavInViewport,
            items: Array.from(bottomNav.querySelectorAll('a, button')).map(el => el.innerText.trim().replace(/\\n/g, ' '))
          } : null,
          careAi: careAiBtn ? {
            btnRect: toObj(careAiBtn.getBoundingClientRect()),
            containerRect: toObj(careAiContainer.getBoundingClientRect()),
            containerPos: window.getComputedStyle(careAiContainer).position,
            containerZIndex: window.getComputedStyle(careAiContainer).zIndex,
            inViewport: careAiInViewport,
          } : null,
          mainPaddingBottom: main ? window.getComputedStyle(main).paddingBottom : null,
        };
      })()`,
      returnByValue: true,
    });

    const data = evalResult?.result?.value !== undefined ? evalResult.result.value : evalResult;
    console.log(`\n=== VIEWPORT ${vp.width}px (${vp.name}) ===`);
    console.log('Bottom Nav:', data.bottomNav ? {
      display: data.bottomNav.display,
      rect: data.bottomNav.rect,
      inViewport: data.bottomNav.inViewport,
      items: data.bottomNav.items
    } : 'NOT FOUND');
    console.log('Aside Sidebar:', data.aside ? {
      display: data.aside.display,
      rect: data.aside.rect,
      transform: data.aside.transform
    } : 'NOT FOUND');
    console.log('CareAI Launcher:', data.careAi ? {
      btnRect: data.careAi.btnRect,
      inViewport: data.careAi.inViewport,
      zIndex: data.careAi.containerZIndex
    } : 'NOT FOUND');
    console.log('Main Padding Bottom:', data.mainPaddingBottom);

    // Save screenshot
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`scripts/screenshot-${vp.width}px.png`, Buffer.from(screenshot.data, 'base64'));
    console.log(`Screenshot saved: scripts/screenshot-${vp.width}px.png`);
  }

  ws.close();
  chromeProcess.kill();
  console.log('\nAll viewports inspected.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
