import { 
  Patient, Doctor, Attender, PatientRequest, VitalAlert, Medication, 
  MedicalReport, DoctorNote, TimelineEvent, NotificationItem, VitalReading, RequestType,
  PatientAttenderLink, AttenderProvisionInput,
  CallRequest, CallServiceStaff, AuditLogEntry, CallPriority, CallStatus, UserRole,
  PatientCareTeamMember, CareTeamRole, Encounter, EncounterType, EncounterStatus,
  InpatientAdmission, HospitalLocation, Procedure, ProcedureStatus,
  MedicationCategory, MedAdministrationStatus, MedicationOrder, MedicationAdministrationRecord,
  Investigation, InvestigationStatus, PatientTransfer, DischargePlan
} from '../types';
import { analyzeVitalReading, checkForAlerts, shouldRepeatCriticalAlertSound } from './alertEngine';
import { networkSyncService, SyncMutation } from './networkSyncService';
import { supabaseSyncService } from './supabaseSyncService';
import { audioAlertService } from './audioAlertService';
import { telemetryDiagnosticService } from './telemetryDiagnosticService';

const STORAGE_KEY = 'careconnect_datastore_v4';

// 1. Initial Synthetic Doctors
const INITIAL_DOCTORS: Doctor[] = [
  {
    id: 'doc-arun',
    name: 'Dr. Arun Kumar',
    email: 'arun.kumar@careconnect.demo',
    specialty: 'Cardiology',
    department: 'Cardiology',
    phone: '+91 98401 23456',
    isOnline: true,
    activePatientCount: 1,
  },
  {
    id: 'doc-meena',
    name: 'Dr. Meena Swaminathan',
    email: 'meena.s@careconnect.demo',
    specialty: 'Neurology',
    department: 'Neurology',
    phone: '+91 98402 34567',
    isOnline: true,
    activePatientCount: 1,
  },
  {
    id: 'doc-kumar',
    name: 'Dr. Kumar Sundaram',
    email: 'kumar.s@careconnect.demo',
    specialty: 'Orthopedics',
    department: 'Orthopedics',
    phone: '+91 98403 45678',
    isOnline: true,
    activePatientCount: 1,
  },
  {
    id: 'doc-sneha',
    name: 'Dr. Sneha Reddy',
    email: 'sneha.reddy@careconnect.demo',
    specialty: 'Pulmonology',
    department: 'Pulmonology',
    phone: '+91 98404 56789',
    isOnline: true,
    activePatientCount: 0,
  },
  {
    id: 'doc-priya',
    name: 'Dr. Priya Sharma',
    email: 'priya.sharma@careconnect.demo',
    specialty: 'Endocrine & General Surgery',
    department: 'Surgery',
    phone: '+91 98405 67890',
    isOnline: true,
    activePatientCount: 1,
  },
  {
    id: 'doc-rajesh',
    name: 'Dr. Rajesh Kumar',
    email: 'rajesh.kumar@careconnect.demo',
    specialty: 'Anesthesiology & Critical Care',
    department: 'Anesthesiology',
    phone: '+91 98406 78901',
    isOnline: true,
    activePatientCount: 1,
  },
];

// 2. Initial Family Attenders (Family members / bedside caregivers)
const INITIAL_ATTENDERS: Attender[] = [
  {
    id: 'att-vikash',
    userId: 'att-vikash',
    name: 'Vikash Kumar',
    email: 'attender.vikash@careconnect.demo',
    phone: '+91 98765 43210',
    relation: 'Grandson',
    assignedPatientId: 'pat-ramesh',
    isOnline: true,
    temporaryPassword: 'Demo@123',
    mustChangePassword: false,
    status: 'active',
  },
  {
    id: 'att-priya',
    userId: 'att-priya',
    name: 'Priya Raj',
    email: 'attender.priya@careconnect.demo',
    phone: '+91 98765 43211',
    relation: 'Daughter',
    assignedPatientId: 'pat-anitha',
    isOnline: true,
    temporaryPassword: 'Demo@123',
    mustChangePassword: false,
    status: 'active',
  },
  {
    id: 'att-rahul',
    userId: 'att-rahul',
    name: 'Rahul S',
    email: 'attender.rahul@careconnect.demo',
    phone: '+91 98765 43212',
    relation: 'Brother',
    assignedPatientId: 'pat-karthik',
    isOnline: true,
    temporaryPassword: 'Demo@123',
    mustChangePassword: false,
    status: 'active',
  },
];

// History generator
function generateHistory(
  baseSys: number, baseDia: number, basePulse: number, baseSpO2: number, baseTemp: number, count = 12
): VitalReading[] {
  const readings: VitalReading[] = [];
  const now = Date.now();
  const stepMs = (6 * 3600 * 1000) / count;

  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now - i * stepMs).toISOString();
    const sVar = Math.round(Math.sin(i * 1.5) * 3);
    const dVar = Math.round(Math.cos(i * 1.2) * 2);
    const pVar = Math.round(Math.sin(i * 0.9) * 4);
    const oVar = Math.round(Math.cos(i * 2.1) * 1);
    const tVar = Number((Math.sin(i * 0.8) * 0.1).toFixed(1));

    const reading = analyzeVitalReading({
      systolicBP: Math.max(70, baseSys + sVar),
      diastolicBP: Math.max(45, baseDia + dVar),
      pulse: Math.max(45, basePulse + pVar),
      spO2: Math.min(100, Math.max(85, baseSpO2 + oVar)),
      temperature: Number((baseTemp + tVar).toFixed(1)),
      timestamp: time,
    });
    readings.push(reading);
  }
  return readings;
}

