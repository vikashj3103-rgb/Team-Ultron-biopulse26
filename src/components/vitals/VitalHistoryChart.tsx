import React, { useState } from 'react';
import { VitalReading } from '../../types';
import { celsiusToFahrenheit } from '../../utils/temperature';

interface VitalHistoryChartProps {
  history: VitalReading[];
}

export const VitalHistoryChart: React.FC<VitalHistoryChartProps> = ({ history }) => {
  const [activeTab, setActiveTab] = useState<'BP' | 'PULSE' | 'SPO2' | 'TEMP'>('BP');
  const [timeRange, setTimeRange] = useState<'6h' | '24h'>('6h');

  // Retain historical vital telemetry readings and append new points smoothly
  const maxPoints = timeRange === '6h' ? 30 : 60;
  const data = history.slice(-maxPoints);

  // Chart Dimensions
  const width = 640;
  const height = 200;
  const padding = { top: 20, right: 30, bottom: 35, left: 45 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400">
        No historical vital telemetry available.
      </div>
    );
  }

  // Value configurations by tab
  const getBounds = () => {
    switch (activeTab) {
      case 'BP': {
        const allSys = data.map((d) => d.systolicBP);
        const allDia = data.map((d) => d.diastolicBP);
        const minVal = Math.min(...allDia, 50);
        const maxVal = Math.max(...allSys, 180);
        return { min: Math.floor(minVal / 10) * 10, max: Math.ceil(maxVal / 10) * 10 };
      }
      case 'PULSE': {
        const vals = data.map((d) => d.pulse);
        return { min: Math.min(...vals, 45), max: Math.max(...vals, 130) };
      }
      case 'SPO2': {
        const vals = data.map((d) => d.spO2);
        return { min: Math.min(...vals, 85), max: 100 };
      }
      case 'TEMP': {
        const vals = data.map((d) => celsiusToFahrenheit(d.temperature));
        return { min: Math.floor(Math.min(...vals, 96)), max: Math.ceil(Math.max(...vals, 103)) };
      }
    }
  };

  const bounds = getBounds();

  const getX = (index: number) => {
    if (data.length <= 1) return padding.left + chartW / 2;
    return padding.left + (index / (data.length - 1)) * chartW;
  };

  const getY = (val: number) => {
    const range = bounds.max - bounds.min || 1;
    return padding.top + chartH - ((val - bounds.min) / range) * chartH;
  };

  // Generate SVG path strings
  const generatePath = (valExtractor: (d: VitalReading) => number) => {
    return data.reduce((acc, curr, idx) => {
      const x = getX(idx);
      const y = getY(valExtractor(curr));
      return `${acc} ${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
    }, '');
  };

  const formatTimeLabel = (timestamp: string, showSeconds = false) => {
    try {
      const d = new Date(timestamp);
      return d.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        ...(showSeconds ? { second: '2-digit' } : {})
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('BP')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'BP' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Blood Pressure
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PULSE')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'PULSE' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pulse
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SPO2')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'SPO2' ? 'bg-white text-cyan-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            SpO2
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TEMP')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'TEMP' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Temperature
          </button>
        </div>

        {/* Time Window Selector */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-400 mr-1">Window:</span>
          <button
            type="button"
            onClick={() => setTimeRange('6h')}
            className={`px-2.5 py-1 rounded text-xs font-medium border ${
              timeRange === '6h' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Last 6 Hours
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('24h')}
            className={`px-2.5 py-1 rounded text-xs font-medium border ${
              timeRange === '24h' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            24 Hours
          </button>
        </div>
      </div>

      {/* SVG Responsive Container */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[500px]"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="bpGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="pulseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e11d48" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#e11d48" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="spo2Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0891b2" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#0891b2" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines & Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const val = bounds.min + (bounds.max - bounds.min) * (1 - ratio);
            const y = padding.top + chartH * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartW}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94a3b8"
                  fontFamily="monospace"
                >
                  {Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* Normal Target Range Bands (Shaded reference background) */}
          {activeTab === 'BP' && (
            <rect
              x={padding.left}
              y={getY(120)}
              width={chartW}
              height={Math.max(0, getY(80) - getY(120))}
              fill="#10b981"
              fillOpacity="0.06"
            />
          )}
          {activeTab === 'PULSE' && (
            <rect
              x={padding.left}
              y={getY(100)}
              width={chartW}
              height={Math.max(0, getY(60) - getY(100))}
              fill="#10b981"
              fillOpacity="0.06"
            />
          )}
          {activeTab === 'SPO2' && (
            <rect
              x={padding.left}
              y={getY(100)}
              width={chartW}
              height={Math.max(0, getY(95) - getY(100))}
              fill="#10b981"
              fillOpacity="0.06"
            />
          )}
          {activeTab === 'TEMP' && (
            <rect
              x={padding.left}
              y={getY(99.5)}
              width={chartW}
              height={Math.max(0, getY(97.7) - getY(99.5))}
              fill="#10b981"
              fillOpacity="0.06"
            />
          )}

          {/* Lines & Markers */}
          {activeTab === 'BP' && (
            <>
              {/* Systolic Line */}
              <path
                d={generatePath((d) => d.systolicBP)}
                fill="none"
                stroke="#4f46e5"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {data.map((d, i) => {
                const isLatest = i === data.length - 1;
                return (
                  <g key={'sys-g-' + i}>
                    {isLatest && (
                      <circle
                        cx={getX(i)}
                        cy={getY(d.systolicBP)}
                        r="6"
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth="1.5"
                        opacity="0.6"
                      />
                    )}
                    <circle
                      data-testid={isLatest ? 'chart-latest-point' : undefined}
                      data-point-type="sys"
                      data-timestamp={d.timestamp}
                      cx={getX(i)}
                      cy={getY(d.systolicBP)}
                      r={isLatest ? '4.5' : '3.5'}
                      fill="#4f46e5"
                      stroke="#ffffff"
                      strokeWidth={isLatest ? '2' : '1.5'}
                    >
                      <title>{`Time: ${formatTimeLabel(d.timestamp, true)} | Systolic: ${d.systolicBP} mmHg`}</title>
                    </circle>
                  </g>
                );
              })}

              {/* Diastolic Line */}
              <path
                d={generatePath((d) => d.diastolicBP)}
                fill="none"
                stroke="#818cf8"
                strokeWidth="2"
                strokeDasharray="4 2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {data.map((d, i) => {
                const isLatest = i === data.length - 1;
                return (
                  <circle
                    key={'dia-' + i}
                    data-point-type="dia"
                    data-timestamp={d.timestamp}
                    cx={getX(i)}
                    cy={getY(d.diastolicBP)}
                    r={isLatest ? '4' : '3'}
                    fill="#818cf8"
                    stroke="#ffffff"
                    strokeWidth={isLatest ? '2' : '1'}
                  >
                    <title>{`Time: ${formatTimeLabel(d.timestamp, true)} | Diastolic: ${d.diastolicBP} mmHg`}</title>
                  </circle>
                );
              })}
            </>
          )}

          {activeTab === 'PULSE' && (
            <>
              <path
                d={generatePath((d) => d.pulse)}
                fill="none"
                stroke="#e11d48"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {data.map((d, i) => {
                const isLatest = i === data.length - 1;
                return (
                  <g key={'pulse-g-' + i}>
                    {isLatest && (
                      <circle
                        cx={getX(i)}
                        cy={getY(d.pulse)}
                        r="6"
                        fill="none"
                        stroke="#e11d48"
                        strokeWidth="1.5"
                        opacity="0.6"
                      />
                    )}
                    <circle
                      data-testid={isLatest ? 'chart-latest-point' : undefined}
                      data-point-type="pulse"
                      data-timestamp={d.timestamp}
                      cx={getX(i)}
                      cy={getY(d.pulse)}
                      r={isLatest ? '4.5' : '3.5'}
                      fill="#e11d48"
                      stroke="#ffffff"
                      strokeWidth={isLatest ? '2' : '1.5'}
                    >
                      <title>{`Time: ${formatTimeLabel(d.timestamp, true)} | Pulse: ${d.pulse} bpm`}</title>
                    </circle>
                  </g>
                );
              })}
            </>
          )}

          {activeTab === 'SPO2' && (
            <>
              <path
                d={generatePath((d) => d.spO2)}
                fill="none"
                stroke="#0891b2"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {data.map((d, i) => {
                const isLatest = i === data.length - 1;
                return (
                  <g key={'spo2-g-' + i}>
                    {isLatest && (
                      <circle
                        cx={getX(i)}
                        cy={getY(d.spO2)}
                        r="6"
                        fill="none"
                        stroke="#0891b2"
                        strokeWidth="1.5"
                        opacity="0.6"
                      />
                    )}
                    <circle
                      data-testid={isLatest ? 'chart-latest-point' : undefined}
                      data-point-type="spo2"
                      data-timestamp={d.timestamp}
                      cx={getX(i)}
                      cy={getY(d.spO2)}
                      r={isLatest ? '4.5' : '3.5'}
                      fill="#0891b2"
                      stroke="#ffffff"
                      strokeWidth={isLatest ? '2' : '1.5'}
                    >
                      <title>{`Time: ${formatTimeLabel(d.timestamp, true)} | SpO2: ${d.spO2}%`}</title>
                    </circle>
                  </g>
                );
              })}
            </>
          )}

          {activeTab === 'TEMP' && (
            <>
              <path
                d={generatePath((d) => celsiusToFahrenheit(d.temperature))}
                fill="none"
                stroke="#d97706"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {data.map((d, i) => {
                const fVal = celsiusToFahrenheit(d.temperature);
                const isLatest = i === data.length - 1;
                return (
                  <g key={'temp-g-' + i}>
                    {isLatest && (
                      <circle
                        cx={getX(i)}
                        cy={getY(fVal)}
                        r="6"
                        fill="none"
                        stroke="#d97706"
                        strokeWidth="1.5"
                        opacity="0.6"
                      />
                    )}
                    <circle
                      data-testid={isLatest ? 'chart-latest-point' : undefined}
                      data-point-type="temp"
                      data-timestamp={d.timestamp}
                      cx={getX(i)}
                      cy={getY(fVal)}
                      r={isLatest ? '4.5' : '3.5'}
                      fill="#d97706"
                      stroke="#ffffff"
                      strokeWidth={isLatest ? '2' : '1.5'}
                    >
                      <title>{`Time: ${formatTimeLabel(d.timestamp, true)} | Temp: ${fVal} °F`}</title>
                    </circle>
                  </g>
                );
              })}
            </>
          )}

          {/* X-axis time points */}
          {data.map((d, idx) => {
            if (idx % 2 !== 0 && idx !== data.length - 1) return null;
            return (
              <text
                key={'time-' + idx}
                x={getX(idx)}
                y={padding.top + chartH + 18}
                textAnchor="middle"
                fontSize="10"
                fill="#94a3b8"
                fontFamily="sans-serif"
              >
                {formatTimeLabel(d.timestamp)}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Legend & Guidance */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          {activeTab === 'BP' && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-blue-600"></span> Systolic (mmHg)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-blue-400 border-t border-dashed"></span> Diastolic (mmHg)
              </span>
            </>
          )}
          {activeTab === 'TEMP' && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-amber-600"></span> Core Body Temp (°F)
            </span>
          )}
          <span className="flex items-center gap-1 text-emerald-700">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200"></span> Normal Target Zone
          </span>
        </div>
        <span className="text-[11px] text-slate-400">Hover data points to inspect values</span>
      </div>
    </div>
  );
};
