/**
 * CareConnect Unified Lifecycle & Window Control Adapter
 * Controls Tauri 2 desktop window frames (minimize, maximize, close, fullscreen) with browser fallbacks.
 */
import { LifecycleAdapter } from './types';
import { detectPlatformTarget } from './detection';

export class PlatformLifecycleAdapter implements LifecycleAdapter {
  private target = detectPlatformTarget();

  async minimize(): Promise<void> {
    if (this.target === 'windows-tauri') {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().minimize();
      } catch (err) {
        console.warn('[PlatformLifecycle] minimize error:', err);
      }
    }
  }

  async maximize(): Promise<void> {
    if (this.target === 'windows-tauri') {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().maximize();
      } catch (err) {
        console.warn('[PlatformLifecycle] maximize error:', err);
      }
    }
  }

  async toggleMaximize(): Promise<void> {
    if (this.target === 'windows-tauri') {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().toggleMaximize();
      } catch (err) {
        console.warn('[PlatformLifecycle] toggleMaximize error:', err);
      }
    }
  }

  async close(): Promise<void> {
    if (this.target === 'windows-tauri') {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().close();
      } catch (err) {
        console.warn('[PlatformLifecycle] close error:', err);
      }
    } else if (typeof window !== 'undefined') {
      window.close();
    }
  }

  async setFullscreen(fullscreen: boolean): Promise<void> {
    if (this.target === 'windows-tauri') {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().setFullscreen(fullscreen);
      } catch (err) {
        console.warn('[PlatformLifecycle] setFullscreen error:', err);
      }
    } else if (typeof document !== 'undefined') {
      if (fullscreen && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      } else if (!fullscreen && document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      }
    }
  }

  async isFullscreen(): Promise<boolean> {
    if (this.target === 'windows-tauri') {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        return await getCurrentWindow().isFullscreen();
      } catch {
        return false;
      }
    }
    return typeof document !== 'undefined' && Boolean(document.fullscreenElement);
  }

  onWindowFocus(callback: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener('focus', callback);
    return () => window.removeEventListener('focus', callback);
  }

  onWindowBlur(callback: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener('blur', callback);
    return () => window.removeEventListener('blur', callback);
  }
}

export const platformLifecycle = new PlatformLifecycleAdapter();
