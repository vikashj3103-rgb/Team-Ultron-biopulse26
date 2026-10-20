import React, { useState, useEffect } from 'react';
import { dataStore } from '../../services/dataStore';
import { networkSyncService, SyncConnectionState } from '../../services/networkSyncService';
import { useLanguage } from '../../i18n';

interface RealtimeStatusBadgeProps {
  compact?: boolean;
}

export const RealtimeStatusBadge: React.FC<RealtimeStatusBadgeProps> = ({ compact = false }) => {
  const { t } = useLanguage();
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [connState, setConnState] = useState<SyncConnectionState>(() => networkSyncService.getConnectionState());
  const [connType, setConnType] = useState<string>(() => networkSyncService.getConnectionType());
  const [latency, setLatency] = useState<number>(() => networkSyncService.getLatency());

  useEffect(() => {
    const unsubConn = networkSyncService.onConnectionChange((state, type) => {
      setConnState(state);
      setConnType(type);
      setLatency(networkSyncService.getLatency());
    });

    const updateSeconds = () => {
      const lastSync = dataStore.getLastSyncTime();
      const diffSec = Math.max(0, Math.floor((Date.now() - lastSync) / 1000));
      setSecondsAgo(diffSec);
      setLatency(networkSyncService.getLatency());
    };

    updateSeconds();
    const interval = setInterval(updateSeconds, 1000);
    const unsubStore = dataStore.subscribe(updateSeconds);

    return () => {
      unsubConn();
      unsubStore();
      clearInterval(interval);
    };
  }, []);

  const formatText = () => {
    if (secondsAgo < 3) return t('status.syncedJustNow') || 'Synced just now';
    if (secondsAgo < 60) return t('status.syncedSecAgo', { sec: secondsAgo }) || `Synced ${secondsAgo}s ago`;
    const mins = Math.floor(secondsAgo / 60);
    return t('status.syncedMinAgo', { min: mins }) || `Synced ${mins}m ago`;
  };

  const isLocalMode = connType === 'LOCAL_TABS';
  const typeLabel = connType === 'SUPABASE' ? 'Supabase Cloud' : connType === 'NETWORK_RELAY' ? 'Network Sync' : (t('status.thisBrowser') || 'Local browser tabs');
  const liveTitle = isLocalMode
    ? 'Local clinical session syncs only within this browser and its tabs. Cross-device sync is not configured.'
    : `${typeLabel} Active • Latency ~${latency}ms • ${formatText()}`;

  if (!isLocalMode && (connState === 'OFFLINE' || (typeof navigator !== 'undefined' && !navigator.onLine))) {
    return (
      <div 
        data-testid="sync-status-indicator"
        data-sync-state="OFFLINE"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-300"
        title="Browser is offline. Local changes remain in this browser; external sync is unavailable."
      >
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        <span className="font-bold text-[11px]">{t('status.offline') || 'OFFLINE'}</span>
      </div>
    );
  }

  if (connState === 'RECONNECTING') {
    return (
      <div 
        data-testid="sync-status-indicator"
        data-sync-state="RECONNECTING"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse"
        title="Reconnecting to the configured sync relay. Local changes remain in this browser."
      >
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span className="font-bold text-[11px]">{t('status.reconnecting') || 'RECONNECTING'}</span>
      </div>
    );
  }

  const liveBadgeLabel = isLocalMode ? (t('status.local') || 'LOCAL') : (t('status.live') || 'LIVE');

  if (compact) {
    return (
      <span
        data-testid="sync-status-indicator"
        data-sync-state={isLocalMode ? 'LOCAL' : 'LIVE'}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${isLocalMode ? 'bg-sky-50 text-sky-800 border-sky-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}
        title={liveTitle}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isLocalMode ? 'bg-sky-600' : 'bg-emerald-500'}`} />
        <span>{liveBadgeLabel}</span>
      </span>
    );
  }

  return (
    <div
      data-testid="sync-status-indicator"
      data-sync-state={isLocalMode ? 'LOCAL' : 'LIVE'}
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs font-semibold border shadow-2xs ${isLocalMode ? 'bg-sky-50 text-sky-800 border-sky-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}
      title={liveTitle}
    >
      <div className="relative flex items-center justify-center">
        <span className={`w-2 h-2 rounded-full relative ${isLocalMode ? 'bg-sky-600' : 'bg-emerald-600'}`} />
      </div>
      <span className="font-extrabold tracking-wider text-[11px]">{liveBadgeLabel}</span>
      <span className={`text-[10px] font-normal hidden sm:inline ${isLocalMode ? 'text-sky-700/80' : 'text-emerald-700/80'}`}>
        • {isLocalMode ? (t('status.thisBrowser') || 'This browser') : `${formatText()} (~${latency}ms)`}
      </span>
    </div>
  );
};
