import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Building2, Stethoscope, HeartHandshake, CheckCircle2, ChevronRight, 
  ChevronLeft, X, Sparkles, Activity, ShieldCheck, PhoneCall, 
  FileText, Users, Globe, Compass, Check
} from 'lucide-react';
import { useLanguage } from '../../i18n';

export type UserRole = 'admin' | 'doctor' | 'attender';

export interface InteractiveTourStep {
  selector: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  highlights: string[];
  roleBadge: string;
  preferredPlacement?: 'bottom' | 'top' | 'right' | 'left';
}

interface OnboardingTutorialProps {
  role: UserRole;
  isOpen: boolean;
  onClose: () => void;
}

const TOUR_STEPS: Record<UserRole, InteractiveTourStep[]> = {
  admin: [
    {
      selector: '[data-tour="nav-dashboard"]',
      title: 'Operations Dashboard',
      subtitle: 'Hospital activity & real-time census',
      description: 'Start here to see your current hospital activity, active inpatient census, critical care occupancy, and department-level allocations.',
      icon: <Building2 className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Real-time inpatient census across ICU, Cardiology & General Wards',
        'Hospital capacity and rapid admission status',
        'Direct navigation to bed management',
      ],
      roleBadge: 'Operations Admin',
      preferredPlacement: 'right',
    },
    {
      selector: '[data-tour="nav-census"]',
      title: 'Inpatient Census',
      subtitle: 'Patient records & bed assignments',
      description: 'Review admitted patients, room numbers, bed assignments, primary care doctors, and family attender credentials in one place.',
      icon: <Users className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Complete admitted patient directory with room & bed codes',
        'Dynamic 0, 1, or 2 family attender account provisioning',
        'Forced password change policy on first login for data security',
      ],
      roleBadge: 'Census & Admissions',
      preferredPlacement: 'right',
    },
    {
      selector: '[data-tour="nav-assignments"]',
      title: 'Bed & Room Management',
      subtitle: 'Capacity & ward distribution',
      description: 'Review ward-level bed availability, patient transfers, and room capacity with standard Indian hospital numbering (e.g. Room 001 Bed A1, A2).',
      icon: <Building2 className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Ward 1, ICU, and Specialty Care room assignments',
        'Bed status tracking (occupied, cleaning, available)',
        'Direct patient transfer coordination',
      ],
      roleBadge: 'Ward Operations',
      preferredPlacement: 'right',
    },
    {
      selector: '[data-tour="nav-doctors"]',
      title: 'Doctor Reassignment',
      subtitle: 'Formal handovers with clinical rationale',
      description: 'Execute formal clinical handovers between primary attending physicians with mandatory clinical rationale recorded in the patient timeline and audit log.',
      icon: <Stethoscope className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Select new primary physician with instant patient validation',
        'Mandatory handover justification required prior to saving',
        'Automated update to active care team roster',
      ],
      roleBadge: 'Clinical Governance',
      preferredPlacement: 'right',
    },
    {
      selector: '[data-tour="nav-nurse-call"]',
      title: 'Nurse Call Dispatcher',
      subtitle: 'Bedside emergency requests & 10s escalation',
      description: 'Monitor active bedside assistance calls across all wards. If staff does not respond within 10 seconds, requests automatically escalate to the Central Nursing Desk.',
      icon: <PhoneCall className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Real-time call statuses: Sent → Dispatched → Arrived → Resolved',
        'Automatic 10-second priority escalation to CRITICAL if unacknowledged',
        'Staff phone privacy protected; public desk line: +91 44 2800 0000 Ext 108',
      ],
      roleBadge: 'Nurse Dispatch',
      preferredPlacement: 'right',
    },
    {
      selector: '[data-tour="nav-alerts"]',
      title: 'Hospital Alerts Center',
      subtitle: 'Operational severity tracking',
      description: 'Review warning and critical alerts across the hospital. Note that clinical telemetry interpretation and alert acknowledgement are strictly reserved for physicians.',
      icon: <Activity className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Operational tracking of active vital threshold alerts',
        'Fail-closed security: admin cannot acknowledge clinical vital alerts',
        'Comprehensive timeline audit for every critical event',
      ],
      roleBadge: 'Hospital Alerts',
      preferredPlacement: 'right',
    },
    {
      selector: '[data-tour="nav-audit"]',
      title: 'Regulatory Audit Trail',
      subtitle: 'Immutable hospital event logging',
      description: 'Inspect a tamper-evident record of all hospital events including admissions, physician handovers, clinical alerts, and nurse responses.',
      icon: <ShieldCheck className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Permanent timestamps and role-attributed actions',
        'Tracks admissions, discharges, medication entries, and logins',
        'Complete regulatory compliance for hospital accreditation',
      ],
      roleBadge: 'Audit & Compliance',
      preferredPlacement: 'right',
    },
  ],
  doctor: [
    {
      selector: '[data-tour="nav-worklist"]',
      title: 'Clinical Worklist',
      subtitle: 'Acuity-prioritized inpatient census',
      description: 'Start here to see your assigned patients, sorted by clinical urgency (Critical, High, Stable) with live telemetry indicators.',
      icon: <Stethoscope className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Patients scoped strictly to your clinical team',
        'Quick filters for critical alerts and unacknowledged telemetry',
        'Immediate acuity status: Critical, Warning, Stable',
      ],
      roleBadge: 'Doctor Workstation',
      preferredPlacement: 'bottom',
    },
    {
      selector: '[data-tour="doctor-patient-item"]',
      title: 'Patient Clinical Chart',
      subtitle: 'Comprehensive patient record',
      description: 'Open the authorized patient record to inspect real-time vitals, history, diagnostic investigations, care team notes, and operative procedures.',
      icon: <FileText className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Strict role-based clinical workspace access',
        'Integrated medical history and pre-op evaluations',
        'Timeline of nursing entries and physician rounds',
      ],
      roleBadge: 'Patient Chart',
      preferredPlacement: 'bottom',
    },
    {
      selector: '[data-tour="doctor-vitals"]',
      title: 'Vitals & Telemetry in °F',
      subtitle: 'Standard Fahrenheit display & alarms',
      description: 'Review patient vital signs displayed in standard clinical Fahrenheit (°F) with Celsius backend storage. Audible alarm chimes alert you to unacknowledged critical vitals.',
      icon: <Activity className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Clinical display in Fahrenheit (e.g. 98.6°F, 101.4°F)',
        'Continuous repeating alert chime for critical telemetry breaches',
        'One-click physician acknowledgement to silence alarms and record audit',
      ],
      roleBadge: 'Vital Signs',
      preferredPlacement: 'bottom',
    },
    {
      selector: '[data-tour="nav-alerts"]',
      title: 'Clinical Alerts',
      subtitle: 'Active vital warnings & crisis events',
      description: 'Review warning and critical alerts. Only authorized doctors and bedside nurses have clinical authorization to acknowledge or resolve vital alerts.',
      icon: <Activity className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Acknowledge critical alerts with permanent clinician timestamp',
        'Review blood pressure, SpO2 hypoxia, and arrhythmia alerts',
        'Direct link to immediate bedside care intervention',
      ],
      roleBadge: 'Clinical Alerts',
      preferredPlacement: 'bottom',
    },
    {
      selector: '[data-tour="doctor-medications"]',
      title: 'Medication Orders',
      subtitle: 'Inpatient prescriptions & administration',
      description: 'Review active medication orders, dosages, administration schedules, and verified nurse sign-offs with contraindication checking.',
      icon: <FileText className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Nurse administration tracking with signature timestamps',
        'Perioperative and discharge medication reconciliation',
        'Automatic drug-allergy and contraindication warnings',
      ],
      roleBadge: 'Medication Orders',
      preferredPlacement: 'bottom',
    },
    {
      selector: '[data-tour="nav-reports"]',
      title: 'Verified Diagnostic Reports',
      subtitle: 'Pathology, CBC & Imaging results',
      description: 'Review verified medical reports (Pathology FNAC, Serum Calcium, Chest X-Ray, ECG) before surgical clearance or patient discharge.',
      icon: <FileText className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Diagnostic laboratory investigations and imaging results',
        'Verified status ensures reports are reviewed prior to clinical action',
        'PDF export and official hospital print formatting',
      ],
      roleBadge: 'Diagnostic Reports',
      preferredPlacement: 'bottom',
    },
    {
      selector: '[data-tour="careai-launcher"]',
      title: 'CareAI Clinical Assistant',
      subtitle: 'Doctor-scoped summary synthesis',
      description: 'Use CareAI to draft clinical summaries and pre-op briefings. All AI drafts require physician verification before being filed into the patient record.',
      icon: <Sparkles className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Fast draft synthesis of patient telemetry and recent labs',
        'Scoped strictly to authorized patients under your clinical care',
        'Mandatory doctor review ensures 100% medical accuracy and safety',
      ],
      roleBadge: 'CareAI Clinical Assistant',
      preferredPlacement: 'left',
    },
  ],
  attender: [
    {
      selector: '[data-tour="attender-patient-header"]',
      title: 'Your Loved One’s Status',
      subtitle: 'Room, bed, and clinical care context',
      description: 'Check your assigned patient\'s current room, bed (e.g. Room 204 Bed A1), admission status, and primary attending doctor at any time.',
      icon: <HeartHandshake className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Real-time room & bed numbering (e.g. Room 204 Bed A1)',
        'Primary attending doctor and assigned nursing station',
        'Privacy protected: private clinician cell numbers are kept safe',
      ],
      roleBadge: 'Family Caregiver',
      preferredPlacement: 'bottom',
    },
    {
      selector: '[data-tour="attender-vitals"]',
      title: 'Live Vital Signs in °F',
      subtitle: 'Familiar Fahrenheit temperature tracking',
      description: 'Review vital signs displayed in standard clinical Fahrenheit (°F) so you can easily understand your loved one’s recovery progress.',
      icon: <Activity className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Familiar °F temperature display (e.g. 98.6°F, 99.2°F)',
        'Heart rate, blood pressure, and oxygen saturation updates',
        'Clear explanations without confusing medical jargon',
      ],
      roleBadge: 'Patient Vitals',
      preferredPlacement: 'bottom',
    },
    {
      selector: '[data-tour="nav-meds"]',
      title: 'Medications Schedule',
      subtitle: 'Prescription timings & doses',
      description: 'Track which medicines are scheduled and see when ward nurses have administered daily doses.',
      icon: <FileText className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Scheduled medicine timings (Morning, Afternoon, Night)',
        'Administration status and nurse confirmation',
        'Non-prescriptive view: family cannot alter clinical doses',
      ],
      roleBadge: 'Prescriptions',
      preferredPlacement: 'bottom',
    },
    {
      selector: '[data-tour="nav-reports"]',
      title: 'Medical Reports',
      subtitle: 'Verified test results & summaries',
      description: 'Access official diagnostic records and lab reports once they have been approved and verified by your clinical care team.',
      icon: <FileText className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Access verified pathology and blood test results',
        'Download or print official clinical discharge summaries',
        'Restricted until clinical team completes review',
      ],
      roleBadge: 'Medical Records',
      preferredPlacement: 'bottom',
    },
    {
      selector: '[data-tour="attender-nurse-call"]',
      title: 'Urgent Nurse Call',
      subtitle: '1-tap bedside help with 10s escalation',
      description: 'Request urgent nurse assistance for pain relief, vitals check, or IV lines. If staff does not respond within 10 seconds, requests automatically escalate to the Central Nursing Desk.',
      icon: <PhoneCall className="w-5 h-5 text-blue-700" />,
      highlights: [
        'One-tap urgent nurse call in top-right navigation header',
        'Automatic 10-second escalation if staff has not yet arrived',
        'Public hospital emergency line: +91 44 2800 0000 Ext 108',
      ],
      roleBadge: 'Emergency & Assistance',
      preferredPlacement: 'bottom',
    },
    {
      selector: '[data-tour="careai-launcher"]',
      title: 'CareAI Assistant',
      subtitle: 'Voice-enabled help in 22 Indian languages',
      description: 'Ask questions about hospital policies, cafeteria hours, and daily care routines in Tamil, Hindi, English, and more with voice input and natural speech.',
      icon: <Sparkles className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Independent CareAI language: choose Tamil, Telugu, Hindi, or English',
        'Voice synthesis with Tamil ta-IN audio output',
        'Safe family boundaries: compassionate, non-diagnostic assistance',
      ],
      roleBadge: 'Multilingual CareAI',
      preferredPlacement: 'left',
    },
    {
      selector: '[data-tour="language-selector"]',
      title: 'Language Selector',
      subtitle: 'Change the application display language',
      description: 'Switch the entire application interface to Tamil, Hindi, Telugu, or English at any time. The UI language remains completely independent from CareAI.',
      icon: <Globe className="w-5 h-5 text-blue-700" />,
      highlights: [
        'Supports 22 Scheduled Indian Languages plus English',
        'Decoupled architecture: change UI without altering CareAI speech',
        'Instant translation of all navigation, dashboards, and tables',
      ],
      roleBadge: 'Language Settings',
      preferredPlacement: 'bottom',
    },
  ],
};

