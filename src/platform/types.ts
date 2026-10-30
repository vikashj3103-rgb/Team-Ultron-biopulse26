/**
 * CareConnect Unified Platform Capability Abstraction Layer
 * Defines platform capability interfaces for Windows Desktop (Tauri 2), Mobile, and Web Browser.
 */

export type PlatformTarget = 'windows-tauri' | 'web' | 'mobile-capacitor';

export interface PlatformCapabilities {
  target: PlatformTarget;
  isDesktop: boolean;
  isTauri: boolean;
  isMobile: boolean;
  isWeb: boolean;
  hasHardwareCamera: boolean;
  hasSpeechRecognition: boolean;
  hasSpeechSynthesis: boolean;
  hasNativeNotifications: boolean;
  hasSecureStorage: boolean;
  hasWindowControls: boolean;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  urgency?: 'low' | 'normal' | 'critical';
  sound?: boolean;
  data?: Record<string, unknown>;
}

export interface NotificationAdapter {
  isSupported(): boolean;
  requestPermission(): Promise<NotificationPermission>;
  showNotification(payload: NotificationPayload): Promise<boolean>;
  setBadgeCount(count: number): Promise<void>;
}

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  facingMode?: 'user' | 'environment';
}

export interface CameraAdapter {
  isSupported(): boolean;
  requestPermission(): Promise<boolean>;
  getAvailableCameras(): Promise<CameraDeviceInfo[]>;
  getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream | null>;
}

export interface SpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

export interface SpeechAdapter {
  isRecognitionSupported(): boolean;
  isSynthesisSupported(): boolean;
  startListening(options: SpeechRecognitionOptions): Promise<boolean>;
  stopListening(): void;
  speak(text: string, options?: { lang?: string; rate?: number; pitch?: number; volume?: number }): Promise<void>;
  cancelSpeech(): void;
}

export interface AudioAlertOptions {
  type: 'chime' | 'warning' | 'critical' | 'sos';
  loop?: boolean;
  volume?: number;
}

export interface AudioAdapter {
  playAlert(options: AudioAlertOptions): Promise<() => void>;
  stopAll(): void;
  setMasterVolume(volume: number): void;
}

export interface SecureStorageAdapter {
  getItem<T = string>(key: string): Promise<T | null>;
  setItem<T = unknown>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface LifecycleAdapter {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  setFullscreen(fullscreen: boolean): Promise<void>;
  isFullscreen(): Promise<boolean>;
  onWindowFocus(callback: () => void): () => void;
  onWindowBlur(callback: () => void): () => void;
}

export interface PlatformAdapter {
  target: PlatformTarget;
  capabilities: PlatformCapabilities;
  notifications: NotificationAdapter;
  camera: CameraAdapter;
  speech: SpeechAdapter;
  audio: AudioAdapter;
  storage: SecureStorageAdapter;
  lifecycle: LifecycleAdapter;
}
