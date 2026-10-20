import React, { useState, useMemo } from 'react';
import { hospitalMapService, HOSPITAL_NODES } from '../../services/hospitalMapService';
import { HospitalLocationNode, NavigationRouteResult } from '../../types';
import { 
  Compass, MapPin, Navigation, ArrowRight, CornerDownRight, 
  Building2, Search, CheckCircle2, Layers, Footprints, Clock, 
  HelpCircle, ChevronRight, X 
} from 'lucide-react';
import { useLanguage } from '../../i18n';
import { HospitalMap3D } from './HospitalMap3D';

interface HospitalMapViewProps {
  initialOriginId?: string;
  initialDestinationId?: string;
  onClose?: () => void;
}

export const HospitalMapView: React.FC<HospitalMapViewProps> = ({
  initialOriginId = 'ROOM_ICU_204',
  initialDestinationId = 'ROOM_11002',
  onClose,
}) => {
  const { t, language } = useLanguage();
  const [originId, setOriginId] = useState<string>(initialOriginId);
  const [destinationId, setDestinationId] = useState<string>(initialDestinationId);
  const [activeFloor, setActiveFloor] = useState<number>(() => {
    const orig = hospitalMapService.getNodeById(initialOriginId);
    return orig ? orig.floor : 1;
  });
  const [is2DMode, setIs2DMode] = useState<boolean>(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);

  const allNodes = useMemo(() => hospitalMapService.getAllNodes(), []);

  // Calculate route with active language
  const route: NavigationRouteResult | null = useMemo(() => {
    if (!originId || !destinationId) return null;
    return hospitalMapService.findShortestPath(originId, destinationId, language);
  }, [originId, destinationId, language]);

  const destNode = hospitalMapService.getNodeById(destinationId);

  // Quick destinations matching standard hospital wayfinding points
  const quickDestinations = [
    { labelKey: 'map.destPharmacy', fallback: 'Pharmacy · Ground Floor', id: 'PHARMACY_GF' },
    { labelKey: 'map.destIcu', fallback: 'ICU · Room 204 Bed A1/A2', id: 'ROOM_ICU_204' },
    { labelKey: 'map.destLab', fallback: 'Pathology Laboratory', id: 'LAB_GF' },
    { labelKey: 'map.destRadiology', fallback: 'Radiology & Imaging', id: 'RADIOLOGY_2F' },
    { labelKey: 'map.destEmergency', fallback: 'Emergency Department', id: 'EMERGENCY_GF' },
    { labelKey: 'map.destGenMed', fallback: 'Ward 1 (General Medicine)', id: 'GEN_MED_1F' },
    { labelKey: 'map.destCardiology', fallback: 'Cardiology · Room 11002', id: 'ROOM_11002' },
  ];

  const handleSelectDestination = (id: string) => {
    setDestinationId(id);
    const target = hospitalMapService.getNodeById(id);
    if (target) {
      setActiveFloor(target.floor);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col max-w-5xl w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-950 p-4 text-white sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-200">
            <Compass className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight sm:text-lg">
              {t('map.headerTitle') || 'Hospital map and directions'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-300">
              {t('map.headerSubtitle') || 'Choose a destination to see the route, floor changes, and walking distance.'}
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close hospital map"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Origin & Destination Bar */}
      <div className="grid grid-cols-1 items-center gap-3 border-b border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-12">
        <div className="md:col-span-5 flex items-center gap-2">
          <span className="w-12 shrink-0 font-medium text-slate-700">
            {t('map.from') || 'From'}
          </span>
          <select
            value={originId}
            onChange={(e) => {
              setOriginId(e.target.value);
              const n = hospitalMapService.getNodeById(e.target.value);
              if (n) setActiveFloor(n.floor);
            }}
            aria-label="Current location"
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            {allNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {t('common.floor')} {n.floor} · {hospitalMapService.getLocalizedNodeName(n, language)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-5 flex items-center gap-2">
          <span className="w-12 shrink-0 font-medium text-slate-700">
            {t('map.to') || 'To'}
          </span>
          <select
            value={destinationId}
            onChange={(e) => handleSelectDestination(e.target.value)}
            aria-label="Destination"
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            {allNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {t('common.floor')} {n.floor} · {hospitalMapService.getLocalizedNodeName(n, language)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 flex justify-end">
          {route && (
            <div className="text-right">
              <span className="block font-semibold text-slate-900">
                {route.totalDistanceMeters} {t('common.meters') || 'm'} · {t('map.aboutMinutes', { min: route.estimatedMinutes }) || `about ${route.estimatedMinutes} min`}
              </span>
              <span className="text-xs text-slate-600">
                {destNode && `${t('map.destination')} · ${t('common.floor')} ${destNode.floor}${destNode.wing ? ` · Wing ${destNode.wing}` : ''} · `}
                {route.floorChanges ? (t('map.floorChangeElevator') || 'Floor change · elevator or stairs') : (t('map.sameFloor') || 'Same floor')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Suggested Destinations Pills */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100 bg-white px-4 py-3 text-sm">
        <span className="mr-1 shrink-0 font-medium text-slate-600">
          {t('map.suggestedDestinations') || 'Suggested destinations'}
        </span>
        {quickDestinations.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => handleSelectDestination(q.id)}
            className={`min-h-10 rounded-lg border px-3 text-sm font-medium whitespace-nowrap transition-colors ${
              destinationId === q.id
                ? 'border-blue-700 bg-blue-700 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t(q.labelKey) || q.fallback}
          </button>
        ))}
      </div>

      {/* Main Visualizer Area: 3D Map + Turn-by-Turn Guidance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-[440px]">
        {/* Left: 3D / 2D Architectural Floor Plan Canvas Area (8 cols) */}
        <div className="relative flex flex-col justify-between border-r border-slate-200 bg-slate-50 p-4 lg:col-span-8">
          <HospitalMap3D
            originId={originId}
            destinationId={destinationId}
            activeFloor={activeFloor}
            onSelectFloor={setActiveFloor}
            onSelectNodeAsDestination={handleSelectDestination}
            onSelectNodeAsOrigin={setOriginId}
            route={route}
            activeStepIndex={activeStepIndex}
            is2DMode={is2DMode}
            onToggle2DMode={() => setIs2DMode((prev) => !prev)}
          />
        </div>

        {/* Right: Step-by-Step Guidance (4 cols) */}
        <div className="flex max-h-[520px] flex-col justify-between overflow-y-auto bg-white p-4 sm:p-5 lg:col-span-4">
          <div className="space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Footprints className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-950">
                  {t('map.turnByTurn') || 'Turn-by-turn directions'}
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {t('map.turnByTurnDesc') || 'Follow the numbered directions from your current location.'}
              </p>
            </div>

            {route ? (
              <div className="space-y-2">
                {route.instructions.map((inst, idx) => {
                  const isSelected = activeStepIndex === idx;
                  return (
                    <div 
                      key={idx} 
                      onClick={() => setActiveStepIndex(idx)}
                      className={`flex items-start gap-2.5 text-xs p-2 rounded-xl transition-all cursor-pointer border ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-300 shadow-xs' 
                          : 'hover:bg-slate-50 border-transparent'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px] ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="text-slate-700 leading-relaxed font-medium">
                        {inst}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">
                {t('map.selectToViewDirections') || 'Select origin and destination to view step-by-step directions.'}
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400">
            {t('map.footerNotice') || 'HealthConnect indoor wayfinding navigation map.'}
          </div>
        </div>
      </div>
    </div>
  );
};
