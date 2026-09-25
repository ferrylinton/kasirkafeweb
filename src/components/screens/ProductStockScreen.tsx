import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  AlertCircle,
  PackageCheck,
  PackageX,
  Plus,
  Minus,
  RefreshCw,
  Search,
  Sliders,
  History,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Edit3,
  X,
  Sparkles,
  ArrowRight,
  Layers,
  FileSpreadsheet,
  Eye,
  Lock,
  PauseCircle,
  PlayCircle,
  Clock,
  Coffee,
  HelpCircle,
  Info
} from 'lucide-react';
import { Product, InventoryLog, Category } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { ProductImage } from '../common/ProductImage';
import { AdminAllVendorsHeader, VendorBadge } from '../common/AdminAllVendorsHeader';
import { clearClientCatalogCache } from '../../utils/productCache';

const TEMPORARY_UNAVAILABLE_REASONS = [
  'Bahan baku habis, menunggu pengiriman',
  'Mesin / peralatan sedang maintenance',
  'Habis terjual untuk shift/hari ini',
  'Kualitas bahan baku tidak memenuhi standar',
  'Sedang disiapkan / proses brewing',
  'Musiman / tidak diproduksi hari ini'
];

interface ProductStockScreenProps {
  allVendorsMode?: boolean;
}

