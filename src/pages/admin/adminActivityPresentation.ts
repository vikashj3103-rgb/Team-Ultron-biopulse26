import { TimelineEvent } from '../../types';

export const adminActivityTitleKeys: Record<TimelineEvent['category'], string> = {
  ADMISSION: 'admin.activity.admission',
  ASSIGNMENT: 'admin.activity.assignment',
  VITAL_CHANGE: 'admin.activity.vitals',
  MEDICATION: 'admin.activity.medication',
  REPORT: 'admin.activity.report',
  DOCTOR_NOTE: 'admin.activity.clinicalNote',
  GLOVE_REQUEST: 'admin.activity.bedsideRequest',
  PATIENT_REQUEST: 'admin.activity.patientRequest',
  ALERT: 'admin.activity.alert',
  ALERT_ACKNOWLEDGED: 'admin.activity.alertReviewed',
  ALERT_RESOLVED: 'admin.activity.alertUpdated',
  ATTENDER_ACTION: 'admin.activity.bedsideCare',
  NURSE_CALL: 'admin.activity.nurseCall',
  TRANSFER: 'admin.activity.transfer',
  DISCHARGE: 'admin.activity.discharge',
};
