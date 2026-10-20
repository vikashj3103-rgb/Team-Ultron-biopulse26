import React from 'react';
import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

export interface PrimaryNavItem {
  to?: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
  urgent?: boolean;
  onClick?: () => void;
  expanded?: boolean;
  controls?: string;
}

export const MobilePrimaryNav: React.FC<{ items: PrimaryNavItem[]; label: string; hideAt?: 'lg' | 'xl' }> = ({ items, label, hideAt = 'xl' }) => (
  <nav
    aria-label={label}
    style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}
    className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 px-1.5 pt-1 shadow-[0_-4px_20px_rgba(18,48,74,0.08)] backdrop-blur-md ${hideAt === 'lg' ? 'lg:hidden' : 'xl:hidden'}`}
  >
    <div className="mx-auto grid max-w-screen-md gap-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map(({ to, label: itemLabel, icon: Icon, end, badge, urgent, onClick, expanded, controls }) => {
        const content = (isActiveState: boolean) => (
          <>
            <span className="relative flex h-5 w-6 items-center justify-center">
              <Icon className={`h-5 w-5 transition-transform duration-150 ${urgent ? 'text-red-700' : isActiveState ? 'text-blue-800 scale-105' : 'text-slate-500'}`} aria-hidden="true" />
              {!!badge && (
                <span className={`absolute -right-2 -top-2 flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white ${urgent ? 'bg-red-700' : 'bg-amber-700'}`}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            <span className={`max-w-full truncate text-[10px] tracking-tight ${isActiveState ? 'font-bold text-blue-950' : 'font-medium text-slate-600'}`}>{itemLabel}</span>
          </>
        );

        const baseClass = 'relative flex min-h-[48px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700';

        return to ? (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={itemLabel}
            className={({ isActive }) =>
              `${baseClass} ${
                isActive
                  ? 'bg-blue-50/90 text-blue-900 border-t-2 border-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-t-2 border-transparent'
              }`
            }
          >
            {({ isActive }) => content(isActive)}
          </NavLink>
        ) : (
          <button
            key={itemLabel}
            type="button"
            onClick={onClick}
            aria-label={itemLabel}
            aria-expanded={controls ? expanded : undefined}
            aria-controls={controls}
            className={`${baseClass} ${
              expanded
                ? 'bg-blue-50/90 text-blue-900 border-t-2 border-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-t-2 border-transparent'
            }`}
          >
            {content(Boolean(expanded))}
          </button>
        );
      })}
    </div>
  </nav>
);

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, eyebrow, actions, aside }) => (
  <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {eyebrow && (
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{eyebrow}</p>
      )}
      <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-[28px]">{title}</h1>
      {description && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>}
    </div>
    {(actions || aside) && (
      <div className="flex shrink-0 flex-col gap-3 sm:items-end">
        {aside}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
  </header>
);

interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, description, actions, className = '' }) => (
  <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
    <div className="min-w-0">
      <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

type MetricTone = 'neutral' | 'critical' | 'urgent' | 'warning' | 'success' | 'info';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon?: LucideIcon;
  tone?: MetricTone;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

const metricToneClasses: Record<MetricTone, { border: string; icon: string; value: string }> = {
  neutral: { border: 'border-l-slate-400', icon: 'bg-slate-100 text-slate-700', value: 'text-slate-950' },
  critical: { border: 'border-l-red-600', icon: 'bg-red-50 text-red-700', value: 'text-red-800' },
  urgent: { border: 'border-l-red-700', icon: 'bg-red-50 text-red-700', value: 'text-red-800' },
  warning: { border: 'border-l-amber-500', icon: 'bg-amber-50 text-amber-700', value: 'text-amber-800' },
  success: { border: 'border-l-emerald-600', icon: 'bg-emerald-50 text-emerald-700', value: 'text-emerald-800' },
  info: { border: 'border-l-blue-600', icon: 'bg-blue-50 text-blue-700', value: 'text-blue-800' },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
  selected = false,
  onClick,
  className = '',
}) => {
  const styles = metricToneClasses[tone];
  const content = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <span className="text-sm font-medium leading-5 text-slate-600">{label}</span>
        {Icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${styles.icon}`} aria-hidden="true">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
      <div className={`mt-3 text-2xl font-semibold leading-none tracking-tight ${styles.value}`}>{value}</div>
      {detail && <div className="mt-2 text-xs leading-5 text-slate-600">{detail}</div>}
    </>
  );
  const baseClass = `min-w-0 rounded-[var(--radius-panel)] border border-slate-200 border-l-[3px] ${styles.border} bg-white p-4 text-left shadow-[var(--shadow-panel)] ${selected ? 'ring-2 ring-blue-300' : ''} ${className}`;

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`${baseClass} min-h-12 w-full cursor-pointer transition-colors hover:bg-slate-50 focus-visible:z-10`}
    >
      {content}
    </button>
  ) : (
    <section className={baseClass}>{content}</section>
  );
};

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon,
  action,
  className = '',
}) => (
  <div className={`flex flex-col items-center justify-center px-5 py-10 text-center ${className}`}>
    {Icon && (
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
    )}
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    {description && <p className="mt-1 max-w-md text-sm leading-5 text-slate-600">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
