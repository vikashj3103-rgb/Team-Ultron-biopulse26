import React from 'react';
import { VitalStatus } from '../../types';
import { StatusBadge } from '../common/Badge';
import { Activity, Heart, Wind, Thermometer, TrendingUp, TrendingDown, Minus, Clock, AlertTriangle } from 'lucide-react';

interface VitalCardProps {
  type: 'BP' | 'PULSE' | 'SPO2' | 'TEMP' | 'RR';
  title: string;
  value: string;
  unit: string;
  status: VitalStatus;
  timestamp: string;
  trend?: 'up' | 'down' | 'stable';
  normalRangeText: string;
  isStale?: boolean;
}

export const VitalCard: React.FC<VitalCardProps> = ({
  type,
  title,
  value,
  unit,
  status,
  timestamp,
  trend = 'stable',
  normalRangeText,
  isStale = false,
}) => {
  // Format readable time e.g. "10:42 AM"
  const formattedTime = (() => {
    try {
      const d = new Date(timestamp);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return timestamp;
    }
  })();

  const typeConfig = {
    BP: {
      icon: <Activity className="w-5 h-5 text-blue-600" />,
      accentBg: 'bg-blue-50 border-blue-100',
    },
    PULSE: {
      icon: <Heart className="w-5 h-5 text-rose-600" />,
      accentBg: 'bg-rose-50 border-rose-100',
    },
    SPO2: {
      icon: <Wind className="w-5 h-5 text-cyan-600" />,
      accentBg: 'bg-cyan-50 border-cyan-100',
    },
    TEMP: {
      icon: <Thermometer className="w-5 h-5 text-amber-600" />,
      accentBg: 'bg-amber-50 border-amber-100',
    },
    RR: {
      icon: <Wind className="w-5 h-5 text-teal-600" />,
      accentBg: 'bg-teal-50 border-teal-100',
    },
  }[type];

  const statusBorder = {
    critical: 'border-l-4 border-l-red-600 bg-red-50/20',
    high: 'border-l-4 border-l-orange-500 bg-orange-50/20',
    attention: 'border-l-4 border-l-amber-500 bg-amber-50/20',
    stable: 'border-l-4 border-l-emerald-600 bg-white',
  }[status];

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md ${statusBorder}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${typeConfig.accentBg}`}>{typeConfig.icon}</div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            <span className="text-[11px] text-slate-400">Target: {normalRangeText}</span>
          </div>
        </div>
        <StatusBadge status={status} size="sm" />
      </div>

      {/* Main Metric Value */}
      <div className="flex items-baseline justify-between mt-3 mb-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tracking-tight text-slate-900 font-mono">{value}</span>
          <span className="text-sm font-medium text-slate-500">{unit}</span>
        </div>

        {/* Trend Indicator */}
        <div className="flex items-center text-xs text-slate-500 gap-0.5">
          {trend === 'up' && (
            <span className="flex items-center text-amber-600 font-medium">
              <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> High trend
            </span>
          )}
          {trend === 'down' && (
            <span className="flex items-center text-blue-600 font-medium">
              <TrendingDown className="w-3.5 h-3.5 mr-0.5" /> Low trend
            </span>
          )}
          {trend === 'stable' && (
            <span className="flex items-center text-emerald-600 font-medium">
              <Minus className="w-3.5 h-3.5 mr-0.5" /> Stable
            </span>
          )}
        </div>
      </div>

      {/* Stale Warning & Timestamp */}
      <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between text-xs">
        {isStale ? (
          <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" /> Connection Delayed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            ACTIVE MONITORING
          </span>
        )}
        <span className="text-slate-400 flex items-center gap-1 text-[11px]">
          <Clock className="w-3 h-3" /> {formattedTime}
        </span>
      </div>
    </div>
  );
};
