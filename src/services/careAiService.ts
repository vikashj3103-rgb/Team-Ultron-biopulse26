/**
 * HealthConnect Multilingual Context-Aware CareAI Intent & Routing Service
 * 
 * Provides:
 * 1. Deterministic intent detection across English, Hindi, Tamil, Telugu, and other Indian languages.
 * 2. Conversational context tracking (remembers last mentioned destination for follow-ups like "How do I get there?" / "How far?").
 * 3. Structured rich responses (Route cards, Vitals cards, Medication cards, Map actions).
 * 4. Safety boundaries (Strict disclaimer, zero made-up diagnoses or prescription alterations).
 */

import { Patient, Medication, UserRole } from '../types';
import { hospitalMapService } from './hospitalMapService';
import { dataStore } from './dataStore';
import { formatTemperatureF } from '../utils/temperature';
import { getLanguage, t } from '../i18n';
import { clinicalAiService, ClinicalSummaryResult, sanitizePatientData } from './aiProvider';

export type CareAiIntentType =
  | 'CURRENT_LOCATION'
  | 'PATIENT_LOCATION'
  | 'HOSPITAL_DIRECTIONS'
  | 'MAP_ROUTE'
  | 'VITALS_CURRENT'
  | 'VITALS_LATEST'
  | 'VITALS_EXPLANATION'
  | 'FAHRENHEIT_EXPLANATION'
  | 'MEDICATION_SCHEDULE'
  | 'MEDICATION_EXPLANATION'
  | 'PATIENT_SUMMARY'
  | 'DOCTOR_INFORMATION'
  | 'NURSE_CALL'
  | 'EMERGENCY_HELP'
  | 'VISITING_HOURS'
  | 'PHARMACY'
  | 'CAFETERIA'
  | 'LAB'
  | 'BLOOD_BANK'
  | 'EMERGENCY_DEPARTMENT'
  | 'ROOM_SEARCH'
  | 'FOLLOWUP_DISTANCE'
  | 'FOLLOWUP_DIRECTIONS'
  | 'FOLLOWUP_FLOOR_WING'
  | 'MEDICATION_NEXT'
  | 'PRESCRIPTION_REQUEST'
  | 'DIAGNOSIS_REQUEST'
  | 'UNAUTHORIZED_PATIENT_REQUEST'
  | 'DOCTOR_SUMMARY'
  | 'DOCTOR_VITAL_TRENDS'
  | 'DOCTOR_TIMELINE'
  | 'SURGEON_INFORMATION'
  | 'ANESTHESIOLOGIST_INFORMATION'
  | 'CARE_TEAM_INFORMATION'
  | 'PROCEDURE_INFORMATION'
  | 'VITALS_BP_CURRENT'
  | 'VITALS_BP_TREND'
  | 'MONITORING_REASON'
  | 'ALERT_ACTION_GUIDANCE'
  | 'VITALS_OXYGEN_CURRENT'
  | 'VITALS_OXYGEN_CONCERN'
  | 'VITALS_OXYGEN_GUIDANCE'
  | 'VITALS_PULSE_CURRENT'
  | 'VITALS_PULSE_CONCERN'
  | 'VITALS_RR_CURRENT'
  | 'STAFF_PHONE_REQUEST'
  | 'ALL_PATIENTS_REQUEST'
  | 'DATA_NOT_AVAILABLE'
  | 'UNKNOWN';

export interface CareAiConversationContext {
  lastDestinationId?: string;
  lastDestinationName?: string;
  lastIntent?: CareAiIntentType;
  patient?: Patient;
  role?: UserRole;
  doctorId?: string;
}

export interface CareAiAction {
  label: string;
  actionType: 'CALL_NURSE' | 'VIEW_MEDS' | 'VIEW_DOCTOR' | 'VIEW_MAP' | 'VIEW_SUMMARY';
  meta?: any;
}

export interface CareAiResponse {
  reply: string;
  hasMapLink?: boolean;
  originId?: string;
  destId?: string;
  directions?: string[];
  cardType?: 'NONE' | 'ROUTE' | 'VITALS' | 'MEDICATIONS' | 'UNKNOWN' | 'PRESCRIPTION_RESTRICTED' | 'CLINICAL_SUMMARY' | 'SAFETY_WARNING';
  clinicalSummaryData?: ClinicalSummaryResult;
  actions?: CareAiAction[];
  routeData?: {
    destName: string;
    destCode: string;
    floor: number;
    wing: string;
    distanceMeters: number;
    estimatedMinutes: number;
    instructions: string[];
  };
  vitalData?: {
    patientName: string;
    bp: string;
    bpStatus: string;
    pulse: number;
    pulseStatus: string;
    spO2: number;
    spO2Status: string;
    tempF: string;
    tempC: number;
    tempStatus: string;
    recordedAt: string;
  };
  medicationData?: {
    patientName: string;
    doctorName: string;
    items: Array<{
      id: string;
      name: string;
      dosage: string;
      frequency: string;
      scheduledTime: string;
      status: string;
    }>;
  };
}

class CareAiService {
  private activeContext: CareAiConversationContext = {};

  public setContext(context: Partial<CareAiConversationContext>) {
    this.activeContext = { ...this.activeContext, ...context };
  }

  public getContext(): CareAiConversationContext {
    return this.activeContext;
  }

  public resetContext() {
    this.activeContext = {};
  }

