/**
 * ==============================================================================
 * HealthConnect Network Sync Service (Cross-Device Real-Time Sync Layer)
 * ==============================================================================
 * 
 * Provides long-lived SSE synchronization, deterministic client identification,
 * exponential backoff reconnection, monotonic event sequence deduplication,
 * and idempotent mutation processing across Cloudflare tunnels, local tabs,
 * and mobile browsers.
 * ==============================================================================
 */

import { telemetryDiagnosticService } from './telemetryDiagnosticService';

export type SyncConnectionState = 'LIVE' | 'RECONNECTING' | 'OFFLINE';

export function isNetworkRelayConfigured(streamEndpoint?: string, mutationEndpoint?: string): boolean {
  return Boolean(streamEndpoint?.trim() && mutationEndpoint?.trim());
}

export interface SyncMutation {
  id: string;
  mutationId?: string;
  sequenceId?: number;
  type: 
    | 'SET_PATIENTS'
    | 'UPDATE_PATIENT'
    | 'ADD_PATIENT'
    | 'DISCHARGE_PATIENT'
    | 'RECORD_VITALS'
    | 'TELEMETRY_UPDATE'
    | 'CREATE_REQUEST'
    | 'ACKNOWLEDGE_REQUEST'
    | 'RESOLVE_REQUEST'
    | 'ADD_MEDICATION'
    | 'UPDATE_MEDICATION'
    | 'ADD_REPORT'
    | 'ADD_NOTE'
    | 'ASSIGN_DOCTOR'
    | 'PAIR_ATTENDER'
    | 'RESET_DATA'
    | 'FULL_SYNC'
    | 'CREATE_CALL_REQUEST'
    | 'UPDATE_CALL_REQUEST'
    | 'UPDATE_CALL_STAFF'
    | 'ADD_AUDIT_LOG'
    | 'ACKNOWLEDGE_ALERT'
    | 'ESCALATE_ALERT'
    | 'RESOLVE_ALERT';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  snapshot?: any;
  timestamp: string;
  originId: string;
}

// Development Lifecycle Logger
function sseDevLog(
  action: 'SSE CONNECT' | 'SSE DISCONNECT' | 'SSE RECONNECT' | 'SSE EVENT' | 'SSE HEARTBEAT' | 'SSE DUPLICATE EVENT IGNORED',
  details: { clientId?: string; eventId?: number | string; patientId?: string; info?: string }
) {
  if (import.meta.env?.DEV) {
    const parts = [
      `[${action}]`,
      details.clientId ? `clientId: ${details.clientId}` : '',
      details.eventId !== undefined ? `eventId: ${details.eventId}` : '',
      details.patientId ? `patientId: ${details.patientId}` : '',
      details.info ? `(${details.info})` : '',
    ].filter(Boolean);
    console.log(parts.join(' '));
  }
}

class NetworkSyncService {
  private connectionState: SyncConnectionState = 'OFFLINE';
  private connectionType: 'SUPABASE' | 'NETWORK_RELAY' | 'LOCAL_TABS' = 'LOCAL_TABS';
  private eventSource: EventSource | null = null;
  private clientId: string;
  private lastProcessedEventId: number = 0;
  private processedMutationIds: Set<string> = new Set();
  private maxProcessedMutationHistory: number = 1000;

  private listeners: Set<(state: SyncConnectionState, type: string) => void> = new Set();
  private mutationHandlers: Set<(mutation: SyncMutation) => void> = new Set();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private stateHandlers: Set<(state: any) => void> = new Set();

  // Exponential backoff reconnect controls
  private reconnectTimer: number | null = null;
  private reconnectAttempts: number = 0;
  private readonly baseBackoffMs: number = 1000;
  private readonly maxBackoffMs: number = 15000;

  private pollingTimer: number | null = null;
  private lastLatency: number = 12; // ms
  private lastSyncTime: number = Date.now();
  private isMuted: boolean = false;

  private getSyncEndpoints() {
    const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : undefined;
    return {
      stream: (env?.VITE_SYNC_STREAM_URL as string) || (typeof window !== 'undefined' ? '/api/sync/stream' : undefined),
      mutation: (env?.VITE_SYNC_ENDPOINT as string) || (typeof window !== 'undefined' ? '/api/sync' : undefined),
      state: (env?.VITE_SYNC_STATE_URL as string) || (typeof window !== 'undefined' ? '/api/sync/state' : undefined),
    };
  }

  constructor() {
    this.clientId = this.initStableClientId();
    this.initLastProcessedEventId();

    if (typeof window !== 'undefined') {
      this.initNetworkListener();
      // Auto-connect on startup
      setTimeout(() => this.connect(), 300);
      this.startPollingFallback();
    }
  }

