import { VitalReading, VitalStatus, VitalAlert, AlertSeverity, Patient, ClinicalConditionType } from '../types';
import { formatTemperatureF } from '../utils/temperature';

/**
 * ==============================================================================
 * HEALTHCONNECT VITAL ALERT ENGINE (PROTOTYPE RULES ENGINE)
 * ==============================================================================
 * 
 * DISCLAIMER / ARCHITECTURAL NOTICE:
 * These thresholds are configurable prototype demonstration parameters designed 
 * to exhibit real-time anomaly detection, multi-tier notification escalation,
 * and acknowledgement workflows for the HealthConnect assistive system.
 * They DO NOT constitute medical diagnosis, clinical practice guidelines, or 
 * autonomous treatment decisions.
 * ==============================================================================
 */

export interface ThresholdConfig {
  bp: {
    criticalHighSystolic: number;
    highSystolic: number;
    attentionSystolic: number;
    normalSystolicMin: number;
    criticalLowSystolic: number;
    criticalHighDiastolic: number;
    highDiastolic: number;
    attentionDiastolic: number;
  };
  pulse: {
    criticalHigh: number;
    high: number;
    attentionHigh: number;
    normalMin: number;
    attentionLow: number;
    criticalLow: number;
  };
  spO2: {
    criticalLow: number;
    highLow: number;
    attentionLow: number;
    normalMin: number;
  };
  temperature: {
    criticalHigh: number;
    high: number;
    attentionHigh: number;
    normalMin: number;
    criticalLow: number;
  };
}

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  bp: {
    criticalHighSystolic: 160,
    highSystolic: 140,
    attentionSystolic: 130,
    normalSystolicMin: 90,
    criticalLowSystolic: 80,
    criticalHighDiastolic: 100,
    highDiastolic: 90,
    attentionDiastolic: 85,
  },
  pulse: {
    criticalHigh: 125,
    high: 110,
    attentionHigh: 100,
    normalMin: 60,
    attentionLow: 55,
    criticalLow: 50,
  },
  spO2: {
    criticalLow: 90,
    highLow: 93,
    attentionLow: 95,
    normalMin: 96,
  },
  temperature: {
    criticalHigh: 39.0, // Celsius
    high: 38.0,
    attentionHigh: 37.4,
    normalMin: 36.5,
    criticalLow: 35.5,
  },
};

/** True only while sound is enabled and a critical clinical alert remains unacknowledged. */
export function shouldRepeatCriticalAlertSound(
  alerts: readonly Pick<VitalAlert, 'severity' | 'status'>[],
  soundEnabled: boolean
): boolean {
  return soundEnabled && alerts.some((alert) => alert.severity === 'critical' && alert.status === 'active');
}

/** Demo-only reference ranges derived from the configurable alert thresholds. */
export function getDemoVitalReferenceRange(vitalType: VitalAlert['vitalType'], language = 'en'): string {
  if (language === 'ta') {
    switch (vitalType) {
      case 'BP': return 'மேல் 90–129 / கீழ் <85 mmHg';
      case 'PULSE': return 'நிமிடத்திற்கு 60–99 துடிப்புகள்';
      case 'SPO2': return '96–100%';
      case 'TEMP': return '36.5–37.3 °C';
      default: return 'டெமோ குறிப்பு வரம்பு பதிவு செய்யப்படவில்லை';
    }
  }
  switch (vitalType) {
    case 'BP': return 'SBP 90–129 / DBP <85 mmHg';
    case 'PULSE': return '60–99 bpm';
    case 'SPO2': return '96–100%';
    case 'TEMP': return '36.5–37.3 °C';
    default: return 'No demo reference range recorded';
  }
}

export function evaluateBP(systolic: number, diastolic: number, cfg = DEFAULT_THRESHOLDS.bp): VitalStatus {
  if (systolic >= cfg.criticalHighSystolic || systolic < cfg.criticalLowSystolic || diastolic >= cfg.criticalHighDiastolic) {
    return 'critical';
  }
  if (systolic >= cfg.highSystolic || diastolic >= cfg.highDiastolic) {
    return 'high';
  }
  if (systolic >= cfg.attentionSystolic || diastolic >= cfg.attentionDiastolic || systolic < cfg.normalSystolicMin) {
    return 'attention';
  }
  return 'stable';
}

