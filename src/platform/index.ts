/**
 * CareConnect Unified Platform Capability Abstraction Layer
 * Main entry point and barrel export for desktop (Tauri 2), mobile, and web runtimes.
 */
import { PlatformAdapter, PlatformCapabilities, PlatformTarget } from './types';
import { detectPlatformTarget, inspectPlatformCapabilities } from './detection';
import { platformNotifications } from './notifications';
import { platformCamera } from './camera';
import { platformSpeech } from './speech';
import { platformAudio } from './audio';
import { platformStorage } from './storage';
import { platformLifecycle } from './lifecycle';

export * from './types';
export * from './detection';
export * from './notifications';
export * from './camera';
export * from './speech';
export * from './audio';
export * from './storage';
export * from './lifecycle';

class CareConnectPlatform implements PlatformAdapter {
  get target(): PlatformTarget {
    return detectPlatformTarget();
  }

  get capabilities(): PlatformCapabilities {
    return inspectPlatformCapabilities();
  }

  notifications = platformNotifications;
  camera = platformCamera;
  speech = platformSpeech;
  audio = platformAudio;
  storage = platformStorage;
  lifecycle = platformLifecycle;
}

export const platform = new CareConnectPlatform();

/**
 * React hook to access platform capabilities and runtime target.
 */
export function usePlatform() {
  const target = platform.target;
  const capabilities = platform.capabilities;

  return {
    platform,
    target,
    capabilities,
    isDesktop: capabilities.isDesktop,
    isTauri: capabilities.isTauri,
    isMobile: capabilities.isMobile,
    isWeb: capabilities.isWeb,
    notifications: platform.notifications,
    camera: platform.camera,
    speech: platform.speech,
    audio: platform.audio,
    storage: platform.storage,
    lifecycle: platform.lifecycle,
  };
}
