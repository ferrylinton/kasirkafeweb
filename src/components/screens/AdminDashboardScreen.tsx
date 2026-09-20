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
  Layers,
  Percent,
  CheckCircle2,
  AlertCircle
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
  Tooltip,
  Legend
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';

type PeriodType = 'day' | 'week' | 'month' | 'year';
type MetricType = 'revenue' | 'orders';
type ChartViewType = 'area' | 'bar' | 'line';

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
    thisYear: { orders: number; revenue: number };
  };
  daily: any[];
  weekly: any[];
  monthly: any[];
  yearly: any[];
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

  // Current active dataset according to selected period
  const activeDataset = useMemo(() => {
    if (!data) return [];
    switch (period) {
      case 'day':
        return data.daily || [];
      case 'week':
        return data.weekly || [];
      case 'month':
        return data.monthly || [];
      case 'year':
        return data.yearly || [];
      default:
        return data.daily || [];
    }
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
                {period === 'year' && 'Rekap Tahunan'}
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Admin Analytics
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400">Multi-Vendor Performance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-stone-900 dark:text-white mt-1">
            Dashboard Transaksi Vendor
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 max-w-2xl mt-0.5">
            Pantau dan bandingkan dinamika penjualan harian, mingguan, bulanan, dan tahunan dari seluruh vendor jaringan SipSpot.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
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
      <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* 1. Periode Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-stone-100 dark:bg-stone-800/80 rounded-xl self-start overflow-x-auto max-w-full">
            <button
              type="button"
              id="period-day-btn"
              onClick={() => setPeriod('day')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                period === 'day'
                  ? 'bg-white dark:bg-stone-700 text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Per Hari (30 Hari)</span>
            </button>

            <button
              type="button"
              id="period-week-btn"
              onClick={() => setPeriod('week')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                period === 'week'
                  ? 'bg-white dark:bg-stone-700 text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Per Minggu (12 Minggu)</span>
            </button>

            <button
              type="button"
              id="period-month-btn"
              onClick={() => setPeriod('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                period === 'month'
                  ? 'bg-white dark:bg-stone-700 text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Per Bulan (12 Bulan)</span>
            </button>

            <button
              type="button"
              id="period-year-btn"
              onClick={() => setPeriod('year')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                period === 'year'
                  ? 'bg-white dark:bg-stone-700 text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Per Tahun</span>
            </button>
          </div>

          {/* 2. Controls: Vendor Selector + Metric Toggle + Chart Type */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Vendor Filter Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Vendor:</span>
              <select
                id="admin-dashboard-vendor-select"
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                <option value="all">🌟 Semua Vendor (Komparasi)</option>
                {data?.vendors?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Metric Toggle: Nominal vs Jumlah Trx */}
            <div className="flex items-center p-0.5 bg-stone-100 dark:bg-stone-800 rounded-xl">
              <button
                type="button"
                id="metric-revenue-btn"
                onClick={() => setMetric('revenue')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  metric === 'orders'
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                }`}
              >
                Jumlah Trx
              </button>
            </div>

            {/* Chart Type Toggle */}
            <div className="flex items-center p-0.5 bg-stone-100 dark:bg-stone-800 rounded-xl">
              <button
                type="button"
                id="chart-type-area-btn"
                title="Area Chart"
                onClick={() => setChartType('area')}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
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
                onClick={() => setChartType('bar')}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
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
                onClick={() => setChartType('line')}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
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
                {period === 'year' && `Tahun ini: ${formatIDR(data?.summary.thisYear.revenue || 0)}`}
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
                {period === 'year' && `Tahun ini: ${data?.summary.thisYear.orders || 0} pesanan`}
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
              {data?.summary.topVendor?.name || 'SipSpot Central'}
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

      {/* Main Chart Card */}
      <div className="bg-white dark:bg-stone-900 p-5 sm:p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold font-heading text-stone-900 dark:text-white flex items-center gap-2">
              <span>
                Grafik Penjualan {period === 'day' && 'Per Hari'}
                {period === 'week' && 'Per Minggu'}
                {period === 'month' && 'Per Bulan'}
                {period === 'year' && 'Per Tahun'}
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
              {period === 'month' && 'Per Bulan'}
              {period === 'year' && 'Per Tahun'})
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Rincian angka transaksi dan pendapatan tiap entitas dalam rentang waktu yang dipilih.
            </p>
          </div>
          <span className="text-xs font-bold text-stone-500 dark:text-stone-400 self-start sm:self-auto">
            Total {activeDataset.length} Baris Data
          </span>
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
              {activeDataset.map((row: any, idx: number) => (
                <tr
                  key={row.date || row.weekKey || row.monthKey || row.yearKey || idx}
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
