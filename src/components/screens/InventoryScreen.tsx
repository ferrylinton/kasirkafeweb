import React, { useState, useEffect } from 'react';
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
  TrendingUp,
  Edit3,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Layers,
  FileSpreadsheet,
  ShieldAlert,
  Eye,
  Lock,
  Trash2
} from 'lucide-react';
import { Product, InventoryLog, InventoryAlertSummary, Category } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { ProductImage } from '../common/ProductImage';
import { CsvImportModal } from '../inventory/CsvImportModal';
import { AdminAllVendorsHeader, VendorBadge } from '../common/AdminAllVendorsHeader';
import { clearClientCatalogCache } from '../../utils/productCache';

interface InventoryScreenProps {
  allVendorsMode?: boolean;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({ allVendorsMode = false }) => {
  const { user, token } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  // Role Rule: Role ADMIN hanya bisa melihat Data Inventaris (Read-Only), tidak bisa menambah, mengubah, dan menghapus.
  const isReadOnly = user?.role === 'ADMIN' || (allVendorsMode && user?.role !== 'MANAGER');

  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<InventoryAlertSummary | null>(null);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'products' | 'logs'>('products');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out' | 'healthy'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'critical' | 'name' | 'stockAsc' | 'stockDesc'>('critical');

  // Edit / Restock Modal
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);
  const [manualStockValue, setManualStockValue] = useState<number>(0);
  const [manualThresholdValue, setManualThresholdValue] = useState<number>(10);
  const [manualReason, setManualReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Bulk Threshold Modal
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [bulkThresholdInput, setBulkThresholdInput] = useState<number>(15);
  const [bulkCategoryTarget, setBulkCategoryTarget] = useState<string>('all');

  // CSV Import Modal
  const [showCsvImportModal, setShowCsvImportModal] = useState<boolean>(false);

  // Quick Action Loading Tracker
  const [quickAdjustingId, setQuickAdjustingId] = useState<string | null>(null);

  // Vendor Categories for Dropdown
  const [categories, setCategories] = useState<Category[]>([]);

  // Product Add / Edit Modal (Manager only)
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodName, setProdName] = useState<string>('');
  const [prodCategory, setProdCategory] = useState<string>('kopi');
  const [prodPrice, setProdPrice] = useState<number>(25000);
  const [prodStock, setProdStock] = useState<number>(20);
  const [prodThreshold, setProdThreshold] = useState<number>(10);
  const [prodDescription, setProdDescription] = useState<string>('');
  const [prodTag, setProdTag] = useState<string>('');
  const [prodImage, setProdImage] = useState<string>('');
  const [prodIsAvailable, setProdIsAvailable] = useState<boolean>(true);
  const [isSavingProduct, setIsSavingProduct] = useState<boolean>(false);

  // Delete Product Modal
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState<boolean>(false);

  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      const vendorParam = allVendorsMode
        ? (selectedVendor === 'all' ? '?allVendors=true' : `?vendorId=${selectedVendor}`)
        : '';

      const [alertsRes, prodsRes, logsRes, catsRes] = await Promise.all([
        fetch(`/api/products/inventory/alerts${vendorParam}`, {
          headers: { Authorization: `Bearer ${token || ''}` }
        }),
        fetch(`/api/products${vendorParam}`, {
          headers: { Authorization: `Bearer ${token || ''}` }
        }),
        fetch(`/api/products/inventory/logs${vendorParam}`, {
          headers: { Authorization: `Bearer ${token || ''}` }
        }),
        fetch('/api/products/categories', {
          headers: { Authorization: `Bearer ${token || ''}` }
        })
      ]);

      const alertsData = await alertsRes.json();
      const prodsData = await prodsRes.json();
      const logsData = await logsRes.json();
      const catsData = await catsRes.json();