export function evaluatePulse(pulse: number, cfg = DEFAULT_THRESHOLDS.pulse): VitalStatus {
  if (pulse >= cfg.criticalHigh || pulse < cfg.criticalLow) {
    return 'critical';
  }
  if (pulse >= cfg.high || pulse < cfg.attentionLow) {
    return 'high';
  }
  if (pulse >= cfg.attentionHigh || pulse < cfg.normalMin) {
    return 'attention';
  }
  return 'stable';
}

export function evaluateSpO2(spO2: number, cfg = DEFAULT_THRESHOLDS.spO2): VitalStatus {
  if (spO2 < cfg.criticalLow) {
    return 'critical';
  }
  if (spO2 < cfg.highLow) {
    return 'high';
  }
  if (spO2 < cfg.attentionLow) {
    return 'attention';
  }
  return 'stable';
}

export function evaluateTemperature(temp: number, cfg = DEFAULT_THRESHOLDS.temperature): VitalStatus {
  if (temp >= cfg.criticalHigh || temp < cfg.criticalLow) {
    return 'critical';
  }
  if (temp >= cfg.high) {
    return 'high';
  }
  if (temp >= cfg.attentionHigh || temp < cfg.normalMin) {
    return 'attention';
  }
  return 'stable';
}

export function evaluateRespiratoryRate(rr: number): VitalStatus {
  if (rr > 26 || rr < 10) {
    return 'critical';
  }
  if (rr >= 22 || rr <= 11) {
    return 'high';
  }
  if (rr > 20) {
    return 'attention';
  }
  return 'stable';
}

/**
 * Centralized clinical threshold evaluator ensuring unified status determinations
 * across DoctorDashboard, AttenderDashboard, and monitoring alert components.
 */
export function evaluateClinicalThreshold(
  vital: 'spO2' | 'pulse' | 'temperature' | 'bp' | 'rr',
  value: any
): { status: VitalStatus; label: string } {
  switch (vital) {
    case 'spO2': {
      const val = Number(value);
      const status = evaluateSpO2(val);
      const label = status === 'stable' ? 'Target SpO₂ (≥96%)' : status === 'attention' ? 'Mild Desaturation (94–95%)' : status === 'high' ? 'Warning Hypoxemia (90–93%)' : 'Critical Hypoxemia (<90%)';
      return { status, label };
    }
    case 'pulse': {
      const val = Number(value);
      const status = evaluatePulse(val);
      const label = status === 'stable' ? 'Normal Pulse (60–100 bpm)' : status === 'attention' ? 'Elevated Pulse (100–110 bpm)' : status === 'high' ? 'Tachycardia (110–125 bpm)' : 'Critical Pulse (>125 or <50 bpm)';
      return { status, label };
    }
    case 'temperature': {
      const val = Number(value);
      const status = evaluateTemperature(val);
      const label = status === 'stable' ? 'Normal Temp (36.5–37.3°C / 97.7–99.2°F)' : status === 'attention' ? 'Low-grade Fever' : status === 'high' ? 'High Fever (≥38.0°C / 100.4°F)' : 'Critical Hyperpyrexia (≥39.0°C / 102.2°F)';
      return { status, label };
    }
    case 'bp': {
      if (typeof value === 'object' && value !== null) {
        const sys = Number(value.systolic || value.systolicBP || 120);
        const dia = Number(value.diastolic || value.diastolicBP || 80);
        const status = evaluateBP(sys, dia);
        const label = status === 'stable' ? 'Normotensive' : status === 'attention' ? 'Pre-hypertensive' : status === 'high' ? 'Stage 1/2 Hypertension' : 'Hypertensive Crisis / Severe Hypotension';
        return { status, label };
      }
      return { status: 'stable', label: 'Blood Pressure Normal' };
    }
    case 'rr': {
      const val = Number(value);
      const status = evaluateRespiratoryRate(val);
      const label = status === 'stable' ? 'Normal RR (12–20 bpm)' : status === 'attention' ? 'Tachypnea Mild (21–22 bpm)' : status === 'high' ? 'Tachypnea High (23–26 bpm)' : 'Respiratory Distress (>26 or <10 bpm)';
      return { status, label };
    }
    default:
      return { status: 'stable', label: 'Normal' };
  }
}

