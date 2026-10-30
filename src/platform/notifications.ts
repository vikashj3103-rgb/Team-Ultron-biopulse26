/**
 * CareConnect Unified Notification Adapter
 * Bridges Tauri 2 desktop notifications with HTML5 Web Notifications and in-app alerts.
 */
import { NotificationAdapter, NotificationPayload } from './types';
import { detectPlatformTarget } from './detection';

export class PlatformNotificationAdapter implements NotificationAdapter {
  private target = detectPlatformTarget();

  isSupported(): boolean {
    if (this.target === 'windows-tauri') return true;
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (this.target === 'windows-tauri') {
      try {
        const tauriNotification = await import('@tauri-apps/plugin-notification');
        const granted = await tauriNotification.isPermissionGranted();
        if (granted) return 'granted';
        const permission = await tauriNotification.requestPermission();
        return permission === 'granted' ? 'granted' : 'denied';
      } catch {
        // Fallback to Web API if plugin is not loaded yet
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      return await Notification.requestPermission();
    }

    return 'denied';
  }

  async showNotification(payload: NotificationPayload): Promise<boolean> {
    if (this.target === 'windows-tauri') {
      try {
        const tauriNotification = await import('@tauri-apps/plugin-notification');
        const isGranted = await tauriNotification.isPermissionGranted();
        if (!isGranted) {
          const perm = await tauriNotification.requestPermission();
          if (perm !== 'granted') return false;
        }

        tauriNotification.sendNotification({
          title: payload.title,
          body: payload.body,
        });
        return true;
      } catch (err) {
        console.warn('[PlatformNotification] Tauri notification fallback to Web:', err);
      }
    }

    // Web Notification API fallback
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(payload.title, {
          body: payload.body,
          icon: payload.icon || '/favicon.ico',
          tag: payload.tag,
        });
        return true;
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(payload.title, {
            body: payload.body,
            icon: payload.icon || '/favicon.ico',
            tag: payload.tag,
          });
          return true;
        }
      }
    }

    return false;
  }

  async setBadgeCount(count: number): Promise<void> {
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      try {
        if (count > 0) {
          await (navigator as unknown as { setAppBadge: (c: number) => Promise<void> }).setAppBadge(count);
        } else {
          await (navigator as unknown as { clearAppBadge: () => Promise<void> }).clearAppBadge();
        }
      } catch {
        // Badging API ignored if unsupported
      }
    }
  }
}

export const platformNotifications = new PlatformNotificationAdapter();