      if (alertsData.success && alertsData.summary) {
        setSummary(alertsData.summary);
      }
      if (prodsData.success && prodsData.products) {
        setProducts(prodsData.products);
      }
      if (logsData.success && logsData.logs) {
        setLogs(logsData.logs);
      }
      if (catsData.success && Array.isArray(catsData.categories)) {
        setCategories(catsData.categories);
      }
    } catch (err) {
      console.warn('Failed to load inventory data:', err);
      showToast('Gagal memuat data inventaris terbaru', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, [token, allVendorsMode, selectedVendor]);

  // Open modal to create a new product
  const openCreateProductModal = () => {
    if (isReadOnly) {
      showToast('Akses ditolak: Role ADMIN hanya memiliki hak akses melihat (Read-Only).', 'warning');
      return;
    }
    setEditingProduct(null);
    setProdName('');
    setProdCategory(categories.length > 0 ? categories[0].code : 'kopi');
    setProdPrice(25000);
    setProdStock(20);
    setProdThreshold(10);
    setProdDescription('');
    setProdTag('');
    setProdImage('');
    setProdIsAvailable(true);
    setIsProductModalOpen(true);
  };

  // Open modal to edit full product details
  const openFullEditProductModal = (prod: Product) => {
    if (isReadOnly) {
      showToast('Akses ditolak: Role ADMIN hanya memiliki hak akses melihat (Read-Only).', 'warning');
      return;
    }
    setEditingProduct(prod);
    setProdName(prod.name);
    setProdCategory(prod.category || 'kopi');
    setProdPrice(prod.price);
    setProdStock(prod.stock);
    setProdThreshold(typeof prod.lowStockThreshold === 'number' ? prod.lowStockThreshold : 10);
    setProdDescription(prod.description || '');
    setProdTag(prod.tag || '');
    setProdImage(prod.image || '');
    setProdIsAvailable(prod.isAvailable !== false);
    setIsProductModalOpen(true);
  };

  // Save Product (Create or Update)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    if (!prodName.trim()) {
      showToast('Nama produk wajib diisi', 'warning');
      return;
    }
    if (prodPrice < 0) {
      showToast('Harga produk tidak boleh negatif', 'warning');
      return;
    }

    setIsSavingProduct(true);
    try {
      const payload = {
        name: prodName.trim(),
        category: prodCategory.toLowerCase().trim(),
        price: Number(prodPrice),
        stock: Math.max(0, Math.floor(Number(prodStock))),
        lowStockThreshold: Math.max(0, Math.floor(Number(prodThreshold))),
        description: prodDescription.trim(),
        tag: prodTag.trim(),
        image: prodImage.trim(),
        isAvailable: prodIsAvailable
      };

      let res: Response;
      if (editingProduct) {
        // PUT /api/products/:id
        res = await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || ''}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        // POST /api/products
        res = await fetch('/api/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || ''}`
          },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (data.success) {
        showToast(
          editingProduct ? `Produk '${prodName}' berhasil diperbarui!` : `Produk '${prodName}' berhasil ditambahkan ke katalog!`,
          'success'
        );
        clearClientCatalogCache();
        setIsProductModalOpen(false);
        fetchInventoryData();
      } else {
        showToast(data.error || 'Gagal menyimpan produk', 'error');
      }
    } catch (err) {
      console.error('Error saving product:', err);
      showToast('Terjadi kesalahan jaringan saat menyimpan produk', 'error');
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async () => {
    if (isReadOnly || !productToDelete) return;

    setIsDeletingProduct(true);
    try {
      const res = await fetch(`/api/products/${productToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token || ''}`
        }
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Produk '${productToDelete.name}' berhasil dihapus dari database`, 'success');
        clearClientCatalogCache();
        setProductToDelete(null);
        fetchInventoryData();
      } else {
        showToast(data.error || 'Gagal menghapus produk', 'error');
      }
    } catch (err) {
      console.error('Error deleting product:', err);
      showToast('Terjadi kesalahan saat menghapus produk', 'error');
    } finally {
      setIsDeletingProduct(false);
    }
  };

  // Quick delta adjustment (+/-)
  const handleQuickAdjust = async (product: Product, delta: number) => {
    if (isReadOnly) {
      showToast('Akses ditolak: Role ADMIN hanya memiliki hak akses melihat data inventaris (Read-Only).', 'info');
      return;
    }

    const newStock = Math.max(0, product.stock + delta);
    setQuickAdjustingId(product.id);

    try {
      const res = await fetch(`/api/products/${product.id}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          adjustment: delta,
          reason: delta > 0 ? `Quick restock +${delta} unit` : `Penyesuaian cepat ${delta} unit`
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(
          `${product.name}: Stok disesuaikan (${delta > 0 ? `+${delta}` : delta}) -> ${newStock}`,
          'success'
        );
        // Optimistic update
        setProducts(prev =>
          prev.map(p => (p.id === product.id ? { ...p, stock: newStock } : p))
        );
        // Invalidate client product cache
        clearClientCatalogCache();
        // Refresh full stats
        fetchInventoryData();
      } else {
        showToast(data.error || 'Gagal mengubah stok', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setQuickAdjustingId(null);
    }
  };

  // Open modal for manual edit
  const openEditModal = (product: Product) => {
    if (isReadOnly) {
      showToast('Akses ditolak: Role ADMIN hanya memiliki hak akses melihat data inventaris (Read-Only).', 'info');
      return;
    }
    setSelectedProductForEdit(product);
    setManualStockValue(product.stock);
    setManualThresholdValue(product.lowStockThreshold || 10);
    setManualReason('');
  };

  // Submit manual stock & threshold updates
  const handleSaveManualStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      showToast('Akses ditolak: Role ADMIN tidak memiliki izin mengubah stok atau inventaris.', 'error');
      return;
    }
    if (!selectedProductForEdit) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/products/${selectedProductForEdit.id}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          stock: manualStockValue,
          lowStockThreshold: manualThresholdValue,
          reason: manualReason || 'Pembaruan manual melalui panel inventaris'
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message || t('stockUpdateSuccess'), 'success');
        clearClientCatalogCache();
        setSelectedProductForEdit(null);
        fetchInventoryData();
      } else {
        showToast(data.error || 'Gagal menyimpan pembaruan stok', 'error');
      }
    } catch (err) {
      showToast('Terjadi gangguan koneksi', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit bulk threshold update
  const handleSaveBulkThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      showToast('Akses ditolak: Role ADMIN tidak memiliki izin mengubah batas threshold.', 'error');
      return;
    }
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/products/inventory/bulk-threshold', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          threshold: bulkThresholdInput,
          category: bulkCategoryTarget
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Batas threshold berhasil diperbarui!', 'success');
        clearClientCatalogCache();
        setShowBulkModal(false);
        fetchInventoryData();
      } else {
        showToast(data.error || 'Gagal mengubah threshold', 'error');
      }
    } catch (err) {
      showToast('Gagal terhubung ke server', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered & Sorted products
  const filteredProducts = products.filter(p => {
    const threshold = p.lowStockThreshold || 10;
    const isOut = p.stock === 0;
    const isLow = p.stock > 0 && p.stock <= threshold;
    const isHealthy = p.stock > threshold;

    // Status filter
    if (statusFilter === 'low' && !isLow) return false;
    if (statusFilter === 'out' && !isOut) return false;
    if (statusFilter === 'healthy' && !isHealthy) return false;

    // Category filter
    if (categoryFilter !== 'all' && p.category.toLowerCase() !== categoryFilter.toLowerCase()) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchCategory = p.category.toLowerCase().includes(q);
      const matchTag = p.tag?.toLowerCase().includes(q);
      if (!matchName && !matchCategory && !matchTag) return false;
    }

    return true;
  });

  // Sort
  filteredProducts.sort((a, b) => {
    const aThreshold = a.lowStockThreshold || 10;
    const bThreshold = b.lowStockThreshold || 10;
    const aIsCritical = a.stock <= aThreshold;
    const bIsCritical = b.stock <= bThreshold;

    if (sortBy === 'critical') {
      if (a.stock === 0 && b.stock !== 0) return -1;
      if (b.stock === 0 && a.stock !== 0) return 1;
      if (aIsCritical && !bIsCritical) return -1;
      if (!aIsCritical && bIsCritical) return 1;
      return a.stock - b.stock;
    }
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'stockAsc') {
      return a.stock - b.stock;
    }
    if (sortBy === 'stockDesc') {
      return b.stock - a.stock;
    }
    return 0;
  });

  const lowStockCount = summary?.lowStockCount ?? products.filter(p => p.stock > 0 && p.stock <= (p.lowStockThreshold || 10)).length;
  const outOfStockCount = summary?.outOfStockCount ?? products.filter(p => p.stock === 0).length;
  const healthyCount = summary?.healthyCount ?? products.filter(p => p.stock > (p.lowStockThreshold || 10)).length;
  const totalStockUnits = summary?.totalStockUnits ?? products.reduce((acc, p) => acc + p.stock, 0);
  const totalStockValue = summary?.totalStockValue ?? products.reduce((acc, p) => acc + (p.stock * p.price), 0);

  const isAuthorized = allVendorsMode
    ? (user?.role === 'ADMIN')
    : (user?.role === 'MANAGER');

  if (!isAuthorized) {
    return (
      <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-xl mx-auto flex flex-col items-center justify-center text-center">
        <div className="w-full bg-white dark:bg-[#251e1c] rounded-3xl border border-rose-200 dark:border-rose-900/50 p-8 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold font-heading text-stone-900 dark:text-stone-100">
            {allVendorsMode ? 'Akses Terbatas: Khusus Administrator' : 'Akses Terbatas: Khusus Manajer'}
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-2 mb-6">
            {allVendorsMode
              ? 'Menu Administrasi Inventaris Jaringan hanya dapat diakses oleh Administrator.'
              : 'Menu Manajemen Inventaris Toko hanya dapat diakses oleh akun dengan peran Manajer.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-7xl mx-auto flex flex-col gap-6">
      {/* Admin Cross-Vendor Header */}
      {allVendorsMode && (
        <AdminAllVendorsHeader
          title={t('navAdminInventory')}
          subtitle="Monitoring inventaris stok barang, ambang batas minimum, dan audit mutasi stok lintas vendor"
          selectedVendor={selectedVendor}
          onVendorChange={setSelectedVendor}
          onRefresh={fetchInventoryData}
          isLoading={loading}
          itemCount={products.length}
          itemLabel="Produk"
        />
      )}

      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shrink-0 shadow-xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-stone-900 dark:text-stone-100">
                {allVendorsMode ? 'Data Inventaris Jaringan' : t('inventoryTitle')}
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {allVendorsMode ? 'Inventaris gabungan seluruh cabang vendor terdaftar' : t('inventorySubtitle')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Read-Only Access Badge for ADMIN */}
          {isReadOnly && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold shadow-2xs">
              <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Hak Akses:</span>
              <span>Lihat Saja (Read-Only)</span>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={fetchInventoryData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#251e1c] border border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 shadow-2xs transition-colors"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Bulk Threshold Button (Hanya untuk Manager) */}
          {!isReadOnly && (
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#251e1c] border border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 shadow-2xs transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-accent" />
              <span>{t('configureThreshold')}</span>
            </button>
          )}

          {/* Add Product Button (Hanya untuk Manager) */}
          {!isReadOnly && (
            <button
              type="button"
              onClick={openCreateProductModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent/90 shadow-2xs transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              title="Tambah produk menu baru ke database vendor"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Produk</span>
            </button>
          )}

          {/* Import CSV Button (Hanya untuk Manager) */}
          {!isReadOnly && (
            <button
              onClick={() => setShowCsvImportModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 text-xs font-bold shadow-2xs transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              title="Import CSV untuk perbarui stok & harga atau tambah produk baru"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{t('importCsv')}</span>
            </button>
          )}

          {/* Toggle View: Products / Logs */}
          <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'products'
                  ? 'bg-white dark:bg-[#251e1c] text-accent shadow-xs'
                  : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Katalog Stok
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'logs'
                  ? 'bg-white dark:bg-[#251e1c] text-accent shadow-xs'
                  : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{t('inventoryLogs')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Read-Only Notice Banner for Role ADMIN */}
      {isReadOnly && (
        <div className="rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            <span className="font-bold text-stone-900 dark:text-stone-100">Hak Akses Role ADMIN: Mode Lihat (Read-Only)</span> — Administrator hanya berwenang memantau ketersediaan stok, ambang batas minimum, dan audit riwayat mutasi. Penambahan menu baru, restock/pengurangan stok, dan penghapusan produk dikelola secara eksklusif oleh role Manager.
          </div>
        </div>
      )}

      {/* 2. Key Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total SKU */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Total SKU</span>
            <div className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-stone-900 dark:text-stone-100 font-heading">
              {products.length}
            </span>
            <span className="text-[11px] text-stone-400 ml-1.5">Produk Terdaftar</span>
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
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-heading">
              {healthyCount}
            </span>
            <span className="text-[11px] text-emerald-600/70 ml-1.5">Di atas batas aman</span>
          </div>
        </div>

        {/* Peringatan Stok Menipis (Alert) */}
        <div
          onClick={() => {
            setStatusFilter('low');
            setActiveTab('products');
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
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-heading">
                {lowStockCount}
              </span>
              <span className="text-[11px] text-amber-600/80 ml-1.5">Butuh restock</span>
            </div>
            {lowStockCount > 0 && (
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 underline">
                Filter
              </span>
            )}
          </div>
        </div>

        {/* Stok Habis (Out of Stock Alert) */}
        <div
          onClick={() => {
            setStatusFilter('out');
            setActiveTab('products');
          }}
          className={`p-4 rounded-3xl cursor-pointer transition-all shadow-2xs flex flex-col justify-between ${
            outOfStockCount > 0
              ? 'bg-red-500/10 border-2 border-red-500/60 hover:border-red-500'
              : 'bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-600 dark:text-red-400">Stok Habis (0)</span>
            <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-600">
              <PackageX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-extrabold text-red-600 dark:text-red-400 font-heading">
                {outOfStockCount}
              </span>
              <span className="text-[11px] text-red-500/80 ml-1.5">Tidak bisa dijual</span>
            </div>
            {outOfStockCount > 0 && (
              <span className="text-[10px] font-bold text-red-700 dark:text-red-300 underline">
                Filter
              </span>
            )}
          </div>
        </div>

        {/* Total Aset Stok */}
        <div className="col-span-2 lg:col-span-1 p-4 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Estimasi Nilai Stok</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/60 flex items-center justify-center text-accent">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-lg sm:text-xl font-extrabold text-stone-900 dark:text-stone-100 font-heading truncate block">
              Rp {totalStockValue.toLocaleString('id-ID')}
            </span>
            <span className="text-[11px] text-stone-400">{totalStockUnits} total cup / item fisik</span>
          </div>
        </div>
      </div>

      {/* 3. Alert Callout Banner if Low or Out of Stock exists */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="rounded-3xl bg-gradient-to-r from-amber-500/15 via-red-500/10 to-orange-500/10 border border-amber-300/80 dark:border-amber-800/80 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs animate-bounce">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 font-heading">
                  {t('lowStockAlert')}: {lowStockCount + outOfStockCount} Produk Membutuhkan Tindakan
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-600 text-white uppercase tracking-wider">
                  URGENT
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300 mt-1 leading-relaxed">
                Terdapat {outOfStockCount > 0 ? `${outOfStockCount} produk stok kosong ` : ''}
                {outOfStockCount > 0 && lowStockCount > 0 ? 'dan ' : ''}
                {lowStockCount > 0 ? `${lowStockCount} produk yang mendekati batas minimum. ` : ''}
                Segera lakukan restock manual atau pesan kembali bahan baku ke supplier agar operasional kasir tetap lancar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              onClick={() => {
                setStatusFilter('low');
                setActiveTab('products');
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors shadow-xs"
            >
              Lihat Produk Menipis
            </button>
            {outOfStockCount > 0 && (
              <button
                onClick={() => {
                  setStatusFilter('out');
                  setActiveTab('products');
                }}
                className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors shadow-xs"
              >
                Lihat Produk Habis
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. Tab 1: Product Inventory Table / Cards */}
      {activeTab === 'products' && (
        <div className="flex flex-col gap-4">
          {/* Filters, Search & Sorters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-[#251e1c] p-3 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari nama produk, kategori, atau tag..."
                className="w-full pl-10 pr-8 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs focus:outline-none focus:ring-2 focus:ring-accent text-stone-900 dark:text-stone-100 placeholder-stone-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  statusFilter === 'all'
                    ? 'bg-accent text-white shadow-2xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                }`}
              >
                Semua ({products.length})
              </button>
              <button
                onClick={() => setStatusFilter('low')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
                  statusFilter === 'low'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-amber-600 dark:text-amber-400 hover:bg-amber-100/50'
                }`}
              >
                <span>Menipis</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-600 text-white">
                  {lowStockCount}
                </span>
              </button>
              <button
                onClick={() => setStatusFilter('out')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
                  statusFilter === 'out'
                    ? 'bg-red-600 text-white shadow-2xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-red-600 dark:text-red-400 hover:bg-red-100/50'
                }`}
              >
                <span>Habis</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-red-700 text-white">
                  {outOfStockCount}
                </span>
              </button>
              <button
                onClick={() => setStatusFilter('healthy')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  statusFilter === 'healthy'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                }`}
              >
                Aman ({healthyCount})
              </button>
            </div>

            {/* Category Filter Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-medium text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="all">Semua Kategori</option>
                <option value="kopi">Kopi</option>
                <option value="teh">Teh</option>
                <option value="jus">Jus</option>
                <option value="cemilan">Cemilan</option>
              </select>

              {/* Sort selector */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-medium text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="critical">Urutkan: Kritis Dulu</option>
                <option value="name">Urutkan: Nama (A-Z)</option>
                <option value="stockAsc">Stok Terendah</option>
                <option value="stockDesc">Stok Terbanyak</option>
              </select>
            </div>
          </div>

          {/* Product Items List / Cards */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div
                  key={i}
                  className="h-44 rounded-3xl bg-stone-200/60 dark:bg-stone-800/60 animate-pulse"
                />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-stone-400 bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800">
              <Boxes className="w-10 h-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm font-semibold">Tidak ada produk yang cocok dengan filter.</p>
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setCategoryFilter('all');
                  setSearchQuery('');
                }}
                className="mt-3 px-3.5 py-1.5 rounded-xl bg-accent text-white text-xs font-bold"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredProducts.map(product => {
                const threshold = product.lowStockThreshold || 10;
                const isOut = product.stock === 0;
                const isLow = product.stock > 0 && product.stock <= threshold;
                const isHealthy = product.stock > threshold;
                const isBusy = quickAdjustingId === product.id;

                return (
                  <div
                    key={product.id}
                    className={`rounded-3xl p-4 bg-white dark:bg-[#251e1c] border shadow-2xs flex flex-col justify-between transition-all ${
                      isOut
                        ? 'border-red-500/70 bg-red-50/20 dark:bg-red-950/20'
                        : isLow
                        ? 'border-amber-400/80 bg-amber-50/20 dark:bg-amber-950/20'
                        : 'border-stone-200/80 dark:border-stone-800 hover:border-stone-300'
                    }`}
                  >
                    {/* Top row: Image & Info */}
                    <div>
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0 relative">
                          <ProductImage
                            src={product.image}
                            alt={product.name}
                            category={product.category}
                            className="w-full h-full object-cover"
                            containerClassName="w-full h-full relative"
                            loading="lazy"
                          />
                          {isOut && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-[9px] font-black text-white uppercase tracking-tighter">
                              HABIS
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 uppercase">
                              {product.category}
                            </span>
                            {product.tag && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-accent/10 text-accent">
                                {product.tag}
                              </span>
                            )}
                            {allVendorsMode && (
                              <VendorBadge vendorId={product.vendorId} />
                            )}
                          </div>
                          <h4 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 font-heading truncate mt-1">
                            {product.name}
                          </h4>
                          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 block">
                            Rp {product.price.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>

                      {/* Stock Level Display & Progress */}
                      <div className="mt-3.5 p-3 rounded-2xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200/60 dark:border-stone-800/60">
                        <div className="flex items-center justify-between">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                              Stok Saat Ini:
                            </span>
                            <span
                              className={`text-xl font-extrabold font-heading ${
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
                              isOut
                                ? 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300'
                                : isLow
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 animate-pulse'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            }`}
                          >
                            {isOut && <PackageX className="w-3 h-3" />}
                            {isLow && <AlertCircle className="w-3 h-3" />}
                            {isHealthy && <PackageCheck className="w-3 h-3" />}
                            <span>{isOut ? t('stockStatusOut') : isLow ? t('stockStatusLow') : t('stockStatusHealthy')}</span>
                          </span>
                        </div>

                        {/* Visual Progress Bar relative to threshold */}
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
                              width: `${Math.min(100, Math.max(8, (product.stock / (threshold * 2)) * 100))}%`
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between mt-1.5 text-[11px] text-stone-500 dark:text-stone-400">
                          <span className="flex items-center gap-1">
                            <span>Batas Peringatan (Min):</span>
                            <strong className="text-stone-700 dark:text-stone-300">{threshold} unit</strong>
                          </span>
                          {!isReadOnly && (
                            <button
                              onClick={() => openEditModal(product)}
                              className="text-accent hover:underline font-semibold flex items-center gap-0.5"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Ubah</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom row: Quick +/- Adjusters & Detail Action (Hanya untuk Manager) */}
                    <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">
                      {!isReadOnly ? (
                        <>
                          {/* Quick Adjust Buttons */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={product.stock <= 0 || isBusy}
                              onClick={() => handleQuickAdjust(product, -1)}
                              className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 font-bold text-xs flex items-center justify-center transition-all disabled:opacity-30 active:scale-95"
                              title="Kurangi 1"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleQuickAdjust(product, 1)}
                              className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 font-bold text-xs flex items-center justify-center transition-all active:scale-95"
                              title="Tambah 1"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleQuickAdjust(product, 5)}
                              className="w-8 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center transition-all active:scale-95"
                              title="Tambah 5"
                            >
                              +5
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleQuickAdjust(product, 10)}
                              className="w-8 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center transition-all active:scale-95"
                              title="Tambah 10"
                            >
                              +10
                            </button>
                          </div>

                          {/* Action Buttons for Manager: Restock, Ubah Produk, Hapus Produk */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => openFullEditProductModal(product)}
                              className="p-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-stone-600 dark:text-stone-300 hover:text-accent transition-colors cursor-pointer"
                              title="Ubah detail produk (nama, harga, kategori, gambar)"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setProductToDelete(product)}
                              className="p-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-stone-500 dark:text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Hapus produk dari katalog"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(product)}
                              className="px-2.5 py-1.5 rounded-xl bg-accent text-white font-bold text-xs shadow-2xs hover:opacity-90 active:scale-95 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                              title="Restock cepat stok fisik"
                            >
                              <span>Restock</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        /* Read-Only Status Indicator for ADMIN */
                        <div className="flex items-center justify-between w-full text-xs text-stone-500 dark:text-stone-400">
                          <span className="flex items-center gap-1 text-[11px] font-medium text-stone-400 dark:text-stone-500">
                            <Eye className="w-3.5 h-3.5 text-blue-500" />
                            <span>Mode Lihat Saja</span>
                          </span>
                          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
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

      {/* 5. Tab 2: Inventory Activity / Audit Logs */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 p-4 sm:p-6 shadow-2xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
            <div>
              <h3 className="text-base font-bold font-heading text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <History className="w-4 h-4 text-accent" />
                <span>Riwayat Audit Mutasi Stok</span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Catatan otomatis dari transaksi penjualan dan pembaruan manual manager
              </p>
            </div>
            <span className="text-xs text-stone-400">{logs.length} catatan aktivitas</span>
          </div>

          {logs.length === 0 ? (
            <div className="py-12 text-center text-stone-400">
              <History className="w-8 h-8 mx-auto opacity-30 mb-2" />
              <p className="text-sm">Belum ada riwayat aktivitas stok.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-400 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Waktu</th>
                    {allVendorsMode && <th className="py-2.5 px-3">Vendor</th>}
                    <th className="py-2.5 px-3">Produk</th>
                    <th className="py-2.5 px-3">Tipe Aksi</th>
                    <th className="py-2.5 px-3 text-center">Perubahan</th>
                    <th className="py-2.5 px-3 text-center">Stok Akhir</th>
                    <th className="py-2.5 px-3">Keterangan / Alasan</th>
                    <th className="py-2.5 px-3">Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                  {logs.map(log => {
                    const isPositive = log.change > 0;
                    const isZero = log.change === 0;

                    return (
                      <tr key={log.id} className="hover:bg-stone-50 dark:hover:bg-stone-900/50 transition-colors">
                        <td className="py-2.5 px-3 text-stone-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}
                        </td>
                        {allVendorsMode && (
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <VendorBadge vendorId={log.vendorId} />
                          </td>
                        )}
                        <td className="py-2.5 px-3 font-bold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                          {log.productName}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                              log.type === 'MANUAL_RESTOCK'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                : log.type === 'CSV_IMPORT'
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300'
                                : log.type === 'SALE_DEDUCTION'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                                : log.type === 'THRESHOLD_UPDATE'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                            }`}
                          >
                            {log.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-extrabold whitespace-nowrap">
                          <span
                            className={
                              isPositive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isZero
                                ? 'text-stone-400'
                                : 'text-red-500'
                            }
                          >
                            {isPositive ? `+${log.change}` : log.change}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-stone-700 dark:text-stone-300 whitespace-nowrap">
                          {log.newStock}
                        </td>
                        <td className="py-2.5 px-3 text-stone-600 dark:text-stone-400 max-w-xs truncate">
                          {log.reason || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-stone-500 whitespace-nowrap">
                          {log.performedBy?.name || 'Sistem POS'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. Modal: Manual Stock Update & Threshold Configuration (Hanya Manager) */}
      {!isReadOnly && selectedProductForEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
          }}
        >
          <div className="w-full max-w-md bg-white dark:bg-[#251e1c] rounded-3xl p-5 sm:p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base font-heading">Update Stok Manual</h3>
                  <p className="text-xs text-stone-500 truncate max-w-[240px]">
                    {selectedProductForEdit.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProductForEdit(null)}
                className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualStock} className="flex flex-col gap-4 mt-4">
              {/* Product Info Preview */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200/60 dark:border-stone-800">
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                  <ProductImage
                    src={selectedProductForEdit.image}
                    alt={selectedProductForEdit.name}
                    category={selectedProductForEdit.category}
                    className="w-full h-full object-cover"
                    containerClassName="w-full h-full relative"
                  />
                </div>
                <div className="text-xs">
                  <span className="font-bold text-stone-900 dark:text-stone-100 block">
                    {selectedProductForEdit.name}
                  </span>
                  <span className="text-stone-500">
                    Kategori: {selectedProductForEdit.category} • Harga: Rp {selectedProductForEdit.price.toLocaleString('id-ID')}
                  </span>
                  <span className="text-stone-400 block mt-0.5">
                    Stok saat ini di sistem: <strong>{selectedProductForEdit.stock} unit</strong>
                  </span>
                </div>
              </div>

              {/* 1. New Stock Level Input & Quick Presets */}
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Jumlah Stok Baru (Fisik)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setManualStockValue(prev => Math.max(0, prev - 10))}
                    className="w-9 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-200"
                  >
                    -10
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualStockValue(prev => Math.max(0, prev - 1))}
                    className="w-8 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-200"
                  >
                    -1
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={manualStockValue}
                    onChange={e => setManualStockValue(Math.max(0, parseInt(e.target.value) || 0))}
                    required
                    className="flex-1 px-3 py-2.5 text-center font-bold text-lg rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-accent text-stone-900 dark:text-stone-100"
                  />
                  <button
                    type="button"
                    onClick={() => setManualStockValue(prev => prev + 1)}
                    className="w-8 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-200"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualStockValue(prev => prev + 10)}
                    className="w-9 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-200"
                  >
                    +10
                  </button>
                </div>
                {/* Difference indicator */}
                <span className="text-[11px] text-stone-500 mt-1 block">
                  Perubahan: {manualStockValue - selectedProductForEdit.stock > 0 ? `+${manualStockValue - selectedProductForEdit.stock}` : manualStockValue - selectedProductForEdit.stock} unit
                </span>
              </div>

              {/* 2. Configurable Low-Stock Alert Threshold */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    Batas Peringatan Stok Menipis (Threshold)
                  </label>
                  <span className="text-[10px] text-stone-400 font-semibold">
                    Notifikasi aktif saat stok ≤ nilai ini
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={manualThresholdValue}
                    onChange={e => setManualThresholdValue(Math.max(1, parseInt(e.target.value) || 1))}
                    required
                    className="w-24 px-3 py-2 text-center font-bold rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-accent text-stone-900 dark:text-stone-100"
                  />
                  {/* Preset quick buttons */}
                  <div className="flex items-center gap-1">
                    {[5, 10, 15, 20].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setManualThresholdValue(val)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          manualThresholdValue === val
                            ? 'bg-accent text-white'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Reason for Stock Adjustment (Audit trail) */}
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Alasan / Keterangan Restock
                </label>
                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Pengiriman Supplier',
                    'Restock Mingguan',
                    'Audit Stok Fisik',
                    'Koreksi Salah Hitung',
                    'Barang Rusak / Expired'
                  ].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setManualReason(chip)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                        manualReason === chip
                          ? 'border-accent bg-accent/10 text-accent font-bold'
                          : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={manualReason}
                  onChange={e => setManualReason(e.target.value)}
                  placeholder="Contoh: Pengiriman 20 cup kopi dari gudang pusat..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-accent text-stone-900 dark:text-stone-100"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800 mt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProductForEdit(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-800 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold shadow-md hover:opacity-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan Stok'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: Bulk Threshold Configuration (Hanya Manager) */}
      {!isReadOnly && showBulkModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
          }}
        >
          <div className="w-full max-w-md bg-white dark:bg-[#251e1c] rounded-3xl p-5 sm:p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base font-heading">Atur Batas Threshold Masal</h3>
                  <p className="text-xs text-stone-500">
                    Konfigurasi batas peringatan stok sekaligus
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBulkThreshold} className="flex flex-col gap-4 mt-4">
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Target Produk
                </label>
                <select
                  value={bulkCategoryTarget}
                  onChange={e => setBulkCategoryTarget(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-medium text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="all">Semua Produk (Seluruh Menu)</option>
                  <option value="kopi">Khusus Kategori: Kopi</option>
                  <option value="teh">Khusus Kategori: Teh</option>
                  <option value="jus">Khusus Kategori: Jus</option>
                  <option value="cemilan">Khusus Kategori: Cemilan</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
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
                    className="w-28 px-3 py-2.5 text-center font-bold text-lg rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-accent text-stone-900 dark:text-stone-100"
                  />
                  <div className="flex items-center gap-1.5 flex-1">
                    {[5, 10, 15, 20, 25].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setBulkThresholdInput(v)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
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
                <p className="text-[11px] text-stone-500 mt-2 leading-relaxed">
                  Sistem akan otomatis memberikan notifikasi peringatan jika stok produk terpilih berada sama atau di bawah angka ini.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-stone-800 mt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-800 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold shadow-md hover:opacity-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'Memproses...' : 'Terapkan Threshold'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal (Hanya Manager) */}
      {!isReadOnly && (
        <CsvImportModal
          isOpen={showCsvImportModal}
          onClose={() => setShowCsvImportModal(false)}
          existingProducts={products}
          onSuccess={() => {
            clearClientCatalogCache();
            fetchInventoryData();
          }}
        />
      )}

      {/* Modal: Tambah / Ubah Produk Lengkap (Hanya Manager) */}
      {!isReadOnly && isProductModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs"
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)'
          }}
        >
          <div className="w-full sm:max-w-xl max-h-[92vh] flex flex-col bg-white dark:bg-[#251e1c] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shrink-0">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base font-heading">
                    {editingProduct ? `Ubah Produk: ${editingProduct.name}` : 'Tambah Produk Baru'}
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Produk akan langsung tersimpan di database vendor dan sinkron ke kasir
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {/* Nama Produk */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                  Nama Produk <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={e => setProdName(e.target.value)}
                  placeholder="Contoh: Espresso Macchiato, Artisan Green Tea..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* Kategori & Harga */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                    Kategori <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={prodCategory}
                    onChange={e => setProdCategory(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {categories.length > 0 ? (
                      categories.map(c => (
                        <option key={c.id || c.code} value={c.code}>
                          {c.icon || '🏷️'} {c.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="kopi">☕ Kopi</option>
                        <option value="teh">🍵 Teh</option>
                        <option value="jus">🍹 Jus</option>
                        <option value="cemilan">🥐 Cemilan</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                    Harga Jual (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    required
                    value={prodPrice}
                    onChange={e => setProdPrice(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm font-bold text-accent focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Stok & Batas Threshold */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                    Stok Saat Ini (Unit)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={prodStock}
                    onChange={e => setProdStock(Math.max(0, Math.floor(Number(e.target.value))))}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                    Batas Minimum (Threshold)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={prodThreshold}
                    onChange={e => setProdThreshold(Math.max(1, Math.floor(Number(e.target.value))))}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Tag Promosi */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                    Tag / Label (Opsional)
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {['Best Seller', 'Favorit Barista', 'Signature', 'Promo', 'Baru'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setProdTag(t)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                          prodTag === t
                            ? 'bg-accent text-white border-accent'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={prodTag}
                  onChange={e => setProdTag(e.target.value)}
                  placeholder="Contoh: Best Seller, Favorit, Menu Baru..."
                  className="w-full px-3.5 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* URL Gambar */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                  URL Gambar Produk (Opsional)
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0 border border-stone-200 dark:border-stone-700">
                    <ProductImage
                      src={prodImage}
                      alt="Preview"
                      category={prodCategory}
                      className="w-full h-full object-cover"
                      containerClassName="w-full h-full relative"
                    />
                  </div>
                  <input
                    type="url"
                    value={prodImage}
                    onChange={e => setProdImage(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Deskripsi */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                  Deskripsi Menu (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={prodDescription}
                  onChange={e => setProdDescription(e.target.value)}
                  placeholder="Keterangan komposisi atau kelezatan produk untuk pelanggan..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* Status Ketersediaan */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="prodIsAvailable"
                  checked={prodIsAvailable}
                  onChange={e => setProdIsAvailable(e.target.checked)}
                  className="w-4 h-4 rounded text-accent focus:ring-accent accent-orange-500 cursor-pointer"
                />
                <label htmlFor="prodIsAvailable" className="text-xs font-bold text-stone-800 dark:text-stone-200 cursor-pointer">
                  Produk Tersedia untuk Dijual di Kasir
                </label>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  disabled={isSavingProduct}
                  className="px-4 py-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="px-6 py-2.5 rounded-2xl bg-accent text-white text-xs font-bold shadow-md hover:opacity-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSavingProduct && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingProduct ? 'Simpan Perubahan' : 'Tambah ke Katalog'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Hapus Produk (Hanya Manager) */}
      {!isReadOnly && productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-[#251e1c] rounded-3xl p-6 border border-stone-200 dark:border-stone-800 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mb-1">
                Hapus Produk '{productToDelete.name}'?
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Produk ini akan dihapus dari database katalog vendor Anda. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                disabled={isDeletingProduct}
                className="flex-1 py-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingProduct}
                onClick={handleDeleteProduct}
                className="flex-1 py-2.5 rounded-2xl bg-rose-600 text-white text-xs font-bold shadow-md hover:bg-rose-700 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isDeletingProduct && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
