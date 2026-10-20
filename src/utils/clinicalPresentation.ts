import { VitalAlert } from '../types';

export interface ClinicalPresentationState {
  isActive: boolean;
  isAcknowledged: boolean;
  isResponding: boolean;
  isResolved: boolean;
  isCritical: boolean;
  isAttention: boolean;
  canAcknowledge: boolean;
  canRequestNurse: boolean;
  canResolve: boolean;
  elapsedSeconds: number;
  isEmergencyTimeoutExceeded: boolean;
  emergencyEscalationAllowed: boolean;
  isEscalated: boolean;
  acknowledgedBeforeEscalation: boolean;
  escalatedBeforeAcknowledgement: boolean;
  escalationNotice?: string;
  statusBadgeLabel: string;
  statusBadgeClass: string;
}

/**
 * Single authoritative clinical presentation derivation function.
 * Guarantees that Doctor, Attender, and Admin views present completely
 * consistent, non-contradictory lifecycle states.
 */
export function getClinicalPresentationState(
  alert: VitalAlert | undefined,
  demoTimeoutSeconds: number = 30,
  currentTime: number = Date.now()
): ClinicalPresentationState {
  if (!alert) {
    return {
      isActive: false,
      isAcknowledged: false,
      isResponding: false,
      isResolved: false,
      isCritical: false,
      isAttention: false,
      canAcknowledge: false,
      canRequestNurse: false,
      canResolve: false,
      elapsedSeconds: 0,
      isEmergencyTimeoutExceeded: false,
      emergencyEscalationAllowed: false,
      isEscalated: false,
      acknowledgedBeforeEscalation: false,
      escalatedBeforeAcknowledgement: false,
      statusBadgeLabel: 'NORMAL',
      statusBadgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    };
  }

  const isResolved = alert.status === 'resolved';
  const isResponding = alert.status === 'responding';
  const isAcknowledged = alert.status === 'acknowledged';
  const isActive = alert.status === 'active';
  const isCritical = alert.severity === 'critical';
  const isAttention = alert.severity === 'attention';

  const alertStart = alert.firstDetectedAt
    ? new Date(alert.firstDetectedAt).getTime()
    : alert.timestamp
    ? new Date(alert.timestamp).getTime()
    : currentTime;
  const elapsedSeconds = Math.max(0, Math.floor((currentTime - alertStart) / 1000));

  const isEscalated = alert.escalationStatus === 'ESCALATED';
  const hasDoctorAcknowledged = Boolean(alert.acknowledgedAt) || isAcknowledged || isResponding || isResolved;

  // Emergency timeout is ONLY exceeded when the episode is ACTIVE, CRITICAL, NOT YET ACKNOWLEDGED, and elapsed >= timeout
  const isEmergencyTimeoutExceeded = isActive && isCritical && !hasDoctorAcknowledged && elapsedSeconds >= demoTimeoutSeconds;

  // Escalation button allowed ONLY if ACTIVE + CRITICAL + UNACKNOWLEDGED + TIMEOUT EXCEEDED + NOT YET ESCALATED
  const emergencyEscalationAllowed = isEmergencyTimeoutExceeded && !isEscalated;

  // Escalation historical context:
  const acknowledgedBeforeEscalation = hasDoctorAcknowledged && !isEscalated;
  const escalatedBeforeAcknowledgement = isEscalated && hasDoctorAcknowledged;

  let escalationNotice: string | undefined;
  if (escalatedBeforeAcknowledgement) {
    escalationNotice = 'Emergency escalation was requested before clinician acknowledgement.';
  } else if (isEscalated) {
    escalationNotice = '🚨 Hospital Emergency Response Team has been alerted for immediate bedside intervention.';
  }

  // Action permissions:
  // Can acknowledge ONLY if strictly active
  const canAcknowledge = isActive && !isResolved;
  const canRequestNurse = (isAcknowledged || isResponding) && !isResolved;
  const canResolve = (isAcknowledged || isResponding) && !isResolved;

  const statusBadgeLabel = isResolved
    ? 'RESOLVED'
    : isResponding
    ? 'RESPONDING'
    : isAcknowledged
    ? 'ACKNOWLEDGED'
    : isEscalated
    ? 'ESCALATED'
    : isCritical
    ? 'CRITICAL'
    : 'ATTENTION';

  const statusBadgeClass = isResolved
    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
    : isResponding
    ? 'bg-blue-100 text-blue-900 border-blue-300'
    : isAcknowledged
    ? 'bg-amber-100 text-amber-900 border-amber-300'
    : isEscalated
    ? 'bg-red-700 text-white border-red-800'
    : isCritical
    ? 'bg-red-100 text-red-900 border-red-300'
    : 'bg-amber-100 text-amber-900 border-amber-300';

  return {
    isActive,
    isAcknowledged,
    isResponding,
    isResolved,
    isCritical,
    isAttention,
    canAcknowledge,
    canRequestNurse,
    canResolve,
    elapsedSeconds,
    isEmergencyTimeoutExceeded,
    emergencyEscalationAllowed,
    isEscalated,
    acknowledgedBeforeEscalation,
    escalatedBeforeAcknowledgement,
    escalationNotice,
    statusBadgeLabel,
    statusBadgeClass,
  };
}
