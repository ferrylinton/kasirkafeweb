import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  BarChart3,
  LineChart as LineChartIcon,
  ShoppingBag,
  Store,
  Calendar,
  CalendarDays,
  CalendarRange,
  RefreshCw,
  CreditCard,
  PieChart as PieChartIcon,
  ChevronRight,
  ArrowUpRight,
  Percent,
  CheckCircle2,
  AlertCircle,
  Download,
  FileSpreadsheet,
  FileCode,
  Clock,
  ShieldCheck,
  Trash2,
  CalendarCheck,
  Sparkles,
  Database,
  Building2,
  Trophy
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';

type PeriodType = 'day' | 'week' | 'month';
type MetricType = 'revenue' | 'orders';
type ChartViewType = 'area' | 'bar' | 'line';

interface ManagerAnalyticsData {
  success: boolean;
  vendor: {
    id: string;
    name: string;
    code: string;
    address: string;
    currency: string;
  };
  retention?: {
    retentionDays: number;
    retentionMonths: number;
    cutoffDate: string;
    lastRunTime: string | null;
    lastDeletedCount: number;
    totalPurgedLifetime: number;
    activeOrdersCount: number;
    vendorOrdersCount: number;
    nextScheduledRun: string | null;
    schedulerStatus: 'ACTIVE' | 'RUNNING';
    intervalHours: number;
  };
  retentionPolicy?: {
    months: number;
    days: number;
    cutoffDate: string;
    description: string;
  };
  summary: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    today: { orders: number; revenue: number };
    thisWeek: { orders: number; revenue: number };
    thisMonth: { orders: number; revenue: number };
  };
  daily: Array<{
    date: string;
    label: string;
    dayName: string;
    totalOrders: number;
    totalRevenue: number;
    averageTicket: number;
    paymentCounts?: Record<string, number>;
  }>;
  weekly: Array<{
    weekKey: string;
    label: string;
    shortLabel: string;
    startDate: string;
    endDate: string;
    totalOrders: number;
    totalRevenue: number;
    averageTicket: number;
  }>;
  monthly: Array<{
    monthKey: string;
    label: string;
    year: number;
    month: number;
    totalOrders: number;
    totalRevenue: number;
    averageTicket: number;
  }>;
  paymentMethods: Array<{
    method: string;
    count: number;
    revenue: number;
    percentage: number;
  }>;
}

export interface ChartDataItem {
  label: string;
  shortLabel?: string;
  dayName?: string;
  date?: string;
  totalOrders: number;
  totalRevenue: number;
  averageTicket: number;
  [key: string]: any;
}

interface ManagerDashboardScreenProps {
  onNavigateTab?: (tab: string) => void;
}

