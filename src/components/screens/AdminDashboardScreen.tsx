import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react';
import * as Select from '@radix-ui/react-select';
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
  Tooltip,
  Legend
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';

type PeriodType = 'day' | 'week' | 'month';
type MetricType = 'revenue' | 'orders';
type ChartViewType = 'area' | 'bar' | 'line';

export interface AdminChartDataItem {
  label: string;
  shortLabel?: string;
  dayName?: string;
  date?: string;
  weekKey?: string;
  monthKey?: string;
  totalOrders: number;
  totalRevenue: number;
  averageTicket: number;
  [key: string]: any;
}

interface VendorMeta {
  id: string;
  name: string;
  code: string;
  color: string;
}

interface AnalyticsData {
  success: boolean;
  requestedVendorId: string;
  vendors: VendorMeta[];
  retention?: {
    retentionDays: number;
    retentionMonths: number;
    cutoffDate: string;
    lastRunTime: string | null;
    lastDeletedCount: number;
    totalPurgedLifetime: number;
    activeOrdersCount: number;
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
    topVendor: {
      id: string;
      name: string;
      revenue: number;
      percentage: number;
    };
    today: { orders: number; revenue: number };
    thisWeek: { orders: number; revenue: number };
    thisMonth: { orders: number; revenue: number };
    thisYear?: { orders: number; revenue: number };
  };
  daily: any[];
  weekly: any[];
  monthly: any[];
  yearly?: any[];
  paymentMethods: Array<{
    method: string;
    count: number;
    total: number;
    percentage: number;
  }>;
  vendorShares: Array<{
    vendorId: string;
    name: string;
    code: string;
    color: string;
    orderCount: number;
    revenue: number;
    share: number;
  }>;
}

