import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeAccent } from '../types';

export const THEME_ACCENTS: ThemeAccent[] = [
  { id: 'orange', name: 'Coral Orange', hex: '#fd7e14', rgb: '253, 126, 20' },
  { id: 'red', name: 'Crimson Red', hex: '#dc3545', rgb: '220, 53, 69' },
  { id: 'blue', name: 'Classic Blue', hex: '#0d6efd', rgb: '13, 110, 253' },
  { id: 'indigo', name: 'Deep Indigo', hex: '#6610f2', rgb: '102, 16, 242' },
  { id: 'purple', name: 'Royal Purple', hex: '#6f42c1', rgb: '111, 66, 193' },
  { id: 'pink', name: 'Vibrant Pink', hex: '#d63384', rgb: '214, 51, 132' },
  { id: 'yellow', name: 'Sunny Yellow', hex: '#ffc107', rgb: '255, 193, 7' },
  { id: 'green', name: 'Emerald Green', hex: '#198754', rgb: '25, 135, 84' },
  { id: 'teal', name: 'Mint Teal', hex: '#20c997', rgb: '32, 201, 151' },
  { id: 'cyan', name: 'Electric Cyan', hex: '#0dcaf0', rgb: '13, 202, 240' }
];

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  accent: ThemeAccent;
  setAccent: (accent: ThemeAccent) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('sipspot_theme_dark');
    return saved === 'true';
  });

  const [accent, setAccentState] = useState<ThemeAccent>(() => {
    const saved = localStorage.getItem('sipspot_accent_id');
    const found = THEME_ACCENTS.find(a => a.id === saved);
    return found || THEME_ACCENTS[0]; // Default to Orange (#fd7e14)
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (isDarkMode) {
      root.classList.add('dark');
      body.classList.add('dark');
      localStorage.setItem('sipspot_theme_dark', 'true');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
      localStorage.setItem('sipspot_theme_dark', 'false');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent-color', accent.hex);
    root.style.setProperty('--accent-rgb', accent.rgb);
    localStorage.setItem('sipspot_accent_id', accent.id);
  }, [accent]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);
  const setAccent = (newAccent: ThemeAccent) => setAccentState(newAccent);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
