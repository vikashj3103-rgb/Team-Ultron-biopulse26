/**
 * CareConnect Unified Camera Adapter
 * Cross-platform camera capture and device enumeration.
 */
import { CameraAdapter, CameraDeviceInfo } from './types';

export class PlatformCameraAdapter implements CameraAdapter {
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  async getAvailableCameras(): Promise<CameraDeviceInfo[]> {
    if (!this.isSupported() || !navigator.mediaDevices.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${idx + 1}`,
          facingMode: d.label.toLowerCase().includes('front') || d.label.toLowerCase().includes('user') ? 'user' : 'environment',
        }));
    } catch {
      return [];
    }
  }

  async getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream | null> {
    if (!this.isSupported()) return null;
    try {
      return await navigator.mediaDevices.getUserMedia(
        constraints || {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        }
      );
    } catch (err) {
      console.warn('[PlatformCamera] getUserMedia error:', err);
      return null;
    }
  }
}

export const platformCamera = new PlatformCameraAdapter();
