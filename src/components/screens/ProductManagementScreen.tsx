import React, { useState, useEffect, useMemo } from 'react';
import {
  Coffee,
  Plus,
  Search,
  Filter,
  Edit3,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  Tag,
  Layers,
  Sparkles,
  ArrowUpDown,
  LayoutGrid,
  List,
  Store,
  Boxes,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
  PackageCheck,
  PackageX
} from 'lucide-react';
import { Product, Category } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { ProductImage } from '../common/ProductImage';
import { AdminAllVendorsHeader, VendorBadge } from '../common/AdminAllVendorsHeader';
import { clearClientCatalogCache } from '../../utils/productCache';

// Sample high-quality drink & food images for quick one-click selection
const QUICK_SAMPLE_IMAGES = [
  { label: 'Espresso Latte', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAtNMfSOkPEgLdVc2vKwY45wCgzwwn4srarfAclzt4f_z1t2GCXiXjKzKyLTw4Qb8HF_DbCT7aVAnSQEmWwHcfzRoFT7jXlEGDi9-Syypy9Jfw4AYn5_pfnyO7wbmT7XnhAnvqvJK8cZzK5Vv7IGXNv6tuat4pduj-j3JDy_TgWxA1oG-n8JqvJJGHe8FFYHRmRoIuEyWYwXNfISAcW7eYXrJwGpLW2jC44VdVHli4si8Q_iL9P2f3tLg' },
  { label: 'Cold Brew', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCvJdh749nH1gR2JunVywYMQZwKd2m2nffiuj2Mvs2KMwqC9BBJ49yOGr_9_JunjgM9BxcD5KR_nAPO1VF42jGfY5qhEuGwJ-gqaQi1vwD8pJlZvZIq9eBfOaUmi26UhKFA9phssHpmNM6n-B0JgNOtDATqeCk3I9xvzv0PVXhp0xgpiC68lFuRhz08JtMKVwm0mgVxahNDoLqkP0RVYozDd8OtNWaJeeeAdnrDckAcMSSOjFMVUACykA' },
  { label: 'Matcha Uji', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyUf2Pv_hsauF8bNxe7DbZfgv8KjnRNMji6pTuhzjaaKuZQJJ8goHYZ1vwnWe7W0qb2PfiNWEpMbADXDOn6FkTmlVOnf5ijPtDH3tUl_MDNWySfMhcrwvDjWK7Qvd9ZEQ4w6OeerwlFMEvmpe9Am8t57ie6yPyFRckYlRx7Av9IjDKBIxYkpjqLzqSOIcehmbGogUhaf9E0XGBlkrOsAGpD0GbzX18XoH4v5gDtjW-5U4ZrUfu8mciBw' },
  { label: 'Milk Tea Boba', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDRLFgKetXqgXN7L2j8MWsu9Q1Eb9yHwzyH6-ASIfUwawAa9Enj3XMOj3yT86b_LEmCuXDTFvluCM0F10enTo2U0OLeQqJdWeFTImS0m-nw__5a8Kmthg-b5xhuPnnPAVecNG8akkmHvu1HieuycWai8C2Zowe1OYFo5Xgu3Riec6vW3kaRaS_yvZxwYE4x3PGxUXGKVuLk3FdzMBRvjKWTPYXCwhbmsDJE-tXXL4nh8a9666-msWD1JA' },
  { label: 'Teh Melati', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBEDdNAgqpFDYomBUwebjH1cUlD6u-s6RdfV_B3Zb2sErpLrfWBAlI-B4p9ghPK0MgP7u-BExqyPi0O6Fy5nc1a9JyE3lDkxO1GyavPWK6Rmk67W9jItT13snorCP72I1AEUd4jAYXNMKn2Lz44DGZ6HM9_iOY7NSczXkEJzmmMyq-3b2vxTM-puw_0iCpUshE4u_GwKW-TTggh5T670zI2UA3bRKmSkfrEPZWMX1SqFzQj0F5diM9zYQ' },
  { label: 'Jus Alpukat Kulo', url: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&auto=format&fit=crop&q=80' },
  { label: 'Toast Panggang', url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&auto=format&fit=crop&q=80' },
  { label: 'Dimsum Hakau', url: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&auto=format&fit=crop&q=80' },
  { label: 'Siomay Dimsum', url: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=400&auto=format&fit=crop&q=80' },
  { label: 'Croffle Karamel', url: 'https://images.unsplash.com/photo-1588685912170-07e0c7e2b7e5?w=400&auto=format&fit=crop&q=80' }
];

const PRESET_TAGS = ['Best Seller', 'Favorit Barista', 'Signature', 'Promo', 'Baru', 'Rekomendasi'];

interface ProductManagementScreenProps {
  allVendorsMode?: boolean;
}

export const ProductManagementScreen: React.FC<ProductManagementScreenProps> = ({ allVendorsMode = false }) => {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  // Role rule: Only role MANAGER has write access (can add, edit, delete). ADMIN is Read-Only.
  const isReadOnly = user?.role !== 'MANAGER' || allVendorsMode;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');

  // Filters & Sorters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'unavailable' | 'low_stock' | 'out_of_stock'>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc'>('name_asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDuplicating, setIsDuplicating] = useState<boolean>(false);
  const [prodName, setProdName] = useState<string>('');
  const [prodCategory, setProdCategory] = useState<string>('kopi');
  const [prodPrice, setProdPrice] = useState<number>(25000);
  const [prodStock, setProdStock] = useState<number>(20);
  const [prodThreshold, setProdThreshold] = useState<number>(10);
  const [prodDescription, setProdDescription] = useState<string>('');
  const [prodTag, setProdTag] = useState<string>('');
  const [prodImage, setProdImage] = useState<string>('');
  const [prodIsAvailable, setProdIsAvailable] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Delete Modal State
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Quick Toggle Availability State
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Fetch Products & Categories
  const fetchData = async () => {
    setLoading(true);
    try {
      const vendorParam = allVendorsMode
        ? (selectedVendor === 'all' ? '?allVendors=true' : `?vendorId=${selectedVendor}`)
        : '';

      const [prodRes, catRes] = await Promise.all([
        fetch(`/api/products${vendorParam}${vendorParam ? '&refresh=true' : '?refresh=true'}`, {
          headers: { Authorization: `Bearer ${token || ''}` }
        }),
        fetch('/api/products/categories?bypassCache=true', {
          headers: { Authorization: `Bearer ${token || ''}` }
        })
      ]);

      const prodData = await prodRes.json();
      const catData = await catRes.json();

      if (prodData.success && Array.isArray(prodData.products)) {
        setProducts(prodData.products);
      }
      if (catData.success && Array.isArray(catData.categories)) {
        setCategories(catData.categories);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
      showToast('Gagal memuat katalog produk dari database', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, allVendorsMode, selectedVendor]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    if (isReadOnly) {
      showToast('Akses ditolak: Hanya role MANAGER yang berhak menambah produk.', 'warning');
      return;
    }
    setEditingProduct(null);
    setIsDuplicating(false);
    setProdName('');
    setProdCategory(categories.length > 0 ? categories[0].code : 'kopi');
    setProdPrice(25000);
    setProdStock(25);
    setProdThreshold(10);
    setProdDescription('');
    setProdTag('Best Seller');
    setProdImage('');
    setProdIsAvailable(true);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (product: Product) => {
    if (isReadOnly) {
      showToast('Akses ditolak: Hanya role MANAGER yang berhak mengubah produk.', 'warning');
      return;
    }
    setEditingProduct(product);
    setIsDuplicating(false);
    setProdName(product.name);
    setProdCategory(product.category || 'kopi');
    setProdPrice(product.price);
    setProdStock(product.stock);
    setProdThreshold(typeof product.lowStockThreshold === 'number' ? product.lowStockThreshold : 10);
    setProdDescription(product.description || '');
    setProdTag(product.tag || '');
    setProdImage(product.image || '');
    setProdIsAvailable(product.isAvailable !== false);
    setIsModalOpen(true);
  };

  // Open Duplicate Modal
  const handleOpenDuplicateModal = (product: Product) => {
    if (isReadOnly) {
      showToast('Akses ditolak: Hanya role MANAGER yang berhak menduplikasi produk.', 'warning');
      return;
    }
    setEditingProduct(null);
    setIsDuplicating(true);
    setProdName(`${product.name} (Salinan)`);
    setProdCategory(product.category || 'kopi');
    setProdPrice(product.price);
    setProdStock(product.stock);
    setProdThreshold(typeof product.lowStockThreshold === 'number' ? product.lowStockThreshold : 10);
    setProdDescription(product.description || '');
    setProdTag(product.tag || '');
    setProdImage(product.image || '');
    setProdIsAvailable(true);
    setIsModalOpen(true);
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

    setIsSaving(true);
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
      if (editingProduct && !isDuplicating) {
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
          editingProduct && !isDuplicating
            ? `Produk '${prodName}' berhasil diperbarui!`
            : `Produk '${prodName}' berhasil ditambahkan ke database vendor!`,
          'success'
        );
        clearClientCatalogCache();
        setIsModalOpen(false);
        fetchData();
      } else {
        showToast(data.error || 'Gagal menyimpan produk', 'error');
      }
    } catch (err) {
      console.error('Error saving product:', err);
      showToast('Terjadi kesalahan saat menyimpan produk', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Toggle Availability
  const handleToggleAvailability = async (product: Product) => {
    if (isReadOnly) {
      showToast('Akses ditolak: Hanya role MANAGER yang berhak mengubah status produk.', 'warning');
      return;
    }

    const newStatus = product.isAvailable === false;
    setTogglingId(product.id);

    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          isAvailable: newStatus
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(
          `Produk '${product.name}' kini ${newStatus ? 'TERSEDIA di kasir' : 'NON-AKTIF (Draft)'}`,
          'success'
        );
        clearClientCatalogCache();
        // Optimistic UI update
        setProducts(prev =>
          prev.map(p => (p.id === product.id ? { ...p, isAvailable: newStatus } : p))
        );
      } else {
        showToast(data.error || 'Gagal memperbarui status ketersediaan', 'error');
      }
    } catch (err) {
      showToast('Gagal terhubung ke server', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  // Delete Product
  const handleDeleteProduct = async () => {
    if (isReadOnly || !productToDelete) return;

    setIsDeleting(true);
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
        fetchData();
      } else {
        showToast(data.error || 'Gagal menghapus produk', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered and Sorted Products
  const filteredProducts = useMemo(() => {
    return products
      .filter(p => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = p.name.toLowerCase().includes(q);
          const matchCat = (p.category || '').toLowerCase().includes(q);
          const matchTag = (p.tag || '').toLowerCase().includes(q);
          const matchDesc = (p.description || '').toLowerCase().includes(q);
          if (!matchName && !matchCat && !matchTag && !matchDesc) return false;
        }

        // Category filter
        if (categoryFilter !== 'all' && (p.category || '').toLowerCase() !== categoryFilter.toLowerCase()) {
          return false;
        }

        // Status filter
        const threshold = typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 10;
        if (statusFilter === 'available' && p.isAvailable === false) return false;
        if (statusFilter === 'unavailable' && p.isAvailable !== false) return false;
        if (statusFilter === 'low_stock' && (p.stock <= 0 || p.stock > threshold)) return false;
        if (statusFilter === 'out_of_stock' && p.stock > 0) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
        if (sortBy === 'price_asc') return a.price - b.price;
        if (sortBy === 'price_desc') return b.price - a.price;
        if (sortBy === 'stock_asc') return a.stock - b.stock;
        if (sortBy === 'stock_desc') return b.stock - a.stock;
        return 0;
      });
  }, [products, searchQuery, categoryFilter, statusFilter, sortBy]);

  // Key KPI stats
  const totalSku = products.length;
  const availableCount = products.filter(p => p.isAvailable !== false).length;
  const unavailableCount = products.filter(p => p.isAvailable === false).length;
  const lowStockCount = products.filter(p => {
    const t = typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 10;
    return p.stock > 0 && p.stock <= t;
  }).length;
  const outOfStockCount = products.filter(p => p.stock <= 0).length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Admin Multi-Vendor Selector Header (if Admin) */}
      {allVendorsMode && (
        <AdminAllVendorsHeader
          title="Katalog Produk Semua Cabang Vendor"
          subtitle="Tinjau dan pantau ketersediaan serta harga produk seluruh vendor jaringan"
          selectedVendor={selectedVendor}
          onVendorChange={setSelectedVendor}
          onRefresh={fetchData}
          isLoading={loading}
          itemCount={products.length}
          itemLabel="Produk"
        />
      )}

      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
              <Coffee className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black font-heading text-stone-900 dark:text-stone-100">
                  {allVendorsMode ? 'Katalog Produk Lintas Vendor' : 'Manajemen Produk'}
                </h1>
                {user?.vendorName && !allVendorsMode && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 dark:bg-orange-950/60 text-accent border border-orange-200/80 dark:border-orange-900/60">
                    {user.vendorName}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {allVendorsMode
                  ? 'Pemantauan katalog produk gabungan seluruh cabang vendor terdaftar'
                  : 'Kelola daftar menu, harga jual, foto produk, dan ketersediaan toko Anda'}
              </p>
            </div>
          </div>
        </div>

        {/* Top Header Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Read-Only Badge for ADMIN */}
          {isReadOnly && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold shadow-2xs">
              <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Mode Lihat Saja (Read-Only)</span>
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#251e1c] border border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 shadow-2xs transition-colors cursor-pointer"
            title="Muat ulang data produk"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Add Product Button (Hanya Manager) */}
          {!isReadOnly && (
            <button
              type="button"
              id="btn-add-product"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent/90 shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Produk Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Read-Only Notice Banner for Non-Manager / Admin */}
      {isReadOnly && (
        <div className="rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            <span className="font-bold text-stone-900 dark:text-stone-100">
              {user?.role === 'ADMIN' ? 'Hak Akses Role ADMIN: Mode Pantau (Read-Only)' : 'Mode Lihat Saja'}
            </span> — Setiap vendor memiliki katalog produk yang terisolasi di database. Penambahan produk baru, pengubahan harga/stok, dan penghapusan produk khusus dikelola oleh role <strong className="text-amber-700 dark:text-amber-400">MANAGER</strong> pada masing-masing vendor.
          </div>
        </div>
      )}

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total SKU */}
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
            <span className="text-[11px] text-stone-400 ml-1.5">SKU Menu</span>
          </div>
        </div>

        {/* Produk Tersedia */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#251e1c] border border-emerald-200/60 dark:border-emerald-950/40 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Tersedia di Kasir</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-heading">
              {availableCount}
            </span>
            <span className="text-[11px] text-emerald-600/70 ml-1.5">Aktif dijual</span>
          </div>
        </div>

        {/* Produk Draft / Nonaktif */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Non-Aktif / Draft</span>
            <div className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500">
              <PackageX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-stone-600 dark:text-stone-300 font-heading">
              {unavailableCount}
            </span>
            <span className="text-[11px] text-stone-400 ml-1.5">Disembunyikan</span>
          </div>
        </div>

        {/* Stok Rendah & Kosong */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#251e1c] border border-amber-200/70 dark:border-amber-950/50 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Perhatian Stok</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-heading">
              {lowStockCount + outOfStockCount}
            </span>
            <span className="text-[11px] text-amber-600/80 ml-1.5">
              ({outOfStockCount} Habis, {lowStockCount} Tipis)
            </span>
          </div>
        </div>
      </div>

      {/* Filter, Search & View Bar */}
      <div className="bg-white dark:bg-[#251e1c] p-4 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari nama produk, kategori, tag, atau deskripsi..."
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

          {/* Sorter & View Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-1 bg-stone-50 dark:bg-stone-900 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-transparent text-stone-700 dark:text-stone-300 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="name_asc">Nama (A - Z)</option>
                <option value="name_desc">Nama (Z - A)</option>
                <option value="price_asc">Harga Terendah</option>
                <option value="price_desc">Harga Tertinggi</option>
                <option value="stock_asc">Stok Tersedikit</option>
                <option value="stock_desc">Stok Terbanyak</option>
              </select>
            </div>

            {/* Status Filter Dropdown */}
            <div className="flex items-center gap-1 bg-stone-50 dark:bg-stone-900 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 text-xs">
              <Filter className="w-3.5 h-3.5 text-stone-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="bg-transparent text-stone-700 dark:text-stone-300 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="available">Tersedia Saja</option>
                <option value="unavailable">Nonaktif / Draft</option>
                <option value="low_stock">Stok Menipis</option>
                <option value="out_of_stock">Stok Habis (0)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-[#251e1c] text-accent shadow-xs'
                    : 'text-stone-400 hover:text-stone-600'
                }`}
                title="Tampilan Grid Kartu"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-[#251e1c] text-accent shadow-xs'
                    : 'text-stone-400 hover:text-stone-600'
                }`}
                title="Tampilan Tabel / List"
              >
                <List className="w-4 h-4" />
              </button>
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
            Semua ({products.length})
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

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCw className="w-8 h-8 text-accent animate-spin" />
          <span className="text-xs font-semibold text-stone-500">Memuat katalog produk database...</span>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-orange-50 dark:bg-orange-950/60 text-accent flex items-center justify-center mx-auto">
            <Coffee className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Tidak ada produk ditemukan
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-md mx-auto">
              {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all'
                ? 'Tidak ada produk yang sesuai dengan kriteria pencarian dan filter Anda.'
                : 'Belum ada produk yang didaftarkan untuk vendor ini.'}
            </p>
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 rounded-2xl bg-accent text-white text-xs font-bold shadow-xs hover:bg-accent/90 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Produk Pertama</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map(product => {
            const threshold = typeof product.lowStockThreshold === 'number' ? product.lowStockThreshold : 10;
            const isOut = product.stock <= 0;
            const isLow = product.stock > 0 && product.stock <= threshold;
            const isAvailable = product.isAvailable !== false;
            const isToggling = togglingId === product.id;

            return (
              <div
                key={product.id}
                className={`flex flex-col justify-between rounded-3xl bg-white dark:bg-[#251e1c] border transition-all duration-200 overflow-hidden shadow-2xs hover:shadow-md ${
                  !isAvailable
                    ? 'border-stone-200 dark:border-stone-800 opacity-75'
                    : isOut
                    ? 'border-red-300 dark:border-red-900/60'
                    : isLow
                    ? 'border-amber-300 dark:border-amber-900/60'
                    : 'border-stone-200/80 dark:border-stone-800 hover:border-accent/40'
                }`}
              >
                {/* Image & Badges Banner */}
                <div className="relative aspect-4/3 bg-stone-100 dark:bg-stone-900 overflow-hidden">
                  <ProductImage
                    src={product.image}
                    alt={product.name}
                    category={product.category}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Top Left: Category & Vendor Tag */}
                  <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-xs text-white">
                      {product.category}
                    </span>
                    {allVendorsMode && product.vendorId && (
                      <VendorBadge vendorId={product.vendorId} />
                    )}
                  </div>

                  {/* Top Right: Tag Promo/Badge */}
                  {product.tag && (
                    <div className="absolute top-2.5 right-2.5">
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-accent text-white shadow-2xs">
                        {product.tag}
                      </span>
                    </div>
                  )}

                  {/* Bottom Ribbon: If unavailable / out of stock */}
                  {!isAvailable && (
                    <div className="absolute inset-x-0 bottom-0 py-1 bg-stone-900/80 backdrop-blur-xs text-stone-200 text-[10px] font-bold text-center tracking-wider uppercase">
                      Non-Aktif (Draft)
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100 font-heading line-clamp-1" title={product.name}>
                      {product.name}
                    </h3>
                    <p className="text-[11px] text-stone-400 line-clamp-2 mt-0.5 min-h-8">
                      {product.description || 'Tidak ada deskripsi produk.'}
                    </p>
                  </div>

                  {/* Price and Stock Indicators */}
                  <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800/80">
                    <div className="flex items-baseline justify-between">
                      <span className="text-base font-extrabold text-accent font-heading">
                        Rp {product.price.toLocaleString('id-ID')}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isOut
                          ? 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400'
                          : isLow
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                      }`}>
                        Stok: {product.stock}
                      </span>
                    </div>

                    {/* Availability Quick Toggle (Only for Manager) */}
                    {!isReadOnly && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-stone-500 font-medium">Status Kasir:</span>
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={() => handleToggleAvailability(product)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                            isAvailable
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border border-stone-200 dark:border-stone-700'
                          }`}
                          title="Klik untuk mengaktifkan / menonaktifkan produk di kasir"
                        >
                          {isToggling ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : isAvailable ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-stone-400" />
                          )}
                          <span>{isAvailable ? 'Tersedia' : 'Non-Aktif'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                {!isReadOnly ? (
                  <div className="px-4 py-2.5 bg-stone-50 dark:bg-stone-900/60 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(product)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#251e1c] border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:text-accent text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                        title="Ubah detail produk"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Ubah</span>
                      </button>

                      {/* Duplicate Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenDuplicateModal(product)}
                        className="p-1.5 rounded-xl bg-white dark:bg-[#251e1c] border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-stone-800 text-xs shadow-2xs transition-colors cursor-pointer"
                        title="Duplikasi produk ini menjadi produk baru"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => setProductToDelete(product)}
                      className="p-1.5 rounded-xl text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      title="Hapus produk dari katalog"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-2 bg-stone-50 dark:bg-stone-900/60 border-t border-stone-100 dark:border-stone-800/80 text-[10px] text-stone-400 font-mono">
                    ID: {product.id}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Table List View */
        <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 dark:bg-stone-900 border-b border-stone-200/80 dark:border-stone-800 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Produk</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4 text-right">Harga Jual</th>
                  <th className="py-3 px-4 text-center">Stok</th>
                  <th className="py-3 px-4 text-center">Status Kasir</th>
                  {!isReadOnly && <th className="py-3 px-4 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredProducts.map(product => {
                  const threshold = typeof product.lowStockThreshold === 'number' ? product.lowStockThreshold : 10;
                  const isOut = product.stock <= 0;
                  const isLow = product.stock > 0 && product.stock <= threshold;
                  const isAvailable = product.isAvailable !== false;
                  const isToggling = togglingId === product.id;

                  return (
                    <tr key={product.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-900/40 transition-colors">
                      {/* Product Thumbnail & Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0 border border-stone-200/60 dark:border-stone-700">
                            <ProductImage
                              src={product.image}
                              alt={product.name}
                              category={product.category}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-heading">
                                {product.name}
                              </span>
                              {product.tag && (
                                <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-orange-100 dark:bg-orange-950 text-accent">
                                  {product.tag}
                                </span>
                              )}
                              {allVendorsMode && product.vendorId && (
                                <VendorBadge vendorId={product.vendorId} />
                              )}
                            </div>
                            <span className="text-[11px] text-stone-400 line-clamp-1 max-w-xs">
                              {product.description || 'Tidak ada deskripsi'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                          {product.category}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-extrabold text-accent font-heading">
                          Rp {product.price.toLocaleString('id-ID')}
                        </span>
                      </td>

                      {/* Stock */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isOut
                            ? 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400'
                            : isLow
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                        }`}>
                          {product.stock} unit
                        </span>
                      </td>

                      {/* Availability */}
                      <td className="py-3 px-4 text-center">
                        {!isReadOnly ? (
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleToggleAvailability(product)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                              isAvailable
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                : 'bg-stone-100 dark:bg-stone-800 text-stone-400'
                            }`}
                          >
                            {isToggling ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : isAvailable ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            <span>{isAvailable ? 'Tersedia' : 'Non-Aktif'}</span>
                          </button>
                        ) : (
                          <span className={`text-[10px] font-bold ${isAvailable ? 'text-emerald-600' : 'text-stone-400'}`}>
                            {isAvailable ? 'Tersedia' : 'Non-Aktif'}
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      {!isReadOnly && (
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(product)}
                              className="p-1.5 rounded-lg text-stone-600 hover:text-accent hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                              title="Ubah Produk"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDuplicateModal(product)}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                              title="Duplikasi Produk"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setProductToDelete(product)}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer"
                              title="Hapus Produk"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Tambah / Ubah / Duplikasi Produk */}
      {!isReadOnly && isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full sm:max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-[#251e1c] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base font-heading flex items-center gap-2 flex-wrap">
                    <span>
                      {editingProduct
                        ? `Ubah Produk: ${editingProduct.name}`
                        : isDuplicating
                        ? 'Duplikasi Produk Baru'
                        : 'Tambah Produk Baru'}
                    </span>
                    {user?.vendorName && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-accent">
                        {user.vendorName}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Produk tersimpan di database khusus vendor Anda ({user?.vendorName || user?.vendorId}) dan hanya dapat dikelola oleh role Manager
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
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
                  placeholder="Contoh: Espresso Latte, Aren Cold Brew, Dimsum..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* Kategori & Harga Jual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                    Kategori Menu <span className="text-rose-500">*</span>
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
                    Batas Peringatan Minimum
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

              {/* Tag / Label Promosi */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                    Label / Tag (Opsional)
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {PRESET_TAGS.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setProdTag(prodTag === t ? '' : t)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                          prodTag === t
                            ? 'bg-accent text-white border-accent'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 border-transparent'
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
                  placeholder="Contoh: Best Seller, Promo, Signature..."
                  className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* Foto / Gambar Produk */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                  URL Foto Produk
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="url"
                    value={prodImage}
                    onChange={e => setProdImage(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  {prodImage && (
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                      <img
                        src={prodImage}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={e => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Quick Sample Image Suggestions */}
                <div className="mt-2">
                  <span className="text-[10px] text-stone-400 font-semibold block mb-1">
                    Atau pilih foto contoh cepat:
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {QUICK_SAMPLE_IMAGES.map((sample, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setProdImage(sample.url)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border shrink-0 transition-all cursor-pointer ${
                          prodImage === sample.url
                            ? 'bg-accent text-white border-accent'
                            : 'bg-stone-50 dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:bg-stone-100'
                        }`}
                      >
                        <span>📷</span>
                        <span>{sample.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Deskripsi Menu */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                  Deskripsi Menu / Komposisi
                </label>
                <textarea
                  rows={2}
                  value={prodDescription}
                  onChange={e => setProdDescription(e.target.value)}
                  placeholder="Ceritakan rasa, komposisi bahan baku, atau keunggulan menu ini..."
                  className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                />
              </div>

              {/* Status Ketersediaan Checkbox */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="modalProdIsAvailable"
                  checked={prodIsAvailable}
                  onChange={e => setProdIsAvailable(e.target.checked)}
                  className="w-4 h-4 rounded text-accent focus:ring-accent accent-orange-500 cursor-pointer"
                />
                <label htmlFor="modalProdIsAvailable" className="text-xs font-bold text-stone-800 dark:text-stone-200 cursor-pointer">
                  Produk Tersedia & Ditampilkan di Katalog Kasir
                </label>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-2xl bg-accent text-white text-xs font-bold shadow-md hover:opacity-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {editingProduct && !isDuplicating
                      ? 'Simpan Perubahan'
                      : isDuplicating
                      ? 'Duplikasi & Simpan'
                      : 'Tambah ke Database'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Hapus Produk */}
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
                Produk ini akan dihapus dari database vendor Anda secara permanen. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteProduct}
                className="flex-1 py-2.5 rounded-2xl bg-rose-600 text-white text-xs font-bold shadow-md hover:bg-rose-700 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
