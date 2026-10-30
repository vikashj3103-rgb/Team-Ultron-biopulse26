/**
 * CareConnect Unified Secure Storage Adapter
 * Provides persistent key-value storage with Tauri plugin integration and web fallback.
 */
import { SecureStorageAdapter } from './types';
import { detectPlatformTarget } from './detection';

export class PlatformStorageAdapter implements SecureStorageAdapter {
  private target = detectPlatformTarget();
  private prefix = 'careconnect_store_';
  private memoryFallback = new Map<string, string>();

  async getItem<T = string>(key: string): Promise<T | null> {
    const storageKey = `${this.prefix}${key}`;

    if (this.target === 'windows-tauri') {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('careconnect-settings.json');
        const val = await store.get<T>(storageKey);
        if (val !== undefined && val !== null) return val;
      } catch {
        // Fallback to localStorage
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const item = window.localStorage.getItem(storageKey);
        if (!item) return null;
        return JSON.parse(item) as T;
      } catch {
        return (window.localStorage.getItem(storageKey) as unknown as T) || null;
      }
    }

    const memItem = this.memoryFallback.get(storageKey);
    if (!memItem) return null;
    try {
      return JSON.parse(memItem) as T;
    } catch {
      return memItem as unknown as T;
    }
  }

  async setItem<T = unknown>(key: string, value: T): Promise<void> {
    const storageKey = `${this.prefix}${key}`;

    if (this.target === 'windows-tauri') {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('careconnect-settings.json');
        await store.set(storageKey, value);
        await store.save();
        return;
      } catch {
        // Fallback to localStorage
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(value));
        return;
      } catch {
        // Fallback
      }
    }

    this.memoryFallback.set(storageKey, JSON.stringify(value));
  }

  async removeItem(key: string): Promise<void> {
    const storageKey = `${this.prefix}${key}`;

    if (this.target === 'windows-tauri') {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('careconnect-settings.json');
        await store.delete(storageKey);
        await store.save();
      } catch {
        // Fallback
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(storageKey);
    }
    this.memoryFallback.delete(storageKey);
  }

  async clear(): Promise<void> {
    if (this.target === 'windows-tauri') {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('careconnect-settings.json');
        await store.clear();
        await store.save();
      } catch {
        // Fallback
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    }
    this.memoryFallback.clear();
  }
}

export const platformStorage = new PlatformStorageAdapter();