export const ManagerDashboardScreen: React.FC<ManagerDashboardScreenProps> = ({ onNavigateTab }) => {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [period, setPeriod] = useState<PeriodType>('day');
  const [metric, setMetric] = useState<MetricType>('revenue');
  const [chartView, setChartView] = useState<ChartViewType>('area');

  const [data, setData] = useState<ManagerAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);

  // Fetch Manager Vendor Analytics
  const fetchAnalytics = async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      const res = await fetch('/api/manager/analytics/transactions', {
        headers: {
          Authorization: `Bearer ${token || localStorage.getItem('kasirkafe_token') || ''}`
        }
      });

      if (!res.ok) {
        throw new Error(`Gagal memuat data analitik (Status: ${res.status})`);
      }

      const json: ManagerAnalyticsData = await res.json();
      if (!json.success) {
        throw new Error('Format respon server tidak valid');
      }

      setData(json);
      if (showRefreshToast) {
        showToast('Data analitik transaksi vendor berhasil diperbarui', 'success');
      }
    } catch (err: any) {
      console.error('[ManagerDashboard] Fetch error:', err);
      setError(err.message || 'Terjadi kesalahan saat memuat data transaksi');
      showToast(err.message || 'Gagal memuat data transaksi vendor', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [token]);

  // Format currency helper
  const formatIDR = (val: number): string => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Format date helper
  const formatDateID = (dStr: string | null | undefined): string => {
    if (!dStr) return '-';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  };

  // Export handler
  const handleExport = async (format: 'csv' | 'json', targetPeriod: 'day' | 'week' | 'month' | 'all' = 'all') => {
    try {
      setIsExporting(true);
      setExportMenuOpen(false);

      const url = `/api/manager/analytics/transactions/export?format=${format}&period=${targetPeriod}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token || localStorage.getItem('kasirkafe_token') || ''}`
        }
      });

      if (!res.ok) {
        throw new Error(`Gagal mengekspor data (Status: ${res.status})`);
      }

      if (format === 'json') {
        const jsonData = await res.json();
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        const vendorSlug = (data?.vendor?.name || 'vendor').toLowerCase().replace(/[^a-z0-9]/g, '_');
        link.download = `transaksi_${vendorSlug}_3bulan_${targetPeriod}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        const vendorSlug = (data?.vendor?.name || 'vendor').toLowerCase().replace(/[^a-z0-9]/g, '_');
        link.download = `transaksi_${vendorSlug}_3bulan_${targetPeriod}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      }

      showToast(`Berhasil mengekspor data transaksi vendor (.${format.toUpperCase()})`, 'success');
    } catch (err: any) {
      console.error('[ManagerDashboard] Export error:', err);
      showToast(err.message || 'Gagal mengekspor data transaksi', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Export current table view
  const handleExportCurrentTable = (format: 'csv' | 'json') => {
    if (!currentChartData || currentChartData.length === 0) {
      showToast('Tidak ada data tabel untuk diekspor', 'warning');
      return;
    }

    try {
      const vendorSlug = (data?.vendor?.name || 'vendor').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const nowStr = new Date().toISOString().slice(0, 10);

      if (format === 'json') {
        const payload = {
          exportType: `Tabel Rekapitulasi ${period.toUpperCase()}`,
          vendor: data?.vendor,
          exportedAt: new Date().toISOString(),
          period,
          rows: currentChartData
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rekap_${period}_${vendorSlug}_${nowStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        // CSV with UTF-8 BOM
        const headers = ['Label Periode', 'Jumlah Transaksi', 'Total Omzet (Rp)', 'Rata-rata per Transaksi (Rp)'];
        const rows = currentChartData.map((row: any) => [
          `"${(row.label || row.shortLabel || '').replace(/"/g, '""')}"`,
          row.totalOrders,
          row.totalRevenue,
          row.averageTicket
        ]);
        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv; charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rekap_${period}_${vendorSlug}_${nowStr}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }

      showToast(`Tabel ${period.toUpperCase()} berhasil diekspor (.${format.toUpperCase()})`, 'success');
    } catch (e: any) {
      showToast('Gagal mengekspor tabel', 'error');
    }
  };

  // Run Retention Cleanup Scheduler on Demand
  const handleTriggerRetentionRun = async () => {
    if (isPurging) return;
    try {
      setIsPurging(true);
      const res = await fetch('/api/manager/analytics/retention-run', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token || localStorage.getItem('kasirkafe_token') || ''}`,
          'Content-Type': 'application/json'
        }
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menjalankan pembersihan retensi');
      }

      showToast(json.message || 'Pembersihan data retensi 3 bulan berhasil dijalankan!', 'success');
      // Refresh analytics data immediately
      await fetchAnalytics(false);
    } catch (err: any) {
      console.error('[ManagerDashboard] Retention run error:', err);
      showToast(err.message || 'Gagal memicu skeduler retensi', 'error');
    } finally {
      setIsPurging(false);
    }
  };

  // Active chart data based on selected period
  // Ensure every item is a valid object whose properties represent the values of different data dimensions
  const currentChartData: ChartDataItem[] = useMemo(() => {
    if (!data) return [];
    const sourceList =
      period === 'day'
        ? data.daily
        : period === 'week'
        ? data.weekly
        : data.monthly;

    if (!Array.isArray(sourceList)) return [];

    return sourceList
      .filter((item): item is NonNullable<typeof item> => item !== null && typeof item === 'object')
      .map(item => ({
        ...item,
        label: String(item.label || (item as any).shortLabel || ''),
        shortLabel: (item as any).shortLabel ? String((item as any).shortLabel) : undefined,
        dayName: (item as any).dayName ? String((item as any).dayName) : undefined,
        date: (item as any).date ? String((item as any).date) : undefined,
        totalOrders: Number(item.totalOrders) || 0,
        totalRevenue: Number(item.totalRevenue) || 0,
        averageTicket: Number(item.averageTicket) || 0
      }));
  }, [data, period]);

  // Total summary for current chart view
  const periodTotalRevenue = useMemo(() => {
    return currentChartData.reduce((sum: number, item: any) => sum + (item.totalRevenue || 0), 0);
  }, [currentChartData]);

  const periodTotalOrders = useMemo(() => {
    return currentChartData.reduce((sum: number, item: any) => sum + (item.totalOrders || 0), 0);
  }, [currentChartData]);

  const periodAverageTicket = useMemo(() => {
    return periodTotalOrders > 0 ? Math.round(periodTotalRevenue / periodTotalOrders) : 0;
  }, [periodTotalRevenue, periodTotalOrders]);

  // Primary brand accent color for manager charts
  const vendorAccentColor = '#ea580c'; // Warm vibrant orange

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const dataItem = payload[0]?.payload;
    const rev = dataItem?.totalRevenue || 0;
    const ords = dataItem?.totalOrders || 0;
    const avg = ords > 0 ? Math.round(rev / ords) : 0;

    return (
      <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-4xl mx-auto flex flex-col gap-5">
        <div className="font-bold text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800 pb-2 mb-2 flex items-center justify-between">
          <span>{label || dataItem?.label || 'Periode'}</span>
          {dataItem?.dayName && (
            <span className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase">
              {dataItem.dayName}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-stone-500 dark:text-stone-400">Total Omzet:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatIDR(rev)}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-stone-500 dark:text-stone-400">Total Transaksi:</span>
            <span className="font-bold text-stone-900 dark:text-stone-100">{ords.toLocaleString('id-ID')} pesanan</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-stone-500 dark:text-stone-400">Rata-rata/Tiket:</span>
            <span className="font-semibold text-stone-700 dark:text-stone-300">{formatIDR(avg)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-7xl mx-auto space-y-6 select-none font-sans">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200/80 dark:border-stone-800/80">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading tracking-tight">
              Dashboard Transaksi Cabang
            </h1>

            {data?.vendor && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/80 shadow-2xs">
                <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{data.vendor.name}</span>
              </span>
            )}
          </div>

          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 flex items-center gap-2">
            <span>Data transaksi terisolasi khusus cabang Anda</span>
            <span>•</span>
            <span className="font-semibold text-orange-600 dark:text-orange-400">Retensi 3 Bulan Terakhir</span>
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick link to Top 10 Products for Manager */}
          {onNavigateTab && (
            <button
              type="button"
              id="goto-manager-top-products-btn"
              onClick={() => onNavigateTab('manager-top-products')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs"
              title="Buka Peringkat 10 Produk Paling Laku Cabang"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>Top 10 Produk</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchAnalytics(true)}
            disabled={isLoading || isRefreshing}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
            title="Muat ulang data transaksi"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-orange-600' : ''}`} />
            <span>Segarkan</span>
          </button>

          {/* Export Dropdown Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen(prev => !prev)}
              disabled={isExporting || isLoading}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-accent text-white hover:bg-orange-600 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
              <span>{isExporting ? 'Mengekspor...' : 'Ekspor Data'}</span>
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${exportMenuOpen ? 'rotate-90' : ''}`} />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-stone-400 dark:text-stone-500 border-b border-stone-100 dark:border-stone-800">
                  Format Ekspor 3 Bulan
                </div>

                <button
                  type="button"
                  onClick={() => handleExport('csv', 'all')}
                  className="w-full text-left px-3.5 py-2 text-xs text-stone-700 dark:text-stone-300 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-bold">Ekspor CSV (Excel)</div>
                    <div className="text-[10px] text-stone-400">Rincian nota transaksi lengkap</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleExport('json', 'all')}
                  className="w-full text-left px-3.5 py-2 text-xs text-stone-700 dark:text-stone-300 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileCode className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                    <div className="font-bold">Ekspor JSON</div>
                    <div className="text-[10px] text-stone-400">Struktur arsip digital sistem</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Banner Kebijakan Retensi 3 Bulan & Skeduler Otomatis */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-600/5 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-stone-900/40 border border-amber-300/80 dark:border-amber-800/70 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Database className="w-4 h-4" />
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 font-heading">
                Kebijakan Retensi Data 3 Bulan & Skeduler Pembersihan Otomatis
              </span>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              Sesuai regulasi sistem, seluruh transaksi cabang <strong className="text-stone-900 dark:text-stone-100">{data?.vendor?.name || 'Anda'}</strong> disimpan selama <strong className="text-amber-700 dark:text-amber-400">3 bulan terakhir (90 hari)</strong>. Data yang melewati batas cutoff otomatis dibersihkan secara berkala oleh skeduler latar belakang setiap 6 jam.
            </p>

            {/* Retention Metrics Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
              <div className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 flex items-center gap-1.5 shadow-2xs">
                <CalendarCheck className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-stone-500 dark:text-stone-400">Batas Cutoff:</span>
                <span className="font-bold text-stone-800 dark:text-stone-200">
                  {formatDateID(data?.retention?.cutoffDate || data?.retentionPolicy?.cutoffDate)}
                </span>
              </div>

              <div className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 flex items-center gap-1.5 shadow-2xs">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-stone-500 dark:text-stone-400">Transaksi Aktif Tersimpan:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {(data?.retention?.vendorOrdersCount ?? data?.summary?.totalOrders ?? 0).toLocaleString('id-ID')} pesanan
                </span>
              </div>

              <div className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 flex items-center gap-1.5 shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-stone-500 dark:text-stone-400">Skeduler Otomatis:</span>
                <span className="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Aktif (Setiap 6 Jam)
                </span>
              </div>
            </div>
          </div>

          {/* Retention Actions */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2 shrink-0">
            <button
              type="button"
              onClick={handleTriggerRetentionRun}
              disabled={isPurging || isLoading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Jalankan skeduler pembersihan sekarang"
            >
              <Trash2 className={`w-3.5 h-3.5 ${isPurging ? 'animate-spin' : ''}`} />
              <span>{isPurging ? 'Membersihkan Data...' : 'Jalankan Skeduler Sekarang'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleExport('csv', 'all')}
              disabled={isExporting}
              className="px-3.5 py-1.5 rounded-xl text-[11px] font-semibold text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-white/80 dark:hover:bg-stone-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ekspor Data 3 Bulan (.CSV)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Summary KPIs (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Omzet 3 Bulan */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
              Total Omzet (3 Bulan)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading tracking-tight">
            {formatIDR(data?.summary?.totalRevenue || 0)}
          </div>

          <div className="text-[11px] text-stone-400 dark:text-stone-500 mt-2 flex items-center justify-between">
            <span>Bulan Ini:</span>
            <span className="font-bold text-stone-700 dark:text-stone-300">
              {formatIDR(data?.summary?.thisMonth?.revenue || 0)}
            </span>
          </div>
        </div>

        {/* Card 2: Total Transaksi 3 Bulan */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
              Total Transaksi (3 Bulan)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>

          <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading tracking-tight">
            {(data?.summary?.totalOrders || 0).toLocaleString('id-ID')}{' '}
            <span className="text-xs font-normal text-stone-500">pesanan</span>
          </div>

          <div className="text-[11px] text-stone-400 dark:text-stone-500 mt-2 flex items-center justify-between">
            <span>Bulan Ini:</span>
            <span className="font-bold text-stone-700 dark:text-stone-300">
              {(data?.summary?.thisMonth?.orders || 0).toLocaleString('id-ID')} pesanan
            </span>
          </div>
        </div>

        {/* Card 3: Rata-rata per Transaksi (AOV) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
              Rata-rata per Pesanan (AOV)
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>

          <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading tracking-tight">
            {formatIDR(data?.summary?.averageOrderValue || 0)}
          </div>

          <div className="text-[11px] text-stone-400 dark:text-stone-500 mt-2 flex items-center justify-between">
            <span>Minggu Ini:</span>
            <span className="font-bold text-stone-700 dark:text-stone-300">
              {formatIDR(data?.summary?.thisWeek?.revenue || 0)}
            </span>
          </div>
        </div>

        {/* Card 4: Transaksi Hari Ini */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
              Penjualan Hari Ini
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>

          <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading tracking-tight">
            {formatIDR(data?.summary?.today?.revenue || 0)}
          </div>

          <div className="text-[11px] text-stone-400 dark:text-stone-500 mt-2 flex items-center justify-between">
            <span>Volume Hari Ini:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {(data?.summary?.today?.orders || 0).toLocaleString('id-ID')} pesanan
            </span>
          </div>
        </div>
      </div>

      {/* 4. Chart Section (Per Hari, Per Minggu, Per Bulan) */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 shadow-xs space-y-4">
        {/* Controls Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-100 dark:border-stone-800">
          {/* Period Selection (Per Hari, Per Minggu, Per Bulan) */}
          <div className="flex items-center gap-1.5 p-1 bg-stone-100 dark:bg-stone-800/90 rounded-2xl w-fit">
            <button
              type="button"
              onClick={() => setPeriod('day')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                period === 'day'
                  ? 'bg-white dark:bg-stone-900 text-accent shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Per Hari (30 Hari)</span>
            </button>

            <button
              type="button"
              onClick={() => setPeriod('week')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                period === 'week'
                  ? 'bg-white dark:bg-stone-900 text-accent shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Per Minggu (12 Minggu)</span>
            </button>

            <button
              type="button"
              onClick={() => setPeriod('month')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                period === 'month'
                  ? 'bg-white dark:bg-stone-900 text-accent shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Per Bulan (3 Bulan Terakhir)</span>
            </button>
          </div>

          {/* Metric & Chart Type Switchers */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Metric Switcher */}
            <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800/90 rounded-xl">
              <button
                type="button"
                onClick={() => setMetric('revenue')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  metric === 'revenue'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                Omzet (Rp)
              </button>
              <button
                type="button"
                onClick={() => setMetric('orders')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  metric === 'orders'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                Volume Transaksi
              </button>
            </div>

            {/* Chart Type Switcher */}
            <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800/90 rounded-xl">
              <button
                type="button"
                onClick={() => setChartView('area')}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  chartView === 'area'
                    ? 'bg-white dark:bg-stone-900 text-accent shadow-2xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
                title="Area Chart"
              >
                <TrendingUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setChartView('bar')}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  chartView === 'bar'
                    ? 'bg-white dark:bg-stone-900 text-accent shadow-2xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
                title="Bar Chart"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setChartView('line')}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  chartView === 'line'
                    ? 'bg-white dark:bg-stone-900 text-accent shadow-2xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
                title="Line Chart"
              >
                <LineChartIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Chart Header Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="text-stone-500 dark:text-stone-400">Total Periode Ini: </span>
            <strong className="text-stone-900 dark:text-stone-100 font-bold">
              {metric === 'revenue' ? formatIDR(periodTotalRevenue) : `${periodTotalOrders.toLocaleString('id-ID')} pesanan`}
            </strong>
            <span className="text-stone-400 dark:text-stone-500 ml-2">
              (Rata-rata: {formatIDR(periodAverageTicket)}/pesanan)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500 shrink-0" />
            <span className="font-semibold text-stone-700 dark:text-stone-300">
              {data?.vendor?.name || 'Cabang Anda'}
            </span>
          </div>
        </div>

        {/* Visual Chart */}
        <div className="h-72 sm:h-80 w-full pt-2">
          {isLoading ? (
            <div className="h-full w-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-stone-400 text-xs font-semibold">
                <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
                <span>Memuat grafik transaksi vendor...</span>
              </div>
            </div>
          ) : currentChartData.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center text-stone-400 text-xs">
              Tidak ada data transaksi pada rentang periode ini
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartView === 'area' ? (
                <AreaChart data={currentChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="managerGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={vendorAccentColor} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={vendorAccentColor} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.6} />
                  <XAxis
                    dataKey="label"
                    stroke="#9ca3af"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={val => metric === 'revenue' ? `Rp${(val / 1000).toFixed(0)}k` : val}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey={metric === 'revenue' ? 'totalRevenue' : 'totalOrders'}
                    name={metric === 'revenue' ? 'Omzet (Rp)' : 'Transaksi'}
                    stroke={vendorAccentColor}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#managerGrad)"
                  />
                </AreaChart>
              ) : chartView === 'bar' ? (
                <BarChart data={currentChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.6} />
                  <XAxis
                    dataKey="label"
                    stroke="#9ca3af"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={val => metric === 'revenue' ? `Rp${(val / 1000).toFixed(0)}k` : val}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey={metric === 'revenue' ? 'totalRevenue' : 'totalOrders'}
                    name={metric === 'revenue' ? 'Omzet (Rp)' : 'Transaksi'}
                    fill={vendorAccentColor}
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              ) : (
                <LineChart data={currentChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.6} />
                  <XAxis
                    dataKey="label"
                    stroke="#9ca3af"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={val => metric === 'revenue' ? `Rp${(val / 1000).toFixed(0)}k` : val}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey={metric === 'revenue' ? 'totalRevenue' : 'totalOrders'}
                    name={metric === 'revenue' ? 'Omzet (Rp)' : 'Transaksi'}
                    stroke={vendorAccentColor}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: vendorAccentColor }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 5. Distribution of Payment Methods for Manager's Store */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 shadow-xs space-y-3 lg:col-span-1">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
            <span className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5 font-heading">
              <CreditCard className="w-4 h-4 text-accent" />
              <span>Metode Pembayaran</span>
            </span>
            <span className="text-[10px] font-bold text-stone-400">Retensi 3 Bulan</span>
          </div>

          <div className="space-y-2.5 pt-1">
            {(!data?.paymentMethods || data.paymentMethods.length === 0) ? (
              <div className="text-xs text-stone-400 py-4 text-center">Belum ada data transaksi</div>
            ) : (
              data.paymentMethods.map(pm => (
                <div key={pm.method} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-800 dark:text-stone-200">{pm.method}</span>
                    <span className="font-bold text-stone-900 dark:text-stone-100">{formatIDR(pm.revenue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>{pm.count} transaksi</span>
                    <span>{pm.percentage}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pm.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 6. Detailed Tabular Breakdown for Active Period */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 shadow-xs space-y-3 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5 font-heading">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <span>Rincian Data Tabel ({period === 'day' ? 'Harian' : period === 'week' ? 'Mingguan' : 'Bulanan'})</span>
                </span>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Rekapitulasi lengkap data transaksi tersimpan cabang Anda
                </p>
              </div>

              {/* Table Export Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportCurrentTable('csv')}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all flex items-center gap-1 cursor-pointer"
                  title="Ekspor tabel ini sebagai CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ekspor Tabel (CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportCurrentTable('json')}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all flex items-center gap-1 cursor-pointer"
                  title="Ekspor tabel ini sebagai JSON"
                >
                  <FileCode className="w-3.5 h-3.5 text-purple-600" />
                  <span>JSON</span>
                </button>
              </div>
            </div>

            {/* Scrollable Table */}
            <div className="overflow-x-auto max-h-72 mt-2">
              <table className="w-full text-left text-xs text-stone-600 dark:text-stone-300">
                <thead className="sticky top-0 bg-stone-50 dark:bg-stone-850 text-stone-500 dark:text-stone-400 font-bold uppercase text-[10px] tracking-wider border-b border-stone-200 dark:border-stone-800">
                  <tr>
                    <th className="py-2.5 px-3">Periode</th>
                    <th className="py-2.5 px-3 text-right">Jumlah Pesanan</th>
                    <th className="py-2.5 px-3 text-right">Total Omzet</th>
                    <th className="py-2.5 px-3 text-right">Rata-rata/Tiket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {currentChartData.map((row: ChartDataItem, idx: number) => (
                    <tr key={idx} className="hover:bg-stone-50 dark:hover:bg-stone-850/60 transition-colors">
                      <td className="py-2 px-3 font-semibold text-stone-800 dark:text-stone-200 whitespace-nowrap">
                        {row.label || row.shortLabel}
                        {row.dayName && <span className="text-stone-400 font-normal ml-1">({row.dayName})</span>}
                      </td>
                      <td className="py-2 px-3 text-right font-medium">
                        {row.totalOrders.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatIDR(row.totalRevenue)}
                      </td>
                      <td className="py-2 px-3 text-right text-stone-500">
                        {formatIDR(row.averageTicket)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
