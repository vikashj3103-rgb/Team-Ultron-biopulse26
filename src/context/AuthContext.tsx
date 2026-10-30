import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { dataStore } from '../services/dataStore';
import { DEMO_MODE_ENABLED } from '../services/runtimeMode';

export interface ActiveHospitalMembership {
  id: string;
  hospitalId: string;
  hospitalName: string;
  role: UserRole;
  status: 'active';
  permissions: string[];
}

interface AuthContextType {
  currentUser: UserProfile | null;
  membership: ActiveHospitalMembership | null;
  permissions: string[];
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoSession: boolean;
  loginAsDemo: (role: UserRole) => boolean;
  loginWithCredentials: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  canAccessPatient: (patientId: string) => boolean;
  assignedDoctorId?: string;
  assignedAttenderId?: string;
  mustChangePassword?: boolean;
}

const DEMO_USERS: Record<UserRole, UserProfile & { assignedDoctorId?: string; assignedAttenderId?: string }> = {
  doctor: { id: 'user-doc-arun', name: 'Dr. Arun Kumar', email: 'doctor.cardio@careconnect.demo', role: 'doctor', phone: '+91 98401 23456', createdAt: new Date().toISOString(), assignedDoctorId: 'doc-arun' },
  attender: { id: 'user-att-vikash', name: 'Vikash Kumar', email: 'attender.vikash@careconnect.demo', role: 'attender', phone: '+91 98765 43210', createdAt: new Date().toISOString(), assignedAttenderId: 'att-vikash' },
  admin: { id: 'user-admin', name: 'Clinical Administrator', email: 'admin@careconnect.demo', role: 'admin', phone: '+91 98400 00000', createdAt: new Date().toISOString() },
};
const WORKSPACE_ROLES: readonly string[] = ['admin', 'doctor', 'attender'];
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getInitialDemoRole = (): UserRole | null => {
  if (!DEMO_MODE_ENABLED || typeof window === 'undefined') return null;
  try {
    const saved = window.sessionStorage.getItem('careconnect_demo_role') as UserRole | null;
    if (saved && DEMO_USERS[saved]) return saved;
  } catch {}
  return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialRole = getInitialDemoRole();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => initialRole ? DEMO_USERS[initialRole] : null);
  const [membership, setMembership] = useState<ActiveHospitalMembership | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [assignedDoctorId, setAssignedDoctorId] = useState<string | undefined>(() => initialRole === 'doctor' ? 'doc-arun' : undefined);
  const [assignedAttenderId, setAssignedAttenderId] = useState<string | undefined>(() => initialRole === 'attender' ? 'att-vikash' : undefined);
  const [isLoading, setIsLoading] = useState(() => initialRole ? false : isSupabaseConfigured());
  const [isDemoSession, setIsDemoSession] = useState<boolean>(() => Boolean(initialRole));
  const demoSessionRef = useRef(Boolean(initialRole));
  const skipSignInHydration = useRef(false);
  const generation = useRef(0);

  const clearIdentity = useCallback(() => {
    setCurrentUser(null);
    setMembership(null);
    setPermissions([]);
    setAssignedDoctorId(undefined);
    setAssignedAttenderId(undefined);
  }, []);

  const hydrateTrustedIdentity = useCallback(async (userId: string, accessToken?: string) => {
    if (!isSupabaseConfigured()) return { success: false as const, error: 'Supabase Auth is not configured.' };
    const currentGeneration = ++generation.current;
    const { data: verified, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !verified.user || verified.user.id !== userId) {
      return { success: false as const, error: 'The authentication session could not be verified.' };
    }
    const authUser = verified.user;
    const [profileResult, membershipResult] = await Promise.all([
      supabase.from('profiles').select('name,email,phone,avatar,created_at').eq('id', authUser.id).maybeSingle(),
      supabase.from('hospital_memberships').select('id,hospital_id,role,status').eq('user_id', authUser.id).eq('status', 'active'),
    ]);
    if (membershipResult.error) return { success: false as const, error: 'Unable to load hospital membership.' };
    const memberships = membershipResult.data || [];
    if (memberships.length !== 1) {
      return {
        success: false as const,
        error: memberships.length === 0
          ? 'This account has no active hospital membership.'
          : 'This account has multiple hospital memberships; hospital switching is not enabled yet.',
      };
    }
    const active = memberships[0];
    if (!WORKSPACE_ROLES.includes(active.role)) {
      return { success: false as const, error: 'This hospital role is not available in the current workspace.' };
    }
    const role = active.role as UserRole;
    const [hospitalResult, permissionResult, clinicianResult] = await Promise.all([
      supabase.from('hospitals').select('name').eq('id', active.hospital_id).maybeSingle(),
      supabase.from('hospital_role_permissions').select('permission').eq('role', role),
      role === 'doctor'
        ? supabase.from('doctors').select('id').eq('profile_id', authUser.id).eq('hospital_id', active.hospital_id).maybeSingle()
        : role === 'attender'
          ? supabase.from('attenders').select('id').eq('profile_id', authUser.id).eq('hospital_id', active.hospital_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
    ]);
    if (currentGeneration !== generation.current) {
      return { success: false as const, error: 'Authentication state changed while membership was loading.' };
    }
    if (hospitalResult.error || !hospitalResult.data || permissionResult.error) {
      return { success: false as const, error: 'Unable to verify the hospital workspace and its permissions.' };
    }
    const profile = profileResult.data;
    const rolePermissions = (permissionResult.data || []).map((item) => item.permission as string);
    const user: UserProfile = {
      id: authUser.id,
      name: profile?.name || authUser.user_metadata?.full_name || authUser.email || 'Hospital user',
      email: authUser.email || profile?.email || '',
      role,
      phone: profile?.phone || undefined,
      avatar: profile?.avatar || undefined,
      createdAt: profile?.created_at || authUser.created_at,
    };
    setCurrentUser(user);
    setMembership({
      id: active.id,
      hospitalId: active.hospital_id,
      hospitalName: hospitalResult.data.name,
      role,
      status: 'active',
      permissions: rolePermissions,
    });
    setPermissions(rolePermissions);
    setAssignedDoctorId(role === 'doctor' ? clinicianResult.data?.id : undefined);
    setAssignedAttenderId(role === 'attender' ? clinicianResult.data?.id : undefined);
    setIsDemoSession(false);
    demoSessionRef.current = false;
    return { success: true as const, role };
  }, []);

  useEffect(() => {
    let mounted = true;
    try {
      // Remove the retired client-auth cache; it is never consulted for identity.
      if (typeof window !== 'undefined') window.localStorage.removeItem('careconnect_auth_session_v2');
    } catch {
      // Browser storage can be disabled.
    }
    const applySession = async (userId?: string, accessToken?: string) => {
      if (!userId) {
        if (!demoSessionRef.current) clearIdentity();
        if (mounted && !demoSessionRef.current) setIsLoading(false);
        return;
      }
      const result = await hydrateTrustedIdentity(userId, accessToken).catch(() => ({
        success: false as const,
        error: 'Unable to verify the hospital session.',
      }));
      if (!mounted) return;
      if (!result.success && !demoSessionRef.current) {
        clearIdentity();
        void supabase.auth.signOut().catch(() => {});
      }
      setIsLoading(false);
    };
    if (!isSupabaseConfigured()) {
      return () => { mounted = false; };
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase recommends keeping this callback synchronous; defer membership queries.
      if (event === 'SIGNED_IN' && skipSignInHydration.current) {
        skipSignInHydration.current = false;
        return;
      }
      globalThis.setTimeout(() => {
        if (mounted) void applySession(session?.user.id, session?.access_token);
      }, 0);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
      generation.current += 1;
    };
  }, [clearIdentity, hydrateTrustedIdentity]);

  const loginAsDemo = (role: UserRole): boolean => {
    if (!DEMO_MODE_ENABLED) return false;
    if (!demoSessionRef.current && isSupabaseConfigured()) void supabase.auth.signOut().catch(() => {});
    generation.current += 1;
    demoSessionRef.current = true;
    setCurrentUser(DEMO_USERS[role]);
    setMembership(null);
    setPermissions([]);
    setAssignedDoctorId(role === 'doctor' ? 'doc-arun' : undefined);
    setAssignedAttenderId(role === 'attender' ? 'att-vikash' : undefined);
    setIsDemoSession(true);
    setIsLoading(false);
    try {
      if (typeof window !== 'undefined') window.sessionStorage.setItem('careconnect_demo_role', role);
    } catch {}
    return true;
  };

  useEffect(() => {
    if (DEMO_MODE_ENABLED && typeof window !== 'undefined') {
      try {
        const savedDemo = window.sessionStorage.getItem('careconnect_demo_role') as UserRole | null;
        if (savedDemo && DEMO_USERS[savedDemo] && !currentUser) {
          loginAsDemo(savedDemo);
        }
      } catch {}
    }
  }, []);

  const loginWithCredentials = async (email: string, password: string): Promise<{ success: boolean; error?: string; role?: UserRole }> => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Hospital sign-in is not configured. Contact your HealthConnect administrator.' };
    }
    const cleanEmail = email.trim();
    if (!cleanEmail.includes('@')) {
      return { success: false, error: 'Sign in with the email registered to your hospital account.' };
    }
    demoSessionRef.current = false;
    setIsDemoSession(false);
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // A new sign-in attempt still replaces the previous provider session if reachable.
    }
    clearIdentity();
    skipSignInHydration.current = true;
    let signInResult;
    try {
      signInResult = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    } catch {
      skipSignInHydration.current = false;
      setIsLoading(false);
      return { success: false, error: 'The hospital sign-in service is unavailable.' };
    }
    const { data, error } = signInResult;
    if (error || !data.user || !data.session) {
      skipSignInHydration.current = false;
      setIsLoading(false);
      return { success: false, error: error?.message || 'Unable to verify the submitted credentials.' };
    }
    let result;
    try {
      result = await hydrateTrustedIdentity(data.user.id, data.session.access_token);
    } catch {
      result = { success: false as const, error: 'Unable to load this account\'s hospital membership.' };
    }
    skipSignInHydration.current = false;
    if (!result.success) {
      await supabase.auth.signOut().catch(() => {});
      clearIdentity();
      setIsLoading(false);
      return { success: false, error: result.error };
    }
    setIsLoading(false);
    return { success: true, role: result.role };
  };

  const changePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (isDemoSession || !currentUser || !isSupabaseConfigured()) {
      return { success: false, error: 'Password changes require a verified hospital account.' };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return error ? { success: false, error: error.message } : { success: true };
  };

  const logout = () => {
    const shouldSignOut = !demoSessionRef.current && isSupabaseConfigured();
    demoSessionRef.current = false;
    generation.current += 1;
    setIsDemoSession(false);
    setIsLoading(false);
    clearIdentity();
    try {
      if (typeof window !== 'undefined') window.sessionStorage.removeItem('careconnect_demo_role');
    } catch {}
    if (shouldSignOut) void supabase.auth.signOut().catch(() => {});
  };

  const canAccessPatient = (patientId: string): boolean => {
    // Client checks scope synthetic demo UI only. Hospital access is enforced by database RLS.
    if (!currentUser || !isDemoSession) return false;
    if (currentUser.role === 'admin') return true;
    const patient = dataStore.getPatientById(patientId);
    if (!patient || patient.dischargeDate) return false;
    if (currentUser.role === 'doctor') return patient.assignedDoctorId === assignedDoctorId;
    if (currentUser.role === 'attender') {
      return patient.assignedAttenderId === assignedAttenderId
        || Boolean(patient.assignedAttenders?.some((item) => item.attenderId === assignedAttenderId && item.status === 'active'));
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      membership,
      permissions,
      role: membership?.role || (isDemoSession ? currentUser?.role || null : null),
      isAuthenticated: Boolean(currentUser),
      isLoading,
      isDemoSession,
      loginAsDemo,
      loginWithCredentials,
      changePassword,
      logout,
      canAccessPatient,
      assignedDoctorId,
      assignedAttenderId,
      mustChangePassword: false,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
