// =============================================================================
// i18n/index.ts — Internationalization (i18n) Configuration
// =============================================================================
//
// WHAT IS i18n?
// "i18n" is short for "internationalization" (i + 18 letters + n).
// It means making your app work in multiple languages.
//
// HOW IT WORKS:
// Instead of hardcoding English text in components:
//   <h1>Upload Document</h1>
//
// We use translation keys:
//   <h1>{t('upload.title')}</h1>
//
// The t() function looks up the key in the current language's translation file
// and returns the correct text: "Upload Document" (EN), "Dokument hochladen" (DE),
// or "Subir documento" (ES).
//
// LANGUAGE DETECTION:
// On first visit, i18next checks (in order):
//   1. localStorage — if the user previously chose a language, use that
//   2. navigator — the browser's language setting (from the OS)
// If neither matches a supported language, it falls back to English.
//
// The user's choice is saved in localStorage under the key "df_language"
// so it persists across browser restarts.
//
// INTERPOLATION:
// Translation strings can contain variables:
//   "documentsFound_other": "{{count}} documents found"
// When you call t('dashboard.documentsFound', { count: 42 }),
// it becomes "42 documents found".
//
// PLURALS:
// i18next handles pluralization automatically:
//   "documentsFound_one": "{{count}} document found"   ← used when count === 1
//   "documentsFound_other": "{{count}} documents found" ← used for all other counts
//
// escapeValue: false — React already escapes output to prevent XSS,
// so we don't need i18next to double-escape it.
// =============================================================================

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all translation files (bundled at build time — no network requests needed)
import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';

i18n
  .use(LanguageDetector)    // auto-detect browser/saved language
  .use(initReactI18next)    // connect i18next to React (provides useTranslation hook)
  .init({
    resources: {
      en: { translation: en },  // English translations
      de: { translation: de },  // German translations
      es: { translation: es },  // Spanish translations
    },
    fallbackLng: 'en',           // if a key is missing in de/es, fall back to English
    supportedLngs: ['en', 'de', 'es'], // only these languages are valid
    interpolation: {
      escapeValue: false,         // React already handles XSS prevention
    },
    detection: {
      order: ['localStorage', 'navigator'], // check saved preference first, then browser language
      caches: ['localStorage'],             // save the detected/chosen language here
      lookupLocalStorage: 'df_language',    // the localStorage key name
    },
  });

export default i18n;