export const AdminDashboardScreen: React.FC = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { showToast } = useToast();

  const [period, setPeriod] = useState<PeriodType>('day');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [metric, setMetric] = useState<MetricType>('revenue');
  const [chartType, setChartType] = useState<ChartViewType>('area');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchAnalytics = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setFetchError(null);

    try {
      const res = await fetch(`/api/admin/analytics/transactions?vendorId=${encodeURIComponent(selectedVendor)}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error(`Gagal memuat data analitik (${res.status})`);
      }

      const json = await res.json();
      if (json.success) {
        setData(json);
        if (isManualRefresh) {
          showToast('Data analitik berhasil diperbarui', 'success');
        }
      } else {
        throw new Error(json.error || 'Terjadi kesalahan sistem');
      }
    } catch (err: any) {
      console.error('[AdminDashboard] Error fetching analytics:', err);
      setFetchError(err.message || 'Gagal memuat analitik');
      if (isManualRefresh) {
        showToast(err.message || 'Gagal menyegarkan data', 'error');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAnalytics();
    }
  }, [token, selectedVendor]);

  // Export full transaction dataset (within 3-month retention window)
  const handleExportTransactions = async (format: 'csv' | 'json', targetPeriod = period) => {
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const res = await fetch(
        `/api/admin/analytics/transactions/export?period=${encodeURIComponent(targetPeriod)}&vendorId=${encodeURIComponent(selectedVendor)}&format=${format}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!res.ok) {
        throw new Error(`Gagal mengekspor data (${res.status})`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kasirkafe_transaksi_3bulan_${targetPeriod}_${selectedVendor}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast(`Data transaksi (${format.toUpperCase()}) 3 bulan berhasil diunduh!`, 'success');
    } catch (err: any) {
      console.error('[AdminDashboard] Export error:', err);
      showToast(err.message || 'Gagal mengekspor data', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Run retention cleanup scheduler on-demand
  const handleRunRetentionCleanup = async () => {
    setIsPurging(true);
    try {
      const res = await fetch('/api/admin/analytics/retention-run', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`Gagal menjalankan skeduler pembersihan (${res.status})`);
      }

      const json = await res.json();
      if (json.success) {
        showToast(
          json.message || `Skeduler pembersihan berhasil dijalankan. ${json.result?.deletedCount || 0} pesanan usang dihapus.`,
          'success'
        );
        fetchAnalytics(true);
      } else {
        throw new Error(json.error || 'Gagal menjalankan pembersihan data');
      }
    } catch (err: any) {
      console.error('[AdminDashboard] Retention cleanup error:', err);
      showToast(err.message || 'Gagal menjalankan skeduler', 'error');
    } finally {
      setIsPurging(false);
    }
  };

  // Export current table view directly to CSV or JSON
  const handleExportCurrentTable = (format: 'csv' | 'json') => {
    if (!activeDataset || activeDataset.length === 0) {
      showToast('Tidak ada data tabel untuk diekspor', 'error');
      return;
    }

    const periodNames: Record<PeriodType, string> = {
      day: 'Per_Hari',
      week: 'Per_Minggu',
      month: 'Per_Bulan'
    };

    if (format === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeDataset, null, 2));
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = `kasirkafe_rekap_tabel_${periodNames[period]}_${selectedVendor}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Tabel analitik berhasil diekspor ke JSON', 'success');
      return;
    }

    // CSV format
    const vendors = data?.vendors || [];
    const headers = [
      'Periode',
      'Hari',
      ...vendors.map((v) => `Omzet ${v.name} (Rp)`),
      ...vendors.map((v) => `Trx ${v.name}`),
      'Total Volume Trx',
      'Total Omzet (Rp)',
      'Rata-rata / AOV (Rp)'
    ];

    const rows = activeDataset.map((row: any) => {
      return [
        `"${row.label || ''}"`,
        `"${row.dayName || ''}"`,
        ...vendors.map((v) => row[`${v.id}_revenue`] || 0),
        ...vendors.map((v) => row[`${v.id}_orders`] || 0),
        row.totalOrders || 0,
        row.totalRevenue || 0,
        row.averageTicket || 0
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kasirkafe_rekap_tabel_${periodNames[period]}_${selectedVendor}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Tabel analitik berhasil diekspor ke CSV', 'success');
  };

  // Current active dataset according to selected period
  const activeDataset: AdminChartDataItem[] = useMemo(() => {
    if (!data) return [];
    let list: any[] = [];
    switch (period) {
      case 'day':
        list = data.daily || [];
        break;
      case 'week':
        list = data.weekly || [];
        break;
      case 'month':
        list = data.monthly || [];
        break;
      default:
        list = data.daily || [];
    }
    if (!Array.isArray(list)) return [];
    return list
      .filter((item): item is NonNullable<typeof item> => item !== null && typeof item === 'object')
      .map((item) => ({
        ...item,
        label: String(item.label || item.shortLabel || ''),
        totalOrders: Number(item.totalOrders) || 0,
        totalRevenue: Number(item.totalRevenue) || 0,
        averageTicket: Number(item.averageTicket) || 0
      }));
  }, [data, period]);

  // Helpers for IDR currency formatting
  const formatIDR = (val: number) => {
    return `Rp ${(val || 0).toLocaleString('id-ID')}`;
  };

  const formatShortIDR = (val: number) => {
    if (val >= 1000000000) {
      return `${(val / 1000000000).toFixed(1)}M`;
    }
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)}jt`;
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(0)}rb`;
    }
    return String(val);
  };

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const currentPoint = payload[0]?.payload;
      const totalRev = currentPoint?.totalRevenue || 0;
      const totalOrd = currentPoint?.totalOrders || 0;
      const pointLabel = currentPoint?.label || label;
      const dayName = currentPoint?.dayName ? `(${currentPoint.dayName})` : '';

      return (
        <div className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-md p-4 rounded-xl border border-stone-200 dark:border-stone-700 shadow-xl text-xs max-w-xs z-50">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-2 mb-2.5">
            <div>
              <p className="font-bold text-stone-900 dark:text-stone-100 font-heading">
                {pointLabel} {dayName}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {period === 'day' && 'Transaksi Harian'}
                {period === 'week' && 'Rekap Mingguan'}
                {period === 'month' && 'Rekap Bulanan'}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
              {totalOrd} trx
            </span>
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-stone-600 dark:text-stone-400">Total Omzet:</span>
              <span className="font-bold text-stone-900 dark:text-white font-mono">{formatIDR(totalRev)}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] mt-0.5">
              <span className="text-stone-600 dark:text-stone-400">Rata-rata/Trx:</span>
              <span className="font-semibold text-stone-700 dark:text-stone-300 font-mono">
                {formatIDR(currentPoint?.averageTicket || 0)}
              </span>
            </div>
          </div>

          {/* Per-Vendor details if multiple vendors */}
          {data?.vendors && data.vendors.length > 0 && selectedVendor === 'all' && (
            <div className="space-y-1.5 border-t border-stone-100 dark:border-stone-800 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                Kontribusi Vendor
              </p>
              {data.vendors.map((v) => {
                const vOrders = currentPoint?.[`${v.id}_orders`] || 0;
                const vRev = currentPoint?.[`${v.id}_revenue`] || 0;
                return (
                  <div key={v.id} className="flex items-center justify-between text-[11px] gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                      <span className="truncate text-stone-700 dark:text-stone-300">{v.name}</span>
                    </div>
                    <span className="font-mono font-medium text-stone-900 dark:text-stone-100 shrink-0">
                      {metric === 'revenue' ? formatIDR(vRev) : `${vOrders} trx`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-7xl mx-auto space-y-6 w-full">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Admin Analytics
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400">Multi-Vendor Performance</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <ShieldCheck className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Retensi 3 Bulan (90 Hari)</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-stone-900 dark:text-white mt-1">
            Dashboard Transaksi Vendor
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 max-w-2xl mt-0.5">
            Pantau dinamika grafik transaksi Per Hari, Per Minggu, dan Per Bulan untuk multi-vendor. Data tersimpan 3 bulan terakhir dengan skeduler pembersihan otomatis dan fasilitas ekspor data CSV/JSON.
          </p>
        </div>

        {/* Action Controls: Export Data + Refresh */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Export CSV Button */}
          <button
            type="button"
            id="admin-export-csv-btn"
            onClick={() => handleExportTransactions('csv')}
            disabled={isLoading || isExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Unduh Data Transaksi 3 Bulan Terakhir format CSV (Excel)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{isExporting ? 'Mengekspor...' : 'Ekspor CSV'}</span>
          </button>

          {/* Export JSON Button */}
          <button
            type="button"
            id="admin-export-json-btn"
            onClick={() => handleExportTransactions('json')}
            disabled={isLoading || isExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Unduh Data Transaksi 3 Bulan Terakhir format JSON"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Ekspor JSON</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            id="admin-dashboard-refresh-btn"
            onClick={() => fetchAnalytics(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-750 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-orange-500' : ''}`} />
            <span>{isRefreshing ? 'Menyinkronkan...' : 'Segarkan Data'}</span>
          </button>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-3.5">
        {/* Row 1: Periode Switcher & Vendor Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Periode Switcher (Radix UI Select) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 shrink-0">Periode:</span>
            <Select.Root value={period} onValueChange={(val) => setPeriod(val as PeriodType)}>
              <Select.Trigger
                id="period-select-trigger"
                aria-label="Pilih Periode Grafik"
                className="inline-flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl text-xs font-bold bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-100 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-750 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-2xs transition-all cursor-pointer w-full sm:w-[220px]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {period === 'day' && <Calendar className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                  {period === 'week' && <CalendarDays className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                  {period === 'month' && <CalendarRange className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                  <Select.Value placeholder="Pilih Periode" />
                </div>
                <Select.Icon asChild>
                  <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0 transition-transform duration-200" />
                </Select.Icon>
              </Select.Trigger>

              <Select.Portal>
                <Select.Content
                  position="popper"
                  sideOffset={6}
                  className="z-50 min-w-[230px] overflow-hidden rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xl p-1 text-xs animate-in fade-in-80 zoom-in-95"
                >
                  <Select.ScrollUpButton className="flex items-center justify-center h-6 text-stone-500 cursor-default">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </Select.ScrollUpButton>

                  <Select.Viewport className="p-1 space-y-1">
                    <Select.Item
                      value="day"
                      id="period-select-item-day"
                      className="relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 dark:hover:text-orange-400 focus:bg-orange-50 dark:focus:bg-orange-950/40 focus:text-orange-600 dark:focus:text-orange-400 outline-none cursor-pointer data-[highlighted]:bg-orange-50 dark:data-[highlighted]:bg-orange-950/40 transition-colors select-none"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-orange-500" />
                        <Select.ItemText>Per Hari (30 Hari)</Select.ItemText>
                      </div>
                      <Select.ItemIndicator>
                        <Check className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                      </Select.ItemIndicator>
                    </Select.Item>

                    <Select.Item
                      value="week"
                      id="period-select-item-week"
                      className="relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 dark:hover:text-orange-400 focus:bg-orange-50 dark:focus:bg-orange-950/40 focus:text-orange-600 dark:focus:text-orange-400 outline-none cursor-pointer data-[highlighted]:bg-orange-50 dark:data-[highlighted]:bg-orange-950/40 transition-colors select-none"
                    >
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5 text-orange-500" />
                        <Select.ItemText>Per Minggu (12 Minggu)</Select.ItemText>
                      </div>
                      <Select.ItemIndicator>
                        <Check className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                      </Select.ItemIndicator>
                    </Select.Item>

                    <Select.Item
                      value="month"
                      id="period-select-item-month"
                      className="relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 dark:hover:text-orange-400 focus:bg-orange-50 dark:focus:bg-orange-950/40 focus:text-orange-600 dark:focus:text-orange-400 outline-none cursor-pointer data-[highlighted]:bg-orange-50 dark:data-[highlighted]:bg-orange-950/40 transition-colors select-none"
                    >
                      <div className="flex items-center gap-2">
                        <CalendarRange className="w-3.5 h-3.5 text-orange-500" />
                        <Select.ItemText>Per Bulan (3 Bulan Terakhir)</Select.ItemText>
                      </div>
                      <Select.ItemIndicator>
                        <Check className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                      </Select.ItemIndicator>
                    </Select.Item>
                  </Select.Viewport>

                  <Select.ScrollDownButton className="flex items-center justify-center h-6 text-stone-500 cursor-default">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Select.ScrollDownButton>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>

          {/* Vendor Filter Dropdown (Radix UI Select) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-start gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 shrink-0">Vendor:</span>
            <Select.Root value={selectedVendor} onValueChange={(val) => setSelectedVendor(val)}>
              <Select.Trigger
                id="admin-dashboard-vendor-select-trigger"
                aria-label="Pilih Filter Vendor"
                className="inline-flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-750 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-2xs transition-all cursor-pointer w-full sm:w-[240px]"
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  <Store className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <Select.Value placeholder="Pilih Vendor" />
                </div>
                <Select.Icon asChild>
                  <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0 transition-transform duration-200" />
                </Select.Icon>
              </Select.Trigger>

              <Select.Portal>
                <Select.Content
                  position="popper"
                  sideOffset={6}
                  className="z-50 min-w-[220px] max-w-[320px] max-h-[300px] overflow-hidden rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xl p-1 text-xs animate-in fade-in-80 zoom-in-95"
                >
                  <Select.ScrollUpButton className="flex items-center justify-center h-6 text-stone-500 cursor-default">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </Select.ScrollUpButton>

                  <Select.Viewport className="p-1 space-y-1">
                    <Select.Item
                      value="all"
                      id="vendor-select-item-all"
                      className="relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 dark:hover:text-orange-400 focus:bg-orange-50 dark:focus:bg-orange-950/40 focus:text-orange-600 dark:focus:text-orange-400 outline-none cursor-pointer data-[highlighted]:bg-orange-50 dark:data-[highlighted]:bg-orange-950/40 transition-colors select-none"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Select.ItemText>🌟 Semua Vendor (Komparasi)</Select.ItemText>
                      </div>
                      <Select.ItemIndicator>
                        <Check className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
                      </Select.ItemIndicator>
                    </Select.Item>

                    {data?.vendors?.map((v) => (
                      <Select.Item
                        key={v.id}
                        value={v.id}
                        id={`vendor-select-item-${v.id}`}
                        className="relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 dark:hover:text-orange-400 focus:bg-orange-50 dark:focus:bg-orange-950/40 focus:text-orange-600 dark:focus:text-orange-400 outline-none cursor-pointer data-[highlighted]:bg-orange-50 dark:data-[highlighted]:bg-orange-950/40 transition-colors select-none"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Store className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <Select.ItemText>
                            {v.name} ({v.code})
                          </Select.ItemText>
                        </div>
                        <Select.ItemIndicator>
                          <Check className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Viewport>

                  <Select.ScrollDownButton className="flex items-center justify-center h-6 text-stone-500 cursor-default">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Select.ScrollDownButton>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
        </div>

        {/* Row 2: Metric Toggle & Chart Type Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-stone-100 dark:border-stone-800/80">
          {/* Metric Toggle: Nominal vs Jumlah Trx */}
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 shrink-0">Metrik:</span>
            <div className="flex items-center p-0.5 bg-stone-100 dark:bg-stone-800 rounded-xl flex-1 sm:flex-none">
              <button
                type="button"
                id="metric-revenue-btn"
                onClick={() => setMetric('revenue')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                  metric === 'revenue'
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                }`}
              >
                Nominal (Rp)
              </button>
              <button
                type="button"
                id="metric-orders-btn"
                onClick={() => setMetric('orders')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                  metric === 'orders'
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                }`}
              >
                Jumlah Trx
              </button>
            </div>
          </div>

          {/* Chart Type Toggle */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 shrink-0">Tipe Grafik:</span>
            <div className="flex items-center p-0.5 bg-stone-100 dark:bg-stone-800 rounded-xl">
              <button
                type="button"
                id="chart-type-area-btn"
                title="Area Chart"
                aria-label="Area Chart"
                onClick={() => setChartType('area')}
                className={`p-2 rounded-lg text-xs transition-all cursor-pointer ${
                  chartType === 'area'
                    ? 'bg-white dark:bg-stone-700 text-orange-600 dark:text-orange-400 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                id="chart-type-bar-btn"
                title="Bar Chart"
                aria-label="Bar Chart"
                onClick={() => setChartType('bar')}
                className={`p-2 rounded-lg text-xs transition-all cursor-pointer ${
                  chartType === 'bar'
                    ? 'bg-white dark:bg-stone-700 text-orange-600 dark:text-orange-400 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                id="chart-type-line-btn"
                title="Line Chart"
                aria-label="Line Chart"
                onClick={() => setChartType('line')}
                className={`p-2 rounded-lg text-xs transition-all cursor-pointer ${
                  chartType === 'line'
                    ? 'bg-white dark:bg-stone-700 text-orange-600 dark:text-orange-400 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                }`}
              >
                <LineChartIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Vendor Legend Chips */}
        {data?.vendors && data.vendors.length > 0 && selectedVendor === 'all' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-800/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Warna Vendor:
            </span>
            {data.vendors.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVendor(v.id)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-50 dark:bg-stone-850 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200/80 dark:border-stone-750 transition-all cursor-pointer"
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.color }} />
                <span>{v.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Omzet */}
        <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Total Omzet Penjualan
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/80 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black font-heading text-stone-900 dark:text-white font-mono">
              {data ? formatIDR(data.summary.totalRevenue) : '...'}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 mt-1">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {period === 'day' && `Hari ini: ${formatIDR(data?.summary.today.revenue || 0)}`}
                {period === 'week' && `Minggu ini: ${formatIDR(data?.summary.thisWeek.revenue || 0)}`}
                {period === 'month' && `Bulan ini: ${formatIDR(data?.summary.thisMonth.revenue || 0)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Transaksi */}
        <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Volume Transaksi
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black font-heading text-stone-900 dark:text-white font-mono">
              {data ? `${data.summary.totalOrders.toLocaleString('id-ID')} Trx` : '...'}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 mt-1">
              <span>
                {period === 'day' && `Hari ini: ${data?.summary.today.orders || 0} pesanan`}
                {period === 'week' && `Minggu ini: ${data?.summary.thisWeek.orders || 0} pesanan`}
                {period === 'month' && `Bulan ini: ${data?.summary.thisMonth.orders || 0} pesanan`}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Rata-rata Nilai Transaksi (AOV) */}
        <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Rata-Rata Tiket (AOV)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black font-heading text-stone-900 dark:text-white font-mono">
              {data ? formatIDR(data.summary.averageOrderValue) : '...'}
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Nilai belanja rata-rata per transaksi</p>
          </div>
        </div>

        {/* Card 4: Top Contributor Vendor */}
        <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Vendor Kontributor Tertinggi
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-lg font-bold font-heading text-stone-900 dark:text-white truncate">
              {data?.summary.topVendor?.name || 'KasirKafe Central'}
            </p>
            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mt-1">
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                {formatIDR(data?.summary.topVendor?.revenue || 0)}
              </span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                {data?.summary.topVendor?.percentage || 0}% Kontribusi
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Retention Policy & Automated Cleanup Scheduler Card */}
      <div className="bg-gradient-to-br from-amber-500/5 via-stone-50 to-orange-500/5 dark:from-amber-950/20 dark:via-stone-900 dark:to-orange-950/20 p-5 sm:p-6 rounded-2xl border border-amber-200/70 dark:border-amber-900/50 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-amber-200/50 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold font-heading text-stone-900 dark:text-white">
                  Kebijakan Retensi Data 3 Bulan & Skeduler Pembersihan Otomatis
                </h3>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  90 Hari Terakhir
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Data transaksi disimpan selama 3 bulan terakhir. Data pesanan usang sebelum batas retensi dihapus secara otomatis oleh skeduler sistem.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Skeduler Aktif (Tiap 6 Jam)</span>
            </span>
          </div>
        </div>

        {/* 4 Stat Tiles for Retention */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Tile 1: Cutoff Date */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-stone-850 border border-stone-200/70 dark:border-stone-750 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 text-xs font-semibold">
              <CalendarCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Batas Tanggal Retensi</span>
            </div>
            <div className="mt-2">
              <p className="text-sm sm:text-base font-bold font-heading text-stone-900 dark:text-white font-mono">
                {data?.retention?.cutoffDate
                  ? new Date(data.retention.cutoffDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '90 Hari Lalu'}
              </p>
              <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">Data sebelum tanggal ini dibersihkan</p>
            </div>
          </div>

          {/* Tile 2: Active Stored Orders */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-stone-850 border border-stone-200/70 dark:border-stone-750 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 text-xs font-semibold">
              <Database className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Transaksi Aktif Tersimpan</span>
            </div>
            <div className="mt-2">
              <p className="text-sm sm:text-base font-bold font-heading text-stone-900 dark:text-white font-mono">
                {data?.retention?.activeOrdersCount !== undefined
                  ? `${data.retention.activeOrdersCount.toLocaleString('id-ID')} Pesanan`
                  : `${(data?.summary.totalOrders || 0).toLocaleString('id-ID')} Pesanan`}
              </p>
              <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">Tersedia dalam database aktif 3 bulan</p>
            </div>
          </div>

          {/* Tile 3: Last Purge */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-stone-850 border border-stone-200/70 dark:border-stone-750 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Pembersihan Terakhir</span>
            </div>
            <div className="mt-2">
              <p className="text-sm sm:text-base font-bold font-heading text-stone-900 dark:text-white font-mono">
                {data?.retention?.lastDeletedCount !== undefined
                  ? `${data.retention.lastDeletedCount} data usang dihapus`
                  : '0 data usang dihapus'}
              </p>
              <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                {data?.retention?.lastRunTime
                  ? `Eksekusi: ${new Date(data.retention.lastRunTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`
                  : 'Berjalan otomatis berkala'}
              </p>
            </div>
          </div>

          {/* Tile 4: Next Scheduled Run */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-stone-850 border border-stone-200/70 dark:border-stone-750 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Jadwal Berikutnya</span>
            </div>
            <div className="mt-2">
              <p className="text-sm sm:text-base font-bold font-heading text-stone-900 dark:text-white font-mono">
                {data?.retention?.nextScheduledRun
                  ? `${new Date(data.retention.nextScheduledRun).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`
                  : 'Setiap 6 Jam'}
              </p>
              <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">Skeduler latar belakang otomatis</p>
            </div>
          </div>
        </div>

        {/* Action Controls for Retention */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-200/50 dark:border-stone-800">
          <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
            <span className="font-semibold text-stone-700 dark:text-stone-300">Catatan Retensi:</span>
            <span>Data transaksi &gt; 90 hari otomatis dimusnahkan demi efisiensi dan privasi.</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="admin-run-retention-btn"
              onClick={handleRunRetentionCleanup}
              disabled={isPurging || isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-stone-700 transition-all cursor-pointer disabled:opacity-50"
              title="Jalankan skeduler pembersihan data usang sekarang secara manual"
            >
              <Trash2 className={`w-3.5 h-3.5 ${isPurging ? 'animate-spin text-orange-600' : 'text-stone-500'}`} />
              <span>{isPurging ? 'Menjalankan Skeduler...' : 'Jalankan Skeduler Sekarang'}</span>
            </button>

            <button
              type="button"
              id="admin-export-3months-csv-btn"
              onClick={() => handleExportTransactions('csv', period)}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Ekspor Seluruh Data 3 Bulan (.CSV)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart Card */}
      <div className="bg-white dark:bg-stone-900 p-5 sm:p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold font-heading text-stone-900 dark:text-white flex items-center gap-2">
              <span>
                Grafik Penjualan {period === 'day' && 'Per Hari'}
                {period === 'week' && 'Per Minggu'}
                {period === 'month' && 'Per Bulan'}
              </span>
              <span className="text-xs font-normal text-stone-500 dark:text-stone-400">
                ({metric === 'revenue' ? 'Nominal Omzet' : 'Jumlah Transaksi'})
              </span>
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {selectedVendor === 'all'
                ? 'Menampilkan perbandingan tren penjualan untuk tiap vendor'
                : `Menampilkan tren transaksi khusus ${data?.vendors?.find((v) => v.id === selectedVendor)?.name || selectedVendor}`}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Data Terkini (Live Analytics)</span>
          </div>
        </div>

        {/* Recharts Canvas */}
        <div className="w-full h-[360px] sm:h-[400px]">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center text-stone-400 gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
              <span className="text-xs font-semibold">Memuat visualisasi data grafik...</span>
            </div>
          ) : fetchError ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 gap-2">
              <AlertCircle className="w-8 h-8 text-rose-500" />
              <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">{fetchError}</p>
              <button
                type="button"
                onClick={() => fetchAnalytics()}
                className="mt-2 px-3 py-1.5 text-xs font-bold rounded-xl bg-orange-600 text-white"
              >
                Coba Lagi
              </button>
            </div>
          ) : activeDataset.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs">
              Tidak ada data transaksi untuk rentang ini.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={activeDataset} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    {data?.vendors?.map((v) => (
                      <linearGradient key={v.id} id={`color_${v.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={v.color} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={v.color} stopOpacity={0.0} />
                      </linearGradient>
                    ))}
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ea580c" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ea580c" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.5} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#888' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#888' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => (metric === 'revenue' ? formatShortIDR(val) : String(val))}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
                    formatter={(value) => <span className="text-stone-700 dark:text-stone-300 font-medium">{value}</span>}
                  />

                  {selectedVendor === 'all' ? (
                    data?.vendors?.map((v) => (
                      <Area
                        key={v.id}
                        type="monotone"
                        dataKey={metric === 'revenue' ? `${v.id}_revenue` : `${v.id}_orders`}
                        name={v.name}
                        stroke={v.color}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill={`url(#color_${v.id})`}
                      />
                    ))
                  ) : (
                    <Area
                      type="monotone"
                      dataKey={metric === 'revenue' ? 'totalRevenue' : 'totalOrders'}
                      name={data?.vendors?.find((v) => v.id === selectedVendor)?.name || 'Penjualan'}
                      stroke="#ea580c"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorTotal)"
                    />
                  )}
                </AreaChart>
              ) : chartType === 'bar' ? (
                <BarChart data={activeDataset} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.5} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#888' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#888' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => (metric === 'revenue' ? formatShortIDR(val) : String(val))}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
                    formatter={(value) => <span className="text-stone-700 dark:text-stone-300 font-medium">{value}</span>}
                  />

                  {selectedVendor === 'all' ? (
                    data?.vendors?.map((v) => (
                      <Bar
                        key={v.id}
                        dataKey={metric === 'revenue' ? `${v.id}_revenue` : `${v.id}_orders`}
                        name={v.name}
                        fill={v.color}
                        radius={[4, 4, 0, 0]}
                      />
                    ))
                  ) : (
                    <Bar
                      dataKey={metric === 'revenue' ? 'totalRevenue' : 'totalOrders'}
                      name={data?.vendors?.find((v) => v.id === selectedVendor)?.name || 'Penjualan'}
                      fill="#ea580c"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                </BarChart>
              ) : (
                <LineChart data={activeDataset} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.5} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#888' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#888' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => (metric === 'revenue' ? formatShortIDR(val) : String(val))}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
                    formatter={(value) => <span className="text-stone-700 dark:text-stone-300 font-medium">{value}</span>}
                  />

                  {selectedVendor === 'all' ? (
                    data?.vendors?.map((v) => (
                      <Line
                        key={v.id}
                        type="monotone"
                        dataKey={metric === 'revenue' ? `${v.id}_revenue` : `${v.id}_orders`}
                        name={v.name}
                        stroke={v.color}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: v.color }}
                        activeDot={{ r: 5 }}
                      />
                    ))
                  ) : (
                    <Line
                      type="monotone"
                      dataKey={metric === 'revenue' ? 'totalRevenue' : 'totalOrders'}
                      name={data?.vendors?.find((v) => v.id === selectedVendor)?.name || 'Penjualan'}
                      stroke="#ea580c"
                      strokeWidth={3}
                      dot={{ r: 3, fill: '#ea580c' }}
                      activeDot={{ r: 6 }}
                    />
                  )}
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Two-Column Grid: Market Share by Vendor & Payment Method Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Pangsa Pasar Vendor (Market Share) */}
        <div className="bg-white dark:bg-stone-900 p-5 sm:p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-bold font-heading text-stone-900 dark:text-white">
                Pangsa Pasar Penjualan Vendor (Market Share)
              </h3>
            </div>
            <span className="text-xs text-stone-500 dark:text-stone-400">Akumulatif Omzet</span>
          </div>

          <div className="space-y-3.5">
            {data?.vendorShares?.map((vs) => (
              <div key={vs.vendorId} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: vs.color }} />
                    <span className="font-semibold text-stone-800 dark:text-stone-200">{vs.name}</span>
                    <span className="text-[10px] text-stone-400 font-mono">({vs.code})</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-stone-600 dark:text-stone-300 font-semibold">{formatIDR(vs.revenue)}</span>
                    <span className="text-xs font-bold text-stone-900 dark:text-white">({vs.share}%)</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${vs.share}%`,
                      backgroundColor: vs.color
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 2: Distribusi Metode Pembayaran */}
        <div className="bg-white dark:bg-stone-900 p-5 sm:p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <h3 className="text-sm font-bold font-heading text-stone-900 dark:text-white">
                Distribusi Metode Pembayaran
              </h3>
            </div>
            <span className="text-xs text-stone-500 dark:text-stone-400">Channel Transaksi</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {data?.paymentMethods?.map((pm) => (
              <div
                key={pm.method}
                className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/60 dark:border-stone-750 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs font-heading text-stone-900 dark:text-white">{pm.method}</span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                    {pm.percentage}%
                  </span>
                </div>
                <div className="mt-2.5">
                  <p className="text-base font-bold font-mono text-stone-900 dark:text-stone-100">
                    {formatIDR(pm.total)}
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">{pm.count} transaksi selesai</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Breakdown Table */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold font-heading text-stone-900 dark:text-white">
              Tabel Rekapitulasi Rinci ({period === 'day' && 'Per Hari'}
              {period === 'week' && 'Per Minggu'}
              {period === 'month' && 'Per Bulan'})
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Rincian angka transaksi dan pendapatan tiap entitas dalam rentang waktu yang dipilih.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="export-table-csv-btn"
              onClick={() => handleExportCurrentTable('csv')}
              disabled={activeDataset.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 transition-all cursor-pointer disabled:opacity-50"
              title="Ekspor data tabel ke format CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Ekspor Tabel (CSV)</span>
            </button>
            <button
              type="button"
              id="export-table-json-btn"
              onClick={() => handleExportCurrentTable('json')}
              disabled={activeDataset.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 transition-all cursor-pointer disabled:opacity-50"
              title="Ekspor data tabel ke format JSON"
            >
              <FileCode className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Ekspor Tabel (JSON)</span>
            </button>
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400 pl-1">
              Total {activeDataset.length} Baris
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 dark:bg-stone-850/80 border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Periode</th>
                {data?.vendors?.map((v) => (
                  <th key={v.id} className="py-3 px-4 text-right">
                    <span className="inline-flex items-center gap-1.5 justify-end">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
                      <span>{v.code}</span>
                    </span>
                  </th>
                ))}
                <th className="py-3 px-4 text-right font-bold text-stone-800 dark:text-stone-200">Volume Trx</th>
                <th className="py-3 px-4 text-right font-bold text-stone-800 dark:text-stone-200">Total Omzet</th>
                <th className="py-3 px-4 text-right">AOV / Tiket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {activeDataset.map((row: AdminChartDataItem, idx: number) => (
                <tr
                  key={row.date || row.weekKey || row.monthKey || idx}
                  className="hover:bg-stone-50/70 dark:hover:bg-stone-850/50 transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-stone-900 dark:text-stone-100">
                    <div className="flex items-center gap-1.5">
                      <span>{row.label}</span>
                      {row.dayName && (
                        <span className="text-[10px] font-normal text-stone-400 dark:text-stone-500">
                          ({row.dayName})
                        </span>
                      )}
                    </div>
                  </td>

                  {data?.vendors?.map((v) => {
                    const rev = row[`${v.id}_revenue`] || 0;
                    const ord = row[`${v.id}_orders`] || 0;
                    return (
                      <td key={v.id} className="py-3 px-4 text-right font-mono">
                        {metric === 'revenue' ? (
                          <span className={rev > 0 ? 'text-stone-800 dark:text-stone-200' : 'text-stone-400'}>
                            {formatIDR(rev)}
                          </span>
                        ) : (
                          <span className={ord > 0 ? 'text-stone-800 dark:text-stone-200' : 'text-stone-400'}>
                            {ord} trx
                          </span>
                        )}
                      </td>
                    );
                  })}

                  <td className="py-3 px-4 text-right font-mono font-bold text-stone-800 dark:text-stone-200">
                    {row.totalOrders} trx
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-orange-600 dark:text-orange-400">
                    {formatIDR(row.totalRevenue)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-stone-500 dark:text-stone-400">
                    {formatIDR(row.averageTicket || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-stone-100 dark:bg-stone-850 font-bold text-stone-900 dark:text-white border-t border-stone-200 dark:border-stone-700">
                <td className="py-3 px-4">TOTAL KESELURUHAN</td>
                {data?.vendors?.map((v) => {
                  const totalVRev = activeDataset.reduce((sum, r) => sum + (r[`${v.id}_revenue`] || 0), 0);
                  const totalVOrd = activeDataset.reduce((sum, r) => sum + (r[`${v.id}_orders`] || 0), 0);
                  return (
                    <td key={v.id} className="py-3 px-4 text-right font-mono">
                      {metric === 'revenue' ? formatIDR(totalVRev) : `${totalVOrd} trx`}
                    </td>
                  );
                })}
                <td className="py-3 px-4 text-right font-mono">
                  {activeDataset.reduce((sum, r) => sum + (r.totalOrders || 0), 0)} trx
                </td>
                <td className="py-3 px-4 text-right font-mono text-orange-600 dark:text-orange-400">
                  {formatIDR(activeDataset.reduce((sum, r) => sum + (r.totalRevenue || 0), 0))}
                </td>
                <td className="py-3 px-4 text-right font-mono text-stone-500 dark:text-stone-400">-</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
