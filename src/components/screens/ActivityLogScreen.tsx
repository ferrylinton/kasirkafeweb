import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-date-picker';
import 'react-date-picker/dist/DatePicker.css';
import 'react-calendar/dist/Calendar.css';

import {
  ClipboardList,
  Search,
  Filter,
  RotateCcw,
  RefreshCw,
  Download,
  Calendar as CalendarIcon,
  User as UserIcon,
  PlusCircle,
  Edit3,
  Trash2,
  Clock,
  Boxes,
  Layers,
  Tag,
  Users,
  Receipt,
  Mail,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Info,
  X,
  Copy,
  Check,
  Database,
  Laptop,
  Smartphone,
  Tablet as TabletIcon
} from 'lucide-react';
import { ActivityLogEntry, ActivityLogStats, ActivityAction, ActivityEntity, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { RadixSelect, RadixSelectOption } from '../common/RadixSelect';

interface SelectableUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

type ValuePiece = Date | null;
type DatePickerValue = ValuePiece | [ValuePiece, ValuePiece];

export const ActivityLogScreen: React.FC = () => {
  const { user, token } = useAuth();
  const { language } = useLanguage();
  const { showToast } = useToast();

  const isManager = user?.role === 'MANAGER';

  // Data states
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [usersList, setUsersList] = useState<SelectableUser[]>([]);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  // Pagination states
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Summary stats
  const [stats, setStats] = useState<ActivityLogStats>({
    totalLogs: 0,
    createCount: 0,
    updateCount: 0,
    deleteCount: 0,
    todayCount: 0,
    entityBreakdown: {}
  });

  // Filter states (matching Login History)
  const [keyword, setKeyword] = useState<string>('');
  const [debouncedKeyword, setDebouncedKeyword] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [dateFilterType, setDateFilterType] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'CUSTOM'>('ALL');
  const [dateValue, setDateValue] = useState<ValuePiece>(null);
  const [customDate, setCustomDate] = useState<string>('');
  const [calendarPortal, setCalendarPortal] = useState<HTMLDivElement | null>(null);

  // Modal states
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<ActivityLogEntry | null>(null);
  const [isCopiedJson, setIsCopiedJson] = useState<boolean>(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  // Debounce search keyword
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [keyword]);

  // Fetch selectable users for user filter dropdown
  useEffect(() => {
    if (!isManager) return;
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/auth/selectable-users');
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          setUsersList(data.users);
        } else {
          // Fallback to /api/users
          const resFallback = await fetch('/api/users', {
            headers: { Authorization: `Bearer ${token || ''}` }
          });
          const dataFallback = await resFallback.json();
          if (dataFallback.success && Array.isArray(dataFallback.users)) {
            setUsersList(dataFallback.users);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat daftar pengguna:', err);
      }
    };
    fetchUsers();
  }, [isManager, token]);

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

  // Fetch activity logs data with pagination & filters
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      if (debouncedKeyword.trim()) {
        params.set('search', debouncedKeyword.trim());
      }
      if (selectedUser && selectedUser !== 'ALL') {
        params.set('userId', selectedUser);
      }
      if (selectedAction && selectedAction !== 'ALL') {
        params.set('action', selectedAction);
      }
      if (selectedEntity && selectedEntity !== 'ALL') {
        params.set('entity', selectedEntity);
      }
      if (computedDateQuery) {
        params.set('date', computedDateQuery);
      }

      const res = await fetch(`/api/activity-logs?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        }
      });

      if (res.status === 403) {
        showToast('Akses ditolak: Hanya Manajer yang dapat melihat log audit database', 'error');
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        if (data.pagination) {
          setTotalRecords(data.pagination.total);
          setTotalPages(data.pagination.totalPages);
        }
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        showToast(data.message || 'Gagal memuat log aktivitas', 'error');
      }
    } catch (err) {
      console.error('Fetch logs error:', err);
      showToast('Gagal terhubung ke server untuk memuat log aktivitas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, limit, debouncedKeyword, selectedUser, selectedAction, selectedEntity, computedDateQuery, token]);

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
    setSelectedAction('ALL');
    setSelectedEntity('ALL');
    setDateFilterType('ALL');
    setDateValue(null);
    setCustomDate('');
    setPage(1);
  };

  const isFilterActive = Boolean(
    keyword ||
    selectedUser !== 'ALL' ||
    selectedAction !== 'ALL' ||
    selectedEntity !== 'ALL' ||
    dateFilterType !== 'ALL' ||
    customDate
  );

  const activeFiltersCount = [
    Boolean(keyword),
    selectedUser !== 'ALL',
    selectedAction !== 'ALL',
    selectedEntity !== 'ALL',
    dateFilterType !== 'ALL' || Boolean(customDate)
  ].filter(Boolean).length;

  // Radix UI Select options for User (matching Login History)
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
        value: u.email || u.id,
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

  // Radix UI Select options for Action (matching Login History styling)
  const actionSelectOptions: RadixSelectOption[] = useMemo(
    () => [
      {
        value: 'ALL',
        label: 'Semua Tipe Aksi',
        sublabel: 'Tambah, Ubah, dan Hapus Data',
        icon: <Filter className="w-3.5 h-3.5 text-stone-400" />
      },
      {
        value: 'CREATE',
        label: 'Tambah Data (CREATE)',
        sublabel: 'Penambahan data baru ke sistem',
        badge: 'TAMBAH',
        badgeColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
        icon: <PlusCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
      },
      {
        value: 'UPDATE',
        label: 'Ubah Data (UPDATE)',
        sublabel: 'Modifikasi data atau penyesuaian stok',
        badge: 'UBAH',
        badgeColor: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300',
        icon: <Edit3 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
      },
      {
        value: 'DELETE',
        label: 'Hapus Data (DELETE)',
        sublabel: 'Penghapusan data dari database',
        badge: 'HAPUS',
        badgeColor: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
        icon: <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
      }
    ],
    []
  );

  // Radix UI Select options for Database Entity
  const entitySelectOptions: RadixSelectOption[] = useMemo(
    () => [
      {
        value: 'ALL',
        label: 'Semua Entitas Database',
        sublabel: 'Seluruh modul data toko',
        icon: <Database className="w-3.5 h-3.5 text-stone-400" />
      },
      {
        value: 'PRODUCT',
        label: 'Produk Katalog',
        sublabel: 'Menu minuman & makanan ringan',
        badge: 'PRODUK',
        badgeColor: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
        icon: <Boxes className="w-3.5 h-3.5 text-amber-500 shrink-0" />
      },
      {
        value: 'INVENTORY',
        label: 'Stok & Inventaris',
        sublabel: 'Penyesuaian stok & restok barang',
        badge: 'STOK',
        badgeColor: 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300',
        icon: <Layers className="w-3.5 h-3.5 text-orange-500 shrink-0" />
      },
      {
        value: 'DISCOUNT_RULE',
        label: 'Aturan Diskon & Promo',
        sublabel: 'Promosi kupon & diskon toko',
        badge: 'DISKON',
        badgeColor: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300',
        icon: <Tag className="w-3.5 h-3.5 text-purple-500 shrink-0" />
      },
      {
        value: 'USER',
        label: 'Akun Pengguna',
        sublabel: 'Akun kasir & akun manajer',
        badge: 'PENGGUNA',
        badgeColor: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
        icon: <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
      },
      {
        value: 'ORDER',
        label: 'Transaksi & Pesanan',
        sublabel: 'Struk penjualan kasir POS',
        badge: 'PESANAN',
        badgeColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
        icon: <Receipt className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
      },
      {
        value: 'EMAIL_TEMPLATE',
        label: 'Template Email',
        sublabel: 'Format email struk & keamanan',
        badge: 'TEMPLATE',
        badgeColor: 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300',
        icon: <Mail className="w-3.5 h-3.5 text-teal-500 shrink-0" />
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

  // Export CSV Handler
  const handleExportCsv = () => {
    if (logs.length === 0) {
      showToast('Tidak ada data log untuk diekspor', 'warning');
      return;
    }

    const headers = ['ID', 'Waktu', 'Aksi', 'Entitas', 'Target Entitas', 'Deskripsi Aktivitas', 'Staf Pelaksana', 'Role', 'Email', 'Alamat IP'];
    const rows = logs.map(l => [
      l.id,
      new Date(l.createdAt).toLocaleString('id-ID'),
      l.action,
      l.entity,
      l.entityName ? `"${l.entityName.replace(/"/g, '""')}"` : '',
      `"${(l.summary || '').replace(/"/g, '""')}"`,
      `"${(l.performedBy?.name || '').replace(/"/g, '""')}"`,
      l.performedBy?.role || '',
      l.performedBy?.email || '',
      l.ipAddress || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `log-aktivitas-db-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Log aktivitas berhasil diekspor ke CSV!', 'success');
  };

  // Copy IP Helper
  const handleCopyIp = (ip: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard?.writeText(ip);
    setCopiedIp(ip);
    showToast(`IP ${ip} berhasil disalin`, 'info');
    setTimeout(() => setCopiedIp(null), 2000);
  };

  // Device Icon helper (matching Login History)
  const getDeviceIcon = (userAgent?: string) => {
    const text = (userAgent || '').toLowerCase();
    if (text.includes('ipad') || text.includes('tablet')) {
      return <TabletIcon className="w-4 h-4 text-purple-500 shrink-0" />;
    }
    if (text.includes('mobile') || text.includes('iphone') || text.includes('android')) {
      return <Smartphone className="w-4 h-4 text-sky-500 shrink-0" />;
    }
    return <Laptop className="w-4 h-4 text-emerald-500 shrink-0" />;
  };

  // Format date helper (WIB) - matching Login History
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

  // Clear Older Logs
  const handleClearOldLogs = async () => {
    setIsClearing(true);
    try {
      const res = await fetch('/api/activity-logs/clear', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({ days: 30 })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Log aktivitas lama berhasil dibersihkan', 'success');
        setIsClearModalOpen(false);
        fetchLogs();
      } else {
        showToast(data.message || 'Gagal membersihkan log', 'error');
      }
    } catch (err) {
      showToast('Gagal menghubungi server', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  // Badges helper functions
  const getActionBadge = (action: ActivityAction) => {
    switch (action) {
      case 'CREATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/70 shadow-2xs">
            <PlusCircle className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>TAMBAH</span>
          </span>
        );
      case 'UPDATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800/70 shadow-2xs">
            <Edit3 className="w-3 h-3 text-sky-500 shrink-0" />
            <span>UBAH</span>
          </span>
        );
      case 'DELETE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/70 shadow-2xs">
            <Trash2 className="w-3 h-3 text-rose-500 shrink-0" />
            <span>HAPUS</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700">
            {action}
          </span>
        );
    }
  };

  const getEntityBadge = (entity: ActivityEntity) => {
    switch (entity) {
      case 'PRODUCT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/70 dark:border-amber-800/60">
            <Boxes className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Produk</span>
          </span>
        );
      case 'INVENTORY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-orange-100 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 border border-orange-300/70 dark:border-orange-800/60">
            <Layers className="w-3 h-3 text-orange-600 dark:text-orange-400 shrink-0" />
            <span>Stok</span>
          </span>
        );
      case 'DISCOUNT_RULE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300/70 dark:border-purple-800/60">
            <Tag className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>Diskon</span>
          </span>
        );
      case 'USER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300/70 dark:border-blue-800/60">
            <Users className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>Pengguna</span>
          </span>
        );
      case 'ORDER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/70 dark:border-emerald-800/60">
            <Receipt className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Pesanan</span>
          </span>
        );
      case 'EMAIL_TEMPLATE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-300/70 dark:border-teal-800/60">
            <Mail className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>Template</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
            {entity}
          </span>
        );
    }
  };

  return (
    <div id="activity-log-screen" className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-7xl mx-auto space-y-5 sm:space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Section - Matching Login History */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#251e1c] p-4 sm:p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shrink-0 shadow-xs">
              <Database className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black font-heading tracking-tight text-stone-900 dark:text-stone-100">
                  Log Aktivitas Database
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60">
                  Audit Trail
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                Audit jejak transparan saat pengguna menambahkan, memodifikasi, atau menghapus data produk, stok, user, diskon, dan transaksi
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Responsive across mobile & desktop */}
        <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto flex-wrap">
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="flex-1 sm:flex-initial justify-center px-3.5 py-2.5 sm:py-2 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-60 cursor-pointer min-h-[44px] sm:min-h-0"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex-1 sm:flex-initial justify-center px-3.5 py-2.5 sm:py-2 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer min-h-[44px] sm:min-h-0"
            title="Ekspor CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>

          {isManager && (
            <button
              type="button"
              onClick={() => setIsClearModalOpen(true)}
              className="flex-1 sm:flex-initial justify-center px-4 py-2.5 sm:py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs font-bold flex items-center gap-2 transition-all shadow-xs active:scale-95 cursor-pointer min-h-[44px] sm:min-h-0"
              title="Bersihkan Log Lama (>30 hari)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Bersihkan &gt; 30 Hari</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Summary KPI Metric Cards (Responsive Grid: 2 cols on mobile, 4 cols on desktop - matching Login History) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Aktivitas */}
        <div className="bg-white dark:bg-[#251e1c] p-3.5 sm:p-5 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Database className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold text-stone-500 dark:text-stone-400 block truncate">
              Total Log Aktivitas
            </span>
            <span className="text-base sm:text-xl font-black font-heading text-stone-900 dark:text-stone-100">
              {stats.totalLogs.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Data Ditambah (CREATE) */}
        <div className="bg-white dark:bg-[#251e1c] p-3.5 sm:p-5 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold text-stone-500 dark:text-stone-400 block truncate">
              Data Ditambah (CREATE)
            </span>
            <span className="text-base sm:text-xl font-black font-heading text-emerald-600 dark:text-emerald-400">
              {stats.createCount.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Data Diubah (UPDATE) */}
        <div className="bg-white dark:bg-[#251e1c] p-3.5 sm:p-5 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold text-stone-500 dark:text-stone-400 block truncate">
              Data Diubah (UPDATE)
            </span>
            <span className="text-base sm:text-xl font-black font-heading text-sky-600 dark:text-sky-400">
              {stats.updateCount.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Data Dihapus (DELETE) */}
        <div className="bg-white dark:bg-[#251e1c] p-3.5 sm:p-5 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold text-stone-500 dark:text-stone-400 block truncate">
              Data Dihapus (DELETE)
            </span>
            <span className="text-base sm:text-xl font-black font-heading text-rose-600 dark:text-rose-400">
              {stats.deleteCount.toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Filter Control Bar - IDENTICAL TO LOGIN HISTORY */}
      <div className="bg-white dark:bg-[#251e1c] p-4 sm:p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-4 sm:space-y-5">
        {/* Header & Reset Button */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-stone-100 dark:border-stone-800/80 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shrink-0">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                Filter & Pencarian Log Aktivitas
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400">
                Saring data log aktivitas database berdasarkan kata kunci, staf, tipe aksi, entitas, atau tanggal
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
              placeholder="Cari berdasarkan ringkasan perubahan, nama target entitas, staf, email, atau alamat IP..."
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

        {/* Komponen 2: Dropdown Pengguna, Tipe Aksi, & Entitas Database (Grid 3 Kolom yang Lega) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
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

          {/* Dropdown Tipe Aksi */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-stone-400" />
              <span>Filter Tipe Aksi Database</span>
            </label>
            <RadixSelect
              id="action-select-filter"
              ariaLabel="Filter Tipe Aksi"
              value={selectedAction}
              onValueChange={val => {
                setSelectedAction(val);
                setPage(1);
              }}
              options={actionSelectOptions}
              placeholder="Pilih Tipe Aksi..."
            />
          </div>

          {/* Dropdown Entitas Database */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-stone-400" />
              <span>Filter Entitas Database</span>
            </label>
            <RadixSelect
              id="entity-select-filter"
              ariaLabel="Filter Entitas Database"
              value={selectedEntity}
              onValueChange={val => {
                setSelectedEntity(val);
                setPage(1);
              }}
              options={entitySelectOptions}
              placeholder="Pilih Entitas Database..."
            />
          </div>
        </div>

        {/* Komponen 3: Filter Tanggal Aktivitas (Dedicated Date Range & react-date-picker Card) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-50/80 dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-accent" />
              <span className="text-xs sm:text-sm font-bold text-stone-800 dark:text-stone-200">
                Filter Tanggal Aktivitas
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
                  ? 'Menampilkan semua aktivitas tanpa filter tanggal.'
                  : dateFilterType === 'TODAY'
                  ? 'Menampilkan aktivitas hari ini.'
                  : dateFilterType === 'YESTERDAY'
                  ? 'Menampilkan aktivitas kemarin.'
                  : dateValue instanceof Date
                  ? `Menampilkan aktivitas tanggal ${dateValue.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
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
                <span>Staf: {usersList.find(u => u.email === selectedUser || u.id === selectedUser)?.name || selectedUser}</span>
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
            {selectedAction !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
                <span>
                  Aksi:{' '}
                  {selectedAction === 'CREATE'
                    ? 'Tambah Data (CREATE)'
                    : selectedAction === 'UPDATE'
                    ? 'Ubah Data (UPDATE)'
                    : 'Hapus Data (DELETE)'}
                </span>
                <button
                  type="button"
                  onClick={() => { setSelectedAction('ALL'); setPage(1); }}
                  className="hover:text-rose-500 cursor-pointer ml-0.5"
                  title="Hapus filter aksi"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedEntity !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300">
                <span>
                  Entitas:{' '}
                  {selectedEntity === 'PRODUCT'
                    ? 'Produk'
                    : selectedEntity === 'INVENTORY'
                    ? 'Stok/Inventaris'
                    : selectedEntity === 'DISCOUNT_RULE'
                    ? 'Aturan Diskon'
                    : selectedEntity === 'USER'
                    ? 'Pengguna'
                    : selectedEntity === 'ORDER'
                    ? 'Pesanan'
                    : selectedEntity === 'EMAIL_TEMPLATE'
                    ? 'Template Email'
                    : selectedEntity}
                </span>
                <button
                  type="button"
                  onClick={() => { setSelectedEntity('ALL'); setPage(1); }}
                  className="hover:text-rose-500 cursor-pointer ml-0.5"
                  title="Hapus filter entitas"
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
          </div>
        )}
      </div>

      {/* 4. Main Activity Logs Container - EXACT LAYOUT AND STRUCTURE AS LOGIN HISTORY */}
      <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs overflow-hidden">
        {/* Table Top Controls: Count & Rows Per Page using Radix Select */}
        <div className="p-3.5 sm:p-5 border-b border-stone-100 dark:border-stone-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-stone-50/50 dark:bg-stone-900/30">
          <div className="text-xs text-stone-600 dark:text-stone-400">
            Ditemukan <span className="font-black text-stone-900 dark:text-stone-100">{totalRecords}</span> entri log aktivitas
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
            <span className="text-xs font-bold text-stone-500">Memuat log aktivitas database...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 sm:p-14 text-center max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-850 text-stone-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-stone-800 dark:text-stone-200">
              Tidak Ada Log Aktivitas
            </h4>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {isFilterActive
                ? 'Tidak ada log aktivitas database yang cocok dengan kriteria filter pencarian Anda. Silakan coba sesuaikan kata kunci atau filter lainnya.'
                : 'Belum ada data aktivitas database tercatat pada sistem.'}
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
            {/* VIEW A: Desktop Table View (lg: screens >= 1024px) - IDENTICAL HEADER AND COLUMN STYLING */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200/80 dark:border-stone-800 bg-stone-100/80 dark:bg-stone-900/80 text-[11px] font-extrabold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                    <th className="py-3.5 px-4">{language === 'en' ? 'User' : 'Pengguna'}</th>
                    <th className="py-3.5 px-4">{language === 'en' ? 'Timestamp' : 'Waktu Aktivitas'}</th>
                    <th className="py-3.5 px-4 text-center">{language === 'en' ? 'Action' : 'Tipe Aksi'}</th>
                    <th className="py-3.5 px-4">{language === 'en' ? 'Entity' : 'Entitas'}</th>
                    <th className="py-3.5 px-4 min-w-[260px]">{language === 'en' ? 'Summary & Target' : 'Deskripsi & Target'}</th>
                    <th className="py-3.5 px-4">{language === 'en' ? 'Device & IP' : 'Perangkat & IP'}</th>
                    <th className="py-3.5 px-4 text-right">{language === 'en' ? 'Actions' : 'Aksi'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/70 dark:divide-stone-800/80 text-xs">
                  {logs.map((entry, idx) => {
                    const dt = formatDateTime(entry.createdAt);
                    const isEven = idx % 2 === 0;

                    return (
                      <tr
                        key={entry.id || idx}
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
                              {entry.performedBy?.name?.[0] || 'U'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-stone-900 dark:text-stone-100 truncate">
                                  {entry.performedBy?.name || 'Sistem POS'}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                                    entry.performedBy?.role === 'MANAGER'
                                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300/70 dark:border-amber-800/60'
                                      : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                                  }`}
                                >
                                  {entry.performedBy?.role === 'MANAGER' ? 'Manager' : 'Kasir'}
                                </span>
                              </div>
                              <span className="text-[11px] text-stone-500 dark:text-stone-400 block truncate">
                                {entry.performedBy?.email || '-'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Waktu Aktivitas */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-stone-800 dark:text-stone-200">
                            {dt.date}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400">
                            {dt.time} WIB
                          </div>
                        </td>

                        {/* 3. Tipe Aksi */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {getActionBadge(entry.action)}
                        </td>

                        {/* 4. Entitas */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getEntityBadge(entry.entity)}
                        </td>

                        {/* 5. Deskripsi & Target */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-stone-900 dark:text-stone-100 leading-snug">
                              {entry.summary}
                            </p>
                            {entry.entityName && (
                              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                                Target: <span className="font-medium text-stone-700 dark:text-stone-300">{entry.entityName}</span>
                              </p>
                            )}
                          </div>
                        </td>

                        {/* 6. Perangkat & IP */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            {getDeviceIcon(entry.userAgent)}
                            <span className="font-semibold text-stone-800 dark:text-stone-200 truncate max-w-[160px]">
                              {entry.userAgent ? 'Perangkat Web' : 'Sistem Server'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[11px] text-stone-600 dark:text-stone-400">
                              {entry.ipAddress || '127.0.0.1'}
                            </span>
                            {entry.ipAddress && (
                              <button
                                type="button"
                                onClick={e => handleCopyIp(entry.ipAddress!, e)}
                                className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer p-0.5 rounded transition-colors"
                                title="Salin IP"
                              >
                                {copiedIp === entry.ipAddress ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 7. Aksi */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedLogForDetail(entry)}
                            className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-stone-700 dark:text-stone-200 bg-white/80 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Lihat Detail Log"
                          >
                            <Info className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VIEW B: Tablet Grid View (sm: to lg: screens 640px - 1023px) - IDENTICAL TO LOGIN HISTORY */}
            <div className="hidden sm:grid lg:hidden sm:grid-cols-2 gap-4 p-4 bg-stone-50/50 dark:bg-stone-950/20">
              {logs.map((entry, idx) => {
                const dt = formatDateTime(entry.createdAt);
                const isEven = idx % 2 === 0;

                return (
                  <div
                    key={entry.id || idx}
                    className={`p-4 rounded-2xl border space-y-3.5 hover:border-stone-400 dark:hover:border-stone-600 transition-all flex flex-col justify-between shadow-2xs ${
                      isEven
                        ? 'bg-white dark:bg-[#251e1c] border-stone-200/90 dark:border-stone-800'
                        : 'bg-stone-100/70 dark:bg-[#1a1413] border-stone-300/80 dark:border-stone-800/90'
                    }`}
                  >
                    {/* Header: User & Action */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-stone-200 dark:bg-stone-800 shrink-0 border border-stone-300 dark:border-stone-700 flex items-center justify-center font-bold text-xs text-stone-700 dark:text-stone-300">
                          {entry.performedBy?.name?.[0] || 'U'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-stone-900 dark:text-stone-100 truncate">
                              {entry.performedBy?.name || 'Sistem POS'}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                                entry.performedBy?.role === 'MANAGER'
                                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300/70 dark:border-amber-800/60'
                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                              }`}
                            >
                              {entry.performedBy?.role === 'MANAGER' ? 'Manager' : 'Kasir'}
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-500 dark:text-stone-400 block truncate">
                            {entry.performedBy?.email || '-'}
                          </span>
                        </div>
                      </div>

                      {/* Action & Entity Badges */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {getActionBadge(entry.action)}
                        {getEntityBadge(entry.entity)}
                      </div>
                    </div>

                    {/* Content Details Grid */}
                    <div
                      className={`grid grid-cols-2 gap-2 text-xs p-3 rounded-xl border transition-colors ${
                        isEven
                          ? 'bg-stone-50/90 dark:bg-[#1e1715] border-stone-200/80 dark:border-stone-800/70'
                          : 'bg-white dark:bg-[#251e1c] border-stone-200/80 dark:border-stone-700/80'
                      }`}
                    >
                      <div className="col-span-2">
                        <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase font-bold block">Deskripsi Aktivitas</span>
                        <p className="font-semibold text-stone-800 dark:text-stone-200 text-xs mt-0.5">
                          {entry.summary}
                        </p>
                        {entry.entityName && (
                          <span className="text-[11px] text-stone-500 dark:text-stone-400 block mt-0.5">
                            Target: <span className="font-medium text-stone-700 dark:text-stone-300">{entry.entityName}</span>
                          </span>
                        )}
                      </div>

                      <div className="pt-1.5 border-t border-stone-200/60 dark:border-stone-800/80">
                        <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase font-bold block">Waktu</span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200 text-[11px]">
                          {dt.date}
                        </span>
                        <span className="block text-[10px] text-stone-500 dark:text-stone-400">
                          {dt.time} WIB
                        </span>
                      </div>

                      <div className="pt-1.5 border-t border-stone-200/60 dark:border-stone-800/80 flex items-center justify-between">
                        <div className="min-w-0">
                          <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase font-bold block">Alamat IP</span>
                          <span className="truncate text-stone-700 dark:text-stone-300 font-mono text-[11px] block">
                            {entry.ipAddress || '127.0.0.1'}
                          </span>
                        </div>
                        {entry.ipAddress && (
                          <button
                            type="button"
                            onClick={e => handleCopyIp(entry.ipAddress!, e)}
                            className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1 cursor-pointer transition-colors"
                            title="Salin IP"
                          >
                            {copiedIp === entry.ipAddress ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tablet Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedLogForDetail(entry)}
                        className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 text-xs font-bold hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>Detail Log</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* VIEW C: Mobile Card List View (sm:hidden screens < 640px) - IDENTICAL TO LOGIN HISTORY */}
            <div className="sm:hidden divide-y divide-stone-200/80 dark:divide-stone-800">
              {logs.map((entry, idx) => {
                const dt = formatDateTime(entry.createdAt);
                const isEven = idx % 2 === 0;

                return (
                  <div
                    key={entry.id || idx}
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
                          {entry.performedBy?.name?.[0] || 'U'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-stone-900 dark:text-stone-100 truncate">
                              {entry.performedBy?.name || 'Sistem POS'}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                                entry.performedBy?.role === 'MANAGER'
                                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300/70 dark:border-amber-800/60'
                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                              }`}
                            >
                              {entry.performedBy?.role === 'MANAGER' ? 'Manager' : 'Kasir'}
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-500 dark:text-stone-400 block truncate">
                            {entry.performedBy?.email || '-'}
                          </span>
                        </div>
                      </div>

                      {/* Action badge */}
                      <div className="shrink-0">{getActionBadge(entry.action)}</div>
                    </div>

                    {/* Content Details */}
                    <div
                      className={`p-3 rounded-xl border space-y-2 text-xs transition-colors ${
                        isEven
                          ? 'bg-stone-50/90 dark:bg-[#1e1715] border-stone-200/80 dark:border-stone-800/70'
                          : 'bg-white dark:bg-[#251e1c] border-stone-200/80 dark:border-stone-700/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase text-stone-400">Entitas:</span>
                        <div>{getEntityBadge(entry.entity)}</div>
                      </div>

                      <div>
                        <span className="text-[10px] text-stone-400 block uppercase font-bold">Deskripsi</span>
                        <p className="font-semibold text-stone-800 dark:text-stone-200 text-xs mt-0.5">
                          {entry.summary}
                        </p>
                        {entry.entityName && (
                          <span className="text-[10px] text-stone-500 dark:text-stone-400 block mt-0.5">
                            Target: {entry.entityName}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-200/60 dark:border-stone-800/80">
                        <div>
                          <span className="text-stone-400 block text-[10px] uppercase font-bold">Waktu</span>
                          <span className="font-bold text-stone-800 dark:text-stone-200">
                            {dt.date}
                          </span>
                          <span className="block text-stone-500 dark:text-stone-400 text-[10px]">
                            {dt.time} WIB
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <span className="text-stone-400 block text-[10px] uppercase font-bold">IP Address</span>
                            <span className="font-mono text-stone-800 dark:text-stone-200 text-[11px] truncate block">
                              {entry.ipAddress || '127.0.0.1'}
                            </span>
                          </div>
                          {entry.ipAddress && (
                            <button
                              type="button"
                              onClick={e => handleCopyIp(entry.ipAddress!, e)}
                              className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1 cursor-pointer transition-colors"
                              title="Salin IP"
                            >
                              {copiedIp === entry.ipAddress ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Touch-Friendly Action Button (min 44px height - matching Login History) */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedLogForDetail(entry)}
                        className="w-full py-2.5 rounded-xl bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px] shadow-2xs"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>Rincian Log Aktivitas</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 5. Pagination Footer - IDENTICAL TO LOGIN HISTORY */}
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

      {/* 6. Log Detail Modal */}
      {selectedLogForDetail && (
        <div
          id="log-detail-modal-backdrop"
          onClick={() => setSelectedLogForDetail(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                      Rincian Log Audit
                    </h3>
                    {getActionBadge(selectedLogForDetail.action)}
                  </div>
                  <p className="text-xs text-stone-400">
                    ID: {selectedLogForDetail.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLogForDetail(null)}
                className="w-8 h-8 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Summary Callout */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200/80 dark:border-stone-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                  Deskripsi Operasi
                </div>
                <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  {selectedLogForDetail.summary}
                </p>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/70 dark:border-stone-800">
                  <span className="text-[10px] text-stone-400 block mb-0.5">Entitas Target</span>
                  <div className="mt-0.5">{getEntityBadge(selectedLogForDetail.entity)}</div>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/70 dark:border-stone-800">
                  <span className="text-[10px] text-stone-400 block mb-0.5">Waktu Eksekusi</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    {new Date(selectedLogForDetail.createdAt).toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/70 dark:border-stone-800">
                  <span className="text-[10px] text-stone-400 block mb-0.5">Alamat IP Klien</span>
                  <span className="font-mono text-stone-800 dark:text-stone-200">
                    {selectedLogForDetail.ipAddress || '127.0.0.1'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/70 dark:border-stone-800 col-span-2 sm:col-span-3">
                  <span className="text-[10px] text-stone-400 block mb-0.5">Staf Pelaksana (Performed By)</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-bold text-stone-900 dark:text-stone-100">
                      {selectedLogForDetail.performedBy?.name || 'Sistem POS'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-accent/10 text-accent">
                      {selectedLogForDetail.performedBy?.role || 'SYSTEM'}
                    </span>
                    {selectedLogForDetail.performedBy?.email && (
                      <span className="text-stone-400 text-[11px]">
                        ({selectedLogForDetail.performedBy.email})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* JSON Details Inspector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-accent" />
                    <span>Payload &amp; Detail Perubahan</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedLogForDetail, null, 2));
                      setIsCopiedJson(true);
                      setTimeout(() => setIsCopiedJson(false), 2000);
                      showToast('JSON log disalin ke clipboard!', 'info');
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {isCopiedJson ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Salin JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 rounded-2xl bg-stone-950 text-stone-200 font-mono text-[11px] overflow-x-auto max-h-56 leading-relaxed border border-stone-800">
                  {JSON.stringify(selectedLogForDetail.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-stone-200 dark:border-stone-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLogForDetail(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Clear Old Logs Modal */}
      <ConfirmationModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleClearOldLogs}
        title="Bersihkan Log Aktivitas Lama?"
        message="Aksi ini akan menghapus semua riwayat log aktivitas database yang berusia lebih dari 30 hari untuk menghemat ruang penyimpanan. Catatan baru akan tetap tersimpan."
        confirmText={isClearing ? 'Membersihkan...' : 'Ya, Bersihkan Log'}
        cancelText="Batal"
        type="danger"
      />
    </div>
  );
};
