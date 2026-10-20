export type UserRole = 'admin' | 'doctor' | 'attender';

export type VitalStatus = 'stable' | 'attention' | 'high' | 'critical';

export type RequestType = 'WATER' | 'FOOD' | 'MEDICINE' | 'NURSE' | 'EMERGENCY';

export type RequestStatus = 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED';

export type AlertSeverity = 'attention' | 'high' | 'critical';

export type AlertStatus = 'active' | 'acknowledged' | 'responding' | 'resolved';

export type SimulationScenario = 'normal' | 'attention' | 'critical' | 'deterioration';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  createdAt: string;
}

export interface Doctor {
  id: string;
  name: string;
  email: string;
  specialty: string;
  department: string;
  phone: string;
  isOnline: boolean;
  activePatientCount: number;
}

export interface PatientAttenderLink {
  id: string;
  patientId: string;
  attenderId: string; // The User ID / login username
  attenderName: string;
  relation: string; // e.g. "Grandson", "Daughter", "Spouse", "Son"
  phone: string;
  status: 'active' | 'revoked';
  createdAt: string;
  revokedAt?: string;
}

export interface AttenderProvisionInput {
  name: string;
  relation: string;
  phone: string;
  userId: string;
  temporaryPassword: string;
}

export interface Attender {
  id: string;
  userId?: string;
  name: string;
  email: string;
  phone: string;
  relation: string; // Family relationship e.g. "Grandson", "Spouse", "Daughter"
  assignedPatientId?: string;
  isOnline: boolean;
  temporaryPassword?: string;
  passwordHash?: string;
  mustChangePassword?: boolean;
  status?: 'active' | 'revoked';
  createdAt?: string;
  revokedAt?: string;
}

export interface VitalReading {
  systolicBP: number;
  diastolicBP: number;
  pulse: number; // bpm
  spO2: number; // %
  temperature: number; // Celsius
  respiratoryRate?: number; // breaths/min
  timestamp: string;
  status: VitalStatus;
  bpStatus: VitalStatus;
  pulseStatus: VitalStatus;
  spO2Status: VitalStatus;
  tempStatus: VitalStatus;
  rrStatus?: VitalStatus;
}

export interface Patient {
  id: string;
  mrn: string; // Medical Record Number e.g. "CC-2026-101"
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  bloodGroup: string;
  room: string;
  bed: string;
  primaryCondition: string;
  currentDiagnosis?: string;
  medicalHistory?: string;
  treatmentPlan?: string;
  allergies?: string[];
  careInstructions?: string;
  department: string;
  admissionDate: string;
  dischargeDate?: string;
  status: VitalStatus;
  assignedDoctorId?: string;
  assignedDoctorName?: string;
  assignedDoctorSpecialty?: string;
  assignedAttenderId?: string;
  assignedAttenderName?: string;
  assignedAttenderRelation?: string;
  assignedAttenderPhone?: string;
  assignedAttenders?: PatientAttenderLink[];
  latestVitals: VitalReading;
  vitalsHistory: VitalReading[];
  hardwareDeviceId?: string;
  lastVitalUpdate: string;
  emergencyContact?: string;
  notes?: string;
  currentLocation?: HospitalLocation;
  careTeam?: PatientCareTeamMember[];
  activeEncounterId?: string;
}

export interface PatientRequest {
  id: string;
  patientId: string;
  patientName: string;
  room: string;
  bed: string;
  requestType: RequestType;
  status: RequestStatus;
  timestamp: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
}

export type ClinicalConditionType =
  | 'HYPOXIA'
  | 'HYPERTENSION'
  | 'HYPOTENSION'
  | 'TACHYCARDIA'
  | 'BRADYCARDIA'
  | 'HYPERPYREXIA'
  | 'FEVER'
  | 'HYPOTHERMIA'
  | 'RESPIRATORY_DISTRESS'
  | 'GENERAL';

