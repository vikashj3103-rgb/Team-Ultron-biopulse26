import { Patient, UserRole } from '../types';
import { dataStore } from './dataStore';

/** Returns only records visible in the clinical workspace for the active role. */
export const getClinicalWorkspacePatients = (
  role: UserRole | null | undefined,
  assignedDoctorId?: string
): Patient[] => {
  if (role === 'admin') return dataStore.getPatients();
  if (role === 'doctor' && assignedDoctorId) return dataStore.getPatientsByDoctor(assignedDoctorId);
  return [];
};
