import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Trophy,
  Award,
  Calendar,
  CalendarDays,
  CalendarRange,
  RefreshCw,
  Download,
  FileSpreadsheet,
  FileCode,
  Printer,
  TrendingUp,
  Clock,
  ShieldCheck,
  Building2,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Layers,
  Store,
  DollarSign,
  Package,
  Search,
  Sparkles,
  Zap,
  Trash2,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { VendorOption, KNOWN_VENDORS, getVendorName } from '../common/AdminAllVendorsHeader';

export type TopProductPeriod = 'day' | 'week' | 'month';

interface TopProductItem {
  rank: number;
  productId: string;
  name: string;
  category: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  quantitySold: number;
  totalRevenue: number;
  averagePrice: number;
  orderCount: number;
  percentageOfTotal: number;
  percentageOfRevenue: number;
  color: string;
}

interface RetentionInfo {
  retentionDays: number;
  retentionMonths: number;
  cutoffDate: string;
  lastRunTime: string | null;
  lastDeletedCount: number;
  totalPurgedLifetime: number;
  activeOrdersCount: number;
  nextScheduledRun: string | null;
  schedulerStatus: string;
  intervalHours: number;
}

interface TopProductsApiResponse {
  success: boolean;
  period: TopProductPeriod;
  periodLabel: string;
  dateRange: {
    startDate: string;
    endDate: string;
    cutoffDate: string;
  };
  requestedVendorId: string;
  vendors: Array<{ id: string; name: string; code: string; color: string }>;
  topProducts: TopProductItem[];
  allProductsCount: number;
  summary: {
    totalItemsSold: number;
    totalRevenue: number;
    totalTransactions: number;
    uniqueProductsCount: number;
    topCategory: { name: string; quantity: number; revenue: number };
    topProduct: {
      name: string;
      category?: string;
      vendorName?: string;
      quantitySold: number;
      totalRevenue: number;
    } | null;
  };
  categoryBreakdown: Array<{
    category: string;
    quantity: number;
    revenue: number;
    percentage: number;
  }>;
  retention: RetentionInfo;
}

