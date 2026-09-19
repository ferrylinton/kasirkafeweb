import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  X,
  Delete,
  RefreshCw,
  AlertCircle,
  KeyRound,
  Lock
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface ManagerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserName: string;
  onSubmitPin: (pin: string) => Promise<void> | void;
  isLoading?: boolean;
  errorMessage?: string;
  onClearError?: () => void;
}

export const ManagerAuthModal: React.FC<ManagerAuthModalProps> = ({
  isOpen,
  onClose,
  targetUserName,
  onSubmitPin,
  isLoading = false,
  errorMessage = '',
  onClearError
}) => {
  const { language } = useLanguage();
  const [pin, setPin] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setPin('');
      if (onClearError) onClearError();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigitClick = (num: number) => {
    if (isLoading) return;
    if (errorMessage && onClearError) onClearError();
    if (pin.length < 6) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 6) {
        onSubmitPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    if (isLoading) return;
    if (errorMessage && onClearError) onClearError();
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isLoading) return;
    if (errorMessage && onClearError) onClearError();
    setPin('');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={isLoading ? undefined : onClose}
          className="fixed inset-0 bg-stone-900/60 dark:bg-stone-950/80 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-sm bg-white dark:bg-[#201a18] rounded-3xl shadow-2xl border border-stone-200/80 dark:border-stone-800 overflow-hidden z-10 flex flex-col my-auto"
        >
          {/* Header */}
          <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-900/50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold font-heading text-stone-900 dark:text-stone-100">
                  {language === 'en' ? 'Manager Force Logout' : 'Otorisasi PIN Manager'}
                </h3>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  {language === 'en' ? 'Force logout active cashier session' : 'Putuskan sesi kasir di browser lain'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Prompt description */}
          <div className="px-6 pt-4 pb-2 text-center">
            <p className="text-xs text-stone-600 dark:text-stone-300">
              {language === 'en'
                ? `Enter 6-digit Manager PIN to force logout previous session for `
                : `Masukkan 6-digit PIN Manager untuk mengeluarkan sesi `}
              <strong className="text-stone-900 dark:text-stone-100">{targetUserName}</strong>:
            </p>

            {/* Error Message */}
            {errorMessage && (
              <div className="mt-3 p-2.5 rounded-xl bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
            )}

            {/* 6-Digit PIN Display Indicator */}
            <div className="flex items-center justify-center gap-2.5 mt-4 mb-2">
              {[0, 1, 2, 3, 4, 5].map(idx => {
                const isFilled = pin.length > idx;
                const isCurrent = pin.length === idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full transition-all duration-200 ${
                      isFilled
                        ? 'bg-accent scale-110 shadow-xs'
                        : isCurrent
                        ? 'border-2 border-accent scale-100 bg-transparent animate-pulse'
                        : 'border-2 border-stone-300 dark:border-stone-700 bg-transparent'
                    }`}
                  />
                );
              })}
            </div>

            <p className="text-[11px] text-stone-400 mt-1">
              {isLoading ? (
                <span className="inline-flex items-center gap-1 text-accent font-semibold">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {language === 'en' ? 'Verifying Manager PIN...' : 'Memverifikasi PIN Manager...'}
                </span>
              ) : (
                `${pin.length}/6 Digit`
              )}
            </p>
          </div>

          {/* Keypad */}
          <div className="p-4 pt-1">
            <div className="grid grid-cols-3 gap-2 w-full max-w-[260px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleDigitClick(num)}
                  disabled={isLoading || pin.length >= 6}
                  className="h-13 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 active:scale-95 text-lg font-bold text-stone-800 dark:text-stone-100 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                onClick={handleClear}
                disabled={isLoading || pin.length === 0}
                className="h-13 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 active:scale-95 text-xs font-bold text-stone-500 dark:text-stone-400 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30"
              >
                C
              </button>

              <button
                type="button"
                onClick={() => handleDigitClick(0)}
                disabled={isLoading || pin.length >= 6}
                className="h-13 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 active:scale-95 text-lg font-bold text-stone-800 dark:text-stone-100 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                disabled={isLoading || pin.length === 0}
                className="h-13 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 active:scale-95 text-stone-600 dark:text-stone-300 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30"
                title="Hapus"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 text-center">
              <span className="text-[10px] text-stone-400">
                Hint: PIN Default Manager: <code className="bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded font-bold text-accent">123456</code>
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
