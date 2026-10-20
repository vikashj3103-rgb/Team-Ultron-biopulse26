import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage, SUPPORTED_LANGUAGES, LanguageOption } from '../../i18n';
import { Globe, Check, ChevronDown } from 'lucide-react';

interface LanguageSelectorProps {
  variant?: 'header' | 'compact' | 'modal';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ variant = 'header', className = '' }) => {
  const { language, setLanguage, languageOption, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;

    // Viewport-safe width with 8px margin on either side
    const menuWidth = Math.min(260, Math.max(220, vw - 16));

    // Horizontal placement: align to right if trigger is in right half of screen, else left
    let left: number;
    const isRightHalf = (rect.left + rect.width / 2) > (vw / 2);
    if (isRightHalf) {
      left = rect.right - menuWidth;
    } else {
      left = rect.left;
    }
    // Clamp to viewport
    left = Math.max(8, Math.min(left, vw - menuWidth - 8));

    // Vertical placement: evaluate space below vs above
    const spaceBelow = vh - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const placeBelow = spaceBelow >= 200 || spaceBelow >= spaceAbove;

    const maxHeight = Math.min(340, Math.max(160, placeBelow ? spaceBelow - 8 : spaceAbove - 8));

    const style: React.CSSProperties = {
      position: 'fixed',
      left: `${Math.round(left)}px`,
      width: `${Math.round(menuWidth)}px`,
      maxHeight: `${Math.round(maxHeight)}px`,
      zIndex: 9999,
    };

    if (placeBelow) {
      style.top = `${Math.round(rect.bottom + 6)}px`;
      style.bottom = 'auto';
    } else {
      style.bottom = `${Math.round(vh - rect.top + 6)}px`;
      style.top = 'auto';
    }

    setMenuStyle(style);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  const handleSelect = (lang: LanguageOption) => {
    setLanguage(lang.code);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 min-h-11 rounded-xl text-xs font-medium transition-all cursor-pointer ${
          variant === 'header'
            ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
        } shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-blue-500`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={t('common.languageSelectorLabel', { language: languageOption.name, nativeName: languageOption.nativeName })}
        title={t('common.selectLanguageTitle', { language: languageOption.name, nativeName: languageOption.nativeName })}
        data-testid="language-selector-trigger"
      >
        <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="font-semibold hidden sm:inline">{languageOption.nativeName}</span>
        <span className="font-bold text-[11px] sm:hidden uppercase tracking-tight">{languageOption.code}</span>
        {variant !== 'compact' && languageOption.code !== 'en' && (
          <span className="text-slate-400 text-[10px] hidden md:inline">({languageOption.name})</span>
        )}
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Collision-Aware Dropdown Menu rendered via React Portal to document.body */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-1.5 focus:outline-hidden"
          role="menu"
          aria-label={t('common.selectLanguageList')}
        >
          <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
            {t('common.selectLanguageList')}
          </div>

          <div className="py-1">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = lang.code === language;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelect(lang)}
                  className={`w-full min-h-11 text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  role="menuitem"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-medium truncate">{lang.nativeName}</span>
                    <span className="text-slate-400 dark:text-slate-500 shrink-0">—</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{lang.name}</span>
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
