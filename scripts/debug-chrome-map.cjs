const { spawn } = require('child_process');
const http = require('http');

async function debug() {
  const port = 9228;
  const chromeProcess = spawn(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      '--no-first-run',
      '--no-default-browser-check',
      'http://localhost:3001'
    ],
    { stdio: 'ignore' }
  );

  let ws = null;
  try {
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        targets = await new Promise((resolve, reject) => {
          http.get(`http://127.0.0.1:${port}/json`, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
          }).on('error', reject);
        });
        if (targets && targets.length > 0) break;
      } catch {}
    }

    const pageTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
    ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let msgId = 1;
    const pending = new Map();
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.id && pending.has(data.id)) {
        const p = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) p.reject(data.error);
        else p.resolve(data.result);
      }
    };

    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    await send('Page.enable');
    await send('Runtime.enable');

    // Authenticate
    const authRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
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
          return window.location.href;
        })()
      `,
      returnByValue: true
    });
    console.log('Auth evaluated:', authRes);

    await send('Page.navigate', { url: 'http://localhost:3001/attender/map' });
    await new Promise(r => setTimeout(r, 2000));

    const pageState = await send('Runtime.evaluate', {
      expression: `
        (() => {
          return {
            url: window.location.href,
            title: document.title,
            bodyLength: document.body.innerHTML.length,
            h1: Array.from(document.querySelectorAll('h1, h2')).map(h => h.textContent),
            hasMap3d: !!document.querySelector('[role="region"]'),
            allRegions: Array.from(document.querySelectorAll('[role="region"]')).map(r => r.getAttribute('aria-label'))
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Page state:', pageState);

  } finally {
    if (ws) ws.close();
    chromeProcess.kill();
  }
}

debug();
