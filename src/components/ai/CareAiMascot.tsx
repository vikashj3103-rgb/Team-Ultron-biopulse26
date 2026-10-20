import React from 'react';

interface CareAiMascotProps {
  className?: string;
  size?: number;
}

/**
 * HealthConnect Formal Clinical CareAI Mascot / Assistant Illustration
 * 
 * Strict Clinical Hierarchy (Clean White Medical Device Appearance):
 * - Main mascot body/chassis: #FFFFFF (Dominant clean white)
 * - Secondary body sections: #F8FAFC (Subtle off-white)
 * - Borders/outlines: #CBD5E1 (Neutral slate borders)
 * - Dark details/visor frame: #0F172A (Deep clinical navy screen)
 * - Small medical-blue accent only where necessary: #2563EB (Subtle medical blue accents)
 * - Status/eyes: #059669 (Stable clinical green)
 * - Shadow/base: #CBD5E1 (Neutral ground base)
 * 
 * Strictly Removed: #7C3AED, #8B5CF6, #A855F7, #9333EA, #1E40AF, zero violet/purple/neon.
 */
export const CareAiMascot: React.FC<CareAiMascotProps> = ({
  className = '',
  size = 56,
}) => {
  return (
    <div
      className={`inline-flex items-center justify-center pointer-events-none select-none ${className}`}
      data-tour="careai-mascot"
      aria-hidden="true"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* 1. Neutral Ground Shadow */}
        <ellipse cx="32" cy="58" rx="20" ry="3.5" fill="#CBD5E1" opacity="0.6" />

        {/* 2. Medical Sensor Antenna */}
        <path d="M32 14V8" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="32" cy="7" r="3" fill="#CBD5E1" />
        <circle cx="32" cy="7" r="1.5" fill="#059669" />

        {/* 3. Ear Transceivers / Head Sensors (Pure White #FFFFFF with Slate #CBD5E1 Border) */}
        <rect x="11" y="22" width="4" height="9" rx="2" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
        <rect x="49" y="22" width="4" height="9" rx="2" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />

        {/* 4. Main Head Unit (Dominant Pure White #FFFFFF with Neutral Slate #CBD5E1 border) */}
        <rect x="14" y="14" width="36" height="25" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.2" />

        {/* 5. Sleek Eye Visor Band Only (Dark Clinical Navy #0F172A with Slate Border) */}
        <rect x="18" y="20" width="28" height="11" rx="5" fill="#0F172A" stroke="#CBD5E1" strokeWidth="0.8" />

        {/* 6. Expressive Clinical Eyes (Stable Green Vital Indicator #059669 with White Catchlight) */}
        <circle cx="26" cy="25.5" r="2.8" fill="#059669" />
        <circle cx="27" cy="24.5" r="0.9" fill="#FFFFFF" />

        <circle cx="38" cy="25.5" r="2.8" fill="#059669" />
        <circle cx="39" cy="24.5" r="0.9" fill="#FFFFFF" />

        {/* 7. Friendly Clinical Waveform Smile on White Chin */}
        <path d="M29 34.5C30.2 35.8 33.8 35.8 35 34.5" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />

        {/* 8. Forehead Specular Reflection */}
        <path d="M20 17C24 16.2 28 16.2 32 16.5" stroke="#F1F5F9" strokeWidth="1.2" strokeLinecap="round" />

        {/* 9. Neck Joint */}
        <rect x="28" y="39" width="8" height="3" rx="1.5" fill="#CBD5E1" />

        {/* 10. Torso Body Chassis (Dominant Pure White #FFFFFF with Neutral Slate #CBD5E1 border) */}
        <path
          d="M20 42C20 40.8954 20.8954 40 22 40H42C43.1046 40 44 40.8954 44 42V51C44 53.7614 41.7614 56 39 56H25C22.2386 56 20 53.7614 20 51V42Z"
          fill="#FFFFFF"
          stroke="#CBD5E1"
          strokeWidth="1.2"
        />

        {/* 11. Chest Medical Badge (Secondary #F8FAFC with Tiny #2563EB Blue Medical Accent) */}
        <rect x="26" y="44" width="12" height="9" rx="2.5" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.8" />
        <path d="M32 46V51M29.5 48.5H34.5" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" />

        {/* 12. Left Arm (Pure White #FFFFFF with Neutral Slate #CBD5E1 stroke) */}
        <path
          d="M19 43C16 45 15 48 16 51C16.5 52.5 18 52.5 19 51C19.5 49.5 20 47 21 45"
          fill="#FFFFFF"
          stroke="#CBD5E1"
          strokeWidth="1"
        />

        {/* 13. Right Arm (Pure White #FFFFFF with Neutral Slate #CBD5E1 stroke & Stable Green Hand #059669) */}
        <path
          d="M45 44C48 42 50 40 51 38C52 36.5 53.5 37.5 53 39C52 41 49 45 46 47"
          fill="#FFFFFF"
          stroke="#CBD5E1"
          strokeWidth="1"
        />
        <circle cx="51.5" cy="38" r="2" fill="#059669" />
      </svg>
    </div>
  );
};