export const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({ role, isOpen, onClose }) => {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetFound, setTargetFound] = useState<boolean>(true);
  const steps = TOUR_STEPS[role] || TOUR_STEPS.attender;
  const step = steps[currentStep];

  const handleFinish = useCallback(() => {
    try {
      localStorage.setItem(`healthconnect_tutorial_${role}_completed`, 'true');
    } catch {
      // ignore
    }
    onClose();
  }, [role, onClose]);

  const handleSkip = useCallback(() => {
    try {
      localStorage.setItem(`healthconnect_tutorial_${role}_completed`, 'true');
    } catch {
      // ignore
    }
    onClose();
  }, [role, onClose]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const contentRef = useRef<HTMLDivElement>(null);

  // Prevent background scrolling while tutorial is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  // Auto-scroll content area to top whenever active step changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  // Locate target DOM element and measure its bounding box
  const measureTarget = useCallback(() => {
    if (!isOpen || !step) return;
    const el = document.querySelector(step.selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect(rect);
        setTargetFound(true);
        const computed = window.getComputedStyle(el);
        if (computed.position !== 'fixed') {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
        return;
      }
    }
    setTargetRect(null);
    setTargetFound(false);
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) return;
    measureTarget();

    // Re-measure on resize or scroll
    const handleUpdate = () => measureTarget();
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    // Keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, currentStep, measureTarget, handleSkip]);

  if (!isOpen) return null;

  // Calculate intelligent viewport-safe tooltip position relative to target rect
  const computeTooltipStyle = (): React.CSSProperties => {
    const margin = 16;
    const tooltipWidth = Math.min(420, window.innerWidth - 32);

    if (!targetRect || !targetFound) {
      // Centered fallback
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '460px',
        width: 'calc(100vw - 32px)',
        maxHeight: 'min(calc(100dvh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)), calc(100vh - 32px))',
        zIndex: 70,
      };
    }

    // 1. Target is near right edge (e.g. Floating CareAI launcher or language selector)
    // On tablet / desktop (window.innerWidth >= 768)
    if (targetRect.right > window.innerWidth - 140 && window.innerWidth >= 768) {
      const right = Math.max(margin, window.innerWidth - targetRect.left + 14);

      if (targetRect.top > window.innerHeight / 2) {
        // Target is in the lower half of the viewport (e.g. CareAI launcher at bottom right)
        const bottom = Math.max(margin, window.innerHeight - targetRect.bottom);
        return {
          position: 'fixed',
          bottom: `${bottom}px`,
          right: `${right}px`,
          width: `${tooltipWidth}px`,
          maxHeight: `min(calc(100dvh - ${bottom + margin}px - env(safe-area-inset-top, 0px)), calc(100vh - ${bottom + margin}px))`,
          zIndex: 70,
        };
      } else {
        // Target is in the upper half of the viewport
        const top = Math.max(margin, targetRect.top - 10);
        return {
          position: 'fixed',
          top: `${top}px`,
          right: `${right}px`,
          width: `${tooltipWidth}px`,
          maxHeight: `min(calc(100dvh - ${top + margin}px - env(safe-area-inset-bottom, 0px)), calc(100vh - ${top + margin}px))`,
          zIndex: 70,
        };
      }
    }

    // 2. Target is in a left sidebar on desktop (e.g. navigation items)
    const isSidebar = targetRect.left < 280 && window.innerWidth >= 1024;
    if (isSidebar) {
      const left = Math.min(window.innerWidth - tooltipWidth - margin, targetRect.right + 14);
      if (targetRect.top > window.innerHeight / 2) {
        const bottom = Math.max(margin, window.innerHeight - targetRect.bottom);
        return {
          position: 'fixed',
          bottom: `${bottom}px`,
          left: `${left}px`,
          width: `${tooltipWidth}px`,
          maxHeight: `min(calc(100dvh - ${bottom + margin}px - env(safe-area-inset-top, 0px)), calc(100vh - ${bottom + margin}px))`,
          zIndex: 70,
        };
      } else {
        const top = Math.max(margin, targetRect.top - 10);
        return {
          position: 'fixed',
          top: `${top}px`,
          left: `${left}px`,
          width: `${tooltipWidth}px`,
          maxHeight: `min(calc(100dvh - ${top + margin}px - env(safe-area-inset-bottom, 0px)), calc(100vh - ${top + margin}px))`,
          zIndex: 70,
        };
      }
    }

    // 3. General Target (Above / Below placement)
    // Horizontal alignment: Center on target, clamped within viewport margins
    const targetCenter = targetRect.left + targetRect.width / 2;
    let left = targetCenter - tooltipWidth / 2;
    left = Math.max(margin, Math.min(window.innerWidth - tooltipWidth - margin, left));

    const spaceBelow = window.innerHeight - targetRect.bottom;
    const spaceAbove = targetRect.top;

    // Prefer below if at least 340px available below, or if more space below than above
    const preferBelow = spaceBelow >= 340 || spaceBelow >= spaceAbove;

    if (preferBelow) {
      const top = Math.max(margin, Math.min(window.innerHeight - 200, targetRect.bottom + 12));
      return {
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${tooltipWidth}px`,
        maxHeight: `min(calc(100dvh - ${top + margin}px - env(safe-area-inset-bottom, 0px)), calc(100vh - ${top + margin}px))`,
        zIndex: 70,
      };
    } else {
      // Place above target using bottom positioning
      const bottom = Math.max(margin, Math.min(window.innerHeight - 200, window.innerHeight - targetRect.top + 12));
      return {
        position: 'fixed',
        bottom: `${bottom}px`,
        left: `${left}px`,
        width: `${tooltipWidth}px`,
        maxHeight: `min(calc(100dvh - ${bottom + margin}px - env(safe-area-inset-top, 0px)), calc(100vh - ${bottom + margin}px))`,
        zIndex: 70,
      };
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="tour-step-title">
      {/* 1. DOM Element Spotlight Cutout: frames real DOM element and dims everything else */}
      {targetRect && targetFound ? (
        <div
          className="fixed pointer-events-none transition-all duration-300 ease-out z-[65]"
          style={{
            top: Math.max(0, targetRect.top - 6),
            left: Math.max(0, targetRect.left - 6),
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            borderRadius: 12,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.72)',
            border: '2px solid #38bdf8',
          }}
        />
      ) : (
        /* Full Dimmed Backdrop if target not currently found */
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity z-[65]" />
      )}

      {/* 2. Interactive Tooltip Card positioned intelligently next to target element */}
      <div 
        style={computeTooltipStyle()} 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col pointer-events-auto animate-in fade-in zoom-in-95 duration-200 max-h-[min(calc(100dvh-32px),calc(100vh-32px))]"
      >
        {/* Header: Role Badge, Step Indicator & Skip (Sticky / Pinned) */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--brand-navy,#0f172a)] text-white text-[10px] font-bold">
              HC
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                {step.roleBadge} Tour
              </span>
              <span className="mx-1.5 text-slate-300">•</span>
              <span className="text-[11px] font-semibold text-blue-700">
                {t('tour.stepOf', { current: currentStep + 1, total: steps.length })}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            className="flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
            aria-label={t('tour.skip')}
          >
            <span>{t('tour.skip')}</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step Progress Bar (Sticky / Pinned) */}
        <div className="shrink-0 h-1 w-full bg-slate-100">
          <div 
            className="h-full bg-blue-700 transition-all duration-300 ease-out"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Step Body (Scrollable Content Container with auto-scroll on step change) */}
        <div 
          ref={contentRef}
          tabIndex={0}
          role="region"
          aria-label={step.title}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3 focus:outline-hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-slate-50 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-200 text-blue-700">
              {step.icon}
            </div>
            <div>
              <h2 id="tour-step-title" className="text-base font-bold text-slate-950">
                {step.title}
              </h2>
              <p className="text-xs font-semibold text-blue-700">
                {step.subtitle}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {step.description}
          </p>

          {/* Highlights */}
          <div className="space-y-1.5 rounded-lg bg-slate-50 border border-slate-200/80 p-2.5">
            <ul className="space-y-1">
              {step.highlights.map((highlight, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Navigation (Sticky / Pinned) */}
        <div className="shrink-0 flex items-center justify-between border-t border-slate-100 bg-slate-50/90 px-4 py-2.5">
          {/* Step Dots */}
          <div className="flex items-center gap-1">
            {steps.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentStep ? 'w-5 bg-blue-700' : 'w-1.5 bg-slate-300'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={`flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                currentStep === 0
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>{t('tour.back')}</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="flex min-h-9 items-center gap-1 rounded-lg bg-blue-700 px-3.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              <span>{currentStep === steps.length - 1 ? t('tour.finish') : t('tour.next')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