export interface VitalAlert {
  id: string; // Episode identifier e.g. "alert-pat-ramesh-hypoxia-..."
  alertKey: string; // Deterministic episode deduplication identity: `${patientId}:${conditionType}`
  conditionType: ClinicalConditionType;
  patientId: string;
  patientName: string;
  room: string;
  bed?: string;
  encounterId?: string;
  severity: AlertSeverity;
  status: AlertStatus;
  trigger: string;
  message: string;
  familyMessage: string; // Non-clinical calm message for the family attender
  vitalType: 'BP' | 'PULSE' | 'SPO2' | 'TEMP' | 'RR' | 'GENERAL';
  unit?: string;
  valueRecorded: string;
  baselineValue?: string;
  previousValue?: string;
  currentValue?: string;
  trend?: 'deteriorating' | 'improving' | 'stable';
  timestamp: string; // Last updated timestamp
  firstDetectedAt: string;
  lastUpdatedAt: string;
  occurrenceCount: number; // Increment on every telemetry update for this active episode
  readingsCount?: number;
  recoveryCount?: number; // Consecutive normal readings for hysteresis
  recoveryEligible?: boolean;
  source?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  respondingAt?: string;
  respondingBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  escalationStatus?: 'NONE' | 'TIMEOUT_EXCEEDED' | 'ESCALATED';
  escalatedAt?: string;
  escalatedBy?: string;
  escalationReason?: string;
  callRequestId?: string;
  responseTimeSeconds?: number;
  notes?: string;
}

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  route: 'Oral' | 'IV' | 'IM' | 'Sublingual' | 'Inhalation';
  frequency: string;
  scheduledTime: string;
  instructions: string;
  startDate: string;
  endDate?: string;
  status: 'Pending' | 'Given' | 'Missed';
  prescribedBy: string;
  createdAt?: string;
  updatedAt?: string;
  administeredAt?: string;
  administeredBy?: string;
}

export interface MedicalReport {
  id: string;
  patientId: string;
  title: string;
  reportType: 'Lab Test' | 'Radiology' | 'ECG' | 'Echo' | 'Discharge Summary' | 'Vitals Assessment';
  date: string;
  uploadedBy: string;
  status: 'Reviewed' | 'Pending Review' | 'Final';
  summary: string;
  fileUrl?: string;
  fileName?: string;
}

export interface DoctorNote {
  id: string;
  patientId: string;
  doctorName: string;
  doctorId: string;
  content: string;
  timestamp: string;
  category: 'Observation' | 'Treatment Plan' | 'Consultation' | 'Discharge Plan';
}

export interface TimelineEvent {
  id: string;
  patientId: string;
  title: string;
  description: string;
  category: 
    | 'ADMISSION' 
    | 'ASSIGNMENT' 
    | 'VITAL_CHANGE' 
    | 'MEDICATION' 
    | 'REPORT' 
    | 'DOCTOR_NOTE' 
    | 'GLOVE_REQUEST' 
    | 'PATIENT_REQUEST'
    | 'ALERT' 
    | 'ALERT_ACKNOWLEDGED' 
    | 'ALERT_RESOLVED' 
    | 'ATTENDER_ACTION' 
    | 'NURSE_CALL' 
    | 'TRANSFER' 
    | 'DISCHARGE';
  timestamp: string;
  actor?: string;
  severity?: 'normal' | 'attention' | 'critical';
}