// 3. Initial Demo Patients
const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'pat-ramesh',
    mrn: 'CC-2026-101',
    name: 'Ramesh Kumar',
    age: 68,
    gender: 'Male',
    bloodGroup: 'O+',
    room: 'ICU-204',
    bed: 'Bed A',
    primaryCondition: 'Post-MI Cardiac Monitoring',
    currentDiagnosis: 'Acute Anterior Wall Myocardial Infarction (Post-PCI, DES placed in LAD)',
    medicalHistory: 'Type 2 Diabetes Mellitus (8 yrs), Essential Hypertension, Prior PCI to LAD (2024)',
    treatmentPlan: 'Dual Antiplatelet Therapy (DAPT), Statin plaque stabilization, continuous bedside ECG/SpO2 telemetry, low sodium diet',
    allergies: ['Penicillin (Severe Rash / Anaphylaxis Risk)', 'Sulfonamides'],
    careInstructions: 'Elevate head of bed 30°. Assist with all bed transfers. Low sodium cardiac diet. Notify doctor immediately if SpO2 falls below 92% or chest tightness occurs.',
    department: 'Cardiology',
    admissionDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    status: 'stable',
    assignedDoctorId: 'doc-arun',
    assignedDoctorName: 'Dr. Arun Kumar',
    assignedDoctorSpecialty: 'Cardiology',
    assignedAttenderId: 'att-vikash',
    assignedAttenderName: 'Vikash Kumar',
    assignedAttenderRelation: 'Grandson',
    assignedAttenderPhone: '+91 98765 43210',
    assignedAttenders: [
      {
        id: 'link-pat-ramesh-1',
        patientId: 'pat-ramesh',
        attenderId: 'att-vikash',
        attenderName: 'Vikash Kumar',
        relation: 'Grandson',
        phone: '+91 98765 43210',
        status: 'active',
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
    ],
    hardwareDeviceId: 'GLOVE-ESP32-DEV01',
    lastVitalUpdate: new Date().toISOString(),
    emergencyContact: 'Vikash Kumar (Grandson) • +91 98765 43210',
    notes: 'Patient exhibits residual right-hand finger movement. Smart Glove calibrated for bedside assistance requests.',
    currentLocation: {
      id: 'loc-icu-204-a',
      building: 'Main Hospital Building',
      floor: 1,
      wing: 'A',
      department: 'Cardiology',
      ward: 'Floor 1 ICU',
      room: 'ICU-204',
      bed: 'Bed A',
      mapNodeId: 'ROOM_ICU_204',
    },
    activeEncounterId: 'enc-ramesh-001',
    latestVitals: analyzeVitalReading({
      systolicBP: 120,
      diastolicBP: 80,
      pulse: 76,
      spO2: 98,
      temperature: 36.8,
      timestamp: new Date().toISOString(),
    }),
    vitalsHistory: generateHistory(120, 80, 76, 98, 36.8, 14),
  },
  {
    id: 'pat-anitha',
    mrn: 'CC-2026-102',
    name: 'Anitha Raj',
    age: 52,
    gender: 'Female',
    bloodGroup: 'B+',
    room: 'ICU-205',
    bed: 'Bed A',
    primaryCondition: 'Ischemic Stroke Recovery',
    currentDiagnosis: 'Acute Ischemic Stroke (Left MCA territory), Post-thrombolysis',
    medicalHistory: 'Atrial fibrillation, Dyslipidemia, Mild vascular cognitive impairment',
    treatmentPlan: 'Neuro-rehabilitation, anticoagulation therapy, swallow evaluation, speech therapy daily',
    allergies: ['NSAIDs (Gastric Intolerance)'],
    careInstructions: 'Fall precautions active. Assist right-side movement. Dysphagia diet level 2. Monitor BP q2h.',
    department: 'Neurology',
    admissionDate: new Date(Date.now() - 4 * 86400000).toISOString(),
    status: 'attention',
    assignedDoctorId: 'doc-meena',
    assignedDoctorName: 'Dr. Meena Swaminathan',
    assignedDoctorSpecialty: 'Neurology',
    assignedAttenderId: 'att-priya',
    assignedAttenderName: 'Priya Raj',
    assignedAttenderRelation: 'Daughter',
    assignedAttenderPhone: '+91 98765 43211',
    assignedAttenders: [
      {
        id: 'link-pat-anitha-1',
        patientId: 'pat-anitha',
        attenderId: 'att-priya',
        attenderName: 'Priya Raj',
        relation: 'Daughter',
        phone: '+91 98765 43211',
        status: 'active',
        createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      },
    ],
    hardwareDeviceId: 'GLOVE-ESP32-DEV02',
    lastVitalUpdate: new Date(Date.now() - 15000).toISOString(),
    emergencyContact: 'Priya Raj (Daughter) • +91 98765 43211',
    notes: 'Mild right hemiparesis. Using assistive glove for water and nurse calls.',
    currentLocation: {
      id: 'loc-icu-205-a',
      building: 'Main Hospital Building',
      floor: 1,
      wing: 'A',
      department: 'Neurology',
      ward: 'Floor 1 ICU',
      room: 'ICU-205',
      bed: 'Bed A',
      mapNodeId: 'ROOM_ICU_205',
    },
    activeEncounterId: 'enc-anitha-001',
    latestVitals: analyzeVitalReading({
      systolicBP: 136,
      diastolicBP: 88,
      pulse: 84,
      spO2: 95,
      temperature: 37.4,
      timestamp: new Date(Date.now() - 15000).toISOString(),
    }),
    vitalsHistory: generateHistory(134, 86, 82, 95, 37.3, 12),
  },
  {
    id: 'pat-karthik',
    mrn: 'CC-2026-103',
    name: 'Karthik S',
    age: 45,
    gender: 'Male',
    bloodGroup: 'A+',
    room: 'Ward-302',
    bed: 'Bed B',
    primaryCondition: 'Femur Fracture Post-Fixation',
    currentDiagnosis: 'Right Femoral Shaft Fracture, Closed Reduction & Interlocking Nailing',
    allergies: ['No Known Drug Allergies (NKDA)'],
    careInstructions: 'Non-weight bearing on right lower limb. Cryotherapy q4h. DVT prophylaxis active.',
    department: 'Orthopedics',
    admissionDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    status: 'stable',
    assignedDoctorId: 'doc-kumar',
    assignedDoctorName: 'Dr. Kumar Sundaram',
    assignedDoctorSpecialty: 'Orthopedics',
    assignedAttenderId: 'att-rahul',
    assignedAttenderName: 'Rahul S',
    assignedAttenderRelation: 'Brother',
    assignedAttenderPhone: '+91 98765 43212',
    assignedAttenders: [
      {
        id: 'link-pat-karthik-1',
        patientId: 'pat-karthik',
        attenderId: 'att-rahul',
        attenderName: 'Rahul S',
        relation: 'Brother',
        phone: '+91 98765 43212',
        status: 'active',
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
    ],
    hardwareDeviceId: 'GLOVE-ESP32-DEV03',
    lastVitalUpdate: new Date(Date.now() - 25000).toISOString(),
    emergencyContact: 'Rahul S (Brother) • +91 98765 43212',
    notes: 'Post-op day 2 recovery. Patient mobile with bed assistance.',
    currentLocation: {
      id: 'loc-ward-302-b',
      building: 'Main Hospital Building',
      floor: 2,
      wing: 'B',
      department: 'Orthopedics',
      ward: 'Ward 3',
      room: 'Ward-302',
      bed: 'Bed B',
      mapNodeId: 'ROOM_WARD_302',
    },
    activeEncounterId: 'enc-karthik-001',
    latestVitals: analyzeVitalReading({
      systolicBP: 118,
      diastolicBP: 78,
      pulse: 72,
      spO2: 99,
      temperature: 36.7,
      timestamp: new Date(Date.now() - 25000).toISOString(),
    }),
    vitalsHistory: generateHistory(118, 78, 72, 99, 36.7, 12),
  },
  {
    id: 'pat-suresh',
    mrn: 'CC-2026-104',
    name: 'Suresh Kumar',
    age: 58,
    gender: 'Male',
    bloodGroup: 'B+',
    room: '11002',
    bed: 'Bed B',
    primaryCondition: 'Multinodular Goiter / Thyroid Neoplasm',
    currentDiagnosis: 'Thyroid condition requiring surgery',
    medicalHistory: 'Euthyroid multinodular goiter (3 yrs), Mild essential hypertension',
    treatmentPlan: 'Total/Subtotal Thyroidectomy, post-op calcium and thyroid hormone monitoring',
    allergies: ['No Known Drug Allergies (NKDA)'],
    careInstructions: 'NPO post-midnight prior to surgery. Monitor surgical site incision, vocal cord function, and serum calcium levels.',
    department: 'Endocrinology / Surgical service',
    admissionDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    status: 'stable',
    assignedDoctorId: 'doc-arun',
    assignedDoctorName: 'Dr. Arun Kumar',
    assignedDoctorSpecialty: 'Cardiology / Endocrinology',
    assignedAttenderId: 'att-vikash',
    assignedAttenderName: 'Vikash Kumar',
    assignedAttenderRelation: 'Grandson',
    assignedAttenderPhone: '+91 98765 43210',
    assignedAttenders: [
      {
        id: 'link-pat-suresh-1',
        patientId: 'pat-suresh',
        attenderId: 'att-vikash',
        attenderName: 'Vikash Kumar',
        relation: 'Grandson',
        phone: '+91 98765 43210',
        status: 'active',
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
    ],
    currentLocation: {
      id: 'loc-11002-b',
      building: 'Main Hospital Building',
      floor: 2,
      wing: 'B',
      department: 'Cardiology / Surgical',
      ward: 'Ward 2',
      room: '11002',
      bed: 'Bed B',
      mapNodeId: 'ROOM_11002',
    },
    activeEncounterId: 'enc-suresh-001',
    hardwareDeviceId: 'GLOVE-ESP32-DEV04',
    lastVitalUpdate: new Date(Date.now() - 10000).toISOString(),
    emergencyContact: 'Vikash Kumar (Grandson) • +91 98765 43210',
    notes: 'Pre-operative thyroidectomy candidate. Pre-op surgical workup complete. Bedside assistance button active.',
    latestVitals: analyzeVitalReading({
      systolicBP: 122,
      diastolicBP: 80,
      pulse: 74,
      spO2: 98,
      temperature: 36.9,
      timestamp: new Date(Date.now() - 10000).toISOString(),
    }),
    vitalsHistory: generateHistory(122, 80, 74, 98, 36.9, 12),
  },
];

// Initial Hardware Requests (clean baseline; events triggered dynamically)
const INITIAL_REQUESTS: PatientRequest[] = [];

// Initial Alerts
const INITIAL_ALERTS: VitalAlert[] = [
  {
    id: 'alt-1',
    alertKey: 'pat-anitha:HYPERTENSION',
    conditionType: 'HYPERTENSION',
    patientId: 'pat-anitha',
    patientName: 'Anitha Raj',
    room: 'ICU-205',
    bed: 'Bed A',
    severity: 'attention',
    status: 'active',
    trigger: 'Blood pressure attention: 136/88 mmHg',
    message: 'Patient Anitha Raj (ICU-205) BP is 136/88 mmHg, exceeding baseline attention threshold.',
    familyMessage: "⚠️ ATTENTION NEEDED: Your family member's blood pressure has shifted. Please wait for / follow the medical team's instructions.",
    vitalType: 'BP',
    unit: 'mmHg',
    previousValue: '120/80 mmHg',
    currentValue: '136/88 mmHg',
    valueRecorded: '136/88 mmHg',
    trend: 'stable',
    timestamp: new Date(Date.now() - 15000).toISOString(),
    firstDetectedAt: new Date(Date.now() - 15000).toISOString(),
    lastUpdatedAt: new Date(Date.now() - 15000).toISOString(),
    occurrenceCount: 1,
    readingsCount: 1,
    recoveryCount: 0,
    recoveryEligible: false,
    escalationStatus: 'NONE',
    source: 'Clinical Telemetry',
  },
];

// Initial Medications
const INITIAL_MEDICATIONS: Medication[] = [
  {
    id: 'med-1',
    patientId: 'pat-ramesh',
    name: 'Amlodipine Besylate',
    dosage: '5 mg',
    route: 'Oral',
    frequency: 'Once daily (Morning)',
    scheduledTime: '08:00 AM',
    instructions: 'Take with water after breakfast',
    startDate: '2026-10-14',
    status: 'Given',
    prescribedBy: 'Dr. Arun Kumar',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    administeredAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    administeredBy: 'Vikash Kumar (Attender)',
  },
  {
    id: 'med-2',
    patientId: 'pat-ramesh',
    name: 'Atorvastatin Calcium',
    dosage: '40 mg',
    route: 'Oral',
    frequency: 'Once daily (Night)',
    scheduledTime: '09:00 PM',
    instructions: 'Post-dinner lipid management',
    startDate: '2026-10-14',
    status: 'Pending',
    prescribedBy: 'Dr. Arun Kumar',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'med-3',
    patientId: 'pat-ramesh',
    name: 'Aspirin (Ecosprin)',
    dosage: '75 mg',
    route: 'Oral',
    frequency: 'Once daily (Lunch)',
    scheduledTime: '01:00 PM',
    instructions: 'Antiplatelet therapy after food',
    startDate: '2026-10-14',
    status: 'Pending',
    prescribedBy: 'Dr. Arun Kumar',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

// Initial Reports
const INITIAL_REPORTS: MedicalReport[] = [
  {
    id: 'rep-1',
    patientId: 'pat-ramesh',
    title: '12-Lead Electrocardiogram (ECG)',
    reportType: 'ECG',
    date: '2026-10-15',
    uploadedBy: 'Dr. Arun Kumar',
    status: 'Reviewed',
    summary: 'Sinus rhythm with documented post-MI changes. Resolved anterior ST segment changes. Stable EF ~48%.',
    fileName: 'ecg_ramesh_15oct2026.pdf',
  },
  {
    id: 'rep-2',
    patientId: 'pat-ramesh',
    title: 'Serum Electrolytes & Cardiac Enzymes',
    reportType: 'Lab Test',
    date: '2026-10-15',
    uploadedBy: 'Central Biochemistry Lab',
    status: 'Reviewed',
    summary: 'Troponin-I: 0.03 ng/mL (normalized baseline). Potassium: 4.2 mEq/L, Sodium: 139 mEq/L.',
    fileName: 'lab_electrolytes_15oct2026.pdf',
  },
  {
    id: 'rep-3',
    patientId: 'pat-ramesh',
    title: 'Transthoracic 2D Echocardiogram',
    reportType: 'Echo',
    date: '2026-10-14',
    uploadedBy: 'Dr. Arun Kumar',
    status: 'Reviewed',
    summary: 'Mild anterior hypokinesia consistent with resolving MI. Left ventricular ejection fraction preserved at ~48%.',
    fileName: 'echo_ramesh_14oct2026.pdf',
  },
];

// Initial Notes
const INITIAL_NOTES: DoctorNote[] = [
  {
    id: 'note-1',
    patientId: 'pat-ramesh',
    doctorName: 'Dr. Arun Kumar',
    doctorId: 'doc-arun',
    content: 'Patient transferred to ICU-204 Bed A. Assistive smart glove paired with grandson Vikash for bedside caregiver communication. Vital parameters responding well.',
    category: 'Observation',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
];

// Initial Timeline
const INITIAL_TIMELINE: TimelineEvent[] = [
  {
    id: 'tl-1',
    patientId: 'pat-ramesh',
    title: 'Patient Admitted to ICU-204',
    description: 'Ramesh Kumar admitted with cardiac monitoring indication in Bed A.',
    category: 'ADMISSION',
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
    actor: 'Admin Desk',
    severity: 'normal',
  },
  {
    id: 'tl-2',
    patientId: 'pat-ramesh',
    title: 'Cardiologist Assigned',
    description: 'Dr. Arun Kumar (Cardiology) assigned via rule-based specialty allocation.',
    category: 'ASSIGNMENT',
    timestamp: new Date(Date.now() - 3 * 86400000 + 300000).toISOString(),
    actor: 'Admin Desk',
    severity: 'normal',
  },
  {
    id: 'tl-3',
    patientId: 'pat-ramesh',
    title: 'Family Attender Paired',
    description: 'Vikash Kumar (Grandson) registered as primary bedside family attender.',
    category: 'ASSIGNMENT',
    timestamp: new Date(Date.now() - 3 * 86400000 + 600000).toISOString(),
    actor: 'Admin Desk',
    severity: 'normal',
  },
  {
    id: 'tl-4',
    patientId: 'pat-ramesh',
    title: 'Assistive Smart Glove Paired',
    description: 'Hardware GLOVE-ESP32-DEV01 paired for residual hand movement requests.',
    category: 'ADMISSION',
    timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
    actor: 'Biomedical Engineering',
    severity: 'normal',
  },
  {
    id: 'tl-5',
    patientId: 'pat-ramesh',
    title: 'Medication Administered: Amlodipine 5 mg',
    description: '08:00 AM morning dose marked as GIVEN by Vikash Kumar (Attender).',
    category: 'ATTENDER_ACTION',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    actor: 'Vikash Kumar (Attender)',
    severity: 'normal',
  },
];

// Initial Notifications (clean baseline; generated upon events)
const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

// Initial Call Service Staff
export const INITIAL_CALL_STAFF: CallServiceStaff[] = [
  {
    id: 'staff-priya',
    name: 'Nurse Priya',
    role: 'Nurse',
    department: 'Cardiology & Acute Surgical Care',
    ward: 'Cardio-Floor 2',
    floor: 2,
    status: 'AVAILABLE',
    activeCallCount: 0,
    phone: '+91 98401 11225',
    lastActive: new Date().toISOString(),
  },
  {
    id: 'staff-sarah',
    name: 'Nurse Sarah Jenkins',
    role: 'Nurse',
    department: 'Intensive Care Unit',
    ward: 'ICU-Floor 1',
    floor: 1,
    status: 'AVAILABLE',
    activeCallCount: 0,
    phone: '+91 98401 11221',
    lastActive: new Date().toISOString(),
  },
  {
    id: 'staff-rahul',
    name: 'Nurse Rahul Nair',
    role: 'Nurse',
    department: 'Cardiology',
    ward: 'Cardio-Floor 2',
    floor: 2,
    status: 'AVAILABLE',
    activeCallCount: 0,
    phone: '+91 98401 11222',
    lastActive: new Date().toISOString(),
  },
  {
    id: 'staff-amit',
    name: 'Support Amit Roy',
    role: 'Support Staff',
    department: 'General Inpatient Care',
    ward: 'Floor 1 Ward',
    floor: 1,
    status: 'AVAILABLE',
    activeCallCount: 0,
    phone: '+91 98401 11223',
    lastActive: new Date().toISOString(),
  },
  {
    id: 'staff-deepa',
    name: 'Ward Asst Deepa Patel',
    role: 'Ward Assistant',
    department: 'Patient Transport & Mobility',
    ward: 'Ground Floor',
    floor: 0,
    status: 'AVAILABLE',
    activeCallCount: 0,
    phone: '+91 98401 11224',
    lastActive: new Date().toISOString(),
  },
  {
    id: 'staff-kavita',
    name: 'Dr. Kavita Joshi',
    role: 'Duty Physician',
    department: 'Emergency & Acute Care',
    ward: 'Emergency-Ground',
    floor: 0,
    status: 'AVAILABLE',
    activeCallCount: 0,
    phone: '+91 98401 11225',
    lastActive: new Date().toISOString(),
  },
];

// Initial Call Requests
export const INITIAL_CALL_REQUESTS: CallRequest[] = [
  {
    id: 'call-seed-1',
    patientId: 'pat-ramesh',
    patientName: 'Ramesh Kumar',
    room: 'ICU-204',
    bed: 'Bed A',
    floor: 1,
    ward: 'ICU',
    attenderId: 'att-vikash',
    attenderName: 'Vikash Kumar',
    attenderRelation: 'Grandson',
    reason: 'Bedside IV line check requested',
    priority: 'NORMAL',
    status: 'RESOLVED',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    acknowledgedAt: new Date(Date.now() - 3600000 * 2 + 45000).toISOString(),
    assignedAt: new Date(Date.now() - 3600000 * 2 + 50000).toISOString(),
    respondingAt: new Date(Date.now() - 3600000 * 2 + 90000).toISOString(),
    resolvedAt: new Date(Date.now() - 3600000 * 2 + 300000).toISOString(),
    assignedStaffId: 'staff-sarah',
    assignedStaffName: 'Nurse Sarah Jenkins',
    assignedStaffRole: 'Nurse',
    notes: 'Attended bedside, IV drip verified secure and flowing smoothly.',
  },
];

// Initial Security & Audit Logs
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'audit-seed-1',
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
    user: 'Admin Desk',
    userRole: 'admin',
    action: 'PATIENT_ADMITTED',
    target: 'Ramesh Kumar (ICU-204)',
    details: 'Admitted with Cardiac condition. Doctor Arun Kumar assigned.',
    result: 'SUCCESS',
  },
  {
    id: 'audit-seed-2',
    timestamp: new Date(Date.now() - 3 * 86400000 + 600000).toISOString(),
    user: 'Admin Desk',
    userRole: 'admin',
    action: 'ATTENDER_PROVISIONED',
    target: 'Vikash Kumar (att-vikash)',
    details: 'Provisioned as bedside attender for Ramesh Kumar. Temporary password issued.',
    result: 'SUCCESS',
  },
  {
    id: 'audit-seed-3',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    user: 'system',
    userRole: 'system',
    action: 'SECURITY_INTEGRITY_CHECK',
    target: 'Role Scoping & Database',
    details: 'Integrity scan verified: Doctor scoping, Attender scoping, and Audit ledger active.',
    result: 'SUCCESS',
  },
];

// ==========================================
// INITIAL CLINICAL DOMAIN CONSTANTS
// ==========================================

export const INITIAL_CARE_TEAMS: PatientCareTeamMember[] = [
  // Suresh Kumar - Thyroid Surgery Care Team
  {
    id: 'ct-suresh-1',
    patientId: 'pat-suresh',
    encounterId: 'enc-suresh-001',
    userId: 'doc-arun',
    name: 'Dr. Arun Kumar',
    role: 'ATTENDING_PHYSICIAN',
    specialty: 'Cardiology / Endocrinology',
    department: 'Endocrinology',
    status: 'active',
    assignedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    isPrimary: true,
    phone: '+91 98401 23456',
    notes: 'Primary admitting physician overseeing medical optimization.',
  },
  {
    id: 'ct-suresh-2',
    patientId: 'pat-suresh',
    encounterId: 'enc-suresh-001',
    userId: 'doc-priya',
    name: 'Dr. Priya Sharma',
    role: 'SURGEON',
    specialty: 'Endocrine & General Surgery',
    department: 'Surgery',
    status: 'active',
    assignedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    isPrimary: false,
    phone: '+91 98405 67890',
    notes: 'Operating endocrine surgeon for planned thyroidectomy.',
  },
  {
    id: 'ct-suresh-3',
    patientId: 'pat-suresh',
    encounterId: 'enc-suresh-001',
    userId: 'doc-rajesh',
    name: 'Dr. Rajesh Kumar',
    role: 'ANESTHESIOLOGIST',
    specialty: 'Anesthesiology & Critical Care',
    department: 'Anesthesiology',
    status: 'active',
    assignedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    isPrimary: false,
    phone: '+91 98406 78901',
    notes: 'Pre-anesthetic evaluation complete. Mallampati Class 1 airway.',
  },
  {
    id: 'ct-suresh-4',
    patientId: 'pat-suresh',
    encounterId: 'enc-suresh-001',
    userId: 'doc-meena',
    name: 'Dr. Meena Swaminathan',
    role: 'CONSULTANT',
    specialty: 'Neurology',
    department: 'Neurology',
    status: 'active',
    assignedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    isPrimary: false,
    phone: '+91 98402 34567',
    notes: 'Cross-consultation regarding recurrent laryngeal nerve monitoring.',
  },
  {
    id: 'ct-suresh-5',
    patientId: 'pat-suresh',
    encounterId: 'enc-suresh-001',
    userId: 'staff-sarah',
    name: 'Nurse Sarah Jenkins',
    role: 'NURSE',
    department: 'Intensive Care Unit',
    status: 'active',
    assignedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    isPrimary: false,
    phone: '+91 98401 11221',
    notes: 'Floor primary bedside nurse.',
  },
  // Ramesh Kumar - Cardiology Care Team
  {
    id: 'ct-ramesh-1',
    patientId: 'pat-ramesh',
    encounterId: 'enc-ramesh-001',
    userId: 'doc-arun',
    name: 'Dr. Arun Kumar',
    role: 'ATTENDING_PHYSICIAN',
    specialty: 'Cardiology',
    department: 'Cardiology',
    status: 'active',
    assignedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    isPrimary: true,
    phone: '+91 98401 23456',
  },
  {
    id: 'ct-ramesh-2',
    patientId: 'pat-ramesh',
    encounterId: 'enc-ramesh-001',
    userId: 'staff-sarah',
    name: 'Nurse Sarah Jenkins',
    role: 'NURSE',
    department: 'Intensive Care Unit',
    status: 'active',
    assignedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    isPrimary: false,
  },
  // Anitha Raj - Neurology Care Team
  {
    id: 'ct-anitha-1',
    patientId: 'pat-anitha',
    encounterId: 'enc-anitha-001',
    userId: 'doc-meena',
    name: 'Dr. Meena Swaminathan',
    role: 'ATTENDING_PHYSICIAN',
    specialty: 'Neurology',
    department: 'Neurology',
    status: 'active',
    assignedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    isPrimary: true,
    phone: '+91 98402 34567',
  },
  {
    id: 'ct-anitha-2',
    patientId: 'pat-anitha',
    encounterId: 'enc-anitha-001',
    userId: 'staff-sarah',
    name: 'Nurse Sarah Jenkins',
    role: 'NURSE',
    department: 'Intensive Care Unit',
    status: 'active',
    assignedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    isPrimary: false,
  },
  // Karthik S - Orthopedics Care Team
  {
    id: 'ct-karthik-1',
    patientId: 'pat-karthik',
    encounterId: 'enc-karthik-001',
    userId: 'doc-kumar',
    name: 'Dr. Kumar Sundaram',
    role: 'ATTENDING_PHYSICIAN',
    specialty: 'Orthopedics',
    department: 'Orthopedics',
    status: 'active',
    assignedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    isPrimary: true,
    phone: '+91 98403 45678',
  },
];

export const INITIAL_ENCOUNTERS: Encounter[] = [
  {
    id: 'enc-suresh-001',
    patientId: 'pat-suresh',
    type: 'SURGICAL',
    status: 'ACTIVE',
    startDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    department: 'Endocrinology / Surgical service',
    reasonForAdmission: 'Thyroid condition requiring surgery',
  },
  {
    id: 'enc-ramesh-001',
    patientId: 'pat-ramesh',
    type: 'INPATIENT',
    status: 'ACTIVE',
    startDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    department: 'Cardiology',
    reasonForAdmission: 'Post-MI cardiac telemetry monitoring',
  },
  {
    id: 'enc-anitha-001',
    patientId: 'pat-anitha',
    type: 'INPATIENT',
    status: 'ACTIVE',
    startDate: new Date(Date.now() - 4 * 86400000).toISOString(),
    department: 'Neurology',
    reasonForAdmission: 'Acute ischemic stroke rehabilitation',
  },
  {
    id: 'enc-karthik-001',
    patientId: 'pat-karthik',
    type: 'SURGICAL',
    status: 'ACTIVE',
    startDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    department: 'Orthopedics',
    reasonForAdmission: 'Right femur fracture post-fixation recovery',
  },
];

export const INITIAL_ADMISSIONS: InpatientAdmission[] = [
  {
    admissionId: 'adm-suresh-001',
    patientId: 'pat-suresh',
    encounterId: 'enc-suresh-001',
    admissionDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    admissionType: 'SURGICAL',
    admittingService: 'Endocrinology / Surgical service',
    attendingDoctorId: 'doc-arun',
    attendingDoctorName: 'Dr. Arun Kumar',
    currentLocation: {
      id: 'loc-11002-b',
      building: 'Main Hospital Building',
      floor: 2,
      wing: 'B',
      department: 'Cardiology / Surgical',
      ward: 'Ward 2',
      room: '11002',
      bed: 'Bed B',
      mapNodeId: 'ROOM_11002',
    },
    status: 'PREOP',
    expectedDischargeDate: new Date(Date.now() + 3 * 86400000).toISOString(),
  },
  {
    admissionId: 'adm-ramesh-001',
    patientId: 'pat-ramesh',
    encounterId: 'enc-ramesh-001',
    admissionDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    admissionType: 'EMERGENCY',
    admittingService: 'Cardiology',
    attendingDoctorId: 'doc-arun',
    attendingDoctorName: 'Dr. Arun Kumar',
    currentLocation: {
      id: 'loc-icu-204-a',
      building: 'Main Hospital Building',
      floor: 1,
      wing: 'A',
      department: 'Cardiology',
      ward: 'Floor 1 ICU',
      room: 'ICU-204',
      bed: 'Bed A',
      mapNodeId: 'ROOM_ICU_204',
    },
    status: 'ADMITTED',
  },
];

export const INITIAL_PROCEDURES: Procedure[] = [
  {
    id: 'proc-suresh-001',
    patientId: 'pat-suresh',
    encounterId: 'enc-suresh-001',
    procedureName: 'Thyroidectomy',
    specialty: 'Endocrine & General Surgery',
    scheduledAt: new Date(Date.now() + 18 * 3600000).toISOString(),
    status: 'SCHEDULED',
    surgeonId: 'doc-priya',
    surgeonName: 'Dr. Priya Sharma',
    anesthesiologistId: 'doc-rajesh',
    anesthesiologistName: 'Dr. Rajesh Kumar',
    operatingRoom: 'OT-Floor 2',
    preOpVerified: true,
    notes: 'Airway assessment Grade 1. Vocal cords visually verified intact by scope. Informed consent signed.',
  },
];

export const INITIAL_MEDICATION_ORDERS: MedicationOrder[] = [
  {
    id: 'order-suresh-1',
    patientId: 'pat-suresh',
    encounterId: 'enc-suresh-001',
    name: 'Levothyroxine 100mcg',
    category: 'HOME_MEDICATION',
    dosage: '100mcg',
    route: 'Oral',
    frequency: 'Once daily before breakfast',
    prescribedBy: 'Dr. Arun Kumar',
    prescribedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    status: 'ACTIVE',
    instructions: 'Home medication reconciled. Hold morning of surgery.',
  },
  {
    id: 'order-suresh-2',
    patientId: 'pat-suresh',
    encounterId: 'enc-suresh-001',
    name: 'Cefazolin 1g IV',
    category: 'INPATIENT_ORDER',
    dosage: '1g',
    route: 'IV',
    frequency: 'Pre-operative surgical prophylaxis 30 min before incision',
    prescribedBy: 'Dr. Priya Sharma',
    prescribedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    status: 'ACTIVE',
    instructions: 'Administer over 3-5 min IV push in pre-op.',
  },
  {
    id: 'order-suresh-3',
    patientId: 'pat-suresh',
    encounterId: 'enc-suresh-001',
    name: 'Calcium Carbonate 500mg',
    category: 'INPATIENT_ORDER',
    dosage: '500mg',
    route: 'Oral',
    frequency: 'Three times daily with meals',
    prescribedBy: 'Dr. Priya Sharma',
    prescribedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    status: 'ACTIVE',
    instructions: 'Prophylaxis for transient post-thyroidectomy hypocalcemia.',
  },
  {
    id: 'order-suresh-4',
    patientId: 'pat-suresh',
    encounterId: 'enc-suresh-001',
    name: 'Paracetamol 650mg IV PRN',
    category: 'INPATIENT_ORDER',
    dosage: '650mg',
    route: 'IV',
    frequency: 'Every 6 hours as needed for mild to moderate surgical pain',
    prescribedBy: 'Dr. Rajesh Kumar',
    prescribedAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    status: 'ACTIVE',
    instructions: 'Maximum 4000mg in 24 hours.',
  },
];

export const INITIAL_MED_ADMINISTRATIONS: MedicationAdministrationRecord[] = [
  {
    id: 'mar-suresh-1',
    orderId: 'order-suresh-1',
    patientId: 'pat-suresh',
    medicationName: 'Levothyroxine 100mcg',
    dosage: '100mcg',
    route: 'Oral',
    scheduledTime: '08:00 AM',
    status: 'ADMINISTERED',
    administeredAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    administeredBy: 'Nurse Sarah Jenkins',
    notes: 'Administered bedside with a sip of water.',
  },
  {
    id: 'mar-suresh-2',
    orderId: 'order-suresh-2',
    patientId: 'pat-suresh',
    medicationName: 'Cefazolin 1g IV',
    dosage: '1g',
    route: 'IV',
    scheduledTime: '09:00 AM',
    status: 'SCHEDULED',
    notes: 'Awaiting call to OR suite.',
  },
];

export const INITIAL_INVESTIGATIONS: Investigation[] = [
  {
    id: 'inv-suresh-1',
    patientId: 'pat-suresh',
    encounterId: 'enc-suresh-001',
    type: 'LAB',
    name: 'Thyroid Stimulating Hormone (TSH)',
    orderedBy: 'Dr. Arun Kumar',
    orderedAt: new Date(Date.now() - 36 * 3600000).toISOString(),
    status: 'REVIEWED',
    result: '2.1 mIU/L',
    resultedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    reviewedBy: 'Dr. Arun Kumar',
    reviewedAt: new Date(Date.now() - 20 * 3600000).toISOString(),
    normalRange: '0.4 - 4.0 mIU/L',
  },
  {
    id: 'inv-suresh-2',
    patientId: 'pat-suresh',
    encounterId: 'enc-suresh-001',
    type: 'RADIOLOGY',
    name: 'Ultrasound Neck & Thyroid',
    orderedBy: 'Dr. Priya Sharma',
    orderedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    status: 'REVIEWED',
    result: '2.4 cm dominant nodule right lobe, EU-TIRADS 4',
    resultedAt: new Date(Date.now() - 30 * 3600000).toISOString(),
    reviewedBy: 'Dr. Priya Sharma',
    reviewedAt: new Date(Date.now() - 28 * 3600000).toISOString(),
  },
  {
    id: 'inv-suresh-3',
    patientId: 'pat-suresh',
    encounterId: 'enc-suresh-001',
    type: 'PATHOLOGY',
    name: 'Fine Needle Aspiration Cytology (FNAC)',
    orderedBy: 'Dr. Priya Sharma',
    orderedAt: new Date(Date.now() - 40 * 3600000).toISOString(),
    status: 'REVIEWED',
    result: 'Bethesda Category IV (Follicular Neoplasm)',
    resultedAt: new Date(Date.now() - 20 * 3600000).toISOString(),
    reviewedBy: 'Dr. Priya Sharma',
    reviewedAt: new Date(Date.now() - 18 * 3600000).toISOString(),
  },
  {
    id: 'inv-suresh-4',
    patientId: 'pat-suresh',
    encounterId: 'enc-suresh-001',
    type: 'LAB',
    name: 'Serum Ionized Calcium',
    orderedBy: 'Dr. Rajesh Kumar',
    orderedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    status: 'REVIEWED',
    result: '9.4 mg/dL',
    resultedAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    reviewedBy: 'Dr. Rajesh Kumar',
    reviewedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    normalRange: '8.5 - 10.5 mg/dL',
  },
];

export const INITIAL_TRANSFERS: PatientTransfer[] = [];

export const INITIAL_DISCHARGE_PLANS: DischargePlan[] = [
  {
    id: 'dc-plan-suresh',
    patientId: 'pat-suresh',
    encounterId: 'enc-suresh-001',
    plannedDate: new Date(Date.now() + 3 * 86400000).toISOString(),
    status: 'PLANNING',
    medicationsReconciled: false,
    pendingResultsReviewed: true,
    nursingDischargeCompleted: false,
    dischargeInstructions: [
      'Post-thyroidectomy incision wound care: keep dry for 48 hours.',
      'Report immediate perioral tingling, numbness, or finger spasms (hypocalcemia signs).',
      'Follow-up with Dr. Priya Sharma in 5 days for histopathology review and suture check.',
      'Resume Levothyroxine with post-operative dose titration as prescribed.',
    ],
    followUpAppointment: 'Dr. Priya Sharma - OPD Surgical Suite 4',
  },
];

class DataStore {
  private patients: Patient[] = [];
  private doctors: Doctor[] = [];
  private attenders: Attender[] = [];
  private requests: PatientRequest[] = [];
  private alerts: VitalAlert[] = [];
  private medications: Medication[] = [];
  private reports: MedicalReport[] = [];
  private notes: DoctorNote[] = [];
  private timeline: TimelineEvent[] = [];
  private notifications: NotificationItem[] = [];
  private callRequests: CallRequest[] = [];
  private callStaff: CallServiceStaff[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private careTeamMembers: PatientCareTeamMember[] = [];
  private encounters: Encounter[] = [];
  private admissions: InpatientAdmission[] = [];
  private procedures: Procedure[] = [];
  private medicationOrders: MedicationOrder[] = [];
  private medicationAdministrations: MedicationAdministrationRecord[] = [];
  private investigations: Investigation[] = [];
  private transfers: PatientTransfer[] = [];
  private dischargePlans: DischargePlan[] = [];

  // Shared browser sound preference (default: ON)
  private soundEnabled: boolean = true;
  private clinicalAlertSoundEnabled: boolean = true;
  private criticalAlertTimer: number | null = null;

  private listeners: Set<() => void> = new Set();
  private vitalListeners: Set<(patientId: string, reading: VitalReading) => void> = new Set();
  private channel: BroadcastChannel | null = null;
  private lastSyncTimestamp: number = Date.now();
  private stateVersion: number = 1;
  private processedMutationIds: Set<string> = new Set();
  private maxProcessedMutationHistory: number = 1000;

  public onVitalRecorded(cb: (patientId: string, reading: VitalReading) => void): () => void {
    this.vitalListeners.add(cb);
    return () => this.vitalListeners.delete(cb);
  }

  public isMutationProcessed(mutationId: string): boolean {
    return this.processedMutationIds.has(mutationId);
  }

  public markMutationProcessed(mutationId: string): void {
    if (this.processedMutationIds.size >= this.maxProcessedMutationHistory) {
      const firstKey = this.processedMutationIds.values().next().value;
      if (firstKey) this.processedMutationIds.delete(firstKey);
    }
    this.processedMutationIds.add(mutationId);
  }

  public getStateVersion(): number {
    return this.stateVersion;
  }

  constructor() {
    this.loadFromStorage();
    this.loadClinicalAlertSoundPreference();
    this.initCrossTabSync();
    this.initNetworkSync();
  }

  private initCrossTabSync() {
    if (typeof window !== 'undefined') {
      try {
        if ('BroadcastChannel' in window) {
          this.channel = new BroadcastChannel('careconnect_datastore_sync');
          this.channel.onmessage = (event) => {
            if (event.data?.type === 'DATASTORE_SYNC') {
              if (event.data.snapshot) {
                this.applyFullSnapshot(event.data.snapshot);
              } else {
                this.reloadFromStorage();
              }
              if (event.data.mutation) {
                this.applyRemoteMutation(event.data.mutation);
              }
            }
          };
        }
      } catch {
        // BroadcastChannel may fail in private/sandboxed windows, fallback to storage event
      }

      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY) {
          this.reloadFromStorage();
        }
      });
    }
  }

  private initNetworkSync() {
    if (typeof window !== 'undefined') {
      // 1. Listen for cross-device SSE mutations (e.g. phone to laptop)
      networkSyncService.onMutation((mutation) => {
        this.applyRemoteMutation(mutation);
      });

      // 2. Listen for polling fallback state sync
      networkSyncService.onStateSync((state) => {
        if (state && state.patients && state.patients.length > 0) {
          this.applyFullSnapshot(state);
        }
      });

      // 3. Fetch server canonical snapshot if available
      networkSyncService.fetchServerState().then((state) => {
        if (state && state.patients && state.patients.length > 0) {
          this.applyFullSnapshot(state);
        } else {
          // Push initial state snapshot so newly connected devices have it
          networkSyncService.broadcastMutation({
            type: 'FULL_SYNC',
            payload: this.getStateSnapshot(),
          });
        }
      });

      // 4. Supabase Realtime cloud connection
      supabaseSyncService.initialize((table, eventType, data) => {
        this.handleSupabaseChange(table, eventType, data);
      });
    }
  }

  public getStateSnapshot() {
    return {
      patients: this.patients,
      doctors: this.doctors,
      attenders: this.attenders,
      requests: this.requests,
      alerts: this.alerts,
      medications: this.medications,
      reports: this.reports,
      notes: this.notes,
      timeline: this.timeline,
      notifications: this.notifications,
      callRequests: this.callRequests,
      callStaff: this.callStaff,
      auditLogs: this.auditLogs,
      careTeamMembers: this.careTeamMembers,
      encounters: this.encounters,
      admissions: this.admissions,
      procedures: this.procedures,
      medicationOrders: this.medicationOrders,
      medicationAdministrations: this.medicationAdministrations,
      investigations: this.investigations,
      transfers: this.transfers,
      dischargePlans: this.dischargePlans,
      soundEnabled: this.soundEnabled,
      _timestamp: this.lastSyncTimestamp || Date.now(),
      _stateVersion: this.stateVersion,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public applyFullSnapshot(snapshot: any) {
    if (!snapshot) return;
    // Guard against stale snapshots overwriting newer local state
    if (snapshot._stateVersion !== undefined && this.stateVersion !== undefined) {
      if (snapshot._stateVersion <= this.stateVersion) {
        return;
      }
      this.stateVersion = snapshot._stateVersion;
    } else if (snapshot._timestamp && this.lastSyncTimestamp && snapshot._timestamp < this.lastSyncTimestamp) {
      return;
    }
    if (snapshot._stateVersion) {
      this.stateVersion = Math.max(this.stateVersion, snapshot._stateVersion);
    }
    this.patients = snapshot.patients || this.patients;
    this.doctors = snapshot.doctors || this.doctors;
    this.attenders = snapshot.attenders || this.attenders;
    this.requests = snapshot.requests || this.requests;
    this.alerts = snapshot.alerts || this.alerts;
    this.medications = snapshot.medications || this.medications;
    this.reports = snapshot.reports || this.reports;
    this.notes = snapshot.notes || this.notes;
    this.timeline = snapshot.timeline || this.timeline;
    this.notifications = snapshot.notifications || this.notifications;
    this.callRequests = snapshot.callRequests || this.callRequests;
    this.callStaff = snapshot.callStaff || this.callStaff;
    this.auditLogs = snapshot.auditLogs || this.auditLogs;
    this.careTeamMembers = snapshot.careTeamMembers || this.careTeamMembers;
    this.encounters = snapshot.encounters || this.encounters;
    this.admissions = snapshot.admissions || this.admissions;
    this.procedures = snapshot.procedures || this.procedures;
    this.medicationOrders = snapshot.medicationOrders || this.medicationOrders;
    this.medicationAdministrations = snapshot.medicationAdministrations || this.medicationAdministrations;
    this.investigations = snapshot.investigations || this.investigations;
    this.transfers = snapshot.transfers || this.transfers;
    this.dischargePlans = snapshot.dischargePlans || this.dischargePlans;
    this.soundEnabled = snapshot.soundEnabled !== undefined ? snapshot.soundEnabled : this.soundEnabled;
    this.notifyLocalSubscribersOnly();
  }

  public reloadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.patients = parsed.patients || this.patients;
        this.doctors = parsed.doctors || this.doctors;
        this.attenders = parsed.attenders || this.attenders;
        this.requests = parsed.requests || this.requests;
        this.alerts = parsed.alerts || this.alerts;
        this.medications = parsed.medications || this.medications;
        this.reports = parsed.reports || this.reports;
        this.notes = parsed.notes || this.notes;
        this.timeline = parsed.timeline || this.timeline;
        this.notifications = parsed.notifications || this.notifications;
        this.callRequests = parsed.callRequests || this.callRequests;
        this.callStaff = parsed.callStaff || this.callStaff;
        this.auditLogs = parsed.auditLogs || this.auditLogs;
        this.careTeamMembers = parsed.careTeamMembers || this.careTeamMembers;
        this.encounters = parsed.encounters || this.encounters;
        this.admissions = parsed.admissions || this.admissions;
        this.procedures = parsed.procedures || this.procedures;
        this.medicationOrders = parsed.medicationOrders || this.medicationOrders;
        this.medicationAdministrations = parsed.medicationAdministrations || this.medicationAdministrations;
        this.investigations = parsed.investigations || this.investigations;
        this.transfers = parsed.transfers || this.transfers;
        this.dischargePlans = parsed.dischargePlans || this.dischargePlans;
        this.soundEnabled = parsed.soundEnabled !== undefined ? parsed.soundEnabled : this.soundEnabled;
        this.lastSyncTimestamp = Date.now();
      }
    } catch {
      // ignore
    }

    // Notify all active React subscribers in this tab
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Subscriber notification error on cross-tab reload:', err);
      }
    });
  }

  public getLastSyncTime(): number {
    return this.lastSyncTimestamp;
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.patients = parsed.patients || INITIAL_PATIENTS;
        this.doctors = parsed.doctors || INITIAL_DOCTORS;
        this.attenders = parsed.attenders || INITIAL_ATTENDERS;
        this.requests = parsed.requests || INITIAL_REQUESTS;
        this.alerts = parsed.alerts || INITIAL_ALERTS;
        this.medications = parsed.medications || INITIAL_MEDICATIONS;
        this.reports = parsed.reports || INITIAL_REPORTS;
        this.notes = parsed.notes || INITIAL_NOTES;
        this.timeline = parsed.timeline || INITIAL_TIMELINE;
        this.notifications = parsed.notifications || INITIAL_NOTIFICATIONS;
        this.callRequests = parsed.callRequests || INITIAL_CALL_REQUESTS;
        this.callStaff = parsed.callStaff || INITIAL_CALL_STAFF;
        this.auditLogs = parsed.auditLogs || INITIAL_AUDIT_LOGS;
        this.careTeamMembers = parsed.careTeamMembers || INITIAL_CARE_TEAMS;
        this.encounters = parsed.encounters || INITIAL_ENCOUNTERS;
        this.admissions = parsed.admissions || INITIAL_ADMISSIONS;
        this.procedures = parsed.procedures || INITIAL_PROCEDURES;
        this.medicationOrders = parsed.medicationOrders || INITIAL_MEDICATION_ORDERS;
        this.medicationAdministrations = parsed.medicationAdministrations || INITIAL_MED_ADMINISTRATIONS;
        this.investigations = parsed.investigations || INITIAL_INVESTIGATIONS;
        this.transfers = parsed.transfers || INITIAL_TRANSFERS;
        this.dischargePlans = parsed.dischargePlans || INITIAL_DISCHARGE_PLANS;
        this.soundEnabled = parsed.soundEnabled !== undefined ? parsed.soundEnabled : true;
        this.lastSyncTimestamp = Date.now();
        return;
      }
    } catch {
      // ignore
    }
    this.resetToDefaults();
  }

  private saveToStorage() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          patients: this.patients,
          doctors: this.doctors,
          attenders: this.attenders,
          requests: this.requests,
          alerts: this.alerts,
          medications: this.medications,
          reports: this.reports,
          notes: this.notes,
          timeline: this.timeline,
          notifications: this.notifications,
          callRequests: this.callRequests,
          callStaff: this.callStaff,
          auditLogs: this.auditLogs,
          careTeamMembers: this.careTeamMembers,
          encounters: this.encounters,
          admissions: this.admissions,
          procedures: this.procedures,
          medicationOrders: this.medicationOrders,
          medicationAdministrations: this.medicationAdministrations,
          investigations: this.investigations,
          transfers: this.transfers,
          dischargePlans: this.dischargePlans,
          soundEnabled: this.soundEnabled,
        })
      );
    } catch {
      // ignore
    }
  }

  /**
   * Strictly local notify: Updates local storage and local tab React listeners ONLY.
   * Does NOT echo to BroadcastChannel or network, breaking cross-tab broadcast loops.
   */
  private notifyLocalSubscribersOnly() {
    this.saveToStorage();
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Subscriber notification error:', err);
      }
    });
  }

  /**
   * Cross-tab notify: Updates local storage, increments stateVersion, and posts to BroadcastChannel
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private notifyLocal(mutation?: { type: string; payload: any }) {
    this.stateVersion++;
    this.saveToStorage();
    this.lastSyncTimestamp = Date.now();

    try {
      this.channel?.postMessage({
        type: 'DATASTORE_SYNC',
        timestamp: this.lastSyncTimestamp,
        mutation,
        snapshot: this.getStateSnapshot(),
      });
    } catch {
      // ignore
    }

    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Subscriber notification error:', err);
      }
    });
  }

  /**
   * Full notify: Updates local storage, increments stateVersion, same-browser tabs, AND broadcasts cross-device mutation
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private notify(mutation?: { type: string; payload: any; mutationId?: string }) {
    this.stateVersion++;
    this.saveToStorage();
    this.lastSyncTimestamp = Date.now();

    let mutationId: string | undefined = undefined;
    if (mutation) {
      mutationId = mutation.mutationId || (
        mutation.type.toLowerCase().substring(0, 3) + '-' +
        (mutation.payload?.patientId || mutation.payload?.id || 'global') + '-' +
        Date.now() + '-' + Math.random().toString(36).substring(2, 6)
      );
      this.markMutationProcessed(mutationId);
    }

    // 1. Same-browser cross-tab broadcast
    try {
      this.channel?.postMessage({
        type: 'DATASTORE_SYNC',
        timestamp: this.lastSyncTimestamp,
        mutation: mutation ? { ...mutation, mutationId } : undefined,
        snapshot: this.getStateSnapshot(),
      });
    } catch {
      // ignore
    }

    // 2. Cross-device network broadcast (SSE + Server relay)
    if (mutation) {
      networkSyncService.broadcastMutation({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: mutation.type as any,
        payload: mutation.payload,
        mutationId,
        snapshot: this.getStateSnapshot(),
      });
    }

    // 3. Notify local React subscribers
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Subscriber notification error:', err);
      }
    });
  }

  /**
   * Applies an incoming mutation originating from another device or Supabase Realtime
   */
  public applyRemoteMutation(mutation: SyncMutation) {
    if (!mutation || !mutation.type) return;

    // Idempotency: Ignore already processed mutations
    const mutationId = mutation.mutationId || mutation.id;
    if (mutationId && this.isMutationProcessed(mutationId)) {
      if (import.meta.env?.DEV) {
        console.log(`[SSE DUPLICATE MUTATION IGNORED] mutationId: ${mutationId}`);
      }
      return;
    }
    if (mutationId) {
      this.markMutationProcessed(mutationId);
    }

    switch (mutation.type) {
      case 'ADD_PATIENT': {
        const patient = mutation.payload as Patient;
        if (patient && !this.patients.some((p) => p.id === patient.id)) {
          this.patients.push(patient);
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'UPDATE_PATIENT': {
        const { id, updates } = mutation.payload;
        const patient = this.patients.find((p) => p.id === id);
        if (patient) {
          Object.assign(patient, updates);
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'DISCHARGE_PATIENT': {
        const { patientId, id } = mutation.payload;
        const targetId = patientId || id;
        const patient = this.patients.find((p) => p.id === targetId);
        if (patient) {
          patient.dischargeDate = new Date().toISOString();
          if (patient.assignedAttenderId) {
            const att = this.attenders.find((a) => a.id === patient.assignedAttenderId);
            if (att) att.assignedPatientId = undefined;
          }
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'ASSIGN_DOCTOR': {
        const { patientId, doctorId } = mutation.payload;
        const patient = this.patients.find((p) => p.id === patientId);
        const doctor = this.doctors.find((d) => d.id === doctorId);
        if (patient && doctor) {
          patient.assignedDoctorId = doctorId;
          patient.assignedDoctorName = doctor.name;
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'PAIR_ATTENDER': {
        const { patientId, attender } = mutation.payload;
        const patient = this.patients.find((p) => p.id === patientId);
        if (patient && attender) {
          patient.assignedAttenderName = attender.name;
          patient.assignedAttenderPhone = attender.phone;
          patient.assignedAttenderRelation = attender.relation;
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'CREATE_REQUEST': {
        const req = mutation.payload as PatientRequest;
        if (req && !this.requests.some((r) => r.id === req.id)) {
          this.requests.unshift(req);
          this.addNotification({
            recipientRole: 'attender',
            patientId: req.patientId,
            title: `🔔 Patient ${req.patientName} requested ${req.requestType}`,
            message: `Room ${req.room} (${req.bed}): ${req.requestType} call received from smart glove.`,
            severity: req.requestType === 'EMERGENCY' ? 'critical' : 'warning',
            requestId: req.id,
          });
          if (this.soundEnabled) {
            this.playChime(req.requestType === 'EMERGENCY' ? 'critical' : 'warning');
          }
          this.addTimelineEvent(
            {
              patientId: req.patientId,
              title: `Hardware Gesture: ${req.requestType}`,
              description: `Patient triggered ${req.requestType} assistance call via glove sensors.`,
              category: 'PATIENT_REQUEST',
              actor: 'Patient Glove',
              severity: req.requestType === 'EMERGENCY' ? 'critical' : 'attention',
            },
            false
          );
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'ACKNOWLEDGE_REQUEST': {
        const { requestId, acknowledgedBy, acknowledgedAt } = mutation.payload;
        const req = this.requests.find((r) => r.id === requestId);
        if (req && req.status !== 'ACKNOWLEDGED') {
          req.status = 'ACKNOWLEDGED';
          req.acknowledgedBy = acknowledgedBy;
          req.acknowledgedAt = acknowledgedAt || new Date().toISOString();
          this.addTimelineEvent(
            {
              patientId: req.patientId,
              title: `Request Acknowledged (${req.requestType})`,
              description: `${acknowledgedBy} acknowledged ${req.requestType} call. Attending bedside.`,
              category: 'PATIENT_REQUEST',
              actor: acknowledgedBy,
              severity: 'normal',
            },
            false
          );
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'RESOLVE_REQUEST': {
        const { requestId, resolvedBy, resolvedAt } = mutation.payload;
        const req = this.requests.find((r) => r.id === requestId);
        if (req && req.status !== 'RESOLVED') {
          req.status = 'RESOLVED';
          req.resolvedBy = resolvedBy;
          req.resolvedAt = resolvedAt || new Date().toISOString();
          this.addTimelineEvent(
            {
              patientId: req.patientId,
              title: `Request Resolved (${req.requestType})`,
              description: `${resolvedBy} completed ${req.requestType} assistance call.`,
              category: 'PATIENT_REQUEST',
              actor: resolvedBy,
              severity: 'normal',
            },
            false
          );
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'ADD_MEDICATION': {
        const med = mutation.payload as Medication;
        if (med && !this.medications.some((m) => m.id === med.id)) {
          this.medications.unshift(med);
          this.addTimelineEvent(
            {
              patientId: med.patientId,
              title: `Medication Prescribed: ${med.name} ${med.dosage}`,
              description: `${med.dosage} (${med.route}) scheduled for ${med.scheduledTime}. ${med.instructions}. Prescribed by ${med.prescribedBy}.`,
              category: 'MEDICATION',
              actor: med.prescribedBy,
              severity: 'normal',
            },
            false
          );
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'UPDATE_MEDICATION': {
        const { id, status, administeredAt, administeredBy } = mutation.payload;
        const med = this.medications.find((m) => m.id === id);
        if (med) {
          med.status = status;
          if (administeredAt) med.administeredAt = administeredAt;
          if (administeredBy) med.administeredBy = administeredBy;
          med.updatedAt = new Date().toISOString();

          const isAttender =
            administeredBy?.toLowerCase().includes('attender') ||
            administeredBy?.toLowerCase().includes('caregiver') ||
            administeredBy?.toLowerCase().includes('vikash');

          this.addTimelineEvent(
            {
              patientId: med.patientId,
              title: `Medication ${status}: ${med.name}`,
              description: `${med.dosage} (${med.scheduledTime}) marked as ${status} by ${administeredBy || 'Caregiver'}.`,
              category: isAttender ? 'ATTENDER_ACTION' : 'MEDICATION',
              actor: administeredBy || 'Caregiver',
              severity: status === 'Missed' ? 'attention' : 'normal',
            },
            false
          );
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'RECORD_VITALS':
      case 'TELEMETRY_UPDATE': {
        const { patientId, vitals } = mutation.payload;
        if (patientId && vitals) {
          const patient = this.patients.find((p) => p.id === patientId);
          if (patient && !patient.dischargeDate) {
            const analyzed = analyzeVitalReading({
              ...vitals,
              timestamp: vitals.timestamp || new Date().toISOString(),
            });
            const updatedPatient: Patient = {
              ...patient,
              latestVitals: analyzed,
              status: analyzed.status,
              lastVitalUpdate: analyzed.timestamp,
              vitalsHistory: [...patient.vitalsHistory, analyzed].slice(-30),
            };
            this.patients = this.patients.map((p) => (p.id === patientId ? updatedPatient : p));

            if (import.meta.env?.DEV) {
              console.log(`[TELEMETRY APPLIED] eventId=${mutation.sequenceId || mutation.id || 'remote'} patientId=${patientId} timestamp=${analyzed.timestamp}`);
            }

            telemetryDiagnosticService.recordPacketApplied(analyzed, mutation.sequenceId, patientId);

            this.vitalListeners.forEach((cb) => {
              try {
                cb(patientId, analyzed);
              } catch (err) {
                console.error('Vital listener error:', err);
              }
            });

            const { newAlerts, updatedAlerts, resolvedAlerts } = checkForAlerts(updatedPatient, analyzed, this.alerts);
            if (resolvedAlerts && resolvedAlerts.length > 0) {
              resolvedAlerts.forEach((alert) => {
                this.addTimelineEvent(
                  {
                    patientId: patient.id,
                    title: `Vital Normalized (${alert.vitalType})`,
                    description: `Patient ${patient.name}'s ${alert.vitalType} returned to physiological target range. Active alert resolved.`,
                    category: 'ALERT_RESOLVED',
                    actor: 'Vital Telemetry Engine',
                    severity: 'normal',
                  },
                  false
                );
              });
            }

            if (newAlerts.length > 0) {
              this.alerts = [...newAlerts, ...this.alerts];
              if (this.soundEnabled) {
                if (!newAlerts.some((alert) => alert.severity === 'critical')) this.playChime('warning');
              }
              newAlerts.forEach((alert) => {
                this.addNotification({
                  recipientRole: 'doctor',
                  patientId: patient.id,
                  title: `🔴 Critical Patient Alert: ${patient.name}`,
                  message: alert.message,
                  severity: alert.severity === 'critical' ? 'critical' : 'warning',
                  alertId: alert.id,
                });
                this.addNotification({
                  recipientRole: 'attender',
                  patientId: patient.id,
                  title: alert.severity === 'critical' ? '🔴 Urgent Medical Alert' : '⚠️ Caregiver Notice',
                  message: alert.familyMessage,
                  severity: alert.severity === 'critical' ? 'critical' : 'warning',
                  alertId: alert.id,
                });
                this.addTimelineEvent(
                  {
                    patientId: patient.id,
                    title: `Vital Alert Triggered (${alert.vitalType})`,
                    description: alert.trigger,
                    category: 'ALERT',
                    actor: 'Vital Alert Engine',
                    severity: alert.severity === 'critical' ? 'critical' : 'attention',
                  },
                  false
                );
              });
            }

            if (updatedAlerts && updatedAlerts.length > 0) {
              updatedAlerts.forEach((alert) => {
                const docNotif = this.notifications.find(
                  (n) => n.recipientRole === 'doctor' && n.alertId === alert.id
                );
                if (docNotif) {
                  docNotif.message = `${alert.message} (Updated ${alert.occurrenceCount} times)`;
                  docNotif.timestamp = alert.lastUpdatedAt;
                }
                const attNotif = this.notifications.find(
                  (n) => n.recipientRole === 'attender' && n.alertId === alert.id
                );
                if (attNotif) {
                  attNotif.message = `${alert.familyMessage} (Updated ${alert.occurrenceCount} times)`;
                  attNotif.timestamp = alert.lastUpdatedAt;
                }
              });
            }
            this.notifyLocalSubscribersOnly();
          }
        }
        break;
      }

      case 'ADD_REPORT': {
        const rep = mutation.payload as MedicalReport;
        if (rep && !this.reports.some((r) => r.id === rep.id)) {
          this.reports.unshift(rep);
          this.addTimelineEvent(
            {
              patientId: rep.patientId,
              title: `Diagnostic Report Uploaded: ${rep.title}`,
              description: `${rep.reportType} report reviewed by ${rep.uploadedBy}. Summary: ${rep.summary}`,
              category: 'REPORT',
              actor: rep.uploadedBy,
              severity: 'normal',
            },
            false
          );
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'ADD_NOTE': {
        const note = mutation.payload as DoctorNote;
        if (note && !this.notes.some((n) => n.id === note.id)) {
          this.notes.unshift(note);
          this.addTimelineEvent(
            {
              patientId: note.patientId,
              title: `Clinical Note (${note.category})`,
              description: `${note.doctorName}: ${note.content.substring(0, 100)}...`,
              category: 'DOCTOR_NOTE',
              actor: note.doctorName,
              severity: 'normal',
            },
            false
          );
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'CREATE_CALL_REQUEST': {
        const call = mutation.payload as CallRequest;
        if (call && !this.callRequests.some((c) => c.id === call.id)) {
          this.callRequests.unshift(call);
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'UPDATE_CALL_REQUEST': {
        const updated = mutation.payload as CallRequest;
        if (updated) {
          const idx = this.callRequests.findIndex((c) => c.id === updated.id);
          if (idx >= 0) {
            this.callRequests[idx] = updated;
          } else {
            this.callRequests.unshift(updated);
          }
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'UPDATE_CALL_STAFF': {
        const updated = mutation.payload as CallServiceStaff;
        if (updated) {
          const staff = this.callStaff.find((s) => s.id === updated.id);
          if (staff) {
            Object.assign(staff, updated);
          } else {
            this.callStaff.push(updated);
          }
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'ADD_AUDIT_LOG': {
        const log = mutation.payload as AuditLogEntry;
        if (log && !this.auditLogs.some((l) => l.id === log.id)) {
          this.auditLogs.unshift(log);
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'ACKNOWLEDGE_ALERT': {
        const { alertId, acknowledgedBy, acknowledgedAt } = mutation.payload;
        const alert = this.alerts.find((a) => a.id === alertId);
        if (alert) {
          alert.status = 'acknowledged';
          alert.acknowledgedAt = acknowledgedAt || new Date().toISOString();
          alert.acknowledgedBy = acknowledgedBy;
          this.notifications.forEach((n) => {
            if (n.alertId === alert.id) {
              n.status = 'acknowledged';
              n.acknowledgedAt = alert.acknowledgedAt;
              n.acknowledgedBy = alert.acknowledgedBy;
            }
          });
          if (!shouldRepeatCriticalAlertSound(this.alerts, this.clinicalAlertSoundEnabled)) {
            this.stopCriticalAlertAlarm();
          }
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'ESCALATE_ALERT': {
        const { alertId, requestedBy, reason, callRequestId } = mutation.payload;
        const alert = this.alerts.find((a) => a.id === alertId);
        if (alert) {
          alert.escalationStatus = 'ESCALATED';
          alert.escalatedAt = alert.escalatedAt || new Date().toISOString();
          alert.escalatedBy = requestedBy;
          alert.escalationReason = reason;
          if (callRequestId) alert.callRequestId = callRequestId;
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'RESOLVE_ALERT': {
        const { alertId, resolvedBy, notes, resolvedAt } = mutation.payload;
        const alert = this.alerts.find((a) => a.id === alertId);
        if (alert) {
          alert.status = 'resolved';
          alert.resolvedAt = resolvedAt || new Date().toISOString();
          alert.resolvedBy = resolvedBy;
          if (notes) alert.notes = notes;
          if (alert.callRequestId) {
            const call = this.callRequests.find((c) => c.id === alert.callRequestId);
            if (call && call.status !== 'RESOLVED' && call.status !== 'CANCELLED') {
              call.status = 'RESOLVED';
              call.resolvedAt = alert.resolvedAt;
            }
          }
          this.notifyLocalSubscribersOnly();
        }
        break;
      }

      case 'FULL_SYNC': {
        if (mutation.payload) {
          this.applyFullSnapshot(mutation.payload);
        }
        break;
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleSupabaseChange(table: string, eventType: string, data: any) {
    if (!data) return;
    if (table === 'patient_requests') {
      const existing = this.requests.find((r) => r.id === data.id);
      if (!existing && eventType === 'INSERT') {
        this.applyRemoteMutation({
          id: 'sb_' + Date.now(),
          type: 'CREATE_REQUEST',
          payload: {
            id: data.id,
            patientId: data.patient_id,
            patientName: data.patient_name || 'Inpatient',
            room: data.room || 'ICU-204',
            bed: data.bed || 'Bed A',
            requestType: data.request_type,
            status: data.status,
            timestamp: data.timestamp || new Date().toISOString(),
            notes: data.notes,
          },
          timestamp: new Date().toISOString(),
          originId: 'supabase',
        });
      } else if (existing && eventType === 'UPDATE') {
        if (data.status === 'ACKNOWLEDGED') {
          this.applyRemoteMutation({
            id: 'sb_' + Date.now(),
            type: 'ACKNOWLEDGE_REQUEST',
            payload: { requestId: data.id, acknowledgedBy: data.acknowledged_by, acknowledgedAt: data.acknowledged_at },
            timestamp: new Date().toISOString(),
            originId: 'supabase',
          });
        } else if (data.status === 'RESOLVED') {
          this.applyRemoteMutation({
            id: 'sb_' + Date.now(),
            type: 'RESOLVE_REQUEST',
            payload: { requestId: data.id, resolvedBy: data.resolved_by, resolvedAt: data.resolved_at },
            timestamp: new Date().toISOString(),
            originId: 'supabase',
          });
        }
      }
    } else if (table === 'medications') {
      const existing = this.medications.find((m) => m.id === data.id);
      if (!existing && eventType === 'INSERT') {
        this.applyRemoteMutation({
          id: 'sb_' + Date.now(),
          type: 'ADD_MEDICATION',
          payload: {
            id: data.id,
            patientId: data.patient_id,
            name: data.name,
            dosage: data.dosage,
            route: data.route,
            frequency: data.frequency,
            scheduledTime: data.scheduled_time,
            instructions: data.instructions,
            startDate: data.start_date,
            status: data.status,
            prescribedBy: data.prescribed_by,
          },
          timestamp: new Date().toISOString(),
          originId: 'supabase',
        });
      } else if (existing && eventType === 'UPDATE') {
        this.applyRemoteMutation({
          id: 'sb_' + Date.now(),
          type: 'UPDATE_MEDICATION',
          payload: {
            id: data.id,
            status: data.status,
            administeredAt: data.administered_at,
            administeredBy: data.administered_by,
          },
          timestamp: new Date().toISOString(),
          originId: 'supabase',
        });
      }
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public subscribePatientState(
    patientId: string,
    callback: (patient: Patient | undefined, alerts: VitalAlert[], requests: PatientRequest[]) => void
  ): () => void {
    const handler = () => {
      const patient = this.getPatientById(patientId);
      const alerts = this.getAlerts(patientId);
      const requests = this.getRequests(patientId);
      callback(patient, alerts, requests);
    };
    handler();
    return this.subscribe(handler);
  }

  public resetToDefaults() {
    this.patients = JSON.parse(JSON.stringify(INITIAL_PATIENTS));
    this.doctors = JSON.parse(JSON.stringify(INITIAL_DOCTORS));
    this.attenders = JSON.parse(JSON.stringify(INITIAL_ATTENDERS));
    this.requests = JSON.parse(JSON.stringify(INITIAL_REQUESTS));
    this.alerts = JSON.parse(JSON.stringify(INITIAL_ALERTS));
    this.medications = JSON.parse(JSON.stringify(INITIAL_MEDICATIONS));
    this.reports = JSON.parse(JSON.stringify(INITIAL_REPORTS));
    this.notes = JSON.parse(JSON.stringify(INITIAL_NOTES));
    this.timeline = JSON.parse(JSON.stringify(INITIAL_TIMELINE));
    this.notifications = JSON.parse(JSON.stringify(INITIAL_NOTIFICATIONS));
    this.callRequests = JSON.parse(JSON.stringify(INITIAL_CALL_REQUESTS));
    this.callStaff = JSON.parse(JSON.stringify(INITIAL_CALL_STAFF));
    this.auditLogs = JSON.parse(JSON.stringify(INITIAL_AUDIT_LOGS));
    this.careTeamMembers = JSON.parse(JSON.stringify(INITIAL_CARE_TEAMS));
    this.encounters = JSON.parse(JSON.stringify(INITIAL_ENCOUNTERS));
    this.admissions = JSON.parse(JSON.stringify(INITIAL_ADMISSIONS));
    this.procedures = JSON.parse(JSON.stringify(INITIAL_PROCEDURES));
    this.medicationOrders = JSON.parse(JSON.stringify(INITIAL_MEDICATION_ORDERS));
    this.medicationAdministrations = JSON.parse(JSON.stringify(INITIAL_MED_ADMINISTRATIONS));
    this.investigations = JSON.parse(JSON.stringify(INITIAL_INVESTIGATIONS));
    this.transfers = JSON.parse(JSON.stringify(INITIAL_TRANSFERS));
    this.dischargePlans = JSON.parse(JSON.stringify(INITIAL_DISCHARGE_PLANS));
    this.stopCriticalAlertAlarm();
    this.soundEnabled = true;
    this.setClinicalAlertSoundEnabled(true);
    this.notify({ type: 'FULL_SYNC', payload: this.getStateSnapshot() });
  }

  // --- Sound Setting ---
  public getSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    audioAlertService.setEnabled(enabled);
    this.notify();
  }

  private loadClinicalAlertSoundPreference() {
    if (typeof window === 'undefined') return;
    try {
      this.clinicalAlertSoundEnabled = window.localStorage.getItem('healthconnect_clinical_alert_sound') !== 'false';
    } catch {
      this.clinicalAlertSoundEnabled = true;
    }
  }

  public getClinicalAlertSoundEnabled(): boolean {
    return this.clinicalAlertSoundEnabled;
  }

  public setClinicalAlertSoundEnabled(enabled: boolean) {
    this.clinicalAlertSoundEnabled = enabled;
    audioAlertService.setEnabled(enabled);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('healthconnect_clinical_alert_sound', String(enabled));
      } catch {
        // Browser storage can be unavailable in private or sandboxed contexts.
      }
    }
    if (!enabled) this.stopCriticalAlertAlarm();
    this.notify();
  }

  public startCriticalAlertAlarm() {
    if (typeof window === 'undefined' || !shouldRepeatCriticalAlertSound(this.alerts, this.clinicalAlertSoundEnabled)) {
      this.stopCriticalAlertAlarm();
      return;
    }
    if (this.criticalAlertTimer !== null) return;

    const playWhileUnacknowledged = () => {
      if (!shouldRepeatCriticalAlertSound(this.alerts, this.clinicalAlertSoundEnabled)) {
        this.stopCriticalAlertAlarm();
        return;
      }
      this.playClinicalAlertChime();
    };

    playWhileUnacknowledged();
    this.criticalAlertTimer = window.setInterval(playWhileUnacknowledged, 4000);
  }

  public stopCriticalAlertAlarm() {
    if (this.criticalAlertTimer === null || typeof window === 'undefined') return;
    window.clearInterval(this.criticalAlertTimer);
    this.criticalAlertTimer = null;
  }

  // --- Patients ---
  public getPatients(): Patient[] {
    return [...this.patients];
  }

  public getPatientById(id: string): Patient | undefined {
    const patient = this.patients.find((p) => p.id === id);
    if (!patient) return undefined;
    const careTeam = this.getPatientCareTeam(id);
    return {
      ...patient,
      careTeam,
    };
  }

  public getPatientsByDoctor(doctorId: string): Patient[] {
    return this.patients.filter((p) => {
      if (p.dischargeDate) return false;
      if (p.assignedDoctorId === doctorId) return true;
      const careTeam = this.careTeamMembers.filter((m) => m.patientId === p.id && m.status === 'active');
      return careTeam.some((m) => m.userId === doctorId);
    });
  }

  public getDischargedPatients(): Patient[] {
    return this.patients.filter((p) => !!p.dischargeDate);
  }

  public getHistoricalPatientRecord(id: string): Patient | undefined {
    return this.getPatientById(id);
  }

  // ==========================================
  // CARE TEAM MANAGEMENT
  // ==========================================
  public getPatientCareTeam(patientId: string): PatientCareTeamMember[] {
    const list = this.careTeamMembers.filter((m) => m.patientId === patientId);
    if (list.length > 0) return list;

    // Fallback: If no explicit care team entries exist, build structured team from patient record
    const patient = this.patients.find((p) => p.id === patientId);
    if (!patient) return [];

    const defaultTeam: PatientCareTeamMember[] = [];
    if (patient.assignedDoctorName) {
      defaultTeam.push({
        id: `ct-${patient.id}-doc`,
        patientId: patient.id,
        userId: patient.assignedDoctorId || 'doc-default',
        name: patient.assignedDoctorName,
        role: 'ATTENDING_PHYSICIAN',
        specialty: patient.assignedDoctorSpecialty || 'General Medicine',
        department: patient.department || 'Inpatient',
        status: 'active',
        assignedAt: patient.admissionDate || new Date().toISOString(),
        isPrimary: true,
        notes: 'Primary admitting physician.',
      });
    }

    defaultTeam.push({
      id: `ct-${patient.id}-nurse`,
      patientId: patient.id,
      userId: 'staff-duty-nurse',
      name: 'Duty Nursing Team',
      role: 'NURSE',
      department: patient.department || 'Ward Care',
      status: 'active',
      assignedAt: patient.admissionDate || new Date().toISOString(),
      isPrimary: false,
      notes: 'Floor bedside nursing care & vital monitoring.',
    });

    return defaultTeam;
  }

  public assignCareTeamMember(member: Omit<PatientCareTeamMember, 'id' | 'assignedAt'>): PatientCareTeamMember {
    const newMember: PatientCareTeamMember = {
      ...member,
      id: 'ct-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      assignedAt: new Date().toISOString(),
    };
    this.careTeamMembers.push(newMember);
    this.addTimelineEvent({
      patientId: member.patientId,
      title: `Care Team Assigned: ${member.name} (${member.role.replace(/_/g, ' ')})`,
      description: `${member.name} assigned as ${member.role.replace(/_/g, ' ')}${member.specialty ? ' - ' + member.specialty : ''}.`,
      category: 'ASSIGNMENT',
      actor: 'Admissions / Charge Staff',
      severity: 'normal',
    });
    this.logAudit(
      'Staff Coordinator',
      'staff',
      'CARE_TEAM_ASSIGNED',
      `${member.name} -> Patient ${member.patientId}`,
      `Assigned role ${member.role} to patient care team.`,
      'SUCCESS'
    );
    this.notify();
    return newMember;
  }

  public removeCareTeamMember(id: string): boolean {
    const idx = this.careTeamMembers.findIndex((m) => m.id === id);
    if (idx === -1) return false;
    const member = this.careTeamMembers[idx];
    member.status = 'completed';
    member.endedAt = new Date().toISOString();
    this.notify();
    return true;
  }

  public getPatientsForCareTeamMember(userId: string): Patient[] {
    const patientIds = new Set(
      this.careTeamMembers
        .filter((m) => m.userId === userId && m.status === 'active')
        .map((m) => m.patientId)
    );
    return this.patients.filter((p) => !p.dischargeDate && (patientIds.has(p.id) || p.assignedDoctorId === userId));
  }

  // ==========================================
  // ENCOUNTERS & ADMISSIONS
  // ==========================================
  public getEncounters(patientId?: string): Encounter[] {
    if (patientId) {
      return this.encounters.filter((e) => e.patientId === patientId);
    }
    return [...this.encounters];
  }

  public createEncounter(enc: Omit<Encounter, 'id'>): Encounter {
    const newEnc: Encounter = {
      ...enc,
      id: 'enc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    };
    this.encounters.push(newEnc);
    this.notify();
    return newEnc;
  }

  public getInpatientAdmissions(patientId?: string): InpatientAdmission[] {
    if (patientId) {
      return this.admissions.filter((a) => a.patientId === patientId);
    }
    return [...this.admissions];
  }

  public createInpatientAdmission(adm: Omit<InpatientAdmission, 'admissionId'>): InpatientAdmission {
    const newAdmission: InpatientAdmission = {
      ...adm,
      admissionId: 'adm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    };
    this.admissions.push(newAdmission);
    this.notify();
    return newAdmission;
  }

  // ==========================================
  // PROCEDURES / SURGERY
  // ==========================================
  public getProcedures(patientId?: string): Procedure[] {
    if (patientId) {
      return this.procedures.filter((pr) => pr.patientId === patientId);
    }
    return [...this.procedures];
  }

  public scheduleProcedure(proc: Omit<Procedure, 'id'>): Procedure {
    const newProc: Procedure = {
      ...proc,
      id: 'proc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    };
    this.procedures.push(newProc);
    this.addTimelineEvent({
      patientId: proc.patientId,
      title: `Procedure Scheduled: ${proc.procedureName}`,
      description: `${proc.procedureName} scheduled for ${new Date(proc.scheduledAt).toLocaleString()}. Surgeon: ${proc.surgeonName}, Anesthesiologist: ${proc.anesthesiologistName}. Operating Room: ${proc.operatingRoom}.`,
      category: 'DOCTOR_NOTE',
      actor: proc.surgeonName,
      severity: 'normal',
    });
    this.logAudit(
      proc.surgeonName,
      'doctor',
      'PROCEDURE_SCHEDULED',
      `${proc.procedureName} (${proc.patientId})`,
      `Scheduled in ${proc.operatingRoom} with ${proc.anesthesiologistName}.`,
      'SUCCESS'
    );
    this.notify();
    return newProc;
  }

  public updateProcedureStatus(id: string, status: ProcedureStatus, notes?: string): boolean {
    const proc = this.procedures.find((p) => p.id === id);
    if (!proc) return false;
    proc.status = status;
    if (notes) proc.notes = (proc.notes ? proc.notes + ' • ' : '') + notes;
    if (status === 'COMPLETED') {
      proc.completedAt = new Date().toISOString();
    }
    this.addTimelineEvent({
      patientId: proc.patientId,
      title: `Procedure Status: ${proc.procedureName} -> ${status}`,
      description: `Procedure status updated to ${status}.${notes ? ' Notes: ' + notes : ''}`,
      category: 'DOCTOR_NOTE',
      actor: proc.surgeonName,
      severity: status === 'COMPLETED' ? 'normal' : 'attention',
    });
    this.logAudit(
      proc.surgeonName,
      'doctor',
      'PROCEDURE_STATUS_UPDATED',
      `${proc.procedureName} (${proc.id})`,
      `Status transitioned to ${status}.`,
      'SUCCESS'
    );
    this.notify();
    return true;
  }

  // ==========================================
  // MEDICATION ORDER & ADMINISTRATION LIFECYCLE
  // ==========================================
  public getMedicationOrders(patientId: string, category?: MedicationCategory): MedicationOrder[] {
    return this.medicationOrders.filter((o) => {
      if (o.patientId !== patientId) return false;
      if (category && o.category !== category) return false;
      return true;
    });
  }

  public orderMedication(order: Omit<MedicationOrder, 'id' | 'prescribedAt'>): MedicationOrder {
    const newOrder: MedicationOrder = {
      ...order,
      id: 'ord-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      prescribedAt: new Date().toISOString(),
    };
    this.medicationOrders.push(newOrder);
    this.addTimelineEvent({
      patientId: order.patientId,
      title: `Medication Ordered: ${order.name} [${order.category}]`,
      description: `${order.name} ${order.dosage} (${order.route}) prescribed by ${order.prescribedBy}. Frequency: ${order.frequency}.`,
      category: 'MEDICATION',
      actor: order.prescribedBy,
      severity: 'normal',
    });
    this.logAudit(
      order.prescribedBy,
      'doctor',
      'MEDICATION_ORDERED',
      `${order.name} (${order.patientId})`,
      `Category: ${order.category}, Dosage: ${order.dosage}`,
      'SUCCESS'
    );
    this.notify();
    return newOrder;
  }

  public discontinueMedication(orderId: string): boolean {
    const ord = this.medicationOrders.find((o) => o.id === orderId);
    if (!ord) return false;
    ord.status = 'DISCONTINUED';
    ord.discontinuedAt = new Date().toISOString();
    this.addTimelineEvent({
      patientId: ord.patientId,
      title: `Medication Discontinued: ${ord.name}`,
      description: `${ord.name} discontinued by physician.`,
      category: 'MEDICATION',
      actor: ord.prescribedBy,
      severity: 'normal',
    });
    this.notify();
    return true;
  }

  public getMedicationAdministrations(patientId: string): MedicationAdministrationRecord[] {
    return this.medicationAdministrations.filter((a) => a.patientId === patientId);
  }

  public recordMedicationAdministration(admin: Omit<MedicationAdministrationRecord, 'id'>): MedicationAdministrationRecord {
    const newAdmin: MedicationAdministrationRecord = {
      ...admin,
      id: 'mar-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      administeredAt: admin.administeredAt || new Date().toISOString(),
    };
    this.medicationAdministrations.push(newAdmin);
    this.addTimelineEvent({
      patientId: admin.patientId,
      title: `Medication Dose ${admin.status}: ${admin.medicationName}`,
      description: `${admin.dosage} ${admin.medicationName} via ${admin.route} marked ${admin.status} by ${admin.administeredBy || 'Nurse'}.${admin.notes ? ' Notes: ' + admin.notes : ''}`,
      category: 'MEDICATION',
      actor: admin.administeredBy || 'Nurse',
      severity: admin.status === 'ADMINISTERED' ? 'normal' : 'attention',
    });
    this.logAudit(
      admin.administeredBy || 'Duty Nurse',
      'nurse',
      'MEDICATION_ADMINISTERED',
      `${admin.medicationName} (${admin.patientId})`,
      `Status: ${admin.status}, Dose: ${admin.dosage}`,
      'SUCCESS'
    );
    this.notify();
    return newAdmin;
  }

  // ==========================================
  // INVESTIGATION / LAB WORKFLOW
  // ==========================================
  public getInvestigations(patientId: string): Investigation[] {
    return this.investigations.filter((i) => i.patientId === patientId);
  }

  public orderInvestigation(inv: Omit<Investigation, 'id' | 'orderedAt' | 'status'>): Investigation {
    const newInv: Investigation = {
      ...inv,
      id: 'inv-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      orderedAt: new Date().toISOString(),
      status: 'ORDERED',
    };
    this.investigations.push(newInv);
    this.addTimelineEvent({
      patientId: inv.patientId,
      title: `Investigation Ordered: ${inv.name} [${inv.type}]`,
      description: `${inv.name} ordered by ${inv.orderedBy}.`,
      category: 'REPORT',
      actor: inv.orderedBy,
      severity: 'normal',
    });
    this.notify();
    return newInv;
  }

  public recordInvestigationResult(id: string, result: string, reviewedBy?: string): boolean {
    const inv = this.investigations.find((i) => i.id === id);
    if (!inv) return false;
    inv.result = result;
    inv.status = 'RESULTED';
    inv.resultedAt = new Date().toISOString();
    if (reviewedBy) {
      inv.reviewedBy = reviewedBy;
      inv.reviewedAt = new Date().toISOString();
      inv.status = 'REVIEWED';
    }
    this.addTimelineEvent({
      patientId: inv.patientId,
      title: `Lab Result: ${inv.name} -> ${result}`,
      description: `Result recorded: ${result}.${reviewedBy ? ' Reviewed by ' + reviewedBy : ''}`,
      category: 'REPORT',
      actor: reviewedBy || 'Clinical Laboratory',
      severity: 'normal',
    });
    this.notify();
    return true;
  }

  // ==========================================
  // PATIENT TRANSFER WORKFLOW
  // ==========================================
  public transferPatient(
    patientId: string,
    toLocation: HospitalLocation,
    initiatedBy: string,
    reason: string
  ): PatientTransfer {
    const patient = this.patients.find((p) => p.id === patientId);
    if (!patient) throw new Error('Patient not found for transfer');

    const fromLocation: HospitalLocation = patient.currentLocation || {
      id: 'loc-default',
      building: 'Main Hospital Building',
      floor: 1,
      department: patient.department,
      ward: 'General Ward',
      room: patient.room,
      bed: patient.bed,
    };

    const transfer: PatientTransfer = {
      id: 'trans-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      patientId,
      encounterId: patient.activeEncounterId,
      fromLocation,
      toLocation,
      initiatedBy,
      reason,
      timestamp: new Date().toISOString(),
      status: 'COMPLETED',
    };

    // Update patient current structural location and room/bed
    patient.currentLocation = toLocation;
    patient.room = toLocation.room;
    patient.bed = toLocation.bed;
    patient.department = toLocation.department;

    this.transfers.push(transfer);

    this.addTimelineEvent({
      patientId,
      title: `Patient Transferred: ${fromLocation.room} -> ${toLocation.room}`,
      description: `Transferred to ${toLocation.ward} (Room ${toLocation.room}, ${toLocation.bed}). Reason: ${reason}. Initiated by: ${initiatedBy}.`,
      category: 'TRANSFER',
      actor: initiatedBy,
      severity: 'normal',
    });

    this.logAudit(
      initiatedBy,
      'staff',
      'PATIENT_TRANSFERRED',
      `${patient.name} (${patientId})`,
      `From ${fromLocation.room} to ${toLocation.room}. Reason: ${reason}`,
      'SUCCESS'
    );

    this.notify();
    return transfer;
  }

  public getPatientTransfers(patientId: string): PatientTransfer[] {
    return this.transfers.filter((t) => t.patientId === patientId);
  }

  // ==========================================
  // DISCHARGE PLANNING & WORKFLOW
  // ==========================================
  public getDischargePlan(patientId: string): DischargePlan | undefined {
    return this.dischargePlans.find((dp) => dp.patientId === patientId);
  }

  public initiateDischargePlan(patientId: string, plannedDate: string, instructions?: string[]): DischargePlan {
    let plan = this.dischargePlans.find((dp) => dp.patientId === patientId);
    if (plan) {
      plan.plannedDate = plannedDate;
      if (instructions) plan.dischargeInstructions = instructions;
    } else {
      plan = {
        id: 'dc-plan-' + Date.now(),
        patientId,
        plannedDate,
        status: 'PLANNING',
        medicationsReconciled: false,
        pendingResultsReviewed: false,
        nursingDischargeCompleted: false,
        dischargeInstructions: instructions || [],
      };
      this.dischargePlans.push(plan);
    }
    this.addTimelineEvent({
      patientId,
      title: 'Discharge Planning Initiated',
      description: `Target discharge date planned for ${new Date(plannedDate).toLocaleDateString()}. Multidisciplinary review initiated.`,
      category: 'DOCTOR_NOTE',
      actor: 'Attending Clinician',
      severity: 'normal',
    });
    this.notify();
    return plan;
  }

  public updateDischargePlan(id: string, updates: Partial<DischargePlan>): boolean {
    const plan = this.dischargePlans.find((dp) => dp.id === id);
    if (!plan) return false;
    Object.assign(plan, updates);
    this.notify();
    return true;
  }

  public completeDischargeWorkflow(patientId: string, summary: string): boolean {
    const patient = this.patients.find((p) => p.id === patientId);
    if (!patient) return false;

    // 1. Mark discharge plan completed if exists
    let plan = this.dischargePlans.find((dp) => dp.patientId === patientId);
    if (!plan) {
      plan = this.initiateDischargePlan(patientId, new Date().toISOString());
    }
    plan.status = 'COMPLETED';
    plan.medicationsReconciled = true;
    plan.pendingResultsReviewed = true;
    plan.nursingDischargeCompleted = true;
    plan.dischargeSummary = summary;
    plan.completedAt = new Date().toISOString();

    // 2. Mark active care team assignments completed
    this.careTeamMembers
      .filter((m) => m.patientId === patientId && m.status === 'active')
      .forEach((m) => {
        m.status = 'completed';
        m.endedAt = new Date().toISOString();
      });

    // 3. Mark active encounters discharged
    this.encounters
      .filter((e) => e.patientId === patientId && e.status === 'ACTIVE')
      .forEach((e) => {
        e.status = 'DISCHARGED';
        e.endDate = new Date().toISOString();
      });

    // 4. Execute base discharge logic (releases bed, revokes attenders, adds DISCHARGE timeline event)
    const success = this.dischargePatient(patientId);
    if (success) {
      patient.bed = 'Bed Released';
    }
    this.notify();
    return success;
  }

  public getPatientByAttender(attenderId: string): Patient | undefined {
    return this.patients.find(
      (p) =>
        !p.dischargeDate &&
        (p.assignedAttenderId === attenderId ||
          p.assignedAttenders?.some((a) => a.attenderId === attenderId && a.status === 'active'))
    );
  }

  public getPatientsByAttender(attenderId: string): Patient[] {
    return this.patients.filter(
      (p) =>
        !p.dischargeDate &&
        (p.assignedAttenderId === attenderId ||
          p.assignedAttenders?.some((a) => a.attenderId === attenderId && a.status === 'active'))
    );
  }

  public getAttenderLinks(patientId: string): PatientAttenderLink[] {
    const p = this.patients.find((pt) => pt.id === patientId);
    return p?.assignedAttenders || [];
  }

  public verifyAttenderPassword(
    userId: string,
    passwordAttempt: string
  ): { valid: boolean; attender?: Attender; error?: string } {
    const cleanId = userId.trim().toLowerCase();
    const attender = this.attenders.find(
      (a) =>
        a.id.toLowerCase() === cleanId ||
        a.userId?.toLowerCase() === cleanId ||
        a.email.toLowerCase() === cleanId ||
        a.phone === userId.trim()
    );

    if (!attender) {
      return { valid: false, error: 'Attender account not found.' };
    }

    if (attender.status === 'revoked') {
      return { valid: false, error: 'Access revoked. Associated patient has been discharged.' };
    }

    const expected = attender.passwordHash || attender.temporaryPassword;
    if (expected && expected !== passwordAttempt) {
      return { valid: false, error: 'Incorrect password.' };
    }

    return { valid: true, attender };
  }

  public changeAttenderPassword(attenderId: string, newPassword: string): boolean {
    const attender = this.attenders.find((a) => a.id === attenderId || a.userId === attenderId);
    if (!attender) return false;

    attender.passwordHash = newPassword;
    attender.temporaryPassword = undefined; // clear temporary password after first change
    attender.mustChangePassword = false;
    this.notify();
    return true;
  }

  public addPatientWithDynamicAttenders(
    patientData: Omit<Patient, 'id' | 'mrn' | 'latestVitals' | 'vitalsHistory' | 'lastVitalUpdate' | 'status'> & { initialVitals?: Partial<VitalReading> },
    attendersToProvision: AttenderProvisionInput[]
  ): { patient: Patient; createdAttenders: Attender[] } {
    const id = 'pat-' + Math.random().toString(36).substring(2, 8);
    const mrn = 'CC-2026-' + (100 + this.patients.length + 1);

    const baseSys = patientData.initialVitals?.systolicBP || 120;
    const baseDia = patientData.initialVitals?.diastolicBP || 80;
    const basePulse = patientData.initialVitals?.pulse || 74;
    const baseSpO2 = patientData.initialVitals?.spO2 || 98;
    const baseTemp = patientData.initialVitals?.temperature || 36.8;

    const analyzed = analyzeVitalReading({
      systolicBP: baseSys,
      diastolicBP: baseDia,
      pulse: basePulse,
      spO2: baseSpO2,
      temperature: baseTemp,
      timestamp: new Date().toISOString(),
    });

    const createdAttenders: Attender[] = [];
    const links: PatientAttenderLink[] = [];

    // Dynamically provision each attender account
    if (attendersToProvision && attendersToProvision.length > 0) {
      attendersToProvision.slice(0, 2).forEach((attInput, idx) => {
        const cleanUserId = attInput.userId.trim();
        let finalUserId = cleanUserId;
        if (this.attenders.some((a) => a.id.toLowerCase() === finalUserId.toLowerCase())) {
          finalUserId = `${cleanUserId}_${Math.random().toString(36).substring(2, 5)}`;
        }

        const newAttender: Attender = {
          id: finalUserId,
          userId: finalUserId,
          name: attInput.name.trim(),
          email: `${finalUserId}@careconnect.in`,
          phone: attInput.phone.trim(),
          relation: attInput.relation.trim(),
          assignedPatientId: id,
          isOnline: true,
          temporaryPassword: attInput.temporaryPassword,
          mustChangePassword: true,
          status: 'active',
          createdAt: new Date().toISOString(),
        };

        this.attenders.push(newAttender);
        createdAttenders.push(newAttender);

        const link: PatientAttenderLink = {
          id: `link_${id}_${idx + 1}_${Date.now()}`,
          patientId: id,
          attenderId: newAttender.id,
          attenderName: newAttender.name,
          relation: newAttender.relation,
          phone: newAttender.phone,
          status: 'active',
          createdAt: new Date().toISOString(),
        };
        links.push(link);
      });
    }

    const patient: Patient = {
      ...patientData,
      id,
      mrn,
      status: analyzed.status,
      latestVitals: analyzed,
      vitalsHistory: generateHistory(baseSys, baseDia, basePulse, baseSpO2, baseTemp, 10),
      lastVitalUpdate: new Date().toISOString(),
      assignedAttenders: links,
      assignedAttenderId: links[0]?.attenderId,
      assignedAttenderName: links[0]?.attenderName,
      assignedAttenderRelation: links[0]?.relation,
      assignedAttenderPhone: links[0]?.phone,
    };

    this.patients.unshift(patient);

    if (patient.assignedDoctorId) {
      const doc = this.doctors.find((d) => d.id === patient.assignedDoctorId);
      if (doc) doc.activePatientCount += 1;
    }

    const attDesc =
      links.length === 0
        ? 'No family attender linked.'
        : links.length === 1
        ? `1 family attender provisioned (${links[0].attenderName} - ${links[0].relation}).`
        : `2 family attenders provisioned (${links[0].attenderName} & ${links[1].attenderName}).`;

    this.addTimelineEvent({
      patientId: id,
      title: 'Inpatient Admitted',
      description: `${patient.name} admitted to ${patient.department} (${patient.room}, ${patient.bed}) for ${patient.primaryCondition}. ${attDesc}`,
      category: 'ADMISSION',
      actor: 'Admin Team',
      severity: 'normal',
    });

    this.notify({ type: 'ADD_PATIENT', payload: patient });
    supabaseSyncService.syncPatient(patient);
    return { patient, createdAttenders };
  }

  public addPatient(newPatient: Omit<Patient, 'id' | 'mrn' | 'latestVitals' | 'vitalsHistory' | 'lastVitalUpdate' | 'status'> & { initialVitals?: Partial<VitalReading> }): Patient {
    const id = 'pat-' + Math.random().toString(36).substring(2, 8);
    const mrn = 'CC-2026-' + (100 + this.patients.length + 1);

    const baseSys = newPatient.initialVitals?.systolicBP || 120;
    const baseDia = newPatient.initialVitals?.diastolicBP || 80;
    const basePulse = newPatient.initialVitals?.pulse || 74;
    const baseSpO2 = newPatient.initialVitals?.spO2 || 98;
    const baseTemp = newPatient.initialVitals?.temperature || 36.8;

    const analyzed = analyzeVitalReading({
      systolicBP: baseSys,
      diastolicBP: baseDia,
      pulse: basePulse,
      spO2: baseSpO2,
      temperature: baseTemp,
      timestamp: new Date().toISOString(),
    });

    const links: PatientAttenderLink[] = newPatient.assignedAttenders ? [...newPatient.assignedAttenders] : [];
    if (newPatient.assignedAttenderId && links.length === 0) {
      links.push({
        id: `link_${id}_1`,
        patientId: id,
        attenderId: newPatient.assignedAttenderId,
        attenderName: newPatient.assignedAttenderName || 'Family Attender',
        relation: newPatient.assignedAttenderRelation || 'Caregiver',
        phone: newPatient.assignedAttenderPhone || '',
        status: 'active',
        createdAt: new Date().toISOString(),
      });
    }

    const patient: Patient = {
      ...newPatient,
      id,
      mrn,
      status: analyzed.status,
      latestVitals: analyzed,
      vitalsHistory: generateHistory(baseSys, baseDia, basePulse, baseSpO2, baseTemp, 10),
      lastVitalUpdate: new Date().toISOString(),
      assignedAttenders: links,
    };

    this.patients.unshift(patient);

    if (patient.assignedDoctorId) {
      const doc = this.doctors.find((d) => d.id === patient.assignedDoctorId);
      if (doc) doc.activePatientCount += 1;
    }

    if (patient.assignedAttenderId) {
      const att = this.attenders.find((a) => a.id === patient.assignedAttenderId);
      if (att) att.assignedPatientId = patient.id;
    }

    this.addTimelineEvent({
      patientId: id,
      title: 'Inpatient Admitted',
      description: `${patient.name} admitted to ${patient.department} (${patient.room}, ${patient.bed}) for ${patient.primaryCondition}.`,
      category: 'ADMISSION',
      actor: 'Admin Team',
      severity: 'normal',
    });

    this.notify({ type: 'ADD_PATIENT', payload: patient });
    supabaseSyncService.syncPatient(patient);
    return patient;
  }

  public updatePatient(id: string, updates: Partial<Patient>): Patient | undefined {
    const idx = this.patients.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;

    this.patients[idx] = { ...this.patients[idx], ...updates };
    this.notify({ type: 'UPDATE_PATIENT', payload: { id, updates } });
    supabaseSyncService.syncPatient(this.patients[idx]);
    return this.patients[idx];
  }

  public dischargePatient(id: string): boolean {
    const patient = this.patients.find((p) => p.id === id);
    if (!patient) return false;

    patient.dischargeDate = new Date().toISOString();

    // Deactivate all associated attender assignments - family caregiver access archived
    if (patient.assignedAttenders && patient.assignedAttenders.length > 0) {
      patient.assignedAttenders.forEach((link) => {
        link.status = 'revoked';
        link.revokedAt = new Date().toISOString();
        const att = this.attenders.find((a) => a.id === link.attenderId || a.userId === link.attenderId);
        if (att) {
          att.status = 'revoked';
          att.revokedAt = new Date().toISOString();
          att.assignedPatientId = undefined;
        }
      });
    }

    if (patient.assignedAttenderId) {
      const att = this.attenders.find((a) => a.id === patient.assignedAttenderId);
      if (att) {
        att.status = 'revoked';
        att.revokedAt = new Date().toISOString();
        att.assignedPatientId = undefined;
      }
    }

    if (patient.assignedDoctorId) {
      const doc = this.doctors.find((d) => d.id === patient.assignedDoctorId);
      if (doc && doc.activePatientCount > 0) {
        doc.activePatientCount -= 1;
      }
    }

    this.addTimelineEvent({
      patientId: id,
      title: 'Patient Discharged',
      description: `${patient.name} discharged from ${patient.room}. Bedside monitoring terminated. All caregiver access archived/revoked.`,
      category: 'DISCHARGE',
      actor: 'Attending Clinician / Admin',
      severity: 'normal',
    });

    this.logAudit(
      'Attending Clinician / Admin',
      'admin',
      'PATIENT_DISCHARGED',
      `${patient.name} (${patient.mrn})`,
      `Discharged from ${patient.room} (${patient.bed}). Linked attender accounts revoked.`,
      'SUCCESS'
    );

    this.notify({ type: 'DISCHARGE_PATIENT', payload: { patientId: id } });
    supabaseSyncService.syncPatient(patient);
    return true;
  }

  // --- Assignments ---
  public assignDoctor(
    patientId: string,
    doctorId: string,
    reason?: string,
    actor?: string
  ): boolean {
    const patient = this.patients.find((p) => p.id === patientId);
    const doctor = this.doctors.find((d) => d.id === doctorId);
    if (!patient || !doctor) return false;

    const previousDoctorId = patient.assignedDoctorId;
    const previousDoctorName = patient.assignedDoctorName;
    const isReassignment = Boolean(previousDoctorId && previousDoctorId !== doctorId);

    if (previousDoctorId && previousDoctorId !== doctorId) {
      const oldDoc = this.doctors.find((d) => d.id === previousDoctorId);
      if (oldDoc && oldDoc.activePatientCount > 0) oldDoc.activePatientCount -= 1;
    }

    patient.assignedDoctorId = doctor.id;
    patient.assignedDoctorName = doctor.name;
    patient.assignedDoctorSpecialty = doctor.specialty;
    doctor.activePatientCount += 1;

    // Update Care Team Members roster
    if (this.careTeamMembers && Array.isArray(this.careTeamMembers)) {
      if (isReassignment && previousDoctorId) {
        // Mark previous attending physician as completed
        this.careTeamMembers.forEach((m) => {
          if (m.patientId === patientId && m.userId === previousDoctorId && m.role === 'ATTENDING_PHYSICIAN') {
            m.status = 'completed';
            m.endedAt = new Date().toISOString();
          }
        });
      }

      // Check if new doctor already in care team for this patient
      const existingMember = this.careTeamMembers.find(
        (m) => m.patientId === patientId && m.userId === doctor.id
      );
      if (existingMember) {
        existingMember.status = 'active';
        existingMember.role = 'ATTENDING_PHYSICIAN';
        existingMember.isPrimary = true;
      } else {
        this.careTeamMembers.push({
          id: `ct-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          patientId,
          userId: doctor.id,
          name: doctor.name,
          role: 'ATTENDING_PHYSICIAN',
          specialty: doctor.specialty,
          department: patient.department || 'Inpatient',
          status: 'active',
          assignedAt: new Date().toISOString(),
          isPrimary: true,
          phone: doctor.phone,
          notes: isReassignment ? `Reassigned: ${reason || 'Clinical handover'}` : 'Primary admitting physician.',
        });
      }
    }

    const effectiveActor = actor || 'Admin Desk';
    const timelineTitle = isReassignment ? 'Doctor Reassigned' : 'Doctor Assigned';
    const reasonText = reason ? ` Reason: ${reason}.` : '';
    const timelineDesc = isReassignment
      ? `Reassigned from ${previousDoctorName || 'Previous Doctor'} to ${doctor.name} (${doctor.specialty}).${reasonText}`
      : `${doctor.name} (${doctor.specialty}) assigned to patient care.${reasonText}`;

    this.addTimelineEvent({
      patientId,
      title: timelineTitle,
      description: timelineDesc,
      category: 'ASSIGNMENT',
      actor: effectiveActor,
      severity: 'normal',
    });

    if (isReassignment) {
      this.logAudit(
        effectiveActor,
        'admin',
        'DOCTOR_REASSIGNED',
        `${patient.name} (${patientId})`,
        `Reassigned from ${previousDoctorName} to ${doctor.name}.${reasonText}`,
        'SUCCESS'
      );
    }

    this.notify({ type: 'ASSIGN_DOCTOR', payload: { patientId, doctorId, reason } });
    supabaseSyncService.syncPatient(patient);
    return true;
  }

  public assignAttender(patientId: string, attenderId: string): boolean {
    const patient = this.patients.find((p) => p.id === patientId);
    const attender = this.attenders.find((a) => a.id === attenderId);
    if (!patient || !attender) return false;

    if (patient.assignedAttenderId && patient.assignedAttenderId !== attenderId) {
      const oldAtt = this.attenders.find((a) => a.id === patient.assignedAttenderId);
      if (oldAtt) oldAtt.assignedPatientId = undefined;
    }

    patient.assignedAttenderId = attender.id;
    patient.assignedAttenderName = attender.name;
    patient.assignedAttenderRelation = attender.relation;
    patient.assignedAttenderPhone = attender.phone;
    attender.assignedPatientId = patient.id;

    this.addTimelineEvent({
      patientId,
      title: 'Family Attender Paired',
      description: `${attender.name} (${attender.relation}) paired to bedside care channel.`,
      category: 'ASSIGNMENT',
      actor: 'Admin Desk',
      severity: 'normal',
    });

    this.notify({ type: 'PAIR_ATTENDER', payload: { patientId, attenderId } });
    supabaseSyncService.syncPatient(patient);
    return true;
  }

  // --- Doctors & Attenders ---
  public getDoctors(): Doctor[] {
    return [...this.doctors];
  }

  public addDoctor(doctor: Omit<Doctor, 'id' | 'activePatientCount'>): Doctor {
    const id = 'doc-' + Math.random().toString(36).substring(2, 8);
    const newDoc: Doctor = { ...doctor, id, activePatientCount: 0 };
    this.doctors.push(newDoc);
    this.notify();
    return newDoc;
  }

  public toggleDoctorOnline(id: string): boolean {
    const doc = this.doctors.find((d) => d.id === id);
    if (!doc) return false;
    doc.isOnline = !doc.isOnline;
    this.notify();
    return doc.isOnline;
  }

  public getAttenders(): Attender[] {
    return [...this.attenders];
  }

  public addAttender(attender: Omit<Attender, 'id'>): Attender {
    const id = 'att-' + Math.random().toString(36).substring(2, 8);
    const newAtt: Attender = { ...attender, id };
    this.attenders.push(newAtt);
    this.notify();
    return newAtt;
  }

  // --- Vitals & Alert Deduplication Engine Pipeline ---
  public recordVitals(
    patientId: string,
    vitals: Omit<VitalReading, 'status' | 'bpStatus' | 'pulseStatus' | 'spO2Status' | 'tempStatus' | 'timestamp'> & { timestamp?: string }
  ): VitalReading | undefined {
    const patient = this.patients.find((p) => p.id === patientId);
    if (!patient || patient.dischargeDate) return undefined;

    const analyzed = analyzeVitalReading({
      ...vitals,
      timestamp: vitals.timestamp || new Date().toISOString(),
    });

    // IMMUTABLE PATIENT TELEMETRY UPDATE
    const updatedPatient: Patient = {
      ...patient,
      latestVitals: analyzed,
      status: analyzed.status,
      lastVitalUpdate: analyzed.timestamp,
      vitalsHistory: [...patient.vitalsHistory, analyzed].slice(-30),
    };
    this.patients = this.patients.map((p) => (p.id === patientId ? updatedPatient : p));

    telemetryDiagnosticService.recordPacketApplied(analyzed, undefined, patientId);

    // Notify vital listeners
    this.vitalListeners.forEach((cb) => {
      try {
        cb(patientId, analyzed);
      } catch (err) {
        console.error('Vital listener error:', err);
      }
    });

    // Run vital alert engine with STRICT ACTIVE ALERT DEDUPLICATION
    const { newAlerts, updatedAlerts, resolvedAlerts } = checkForAlerts(updatedPatient, analyzed, this.alerts);

    if (resolvedAlerts && resolvedAlerts.length > 0) {
      resolvedAlerts.forEach((alert) => {
        this.addTimelineEvent({
          patientId: patient.id,
          title: `Vital Normalized (${alert.vitalType})`,
          description: `Patient ${patient.name}'s ${alert.vitalType} returned to physiological target range. Active alert resolved.`,
          category: 'ALERT_RESOLVED',
          actor: 'Vital Telemetry Engine',
          severity: 'normal',
        });
      });
    }

    if (newAlerts.length > 0) {
      // Prepend only truly new alerts (no duplicate spam)
      this.alerts = [...newAlerts, ...this.alerts];
      if (this.soundEnabled) {
        if (!newAlerts.some((alert) => alert.severity === 'critical')) this.playChime('warning');
      }

      newAlerts.forEach((alert) => {
        // Clinical Audio Alert Announcement
        audioAlertService.announceAlert(alert);
        // Notification for Doctor (clinical technical details)
        this.addNotification({
          recipientRole: 'doctor',
          patientId: patient.id,
          title: `🔴 Critical Patient Alert: ${patient.name}`,
          message: alert.message,
          severity: alert.severity === 'critical' ? 'critical' : 'warning',
          alertId: alert.id,
        });

        // Notification for Family Attender (calm, respectful family guidance)
        this.addNotification({
          recipientRole: 'attender',
          patientId: patient.id,
          title: alert.severity === 'critical' ? '🔴 Urgent Medical Alert' : '⚠️ Caregiver Notice',
          message: alert.familyMessage,
          severity: alert.severity === 'critical' ? 'critical' : 'warning',
          alertId: alert.id,
        });

        this.addTimelineEvent({
          patientId: patient.id,
          title: `Vital Alert Triggered (${alert.vitalType})`,
          description: alert.trigger,
          category: 'ALERT',
          actor: 'Vital Alert Engine',
          severity: alert.severity === 'critical' ? 'critical' : 'attention',
        });

        this.logAudit(
          'Clinical Monitoring Engine',
          'system',
          'CLINICAL_ALERT_GENERATED',
          `${patient.name} (${patient.room})`,
          `${alert.severity.toUpperCase()} ${alert.vitalType} alert generated: ${alert.trigger}`,
          alert.severity === 'critical' ? 'WARNING' : 'SUCCESS'
        );
      });
    }

    if (updatedAlerts && updatedAlerts.length > 0) {
      updatedAlerts.forEach((alert) => {
        const docNotif = this.notifications.find(
          (n) => n.recipientRole === 'doctor' && n.alertId === alert.id
        );
        if (docNotif) {
          docNotif.message = `${alert.message} (Updated ${alert.occurrenceCount} times)`;
          docNotif.timestamp = alert.lastUpdatedAt;
        }
        const attNotif = this.notifications.find(
          (n) => n.recipientRole === 'attender' && n.alertId === alert.id
        );
        if (attNotif) {
          attNotif.message = `${alert.familyMessage} (Updated ${alert.occurrenceCount} times)`;
          attNotif.timestamp = alert.lastUpdatedAt;
        }
        if (audioAlertService.shouldAnnounce(alert)) {
          audioAlertService.announceAlert(alert);
        }
      });
    }

    this.notify({ type: 'RECORD_VITALS', payload: { patientId, vitals: analyzed } });
    supabaseSyncService.syncVitalReading(patientId, analyzed);
    return analyzed;
  }

  // --- Patient Hardware Requests ---
  public createPatientRequest(patientId: string, requestType: RequestType, notes?: string): PatientRequest | undefined {
    const patient = this.patients.find((p) => p.id === patientId);
    if (!patient || patient.dischargeDate) return undefined;

    const req: PatientRequest = {
      id: 'req-' + Math.random().toString(36).substring(2, 9),
      patientId: patient.id,
      patientName: patient.name,
      room: patient.room,
      bed: patient.bed,
      requestType,
      status: 'NEW',
      timestamp: new Date().toISOString(),
      notes: notes || 'Originating from patient smart glove residual gesture.',
    };

    this.requests.unshift(req);

    // Primary Notification to Family Attender
    this.addNotification({
      recipientRole: 'attender',
      patientId: patient.id,
      title: `🔔 Patient ${patient.name} requested ${requestType}`,
      message: `Your family member in ${patient.room} (${patient.bed}) requested ${requestType}.`,
      severity: requestType === 'EMERGENCY' ? 'critical' : 'warning',
      requestId: req.id,
    });

    // If emergency, notify Doctor as well
    if (requestType === 'EMERGENCY') {
      this.addNotification({
        recipientRole: 'doctor',
        patientId: patient.id,
        title: `🚨 Emergency Bedside Call: ${patient.name}`,
        message: `Emergency gesture recognized in ${patient.room} (${patient.bed}).`,
        severity: 'critical',
        requestId: req.id,
      });
    }

    this.addTimelineEvent({
      patientId: patient.id,
      title: `Hardware Gesture: ${requestType}`,
      description: `Patient triggered ${requestType} assistance call via glove sensors.`,
      category: 'PATIENT_REQUEST',
      actor: 'Patient Glove',
      severity: requestType === 'EMERGENCY' ? 'critical' : 'attention',
    });

    // Play chime for attender if sound is enabled
    if (this.soundEnabled) {
      this.playChime(requestType === 'EMERGENCY' ? 'critical' : 'warning');
    }

    this.notify({ type: 'CREATE_REQUEST', payload: req });
    supabaseSyncService.syncRequest(req);
    return req;
  }

  public acknowledgeRequest(requestId: string, acknowledgedBy: string): boolean {
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) return false;

    req.status = 'ACKNOWLEDGED';
    req.acknowledgedAt = new Date().toISOString();
    req.acknowledgedBy = acknowledgedBy;

    this.addTimelineEvent({
      patientId: req.patientId,
      title: `Request Acknowledged (${req.requestType})`,
      description: `${acknowledgedBy} acknowledged ${req.requestType} call. Attending bedside.`,
      category: 'PATIENT_REQUEST',
      actor: acknowledgedBy,
      severity: 'normal',
    });

    this.notify({
      type: 'ACKNOWLEDGE_REQUEST',
      payload: { requestId, acknowledgedBy, acknowledgedAt: req.acknowledgedAt },
    });
    supabaseSyncService.syncRequest(req);
    return true;
  }

  public resolveRequest(requestId: string, resolvedBy: string): boolean {
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) return false;

    req.status = 'RESOLVED';
    req.resolvedAt = new Date().toISOString();
    req.resolvedBy = resolvedBy;

    this.addTimelineEvent({
      patientId: req.patientId,
      title: `Request Resolved (${req.requestType})`,
      description: `${resolvedBy} completed ${req.requestType} assistance call.`,
      category: 'PATIENT_REQUEST',
      actor: resolvedBy,
      severity: 'normal',
    });

    this.notify({
      type: 'RESOLVE_REQUEST',
      payload: { requestId, resolvedBy, resolvedAt: req.resolvedAt },
    });
    supabaseSyncService.syncRequest(req);
    return true;
  }

  public getRequests(patientId?: string): PatientRequest[] {
    if (patientId) {
      return this.requests.filter((r) => r.patientId === patientId);
    }
    return [...this.requests];
  }

  // --- Alerts ---
  public getAlerts(patientId?: string): VitalAlert[] {
    if (patientId) {
      return this.alerts.filter((a) => a.patientId === patientId);
    }
    return [...this.alerts];
  }

  public acknowledgeClinicalEpisode(
    episodeId: string,
    clinicianName: string,
    clinicianRole: UserRole | 'nurse' = 'doctor'
  ): boolean {
    const alert = this.alerts.find((a) => a.id === episodeId);
    if (!alert) return false;

    // Idempotent: If already acknowledged, responding, or resolved, return true immediately
    if (alert.status === 'acknowledged' || alert.status === 'responding' || alert.status === 'resolved') {
      return true;
    }

    if (clinicianRole !== 'doctor' && clinicianRole !== 'nurse') return false;

    const ackTime = new Date().toISOString();
    alert.status = 'acknowledged';
    alert.acknowledgedAt = alert.acknowledgedAt || ackTime;
    alert.acknowledgedBy = alert.acknowledgedBy || clinicianName;

    // Update in-place all linked notifications so Doctor and Attender see ACKNOWLEDGED
    this.notifications.forEach((n) => {
      if (n.alertId === alert.id) {
        n.status = 'acknowledged';
        n.acknowledgedAt = ackTime;
        n.acknowledgedBy = clinicianName;
      }
    });

    this.addTimelineEvent({
      patientId: alert.patientId,
      title: `Alert Acknowledged (${alert.vitalType})`,
      description: `${clinicianName} acknowledged clinical alert: ${alert.trigger}`,
      category: 'ALERT',
      actor: clinicianName,
      severity: 'normal',
    });

    this.logAudit(
      clinicianName,
      clinicianRole,
      'CLINICAL_ALERT_ACKNOWLEDGED',
      `${alert.patientName} (${alert.room})`,
      `${alert.vitalType} alert acknowledged: ${alert.trigger}`,
      'SUCCESS'
    );

    if (!shouldRepeatCriticalAlertSound(this.alerts, this.clinicalAlertSoundEnabled)) {
      this.stopCriticalAlertAlarm();
    }

    this.notify({
      type: 'ACKNOWLEDGE_ALERT',
      mutationId: 'ack-' + alert.id + '-' + Date.now(),
      payload: {
        alertId: alert.id,
        acknowledgedBy: clinicianName,
        actorRole: clinicianRole,
        acknowledgedAt: alert.acknowledgedAt,
      },
    });

    return true;
  }

  public acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
    actorRole: UserRole | 'nurse' = 'doctor'
  ): boolean {
    return this.acknowledgeClinicalEpisode(alertId, acknowledgedBy, actorRole);
  }

  public acknowledgeAllAlertsForPatient(
    patientId: string,
    doctorName: string,
    doctorRole: UserRole = 'doctor'
  ): number {
    const patientAlerts = this.alerts.filter(
      (a) => a.patientId === patientId && a.status === 'active'
    );
    patientAlerts.forEach((a) => {
      this.acknowledgeAlert(a.id, doctorName, doctorRole);
    });
    return patientAlerts.length;
  }

  public requestNurseForAlert(
    alertId: string,
    requestedBy: string,
    actorRole: UserRole = 'doctor'
  ): CallRequest | undefined {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return undefined;
    const patient = this.patients.find((p) => p.id === alert.patientId);
    if (!patient) return undefined;

    // DEDUPLICATION: If this alert or patient already has an active call request, return it rather than spamming
    if (alert.callRequestId) {
      const existingCall = this.callRequests.find(
        (c) => c.id === alert.callRequestId && (c.status === 'WAITING' || c.status === 'ASSIGNED' || c.status === 'RESPONDING')
      );
      if (existingCall) {
        return existingCall;
      }
    }
    const existingPatientCall = this.callRequests.find(
      (c) =>
        c.patientId === patient.id &&
        c.reason.includes(alert.vitalType) &&
        (c.status === 'WAITING' || c.status === 'ASSIGNED' || c.status === 'RESPONDING')
    );
    if (existingPatientCall) {
      alert.callRequestId = existingPatientCall.id;
      return existingPatientCall;
    }

    // 1. Create associated Nurse CallRequest with CRITICAL priority
    const callRequest = this.createCallRequest({
      patientId: patient.id,
      patientName: patient.name,
      roomNumber: patient.room,
      bedNumber: patient.bed,
      attenderId: patient.assignedAttenderId || 'att-vikash',
      attenderName: patient.assignedAttenderName || 'Vikash Kumar',
      attenderRelation: patient.assignedAttenderRelation || 'Family Caregiver',
      reason: `Clinical Alert: ${alert.vitalType} (${alert.currentValue || alert.valueRecorded}) — Doctor requested immediate bedside nurse response`,
      priority: 'CRITICAL',
    });

    alert.callRequestId = callRequest.id;

    // 2. Log Doctor Nurse Request Audit Event
    this.logAudit(
      requestedBy,
      actorRole,
      'NURSE_ASSISTANCE_REQUESTED',
      `${patient.name} (${patient.room})`,
      `Physician requested urgent bedside nurse assistance for ${alert.vitalType} alert: ${alert.trigger}`,
      'SUCCESS'
    );

    // 3. Resolve assigned Nurse (Nurse Priya preferred, or duty nurse)
    const nurseStaff = this.callStaff.find((s) => s.name === 'Nurse Priya' || s.role === 'Nurse') || this.callStaff[0];
    const nurseName = nurseStaff ? nurseStaff.name : 'Nurse Priya';
    const nurseId = nurseStaff ? nurseStaff.id : 'staff-priya';

    // 4. Update Call Request to RESPONDING
    callRequest.status = 'RESPONDING';
    callRequest.assignedAt = new Date().toISOString();
    callRequest.respondingAt = new Date().toISOString();
    callRequest.assignedStaffId = nurseId;
    callRequest.assignedStaffName = nurseName;
    callRequest.assignedStaffRole = 'Nurse';

    // 5. Update Alert status to RESPONDING
    alert.status = 'responding';
    alert.respondingBy = nurseName;
    alert.respondingAt = new Date().toISOString();

    this.addTimelineEvent({
      patientId: patient.id,
      title: `Nurse Responding (${nurseName})`,
      description: `${nurseName} accepted request and is responding to bedside in ${patient.room}.`,
      category: 'NURSE_CALL',
      actor: nurseName,
      severity: 'normal',
    });

    // 6. Audit Trail for Nurse acceptance and response
    this.logAudit(
      nurseName,
      'nurse',
      'NURSE_REQUEST_ACCEPTED',
      `${patient.name} (${patient.room})`,
      `${nurseName} accepted nurse request for ${alert.vitalType} alert`,
      'SUCCESS'
    );

    this.logAudit(
      nurseName,
      'nurse',
      'NURSE_RESPONDING',
      `${patient.name} (${patient.room})`,
      `${nurseName} en route to bedside in ${patient.room} (${patient.bed})`,
      'SUCCESS'
    );

    this.notify();
    return callRequest;
  }

  public markAlertResponding(
    alertId: string,
    respondingBy: string,
    callRequestId?: string
  ): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return false;

    alert.status = 'responding';
    alert.respondingBy = respondingBy;
    alert.respondingAt = new Date().toISOString();
    if (callRequestId) alert.callRequestId = callRequestId;

    this.logAudit(
      respondingBy,
      'nurse',
      'NURSE_RESPONDING',
      `${alert.patientName} (${alert.room})`,
      `${respondingBy} marked responding to ${alert.vitalType} alert`,
      'SUCCESS'
    );

    this.notify();
    return true;
  }

  public resolveAlert(
    alertId: string,
    resolvedBy: string,
    notes: string | undefined,
    actorRole: UserRole | 'nurse'
  ): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (
      !alert ||
      (alert.status !== 'acknowledged' && alert.status !== 'responding') ||
      (actorRole !== 'doctor' && actorRole !== 'nurse')
    ) return false;

    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();
    alert.resolvedBy = resolvedBy;
    if (notes) alert.notes = notes;

    // Calculate response time in seconds
    if (alert.timestamp) {
      const ms = new Date(alert.resolvedAt).getTime() - new Date(alert.timestamp).getTime();
      alert.responseTimeSeconds = Math.max(18, Math.round(ms / 1000));
    } else {
      alert.responseTimeSeconds = 38;
    }

    // Resolve associated callRequest if present
    if (alert.callRequestId) {
      const call = this.callRequests.find((c) => c.id === alert.callRequestId);
      if (call && call.status !== 'RESOLVED' && call.status !== 'CANCELLED') {
        call.status = 'RESOLVED';
        call.resolvedAt = alert.resolvedAt;
        call.notes = `Bedside care completed. ${notes || 'Vital parameters stabilized.'}`;
      }
    }

    // If patient's current vital was in critical status, normalize back to target
    const patient = this.patients.find((p) => p.id === alert.patientId);
    if (patient && alert.vitalType === 'SPO2' && patient.latestVitals.spO2 < 90) {
      this.recordVitals(patient.id, {
        systolicBP: 122,
        diastolicBP: 80,
        pulse: 74,
        spO2: 98,
        temperature: 36.8,
        respiratoryRate: 16,
        timestamp: new Date().toISOString(),
      });
    }

    this.addTimelineEvent({
      patientId: alert.patientId,
      title: `Alert Resolved (${alert.vitalType})`,
      description: `${resolvedBy} marked alert as resolved.${notes ? ' Note: ' + notes : ''}`,
      category: 'ALERT',
      actor: resolvedBy,
      severity: 'normal',
    });

    this.logAudit(
      resolvedBy,
      actorRole,
      'CLINICAL_ALERT_RESOLVED',
      `${alert.patientName} (${alert.room})`,
      `${alert.vitalType} alert resolved by ${resolvedBy}. Response time: ${alert.responseTimeSeconds}s.${notes ? ` Note: ${notes}` : ''}`,
      'SUCCESS'
    );

    this.notify({
      type: 'RESOLVE_ALERT',
      mutationId: 'res-' + alert.id + '-' + Date.now(),
      payload: {
        alertId: alert.id,
        resolvedBy,
        notes,
        actorRole,
        resolvedAt: alert.resolvedAt,
      },
    });
    return true;
  }

  public escalateAlertToEmergency(
    alertId: string,
    requestedBy: string,
    reason?: string
  ): CallRequest | undefined {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return undefined;
    const patient = this.patients.find((p) => p.id === alert.patientId);
    if (!patient) return undefined;

    // Idempotent: If already escalated, return existing emergency call request without duplicate creation
    if (alert.escalationStatus === 'ESCALATED' && alert.callRequestId) {
      const existingCall = this.callRequests.find((c) => c.id === alert.callRequestId);
      if (existingCall) return existingCall;
    }

    // Do not escalate if alert is resolved
    if (alert.status === 'resolved') {
      return undefined;
    }

    alert.escalationStatus = 'ESCALATED';
    alert.escalatedAt = alert.escalatedAt || new Date().toISOString();
    alert.escalatedBy = alert.escalatedBy || requestedBy;
    alert.escalationReason = reason || alert.escalationReason || `Unacknowledged critical alert: ${alert.trigger}`;

    // Create or retrieve emergency call request (deduplicated)
    const emergencyCall = this.createCallRequest({
      patientId: patient.id,
      patientName: patient.name,
      roomNumber: patient.room,
      bedNumber: patient.bed,
      attenderId: patient.assignedAttenderId || 'att-vikash',
      attenderName: requestedBy,
      attenderRelation: patient.assignedAttenderRelation || 'Family Caregiver',
      reason: `🚨 EMERGENCY ESCALATION: ${alert.vitalType} (${alert.currentValue || alert.valueRecorded}) — ${alert.escalationReason}`,
      priority: 'CRITICAL',
    });

    alert.callRequestId = emergencyCall.id;

    this.addTimelineEvent({
      patientId: patient.id,
      title: `Emergency Escalation Triggered (${alert.vitalType})`,
      description: `${requestedBy} escalated unacknowledged critical alert to hospital emergency team.`,
      category: 'ALERT',
      actor: requestedBy,
      severity: 'critical',
    });

    this.logAudit(
      requestedBy,
      'attender',
      'ALERT_EMERGENCY_ESCALATED',
      `${patient.name} (${patient.room})`,
      `Emergency escalation triggered for ${alert.vitalType} episode ${alert.id}: ${alert.trigger}`,
      'WARNING'
    );

    this.notify({
      type: 'ESCALATE_ALERT',
      mutationId: 'esc-' + alert.id + '-' + Date.now(),
      payload: {
        alertId: alert.id,
        requestedBy,
        reason: alert.escalationReason,
        callRequestId: emergencyCall.id,
      },
    });
    return emergencyCall;
  }

  // --- Medications ---
  public getMedications(patientId: string): Medication[] {
    return this.medications.filter((m) => m.patientId === patientId);
  }

  public addMedication(med: Omit<Medication, 'id'>): Medication {
    const id = 'med-' + Math.random().toString(36).substring(2, 8);
    const newMed: Medication = {
      ...med,
      id,
      createdAt: med.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.medications.unshift(newMed);

    this.addTimelineEvent({
      patientId: med.patientId,
      title: `Medication Prescribed: ${med.name} ${med.dosage}`,
      description: `${med.dosage} (${med.route}) scheduled for ${med.scheduledTime}. ${med.instructions}. Prescribed by ${med.prescribedBy}.`,
      category: 'MEDICATION',
      actor: med.prescribedBy,
      severity: 'normal',
    });

    this.notify({ type: 'ADD_MEDICATION', payload: newMed });
    supabaseSyncService.syncMedication(newMed);
    return newMed;
  }

  public updateMedicationStatus(id: string, status: 'Pending' | 'Given' | 'Missed', actor = 'Clinician/Nurse'): boolean {
    const med = this.medications.find((m) => m.id === id);
    if (!med) return false;

    med.status = status;
    med.updatedAt = new Date().toISOString();
    if (status === 'Given') {
      med.administeredAt = new Date().toISOString();
      med.administeredBy = actor;
    }

    const isAttender = 
      actor.toLowerCase().includes('attender') || 
      actor.toLowerCase().includes('caregiver') || 
      actor.toLowerCase().includes('vikash');

    this.addTimelineEvent({
      patientId: med.patientId,
      title: `Medication ${status}: ${med.name}`,
      description: `${med.dosage} (${med.scheduledTime}) marked as ${status} by ${actor}.`,
      category: isAttender ? 'ATTENDER_ACTION' : 'MEDICATION',
      actor,
      severity: status === 'Missed' ? 'attention' : 'normal',
    });

    this.notify({
      type: 'UPDATE_MEDICATION',
      payload: { id, status, administeredAt: med.administeredAt, administeredBy: med.administeredBy },
    });
    supabaseSyncService.syncMedication(med);
    return true;
  }

  // --- Reports ---
  public getReports(patientId: string): MedicalReport[] {
    return this.reports.filter((r) => r.patientId === patientId);
  }

  public addReport(rep: Omit<MedicalReport, 'id'>): MedicalReport {
    const id = 'rep-' + Math.random().toString(36).substring(2, 8);
    const newRep: MedicalReport = { ...rep, id };
    this.reports.unshift(newRep);

    this.addTimelineEvent({
      patientId: rep.patientId,
      title: `Diagnostic Report Uploaded: ${rep.title}`,
      description: `${rep.reportType} report reviewed by ${rep.uploadedBy}. Summary: ${rep.summary}`,
      category: 'REPORT',
      actor: rep.uploadedBy,
      severity: 'normal',
    });

    this.notify({ type: 'ADD_REPORT', payload: newRep });
    return newRep;
  }

  // --- Doctor Notes ---
  public getNotes(patientId: string): DoctorNote[] {
    return this.notes.filter((n) => n.patientId === patientId);
  }

  public addNote(note: Omit<DoctorNote, 'id' | 'timestamp'>): DoctorNote {
    const id = 'note-' + Math.random().toString(36).substring(2, 8);
    const newNote: DoctorNote = {
      ...note,
      id,
      timestamp: new Date().toISOString(),
    };
    this.notes.unshift(newNote);

    this.addTimelineEvent({
      patientId: note.patientId,
      title: `Clinical Note Added (${note.category}): ${note.doctorName}`,
      description: note.content,
      category: 'DOCTOR_NOTE',
      actor: note.doctorName,
      severity: 'normal',
    });

    this.notify({ type: 'ADD_NOTE', payload: newNote });
    return newNote;
  }

  // --- Timeline ---
  public getTimeline(patientId: string): TimelineEvent[] {
    return this.timeline
      .filter((t) => t.patientId === patientId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public getAllTimeline(): TimelineEvent[] {
    return [...this.timeline].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public addTimelineEvent(
    evt: Omit<TimelineEvent, 'id' | 'timestamp'> & { timestamp?: string },
    shouldNotify = false
  ): TimelineEvent {
    const newEvt: TimelineEvent = {
      ...evt,
      id: 'tl-' + Math.random().toString(36).substring(2, 9),
      timestamp: evt.timestamp || new Date().toISOString(),
    };
    this.timeline.unshift(newEvt);
    if (shouldNotify) {
      this.notify();
    }
    return newEvt;
  }

  // --- Notifications ---
  public getNotifications(role?: string, patientId?: string): NotificationItem[] {
    let list = this.notifications;
    if (role) {
      list = list.filter((n) => !n.recipientRole || n.recipientRole === role);
    }
    if (patientId) {
      list = list.filter((n) => !n.patientId || n.patientId === patientId);
    }
    return [...list];
  }

  public addNotification(item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>): NotificationItem {
    // DEDUPLICATION: Check if notification already exists for this alertId or requestId
    if (item.alertId) {
      const existing = this.notifications.find(
        (n) => n.recipientRole === item.recipientRole && n.alertId === item.alertId
      );
      if (existing) {
        existing.message = item.message;
        existing.title = item.title;
        existing.severity = item.severity;
        existing.timestamp = new Date().toISOString();
        existing.read = false;
        return existing;
      }
    }
    if (item.requestId) {
      const existing = this.notifications.find(
        (n) => n.recipientRole === item.recipientRole && n.requestId === item.requestId
      );
      if (existing) {
        existing.message = item.message;
        existing.title = item.title;
        existing.severity = item.severity;
        existing.timestamp = new Date().toISOString();
        existing.read = false;
        return existing;
      }
    }

    const newNotif: NotificationItem = {
      ...item,
      id: 'notif-' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      read: false,
    };
    this.notifications.unshift(newNotif);
    return newNotif;
  }

  public markNotificationRead(id: string) {
    const n = this.notifications.find((notif) => notif.id === id);
    if (n) {
      n.read = true;
      this.notify();
    }
  }

  public markAllNotificationsRead(role?: string) {
    this.notifications.forEach((n) => {
      if (!role || n.recipientRole === role) {
        n.read = true;
      }
    });
    this.notify();
  }

  // Subtle web audio synthesized chime for attender hardware requests
  public playChime(severity: 'info' | 'warning' | 'critical' = 'warning') {
    if (!this.soundEnabled) return;
    this.synthesizeChime(severity);
  }

  public playClinicalAlertChime() {
    if (!this.clinicalAlertSoundEnabled) return;
    this.synthesizeChime('critical');
  }

  private synthesizeChime(severity: 'info' | 'warning' | 'critical') {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = severity === 'critical' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(severity === 'critical' ? 784 : 523.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.onended = () => {
        void ctx.close().catch(() => undefined);
      };
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio might be blocked before user gesture
    }
  }

  // --- Call Service & Staff Management ---
  public deduceRoomLocation(room: string): { floor: number; ward: string } {
    const r = (room || '').toUpperCase();
    if (r.includes('GROUND') || r.includes('EMERGENCY') || r.includes('OPD') || r.startsWith('0') || r.includes('REC')) {
      return { floor: 0, ward: r.includes('EMERGENCY') ? 'Emergency' : 'Ground Floor' };
    }
    if (r.includes('ICU') || r.includes('204') || r.includes('206') || r.includes('10') || r.includes('FL-1') || r.includes('FLOOR 1')) {
      return { floor: 1, ward: r.includes('ICU') ? 'ICU' : 'First Floor' };
    }
    if (r.includes('302') || r.includes('30') || r.includes('CARDIO') || r.includes('11002') || r.includes('FL-2') || r.includes('FLOOR 2')) {
      return { floor: 2, ward: r.includes('CARDIO') ? 'Cardiology' : 'Second Floor' };
    }
    return { floor: 1, ward: 'General Inpatient' };
  }

  public getCallRequests(patientId?: string): CallRequest[] {
    if (patientId) {
      return this.callRequests.filter((c) => c.patientId === patientId);
    }
    return [...this.callRequests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getCallRequestById(id: string): CallRequest | undefined {
    return this.callRequests.find((c) => c.id === id);
  }

  public getCallStaff(): CallServiceStaff[] {
    return [...this.callStaff];
  }

  public getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public logAudit(
    user: string,
    userRole: UserRole | 'system' | 'nurse' | 'staff',
    action: string,
    target: string,
    details: string,
    result: 'SUCCESS' | 'FAILURE' | 'WARNING' = 'SUCCESS'
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      user,
      userRole,
      action,
      target,
      details,
      result,
    };
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
    this.notify({ type: 'ADD_AUDIT_LOG', payload: entry });
    return entry;
  }

  public createCallRequest(
    patientIdOrObj:
      | string
      | {
          patientId: string;
          patientName?: string;
          roomNumber?: string;
          bedNumber?: string;
          attenderId?: string;
          attenderName?: string;
          attenderPhone?: string;
          attenderRelation?: string;
          reason: string;
          priority?: CallPriority;
        },
    attenderId?: string,
    reason?: string,
    priority: CallPriority = 'URGENT'
  ): CallRequest {
    let pId: string;
    let aId: string;
    let callReason: string;
    let callPriority: CallPriority = 'URGENT';
    let passedAttenderName: string | undefined;
    let passedAttenderRelation: string | undefined;

    if (typeof patientIdOrObj === 'object') {
      pId = patientIdOrObj.patientId;
      aId = patientIdOrObj.attenderId || '';
      callReason = patientIdOrObj.reason;
      callPriority = patientIdOrObj.priority || 'URGENT';
      passedAttenderName = patientIdOrObj.attenderName;
      passedAttenderRelation = patientIdOrObj.attenderRelation;
    } else {
      pId = patientIdOrObj;
      aId = attenderId || '';
      callReason = reason || 'Immediate assistance requested';
      callPriority = priority;
    }

    const patient = this.patients.find((p) => p.id === pId);
    if (!patient) {
      throw new Error(`Patient ${pId} not found`);
    }

    const attender = this.attenders.find((a) => a.id === aId || a.userId === aId);
    const attenderName =
      passedAttenderName || (attender ? attender.name : patient.assignedAttenderName || 'Attender');
    const attenderRelation =
      passedAttenderRelation || (attender ? attender.relation : patient.assignedAttenderRelation || 'Family');
    const loc = this.deduceRoomLocation(patient.room);

    // DEDUPLICATION: Check if active call request already exists for this patient and matching clinical alert / reason
    const existingActive = this.callRequests.find(
      (c) =>
        c.patientId === patient.id &&
        (c.status === 'WAITING' || c.status === 'ASSIGNED' || c.status === 'RESPONDING') &&
        (c.priority === callPriority ||
          c.reason === callReason ||
          (c.reason.includes('Clinical Alert') && callReason.includes('Clinical Alert')) ||
          (c.reason.includes('EMERGENCY ESCALATION') && callReason.includes('EMERGENCY ESCALATION')))
    );
    if (existingActive) {
      existingActive.reason = callReason;
      existingActive.priority = callPriority;
      this.notify();
      return existingActive;
    }

    const newCall: CallRequest = {
      id: 'call-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      patientId: patient.id,
      patientName: patient.name,
      room: patient.room,
      bed: patient.bed,
      floor: loc.floor,
      ward: loc.ward,
      attenderId: attender?.id || aId || 'attender',
      attenderName,
      attenderRelation,
      reason: callReason,
      priority: callPriority,
      status: 'WAITING',
      createdAt: new Date().toISOString(),
    };

    this.callRequests.unshift(newCall);

    // Timeline event
    this.addTimelineEvent({
      patientId: patient.id,
      title: `${priority === 'CRITICAL' ? '🚨 CRITICAL' : '🔔 URGENT'} Bedside Attender Assistance Requested`,
      description: `${reason} — Initiated by ${attenderName} (${attenderRelation}) in Room ${patient.room}.`,
      category: 'ATTENDER_ACTION',
      actor: attenderName,
      severity: priority === 'CRITICAL' ? 'critical' : 'attention',
    });

    // Notification for admin/duty staff
    this.addNotification({
      recipientRole: 'admin',
      patientId: patient.id,
      title: `🚨 ${priority} Call: ${patient.name} (${patient.room})`,
      message: `${attenderName} requested assistance: ${reason}`,
      severity: priority === 'CRITICAL' ? 'critical' : 'warning',
    });

    // Audit log
    this.logAudit(
      attenderName,
      'attender',
      'URGENT_HELP_CALLED',
      `${patient.name} (${patient.room})`,
      `Priority: ${priority}, Reason: ${reason}`,
      'SUCCESS'
    );

    // Play chime
    this.playChime(priority === 'CRITICAL' ? 'critical' : 'warning');

    // Attempt intelligent auto-assignment
    this.autoAssignCall(newCall.id);

    this.notify({ type: 'CREATE_CALL_REQUEST', payload: newCall });
    return newCall;
  }

  public autoAssignCall(callId: string): CallRequest | undefined {
    const call = this.callRequests.find((c) => c.id === callId);
    if (!call || call.status === 'RESOLVED' || call.status === 'CANCELLED') return call;

    // Intelligent multi-factor matching:
    // 1. Staff with status === 'AVAILABLE'
    // 2. Exact ward and floor match first, then same floor, then hospital-wide
    // 3. Lowest activeCallCount
    const availableStaff = this.callStaff.filter((s) => s.status === 'AVAILABLE');
    if (availableStaff.length === 0) return call;

    const targetFloor = call.floor !== undefined ? call.floor : 1;
    const targetWard = (call.ward || '').toLowerCase();

    const scored = [...availableStaff].sort((a, b) => {
      const aWardMatch = a.ward.toLowerCase().includes(targetWard) || targetWard.includes(a.ward.toLowerCase());
      const bWardMatch = b.ward.toLowerCase().includes(targetWard) || targetWard.includes(b.ward.toLowerCase());

      const aFloorMatch = a.floor === targetFloor;
      const bFloorMatch = b.floor === targetFloor;

      const aScore = aWardMatch && aFloorMatch ? 0 : aFloorMatch ? 1 : 2;
      const bScore = bWardMatch && bFloorMatch ? 0 : bFloorMatch ? 1 : 2;

      if (aScore !== bScore) return aScore - bScore;
      return a.activeCallCount - b.activeCallCount;
    });

    const chosenStaff = scored[0];
    if (chosenStaff) {
      call.status = 'ASSIGNED';
      call.assignedAt = new Date().toISOString();
      call.assignedStaffId = chosenStaff.id;
      call.assignedStaffName = chosenStaff.name;
      call.assignedStaffRole = chosenStaff.role;
      call.assignedStaffContact = chosenStaff.phone;

      chosenStaff.activeCallCount += 1;
      chosenStaff.lastActive = new Date().toISOString();

      this.logAudit(
        'system',
        'system',
        'CALL_AUTO_ASSIGNED',
        `${call.patientName} -> ${chosenStaff.name}`,
        `Routed to ${chosenStaff.role} on Floor ${chosenStaff.floor} (${chosenStaff.ward})`,
        'SUCCESS'
      );
    }

    return call;
  }

  public updateCallStatus(
    callId: string,
    status: CallStatus,
    staffIdOrNotes?: string,
    notes?: string
  ): CallRequest | undefined {
    const call = this.callRequests.find((c) => c.id === callId);
    if (!call) return undefined;

    let targetStaffId: string | undefined = undefined;
    let noteText = notes;
    if (staffIdOrNotes) {
      const match = this.callStaff.find((s) => s.id === staffIdOrNotes);
      if (match) {
        targetStaffId = staffIdOrNotes;
      } else if (!notes) {
        noteText = staffIdOrNotes;
      }
    }

    const oldStatus = call.status;
    call.status = status;
    const now = new Date().toISOString();

    if (status === 'ACKNOWLEDGED' && !call.acknowledgedAt) {
      call.acknowledgedAt = now;
    } else if (status === 'ASSIGNED') {
      call.assignedAt = now;
    } else if (status === 'RESPONDING') {
      call.respondingAt = now;
    } else if (status === 'ARRIVED') {
      call.arrivedAt = now;
    } else if (status === 'RESOLVED' || status === 'CANCELLED') {
      call.resolvedAt = now;
      const staff = this.callStaff.find((s) => s.id === call.assignedStaffId);
      if (staff) {
        staff.activeCallCount = Math.max(0, staff.activeCallCount - 1);
        staff.lastActive = now;
      }
    }

    if (targetStaffId) {
      const staff = this.callStaff.find((s) => s.id === targetStaffId);
      if (staff) {
        call.assignedStaffId = staff.id;
        call.assignedStaffName = staff.name;
        call.assignedStaffRole = staff.role;
        call.assignedStaffContact = staff.phone;
      }
    }

    if (noteText) {
      call.notes = noteText;
    }

    const actionName =
      status === 'RESOLVED'
        ? 'CALL_RESOLVED'
        : status === 'CANCELLED'
        ? 'CALL_CANCELLED'
        : status === 'RESPONDING'
        ? 'CALL_RESPONDING'
        : status === 'ARRIVED'
        ? 'CALL_ARRIVED'
        : 'CALL_STATUS_CHANGED';

    this.logAudit(
      call.assignedStaffName || 'Staff',
      'nurse',
      actionName,
      `Call #${call.id.slice(-6)} (${call.patientName})`,
      `Transitioned from ${oldStatus} to ${status}${noteText ? ` - Note: ${noteText}` : ''}`,
      'SUCCESS'
    );

    this.notify({ type: 'UPDATE_CALL_REQUEST', payload: call });
    return call;
  }

  public escalateCall(callId: string, reason?: string, actor?: string): boolean {
    const call = this.callRequests.find((c) => c.id === callId);
    if (!call) return false;

    call.priority = 'CRITICAL';
    const noteText = reason || 'Escalated to critical priority by dispatch admin';
    call.notes = call.notes ? `${call.notes} | Escalated: ${noteText}` : `Escalated: ${noteText}`;

    this.logAudit(
      actor || 'Dispatch Admin',
      'staff',
      'CALL_ESCALATED',
      `Call #${call.id.slice(-6)} (${call.patientName})`,
      `Priority escalated to CRITICAL. Reason: ${noteText}`,
      'SUCCESS'
    );
    this.notify({ type: 'ESCALATE_CALL_REQUEST', payload: call });
    return true;
  }

  public updateStaffStatus(
    staffId: string,
    status: 'AVAILABLE' | 'BUSY' | 'OFFLINE'
  ): CallServiceStaff | undefined {
    const staff = this.callStaff.find((s) => s.id === staffId);
    if (!staff) return undefined;

    staff.status = status;
    staff.lastActive = new Date().toISOString();

    this.logAudit(
      staff.name,
      'nurse',
      'STAFF_AVAILABILITY_CHANGED',
      staff.name,
      `Status set to ${status}`,
      'SUCCESS'
    );

    this.notify({ type: 'UPDATE_CALL_STAFF', payload: staff });
    return staff;
  }

  public addCallStaffMember(staff: Omit<CallServiceStaff, 'id' | 'activeCallCount'>): CallServiceStaff {
    const newStaff: CallServiceStaff = {
      ...staff,
      id: 'staff-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      activeCallCount: 0,
      lastActive: new Date().toISOString(),
    };
    this.callStaff.push(newStaff);
    this.notify();
    return newStaff;
  }

  // --- Demo Simulation Timeout Configuration ---
  private demoAlertTimeoutSeconds: number = 30;

  public getDemoAlertTimeoutSeconds(): number {
    return this.demoAlertTimeoutSeconds;
  }

  public setDemoAlertTimeoutSeconds(seconds: number): void {
    this.demoAlertTimeoutSeconds = Math.max(5, seconds);
    this.notify();
  }

  public exportSnapshot(): string {
    return JSON.stringify({
      patients: this.patients,
      doctors: this.doctors,
      attenders: this.attenders,
      requests: this.requests,
      alerts: this.alerts,
      medications: this.medications,
      reports: this.reports,
      notes: this.notes,
      timeline: this.timeline,
      notifications: this.notifications,
      callRequests: this.callRequests,
      callStaff: this.callStaff,
      auditLogs: this.auditLogs,
      careTeamMembers: this.careTeamMembers,
      encounters: this.encounters,
      admissions: this.admissions,
      procedures: this.procedures,
      medicationOrders: this.medicationOrders,
      medicationAdministrations: this.medicationAdministrations,
      investigations: this.investigations,
      transfers: this.transfers,
      dischargePlans: this.dischargePlans,
      soundEnabled: this.soundEnabled,
    });
  }

  public importSnapshot(snapshot: string): void {
    try {
      const parsed = JSON.parse(snapshot);
      if (parsed.patients) this.patients = parsed.patients;
      if (parsed.doctors) this.doctors = parsed.doctors;
      if (parsed.attenders) this.attenders = parsed.attenders;
      if (parsed.requests) this.requests = parsed.requests;
      if (parsed.alerts) this.alerts = parsed.alerts;
      if (parsed.medications) this.medications = parsed.medications;
      if (parsed.reports) this.reports = parsed.reports;
      if (parsed.notes) this.notes = parsed.notes;
      if (parsed.timeline) this.timeline = parsed.timeline;
      if (parsed.notifications) this.notifications = parsed.notifications;
      if (parsed.callRequests) this.callRequests = parsed.callRequests;
      if (parsed.callStaff) this.callStaff = parsed.callStaff;
      if (parsed.auditLogs) this.auditLogs = parsed.auditLogs;
      if (parsed.careTeamMembers) this.careTeamMembers = parsed.careTeamMembers;
      if (parsed.encounters) this.encounters = parsed.encounters;
      if (parsed.admissions) this.admissions = parsed.admissions;
      if (parsed.procedures) this.procedures = parsed.procedures;
      if (parsed.medicationOrders) this.medicationOrders = parsed.medicationOrders;
      if (parsed.medicationAdministrations) this.medicationAdministrations = parsed.medicationAdministrations;
      if (parsed.investigations) this.investigations = parsed.investigations;
      if (parsed.transfers) this.transfers = parsed.transfers;
      if (parsed.dischargePlans) this.dischargePlans = parsed.dischargePlans;
      if (parsed.soundEnabled !== undefined) this.soundEnabled = parsed.soundEnabled;
      this.lastSyncTimestamp = Date.now();
      this.saveToStorage();
      this.notifyLocal();
    } catch (err) {
      console.error('Failed to import snapshot:', err);
    }
  }
}

export const dataStore = new DataStore();

if (typeof window !== 'undefined') {
  (window as unknown as { __DATA_STORE__: DataStore }).__DATA_STORE__ = dataStore;
}
