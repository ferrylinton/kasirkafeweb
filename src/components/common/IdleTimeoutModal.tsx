import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, ShieldCheck, LogOut, AlertTriangle, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

export const IdleTimeoutModal: React.FC = () => {
  const { showIdleWarning, idleWarningSecondsLeft, extendSession, logout } = useAuth();
  const { t } = useLanguage();
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  // Autofocus primary extend button when modal appears
  useEffect(() => {
    if (showIdleWarning) {
      const timer = setTimeout(() => {
        primaryButtonRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [showIdleWarning]);

  // Keyboard navigation: Enter extends session, Escape logs out immediately
  useEffect(() => {
    if (!showIdleWarning) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        logout();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        extendSession();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showIdleWarning, extendSession, logout]);

  if (!showIdleWarning) return null;

  const seconds = Math.max(0, idleWarningSecondsLeft);
  const isUrgent = seconds <= 15;
  const progressPercent = Math.min(100, Math.max(0, (seconds / 60) * 100));

  // Circular progress math (r = 44, circumference = 2 * PI * 44 ≈ 276.46)
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <AnimatePresence>
      <div
        id="idle-timeout-modal-overlay"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-warning-title"
        aria-describedby="idle-warning-desc"
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-stone-950/75 backdrop-blur-md transition-all select-none"
      >
        <motion.div
          id="idle-timeout-modal-card"
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ type: 'spring', damping: 26, stiffness: 340 }}
          className={`w-full max-w-md rounded-3xl bg-white dark:bg-[#231b18] p-6 sm:p-8 shadow-2xl border ${
            isUrgent
              ? 'border-rose-400 dark:border-rose-700/80 ring-4 ring-rose-500/20'
              : 'border-amber-300 dark:border-amber-700/70 ring-4 ring-amber-500/15'
          } text-stone-900 dark:text-stone-100 flex flex-col gap-6 relative overflow-hidden`}
        >
          {/* Top Background Glow Accent */}
          <div
            className={`absolute -top-24 -right-24 w-52 h-52 rounded-full blur-3xl pointer-events-none opacity-40 ${
              isUrgent ? 'bg-rose-500' : 'bg-amber-500'
            }`}
          />

          {/* Header Banner */}
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                isUrgent
                  ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 animate-pulse'
                  : 'bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400'
              }`}
            >
              {isUrgent ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <Clock className="w-6 h-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2
                  id="idle-warning-title"
                  className="text-lg sm:text-xl font-extrabold font-heading text-stone-900 dark:text-stone-100 leading-tight"
                >
                  {t('idleWarningTitle')}
                </h2>
                {isUrgent && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500 text-white animate-bounce shrink-0">
                    Kritis
                  </span>
                )}
              </div>
              <p
                id="idle-warning-desc"
                className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed"
              >
                {t('idleWarningSubtitle')}
              </p>
            </div>
          </div>

          {/* Center Visual Circular Countdown */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-36 h-36 flex items-center justify-center">
              {/* Background ring track */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className="stroke-stone-100 dark:stroke-stone-800"
                  strokeWidth="8"
                  fill="transparent"
                />
                {/* Animated countdown progress ring */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke={isUrgent ? '#ef4444' : '#f59e0b'}
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>

              {/* Number and Label Display */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span
                  id="idle-countdown-seconds"
                  className={`text-4xl sm:text-5xl font-extrabold font-heading tracking-tight tabular-nums transition-colors ${
                    isUrgent
                      ? 'text-rose-600 dark:text-rose-400 animate-pulse'
                      : 'text-stone-900 dark:text-stone-100'
                  }`}
                >
                  {String(seconds).padStart(2, '0')}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 mt-0.5">
                  {t('idleWarningSeconds')}
                </span>
              </div>
            </div>

            {/* Linear Progress Bar below the ring */}
            <div className="w-full max-w-xs mt-3">
              <div className="w-full h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                    isUrgent
                      ? 'bg-gradient-to-r from-rose-500 to-red-600'
                      : 'bg-gradient-to-r from-amber-400 to-orange-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-stone-400 dark:text-stone-500 mt-1 px-1 font-mono">
                <span>0s</span>
                <span>00:{String(seconds).padStart(2, '0')}</span>
                <span>60s</span>
              </div>
            </div>

            {isUrgent && (
              <p className="text-xs text-center font-bold text-rose-600 dark:text-rose-400 mt-2 px-2 animate-pulse">
                {t('idleWarningUrgentWarning')}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            {/* Primary: Extend Session */}
            <button
              id="idle-extend-session-btn"
              ref={primaryButtonRef}
              type="button"
              onClick={extendSession}
              className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-2xl text-sm font-extrabold text-white shadow-lg transition-all active:scale-[0.98] ${
                isUrgent
                  ? 'bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 shadow-rose-500/25 ring-2 ring-rose-400/40'
                  : 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-orange-500/25 ring-2 ring-orange-400/30'
              }`}
            >
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <span>{t('idleWarningExtendBtn')}</span>
            </button>

            {/* Secondary: Logout Now */}
            <button
              id="idle-logout-now-btn"
              type="button"
              onClick={logout}
              className="sm:w-auto flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/60 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold transition-colors active:scale-95"
            >
              <LogOut className="w-4 h-4 text-stone-500 shrink-0" />
              <span>{t('idleWarningLogoutBtn')}</span>
            </button>
          </div>

          {/* Security note footer */}
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-center gap-1.5 text-[11px] text-stone-400 dark:text-stone-500">
            <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <span className="truncate">{t('idleWarningSecuredNote')}</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
