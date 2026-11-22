import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Trash2,
  X,
  ArrowRight,
  RefreshCw,
  ShoppingBag,
  Settings,
  FlaskConical
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { Product, ProductRecipe, RawMaterial, StockManagementMode } from '../../types';
import { clearClientCatalogCache } from '../../utils/productCache';

export const RawMaterialStockScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { showToast } = useToast();

  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';

  // State
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockManagementMode, setStockManagementMode] = useState<StockManagementMode>('RAW_MATERIAL');
  const [switchingMode, setSwitchingMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filters & Searches
  const [materialSearch, setMaterialSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'depleted' | 'low' | 'safe'>('all');

  // Modal: Add / Edit Material
  const [showMaterialModal, setShowMaterialModal] = useState<boolean>(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [materialForm, setMaterialForm] = useState({
    name: '',
    category: 'KOPI',
    unit: 'gram',
    stock: 0,
    minimumStock: 200,
    avgCostPerUnit: 0,
    notes: ''
  });

  // Modal: Delete Material Confirmation
  const [deletingMaterial, setDeletingMaterial] = useState<RawMaterial | null>(null);

  // Load raw materials, recipes, products, and vendor stock config
  const loadMaterials = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [matRes, vendorRes, recipesRes, prodsRes] = await Promise.all([
        fetch('/api/raw-materials', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/vendors/current', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/raw-materials/recipes', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/products?refresh=true', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const [matData, vendorData, recipesData, prodsData] = await Promise.all([
        matRes.json(),
        vendorRes.json().catch(() => ({})),
        recipesRes.json().catch(() => ({})),
        prodsRes.json().catch(() => ({}))
      ]);

      if (matData.success) {
        setMaterials(matData.materials || []);
      } else {
        showToast(matData.error || 'Gagal memuat master bahan baku', 'error');
      }

      if (vendorData?.success && vendorData.vendor?.stockManagementMode) {
        setStockManagementMode(vendorData.vendor.stockManagementMode);
      } else if (prodsData?.stockManagementMode) {
        setStockManagementMode(prodsData.stockManagementMode);
      }

      if (recipesData?.success && Array.isArray(recipesData.recipes)) {
        setRecipes(recipesData.recipes);
      }

      if (prodsData?.success && Array.isArray(prodsData.products)) {
        setProducts(prodsData.products);
      }
    } catch (err) {
      console.error('Error fetching raw materials:', err);
      showToast('Gagal memuat data master bahan baku', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, [token]);

  // Switch Vendor Stock Management Mode
  const handleToggleStockMode = async (targetMode: StockManagementMode) => {
    if (!isManager && !isAdmin) return;
    if (switchingMode || targetMode === stockManagementMode) return;

    setSwitchingMode(true);
    try {
      const res = await fetch('/api/vendors/stock-config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ stockManagementMode: targetMode })
      });
      const data = await res.json();
      if (data.success) {
        setStockManagementMode(data.stockManagementMode || targetMode);
        clearClientCatalogCache();
        window.dispatchEvent(new CustomEvent('kasirkafe:inventory-updated'));
        showToast(
          data.message ||
            (targetMode === 'RAW_MATERIAL'
              ? 'Stok produk kini diproses otomatis dari Stok Bahan Baku!'
              : 'Stok produk dialihkan kembali ke Stok Produk Manual.'),
          'success'
        );
        await loadMaterials();
      } else {
        showToast(data.message || data.error || 'Gagal mengubah konfigurasi stok', 'error');
      }
    } catch (err) {
      showToast('Gagal terhubung ke server untuk menyimpan konfigurasi', 'error');
    } finally {
      setSwitchingMode(false);
    }
  };

  // Save / Update Raw Material
  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialForm.name.trim()) {
      showToast('Nama bahan baku wajib diisi', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingMaterial ? `/api/raw-materials/${editingMaterial.id}` : '/api/raw-materials';
      const method = editingMaterial ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(materialForm)
      });

      const data = await res.json();
      if (data.success) {
        clearClientCatalogCache();
        window.dispatchEvent(new CustomEvent('kasirkafe:inventory-updated'));
        showToast(data.message || 'Data bahan baku berhasil disimpan!', 'success');
        setShowMaterialModal(false);
        setEditingMaterial(null);
        await loadMaterials();
      } else {
        showToast(data.error || 'Gagal menyimpan bahan baku', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem saat menyimpan bahan', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Material
  const handleDeleteMaterial = async () => {
    if (!deletingMaterial) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/raw-materials/${deletingMaterial.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        clearClientCatalogCache();
        window.dispatchEvent(new CustomEvent('kasirkafe:inventory-updated'));
        showToast(data.message || 'Bahan baku berhasil dihapus', 'success');
        setDeletingMaterial(null);
        await loadMaterials();
      } else {
        showToast(data.error || 'Gagal menghapus bahan baku', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Map material -> linked recipe products
  const materialUsageMap = useMemo(() => {
    const productById = new Map<string, Product>();
    for (const p of products) {
      productById.set(String(p.id), p);
    }

    const byKey = new Map<
      string,
      {
        productId: string;
        productName: string;
        quantityNeeded: number;
        unit: string;
        productStock: number;
      }[]
    >();

    for (const recipe of recipes) {
      const linkedProduct = productById.get(String(recipe.productId));
      const productName = linkedProduct?.name || recipe.productName;
      const productStock = linkedProduct?.stock ?? 0;

      for (const ing of recipe.ingredients || []) {
        const entry = {
          productId: recipe.productId,
          productName,
          quantityNeeded: ing.quantityNeeded,
          unit: ing.unit,
          productStock
        };

        if (ing.materialId) {
          const idKey = `id:${ing.materialId}`;
          const list = byKey.get(idKey) || [];
          if (!list.some(item => item.productId === recipe.productId)) {
            list.push(entry);
            byKey.set(idKey, list);
          }
        }
        if (ing.materialName) {
          const nameKey = `name:${ing.materialName.trim().toLowerCase()}`;
          const list = byKey.get(nameKey) || [];
          if (!list.some(item => item.productId === recipe.productId)) {
            list.push(entry);
            byKey.set(nameKey, list);
          }
        }
      }
    }

    return byKey;
  }, [recipes, products]);

  const getLinkedProductsForMaterial = (m: RawMaterial) => {
    const byId = materialUsageMap.get(`id:${m.id}`) || [];
    const byName = materialUsageMap.get(`name:${m.name.trim().toLowerCase()}`) || [];
    const merged = [...byId];
    for (const item of byName) {
      if (!merged.some(existing => existing.productId === item.productId)) {
        merged.push(item);
      }
    }
    return merged;
  };

  const stockStatusCounts = useMemo(() => {
    let depleted = 0;
    let low = 0;
    let safe = 0;
    for (const m of materials) {
      if (m.stock <= 0) depleted++;
      else if (m.stock <= m.minimumStock) low++;
      else safe++;
    }
    return { total: materials.length, depleted, low, safe };
  }, [materials]);

  const urgentMaterials = useMemo(() => {
    return materials
      .filter(m => m.stock <= m.minimumStock)
      .sort((a, b) => a.stock - b.stock);
  }, [materials]);

  // Filtered & Priority-Sorted Materials (Out-of-stock & Low-stock light up at top)
  const filteredMaterials = useMemo(() => {
    return materials
      .filter(m => {
        const query = materialSearch.toLowerCase();
        const matchSearch =
          m.name.toLowerCase().includes(query) ||
          (m.category && m.category.toLowerCase().includes(query)) ||
          (m.notes && m.notes.toLowerCase().includes(query));

        let matchStatus = true;
        if (statusFilter === 'depleted') {
          matchStatus = m.stock <= 0;
        } else if (statusFilter === 'low') {
          matchStatus = m.stock > 0 && m.stock <= m.minimumStock;
        } else if (statusFilter === 'safe') {
          matchStatus = m.stock > m.minimumStock;
        }

        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        const rank = (m: RawMaterial) => (m.stock <= 0 ? 0 : m.stock <= m.minimumStock ? 1 : 2);
        const rA = rank(a);
        const rB = rank(b);
        if (rA !== rB) return rA - rB;
        return a.name.localeCompare(b.name);
      });
  }, [materials, materialSearch, statusFilter]);

  // Unauthorized view
  if (!isManager && !isAdmin) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-20">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-950/60 rounded-3xl flex items-center justify-center mx-auto mb-4 text-red-600">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2">
          Akses Terbatas: Khusus Role MANAGER & ADMIN
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
          Halaman Master Stok Bahan Baku hanya dapat dikelola oleh akun Manager atau Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-7xl mx-auto flex flex-col gap-6 p-4 sm:p-6">
      {/* Main Stock Table */}
      <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 p-5 sm:p-6 shadow-2xs space-y-4">
        {/* Konfigurasi Sumber Stok Produk Bar */}
        <div
          className={`p-3.5 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
            stockManagementMode === 'RAW_MATERIAL'
              ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/60'
              : 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/60'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                stockManagementMode === 'RAW_MATERIAL'
                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
            </div>
            <div className="text-xs leading-relaxed">
              <div className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 flex-wrap">
                <span>
                  {stockManagementMode === 'RAW_MATERIAL'
                    ? 'Sumber Stok Produk Aktif: Stok Bahan Baku (Otomatis)'
                    : 'Sumber Stok Produk Aktif: Stok Produk Manual'}
                </span>
              </div>
              <p className="text-stone-600 dark:text-stone-400 mt-0.5">
                {stockManagementMode === 'RAW_MATERIAL'
                  ? 'Stok produk ber-resep dihitung otomatis dari sisa bahan baku ini. Jika salah satu bahan baku habis (0 / kurang dari takaran), stok produk terkait otomatis habis (0), dan akan terisi ulang saat mencatat Pembelian Stok Bahan Baku.'
                  : 'Saat ini stok produk masih dikelola manual per produk. Aktifkan mode Stok Bahan Baku agar stok produk otomatis mengikuti ketersediaan bahan baku & faktur pembelian.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={switchingMode}
              onClick={() =>
                handleToggleStockMode(stockManagementMode === 'RAW_MATERIAL' ? 'PRODUCT_STOCK' : 'RAW_MATERIAL')
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                stockManagementMode === 'RAW_MATERIAL'
                  ? 'bg-white dark:bg-[#251e1c] border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50'
                  : 'bg-accent text-white hover:opacity-90'
              }`}
            >
              {switchingMode ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Settings className="w-3.5 h-3.5" />
              )}
              <span>
                {stockManagementMode === 'RAW_MATERIAL'
                  ? 'Alihkan ke Stok Produk Manual'
                  : 'Aktifkan Stok dari Bahan Baku'}
              </span>
            </button>

            {isManager && (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/pembelian-bahan')}
                  className="px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-bold inline-flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Beli Stok Bahan</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMaterial(null);
                    setMaterialForm({
                      name: '',
                      category: 'KOPI',
                      unit: 'gram',
                      stock: 0,
                      minimumStock: 200,
                      avgCostPerUnit: 0,
                      notes: ''
                    });
                    setShowMaterialModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Bahan</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#251e1c] text-stone-600 dark:text-stone-300 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
              title="Buka Pengaturan Sistem"
            >
              Pengaturan
            </button>
          </div>
        </div>

        {/* Glowing Low-Stock & Out-of-Stock Alert Spotlight */}
        {urgentMaterials.length > 0 && (
          <div className="p-4 rounded-2xl border-2 border-amber-400/90 dark:border-amber-500/70 bg-gradient-to-r from-amber-50 via-orange-50/70 to-red-50/50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-red-950/20 shadow-md shadow-amber-500/15 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm relative">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-ping" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-amber-950 dark:text-amber-200 flex items-center gap-2">
                    <span>Peringatan Bahan & Perlengkapan Menipis Sebelum Habis</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                      {urgentMaterials.length} Item
                    </span>
                  </h3>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300/90">
                    Item di bawah ini menyentuh batas minimum atau habis. Segera restock agar menu kasir tetap tersedia.
                  </p>
                </div>
              </div>

              {isManager && (
                <button
                  type="button"
                  onClick={() => navigate('/pembelian-bahan')}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0 self-start sm:self-auto"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Restock Sekarang</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {urgentMaterials.map(m => {
                const isZero = m.stock <= 0;
                const linkedCount = getLinkedProductsForMaterial(m).length;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setStatusFilter(isZero ? 'depleted' : 'low')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all cursor-pointer ${
                      isZero
                        ? 'bg-red-100 dark:bg-red-950/70 border-red-400 dark:border-red-700 text-red-800 dark:text-red-200 shadow-xs'
                        : 'bg-amber-100/90 dark:bg-amber-950/60 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 shadow-xs'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isZero ? 'bg-red-600 animate-ping' : 'bg-amber-500 animate-pulse'}`} />
                    <span>{m.name}</span>
                    <span className="font-black">
                      {m.stock.toLocaleString('id-ID')}/{m.minimumStock.toLocaleString('id-ID')} {m.unit}
                    </span>
                    {linkedCount > 0 && (
                      <span className="text-[10px] opacity-80">({linkedCount} menu)</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Clickable KPI / Status Filter Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'border-accent bg-orange-50/70 dark:bg-orange-950/30 ring-2 ring-accent/20'
                : 'border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/40 hover:border-stone-300'
            }`}
          >
            <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 block">Semua Bahan &amp; Kemasan</span>
            <span className="text-xl font-black text-stone-900 dark:text-stone-100 font-heading">{stockStatusCounts.total}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('safe')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              statusFilter === 'safe'
                ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                : 'border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/40 hover:border-emerald-300'
            }`}
          >
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">Stok Aman</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-heading">{stockStatusCounts.safe}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('low')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              stockStatusCounts.low > 0
                ? statusFilter === 'low'
                  ? 'border-amber-500 bg-amber-100/90 dark:bg-amber-950/50 ring-2 ring-amber-500/40 shadow-md shadow-amber-500/20'
                  : 'border-amber-400 bg-amber-50/90 dark:bg-amber-950/35 shadow-sm shadow-amber-500/15 hover:border-amber-500'
                : statusFilter === 'low'
                ? 'border-amber-500 bg-amber-50/70'
                : 'border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/40'
            }`}
          >
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <span>Menipis (Alert)</span>
              {stockStatusCounts.low > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
            </span>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400 font-heading">{stockStatusCounts.low}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('depleted')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              stockStatusCounts.depleted > 0
                ? statusFilter === 'depleted'
                  ? 'border-red-500 bg-red-100/90 dark:bg-red-950/50 ring-2 ring-red-500/40 shadow-md shadow-red-500/20'
                  : 'border-red-400 bg-red-50/90 dark:bg-red-950/35 shadow-sm shadow-red-500/15 hover:border-red-500'
                : statusFilter === 'depleted'
                ? 'border-red-500 bg-red-50/70'
                : 'border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/40'
            }`}
          >
            <span className="text-[11px] font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
              <span>Habis (0)</span>
              {stockStatusCounts.depleted > 0 && <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />}
            </span>
            <span className="text-xl font-black text-red-600 dark:text-red-400 font-heading">{stockStatusCounts.depleted}</span>
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading">
              Daftar Stok Bahan Baku &amp; Perlengkapan ({filteredMaterials.length})
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Kuantiti bertambah otomatis via Faktur Pembelian dan berkurang otomatis via Kasir Penjualan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={materialSearch}
                onChange={e => setMaterialSearch(e.target.value)}
                placeholder="Cari nama bahan atau kemasan..."
                className="w-full pl-9 pr-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {statusFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="px-2.5 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-semibold flex items-center gap-1 hover:bg-stone-200 cursor-pointer"
              >
                <span>Reset Filter Status</span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Materials Table or Empty State */}
        {loading ? (
          <div className="py-14 flex flex-col items-center justify-center gap-2 text-stone-500">
            <RefreshCw className="w-7 h-7 text-accent animate-spin" />
            <span className="text-xs font-semibold">Memuat stok bahan baku &amp; keterkaitan resep...</span>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="py-16 text-center text-stone-400">
            <Boxes className="w-12 h-12 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">
              {materialSearch || statusFilter !== 'all'
                ? 'Tidak ada bahan baku yang cocok dengan filter yang dipilih.'
                : 'Belum ada data bahan baku terdaftar.'}
            </p>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              Tambahkan bahan baku dasar kafe Anda seperti Biji Kopi, Fresh Milk, Sirup Vanila, atau Cup Takeaway.
            </p>
            {isManager && (
              <button
                type="button"
                onClick={() => {
                  setEditingMaterial(null);
                  setMaterialForm({
                    name: '',
                    category: 'KOPI',
                    unit: 'gram',
                    stock: 0,
                    minimumStock: 200,
                    avgCostPerUnit: 0,
                    notes: ''
                  });
                  setShowMaterialModal(true);
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Bahan Baku Pertama</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border border-stone-200 dark:border-stone-700/80 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 dark:bg-stone-850 text-stone-600 dark:text-stone-400 font-bold border-b border-stone-200 dark:border-stone-700">
                <tr>
                  <th className="p-3">Nama Bahan Baku</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Stok Fisik Saat Ini</th>
                  <th className="p-3">Batas Minimum</th>
                  <th className="p-3">Status Stok</th>
                  <th className="p-3">Produk Terkait (Resep)</th>
                  <th className="p-3">Estimasi Biaya / Satuan</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredMaterials.map(m => {
                  const isDepleted = m.stock <= 0;
                  const isLow = m.stock > 0 && m.stock <= m.minimumStock;
                  const linkedProducts = getLinkedProductsForMaterial(m);
                  const meterPct = m.minimumStock > 0 ? Math.min(100, Math.round((m.stock / (m.minimumStock * 2)) * 100)) : (m.stock > 0 ? 100 : 0);

                  return (
                    <tr
                      key={m.id}
                      className={`transition-colors ${
                        isDepleted
                          ? 'bg-red-50/85 dark:bg-red-950/30 border-l-4 border-l-red-600 hover:bg-red-100/70 dark:hover:bg-red-950/45'
                          : isLow
                          ? 'bg-amber-50/90 dark:bg-amber-950/25 border-l-4 border-l-amber-500 hover:bg-amber-100/70 dark:hover:bg-amber-950/40'
                          : 'hover:bg-stone-50/60 dark:hover:bg-stone-850/60'
                      }`}
                    >
                      <td className="p-3">
                        <div className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm flex items-center gap-1.5">
                          {(isDepleted || isLow) && (
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isDepleted ? 'bg-red-600 animate-ping' : 'bg-amber-500 animate-pulse'
                              }`}
                            />
                          )}
                          <span>{m.name}</span>
                        </div>
                        {m.notes && <div className="text-[10px] text-stone-400 mt-0.5 max-w-xs truncate">{m.notes}</div>}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 font-bold text-[10px] text-stone-700 dark:text-stone-300">
                          {m.category}
                        </span>
                      </td>
                      <td className="p-3 font-black text-sm whitespace-nowrap">
                        <div>
                          <span className={isDepleted ? 'text-red-600 font-black' : isLow ? 'text-amber-700 dark:text-amber-400 font-black' : 'text-stone-900 dark:text-stone-100'}>
                            {m.stock.toLocaleString('id-ID')}
                          </span>
                          <span className="text-xs font-semibold text-stone-500 ml-1">{m.unit}</span>
                        </div>
                        <div className="mt-1.5 w-24 h-1.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isDepleted ? 'bg-red-600 w-0' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${isDepleted ? 0 : Math.max(8, meterPct)}%` }}
                          />
                        </div>
                      </td>
                      <td className="p-3 text-stone-600 dark:text-stone-400 whitespace-nowrap">
                        {m.minimumStock.toLocaleString('id-ID')} {m.unit}
                      </td>
                      <td className="p-3">
                        {isDepleted ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 dark:bg-red-950/80 text-red-600 border border-red-300 dark:border-red-700 flex items-center gap-1 w-fit animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Habis (0)</span>
                          </span>
                        ) : isLow ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-200/90 dark:bg-amber-950/90 text-amber-900 dark:text-amber-300 border border-amber-400 dark:border-amber-600 flex items-center gap-1 w-fit animate-pulse shadow-xs">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Menipis - Segera Beli</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Aman</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 max-w-[230px]">
                        {linkedProducts.length === 0 ? (
                          <span className="text-[11px] text-stone-400 italic">Belum terhubung ke resep</span>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 truncate" title={linkedProducts.map(lp => lp.productName).join(', ')}>
                              {linkedProducts.slice(0, 2).map(lp => lp.productName).join(', ')}
                              {linkedProducts.length > 2 && ` +${linkedProducts.length - 2} lainnya`}
                            </div>
                            {stockManagementMode === 'RAW_MATERIAL' && isDepleted && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400">
                                <AlertTriangle className="w-3 h-3" />
                                <span>{linkedProducts.length} produk otomatis Habis (0)</span>
                              </span>
                            )}
                            {stockManagementMode === 'RAW_MATERIAL' && isLow && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="w-3 h-3" />
                                <span>{linkedProducts.length} menu menyala Menipis</span>
                              </span>
                            )}
                            {stockManagementMode === 'RAW_MATERIAL' && !isDepleted && !isLow && (
                              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block">
                                Menyusun {linkedProducts.length} menu aktif
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-stone-700 dark:text-stone-300 font-medium whitespace-nowrap">
                        Rp {(m.avgCostPerUnit || 0).toLocaleString('id-ID')} <span className="text-[11px] text-stone-400">/ {m.unit}</span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isManager && (
                            <>
                              {isDepleted || isLow ? (
                                <button
                                  type="button"
                                  onClick={() => navigate('/pembelian-bahan')}
                                  className="px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 transition-colors"
                                  title="Catat pembelian stok bahan baku"
                                >
                                  <ShoppingBag className="w-3 h-3" />
                                  <span>Beli</span>
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMaterial(m);
                                  setMaterialForm({
                                    name: m.name,
                                    category: m.category || 'KOPI',
                                    unit: m.unit || 'gram',
                                    stock: m.stock,
                                    minimumStock: m.minimumStock || 100,
                                    avgCostPerUnit: m.avgCostPerUnit || 0,
                                    notes: m.notes || ''
                                  });
                                  setShowMaterialModal(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 transition-colors"
                                title="Ubah bahan baku"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Ubah</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingMaterial(m)}
                                className="p-1 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer transition-colors"
                                title="Hapus bahan baku"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {!isManager && (
                            <span className="text-[11px] text-stone-400">Lihat Saja</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: TAMBAH / UBAH MASTER BAHAN BAKU */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-[#251e1c] rounded-3xl max-w-lg w-full border border-stone-200 dark:border-stone-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Master Data Bahan</span>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading">
                  {editingMaterial ? 'Ubah Data Bahan Baku' : 'Tambah Bahan Baku Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMaterialModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                  Nama Bahan Baku *
                </label>
                <input
                  type="text"
                  required
                  value={materialForm.name}
                  onChange={e => setMaterialForm({ ...materialForm, name: e.target.value })}
                  placeholder="Contoh: Biji Kopi Arabika Aceh Gayo"
                  className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                    Kategori Bahan
                  </label>
                  <select
                    value={materialForm.category}
                    onChange={e => setMaterialForm({ ...materialForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="KOPI">Kopi (Beans/Ground)</option>
                    <option value="SUSU">Susu & Dairy</option>
                    <option value="SIRUP_PEMANIS">Sirup & Pemanis</option>
                    <option value="TEH_BUAH">Teh & Bubuk</option>
                    <option value="TOPPING">Topping & Boba</option>
                    <option value="KEMASAN">Kemasan & Cup</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                    Satuan Takaran
                  </label>
                  <select
                    value={materialForm.unit}
                    onChange={e => setMaterialForm({ ...materialForm, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="gram">gram (gr)</option>
                    <option value="ml">mililiter (ml)</option>
                    <option value="pcs">pieces (pcs)</option>
                    <option value="shot">shot</option>
                    <option value="lembar">lembar</option>
                    <option value="pack">pack</option>
                    <option value="kg">kilogram (kg)</option>
                    <option value="liter">liter (lt)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                    {editingMaterial ? 'Stok Fisik Saat Ini' : 'Stok Awal'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={materialForm.stock}
                    onChange={e => setMaterialForm({ ...materialForm, stock: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                    Ambang Batas Minimum
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={materialForm.minimumStock}
                    onChange={e => setMaterialForm({ ...materialForm, minimumStock: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                  Estimasi Biaya / Satuan (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={materialForm.avgCostPerUnit}
                  onChange={e => setMaterialForm({ ...materialForm, avgCostPerUnit: parseFloat(e.target.value) || 0 })}
                  placeholder="Contoh: 250 (Rp 250 / gram)"
                  className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                  Catatan Bahan
                </label>
                <textarea
                  value={materialForm.notes}
                  onChange={e => setMaterialForm({ ...materialForm, notes: e.target.value })}
                  placeholder="Contoh: Simpan di wadah kedap udara suhu ruang."
                  rows={2}
                  className="w-full p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowMaterialModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold shadow-xs hover:opacity-90 cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Bahan Baku'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI HAPUS BAHAN BAKU */}
      {deletingMaterial && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-[#251e1c] rounded-3xl max-w-sm w-full border border-stone-200 dark:border-stone-800 p-6 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/80 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading">
                Hapus Bahan Baku?
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Apakah Anda yakin ingin menghapus bahan <strong>{deletingMaterial.name}</strong>? Jika bahan ini digunakan di resep racikan, Anda harus memperbarui resep terkait.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingMaterial(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteMaterial}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 cursor-pointer"
              >
                {isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default RawMaterialStockScreen;
