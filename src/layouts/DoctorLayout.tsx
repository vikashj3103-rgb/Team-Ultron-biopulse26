import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getClinicalWorkspacePatients } from '../services/patientScopeService';
import { dataStore } from '../services/dataStore';
import { NotificationCenter } from '../components/common/NotificationCenter';
import { RealtimeStatusBadge } from '../components/common/RealtimeStatusBadge';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { MobilePrimaryNav } from '../components/common/ClinicalUI';
import { useLanguage } from '../i18n';
import { 
  Stethoscope, Activity, ShieldAlert, Settings, LogOut, 
  Menu, X, Bell, Heart, AlertOctagon, CheckCircle2, AlertTriangle, 
  FileText, Radio, Volume2, VolumeX, HelpCircle, Sparkles, MoreHorizontal
} from 'lucide-react';
import { OnboardingTutorial } from '../components/common/OnboardingTutorial';
import { AttenderAiAssistantModal } from '../components/ai/AttenderAiAssistantModal';
import { FloatingCareAiButton } from '../components/ai/FloatingCareAiButton';
import { CareAiMascot } from '../components/ai/CareAiMascot';

export const DoctorLayout: React.FC = () => {
  const { currentUser, assignedDoctorId, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const isCriticalWorklist = location.pathname === '/doctor' && new URLSearchParams(location.search).get('status') === 'critical';
  const isDoctorWorklist = location.pathname === '/doctor' && !isCriticalWorklist;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      return localStorage.getItem('healthconnect_tutorial_doctor_completed') !== 'true';
    } catch {
      return false;
    }
  });
  const [showCareAiModal, setShowCareAiModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => dataStore.getClinicalAlertSoundEnabled());
  const [assignedPatients, setAssignedPatients] = useState(() =>
    getClinicalWorkspacePatients(currentUser?.role, assignedDoctorId)
  );

  useEffect(() => {
    const update = () => {
      setAssignedPatients(getClinicalWorkspacePatients(currentUser?.role, assignedDoctorId));
      setSoundEnabled(dataStore.getClinicalAlertSoundEnabled());
    };
    update();
    return dataStore.subscribe(update);
  }, [assignedDoctorId, currentUser?.role]);

  const criticalCount = assignedPatients.filter((p) => p.status === 'critical' || p.status === 'high').length;
  const assignedPatientIds = new Set(assignedPatients.map((patient) => patient.id));
  const hasUnacknowledgedCriticalAlert = dataStore
    .getAlerts()
    .some((alert) => assignedPatientIds.has(alert.patientId) && alert.severity === 'critical' && alert.status === 'active');

  useEffect(() => {
    if (soundEnabled && hasUnacknowledgedCriticalAlert) {
      dataStore.startCriticalAlertAlarm();
    } else {
      dataStore.stopCriticalAlertAlarm();
    }
    return () => dataStore.stopCriticalAlertAlarm();
  }, [hasUnacknowledgedCriticalAlert, soundEnabled]);

  const toggleAlertSound = () => {
    const nextState = !soundEnabled;
    dataStore.setClinicalAlertSoundEnabled(nextState);
    setSoundEnabled(nextState);
    if (nextState) dataStore.playChime('info');
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-colors ${
      isActive
        ? 'bg-[#EFF6FF] text-[#2563EB] shadow-2xs font-semibold'
        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
    }`;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-slate-900">
      {/* Doctor Dedicated Clinical Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-2xs">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 xl:flex-nowrap xl:px-8 xl:py-0 sm:px-6">
          {/* Brand & Hamburger Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              data-tour="header-hamburger"
              aria-label="Toggle navigation"
              aria-expanded={sidebarOpen}
              className="flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
            >
              <Menu className="w-5 h-5 text-[#0F172A]" />
            </button>

            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/doctor')}>
              <div className="w-9 h-9 rounded-xl bg-[var(--brand-navy)] flex items-center justify-center text-white">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold tracking-tight text-slate-950 sm:text-base">{t('app.name')}</span>
                  <span className="hidden rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 sm:inline-flex">
                    {t('nav.doctorWorkstation').toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden md:block">
                  {getGreeting()}, <strong className="text-slate-700">{currentUser?.name || 'Dr. Arun'}</strong> • {t('nav.cardioInpatientCare')}
                </p>
              </div>
            </div>
          </div>

          {/* Right Action Tools: Workspace Status, Notifications, User Pill & Logout */}
          <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:gap-2.5 xl:w-auto">
            {/* Realtime Live & Synchronization Status Indicator */}
            <span className="hidden xl:inline-flex"><RealtimeStatusBadge /></span>
            <span className="xl:hidden"><RealtimeStatusBadge compact /></span>

            {/* Global Language Selector */}
            <LanguageSelector />

            <button
              type="button"
              onClick={toggleAlertSound}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
              title={soundEnabled ? t('common.muteAlerts') : t('common.unmuteAlerts')}
              aria-label={soundEnabled ? t('common.muteAlerts') : t('common.unmuteAlerts')}
              aria-pressed={soundEnabled}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
            </button>

            {/* System Guide / Onboarding Tutorial Button */}
            <button
              type="button"
              onClick={() => setShowTutorial(true)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              title="Doctor Clinical Guide & Tutorial"
              aria-label="Open Doctor Clinical Guide and Tutorial"
            >
              <HelpCircle className="w-5 h-5" />
            </button>

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => setIsNotifOpen(true)}
              className="relative flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label={t('common.openNotifications')}
            >
              <Bell className="w-5 h-5" />
            </button>

            {/* Doctor Profile Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                {currentUser?.name?.charAt(0) || 'D'}
              </div>
              <div className="hidden xl:block text-left">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {currentUser?.name || 'Dr. Arun Kumar'}
                </div>
                <span className="text-[10px] font-semibold text-blue-700">Cardiologist</span>
              </div>

              <button
                type="button"
                onClick={logout}
                className="ml-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700"
                title={t('common.signOut')}
                aria-label={t('common.signOut')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Subtle Workspace Overlay when Drawer is Open */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-[#0F172A]/15 backdrop-blur-[1px] transition-opacity duration-200"
            aria-label="Close navigation overlay"
          />
        )}

        {/* Clean White Clinical Navigation Drawer */}
        <aside
          aria-label="Doctor navigation drawer"
          className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col justify-between border-r border-[#E2E8F0] bg-white shadow-2xl transition-transform duration-200 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Drawer Top Header with Branding and Dedicated X Close Button */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#E2E8F0] bg-white">
            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => {
                navigate('/doctor');
                setSidebarOpen(false);
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--brand-navy)] flex items-center justify-center text-white shadow-xs">
                <Stethoscope className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight text-[#0F172A]">{t('app.name')}</span>
                <span className="ml-1.5 rounded border border-blue-200 bg-blue-50 px-1 py-0.2 text-[9px] font-semibold text-blue-800">
                  {t('nav.doctorWorkstation').toUpperCase()}
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
            {/* Physician Ward Scope Card */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">
                {t('nav.wardScope')}
              </span>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A]">Cardiology &amp; ICU</span>
                <span className="w-2 h-2 rounded-full bg-[#059669]"></span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                {t('nav.monitoringPatients', { count: assignedPatients.length })}
              </p>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                {t('nav.clinicalWorkflow')}
              </div>
              <Link to="/doctor" className={navClass({ isActive: isDoctorWorklist })} onClick={() => setSidebarOpen(false)} data-tour="nav-worklist">
                <Activity className={`w-4 h-4 ${isDoctorWorklist ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
                <span>{t('nav.dashboard')}</span>
              </Link>
              <Link to="/doctor?status=critical" className={navClass({ isActive: isCriticalWorklist })} onClick={() => setSidebarOpen(false)}>
                <AlertOctagon className="w-4 h-4 text-[#DC2626]" />
                <span className="flex items-center justify-between flex-1">
                  <span>{t('nav.criticalPatients')}</span>
                  {criticalCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-100 text-[#DC2626]">
                      {criticalCount}
                    </span>
                  )}
                </span>
              </Link>
              <NavLink to="/doctor/alerts" className={navClass} onClick={() => setSidebarOpen(false)} data-tour="nav-alerts">
                <ShieldAlert className="w-4 h-4" />
                <span>{t('nav.alerts')}</span>
              </NavLink>
              <NavLink to="/doctor/requests" className={navClass} onClick={() => setSidebarOpen(false)} data-tour="nav-requests">
                <Bell className="w-4 h-4" />
                <span>{t('nav.requests')}</span>
              </NavLink>
              <NavLink to="/doctor/reports" className={navClass} onClick={() => setSidebarOpen(false)} data-tour="nav-reports">
                <FileText className="w-4 h-4" />
                <span>{t('nav.reports')}</span>
              </NavLink>
            </nav>

            {/* Quick Assigned Patient List */}
            <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
              <span className="px-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                {t('nav.assignedPatients')}
              </span>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {assignedPatients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      navigate(`/doctor/patients/${p.id}`);
                      setSidebarOpen(false);
                    }}
                    className="w-full min-h-11 text-left p-2 rounded-lg hover:bg-[#F8FAFC] transition-colors flex items-center justify-between text-xs"
                  >
                    <div className="truncate">
                      <div className="font-semibold text-[#0F172A] truncate">{p.name}</div>
                      <div className="text-[10px] text-[#64748B]">{p.room} • {p.bed}</div>
                    </div>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        p.status === 'critical' || p.status === 'high'
                          ? 'bg-[#DC2626]'
                          : p.status === 'attention'
                          ? 'bg-[#D97706]'
                          : 'bg-[#059669]'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Clinical Disclaimer Footer with CareAI Clinical Mascot */}
          <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-3">
            <div className="text-[11px] text-[#64748B] space-y-1 min-w-0">
              <div className="flex items-center justify-between font-semibold text-[#0F172A]">
                <span>{t('nav.telemetryDemo')}</span>
                <span className="text-blue-700 font-mono text-[10px]">LOCAL</span>
              </div>
              <p className="text-[10px] text-[#64748B] leading-tight">
                {t('nav.syntheticDemoDisclosure')}
              </p>
            </div>
            <CareAiMascot size={48} className="shrink-0" />
          </div>
        </aside>

        {/* Content Outlet */}
        <main className="flex-1 min-w-0 p-4 pb-28 sm:p-6 sm:pb-28 xl:p-8 xl:pb-8 overflow-y-auto">
          <div key={location.pathname} className="clinical-route-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Doctor Mobile Secondary "More" Drawer */}
      {showMoreMenu && (
        <>
          <div
            onClick={() => setShowMoreMenu(false)}
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-slate-950/40 xl:hidden"
          />
          <nav
            id="doctor-mobile-more-menu"
            aria-label="Doctor secondary navigation"
            className="fixed inset-x-3 bottom-[calc(66px+env(safe-area-inset-bottom,0px))] z-40 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl xl:hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <Link
              to="/doctor?status=critical"
              onClick={() => setShowMoreMenu(false)}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <AlertOctagon className="h-4 w-4 text-red-600" aria-hidden="true" />
              <span className="truncate">{t('nav.criticalPatients')}</span>
              {criticalCount > 0 && (
                <span className="ml-auto rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
                  {criticalCount}
                </span>
              )}
            </Link>

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
                toggleAlertSound();
                setShowMoreMenu(false);
              }}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 text-left"
            >
              {soundEnabled ? (
                <>
                  <VolumeX className="h-4 w-4 text-slate-600" aria-hidden="true" />
                  <span className="truncate">{t('common.muteAlerts')}</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  <span className="truncate">{t('common.unmuteAlerts')}</span>
                </>
              )}
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

      {/* Doctor Mobile Bottom Navigation (Visible < 1280px, hidden on desktop >= 1280px) */}
      <MobilePrimaryNav
        label={`${t('role.doctor')} navigation`}
        hideAt="xl"
        items={[
          { to: '/doctor', label: t('nav.worklist'), icon: Activity, end: true },
          { to: '/doctor/alerts', label: t('nav.alerts'), icon: ShieldAlert, badge: criticalCount > 0 ? criticalCount : undefined, urgent: criticalCount > 0 },
          { to: '/doctor/requests', label: t('nav.requests'), icon: Bell },
          { to: '/doctor/reports', label: t('nav.reports'), icon: FileText },
          {
            label: t('common.more'),
            icon: MoreHorizontal,
            onClick: () => setShowMoreMenu((prev) => !prev),
            expanded: showMoreMenu,
            controls: 'doctor-mobile-more-menu',
          },
        ]}
      />


      {/* Slideover Notifications */}
      <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />

      {/* Canonical Responsive Draggable CareAI Floating Launcher */}
      <FloatingCareAiButton
        onClick={() => setShowCareAiModal(true)}
        isOpen={showCareAiModal}
        label="Open CareAI Clinical Assistant"
      />

      {/* CareAI Modal Scoped to Doctor */}
      <AttenderAiAssistantModal
        isOpen={showCareAiModal}
        onClose={() => setShowCareAiModal(false)}
        role="doctor"
        doctorId={assignedDoctorId}
        patient={assignedPatients[0]}
      />

      {/* Role-Specific Doctor Onboarding Tutorial Walkthrough */}
      <OnboardingTutorial
        role="doctor"
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
      />
    </div>
  );
};
