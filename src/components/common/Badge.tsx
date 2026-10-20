import React from 'react';
import { VitalStatus, RequestType, RequestStatus } from '../../types';
import { CheckCircle2, AlertTriangle, AlertOctagon, Flame, Bell, Check, Clock, Droplets, Utensils, Pill, Stethoscope } from 'lucide-react';
import { useLanguage } from '../../i18n';

interface StatusBadgeProps {
  status: VitalStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', showIcon = true }) => {
  const { t } = useLanguage();
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs font-semibold px-2.5 py-1 gap-1.5',
    lg: 'text-sm font-semibold px-3 py-1.5 gap-2',
  };

  switch (status) {
    case 'critical':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-red-100 text-red-700 border border-red-300 font-medium ${sizeClasses[size]}`}
          role="status"
          aria-label={t('status.critical')}
        >
          {showIcon && <AlertOctagon className="w-3.5 h-3.5 text-red-600 shrink-0" />}
          <span>{t('common.critical').toUpperCase()}</span>
        </span>
      );
    case 'high':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-orange-100 text-orange-800 border border-orange-300 font-medium ${sizeClasses[size]}`}
          role="status"
          aria-label={t('status.high')}
        >
          {showIcon && <Flame className="w-3.5 h-3.5 text-orange-600 shrink-0" />}
          <span>{t('common.high').toUpperCase()}</span>
        </span>
      );
    case 'attention':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-medium ${sizeClasses[size]}`}
          role="status"
          aria-label={t('status.attention')}
        >
          {showIcon && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
          <span>{t('common.attention').toUpperCase()}</span>
        </span>
      );
    case 'stable':
    default:
      return (
        <span
          className={`inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium ${sizeClasses[size]}`}
          role="status"
          aria-label={t('status.stable')}
        >
          {showIcon && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
          <span>{t('common.stable').toUpperCase()}</span>
        </span>
      );
  }
};

export const RequestTypeBadge: React.FC<{ type: RequestType; size?: 'sm' | 'md' }> = ({ type, size = 'md' }) => {
  const { t } = useLanguage();
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : 'text-xs font-semibold px-2.5 py-1 gap-1.5';

  const icons: Record<RequestType, React.ReactNode> = {
    WATER: <Droplets className="w-3.5 h-3.5 text-cyan-600" />,
    FOOD: <Utensils className="w-3.5 h-3.5 text-emerald-600" />,
    MEDICINE: <Pill className="w-3.5 h-3.5 text-blue-600" />,
    NURSE: <Stethoscope className="w-3.5 h-3.5 text-blue-600" />,
    EMERGENCY: <Bell className="w-3.5 h-3.5 text-red-600" />,
  };

  const colorStyles: Record<RequestType, string> = {
    WATER: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    FOOD: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    MEDICINE: 'bg-blue-50 text-blue-800 border-blue-200',
    NURSE: 'bg-blue-50 text-blue-800 border-blue-200',
    EMERGENCY: 'bg-red-100 text-red-800 border-red-300',
  };

  return (
    <span className={`inline-flex items-center rounded-md border ${colorStyles[type]} ${sizeClasses}`}>
      {icons[type]}
      <span>{t(`request.type.${type.toLowerCase()}`)}</span>
    </span>
  );
};

export const RequestStatusBadge: React.FC<{ status: RequestStatus }> = ({ status }) => {
  const { t } = useLanguage();
  switch (status) {
    case 'NEW':
      return (
        <span role="status" aria-label={t('request.status.new')} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          {t('request.status.new').toUpperCase()}
        </span>
      );
    case 'ACKNOWLEDGED':
      return (
        <span role="status" aria-label={t('request.status.acknowledged')} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          {t('request.status.acknowledged').toUpperCase()}
        </span>
      );
    case 'RESOLVED':
      return (
        <span role="status" aria-label={t('request.status.resolved')} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <Check className="w-3 h-3 text-emerald-600" />
          {t('request.status.resolved').toUpperCase()}
        </span>
      );
  }
};
