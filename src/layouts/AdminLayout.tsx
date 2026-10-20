import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../services/dataStore';
import { NotificationCenter } from '../components/common/NotificationCenter';
import { RealtimeStatusBadge } from '../components/common/RealtimeStatusBadge';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { MobilePrimaryNav } from '../components/common/ClinicalUI';
import { useLanguage } from '../i18n';
import { 
  Building2, Users, Stethoscope, HeartHandshake, UserCheck, 
  ShieldAlert, Activity, LogOut, Menu, X, Bell, Home, Zap, 
  SlidersHorizontal, History, PhoneCall, ShieldCheck, HelpCircle, MoreHorizontal
} from 'lucide-react';
import { OnboardingTutorial } from '../components/common/OnboardingTutorial';

export const AdminLayout: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      return localStorage.getItem('healthconnect_tutorial_admin_completed') !== 'true';
    } catch {
      return false;
    }
  });

  const patients = dataStore.getPatients();
  const doctors = dataStore.getDoctors();
  const attenders = dataStore.getAttenders();
  const criticalCount = patients.filter((p) => p.status === 'critical' || p.status === 'high').length;

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-colors ${
      isActive
        ? 'bg-[#EFF6FF] text-[#2563EB] shadow-2xs font-semibold'
        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-slate-900">
      {/* Admin Dedicated Top Navigation Bar */}
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

            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/admin')}>
              <div className="w-9 h-9 rounded-xl bg-[var(--brand-navy)] flex items-center justify-center text-white shadow-sm">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold tracking-tight text-slate-950 sm:text-base">{t('app.name')}</span>
                  <span className="hidden rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 sm:inline-flex">
                    ADMIN
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden md:block">
                  {t('app.subtitle')}
                </p>
              </div>
            </div>
          </div>

          {/* Right Action Tools: Realtime Status, Notifications, User Pill & Logout */}
          <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:gap-2.5">
            <span className="hidden xl:inline-flex"><RealtimeStatusBadge /></span>
            <span className="xl:hidden"><RealtimeStatusBadge compact /></span>

            {/* Global Language Selector */}
            <LanguageSelector />

            {/* System Guide / Onboarding Tutorial Button */}
            <button
              type="button"
              onClick={() => setShowTutorial(true)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              title="System Guide & Tutorial"
              aria-label="Open System Guide and Tutorial"
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

            {/* User Profile Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                {currentUser?.name?.charAt(0) || 'A'}
              </div>
              <div className="hidden xl:block text-left">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {currentUser?.name || 'Administrator'}
                </div>
                <span className="text-[10px] font-semibold text-blue-700">{t('role.admin')}</span>
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
          aria-label="Admin navigation drawer"
          className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col justify-between border-r border-[#E2E8F0] bg-white shadow-2xl transition-transform duration-200 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Drawer Top Header with Branding and Dedicated X Close Button */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#E2E8F0] bg-white">
            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => {
                navigate('/admin');
                setSidebarOpen(false);
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--brand-navy)] flex items-center justify-center text-white shadow-xs">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight text-[#0F172A]">{t('app.name')}</span>
                <span className="ml-1.5 rounded border border-blue-200 bg-blue-50 px-1 py-0.2 text-[9px] font-semibold text-blue-800">
                  ADMIN
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
            {/* Hospital Stats Card */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">
                {t('nav.inpatientCensus')}
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[#64748B] block text-[10px]">Patients</span>
                  <span className="font-extrabold text-[#0F172A] text-sm">{patients.length}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px]">Doctors</span>
                  <span className="font-extrabold text-[#0F172A] text-sm">{doctors.length}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px]">Attenders</span>
                  <span className="font-extrabold text-[#0F172A] text-sm">{attenders.length}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px]">Critical</span>
                  <span className="font-extrabold text-[#DC2626] text-sm">{criticalCount}</span>
                </div>
              </div>
            </div>

            {/* Structured Nav Links */}
            <nav className="space-y-1">
              {/* 1. OVERVIEW */}
              <div className="px-3 pb-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                {t('nav.overview')}
              </div>
              <NavLink to="/admin" end className={navClass} onClick={() => setSidebarOpen(false)} data-tour="nav-dashboard">
                <Home className="w-4 h-4" />
                <span>{t('nav.overviewDashboard')}</span>
              </NavLink>

              {/* 2. PATIENT CARE */}
              <div className="pt-3 px-3 pb-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                {t('nav.patientCare')}
              </div>
              <NavLink to="/admin/patients" className={navClass} onClick={() => setSidebarOpen(false)} data-tour="nav-census">
                <Users className="w-4 h-4" />
                <span>{t('nav.inpatientCensus')}</span>
              </NavLink>
              <NavLink to="/admin/alerts" className={navClass} onClick={() => setSidebarOpen(false)} data-tour="nav-alerts">
                <ShieldAlert className="w-4 h-4" />
                <span>{t('nav.hospitalAlerts')}</span>
              </NavLink>

              {/* 3. CLINICAL */}
              <div className="pt-3 px-3 pb-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                {t('nav.clinical')}
              </div>
              <NavLink to="/admin/doctors" className={navClass} onClick={() => setSidebarOpen(false)} data-tour="nav-doctors">
                <Stethoscope className="w-4 h-4" />
                <span>{t('nav.doctorDirectory')}</span>
              </NavLink>
              <NavLink to="/admin/assignments" className={navClass} onClick={() => setSidebarOpen(false)} data-tour="nav-assignments">
                <UserCheck className="w-4 h-4" />
                <span>{t('nav.specialtyAllocator')}</span>
              </NavLink>

              {/* 4. FAMILY CARE */}
              <div className="pt-3 px-3 pb-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                {t('nav.familyCare')}
              </div>
              <NavLink to="/admin/attenders" className={navClass} onClick={() => setSidebarOpen(false)}>
                <HeartHandshake className="w-4 h-4" />
                <span>{t('nav.attenderAccounts')}</span>
              </NavLink>
              <NavLink to="/admin/call-service" className={navClass} onClick={() => setSidebarOpen(false)} data-tour="nav-nurse-call">
                <PhoneCall className="w-4 h-4 text-red-500" />
                <span>{t('nav.urgentCallService')}</span>
              </NavLink>

              {/* 5. OPERATIONS & AUDIT */}
              <div className="pt-3 px-3 pb-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                {t('nav.operationsSecurity')}
              </div>
              <NavLink to="/admin/activity" className={navClass} onClick={() => setSidebarOpen(false)}>
                <History className="w-4 h-4" />
                <span>{t('nav.hospitalActivityLog')}</span>
              </NavLink>
              <NavLink to="/admin/audit-logs" className={navClass} onClick={() => setSidebarOpen(false)} data-tour="nav-audit">
                <ShieldCheck className="w-4 h-4 text-[#059669]" />
                <span>{t('nav.auditSecurityLedger')}</span>
              </NavLink>
              <NavLink to="/admin/demo" className={navClass} onClick={() => setSidebarOpen(false)}>
                <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                <span>{t('nav.simulationCenter')}</span>
              </NavLink>
            </nav>
          </div>

          {/* Connected clinical telemetry status */}
          <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <div className="text-[11px] text-[#64748B] space-y-1">
              <div className="flex items-center justify-between font-semibold text-[#0F172A]">
                <span>{t('nav.smartGloveSimulation')}</span>
                <span className="text-emerald-700 font-mono text-[10px] font-bold">ACTIVE</span>
              </div>
              <p className="text-[10px] text-[#64748B] leading-tight">
                {t('nav.realtimeDemoDisclosure')}
              </p>
            </div>
          </div>
        </aside>

        {/* Content Outlet */}
        <main className="flex-1 min-w-0 p-4 pb-28 sm:p-6 sm:pb-28 xl:p-8 xl:pb-8 overflow-y-auto">
          <div key={location.pathname} className="clinical-route-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Admin Mobile Secondary "More" Drawer */}
      {showMoreMenu && (
        <>
          <div
            onClick={() => setShowMoreMenu(false)}
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-slate-950/40 xl:hidden"
          />
          <nav
            id="admin-mobile-more-menu"
            aria-label="Admin secondary navigation"
            className="fixed inset-x-3 bottom-[calc(66px+env(safe-area-inset-bottom,0px))] z-40 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl xl:hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <NavLink
              to="/admin/assignments"
              onClick={() => setShowMoreMenu(false)}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Building2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span className="truncate">{t('nav.assignments')}</span>
            </NavLink>

            <NavLink
              to="/admin/doctors"
              onClick={() => setShowMoreMenu(false)}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Stethoscope className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span className="truncate">{t('nav.doctors')}</span>
            </NavLink>

            <NavLink
              to="/admin/attenders"
              onClick={() => setShowMoreMenu(false)}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <HeartHandshake className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span className="truncate">{t('nav.attenders')}</span>
            </NavLink>

            <NavLink
              to="/admin/audit-logs"
              onClick={() => setShowMoreMenu(false)}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <span className="truncate">{t('nav.auditSecurityLedger')}</span>
            </NavLink>

            <NavLink
              to="/admin/activity"
              onClick={() => setShowMoreMenu(false)}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <History className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span className="truncate">{t('nav.hospitalActivityLog')}</span>
            </NavLink>

            <NavLink
              to="/admin/demo"
              onClick={() => setShowMoreMenu(false)}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <SlidersHorizontal className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <span className="truncate">{t('nav.simulationCenter')}</span>
            </NavLink>

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

      {/* Admin Mobile Bottom Navigation (Visible < 1280px, hidden on desktop >= 1280px) */}
      <MobilePrimaryNav
        label={`${t('role.admin')} navigation`}
        hideAt="xl"
        items={[
          { to: '/admin', label: t('nav.overview'), icon: Home, end: true },
          { to: '/admin/patients', label: t('nav.inpatientCensus'), icon: Users },
          { to: '/admin/alerts', label: t('nav.hospitalAlerts'), icon: ShieldAlert, badge: criticalCount > 0 ? criticalCount : undefined, urgent: criticalCount > 0 },
          { to: '/admin/call-service', label: 'Operations', icon: PhoneCall, urgent: true },
          {
            label: t('common.more'),
            icon: MoreHorizontal,
            onClick: () => setShowMoreMenu((prev) => !prev),
            expanded: showMoreMenu,
            controls: 'admin-mobile-more-menu',
          },
        ]}
      />

      {/* Slideover Notifications */}
      <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />

      {/* Role-Specific Onboarding Tutorial Walkthrough */}
      <OnboardingTutorial
        role="admin"
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
      />
    </div>
  );
};
