import React, { useState, useEffect, useCallback } from 'react';
import {
  Sun,
  Moon,
  KeyRound,
  Lock,
  ArrowRight,
  ShieldAlert,
  AlertTriangle,
  Clock,
  RefreshCw,
  X,
  Store,
  CheckCircle2,
  Mail,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { SelectableUser, FALLBACK_USERS } from '../modals/SelectUserModal';
import { AlreadyLoggedInModal } from '../modals/AlreadyLoggedInModal';
import { ManagerAuthModal } from '../modals/ManagerAuthModal';
import { UserRadixSelect } from '../common/UserRadixSelect';
import { LanguageSelect } from '../common/LanguageSelect';
import { VendorRegisterScreen } from './VendorRegisterScreen';
import { VendorReactivationScreen } from './VendorReactivationScreen';
import { ForgotPasswordModal } from '../modals/ForgotPasswordModal';
import { CaptchaBox, CaptchaBoxRef } from '../common/CaptchaBox';
import kasirKafeLogo from '../../assets/images/kasirkafe_logo_1790154574271.jpg';

export interface LoginScreenProps {
  onOpenRegister?: () => void;
  onOpenResetPassword?: (token?: string) => void;
}

interface AlreadyLoggedInInfo {
  userName: string;
  userEmail: string;
  userRole: string;
  device: string;
  ipAddress: string;
  timestamp: string;
  isSelfManager: boolean;
  passwordAttempted?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onOpenRegister, onOpenResetPassword }) => {
  const {
    loginWithPassword,
    forceLogoutUser,
    idleTimedOut,
    clearIdleTimeout,
    sessionRevoked,
    clearSessionRevoked
  } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [internalShowRegister, setInternalShowRegister] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState<boolean>(false);
  const [showReactivationScreen, setShowReactivationScreen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('view') === 'reactivate-vendor';
    }
    return false;
  });
  const [vendorDeactivatedNotice, setVendorDeactivatedNotice] = useState<{
    message: string;
    vendorName?: string;
    email?: string;
  } | null>(null);
  const [confirmedVendorNotice, setConfirmedVendorNotice] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('confirmed') === 'true') {
        return params.get('vendorName') || 'Vendor Anda';
      }
    }
    return null;
  });

  const handleOpenRegister = () => {
    if (onOpenRegister) {
      onOpenRegister();
    } else {
      setInternalShowRegister(true);
    }
  };

  // Selected User state (with localStorage persistence)
  const [selectedUser, setSelectedUser] = useState<SelectableUser>(() => {
    try {
      const saved = localStorage.getItem('kasirkafe_selected_user');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return {
      id: 'manager_1',
      name: 'Ferry Manager',
      email: 'manager@beverage.com',
      role: 'MANAGER',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    };
  });

  const [allUsers, setAllUsers] = useState<SelectableUser[]>(FALLBACK_USERS);

  const [email, setEmail] = useState<string>(() => {
    try {
      const savedEmail = localStorage.getItem('kasirkafe_saved_email');
      if (savedEmail) return savedEmail;
    } catch (e) {}
    return selectedUser.email || 'manager@beverage.com';
  });
  const [password, setPassword] = useState<string>('Password123!');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [captchaAnswer, setCaptchaAnswer] = useState<string>('');
  const captchaRef = React.useRef<CaptchaBoxRef>(null);

  const handleCaptchaChange = useCallback(({ token: t, answer: a }: { token: string; answer: string }) => {
    setCaptchaToken(t);
    setCaptchaAnswer(a);
  }, []);

  // Fetch selectable users from backend API
  useEffect(() => {
    const fetchSelectable = async () => {
      try {
        const res = await fetch('/api/auth/selectable-users');
        const data = await res.json();
        if (data.success) {
          if (Array.isArray(data.users) && data.users.length > 0) {
            setAllUsers(data.users);
          }
        }
      } catch (e) {}
    };
    fetchSelectable();
  }, []);

  // Concurrent Login State (Single active browser enforcement & Manager Force Logout)
  const [alreadyLoggedInData, setAlreadyLoggedInData] = useState<AlreadyLoggedInInfo | null>(null);
  const [isManagerPromptOpen, setIsManagerPromptOpen] = useState<boolean>(false);
  const [managerPasswordError, setManagerPasswordError] = useState<string>('');
  const [isForceLoggingOut, setIsForceLoggingOut] = useState<boolean>(false);

  // Lockout State Management (3 failed attempts -> 15 min lockout)
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const getLockoutStorageKey = useCallback((userEmail?: string) => {
    return userEmail ? `kasirkafe_lockout_${userEmail.trim().toLowerCase()}` : 'kasirkafe_lockout_default';
  }, []);

  // Sync lockout state from server & localStorage when selectedUser or email changes
  const checkLockoutStatus = useCallback(async (userEmail?: string) => {
    const targetEmail = userEmail || selectedUser?.email;
    const storageKey = getLockoutStorageKey(targetEmail);
    const now = Date.now();

    // 1. Check local storage first for immediate UI responsiveness
    try {
      const localData = localStorage.getItem(storageKey);
      if (localData) {
        const parsed = JSON.parse(localData);
        if (parsed.lockedUntil && parsed.lockedUntil > now) {
          setIsLocked(true);
          setLockedUntil(parsed.lockedUntil);
          setRemainingSeconds(Math.ceil((parsed.lockedUntil - now) / 1000));
          setFailedAttempts(parsed.failedAttempts || 3);
        } else if (parsed.lockedUntil && parsed.lockedUntil <= now) {
          // Lockout period has expired
          setIsLocked(false);
          setLockedUntil(null);
          setRemainingSeconds(0);
          setFailedAttempts(0);
          localStorage.removeItem(storageKey);
        } else {
          setFailedAttempts(parsed.failedAttempts || 0);
        }
      } else {
        setFailedAttempts(0);
        setIsLocked(false);
        setLockedUntil(null);
        setRemainingSeconds(0);
      }
    } catch (e) {}

    // 2. Query server lockout status
    if (targetEmail) {
      try {
        const res = await fetch(`/api/auth/lockout-status?email=${encodeURIComponent(targetEmail)}`);
        const data = await res.json();
        if (data.success) {
          if (data.isLocked && data.lockedUntil && data.lockedUntil > now) {
            setIsLocked(true);
            setLockedUntil(data.lockedUntil);
            setRemainingSeconds(data.remainingSeconds || Math.ceil((data.lockedUntil - now) / 1000));
            setFailedAttempts(data.failedAttempts || 3);
            try {
              localStorage.setItem(storageKey, JSON.stringify({
                isLocked: true,
                lockedUntil: data.lockedUntil,
                failedAttempts: data.failedAttempts || 3
              }));
            } catch (e) {}
          } else if (!data.isLocked) {
            setFailedAttempts(data.failedAttempts || 0);
            if (isLocked) {
              setIsLocked(false);
              setLockedUntil(null);
              setRemainingSeconds(0);
              try {
                localStorage.removeItem(storageKey);
              } catch (e) {}
            }
          }
        }
      } catch (e) {
        // Fallback to local storage state
      }
    }
  }, [getLockoutStorageKey, selectedUser?.email, isLocked]);

  useEffect(() => {
    if (selectedUser?.email) {
      setEmail(selectedUser.email);
      checkLockoutStatus(selectedUser.email);
    }
  }, [selectedUser, checkLockoutStatus]);

  // Lockout countdown timer
  useEffect(() => {
    if (!isLocked || !lockedUntil) return;

    const storageKey = getLockoutStorageKey(selectedUser?.email);

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.ceil((lockedUntil - now) / 1000);

      if (diff <= 0) {
        setIsLocked(false);
        setLockedUntil(null);
        setRemainingSeconds(0);
        setFailedAttempts(0);
        try {
          localStorage.removeItem(storageKey);
        } catch (e) {}
        showToast(t('lockoutExpiredToast') || 'Waktu kunci telah berakhir. Anda dapat mencoba login kembali.', 'info');
      } else {
        setRemainingSeconds(diff);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isLocked, lockedUntil, selectedUser?.email, getLockoutStorageKey, showToast, t]);

  // Periodically check Redis lockout status while locked (so if admin unlocks, UI updates immediately)
  useEffect(() => {
    if (!isLocked) return;
    const targetEmail = selectedUser?.email || email;
    if (!targetEmail) return;

    const pollInterval = setInterval(() => {
      checkLockoutStatus(targetEmail);
    }, 4000);
    return () => clearInterval(pollInterval);
  }, [isLocked, selectedUser?.email, email, checkLockoutStatus]);

  const formatLockoutTimer = (totalSeconds: number) => {
    const m = Math.floor(Math.max(0, totalSeconds) / 60);
    const s = Math.max(0, totalSeconds) % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSelectUser = (user: SelectableUser) => {
    const updatedUser = {
      ...user
    };
    setSelectedUser(updatedUser);
    if (user.vendorId) {
      try {
        localStorage.setItem('kasirkafe_selected_vendor', user.vendorId);
        document.cookie = `kasirkafe_vendor_id=${encodeURIComponent(user.vendorId)}; path=/; max-age=31536000; SameSite=Lax`;
      } catch (e) {}
    }
    // Langsung isi email dan kata sandi sesuai permintaan pengguna
    setEmail(updatedUser.email);
    setPassword('Password123!');
    try {
      localStorage.setItem('kasirkafe_selected_user', JSON.stringify(updatedUser));
      localStorage.setItem('kasirkafe_saved_email', updatedUser.email);
    } catch (e) {}
    checkLockoutStatus(updatedUser.email);
    const roleBadge = updatedUser.role.toUpperCase() === 'ADMIN' ? 'Admin' : updatedUser.role.toUpperCase() === 'MANAGER' ? 'Manager' : 'Kasir';
    showToast(`Akun ${updatedUser.name} (${roleBadge}) dipilih! Email & kata sandi otomatis terisi.`, 'success');
  };

  const attemptPasswordLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanEmail = email.trim();
    const cleanPassword = password;

    if (!cleanEmail) {
      showToast('Silakan masukkan alamat email akun Anda.', 'error');
      return;
    }
    if (!cleanPassword) {
      showToast('Silakan masukkan kata sandi akun Anda.', 'error');
      return;
    }
    if (!captchaAnswer.trim()) {
      showToast('Silakan masukkan kode captcha terlebih dahulu.', 'error');
      captchaRef.current?.focus();
      return;
    }

    if (isLocked) {
      showToast(`Akun sedang terkunci. Coba lagi dalam ${formatLockoutTimer(remainingSeconds)}.`, 'error');
      return;
    }

    const storageKey = getLockoutStorageKey(cleanEmail);
    setIsSubmitting(true);
    const result = await loginWithPassword(cleanEmail, cleanPassword, false, captchaToken, captchaAnswer);
    setIsSubmitting(false);

    if (!result.success) {
      captchaRef.current?.reload();
    }

    if (result.success) {
      setFailedAttempts(0);
      setIsLocked(false);
      setLockedUntil(null);
      setAlreadyLoggedInData(null);
      try {
        localStorage.removeItem(storageKey);
        localStorage.setItem('kasirkafe_saved_email', cleanEmail);
      } catch (e) {}
      if (result.previousSessionsTerminated) {
        showToast(`Selamat datang, ${selectedUser.name}! Sesi di browser lain telah otomatis dikeluarkan.`, 'info');
      } else {
        showToast(`Selamat datang, ${selectedUser.name}!`, 'success');
      }
      setVendorDeactivatedNotice(null);
    } else if (result.vendorDeactivated || result.error === 'VENDOR_DEACTIVATED' || result.message?.toLowerCase().includes('tidak aktif')) {
      setVendorDeactivatedNotice({
        message: result.message || 'Akun vendor sudah tidak aktif.',
        vendorName: (result as any).vendorName || selectedUser.vendorId,
        email: cleanEmail
      });
      showToast(result.message || 'Akun vendor sudah tidak aktif.', 'error');
    } else if (result.isAlreadyLoggedIn) {
      setAlreadyLoggedInData({
        userName: result.user?.name || selectedUser.name,
        userEmail: result.user?.email || cleanEmail,
        userRole: result.user?.role || selectedUser.role,
        device: result.activeSession?.device || 'Browser lain',
        ipAddress: result.activeSession?.ipAddress || '127.0.0.1',
        timestamp: result.activeSession?.timestamp || new Date().toISOString(),
        isSelfManager: result.isSelfManager ?? (selectedUser.role?.toUpperCase() === 'MANAGER'),
        passwordAttempted: cleanPassword
      });
      showToast(result.message || 'Pengguna sedang aktif di browser lain. Satu akun tidak dapat digunakan bersamaan.', 'error');
    } else {
      if (result.isLocked) {
        const lockUntil = result.lockedUntil || (Date.now() + 15 * 60 * 1000);
        const remSec = result.remainingSeconds || (15 * 60);
        setIsLocked(true);
        setLockedUntil(lockUntil);
        setRemainingSeconds(remSec);
        setFailedAttempts(3);
        try {
          localStorage.setItem(storageKey, JSON.stringify({
            isLocked: true,
            lockedUntil: lockUntil,
            failedAttempts: 3
          }));
        } catch (e) {}
        showToast('Akun Anda telah terkunci selama 15 menit karena 3 kali percobaan login gagal.', 'error');
      } else {
        const newAttempts = result.failedAttempts ?? (failedAttempts + 1);
        setFailedAttempts(newAttempts);
        try {
          localStorage.setItem(storageKey, JSON.stringify({
            isLocked: false,
            lockedUntil: null,
            failedAttempts: newAttempts
          }));
        } catch (e) {}
        showToast(result.message || `Kata sandi salah. Sisa ${Math.max(0, 3 - newAttempts)} kesempatan sebelum akun terkunci.`, 'error');
      }
    }
  };

  // Manager self force-logout handler (when Manager tries to login while active elsewhere)
  const handleManagerSelfForceLogout = async () => {
    if (!alreadyLoggedInData) return;
    setIsForceLoggingOut(true);
    try {
      if (alreadyLoggedInData.passwordAttempted || password) {
        const result = await loginWithPassword(
          alreadyLoggedInData.userEmail,
          alreadyLoggedInData.passwordAttempted || password || 'Password123!',
          true
        );
        if (result.success) {
          setFailedAttempts(0);
          setIsLocked(false);
          setLockedUntil(null);
          setAlreadyLoggedInData(null);
          showToast('Sesi sebelumnya di browser lain telah diputus dan Anda berhasil masuk!', 'success');
          return;
        } else {
          showToast(result.message || 'Gagal melakukan force logout', 'error');
        }
      } else {
        const res = await forceLogoutUser({
          targetEmail: alreadyLoggedInData.userEmail,
          reason: 'Dipaksa logout oleh Manager dari browser lain'
        });
        if (res.success) {
          showToast('Sesi aktif di browser lain telah diputuskan. Silakan masukkan password untuk masuk.', 'success');
          setAlreadyLoggedInData(null);
        } else {
          showToast(res.message || 'Gagal memutuskan sesi', 'error');
        }
      }
    } catch (err) {
      showToast('Koneksi gagal saat memutuskan sesi', 'error');
    } finally {
      setIsForceLoggingOut(false);
    }
  };

  // Manager authorization handler to force logout a cashier's active session
  const handleManagerAuthorizeForceLogout = async (managerPassword: string, managerEmail?: string) => {
    if (!alreadyLoggedInData) return;
    if (managerPassword.length < 6) {
      setManagerPasswordError('Kata sandi Manager minimal 6 karakter');
      return;
    }
    setManagerPasswordError('');
    setIsForceLoggingOut(true);

    try {
      const res = await forceLogoutUser({
        targetEmail: alreadyLoggedInData.userEmail,
        managerEmail,
        managerPassword,
        reason: 'Otorisasi Manager untuk kasir'
      });

      if (res.success) {
        showToast(`Sesi aktif untuk ${alreadyLoggedInData.userName} berhasil diputus oleh Manager! Silakan masuk kembali dengan kata sandi Anda.`, 'success');
        setIsManagerPromptOpen(false);
        setAlreadyLoggedInData(null);
      } else {
        setManagerPasswordError(res.message || 'Gagal otorisasi Manager');
      }
    } catch (e) {
      setManagerPasswordError('Koneksi ke server gagal');
    } finally {
      setIsForceLoggingOut(false);
    }
  };

  if (showReactivationScreen) {
    return (
      <VendorReactivationScreen
        initialEmail={vendorDeactivatedNotice?.email || email || selectedUser?.email || ''}
        onBackToLogin={() => setShowReactivationScreen(false)}
      />
    );
  }

  if (internalShowRegister) {
    return (
      <VendorRegisterScreen
        onBackToLogin={() => setInternalShowRegister(false)}
        onRegistrationSuccess={() => {
          setInternalShowRegister(false);
          // Refetch selectable users so the new vendor appears immediately
          fetch('/api/auth/selectable-users')
            .then(res => res.json())
            .then(data => {
              if (data && data.success) {
                if (Array.isArray(data.users) && data.users.length > 0) setAllUsers(data.users);
              }
            })
            .catch(() => {});
        }}
      />
    );
  }

  return (
    <div
      className="min-h-screen w-full bg-theme-app text-theme-primary flex flex-col justify-between p-4 sm:p-6 transition-colors font-sans"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
      }}
    >
      {/* Concurrent Login Alert Modal */}
      <AlreadyLoggedInModal
        isOpen={!!alreadyLoggedInData && !isManagerPromptOpen}
        onClose={() => setAlreadyLoggedInData(null)}
        userName={alreadyLoggedInData?.userName || ''}
        userEmail={alreadyLoggedInData?.userEmail || ''}
        userRole={alreadyLoggedInData?.userRole || ''}
        device={alreadyLoggedInData?.device || ''}
        ipAddress={alreadyLoggedInData?.ipAddress || ''}
        timestamp={alreadyLoggedInData?.timestamp || ''}
        isSelfManager={alreadyLoggedInData?.isSelfManager ?? false}
        onForceLogoutSelf={handleManagerSelfForceLogout}
        onRequestManagerAuth={() => setIsManagerPromptOpen(true)}
        isLoading={isForceLoggingOut}
      />

      {/* Manager Authorization Password Modal for Cashier Force Logout */}
      <ManagerAuthModal
        isOpen={isManagerPromptOpen}
        onClose={() => {
          setIsManagerPromptOpen(false);
          setManagerPasswordError('');
        }}
        targetUserName={alreadyLoggedInData?.userName || selectedUser.name}
        onSubmitPassword={handleManagerAuthorizeForceLogout}
        isLoading={isForceLoggingOut}
        errorMessage={managerPasswordError}
        onClearError={() => setManagerPasswordError('')}
      />

      {/* Top Header Bar */}
      <div className="flex items-center justify-end w-full max-w-md mx-auto">
        <div className="flex items-center gap-2">

          <LanguageSelect />
          <button
            onClick={toggleDarkMode}
            className="w-9 h-9 rounded-xl bg-stone-200/60 dark:bg-stone-800 flex items-center justify-center text-stone-700 dark:text-stone-300 transition-colors"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-600" />}
          </button>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md mx-auto my-auto flex flex-col items-center">
        {/* Vendor Registration Email Confirmed Banner */}
        {confirmedVendorNotice && (
          <div
            id="vendor-confirmed-alert"
            className="w-full mb-5 p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 dark:border-emerald-500/40 flex items-start gap-3 text-emerald-900 dark:text-emerald-200 transition-all shadow-xs"
          >
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs sm:text-sm font-bold font-heading">Akun Vendor Aktif!</h4>
              <p className="text-[11px] sm:text-xs text-emerald-800/90 dark:text-emerald-300/90 mt-0.5 leading-relaxed">
                Pendaftaran untuk <strong>{confirmedVendorNotice}</strong> telah terkonfirmasi. Silakan pilih akun dan masukkan kata sandi Anda.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmedVendorNotice(null)}
              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-100 p-1 rounded-lg hover:bg-emerald-500/10 transition-colors"
              title="Tutup"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Remote Session Revocation Security Alert Banner */}
        {sessionRevoked && (
          <div
            id="session-revoked-alert"
            className="w-full mb-5 p-4 rounded-2xl bg-red-500/10 dark:bg-red-500/15 border border-red-500/30 dark:border-red-500/40 flex items-start gap-3 text-red-900 dark:text-red-200 transition-all shadow-xs animate-pulse"
          >
            <div className="p-2 rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs sm:text-sm font-bold font-heading">{t('remoteRevokeTitle')}</h4>
              <p className="text-[11px] sm:text-xs text-red-800/90 dark:text-red-300/90 mt-0.5 leading-relaxed">
                {t('remoteRevokeMessage')}
              </p>
            </div>
            <button
              type="button"
              onClick={clearSessionRevoked}
              className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-100 p-1 rounded-lg hover:bg-red-500/10 transition-colors"
              title="Tutup"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Idle Timeout Security Banner */}
        {idleTimedOut && (
          <div
            id="idle-timeout-alert"
            className="w-full mb-5 p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 dark:border-amber-500/40 flex items-start gap-3 text-amber-900 dark:text-amber-200 transition-all shadow-xs"
          >
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs sm:text-sm font-bold font-heading">{t('idleTimeoutTitle')}</h4>
              <p className="text-[11px] sm:text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                {t('idleTimeoutMessage')}
              </p>
            </div>
            <button
              type="button"
              onClick={clearIdleTimeout}
              className="text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-100 p-1 rounded-lg hover:bg-amber-500/10 transition-colors"
              title="Tutup"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Logo & Brand Identity */}
        <div className="flex flex-col items-center text-center mt-2 mb-4">
          <div className="relative mb-2.5">
            <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-xl shadow-orange-500/15 ring-4 ring-orange-500/10 border-2 border-orange-200/80 dark:border-orange-900/60 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-stone-900 dark:to-stone-850 p-1">
              <img
                src={kasirKafeLogo}
                alt="KasirKafe POS Logo"
                className="w-full h-full object-cover rounded-[20px]"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <h1 className="text-2xl font-black font-heading text-stone-900 dark:text-stone-100 tracking-tight">
            KasirKafe
          </h1>
        </div>

        {/* Radix UI Select User Picker (Auto-fills email & password) */}
        <div className="w-full mb-5 max-w-sm">
          <UserRadixSelect
            id="login-user-radix-select"
            users={allUsers.length > 0 ? allUsers : FALLBACK_USERS}
            selectedUserId={selectedUser.id}
            onSelectUser={handleSelectUser}
            disabled={isSubmitting || isLocked}
          />
        </div>

        {/* Deactivated Vendor Alert (When vendor status is DEACTIVATE) */}
        {vendorDeactivatedNotice && (
          <div
            id="login-vendor-deactivated-alert"
            className="w-full mb-4 p-4 rounded-3xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 shadow-sm flex flex-col gap-3 animate-in fade-in duration-300"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-2xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs sm:text-sm font-bold font-heading text-rose-900 dark:text-rose-100">
                  Akun Vendor Sudah Tidak Aktif
                </h4>
                <p className="text-[11px] sm:text-xs text-rose-800/90 dark:text-rose-300/90 mt-0.5 leading-relaxed font-semibold">
                  {vendorDeactivatedNotice.message}
                </p>
                <p className="text-[10px] sm:text-[11px] text-rose-700/80 dark:text-rose-400/80 mt-1">
                  Seluruh akun pengguna di dalam vendor ini tidak dapat login ke sistem kasir. Pengguna dengan role <strong>MANAGER</strong> dapat mengajukan permohonan pengaktifan kembali ke Administrator.
                </p>
              </div>
            </div>

            <button
              type="button"
              id="btn-goto-reactivate-screen"
              onClick={() => setShowReactivationScreen(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Store className="w-4 h-4" />
              <span>Buka Halaman Aktivasi Kembali Akun Vendor</span>
            </button>
          </div>
        )}

        {/* 15-Minute Lockout Banner (Active when 3 failed attempts) */}
        {isLocked && (
          <div
            id="login-lockout-alert"
            className="w-full mb-4 p-4 rounded-3xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800/80 text-red-900 dark:text-red-200 shadow-sm flex flex-col gap-3 animate-in fade-in duration-300"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-2xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs sm:text-sm font-bold font-heading text-red-900 dark:text-red-100">
                  {t('accountLockedTitle') || 'Akun Terkunci Selama 15 Menit'}
                </h4>
                <p className="text-[11px] sm:text-xs text-red-800/90 dark:text-red-300/90 mt-0.5 leading-relaxed">
                  {t('accountLockedDesc') || 'Terjadi 3 kali kegagalan login. Login dinonaktifkan sementara demi perlindungan keamanan toko.'}
                </p>
              </div>
            </div>

            {/* Countdown timer badge */}
            <div className="flex items-center justify-between bg-white dark:bg-[#201514] px-3.5 py-2.5 rounded-2xl border border-red-200 dark:border-red-900/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-300">
                <Clock className="w-4 h-4 text-red-500 animate-spin" />
                <span>{t('retryInLabel') || 'Dapat mencoba lagi dalam:'}</span>
              </div>
              <span className="font-mono text-base font-extrabold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/80 px-3 py-1 rounded-xl tracking-wider">
                {formatLockoutTimer(remainingSeconds)}
              </span>
            </div>

            {/* Admin unlock note & instant check button */}
            <div className="flex items-center justify-between pt-1 text-[11px] text-red-800/80 dark:text-red-300/80">
              <span>Hubungi Role ADMIN jika perlu membuka kunci segera.</span>
              <button
                type="button"
                id="check-unlock-status-btn"
                onClick={() => checkLockoutStatus(selectedUser?.email || email)}
                className="px-2.5 py-1 text-[11px] font-bold text-red-700 dark:text-red-300 hover:text-red-900 bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/70 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Periksa apakah Admin telah membuka kunci akun Anda"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Cek Status</span>
              </button>
            </div>

            {/* Quick action to request password reset or reset via email when locked */}
            <div className="pt-2 border-t border-red-200/80 dark:border-red-900/60 flex items-center justify-between gap-2">
              <span className="text-[11px] text-red-800/80 dark:text-red-300/80">Lupa kata sandi akun?</span>
              <button
                type="button"
                id="btn-lockout-forgot-password"
                onClick={() => setShowForgotPasswordModal(true)}
                className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <KeyRound className="w-3 h-3" />
                <span>Reset Password / Minta ke ADMIN</span>
              </button>
            </div>
          </div>
        )}

        {/* Failed Attempts Indicator Banner (when 1 or 2 failed attempts) */}
        {!isLocked && failedAttempts > 0 && (
          <div
            id="login-attempts-warning"
            className="w-full mb-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 flex items-center justify-between text-xs shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="font-medium text-[11px] sm:text-xs">
                Percobaan gagal: <strong className="font-bold text-amber-800 dark:text-amber-300">{failedAttempts}/3</strong>. Sisa {Math.max(0, 3 - failedAttempts)} kesempatan lagi!
              </span>
            </div>
            {/* 3 Step Indicator Dots */}
            <div className="flex items-center gap-1.5 shrink-0">
              {[1, 2, 3].map(attemptNum => (
                <div
                  key={attemptNum}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    attemptNum <= failedAttempts
                      ? 'bg-amber-500 scale-110 shadow-xs'
                      : 'bg-amber-200 dark:bg-amber-800/60'
                  }`}
                  title={`Percobaan ${attemptNum}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Email & Password Login Card */}
        <form
          id="email-password-login-form"
          onSubmit={attemptPasswordLogin}
          className="w-full bg-white dark:bg-[#251e1c] rounded-3xl p-5 sm:p-6 shadow-sm border border-stone-200/80 dark:border-stone-800 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-0.5 text-left">
            <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 font-heading flex items-center gap-2">
              <Lock className="w-4 h-4 text-accent" />
              <span>{t('loginBtn') || 'Masuk ke Sistem POS'}</span>
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Silakan periksa email dan kata sandi akun Anda di bawah ini
            </p>
          </div>

          {/* Email Field */}
          <div className="flex flex-col gap-1 text-left">
            <label htmlFor="login-email-input" className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-accent" />
              <span>Alamat Email Akun</span>
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 absolute left-3.5 text-stone-400 pointer-events-none" />
              <input
                id="login-email-input"
                type="email"
                required
                autoComplete="username email"
                disabled={isSubmitting || isLocked}
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (!isLocked) checkLockoutStatus(e.target.value);
                }}
                placeholder="nama@email.com"
                className="w-full pl-10 pr-4 py-3 bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-700/80 rounded-2xl text-sm font-medium text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-1 text-left">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password-input" className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-accent" />
                <span>Kata Sandi (Password)</span>
              </label>
              <button
                type="button"
                id="btn-forgot-password-link"
                onClick={() => setShowForgotPasswordModal(true)}
                className="text-[11px] font-semibold text-accent hover:underline cursor-pointer"
              >
                Lupa Password?
              </button>
            </div>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-3.5 text-stone-400 pointer-events-none" />
              <input
                id="login-password-input"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                disabled={isSubmitting || isLocked}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi..."
                className="w-full pl-10 pr-11 py-3 bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-700/80 rounded-2xl text-sm font-medium text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-3 p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors cursor-pointer"
                title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Captcha Verification Box (Alphanumeric uppercase, 5 min TTL, reloadable) */}
          <CaptchaBox
            ref={captchaRef}
            disabled={isSubmitting || isLocked}
            onCaptchaChange={handleCaptchaChange}
          />

          {/* Submit Button */}
          <button
            id="login-submit-btn"
            type="submit"
            disabled={isSubmitting || isLocked || !email.trim() || !password || !captchaAnswer.trim()}
            className="w-full mt-1 py-3.5 px-5 rounded-2xl bg-accent hover:bg-accent/90 text-white font-bold text-sm shadow-md hover:shadow-lg active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLocked ? (
              <>
                <Lock className="w-4 h-4" />
                <span>Akun Terkunci ({formatLockoutTimer(remainingSeconds)})</span>
              </>
            ) : isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memverifikasi Akun...</span>
              </>
            ) : (
              <>
                <span>Masuk ke Sistem POS</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Action button: Forgot Password via email or admin */}
          <div className="w-full pt-1 flex items-center justify-center">
            <button
              id="btn-forgot-credentials-link"
              type="button"
              onClick={() => setShowForgotPasswordModal(true)}
              className="py-1 px-3 rounded-xl text-xs font-semibold text-stone-500 hover:text-accent dark:text-stone-400 dark:hover:text-orange-400 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-stone-400" />
              <span>Lupa Password? Reset via Email atau Minta ke ADMIN</span>
            </button>
          </div>

          {/* Action button to open Vendor Registration */}
          <div className="w-full pt-3 border-t border-stone-200/80 dark:border-stone-800 text-center space-y-2">
            <button
              id="btn-open-vendor-register"
              type="button"
              onClick={handleOpenRegister}
              className="w-full py-2.5 px-4 rounded-xl border border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-100/60 dark:hover:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-xs font-bold transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              <Store className="w-4 h-4 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform" />
              <span>Daftar Mitra Vendor Baru (Role MANAGER)</span>
            </button>

            <button
              id="btn-open-vendor-reactivate-footer"
              type="button"
              onClick={() => setShowReactivationScreen(true)}
              className="py-1 px-3 text-[11px] text-stone-500 hover:text-amber-600 dark:text-stone-400 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition-colors inline-flex items-center gap-1.5 font-medium cursor-pointer"
            >
              <Store className="w-3.5 h-3.5 text-stone-400" />
              <span>Akun vendor nonaktif? <strong>Halaman Aktivasi Kembali Akun Vendor</strong></span>
            </button>
          </div>
        </form>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
        defaultEmail={selectedUser?.email || ''}
        onOpenResetWithToken={(token) => {
          setShowForgotPasswordModal(false);
          if (onOpenResetPassword) {
            onOpenResetPassword(token);
          }
        }}
      />
    </div>
  );
};

