import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

// Retrieve stored language or default to Indonesia ('id')
const savedLang = typeof window !== 'undefined' ? localStorage.getItem('kasirkafe_lang') : null;
const initialLanguage = savedLang === 'en' || savedLang === 'id' ? savedLang : 'id';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'id',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
    }
  });

// Synchronize HTML lang attribute based on current language
if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLanguage;
}

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem('kasirkafe_lang', lng);
  }
});

export default i18n;
