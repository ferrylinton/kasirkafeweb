import React, { createContext, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Language } from '../types';
import { resources } from '../i18n/resources';

export const translations = {
  id: resources.id.translation,
  en: resources.en.translation,
};

export type TranslationKey = keyof typeof resources.id.translation | string;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, options?: any) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t: i18nT, i18n } = useTranslation();

  const currentLang = (i18n.language?.startsWith('en') ? 'en' : 'id') as Language;

  useEffect(() => {
    // Sync HTML document lang attribute immediately
    if (typeof document !== 'undefined') {
      document.documentElement.lang = currentLang;
    }
  }, [currentLang]);

  const setLanguage = (lang: Language) => {
    i18n.changeLanguage(lang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('kasirkafe_lang', lang);
    }
  };

  const t = (key: TranslationKey, options?: any): string => {
    const result = i18nT(key as string, options);
    return typeof result === 'string' ? result : String(key);
  };

  return (
    <LanguageContext.Provider value={{ language: currentLang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
