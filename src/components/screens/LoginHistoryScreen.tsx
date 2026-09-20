import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-date-picker';
import 'react-date-picker/dist/DatePicker.css';
import 'react-calendar/dist/Calendar.css';

import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Calendar as CalendarIcon,
  User as UserIcon,
  Filter,
  RotateCcw,
  RefreshCw,
  Mail,
  Laptop,
  Smartphone,
  Tablet as TabletIcon,
  CheckCircle2,
  XCircle,
  KeyRound,
  Lock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Info,
  Clock,
  X,
  Copy,
  Check
} from 'lucide-react';
import { LoginHistoryEntry, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { RadixSelect, RadixSelectOption } from '../common/RadixSelect';
import { AdminAllVendorsHeader, VendorBadge } from '../common/AdminAllVendorsHeader';

interface SelectableUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

type ValuePiece = Date | null;
type DatePickerValue = ValuePiece | [ValuePiece, ValuePiece];

interface LoginHistoryScreenProps {
  allVendorsMode?: boolean;
}

export const LoginHistoryScreen: React.FC<LoginHistoryScreenProps> = ({ allVendorsMode = false }) => {
  const { user, token } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  const isAuthorized = user?.role === 'MANAGER' || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const isManager = isAuthorized;

  // Data states
  const [history, setHistory] = useState<LoginHistoryEntry[]>([]);
  const [usersList, setUsersList] = useState<SelectableUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');

  // Pagination states
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Summary stats
  const [stats, setStats] = useState({
    totalLogins: 0,
    activeSessions: 0,
    revokedSessions: 0,
    uniqueUsers: 0
  });

  // Filter states
  const [keyword, setKeyword] = useState<string>('');
  const [debouncedKeyword, setDebouncedKeyword] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [dateFilterType, setDateFilterType] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'CUSTOM'>('ALL');
  const [dateValue, setDateValue] = useState<ValuePiece>(null);
  const [customDate, setCustomDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'REVOKED' | 'LOGGED_OUT'>('ALL');
  const [calendarPortal, setCalendarPortal] = useState<HTMLDivElement | null>(null);

  // Modal states
  const [selectedEntryForDetail, setSelectedEntryForDetail] = useState<LoginHistoryEntry | null>(null);
  const [sessionToRevoke, setSessionToRevoke] = useState<LoginHistoryEntry | null>(null);
  const [revokeReason, setRevokeReason] = useState<string>('Dikeluarkan oleh manajer toko');
  const [isRevoking, setIsRevoking] = useState<boolean>(false);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  // Debounce search keyword
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
      setPage(1); // Reset to page 1 on search change
    }, 350);
    return () => clearTimeout(timer);
  }, [keyword]);

  // Fetch selectable users for user filter dropdown
  useEffect(() => {
    if (!isAuthorized) return;
    const fetchUsers = async () => {
      try {
        const url = allVendorsMode
          ? (selectedVendor === 'all' ? '/api/auth/selectable-users?allVendors=true' : `/api/auth/selectable-users?vendorId=${selectedVendor}`)
          : '/api/auth/selectable-users';
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token || ''}` }
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          setUsersList(data.users);
        }
      } catch (err) {
        console.warn('Gagal memuat daftar pengguna:', err);
      }
    };
    fetchUsers();
  }, [isAuthorized, allVendorsMode, selectedVendor, token]);

  // Determine computed date string for query
  const computedDateQuery = useMemo(() => {
    if (dateFilterType === 'TODAY') {
      return new Date().toISOString().split('T')[0];
    }
    if (dateFilterType === 'YESTERDAY') {
      const yesterday = new Date(Date.now() - 86400000);
      return yesterday.toISOString().split('T')[0];
    }
    if (dateFilterType === 'CUSTOM' && customDate) {
      return customDate;
    }
    return '';
  }, [dateFilterType, customDate]);

  // Fetch login history data with pagination & filters
  const fetchHistory = async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('scope', 'all');
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      if (allVendorsMode) {
        if (selectedVendor === 'all') {
          params.set('allVendors', 'true');
        } else {
          params.set('vendorId', selectedVendor);
        }
      }

      if (debouncedKeyword.trim()) {
        params.set('search', debouncedKeyword.trim());
      }
      if (selectedUser && selectedUser !== 'ALL') {
        params.set('user', selectedUser);
      }
      if (computedDateQuery) {
        params.set('date', computedDateQuery);
      }
      if (statusFilter && statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }

      const res = await fetch(`/api/auth/login-history?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token || ''}`
        }
      });

      if (res.status === 403) {
        showToast('Akses ditolak: Hanya Manajer atau Admin yang dapat melihat riwayat login', 'error');
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
        if (data.pagination) {
          setTotalRecords(data.pagination.total);
          setTotalPages(data.pagination.totalPages);
        }
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        showToast(data.message || 'Gagal mengambil riwayat login', 'error');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      showToast('Gagal terhubung ke server', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token, isAuthorized, allVendorsMode, selectedVendor, page, limit, debouncedKeyword, selectedUser, computedDateQuery, statusFilter]);

  // Handle DatePicker change from react-date-picker
  const handleDatePickerChange = (val: DatePickerValue) => {
    if (val instanceof Date) {
      setDateValue(val);
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      setCustomDate(`${y}-${m}-${d}`);
      setDateFilterType('CUSTOM');
      setPage(1);
    } else {
      setDateValue(null);
      setCustomDate('');
      setDateFilterType('ALL');
      setPage(1);
    }
  };

  // Quick preset button click handler
  const handleSelectPreset = (type: 'ALL' | 'TODAY' | 'YESTERDAY') => {
    setDateFilterType(type);
    if (type === 'ALL') {
      setDateValue(null);
      setCustomDate('');
    } else if (type === 'TODAY') {
      const now = new Date();
      setDateValue(now);
      setCustomDate(now.toISOString().split('T')[0]);
    } else if (type === 'YESTERDAY') {
      const yest = new Date(Date.now() - 86400000);
      setDateValue(yest);
      setCustomDate(yest.toISOString().split('T')[0]);
    }
    setPage(1);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setKeyword('');
    setDebouncedKeyword('');
    setSelectedUser('ALL');
    setDateFilterType('ALL');
    setDateValue(null);
    setCustomDate('');
    setStatusFilter('ALL');
    setPage(1);
  };

  const isFilterActive = Boolean(
    keyword ||
    selectedUser !== 'ALL' ||
    dateFilterType !== 'ALL' ||
    customDate ||
    statusFilter !== 'ALL'
  );

  const activeFiltersCount = [
    Boolean(keyword),
    selectedUser !== 'ALL',
    dateFilterType !== 'ALL' || Boolean(customDate),
    statusFilter !== 'ALL'
  ].filter(Boolean).length;

  // Radix UI Select options for User
  const userSelectOptions: RadixSelectOption[] = useMemo(() => {
    const opts: RadixSelectOption[] = [
      {
        value: 'ALL',
        label: 'Semua Pengguna',
        sublabel: 'Seluruh akun kasir & manajer',
        icon: <UserIcon className="w-3.5 h-3.5 text-stone-400" />
      }
    ];

    usersList.forEach(u => {
      opts.push({
        value: u.email,
        label: u.name,
        sublabel: u.email,
        badge: u.role === 'MANAGER' ? 'Manager' : 'Kasir',
        badgeColor:
          u.role === 'MANAGER'
            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
            : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400',
        icon: (
          <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-[10px] font-bold text-stone-700 dark:text-stone-200 shrink-0">
            {u.name ? u.name[0].toUpperCase() : 'U'}
          </span>
        )
      });
    });

    return opts;
  }, [usersList]);

  // Radix UI Select options for Session Status
  const statusSelectOptions: RadixSelectOption[] = useMemo(
    () => [
      {
        value: 'ALL',
        label: 'Semua Status Sesi',
        sublabel: 'Aktif, Dicabut, dan Logout',
        icon: <Filter className="w-3.5 h-3.5 text-stone-400" />
      },
      {
        value: 'ACTIVE',
        label: 'Sesi Aktif',
        sublabel: 'Perangkat sedang terhubung',
        badge: 'ACTIVE',
        badgeColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
        icon: <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block shrink-0" />
      },
      {
        value: 'TIMED_OUT',
        label: 'Timeout (15 Menit)',
        sublabel: 'Otomatis idle via Redis',
        badge: 'TIMED_OUT',
        badgeColor: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
        icon: <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
      },
      {
        value: 'REVOKED',
        label: 'Sesi Dicabut',
        sublabel: 'Dikeluarkan oleh manajer',
        badge: 'REVOKED',
        badgeColor: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
        icon: <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
      },
      {
        value: 'LOGGED_OUT',
        label: 'Logout Selesai',
        sublabel: 'Keluar secara normal',
        badge: 'LOGGED_OUT',
        badgeColor: 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400',
        icon: <LogOut className="w-3.5 h-3.5 text-stone-400 shrink-0" />
      }
    ],
    []
  );

  // Radix UI Select options for Limit (Rows per page)
  const limitSelectOptions: RadixSelectOption[] = useMemo(
    () => [
      { value: '10', label: '10 baris per halaman' },
      { value: '15', label: '15 baris per halaman' },
      { value: '20', label: '20 baris per halaman' },
      { value: '50', label: '50 baris per halaman' }
    ],
    []
  );

  // Revoke active session handler
  const handleConfirmRevoke = async () => {
    if (!sessionToRevoke) return;
    setIsRevoking(true);
    try {
      const res = await fetch('/api/auth/revoke-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          sessionId: sessionToRevoke.sessionId,
          reason: revokeReason || 'Dikeluarkan oleh manajer toko'
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Sesi perangkat berhasil dicabut dan dikeluarkan!', 'success');
        setSessionToRevoke(null);
        fetchHistory();
      } else {
        showToast(data.message || 'Gagal mencabut sesi', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setIsRevoking(false);
    }
  };

  // Send login history report email to manager
  const handleSendEmailReport = async () => {
    if (!user?.email) return;
    setIsSendingEmail(true);
    try {
      const res = await fetch('/api/auth/send-login-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({ email: user.email })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Laporan riwayat login berhasil dikirim ke email manajer!', 'success');
      } else {
        showToast(data.message || 'Gagal mengirim email laporan', 'error');
      }
    } catch (err) {
      showToast('Gagal menghubungi server email', 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Copy IP Helper
  const handleCopyIp = (ip: string) => {
    navigator.clipboard?.writeText(ip);
    setCopiedIp(ip);
    showToast(`IP ${ip} berhasil disalin`, 'info');
    setTimeout(() => setCopiedIp(null), 2000);
  };

  // Device Icon helper
  const getDeviceIcon = (device?: string, userAgent?: string) => {
    const text = `${device || ''} ${userAgent || ''}`.toLowerCase();
    if (text.includes('ipad') || text.includes('tablet')) {
      return <TabletIcon className="w-4 h-4 text-purple-500 shrink-0" />;
    }
    if (text.includes('mobile') || text.includes('iphone') || text.includes('android')) {
      return <Smartphone className="w-4 h-4 text-sky-500 shrink-0" />;
    }
    return <Laptop className="w-4 h-4 text-emerald-500 shrink-0" />;
  };

  // Format date helper (WIB)
  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return {
        date: d.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        time: d.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      };
    } catch (e) {
      return { date: dateStr, time: '' };
    }
  };

  // If user is not manager/admin, display access denied
  if (!isAuthorized) {
    return (
      <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-xl mx-auto flex flex-col items-center justify-center text-center">
        <div className="w-full bg-white dark:bg-[#251e1c] rounded-3xl border border-rose-200 dark:border-rose-900/50 p-8 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold font-heading text-stone-900 dark:text-stone-100">
            Akses Terbatas: Khusus Manajer & Administrator
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-2 mb-6">
            Menu Login Histori hanya dapat diakses oleh akun dengan peran Manajer atau Administrator untuk memantau audit keamanan seluruh staf.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="login-history-screen" className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-7xl mx-auto space-y-5 sm:space-y-6 animate-in fade-in duration-200">
      {/* Admin Cross-Vendor Header */}
      {allVendorsMode && (
        <AdminAllVendorsHeader
          title={t('navAdminLoginHistory')}
          subtitle="Audit log riwayat login, keamanan sesi, dan alamat IP seluruh vendor jaringan"
          selectedVendor={selectedVendor}
          onVendorChange={setSelectedVendor}
          onRefresh={fetchHistory}
          isLoading={loading}
          itemCount={totalRecords}
          itemLabel="Log Sesi"
        />
      )}

      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#251e1c] p-4 sm:p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black font-heading tracking-tight text-stone-900 dark:text-stone-100">
                  {allVendorsMode ? 'Riwayat Login Seluruh Vendor' : 'Riwayat Login Pengguna'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60">
                  {allVendorsMode ? 'ALL VENDOR' : 'Khusus Manajer'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                Audit trail keamanan seluruh staf, sesi aktif, alamat IP, dan perangkat kasir
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Responsive across mobile & desktop */}
        <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={fetchHistory}
            disabled={loading}
            className="flex-1 sm:flex-initial justify-center px-3.5 py-2.5 sm:py-2 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-60 cursor-pointer min-h-[44px] sm:min-h-0"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={handleSendEmailReport}
            disabled={isSendingEmail}
            className="flex-1 sm:flex-initial justify-center px-4 py-2.5 sm:py-2 rounded-2xl bg-accent hover:bg-accent/90 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-xs active:scale-95 disabled:opacity-60 cursor-pointer min-h-[44px] sm:min-h-0"
            title="Kirim laporan ringkasan riwayat login ke email manajer"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>{isSendingEmail ? 'Mengirim...' : 'Kirim Laporan'}</span>
          </button>
        </div>
      </div>

      {/* 2. Summary KPI Metric Cards (Responsive Grid: 2 cols on mobile, 4 cols on tablet/desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Logins */}
        <div className="bg-white dark:bg-[#251e1c] p-3.5 sm:p-5 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold text-stone-500 dark:text-stone-400 block truncate">
              Total Riwayat Login
            </span>
            <span className="text-base sm:text-xl font-black font-heading text-stone-900 dark:text-stone-100">
              {stats.totalLogins.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-white dark:bg-[#251e1c] p-3.5 sm:p-5 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold text-stone-500 dark:text-stone-400 block truncate">
              Sesi Aktif
            </span>
            <span className="text-base sm:text-xl font-black font-heading text-emerald-600 dark:text-emerald-400">
              {stats.activeSessions.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Revoked Sessions */}
        <div className="bg-white dark:bg-[#251e1c] p-3.5 sm:p-5 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold text-stone-500 dark:text-stone-400 block truncate">
              Sesi Dicabut
            </span>
            <span className="text-base sm:text-xl font-black font-heading text-rose-600 dark:text-rose-400">
              {stats.revokedSessions.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Unique Users */}
        <div className="bg-white dark:bg-[#251e1c] p-3.5 sm:p-5 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <UserIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold text-stone-500 dark:text-stone-400 block truncate">
              Pengguna Unik
            </span>
            <span className="text-base sm:text-xl font-black font-heading text-stone-900 dark:text-stone-100">
              {stats.uniqueUsers.toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Comprehensive Filter Control Bar - RESPONSIVE FOR DESKTOP, TABLET, AND MOBILE */}
      <div className="bg-white dark:bg-[#251e1c] p-4 sm:p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-4 sm:space-y-5">
        {/* Header & Reset Button */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-stone-100 dark:border-stone-800/80 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shrink-0">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                Filter & Pencarian Riwayat
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400">
                Saring data riwayat login berdasarkan kata kunci, staf, status sesi, atau tanggal
              </p>
            </div>
          </div>

          {isFilterActive && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-accent hover:bg-orange-50 dark:hover:bg-orange-950/40 border border-accent/20 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Semua Filter ({activeFiltersCount})</span>
            </button>
          )}
        </div>

        {/* Komponen 1: Bar Pencarian Kata Kunci Utama (Full Width & Lega) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-stone-400" />
            <span>Pencarian Kata Kunci</span>
          </label>
          <div className="relative w-full">
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Cari berdasarkan nama staf, email, alamat IP, ID sesi, atau perangkat..."
              className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all min-h-[44px]"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3 sm:top-3.5 pointer-events-none" />
            {keyword && (
              <button
                type="button"
                onClick={() => setKeyword('')}
                className="w-7 h-7 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 absolute right-3 top-2 sm:top-2.5 flex items-center justify-center cursor-pointer rounded-lg hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
                aria-label="Hapus kata kunci"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Komponen 2: Dropdown Pengguna & Status Sesi (Grid 2 Kolom yang Lega) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {/* Dropdown Pengguna / Staf */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-stone-400" />
              <span>Filter Pengguna / Staf</span>
            </label>
            <RadixSelect
              id="user-select-filter"
              ariaLabel="Filter Pengguna atau Staf"
              value={selectedUser}
              onValueChange={val => {
                setSelectedUser(val);
                setPage(1);
              }}
              options={userSelectOptions}
              placeholder="Pilih Pengguna..."
            />
          </div>

          {/* Dropdown Status Sesi */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-stone-400" />
              <span>Filter Status Sesi Perangkat</span>
            </label>
            <RadixSelect
              id="status-select-filter"
              ariaLabel="Filter Status Sesi"
              value={statusFilter}
              onValueChange={val => {
                setStatusFilter(val as any);
                setPage(1);
              }}
              options={statusSelectOptions}
              placeholder="Pilih Status Sesi..."
            />
          </div>
        </div>

        {/* Komponen 3: Filter Tanggal Login (Dedicated Date Range & react-date-picker Card) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-50/80 dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-accent" />
              <span className="text-xs sm:text-sm font-bold text-stone-800 dark:text-stone-200">
                Filter Tanggal Login
              </span>
              {dateFilterType !== 'ALL' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-950 text-accent">
                  {dateFilterType === 'TODAY' ? 'Hari Ini' : dateFilterType === 'YESTERDAY' ? 'Kemarin' : 'Kustom'}
                </span>
              )}
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleSelectPreset('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[36px] flex items-center justify-center ${
                  dateFilterType === 'ALL'
                    ? 'bg-accent text-white shadow-2xs'
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-100'
                }`}
              >
                Semua Tanggal
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('TODAY')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[36px] flex items-center justify-center ${
                  dateFilterType === 'TODAY'
                    ? 'bg-accent text-white shadow-2xs'
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-100'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('YESTERDAY')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[36px] flex items-center justify-center ${
                  dateFilterType === 'YESTERDAY'
                    ? 'bg-accent text-white shadow-2xs'
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-100'
                }`}
              >
                Kemarin
              </button>
            </div>
          </div>

          {/* DatePicker row with wide room and descriptive text */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="w-full sm:w-80 lg:w-96 relative shrink-0">
              <DatePicker
                value={dateValue}
                onChange={handleDatePickerChange}
                format="dd/MM/yyyy"
                locale="id-ID"
                className="custom-date-picker"
                portalContainer={calendarPortal}
                calendarIcon={<CalendarIcon className="w-4 h-4 text-stone-400" />}
                clearIcon={<X className="w-4 h-4 text-stone-400" />}
                calendarAriaLabel="Buka Kalender"
                clearAriaLabel="Hapus Tanggal"
                dayAriaLabel="Hari"
                monthAriaLabel="Bulan"
                yearAriaLabel="Tahun"
                maxDate={new Date()}
              />
              <div ref={setCalendarPortal} className="custom-date-picker custom-date-picker-portal" />
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5 min-w-0">
              <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span className="truncate">
                {dateFilterType === 'ALL'
                  ? 'Menampilkan semua riwayat tanpa filter tanggal.'
                  : dateFilterType === 'TODAY'
                  ? 'Menampilkan riwayat hari ini.'
                  : dateFilterType === 'YESTERDAY'
                  ? 'Menampilkan riwayat kemarin.'
                  : dateValue instanceof Date
                  ? `Menampilkan riwayat tanggal ${dateValue.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
                  : 'Pilih tanggal di kalender'}
              </span>
            </div>
          </div>
        </div>

        {/* Komponen 4: Active Filters Chips Bar */}
        {isFilterActive && (
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
              Filter Aktif:
            </span>
            {keyword && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200">
                <span>Kata Kunci: "{keyword}"</span>
                <button
                  type="button"
                  onClick={() => setKeyword('')}
                  className="hover:text-rose-500 cursor-pointer ml-0.5"
                  title="Hapus filter kata kunci"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedUser !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                <span>Staf: {usersList.find(u => u.email === selectedUser)?.name || selectedUser}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedUser('ALL'); setPage(1); }}
                  className="hover:text-rose-500 cursor-pointer ml-0.5"
                  title="Hapus filter staf"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {dateFilterType !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-100 dark:bg-orange-950/60 text-accent">
                <span>
                  Tanggal:{' '}
                  {dateFilterType === 'TODAY'
                    ? 'Hari Ini'
                    : dateFilterType === 'YESTERDAY'
                    ? 'Kemarin'
                    : dateValue instanceof Date
                    ? dateValue.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'Kustom'}
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectPreset('ALL')}
                  className="hover:text-rose-500 cursor-pointer ml-0.5"
                  title="Hapus filter tanggal"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {statusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                <span>
                  Status:{' '}
                  {statusFilter === 'ACTIVE'
                    ? 'Sesi Aktif'
                    : statusFilter === 'TIMED_OUT'
                    ? 'Timeout (15m)'
                    : statusFilter === 'REVOKED'
                    ? 'Sesi Dicabut'
                    : 'Logout'}
                </span>
                <button
                  type="button"
                  onClick={() => { setStatusFilter('ALL'); setPage(1); }}
                  className="hover:text-rose-500 cursor-pointer ml-0.5"
                  title="Hapus filter status"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 4. Main Login History Container - RESPONSIVE FOR DESKTOP, TABLET, AND MOBILE */}
      <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs overflow-hidden">
        {/* Table Top Controls: Count & Rows Per Page using Radix Select */}
        <div className="p-3.5 sm:p-5 border-b border-stone-100 dark:border-stone-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-stone-50/50 dark:bg-stone-900/30">
          <div className="text-xs text-stone-600 dark:text-stone-400">
            Ditemukan <span className="font-black text-stone-900 dark:text-stone-100">{totalRecords}</span> entri riwayat login
            {isFilterActive && <span className="text-accent font-semibold ml-1">(tersaring)</span>}
          </div>

          {/* Rows per page selector with Radix UI Select */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-stone-500 dark:text-stone-400 whitespace-nowrap">Tampilkan:</span>
            <div className="w-48 sm:w-44">
              <RadixSelect
                value={String(limit)}
                onValueChange={val => {
                  setLimit(Number(val));
                  setPage(1);
                }}
                options={limitSelectOptions}
                className="py-1.5 px-3 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Loading Indicator */}
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full border-3 border-orange-500 border-t-transparent animate-spin" />
            <span className="text-xs font-bold text-stone-500">Memuat riwayat login...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="p-10 sm:p-14 text-center max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-850 text-stone-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-stone-800 dark:text-stone-200">
              Tidak Ada Riwayat Login
            </h4>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {isFilterActive
                ? 'Tidak ada riwayat login yang cocok dengan kriteria filter pencarian Anda. Silakan coba sesuaikan kata kunci atau filter tanggal.'
                : 'Belum ada data riwayat login tercatat pada sistem.'}
            </p>
            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold hover:bg-stone-200 transition-all cursor-pointer"
              >
                Reset Semua Filter
              </button>
            )}
          </div>
        ) : (
          <>
            {/* VIEW A: Desktop Table View (lg: screens >= 1024px) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200/80 dark:border-stone-800 bg-stone-100/80 dark:bg-stone-900/80 text-[11px] font-extrabold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                    <th className="py-3.5 px-4">{language === 'en' ? 'User' : 'Pengguna'}</th>
                    <th className="py-3.5 px-4">{language === 'en' ? 'Login Time' : 'Waktu Login'}</th>
                    <th className="py-3.5 px-4">{language === 'en' ? 'Method' : 'Metode'}</th>
                    <th className="py-3.5 px-4">{language === 'en' ? 'Device & IP' : 'Perangkat & IP'}</th>
                    <th className="py-3.5 px-4">{language === 'en' ? 'Session Status' : 'Status Sesi'}</th>
                    <th className="py-3.5 px-4 text-right">{language === 'en' ? 'Actions' : 'Aksi'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/70 dark:divide-stone-800/80 text-xs">
                  {history.map((entry, idx) => {
                    const dt = formatDateTime(entry.timestamp);
                    const isActive = entry.status === 'ACTIVE';
                    const isRevoked = entry.status === 'REVOKED';
                    const isEven = idx % 2 === 0;

                    return (
                      <tr
                        key={entry.id || entry.sessionId || idx}
                        className={`transition-colors border-b border-stone-200/60 dark:border-stone-800/70 last:border-b-0 ${
                          isEven
                            ? 'bg-white dark:bg-[#251e1c]'
                            : 'bg-stone-100/70 dark:bg-[#1a1413]'
                        } hover:bg-orange-500/10 dark:hover:bg-orange-500/15`}
                      >
                        {/* 1. Pengguna */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl overflow-hidden bg-stone-200/80 dark:bg-stone-800 shrink-0 border border-stone-300/80 dark:border-stone-700 flex items-center justify-center font-bold text-xs text-stone-700 dark:text-stone-200">
                              {entry.name?.[0] || 'U'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-stone-900 dark:text-stone-100 truncate">
                                  {entry.name}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                                    entry.role === 'MANAGER'
                                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300/70 dark:border-amber-800/60'
                                      : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                                  }`}
                                >
                                  {entry.role === 'MANAGER' ? 'Manager' : 'Kasir'}
                                </span>
                                {allVendorsMode && (
                                  <VendorBadge vendorId={entry.vendorId} />
                                )}
                              </div>
                              <span className="text-[11px] text-stone-500 dark:text-stone-400 block truncate">
                                {entry.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Waktu Login */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-stone-800 dark:text-stone-200">
                            {dt.date}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400">
                            {dt.time} WIB
                          </div>
                        </td>

                        {/* 3. Metode Login */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-stone-800/90 text-stone-800 dark:text-stone-200 border border-stone-200/80 dark:border-stone-700/70 font-bold text-[11px]">
                            {entry.loginMethod === 'PIN' ? (
                              <>
                                <KeyRound className="w-3.5 h-3.5 text-accent" />
                                <span>PIN 4-Digit</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5 text-blue-500" />
                                <span>Password</span>
                              </>
                            )}
                          </span>
                        </td>

                        {/* 4. Perangkat & IP */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            {getDeviceIcon(entry.device, entry.userAgent)}
                            <span className="font-semibold text-stone-800 dark:text-stone-200 truncate max-w-[180px]">
                              {entry.device || 'Perangkat Web'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[11px] text-stone-600 dark:text-stone-400">
                              {entry.ipAddress}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyIp(entry.ipAddress)}
                              className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer p-0.5 rounded transition-colors"
                              title="Salin IP"
                            >
                              {copiedIp === entry.ipAddress ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* 5. Status Sesi */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/70 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                              <span>Sesi Aktif</span>
                            </span>
                          ) : entry.status === 'TIMED_OUT' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/70">
                              <Clock className="w-3 h-3 text-amber-500" />
                              <span>Timeout 15m</span>
                            </span>
                          ) : isRevoked ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/70">
                              <XCircle className="w-3 h-3 text-rose-500" />
                              <span>Dicabut</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700">
                              <LogOut className="w-3 h-3 text-stone-400" />
                              <span>Logout Selesai</span>
                            </span>
                          )}
                        </td>

                        {/* 6. Aksi */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedEntryForDetail(entry)}
                              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-stone-700 dark:text-stone-200 bg-white/80 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Lihat Detail Sesi"
                            >
                              <Info className="w-3.5 h-3.5" />
                              <span>Detail</span>
                            </button>

                            {isActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSessionToRevoke(entry);
                                  setRevokeReason(`Dikeluarkan oleh manajer (${user?.name || 'Manager'})`);
                                }}
                                className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 border border-rose-200 dark:border-rose-900/60 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="Keluarkan / Cabut sesi pengguna ini sekarang"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                                <span>Keluarkan</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VIEW B: Tablet Grid View (sm: to lg: screens 640px - 1023px) */}
            <div className="hidden sm:grid lg:hidden sm:grid-cols-2 gap-4 p-4 bg-stone-50/50 dark:bg-stone-950/20">
              {history.map((entry, idx) => {
                const dt = formatDateTime(entry.timestamp);
                const isActive = entry.status === 'ACTIVE';
                const isRevoked = entry.status === 'REVOKED';
                const isEven = idx % 2 === 0;

                return (
                  <div
                    key={entry.id || entry.sessionId || idx}
                    className={`p-4 rounded-2xl border space-y-3.5 hover:border-stone-400 dark:hover:border-stone-600 transition-all flex flex-col justify-between shadow-2xs ${
                      isEven
                        ? 'bg-white dark:bg-[#251e1c] border-stone-200/90 dark:border-stone-800'
                        : 'bg-stone-100/70 dark:bg-[#1a1413] border-stone-300/80 dark:border-stone-800/90'
                    }`}
                  >
                    {/* Header: User & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-stone-200 dark:bg-stone-800 shrink-0 border border-stone-300 dark:border-stone-700 flex items-center justify-center font-bold text-xs text-stone-700 dark:text-stone-300">
                          {entry.name?.[0] || 'U'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-stone-900 dark:text-stone-100 truncate">
                              {entry.name}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                                entry.role === 'MANAGER'
                                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300/70 dark:border-amber-800/60'
                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                              }`}
                            >
                              {entry.role === 'MANAGER' ? 'Manager' : 'Kasir'}
                            </span>
                            {allVendorsMode && (
                              <VendorBadge vendorId={entry.vendorId} />
                            )}
                          </div>
                          <span className="text-[11px] text-stone-500 dark:text-stone-400 block truncate">
                            {entry.email}
                          </span>
                        </div>
                      </div>

                      {/* Status badge */}
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/70 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Aktif</span>
                        </span>
                      ) : entry.status === 'TIMED_OUT' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/70 shrink-0">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span>Timeout</span>
                        </span>
                      ) : isRevoked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/70 shrink-0">
                          <XCircle className="w-3 h-3 text-rose-500" />
                          <span>Dicabut</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 shrink-0">
                          <LogOut className="w-3 h-3 text-stone-400" />
                          <span>Logout</span>
                        </span>
                      )}
                    </div>

                    {/* Content Details Grid */}
                    <div
                      className={`grid grid-cols-2 gap-2 text-xs p-3 rounded-xl border transition-colors ${
                        isEven
                          ? 'bg-stone-50/90 dark:bg-[#1e1715] border-stone-200/80 dark:border-stone-800/70'
                          : 'bg-white dark:bg-[#251e1c] border-stone-200/80 dark:border-stone-700/80'
                      }`}
                    >
                      <div>
                        <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase font-bold block">Waktu Login</span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200 text-[11px]">
                          {dt.date}
                        </span>
                        <span className="block text-[10px] text-stone-500 dark:text-stone-400">
                          {dt.time} WIB
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase font-bold block">Metode</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-stone-800 dark:text-stone-200 text-[11px] mt-0.5">
                          {entry.loginMethod === 'PIN' ? (
                            <>
                              <KeyRound className="w-3 h-3 text-accent" />
                              <span>PIN 4-Digit</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 text-blue-500" />
                              <span>Password</span>
                            </>
                          )}
                        </span>
                      </div>

                      <div className="col-span-2 pt-1.5 border-t border-stone-200/60 dark:border-stone-800/80 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {getDeviceIcon(entry.device, entry.userAgent)}
                          <span className="truncate text-stone-700 dark:text-stone-300 text-[11px] font-medium">
                            {entry.device || 'Web'} • {entry.ipAddress}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyIp(entry.ipAddress)}
                          className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1 cursor-pointer transition-colors"
                          title="Salin IP"
                        >
                          {copiedIp === entry.ipAddress ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Tablet Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedEntryForDetail(entry)}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 text-xs font-bold hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>Detail</span>
                      </button>

                      {isActive && (
                        <button
                          type="button"
                          onClick={() => {
                            setSessionToRevoke(entry);
                            setRevokeReason(`Dikeluarkan oleh manajer (${user?.name || 'Manager'})`);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Keluarkan</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* VIEW C: Mobile Card List View (sm:hidden screens < 640px) */}
            <div className="sm:hidden divide-y divide-stone-200/80 dark:divide-stone-800">
              {history.map((entry, idx) => {
                const dt = formatDateTime(entry.timestamp);
                const isActive = entry.status === 'ACTIVE';
                const isRevoked = entry.status === 'REVOKED';
                const isEven = idx % 2 === 0;

                return (
                  <div
                    key={entry.id || entry.sessionId || idx}
                    className={`p-4 space-y-3 transition-colors ${
                      isEven
                        ? 'bg-white dark:bg-[#251e1c]'
                        : 'bg-stone-100/70 dark:bg-[#1a1413]'
                    }`}
                  >
                    {/* User Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-stone-200 dark:bg-stone-800 shrink-0 border border-stone-300 dark:border-stone-700 flex items-center justify-center font-bold text-xs text-stone-700 dark:text-stone-300">
                          {entry.name?.[0] || 'U'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-stone-900 dark:text-stone-100 truncate">
                              {entry.name}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                                entry.role === 'MANAGER'
                                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300/70 dark:border-amber-800/60'
                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                              }`}
                            >
                              {entry.role === 'MANAGER' ? 'Manager' : 'Kasir'}
                            </span>
                            {allVendorsMode && (
                              <VendorBadge vendorId={entry.vendorId} />
                            )}
                          </div>
                          <span className="text-[11px] text-stone-500 dark:text-stone-400 block truncate">
                            {entry.email}
                          </span>
                        </div>
                      </div>

                      {/* Status indicator */}
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/70 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Aktif</span>
                        </span>
                      ) : isRevoked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/70 shrink-0">
                          <XCircle className="w-3 h-3 text-rose-500" />
                          <span>Dicabut</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 shrink-0">
                          <LogOut className="w-3 h-3 text-stone-400" />
                          <span>Logout</span>
                        </span>
                      )}
                    </div>

                    {/* Metadata Grid */}
                    <div
                      className={`grid grid-cols-2 gap-2 text-[11px] p-3 rounded-2xl border transition-colors ${
                        isEven
                          ? 'bg-stone-50/90 dark:bg-[#1e1715] border-stone-200/80 dark:border-stone-800/70'
                          : 'bg-white dark:bg-[#251e1c] border-stone-200/80 dark:border-stone-700/80'
                      }`}
                    >
                      <div>
                        <span className="text-stone-400 dark:text-stone-500 block text-[10px] uppercase font-bold">Waktu</span>
                        <span className="font-bold text-stone-800 dark:text-stone-200">
                          {dt.date}
                        </span>
                        <span className="block text-stone-500 dark:text-stone-400 text-[10px]">
                          {dt.time} WIB
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 dark:text-stone-500 block text-[10px] uppercase font-bold">Metode</span>
                        <span className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1 mt-0.5">
                          {entry.loginMethod === 'PIN' ? (
                            <>
                              <KeyRound className="w-3 h-3 text-accent" />
                              <span>PIN 4-Digit</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 text-blue-500" />
                              <span>Password</span>
                            </>
                          )}
                        </span>
                      </div>

                      <div className="col-span-2 flex items-center justify-between pt-1.5 border-t border-stone-200/60 dark:border-stone-800/80">
                        <div className="flex items-center gap-1.5 truncate">
                          {getDeviceIcon(entry.device, entry.userAgent)}
                          <span className="truncate text-stone-700 dark:text-stone-300 font-mono text-[11px]">
                            {entry.device || 'Web'} • {entry.ipAddress}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyIp(entry.ipAddress)}
                          className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1 cursor-pointer transition-colors"
                          title="Salin IP"
                        >
                          {copiedIp === entry.ipAddress ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Touch-Friendly Action Buttons (min 44px height) */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedEntryForDetail(entry)}
                        className="flex-1 py-2.5 rounded-xl bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px] shadow-2xs"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>Rincian</span>
                      </button>

                      {isActive && (
                        <button
                          type="button"
                          onClick={() => {
                            setSessionToRevoke(entry);
                            setRevokeReason(`Dikeluarkan oleh manajer (${user?.name || 'Manager'})`);
                          }}
                          className="flex-1 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px] shadow-2xs"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Keluarkan Sesi</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 5. Pagination Footer - RESPONSIVE FOR ALL SCREENS */}
        {totalRecords > 0 && (
          <div className="p-3.5 sm:p-5 border-t border-stone-100 dark:border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-50/50 dark:bg-stone-900/30">
            {/* Status Information */}
            <div className="text-xs text-stone-500 dark:text-stone-400 text-center sm:text-left">
              Menampilkan{' '}
              <span className="font-bold text-stone-800 dark:text-stone-200">
                {Math.min((page - 1) * limit + 1, totalRecords)}
              </span>{' '}
              -{' '}
              <span className="font-bold text-stone-800 dark:text-stone-200">
                {Math.min(page * limit, totalRecords)}
              </span>{' '}
              dari{' '}
              <span className="font-bold text-stone-800 dark:text-stone-200">{totalRecords}</span> entri
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
              {/* First Page */}
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl border border-stone-200 dark:border-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                title="Halaman Pertama"
                aria-label="Halaman Pertama"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              {/* Previous Page */}
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl border border-stone-200 dark:border-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                title="Halaman Sebelumnya"
                aria-label="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page Number Chips */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => {
                  return p === 1 || p === totalPages || Math.abs(p - page) <= 1;
                })
                .map((p, idx, arr) => {
                  const showEllipsisBefore = idx > 0 && p - arr[idx - 1] > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsisBefore && (
                        <span className="px-1 text-xs text-stone-400 select-none">...</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPage(p)}
                        className={`w-9 h-9 sm:w-8 sm:h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          page === p
                            ? 'bg-accent text-white shadow-2xs'
                            : 'border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}

              {/* Next Page */}
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl border border-stone-200 dark:border-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                title="Halaman Selanjutnya"
                aria-label="Halaman Selanjutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Last Page */}
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl border border-stone-200 dark:border-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                title="Halaman Terakhir"
                aria-label="Halaman Terakhir"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Session Detail Modal (Responsive with max-h and scroll) */}
      {selectedEntryForDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
          }}
        >
          <div className="w-full max-w-lg bg-white dark:bg-[#251e1c] rounded-3xl p-5 sm:p-6 shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-950 text-accent flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-heading text-stone-900 dark:text-stone-100">
                    Rincian Sesi Login
                  </h3>
                  <p className="text-xs text-stone-500 truncate max-w-[240px] sm:max-w-xs">
                    ID Sesi: <span className="font-mono">{selectedEntryForDetail.sessionId}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntryForDetail(null)}
                className="w-8 h-8 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center cursor-pointer"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs bg-stone-50 dark:bg-stone-900/60 p-3.5 sm:p-4 rounded-2xl border border-stone-200/60 dark:border-stone-800">
              <div className="flex justify-between py-1 border-b border-stone-200/40 dark:border-stone-800/40">
                <span className="text-stone-400 font-medium">Pengguna:</span>
                <span className="font-bold text-stone-800 dark:text-stone-200">
                  {selectedEntryForDetail.name} ({selectedEntryForDetail.role})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-200/40 dark:border-stone-800/40">
                <span className="text-stone-400 font-medium">Email Akun:</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  {selectedEntryForDetail.email}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-200/40 dark:border-stone-800/40">
                <span className="text-stone-400 font-medium">Waktu Login:</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  {new Date(selectedEntryForDetail.timestamp).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-200/40 dark:border-stone-800/40">
                <span className="text-stone-400 font-medium">Metode:</span>
                <span className="font-bold text-stone-800 dark:text-stone-200">
                  {selectedEntryForDetail.loginMethod === 'PIN' ? 'PIN Kasir 4-Digit' : 'Email & Password'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-200/40 dark:border-stone-800/40">
                <span className="text-stone-400 font-medium">IP Address:</span>
                <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                  {selectedEntryForDetail.ipAddress}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-200/40 dark:border-stone-800/40">
                <span className="text-stone-400 font-medium">Perangkat:</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  {selectedEntryForDetail.device || 'Perangkat Web'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-200/40 dark:border-stone-800/40">
                <span className="text-stone-400 font-medium">Status Sesi:</span>
                <span className="font-bold text-stone-800 dark:text-stone-200">
                  {selectedEntryForDetail.status === 'ACTIVE'
                    ? 'Sesi Aktif'
                    : selectedEntryForDetail.status === 'TIMED_OUT'
                    ? 'Otomatis Timeout (15 Menit Tidak Aktif di Redis)'
                    : selectedEntryForDetail.status === 'REVOKED'
                    ? 'Sesi Dicabut'
                    : 'Logout Selesai'}
                </span>
              </div>
              {selectedEntryForDetail.revokedAt && (
                <div className="flex justify-between py-1 border-b border-stone-200/40 dark:border-stone-800/40 text-rose-600 dark:text-rose-400">
                  <span className="font-medium">Waktu Dicabut:</span>
                  <span className="font-semibold">
                    {new Date(selectedEntryForDetail.revokedAt).toLocaleString('id-ID')}
                  </span>
                </div>
              )}
              {selectedEntryForDetail.revokeReason && (
                <div className="flex flex-col gap-1 py-1 text-rose-600 dark:text-rose-400">
                  <span className="font-medium">Alasan Pencabutan:</span>
                  <span className="italic">{selectedEntryForDetail.revokeReason}</span>
                </div>
              )}
              {selectedEntryForDetail.userAgent && (
                <div className="flex flex-col gap-1 pt-1">
                  <span className="text-stone-400 font-medium">User Agent Lengkap:</span>
                  <span className="font-mono text-[10px] break-all text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-850 p-2 rounded-xl">
                    {selectedEntryForDetail.userAgent}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedEntryForDetail(null)}
                className="px-4 py-2.5 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Revoke Session Confirmation Modal */}
      {sessionToRevoke && (
        <ConfirmationModal
          isOpen={Boolean(sessionToRevoke)}
          title="Keluarkan Sesi Perangkat Pengguna?"
          message={`Anda akan mencabut sesi aktif milik ${sessionToRevoke.name} (${sessionToRevoke.email}) pada perangkat ${sessionToRevoke.device || sessionToRevoke.ipAddress}. Perangkat tersebut akan langsung logout seketika.`}
          confirmText={isRevoking ? 'Mencabut...' : 'Keluarkan Sesi'}
          cancelText="Batal"
          isDanger={true}
          onConfirm={handleConfirmRevoke}
          onCancel={() => setSessionToRevoke(null)}
        />
      )}
    </div>
  );
};
