import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  X,
  RefreshCw,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  UserCheck
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface ManagerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserName: string;
  onSubmitPassword: (password: string, managerEmail?: string) => Promise<void> | void;
  isLoading?: boolean;
  errorMessage?: string;
  onClearError?: () => void;
}

export const ManagerAuthModal: React.FC<ManagerAuthModalProps> = ({
  isOpen,
  onClose,
  targetUserName,
  onSubmitPassword,
  isLoading = false,
  errorMessage = '',
  onClearError
}) => {
  const { language } = useLanguage();
  const [managerEmail, setManagerEmail] = useState<string>('manager@beverage.com');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setManagerEmail('manager@beverage.com');
      setShowPassword(false);
      if (onClearError) onClearError();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !password.trim()) return;
    if (errorMessage && onClearError) onClearError();
    onSubmitPassword(password.trim(), managerEmail.trim());
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
          className="relative w-full max-w-md bg-white dark:bg-[#201a18] rounded-3xl shadow-2xl border border-stone-200/80 dark:border-stone-800 overflow-hidden z-10 flex flex-col my-auto"
        >
          {/* Header */}
          <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-900/50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold font-heading text-stone-900 dark:text-stone-100">
                  {language === 'en' ? 'Manager Authorization' : 'Otorisasi Password Manager'}
                </h3>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  {language === 'en' ? 'Force logout active cashier session' : 'Putuskan sesi kasir di browser atau perangkat lain'}
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

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              {language === 'en'
                ? `Enter Manager credentials to terminate the active session for `
                : `Masukkan password akun Manager untuk memutuskan sesi aktif `}
              <strong className="text-stone-900 dark:text-stone-100">{targetUserName}</strong>:
            </p>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
            )}

            {/* Manager Email field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                {language === 'en' ? 'Manager Email' : 'Email Akun Manager'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={managerEmail}
                  onChange={(e) => {
                    setManagerEmail(e.target.value);
                    if (errorMessage && onClearError) onClearError();
                  }}
                  required
                  placeholder="manager@beverage.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900/60 text-xs text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {/* Manager Password field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                {language === 'en' ? 'Manager Password' : 'Password Akun Manager'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage && onClearError) onClearError();
                  }}
                  required
                  placeholder="Masukkan kata sandi manager..."
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900/60 text-xs text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Buttons */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
              >
                {language === 'en' ? 'Cancel' : 'Batal'}
              </button>
              <button
                type="submit"
                disabled={isLoading || !password.trim()}
                className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{language === 'en' ? 'Verifying...' : 'Memverifikasi...'}</span>
                  </>
                ) : (
                  <span>{language === 'en' ? 'Authorize Logout' : 'Otorisasi Putus Sesi'}</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
