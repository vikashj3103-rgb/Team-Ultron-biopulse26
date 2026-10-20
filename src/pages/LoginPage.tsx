import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { 
  HeartHandshake, Stethoscope, Users, ShieldCheck, 
  ArrowRight, Activity, Shield, 
  Building2, Eye, EyeOff, Loader2, Lock
} from 'lucide-react';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { useLanguage } from '../i18n';

export const LoginPage: React.FC = () => {
  const { loginAsDemo, loginWithCredentials } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'credentials' | 'demo'>('credentials');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberShift, setRememberShift] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      setError(t('login.enterUserIdError') || 'Please enter your assigned clinical user ID or email.');
      return;
    }
    if (!password) {
      setError(t('login.enterPasswordError') || 'Please enter your account password.');
      return;
    }

    setError(null);
    setIsLoading(true);
    const res = await loginWithCredentials(userId.trim(), password);
    setIsLoading(false);

    if (res.success) {
      if (res.role === 'doctor') {
        navigate('/doctor');
      } else if (res.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/attender');
      }
    } else {
      setError(res.error || t('login.authenticationError') || 'Unable to sign in. Please check your credentials and try again.');
    }
  };

  const handleDemoSelect = (selectedRole: UserRole) => {
    loginAsDemo(selectedRole);
    if (selectedRole === 'doctor') navigate('/doctor');
    else if (selectedRole === 'attender') navigate('/attender');
    else navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col justify-center py-6 px-4 sm:px-6 lg:px-8 relative overflow-x-hidden">
      {/* Global Language Selector (Portal-rendered) */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-8 z-20">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-6xl mx-auto my-auto py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* LEFT COLUMN: HealthConnect Branding & Clinical Identity (Desktop) */}
          <div className="lg:col-span-6 xl:col-span-6 space-y-6 text-left">
            {/* Brand Logo & Title */}
            <div className="space-y-3">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#12304A] text-white shadow-md">
                <HeartHandshake className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A]">
                  {t('app.name')}
                </h1>
                <p className="text-sm sm:text-base font-semibold text-[#2563EB] mt-1">
                  {t('app.subtitle')}
                </p>
                <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed mt-2 max-w-lg">
                  {t('login.clinicalDescription')}
                </p>
              </div>
            </div>

            {/* 3 Clinical Platform Pillars */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-[#E2E8F0] bg-white shadow-2xs">
                <div className="p-2 rounded-lg bg-blue-50 text-[#2563EB] shrink-0 mt-0.5">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#0F172A]">{t('login.telemetryTitle')}</h3>
                  <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                    {t('login.telemetryDesc')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-[#E2E8F0] bg-white shadow-2xs">
                <div className="p-2 rounded-lg bg-emerald-50 text-[#059669] shrink-0 mt-0.5">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#0F172A]">{t('login.caregiverTitle')}</h3>
                  <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                    {t('login.caregiverDesc')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-[#E2E8F0] bg-white shadow-2xs">
                <div className="p-2 rounded-lg bg-blue-50 text-[#2563EB] shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#0F172A]">{t('login.roleGovernanceTitle')}</h3>
                  <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                    {t('login.roleGovernanceDesc')}
                  </p>
                </div>
              </div>
            </div>

            {/* Security Compliance Seal */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#64748B] pt-1">
              <Lock className="w-3.5 h-3.5 text-[#059669] shrink-0" />
              <span>{t('login.securitySeal')}</span>
            </div>
          </div>

          {/* RIGHT COLUMN: The Login Card */}
          <div className="lg:col-span-6 xl:col-span-6 w-full max-w-lg mx-auto lg:max-w-none">
            <div className="bg-white rounded-2xl border border-[#CBD5E1] p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-5">
              
              {/* Mobile-only brand badge */}
              <div className="lg:hidden flex items-center gap-2.5 pb-2 border-b border-[#E2E8F0]">
                <div className="w-9 h-9 rounded-xl bg-[#12304A] text-white flex items-center justify-center shrink-0">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">{t('app.name')}</h2>
                  <p className="text-[11px] text-[#64748B]">{t('app.subtitle')}</p>
                </div>
              </div>

              {/* Card Welcome Heading */}
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
                  {t('login.welcomeTitle')}
                </h2>
                <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                  {t('login.welcomeSubtitle')}
                </p>
              </div>

              {/* Role-aware Access Switcher Tabs */}
              <div className="flex items-center justify-center p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  data-testid="tab-credentials"
                  onClick={() => {
                    setActiveTab('credentials');
                    setError(null);
                  }}
                  aria-pressed={activeTab === 'credentials'}
                  className={`flex min-h-11 flex-1 items-center justify-center rounded-lg py-2 text-xs font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
                    activeTab === 'credentials'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {t('login.tabCredentials')}
                </button>
                <button
                  type="button"
                  data-testid="tab-demo-access"
                  onClick={() => {
                    setActiveTab('demo');
                    setError(null);
                  }}
                  aria-pressed={activeTab === 'demo'}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
                    activeTab === 'demo'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>{t('login.tabRoles')}</span>
                </button>
              </div>

              {/* Error Alert Banner */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                  <Shield className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Tab 1: Real Account Credentials Form */}
              {activeTab === 'credentials' ? (
                <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="login-user-id" className="block text-xs font-bold text-[#0F172A] mb-1">
                      {t('login.userIdLabel')}
                    </label>
                    <input
                      id="login-user-id"
                      type="text"
                      required
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      placeholder={t('login.userIdPlaceholder')}
                      className="w-full text-xs px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] font-medium"
                    />
                    <p className="text-[11px] text-[#64748B] mt-1">
                      {t('login.userIdHelp')}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="login-password" className="block text-xs font-bold text-[#0F172A]">
                        {t('login.passwordLabel')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="text-[11px] text-[#2563EB] hover:text-blue-800 font-semibold flex items-center gap-1 focus:outline-none"
                      >
                        {showPassword ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>{t('login.hidePassword')}</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>{t('login.showPassword')}</span>
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] font-medium"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer text-[#64748B]">
                      <input
                        type="checkbox"
                        checked={rememberShift}
                        onChange={(e) => setRememberShift(e.target.checked)}
                        className="h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <span className="text-[11px]">{t('login.rememberShift')}</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setError(t('login.forgotPasswordNotice'))}
                      className="text-[11px] text-[#2563EB] hover:underline font-semibold"
                    >
                      {t('login.forgotPassword')}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#12304A] hover:bg-[#0F172A] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-60 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>{t('login.verifying')}</span>
                      </>
                    ) : (
                      <>
                        <span>{t('login.signInButton')}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-white" />
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-center text-[#64748B] pt-1">
                    {t('login.needAssistance')}
                  </p>
                </form>
              ) : (
                /* Tab 2: Authorized Role Workspaces */
                <div className="space-y-3.5">
                  <p className="text-xs text-[#64748B] text-center">
                    {t('login.selectWorkspacePrompt')}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Doctor Button */}
                    <button
                      type="button"
                      data-testid="demo-login-doctor"
                      onClick={() => handleDemoSelect('doctor')}
                      className="group relative p-3.5 rounded-xl border border-[#CBD5E1] hover:border-[#2563EB] hover:bg-blue-50/40 text-left transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#2563EB] cursor-pointer"
                    >
                      <div className="p-2 rounded-lg bg-blue-100 text-[#2563EB] w-fit mb-2 group-hover:scale-105 transition-transform">
                        <Stethoscope className="w-5 h-5" />
                      </div>
                      <div className="text-sm font-bold text-[#0F172A]">{t('login.doctorCardTitle')}</div>
                      <div className="text-xs text-[#64748B] font-medium">Dr. Arun Kumar</div>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">{t('login.doctorCardDesc')}</div>
                      <div className="text-[11px] text-[#2563EB] font-bold mt-2 flex items-center gap-0.5">
                        {t('login.doctorCardAction')} <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>

                    {/* Family Attender Button */}
                    <button
                      type="button"
                      data-testid="demo-login-attender"
                      onClick={() => handleDemoSelect('attender')}
                      className="group relative p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 hover:border-[#059669] hover:bg-emerald-50/50 text-left transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#059669] cursor-pointer"
                    >
                      <div className="p-2 rounded-lg bg-emerald-100 text-[#059669] w-fit mb-2 group-hover:scale-105 transition-transform">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="text-sm font-bold text-[#0F172A]">{t('login.attenderCardTitle')}</div>
                      <div className="text-xs text-[#64748B] font-medium">Vikash Kumar</div>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">{t('login.attenderCardDesc')}</div>
                      <div className="text-[11px] text-[#059669] font-bold mt-2 flex items-center gap-0.5">
                        {t('login.attenderCardAction')} <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>

                    {/* Administrator Button */}
                    <button
                      type="button"
                      data-testid="demo-login-admin"
                      onClick={() => handleDemoSelect('admin')}
                      className="group relative p-3.5 rounded-xl border border-[#CBD5E1] hover:border-[#2563EB] hover:bg-blue-50/40 text-left transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#2563EB] cursor-pointer"
                    >
                      <div className="p-2 rounded-lg bg-blue-100 text-[#2563EB] w-fit mb-2 group-hover:scale-105 transition-transform">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="text-sm font-bold text-[#0F172A]">{t('login.adminCardTitle')}</div>
                      <div className="text-xs text-[#64748B] font-medium">{t('login.adminCardSubtitle')}</div>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">{t('login.adminCardDesc')}</div>
                      <div className="text-[11px] text-[#2563EB] font-bold mt-2 flex items-center gap-0.5">
                        {t('login.adminCardAction')} <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Clinical Security Notice */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-[#64748B]">
                  <strong>{t('login.auditNoticeTitle')}</strong> {t('login.auditNoticeDesc')}
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
