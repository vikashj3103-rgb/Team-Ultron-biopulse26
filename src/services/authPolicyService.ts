import { UserRole } from '../types';

export type StaffCredentialRole = Extract<UserRole, 'admin' | 'doctor'>;

type StaffSignInDecision =
  | { success: true; role: StaffCredentialRole }
  | { success: false; error: string };

/**
 * Staff credential sign-in is deny-by-default until a trusted identity provider
 * verifies the submitted credentials. Demo personas use the separate explicit
 * demo-access flow and must never be treated as authenticated credentials.
 */
export function decideStaffCredentialSignIn(
  role: StaffCredentialRole,
  verifiedByTrustedProvider: boolean
): StaffSignInDecision {
  if (verifiedByTrustedProvider) return { success: true, role };

  return {
    success: false,
    error: 'Staff password sign-in is not configured. Choose Demo access to enter a demo workspace.',
  };
}
