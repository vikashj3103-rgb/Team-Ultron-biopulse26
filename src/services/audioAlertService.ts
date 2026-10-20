/**
 * HealthConnect Clinical Audio Alert & Multilingual Speech Synthesis Engine
 * 
 * Provides:
 * 1. Live clinical alert audio notifications for Doctor, Attender, and Admin roles.
 * 2. Intelligent deduplication and debounce: avoids spamming on every telemetry tick.
 * 3. Dynamic multilingual speech synthesis with patient's live values.
 * 4. Role-specific phrasing: clinically detailed for Doctors, privacy-safe and reassuring for Attenders.
 * 5. Resilient fallback to Web Audio API synthesized chimes if TTS is unavailable or blocked.
 * 6. Browser autoplay safety with graceful degradation.
 */

import { VitalAlert, AlertSeverity, UserRole } from '../types';
import { getLanguage, getSpeechLocale } from '../i18n';

interface AnnouncedAlertRecord {
  alertId: string;
  severity: AlertSeverity;
  vitalType: string;
  valueRecorded: string;
  announcedAt: number;
}

export interface AudioAlertOptions {
  role?: UserRole;
  language?: string;
  force?: boolean;
}

class AudioAlertService {
  private announcedAlerts: Map<string, AnnouncedAlertRecord> = new Map();
  private isProcessing = false;
  private audioContext: AudioContext | null = null;
  private isMuted = false;
  private readonly COOLDOWN_MS = {
    critical: 30000, // 30s cooldown for repeating critical alerts if unresolved
    high: 45000,     // 45s cooldown for warnings
    attention: 60000 // 60s cooldown for review items
  };

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const storedMute = localStorage.getItem('healthconnect_audio_muted');
        this.isMuted = storedMute === 'true';
      } catch {
        this.isMuted = false;
      }
    }
  }

  public isEnabled(): boolean {
    return !this.isMuted;
  }

  public setEnabled(enabled: boolean): void {
    this.isMuted = !enabled;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('healthconnect_audio_muted', (!enabled).toString());
      } catch {
        // LocalStorage unavailable
      }
    }
    if (enabled) {
      this.playChime('info');
    }
  }

  public toggleSound(): boolean {
    const next = !this.isEnabled();
    this.setEnabled(next);
    return next;
  }

  /**
   * Evaluates an alert and determines whether an announcement is clinically warranted.
   * Prevents spamming unchanged readings across ticks.
   */
  public shouldAnnounce(alert: VitalAlert, now = Date.now()): boolean {
    if (!this.isEnabled()) return false;
    if (alert.status !== 'active' && alert.status !== 'responding') return false;

    const record = this.announcedAlerts.get(alert.id);
    if (!record) {
      // First time this alert is observed
      return true;
    }

    // Severity escalation warrants immediate re-announcement
    const severityRank: Record<AlertSeverity, number> = {
      critical: 3,
      high: 2,
      attention: 1,
    };
    if (severityRank[alert.severity] > severityRank[record.severity]) {
      return true;
    }

    // Value shift significant change
    if (alert.currentValue && record.valueRecorded && alert.currentValue !== record.valueRecorded && alert.severity === 'critical') {
      const elapsed = now - record.announcedAt;
      if (elapsed > 15000) {
        return true;
      }
    }

    // Cooldown elapsed
    const cooldown = this.COOLDOWN_MS[alert.severity] || 30000;
    return now - record.announcedAt >= cooldown;
  }

  /**
   * Generates localized speech text based on role, language, and clinical alert details.
   */
  public formatAnnouncementText(alert: VitalAlert, role: UserRole = 'doctor', language?: string): string {
    const lang = language || getLanguage();
    const patientName = alert.patientName || 'Patient';
    const val = alert.currentValue || alert.valueRecorded || '';
    const isCritical = alert.severity === 'critical';
    const isHigh = alert.severity === 'high';
    const vital = alert.vitalType;

    // Doctor receives clinically detailed announcement
    if (role === 'doctor' || role === 'admin') {
      if (lang === 'ta') {
        const vitalNameTa: Record<string, string> = {
          BP: 'இரத்த அழுத்தம்',
          PULSE: 'இதயத் துடிப்பு',
          SPO2: 'ஆக்ஸிஜன் செறிவு',
          TEMP: 'உடல் வெப்பநிலை',
          RR: 'சுவாச வீதம்',
        };
        const name = vitalNameTa[vital] || vital;
        if (isCritical) {
          return `அவசர நிலை. ${patientName}. ${name} ${val}, மிகக் குறைந்த அல்லது ஆபத்தான நிலையில் உள்ளது. உடனடி மருத்துவக் கவனிப்பு தேவை.`;
        }
        if (isHigh) {
          return `எச்சரிக்கை. ${patientName}. ${name} ${val} ஆக உள்ளது. நோயாளியின் நிலையை மதிப்பாய்வு செய்யவும்.`;
        }
        return `மருத்துவ மறுஆய்வு தேவை. ${patientName}. ${name} ${val} ஆக பதிவாகியுள்ளது. தயவுசெய்து சரிபார்க்கவும்.`;
      }

      if (lang === 'hi') {
        const vitalNameHi: Record<string, string> = {
          BP: 'रक्तचाप',
          PULSE: 'हृदय गति',
          SPO2: 'ऑक्सीजन संतृप्ति',
          TEMP: 'शारीरिक तापमान',
          RR: 'श्वसन दर',
        };
        const name = vitalNameHi[vital] || vital;
        if (isCritical) {
          return `आपातकालीन स्थिति। ${patientName}। ${name} ${val} है, जो गंभीर सीमा से बाहर है। तत्काल ध्यान देने की आवश्यकता है।`;
        }
        if (isHigh) {
          return `चेतावनी। ${patientName}। ${name} ${val} है। कृपया मरीज की स्थिति की समीक्षा करें।`;
        }
        return `नैदानिक समीक्षा आवश्यक। ${patientName}। ${name} ${val} है।`;
      }

      if (lang === 'te') {
        const vitalNameTe: Record<string, string> = {
          BP: 'రక్తపోటు',
          PULSE: 'గుండె వేగం',
          SPO2: 'ఆక్సిజన్ సంతృప్తత',
          TEMP: 'శరీర ఉష్ణోగ్రత',
          RR: 'శ్వాసకోశ రేటు',
        };
        const name = vitalNameTe[vital] || vital;
        if (isCritical) {
          return `అత్యవసర పరిస్థితి. ${patientName}. ${name} ${val} వద్ద ఉంది, ప్రమాదకర స్థితిలో ఉంది. తక్షణ వైద్య సంరక్షణ అవసరం.`;
        }
        if (isHigh) {
          return `హెచ్చరిక. ${patientName}. ${name} ${val} వద్ద ఉంది. దయచేసి రోగి స్థితిని సమీక్షించండి.`;
        }
        return `క్లినికల్ సమీక్ష అవసరం. ${patientName}. ${name} ${val}.`;
      }

      // English (default)
      if (vital === 'BP') {
        if (isCritical) {
          return `Emergency. ${patientName}. Blood pressure is ${val}, exceeding critical threshold. Immediate clinical review required.`;
        }
        if (isHigh) {
          return `Warning. ${patientName}. Blood pressure is ${val}. High clinical review recommended.`;
        }
        return `Clinical review required. ${patientName}. Blood pressure is ${val}. Please review the patient's condition.`;
      }

      if (vital === 'SPO2') {
        if (isCritical) {
          return `Emergency. ${patientName}. Oxygen saturation is ${val}. Severe desaturation below critical threshold. Immediate attention required.`;
        }
        if (isHigh) {
          return `Warning. ${patientName}. Oxygen saturation is ${val}. Please review the patient's condition.`;
        }
        return `Clinical review required. ${patientName}. Oxygen saturation is ${val}.`;
      }

      if (vital === 'PULSE') {
        if (isCritical) {
          return `Emergency. ${patientName}. Pulse rate is ${val}. Immediate attention required.`;
        }
        if (isHigh) {
          return `Warning. ${patientName}. Heart rate is elevated at ${val}. Please review.`;
        }
        return `Clinical review required. ${patientName}. Pulse rate is ${val}.`;
      }

      if (vital === 'TEMP') {
        if (isCritical) {
          return `Emergency. ${patientName}. Temperature is ${val}. Immediate hyperpyrexia review required.`;
        }
        return `Warning. ${patientName}. Temperature is ${val}. Please review the patient's condition.`;
      }

      return `Clinical alert. ${patientName}. ${vital} recorded at ${val}.`;
    }

    // Attender receives a calmer, reassuring, privacy-safe message with live value
    if (lang === 'ta') {
      const vitalNameTa: Record<string, string> = {
        BP: 'இரத்த அழுத்தம்',
        PULSE: 'இதயத் துடிப்பு',
        SPO2: 'ஆக்ஸிஜன் அளவு',
        TEMP: 'உடல் வெப்பநிலை',
        RR: 'சுவாச வீதம்',
      };
      const name = vitalNameTa[vital] || 'உடல் அளவீடு';
      const valStr = val ? ` (${val})` : '';
      if (isCritical || isHigh) {
        return `கவனம். ${patientName} அவர்களின் ${name}${valStr} பாதுகாப்பான அளவைத் தாண்டியுள்ளது. மருத்துவக் குழுவுக்குத் தகவல் தெரிவிக்கப்பட்டுள்ளது.`;
      }
      return `அறிவிப்பு. ${patientName} அவர்களின் ${name}${valStr} கண்காணிக்கப்படுகிறது. செவிலியர் குழு கவனித்து வருகிறது.`;
    }

    if (lang === 'hi') {
      const vitalNameHi: Record<string, string> = {
        BP: 'रक्तचाप',
        PULSE: 'हृदय गति',
        SPO2: 'ऑक्सीजन स्तर',
        TEMP: 'तापमान',
        RR: 'श्वसन दर',
      };
      const name = vitalNameHi[vital] || 'वाइटल्स';
      const valStr = val ? ` (${val})` : '';
      if (isCritical || isHigh) {
        return `ध्यान दें। ${patientName} का ${name}${valStr} सुरक्षित सीमा से बाहर है। मेडिकल टीम को सूचित कर दिया गया है।`;
      }
      return `सूचना। ${patientName} का ${name}${valStr} की निगरानी नर्सिंग टीम द्वारा की जा रही है।`;
    }

    if (lang === 'te') {
      const vitalNameTe: Record<string, string> = {
        BP: 'రక్తపోటు',
        PULSE: 'గుండె వేగం',
        SPO2: 'ఆక్సిజన్ స్థాయి',
        TEMP: 'ఉష్ణోగ్రత',
        RR: 'శ్వాసకోశ రేటు',
      };
      const name = vitalNameTe[vital] || 'వైటల్స్';
      const valStr = val ? ` (${val})` : '';
      if (isCritical || isHigh) {
        return `శ్రద్ధ వహించండి. ${patientName} యొక్క ${name}${valStr} సురక్షిత పరిధి వెలుపల ఉంది. వైద్య బృందానికి సమాచారం అందించబడింది.`;
      }
      return `సమాచారం. ${patientName} యొక్క ${name}${valStr} నర్సింగ్ బృందం పర్యవేక్షిస్తోంది.`;
    }

    // English Attender
    const friendlyName = vital === 'SPO2' ? 'oxygen level' : vital === 'BP' ? 'blood pressure' : vital === 'PULSE' ? 'heart rate' : vital === 'RR' ? 'breathing rate' : 'temperature';
    const valText = val ? ` at ${val}` : '';
    if (isCritical || isHigh) {
      return `Attention. ${patientName}'s ${friendlyName}${valText} is outside the safe range. The medical team has been notified.`;
    }
    return `Notice. ${patientName}'s ${friendlyName}${valText} has shifted. The nursing team is monitoring.`;
  }

  /**
   * Announces a clinical alert via Web Speech Synthesis or synthetic audio chime.
   */
  public async announceAlert(alert: VitalAlert, options: AudioAlertOptions = {}): Promise<boolean> {
    if (!this.isEnabled() && !options.force) {
      return false;
    }

    const now = Date.now();
    if (!options.force && !this.shouldAnnounce(alert, now)) {
      return false;
    }

    // Update announcement tracking record
    this.announcedAlerts.set(alert.id, {
      alertId: alert.id,
      severity: alert.severity,
      vitalType: alert.vitalType,
      valueRecorded: alert.currentValue || alert.valueRecorded || '',
      announcedAt: now,
    });

    const role = options.role || 'doctor';
    const lang = options.language || getLanguage();
    const speechText = this.formatAnnouncementText(alert, role, lang);

    // Play tone chime first
    this.playToneForSeverity(alert.severity);

    // Speak announcement if SpeechSynthesis is available in browser
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel(); // Cancel any lingering utterance

        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.lang = getSpeechLocale(lang);
        utterance.rate = 1.0;
        utterance.pitch = alert.severity === 'critical' ? 1.05 : 1.0;
        utterance.volume = 0.95;

        // Pick preferred voice if available for locale
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(
          (v) => v.lang.startsWith(utterance.lang) || v.lang.includes(lang)
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        window.speechSynthesis.speak(utterance);
        return true;
      } catch (err) {
        console.warn('Speech synthesis playback deferred or restricted by browser:', err);
        return false;
      }
    }

    return true;
  }

  /**
   * Synthesizes audio tones using Web Audio API for hospital chime sounds.
   */
  private playToneForSeverity(severity: AlertSeverity): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      const ctx = this.audioContext;
      const now = ctx.currentTime;

      if (severity === 'critical') {
        // High urgency two-tone hospital alarm
        [880, 1174.66, 880, 1174.66].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0.2, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.1);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.11);
        });
      } else if (severity === 'high') {
        // Warning chime
        [587.33, 880].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.15);
          gain.gain.setValueAtTime(0.15, now + idx * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.13);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.15);
          osc.stop(now + idx * 0.15 + 0.14);
        });
      } else {
        // Soft review chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.21);
      }
    } catch {
      // AudioContext unavailable or blocked by autoplay policy
    }
  }

  public playChime(tone: 'critical' | 'warning' | 'info' = 'info'): void {
    const sevMap: Record<string, AlertSeverity> = {
      critical: 'critical',
      warning: 'high',
      info: 'attention',
    };
    this.playToneForSeverity(sevMap[tone] || 'attention');
  }

  /**
   * Resets internal tracking cache (e.g. for testing)
   */
  public reset(): void {
    this.announcedAlerts.clear();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }
}

export const audioAlertService = new AudioAlertService();
