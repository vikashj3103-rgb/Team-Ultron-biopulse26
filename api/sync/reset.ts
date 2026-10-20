import { syncStore } from '../_state';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  syncStore.canonicalServerState = null;
  syncStore.recentMutations = [];

  return res.status(200).json({
    success: true,
    message: 'Canonical sync state cleared',
  });
}
