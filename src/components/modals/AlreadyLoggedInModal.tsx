import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  X,
  Laptop,
  Clock,
  MapPin,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  User as UserIcon,
  RefreshCw
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface AlreadyLoggedInModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  userRole: string;
  device: string;
  ipAddress: string;
  timestamp: string;
  isSelfManager: boolean;
  onForceLogoutSelf: () => void;
  onRequestManagerAuth: () => void;
  isLoading?: boolean;
}

export const AlreadyLoggedInModal: React.FC<AlreadyLoggedInModalProps> = ({
  isOpen,
  onClose,
  userName,
  userEmail,
  userRole,
  device,
  ipAddress,
  timestamp,
  isSelfManager,
  onForceLogoutSelf,
  onRequestManagerAuth,
  isLoading = false
}) => {
  const { language } = useLanguage();

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return (
        d.toLocaleString(language === 'en' ? 'en-US' : 'id-ID', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Jakarta'
        }) + ' WIB'
      );
    } catch (e) {
      return dateStr;
    }
  };

  const isRoleManager = isSelfManager || userRole?.toUpperCase() === 'MANAGER';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-stone-900/60 dark:bg-stone-950/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-lg bg-white dark:bg-[#201a18] rounded-3xl shadow-2xl border border-stone-200/80 dark:border-stone-800 overflow-hidden z-10 flex flex-col my-auto"
        >
          {/* Header Bar */}
          <div className="p-6 border-b border-stone-100 dark:border-stone-800/80 flex items-start justify-between gap-3 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/15 dark:to-transparent">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs border border-amber-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heading text-stone-900 dark:text-stone-100">
                  {language === 'en' ? 'User Already Logged In' : 'Pengguna Sedang Aktif di Browser Lain'}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  {language === 'en'
                    ? 'Concurrent sessions are blocked to maintain checkout security.'
                    : 'Akun yang sama tidak dapat digunakan login bersamaan di browser lain.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-4">
            {/* Active Session Info Card */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200/80 dark:border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs font-bold">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">{userName}</h4>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">{userEmail}</p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {language === 'en' ? 'Active Session' : 'Sesi Sedang Aktif'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-stone-200/60 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-300">
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-stone-400 shrink-0" />
                  <span className="truncate">{device || 'Browser/Perangkat POS'}</span>
                </div>

                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-stone-400 shrink-0" />
                  <code className="text-[11px] bg-stone-200/60 dark:bg-stone-800 px-1.5 py-0.5 rounded text-stone-700 dark:text-stone-300">
                    {ipAddress || '127.0.0.1'}
                  </code>
                </div>

                <div className="flex items-center gap-2 sm:col-span-2 text-stone-500 dark:text-stone-400">
                  <Clock className="w-4 h-4 text-stone-400 shrink-0" />
                  <span>{language === 'en' ? 'Logged in since:' : 'Waktu login:'} {formatDate(timestamp)}</span>
                </div>
              </div>
            </div>

            {/* Explanation / Rule Card */}
            <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 leading-relaxed">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {language === 'en'
                    ? 'Security policy prevents multiple browser logins on the same account.'
                    : 'Kebijakan keamanan melarang login ganda di akun yang sama.'}
                </p>
                <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/80 text-[11px]">
                  {isRoleManager
                    ? (language === 'en'
                        ? 'As a Manager, you have the authority to terminate the active session on the other device and proceed.'
                        : 'Sebagai Manager, Anda dapat langsung memutuskan sesi yang sedang aktif di browser lain dan masuk.')
                    : (language === 'en'
                        ? 'Role Manager can force-logout this active session to allow this cashier to log in.'
                        : 'Role Manager dapat melakukan otorisasi untuk memaksa logout sesi aktif kasir ini.')}
                </p>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-5 border-t border-stone-100 dark:border-stone-800/80 bg-stone-50/80 dark:bg-stone-900/50 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer text-center"
            >
              {language === 'en' ? 'Cancel / Pick Other User' : 'Batal / Pilih Pengguna Lain'}
            </button>

            {isRoleManager ? (
              <button
                type="button"
                id="btn-manager-self-force-logout"
                onClick={onForceLogoutSelf}
                disabled={isLoading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{language === 'en' ? 'Disconnecting...' : 'Memutuskan Sesi...'}</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span>{language === 'en' ? 'Force Logout Other Session & Log In' : 'Paksa Logout Sesi Lain & Masuk'}</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                id="btn-request-manager-auth"
                onClick={onRequestManagerAuth}
                disabled={isLoading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-60 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{language === 'en' ? 'Manager Authorization (Force Logout)' : 'Otorisasi Manager (Paksa Logout)'}</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