export function evaluateOverallStatus(statuses: VitalStatus[]): VitalStatus {
  if (statuses.includes('critical')) return 'critical';
  if (statuses.includes('high')) return 'high';
  if (statuses.includes('attention')) return 'attention';
  return 'stable';
}

export function analyzeVitalReading(
  reading: Omit<VitalReading, 'status' | 'bpStatus' | 'pulseStatus' | 'spO2Status' | 'tempStatus' | 'rrStatus'> & { respiratoryRate?: number },
  cfg = DEFAULT_THRESHOLDS
): VitalReading {
  const bpStatus = evaluateBP(reading.systolicBP, reading.diastolicBP, cfg.bp);
  const pulseStatus = evaluatePulse(reading.pulse, cfg.pulse);
  const spO2Status = evaluateSpO2(reading.spO2, cfg.spO2);
  const tempStatus = evaluateTemperature(reading.temperature, cfg.temperature);
  const rrStatus = reading.respiratoryRate !== undefined ? evaluateRespiratoryRate(reading.respiratoryRate) : undefined;
  
  const allStatuses: VitalStatus[] = [bpStatus, pulseStatus, spO2Status, tempStatus];
  if (rrStatus) allStatuses.push(rrStatus);
  const status = evaluateOverallStatus(allStatuses);

  return {
    ...reading,
    status,
    bpStatus,
    pulseStatus,
    spO2Status,
    tempStatus,
    rrStatus,
  };
}

/**
 * Extracts the preceding baseline reading of the exact vital parameter type.
 * Ensures BP compares to previous BP, Pulse to previous Pulse, SpO2 to SpO2, etc.
 */
export function getPreviousVitalValue(
  patient: Patient,
  vitalType: 'BP' | 'PULSE' | 'SPO2' | 'TEMP' | 'RR' | 'GENERAL'
): { value: string; unit: string } {
  const history = patient.vitalsHistory || [];
  const prevReading = history.length > 1 ? history[history.length - 2] : (history[0] || patient.latestVitals);

  switch (vitalType) {
    case 'BP': {
      const sys = prevReading?.systolicBP ?? 120;
      const dia = prevReading?.diastolicBP ?? 80;
      return { value: `${sys}/${dia} mmHg`, unit: 'mmHg' };
    }
    case 'PULSE': {
      const pulse = prevReading?.pulse ?? 72;
      return { value: `${pulse} bpm`, unit: 'bpm' };
    }
    case 'SPO2': {
      const spo2 = prevReading?.spO2 ?? 98;
      return { value: `${spo2}%`, unit: '%' };
    }
    case 'TEMP': {
      const temp = prevReading?.temperature ?? 36.8;
      return { value: formatTemperatureF(temp), unit: '°F' };
    }
    case 'RR': {
      const rr = prevReading?.respiratoryRate ?? 16;
      return { value: `${rr} breaths/min`, unit: 'breaths/min' };
    }
    default:
      return { value: '--', unit: '' };
  }
}

/**
 * Maps a vital telemetry reading to its canonical ClinicalConditionType.
 */
export function determineConditionType(
  vitalType: 'BP' | 'PULSE' | 'SPO2' | 'TEMP' | 'RR',
  reading: VitalReading
): ClinicalConditionType {
  switch (vitalType) {
    case 'SPO2':
      return 'HYPOXIA';
    case 'BP':
      return reading.systolicBP < 85 ? 'HYPOTENSION' : 'HYPERTENSION';
    case 'PULSE':
      return reading.pulse < 55 ? 'BRADYCARDIA' : 'TACHYCARDIA';
    case 'TEMP':
      return reading.temperature < 35.5 ? 'HYPOTHERMIA' : (reading.temperature >= 39.0 ? 'HYPERPYREXIA' : 'FEVER');
    case 'RR':
      return 'RESPIRATORY_DISTRESS';
    default:
      return 'GENERAL';
  }
}

/**
 * Generates or updates alerts with strict Clinical Episode deduplication.
 * Telemetry != Alert.
 * One patient + one ongoing clinical condition = ONE active clinical episode.
 * Repeated telemetry readings update the existing episode (occurrenceCount, lastUpdatedAt, currentValue)
 * instead of generating duplicate dashboard cards.
 */
