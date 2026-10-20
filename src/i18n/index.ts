import { useState, useEffect } from 'react';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, LanguageOption, getLanguageByCode } from './languages';
import { en } from './translations/en';
import { hi } from './translations/hi';
import { ta } from './translations/ta';
import { te } from './translations/te';
import { regionalTranslations } from './translations/regional';

const STORAGE_KEY = 'careconnect_language';
const ALT_STORAGE_KEY = 'healthconnect_language';
const CAREAI_STORAGE_KEY = 'careconnect_careai_language';

// Built-in dictionaries map
const dictionaries: Record<string, Record<string, string>> = {
  en,
  hi,
  ta,
  te,
  ...regionalTranslations,
};

let currentLanguage = DEFAULT_LANGUAGE;
let currentCareAiLanguage = DEFAULT_LANGUAGE;

// Initialize languages from localStorage
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(ALT_STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      currentLanguage = saved;
    }
  } catch {
    currentLanguage = DEFAULT_LANGUAGE;
  }

  try {
    const savedCareAi = localStorage.getItem(CAREAI_STORAGE_KEY);
    if (savedCareAi && SUPPORTED_LANGUAGES.some((l) => l.code === savedCareAi)) {
      currentCareAiLanguage = savedCareAi;
    }
  } catch {
    currentCareAiLanguage = DEFAULT_LANGUAGE;
  }
}

type LanguageChangeListener = (lang: string) => void;
const listeners = new Set<LanguageChangeListener>();
const careAiListeners = new Set<LanguageChangeListener>();

export const getLanguage = (): string => currentLanguage;

export const setLanguage = (langCode: string): void => {
  if (!SUPPORTED_LANGUAGES.some((l) => l.code === langCode)) {
    langCode = DEFAULT_LANGUAGE;
  }
  currentLanguage = langCode;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, langCode);
      localStorage.setItem(ALT_STORAGE_KEY, langCode);
      const html = document.documentElement;
      html.setAttribute('lang', langCode);
      const opt = getLanguageByCode(langCode);
      html.setAttribute('dir', opt.direction || 'ltr');
    } catch {
      // storage unavailable
    }
  }
  listeners.forEach((fn) => fn(langCode));
};

export const getCareAiLanguage = (): string => currentCareAiLanguage;

export const setCareAiLanguage = (langCode: string): void => {
  if (!SUPPORTED_LANGUAGES.some((l) => l.code === langCode)) {
    langCode = DEFAULT_LANGUAGE;
  }
  currentCareAiLanguage = langCode;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CAREAI_STORAGE_KEY, langCode);
    } catch {
      // storage unavailable
    }
  }
  careAiListeners.forEach((fn) => fn(langCode));
};

export const subscribeToLanguageChange = (listener: LanguageChangeListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const subscribeToCareAiLanguageChange = (listener: LanguageChangeListener): (() => void) => {
  careAiListeners.add(listener);
  return () => {
    careAiListeners.delete(listener);
  };
};

/**
 * Translation helper with controlled fallback:
 * Selected language -> English fallback -> Humanized key fallback.
 * Never returns undefined, null, or translation_key.
 */
export const t = (key: string, params?: Record<string, string | number>, langOverride?: string): string => {
  const lang = langOverride || currentLanguage;
  const dict = dictionaries[lang];
  let text = dict?.[key];

  if (!text) {
    // English fallback
    text = dictionaries.en?.[key];
  }

  if (!text) {
    // Safe humanized fallback for missing keys
    const lastPart = key.split('.').pop() || key;
    text = lastPart
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  if (params && text) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }

  return text;
};

export const getSpeechLocale = (langCode?: string): string => {
  const code = langCode || currentLanguage;
  const opt = getLanguageByCode(code);
  return opt.speechLocale || 'en-IN';
};

/**
 * React hook for language state & reactive re-rendering
 */
export const useLanguage = () => {
  const [language, setLangState] = useState<string>(getLanguage());

  useEffect(() => {
    return subscribeToLanguageChange((newLang) => {
      setLangState(newLang);
    });
  }, []);

  const changeLanguage = (code: string) => {
    setLanguage(code);
  };

  const currentOption: LanguageOption = getLanguageByCode(language);

  return {
    language,
    setLanguage: changeLanguage,
    t: (key: string, params?: Record<string, string | number>) => t(key, params, language),
    languageOption: currentOption,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
};

/**
 * Dedicated React hook for CareAI conversational language
 * Completely decoupled from global appLanguage.
 */
export const useCareAiLanguage = () => {
  const [careAiLanguage, setCareAiLangState] = useState<string>(getCareAiLanguage());

  useEffect(() => {
    return subscribeToCareAiLanguageChange((newLang) => {
      setCareAiLangState(newLang);
    });
  }, []);

  const changeCareAiLanguage = (code: string) => {
    setCareAiLanguage(code);
  };

  const currentOption: LanguageOption = getLanguageByCode(careAiLanguage);

  return {
    careAiLanguage,
    setCareAiLanguage: changeCareAiLanguage,
    t: (key: string, params?: Record<string, string | number>) => t(key, params, careAiLanguage),
    languageOption: currentOption,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
};

export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type LanguageOption, getLanguageByCode };

