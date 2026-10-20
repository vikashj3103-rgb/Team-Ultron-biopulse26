import { syncStore } from './_state.js';

// Patient device mapping (Hardware Smart Glove Dev Modules)
const DEVICE_PATIENT_MAP: Record<string, string> = {
  'GLOVE-ESP32-DEV01': 'pat-ramesh',
  'GLOVE-ESP32-DEV02': 'pat-anitha',
  'GLOVE-ESP32-DEV03': 'pat-karthik',
  'GLOVE-ESP32-DEV04': 'pat-suresh',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Last-Event-ID, X-Device-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    // Device-to-patient mapping
    const deviceId = payload.deviceId || req.headers['x-device-id'] || 'GLOVE-ESP32-DEV01';
    let targetPatientId = payload.patientId;
    if (!targetPatientId && DEVICE_PATIENT_MAP[deviceId]) {
      targetPatientId = DEVICE_PATIENT_MAP[deviceId];
    }
    if (!targetPatientId) {
      targetPatientId = 'pat-ramesh'; // Default evaluation patient
    }

    const eventId = ++syncStore.serverEventSequence;
    const mutationId = 'hw_' + targetPatientId + '_' + Date.now();

    const hardwareMutation = {
      id: mutationId,
      mutationId,
      sequenceId: eventId,
      type: payload.eventType === 'VITAL' ? 'RECORD_VITALS' : 'CREATE_REQUEST',
      payload: {
        ...payload,
        patientId: targetPatientId,
        deviceId,
      },
      timestamp: new Date().toISOString(),
      originId: 'hardware_gateway',
    };

    syncStore.recentMutations.push(hardwareMutation);
    if (syncStore.recentMutations.length > 50) syncStore.recentMutations.shift();

    return res.status(200).json({
      success: true,
      synchronized: true,
      eventId,
      patientId: targetPatientId,
      message: 'Hardware event processed and registered for evaluation',
      receivedAt: new Date().toISOString(),
      payload: hardwareMutation.payload,
    });
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
  }
}