  /**
   * Deterministic client identification: persists clientId for the lifetime of the browser session
   */
  private initStableClientId(): string {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const stored = sessionStorage.getItem('healthconnect_sse_client_id');
        if (stored && stored.startsWith('client_')) {
          return stored;
        }
        const created = 'client_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
        sessionStorage.setItem('healthconnect_sse_client_id', created);
        return created;
      } catch {
        // storage disabled
      }
    }
    return 'client_' + Math.random().toString(36).substring(2, 9);
  }

  private initLastProcessedEventId(): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const stored = sessionStorage.getItem('healthconnect_sse_last_event_id');
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed > 0) {
            this.lastProcessedEventId = parsed;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  private initNetworkListener() {
    window.addEventListener('online', () => {
      this.reconnectAttempts = 0;
      this.connect();
    });
    window.addEventListener('offline', () => {
      this.setConnectionState('OFFLINE', this.connectionType);
      sseDevLog('SSE DISCONNECT', { clientId: this.clientId, info: 'browser went offline' });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (this.connectionState !== 'LIVE' || !this.eventSource) {
          this.connect();
        }
        this.fetchServerState().then((state) => {
          if (state) {
            this.stateHandlers.forEach((h) => {
              try {
                h(state);
              } catch (err) {
                console.error('State sync on tab resume error:', err);
              }
            });
          }
        });
      }
    });
  }

  public getClientId(): string {
    return this.clientId;
  }

  public getLastProcessedEventId(): number {
    return this.lastProcessedEventId;
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  public getConnectionState(): SyncConnectionState {
    return this.connectionState;
  }

  public getConnectionType(): 'SUPABASE' | 'NETWORK_RELAY' | 'LOCAL_TABS' {
    return this.connectionType;
  }

  public getLatency(): number {
    return this.lastLatency;
  }

  public getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  public onConnectionChange(listener: (state: SyncConnectionState, type: string) => void): () => void {
    this.listeners.add(listener);
    listener(this.connectionState, this.connectionType);
    return () => this.listeners.delete(listener);
  }

  public onMutation(handler: (mutation: SyncMutation) => void): () => void {
    this.mutationHandlers.add(handler);
    return () => this.mutationHandlers.delete(handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public onStateSync(handler: (state: any) => void): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  private setConnectionState(state: SyncConnectionState, type: 'SUPABASE' | 'NETWORK_RELAY' | 'LOCAL_TABS') {
    this.connectionState = state;
    this.connectionType = type;
    telemetryDiagnosticService.setConnectionState(
      state === 'LIVE' ? 'CONNECTED' : state === 'RECONNECTING' ? 'RECONNECTING' : 'OFFLINE'
    );
    this.listeners.forEach((l) => {
      try {
        l(state, type);
      } catch (err) {
        console.error('Connection listener error:', err);
      }
    });
  }

  /**
   * Calculates exponential backoff delay with jitter
   */
  private getNextBackoffDelay(): number {
    const delay = Math.min(
      this.maxBackoffMs,
      this.baseBackoffMs * Math.pow(1.5, Math.min(this.reconnectAttempts, 8))
    );
    const jitter = Math.random() * 400;
    return Math.round(delay + jitter);
  }

  /**
   * Cleans up existing EventSource stream and listeners cleanly
   */
  private cleanupEventSource() {
    if (this.eventSource) {
      try {
        this.eventSource.onopen = null;
        this.eventSource.onmessage = null;
        this.eventSource.onerror = null;
        this.eventSource.close();
      } catch {
        // ignore
      }
      this.eventSource = null;
    }
  }

  /**
   * Connects to long-lived SSE stream with deterministic identification and event resumption
   */
  public connect() {
    if (typeof window === 'undefined') return;

    const endpoints = this.getSyncEndpoints();
    if (!isNetworkRelayConfigured(endpoints.stream, endpoints.mutation)) {
      this.setConnectionState('LIVE', 'LOCAL_TABS');
      return;
    }

    if (!navigator.onLine) {
      this.setConnectionState('OFFLINE', 'NETWORK_RELAY');
      return;
    }

    this.cleanupEventSource();
    this.setConnectionState('RECONNECTING', 'NETWORK_RELAY');

    try {
      const queryParams = new URLSearchParams();
      queryParams.set('clientId', this.clientId);
      if (this.lastProcessedEventId > 0) {
        queryParams.set('lastEventId', String(this.lastProcessedEventId));
      }

      const streamUrl = `${endpoints.stream}${endpoints.stream!.includes('?') ? '&' : '?'}${queryParams.toString()}`;
      const es = new EventSource(streamUrl);
      this.eventSource = es;

      es.onopen = () => {
        this.reconnectAttempts = 0;
        this.setConnectionState('LIVE', 'NETWORK_RELAY');
        this.lastSyncTime = Date.now();
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        sseDevLog('SSE CONNECT', { clientId: this.clientId, eventId: this.lastProcessedEventId, info: 'connection opened' });
      };

      const handleIncomingData = (rawText: string, lastEventIdHeader?: string) => {
        try {
          const data = JSON.parse(rawText);

          // 1. Initial Handshake / Connect Event
          if (data.type === 'CONNECTED') {
            this.reconnectAttempts = 0;
            this.setConnectionState('LIVE', 'NETWORK_RELAY');
            this.lastSyncTime = Date.now();
            if (data.eventId) {
              this.lastProcessedEventId = Math.max(this.lastProcessedEventId, data.eventId);
              try { sessionStorage.setItem('healthconnect_sse_last_event_id', String(this.lastProcessedEventId)); } catch {}
            }
            sseDevLog('SSE CONNECT', { clientId: this.clientId, eventId: data.eventId, info: 'handshake verified' });
            return;
          }

          // 2. Heartbeat / PING Event
          if (data.type === 'PING') {
            const start = data.clientSent || data.timestamp || Date.now();
            this.lastLatency = Math.max(4, Math.min(250, Date.now() - start));
            this.lastSyncTime = Date.now();
            if (data.eventId) {
              this.lastProcessedEventId = Math.max(this.lastProcessedEventId, data.eventId);
            }
            sseDevLog('SSE HEARTBEAT', { clientId: this.clientId, eventId: data.eventId });
            return;
          }

          // 3. Clinical State Mutation Event
          if (data.type === 'MUTATION') {
            const eventId = data.eventId || (lastEventIdHeader ? parseInt(lastEventIdHeader, 10) : undefined);

            // Monotonic event sequence deduplication: ignore already processed sequence numbers
            if (eventId !== undefined && !isNaN(eventId) && eventId > 0 && eventId <= this.lastProcessedEventId) {
              sseDevLog('SSE DUPLICATE EVENT IGNORED', { clientId: this.clientId, eventId, info: 'lower or equal eventId' });
              return;
            }

            if (eventId) {
              this.lastProcessedEventId = eventId;
              try { sessionStorage.setItem('healthconnect_sse_last_event_id', String(eventId)); } catch {}
            }

            const mutation: SyncMutation = data.mutation;
            if (!mutation) return;

            // Ignore self-originated mutations
            if (mutation.originId === this.clientId) {
              return;
            }

            // Mutation ID idempotency: ignore duplicate mutationId
            const mutationId = mutation.mutationId || mutation.id;
            if (mutationId && this.processedMutationIds.has(mutationId)) {
              sseDevLog('SSE DUPLICATE EVENT IGNORED', { clientId: this.clientId, eventId, info: `duplicate mutationId: ${mutationId}` });
              return;
            }

            if (mutationId) {
              if (this.processedMutationIds.size >= this.maxProcessedMutationHistory) {
                const firstKey = this.processedMutationIds.values().next().value;
                if (firstKey) this.processedMutationIds.delete(firstKey);
              }
              this.processedMutationIds.add(mutationId);
            }

            this.lastSyncTime = Date.now();
            const patientId = mutation.payload?.patientId || mutation.payload?.id;

            if (import.meta.env?.DEV && (mutation.type === 'RECORD_VITALS' || mutation.type === 'TELEMETRY_UPDATE')) {
              console.log(`[SSE TELEMETRY RECEIVED] eventId=${eventId} patientId=${patientId} serverTimestamp=${mutation.timestamp || new Date().toISOString()}`);
            }

            if (mutation.type === 'RECORD_VITALS' || mutation.type === 'TELEMETRY_UPDATE') {
              telemetryDiagnosticService.recordPacketReceived(eventId, patientId);
            }

            sseDevLog('SSE EVENT', {
              clientId: this.clientId,
              eventId,
              patientId,
              info: `${mutation.type} (id: ${mutationId})`,
            });

            this.mutationHandlers.forEach((handler) => {
              try {
                handler(mutation);
              } catch (err) {
                console.error('Mutation handler error:', err);
              }
            });
          }
        } catch {
          // parse error or comment line
        }
      };

      es.onmessage = (event) => {
        handleIncomingData(event.data, event.lastEventId);
      };

      // Also listen to named events for SSE standard compliance
      es.addEventListener('mutation', (event: any) => {
        handleIncomingData(event.data, event.lastEventId);
      });
      es.addEventListener('ping', (event: any) => {
        handleIncomingData(event.data, event.lastEventId);
      });
      es.addEventListener('connected', (event: any) => {
        handleIncomingData(event.data, event.lastEventId);
      });

      es.onerror = () => {
        // If the browser is in CONNECTING state, native EventSource is actively reconnecting in background
        if (es.readyState === EventSource.CONNECTING) {
          this.setConnectionState('RECONNECTING', 'NETWORK_RELAY');
          sseDevLog('SSE RECONNECT', { clientId: this.clientId, info: 'EventSource CONNECTING (browser retry)' });
          return;
        }

        // If CLOSED or aborted, handle with exponential backoff
        this.setConnectionState('RECONNECTING', 'NETWORK_RELAY');
        this.cleanupEventSource();

        this.reconnectAttempts++;
        const nextDelay = this.getNextBackoffDelay();
        sseDevLog('SSE DISCONNECT', { clientId: this.clientId, info: `closed, retry #${this.reconnectAttempts} in ${nextDelay}ms` });

        if (!this.reconnectTimer) {
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, nextDelay);
        }
      };
    } catch {
      this.setConnectionState('LIVE', 'LOCAL_TABS');
    }
  }

  /**
   * Broadcast a state mutation through the configured relay
   */
  public async broadcastMutation(mutation: Omit<SyncMutation, 'id' | 'timestamp' | 'originId'> & { mutationId?: string }): Promise<void> {
    if (this.isMuted) return;

    const endpoints = this.getSyncEndpoints();
    if (!isNetworkRelayConfigured(endpoints.stream, endpoints.mutation)) return;

    const mutationId = mutation.mutationId || ('mut_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));

    const fullMutation: SyncMutation = {
      ...mutation,
      id: mutationId,
      mutationId,
      timestamp: new Date().toISOString(),
      originId: this.clientId,
    };

    // Mark own mutation as processed so if reflected back it is ignored
    this.processedMutationIds.add(mutationId);

    const startTime = Date.now();

    try {
      const response = await fetch(endpoints.mutation!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Last-Event-ID': String(this.lastProcessedEventId),
        },
        body: JSON.stringify({
          mutation: fullMutation,
          snapshot: (mutation as any).snapshot,
          clientId: this.clientId,
        }),
      });

      const result = response.ok ? await response.json().catch(() => null) : null;
      if (result?.synchronized === true || result?.success === true) {
        this.lastLatency = Math.max(4, Date.now() - startTime);
        this.lastSyncTime = Date.now();
        if (result.eventId) {
          this.lastProcessedEventId = Math.max(this.lastProcessedEventId, result.eventId);
        }
        if (this.connectionState !== 'LIVE') {
          this.setConnectionState('LIVE', 'NETWORK_RELAY');
        }
      }
    } catch {
      // Offline or temporary network drop: local state and BroadcastChannel remain safe
    }
  }

  /**
   * Fetch canonical state from the server endpoint
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async fetchServerState(): Promise<any | null> {
    try {
      const stateEndpoint = this.getSyncEndpoints().state;
      if (!stateEndpoint) return null;
      const res = await fetch(`${stateEndpoint}${stateEndpoint.includes('?') ? '&' : '?'}clientId=${this.clientId}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.state) {
          this.lastSyncTime = Date.now();
          return json.state;
        }
      }
    } catch {
      // offline fallback
    }
    return null;
  }

  public startPollingFallback() {
    if (this.pollingTimer) return;
    if (!this.getSyncEndpoints().state) return;
    this.pollingTimer = window.setInterval(async () => {
      // In case SSE is reconnecting, offline, or buffered by tunnel proxies past 25s
      if (this.connectionState !== 'LIVE' || Date.now() - this.lastSyncTime > 25000) {
        try {
          const state = await this.fetchServerState();
          if (state && this.stateHandlers.size > 0) {
            this.stateHandlers.forEach((handler) => {
              try {
                handler(state);
              } catch (err) {
                console.error('State poll sync handler error:', err);
              }
            });
          }
        } catch {
          // ignore network polling errors
        }
      }
    }, 6000);
  }

  public setSupabaseActive(active: boolean) {
    if (active) {
      this.setConnectionState('LIVE', 'SUPABASE');
    }
  }

  /**
   * Diagnostic / Test methods for simulating network drops and verifying reconnection
   */
  public simulateDisconnect(): void {
    sseDevLog('SSE DISCONNECT', { clientId: this.clientId, info: 'simulated test disconnect' });
    this.cleanupEventSource();
    this.setConnectionState('RECONNECTING', 'NETWORK_RELAY');
  }

  public reconnectNow(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.connect();
  }

  public getProcessedMutationCount(): number {
    return this.processedMutationIds.size;
  }
}

export const networkSyncService = new NetworkSyncService();

if (typeof window !== 'undefined') {
  (window as any).__NETWORK_SYNC__ = networkSyncService;
}
