import { syncStore } from '../_state';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Last-Event-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'LIVE',
      server: 'CareConnect Synchronization Gateway',
      eventId: syncStore.serverEventSequence,
      timestamp: Date.now(),
    });
  }

  if (req.method === 'POST') {
    try {
      const parsed = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const mutation = parsed.mutation;

      if (parsed.snapshot) {
        syncStore.canonicalServerState = parsed.snapshot;
      } else if (mutation?.snapshot) {
        syncStore.canonicalServerState = mutation.snapshot;
      } else if (mutation?.type === 'FULL_SYNC') {
        syncStore.canonicalServerState = mutation.payload;
      } else if (mutation?.type === 'RESET_DATA') {
        syncStore.canonicalServerState = null;
      }

      const eventId = ++syncStore.serverEventSequence;
      if (mutation) {
        mutation.mutationId =
          mutation.mutationId || mutation.id || 'mut_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        mutation.id = mutation.id || mutation.mutationId;
        mutation.sequenceId = eventId;
        syncStore.recentMutations.push(mutation);
        if (syncStore.recentMutations.length > 50) syncStore.recentMutations.shift();
      }

      return res.status(200).json({
        success: true,
        synchronized: true,
        eventId,
        clientCount: 1,
        timestamp: Date.now(),
      });
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
