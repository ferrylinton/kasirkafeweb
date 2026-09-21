import React, { useState, useEffect, useCallback } from 'react';
import {
  Coffee,
  ShieldCheck,
  Sun,
  Moon,
  Delete,
  KeyRound,
  Lock,
  ArrowRight,
  UserCheck,
  Users,
  Shield,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Clock,
  RefreshCw,
  X,
  Building2,
  Store
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { SelectUserModal, SelectableUser } from '../modals/SelectUserModal';
import { AlreadyLoggedInModal } from '../modals/AlreadyLoggedInModal';
import { ManagerAuthModal } from '../modals/ManagerAuthModal';
import { RadixSelect, RadixSelectOption } from '../common/RadixSelect';

interface VendorItem {
  id: string;
  name: string;
  code: string;
  clientId?: string;
  status?: string;
}

const DEFAULT_VENDORS: VendorItem[] = [
  { id: 'vnd_admin', name: 'Admin', code: 'ADMIN' },
  { id: 'vnd_sipspot_central', name: 'SipSpot Coffee & Boba (Pusat)', code: 'SIPSPOT' },
  { id: 'vnd_kopi_kulo_kemang', name: 'Kopi Kulo & Toast (Kemang)', code: 'KULO' },
  { id: 'vnd_tehpoci_nusantara', name: 'Teh Poci & Dimsum Nusantara (Bekasi)', code: 'TEHPOCI' }
];

interface AlreadyLoggedInInfo {
  userName: string;
  userEmail: string;
  userRole: string;
  device: string;
  ipAddress: string;
  timestamp: string;
  isSelfManager: boolean;
  canManagerForceLogout: boolean;
  pinAttempted?: string;
}

export const LoginScreen: React.FC = () => {
  const {
    loginWithPin,
    forceLogoutUser,
    idleTimedOut,
    clearIdleTimeout,
    sessionRevoked,
    clearSessionRevoked
  } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const { showToast } = useToast();

  // Selected User state (with localStorage persistence)
  const [selectedUser, setSelectedUser] = useState<SelectableUser>(() => {
    try {
      const saved = localStorage.getItem('sipspot_selected_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.pin === '1234') parsed.pin = '123456';
        if (parsed.pin === '8492') parsed.pin = '849201';
        return parsed;
      }
    } catch (e) {}
    return {
      id: 'manager_1',
      name: 'Ferry Manager',
      email: 'manager@beverage.com',
      role: 'MANAGER',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      pin: '123456'
    };
  });

  // Vendor management state
  const [vendors, setVendors] = useState<VendorItem[]>(DEFAULT_VENDORS);
  const [allUsers, setAllUsers] = useState<SelectableUser[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>(() => {
    try {
      const savedVendor = localStorage.getItem('sipspot_selected_vendor');
      if (savedVendor) return savedVendor;
    } catch (e) {}
    return selectedUser.vendorId || 'vnd_sipspot_central';
  });

  const [isSelectModalOpen, setIsSelectModalOpen] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [email, setEmail] = useState<string>(selectedUser.email || 'manager@beverage.com');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch selectable users & vendors from backend API
  useEffect(() => {
    const fetchSelectable = async () => {
      try {
        const res = await fetch('/api/auth/selectable-users');
        const data = await res.json();
        if (data.success) {
          if (Array.isArray(data.vendors) && data.vendors.length > 0) {
            setVendors(data.vendors);
          }
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
  const [managerPinError, setManagerPinError] = useState<string>('');
  const [isForceLoggingOut, setIsForceLoggingOut] = useState<boolean>(false);

  // Lockout State Management (3 failed attempts -> 15 min lockout)
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const getLockoutStorageKey = useCallback((userEmail?: string) => {
    return userEmail ? `sipspot_lockout_${userEmail.trim().toLowerCase()}` : 'sipspot_lockout_default';
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

  const handleVendorChange = useCallback((newVendorId: string) => {
    setSelectedVendorId(newVendorId);
    try {
      localStorage.setItem('sipspot_selected_vendor', newVendorId);
      document.cookie = `sipspot_vendor_id=${encodeURIComponent(newVendorId)}; path=/; max-age=31536000; SameSite=Lax`;
    } catch (e) {}

    // Find the users of this vendor (from allUsers or fallback list)
    const matchingUsers = allUsers.filter(u => (u.vendorId || 'vnd_sipspot_central') === newVendorId);
    if (matchingUsers.length > 0) {
      // Pick manager first if available, else first user
      const preferred = matchingUsers.find(u => u.role.toUpperCase() === 'MANAGER') || matchingUsers[0];
      const updatedUser: SelectableUser = {
        ...preferred,
        pin: preferred.pin === '1234' ? '123456' : (preferred.pin === '8492' ? '849201' : preferred.pin || '123456')
      };
      setSelectedUser(updatedUser);
      setEmail(updatedUser.email);
      setPin('');
      try {
        localStorage.setItem('sipspot_selected_user', JSON.stringify(updatedUser));
      } catch (e) {}
      checkLockoutStatus(updatedUser.email);
      const targetVendor = vendors.find(v => v.id === newVendorId);
      if (targetVendor) {
        showToast(`Vendor dialihkan ke ${targetVendor.name}`, 'info');
      }
    }
  }, [allUsers, vendors, checkLockoutStatus, showToast]);

  const handleSelectUser = (user: SelectableUser) => {
    const updatedUser = {
      ...user,
      pin: user.pin === '1234' ? '123456' : (user.pin === '8492' ? '849201' : user.pin || '123456')
    };
    setSelectedUser(updatedUser);
    if (user.vendorId) {
      setSelectedVendorId(user.vendorId);
      try {
        localStorage.setItem('sipspot_selected_vendor', user.vendorId);
        document.cookie = `sipspot_vendor_id=${encodeURIComponent(user.vendorId)}; path=/; max-age=31536000; SameSite=Lax`;
      } catch (e) {}
    }
    setEmail(updatedUser.email);
    setPin(''); // Reset PIN input so user can type cleanly
    try {
      localStorage.setItem('sipspot_selected_user', JSON.stringify(updatedUser));
    } catch (e) {}
    checkLockoutStatus(updatedUser.email);
    showToast(`${updatedUser.name} (${updatedUser.role === 'MANAGER' ? 'Manager' : 'Kasir'}) dipilih!`, 'success');
  };

  const handlePinPress = (digit: string) => {
    if (isLocked) {
      showToast(`Akun terkunci selama 15 menit. Sisa waktu: ${formatLockoutTimer(remainingSeconds)}.`, 'error');
      return;
    }
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 6) {
        attemptPinLogin(nextPin);
      }
    }
  };

  const handlePinDelete = () => {
    if (isLocked) return;
    setPin(prev => prev.slice(0, -1));
  };

  const attemptPinLogin = async (pinValue: string) => {
    if (isLocked) {
      showToast(`Akun sedang terkunci. Coba lagi dalam ${formatLockoutTimer(remainingSeconds)}.`, 'error');
      return;
    }

    const storageKey = getLockoutStorageKey(selectedUser.email);
    setIsSubmitting(true);
    const result = await loginWithPin(pinValue, selectedUser.email);
    setIsSubmitting(false);

    if (result.success) {
      setFailedAttempts(0);
      setIsLocked(false);
      setLockedUntil(null);
      setAlreadyLoggedInData(null);
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {}
      if (result.previousSessionsTerminated) {
        showToast(`Selamat datang, ${selectedUser.name}! Sesi di browser lain telah otomatis dikeluarkan.`, 'info');
      } else {
        showToast(`Selamat datang, ${selectedUser.name}!`, 'success');
      }
    } else if (result.isAlreadyLoggedIn) {
      setPin('');
      setAlreadyLoggedInData({
        userName: result.user?.name || selectedUser.name,
        userEmail: result.user?.email || selectedUser.email,
        userRole: result.user?.role || selectedUser.role,
        device: result.activeSession?.device || 'Browser lain',
        ipAddress: result.activeSession?.ipAddress || '127.0.0.1',
        timestamp: result.activeSession?.timestamp || new Date().toISOString(),
        isSelfManager: result.isSelfManager ?? (selectedUser.role?.toUpperCase() === 'MANAGER'),
        canManagerForceLogout: true,
        pinAttempted: pinValue
      });
      showToast(result.message || 'Pengguna sedang aktif di browser lain. Satu akun tidak dapat digunakan bersamaan.', 'error');
    } else {
      setPin('');
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
        showToast(result.message || `PIN salah. Sisa ${Math.max(0, 3 - newAttempts)} kesempatan sebelum akun terkunci.`, 'error');
      }
    }
  };

  // Manager self force-logout handler (when Manager tries to login while active elsewhere)
  const handleManagerSelfForceLogout = async () => {
    if (!alreadyLoggedInData) return;
    setIsForceLoggingOut(true);
    try {
      if (alreadyLoggedInData.pinAttempted) {
        const result = await loginWithPin(alreadyLoggedInData.pinAttempted, alreadyLoggedInData.userEmail, true);
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
          showToast('Sesi aktif di browser lain telah diputuskan. Silakan masukkan PIN untuk masuk.', 'success');
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
  const handleManagerAuthorizeForceLogout = async (managerPin: string) => {
    if (!alreadyLoggedInData) return;
    if (managerPin.length !== 6) {
      setManagerPinError('PIN Manager harus 6 digit angka');
      return;
    }
    setManagerPinError('');
    setIsForceLoggingOut(true);

    try {
      if (alreadyLoggedInData.pinAttempted) {
        const result = await loginWithPin(
          alreadyLoggedInData.pinAttempted,
          alreadyLoggedInData.userEmail,
          true,
          managerPin
        );

        if (result.success) {
          setFailedAttempts(0);
          setIsLocked(false);
          setLockedUntil(null);
          setAlreadyLoggedInData(null);
          setIsManagerPromptOpen(false);
          showToast(`Otorisasi Manager berhasil! Sesi sebelumnya telah diputus dan ${alreadyLoggedInData.userName} berhasil masuk.`, 'success');
          return;
        } else if (result.error === 'InvalidManagerPin' || result.message?.toLowerCase().includes('pin manager')) {
          setManagerPinError(result.message || 'PIN Manager salah.');
          setIsForceLoggingOut(false);
          return;
        }
      }

      const res = await forceLogoutUser({
        targetEmail: alreadyLoggedInData.userEmail,
        managerPin,
        reason: 'Otorisasi Manager untuk kasir'
      });

      if (res.success) {
        showToast(`Sesi aktif untuk ${alreadyLoggedInData.userName} berhasil diputus oleh Manager! Silakan masuk kembali.`, 'success');
        setIsManagerPromptOpen(false);
        setAlreadyLoggedInData(null);
        setPin('');
      } else {
        setManagerPinError(res.message || 'Gagal otorisasi Manager');
      }
    } catch (e) {
      setManagerPinError('Koneksi ke server gagal');
    } finally {
      setIsForceLoggingOut(false);
    }
  };

  const isAdminRole = selectedUser.role?.toUpperCase() === 'ADMIN';
  const isManagerRole = selectedUser.role?.toUpperCase() === 'MANAGER';
  const currentVendorData = vendors.find(v => v.id === selectedVendorId);

  const vendorSelectOptions: RadixSelectOption[] = vendors.map(v => {
    const staffCount = allUsers.filter(u => (u.vendorId || 'vnd_sipspot_central') === v.id).length;
    return {
      value: v.id,
      label: v.name,
      sublabel: `${v.code}${staffCount > 0 ? ` • ${staffCount} staf` : ''}`,
      badge: v.code,
      badgeColor: 'bg-orange-100 dark:bg-orange-950/60 text-accent',
      icon: <Store className="w-4 h-4 text-accent" />
    };
  });

  return (
    <div
      className="min-h-screen w-full bg-[#f8f5f2] dark:bg-[#1a1412] text-stone-900 dark:text-stone-100 flex flex-col justify-between p-4 sm:p-6 transition-colors font-sans"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
      }}
    >
      {/* User Selection Modal */}
      <SelectUserModal
        isOpen={isSelectModalOpen}
        onClose={() => setIsSelectModalOpen(false)}
        selectedUserId={selectedUser.id}
        selectedVendorId={selectedVendorId}
        onSelectUser={handleSelectUser}
        onSelectVendor={handleVendorChange}
      />

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

      {/* Manager Authorization PIN Modal for Cashier Force Logout */}
      <ManagerAuthModal
        isOpen={isManagerPromptOpen}
        onClose={() => {
          setIsManagerPromptOpen(false);
          setManagerPinError('');
        }}
        targetUserName={alreadyLoggedInData?.userName || selectedUser.name}
        onSubmitPin={handleManagerAuthorizeForceLogout}
        isLoading={isForceLoggingOut}
        errorMessage={managerPinError}
        onClearError={() => setManagerPinError('')}
      />

      {/* Top Header Bar */}
      <div className="flex items-center justify-between w-full max-w-md mx-auto">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center font-bold shadow-xs shrink-0">
            <Coffee className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-base font-heading">SipSpot</span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                {t('online')}
              </span>
            </div>
            {/* Selected Vendor Name */}
            <div
              id="top-bar-selected-vendor"
              className="flex items-center gap-1 text-[11px] text-stone-600 dark:text-stone-300 mt-0.5 min-w-0"
              title={currentVendorData ? `Vendor Aktif: ${currentVendorData.name}` : undefined}
            >
              <Store className="w-3 h-3 text-accent shrink-0" />
              <span className="truncate max-w-[140px] sm:max-w-[180px] font-medium text-stone-700 dark:text-stone-300">
                {currentVendorData?.name || 'SipSpot Coffee & Boba'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Select User Header Button */}
          <button
            type="button"
            onClick={() => setIsSelectModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-accent border border-orange-200 dark:border-orange-800/50 text-xs font-semibold hover:bg-orange-100 transition-colors shadow-2xs"
            title="Pilih Pengguna Login"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden xs:inline sm:inline">{t('changeStaff')}</span>
          </button>

          <button
            onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
            className="px-2.5 py-1.5 rounded-xl bg-stone-200/60 dark:bg-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 transition-colors"
          >
            {language.toUpperCase()}
          </button>
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

        {/* Vendor / Branch Selector Dropdown (Radix UI Select) */}
        <div className="w-full mb-5 p-3 sm:p-3.5 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/90 dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between mb-2 px-1">
            <label htmlFor="login-vendor-select" className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-accent" />
              <span>{t('selectVendorLabel')}</span>
            </label>
            {currentVendorData && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950/60 text-accent border border-orange-200 dark:border-orange-800/60">
                {currentVendorData.code}
              </span>
            )}
          </div>
          <RadixSelect
            id="login-vendor-select"
            value={selectedVendorId}
            onValueChange={handleVendorChange}
            options={vendorSelectOptions}
            placeholder="Pilih Vendor / Cabang..."
            prefixIcon={<Building2 className="w-4 h-4 text-accent" />}
            ariaLabel="Pilih Vendor atau Cabang Toko"
            className="bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 py-2.5 text-xs font-semibold"
          />
        </div>

        {/* Selected User Profile Header (Foto Profil & Nama yang dipilih) */}
        <div className="flex flex-col items-center text-center mb-6 w-full">
          {/* Clickable Profile Photo */}
          <div
            onClick={() => setIsSelectModalOpen(true)}
            className="relative mb-3 group cursor-pointer"
            title="Klik untuk memilih pengguna lain"
          >
            <div
              className={`w-22 h-22 rounded-full overflow-hidden border-3 p-0.5 bg-stone-200 dark:bg-stone-800 shadow-md transition-all group-hover:scale-105 group-hover:shadow-lg ${
                isAdminRole
                  ? 'border-purple-500 ring-2 ring-purple-500/20'
                  : isManagerRole
                  ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/20'
                  : 'border-emerald-400 dark:border-emerald-500 ring-2 ring-emerald-400/20'
              }`}
            >
              <img
                src={
                  selectedUser.avatar ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
                }
                alt={selectedUser.name}
                className="w-full h-full object-cover rounded-full"
                onError={e => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';
                }}
              />
            </div>

            {/* Hover Swap Indicator */}
            <div className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold">
              <Users className="w-5 h-5 mb-0.5" />
              <span>Ganti</span>
            </div>

            {/* Role Icon Overlay Badge */}
            <div
              className={`absolute bottom-0 right-0 w-7 h-7 rounded-full border-2 border-white dark:border-stone-900 flex items-center justify-center text-white shadow-xs ${
                isAdminRole ? 'bg-purple-600' : isManagerRole ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            >
              {isAdminRole ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : isManagerRole ? (
                <Shield className="w-3.5 h-3.5" />
              ) : (
                <Coffee className="w-3.5 h-3.5" />
              )}
            </div>
          </div>

          {/* User Name & Role Badge */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold font-heading text-stone-900 dark:text-stone-100">
              {selectedUser.name}
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isAdminRole
                  ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800/60'
                  : isManagerRole
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/60'
                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60'
              }`}
            >
              {isAdminRole ? 'ADMIN' : isManagerRole ? t('roleManager') : t('roleCashier')}
            </span>
          </div>

          {/* Role Access Scope Badge */}
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">
              {isAdminRole
                ? 'Hak Akses: Administrasi Sistem (Semua Vendor)'
                : isManagerRole
                ? 'Hak Akses: Operasional Kasir & Manajemen Toko'
                : 'Hak Akses: Operasional Kasir'}
            </span>
          </div>

          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-xs">
            {selectedUser.email}
          </p>

          {/* Vendor Affiliation Badge */}
          {currentVendorData && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200/80 dark:border-stone-700">
              <Store className="w-3 h-3 text-accent shrink-0" />
              <span className="truncate max-w-[200px]">{currentVendorData.name}</span>
            </div>
          )}

          {/* Explicit "Ganti Pengguna" Trigger Button */}
          <button
            type="button"
            onClick={() => setIsSelectModalOpen(true)}
            className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-[#251e1c] hover:bg-orange-50 dark:hover:bg-orange-950/40 border border-stone-200/90 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:text-accent text-xs font-semibold shadow-2xs transition-all active:scale-95"
          >
            <Users className="w-3.5 h-3.5 text-accent" />
            <span>{t('switchUserBtn')}</span>
          </button>
        </div>

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

        {/* 6-Digit PIN Keypad Card */}
        <div className="w-full bg-white dark:bg-[#251e1c] rounded-3xl p-5 shadow-sm border border-stone-200/80 dark:border-stone-800 flex flex-col items-center">
          <span className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
            {t('enterPin')}
          </span>
          <span className="text-[11px] text-stone-400 mb-3">
            Masukkan PIN 6-digit untuk <strong className="text-stone-700 dark:text-stone-200">{selectedUser.name}</strong>
          </span>

          {/* 6 Dots indicator */}
          <div className="flex gap-3 mb-5">
            {[0, 1, 2, 3, 4, 5].map(index => {
              const filled = index < pin.length;
              return (
                <div
                  key={index}
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full transition-all duration-200 ${
                    filled
                      ? 'bg-accent scale-110 shadow-xs'
                      : 'border-2 border-stone-300 dark:border-stone-700 bg-stone-100 dark:bg-stone-800'
                  }`}
                />
              );
            })}
          </div>

          {/* Quick Helper presets for selected user & switcher */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            {selectedUser.pin && !isLocked && (
              <button
                type="button"
                onClick={() => {
                  setPin(selectedUser.pin!);
                  attemptPinLogin(selectedUser.pin!);
                }}
                className="px-2.5 py-1 rounded-xl bg-accent text-white text-[10px] sm:text-[11px] font-bold shadow-xs hover:opacity-90 flex items-center gap-1.5 transition-all active:scale-95"
                title="Gunakan PIN Akun Ini"
              >
                <KeyRound className="w-3 h-3" />
                <span>PIN {selectedUser.name.split(' ')[0]}: {selectedUser.pin}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsSelectModalOpen(true)}
              className="px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 text-[10px] sm:text-[11px] font-semibold border border-stone-200 dark:border-stone-700 flex items-center gap-1 transition-all"
            >
              <Users className="w-3 h-3 text-stone-400" />
              <span>Pilih User Lain</span>
            </button>
          </div>

          {/* 3x4 Number Keypad */}
          <div className={`grid grid-cols-3 gap-2.5 w-full max-w-[280px] ${isLocked ? 'opacity-40 pointer-events-none' : ''}`}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handlePinPress(num)}
                disabled={isSubmitting || isLocked}
                className="h-14 rounded-2xl bg-stone-50 dark:bg-stone-900/90 hover:bg-stone-100 dark:hover:bg-stone-800 text-lg font-bold text-stone-800 dark:text-stone-200 active:scale-95 transition-all shadow-2xs flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {num}
              </button>
            ))}
            <div className="h-14" /> {/* Empty spacer */}
            <button
              type="button"
              onClick={() => handlePinPress('0')}
              disabled={isSubmitting || isLocked}
              className="h-14 rounded-2xl bg-stone-50 dark:bg-stone-900/90 hover:bg-stone-100 dark:hover:bg-stone-800 text-lg font-bold text-stone-800 dark:text-stone-200 active:scale-95 transition-all shadow-2xs flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              0
            </button>
            <button
              type="button"
              onClick={handlePinDelete}
              disabled={isSubmitting || pin.length === 0 || isLocked}
              className="h-14 rounded-2xl bg-stone-100 dark:bg-stone-900/50 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 active:scale-95 transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => attemptPinLogin(pin)}
            disabled={isSubmitting || pin.length < 6 || isLocked}
            className="w-full mt-5 py-3.5 rounded-2xl bg-accent text-white font-bold text-sm shadow-md hover:opacity-95 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLocked ? (
              <>
                <Lock className="w-4 h-4" />
                <span>Terkunci ({formatLockoutTimer(remainingSeconds)})</span>
              </>
            ) : isSubmitting ? (
              'Memverifikasi...'
            ) : (
              <>
                <span>{t('openRegister')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Footer Security Badge */}
      <div className="flex items-center justify-center gap-1.5 text-stone-400 text-[11px] py-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>{t('encryptionStandard')}</span>
      </div>
    </div>
  );
};

