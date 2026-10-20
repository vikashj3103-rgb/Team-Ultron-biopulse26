import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../services/dataStore';
import { Patient, PatientRequest } from '../types';
import { NotificationCenter } from '../components/common/NotificationCenter';
import { RealtimeStatusBadge } from '../components/common/RealtimeStatusBadge';
import { ForcePasswordChangeModal } from '../components/auth/ForcePasswordChangeModal';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { MobilePrimaryNav } from '../components/common/ClinicalUI';
import { useLanguage } from '../i18n';
import { getLocalizedRelation } from '../utils/relationTranslator';
import { UrgentNurseCallModal } from '../components/requests/UrgentNurseCallModal';
import { AttenderAiAssistantModal } from '../components/ai/AttenderAiAssistantModal';
import { 
  HeartHandshake, Bell, Volume2, VolumeX, PhoneCall,
  LogOut, Activity, Pill, Video, User, FileText, Compass, MoreHorizontal, HelpCircle,
  Menu, X
} from 'lucide-react';
import { OnboardingTutorial } from '../components/common/OnboardingTutorial';
import { FloatingCareAiButton } from '../components/ai/FloatingCareAiButton';
import { CareAiMascot } from '../components/ai/CareAiMascot';

export const AttenderLayout: React.FC = () => {
  const { currentUser, assignedAttenderId, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [patient, setPatient] = useState<Patient | undefined>(() =>
    assignedAttenderId ? dataStore.getPatientByAttender(assignedAttenderId) : undefined
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => dataStore.getSoundEnabled());
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      return localStorage.getItem('healthconnect_tutorial_attender_completed') !== 'true';
    } catch {
      return false;
    }
  });
  const [activeRequests, setActiveRequests] = useState<PatientRequest[]>([]);
  const [showCallNurseModal, setShowCallNurseModal] = useState<boolean>(false);
  const [showCareAiModal, setShowCareAiModal] = useState<boolean>(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const p = assignedAttenderId ? dataStore.getPatientByAttender(assignedAttenderId) : undefined;
      setPatient(p);
      setSoundEnabled(dataStore.getSoundEnabled());
      if (p) {
        setActiveRequests(dataStore.getRequests(p.id).filter((r) => r.status === 'NEW'));
      }
    };
    update();
    return dataStore.subscribe(update);
  }, [assignedAttenderId]);

  useEffect(() => {
    if (!showMoreMenu && !sidebarOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMoreMenu(false);
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showMoreMenu, sidebarOpen]);

  const toggleSound = () => {
    const nextState = !soundEnabled;
    dataStore.setSoundEnabled(nextState);
    setSoundEnabled(nextState);
    if (nextState) {
      dataStore.playChime('info');
    }
  };

  const drawerNavClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-colors ${
      isActive
        ? 'bg-[#EFF6FF] text-[#2563EB] shadow-2xs font-semibold'
        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] pb-20 xl:pb-0">
      {/* Attender Clean Rebalanced Top Navigation */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#E2E8F0] shadow-2xs">
        <div className="mx-auto flex min-h-16 w-full max-w-screen-2xl items-center justify-between gap-2 px-3 py-2 sm:px-6 xl:px-8">
          {/* Brand + Attender Patient Context */}
          <div className="flex items-center gap-2.5 sm:gap-3" data-tour="attender-patient-header">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              data-tour="header-hamburger"
              aria-label="Toggle navigation"
              aria-expanded={sidebarOpen}
              className="flex h-10 w-10 min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
            >
              <Menu className="w-5 h-5 text-[#0F172A]" />
            </button>

            <button
              type="button"
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-2xs"
              onClick={() => navigate('/attender')}
              aria-label={`${t('app.name')} home`}
            >
              <HeartHandshake className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-[#0F172A] sm:text-base whitespace-nowrap">{t('app.name')}</span>
                <span className="hidden md:inline-flex rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 uppercase tracking-wide whitespace-nowrap">
                  {t('nav.nonClinicalCaregiver')}
                </span>
              </div>
              {patient ? (
                <p className="truncate text-[11px] font-medium text-[#64748B] max-w-[95px] sm:max-w-[200px] lg:max-w-none">
                  {t('nav.caringForPatient', { name: patient.name, room: patient.room, bed: patient.bed })}
                </p>
              ) : (
                <p className="text-[11px] text-[#64748B]">{t('nav.familyCaregiverPortal')}</p>
              )}
            </div>
          </div>

          {/* Right Action Tools Aligned on Single Row Baseline */}
          <div className="flex items-center justify-end gap-1 sm:gap-1.5 lg:gap-2 shrink-0">
            {/* 1. Language Selector */}
            <div data-tour="language-selector" className="shrink-0">
              <LanguageSelector />
            </div>

            {/* 2. LIVE Realtime Status */}
            <div className="hidden sm:block shrink-0">
              <span className="hidden xl:inline-flex"><RealtimeStatusBadge /></span>
              <span className="xl:hidden"><RealtimeStatusBadge compact /></span>
            </div>

            {/* 3. Audio Alert Sound ON/OFF Toggle */}
            <button
              type="button"
              onClick={toggleSound}
              className={`hidden sm:flex min-h-10 min-w-10 sm:min-h-11 sm:min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors xl:px-2.5 ${
                soundEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
              }`}
              title={soundEnabled ? t('nav.alertChimesActive') : t('nav.alertChimesMuted')}
              aria-label={soundEnabled ? t('common.muteAlerts') : t('common.unmuteAlerts')}
              aria-pressed={soundEnabled}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                  <span className="hidden 2xl:inline">{t('nav.soundOn')}</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  <span className="hidden 2xl:inline">{t('nav.soundOff')}</span>
                </>
              )}
            </button>

            {/* 4. Urgent Call Nurse Emergency Action */}
            <button
              type="button"
              onClick={() => setShowCallNurseModal(true)}
              data-tour="attender-nurse-call"
              className="inline-flex min-h-10 min-w-10 sm:min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#1D4ED8] bg-[#2563EB] px-2 sm:px-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] active:bg-[#1E40AF] shadow-2xs"
              title={t('nav.nurseAssistanceOptions')}
              aria-label={t('nav.callNurse')}
            >
              <PhoneCall className="h-4 w-4 shrink-0" />
              <span className="hidden lg:inline whitespace-nowrap">{t('nav.callNurse')}</span>
            </button>

            {/* 5. System Guide / Onboarding Tutorial Button */}
            <button
              type="button"
              onClick={() => setShowTutorial(true)}
              className="hidden md:flex min-h-10 min-w-10 sm:min-h-11 sm:min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
              title={t('nav.familyGuideTooltip')}
              aria-label={t('nav.familyGuideAria')}
            >
              <HelpCircle className="w-5 h-5" />
            </button>

            {/* 6. Notification Bell with Active Badge */}
            <button
              type="button"
              onClick={() => setIsNotifOpen(true)}
              className="relative flex min-h-10 min-w-10 sm:min-h-11 sm:min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
              aria-label={t('common.openNotifications')}
            >
              <Bell className="w-5 h-5" />
              {activeRequests.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white shadow-xs">
                  {activeRequests.length}
                </span>
              )}
            </button>

            {/* 7. Attender User Profile Pill */}
            <div className="hidden sm:flex items-center gap-1.5 border-l border-slate-200 pl-1.5 sm:pl-2 shrink-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white shadow-2xs">
                {currentUser?.name?.charAt(0) || 'C'}
              </div>
              <div className="hidden 2xl:block text-left">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {currentUser?.name || t('nav.defaultCaregiver')}
                </div>
                <span className="text-[10px] font-semibold text-emerald-700">
                  {(() => {
                    const matchedLink = patient?.assignedAttenders?.find(
                      (a) => a.attenderId === assignedAttenderId || a.attenderName.toLowerCase() === currentUser?.name?.toLowerCase()
                    );
                    const rel = matchedLink?.relation || patient?.assignedAttenderRelation;
                    return rel 
                      ? `${getLocalizedRelation(rel, t)} • ${t('attender.attenderBadge')}`
                      : t('nav.familyAttender');
                  })()}
                </span>
              </div>
            </div>

            {/* 8. Logout */}
            <button
              type="button"
              onClick={logout}
              className="hidden md:flex min-h-10 min-w-10 sm:min-h-11 sm:min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
              title={t('common.signOut')}
              aria-label={t('common.signOut')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Slide-over Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      {/* Clean White Clinical Navigation Drawer */}
      <aside
        aria-label="Family attender navigation drawer"
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col justify-between border-r border-[#E2E8F0] bg-white shadow-2xl transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Top Header with Branding and Dedicated X Close Button */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#E2E8F0] bg-white">
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => {
              navigate('/attender');
              setSidebarOpen(false);
            }}
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-navy)] flex items-center justify-center text-white shadow-xs">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-[#0F172A]">{t('app.name')}</span>
              <span className="ml-1.5 rounded border border-emerald-200 bg-emerald-50 px-1 py-0.2 text-[9px] font-semibold text-emerald-800">
                {t('role.attender').toUpperCase()}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC] transition-colors focus:outline-none"
            aria-label="Close navigation drawer"
          >
            <X className="w-4 h-4 text-[#0F172A]" />
          </button>
        </div>

        <div className="p-4 space-y-6 overflow-y-auto flex-1">
          {/* Patient Context Card */}
          {patient && (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">
                {t('nav.patientInformation')}
              </span>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A]">{patient.name}</span>
                <span className={`w-2 h-2 rounded-full ${patient.status === 'critical' ? 'bg-[#DC2626]' : patient.status === 'attention' ? 'bg-[#D97706]' : 'bg-[#059669]'}`}></span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                {patient.room} • {patient.bed} ({patient.department || 'General Ward'})
              </p>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
              {t('nav.familyNavigation')}
            </div>
            <NavLink to="/attender" end className={drawerNavClass} onClick={() => setSidebarOpen(false)}>
              <Activity className="w-4 h-4 text-[#2563EB]" />
              <span>{t('common.home')}</span>
            </NavLink>
            <NavLink to="/attender/requests" className={drawerNavClass} onClick={() => setSidebarOpen(false)}>
              <Bell className="w-4 h-4" />
              <span className="flex items-center justify-between flex-1">
                <span>{t('nav.requests')}</span>
                {activeRequests.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    {activeRequests.length}
                  </span>
                )}
              </span>
            </NavLink>
            <NavLink to="/attender/medications" className={drawerNavClass} onClick={() => setSidebarOpen(false)} data-tour="nav-meds">
              <Pill className="w-4 h-4" />
              <span>{t('nav.medications')}</span>
            </NavLink>
            <NavLink to="/attender/reports" className={drawerNavClass} onClick={() => setSidebarOpen(false)} data-tour="nav-reports">
              <FileText className="w-4 h-4" />
              <span>{t('nav.reports')}</span>
            </NavLink>
            <NavLink to="/attender/map" className={drawerNavClass} onClick={() => setSidebarOpen(false)}>
              <Compass className="w-4 h-4" />
              <span>{t('nav.hospitalMap')}</span>
            </NavLink>
            <NavLink to="/attender/camera" className={drawerNavClass} onClick={() => setSidebarOpen(false)}>
              <Video className="w-4 h-4" />
              <span>{t('nav.bedsideCamera')}</span>
            </NavLink>
            <NavLink to="/attender/patient" className={drawerNavClass} onClick={() => setSidebarOpen(false)}>
              <User className="w-4 h-4" />
              <span>{t('nav.patient')}</span>
            </NavLink>
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                setShowCallNurseModal(true);
              }}
              className="flex w-full min-h-11 items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-[#2563EB] hover:text-blue-800 hover:bg-[#EFF6FF] transition-colors text-left"
            >
              <PhoneCall className="w-4 h-4 text-[#2563EB]" />
              <span>{t('nav.callNurse')}</span>
            </button>
          </nav>
        </div>

        {/* Clinical Disclaimer Footer with CareAI Clinical Mascot */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-3">
          <div className="text-[11px] text-[#64748B] space-y-1 min-w-0">
            <div className="flex items-center justify-between font-semibold text-[#0F172A]">
              <span>HealthConnect</span>
              <span className="text-emerald-700 font-mono text-[10px]">CARE AI</span>
            </div>
            <p className="text-[10px] text-[#64748B] leading-tight">
              {t('common.verifiedClinicalData')}
            </p>
          </div>
          <CareAiMascot size={48} className="shrink-0" />
        </div>
      </aside>

      {/* Main Attender Mobile-Optimized Body with bottom navigation clearance */}
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-28 sm:p-6 lg:p-8 lg:pb-8">
        <div key={location.pathname} className="clinical-route-enter">
          <Outlet />
        </div>
      </main>

      {/* Attender Mobile Secondary "More" Drawer */}
      {showMoreMenu && (
        <>
          <div
            onClick={() => setShowMoreMenu(false)}
            aria-label={t('nav.closeFamilyMore')}
            className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          />
          <nav
            id="attender-mobile-more-menu"
            aria-label={t('nav.familyMoreMenu')}
            className="fixed inset-x-3 bottom-[calc(66px+env(safe-area-inset-bottom,0px))] z-40 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl lg:hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <NavLink to="/attender/reports" onClick={() => setShowMoreMenu(false)} className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50">
              <FileText className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span className="truncate">{t('nav.reports')}</span>
            </NavLink>
            <NavLink to="/attender/map" onClick={() => setShowMoreMenu(false)} className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50">
              <Compass className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span className="truncate">{t('nav.hospitalMap')}</span>
            </NavLink>
            <NavLink to="/attender/camera" onClick={() => setShowMoreMenu(false)} className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50">
              <Video className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span className="truncate">{t('nav.bedsideCamera')}</span>
            </NavLink>
            <button
              type="button"
              onClick={() => {
                setShowMoreMenu(false);
                setShowCallNurseModal(true);
              }}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/50 px-3 text-xs font-semibold text-blue-900 hover:bg-blue-100 text-left"
            >
              <PhoneCall className="h-4 w-4 text-blue-700" aria-hidden="true" />
              <span className="truncate">{t('nav.callNurse')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMoreMenu(false);
                setShowTutorial(true);
              }}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 text-left"
            >
              <HelpCircle className="h-4 w-4 text-blue-700" aria-hidden="true" />
              <span className="truncate">{t('tour.guideTitle') || 'System Guide'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMoreMenu(false);
                logout();
              }}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-red-200 bg-red-50/50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 text-left"
            >
              <LogOut className="h-4 w-4 text-red-700" aria-hidden="true" />
              <span className="truncate">{t('common.signOut')}</span>
            </button>
          </nav>
        </>
      )}

      {/* Attender Mobile Bottom Navigation (Visible < 1280px, hidden on desktop >= 1280px) */}
      <MobilePrimaryNav
        label={t('nav.familyCareNavigation')}
        hideAt="xl"
        items={[
          { to: '/attender', label: t('common.home'), icon: Activity, end: true },
          { to: '/attender/requests', label: t('nav.requests'), icon: Bell, badge: activeRequests.length > 0 ? activeRequests.length : undefined },
          { to: '/attender/medications', label: t('nav.medications'), icon: Pill },
          { to: '/attender/patient', label: t('nav.patient'), icon: User },
          {
            label: t('common.more'),
            icon: MoreHorizontal,
            onClick: () => setShowMoreMenu((open) => !open),
            expanded: showMoreMenu,
            controls: 'attender-mobile-more-menu',
          },
        ]}
      />

      {/* Canonical Responsive Draggable CareAI Floating Launcher */}
      <FloatingCareAiButton
        onClick={() => setShowCareAiModal(true)}
        isOpen={showCareAiModal}
        label={t('nav.openCareAiAttender')}
      />

      {/* Urgent Nurse Call Modal (Real-time Full Lifecycle Workflow) */}
      {patient && (
        <UrgentNurseCallModal
          patient={patient}
          isOpen={showCallNurseModal}
          onClose={() => setShowCallNurseModal(false)}
          callerName={currentUser?.name}
          callerPhone={currentUser?.phone}
        />
      )}

      {/* CareAI Modal Scoped to Attender */}
      <AttenderAiAssistantModal
        patient={patient}
        isOpen={showCareAiModal}
        onClose={() => setShowCareAiModal(false)}
        role="attender"
        onCallNurse={() => {
          setShowCareAiModal(false);
          setShowCallNurseModal(true);
        }}
        onOpenMeds={() => {
          setShowCareAiModal(false);
          navigate('/attender/medications');
        }}
        onOpenDoctor={() => {
          setShowCareAiModal(false);
          navigate('/attender/patient');
        }}
      />

      {/* Force Password Change Modal on First Login */}
      <ForcePasswordChangeModal />

      {/* Slideover Notifications */}
      <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />

      {/* Role-Specific Attender Onboarding Tutorial Walkthrough */}
      <OnboardingTutorial
        role="attender"
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
      />
    </div>
  );
};
