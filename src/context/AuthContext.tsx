import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { dataStore } from '../services/dataStore';
import { decideStaffCredentialSignIn } from '../services/authPolicyService';

interface AuthContextType {
  currentUser: UserProfile | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  loginAsDemo: (role: UserRole) => void;
  loginWithCredentials: (userIdOrEmail: string, passwordAttempt: string) => Promise<{ success: boolean; error?: string; mustChangePassword?: boolean; role?: UserRole }>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  canAccessPatient: (patientId: string) => boolean;
  assignedDoctorId?: string;
  assignedAttenderId?: string;
  mustChangePassword?: boolean;
}

const DEMO_USERS: Record<UserRole, UserProfile & { assignedDoctorId?: string; assignedAttenderId?: string }> = {
  doctor: {
    id: 'user-doc-arun',
    name: 'Dr. Arun Kumar',
    email: 'doctor.cardio@careconnect.demo',
    role: 'doctor',
    phone: '+91 98401 23456',
    createdAt: new Date().toISOString(),
    assignedDoctorId: 'doc-arun',
  },
  attender: {
    id: 'user-att-vikash',
    name: 'Vikash Kumar',
    email: 'attender.vikash@careconnect.demo',
    role: 'attender',
    phone: '+91 98765 43210',
    createdAt: new Date().toISOString(),
    assignedAttenderId: 'att-vikash',
  },
  admin: {
    id: 'user-admin',
    name: 'Clinical Administrator',
    email: 'admin@careconnect.demo',
    role: 'admin',
    phone: '+91 98400 00000',
    createdAt: new Date().toISOString(),
  },
};

const AUTH_STORAGE_KEY = 'careconnect_auth_session_v2';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null;
  });

  const [assignedDoctorId, setAssignedDoctorId] = useState<string | undefined>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const u = JSON.parse(saved);
        if (u.role === 'doctor') return u.assignedDoctorId || 'doc-arun';
      }
    } catch {
      // ignore
    }
    if (currentUser?.role === 'doctor') return (currentUser as any).assignedDoctorId || 'doc-arun';
    return undefined;
  });

  const [assignedAttenderId, setAssignedAttenderId] = useState<string | undefined>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const u = JSON.parse(saved);
        if (u.role === 'attender') return u.assignedAttenderId || u.id;
      }
    } catch {
      // ignore
    }
    if (currentUser?.role === 'attender') return (currentUser as any).assignedAttenderId || currentUser.id;
    return undefined;
  });

  const [mustChangePassword, setMustChangePassword] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const u = JSON.parse(saved);
        return !!u.mustChangePassword;
      }
    } catch {
      // ignore
    }
    return false;
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
      if (currentUser.role === 'doctor') {
        setAssignedDoctorId((currentUser as any).assignedDoctorId || 'doc-arun');
      } else {
        setAssignedDoctorId(undefined);
      }

      if (currentUser.role === 'attender') {
        setAssignedAttenderId((currentUser as any).assignedAttenderId || currentUser.id);
      } else {
        setAssignedAttenderId(undefined);
      }
      setMustChangePassword(!!(currentUser as any).mustChangePassword);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setAssignedDoctorId(undefined);
      setAssignedAttenderId(undefined);
      setMustChangePassword(false);
    }
  }, [currentUser]);

  const loginAsDemo = (demoRole: UserRole) => {
    const user = DEMO_USERS[demoRole];
    setCurrentUser(user);
    if (demoRole === 'doctor') {
      setAssignedDoctorId('doc-arun');
      setAssignedAttenderId(undefined);
    } else if (demoRole === 'attender') {
      setAssignedAttenderId('att-vikash');
      setAssignedDoctorId(undefined);
    } else {
      setAssignedDoctorId(undefined);
      setAssignedAttenderId(undefined);
    }
    setMustChangePassword(false);
  };

  const loginWithCredentials = async (
    userIdOrEmail: string,
    passwordAttempt: string
  ): Promise<{ success: boolean; error?: string; mustChangePassword?: boolean; role?: UserRole }> => {
    const trimmedId = userIdOrEmail.trim();

    // 1. Check Attender accounts in dataStore
    const attenderCheck = dataStore.verifyAttenderPassword(trimmedId, passwordAttempt);
    if (attenderCheck.valid && attenderCheck.attender) {
      const att = attenderCheck.attender;
      const user: UserProfile & { assignedAttenderId?: string; mustChangePassword?: boolean } = {
        id: att.id,
        name: att.name,
        email: att.email || `${att.id}@careconnect.in`,
        role: 'attender',
        phone: att.phone,
        createdAt: att.createdAt || new Date().toISOString(),
        assignedAttenderId: att.id,
        mustChangePassword: !!att.mustChangePassword,
      };

      setCurrentUser(user);
      setAssignedAttenderId(att.id);
      setAssignedDoctorId(undefined);
      setMustChangePassword(!!att.mustChangePassword);

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      return { success: true, mustChangePassword: !!att.mustChangePassword, role: 'attender' };
    } else if (attenderCheck.error && attenderCheck.error.includes('revoked')) {
      return { success: false, error: attenderCheck.error };
    }

    // Staff credential authentication is unavailable until a trusted server-side
    // credential provider is configured. Never grant access from an account ID.
    const doctors = dataStore.getDoctors();
    const doc = doctors.find(
      (d) => d.id.toLowerCase() === trimmedId.toLowerCase() || d.email.toLowerCase() === trimmedId.toLowerCase()
    );
    if (doc) {
      return decideStaffCredentialSignIn('doctor', false);
    }

    // 3. Check Admin account
    if (trimmedId.toLowerCase() === 'admin' || trimmedId.toLowerCase() === 'admin@careconnect.demo') {
      return decideStaffCredentialSignIn('admin', false);
    }

    return { success: false, error: attenderCheck.error || 'Invalid User ID or Password' };
  };

  const changePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser || currentUser.role !== 'attender' || !assignedAttenderId) {
      return { success: false, error: 'Unauthorized session' };
    }

    const changed = dataStore.changeAttenderPassword(assignedAttenderId, newPassword);
    if (changed) {
      setMustChangePassword(false);
      const updatedUser = { ...currentUser, mustChangePassword: false };
      setCurrentUser(updatedUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
      return { success: true };
    }
    return { success: false, error: 'Failed to update password' };
  };

  const logout = () => {
    if (isSupabaseConfigured()) {
      supabase.auth.signOut().catch(() => {});
    }
    setCurrentUser(null);
    setAssignedDoctorId(undefined);
    setAssignedAttenderId(undefined);
    setMustChangePassword(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const canAccessPatient = (patientId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;

    if (currentUser.role === 'doctor') {
      const patient = dataStore.getPatientById(patientId);
      return patient?.assignedDoctorId === assignedDoctorId && !patient?.dischargeDate;
    }

    if (currentUser.role === 'attender') {
      const patient = dataStore.getPatientById(patientId);
      if (!patient || patient.dischargeDate) return false;
      if (patient.assignedAttenderId === assignedAttenderId) return true;
      if (patient.assignedAttenders?.some((a) => a.attenderId === assignedAttenderId && a.status === 'active')) return true;
      return false;
    }

    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser?.role || null,
        isAuthenticated: !!currentUser,
        loginAsDemo,
        loginWithCredentials,
        changePassword,
        logout,
        canAccessPatient,
        assignedDoctorId,
        assignedAttenderId,
        mustChangePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
