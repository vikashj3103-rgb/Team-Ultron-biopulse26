import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, GripVertical, RotateCcw } from 'lucide-react';

interface FloatingCareAiButtonProps {
  onClick: () => void;
  isOpen?: boolean;
  label?: string;
  className?: string;
}

interface Position {
  x: number;
  y: number;
}

const STORAGE_KEY = 'healthconnect_careai_position';

export const FloatingCareAiButton: React.FC<FloatingCareAiButtonProps> = ({
  onClick,
  isOpen = false,
  label,
  className = '',
}) => {
  const [customPos, setCustomPos] = useState<Position | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const latestPosRef = useRef<Position | null>(customPos);
  const dragStartPointer = useRef({ clientX: 0, clientY: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const hasMovedBeyondThreshold = useRef(false);

  // Keep latestPosRef in sync with customPos
  useEffect(() => {
    latestPosRef.current = customPos;
  }, [customPos]);

  // Clamp coordinates within safe viewport boundaries
  const clampPosition = useCallback((x: number, y: number, elementWidth = 118, elementHeight = 48): Position => {
    // Under 1280px (mobile/tablet), reserve safe bottom clearance for the 63px bottom nav + 16px margin
    const isMobileTablet = window.innerWidth < 1280;
    const minX = 12;
    const maxX = Math.max(12, window.innerWidth - elementWidth - 12);
    const minY = 68; // below top hospital header
    const bottomNavHeight = isMobileTablet ? 84 : 24; // 63px bottom nav + 16px safe clearance on mobile/tablet
    const maxY = Math.max(minY, window.innerHeight - elementHeight - bottomNavHeight);

    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  }, []);

  // Re-clamp position on window resize
  useEffect(() => {
    const handleResize = () => {
      setCustomPos((prev) => {
        if (!prev) return null;
        const rect = buttonRef.current?.getBoundingClientRect();
        const clamped = clampPosition(prev.x, prev.y, rect?.width || 118, rect?.height || 48);
        latestPosRef.current = clamped;
        return clamped;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  // Rock-solid mouse and touch dragging via window-level pointer listeners
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Accept primary mouse button (button 0) or touch/pen
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Prevent default to disable text selection and native HTML5 dragging
    e.preventDefault();

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragStartPointer.current = { clientX: e.clientX, clientY: e.clientY };
    dragStartPos.current = { x: rect.left, y: rect.top };
    hasMovedBeyondThreshold.current = false;
    isDraggingRef.current = false;

    // Window-level listeners ensure continuous tracking even if cursor moves fast
    const handleGlobalPointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - dragStartPointer.current.clientX;
      const dy = moveEvent.clientY - dragStartPointer.current.clientY;

      if (!hasMovedBeyondThreshold.current && Math.hypot(dx, dy) > 6) {
        hasMovedBeyondThreshold.current = true;
        isDraggingRef.current = true;
        setIsDragging(true);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
      }

      if (hasMovedBeyondThreshold.current) {
        const rawX = dragStartPos.current.x + dx;
        const rawY = dragStartPos.current.y + dy;
        const currentRect = buttonRef.current?.getBoundingClientRect();
        const clamped = clampPosition(rawX, rawY, currentRect?.width || 118, currentRect?.height || 48);
        latestPosRef.current = clamped;
        setCustomPos(clamped);
      }
    };

    const handleGlobalPointerUp = () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerCancel);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      const wasDragging = isDraggingRef.current;
      isDraggingRef.current = false;
      setIsDragging(false);

      if (wasDragging || hasMovedBeyondThreshold.current) {
        // Drag complete: persist position to localStorage and DO NOT open modal
        if (latestPosRef.current) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(latestPosRef.current));
          } catch {
            // ignore
          }
        }
      } else {
        // Normal click/tap: open the modal
        onClick();
      }
    };

    const handleGlobalPointerCancel = () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerCancel);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handleGlobalPointerMove, { passive: false });
    window.addEventListener('pointerup', handleGlobalPointerUp, { passive: false });
    window.addEventListener('pointercancel', handleGlobalPointerCancel, { passive: false });
  };

  // Reset custom position back to default responsive CSS position
  const handleReset = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    latestPosRef.current = null;
    setCustomPos(null);
  };

  return (
    <div
      ref={containerRef}
      style={
        customPos
          ? {
              position: 'fixed',
              left: `${customPos.x}px`,
              top: `${customPos.y}px`,
              zIndex: 40,
              touchAction: 'none',
              userSelect: 'none',
            }
          : {
              touchAction: 'none',
              userSelect: 'none',
            }
      }
      className={
        customPos
          ? 'fixed z-40 flex items-center gap-1.5'
          : 'fixed bottom-[calc(63px+16px+env(safe-area-inset-bottom,0px))] right-4 xl:bottom-6 xl:right-6 z-40 flex items-center gap-1.5'
      }
    >
      {/* 1. Main Canonical CareAI Floating Launcher Button */}
      <button
        ref={buttonRef}
        type="button"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleReset}
        data-tour="careai-launcher"
        aria-label={label || 'Open CareAI Clinical Assistant (drag to reposition, double-click to reset)'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={customPos ? 'CareAI (drag to reposition, double-click to reset)' : 'CareAI (drag to reposition)'}
        style={{ touchAction: 'none' }}
        className={`group flex min-h-11 select-none items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#0F172A] shadow-xs transition-colors duration-150 hover:bg-[#F8FAFC] hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB] active:scale-95 ${
          isDragging ? 'cursor-grabbing shadow-sm ring-1 ring-[#2563EB]/40' : 'cursor-grab'
        } ${className}`}
      >
        <GripVertical
          className="h-3.5 w-3.5 text-[#94A3B8] transition-colors group-hover:text-slate-600 pointer-events-none select-none"
          aria-hidden="true"
        />
        <Sparkles className="h-4 w-4 text-[#2563EB] shrink-0 pointer-events-none select-none" aria-hidden="true" />
        <span className="font-semibold text-[#0F172A] pointer-events-none select-none">CareAI</span>
      </button>

      {/* 2. Sibling Reset Position Button: Phase 54 compliant (NOT nested inside launcher button) */}
      {customPos && (
        <button
          type="button"
          onClick={handleReset}
          title="Reset CareAI position to default"
          aria-label="Reset CareAI button position to default"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#CBD5E1] bg-white text-[#64748B] shadow-xs transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB] cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5 pointer-events-none" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
