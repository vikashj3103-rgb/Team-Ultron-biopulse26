/**
 * CareConnect Unified Audio & Chime Adapter
 * Synthesizes deterministic clinical chimes & telemetry alarms using Web Audio API.
 */
import { AudioAdapter, AudioAlertOptions } from './types';

export class PlatformAudioAdapter implements AudioAdapter {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private activeIntervals: number[] = [];

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(0.7, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  setMasterVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(clamped, this.audioCtx.currentTime);
    }
  }

  async playAlert(options: AudioAlertOptions): Promise<() => void> {
    const ctx = this.getAudioContext();
    if (!ctx || !this.masterGain) return () => {};

    const stopFn = () => {
      this.stopAll();
    };

    if (options.type === 'chime') {
      this.playTone(ctx, 880, 0.15, 'sine');
      setTimeout(() => this.playTone(ctx, 1174.66, 0.25, 'sine'), 150);
      return stopFn;
    }

    if (options.type === 'warning') {
      this.playTone(ctx, 659.25, 0.2, 'triangle');
      setTimeout(() => this.playTone(ctx, 659.25, 0.2, 'triangle'), 250);
      return stopFn;
    }

    if (options.type === 'critical' || options.type === 'sos') {
      const playPulsedAlarm = () => {
        this.playTone(ctx, 987.77, 0.18, 'sawtooth');
        setTimeout(() => this.playTone(ctx, 783.99, 0.22, 'sawtooth'), 200);
      };

      playPulsedAlarm();
      if (options.loop) {
        const intervalId = window.setInterval(playPulsedAlarm, 800);
        this.activeIntervals.push(intervalId);
      }
      return stopFn;
    }

    return stopFn;
  }

  private playTone(ctx: AudioContext, freq: number, duration: number, type: OscillatorType) {
    if (!this.masterGain) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(ctx.currentTime + duration);

      this.activeOscillators.push(osc);
      osc.onended = () => {
        const idx = this.activeOscillators.indexOf(osc);
        if (idx >= 0) this.activeOscillators.splice(idx, 1);
      };
    } catch {
      // Audio autoplay restrictions or context closed
    }
  }

  stopAll(): void {
    this.activeIntervals.forEach((id) => clearInterval(id));
    this.activeIntervals = [];

    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignored
      }
    });
    this.activeOscillators = [];
  }
}

export const platformAudio = new PlatformAudioAdapter();
