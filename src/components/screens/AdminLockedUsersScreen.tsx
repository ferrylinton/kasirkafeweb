import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Lock,
  Unlock,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  Clock,
  AlertTriangle,
  User,
  KeyRound,
  Database,
  CheckCircle2,
  UserX,
  Trash2,
  Filter,
  Info,
  Server,
  Sparkles,
  ExternalLink,
  Store,
  Layers
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';

export interface LockedUserItem {
  identifier: string;
  type: 'email' | 'ip';
  email?: string;
  ip?: string;
  name?: string;
  role?: string;
  vendorId?: string;
  avatar?: string;
  failedAttempts: number;
  isLocked: boolean;
  lockedAt: number;
  lockedUntil: number;
  remainingSeconds: number;
  lastAttemptAt: number;
  reason: string;
  source: 'redis' | 'fallback_memory';
}

export const AdminLockedUsersScreen: React.FC = () => {
  const { token, user: currentAdmin } = useAuth();
  const { showToast } = useToast();

  const [lockedUsers, setLockedUsers] = useState<LockedUserItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isRedisConnected, setIsRedisConnected] = useState<boolean>(false);
  const [storageSource, setStorageSource] = useState<string>('redis');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'EMAIL' | 'IP'>('ALL');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Modal States
  const [selectedUserToUnlock, setSelectedUserToUnlock] = useState<LockedUserItem | null>(null);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);
  const [showUnlockAllModal, setShowUnlockAllModal] = useState<boolean>(false);
  const [isUnlockingAll, setIsUnlockingAll] = useState<boolean>(false);

  // Manual Lock Modal State (for test & security actions)
  const [showManualLockModal, setShowManualLockModal] = useState<boolean>(false);
  const [manualIdentifier, setManualIdentifier] = useState<string>('');
  const [manualReason, setManualReason] = useState<string>('Percobaan login mencurigakan');
  const [isLockingManual, setIsLockingManual] = useState<boolean>(false);

  // Fetch locked users from server/Redis
  const fetchLockedUsers = useCallback(async (isBackground = false) => {
    if (!token) return;
    if (!isBackground) setIsRefreshing(true);

    try {
      const res = await fetch('/api/auth/admin/locked-users', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (data.success) {
        setLockedUsers(data.lockedUsers || []);
        setIsRedisConnected(Boolean(data.isRedisConnected));
        setStorageSource(data.source || 'redis');
      } else {
        if (!isBackground) {
          showToast(data.message || 'Gagal memuat daftar pengguna terkunci', 'error');
        }
      }
    } catch (err: any) {
      if (!isBackground) {
        showToast('Terjadi kesalahan koneksi saat memeriksa data Redis', 'error');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token, showToast]);

  // Initial fetch
  useEffect(() => {
    fetchLockedUsers();
  }, [fetchLockedUsers]);

  // Auto-refresh every 10 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLockedUsers(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLockedUsers]);

  // Second-by-second countdown ticker for remainingSeconds
  useEffect(() => {
    const timer = setInterval(() => {
      setLockedUsers(prev =>
        prev.map(item => {
          const now = Date.now();
          const rem = Math.max(0, Math.ceil((item.lockedUntil - now) / 1000));
          return {
            ...item,
            remainingSeconds: rem
          };
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Unlock single user
  const handleUnlockUser = async () => {
    if (!selectedUserToUnlock || !token) return;
    setIsUnlocking(true);

    try {
      const res = await fetch('/api/auth/admin/unlock-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ identifier: selectedUserToUnlock.identifier })
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message || `User ${selectedUserToUnlock.identifier} berhasil dibuka kuncinya!`, 'success');
        setLockedUsers(prev => prev.filter(u => u.identifier !== selectedUserToUnlock.identifier));
        setSelectedUserToUnlock(null);
      } else {
        showToast(data.message || 'Gagal membuka kunci pengguna', 'error');
      }
    } catch (err: any) {
      showToast('Gagal menghubungi server untuk membuka kunci', 'error');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Unlock all users
  const handleUnlockAllUsers = async () => {
    if (!token) return;
    setIsUnlockingAll(true);

    try {
      const res = await fetch('/api/auth/admin/unlock-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message || 'Semua user yang terkunci di Redis berhasil dibuka!', 'success');
        setLockedUsers([]);
        setShowUnlockAllModal(false);
      } else {
        showToast(data.message || 'Gagal membuka seluruh kunci pengguna', 'error');
      }
    } catch (err: any) {
      showToast('Terjadi kesalahan saat membuka seluruh kunci', 'error');
    } finally {
      setIsUnlockingAll(false);
    }
  };

  // Manually lock user (for testing or emergency administrative action)
  const handleManualLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIdentifier.trim() || !token) return;

    setIsLockingManual(true);
    try {
      const res = await fetch('/api/auth/admin/lock-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          identifier: manualIdentifier.trim(),
          reason: manualReason.trim() || 'Manual lock by Admin'
        })
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message || `Akun/IP ${manualIdentifier} berhasil dikunci selama 15 menit!`, 'success');
        setShowManualLockModal(false);
        setManualIdentifier('');
        fetchLockedUsers();
      } else {
        showToast(data.message || 'Gagal mengunci akun', 'error');
      }
    } catch (err: any) {
      showToast('Terjadi kesalahan saat mengunci akun', 'error');
    } finally {
      setIsLockingManual(false);
    }
  };

  // Filtered list
  const filteredUsers = useMemo(() => {
    return lockedUsers.filter(user => {
      // Type filter
      if (filterType === 'EMAIL' && user.type !== 'email') return false;
      if (filterType === 'IP' && user.type !== 'ip') return false;

      // Search filter
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const matchId = user.identifier.toLowerCase().includes(query);
      const matchEmail = user.email ? user.email.toLowerCase().includes(query) : false;
      const matchIp = user.ip ? user.ip.toLowerCase().includes(query) : false;
      const matchName = user.name ? user.name.toLowerCase().includes(query) : false;
      const matchReason = user.reason ? user.reason.toLowerCase().includes(query) : false;
      const matchVendor = user.vendorId ? user.vendorId.toLowerCase().includes(query) : false;

      return matchId || matchEmail || matchIp || matchName || matchReason || matchVendor;
    });
  }, [lockedUsers, filterType, searchQuery]);

  // Formatter for countdown
  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return 'Kedaluwarsa';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  // Percentage for progress bar (15 minutes = 900 seconds)
  const calculateProgressPercent = (remainingSeconds: number) => {
    const total = 900;
    const clamped = Math.max(0, Math.min(total, remainingSeconds));
    return Math.round((clamped / total) * 100);
  };

  const totalLockedCount = lockedUsers.length;
  const emailLockedCount = lockedUsers.filter(u => u.type === 'email').length;
  const ipLockedCount = lockedUsers.filter(u => u.type === 'ip').length;

  return (
    <div id="admin-locked-users-screen" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#201514] rounded-3xl p-6 sm:p-7 border border-stone-200/80 dark:border-stone-800 shadow-sm transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 flex items-center justify-center shadow-xs">
                <Lock className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading tracking-tight">
                Daftar User Terkunci (Redis Lockout)
              </h1>

              {/* Redis Connection Badge */}
              <div
                id="redis-status-badge"
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  isRedisConnected
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRedisConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <Database className="w-3.5 h-3.5" />
                <span>{isRedisConnected ? 'Redis Active (Connected)' : 'Fallback Memory Store'}</span>
              </div>

              {/* Lockout Rule Pill */}
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 text-xs font-semibold">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                <span>Durasi: 15 Menit (3x Gagal)</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 leading-relaxed max-w-3xl">
              Kelola daftar akun pengguna dan IP yang terkunci akibat 3 kali salah memasukkan PIN kasir atau password akun. Sebagai role <strong className="text-purple-600 dark:text-purple-400 font-bold">ADMIN</strong>, Anda dapat memantau status secara langsung dari Redis dan membuka kunci (unlock) pengguna seketika.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Refresh Button */}
            <button
              type="button"
              id="refresh-locked-users-btn"
              onClick={() => fetchLockedUsers(false)}
              disabled={isRefreshing}
              className="px-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-200 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs"
              title="Perbarui data dari Redis"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-orange-500' : ''}`} />
              <span>Refresh</span>
            </button>

            {/* Test / Manual Lock Button */}
            <button
              type="button"
              id="open-manual-lock-modal-btn"
              onClick={() => setShowManualLockModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/50 dark:hover:bg-orange-900/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-2xs"
            >
              <UserX className="w-4 h-4" />
              <span>Kunci Akun (Tes)</span>
            </button>

            {/* Unlock All Button */}
            {totalLockedCount > 0 && (
              <button
                type="button"
                id="unlock-all-users-btn"
                onClick={() => setShowUnlockAllModal(true)}
                className="px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-xs"
              >
                <Unlock className="w-4 h-4" />
                <span>Buka Kunci Semua ({totalLockedCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Quick Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-stone-100 dark:border-stone-800/80">
          {/* Stat 1: Total Locked */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider block">
                Total Terkunci
              </span>
              <span className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading">
                {totalLockedCount}
              </span>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              totalLockedCount > 0
                ? 'bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400'
                : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
            }`}>
              <Lock className="w-5 h-5" />
            </div>
          </div>

          {/* Stat 2: Locked via Email */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider block">
                Via Email Akun
              </span>
              <span className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading">
                {emailLockedCount}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
          </div>

          {/* Stat 3: Locked via IP */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider block">
                Via Alamat IP
              </span>
              <span className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading">
                {ipLockedCount}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
          </div>

          {/* Stat 4: Lockout Policy */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider block">
                Kebijakan Keamanan
              </span>
              <span className="text-xs sm:text-sm font-black text-stone-800 dark:text-stone-200 font-heading">
                15 Menit TTL
              </span>
              <span className="text-[10px] text-stone-400 block">3x Gagal = Kunci</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-[#201514] rounded-2xl p-4 border border-stone-200/80 dark:border-stone-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            id="search-locked-users-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari email, IP, nama, atau alasan..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 text-xs text-stone-800 dark:text-stone-200 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>

        {/* Filter Pills and Auto-Refresh Switch */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          {/* Type Filter Buttons */}
          <div className="flex items-center p-1 rounded-xl bg-stone-100 dark:bg-stone-800/80 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterType === 'ALL'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Semua ({lockedUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('EMAIL')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterType === 'EMAIL'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Email ({emailLockedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('IP')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterType === 'IP'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              IP ({ipLockedCount})
            </button>
          </div>

          {/* Auto Refresh Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded text-orange-500 focus:ring-orange-500/20"
            />
            <span className="hidden md:inline">Auto-refresh (10s)</span>
          </label>
        </div>
      </div>

      {/* Main Content: Table / List */}
      <div className="bg-white dark:bg-[#201514] rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-stone-400">
            <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold">Mengambil data user terkunci dari Redis...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          /* Empty State */
          <div className="py-16 sm:py-20 px-6 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-xs">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 font-heading">
              {searchQuery || filterType !== 'ALL'
                ? 'Tidak Ditemukan Pengguna Terkunci Sesuai Filter'
                : 'Tidak Ada Akun Terkunci di Redis'}
            </h3>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1.5 leading-relaxed">
              {searchQuery || filterType !== 'ALL'
                ? 'Coba ubah kata kunci pencarian atau reset filter tipe.'
                : 'Semua akun pengguna saat ini dalam kondisi aman dan tidak ada yang terblokir akibat 3 kali salah login.'}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                id="empty-test-lock-btn"
                onClick={() => {
                  setManualIdentifier('kasir1@beverage.com');
                  setManualReason('Simulasi pengujian lockout 15 menit');
                  setShowManualLockModal(true);
                }}
                className="px-4 py-2 rounded-2xl bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/60 dark:hover:bg-orange-900/60 text-orange-700 dark:text-orange-300 text-xs font-bold transition-all border border-orange-200 dark:border-orange-800 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Simulasikan Kunci Akun Kasir</span>
              </button>

              <button
                type="button"
                onClick={() => fetchLockedUsers(false)}
                className="px-4 py-2 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-200 text-xs font-bold transition-all"
              >
                Cek Ulang Redis
              </button>
            </div>
          </div>
        ) : (
          /* Table of Locked Users */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200/70 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/40 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Pengguna / Identitas</th>
                  <th className="py-3.5 px-4">Role & Toko</th>
                  <th className="py-3.5 px-4">Percobaan Gagal</th>
                  <th className="py-3.5 px-4">Sisa Waktu Lockout</th>
                  <th className="py-3.5 px-4">Alasan & Info IP</th>
                  <th className="py-3.5 px-4">Penyimpanan</th>
                  <th className="py-3.5 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 text-xs">
                {filteredUsers.map((item, idx) => {
                  const percent = calculateProgressPercent(item.remainingSeconds);
                  const isExpired = item.remainingSeconds <= 0;

                  return (
                    <tr
                      key={item.identifier || idx}
                      className="hover:bg-stone-50/80 dark:hover:bg-stone-850/50 transition-colors"
                    >
                      {/* Column 1: User / Identity */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center shrink-0 overflow-hidden">
                            {item.avatar ? (
                              <img
                                src={item.avatar}
                                alt={item.name || item.identifier}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-stone-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-stone-900 dark:text-stone-100 truncate max-w-[200px]">
                                {item.name || (item.type === 'ip' ? `IP Address Client` : item.email || item.identifier)}
                              </span>
                              {item.type === 'ip' ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                  IP
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                                  EMAIL
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono block truncate max-w-[220px]">
                              {item.identifier}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Role & Store */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          {item.role ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                item.role === 'ADMIN'
                                  ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                  : item.role === 'MANAGER'
                                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              }`}
                            >
                              {item.role}
                            </span>
                          ) : (
                            <span className="text-[11px] text-stone-400 italic">Tidak terdaftar</span>
                          )}

                          {item.vendorId && (
                            <div className="flex items-center gap-1 text-[11px] text-stone-500">
                              <Store className="w-3 h-3 text-stone-400" />
                              <span className="truncate max-w-[120px] font-medium">{item.vendorId}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Column 3: Failed Attempts */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-xl bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 font-mono font-black text-xs">
                            {item.failedAttempts} / 3
                          </span>
                          <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">
                            Terkunci
                          </span>
                        </div>
                      </td>

                      {/* Column 4: Remaining Lockout Time + Progress */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5 w-36">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-mono font-bold ${
                              isExpired
                                ? 'text-stone-400 line-through'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {formatCountdown(item.remainingSeconds)}
                            </span>
                            <span className="text-[10px] text-stone-400 font-medium">
                              {percent}%
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${
                                isExpired ? 'bg-stone-300' : 'bg-red-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Column 5: Reason & IP */}
                      <td className="py-4 px-4">
                        <div className="max-w-[200px] space-y-0.5">
                          <p className="text-xs text-stone-700 dark:text-stone-300 font-medium truncate" title={item.reason}>
                            {item.reason || '3x gagal login PIN/Password'}
                          </p>
                          {item.ip && (
                            <span className="text-[10px] text-stone-400 font-mono block">
                              IP: {item.ip}
                            </span>
                          )}
                          <span className="text-[10px] text-stone-400 block">
                            Sejak: {new Date(item.lockedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* Column 6: Storage Key */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold ${
                            item.source === 'redis'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}>
                            {item.source === 'redis' ? 'REDIS TTL' : 'IN-MEMORY'}
                          </span>
                        </div>
                      </td>

                      {/* Column 7: Action (Unlock) */}
                      <td className="py-4 px-5 text-right">
                        <button
                          type="button"
                          id={`unlock-user-btn-${item.identifier.replace(/[^a-zA-Z0-9]/g, '_')}`}
                          onClick={() => setSelectedUserToUnlock(item)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-all flex items-center gap-1.5 ml-auto cursor-pointer active:scale-95 shadow-2xs"
                          title="Buka kunci user ini dari Redis"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Buka Kunci</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Information Box at Bottom */}
      <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold block">Bagaimana Mekanisme Lockout Redis Bekerja?</span>
          <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed text-[11px] sm:text-xs">
            Setiap kali pengguna gagal memasukkan PIN atau password sebanyak 3 kali berturut-turut, backend secara otomatis membuat kunci di Redis dengan TTL 15 menit (900 detik). Layar login pengguna akan terkunci secara visual dengan countdown timer. Ketika role <strong>ADMIN</strong> menekan tombol <em>Buka Kunci</em>, kunci di Redis dihapus seketika dan penghitung percobaan gagal direset kembali ke 0.
          </p>
        </div>
      </div>

      {/* MODAL 1: Confirm Unlock Single User */}
      {selectedUserToUnlock && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#201514] rounded-3xl p-6 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Unlock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading">
                  Buka Kunci Pengguna Ini?
                </h3>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  Konfirmasi tindakan administratif oleh role ADMIN
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">Identitas:</span>
                <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                  {selectedUserToUnlock.identifier}
                </span>
              </div>
              {selectedUserToUnlock.name && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Nama:</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    {selectedUserToUnlock.name}
                  </span>
                </div>
              )}
              {selectedUserToUnlock.role && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Role:</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    {selectedUserToUnlock.role}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-stone-500">Sisa Waktu:</span>
                <span className="font-mono font-bold text-red-600 dark:text-red-400">
                  {formatCountdown(selectedUserToUnlock.remainingSeconds)}
                </span>
              </div>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              Membuka kunci akun ini akan menghapus entri lockout dari Redis dan mereset status kegagalan login. Pengguna dapat segera mencoba login kembali tanpa perlu menunggu sisa 15 menit.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                id="cancel-unlock-btn"
                onClick={() => setSelectedUserToUnlock(null)}
                disabled={isUnlocking}
                className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="confirm-unlock-btn"
                onClick={handleUnlockUser}
                disabled={isUnlocking}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isUnlocking ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Membuka Kunci...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Ya, Buka Kunci Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Confirm Unlock All Users */}
      {showUnlockAllModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#201514] rounded-3xl p-6 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading">
                  Buka Kunci SEMUA Pengguna ({totalLockedCount} Akun)?
                </h3>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  Tindakan massal pada database Redis
                </span>
              </div>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              Apakah Anda yakin ingin membuka kunci seluruh akun pengguna ({totalLockedCount} akun) yang saat ini terkunci di Redis? Semua penghitung kegagalan login akan direset ke 0.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowUnlockAllModal(false)}
                disabled={isUnlockingAll}
                className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="confirm-unlock-all-btn"
                onClick={handleUnlockAllUsers}
                disabled={isUnlockingAll}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isUnlockingAll ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Membuka Semua...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Buka Kunci Semua ({totalLockedCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Manual Lock (Testing / Security) */}
      {showManualLockModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#201514] rounded-3xl p-6 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading">
                  Kunci Akun / IP (Uji Coba Lockout)
                </h3>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  Simulasikan kunci 15 menit di Redis
                </span>
              </div>
            </div>

            <form onSubmit={handleManualLock} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Email Akun atau Alamat IP
                </label>
                <input
                  type="text"
                  id="manual-lock-identifier-input"
                  value={manualIdentifier}
                  onChange={e => setManualIdentifier(e.target.value)}
                  placeholder="Contoh: kasir1@beverage.com atau 192.168.1.5"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Alasan Kunci
                </label>
                <input
                  type="text"
                  id="manual-lock-reason-input"
                  value={manualReason}
                  onChange={e => setManualReason(e.target.value)}
                  placeholder="Contoh: Percobaan login mencurigakan"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 text-[11px] text-stone-500 leading-relaxed border border-stone-200/60 dark:border-stone-800">
                Akun akan disimpan di Redis dengan durasi <strong>15 menit (900 detik)</strong>. Anda dapat melihatnya langsung di halaman ini dan membuka kuncinya kapan saja.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualLockModal(false)}
                  disabled={isLockingManual}
                  className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  id="submit-manual-lock-btn"
                  disabled={isLockingManual || !manualIdentifier.trim()}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isLockingManual ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengunci...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Kunci Akun Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