export const TopProductsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const [period, setPeriod] = useState<TopProductPeriod>('day');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [chartMetric, setChartMetric] = useState<'qty' | 'revenue'>('qty');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isTriggeringRetention, setIsTriggeringRetention] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [data, setData] = useState<TopProductsApiResponse | null>(null);

  const formatIDR = (val: number) => 'Rp ' + Number(val || 0).toLocaleString('id-ID');

  const fetchTopProducts = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);
    setFetchError(null);

    try {
      const url = `/api/admin/analytics/top-products?period=${period}&vendorId=${selectedVendor}&limit=10`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
          'Cache-Control': 'no-cache'
        }
      });

      if (!res.ok) {
        throw new Error(`Gagal memuat data produk terlaris (${res.status})`);
      }

      const json = await res.json();
      if (json.success) {
        setData(json);
        if (isManual) {
          showToast('Data Top 10 Produk berhasil diperbarui', 'success');
        }
      } else {
        throw new Error(json.error || 'Terjadi kesalahan pada server');
      }
    } catch (err: any) {
      console.error('[TopProductsScreen] Fetch error:', err);
      setFetchError(err.message || 'Gagal memuat data produk terlaris');
      if (isManual) {
        showToast(err.message || 'Gagal menyegarkan data', 'error');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTopProducts(false);
    }
  }, [token, period, selectedVendor]);

  // Export CSV handler
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const url = `/api/admin/analytics/top-products/export?period=${period}&vendorId=${selectedVendor}&format=csv`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token || ''}` }
      });

      if (!res.ok) {
        throw new Error('Gagal mengunduh berkas CSV');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `sipspot_top10_produk_${period}_${selectedVendor}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      showToast('Laporan CSV Top 10 Produk berhasil diunduh', 'success');
    } catch (err: any) {
      console.error('Export CSV error:', err);
      showToast(err.message || 'Gagal mengekspor CSV', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Export JSON handler
  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const exportPayload = {
        title: 'Laporan Top 10 Produk Terlaris - SipSpot POS',
        generatedAt: new Date().toISOString(),
        period,
        periodLabel: data?.periodLabel,
        vendorFilter: selectedVendor,
        retentionPolicy: '3 Bulan (90 Hari)',
        summary: data?.summary,
        topProducts: data?.topProducts,
        categoryBreakdown: data?.categoryBreakdown,
        retentionStatus: data?.retention
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = `sipspot_top10_produk_${period}_${selectedVendor}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      showToast('Laporan JSON berhasil diekspor', 'success');
    } catch (err: any) {
      console.error('Export JSON error:', err);
      showToast('Gagal mengekspor JSON', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Print report
  const handlePrint = () => {
    window.print();
  };

  // Manual Trigger Retention Cleanup
  const handleTriggerRetention = async () => {
    if (isTriggeringRetention) return;
    const confirmed = window.confirm(
      'Jalankan skeduler pembersihan sekarang?\n\nSemua riwayat pesanan yang lebih lama dari 3 bulan (90 hari) akan dihapus secara permanen sesuai kebijakan retensi data.'
    );
    if (!confirmed) return;

    setIsTriggeringRetention(true);
    try {
      const res = await fetch('/api/admin/analytics/retention-run', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token || ''}`,
          'Content-Type': 'application/json'
        }
      });
      const json = await res.json();
      if (json.success) {
        showToast(
          `Skeduler selesai: ${json.result?.deletedCount || 0} pesanan usang dibersihkan.`,
          'success'
        );
        fetchTopProducts(true);
      } else {
        throw new Error(json.error || 'Gagal menjalankan skeduler retensi');
      }
    } catch (err: any) {
      console.error('Retention trigger error:', err);
      showToast(err.message || 'Gagal menjalankan pembersihan retensi', 'error');
    } finally {
      setIsTriggeringRetention(false);
    }
  };

  // Filtered products if user enters search text
  const filteredProducts = useMemo(() => {
    if (!data?.topProducts) return [];
    if (!searchQuery.trim()) return data.topProducts;
    const q = searchQuery.toLowerCase();
    return data.topProducts.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.vendorName.toLowerCase().includes(q)
    );
  }, [data?.topProducts, searchQuery]);

  // Max quantity for relative visual progress bar
  const maxQty = useMemo(() => {
    if (!data?.topProducts || data.topProducts.length === 0) return 1;
    return Math.max(...data.topProducts.map(p => p.quantitySold));
  }, [data?.topProducts]);

  // Chart dataset
  const chartData = useMemo(() => {
    if (!data?.topProducts) return [];
    return data.topProducts.map(p => ({
      name: p.name.length > 15 ? p.name.substring(0, 15) + '…' : p.name,
      fullName: p.name,
      rank: p.rank,
      qty: p.quantitySold,
      revenue: p.totalRevenue,
      category: p.category,
      vendor: p.vendorName,
      color: p.color
    }));
  }, [data?.topProducts]);

  return (
    <div id="top-products-page" className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. Page Header (Admin Only & Multi-Vendor) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              ROLE ADMIN • LINTAS VENDOR
            </span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-stone-500" />
              Retensi 3 Bulan (90 Hari)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-stone-100 font-heading tracking-tight flex items-center gap-2">
            <Trophy className="w-7 h-7 text-amber-500" />
            <span>Top 10 Produk Terlaris</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            Analisis peringkat 10 produk paling laku per Hari, Minggu, dan Bulan. Data usang otomatis dihapus oleh skeduler sistem.
          </p>
        </div>

        {/* Action Controls: Refresh, Export, Print */}
        <div className="flex items-center flex-wrap gap-2 print:hidden">
          <button
            type="button"
            id="refresh-top-products-btn"
            onClick={() => fetchTopProducts(true)}
            disabled={isLoading || isRefreshing}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-2 transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Muat ulang data terkini"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-600' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            id="export-csv-btn"
            onClick={handleExportCSV}
            disabled={isExporting || isLoading || !data?.topProducts?.length}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Ekspor ke berkas CSV (Excel compatible)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>

          <button
            type="button"
            id="export-json-btn"
            onClick={handleExportJSON}
            disabled={isExporting || isLoading || !data?.topProducts?.length}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-2 transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Ekspor ke berkas JSON"
          >
            <FileCode className="w-3.5 h-3.5 text-stone-500" />
            <span>JSON</span>
          </button>

          <button
            type="button"
            id="print-report-btn"
            onClick={handlePrint}
            disabled={isLoading || !data?.topProducts?.length}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Cetak Laporan Resmi"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Laporan</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Bar: Period Selector (Hari, Per Minggu, Per Bulan) & Vendor Selector */}
      <div className="bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 print:hidden">
        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 dark:bg-stone-900/80 rounded-xl overflow-x-auto">
          <button
            type="button"
            id="period-day-tab"
            onClick={() => setPeriod('day')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              period === 'day'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-white/50 dark:hover:bg-stone-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Hari Ini</span>
          </button>

          <button
            type="button"
            id="period-week-tab"
            onClick={() => setPeriod('week')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              period === 'week'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-white/50 dark:hover:bg-stone-800'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Per Minggu</span>
          </button>

          <button
            type="button"
            id="period-month-tab"
            onClick={() => setPeriod('month')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              period === 'month'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-white/50 dark:hover:bg-stone-800'
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            <span>Per Bulan</span>
          </button>
        </div>

        {/* Vendor Selector & Search */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Vendor Filter */}
          <div className="flex items-center gap-2 min-w-[200px]">
            <Building2 className="w-4 h-4 text-stone-400 shrink-0" />
            <select
              id="vendor-filter-select"
              value={selectedVendor}
              onChange={e => setSelectedVendor(e.target.value)}
              className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="all">Semua Vendor (Lintas Usaha)</option>
              {KNOWN_VENDORS.filter(v => v.id !== 'vnd_admin').map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Search in Top 10 */}
          <div className="relative min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="search-top-products-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari item..."
              className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Date Range & Period Badge */}
      {data?.periodLabel && (
        <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="font-semibold text-stone-800 dark:text-stone-200">
              Periode Analisis: {data.periodLabel}
            </span>
          </div>
          <span className="text-[11px] text-stone-500">
            Menampilkan 10 item produk terlaris
          </span>
        </div>
      )}

      {/* Error state */}
      {fetchError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="text-xs font-semibold">{fetchError}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchTopProducts(true)}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* 3. Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Volume Terjual */}
        <div className="bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Total Volume Terjual
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-stone-100 font-heading">
              {isLoading ? (
                <div className="h-8 w-24 bg-stone-200 dark:bg-stone-800 rounded-md animate-pulse" />
              ) : (
                `${data?.summary?.totalItemsSold || 0} pcs`
              )}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Dari {data?.summary?.totalTransactions || 0} nota transaksi di periode ini
            </p>
          </div>
        </div>

        {/* Card 2: Total Omzet Penjualan */}
        <div className="bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Total Omzet Penjualan
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-stone-100 font-heading">
              {isLoading ? (
                <div className="h-8 w-32 bg-stone-200 dark:bg-stone-800 rounded-md animate-pulse" />
              ) : (
                formatIDR(data?.summary?.totalRevenue || 0)
              )}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Rata-rata {data?.summary?.totalTransactions ? formatIDR(Math.round((data.summary.totalRevenue || 0) / data.summary.totalTransactions)) : 'Rp 0'} per nota
            </p>
          </div>
        </div>

        {/* Card 3: Produk #1 Paling Laku */}
        <div className="bg-white dark:bg-[#251e1c] border border-amber-200/80 dark:border-amber-900/60 rounded-2xl p-5 shadow-xs flex flex-col justify-between bg-radial-[at_top_right] from-amber-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              Juara #1 Paling Laku
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-xl font-black text-stone-900 dark:text-stone-100 truncate font-heading" title={data?.summary?.topProduct?.name || '-'}>
              {isLoading ? (
                <div className="h-6 w-36 bg-stone-200 dark:bg-stone-800 rounded-md animate-pulse" />
              ) : (
                data?.summary?.topProduct?.name || 'Belum ada data'
              )}
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold mt-1">
              Terjual {data?.summary?.topProduct?.quantitySold || 0} pcs • {formatIDR(data?.summary?.topProduct?.totalRevenue || 0)}
            </p>
          </div>
        </div>

        {/* Card 4: Kategori Terlaris */}
        <div className="bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Kategori Terlaris
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-stone-100 font-heading">
              {isLoading ? (
                <div className="h-8 w-24 bg-stone-200 dark:bg-stone-800 rounded-md animate-pulse" />
              ) : (
                data?.summary?.topCategory?.name || '-'
              )}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Volume {data?.summary?.topCategory?.quantity || 0} pcs ({formatIDR(data?.summary?.topCategory?.revenue || 0)})
            </p>
          </div>
        </div>
      </div>

      {/* 4. Visual Comparison Chart: Top 10 Products Bar Chart */}
      <div className="bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              <span>Grafik Perbandingan Top 10 Produk</span>
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Visualisasi distribusi penjualan {chartMetric === 'qty' ? 'kuantitas (pcs)' : 'nilai omzet (Rp)'}
            </p>
          </div>

          {/* Metric Toggle */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-900 rounded-xl text-xs font-bold print:hidden">
            <button
              type="button"
              onClick={() => setChartMetric('qty')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartMetric === 'qty'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              Kuantitas (Pcs)
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('revenue')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartMetric === 'revenue'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              Omzet (Rp)
            </button>
          </div>
        </div>

        {/* Chart Container */}
        {isLoading ? (
          <div className="h-64 w-full flex items-center justify-center bg-stone-50 dark:bg-stone-900/40 rounded-xl animate-pulse">
            <span className="text-xs font-semibold text-stone-400">Memuat visualisasi data...</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-64 w-full flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-900/40 rounded-xl text-stone-400 text-xs">
            <Package className="w-8 h-8 mb-2 opacity-40" />
            <span>Belum ada transaksi penjualan pada periode yang dipilih.</span>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150, 150, 150, 0.15)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={45}
                  className="text-stone-500 dark:text-stone-400"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  tickFormatter={val => (chartMetric === 'revenue' ? (val >= 1000 ? `${Math.round(val / 1000)}k` : val) : val)}
                  className="text-stone-500 dark:text-stone-400"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-3 shadow-lg text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-stone-900 dark:text-stone-100">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                            <span>#{item.rank} {item.fullName}</span>
                          </div>
                          <div className="text-[11px] text-stone-500">
                            Kategori: <span className="font-semibold text-stone-700 dark:text-stone-300">{item.category}</span>
                          </div>
                          <div className="text-[11px] text-stone-500">
                            Vendor: <span className="font-semibold text-stone-700 dark:text-stone-300">{item.vendor}</span>
                          </div>
                          <div className="border-t border-stone-100 dark:border-stone-800 pt-1 mt-1 font-semibold text-purple-600 dark:text-purple-400">
                            {chartMetric === 'qty' ? `Terjual: ${item.qty} pcs` : `Omzet: ${formatIDR(item.revenue)}`}
                          </div>
                          <div className="text-[10px] text-stone-400">
                            {chartMetric === 'qty' ? `Total Omzet: ${formatIDR(item.revenue)}` : `Total Qty: ${item.qty} pcs`}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey={chartMetric} radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || '#9333ea'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 5. Top 10 Product Table */}
      <div className="bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-600" />
              <span>Daftar Peringkat 10 Produk Terlaris</span>
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Diurutkan berdasarkan total unit yang terjual pada periode {data?.periodLabel || '-'}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-850 text-xs font-bold text-stone-600 dark:text-stone-300">
            {filteredProducts.length} Produk
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 dark:bg-stone-900/60 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800">
                <th className="py-3 px-4 text-center w-16">Rank</th>
                <th className="py-3 px-4">Nama Produk & Kategori</th>
                <th className="py-3 px-4">Vendor / Cabang</th>
                <th className="py-3 px-4 text-right">Qty Terjual</th>
                <th className="py-3 px-4 text-right">Rata-rata Harga</th>
                <th className="py-3 px-4 text-right">Total Omzet</th>
                <th className="py-3 px-4 text-right">Transaksi</th>
                <th className="py-3 px-4 text-right w-28">Pangsa Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 text-xs">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4 text-center"><div className="h-6 w-6 bg-stone-200 dark:bg-stone-800 rounded-full mx-auto" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-32 bg-stone-200 dark:bg-stone-800 rounded mb-1" /><div className="h-3 w-16 bg-stone-100 dark:bg-stone-900 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-24 bg-stone-200 dark:bg-stone-800 rounded" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-4 w-12 bg-stone-200 dark:bg-stone-800 rounded ml-auto" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-4 w-16 bg-stone-200 dark:bg-stone-800 rounded ml-auto" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-4 w-20 bg-stone-200 dark:bg-stone-800 rounded ml-auto" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-4 w-10 bg-stone-200 dark:bg-stone-800 rounded ml-auto" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-4 w-12 bg-stone-200 dark:bg-stone-800 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-sm">Tidak ada produk yang terjual pada periode ini</p>
                    <p className="text-xs text-stone-500 mt-0.5">Coba ganti filter periode ke Mingguan atau Bulanan</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(item => {
                  const isGold = item.rank === 1;
                  const isSilver = item.rank === 2;
                  const isBronze = item.rank === 3;

                  return (
                    <tr
                      key={`${item.productId}_${item.rank}`}
                      className="hover:bg-stone-50/80 dark:hover:bg-stone-850/50 transition-colors"
                    >
                      {/* Rank Badge */}
                      <td className="py-3 px-4 text-center">
                        {isGold ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 font-black text-xs border border-amber-300 dark:border-amber-700 shadow-2xs" title="Juara 1">
                            #1
                          </span>
                        ) : isSilver ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-300 dark:border-slate-700" title="Juara 2">
                            #2
                          </span>
                        ) : isBronze ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-900/10 dark:bg-amber-950/40 text-amber-800 dark:text-amber-600 font-bold text-xs border border-amber-800/30" title="Juara 3">
                            #3
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-stone-500 dark:text-stone-400 font-semibold text-xs">
                            #{item.rank}
                          </span>
                        )}
                      </td>

                      {/* Product Name & Category */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                          {item.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                            {item.category}
                          </span>
                        </div>
                      </td>

                      {/* Vendor Badge */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-200 dark:border-stone-700 whitespace-nowrap">
                          <Building2 className="w-3 h-3 opacity-60" />
                          <span className="truncate max-w-[140px]">{item.vendorName}</span>
                        </span>
                      </td>

                      {/* Quantity Sold + Progress relative to #1 */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-extrabold text-stone-900 dark:text-stone-100 text-sm">
                          {item.quantitySold} <span className="text-[11px] font-normal text-stone-500">pcs</span>
                        </div>
                        <div className="w-20 ml-auto mt-1 bg-stone-100 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.round((item.quantitySold / maxQty) * 100))}%`,
                              backgroundColor: item.color
                            }}
                          />
                        </div>
                      </td>

                      {/* Average Price */}
                      <td className="py-3 px-4 text-right text-stone-600 dark:text-stone-300 font-medium">
                        {formatIDR(item.averagePrice)}
                      </td>

                      {/* Total Revenue */}
                      <td className="py-3 px-4 text-right font-bold text-stone-900 dark:text-stone-100">
                        {formatIDR(item.totalRevenue)}
                      </td>

                      {/* Transaction Count */}
                      <td className="py-3 px-4 text-right text-stone-600 dark:text-stone-400">
                        {item.orderCount} nota
                      </td>

                      {/* Percentage of Volume */}
                      <td className="py-3 px-4 text-right font-semibold text-purple-700 dark:text-purple-300">
                        {item.percentageOfTotal}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. 3-Month Data Retention Policy & Automated Scheduler Information Panel */}
      <div className="bg-stone-900 dark:bg-[#181312] text-white rounded-2xl p-5 sm:p-6 border border-stone-800 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                SKEDULER OTOMATIS AKTIF
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-800 text-stone-300">
                Pembersihan Tiap 6 Jam
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold font-heading text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Kebijakan Retensi Data 3 Bulan Terakhir</span>
            </h3>

            <p className="text-xs text-stone-300 leading-relaxed">
              Sistem membatasi penyimpanan transaksi maksimal <strong>90 hari (3 bulan terakhir)</strong>. Pesanan yang melampaui batas cutoff otomatis dihapus oleh skeduler berkala untuk menjaga kecepatan performa basis data dan kepatuhan privasi POS.
            </p>

            {/* Detailed metadata */}
            {data?.retention && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-[11px]">
                <div className="bg-stone-800/60 p-2 rounded-xl border border-stone-700/50">
                  <span className="text-stone-400 block text-[10px]">Batas Cutoff Transaksi:</span>
                  <span className="font-bold text-amber-300">
                    {new Date(data.retention.cutoffDate).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                <div className="bg-stone-800/60 p-2 rounded-xl border border-stone-700/50">
                  <span className="text-stone-400 block text-[10px]">Pembersihan Terakhir:</span>
                  <span className="font-semibold text-stone-200">
                    {data.retention.lastRunTime
                      ? new Date(data.retention.lastRunTime).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Baru Saja'}
                  </span>
                </div>

                <div className="bg-stone-800/60 p-2 rounded-xl border border-stone-700/50">
                  <span className="text-stone-400 block text-[10px]">Data Usang Dibersihkan:</span>
                  <span className="font-bold text-emerald-400">
                    {data.retention.totalPurgedLifetime} pesanan
                  </span>
                </div>

                <div className="bg-stone-800/60 p-2 rounded-xl border border-stone-700/50">
                  <span className="text-stone-400 block text-[10px]">Pesanan Aktif (3 Bulan):</span>
                  <span className="font-bold text-white">
                    {data.retention.activeOrdersCount} pesanan
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Trigger Scheduler Button */}
          <div className="shrink-0 flex flex-col items-start md:items-end gap-2">
            <button
              type="button"
              id="trigger-retention-btn"
              onClick={handleTriggerRetention}
              disabled={isTriggeringRetention}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-stone-950 flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Jalankan skeduler pembersihan pesanan usang sekarang"
            >
              <Zap className={`w-4 h-4 ${isTriggeringRetention ? 'animate-bounce' : ''}`} />
              <span>{isTriggeringRetention ? 'Membersihkan...' : 'Jalankan Skeduler Sekarang'}</span>
            </button>
            <span className="text-[10px] text-stone-400">
              Audit trail tercatat di Log Aktivitas DB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