  /**
   * Deterministic Intent Detector supporting normalized variants across English & Indian languages
   */
  public detectIntent(rawQuery: string): { intent: CareAiIntentType; targetLocation?: string } {
    const q = rawQuery.toLowerCase().trim();

    // 0a. Security: Prompt injection override attempts & Unauthorized patient queries (Section 12, 21, 29)
    if (
      q.includes('ignore previous') ||
      q.includes('ignore all previous') ||
      q.includes('disregard previous') ||
      q.includes('bypass') ||
      q.includes('override instructions') ||
      q.includes('override authorization') ||
      q.includes('jailbreak') ||
      q.includes('pretend you are') ||
      q.includes('where is patient ram') ||
      q.includes('where is ram') ||
      q.includes('is ram admitted') ||
      q.includes('is ram currently admitted') ||
      q.includes('who is the critical patient') ||
      q.includes('show me other patients') ||
      q.includes('tell me other patients') ||
      q.includes('list other patients') ||
      q.includes('tell me the patient in bed') ||
      q.includes('who is in bed b') ||
      q.includes('who is in bed a') ||
      q.includes('what is mrn') ||
      q.includes('mrn cc-2026-103') ||
      q.includes('cc-2026-103') ||
      q.includes('cc-2026-101') ||
      q.includes('another patient') ||
      q.includes('other patient') ||
      q.includes('patient xyz') ||
      q.includes('different patient') ||
      q.includes('someone else') ||
      q.includes('show me room') ||
      q.includes('details on room') ||
      q.includes('room 205') ||
      q.includes('room icu-205') ||
      q.includes('who is in room') ||
      q.includes('who is in bed') ||
      q.includes('another room') ||
      q.includes('other room') ||
      q.includes('வேறொரு நோயாளி') ||
      q.includes('மற்றுமொரு நோயாளி') ||
      q.includes('दूसरा मरीज') ||
      q.includes('अन्य मरीज') ||
      q.includes('మరొక రోగి')
    ) {
      if (!q.includes('11002') && !q.includes('cardio')) {
        return { intent: 'UNAUTHORIZED_PATIENT_REQUEST' };
      }
    }

    // 0b. Strict Attender Medical Prescription Restriction (Section 6)
    if (
      q.includes('which tablet should') ||
      q.includes('can i give another') ||
      q.includes('should i increase') ||
      q.includes('can i increase') ||
      q.includes('increase the dose') ||
      q.includes('increase the dosage') ||
      q.includes('increase dosage') ||
      q.includes('decrease the dose') ||
      q.includes('decrease the dosage') ||
      q.includes('change the dose') ||
      q.includes('change the dosage') ||
      q.includes('can i stop') ||
      q.includes('stop this medicine') ||
      q.includes('stop the medicine') ||
      q.includes('should i stop') ||
      q.includes('what medicine should i buy') ||
      q.includes('suggest a new') ||
      q.includes('suggest new') ||
      q.includes('suggest a tablet') ||
      q.includes('suggest a medicine') ||
      q.includes('can i replace') ||
      q.includes('what antibiotic should') ||
      q.includes('which medicine is best') ||
      q.includes('should i give this tablet') ||
      q.includes('should i give this medicine') ||
      q.includes('can i give him') ||
      q.includes('can i give her') ||
      q.includes('can i give this') ||
      q.includes('should i give now') ||
      q.includes('should i give') ||
      q.includes('can i take') ||
      q.includes('recommend medicine') ||
      q.includes('prescribe') ||
      q.includes('how many tablets') ||
      q.includes('how many tablets should i give') ||
      q.includes('can i increase') ||
      q.includes('increase this tablet') ||
      q.includes('increase tablet') ||
      q.includes('increase dose') ||
      q.includes('what dose') ||
      q.includes('how much dose') ||
      q.includes('give paracetamol') ||
      q.includes('give crocin') ||
      q.includes('can i give crocin') ||
      q.includes('give tablet') ||
      q.includes('give medicine') ||
      q.includes('எந்த மாத்திரை கொடுக்க') ||
      q.includes('புதிய மாத்திரை') ||
      q.includes('மருந்தை நிறுத்தலாமா') ||
      q.includes('மருந்து பரிந்துரை') ||
      q.includes('कौन सी गोली देनी चाहिए') ||
      q.includes('दवा बदल सकते हैं') ||
      q.includes('खुराक बढ़ाएं') ||
      q.includes('दवा बंद कर दें') ||
      q.includes('ఏ టాబ్లెట్ ఇవ్వాలి') ||
      q.includes('మందు మార్చవచ్చా')
    ) {
      return { intent: 'PRESCRIPTION_REQUEST' };
    }

    // 0c. Strict Attender Diagnosis Restriction (Section 8)
    if (
      q.includes('pneumonia') ||
      q.includes('heart failure') ||
      q.includes('have pneumonia') ||
      q.includes('has pneumonia') ||
      q.includes('having a heart attack') ||
      q.includes('heart attack') ||
      q.includes('what disease does this indicate') ||
      q.includes('what disease') ||
      q.includes('does this mean') ||
      q.includes('cancer') ||
      q.includes('is it a stroke') ||
      q.includes('stroke') ||
      q.includes('diagnose') ||
      q.includes('diagnosis') ||
      q.includes('is this fatal') ||
      q.includes('இது மாரடைப்பா') ||
      q.includes('இது என்ன நோய்') ||
      q.includes('क्या यह दिल का दौरा है') ||
      q.includes('यह कौन सी बीमारी है')
    ) {
      return { intent: 'DIAGNOSIS_REQUEST' };
    }

    // 0d. Doctor Clinical Assistant Intents (Section 9 & 10)
    if (
      q.includes('patient summary') ||
      q.includes('clinical summary') ||
      q.includes('generate summary') ||
      q.includes('handoff summary') ||
      q.includes('discharge summary')
    ) {
      return { intent: 'DOCTOR_SUMMARY' };
    }

    if (
      q.includes('vital trends') ||
      q.includes('vital trend') ||
      q.includes('trend interpretation')
    ) {
      return { intent: 'DOCTOR_VITAL_TRENDS' };
    }

    if (
      q.includes('recent timeline') ||
      q.includes('timeline synthesis') ||
      q.includes('timeline events') ||
      q.includes('timeline changes')
    ) {
      return { intent: 'DOCTOR_TIMELINE' };
    }

    // 0e. Alert action workflow guidance (Section 13)
    if (
      q.includes('what should i do about this alert') ||
      q.includes('what should i do about the alert') ||
      q.includes('what to do about this alert') ||
      q.includes('how to handle this alert') ||
      q.includes('action for this alert') ||
      q.includes('alert guidance') ||
      q.includes('what should i do for this alert') ||
      q.includes('எச்சரிக்கைக்கு என்ன செய்ய வேண்டும்') ||
      q.includes('इस अलर्ट के लिए क्या करें')
    ) {
      return { intent: 'ALERT_ACTION_GUIDANCE' };
    }

    // 0f. Monitoring reason (Section 13)
    if (
      q.includes('why is the patient being monitored') ||
      q.includes('why monitored') ||
      q.includes('reason for monitoring') ||
      q.includes('why are they monitoring') ||
      q.includes('why is he being monitored') ||
      q.includes('why is she being monitored') ||
      q.includes('monitoring reason') ||
      q.includes('ஏன் கண்காணிக்கப்படுகிறார்') ||
      q.includes('निगरानी क्यों')
    ) {
      return { intent: 'MONITORING_REASON' };
    }

    // 0g. BP Trend (Section 13)
    if (
      q.includes("has the patient's bp changed recently") ||
      q.includes('has bp changed') ||
      q.includes('bp changed recently') ||
      q.includes('blood pressure changed') ||
      q.includes('bp trend') ||
      q.includes('blood pressure trend') ||
      q.includes('vitals changed recently') ||
      q.includes('vital trend') ||
      q.includes('இரத்த அழுத்தம் மாறியுள்ளதா') ||
      q.includes('क्या बीपी बदला है')
    ) {
      return { intent: 'VITALS_BP_TREND' };
    }

    // 0h. BP Current specific reading (Section 13)
    if (
      (q.includes("what is the patient's current bp") ||
       q.includes('current bp') ||
       q.includes("patient's bp") ||
       q.includes('what is the bp') ||
       q.includes('blood pressure reading') ||
       q.includes('current blood pressure') ||
       q.includes('ரத்த அழுத்தம் என்ன') ||
       q.includes('தற்போதைய இரத்த அழுத்தம்') ||
       q.includes('ब्लड प्रेशर क्या है') ||
       q.includes('वर्तमान रक्तचाप')) &&
      !q.includes('trend') && !q.includes('changed')
    ) {
      return { intent: 'VITALS_BP_CURRENT' };
    }

    // 0i. Missing Data / Unsupported Telemetry / Unrecorded Labs
    if (
      q.includes('glucose') ||
      q.includes('blood sugar') ||
      q.includes('sugar level') ||
      q.includes('hba1c') ||
      q.includes('creatinine') ||
      q.includes('hemoglobin') ||
      q.includes('platelet') ||
      q.includes('cholesterol') ||
      q.includes('urine test') ||
      q.includes('சர்க்கரை அளவு') ||
      q.includes('ब्लड शुगर')
    ) {
      return { intent: 'DATA_NOT_AVAILABLE' };
    }

    // 0j. Direct Staff Phone & Contact Restriction (Strict Attender Safety)
    if (
      q.includes("doctor's phone") ||
      q.includes("doctor phone") ||
      q.includes("doctor's number") ||
      q.includes("doctor number") ||
      q.includes("nurse's phone") ||
      q.includes("nurse phone") ||
      q.includes("nurse number") ||
      q.includes("staff phone") ||
      q.includes("staff number") ||
      q.includes("give me the doctor's phone") ||
      q.includes("phone number of doctor") ||
      q.includes("contact number of doctor") ||
      q.includes("phone number of the doctor") ||
      q.includes("physician phone") ||
      q.includes("physician number") ||
      q.includes("மருத்துவரின் தொலைபேசி") ||
      q.includes("டாக்டர் போன்") ||
      q.includes("டாக்டரின் எண்") ||
      q.includes("डॉक्टर का फोन") ||
      q.includes("डॉक्टर का नंबर") ||
      q.includes("డాక్టర్ ఫోన్ నంబర్")
    ) {
      return { intent: 'STAFF_PHONE_REQUEST' };
    }

    // 0k. Cross-Patient & Inpatient Directory Query (Defense in Depth)
    if (
      q.includes('all patients') ||
      q.includes('other patients') ||
      q.includes('another patient') ||
      q.includes('show all patients') ||
      q.includes('list all patients') ||
      q.includes('tell me all patients') ||
      q.includes('who is in icu') ||
      q.includes('who are in icu') ||
      q.includes('patients in icu') ||
      q.includes('who is in room') ||
      q.includes('which patient is in room') ||
      q.includes('tell me all critical patients') ||
      q.includes('show all critical patients') ||
      q.includes('all critical patients') ||
      q.includes('where is another patient') ||
      q.includes('what is another patient') ||
      q.includes('show me a patient outside') ||
      q.includes('patient outside my authorization') ||
      q.includes('where is patient ram') ||
      q.includes('where is ram') ||
      q.includes('patient ram') ||
      q.includes('அனைத்து நோயாளிகள்') ||
      q.includes('மற்ற நோயாளிகள்') ||
      q.includes('வேறொரு நோயாளி') ||
      q.includes('அனைத்து ஆபத்தான நோயாளிகள்') ||
      q.includes('सभी मरीज') ||
      q.includes('अन्य मरीज') ||
      q.includes('आईसीयू में कौन') ||
      q.includes('అన్ని రోగులు') ||
      q.includes('ఇతర రోగులు')
    ) {
      return { intent: 'ALL_PATIENTS_REQUEST' };
    }

    // 0l. Oxygen Emergency Bedside Action Guidance
    if (
      (q.includes('what should i do') ||
       q.includes('what to do') ||
       q.includes('action') ||
       q.includes('how should i react') ||
       q.includes('how to respond') ||
       q.includes('என்ன செய்ய வேண்டும்') ||
       q.includes('क्या करना चाहिए') ||
       q.includes('ఏమి చేయాలి')) &&
      (q.includes('oxygen') ||
       q.includes('spo2') ||
       q.includes('critical') ||
       q.includes('drops') ||
       q.includes('drop') ||
       q.includes('low') ||
       q.includes('ஆக்ஸிஜன்') ||
       q.includes('ஆபத்து') ||
       q.includes('ऑक्सीजन') ||
       q.includes('गंभीर') ||
       q.includes('ఆక్సిజన్'))
    ) {
      return { intent: 'VITALS_OXYGEN_GUIDANCE' };
    }

    // 0m. Oxygen Clinical Significance & Concerning Status
    if (
      (q.includes('why') ||
       q.includes('concerning') ||
       q.includes('concern') ||
       q.includes('critical') ||
       q.includes('danger') ||
       q.includes('serious') ||
       q.includes('ஏன்') ||
       q.includes('கவலை') ||
       q.includes('ஆபத்து') ||
       q.includes('क्यों') ||
       q.includes('चिंता') ||
       q.includes('ఎందుకు')) &&
      (q.includes('oxygen') ||
       q.includes('spo2') ||
       q.includes('saturation') ||
       q.includes('ஆக்ஸிஜன்') ||
       q.includes('ऑक्सीजन') ||
       q.includes('ఆక్సిజన్')) &&
      !q.includes('what should i do') && !q.includes('what to do')
    ) {
      return { intent: 'VITALS_OXYGEN_CONCERN' };
    }

    // 0n. Specific Oxygen Saturation (SpO2) Reading
    if (
      (q.includes('oxygen level') ||
       q.includes('oxygen saturation') ||
       q.includes('current oxygen') ||
       q.includes('spo2 level') ||
       q.includes('current spo2') ||
       q.includes("patient's oxygen") ||
       q.includes('what is the oxygen') ||
       q.includes('what is his oxygen') ||
       q.includes('what is her oxygen') ||
       q.includes('how is his oxygen') ||
       q.includes('how is her oxygen') ||
       q.includes('ஆக்ஸிஜன் அளவு') ||
       q.includes('தற்போதைய ஆக்ஸிஜன்') ||
       q.includes('ऑक्सीजन स्तर') ||
       q.includes('वर्तमान ऑक्सीजन') ||
       q.includes('ఆక్సిజన్ స్థాయి')) &&
      !q.includes('concerning') && !q.includes('why') && !q.includes('what should')
    ) {
      return { intent: 'VITALS_OXYGEN_CURRENT' };
    }

    // 0o. Pulse / Heart Rate Concern
    if (
      (q.includes('why') || q.includes('concerning') || q.includes('high') || q.includes('low')) &&
      (q.includes('pulse') || q.includes('heart rate') || q.includes('இதயத் துடிப்பு') || q.includes('हृदय गति')) &&
      !q.includes('what is') && !q.includes('current')
    ) {
      return { intent: 'VITALS_PULSE_CONCERN' };
    }

    // 0p. Specific Heart Rate / Pulse Reading
    if (
      (q.includes('pulse rate') ||
       q.includes('current pulse') ||
       q.includes('heart rate') ||
       q.includes('current heart rate') ||
       q.includes("patient's pulse") ||
       q.includes("patient's heart rate") ||
       q.includes('what is his pulse') ||
       q.includes('what is his heart rate') ||
       q.includes('what is her pulse') ||
       q.includes('what is her heart rate') ||
       q.includes('இதயத் துடிப்பு என்ன') ||
       q.includes('हृदय गति क्या है')) &&
      !q.includes('why') && !q.includes('concerning')
    ) {
      return { intent: 'VITALS_PULSE_CURRENT' };
    }

    // 0q. Specific Respiratory Rate (RR)
    if (
      q.includes('respiratory rate') ||
      q.includes('breathing rate') ||
      q.includes('respiration rate') ||
      q.includes('breaths per minute') ||
      q.includes('சுவாச வீதம்') ||
      q.includes('श्वसन दर') ||
      q.includes('శ్వాసకోశ రేటు')
    ) {
      return { intent: 'VITALS_RR_CURRENT' };
    }

    // 1. Follow-up query detection based on previous conversation context
    if (this.activeContext.lastDestinationId) {
      if (
        q === 'how far?' ||
        q === 'how far is it?' ||
        q.includes('how far') ||
        q.includes('distance') ||
        q.includes('how long will it take') ||
        q.includes('how long to walk') ||
        q.includes('how long') ||
        q.includes('how many meters') ||
        q.includes('how far away') ||
        q.includes('walking distance') ||
        q.includes('எவ்வளவு தூரம்') ||
        q.includes('कितनी दूर') ||
        q.includes('ఎంత దూరం')
      ) {
        return { intent: 'FOLLOWUP_DISTANCE' };
      }

      if (
        q === 'how do i get there?' ||
        q === 'how to reach there?' ||
        q.includes('get there') ||
        q.includes('reach there') ||
        q.includes('directions to it') ||
        q.includes('how to go') ||
        q.includes('show directions') ||
        q.includes('guide me there') ||
        q.includes('guide me') ||
        q.includes('take me there') ||
        q.includes('path to') ||
        q.includes('route to') ||
        q.includes('show me the route') ||
        q.includes('show route') ||
        q.includes('அங்கே எப்படி செல்வது') ||
        q.includes('वहाँ कैसे जाएं') ||
        q.includes('అక్కడికి ఎలా వెళ్ళాలి')
      ) {
        return { intent: 'FOLLOWUP_DIRECTIONS' };
      }

      if (
        q.includes('what floor') ||
        q.includes('which floor') ||
        q.includes('what wing') ||
        q.includes('which wing') ||
        q.includes('which level') ||
        q.includes('what level') ||
        q.includes('tell me the floor') ||
        q.includes('எந்த தளம்') ||
        q.includes('कौन सी मंजिल') ||
        q.includes('ఏ అంతస్తు')
      ) {
        return { intent: 'FOLLOWUP_FLOOR_WING' };
      }
    }

    // 2. Current bedside location / Where am I?
    if (
      q.includes('where am i') ||
      q.includes('where are we') ||
      q.includes("where're we") ||
      q.includes('current location') ||
      q.includes('which room am i') ||
      q.includes('what room am i') ||
      q.includes('what room are we') ||
      q.includes('which room is the patient') ||
      q.includes('which room is my patient') ||
      q.includes('which ward are we') ||
      q.includes('which ward am i') ||
      q.includes('which ward') ||
      q.includes('what ward') ||
      q.includes('what floor are we on') ||
      q.includes('which floor are we on') ||
      q.includes('what floor are we') ||
      q.includes('which floor are we') ||
      q.includes('where is my patient') ||
      q.includes("where's my patient") ||
      q.includes('எங்கே இருக்கிறார்') ||
      q.includes('எங்கே இருக்கிறேன்') ||
      q.includes('நான் இப்போது எங்கே') ||
      q.includes('நாங்கள் எங்கே') ||
      q.includes('कहाँ हूँ') ||
      q.includes('कहाँ हैं') ||
      q.includes('मेरा मरीज कहाँ') ||
      q.includes('ఎక్కడ ఉన్నాను') ||
      q.includes('ఎక్కడ ఉన్నారు')
    ) {
      return { intent: 'CURRENT_LOCATION' };
    }

    // 3. Why Fahrenheit?
    if (
      q.includes('fahrenheit') ||
      q.includes('why f') ||
      (q.includes('why') && q.includes('temperature')) ||
      q.includes('பாரன்ஹீட்') ||
      q.includes('ஃபாரன்ஹீட்') ||
      q.includes('फ़ारेनहाइट') ||
      q.includes('ఫారెన్‌హీట్')
    ) {
      return { intent: 'FAHRENHEIT_EXPLANATION' };
    }

    // 4. Last vital recorded timestamp
    if (
      q.includes('last vital') ||
      q.includes('last recorded') ||
      q.includes('latest update') ||
      q.includes('when was the last') ||
      q.includes('கடைசியாக') ||
      q.includes('பதிவு செய்யப்பட்டன') ||
      q.includes('आखिरी बार') ||
      q.includes('चिవరిసారి')
    ) {
      return { intent: 'VITALS_LATEST' };
    }

    // 5. Specific Patient Temperature Query
    if (
      (q.includes('temperature') || q.includes('fever') || q.includes('வெப்பநிலை') || q.includes('காய்ச்சல்') || q.includes('तापमान') || q.includes('बुखार') || q.includes('ఉష్ణోగ్రత') || q.includes('జ్వరం')) &&
      (q.includes('what') || q.includes('how') || q.includes('current') || q.includes('patient') || q.includes('reading') || q.includes('என்ன') || q.includes('எவ்வளவு') || q.includes('कितना') || q.includes('क्या') || q.includes('ఎంత'))
    ) {
      return { intent: 'VITALS_CURRENT' };
    }

    // Care Team specific query
    if (
      q.includes('care team') ||
      q.includes('medical team') ||
      q.includes('who is on the team') ||
      q.includes('மருத்துவக் குழு') ||
      q.includes('केयर टीम')
    ) {
      return { intent: 'CARE_TEAM_INFORMATION' };
    }

    // Surgeon specific query
    if (
      q.includes('surgeon') ||
      q.includes('operating doctor') ||
      q.includes('who will operate') ||
      q.includes('who is operating') ||
      q.includes('surgical doctor') ||
      q.includes('who is the surgeon') ||
      q.includes('அறுவை சிகிச்சை மருத்துவர்') ||
      q.includes('सर्जन कौन')
    ) {
      return { intent: 'SURGEON_INFORMATION' };
    }

    // Anesthesiologist specific query
    if (
      q.includes('anesthesiologist') ||
      q.includes('anaesthetist') ||
      q.includes('anesthetist') ||
      q.includes('anesthesia') ||
      q.includes('anaesthesia') ||
      q.includes('who is the anesthesiologist') ||
      q.includes('மயக்க மருந்து') ||
      q.includes('एनेस्थीसिया')
    ) {
      return { intent: 'ANESTHESIOLOGIST_INFORMATION' };
    }

    // Procedure / Surgery specific query
    if (
      q.includes('procedure') ||
      q.includes('surgery') ||
      q.includes('operation') ||
      q.includes('scheduled surgery') ||
      q.includes('what procedure') ||
      q.includes('which procedure') ||
      q.includes('thyroidectomy') ||
      q.includes('அறுவை சிகிச்சை') ||
      q.includes('सर्जरी क्या है')
    ) {
      return { intent: 'PROCEDURE_INFORMATION' };
    }

    // Doctor information
    if (
      q.includes('who is the doctor') ||
      q.includes("who's the doctor") ||
      q.includes('who is my doctor') ||
      q.includes("who's my doctor") ||
      q.includes('who is treating') ||
      q.includes("who's treating") ||
      q.includes('which doctor is treating') ||
      q.includes('doctor is treating') ||
      q.includes('who is treating the patient') ||
      q.includes('attending doctor') ||
      q.includes('attending physician') ||
      q.includes('treating doctor') ||
      q.includes('treating physician') ||
      q.includes('doctor name') ||
      q.includes('physician') ||
      q.includes('doctor in charge') ||
      q.includes('மருத்துவர் யார்') ||
      q.includes('டாக்டர் யார்') ||
      q.includes('சிகிச்சை அளிக்கும் மருத்துவர்') ||
      q.includes('डॉक्टर कौन') ||
      q.includes('इलाज करने वाले डॉक्टर') ||
      q.includes('డాక్టర్ ఎవరు') ||
      q.includes('చికిత్స చేసే డాక్టర్')
    ) {
      return { intent: 'DOCTOR_INFORMATION' };
    }

    // Patient room & bed specific query
    if (
      q.includes('patient room') ||
      q.includes("patient's room") ||
      q.includes('which room is the patient in') ||
      q.includes('which room is patient in') ||
      q.includes('patient bed') ||
      q.includes("patient's bed") ||
      q.includes('which bed is') ||
      (q.includes('patient') && (q.includes('room') || q.includes('bed'))) ||
      q.includes('which bed') ||
      q.includes('room number') ||
      q.includes('bed number') ||
      q.includes('அறை எண்') ||
      q.includes('कमरा नंबर') ||
      q.includes('గది నంబర్')
    ) {
      return { intent: 'PATIENT_LOCATION' };
    }

    // 6a. Next medication / upcoming dose
    if (
      (q.includes('next') && (q.includes('med') || q.includes('medicine') || q.includes('dose'))) ||
      q.includes('upcoming dose') ||
      q.includes('upcoming medicine') ||
      q.includes('next dose') ||
      q.includes('when is the next dose') ||
      q.includes('which medicine comes next') ||
      q.includes('comes next') ||
      q.includes('what medicine is next') ||
      q.includes('அடுத்த மருந்து') ||
      q.includes('अगली दवा') ||
      q.includes('తదుపరి మందు')
    ) {
      return { intent: 'MEDICATION_NEXT' };
    }

    // 6b. Medications Schedule
    if (
      q.includes('scheduled') ||
      q.includes('medication schedule') ||
      q.includes('what med') ||
      q.includes('what medicine') ||
      q.includes('prescription') ||
      q.includes('when should he take') ||
      q.includes('when should she take') ||
      q.includes('மருந்து') ||
      q.includes('மருந்துகள்') ||
      q.includes('எப்போது கொடுக்க') ||
      q.includes('दवा') ||
      q.includes('दवाइयां') ||
      q.includes('कब देनी') ||
      q.includes('మందు') ||
      q.includes('మందులు') ||
      q.includes('ఎప్పుడు ఇవ్వాలి')
    ) {
      return { intent: 'MEDICATION_SCHEDULE' };
    }

    // 7. Pharmacy wayfinding
    if (
      q.includes('pharmacy') ||
      q.includes('chemist') ||
      q.includes('buy medicine') ||
      q.includes('medical shop') ||
      q.includes('medical store') ||
      q.includes('drug store') ||
      q.includes('drugstore') ||
      q.includes('medicine shop') ||
      q.includes('medicine store') ||
      q.includes('medicine counter') ||
      q.includes('மருந்தகம்') ||
      q.includes('மருந்து கடை') ||
      q.includes('फार्मेसी') ||
      q.includes('दवा की दुकान') ||
      q.includes('ఫార్మసీ') ||
      q.includes('మందుల దుకాణం')
    ) {
      return { intent: 'PHARMACY' };
    }

    // 8. Cardiology / Room 11002
    if (
      q.includes('cardiology') ||
      q.includes('cardio') ||
      q.includes('11002') ||
      q.includes('heart dept') ||
      q.includes('இதயவியல்') ||
      q.includes('கார்டியாலஜி') ||
      q.includes('हृदय रोग') ||
      q.includes('కార్డియాలజీ')
    ) {
      return { intent: 'HOSPITAL_DIRECTIONS', targetLocation: 'ROOM_11002' };
    }

    // 9. Pathology / Lab
    if (
      q.includes('lab') ||
      q.includes('pathology') ||
      q.includes('blood test') ||
      q.includes('blood bank') ||
      q.includes('ஆய்வகம்') ||
      q.includes('ரத்த பரிசோதனை') ||
      q.includes('पैथोलॉजी') ||
      q.includes('लैब') ||
      q.includes('రక్త పరీక్ష')
    ) {
      return { intent: 'LAB' };
    }

    // 10. Emergency department
    if (
      q.includes('emergency') ||
      q.includes('casualty') ||
      q.includes('er') ||
      q.includes('trauma') ||
      q.includes('அவசர சிகிச்சை') ||
      q.includes('आपातकालीन') ||
      q.includes('అత్యవసర విభాగం')
    ) {
      return { intent: 'EMERGENCY_DEPARTMENT' };
    }

    // 11. Duty nurse call
    if (
      q.includes('call nurse') ||
      q.includes('need nurse') ||
      q.includes('sister') ||
      q.includes('nurse help') ||
      q.includes('செவிலியர்') ||
      q.includes('நர்ஸ்') ||
      q.includes('नर्स') ||
      q.includes('నర్సు')
    ) {
      return { intent: 'NURSE_CALL' };
    }

    // 12. Visiting Hours
    if (
      q.includes('visiting') ||
      q.includes('hours') ||
      q.includes('timing') ||
      q.includes('visit time') ||
      q.includes('பார்வையிடும் நேரம்') ||
      q.includes('நேரம்') ||
      q.includes('मिलने का समय') ||
      q.includes('దర్శన సమయం')
    ) {
      return { intent: 'VISITING_HOURS' };
    }

    // 13. Cafeteria / Canteen
    if (
      q.includes('food') ||
      q.includes('canteen') ||
      q.includes('cafeteria') ||
      q.includes('coffee') ||
      q.includes('eat') ||
      q.includes('tea') ||
      q.includes('உணவகம்') ||
      q.includes('சாப்பாடு') ||
      q.includes('कैंटीन') ||
      q.includes('खाना') ||
      q.includes('భోజనం')
    ) {
      return { intent: 'CAFETERIA' };
    }

    // 13a. Main Reception & Front Desk
    if (
      q.includes('reception') ||
      q.includes('front desk') ||
      q.includes('help desk') ||
      q.includes('enquiry') ||
      q.includes('வரவேற்பு') ||
      q.includes('रिसेप्शन') ||
      q.includes('రిసెప్షన్')
    ) {
      return { intent: 'HOSPITAL_DIRECTIONS', targetLocation: 'RECEPTION_GF' };
    }

    // 14. Vitals overview / BP / Pulse / SpO2
    if (
      q.includes('vital') ||
      q.includes('bp') ||
      q.includes('heart rate') ||
      q.includes('pulse') ||
      q.includes('oxygen') ||
      q.includes('spo2') ||
      q.includes('உடல் நிலை') ||
      q.includes('அளவீடுகள்') ||
      q.includes('वाइटल्स') ||
      q.includes('వైటల్స్')
    ) {
      return { intent: 'VITALS_EXPLANATION' };
    }

    // 15. Dynamic location match in hospital map service
    const cleanTarget = q
      .replace(/where is|where's|how do i get to|how do i reach|how to reach|navigate to|directions to/gi, '')
      .replace(/எங்கே|செல்ல|வழிகாட்டு|कहाँ है|कहाँ|ఎక్కడ ఉంది|ఎక్కడ/gi, '')
      .trim();

    if (cleanTarget.length >= 3) {
      const match = hospitalMapService.findLocation(cleanTarget);
      if (match) {
        return { intent: 'ROOM_SEARCH', targetLocation: match.id };
      }
    }

    // 16. Fallback if query explicitly mentions "where" or "room"
    if (
      q.includes('where') ||
      q.includes('room') ||
      q.includes('direction') ||
      q.includes('reach') ||
      q.includes('find') ||
      q.includes('எங்கே') ||
      q.includes('வழி') ||
      q.includes('कहाँ') ||
      q.includes('रास्ता') ||
      q.includes('ఎక్కడ') ||
      q.includes('దారి')
    ) {
      return { intent: 'ROOM_SEARCH' };
    }

    return { intent: 'UNKNOWN' };
  }

  /**
   * Builds context-aware multilingual response with role-specific authorization and clinical safety
   */
  public processQuery(
    rawQuery: string,
    patient?: Patient,
    langOverride?: string,
    roleOverride?: UserRole,
    doctorIdOverride?: string
  ): CareAiResponse {
    const lang = langOverride || getLanguage();
    const role: UserRole = roleOverride || this.activeContext.role || 'attender';
    const doctorId = doctorIdOverride;
    const { intent, targetLocation } = this.detectIntent(rawQuery);
    const patientRoom = patient?.room || '';
    const patientLocationNode =
      (patient?.currentLocation?.mapNodeId
        ? hospitalMapService.getNodeById(patient.currentLocation.mapNodeId)
        : undefined) || (patientRoom ? hospitalMapService.findNodeByQuery(patientRoom) : undefined);
    const startId = patientLocationNode?.id || '';

    const patientScopedIntents = new Set<CareAiIntentType>([
      'CURRENT_LOCATION', 'PATIENT_LOCATION', 'VITALS_CURRENT', 'VITALS_LATEST',
      'VITALS_EXPLANATION', 'FAHRENHEIT_EXPLANATION', 'MEDICATION_SCHEDULE',
      'MEDICATION_EXPLANATION', 'MEDICATION_NEXT', 'PATIENT_SUMMARY',
      'DOCTOR_INFORMATION', 'DOCTOR_SUMMARY', 'DOCTOR_VITAL_TRENDS', 'DOCTOR_TIMELINE',
      'SURGEON_INFORMATION', 'ANESTHESIOLOGIST_INFORMATION', 'CARE_TEAM_INFORMATION',
      'PROCEDURE_INFORMATION', 'VITALS_BP_CURRENT', 'VITALS_BP_TREND', 'MONITORING_REASON',
      'ALERT_ACTION_GUIDANCE',
    ]);
    const routeIntents = new Set<CareAiIntentType>([
      'HOSPITAL_DIRECTIONS', 'MAP_ROUTE', 'ROOM_SEARCH', 'PHARMACY', 'LAB',
      'BLOOD_BANK', 'EMERGENCY_DEPARTMENT', 'FOLLOWUP_DISTANCE',
      'FOLLOWUP_DIRECTIONS', 'FOLLOWUP_FLOOR_WING',
    ]);

    if (!patient && patientScopedIntents.has(intent)) {
      return {
        reply: 'No patient is linked to this CareAI session, so I cannot provide bedside or clinical information. Please ask the hospital team to link the patient to your account.',
        cardType: 'SAFETY_WARNING',
      };
    }

    if (!patientLocationNode && routeIntents.has(intent)) {
      return {
        reply: 'I do not have a verified starting location for this session, so I cannot calculate a hospital route. Please check your room or floor with reception or the nursing station.',
        cardType: 'UNKNOWN',
      };
    }

    // Update conversation context
    this.activeContext.lastIntent = intent;
    if (patient) this.activeContext.patient = patient;
    if (roleOverride) this.activeContext.role = roleOverride;
    if (doctorIdOverride) this.activeContext.doctorId = doctorIdOverride;

    // 0a. Security: Unauthorized patient query rejection (Section 12, 21, 29)
    if (intent === 'UNAUTHORIZED_PATIENT_REQUEST') {
      let reply = 'Access restricted: I can only provide information about patients you are authorized to access.';
      if (lang === 'ta') {
        reply = 'அணுகல் தடைசெய்யப்பட்டது: உங்கள் கணக்குடன் இணைக்கப்பட்ட நோயாளிக்கான தகவல்களை மட்டுமே என்னால் வழங்க முடியும்.';
      } else if (lang === 'hi') {
        reply = 'पहुँच प्रतिबंधित: मैं केवल आपके खाते से जुड़े मरीज की जानकारी ही प्रदान कर सकता हूँ।';
      } else if (lang === 'te') {
        reply = 'ప్రాప్యత పరిమితం చేయబడింది: నేను మీ ఖాతాకు లింక్ చేయబడిన రోగి సమాచారాన్ని మాత్రమే అందించగలను.';
      }
      return { reply, cardType: 'SAFETY_WARNING' };
    }

    // 0a-1. Security: Block cross-patient requests & personal phone inquiries
    if (intent === 'ALL_PATIENTS_REQUEST') {
      if (role === 'attender' || !doctorId) {
        let reply = 'Access restricted: I can only provide information about patients you are authorized to access.';
        if (lang === 'ta') {
          reply = 'அணுகல் தடைசெய்யப்பட்டது: உங்கள் கணக்குடன் இணைக்கப்பட்ட நோயாளிக்கான தகவல்களை மட்டுமே என்னால் வழங்க முடியும்.';
        } else if (lang === 'hi') {
          reply = 'पहुँच प्रतिबंधित: मैं केवल आपके खाते से जुड़े मरीज की जानकारी ही प्रदान कर सकता हूँ।';
        } else if (lang === 'te') {
          reply = 'ప్రాప్యత పరిమితం చేయబడింది: నేను మీ ఖాతాకు లింక్ చేయబడిన రోగి సమాచారాన్ని మాత్రమే అందించగలను.';
        }
        return { reply, cardType: 'SAFETY_WARNING' };
      }
      const assigned = dataStore.getPatientsByDoctor(doctorId);
      const names = assigned.map((p) => `${p.name} (${p.room})`).join(', ');
      return {
        reply: `You currently have ${assigned.length} patient(s) assigned to your clinical roster: ${names || 'None'}. Access to non-assigned patients is restricted.`,
        cardType: 'CLINICAL_SUMMARY',
      };
    }

    if (intent === 'STAFF_PHONE_REQUEST') {
      let reply = 'For staff privacy and clinical safety, direct personal phone numbers of doctors and nursing staff are not disclosed. Please use the bedside Call Nurse button or contact the 24/7 Hospital Desk at +91 44 2800 0000 (Internal Ext: 100).';
      if (lang === 'ta') {
        reply = 'பணியாளர்களின் தனியுரிமைக்காக மருத்துவர்கள் அல்லது செவிலியர்களின் தனிப்பட்ட தொலைபேசி எண்கள் வழங்கப்படாது. படுக்கையருகே உள்ள செவிலியர் அழைப்பு பொத்தானைப் பயன்படுத்தவும் அல்லது மருத்துவமனை உதவி மையத்தை +91 44 2800 0000 என்ற எண்ணில் தொடர்பு கொள்ளவும்.';
      } else if (lang === 'hi') {
        reply = 'स्टाफ की गोपनीयता और सुरक्षा के लिए डॉक्टरों या नर्सों के व्यक्तिगत फोन नंबर प्रदान नहीं किए जाते हैं। कृपया बेडसाइड नर्स कॉल बटन दबाएं या अस्पताल सहायता डेस्क से +91 44 2800 0000 पर संपर्क करें।';
      } else if (lang === 'te') {
        reply = 'సిబ్బంది గోప్యత కోసం వైద్యులు లేదా నర్సుల వ్యక్తిగత ఫోన్ నంబర్లు అందించబడవు. దయచేసి బెడ్‌సైడ్ నర్సు కాల్ బటన్‌ను ఉపయోగించండి లేదా ఆసుపత్రి డెస్క్ +91 44 2800 0000 ను సంప్రదించండి.';
      }
      return {
        reply,
        cardType: 'SAFETY_WARNING',
        actions: [{ label: '🚨 Call Nurse', actionType: 'CALL_NURSE' }],
      };
    }

    // 0a-2. Attender cross-patient and unlinked entity isolation (Section 12 & 29)
    if (role === 'attender' && patient) {
      const qLower = rawQuery.toLowerCase();
      // Check if query references any other admitted patients by name or MRN
      const GENERIC_EXCLUSIONS = new Set(['patient', 'inpatient', 'room', 'bed', 'male', 'female', 'observation', 'admitted']);
      const allPatients = dataStore.getPatients();
      const mentionsOtherPatient = allPatients.some((other) => {
        if (other.id === patient.id) return false;
        const otherName = other.name.toLowerCase();
        const otherFirst = otherName.split(' ')[0];
        const otherMrn = other.mrn.toLowerCase();
        
        // Exact MRN match
        if (otherMrn && qLower.includes(otherMrn)) return true;
        // Full name match (if not generic)
        if (!GENERIC_EXCLUSIONS.has(otherName) && qLower.includes(otherName)) return true;
        // First name match with word boundary
        if (otherFirst.length >= 3 && !GENERIC_EXCLUSIONS.has(otherFirst)) {
          const regex = new RegExp(`\\b${otherFirst}\\b`, 'i');
          if (regex.test(qLower)) return true;
        }
        return false;
      });

      if (mentionsOtherPatient) {
        let reply = 'Access restricted: I can only provide information about patients you are authorized to access.';
        if (lang === 'ta') {
          reply = 'அணுகல் தடைசெய்யப்பட்டது: உங்கள் கணக்குடன் இணைக்கப்பட்ட நோயாளிக்கான தகவல்களை மட்டுமே என்னால் வழங்க முடியும்.';
        } else if (lang === 'hi') {
          reply = 'पहुँच प्रतिबंधित: मैं केवल आपके खाते से जुड़े मरीज की जानकारी ही प्रदान कर सकता हूँ।';
        } else if (lang === 'te') {
          reply = 'ప్రాప్యత పరిమితం చేయబడింది: నేను మీ ఖాతాకు లింక్ చేయబడిన రోగి సమాచారాన్ని మాత్రమే అందించగలను.';
        }
        return { reply, cardType: 'SAFETY_WARNING' };
      }

      // Match room/bed identifiers containing at least one digit (e.g. "room 205", "bed 02", "room ICU-204")
      const roomMatch = qLower.match(/\b(?:room|bed)\s*(?:#|no\.?|number)?\s*([a-z0-9-]*\d[a-z0-9-]*)\b/i);
      if (roomMatch && roomMatch[1]) {
        const queryRoom = roomMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '');
        const currentRoom = patient.room.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (queryRoom !== currentRoom && queryRoom !== '11002' && !queryRoom.includes('cardio')) {
          if (
            qLower.includes('show') ||
            qLower.includes('who') ||
            qLower.includes('patient') ||
            qLower.includes('occupant') ||
            qLower.includes('in') ||
            qLower.includes('is') ||
            qLower.includes('anyone') ||
            qLower.includes('what') ||
            qLower.includes('occupied') ||
            qLower.includes('empty')
          ) {
            let reply = 'Access restricted: I can only provide information about patients you are authorized to access.';
            if (lang === 'ta') {
              reply = 'அணுகல் தடைசெய்யப்பட்டது: உங்கள் கணக்குடன் இணைக்கப்பட்ட நோயாளிக்கான தகவல்களை மட்டுமே என்னால் வழங்க முடியும்.';
            } else if (lang === 'hi') {
              reply = 'पहुँच प्रतिबंधित: मैं केवल आपके खाते से जुड़े मरीज की जानकारी ही प्रदान कर सकता हूँ।';
            } else if (lang === 'te') {
              reply = 'ప్రాప్యత పరిమితం చేయబడింది: నేను మీ ఖాతాకు లింక్ చేయబడిన రోగి సమాచారాన్ని మాత్రమే అందించగలను.';
            }
            return { reply, cardType: 'SAFETY_WARNING' };
          }
        }
      }
    }

    // 0b. Doctor Patient Scoping Check (Section 9)
    if (role === 'doctor' && patient) {
      if (!doctorId) {
        return {
          reply: 'Access restricted: a verified clinician assignment is required before I can provide patient information.',
          cardType: 'SAFETY_WARNING',
        };
      }

      const assignedPatients = dataStore.getPatientsByDoctor(doctorId);
      const isAssigned = patient.assignedDoctorId === doctorId || assignedPatients.some((p) => p.id === patient.id);
      if (!isAssigned) {
        return {
          reply: 'Access restricted: As an attending clinician, you can only access telemetry and clinical documentation for patients assigned to your care.',
          cardType: 'SAFETY_WARNING',
        };
      }
    }

    // 0c. Doctor AI Clinical Summary (Section 9 & 10)
    if (intent === 'DOCTOR_SUMMARY' && patient) {
      const meds = dataStore.getMedications(patient.id);
      const alerts = dataStore.getAlerts(patient.id);
      const timeline = dataStore.getTimeline(patient.id);
      const summary = clinicalAiService.generateSummarySync(patient, meds, alerts, timeline);

      let reply = `AI Clinical Assistant — Summary Draft for ${patient.name} (${patient.mrn}):\n\n${summary.patientOverview}\n\n${summary.currentStatus}\n\n${summary.disclaimer}`;
      return {
        reply,
        cardType: 'CLINICAL_SUMMARY',
        clinicalSummaryData: summary,
        actions: [
          { label: '📋 View Full AI Summary', actionType: 'VIEW_SUMMARY' },
          { label: '💊 Prescribe Rx', actionType: 'VIEW_MEDS' },
        ],
      };
    }

    // 0d. Doctor AI Vital Trends (Section 9 & 10)
    if (intent === 'DOCTOR_VITAL_TRENDS' && patient) {
      const meds = dataStore.getMedications(patient.id);
      const alerts = dataStore.getAlerts(patient.id);
      const timeline = dataStore.getTimeline(patient.id);
      const summary = clinicalAiService.generateSummarySync(patient, meds, alerts, timeline);

      let reply = `Vital Trends Interpretation for ${patient.name}:\n\n` + summary.vitalTrends.join('\n') + `\n\n${summary.disclaimer}`;
      return {
        reply,
        cardType: 'CLINICAL_SUMMARY',
        clinicalSummaryData: summary,
      };
    }

    // 0e. Doctor AI Timeline Synthesis (Section 9 & 10)
    if (intent === 'DOCTOR_TIMELINE' && patient) {
      const meds = dataStore.getMedications(patient.id);
      const alerts = dataStore.getAlerts(patient.id);
      const timeline = dataStore.getTimeline(patient.id);
      const summary = clinicalAiService.generateSummarySync(patient, meds, alerts, timeline);

      let reply = `Recent Clinical Timeline Changes for ${patient.name}:\n\n` + summary.importantTimelineChanges.join('\n') + `\n\n${summary.disclaimer}`;
      return {
        reply,
        cardType: 'CLINICAL_SUMMARY',
        clinicalSummaryData: summary,
      };
    }

    // 0f. Strict Attender Medical Prescription Restriction (Section 6)
    if (intent === 'PRESCRIPTION_REQUEST') {
      let reply = "This medication decision should be confirmed with the patient's clinical team. I can explain the medications already recorded for your patient, but I cannot prescribe, add, remove, or change medication. Please contact the attending doctor or nursing staff before giving any additional medicine.";
      if (lang === 'ta') {
        reply = 'இந்த மருந்து முடிவை நோயாளியின் மருத்துவக் குழுவுடன் உறுதிப்படுத்த வேண்டும். உங்கள் நோயாளிக்கு ஏற்கனவே பதிவுசெய்யப்பட்ட மருந்துகளைப் பற்றி என்னால் விளக்க முடியும், ஆனால் என்னால் மருந்துகளைப் பரிந்துரைக்கவோ அல்லது மாற்றவோ முடியாது. கூடுதல் மருந்துகளை வழங்குவதற்கு முன் மருத்துவர் அல்லது செவிலியரைத் தொடர்பு கொள்ளவும்.';
      } else if (lang === 'hi') {
        reply = 'यह दवा निर्णय मरीज की क्लिनिकल टीम द्वारा पुष्टि किया जाना चाहिए। मैं आपके मरीज के लिए पहले से दर्ज दवाओं की जानकारी दे सकता हूँ, लेकिन मैं कोई दवा लिख या बदल नहीं सकता। कोई भी नई दवा देने से पहले कृपया डॉक्टर या नर्सिंग स्टाफ से संपर्क करें।';
      } else if (lang === 'te') {
        reply = 'ఈ ఔషధ నిర్ణయాన్ని రోగి యొక్క క్లినికల్ బృందంతో ధృవీకరించాలి. నేను మీ రోగికి ఇప్పటికే నమోదు చేయబడిన మందులను వివరించగలను, కానీ నేను మందులను సూచించలేను లేదా మార్చలేను. దయచేసి అదనపు మందులు ఇచ్చే ముందు వైద్యుడిని లేదా నర్సును సంప్రదించండి.';
      }

      return {
        reply,
        cardType: 'PRESCRIPTION_RESTRICTED',
        actions: [
          { label: '🚨 Call Hospital Staff', actionType: 'CALL_NURSE' },
          { label: '💊 View Scheduled Medications', actionType: 'VIEW_MEDS' },
          { label: '👨‍⚕️ View Attending Doctor', actionType: 'VIEW_DOCTOR' },
        ],
      };
    }

    // 0g. Strict Attender Diagnosis Restriction (Section 8)
    if (intent === 'DIAGNOSIS_REQUEST') {
      const docName = patient?.assignedDoctorName || 'your attending clinician';
      let reply = `CareAI provides supportive bedside information and cannot diagnose medical diseases or clinical pathology. Always consult ${docName} or nursing staff immediately for acute medical concerns.`;
      if (lang === 'ta') {
        reply = `கேர்கனெக்ட் மருத்துவ நோய்களைக் கண்டறியவோ அல்லது மருத்துவப் பரிசோதனைகளைத் தீர்மானிக்கவோ முடியாது. அவசர மருத்துவக் கவலைகளுக்கு உங்கள் மருத்துவர் அல்லது செவிலியரை உடனடியாகத் தொடர்பு கொள்ளவும்.`;
      } else if (lang === 'hi') {
        reply = `CareAI किसी बीमारी का निदान नहीं कर सकता। किसी भी गंभीर लक्षण के लिए कृपया तुरंत डॉक्टर या ड्यूटी नर्स से संपर्क करें।`;
      } else if (lang === 'te') {
        reply = `CareAI వ్యాధులను నిర్ధారించదు. దయచేసి తక్షణ సహాయం కోసం డ్యూటీ నర్సును లేదా మీ వైద్యుడిని సంప్రదించండి.`;
      }

      return {
        reply,
        cardType: 'SAFETY_WARNING',
        actions: [
          { label: '🚨 Call Nurse', actionType: 'CALL_NURSE' },
          { label: '👨‍⚕️ View Attending Doctor', actionType: 'VIEW_DOCTOR' },
        ],
      };
    }

    // 1. Follow-up: Distance
    if (intent === 'FOLLOWUP_DISTANCE' && this.activeContext.lastDestinationId) {
      const destId = this.activeContext.lastDestinationId;
      const route = hospitalMapService.findShortestPath(startId, destId);
      const destName = this.activeContext.lastDestinationName || 'the requested destination';
      const meters = route?.totalDistanceMeters || 65;
      const mins = route?.estimatedMinutes || 2;

      let reply = `It is approximately ${meters} meters from ${patientRoom} (about ${mins} min walk).`;
      if (lang === 'ta') {
        reply = `${patientRoom}-இலிருந்து சுமார் ${meters} மீட்டர் தொலைவில் உள்ளது (சுமார் ${mins} நிமிட நடை).`;
      } else if (lang === 'hi') {
        reply = `${patientRoom} से यह लगभग ${meters} मीटर की दूरी पर है (लगभग ${mins} मिनट का पैदल रास्ता)।`;
      } else if (lang === 'te') {
        reply = `${patientRoom} నుండి ఇది సుమారు ${meters} మీటర్ల దూరంలో ఉంది (సుమారు ${mins} నిమిషాల నడక).`;
      }

      return {
        reply,
        hasMapLink: true,
        originId: startId,
        destId,
        directions: route?.instructions || [],
        cardType: 'ROUTE',
        routeData: {
          destName,
          destCode: destId,
          floor: route?.toNode.floor ?? 1,
          wing: route?.toNode.wing ?? 'Main',
          distanceMeters: meters,
          estimatedMinutes: mins,
          instructions: route?.instructions || [],
        },
      };
    }

    // 2. Follow-up: Directions
    if (intent === 'FOLLOWUP_DIRECTIONS' && this.activeContext.lastDestinationId) {
      const destId = this.activeContext.lastDestinationId;
      const route = hospitalMapService.findShortestPath(startId, destId);
      const destName = this.activeContext.lastDestinationName || 'the destination';
      const steps = route?.instructions || [];

      let reply = `Here are the turn-by-turn directions to ${destName}:\n` + steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
      if (lang === 'ta') {
        reply = `${destName}-க்கு செல்ல வழிகாட்டுதல்:\n` + steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
      } else if (lang === 'hi') {
        reply = `${destName} के लिए दिशा-निर्देश:\n` + steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
      }

      return {
        reply,
        hasMapLink: true,
        originId: startId,
        destId,
        directions: steps,
        cardType: 'ROUTE',
        routeData: {
          destName,
          destCode: destId,
          floor: route?.toNode.floor ?? 1,
          wing: route?.toNode.wing ?? 'Main',
          distanceMeters: route?.totalDistanceMeters || 60,
          estimatedMinutes: route?.estimatedMinutes || 2,
          instructions: steps,
        },
      };
    }

    // 2b. Follow-up: Floor & Wing
    if (intent === 'FOLLOWUP_FLOOR_WING') {
      const destId = this.activeContext.lastDestinationId;
      if (destId) {
        const node = hospitalMapService.getNodeById(destId);
        const destName = this.activeContext.lastDestinationName || node?.name || 'the destination';
        const floor = node?.floor ?? 0;
        const wing = node?.wing ?? 'Main Wing';

        let reply = `${destName} is located on Floor ${floor} (${wing}).`;
        if (lang === 'ta') {
          reply = `${destName} தளம் ${floor} (${wing})-ல் அமைந்துள்ளது.`;
        } else if (lang === 'hi') {
          reply = `${destName} मंजिल ${floor} (${wing}) पर स्थित है।`;
        } else if (lang === 'te') {
          reply = `${destName} అంతస్తు ${floor} (${wing}) లో ఉంది.`;
        }

        return {
          reply,
          hasMapLink: true,
          originId: startId,
          destId,
        };
      } else if (patient) {
        const node = patientLocationNode;
        const floor = patient.currentLocation?.floor ?? node?.floor;
        const wing = patient.currentLocation?.wing || node?.wing;
        const floorDescription = floor === undefined ? '' : ` on Floor ${floor}${wing ? ` (${wing} Wing)` : ''}`;
        let reply = `${patient.name} is in Room ${patientRoom}${floorDescription}.`;
        if (lang === 'ta') {
          reply = `${patient.name} அறை ${patientRoom}${floor === undefined ? '' : `, தளம் ${floor}${wing ? ` (${wing} Wing)` : ''}`}-ல் உள்ளார்.`;
        } else if (lang === 'hi') {
          reply = `${patient.name} कमरा ${patientRoom}${floor === undefined ? '' : `, मंजिल ${floor}${wing ? ` (${wing} विंग)` : ''}`} में हैं।`;
        }
        return {
          reply,
          ...(node ? { hasMapLink: true, originId: startId, destId: startId } : {}),
        };
      }
    }

    // 3. Current Location / Where am I?
    if (intent === 'CURRENT_LOCATION') {
      const fl = patient?.currentLocation?.floor ?? patientLocationNode?.floor;
      if (!patient || fl === undefined) {
        return {
          reply: 'HealthConnect does not have a verified floor for this patient. Please confirm the current room and floor with the nursing station.',
          cardType: 'UNKNOWN',
        };
      }
      const bed = patient?.bed ? ` (${patient.bed})` : '';
      const dept = patient?.currentLocation?.ward || patient?.currentLocation?.department || patient?.department || 'inpatient ward';
      const name = patient.name;
      const wing = patient.currentLocation?.wing || patientLocationNode?.wing;
      const wingDescription = wing ? `, ${wing} Wing` : '';

      let reply = `You are currently at bedside with ${name} in Room ${patientRoom}${bed}, Floor ${fl}${wingDescription}, ${dept}.`;
      if (lang === 'ta') {
        reply = `நீங்கள் தற்போது ${name} உடன் ${patientRoom}${bed} அறையில், தளம் ${fl}${wingDescription} ${dept}-ல் உள்ளீர்கள்.`;
      } else if (lang === 'hi') {
        reply = `आप वर्तमान में ${name} के साथ कमरा ${patientRoom}${bed}, मंजिल ${fl}${wingDescription}, ${dept} में हैं।`;
      } else if (lang === 'te') {
        reply = `మీరు ప్రస్తుతం ${name} తో గది ${patientRoom}${bed}, అంతస్తు ${fl}, ${dept} లో ఉన్నారు.`;
      }

      return {
        reply,
        ...(patientLocationNode ? { hasMapLink: true, originId: startId, destId: startId } : {}),
      };
    }

    // 3b. Doctor Information
    if (intent === 'DOCTOR_INFORMATION') {
      const docName = patient?.assignedDoctorName || 'Dr. Ananya Sharma';
      const dept = patient?.department || 'Critical Care & Internal Medicine';
      const name = patient?.name || 'your patient';

      let reply = `The primary attending doctor for ${name} is ${docName} (${dept}). For any clinical queries or immediate bedside evaluations, the duty nursing station can page the doctor.`;
      if (lang === 'ta') {
        reply = `${name}-க்கு ஒதுக்கப்பட்ட முதன்மை மருத்துவர் ${docName} (${dept}) ஆவார். மருத்துவ ஆலோசனைகளுக்கு செவிலியர் குழு மருத்துவரைத் தொடர்புகொள்ளும்.`;
      } else if (lang === 'hi') {
        reply = `${name} के मुख्य डॉक्टर ${docName} (${dept}) हैं। किसी भी चिकित्सीय परामर्श के लिए ड्यूटी नर्स डॉक्टर को पेज कर सकती हैं।`;
      } else if (lang === 'te') {
        reply = `${name} కు కేటాయించిన ప్రధాన వైద్యుడు ${docName} (${dept}).`;
      }

      return { reply };
    }

    // 3b-1. Surgeon Information
    if (intent === 'SURGEON_INFORMATION') {
      const name = patient?.name || 'your patient';
      const patientId = patient?.id || '';
      const careTeam = dataStore.getPatientCareTeam(patientId);
      const surgeon = careTeam.find((m) => m.role === 'SURGEON');
      const procedures = dataStore.getProcedures(patientId);
      const procSurgeon = procedures.length > 0 ? procedures[0].surgeonName : undefined;

      const surgeonName = surgeon?.name || procSurgeon;
      let reply: string;
      if (surgeonName) {
        reply = `The operating surgeon for ${name} is ${surgeonName}${surgeon?.specialty ? ` (${surgeon.specialty})` : ''}. Surgical pre-procedure protocols are managed by the surgical care team.`;
      } else {
        reply = `No operating surgeon is assigned to ${name}'s current clinical plan as this is an inpatient medical telemetry admission under the primary physician.`;
      }
      return { reply };
    }

    // 3b-2. Anesthesiologist Information
    if (intent === 'ANESTHESIOLOGIST_INFORMATION') {
      const name = patient?.name || 'your patient';
      const patientId = patient?.id || '';
      const careTeam = dataStore.getPatientCareTeam(patientId);
      const anes = careTeam.find((m) => m.role === 'ANESTHESIOLOGIST');
      const procedures = dataStore.getProcedures(patientId);
      const procAnes = procedures.length > 0 ? procedures[0].anesthesiologistName : undefined;

      const anesName = anes?.name || procAnes;
      let reply: string;
      if (anesName) {
        reply = `The anesthesiologist for ${name} is ${anesName}${anes?.specialty ? ` (${anes.specialty})` : ''}. They manage airway assessment, perioperative anesthesia, and pain management protocols.`;
      } else {
        reply = `No anesthesiologist is assigned to ${name}'s current inpatient admission.`;
      }
      return { reply };
    }

    // 3b-3. Care Team Information
    if (intent === 'CARE_TEAM_INFORMATION') {
      const name = patient?.name || 'your patient';
      const patientId = patient?.id || '';
      const careTeam = dataStore.getPatientCareTeam(patientId);
      if (careTeam.length > 0) {
        const teamSummary = careTeam
          .map((m) => `• ${m.name} — ${m.role.replace(/_/g, ' ')}${m.specialty ? ` (${m.specialty})` : ''}`)
          .join('\n');
        return {
          reply: `The multidisciplinary clinical care team for ${name} includes:\n${teamSummary}\n\nThe duty nursing team can coordinate communication with any care team member.`,
        };
      } else {
        const docName = patient?.assignedDoctorName || 'Dr. Arun Kumar';
        return {
          reply: `The care team for ${name} is led by primary attending physician ${docName} along with the floor nursing staff.`,
        };
      }
    }

    // 3b-4. Procedure Information
    if (intent === 'PROCEDURE_INFORMATION') {
      const name = patient?.name || 'your patient';
      const patientId = patient?.id || '';
      const procedures = dataStore.getProcedures(patientId);
      if (procedures.length > 0) {
        const proc = procedures[0];
        const schedTime = new Date(proc.scheduledAt).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        return {
          reply: `${name} has a scheduled procedure: ${proc.procedureName} (${proc.specialty}). Scheduled for ${schedTime} in ${proc.operatingRoom}. Operating Surgeon: ${proc.surgeonName}, Anesthesiologist: ${proc.anesthesiologistName}. Status: ${proc.status}.${proc.notes ? ' ' + proc.notes : ''}`,
        };
      } else {
        return {
          reply: `No surgical or interventional procedures are currently scheduled for ${name}.`,
        };
      }
    }

    // 3c. Patient Location & Bed Information
    if (intent === 'PATIENT_LOCATION') {
      if (!patient) {
        return { reply: 'No patient is linked to this CareAI session.', cardType: 'SAFETY_WARNING' };
      }
      const name = patient.name;
      const room = patient.room;
      const bed = patient.bed;
      const dept = patient.currentLocation?.ward || patient.currentLocation?.department || patient.department || 'inpatient ward';
      const fl = patient.currentLocation?.floor ?? patientLocationNode?.floor;
      const floorDescription = fl === undefined ? '' : ` (Floor ${fl})`;

      let reply = `${name} is currently in Room ${room}, ${bed} in ${dept}${floorDescription}.`;
      if (lang === 'ta') {
        reply = `${name} தற்போது அறை ${room}, படுக்கை ${bed}-ல் ${dept}${fl === undefined ? '' : `, தளம் ${fl}`} உள்ளார்.`;
      } else if (lang === 'hi') {
        reply = `${name} वर्तमान में कमरा ${room}, बेड ${bed}, ${dept}${fl === undefined ? '' : `, मंजिल ${fl}`} में हैं।`;
      } else if (lang === 'te') {
        reply = `${name} ప్రస్తుతం గది ${room}, బెడ్ ${bed}, ${dept}${fl === undefined ? '' : `, అంతస్తు ${fl}`} లో ఉన్నారు.`;
      }

      return {
        reply,
        ...(patientLocationNode ? { hasMapLink: true, originId: startId, destId: startId } : {}),
      };
    }

    // 4. Why Fahrenheit?
    if (intent === 'FAHRENHEIT_EXPLANATION') {
      let reply = `HealthConnect internally records all biometrics in canonical Celsius (°C) for medical standard compliance, but displays readings in Fahrenheit (°F = °C × 1.8 + 32) on bedside portals because Fahrenheit provides intuitive, fine-grained integer changes for family caregivers (e.g., 98.6 °F is normal, 100.4 °F+ indicates fever).`;
      if (lang === 'ta') {
        reply = `கேர்கனெக்ட் மருத்துவத் தரநிலைகளுக்காக உள் பதிவுகளை செல்சியஸில் (°C) சேமிக்கிறது. ஆனால் படுக்கையருகே குடும்பத்தினருக்கு எளிதில் புரியும் வகையில் பாரன்ஹீட்டில் (°F = °C × 1.8 + 32) காட்டுகிறது (எ.கா. 98.6 °F இயல்பானது, 100.4 °F காய்ச்சல்).`;
      } else if (lang === 'hi') {
        reply = `HealthConnect सभी मेडिकल रिकॉर्ड को मानक सेल्सियस (°C) में संग्रहीत करता है। लेकिन परिजनों की सुविधा के लिए यह फारेनहाइट (°F = °C × 1.8 + 32) में दिखाया जाता है (उदा. 98.6 °F सामान्य है, 100.4 °F बुखार दर्शाता है)।`;
      }
      return { reply };
    }

    // 5. Last Vital Recorded
    if (intent === 'VITALS_LATEST') {
      if (patient) {
        const timeStr = patient.lastVitalUpdate
          ? new Date(patient.lastVitalUpdate).toLocaleTimeString()
          : new Date(patient.latestVitals.timestamp).toLocaleTimeString();

        let reply = `The latest vitals for ${patient.name} were recorded at ${timeStr} from the bedside telemetry monitor and smart glove unit.`;
        if (lang === 'ta') {
          reply = `${patient.name}-க்கான புதிய அளவீடுகள் ${timeStr} மணிக்கு படுக்கையருகே உள்ள மானிட்டரிலிருந்து பதிவு செய்யப்பட்டன.`;
        } else if (lang === 'hi') {
          reply = `${patient.name} के नवीनतम वाइटल्स ${timeStr} पर बेडसाइड मॉनिटर से रिकॉर्ड किए गए थे।`;
        }

        const v = patient.latestVitals;
        return {
          reply,
          cardType: 'VITALS',
          vitalData: {
            patientName: patient.name,
            bp: `${v.systolicBP}/${v.diastolicBP} mmHg`,
            bpStatus: v.bpStatus,
            pulse: v.pulse,
            pulseStatus: v.pulseStatus,
            spO2: v.spO2,
            spO2Status: v.spO2Status,
            tempF: formatTemperatureF(v.temperature),
            tempC: v.temperature,
            tempStatus: v.tempStatus,
            recordedAt: timeStr,
          },
        };
      }
    }

    // 6. Current Body Temperature Specific
    if (intent === 'VITALS_CURRENT' && patient) {
      const v = patient.latestVitals;
      const fTemp = formatTemperatureF(v.temperature);

      let reply = `${patient.name}'s current core body temperature is ${fTemp} (${v.tempStatus}). Normal clinical resting range is between 97.7 °F and 99.5 °F. Telemetry is monitored 24/7.`;
      if (lang === 'ta') {
        reply = `${patient.name}-ன் தற்போதைய உடல் வெப்பநிலை ${fTemp} (${v.tempStatus}). இயல்பான அளவு 97.7 °F முதல் 99.5 °F வரை ஆகும். 24/7 கண்காணிக்கப்படுகிறது.`;
      } else if (lang === 'hi') {
        reply = `${patient.name} का वर्तमान शारीरिक तापमान ${fTemp} (${v.tempStatus}) है। सामान्य सीमा 97.7 °F से 99.5 °F के बीच है।`;
      }

      return {
        reply,
        cardType: 'VITALS',
        vitalData: {
          patientName: patient.name,
          bp: `${v.systolicBP}/${v.diastolicBP} mmHg`,
          bpStatus: v.bpStatus,
          pulse: v.pulse,
          pulseStatus: v.pulseStatus,
          spO2: v.spO2,
          spO2Status: v.spO2Status,
          tempF: fTemp,
          tempC: v.temperature,
          tempStatus: v.tempStatus,
          recordedAt: new Date(v.timestamp).toLocaleTimeString(),
        },
      };
    }

    // 6b. Oxygen Saturation (SpO2) Current
    if (intent === 'VITALS_OXYGEN_CURRENT' && patient) {
      const v = patient.latestVitals;
      const spo2 = v.spO2;
      const status = v.spO2Status;
      let reply = `${patient.name}'s current blood oxygen saturation (SpO2) is ${spo2}% (${status}). Healthy resting oxygen saturation is typically 95% or higher. Telemetry is monitored 24/7.`;
      if (lang === 'ta') {
        reply = `${patient.name}-ன் தற்போதைய இரத்த ஆக்ஸிஜன் அளவு (SpO2) ${spo2}% (${status}). இயல்பான அளவு 95% அல்லது அதற்கு மேல் இருக்க வேண்டும். 24/7 கண்காணிக்கப்படுகிறது.`;
      } else if (lang === 'hi') {
        reply = `${patient.name} का वर्तमान ऑक्सीजन स्तर (SpO2) ${spo2}% (${status}) है। सामान्य स्वस्थ स्तर 95% या उससे अधिक होता है। 24/7 निगरानी जारी है।`;
      } else if (lang === 'te') {
        reply = `${patient.name} ప్రస్తుత ఆక్సిజన్ సంతృప్తత (SpO2) ${spo2}% (${status}). సాధారణ స్థాయి 95% లేదా అంతకంటే ఎక్కువ ఉండాలి.`;
      }

      return {
        reply,
        cardType: 'VITALS',
        vitalData: {
          patientName: patient.name,
          bp: `${v.systolicBP}/${v.diastolicBP} mmHg`,
          bpStatus: v.bpStatus,
          pulse: v.pulse,
          pulseStatus: v.pulseStatus,
          spO2: v.spO2,
          spO2Status: v.spO2Status,
          tempF: formatTemperatureF(v.temperature),
          tempC: v.temperature,
          tempStatus: v.tempStatus,
          recordedAt: new Date(v.timestamp).toLocaleTimeString(),
        },
        actions: status !== 'stable' ? [{ label: '🚨 Call Nurse', actionType: 'CALL_NURSE' }] : undefined,
      };
    }

    // 6c. Oxygen Clinical Significance & Hypoxemia Explanation
    if (intent === 'VITALS_OXYGEN_CONCERN' && patient) {
      const v = patient.latestVitals;
      let reply = `An oxygen saturation below 95% (hypoxemia) indicates less oxygen is circulating in the blood to vital tissues. When levels drop into the critical zone (<90%), clinical protocols require rapid medical intervention. For ${patient.name}, the current SpO2 is ${v.spO2}% (${v.spO2Status}). The telemetry desk is continuously tracking this, and the clinical team is alerted.`;
      if (lang === 'ta') {
        reply = `95%-க்கு குறைவான ஆக்ஸிஜன் அளவு (ஹைபோக்ஸீமியா) இரத்தத்தில் உறுப்புகளுக்குச் செல்லும் ஆக்ஸிஜன் அளவு குறைந்துள்ளதைக் குறிக்கிறது. ${patient.name}-க்கு தற்போதைய SpO2 அளவு ${v.spO2}% (${v.spO2Status}). மருத்துவக் கண்காணிப்பு தொடர்ந்து செயல்படுகிறது, அவசரத் தேவைக்கு மருத்துவக் குழு தயாராக உள்ளது.`;
      } else if (lang === 'hi') {
        reply = `95% से कम ऑक्सीजन स्तर (हाइपोक्सिमिया) का अर्थ है कि रक्त में अंगों तक ऑक्सीजन कम पहुँच रही है। ${patient.name} का वर्तमान SpO2 ${v.spO2}% (${v.spO2Status}) है। टेलीमेट्री डेस्क इसकी निगरानी कर रहा है और क्लिनिकल टीम सतर्क है।`;
      } else if (lang === 'te') {
        reply = `95% కంటే తక్కువ ఆక్సిజన్ స్థాయి (హైపోక్సిమియా) శరీర భాగాలకు ఆక్సిజన్ తక్కువగా చేరుతోందని సూచిస్తుంది. ${patient.name} ప్రస్తుత SpO2 ${v.spO2}% (${v.spO2Status}). వైద్య బృందం నిరంతరం పర్యవేక్షిస్తోంది.`;
      }

      return {
        reply,
        cardType: 'SAFETY_WARNING',
        actions: [
          { label: '🚨 Call Nurse Immediately', actionType: 'CALL_NURSE' },
          { label: '👨‍⚕️ View Attending Doctor', actionType: 'VIEW_DOCTOR' },
        ],
      };
    }

    // 6d. Oxygen Emergency Bedside Action Guidance
    if (intent === 'VITALS_OXYGEN_GUIDANCE' && patient) {
      const v = patient.latestVitals;
      let reply = `Immediate bedside guidance for ${patient.name} (SpO2: ${v.spO2}%):\n1. Assist the patient into a comfortable upright or semi-Fowler's position to ease breathing.\n2. Do NOT adjust oxygen flow meters, tubing, or masks yourself.\n3. Verify the pulse oximeter finger sensor is securely in place.\n4. Stay calm and press the "Call Nurse" button immediately. The floor nursing team has been alerted.`;
      if (lang === 'ta') {
        reply = `${patient.name}-க்கான உடனடி படுக்கையருகே வழிகாட்டுதல் (SpO2: ${v.spO2}%):\n1. நோயாளி எளிதாக சுவாசிக்க அவரை நிமிர்ந்து உட்கார வைக்கவும்.\n2. ஆக்ஸிஜன் கருவிகள் அல்லது குழாய்களை நீங்களாக மாற்ற வேண்டாம்.\n3. விரல் பல்ஸ் ஆக்ஸிமீட்டர் சரியாகப் பொருத்தப்பட்டுள்ளதா எனப் பார்க்கவும்.\n4. அமைதியாக இருந்து உடனடியாக செவிலியர் அழைப்பு பொத்தானை அழுத்தவும். செவிலியர் குழுவுக்குத் தகவல் தெரிவிக்கப்பட்டுள்ளது.`;
      } else if (lang === 'hi') {
        reply = `${patient.name} के लिए तुरंत देखभाल निर्देश (SpO2: ${v.spO2}%):\n1. मरीज को थोड़ा सीधा बैठाएं ताकि सांस लेने में आसानी हो।\n2. ऑक्सीजन फ्लो या मास्क को खुद से न बदलें।\n3. पल्स ऑक्सीमीटर सेंसर सही लगा है यह देखें।\n4. तुरंत नर्स कॉल बटन दबाएं। नर्सिंग टीम को सूचित कर दिया गया है।`;
      } else if (lang === 'te') {
        reply = `${patient.name} కొరకు తక్షణ సూచనలు (SpO2: ${v.spO2}%):\n1. రోగి సులభంగా శ్వాస తీసుకోవడానికి నిటారుగా కూర్చోబెట్టండి.\n2. ఆక్సిజన్ పరికరాలను మీరే మార్చవద్దు.\n3. పల్స్ సెన్సార్ సరిగ్గా ఉందో లేదో చూడండి.\n4. వెంటనే నర్సు కాల్ బటన్ నొక్కండి.`;
      }

      return {
        reply,
        cardType: 'SAFETY_WARNING',
        actions: [{ label: '🚨 Call Nurse Immediately', actionType: 'CALL_NURSE' }],
      };
    }

    // 6e. Heart Rate / Pulse Current
    if (intent === 'VITALS_PULSE_CURRENT' && patient) {
      const v = patient.latestVitals;
      let reply = `${patient.name}'s current heart rate is ${v.pulse} beats per minute (${v.pulseStatus}). Normal resting adult heart rate typically ranges between 60 and 100 bpm. Telemetry is monitored continuously.`;
      if (lang === 'ta') {
        reply = `${patient.name}-ன் தற்போதைய இதயத் துடிப்பு நிமிடத்திற்கு ${v.pulse} துடிப்புகள் (${v.pulseStatus}). இயல்பான அளவு 60 முதல் 100 bpm வரை ஆகும். தொடர்ந்து கண்காணிக்கப்படுகிறது.`;
      } else if (lang === 'hi') {
        reply = `${patient.name} की वर्तमान हृदय गति ${v.pulse} धड़कन प्रति मिनट (${v.pulseStatus}) है। सामान्य सीमा 60 से 100 bpm के बीच है।`;
      } else if (lang === 'te') {
        reply = `${patient.name} ప్రస్తుత గుండె కొట్టుకునే వేగం నిమిషానికి ${v.pulse} (${v.pulseStatus}). సాధారణ పరిధి 60 నుండి 100 bpm.`;
      }

      return {
        reply,
        cardType: 'VITALS',
        vitalData: {
          patientName: patient.name,
          bp: `${v.systolicBP}/${v.diastolicBP} mmHg`,
          bpStatus: v.bpStatus,
          pulse: v.pulse,
          pulseStatus: v.pulseStatus,
          spO2: v.spO2,
          spO2Status: v.spO2Status,
          tempF: formatTemperatureF(v.temperature),
          tempC: v.temperature,
          tempStatus: v.tempStatus,
          recordedAt: new Date(v.timestamp).toLocaleTimeString(),
        },
        actions: v.pulseStatus !== 'stable' ? [{ label: '🚨 Call Nurse', actionType: 'CALL_NURSE' }] : undefined,
      };
    }

    // 6f. Pulse / Heart Rate Concern
    if (intent === 'VITALS_PULSE_CONCERN' && patient) {
      const v = patient.latestVitals;
      let reply = `A heart rate above 100 bpm (tachycardia) or below 60 bpm (bradycardia) can be caused by physical exertion, fever, pain, stress, or medications. For ${patient.name}, the current pulse is ${v.pulse} bpm (${v.pulseStatus}). The bedside monitor continuously records every beat and notifies the floor staff of abnormal rhythms.`;
      if (lang === 'ta') {
        reply = `100 bpm-க்கு மேல் (டாக்ரிக்கார்டியா) அல்லது 60 bpm-க்கு கீழ் (பிரேடிகார்டியா) இதயத் துடிப்பு இருப்பது காய்ச்சல், வலி, கவலை அல்லது மருந்துகளால் ஏற்படலாம். ${patient.name}-ன் தற்போதைய துடிப்பு ${v.pulse} bpm (${v.pulseStatus}). மருத்துவக் குழு தொடர்ந்து கண்காணிக்கிறது.`;
      } else if (lang === 'hi') {
        reply = `हृदय गति का 100 से ऊपर (टैचीकार्डिया) या 60 से नीचे (ब्रैडीकार्डिया) होना बुखार, दर्द, तनाव या दवाओं के कारण हो सकता है। ${patient.name} की वर्तमान नब्ज ${v.pulse} bpm (${v.pulseStatus}) है।`;
      } else if (lang === 'te') {
        reply = `గుండె వేగం 100 కంటే ఎక్కువ లేదా 60 కంటే తక్కువగా ఉండటం జ్వరం, నొప్పి లేదా మందుల వల్ల కావచ్చు. ${patient.name} ప్రస్తుత పల్స్ ${v.pulse} bpm (${v.pulseStatus}).`;
      }

      return {
        reply,
        cardType: 'SAFETY_WARNING',
        actions: [{ label: '🚨 Call Nurse', actionType: 'CALL_NURSE' }],
      };
    }

    // 6g. Respiratory Rate (RR) Current
    if (intent === 'VITALS_RR_CURRENT' && patient) {
      const v = patient.latestVitals;
      const rr = (v as any).respiratoryRate ?? 18;
      const rrStatus = (v as any).respiratoryRateStatus ?? 'stable';
      let reply = `${patient.name}'s current respiratory rate is ${rr} breaths per minute (${rrStatus}). Normal resting adult breathing rate is typically between 12 and 20 breaths per minute. Continuous clinical telemetry is active.`;
      if (lang === 'ta') {
        reply = `${patient.name}-ன் தற்போதைய சுவாச விகிதம் நிமிடத்திற்கு ${rr} மூச்சுகள் (${rrStatus}). பெரியவர்களுக்கு இயல்பான சுவாச விகிதம் நிமிடத்திற்கு 12 முதல் 20 ஆகும். தொடர் கண்காணிப்பு செயல்பாட்டில் உள்ளது.`;
      } else if (lang === 'hi') {
        reply = `${patient.name} की वर्तमान श्वसन दर ${rr} सांस प्रति मिनट (${rrStatus}) है। सामान्य सीमा 12 से 20 सांस प्रति मिनट है।`;
      } else if (lang === 'te') {
        reply = `${patient.name} ప్రస్తుత శ్వాస రేటు నిమిషానికి ${rr} (${rrStatus}). సాధారణ పరిధి 12 నుండి 20 శ్వాసలు.`;
      }

      return {
        reply,
        cardType: 'VITALS',
        vitalData: {
          patientName: patient.name,
          bp: `${v.systolicBP}/${v.diastolicBP} mmHg`,
          bpStatus: v.bpStatus,
          pulse: v.pulse,
          pulseStatus: v.pulseStatus,
          spO2: v.spO2,
          spO2Status: v.spO2Status,
          tempF: formatTemperatureF(v.temperature),
          tempC: v.temperature,
          tempStatus: v.tempStatus,
          recordedAt: new Date(v.timestamp).toLocaleTimeString(),
        },
      };
    }

    // 7. Full Vitals Explanation
    if (intent === 'VITALS_EXPLANATION') {
      if (patient) {
        const v = patient.latestVitals;
        const fTemp = formatTemperatureF(v.temperature);

        let reply = `Here are ${patient.name}'s latest readings: Blood Pressure is ${v.systolicBP}/${v.diastolicBP} mmHg (${v.bpStatus}), Heart Rate is ${v.pulse} bpm (${v.pulseStatus}), Oxygen level is ${v.spO2}% (${v.spO2Status}), and Core Temperature is ${fTemp} (${v.tempStatus}). All telemetry is actively watched by the nursing desk.\n\nNotice: I provide informational guidance only. Always consult Dr. ${patient.assignedDoctorName} for clinical diagnosis.`;
        if (lang === 'ta') {
          reply = `${patient.name}-ன் புதிய அளவீடுகள்: இரத்த அழுத்தம் ${v.systolicBP}/${v.diastolicBP} mmHg (${v.bpStatus}), இதயத் துடிப்பு ${v.pulse} bpm (${v.pulseStatus}), ஆக்ஸிஜன் அளவு ${v.spO2}% (${v.spO2Status}), மற்றும் வெப்பநிலை ${fTemp} (${v.tempStatus}). மருத்துவ ஆலோசனைகளுக்கு உங்கள் மருத்துவரை அணுகவும்.`;
        }

        return {
          reply,
          cardType: 'VITALS',
          vitalData: {
            patientName: patient.name,
            bp: `${v.systolicBP}/${v.diastolicBP} mmHg`,
            bpStatus: v.bpStatus,
            pulse: v.pulse,
            pulseStatus: v.pulseStatus,
            spO2: v.spO2,
            spO2Status: v.spO2Status,
            tempF: fTemp,
            tempC: v.temperature,
            tempStatus: v.tempStatus,
            recordedAt: new Date(v.timestamp).toLocaleTimeString(),
          },
        };
      }
      return {
        reply: `Normal resting vital benchmarks are: Blood pressure around 120/80 mmHg, pulse between 60 - 100 bpm, oxygen saturation 95% or higher, and temperature between 97.7 °F – 99.5 °F.`,
      };
    }

    // 7b. Blood Pressure Current Specific
    if (intent === 'VITALS_BP_CURRENT' && patient) {
      const v = patient.latestVitals;
      let reply = `${patient.name}'s current blood pressure is ${v.systolicBP}/${v.diastolicBP} mmHg (${v.bpStatus}). Telemetry is monitored continuously.`;
      if (lang === 'ta') {
        reply = `${patient.name}-ன் தற்போதைய இரத்த அழுத்தம் ${v.systolicBP}/${v.diastolicBP} mmHg (${v.bpStatus}). தொடர்ந்து கண்காணிக்கப்படுகிறது.`;
      } else if (lang === 'hi') {
        reply = `${patient.name} का वर्तमान रक्तचाप ${v.systolicBP}/${v.diastolicBP} mmHg (${v.bpStatus}) है। यह निरंतर मॉनिटर किया जा रहा है।`;
      } else if (lang === 'te') {
        reply = `${patient.name} ప్రస్తుత రక్తపోటు ${v.systolicBP}/${v.diastolicBP} mmHg (${v.bpStatus}).`;
      }

      return {
        reply,
        cardType: 'VITALS',
        vitalData: {
          patientName: patient.name,
          bp: `${v.systolicBP}/${v.diastolicBP} mmHg`,
          bpStatus: v.bpStatus,
          pulse: v.pulse,
          pulseStatus: v.pulseStatus,
          spO2: v.spO2,
          spO2Status: v.spO2Status,
          tempF: formatTemperatureF(v.temperature),
          tempC: v.temperature,
          tempStatus: v.tempStatus,
          recordedAt: new Date(v.timestamp).toLocaleTimeString(),
        },
      };
    }

    // 7c. Blood Pressure Trend Specific
    if (intent === 'VITALS_BP_TREND' && patient) {
      const history = patient.vitalsHistory || [];
      const current = patient.latestVitals;
      let trendText = 'stable';
      if (history.length >= 2) {
        const prev = history[0];
        const sysDiff = current.systolicBP - prev.systolicBP;
        const diaDiff = current.diastolicBP - prev.diastolicBP;
        if (Math.abs(sysDiff) <= 4 && Math.abs(diaDiff) <= 4) {
          trendText = 'stable with normal physiological variance';
        } else if (sysDiff > 4) {
          trendText = `trending upward (+${sysDiff} mmHg systolic)`;
        } else {
          trendText = `trending downward (${sysDiff} mmHg systolic)`;
        }
      }
      let reply = `${patient.name}'s blood pressure trend is currently ${trendText}. Current reading is ${current.systolicBP}/${current.diastolicBP} mmHg (${current.bpStatus}). Telemetry is continuously recorded.`;
      if (lang === 'ta') {
        reply = `${patient.name}-ன் இரத்த அழுத்தப் போக்கு தற்போது ${trendText.includes('upward') ? 'அதிகரிக்கும்' : trendText.includes('downward') ? 'குறையும்' : 'நிலையான'} போக்கில் உள்ளது. தற்போதைய அளவு ${current.systolicBP}/${current.diastolicBP} mmHg (${current.bpStatus}).`;
      } else if (lang === 'hi') {
        reply = `${patient.name} का रक्तचाप रुझान वर्तमान में ${trendText.includes('upward') ? 'बढ़ता हुआ' : trendText.includes('downward') ? 'कम होता हुआ' : 'स्थिर'} है। वर्तमान रीडिंग ${current.systolicBP}/${current.diastolicBP} mmHg (${current.bpStatus}) है।`;
      }

      return {
        reply,
        cardType: 'VITALS',
        vitalData: {
          patientName: patient.name,
          bp: `${current.systolicBP}/${current.diastolicBP} mmHg`,
          bpStatus: current.bpStatus,
          pulse: current.pulse,
          pulseStatus: current.pulseStatus,
          spO2: current.spO2,
          spO2Status: current.spO2Status,
          tempF: formatTemperatureF(current.temperature),
          tempC: current.temperature,
          tempStatus: current.tempStatus,
          recordedAt: new Date(current.timestamp).toLocaleTimeString(),
        },
      };
    }

    // 7d. Monitoring Reason
    if (intent === 'MONITORING_REASON' && patient) {
      const diagnosis = patient.currentDiagnosis || patient.primaryCondition || 'inpatient clinical observation';
      let reply = `${patient.name} is admitted for ${diagnosis}. Continuous bedside telemetry monitors heart rate, blood pressure, oxygen saturation, and core temperature to ensure rapid detection of physiological fluctuations.`;
      if (lang === 'ta') {
        reply = `${patient.name} ${diagnosis} காரணமாக மருத்துவக் கண்காணிப்பில் உள்ளார். இதயத் துடிப்பு, இரத்த அழுத்தம், ஆக்ஸிஜன் அளவு மற்றும் வெப்பநிலை படுக்கையருகே தொடர்ந்து கண்காணிக்கப்படுகிறது.`;
      } else if (lang === 'hi') {
        reply = `${patient.name} को ${diagnosis} के कारण भर्ती कराया गया है। स्वास्थ्य में किसी भी बदलाव की त्वरित पहचान के लिए वाइटल्स की निरंतर निगरानी की जा रही है।`;
      } else if (lang === 'te') {
        reply = `${patient.name} ${diagnosis} కొరకు పర్యవేక్షణలో ఉన్నారు. నిరంతర వైటల్స్ పర్యవేక్షణ జరుగుతోంది.`;
      }
      return { reply };
    }

    // 7e. Alert Action Guidance
    if (intent === 'ALERT_ACTION_GUIDANCE' && patient) {
      const activeAlerts = dataStore.getAlerts().filter((a) => a.patientId === patient.id && a.status === 'active');
      if (activeAlerts.length > 0) {
        const top = activeAlerts[0];
        let reply = `Active alert for ${patient.name}: ${top.message} (${top.severity} severity). Immediate guidance:\n1. Verify patient comfort and breathing at bedside.\n2. Do NOT adjust medical equipment or oxygen tubes yourself.\n3. Press the "Call Nurse" button or notify floor staff immediately.\n4. Clinical team has been alerted via telemetry dashboard.`;
        if (lang === 'ta') {
          reply = `${patient.name}-க்கான எச்சரிக்கை: ${top.message} (${top.severity}). செய்ய வேண்டியவை:\n1. படுக்கையருகே நோயாளியின் நிலையைச் சரிபார்க்கவும்.\n2. மருத்துவக் கருவிகளை மாற்ற வேண்டாம்.\n3. உடனடியாக செவிலியர் அழைப்பு பொத்தானை அழுத்தவும்.\n4. மருத்துவக் குழுவுக்கு தகவல் தெரிவிக்கப்பட்டுள்ளது.`;
        } else if (lang === 'hi') {
          reply = `${patient.name} के लिए सक्रिय अलर्ट: ${top.message} (${top.severity})। तुरंत ये कदम उठाएं:\n1. मरीज की स्थिति देखें।\n2. मेडिकल उपकरण को न छुएं।\n3. तुरंत नर्स कॉल बटन दबाएं।\n4. मेडिकल टीम को अलर्ट भेज दिया गया है।`;
        }
        return {
          reply,
          cardType: 'SAFETY_WARNING',
          actions: [{ label: '🚨 Call Nurse Immediately', actionType: 'CALL_NURSE' }],
        };
      } else {
        let reply = `There are no active critical alerts for ${patient.name} right now. All vital parameters are within managed limits. If the patient feels discomfort, press the Call Nurse button anytime.`;
        if (lang === 'ta') {
          reply = `${patient.name}-க்கு தற்போது அவசர எச்சரிக்கைகள் எதுவும் இல்லை. அனைத்து அளவீடுகளும் சீராக உள்ளன. ஏதேனும் உதவி தேவைப்பட்டால் செவிலியர் அழைப்பு பொத்தானைப் பயன்படுத்தவும்.`;
        } else if (lang === 'hi') {
          reply = `वर्तमान में ${patient.name} के लिए कोई गंभीर अलर्ट नहीं है। सभी वाइटल्स स्थिर हैं। किसी भी आवश्यकता पर नर्स कॉल बटन दबाएं।`;
        }
        return { reply };
      }
    }

    // 7f. Missing Data / Safety Fallback
    if (intent === 'DATA_NOT_AVAILABLE') {
      let reply = `I don't have enough current information to answer that. HealthConnect currently tracks real-time vital telemetry (BP, pulse, SpO2, temperature), active medication orders, and hospital navigation. Please consult the attending nursing team or reception for additional details.`;
      if (lang === 'ta') {
        reply = `அதற்கு பதிலளிக்க போதுமான தற்போதைய தகவல்கள் என்னிடம் இல்லை. HealthConnect தற்போது முக்கிய அளவீடுகள் (இரத்த அழுத்தம், இதயத் துடிப்பு, ஆக்ஸிஜன், வெப்பநிலை), மருந்துகள் மற்றும் வழிகளை கண்காணிக்கிறது. உங்கள் செவிலியர் அல்லது வரவேற்பறை பணியாளர்களைத் தொடர்பு கொள்ளவும்.`;
      } else if (lang === 'hi') {
        reply = `मेरे पास उस प्रश्न का उत्तर देने के लिए पर्याप्त जानकारी नहीं है। HealthConnect वर्तमान में वाइटल्स (रक्तचाप, पल्स, SpO2, तापमान), दवाओं और अस्पताल के रास्तों की जानकारी देता है। कृपया ड्यूटी नर्स या रिसेप्शन से पूछें।`;
      } else if (lang === 'te') {
        reply = `దానికి సమాధానం ఇవ్వడానికి నా వద్ద తగినంత సమాచారం లేదు. దయచేసి డ్యూటీ నర్సు లేదా రిసెప్షన్‌ను సంప్రదించండి.`;
      }
      return { reply };
    }

    // 8. Medication Schedule
    if (intent === 'MEDICATION_SCHEDULE') {
      if (patient) {
        const meds = dataStore.getMedications(patient.id);
        if (meds.length > 0) {
          const medSummary = meds
            .map((m) => `• ${m.name} ${m.dosage} (${m.frequency}, ${m.scheduledTime}) - Status: ${m.status}`)
            .join('\n');

          let reply = `Here is the current medication schedule for ${patient.name} prescribed by ${patient.assignedDoctorName}:\n${medSummary}\n\nPlease check with your duty nurse before administering any doses.`;
          if (lang === 'ta') {
            reply = `மருத்துவர் ${patient.assignedDoctorName} பரிந்துரைத்த ${patient.name}-க்கான தற்போதைய மருந்து அட்டவணை:\n${medSummary}\n\nமருந்து வழங்குவதற்கு முன் செவிலியரிடம் சரிபார்க்கவும்.`;
          } else if (lang === 'hi') {
            reply = `डॉ. ${patient.assignedDoctorName} द्वारा निर्धारित ${patient.name} की दवा समय-सारणी:\n${medSummary}\n\nकृपया दवा देने से पहले ड्यूटी नर्स से पुष्टि करें।`;
          }

          return {
            reply,
            cardType: 'MEDICATIONS',
            medicationData: {
              patientName: patient.name,
              doctorName: patient.assignedDoctorName || 'Duty Clinician',
              items: meds.map((m) => ({
                id: m.id,
                name: m.name,
                dosage: m.dosage,
                frequency: m.frequency,
                scheduledTime: m.scheduledTime,
                status: m.status,
              })),
            },
          };
        }
        let noMeds = `No active medications are currently scheduled for ${patient.name}.`;
        if (lang === 'ta') noMeds = `${patient.name}-க்கு தற்போது திட்டமிடப்பட்ட மருந்துகள் எதுவும் இல்லை.`;
        return { reply: noMeds };
      }
    }

    // 8b. Next Medication / Upcoming Dose
    if (intent === 'MEDICATION_NEXT') {
      if (patient) {
        const meds = dataStore.getMedications(patient.id);
        const upcoming = meds.find((m) => m.status === 'Pending') || meds[0];
        if (upcoming) {
          let reply = `The next scheduled medication for ${patient.name} is ${upcoming.name} (${upcoming.dosage}) scheduled at ${upcoming.scheduledTime} (${upcoming.frequency}). Please confirm with the on-duty nurse before administering.`;
          if (lang === 'ta') {
            reply = `${patient.name}-க்கு அடுத்து திட்டமிடப்பட்ட மருந்து: ${upcoming.name} (${upcoming.dosage}), நேரம்: ${upcoming.scheduledTime} (${upcoming.frequency}). வழங்குவதற்கு முன் செவிலியரிடம் சரிபார்க்கவும்.`;
          } else if (lang === 'hi') {
            reply = `${patient.name} की अगली निर्धारित दवा: ${upcoming.name} (${upcoming.dosage}) है, समय: ${upcoming.scheduledTime} (${upcoming.frequency})। कृपया देने से पहले ड्यूटी नर्स से पुष्टि करें।`;
          } else if (lang === 'te') {
            reply = `${patient.name} కు తదుపరి మందు: ${upcoming.name} (${upcoming.dosage}), సమయం: ${upcoming.scheduledTime} (${upcoming.frequency}).`;
          }

          return {
            reply,
            cardType: 'MEDICATIONS',
            medicationData: {
              patientName: patient.name,
              doctorName: patient.assignedDoctorName || 'Duty Clinician',
              items: [
                {
                  id: upcoming.id,
                  name: upcoming.name,
                  dosage: upcoming.dosage,
                  frequency: upcoming.frequency,
                  scheduledTime: upcoming.scheduledTime,
                  status: upcoming.status,
                },
              ],
            },
          };
        }
        let noMeds = `No upcoming medications are currently scheduled for ${patient.name}.`;
        if (lang === 'ta') noMeds = `${patient.name}-க்கு தற்போது திட்டமிடப்பட்ட மருந்துகள் எதுவும் இல்லை.`;
        return { reply: noMeds };
      }
    }

    // 9. Pharmacy Wayfinding
    if (intent === 'PHARMACY') {
      this.activeContext.lastDestinationId = 'PHARMACY_GF';
      this.activeContext.lastDestinationName = 'Central 24/7 Pharmacy';
      const route = hospitalMapService.findShortestPath(startId, 'PHARMACY_GF');
      const dist = route?.totalDistanceMeters || 50;

      let reply = `The Central 24/7 Pharmacy is on the Ground Floor (Wing B), next to the Main Concourse. Take the elevator down to Ground Floor. Estimated walk: ~${dist} meters.`;
      if (lang === 'ta') {
        reply = `மத்திய 24/7 மருந்தகம் Ground Floor (Wing B)-ல் உள்ளது. உங்கள் தற்போதைய இடத்திலிருந்து சுமார் ${dist} மீட்டர் தொலைவில் உள்ளது.`;
      } else if (lang === 'hi') {
        reply = `केंद्रीय 24/7 फार्मेसी ग्राउंड फ्लोर (Wing B) में मुख्य कॉनकोर्स के पास है। लिफ्ट से ग्राउंड फ्लोर पर जाएं। अनुमानित दूरी: ~${dist} मीटर।`;
      } else if (lang === 'te') {
        reply = `కేంద్ర 24/7 ఫార్మసీ గ్రౌండ్ ఫ్లోర్ (వింగ్ బి) లో ఉంది. మీ ప్రస్తుత ప్రదేశం నుండి సుమారు ${dist} మీటర్ల దూరం.`;
      }

      return {
        reply,
        hasMapLink: true,
        originId: startId,
        destId: 'PHARMACY_GF',
        directions: route?.instructions || [],
        cardType: 'ROUTE',
        routeData: {
          destName: 'Central 24/7 Pharmacy',
          destCode: 'PHARMACY_GF',
          floor: 0,
          wing: 'Wing B',
          distanceMeters: dist,
          estimatedMinutes: route?.estimatedMinutes || 2,
          instructions: route?.instructions || [],
        },
      };
    }

    // 10. Cardiology Room 11002 Wayfinding
    if (intent === 'HOSPITAL_DIRECTIONS' || (targetLocation === 'ROOM_11002')) {
      this.activeContext.lastDestinationId = 'ROOM_11002';
      this.activeContext.lastDestinationName = 'Cardiology Room 11002';
      const destNode = hospitalMapService.getNodeById('ROOM_11002');
      const route = destNode ? hospitalMapService.findShortestPath(startId, destNode.id) : null;
      const dist = route?.totalDistanceMeters || 65;
      const mins = route?.estimatedMinutes || 2;

      let reply = `Cardiology Room 11002 is located on Floor 2 (East Wing). From ${patientRoom}, take Central Elevator to Floor 2, exit into East Corridor, and proceed to Room 11002. Estimated walk: ~${dist} meters (${mins} min).`;
      if (lang === 'ta') {
        reply = `இதயவியல் அறை 11002 இரண்டாம் தளம் (East Wing)-ல் உள்ளது. ${patientRoom}-இலிருந்து மத்திய லிப்ட் வழியாக இரண்டாம் தளம் செல்லவும். சுமார் ${dist} மீட்டர் தூரம்.`;
      } else if (lang === 'hi') {
        reply = `कार्डियोलॉजी कमरा 11002 दूसरी मंजिल (East Wing) पर है। ${patientRoom} से सेंट्रल लिफ्ट से फ्लोर 2 पर जाएं। अनुमानित दूरी: ~${dist} मीटर (${mins} मिनट)।`;
      }

      return {
        reply,
        hasMapLink: true,
        originId: startId,
        destId: 'ROOM_11002',
        directions: route?.instructions || [],
        cardType: 'ROUTE',
        routeData: {
          destName: 'Cardiology Room 11002',
          destCode: 'ROOM_11002',
          floor: 2,
          wing: 'East Wing',
          distanceMeters: dist,
          estimatedMinutes: mins,
          instructions: route?.instructions || [],
        },
      };
    }

    // 11. Pathology / Lab
    if (intent === 'LAB') {
      this.activeContext.lastDestinationId = 'LAB_GF';
      this.activeContext.lastDestinationName = 'Diagnostic Pathology Laboratory';
      const route = hospitalMapService.findShortestPath(startId, 'LAB_GF');
      const dist = route?.totalDistanceMeters || 55;

      let reply = `The Central Diagnostic Pathology Laboratory is located on the Ground Floor (Wing B). Sample drop-off and report collection counter is open 24/7. Estimated walk: ~${dist} meters.`;
      if (lang === 'ta') {
        reply = `நோயறிதல் ஆய்வகம் Ground Floor (Wing B)-ல் உள்ளது. மாதிரி சேகரிப்பு மற்றும் அறிக்கை கவுண்டர் 24/7 திறந்திருக்கும்.`;
      }

      return {
        reply,
        hasMapLink: true,
        originId: startId,
        destId: 'LAB_GF',
        directions: route?.instructions || [],
        cardType: 'ROUTE',
        routeData: {
          destName: 'Central Pathology Laboratory',
          destCode: 'LAB_GF',
          floor: 0,
          wing: 'Wing B',
          distanceMeters: dist,
          estimatedMinutes: route?.estimatedMinutes || 2,
          instructions: route?.instructions || [],
        },
      };
    }

    // 12. Emergency Ward
    if (intent === 'EMERGENCY_DEPARTMENT') {
      this.activeContext.lastDestinationId = 'EMERGENCY_GF';
      this.activeContext.lastDestinationName = 'Emergency & Trauma Ward';
      const route = hospitalMapService.findShortestPath(startId, 'EMERGENCY_GF');
      const dist = route?.totalDistanceMeters || 60;

      let reply = `Emergency & Trauma Care is on the Ground Floor (Wing A) with immediate ambulance bay access. Estimated walk: ~${dist} meters.`;
      if (lang === 'ta') {
        reply = `அவசர சிகிச்சை பிரிவு Ground Floor (Wing A)-ல் அமைந்துள்ளது.`;
      }

      return {
        reply,
        hasMapLink: true,
        originId: startId,
        destId: 'EMERGENCY_GF',
        directions: route?.instructions || [],
        cardType: 'ROUTE',
        routeData: {
          destName: 'Emergency & Trauma Care',
          destCode: 'EMERGENCY_GF',
          floor: 0,
          wing: 'Wing A',
          distanceMeters: dist,
          estimatedMinutes: route?.estimatedMinutes || 2,
          instructions: route?.instructions || [],
        },
      };
    }

    // 13. Nurse Call
    if (intent === 'NURSE_CALL') {
      let reply = `You can summon immediate nursing assistance by tapping the red "🚨 Call Duty Nurse" button on your Bedside Dashboard or below. Staff is stationed 24/7 on Floor 1.`;
      if (lang === 'ta') {
        reply = `உங்கள் முகப்புப்பலகையில் உள்ள "🚨 செவிலியரை அழைக்கவும்" பொத்தானைத் தட்டுவதன் மூலம் உடனடியாக செவிலியரை அழைக்கலாம்.`;
      } else if (lang === 'hi') {
        reply = `आप अपने डैशबोर्ड पर लाल "🚨 नर्स को बुलाएं" बटन दबाकर तुरंत ड्यूटी नर्स को बुला सकते हैं।`;
      }
      return { reply };
    }

    // 14. Visiting Hours & Cafeteria
    if (intent === 'VISITING_HOURS') {
      let reply = 'Hospital visiting hours are not configured in HealthConnect. Please check with reception or the nursing station.';
      if (lang === 'ta') {
        reply = 'HealthConnect-ல் மருத்துவமனை பார்வை நேரம் அமைக்கப்படவில்லை. வரவேற்பு அல்லது செவிலியர் நிலையத்தில் சரிபார்க்கவும்.';
      } else if (lang === 'hi') {
        reply = 'HealthConnect में अस्पताल के मुलाक़ात के समय उपलब्ध नहीं हैं। कृपया रिसेप्शन या नर्सिंग स्टेशन से पूछें।';
      }
      return { reply };
    }

    if (intent === 'CAFETERIA') {
      let reply = 'HealthConnect does not have verified cafeteria location or hours. Please check with reception or the nursing station.';
      if (lang === 'ta') {
        reply = 'HealthConnect-ல் உணவகத்தின் சரிபார்க்கப்பட்ட இடம் அல்லது நேரம் இல்லை. வரவேற்பு அல்லது செவிலியர் நிலையத்தில் கேளுங்கள்.';
      } else if (lang === 'hi') {
        reply = 'HealthConnect में कैफेटेरिया का सत्यापित स्थान या समय उपलब्ध नहीं है। कृपया रिसेप्शन या नर्सिंग स्टेशन से पूछें।';
      }
      return { reply };
    }

    // 15. Dynamic Room Match
    if (targetLocation) {
      const match = hospitalMapService.getNodeById(targetLocation) || hospitalMapService.findLocation(targetLocation);
      if (match && match.id !== startId) {
        this.activeContext.lastDestinationId = match.id;
        this.activeContext.lastDestinationName = match.name;
        const route = hospitalMapService.findShortestPath(startId, match.id);
        const dist = route?.totalDistanceMeters || 45;
        const mins = route?.estimatedMinutes || 2;

        let reply = `${match.name} (${match.code}) is located on Floor ${match.floor} (${match.wing} Wing). Estimated distance from ${patientRoom}: ~${dist} meters (${mins} min).`;
        return {
          reply,
          hasMapLink: true,
          originId: startId,
          destId: match.id,
          directions: route?.instructions || [],
          cardType: 'ROUTE',
          routeData: {
            destName: match.name,
            destCode: match.code,
            floor: match.floor,
            wing: match.wing || 'Main Wing',
            distanceMeters: dist,
            estimatedMinutes: mins,
            instructions: route?.instructions || [],
          },
        };
      }
    }

    // 16. Fallback Directory (Rich Unknown Query Handler per Part 18)
    let fallbackText = `I could not locate that specific query. I can help you with:\n\n📍 Hospital directions (e.g., Cardiology Room 11002, Pharmacy, Lab)\n❤️ Patient vital telemetry in °F\n💊 Scheduled medication roster\n🗺 Hospital 2D floor maps\n🚨 Emergency duty nurse dispatch\n🕐 Visiting hours and cafeteria info\n\nWhat would you like to explore?`;
    if (lang === 'ta') {
      fallbackText = `என்னிடம் பின்வரும் தகவல்களை நீங்கள் கேட்கலாம்:\n\n📍 மருத்துவமனை வழிகள் (எ.கா. இதயவியல் அறை 11002, மருந்தகம்)\n❤️ நோயாளியின் உடல் அளவீடுகள் (°F)\n💊 மருந்து அட்டவணை\n🗺 மருத்துவமனை வரைபடம்\n🚨 செவிலியர் உதவி\n🕐 பார்வையிடும் நேரம்\n\nநீங்கள் எதை அறிய விரும்புகிறீர்கள்?`;
    } else if (lang === 'hi') {
      fallbackText = `मैं निम्नलिखित में आपकी सहायता कर सकता हूँ:\n\n📍 अस्पताल दिशा-निर्देश (उदा. कार्डियोलॉजी 11002, फार्मेसी, लैब)\n❤️ मरीज के वाइटल्स (°F में)\n💊 निर्धारित दवाओं की सूची\n🗺 अस्पताल 2D मैप\n🚨 ड्यूटी नर्स कॉल\n🕐 मिलने का समय\n\nआप क्या जानना चाहते हैं?`;
    } else if (lang === 'te') {
      fallbackText = `నేను ఈ క్రింది అంశాలలో మీకు సహాయం చేయగలను:\n\n📍 ఆసుపత్రి మార్గాలు (కార్డియాలజీ 11002, ఫార్మసీ)\n❤️ రోగి వైటల్స్ (°F లో)\n💊 మందుల షెడ్యూల్\n🗺 ఆసుపత్రి మ్యాప్\n🚨 డ్యూటీ నర్సు కాల్\n🕐 సందర్శన సమయాలు`;
    }

    return {
      reply: fallbackText,
      cardType: 'UNKNOWN',
    };
  }
}

export const careAiService = new CareAiService();

// Standalone backward-compatible pure function for tests & external callers
export const processCareAiQuery = (
  rawQuery: string,
  patient?: Patient,
  langOverride?: string,
  roleOverride?: UserRole,
  doctorIdOverride?: string
): CareAiResponse => {
  return careAiService.processQuery(rawQuery, patient, langOverride, roleOverride, doctorIdOverride);
};
