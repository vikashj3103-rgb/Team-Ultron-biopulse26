import React, { useState, useRef, useMemo } from 'react';
import { HospitalLocationNode, NavigationRouteResult } from '../../types';
import { 
  HOSPITAL_FLOORS_3D, 
  Room3DDefinition, 
  getFloor3DData, 
  getArchitecturalRoutePoints,
  SHARED_VERTICAL_SHAFT
} from '../../services/hospitalMap3DData';
import { useLanguage } from '../../i18n';
import { 
  Layers, RotateCcw, ZoomIn, ZoomOut, 
  MapPin, Building, ArrowUpRight
} from 'lucide-react';

interface HospitalMap3DProps {
  originId: string;
  destinationId: string;
  activeFloor: number;
  onSelectFloor: (floor: number) => void;
  onSelectNodeAsDestination: (nodeId: string) => void;
  onSelectNodeAsOrigin?: (nodeId: string) => void;
  route: NavigationRouteResult | null;
  activeStepIndex?: number | null;
  is2DMode?: boolean;
  onToggle2DMode?: () => void;
}

export const HospitalMap3D: React.FC<HospitalMap3DProps> = ({
  originId,
  destinationId,
  activeFloor,
  onSelectFloor,
  onSelectNodeAsDestination,
  route,
  activeStepIndex,
  is2DMode = false,
  onToggle2DMode,
}) => {
  const { t, language } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);

  // 3D Camera Controls State (Isometric Architectural Defaults)
  const [pitch, setPitch] = useState<number>(52); // rotateX (35deg - 65deg)
  const [yaw, setYaw] = useState<number>(-28); // rotateZ (-55deg - -5deg)
  const [zoom, setZoom] = useState<number>(1.0); // scale (0.75 - 1.5)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredRoom, setHoveredRoom] = useState<Room3DDefinition | null>(null);

  // Active Floor Architectural Data
  const currentFloorData = useMemo(() => getFloor3DData(activeFloor) || HOSPITAL_FLOORS_3D[1], [activeFloor]);

  // Points on the active floor for the architectural walking route
  const currentFloorRoutePoints = useMemo(() => {
    if (!originId || !destinationId) return [];
    return getArchitecturalRoutePoints(originId, destinationId, activeFloor);
  }, [originId, destinationId, activeFloor]);

  // Check if route changes floor via vertical shaft
  const isMultiFloorRoute = useMemo(() => {
    if (!route) return false;
    const floors = new Set(route.path.map((n) => n.floor));
    return floors.size > 1;
  }, [route]);

  // Determine which floors are traversed
  const routeFloors = useMemo(() => {
    if (!route) return [activeFloor];
    return Array.from(new Set(route.path.map((n) => n.floor)));
  }, [route, activeFloor]);

  // Reset Camera View
  const handleResetView = () => {
    setPitch(52);
    setYaw(-28);
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(1.45, +(z + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.75, +(z - 0.15).toFixed(2)));

  // Drag Orbit / Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (is2DMode) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || is2DMode) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setDragStart({ x: e.clientX, y: e.clientY });

    if (e.shiftKey) {
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    } else {
      setYaw((y) => Math.max(-55, Math.min(-5, y + dx * 0.35)));
      setPitch((p) => Math.max(35, Math.min(65, p - dy * 0.35)));
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Localized Room Name
  const getRoomName = (room: Room3DDefinition): string => {
    if (language === 'hi') {
      if (room.id === 'ROOM_ICU_204') return 'आईसीयू कमरा 204 (बेड ए)';
      if (room.id === 'ROOM_ICU_206') return 'आईसीयू कमरा 206 (बेड ए/बी)';
      if (room.id === 'ROOM_11002') return 'कार्डियोलॉजी कमरा 11002';
      if (room.id === 'CARDIO_OPD_2F') return 'कार्डियोलॉजी ओपीडी और इको';
      if (room.id === 'PHARMACY_GF') return 'केंद्रीय अस्पताल फार्मेसी';
      if (room.id === 'EMERGENCY_GF') return 'आपातकालीन और ट्रॉमा केयर';
      if (room.id === 'LAB_GF') return 'पैथोलॉजी डायग्नोस्टिक लैब';
      if (room.id === 'RECEPTION_GF') return 'मुख्य रिसेप्शन और पूछताछ';
      if (room.type === 'lift') return 'केंद्रीय अस्पताल लिफ्ट';
      if (room.type === 'stairs') return 'केंद्रीय सीढ़ी ए';
      if (room.type === 'nurse') return 'केंद्रीय नर्स स्टेशन';
      if (room.id === 'GEN_MED_1F') return 'जनरल मेडिसिन वार्ड 1';
      if (room.id === 'SURGERY_1F') return 'सर्जिकल रिकवरी वार्ड';
      if (room.id === 'RADIOLOGY_2F') return 'रेडियोलॉजी और एमआरआई';
      if (room.id === 'NEUROLOGY_2F') return 'न्यूरोलॉजी परामर्श';
    } else if (language === 'ta') {
      if (room.id === 'ROOM_ICU_204') return 'தீவிர சிகிச்சைப் பிரிவு 204 (படுக்கை A)';
      if (room.id === 'ROOM_ICU_206') return 'தீவிர சிகிச்சைப் பிரிவு 206';
      if (room.id === 'ROOM_11002') return 'இதயவியல் அறை 11002';
      if (room.id === 'CARDIO_OPD_2F') return 'இதயவியல் வெளிநோயாளி பிரிவு';
      if (room.id === 'PHARMACY_GF') return 'மத்திய மருத்துவமனை மருந்தகம்';
      if (room.id === 'EMERGENCY_GF') return 'அவசர சிகிச்சை பிரிவு';
      if (room.id === 'LAB_GF') return 'நோயியல் பரிசோதனை கூடம்';
      if (room.id === 'RECEPTION_GF') return 'முக்கிய வரவேற்பு & தகவல்';
      if (room.type === 'lift') return 'மத்திய லிப்ட்';
      if (room.type === 'stairs') return 'மத்திய படிக்கட்டு A';
      if (room.type === 'nurse') return 'மத்திய செவிலியர் நிலையம்';
      if (room.id === 'GEN_MED_1F') return 'பொது மருத்துவ வார்டு 1';
      if (room.id === 'SURGERY_1F') return 'அறுவைசிகிச்சை மீட்பு வார்டு';
      if (room.id === 'RADIOLOGY_2F') return 'கதிரியக்கவியல் & எம்ஆர்ஐ';
      if (room.id === 'NEUROLOGY_2F') return 'நரம்பியல் ஆலோசனை';
    } else if (language === 'te') {
      if (room.id === 'ROOM_ICU_204') return 'ICU గది 204 (బెడ్ A)';
      if (room.id === 'ROOM_ICU_206') return 'ICU గది 206';
      if (room.id === 'ROOM_11002') return 'కార్డియాలజీ గది 11002';
      if (room.id === 'CARDIO_OPD_2F') return 'కార్డియాలజీ OPD & ఎకో';
      if (room.id === 'PHARMACY_GF') return 'కేంద్ర ఆసుపత్రి ఫార్మసీ';
      if (room.id === 'EMERGENCY_GF') return 'అత్యవసర విభాగం';
      if (room.id === 'LAB_GF') return 'పాథాలజీ ల్యాబ్';
      if (room.id === 'RECEPTION_GF') return 'ప్రధాన రిసెప్షన్ & సమాచారం';
      if (room.type === 'lift') return 'సెంట్రల్ లిఫ్ట్';
      if (room.type === 'stairs') return 'సెంట్రల్ మెట్లు A';
      if (room.type === 'nurse') return 'సెంట్రల్ నర్సింగ్ స్టేషన్';
      if (room.id === 'GEN_MED_1F') return 'జనరల్ మెడిసిన్ వార్డ్ 1';
      if (room.id === 'SURGERY_1F') return 'సర్జికల్ రికవరీ వార్డ్';
      if (room.id === 'RADIOLOGY_2F') return 'రేడియాలజీ & ఎంఆర్ఐ';
      if (room.id === 'NEUROLOGY_2F') return 'న్యూరాలజీ సంప్రదింపులు';
    }
    return room.name;
  };

  const getBeaconText = (type: 'origin' | 'dest'): string => {
    if (type === 'origin') {
      if (language === 'hi') return 'आप यहाँ हैं';
      if (language === 'ta') return 'நீங்கள் இங்கே';
      if (language === 'te') return 'మీరు ఇక్కడ';
      return t('map.currentLocation') || 'YOU ARE HERE';
    } else {
      if (language === 'hi') return 'गंतव्य';
      if (language === 'ta') return 'இலக்கு';
      if (language === 'te') return 'గమ్యం';
      return t('map.destination') || 'DESTINATION';
    }
  };

  // Find origin & destination room definitions
  const originRoom = useMemo(() => {
    for (const f of HOSPITAL_FLOORS_3D) {
      const r = f.rooms.find((rm) => rm.id === originId);
      if (r) return r;
    }
    return null;
  }, [originId]);

  const destRoom = useMemo(() => {
    for (const f of HOSPITAL_FLOORS_3D) {
      const r = f.rooms.find((rm) => rm.id === destinationId);
      if (r) return r;
    }
    return null;
  }, [destinationId]);

  return (
    <div 
      className="relative w-full aspect-16/10 min-h-[380px] sm:min-h-[460px] lg:min-h-[520px] bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] shadow-inner overflow-hidden select-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label="Interactive 3D Hospital Indoor Map"
    >
      {/* 1. TOP-LEFT OVERLAY: Floor Selector Tabs & 2D/3D Toggle */}
      <div className="absolute top-3 left-3 z-30 flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-white/95 backdrop-blur-md border border-[#E2E8F0] shadow-md text-xs font-semibold">
        {/* Ground Floor */}
        <button
          type="button"
          onClick={() => onSelectFloor(0)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeFloor === 0 
              ? 'bg-[#2563EB] text-white shadow-xs font-bold' 
              : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
          }`}
          aria-label="Select Ground Floor: Reception, Pharmacy and Emergency"
        >
          <Building className="w-3.5 h-3.5" />
          <span>{t('map.floor0') || 'Ground Floor'}</span>
        </button>

        {/* Floor 1 */}
        <button
          type="button"
          onClick={() => onSelectFloor(1)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeFloor === 1 
              ? 'bg-[#2563EB] text-white shadow-xs font-bold' 
              : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
          }`}
          aria-label="Select Floor 1: ICU and Inpatient"
        >
          <Building className="w-3.5 h-3.5" />
          <span>{t('map.floor1') || 'Floor 1 — ICU'}</span>
        </button>

        {/* Floor 2 */}
        <button
          type="button"
          onClick={() => onSelectFloor(2)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeFloor === 2 
              ? 'bg-[#2563EB] text-white shadow-xs font-bold' 
              : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
          }`}
          aria-label="Select Floor 2: Cardiology and Surgery"
        >
          <Building className="w-3.5 h-3.5" />
          <span>{t('map.floor2') || 'Floor 2 — Cardiology'}</span>
        </button>

        <div className="h-4 w-px bg-[#E2E8F0] mx-0.5" />

        {/* 2D / 3D Perspective Toggle Button */}
        <button
          type="button"
          onClick={onToggle2DMode}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
            !is2DMode
              ? 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] font-bold'
              : 'bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#0F172A]'
          }`}
          title={is2DMode ? "Switch to 3D Architectural View" : "Switch to 2D Floor Plan"}
          aria-label={is2DMode ? "Switch to 3D Perspective" : "Switch to 2D Plan"}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{!is2DMode ? '3D' : '2D'}</span>
        </button>
      </div>

      {/* 2. TOP-RIGHT OVERLAY: 3D Camera Controls */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1 p-1 rounded-xl bg-white/95 backdrop-blur-md border border-[#E2E8F0] shadow-md text-xs font-semibold">
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="h-4 w-px bg-[#E2E8F0]" />
        <button
          type="button"
          onClick={handleResetView}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
          title="Reset Isometric Perspective"
          aria-label="Reset View"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('map.resetView') || 'Reset'}</span>
        </button>
      </div>

      {/* 3. 3D ISOMETRIC ARCHITECTURAL STAGE */}
      <div
        className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden"
        style={{
          perspective: is2DMode ? 'none' : '1200px',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="relative transition-transform duration-300 ease-out"
          style={{
            width: '880px',
            height: '540px',
            transform: is2DMode 
              ? `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` 
              : `scale(${zoom}) translate(${pan.x}px, ${pan.y}px) rotateX(${pitch}deg) rotateZ(${yaw}deg)`,
            transformStyle: is2DMode ? 'flat' : 'preserve-3d',
          }}
        >
          {/* ============================================================= */}
          {/* MULTI-FLOOR ARCHITECTURAL STACK: GHOST FLOOR SLABS           */}
          {/* ============================================================= */}
          {!is2DMode && HOSPITAL_FLOORS_3D.map((fl) => {
            if (fl.floor === activeFloor) return null;
            const zOffset = (fl.floor - activeFloor) * 130;
            return (
              <div
                key={`ghost-floor-${fl.floor}`}
                className="absolute inset-0 pointer-events-none transition-all duration-500"
                style={{
                  transform: `translateZ(${zOffset}px)`,
                  opacity: 0.16,
                  filter: 'grayscale(0.7) blur(0.5px)',
                }}
              >
                {/* Structural Floor Slab Rim & Perimeter */}
                <div className="w-full h-full rounded-2xl bg-slate-200 border-2 border-slate-400 shadow-sm" />
              </div>
            );
          })}

          {/* ============================================================= */}
          {/* VERTICAL ELEVATOR SHAFT TOWER COLUMN (CONNECTING FLOORS)     */}
          {/* ============================================================= */}
          {!is2DMode && (
            <div
              className="absolute pointer-events-none transition-all duration-500 z-10"
              style={{
                left: `${SHARED_VERTICAL_SHAFT.elevator.x}px`,
                top: `${SHARED_VERTICAL_SHAFT.elevator.y}px`,
                width: `${SHARED_VERTICAL_SHAFT.elevator.width}px`,
                height: `${SHARED_VERTICAL_SHAFT.elevator.height}px`,
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Vertical Glass Tower Shaft Frame */}
              <div 
                className="absolute inset-0 rounded-lg border-2 border-[#D97706]/70 bg-amber-500/10 shadow-lg"
                style={{
                  transform: 'translateZ(-130px)',
                  height: '260px',
                  borderStyle: 'dashed',
                }}
              />
              
              {/* Vertical Animated Lift Beam when Route Changes Floor */}
              {isMultiFloorRoute && (
                <div 
                  className="absolute left-1/2 -translate-x-1/2 w-4 bg-gradient-to-t from-blue-600 via-sky-400 to-amber-400 rounded-full animate-pulse shadow-md opacity-85"
                  style={{
                    height: '260px',
                    transform: 'translateZ(-130px)',
                  }}
                />
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* ACTIVE ARCHITECTURAL FLOOR SLAB                              */}
          {/* ============================================================= */}
          <div 
            className="absolute inset-0 rounded-2xl bg-[#F8FAFC] border-2 border-[#CBD5E1] shadow-[0_30px_70px_-15px_rgba(15,23,42,0.22)] overflow-hidden"
            style={{
              transform: is2DMode ? 'none' : 'translateZ(0px)',
              transformStyle: is2DMode ? 'flat' : 'preserve-3d',
            }}
          >
            {/* SVG ARCHITECTURAL BLUEPRINT CANVAS */}
            <svg 
              viewBox="0 0 880 540" 
              className="w-full h-full absolute inset-0"
            >
              <defs>
                {/* 32px Architectural Floor Grid */}
                <pattern id="arch-grid-blueprint" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#F1F5F9" strokeWidth="1" />
                </pattern>

                {/* Route Glow Filter */}
                <filter id="route-luminous-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor="#2563EB" floodOpacity="0.5" />
                </filter>
              </defs>

              {/* Grid Background */}
              <rect x="0" y="0" width="880" height="540" fill="url(#arch-grid-blueprint)" />

              {/* Architectural Wing Annotations */}
              <text x="60" y="60" fill="#94A3B8" fontSize="10" fontWeight="800" letterSpacing="1.2">
                {t('map.wingA') || 'WING A (WEST WARD)'}
              </text>
              <text x="320" y="55" fill="#94A3B8" fontSize="10" fontWeight="800" letterSpacing="1.2">
                {t('map.centralHub') || 'CENTRAL CONCOURSE & ELEVATORS'}
              </text>
              <text x="600" y="60" fill="#94A3B8" fontSize="10" fontWeight="800" letterSpacing="1.2">
                {t('map.wingB') || 'WING B (EAST CLINICS)'}
              </text>

              {/* Continuous Walkable Corridors Circulation Network */}
              {currentFloorData.corridors.map((c, i) => (
                <g key={`corridor-segment-${i}`}>
                  {/* Corridor Base Surface */}
                  <line
                    x1={c.x1}
                    y1={c.y1}
                    x2={c.x2}
                    y2={c.y2}
                    stroke="#EDF2F7"
                    strokeWidth={c.width}
                    strokeLinecap="round"
                  />
                  {/* Corridor Center Dashed Guideline */}
                  <line
                    x1={c.x1}
                    y1={c.y1}
                    x2={c.x2}
                    y2={c.y2}
                    stroke="#CBD5E1"
                    strokeWidth="1.5"
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                  />
                </g>
              ))}

              {/* Outer Building Structural Perimeter Wall */}
              <rect 
                x="40" 
                y="50" 
                width="800" 
                height="440" 
                rx="14" 
                fill="none" 
                stroke="#475569" 
                strokeWidth="4" 
              />

              {/* ========================================================= */}
              {/* ARCHITECTURAL ROOMS WITH WALLS, DOORS & FURNITURE GLYPHS  */}
              {/* ========================================================= */}
              {currentFloorData.rooms.map((room) => {
                const isOrigin = originId === room.id;
                const isDest = destinationId === room.id;
                const isHovered = hoveredRoom?.id === room.id;

                // Architectural Palette per Department
                let floorFill = '#FFFFFF';
                let wallStroke = '#94A3B8';
                let badgeBg = '#F1F5F9';
                let badgeColor = '#475569';

                if (room.type === 'icu') {
                  floorFill = '#F0F7FF';
                  wallStroke = '#93C5FD';
                  badgeBg = '#DBEAFE';
                  badgeColor = '#1E40AF';
                } else if (room.type === 'pharmacy') {
                  floorFill = '#F0FDF4';
                  wallStroke = '#86EFAC';
                  badgeBg = '#DCFCE7';
                  badgeColor = '#166534';
                } else if (room.type === 'lab') {
                  floorFill = '#FAF5FF';
                  wallStroke = '#D8B4FE';
                  badgeBg = '#F3E8FF';
                  badgeColor = '#6B21A8';
                } else if (room.type === 'lift') {
                  floorFill = '#FFFBEB';
                  wallStroke = '#FCD34D';
                  badgeBg = '#FEF3C7';
                  badgeColor = '#B45309';
                } else if (room.type === 'stairs') {
                  floorFill = '#F8FAFC';
                  wallStroke = '#CBD5E1';
                  badgeBg = '#E2E8F0';
                  badgeColor = '#334155';
                } else if (room.type === 'nurse') {
                  floorFill = '#F0F9FF';
                  wallStroke = '#7DD3FC';
                  badgeBg = '#E0F2FE';
                  badgeColor = '#0369A1';
                } else if (room.id === 'ROOM_11002' || room.id === 'CARDIO_OPD_2F') {
                  floorFill = '#FEF2F2';
                  wallStroke = '#FCA5A5';
                  badgeBg = '#FEE2E2';
                  badgeColor = '#991B1B';
                } else if (room.type === 'department' && room.id === 'EMERGENCY_GF') {
                  floorFill = '#FFF7ED';
                  wallStroke = '#FDBA74';
                  badgeBg = '#FFEDD5';
                  badgeColor = '#C2410C';
                }

                if (isOrigin) {
                  floorFill = '#EFF6FF';
                  wallStroke = '#2563EB';
                } else if (isDest) {
                  floorFill = '#FEF2F2';
                  wallStroke = '#DC2626';
                }

                // Doorway cutouts: calculate wall segments with door break
                const door = room.door;
                const dHalf = door.width / 2;

                return (
                  <g 
                    key={room.id}
                    className="cursor-pointer transition-all"
                    onClick={() => onSelectNodeAsDestination(room.id)}
                    onMouseEnter={() => setHoveredRoom(room)}
                    onMouseLeave={() => setHoveredRoom(null)}
                  >
                    {/* Room Floor Surface */}
                    <rect
                      x={room.x}
                      y={room.y}
                      width={room.width}
                      height={room.height}
                      rx="6"
                      fill={floorFill}
                      stroke={wallStroke}
                      strokeWidth={isOrigin || isDest ? "3.5" : "2.5"}
                    />

                    {/* Door Opening & Architectural Door Swing Arc */}
                    {door.side === 'right' && (
                      <g>
                        {/* Door Opening Cutout */}
                        <line 
                          x1={room.x + room.width} 
                          y1={door.y - dHalf} 
                          x2={room.x + room.width} 
                          y2={door.y + dHalf} 
                          stroke={floorFill} 
                          strokeWidth="4.5" 
                        />
                        {/* Angled Door Leaf */}
                        <line 
                          x1={room.x + room.width} 
                          y1={door.y - dHalf} 
                          x2={room.x + room.width + 12} 
                          y2={door.y - dHalf - 12} 
                          stroke="#475569" 
                          strokeWidth="2" 
                        />
                        {/* Quarter Circle Swing Arc */}
                        <path 
                          d={`M ${room.x + room.width} ${door.y + dHalf} A ${door.width} ${door.width} 0 0 1 ${room.x + room.width + 12} ${door.y - dHalf - 12}`} 
                          fill="none" 
                          stroke="#CBD5E1" 
                          strokeWidth="1.2" 
                          strokeDasharray="3 3" 
                        />
                      </g>
                    )}

                    {door.side === 'left' && (
                      <g>
                        <line 
                          x1={room.x} 
                          y1={door.y - dHalf} 
                          x2={room.x} 
                          y2={door.y + dHalf} 
                          stroke={floorFill} 
                          strokeWidth="4.5" 
                        />
                        <line 
                          x1={room.x} 
                          y1={door.y - dHalf} 
                          x2={room.x - 12} 
                          y2={door.y - dHalf - 12} 
                          stroke="#475569" 
                          strokeWidth="2" 
                        />
                        <path 
                          d={`M ${room.x} ${door.y + dHalf} A ${door.width} ${door.width} 0 0 0 ${room.x - 12} ${door.y - dHalf - 12}`} 
                          fill="none" 
                          stroke="#CBD5E1" 
                          strokeWidth="1.2" 
                          strokeDasharray="3 3" 
                        />
                      </g>
                    )}

                    {door.side === 'top' && (
                      <g>
                        <line 
                          x1={door.x - dHalf} 
                          y1={room.y} 
                          x2={door.x + dHalf} 
                          y2={room.y} 
                          stroke={floorFill} 
                          strokeWidth="4.5" 
                        />
                        <line 
                          x1={door.x - dHalf} 
                          y1={room.y} 
                          x2={door.x - dHalf - 10} 
                          y2={room.y - 12} 
                          stroke="#475569" 
                          strokeWidth="2" 
                        />
                      </g>
                    )}

                    {door.side === 'bottom' && (
                      <g>
                        <line 
                          x1={door.x - dHalf} 
                          y1={room.y + room.height} 
                          x2={door.x + dHalf} 
                          y2={room.y + room.height} 
                          stroke={floorFill} 
                          strokeWidth="4.5" 
                        />
                      </g>
                    )}

                    {/* ===================================================== */}
                    {/* INTERIOR ARCHITECTURAL EQUIPMENT & FURNITURE GLYPHS   */}
                    {/* ===================================================== */}
                    {room.interiorType === 'beds_icu' && (
                      <g opacity="0.85">
                        {/* Hospital Bed A */}
                        <rect x={room.x + 16} y={room.y + 22} width="32" height="46" rx="3" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.2" />
                        <rect x={room.x + 20} y={room.y + 25} width="24" height="10" rx="2" fill="#E2E8F0" />
                        <line x1={room.x + 16} y1={room.y + 42} x2={room.x + 48} y2={room.y + 42} stroke="#CBD5E1" strokeWidth="1" />
                        {/* IV Drip Pole */}
                        <circle cx={room.x + 12} cy={room.y + 26} r="2.5" fill="#2563EB" />
                        <text x={room.x + 32} y={room.y + 60} textAnchor="middle" fontSize="7" fontWeight="bold" fill="#64748B">BED A</text>

                        {/* Hospital Bed B */}
                        <rect x={room.x + 16} y={room.y + 88} width="32" height="46" rx="3" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.2" />
                        <rect x={room.x + 20} y={room.y + 91} width="24" height="10" rx="2" fill="#E2E8F0" />
                        <line x1={room.x + 16} y1={room.y + 108} x2={room.x + 48} y2={room.y + 108} stroke="#CBD5E1" strokeWidth="1" />
                        <circle cx={room.x + 12} cy={room.y + 92} r="2.5" fill="#2563EB" />
                        <text x={room.x + 32} y={room.y + 126} textAnchor="middle" fontSize="7" fontWeight="bold" fill="#64748B">BED B</text>
                      </g>
                    )}

                    {room.interiorType === 'desk_consult' && (
                      <g opacity="0.85">
                        {/* Doctor Consultation Desk */}
                        <rect x={room.x + 20} y={room.y + 55} width="46" height="24" rx="3" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.2" />
                        {/* Doctor Chair Dot */}
                        <circle cx={room.x + 43} cy={room.y + 46} r="4.5" fill="#64748B" />
                        {/* Patient Chair Dots */}
                        <circle cx={room.x + 32} cy={room.y + 87} r="4.5" fill="#94A3B8" />
                        <circle cx={room.x + 54} cy={room.y + 87} r="4.5" fill="#94A3B8" />
                        {/* Examination Couch */}
                        <rect x={room.x + 82} y={room.y + 30} width="26" height="52" rx="3" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.2" />
                        <rect x={room.x + 85} y={room.y + 33} width="20" height="10" rx="1.5" fill="#E2E8F0" />
                      </g>
                    )}

                    {room.interiorType === 'nurse_station' && (
                      <g opacity="0.85">
                        {/* Semicircular Nurse Counter Desk */}
                        <path 
                          d={`M ${room.x + 25} ${room.y + 30} Q ${room.x + room.width/2} ${room.y + 65} ${room.x + room.width - 25} ${room.y + 30}`} 
                          fill="none" 
                          stroke="#0284C7" 
                          strokeWidth="6" 
                          strokeLinecap="round" 
                        />
                        {/* Staff Terminals */}
                        <rect x={room.x + 45} y={room.y + 58} width="12" height="8" rx="1.5" fill="#0284C7" />
                        <rect x={room.x + room.width - 57} y={room.y + 58} width="12" height="8" rx="1.5" fill="#0284C7" />
                        <circle cx={room.x + 51} cy={room.y + 74} r="3.5" fill="#64748B" />
                        <circle cx={room.x + room.width - 51} cy={room.y + 74} r="3.5" fill="#64748B" />
                      </g>
                    )}

                    {room.interiorType === 'elevator' && (
                      <g opacity="0.9">
                        {/* Double Sliding Doors with Center Seam */}
                        <rect x={room.x + 12} y={room.y + 14} width="44" height="42" rx="3" fill="#FEF3C7" stroke="#D97706" strokeWidth="1.5" />
                        <line x1={room.x + 34} y1={room.y + 14} x2={room.x + 34} y2={room.y + 56} stroke="#B45309" strokeWidth="1.5" />
                        {/* Directional Elevator Indicators */}
                        <text x={room.x + 34} y={room.y + 38} textAnchor="middle" fontSize="12" fontWeight="black" fill="#B45309">▲▼</text>
                      </g>
                    )}

                    {room.interiorType === 'stairs' && (
                      <g opacity="0.85">
                        {/* Staircase Parallel Tread Lines */}
                        {[16, 22, 28, 34, 40, 46, 52, 58].map((offset, ti) => (
                          <line 
                            key={`tread-${ti}`} 
                            x1={room.x + 10} 
                            y1={room.y + offset} 
                            x2={room.x + room.width - 10} 
                            y2={room.y + offset} 
                            stroke="#94A3B8" 
                            strokeWidth="1.2" 
                          />
                        ))}
                        {/* Center Handrail Line */}
                        <line x1={room.x + room.width/2} y1={room.y + 12} x2={room.x + room.width/2} y2={room.y + 64} stroke="#475569" strokeWidth="1.5" />
                        {/* Ascending Arrow */}
                        <path d={`M ${room.x + room.width/2 - 6} ${room.y + 72} L ${room.x + room.width/2} ${room.y + 64} L ${room.x + room.width/2 + 6} ${room.y + 72}`} fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
                      </g>
                    )}

                    {room.interiorType === 'pharmacy_counter' && (
                      <g opacity="0.85">
                        <rect x={room.x + 20} y={room.y + 35} width="65" height="24" rx="3" fill="#FFFFFF" stroke="#059669" strokeWidth="1.5" />
                        <text x={room.x + 52} y={room.y + 51} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#059669">✚</text>
                        {/* Shelves */}
                        <line x1={room.x + 110} y1={room.y + 30} x2={room.x + room.width - 15} y2={room.y + 30} stroke="#86EFAC" strokeWidth="2" />
                        <line x1={room.x + 110} y1={room.y + 45} x2={room.x + room.width - 15} y2={room.y + 45} stroke="#86EFAC" strokeWidth="2" />
                      </g>
                    )}

                    {room.interiorType === 'emergency_bays' && (
                      <g opacity="0.85">
                        <text x={room.x + room.width/2} y={room.y + 60} textAnchor="middle" fontSize="24" fontWeight="bold" fill="#DC2626">✚</text>
                        {/* Trauma Bays */}
                        <rect x={room.x + 20} y={room.y + 80} width="30" height="48" rx="2" fill="#FFFFFF" stroke="#FCA5A5" strokeWidth="1.2" />
                        <rect x={room.x + 65} y={room.y + 80} width="30" height="48" rx="2" fill="#FFFFFF" stroke="#FCA5A5" strokeWidth="1.2" />
                        <rect x={room.x + 110} y={room.y + 80} width="30" height="48" rx="2" fill="#FFFFFF" stroke="#FCA5A5" strokeWidth="1.2" />
                      </g>
                    )}

                    {room.interiorType === 'lab_benches' && (
                      <g opacity="0.85">
                        <rect x={room.x + 20} y={room.y + 35} width="80" height="20" rx="2" fill="#FFFFFF" stroke="#7C3AED" strokeWidth="1.2" />
                        <circle cx={room.x + 40} cy={room.y + 45} r="3" fill="#7C3AED" />
                        <circle cx={room.x + 60} cy={room.y + 45} r="3" fill="#7C3AED" />
                        <circle cx={room.x + 80} cy={room.y + 45} r="3" fill="#7C3AED" />
                      </g>
                    )}

                    {room.interiorType === 'radiology_scanner' && (
                      <g opacity="0.85">
                        {/* Circular MRI / CT Scanner Gantry */}
                        <circle cx={room.x + room.width/2} cy={room.y + 65} r="26" fill="none" stroke="#0284C7" strokeWidth="4" />
                        <rect x={room.x + room.width/2 - 10} y={room.y + 55} width="20" height="44" rx="2" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.2" />
                      </g>
                    )}

                    {/* Room Architectural Identification Tag */}
                    <g transform={`translate(${room.x + (room.door.side === 'left' ? 24 : 12)}, ${room.y + 14})`}>
                      <rect
                        x="0"
                        y="0"
                        width={Math.max(50, room.code.length * 7.5 + 10)}
                        height="18"
                        rx="4"
                        fill={badgeBg}
                        stroke="#CBD5E1"
                        strokeWidth="0.8"
                      />
                      <text
                        x={Math.max(50, room.code.length * 7.5 + 10) / 2}
                        y="12.5"
                        textAnchor="middle"
                        fill={badgeColor}
                        fontSize="9.5"
                        fontWeight="900"
                        letterSpacing="0.8"
                      >
                        {room.code}
                      </text>
                    </g>

                    {/* Room Title */}
                    <text
                      x={room.x + room.width / 2}
                      y={room.y + room.height - 10}
                      textAnchor="middle"
                      fill="#0F172A"
                      fontSize="10"
                      fontWeight="800"
                    >
                      {getRoomName(room)}
                    </text>
                  </g>
                );
              })}

              {/* ========================================================= */}
              {/* WALKING ROUTE PATH: GLOWING CORRIDOR CENTERLINE TRACK     */}
              {/* ========================================================= */}
              {currentFloorRoutePoints.length > 1 && (
                <g>
                  {/* Soft Blue Ambient Corridor Glow */}
                  <polyline
                    points={currentFloorRoutePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#DBEAFE"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.9"
                  />

                  {/* Luminous Animated Core Walking Route Line */}
                  <polyline
                    points={currentFloorRoutePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#route-luminous-glow)"
                    style={{
                      strokeDasharray: '14 10',
                      animation: 'dash-flow 1.2s linear infinite',
                    }}
                  />

                  {/* Waypoint Junction Disks */}
                  {currentFloorRoutePoints.map((pt, pIdx) => (
                    <circle
                      key={`route-pt-${pIdx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r="3.5"
                      fill="#2563EB"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                  ))}
                </g>
              )}

              {/* ========================================================= */}
              {/* CURRENT LOCATION (ORIGIN) FLOOR RADAR RING ANCHOR         */}
              {/* ========================================================= */}
              {originRoom && originRoom.floor === activeFloor && (
                <g transform={`translate(${originRoom.interiorPoint.x}, ${originRoom.interiorPoint.y})`}>
                  {/* Floor-plane radar wave ripples */}
                  <circle cx="0" cy="0" r="18" fill="none" stroke="#2563EB" strokeWidth="1.5" opacity="0.6">
                    <animate attributeName="r" values="8;24;32" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.3;0" dur="2s" repeatCount="indefinite" />
                  </circle>
                  {/* Solid Floor Target Disk */}
                  <circle cx="0" cy="0" r="7" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                </g>
              )}

              {/* ========================================================= */}
              {/* DESTINATION FLOOR RADAR RING ANCHOR                       */}
              {/* ========================================================= */}
              {destRoom && destRoom.floor === activeFloor && (
                <g transform={`translate(${destRoom.interiorPoint.x}, ${destRoom.interiorPoint.y})`}>
                  <circle cx="0" cy="0" r="18" fill="none" stroke="#DC2626" strokeWidth="1.5" opacity="0.6">
                    <animate attributeName="r" values="8;24;32" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.3;0" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="0" cy="0" r="7" fill="#DC2626" stroke="#FFFFFF" strokeWidth="2" />
                </g>
              )}
            </svg>

            {/* =========================================================== */}
            {/* 3D ELEVATED BEACON POLES & PINS (ANCHORED TO FLOOR)         */}
            {/* =========================================================== */}
            {originRoom && originRoom.floor === activeFloor && (
              <div 
                className="absolute pointer-events-none flex flex-col items-center z-30"
                style={{
                  left: `${originRoom.interiorPoint.x}px`,
                  top: `${originRoom.interiorPoint.y}px`,
                  transform: is2DMode ? 'translate(-50%, -100%)' : 'translate(-50%, -100%) translateZ(40px)',
                  transformStyle: 'preserve-3d',
                }}
              >
                <div className="relative flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-[#2563EB] border-2 border-white text-white flex items-center justify-center shadow-lg">
                    <MapPin className="w-4 h-4 fill-white text-white" />
                  </div>
                </div>
                <div className="mt-1 px-2 py-0.5 rounded-full bg-[#1E40AF] border border-blue-400 text-white text-[9.5px] font-black tracking-wide whitespace-nowrap shadow-md uppercase">
                  {getBeaconText('origin')}
                </div>
              </div>
            )}

            {destRoom && destRoom.floor === activeFloor && (
              <div 
                className="absolute pointer-events-none flex flex-col items-center z-30"
                style={{
                  left: `${destRoom.interiorPoint.x}px`,
                  top: `${destRoom.interiorPoint.y}px`,
                  transform: is2DMode ? 'translate(-50%, -100%)' : 'translate(-50%, -100%) translateZ(40px)',
                  transformStyle: 'preserve-3d',
                }}
              >
                <div className="relative flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-[#DC2626] border-2 border-white text-white flex items-center justify-center shadow-lg">
                    <ArrowUpRight className="w-4 h-4 text-white stroke-[2.5]" />
                  </div>
                </div>
                <div className="mt-1 px-2 py-0.5 rounded-full bg-[#991B1B] border border-red-400 text-white text-[9.5px] font-black tracking-wide whitespace-nowrap shadow-md uppercase">
                  {getBeaconText('dest')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. BOTTOM-LEFT OVERLAY: Compact Architectural Map Legend */}
      <div className="absolute bottom-3 left-3 z-30 flex flex-wrap items-center gap-3 px-3 py-2 rounded-xl bg-white/95 backdrop-blur-md border border-[#E2E8F0] shadow-md text-xs font-semibold text-[#334155]">
        {/* Current Location */}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] shadow-xs" />
          <span className="text-[11px]">{t('map.legendCurrent') || 'Current Location'}</span>
        </div>

        {/* Destination */}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] shadow-xs" />
          <span className="text-[11px]">{t('map.legendDestination') || 'Destination'}</span>
        </div>

        {/* Walking Route */}
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-1 rounded-full bg-[#2563EB]" />
          <span className="text-[11px]">{t('map.legendRoute') || 'Walking Route'}</span>
        </div>

        {/* Elevator */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="px-1 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">LIFT</span>
          <span className="text-[11px]">{t('map.legendElevator') || 'Elevator (Lifts 1-4)'}</span>
        </div>

        {/* Stairs */}
        <div className="hidden md:flex items-center gap-1.5">
          <span className="px-1 py-0.2 rounded bg-slate-100 text-slate-800 text-[9px] font-bold">STAIRS</span>
          <span className="text-[11px]">{t('map.legendStairs') || 'Stairs A'}</span>
        </div>
      </div>

      {/* 5. BOTTOM-RIGHT OVERLAY: Active Floor & Step Summary */}
      <div className="absolute bottom-3 right-3 z-30 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-[#E2E8F0] shadow-md text-xs text-[#64748B]">
        <span className="font-bold text-[#0F172A]">{currentFloorData.name}</span>
        <span>•</span>
        <span>{currentFloorData.subtitle}</span>
      </div>

      {/* CSS Keyframes for animated dashed route */}
      <style>{`
        @keyframes dash-flow {
          from {
            stroke-dashoffset: 24;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
};