export interface NotificationItem {
  id: string;
  recipientRole?: UserRole;
  patientId?: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  read: boolean;
  link?: string;
  requestId?: string;
  alertId?: string;
  status?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface HardwareEventPayload {
  patientId: string;
  eventType: 'REQUEST' | 'VITAL';
  requestType?: RequestType;
  vitalType?: 'BP' | 'PULSE' | 'SPO2' | 'TEMP' | 'RR' | 'ALL';
  value?: {
    systolic?: number;
    diastolic?: number;
    pulse?: number;
    spO2?: number;
    temperature?: number;
    respiratoryRate?: number;
  };
  timestamp?: string;
}

export type CallPriority = 'NORMAL' | 'URGENT' | 'CRITICAL';

export type CallStatus = 'WAITING' | 'ACKNOWLEDGED' | 'ASSIGNED' | 'RESPONDING' | 'ARRIVED' | 'RESOLVED' | 'CANCELLED';

export interface CallRequest {
  id: string;
  patientId: string;
  patientName: string;
  room: string;
  bed: string;
  roomNumber?: string;
  bedNumber?: string;
  floor?: number;
  ward?: string;
  attenderId: string;
  attenderName: string;
  attenderRelation: string;
  reason: string;
  priority: CallPriority;
  status: CallStatus;
  createdAt: string;
  acknowledgedAt?: string;
  assignedAt?: string;
  respondingAt?: string;
  arrivedAt?: string;
  resolvedAt?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  assignedStaffRole?: string;
  assignedStaffContact?: string;
  notes?: string;
}

export interface CallServiceStaff {
  id: string;
  name: string;
  role: 'Nurse' | 'Support Staff' | 'Ward Assistant' | 'Duty Physician';
  department: string;
  ward: string;
  floor: number;
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  activeCallCount: number;
  phone?: string;
  lastActive?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  userRole: UserRole | 'system' | 'nurse' | 'staff';
  action: string;
  target: string;
  details: string;
  result: 'SUCCESS' | 'FAILURE' | 'WARNING';
}

export interface HospitalLocationNode {
  id: string;
  name: string;
  code: string;
  type: 'room' | 'department' | 'lift' | 'stairs' | 'reception' | 'pharmacy' | 'lab' | 'corridor' | 'icu';
  floor: number; // 0 = Ground Floor, 1 = First Floor, 2 = Second Floor
  building: string;
  wing?: 'A' | 'B' | 'Central';
  department?: string;
  x: number; // 2D coordinate on floor map (0 - 800)
  y: number; // 2D coordinate on floor map (0 - 500)
  connectedTo: string[]; // Node IDs reachable directly
}

export interface NavigationRouteResult {
  fromNode: HospitalLocationNode;
  toNode: HospitalLocationNode;
  path: HospitalLocationNode[];
  totalDistanceMeters: number;
  estimatedMinutes: number;
  floorChanges: boolean;
  instructions: string[];
}

// ==========================================
// CLINICAL DOMAIN MODELS & CARE TEAM ARCHITECTURE
// ==========================================

export type CareTeamRole =
  | 'ATTENDING_PHYSICIAN'
  | 'SURGEON'
  | 'ANESTHESIOLOGIST'
  | 'CONSULTANT'
  | 'RESIDENT'
  | 'NURSE'
  | 'CHARGE_NURSE'
  | 'PHARMACIST'
  | 'CASE_MANAGER'
  | 'DIETITIAN'
  | 'PHYSIOTHERAPIST';

export interface PatientCareTeamMember {
  id: string;
  patientId: string;
  encounterId?: string;
  userId: string;
  name: string;
  role: CareTeamRole;
  specialty?: string;
  department?: string;
  status: 'active' | 'completed' | 'on_call';
  assignedAt: string;
  endedAt?: string;
  isPrimary: boolean;
  notes?: string;
  phone?: string;
}

export type EncounterType = 'OUTPATIENT' | 'EMERGENCY' | 'INPATIENT' | 'SURGICAL' | 'FOLLOW_UP';

export type EncounterStatus = 'PLANNED' | 'ACTIVE' | 'DISCHARGED' | 'TRANSFERRED' | 'CANCELLED';

export interface HospitalLocation {
  id: string;
  building: string;
  floor: number;
  wing?: 'A' | 'B' | 'Central';
  department: string;
  ward: string;
  room: string;
  bed: string;
  mapNodeId?: string;
}

export interface InpatientAdmission {
  admissionId: string;
  patientId: string;
  encounterId: string;
  admissionDate: string;
  admissionType: 'ELECTIVE' | 'EMERGENCY' | 'TRANSFER' | 'SURGICAL';
  admittingService: string;
  attendingDoctorId: string;
  attendingDoctorName: string;
  currentLocation: HospitalLocation;
  status: 'ADMITTED' | 'PREOP' | 'POSTOP' | 'TRANSFERRED' | 'DISCHARGED';
  expectedDischargeDate?: string;
  actualDischargeDate?: string;
  dischargeSummary?: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  type: EncounterType;
  status: EncounterStatus;
  startDate: string;
  endDate?: string;
  department: string;
  reasonForAdmission: string;
  admissions?: InpatientAdmission[];
}

export type ProcedureStatus = 'PLANNED' | 'SCHEDULED' | 'PREOP' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Procedure {
  id: string;
  patientId: string;
  encounterId?: string;
  procedureName: string;
  specialty: string;
  scheduledAt: string;
  status: ProcedureStatus;
  surgeonId: string;
  surgeonName: string;
  anesthesiologistId: string;
  anesthesiologistName: string;
  operatingRoom: string;
  preOpVerified: boolean;
  completedAt?: string;
  notes?: string;
}

export type MedicationCategory =
  | 'HOME_MEDICATION'
  | 'INPATIENT_ORDER'
  | 'ADMINISTERED_DOSE'
  | 'DISCONTINUED_MEDICATION'
  | 'DISCHARGE_MEDICATION';

export type MedAdministrationStatus =
  | 'SCHEDULED'
  | 'DUE'
  | 'ADMINISTERED'
  | 'HELD'
  | 'REFUSED'
  | 'MISSED'
  | 'CANCELLED';

export interface MedicationOrder {
  id: string;
  patientId: string;
  encounterId?: string;
  name: string;
  category: MedicationCategory;
  dosage: string;
  route: 'Oral' | 'IV' | 'IM' | 'Sublingual' | 'Inhalation' | 'Subcutaneous';
  frequency: string;
  prescribedBy: string;
  prescribedAt: string;
  status: 'ACTIVE' | 'DISCONTINUED' | 'COMPLETED';
  discontinuedAt?: string;
  instructions?: string;
}

export interface MedicationAdministrationRecord {
  id: string;
  orderId: string;
  patientId: string;
  medicationName: string;
  dosage: string;
  route: string;
  scheduledTime: string;
  status: MedAdministrationStatus;
  administeredAt?: string;
  administeredBy?: string; // Must be clinical staff/nurse, not family
  notes?: string;
}

export type InvestigationStatus = 'ORDERED' | 'COLLECTED' | 'IN_PROGRESS' | 'RESULTED' | 'REVIEWED' | 'CANCELLED';

export interface Investigation {
  id: string;
  patientId: string;
  encounterId?: string;
  type: 'LAB' | 'RADIOLOGY' | 'PATHOLOGY' | 'CARDIOLOGY';
  name: string;
  orderedBy: string;
  orderedAt: string;
  status: InvestigationStatus;
  result?: string;
  resultedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  normalRange?: string;
  criticalFlag?: boolean;
}

export interface PatientTransfer {
  id: string;
  patientId: string;
  encounterId?: string;
  fromLocation: HospitalLocation;
  toLocation: HospitalLocation;
  initiatedBy: string;
  reason: string;
  timestamp: string;
  status: 'REQUESTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
}

export interface DischargePlan {
  id: string;
  patientId: string;
  encounterId?: string;
  plannedDate: string;
  status: 'PLANNING' | 'MED_RECONCILED' | 'PENDING_RESULTS_REVIEWED' | 'NURSE_CLEARED' | 'COMPLETED';
  medicationsReconciled: boolean;
  pendingResultsReviewed: boolean;
  nursingDischargeCompleted: boolean;
  dischargeInstructions: string[];
  followUpAppointment?: string;
  dischargeSummary?: string;
  completedAt?: string;
}