export const ProductStockScreen: React.FC<ProductStockScreenProps> = ({ allVendorsMode = false }) => {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  // Role Rule: Hanya role MANAGER yang berhak memodifikasi stok dan mengubah status ketersediaan. ADMIN mode Read-Only.
  const isReadOnly = user?.role !== 'MANAGER' || allVendorsMode;

  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'stock' | 'logs'>('stock');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'temp_unavailable' | 'low' | 'out' | 'healthy'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'critical' | 'name' | 'stockAsc' | 'stockDesc'>('critical');

  // Manual Stock Modal State
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [manualStockValue, setManualStockValue] = useState<number>(0);
  const [manualThresholdValue, setManualThresholdValue] = useState<number>(10);
  const [manualReason, setManualReason] = useState<string>('');
  const [isSubmittingStock, setIsSubmittingStock] = useState<boolean>(false);

  // Temporary Unavailable Modal State
  const [tempUnavailableProduct, setTempUnavailableProduct] = useState<Product | null>(null);
  const [tempUnavailableReason, setTempUnavailableReason] = useState<string>(TEMPORARY_UNAVAILABLE_REASONS[0]);
  const [customUnavailableReason, setCustomUnavailableReason] = useState<string>('');
  const [isSubmittingAvailability, setIsSubmittingAvailability] = useState<boolean>(false);

  // Quick Action Loading Tracker
  const [quickAdjustingId, setQuickAdjustingId] = useState<string | null>(null);

  // Bulk Threshold Modal
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [bulkThresholdInput, setBulkThresholdInput] = useState<number>(15);
  const [bulkCategoryTarget, setBulkCategoryTarget] = useState<string>('all');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState<boolean>(false);

  // Fetch data from backend
  const fetchStockData = async () => {
    setLoading(true);
    try {
      const vendorParam = allVendorsMode
        ? (selectedVendor === 'all' ? '?allVendors=true' : `?vendorId=${selectedVendor}`)
        : '';

      const [prodsRes, logsRes, catsRes] = await Promise.all([
        fetch(`/api/products${vendorParam}${vendorParam ? '&refresh=true' : '?refresh=true'}`, {
          headers: { Authorization: `Bearer ${token || ''}` }
        }),
        fetch(`/api/products/inventory/logs${vendorParam}`, {
          headers: { Authorization: `Bearer ${token || ''}` }
        }),
        fetch('/api/products/categories?bypassCache=true', {
          headers: { Authorization: `Bearer ${token || ''}` }
        })
      ]);

      const prodsData = await prodsRes.json();
      const logsData = await logsRes.json();
      const catsData = await catsRes.json();

      if (prodsData.success && Array.isArray(prodsData.products)) {
        setProducts(prodsData.products);
      }
      if (logsData.success && Array.isArray(logsData.logs)) {
        setLogs(logsData.logs);
      }
      if (catsData.success && Array.isArray(catsData.categories)) {
        setCategories(catsData.categories);
      }
    } catch (err) {
      console.warn('Failed to load stock data:', err);
      showToast('Gagal memuat data stok terbaru dari server', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, [token, allVendorsMode, selectedVendor]);

  // Quick Stock Adjustment (+/-)
  const handleQuickAdjust = async (product: Product, delta: number) => {
    if (isReadOnly) return;
    const currentStock = product.stock || 0;
    const newStock = Math.max(0, currentStock + delta);
    if (newStock === currentStock) return;

    setQuickAdjustingId(product.id);
    try {
      const res = await fetch(`/api/products/${product.id}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          stock: newStock,
          adjustment: delta,
          reason: delta > 0 ? `Quick Add (+${delta}) dari Stok Produk` : `Quick Min (${delta}) dari Stok Produk`
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Stok '${product.name}' diubah menjadi ${newStock} unit`, 'success');
        clearClientCatalogCache();
        // Optimistic update
        setProducts(prev =>
          prev.map(p => (p.id === product.id ? { ...p, stock: newStock } : p))
        );
      } else {
        showToast(data.error || 'Gagal mengubah jumlah stok', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan koneksi saat mengubah stok', 'error');
    } finally {
      setQuickAdjustingId(null);
    }
  };

  // Open Manual Stock Modal
  const openStockModal = (product: Product) => {
    if (isReadOnly) {
      showToast('Akses ditolak: Hanya role MANAGER yang berhak mengubah stok produk.', 'warning');
      return;
    }
    setStockModalProduct(product);
    setManualStockValue(product.stock || 0);
    setManualThresholdValue(typeof product.lowStockThreshold === 'number' ? product.lowStockThreshold : 10);
    setManualReason('Restock berkala dari supplier');
  };

  // Submit Manual Stock Modification
  const handleSubmitManualStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModalProduct || isReadOnly) return;

    setIsSubmittingStock(true);
    try {
      const targetStock = Math.max(0, Math.floor(Number(manualStockValue)));
      const targetThreshold = Math.max(1, Math.floor(Number(manualThresholdValue)));

      const res = await fetch(`/api/products/${stockModalProduct.id}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          stock: targetStock,
          lowStockThreshold: targetThreshold,
          reason: manualReason.trim() || 'Modifikasi stok manual manager'
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Stok '${stockModalProduct.name}' berhasil diperbarui menjadi ${targetStock} unit!`, 'success');
        clearClientCatalogCache();
        setStockModalProduct(null);
        fetchStockData();
      } else {
        showToast(data.error || 'Gagal menyimpan pembaruan stok', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setIsSubmittingStock(false);
    }
  };

  // Open Temporary Unavailable Modal
  const openTemporaryUnavailableModal = (product: Product) => {
    if (isReadOnly) {
      showToast('Akses ditolak: Hanya role MANAGER yang berhak mengubah status ketersediaan.', 'warning');
      return;
    }

    // If currently unavailable, directly restore to available
    if (product.isAvailable === false) {
      handleRestoreAvailability(product);
      return;
    }

    // If currently available, open modal to specify reason
    setTempUnavailableProduct(product);
    setTempUnavailableReason(TEMPORARY_UNAVAILABLE_REASONS[0]);
    setCustomUnavailableReason('');
  };

  // Restore product to available (Tersedia)
  const handleRestoreAvailability = async (product: Product) => {
    setIsSubmittingAvailability(true);
    try {
      const res = await fetch(`/api/products/${product.id}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          isAvailable: true,
          temporaryUnavailableReason: null,
          reason: 'Produk diaktifkan kembali (Tersedia di Kasir)'
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Produk '${product.name}' kembali TERSEDIA di kasir!`, 'success');
        clearClientCatalogCache();
        setProducts(prev =>
          prev.map(p =>
            p.id === product.id ? { ...p, isAvailable: true, temporaryUnavailableReason: undefined } : p
          )
        );
      } else {
        showToast(data.error || 'Gagal mengaktifkan produk', 'error');
      }
    } catch (err) {
      showToast('Gagal terhubung ke server', 'error');
    } finally {
      setIsSubmittingAvailability(false);
    }
  };

  // Submit product as temporary unavailable (Tidak Tersedia Sementara)
  const handleSubmitTemporaryUnavailable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUnavailableProduct || isReadOnly) return;

    const finalReason = customUnavailableReason.trim() || tempUnavailableReason;

    setIsSubmittingAvailability(true);
    try {
      const res = await fetch(`/api/products/${tempUnavailableProduct.id}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          isAvailable: false,
          temporaryUnavailableReason: finalReason,
          reason: `Diset tidak tersedia sementara: ${finalReason}`
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(
          `Produk '${tempUnavailableProduct.name}' ditandai TIDAK TERSEDIA SEMENTARA di kasir.`,
          'warning'
        );
        clearClientCatalogCache();
        setTempUnavailableProduct(null);
        setProducts(prev =>
          prev.map(p =>
            p.id === tempUnavailableProduct.id
              ? { ...p, isAvailable: false, temporaryUnavailableReason: finalReason }
              : p
          )
        );
      } else {
        showToast(data.error || 'Gagal mengubah status ketersediaan', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setIsSubmittingAvailability(false);
    }
  };

  // Submit Bulk Threshold
  const handleBulkThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    setIsSubmittingBulk(true);
    try {
      const res = await fetch('/api/products/inventory/bulk-threshold', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          threshold: bulkThresholdInput,
          category: bulkCategoryTarget === 'all' ? undefined : bulkCategoryTarget
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Batas threshold (${bulkThresholdInput} unit) berhasil diterapkan ke seluruh produk!`, 'success');
        clearClientCatalogCache();
        setShowBulkModal(false);
        fetchStockData();
      } else {
        showToast(data.error || 'Gagal menerapkan batas threshold', 'error');
      }
    } catch (err) {
      showToast('Gagal memproses bulk threshold', 'error');
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    return products
      .filter(p => {
        // Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = p.name.toLowerCase().includes(q);
          const matchCat = (p.category || '').toLowerCase().includes(q);
          const matchTag = (p.tag || '').toLowerCase().includes(q);
          const matchReason = (p.temporaryUnavailableReason || '').toLowerCase().includes(q);
          if (!matchName && !matchCat && !matchTag && !matchReason) return false;
        }

        // Category filter
        if (categoryFilter !== 'all' && (p.category || '').toLowerCase() !== categoryFilter.toLowerCase()) {
          return false;
        }

        // Status filter
        const threshold = typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 10;
        const isOut = p.stock <= 0;
        const isLow = p.stock > 0 && p.stock <= threshold;
        const isAvailable = p.isAvailable !== false;

        if (statusFilter === 'available' && !isAvailable) return false;
        if (statusFilter === 'temp_unavailable' && isAvailable) return false;
        if (statusFilter === 'low' && !isLow) return false;
        if (statusFilter === 'out' && !isOut) return false;
        if (statusFilter === 'healthy' && (isLow || isOut)) return false;

        return true;
      })
      .sort((a, b) => {
        const thresholdA = typeof a.lowStockThreshold === 'number' ? a.lowStockThreshold : 10;
        const thresholdB = typeof b.lowStockThreshold === 'number' ? b.lowStockThreshold : 10;
        const aCritical = a.isAvailable === false ? 0 : a.stock <= 0 ? 1 : a.stock <= thresholdA ? 2 : 3;
        const bCritical = b.isAvailable === false ? 0 : b.stock <= 0 ? 1 : b.stock <= thresholdB ? 2 : 3;

        if (sortBy === 'critical') {
          if (aCritical !== bCritical) return aCritical - bCritical;
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'stockAsc') return a.stock - b.stock;
        if (sortBy === 'stockDesc') return b.stock - a.stock;
        return 0;
      });
  }, [products, searchQuery, categoryFilter, statusFilter, sortBy]);

  // KPI Metrics
  const totalSku = products.length;
  const tempUnavailableCount = products.filter(p => p.isAvailable === false).length;
  const outOfStockCount = products.filter(p => p.stock <= 0 && p.isAvailable !== false).length;
  const lowStockCount = products.filter(p => {
    const t = typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 10;
    return p.stock > 0 && p.stock <= t && p.isAvailable !== false;
  }).length;
  const healthyCount = products.filter(p => {
    const t = typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 10;
    return p.stock > t && p.isAvailable !== false;
  }).length;
  const totalUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Admin Multi-Vendor Selector Header (if Admin) */}
      {allVendorsMode && (
        <AdminAllVendorsHeader
          title="Stok Produk Semua Cabang Vendor"
          subtitle="Tinjau ketersediaan stok fisik, produk habis sementara, dan batas threshold lintas cabang"
          selectedVendor={selectedVendor}
          onVendorChange={setSelectedVendor}
          onRefresh={fetchStockData}
          isLoading={loading}
          itemCount={products.length}
          itemLabel="Produk"
        />
      )}

      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shrink-0 shadow-xs">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black font-heading text-stone-900 dark:text-stone-100">
                  {allVendorsMode ? 'Stok Produk Seluruh Vendor' : 'Stok Produk'}
                </h1>
                {user?.vendorName && !allVendorsMode && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 dark:bg-orange-950/60 text-accent border border-orange-200/80 dark:border-orange-900/60">
                    {user.vendorName}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {allVendorsMode
                  ? 'Pantau pergerakan unit stok fisik dan ketersediaan menu di setiap vendor'
                  : 'Kelola jumlah unit stok fisik, ubah stok cepat (+/-), dan atur produk tidak tersedia sementara waktu'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Read-Only Badge for ADMIN */}
          {isReadOnly && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold shadow-2xs">
              <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Mode Lihat Saja</span>
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchStockData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#251e1c] border border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 shadow-2xs transition-colors cursor-pointer"
            title="Muat ulang data stok"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Bulk Threshold Button (Hanya Manager) */}
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#251e1c] border border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 shadow-2xs transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-accent" />
              <span>Atur Batas Minimum</span>
            </button>
          )}

          {/* Toggle View: Stock Cards vs Logs */}
          <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'stock'
                  ? 'bg-white dark:bg-[#251e1c] text-accent shadow-xs'
                  : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Stok Produk ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-white dark:bg-[#251e1c] text-accent shadow-xs'
                  : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat Mutasi</span>
            </button>
          </div>
        </div>
      </div>

      {/* Read-Only Notice Banner for ADMIN */}
      {isReadOnly && (
        <div className="rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            <span className="font-bold text-stone-900 dark:text-stone-100">Mode Lihat (Read-Only)</span> — Administrator memantau stok fisik gabungan seluruh vendor. Penyesuaian jumlah unit (+/-), restock, dan pengaturan status tidak tersedia sementara waktu khusus dikelola oleh role <strong className="text-amber-700 dark:text-amber-400">MANAGER</strong> vendor terkait.
          </div>
        </div>
      )}

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total SKU & Fisik */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Total Produk</span>
            <div className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-stone-900 dark:text-stone-100 font-heading">
              {totalSku}
            </span>
            <span className="text-[11px] text-stone-400 ml-1.5">({totalUnits} unit fisik)</span>
          </div>
        </div>

        {/* Stok Aman */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#251e1c] border border-emerald-200/60 dark:border-emerald-950/40 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Stok Aman</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-heading">
              {healthyCount}
            </span>
            <span className="text-[11px] text-emerald-600/70 ml-1.5">Di atas ambang batas</span>
          </div>
        </div>

        {/* Stok Menipis */}
        <div
          onClick={() => {
            setStatusFilter('low');
            setActiveTab('stock');
          }}
          className={`p-4 rounded-3xl cursor-pointer transition-all shadow-2xs flex flex-col justify-between ${
            lowStockCount > 0
              ? 'bg-amber-500/10 border-2 border-amber-500/60 hover:border-amber-500'
              : 'bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <span>Stok Menipis</span>
              {lowStockCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-heading">
              {lowStockCount}
            </span>
            <span className="text-[11px] text-amber-600/80 ml-1.5">Perlu restock segera</span>
          </div>
        </div>

        {/* Stok Habis (0) */}
        <div
          onClick={() => {
            setStatusFilter('out');
            setActiveTab('stock');
          }}
          className={`p-4 rounded-3xl cursor-pointer transition-all shadow-2xs flex flex-col justify-between ${
            outOfStockCount > 0
              ? 'bg-red-500/10 border-2 border-red-500/60 hover:border-red-500'
              : 'bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-600 dark:text-red-400">Stok Kosong (0)</span>
            <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-600">
              <PackageX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-red-600 dark:text-red-400 font-heading">
              {outOfStockCount}
            </span>
            <span className="text-[11px] text-red-500/80 ml-1.5">Stok fisik 0 unit</span>
          </div>
        </div>

        {/* Tidak Tersedia Sementara */}
        <div
          onClick={() => {
            setStatusFilter('temp_unavailable');
            setActiveTab('stock');
          }}
          className={`col-span-2 lg:col-span-1 p-4 rounded-3xl cursor-pointer transition-all shadow-2xs flex flex-col justify-between ${
            tempUnavailableCount > 0
              ? 'bg-purple-500/10 border-2 border-purple-500/60 hover:border-purple-500'
              : 'bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-700 dark:text-purple-300">Habis Sementara</span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600">
              <PauseCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-purple-700 dark:text-purple-300 font-heading">
              {tempUnavailableCount}
            </span>
            <span className="text-[11px] text-purple-600/80 ml-1.5">Dijeda dari kasir</span>
          </div>
        </div>
      </div>

      {/* Main Stock Tab Content */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Search, Filter Pills & Sorters */}
          <div className="bg-white dark:bg-[#251e1c] p-4 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Cari nama menu, kategori, alasan habis sementara..."
                  className="w-full pl-10 pr-8 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs focus:outline-none focus:ring-2 focus:ring-accent text-stone-900 dark:text-stone-100 placeholder-stone-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status & Sort Sorters */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Status Filter */}
                <div className="flex items-center gap-1 bg-stone-50 dark:bg-stone-900 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 text-xs">
                  <span className="text-[10px] uppercase font-bold text-stone-400">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="bg-transparent text-stone-700 dark:text-stone-300 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="all">Semua Status ({products.length})</option>
                    <option value="available">Tersedia Saja ({products.filter(p => p.isAvailable !== false).length})</option>
                    <option value="temp_unavailable">Tidak Tersedia Sementara ({tempUnavailableCount})</option>
                    <option value="low">Stok Menipis ({lowStockCount})</option>
                    <option value="out">Stok Habis (0) ({outOfStockCount})</option>
                    <option value="healthy">Stok Aman ({healthyCount})</option>
                  </select>
                </div>

                {/* Sorter */}
                <div className="flex items-center gap-1 bg-stone-50 dark:bg-stone-900 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 text-xs">
                  <span className="text-[10px] uppercase font-bold text-stone-400">Urutkan:</span>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="bg-transparent text-stone-700 dark:text-stone-300 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="critical">Prioritas Kritis</option>
                    <option value="name">Nama (A - Z)</option>
                    <option value="stockAsc">Stok Tersedikit</option>
                    <option value="stockDesc">Stok Terbanyak</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Category Pill Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  categoryFilter === 'all'
                    ? 'bg-accent text-white shadow-xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                }`}
              >
                Semua Kategori ({products.length})
              </button>
              {categories.map(c => {
                const count = products.filter(p => (p.category || '').toLowerCase() === c.code.toLowerCase()).length;
                const isSelected = categoryFilter.toLowerCase() === c.code.toLowerCase();
                return (
                  <button
                    key={c.id || c.code}
                    type="button"
                    onClick={() => setCategoryFilter(c.code)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-accent text-white shadow-xs'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                    }`}
                  >
                    <span>{c.icon || '🏷️'}</span>
                    <span>{c.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-stone-200 dark:bg-stone-700 text-stone-500'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Stock Cards List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw className="w-8 h-8 text-accent animate-spin" />
              <span className="text-xs font-semibold text-stone-500">Memuat status stok fisik produk...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/60 text-accent flex items-center justify-center mx-auto">
                <Boxes className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Tidak ada produk yang cocok dengan filter
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Silakan ganti kata kunci pencarian atau ubah status filter kategori untuk melihat produk lainnya.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map(product => {
                const threshold = typeof product.lowStockThreshold === 'number' ? product.lowStockThreshold : 10;
                const isOut = product.stock <= 0;
                const isLow = product.stock > 0 && product.stock <= threshold;
                const isHealthy = product.stock > threshold;
                const isAvailable = product.isAvailable !== false;
                const isQuickBusy = quickAdjustingId === product.id;

                return (
                  <div
                    key={product.id}
                    className={`flex flex-col justify-between rounded-3xl bg-white dark:bg-[#251e1c] border p-4 sm:p-5 transition-all duration-200 shadow-2xs hover:shadow-md ${
                      !isAvailable
                        ? 'border-purple-300 dark:border-purple-900/60 bg-purple-50/20 dark:bg-purple-950/10'
                        : isOut
                        ? 'border-red-300 dark:border-red-900/60'
                        : isLow
                        ? 'border-amber-300 dark:border-amber-900/60'
                        : 'border-stone-200/80 dark:border-stone-800'
                    }`}
                  >
                    <div>
                      {/* Top Row: Thumbnail, Name, Badges */}
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0 border border-stone-200/60 dark:border-stone-700 relative">
                          <ProductImage
                            src={product.image}
                            alt={product.name}
                            category={product.category}
                            className="w-full h-full object-cover"
                          />
                          {!isAvailable && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white">
                              <PauseCircle className="w-6 h-6 text-purple-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                              {product.category}
                            </span>
                            {product.tag && (
                              <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-orange-100 dark:bg-orange-950 text-accent">
                                {product.tag}
                              </span>
                            )}
                            {allVendorsMode && product.vendorId && (
                              <VendorBadge vendorId={product.vendorId} />
                            )}
                          </div>
                          <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 font-heading truncate mt-1" title={product.name}>
                            {product.name}
                          </h3>
                          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 block">
                            Rp {product.price.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>

                      {/* Temporary Unavailable Warning Banner */}
                      {!isAvailable && (
                        <div className="mt-3 p-2.5 rounded-2xl bg-purple-100/70 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-start gap-2 text-purple-900 dark:text-purple-200">
                          <PauseCircle className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                          <div className="text-[11px] leading-snug">
                            <strong className="block font-bold">Tidak Tersedia Sementara di Kasir</strong>
                            <span className="text-purple-800/80 dark:text-purple-300">
                              Alasan: {product.temporaryUnavailableReason || 'Habis / tidak tersedia sementara'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Stock Level Display & Progress */}
                      <div className="mt-3.5 p-3 rounded-2xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200/60 dark:border-stone-800/60">
                        <div className="flex items-center justify-between">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                              Stok Fisik:
                            </span>
                            <span
                              className={`text-2xl font-black font-heading ${
                                isOut
                                  ? 'text-red-600 dark:text-red-400'
                                  : isLow
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {product.stock}
                            </span>
                            <span className="text-[11px] text-stone-400">unit</span>
                          </div>

                          {/* Status Badge */}
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                              !isAvailable
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : isOut
                                ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                : isLow
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                          >
                            {!isAvailable ? (
                              <>
                                <PauseCircle className="w-3 h-3" />
                                <span>Habis Sementara</span>
                              </>
                            ) : isOut ? (
                              <>
                                <PackageX className="w-3 h-3" />
                                <span>Stok Kosong</span>
                              </>
                            ) : isLow ? (
                              <>
                                <AlertCircle className="w-3 h-3" />
                                <span>Stok Menipis</span>
                              </>
                            ) : (
                              <>
                                <PackageCheck className="w-3 h-3" />
                                <span>Stok Aman</span>
                              </>
                            )}
                          </span>
                        </div>

                        {/* Progress bar towards threshold */}
                        <div className="mt-2 w-full h-2 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden relative">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isOut
                                ? 'bg-red-500 w-0'
                                : isLow
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(6, (product.stock / (threshold * 2)) * 100))}%`
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between mt-1.5 text-[11px] text-stone-500 dark:text-stone-400">
                          <span className="flex items-center gap-1">
                            <span>Batas Minimum (Alert):</span>
                            <strong className="text-stone-700 dark:text-stone-300">{threshold} unit</strong>
                          </span>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => openStockModal(product)}
                              className="text-accent hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Ubah Stok</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Controls: Quick +/- Adjusters & Availability Button */}
                    <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex flex-col gap-2">
                      {!isReadOnly ? (
                        <>
                          {/* Row 1: Quick +/- Quantity Steppers */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                              Ubah Cepat:
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={product.stock <= 0 || isQuickBusy}
                                onClick={() => handleQuickAdjust(product, -1)}
                                className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 font-bold text-xs flex items-center justify-center transition-all disabled:opacity-30 active:scale-95 cursor-pointer"
                                title="Kurangi 1 unit"
                              >
                                -1
                              </button>
                              <button
                                type="button"
                                disabled={isQuickBusy}
                                onClick={() => handleQuickAdjust(product, 1)}
                                className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 font-bold text-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                title="Tambah 1 unit"
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                disabled={isQuickBusy}
                                onClick={() => handleQuickAdjust(product, 5)}
                                className="w-8 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                title="Tambah 5 unit"
                              >
                                +5
                              </button>
                              <button
                                type="button"
                                disabled={isQuickBusy}
                                onClick={() => handleQuickAdjust(product, 10)}
                                className="w-8 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                title="Tambah 10 unit"
                              >
                                +10
                              </button>
                            </div>
                          </div>

                          {/* Row 2: Temporary Unavailable Switch & Edit Button */}
                          <div className="flex items-center justify-between gap-2 pt-1">
                            {/* Toggle Temporary Unavailable Button */}
                            <button
                              type="button"
                              onClick={() => openTemporaryUnavailableModal(product)}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                                !isAvailable
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                              }`}
                              title={
                                !isAvailable
                                  ? 'Klik untuk mengaktifkan kembali produk ke kasir'
                                  : 'Klik jika produk ini habis sementara atau tidak dapat disajikan'
                              }
                            >
                              {!isAvailable ? (
                                <>
                                  <PlayCircle className="w-3.5 h-3.5" />
                                  <span>Aktifkan Kembali</span>
                                </>
                              ) : (
                                <>
                                  <PauseCircle className="w-3.5 h-3.5" />
                                  <span>Habis Sementara</span>
                                </>
                              )}
                            </button>

                            {/* Restock / Manual Modal Button */}
                            <button
                              type="button"
                              onClick={() => openStockModal(product)}
                              className="px-3 py-1.5 rounded-xl bg-accent text-white font-bold text-xs shadow-2xs hover:bg-accent/90 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                              title="Buka form modifikasi jumlah stok dan ambang batas"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Restock</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between text-xs text-stone-500 py-1">
                          <span className="flex items-center gap-1 text-[11px] font-medium text-stone-400">
                            <Eye className="w-3.5 h-3.5 text-blue-500" />
                            <span>Read-Only</span>
                          </span>
                          <span className="font-mono text-[10px] text-stone-400">
                            SKU: {product.id}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Audit Logs Tab Content */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 p-4 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
            <div>
              <h3 className="text-base font-bold font-heading text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <History className="w-4 h-4 text-accent" />
                <span>Riwayat Audit Mutasi Stok Fisik</span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Catatan mutasi stok otomatis dari transaksi kasir dan penyesuaian manual manager
              </p>
            </div>
            <span className="text-xs text-stone-400 font-semibold">{logs.length} catatan aktivitas</span>
          </div>

          {logs.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-xs">
              Belum ada riwayat mutasi stok tercatat untuk vendor ini.
            </div>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-[600px] overflow-y-auto">
              {logs.map((log, index) => {
                const isPositive = log.change > 0;
                const isThreshold = log.type === 'THRESHOLD_UPDATE';

                return (
                  <div key={log.id || index} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isThreshold
                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                            : isPositive
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
                        }`}
                      >
                        {isThreshold ? (
                          <Sliders className="w-4 h-4" />
                        ) : isPositive ? (
                          <Plus className="w-4 h-4" />
                        ) : (
                          <Minus className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 dark:text-stone-100">
                            {log.productName}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-500 font-mono">
                            {log.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          {log.reason || 'Penyesuaian stok'}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-1">
                          <span>Oleh: {log.performedBy?.name || 'Sistem'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-black font-heading text-sm block ${
                          isThreshold
                            ? 'text-blue-600'
                            : isPositive
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {isThreshold ? '⚙️ Update' : `${isPositive ? '+' : ''}${log.change}`}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {log.previousStock} → {log.newStock} unit
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Modifikasi Jumlah Stok & Batas Threshold */}
      {!isReadOnly && stockModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#251e1c] rounded-3xl p-6 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base font-heading">
                    Modifikasi Stok: {stockModalProduct.name}
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Stok saat ini di database: {stockModalProduct.stock} unit
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStockModalProduct(null)}
                className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitManualStock} className="space-y-4">
              {/* Jumlah Stok Baru */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                  Jumlah Stok Fisik Baru (Unit) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    required
                    value={manualStockValue}
                    onChange={e => setManualStockValue(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-32 px-3 py-2.5 text-center font-black text-xl rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-accent focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  {/* Quick Delta Buttons */}
                  <div className="flex items-center gap-1.5 flex-1">
                    {[+5, +10, +20, +50].map(delta => (
                      <button
                        key={delta}
                        type="button"
                        onClick={() => setManualStockValue(prev => Math.max(0, prev + delta))}
                        className="flex-1 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 font-bold text-xs transition-colors cursor-pointer"
                      >
                        +{delta}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Batas Threshold Peringatan */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                  Batas Minimum Peringatan (Unit)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={manualThresholdValue}
                  onChange={e => setManualThresholdValue(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  Kasir dan inventaris akan menampilkan peringatan stok menipis saat sisa unit sama atau di bawah angka ini.
                </span>
              </div>

              {/* Alasan Penyesuaian */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                  Alasan Perubahan Stok
                </label>
                <select
                  value={manualReason}
                  onChange={e => setManualReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="Restock berkala dari supplier">Restock berkala dari supplier</option>
                  <option value="Pengadaan bahan baku tambahan">Pengadaan bahan baku tambahan</option>
                  <option value="Penyesuaian hasil stock opname">Penyesuaian hasil stock opname</option>
                  <option value="Koreksi kesalahan input kasir">Koreksi kesalahan input kasir</option>
                  <option value="Pengurangan barang rusak / basi / tumpah">Pengurangan barang rusak / basi / tumpah</option>
                  <option value="Sampling promosi / tester pelanggan">Sampling promosi / tester pelanggan</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setStockModalProduct(null)}
                  disabled={isSubmittingStock}
                  className="px-4 py-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStock}
                  className="px-6 py-2.5 rounded-2xl bg-accent text-white text-xs font-bold shadow-md hover:opacity-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingStock && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Perubahan Stok</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Ubah Kalo Produk Tidak Tersedia Sementara Waktu */}
      {!isReadOnly && tempUnavailableProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#251e1c] rounded-3xl p-6 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <PauseCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base font-heading">
                    Atur Tidak Tersedia Sementara
                  </h3>
                  <p className="text-[11px] text-stone-400 truncate max-w-[220px]">
                    Menu: {tempUnavailableProduct.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTempUnavailableProduct(null)}
                className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTemporaryUnavailable} className="space-y-4">
              <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200 leading-relaxed">
                Produk ini akan <strong>disembunyikan dari katalog aktif kasir</strong> agar pelanggan atau kasir tidak dapat memesannya untuk sementara waktu.
              </div>

              {/* Pilih Alasan Preset */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                  Pilih Alasan Habis Sementara
                </label>
                <div className="space-y-1.5">
                  {TEMPORARY_UNAVAILABLE_REASONS.map(reason => (
                    <label
                      key={reason}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                        tempUnavailableReason === reason && !customUnavailableReason
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/60 font-bold text-purple-900 dark:text-purple-200'
                          : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/60'
                      }`}
                    >
                      <input
                        type="radio"
                        name="tempReason"
                        checked={tempUnavailableReason === reason && !customUnavailableReason}
                        onChange={() => {
                          setTempUnavailableReason(reason);
                          setCustomUnavailableReason('');
                        }}
                        className="accent-purple-600"
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Alasan Kustom Tambahan */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                  Atau Tulis Alasan Kustom:
                </label>
                <input
                  type="text"
                  value={customUnavailableReason}
                  onChange={e => setCustomUnavailableReason(e.target.value)}
                  placeholder="Contoh: Menunggu buah alpukat matang dari petani..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setTempUnavailableProduct(null)}
                  disabled={isSubmittingAvailability}
                  className="px-4 py-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAvailability}
                  className="px-6 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingAvailability && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Tandai Habis Sementara</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Bulk Threshold Configuration */}
      {!isReadOnly && showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#251e1c] rounded-3xl p-6 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base font-heading">
                    Konfigurasi Batas Threshold Minimum
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Terapkan ambang batas peringatan stok menipis secara massal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkThreshold} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                  Target Kategori
                </label>
                <select
                  value={bulkCategoryTarget}
                  onChange={e => setBulkCategoryTarget(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="all">Semua Kategori Produk ({products.length} SKU)</option>
                  {categories.map(c => (
                    <option key={c.id || c.code} value={c.code}>
                      {c.icon || '🏷️'} Kategori {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                  Batas Peringatan Baru (Unit Minimum)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={bulkThresholdInput}
                    onChange={e => setBulkThresholdInput(Math.max(1, parseInt(e.target.value) || 1))}
                    required
                    className="w-28 px-3 py-2.5 text-center font-black text-xl rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-accent focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <div className="flex items-center gap-1.5 flex-1">
                    {[5, 10, 15, 20, 25].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setBulkThresholdInput(v)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          bulkThresholdInput === v
                            ? 'bg-accent text-white'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  disabled={isSubmittingBulk}
                  className="px-4 py-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBulk}
                  className="px-6 py-2.5 rounded-2xl bg-accent text-white text-xs font-bold shadow-md hover:opacity-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingBulk && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Terapkan Threshold</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
