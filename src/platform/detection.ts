/**
 * CareConnect Platform Detection & Capability Introspection
 */
import { PlatformCapabilities, PlatformTarget } from './types';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
    webkitSpeechRecognition?: unknown;
    SpeechRecognition?: unknown;
  }
}

export function detectPlatformTarget(): PlatformTarget {
  if (typeof window === 'undefined') return 'web';

  // Check Tauri 2.x presence
  if (Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__)) {
    return 'windows-tauri';
  }

  // Check Capacitor Mobile presence
  if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function') {
    if (window.Capacitor.isNativePlatform()) {
      return 'mobile-capacitor';
    }
  }

  return 'web';
}

export function inspectPlatformCapabilities(): PlatformCapabilities {
  const target = detectPlatformTarget();
  const isTauri = target === 'windows-tauri';
  const isMobile = target === 'mobile-capacitor';
  const isDesktop = isTauri;
  const isWeb = target === 'web';

  const hasMediaDevices = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  const hasSpeechRec = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const hasSpeechSynth = typeof window !== 'undefined' && Boolean(window.speechSynthesis);
  const hasNotifs = typeof window !== 'undefined' && ('Notification' in window || isTauri);
  const hasStorage = typeof window !== 'undefined' && Boolean(window.localStorage);

  return {
    target,
    isDesktop,
    isTauri,
    isMobile,
    isWeb,
    hasHardwareCamera: hasMediaDevices,
    hasSpeechRecognition: hasSpeechRec,
    hasSpeechSynthesis: hasSpeechSynth,
    hasNativeNotifications: hasNotifs,
    hasSecureStorage: isTauri || hasStorage,
    hasWindowControls: isTauri,
  };
}
