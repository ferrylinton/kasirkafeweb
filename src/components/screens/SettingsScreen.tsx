import React from 'react';
import {
  Settings,
  Globe,
  Palette,
  Moon,
  Sun,
  Check,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Info,
  CheckCircle2,
  Layers,
  Shield,
  Clock,
  Database,
  Zap,
  Trash2
} from 'lucide-react';
import { useTheme, THEME_ACCENTS } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { clearClientCatalogCache } from '../../utils/productCache';

export const SettingsScreen: React.FC = () => {
  const { isDarkMode, toggleDarkMode, accent, setAccent } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { simulateIdleWarning } = useAuth();
  const { showToast } = useToast();
  const [clearingCache, setClearingCache] = React.useState(false);

  const handleClearCatalogCache = async () => {
    setClearingCache(true);
    try {
      // 1. Clear client cache (LocalStorage & memory)
      clearClientCatalogCache();

      // 2. Clear server cache via API
      await fetch('/api/products/cache/clear', { method: 'POST' });

      showToast(
        language === 'id'
          ? 'Cache produk dan kategori berhasil dibersihkan!'
          : 'Product and category cache successfully cleared!',
        'success'
      );
    } catch (err) {
      showToast(
        language === 'id' ? 'Gagal membersihkan cache server' : 'Failed to clear server cache',
        'warning'
      );
    } finally {
      setClearingCache(false);
    }
  };

  const handleResetDefaults = () => {
    // Default: Light mode, Coral Orange, Indonesian
    if (isDarkMode) {
      toggleDarkMode();
    }
    const defaultAccent = THEME_ACCENTS[0]; // Coral Orange
    setAccent(defaultAccent);
    setLanguage('id');
    showToast(t('resetSettingsConfirm'), 'success');
  };

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-4xl mx-auto flex flex-col gap-6 select-none">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/80 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shrink-0 shadow-xs">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-stone-900 dark:text-stone-100">
                {t('settingsTitle')}
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {t('settingsSubtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Reset to Default Button */}
        <button
          type="button"
          onClick={handleResetDefaults}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#251e1c] hover:bg-stone-100 dark:hover:bg-stone-850 text-xs font-semibold text-stone-700 dark:text-stone-300 transition-all shadow-2xs active:scale-95"
          title="Kembalikan semua preferensi ke standar"
        >
          <RotateCcw className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
          <span>{t('resetSettings')}</span>
        </button>
      </div>

      {/* 2. Language Toggle Section */}
      <section className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-heading text-stone-900 dark:text-stone-100">
                {t('languageSection')}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {t('languageDescription')}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
            {language.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Option: Indonesian */}
          <button
            type="button"
            onClick={() => setLanguage('id')}
            className={`p-4 rounded-2xl border text-left transition-all flex items-start justify-between gap-3 relative ${
              language === 'id'
                ? 'border-accent bg-orange-50/60 dark:bg-orange-950/30 ring-2 ring-accent/20'
                : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50/50 dark:bg-stone-900/40'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <span className="text-2xl select-none">🇮🇩</span>
              <div className="min-w-0">
                <div className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>{t('langIndonesian')}</span>
                  {language === 'id' && (
                    <span className="px-1.5 py-0.2 rounded-md bg-accent text-white text-[9px] font-bold">
                      {t('settingActiveBadge')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
                  {t('langIndonesianDesc')}
                </p>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                language === 'id'
                  ? 'bg-accent text-white'
                  : 'border border-stone-300 dark:border-stone-700'
              }`}
            >
              {language === 'id' && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
          </button>

          {/* Option: English */}
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`p-4 rounded-2xl border text-left transition-all flex items-start justify-between gap-3 relative ${
              language === 'en'
                ? 'border-accent bg-orange-50/60 dark:bg-orange-950/30 ring-2 ring-accent/20'
                : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50/50 dark:bg-stone-900/40'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <span className="text-2xl select-none">🇺🇸</span>
              <div className="min-w-0">
                <div className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>{t('langEnglish')}</span>
                  {language === 'en' && (
                    <span className="px-1.5 py-0.2 rounded-md bg-accent text-white text-[9px] font-bold">
                      {t('settingActiveBadge')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
                  {t('langEnglishDesc')}
                </p>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                language === 'en'
                  ? 'bg-accent text-white'
                  : 'border border-stone-300 dark:border-stone-700'
              }`}
            >
              {language === 'en' && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
          </button>
        </div>
      </section>

      {/* 3. Dark Mode Switcher Section */}
      <section className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-bold font-heading text-stone-900 dark:text-stone-100">
                {t('appearanceSection')}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {t('appearanceDescription')}
              </p>
            </div>
          </div>

          {/* Quick Toggle Pill Switch */}
          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            title="Klik untuk beralih mode tampilan"
          >
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              {isDarkMode ? t('modeDark') : t('modeLight')}
            </span>
            <div
              className={`w-10 h-5 rounded-full p-0.5 transition-colors ${
                isDarkMode ? 'bg-accent' : 'bg-stone-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  isDarkMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Light Mode Card */}
          <button
            type="button"
            onClick={() => isDarkMode && toggleDarkMode()}
            className={`p-4 rounded-2xl border text-left transition-all flex items-start justify-between gap-3 relative ${
              !isDarkMode
                ? 'border-accent bg-orange-50/60 ring-2 ring-accent/20'
                : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50/50 dark:bg-stone-900/40'
            }`}
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
                <Sun className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>{t('modeLight')}</span>
                  {!isDarkMode && (
                    <span className="px-1.5 py-0.2 rounded-md bg-accent text-white text-[9px] font-bold">
                      {t('settingActiveBadge')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
                  {t('modeLightDesc')}
                </p>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                !isDarkMode
                  ? 'bg-accent text-white'
                  : 'border border-stone-300 dark:border-stone-700'
              }`}
            >
              {!isDarkMode && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
          </button>

          {/* Dark Mode Card */}
          <button
            type="button"
            onClick={() => !isDarkMode && toggleDarkMode()}
            className={`p-4 rounded-2xl border text-left transition-all flex items-start justify-between gap-3 relative ${
              isDarkMode
                ? 'border-accent bg-orange-950/30 ring-2 ring-accent/20'
                : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50/50 dark:bg-stone-900/40'
            }`}
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-stone-800 text-amber-300 flex items-center justify-center shrink-0 shadow-2xs">
                <Moon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>{t('modeDark')}</span>
                  {isDarkMode && (
                    <span className="px-1.5 py-0.2 rounded-md bg-accent text-white text-[9px] font-bold">
                      {t('settingActiveBadge')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
                  {t('modeDarkDesc')}
                </p>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                isDarkMode
                  ? 'bg-accent text-white'
                  : 'border border-stone-300 dark:border-stone-700'
              }`}
            >
              {isDarkMode && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
          </button>
        </div>
      </section>

      {/* 4. Theme Accents Picker Section */}
      <section className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-heading text-stone-900 dark:text-stone-100">
                {t('themeAccentSection')}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {t('themeAccentDescription')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs border border-white dark:border-stone-900"
              style={{ backgroundColor: accent.hex }}
            />
            <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
              {accent.name}
            </span>
            <span className="text-[10px] font-mono text-stone-400 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded-md">
              {accent.hex}
            </span>
          </div>
        </div>

        {/* 10 Theme Accents Grid */}
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-3">
          {THEME_ACCENTS.map(acc => {
            const isSelected = accent.id === acc.id;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => setAccent(acc)}
                className={`p-3 rounded-2xl border transition-all flex flex-col items-center text-center gap-2.5 relative group ${
                  isSelected
                    ? 'border-stone-900 dark:border-stone-100 bg-stone-50 dark:bg-stone-800/60 ring-2 ring-stone-900/10 dark:ring-white/10 shadow-xs'
                    : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-white dark:bg-stone-900/30'
                }`}
              >
                {/* Accent Color Circle */}
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-2xl shadow-sm flex items-center justify-center text-white transition-transform group-hover:scale-105"
                    style={{ backgroundColor: acc.hex }}
                  >
                    {isSelected && <Check className="w-5 h-5 stroke-[2.5]" />}
                  </div>
                </div>

                {/* Accent Details */}
                <div className="w-full min-w-0">
                  <div className="font-bold text-xs text-stone-900 dark:text-stone-100 truncate">
                    {acc.name}
                  </div>
                  <div className="text-[10px] font-mono text-stone-400 truncate mt-0.5">
                    {acc.hex}
                  </div>
                </div>

                {isSelected && (
                  <div
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] shadow-xs"
                    style={{ backgroundColor: acc.hex }}
                  >
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Live UI Component Preview Card */}
        <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-stone-50/80 dark:bg-stone-900/50 border border-stone-200/60 dark:border-stone-800/60 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold font-heading text-stone-900 dark:text-stone-100">
                {t('previewUiTitle')}
              </span>
            </div>
            <span className="text-[10px] text-stone-400 dark:text-stone-500 font-medium">
              {t('previewUiSubtitle')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Live Interactive Button & Badges */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#1f1917] border border-stone-200/80 dark:border-stone-800 flex flex-col justify-between gap-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                  Lencana & Tombol Utama
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-accent/15 text-accent border border-accent/20">
                  {accent.name}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  className="flex-1 py-2 px-3 rounded-xl bg-accent text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 hover:opacity-95 transition-opacity"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>{t('sampleButton')}</span>
                </button>
                <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Live Catalog Product Mockup */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#1f1917] border border-stone-200/80 dark:border-stone-800 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-accent flex items-center justify-center shrink-0">
                  ☕
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-stone-900 dark:text-stone-100 truncate">
                    {t('sampleCardTitle')}
                  </div>
                  <div className="text-xs font-extrabold text-accent">
                    {t('samplePrice')}
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1.5 rounded-lg bg-accent text-white text-[11px] font-bold shrink-0 shadow-2xs">
                + Tambah
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Session Security & Idle Timeout Section */}
      <section className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-heading text-stone-900 dark:text-stone-100">
                {language === 'id' ? 'Keamanan Sesi & Timeout Idle (15 Menit)' : 'Session Security & Idle Timeout (15 Mins)'}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {language === 'id'
                  ? 'Modal hitung mundur 60 detik otomatis muncul sebelum sesi kasir berakhir untuk mencegah akses kasir tidak sah.'
                  : 'A 60-second visual countdown modal appears before cashier session expires to prevent unauthorized access.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
              <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{language === 'id' ? 'Proteksi Terminal Kasir Aktif' : 'Cashier Terminal Protection Active'}</span>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 max-w-xl">
              {language === 'id'
                ? 'Setelah 14 menit tanpa interaksi, sistem menampilkan modal hitung mundur 60 detik dengan opsi "Perpanjang Sesi". Jika diabaikan, sesi keluar otomatis demi keamanan.'
                : 'After 14 minutes of inactivity, a 60-second countdown modal displays with an "Extend Session" option. If ignored, session automatically logs out for safety.'}
            </p>
          </div>

          <button
            type="button"
            id="test-idle-warning-modal-btn"
            onClick={() => simulateIdleWarning()}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{language === 'id' ? 'Uji Modal Hitung Mundur (60s)' : 'Test Countdown Modal (60s)'}</span>
          </button>
        </div>
      </section>

      {/* 6. Product & Category Cache Management */}
      <section className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-heading text-stone-900 dark:text-stone-100">
                {language === 'id' ? 'Cache & Akselerasi Katalog' : 'Catalog Cache & Acceleration'}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {language === 'id'
                  ? 'Akselerasi visual 0ms untuk katalog produk dan kategori menggunakan memori lokal dan server cache TTL'
                  : '0ms visual acceleration for product catalog & categories with local memory and server TTL cache'}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
            {language === 'id' ? 'Aktif' : 'Active'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/40 border border-stone-200/60 dark:border-stone-800/60 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-stone-800 dark:text-stone-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{language === 'id' ? 'Client-Side In-Memory & LocalStorage' : 'Client In-Memory & Storage'}</span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              {language === 'id'
                ? 'Menyimpan produk & kategori untuk navigasi instan antar tab kategori tanpa re-render berlebih.'
                : 'Caches products & categories for instant 0ms switching between categories.'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/40 border border-stone-200/60 dark:border-stone-800/60 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-stone-800 dark:text-stone-200">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>{language === 'id' ? 'Server-Side Tagged Cache (TTL 5 Menit)' : 'Server Tagged Cache (5m TTL)'}</span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              {language === 'id'
                ? 'Secara cerdas di-invalidasi otomatis saat terjadi restock inventaris, pesanan baru, atau impor CSV.'
                : 'Automatically invalidated on inventory restock, new orders, or CSV import.'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-stone-500 dark:text-stone-400">
            {language === 'id'
              ? 'Bersihkan cache jika ingin memaksa sinkronisasi ulang total data katalog.'
              : 'Clear cache if you wish to force total catalog re-synchronization.'}
          </p>
          <button
            type="button"
            onClick={handleClearCatalogCache}
            disabled={clearingCache}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#251e1c] hover:bg-stone-100 dark:hover:bg-stone-850 text-xs font-semibold text-rose-600 dark:text-rose-400 transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{clearingCache ? (language === 'id' ? 'Membersihkan...' : 'Clearing...') : (language === 'id' ? 'Bersihkan Cache' : 'Clear Cache')}</span>
          </button>
        </div>
      </section>

      {/* 7. System Information Card */}
      <section className="p-5 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-bold text-xs uppercase tracking-wider">
          <Info className="w-3.5 h-3.5 text-stone-400" />
          <span>{t('systemInfoSection')}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900/40 border border-stone-200/60 dark:border-stone-800/60">
            <span className="text-[11px] text-stone-400 block">{t('systemAppVersion')}</span>
            <span className="font-bold text-stone-800 dark:text-stone-200 mt-0.5 block">
              KasirKafe POS Enterprise v2.4
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900/40 border border-stone-200/60 dark:border-stone-800/60">
            <span className="text-[11px] text-stone-400 block">{t('systemOutlet')}</span>
            <span className="font-bold text-stone-800 dark:text-stone-200 mt-0.5 block">
              Outlet Senopati • Register 01
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900/40 border border-stone-200/60 dark:border-stone-800/60">
            <span className="text-[11px] text-stone-400 block">{t('systemDevice')}</span>
            <span className="font-bold text-stone-800 dark:text-stone-200 mt-0.5 block text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {t('systemLocalStorage')}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
