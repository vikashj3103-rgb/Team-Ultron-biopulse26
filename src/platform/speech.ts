/**
 * CareConnect Unified Speech Adapter
 * Cross-platform speech-to-text (voice assistant) and text-to-speech (clinical telemetry alerts).
 */
import { SpeechAdapter, SpeechRecognitionOptions } from './types';

// Browser SpeechRecognition interface shims
interface IWindowSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export class PlatformSpeechAdapter implements SpeechAdapter {
  private activeRecognition: any = null;

  isRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as IWindowSpeech;
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  isSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  async startListening(options: SpeechRecognitionOptions): Promise<boolean> {
    if (!this.isRecognitionSupported()) {
      options.onError?.('Speech recognition is not supported on this device/browser.');
      return false;
    }

    try {
      this.stopListening();
      const win = window as IWindowSpeech;
      const RecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
      const recognizer = new RecognitionClass();

      recognizer.lang = options.language || 'en-US';
      recognizer.continuous = options.continuous ?? false;
      recognizer.interimResults = options.interimResults ?? true;

      recognizer.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          options.onResult(finalTranscript, true);
        } else if (interimTranscript) {
          options.onResult(interimTranscript, false);
        }
      };

      recognizer.onerror = (event: any) => {
        console.warn('[PlatformSpeech] Recognition error:', event.error);
        options.onError?.(event.error);
      };

      recognizer.onend = () => {
        this.activeRecognition = null;
        options.onEnd?.();
      };

      recognizer.start();
      this.activeRecognition = recognizer;
      return true;
    } catch (err: any) {
      console.warn('[PlatformSpeech] Failed to start speech recognition:', err);
      options.onError?.(err?.message || 'Failed to start speech recognition');
      return false;
    }
  }

  stopListening(): void {
    if (this.activeRecognition) {
      try {
        this.activeRecognition.stop();
      } catch {
        // Ignored
      }
      this.activeRecognition = null;
    }
  }

  async speak(
    text: string,
    options?: { lang?: string; rate?: number; pitch?: number; volume?: number }
  ): Promise<void> {
    if (!this.isSynthesisSupported()) return;

    return new Promise((resolve) => {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        if (options?.lang) utterance.lang = options.lang;
        if (options?.rate) utterance.rate = options.rate;
        if (options?.pitch) utterance.pitch = options.pitch;
        if (options?.volume) utterance.volume = options.volume;

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        window.speechSynthesis.speak(utterance);
      } catch {
        resolve();
      }
    });
  }

  cancelSpeech(): void {
    if (this.isSynthesisSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignored
      }
    }
  }
}

export const platformSpeech = new PlatformSpeechAdapter();
