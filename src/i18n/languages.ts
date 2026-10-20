export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  speechLocale: string;
  direction?: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', speechLocale: 'en-IN', direction: 'ltr' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', speechLocale: 'hi-IN', direction: 'ltr' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', speechLocale: 'ta-IN', direction: 'ltr' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', speechLocale: 'te-IN', direction: 'ltr' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', speechLocale: 'kn-IN', direction: 'ltr' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', speechLocale: 'ml-IN', direction: 'ltr' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', speechLocale: 'mr-IN', direction: 'ltr' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', speechLocale: 'bn-IN', direction: 'ltr' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', speechLocale: 'gu-IN', direction: 'ltr' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', speechLocale: 'pa-IN', direction: 'ltr' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', speechLocale: 'or-IN', direction: 'ltr' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', speechLocale: 'as-IN', direction: 'ltr' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', speechLocale: 'ur-IN', direction: 'rtl' },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्', speechLocale: 'hi-IN', direction: 'ltr' },
  { code: 'mai', name: 'Maithili', nativeName: 'मैथिली', speechLocale: 'hi-IN', direction: 'ltr' },
  { code: 'kok', name: 'Konkani', nativeName: 'कोंकणी', speechLocale: 'mr-IN', direction: 'ltr' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', speechLocale: 'ne-NP', direction: 'ltr' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي', speechLocale: 'ur-IN', direction: 'rtl' },
  { code: 'ks', name: 'Kashmiri', nativeName: 'کٲشُر', speechLocale: 'ur-IN', direction: 'rtl' },
  { code: 'doi', name: 'Dogri', nativeName: 'डोगरी', speechLocale: 'hi-IN', direction: 'ltr' },
  { code: 'mni', name: 'Manipuri', nativeName: 'মৈতৈলোন্', speechLocale: 'bn-IN', direction: 'ltr' },
  { code: 'brx', name: 'Bodo', nativeName: 'बड़ो', speechLocale: 'hi-IN', direction: 'ltr' },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', speechLocale: 'en-IN', direction: 'ltr' },
];

export const DEFAULT_LANGUAGE = 'en';

export const getLanguageByCode = (code: string): LanguageOption => {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code) || SUPPORTED_LANGUAGES[0];
};