export function checkForAlerts(
  patient: Patient,
  reading: VitalReading,
  existingActiveAlerts: VitalAlert[] = []
): { newAlerts: VitalAlert[]; updatedAlerts: VitalAlert[]; resolvedAlerts: VitalAlert[] } {
  const newAlerts: VitalAlert[] = [];
  const updatedAlerts: VitalAlert[] = [];
  const resolvedAlerts: VitalAlert[] = [];

  const processVitalAlert = (
    vitalType: 'BP' | 'PULSE' | 'SPO2' | 'TEMP' | 'RR',
    vitalStatus: VitalStatus,
    valueStr: string,
    triggerDesc: string,
    doctorMsg: string,
    familyMsg: string
  ) => {
    const conditionType = determineConditionType(vitalType, reading);
    const alertKey = `${patient.id}:${conditionType}`;

    // Lookup existing active (unresolved) episode for this patient & condition
    const existing = existingActiveAlerts.find(
      (a) =>
        (a.alertKey === alertKey ||
          (a.patientId === patient.id && (a.conditionType === conditionType || a.vitalType === vitalType))) &&
        (a.status === 'active' || a.status === 'acknowledged' || a.status === 'responding')
    );

    // If vital returned to stable:
    if (vitalStatus === 'stable') {
      if (existing) {
        const nowIso = new Date().toISOString();
        existing.currentValue = valueStr;
        existing.trend = 'improving';
        existing.lastUpdatedAt = nowIso;
        existing.timestamp = nowIso;
        existing.occurrenceCount = (existing.occurrenceCount || 1) + 1;
        existing.readingsCount = existing.occurrenceCount;
        existing.recoveryCount = (existing.recoveryCount || 0) + 1;

        // Hysteresis: sustained recovery required before auto-resolving
        if (existing.recoveryCount >= 3) {
          existing.status = 'resolved';
          existing.resolvedAt = nowIso;
          existing.resolvedBy = 'Vital Telemetry Engine (Hysteresis Verified)';
          existing.recoveryEligible = true;
          resolvedAlerts.push(existing);
        }
        updatedAlerts.push(existing);
      }
      return;
    }

    const severity: AlertSeverity =
      vitalStatus === 'critical' ? 'critical' : vitalStatus === 'high' ? 'high' : 'attention';

    const prevInfo = getPreviousVitalValue(patient, vitalType);
    const prevVal = existing?.previousValue || existing?.currentValue || existing?.valueRecorded || prevInfo.value;

    const isDeteriorating = severity === 'critical' || (existing ? existing.severity === 'attention' && severity === 'high' : false);
    const trend: 'deteriorating' | 'improving' | 'stable' = isDeteriorating ? 'deteriorating' : 'stable';
    const nowIso = new Date().toISOString();

    if (existing) {
      // DEDUPLICATION: Update existing clinical episode with latest reading and count, NO DUPLICATE CARDS
      existing.previousValue = existing.currentValue || existing.valueRecorded || prevVal;
      existing.currentValue = valueStr;
      existing.valueRecorded = valueStr;
      existing.occurrenceCount = (existing.occurrenceCount || 1) + 1;
      existing.readingsCount = existing.occurrenceCount;
      existing.lastUpdatedAt = nowIso;
      existing.timestamp = nowIso;
      existing.recoveryCount = 0; // Reset recovery count while telemetry is abnormal
      existing.recoveryEligible = false;
      existing.bed = patient.bed;
      existing.unit = prevInfo.unit;
      if (!existing.alertKey) existing.alertKey = alertKey;
      if (!existing.conditionType) existing.conditionType = conditionType;

      // Only upgrade severity/trigger messages if deteriorating or newly critical
      if (severity === 'critical' && existing.severity !== 'critical') {
        existing.severity = severity;
        existing.trigger = triggerDesc;
        existing.message = doctorMsg;
        existing.familyMessage = familyMsg;
        existing.trend = 'deteriorating';
      } else {
        existing.trend = trend;
      }
      updatedAlerts.push(existing);
    } else {
      // Create new patient-scoped clinical episode
      newAlerts.push({
        id: `alert-${patient.id}-${conditionType.toLowerCase()}-${Date.now()}`,
        alertKey,
        conditionType,
        patientId: patient.id,
        patientName: patient.name,
        room: patient.room,
        bed: patient.bed,
        encounterId: patient.activeEncounterId || `enc-${patient.id}`,
        severity,
        status: 'active',
        trigger: triggerDesc,
        message: doctorMsg,
        familyMessage: familyMsg,
        vitalType,
        unit: prevInfo.unit,
        valueRecorded: valueStr,
        baselineValue: prevInfo.value,
        previousValue: prevVal,
        currentValue: valueStr,
        trend,
        timestamp: nowIso,
        firstDetectedAt: nowIso,
        lastUpdatedAt: nowIso,
        occurrenceCount: 1,
        readingsCount: 1,
        recoveryCount: 0,
        recoveryEligible: false,
        escalationStatus: 'NONE',
        source: 'Clinical Telemetry',
      });
    }
  };

  // Evaluate BP
  processVitalAlert(
    'BP',
    reading.bpStatus,
    `${reading.systolicBP}/${reading.diastolicBP} mmHg`,
    `Blood pressure ${reading.bpStatus}: ${reading.systolicBP}/${reading.diastolicBP} mmHg`,
    `Patient ${patient.name} (${patient.room}) BP is ${reading.systolicBP}/${reading.diastolicBP} mmHg, exceeding configured ${reading.bpStatus} threshold.`,
    reading.bpStatus === 'critical'
      ? "🔴 URGENT ALERT: Your patient's blood pressure requires immediate medical attention. The clinical care team has been notified."
      : "⚠️ ATTENTION NEEDED: Your patient's blood pressure has shifted. Please wait for / follow the medical team's instructions."
  );

  // Evaluate Pulse
  processVitalAlert(
    'PULSE',
    reading.pulseStatus,
    `${reading.pulse} bpm`,
    `Pulse rate ${reading.pulseStatus}: ${reading.pulse} bpm`,
    `Patient ${patient.name} (${patient.room}) pulse rate is ${reading.pulse} bpm, flagged as ${reading.pulseStatus}.`,
    reading.pulseStatus === 'critical'
      ? "🔴 URGENT ALERT: Heart rate is significantly abnormal. Attending physician has been notified."
      : "⚠️ ATTENTION NEEDED: Heart rate is elevated. The nursing team is monitoring."
  );

  // Evaluate SpO2
  processVitalAlert(
    'SPO2',
    reading.spO2Status,
    `${reading.spO2}%`,
    `SpO2 oxygen saturation ${reading.spO2Status}: ${reading.spO2}%`,
    `Patient ${patient.name} (${patient.room}) SpO2 dropped to ${reading.spO2}%, requiring immediate clinical attention.`,
    reading.spO2Status === 'critical'
      ? "🔴 URGENT ALERT: Oxygen saturation dropped significantly. Oxygen titration required."
      : "⚠️ ATTENTION NEEDED: Oxygen level is slightly below target. Medical team has been alerted."
  );

  // Evaluate Temperature
  processVitalAlert(
    'TEMP',
    reading.tempStatus,
    formatTemperatureF(reading.temperature),
    `Body temperature ${reading.tempStatus}: ${formatTemperatureF(reading.temperature)}`,
    `Patient ${patient.name} (${patient.room}) temperature recorded at ${formatTemperatureF(reading.temperature)}.`,
    reading.tempStatus === 'critical'
      ? "🔴 URGENT ALERT: High fever detected. Antipyretic protocol indicated."
      : "⚠️ ATTENTION NEEDED: Body temperature is elevated. Monitoring hydration and comfort."
  );

  // Evaluate Respiratory Rate if available
  if (reading.respiratoryRate !== undefined && reading.rrStatus) {
    processVitalAlert(
      'RR',
      reading.rrStatus,
      `${reading.respiratoryRate} breaths/min`,
      `Respiratory rate ${reading.rrStatus}: ${reading.respiratoryRate} breaths/min`,
      `Patient ${patient.name} (${patient.room}) respiratory rate is ${reading.respiratoryRate} breaths/min (${reading.rrStatus}).`,
      reading.rrStatus === 'critical'
        ? "🔴 URGENT ALERT: Respiratory distress detected. Immediate airway and oxygenation review required."
        : "⚠️ ATTENTION NEEDED: Breathing rate is elevated. The clinical team is monitoring."
    );
  }

  return { newAlerts, updatedAlerts, resolvedAlerts };
}
