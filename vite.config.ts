import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Cross-Device Real-Time Synchronization & Hardware Ingestion Relay
function careconnectRealtimePlugin(): Plugin {
  return {
    name: 'careconnect-realtime-sync',
    configureServer(server) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connectedClients = new Map<string, { res: any; req: any; connectedAt: number; lastPing: number }>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let canonicalServerState: any = null;
      let serverEventSequence = 1000;

      // 1. Live Long-Lived SSE Stream for Cross-Device Synchronization & Cloudflare Quick Tunnel
      server.middlewares.use('/api/sync/stream', (req, res) => {
        // Parse request URL and parameters
        const reqUrl = new URL(req.url || '/', 'http://localhost:3001');
        const clientIdParam = reqUrl.searchParams.get('clientId');
        const lastEventIdParam = reqUrl.searchParams.get('lastEventId') || req.headers['last-event-id'];
        const clientId = clientIdParam || ('client_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7));

        // Socket tuning: disable timeouts so long-lived SSE connections are never dropped by Node
        if (req.socket) {
          req.socket.setTimeout(0);
          req.socket.setNoDelay(true);
          req.socket.setKeepAlive(true, 15000);
        }

        // Proper unbuffered long-lived SSE response headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Content-Encoding': 'none',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Last-Event-ID',
        });

        // Flush headers immediately through reverse proxy / Cloudflare tunnel
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (res as any).flushHeaders === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (res as any).flushHeaders();
        }

        // Force Cloudflare / reverse proxy edge buffers to immediately flush stream (W3C comment padding)
        res.write(':' + ' '.repeat(2048) + '\n\n');
        res.write(`: heartbeat initial ${Date.now()}\n\n`);
        res.write('retry: 3000\n\n');

        // Monotonic sequence handshake event
        const handshakeSeq = ++serverEventSequence;
        res.write(`id: ${handshakeSeq}\n`);
        res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId, eventId: handshakeSeq, timestamp: Date.now() })}\n\n`);

        // Manage existing client stream if reconnecting
        if (connectedClients.has(clientId)) {
          const old = connectedClients.get(clientId);
          try {
            old?.res.end();
          } catch {
            // ignore
          }
          connectedClients.delete(clientId);
          console.log(`[SSE RECONNECT] clientId: ${clientId} eventId: ${lastEventIdParam || handshakeSeq}`);
        } else {
          console.log(`[SSE CONNECT] clientId: ${clientId} eventId: ${handshakeSeq}`);
        }

        connectedClients.set(clientId, { res, req, connectedAt: Date.now(), lastPing: Date.now() });

        // Clean disconnect handling
        req.on('close', () => {
          const current = connectedClients.get(clientId);
          if (current && current.res === res) {
            connectedClients.delete(clientId);
            console.log(`[SSE DISCONNECT] clientId: ${clientId} (remaining clients: ${connectedClients.size})`);
          }
        });

        req.on('error', (err) => {
          console.log(`[SSE DISCONNECT] clientId: ${clientId} error: ${err.message}`);
          connectedClients.delete(clientId);
        });
      });

      // 2. Canonical State Snapshot for newly connected devices (e.g. phone loading over Wi-Fi)
      server.middlewares.use('/api/sync/state', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.statusCode = 200;
        res.end(JSON.stringify({ state: canonicalServerState, timestamp: Date.now() }));
      });

      // 2b. Reset Canonical State endpoint
      server.middlewares.use('/api/sync/reset', (req, res) => {
        canonicalServerState = null;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: 'Canonical sync state cleared' }));
      });

      // 3. Mutation Ingestion & Multi-Device SSE Broadcast
      server.middlewares.use('/api/sync', (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Last-Event-ID');
          res.statusCode = 200;
          return res.end();
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              const mutation = parsed.mutation;

              if (parsed.snapshot) {
                canonicalServerState = parsed.snapshot;
              } else if (mutation?.snapshot) {
                canonicalServerState = mutation.snapshot;
              } else if (mutation?.type === 'FULL_SYNC') {
                canonicalServerState = mutation.payload;
              } else if (mutation?.type === 'RESET_DATA') {
                canonicalServerState = null;
              }

              // Guarantee stable mutation ID and monotonic sequence ID
              if (mutation) {
                mutation.mutationId = mutation.mutationId || mutation.id || ('mut_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
                mutation.id = mutation.id || mutation.mutationId;
              }

              const eventId = ++serverEventSequence;
              if (mutation) {
                mutation.sequenceId = eventId;
              }

              // Broadcast mutation instantly to all connected phones, tablets, and laptops
              const ssePayload = `id: ${eventId}\ndata: ${JSON.stringify({ type: 'MUTATION', eventId, mutation })}\n\n`;
              connectedClients.forEach((client, cId) => {
                try {
                  client.res.write(ssePayload);
                } catch {
                  connectedClients.delete(cId);
                }
              });

              if (mutation) {
                console.log(`[SSE EVENT] eventId: ${eventId} mutationId: ${mutation.mutationId} type: ${mutation.type} originId: ${mutation.originId || 'unknown'}`);
              }

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, synchronized: true, eventId, clientCount: connectedClients.size }));
            } catch (err) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
            }
          });
          return;
        }
        next();
      });

      // 4. ESP32 Hardware Smart Glove & Telemetry Event Gateway
      server.middlewares.use('/api/patient-events', (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Last-Event-ID');
          res.statusCode = 200;
          return res.end();
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              console.log('[CareConnect Hardware Ingestion Gateway]', payload);

              const eventId = ++serverEventSequence;
              const mutationId = 'hw_' + (payload.patientId || 'global') + '_' + Date.now();

              // Broadcast hardware event as a high-priority mutation to all connected dashboards
              const hardwareMutation = {
                id: mutationId,
                mutationId,
                sequenceId: eventId,
                type: payload.eventType === 'VITAL' ? 'RECORD_VITALS' : 'CREATE_REQUEST',
                payload,
                timestamp: new Date().toISOString(),
                originId: 'hardware_gateway',
              };

              const ssePayload = `id: ${eventId}\ndata: ${JSON.stringify({ type: 'MUTATION', eventId, mutation: hardwareMutation })}\n\n`;
              connectedClients.forEach((client, cId) => {
                try {
                  client.res.write(ssePayload);
                } catch {
                  connectedClients.delete(cId);
                }
              });

              console.log(`[SSE EVENT] eventId: ${eventId} mutationId: ${mutationId} type: ${hardwareMutation.type} patientId: ${payload.patientId || 'all'}`);

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: true,
                  synchronized: true,
                  eventId,
                  message: 'Hardware event processed and broadcasted across connected devices',
                  receivedAt: new Date().toISOString(),
                  payload,
                })
              );
            } catch (err) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
            }
          });
          return;
        }
        next();
      });

      // Keep-alive heartbeat & ping every 15s to maintain Cloudflare Quick Tunnel and mobile Wi-Fi connections
      const pingInterval = setInterval(() => {
        const pingSeq = ++serverEventSequence;
        const commentKeepalive = `: heartbeat ${Date.now()}\n\n`;
        const pingPayload = `id: ${pingSeq}\ndata: ${JSON.stringify({ type: 'PING', eventId: pingSeq, timestamp: Date.now() })}\n\n`;

        connectedClients.forEach((client, cId) => {
          try {
            // Comment ping prevents Cloudflare / reverse proxy 100s idle timeouts
            client.res.write(commentKeepalive);
            // Structured ping payload for client-side latency calculation
            client.res.write(pingPayload);
            client.lastPing = Date.now();
          } catch {
            connectedClients.delete(cId);
          }
        });

        if (connectedClients.size > 0 && process.env.NODE_ENV !== 'production') {
          console.log(`[SSE HEARTBEAT] eventId: ${pingSeq} activeClients: ${connectedClients.size}`);
        }
      }, 15000);

      server.httpServer?.on('close', () => {
        clearInterval(pingInterval);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    careconnectRealtimePlugin(),
  ],
  server: {
    host: '0.0.0.0',
    port: 3001,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3001,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
