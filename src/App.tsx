import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminLayout } from './layouts/AdminLayout';
import { DoctorLayout } from './layouts/DoctorLayout';
import { AttenderLayout } from './layouts/AttenderLayout';
import { UserRole } from './types';
import { useLanguage, t as translate } from './i18n';

const LoginPage = React.lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const PatientsManagementPage = React.lazy(() => import('./pages/admin/PatientsManagementPage').then((module) => ({ default: module.PatientsManagementPage })));
const DoctorsManagementPage = React.lazy(() => import('./pages/admin/DoctorsManagementPage').then((module) => ({ default: module.DoctorsManagementPage })));
const AttendersManagementPage = React.lazy(() => import('./pages/admin/AttendersManagementPage').then((module) => ({ default: module.AttendersManagementPage })));
const AssignmentsPage = React.lazy(() => import('./pages/admin/AssignmentsPage').then((module) => ({ default: module.AssignmentsPage })));
const AdminAlertsPage = React.lazy(() => import('./pages/admin/AdminAlertsPage').then((module) => ({ default: module.AdminAlertsPage })));
const AdminActivityPage = React.lazy(() => import('./pages/admin/AdminActivityPage').then((module) => ({ default: module.AdminActivityPage })));
const DemoSimulationPage = React.lazy(() => import('./pages/admin/DemoSimulationPage').then((module) => ({ default: module.DemoSimulationPage })));
const CallServicePage = React.lazy(() => import('./pages/admin/CallServicePage').then((module) => ({ default: module.CallServicePage })));
const AuditLogsPage = React.lazy(() => import('./pages/admin/AuditLogsPage').then((module) => ({ default: module.AuditLogsPage })));
const DoctorDashboard = React.lazy(() => import('./pages/doctor/DoctorDashboard').then((module) => ({ default: module.DoctorDashboard })));
const PatientDetailPage = React.lazy(() => import('./pages/doctor/PatientDetailPage').then((module) => ({ default: module.PatientDetailPage })));
const DoctorAlertsPage = React.lazy(() => import('./pages/doctor/DoctorAlertsPage').then((module) => ({ default: module.DoctorAlertsPage })));
const DoctorRequestsPage = React.lazy(() => import('./pages/doctor/DoctorRequestsPage').then((module) => ({ default: module.DoctorRequestsPage })));
const DoctorReportsPage = React.lazy(() => import('./pages/doctor/DoctorReportsPage').then((module) => ({ default: module.DoctorReportsPage })));
const AttenderDashboard = React.lazy(() => import('./pages/attender/AttenderDashboard').then((module) => ({ default: module.AttenderDashboard })));
const AttenderRequestsPage = React.lazy(() => import('./pages/attender/AttenderRequestsPage').then((module) => ({ default: module.AttenderRequestsPage })));
const AttenderMedicationsPage = React.lazy(() => import('./pages/attender/AttenderMedicationsPage').then((module) => ({ default: module.AttenderMedicationsPage })));
const AttenderReportsPage = React.lazy(() => import('./pages/attender/AttenderReportsPage').then((module) => ({ default: module.AttenderReportsPage })));
const AttenderCameraPage = React.lazy(() => import('./pages/attender/AttenderCameraPage').then((module) => ({ default: module.AttenderCameraPage })));
const AttenderPatientInfoPage = React.lazy(() => import('./pages/attender/AttenderPatientInfoPage').then((module) => ({ default: module.AttenderPatientInfoPage })));
const AttenderMapPage = React.lazy(() => import('./pages/attender/AttenderMapPage').then((module) => ({ default: module.AttenderMapPage })));

const RouteLoadingState: React.FC = () => {
  const { t } = useLanguage();
  return (
    <div className="mx-auto flex min-h-[40vh] w-full max-w-5xl flex-col justify-center gap-5 p-6" role="status" aria-live="polite" aria-busy="true">
      <span className="text-sm font-medium text-slate-600">{t('common.openingWorkspace')}</span>
      <span className="sr-only">{t('common.loading')}</span>
      <div aria-hidden="true" className="animate-pulse space-y-3">
        <div className="h-7 w-2/5 rounded-md bg-slate-200" />
        <div className="h-4 w-3/5 rounded-md bg-slate-200" />
        <div className="grid gap-3 sm:grid-cols-3"><div className="h-24 rounded-xl bg-slate-200" /><div className="h-24 rounded-xl bg-slate-200" /><div className="h-24 rounded-xl bg-slate-200" /></div>
        <div className="h-48 rounded-xl bg-slate-200" />
      </div>
    </div>
  );
};

class RouteErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
          <p className="text-sm font-medium text-slate-700">{translate('common.pageLoadFailed')}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            {translate('common.retry')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: UserRole[] }> = ({
  children,
  allowedRoles,
}) => {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    if (role === 'doctor') return <Navigate to="/doctor" replace />;
    if (role === 'attender') return <Navigate to="/attender" replace />;
    if (role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Root index redirector based on current user role
const RootRedirect: React.FC = () => {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role === 'attender') return <Navigate to="/attender" replace />;
  if (role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/doctor" replace />;
};

// Role-aware notification redirector
const NotificationRedirect: React.FC = () => {
  const { role } = useAuth();
  if (role === 'admin') return <Navigate to="/admin/alerts" replace />;
  if (role === 'attender') return <Navigate to="/attender/requests" replace />;
  return <Navigate to="/doctor/alerts" replace />;
};

// Role-aware profile redirector
const ProfileRedirect: React.FC = () => {
  const { role } = useAuth();
  if (role === 'attender') return <Navigate to="/attender/patient" replace />;
  return <Navigate to="/doctor/profile" replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RouteErrorBoundary>
        <Suspense fallback={<RouteLoadingState />}>
        <Routes>
          {/* Public login */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* 1. ADMIN ROUTES */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/patients" element={<PatientsManagementPage />} />
            <Route path="/admin/doctors" element={<DoctorsManagementPage />} />
            <Route path="/admin/attenders" element={<AttendersManagementPage />} />
            <Route path="/admin/assignments" element={<AssignmentsPage />} />
            <Route path="/admin/call-service" element={<CallServicePage />} />
            <Route path="/admin/alerts" element={<AdminAlertsPage />} />
            <Route path="/admin/activity" element={<AdminActivityPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
            <Route path="/admin/demo" element={<DemoSimulationPage />} />
          </Route>

          {/* 2. DOCTOR CLINICAL WORKSTATION ROUTES */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                <DoctorLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/doctor" element={<DoctorDashboard />} />
            <Route path="/doctor/patients" element={<Navigate to="/doctor" replace />} />
            <Route path="/doctor/patients/:id" element={<PatientDetailPage />} />
            <Route path="/doctor/alerts" element={<DoctorAlertsPage />} />
            <Route path="/doctor/requests" element={<DoctorRequestsPage />} />
            <Route path="/doctor/reports" element={<DoctorReportsPage />} />
            <Route path="/doctor/profile" element={<ProfilePage />} />
          </Route>

          {/* 3. ATTENDER FAMILY COMPANION ROUTES */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['attender', 'admin']}>
                <AttenderLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/attender" element={<AttenderDashboard />} />
            <Route path="/attender/requests" element={<AttenderRequestsPage />} />
            <Route path="/attender/medications" element={<AttenderMedicationsPage />} />
            <Route path="/attender/reports" element={<AttenderReportsPage />} />
            <Route path="/attender/camera" element={<AttenderCameraPage />} />
            <Route path="/attender/patient" element={<AttenderPatientInfoPage />} />
            <Route path="/attender/map" element={<AttenderMapPage />} />
          </Route>

          {/* SHARED REDIRECTORS */}
          <Route path="/notifications" element={<NotificationRedirect />} />
          <Route path="/profile" element={<ProfileRedirect />} />
          <Route path="/call-service" element={<Navigate to="/admin/call-service" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </RouteErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
