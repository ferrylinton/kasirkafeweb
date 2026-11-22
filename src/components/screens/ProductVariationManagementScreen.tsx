import React, { useState, useEffect, useMemo } from 'react';
import {
  SlidersHorizontal,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Coffee,
  Search,
  Copy,
  Tag,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  Table2,
  ChevronRight
} from 'lucide-react';
import { Product, ProductVariation, VariationOption } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { clearClientCatalogCache } from '../../utils/productCache';

interface ProductVariationManagementScreenProps {
  onNavigateTab?: (tab: string) => void;
}

type SelectionType = 'SINGLE_SELECT' | 'MULTI_SELECT' | 'RADIO' | 'CHECKBOX';

const TYPE_LABELS: Record<SelectionType, string> = {
  SINGLE_SELECT: 'Single Select',
  MULTI_SELECT: 'Multi Select',
  RADIO: 'Radio',
  CHECKBOX: 'Checkbox'
};

export const ProductVariationManagementScreen: React.FC<ProductVariationManagementScreenProps> = ({
  onNavigateTab
}) => {
  const { user, token } = useAuth();
  const { showToast } = useToast();

  const isManager = user?.role === 'MANAGER';
  const isCashier = user?.role === 'CASHIER';

  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // View, Search & Filters
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | SelectionType>('ALL');
  const [requiredFilter, setRequiredFilter] = useState<'ALL' | 'REQUIRED' | 'OPTIONAL'>('ALL');

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingVariation, setEditingVariation] = useState<ProductVariation | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formType, setFormType] = useState<SelectionType>('SINGLE_SELECT');
  const [formRequired, setFormRequired] = useState<boolean>(false);
  const [formOptions, setFormOptions] = useState<VariationOption[]>([]);
  const [formProductIds, setFormProductIds] = useState<string[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');

  // Quick Required Toggle State
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Delete Confirmation Modal
  const [variationToDelete, setVariationToDelete] = useState<ProductVariation | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchVariationsAndProducts = async (showLoadingState = true) => {
    if (showLoadingState) setLoading(true);
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const [varRes, prodRes] = await Promise.all([
        fetch('/api/products/product-variations', {
          headers: { Authorization: `Bearer ${token || ''}` }
        }),
        fetch('/api/products?bypassCache=true', {
          headers: { Authorization: `Bearer ${token || ''}` }
        })
      ]);

      const varData = await varRes.json();
      const prodData = await prodRes.json();

      if (varData.success && Array.isArray(varData.variations)) {
        setVariations(varData.variations);
      } else {
        const msg = varData.error || 'Gagal memuat variasi produk';
        setLoadError(msg);
        showToast(msg, 'error');
      }

      if (prodData.success && Array.isArray(prodData.products)) {
        setProducts(prodData.products);
      }
    } catch (err) {
      console.error('Error fetching variations/products:', err);
      const msg = 'Terjadi kesalahan jaringan saat memuat data variasi produk';
      setLoadError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVariationsAndProducts();
  }, [token]);

  // Open Create Modal
  const openCreateModal = () => {
    setEditingVariation(null);
    setFormName('');
    setFormType('SINGLE_SELECT');
    setFormRequired(false);
    setFormOptions([
      { id: `opt_${Date.now()}_0`, name: 'Regular', extraPrice: 0, isDefault: true },
      { id: `opt_${Date.now()}_1`, name: 'Large', extraPrice: 5000, isDefault: false }
    ]);
    setFormProductIds([]);
    setProductSearchQuery('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (variation: ProductVariation) => {
    setEditingVariation(variation);
    setFormName(variation.name);
    setFormType((variation.type as SelectionType) || 'SINGLE_SELECT');
    setFormRequired(!!variation.required);
    setFormOptions(
      Array.isArray(variation.options) && variation.options.length > 0
        ? JSON.parse(JSON.stringify(variation.options))
        : [{ id: `opt_${Date.now()}_0`, name: 'Opsi Standar', extraPrice: 0, isDefault: true }]
    );

    const linkedProductIds = Array.from(
      new Set([
        ...(Array.isArray(variation.productIds) ? variation.productIds : []),
        ...products
          .filter(p => Array.isArray(p.variationIds) && p.variationIds.includes(variation.id))
          .map(p => p.id)
      ])
    );

    setFormProductIds(linkedProductIds);
    setProductSearchQuery('');
    setIsModalOpen(true);
  };

  // Duplicate Variation into Create Modal
  const duplicateVariation = (variation: ProductVariation) => {
    setEditingVariation(null);
    setFormName(`${variation.name} (Salinan)`);
    setFormType((variation.type as SelectionType) || 'SINGLE_SELECT');
    setFormRequired(!!variation.required);
    setFormOptions(
      (variation.options || []).map((opt, idx) => ({
        ...opt,
        id: `opt_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`
      }))
    );
    setFormProductIds([]);
    setProductSearchQuery('');
    setIsModalOpen(true);
    showToast(`Menyalin template variasi '${variation.name}'`, 'info');
  };

  // Preset Templates
  const applyPreset = (presetName: string) => {
    const now = Date.now();
    switch (presetName) {
      case 'ukuran':
        setFormName('Ukuran Cup');
        setFormType('SINGLE_SELECT');
        setFormRequired(true);
        setFormOptions([
          { id: `opt_${now}_0`, name: 'Regular 12oz', extraPrice: 0, isDefault: true },
          { id: `opt_${now}_1`, name: 'Large 16oz', extraPrice: 5000, isDefault: false },
          { id: `opt_${now}_2`, name: 'Jumbo 22oz', extraPrice: 9000, isDefault: false }
        ]);
        break;
      case 'es':
        setFormName('Level Es');
        setFormType('SINGLE_SELECT');
        setFormRequired(false);
        setFormOptions([
          { id: `opt_${now}_0`, name: 'Normal Ice', extraPrice: 0, isDefault: true },
          { id: `opt_${now}_1`, name: 'Less Ice', extraPrice: 0, isDefault: false },
          { id: `opt_${now}_2`, name: 'No Ice', extraPrice: 0, isDefault: false }
        ]);
        break;
      case 'gula':
        setFormName('Tingkat Gula');
        setFormType('SINGLE_SELECT');
        setFormRequired(false);
        setFormOptions([
          { id: `opt_${now}_0`, name: '100% Normal', extraPrice: 0, isDefault: true },
          { id: `opt_${now}_1`, name: '50% Less Sugar', extraPrice: 0, isDefault: false },
          { id: `opt_${now}_2`, name: '0% No Sugar', extraPrice: 0, isDefault: false }
        ]);
        break;
      case 'shot':
        setFormName('Espresso Shot');
        setFormType('SINGLE_SELECT');
        setFormRequired(false);
        setFormOptions([
          { id: `opt_${now}_0`, name: 'Normal (1 Shot)', extraPrice: 0, isDefault: true },
          { id: `opt_${now}_1`, name: '+1 Extra Shot', extraPrice: 5000, isDefault: false },
          { id: `opt_${now}_2`, name: '+2 Extra Shot', extraPrice: 10000, isDefault: false }
        ]);
        break;
      case 'susu':
        setFormName('Pilihan Susu');
        setFormType('SINGLE_SELECT');
        setFormRequired(false);
        setFormOptions([
          { id: `opt_${now}_0`, name: 'Fresh Milk (Dairy)', extraPrice: 0, isDefault: true },
          { id: `opt_${now}_1`, name: 'Oat Milk (Plant-based)', extraPrice: 6000, isDefault: false },
          { id: `opt_${now}_2`, name: 'Almond Milk', extraPrice: 8000, isDefault: false },
          { id: `opt_${now}_3`, name: 'Soy Milk', extraPrice: 5000, isDefault: false }
        ]);
        break;
      case 'topping':
        setFormName('Topping Ekstra');
        setFormType('MULTI_SELECT');
        setFormRequired(false);
        setFormOptions([
          { id: `opt_${now}_0`, name: 'Brown Sugar Boba', extraPrice: 4000, isDefault: false },
          { id: `opt_${now}_1`, name: 'Grass Jelly (Cincau)', extraPrice: 3500, isDefault: false },
          { id: `opt_${now}_2`, name: 'Egg Pudding', extraPrice: 4000, isDefault: false },
          { id: `opt_${now}_3`, name: 'Coffee Jelly', extraPrice: 4000, isDefault: false },
          { id: `opt_${now}_4`, name: 'Whipped Cream', extraPrice: 3000, isDefault: false }
        ]);
        break;
      default:
        break;
    }
    showToast(`Preset '${presetName}' diterapkan ke form`, 'info');
  };

  // Option CRUD Operations inside Form
  const addOption = () => {
    setFormOptions(prev => [
      ...prev,
      {
        id: `opt_${Date.now()}_${prev.length}`,
        name: `Opsi ${prev.length + 1}`,
        extraPrice: 0,
        isDefault: false
      }
    ]);
  };

  const removeOption = (index: number) => {
    if (formOptions.length <= 1) {
      showToast('Variasi harus memiliki minimal satu opsi', 'warning');
      return;
    }
    setFormOptions(prev => prev.filter((_, idx) => idx !== index));
  };

  const moveOption = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= formOptions.length) return;
    setFormOptions(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIdx, 0, moved);
      return copy;
    });
  };

  const updateOptionField = (index: number, field: keyof VariationOption, value: unknown) => {
    const isSingleMode = formType === 'SINGLE_SELECT' || formType === 'RADIO';
    setFormOptions(prev => {
      const copy = [...prev];
      if (field === 'isDefault' && value === true && isSingleMode) {
        return copy.map((opt, idx) => ({ ...opt, isDefault: idx === index }));
      }
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleTypeChange = (nextType: SelectionType) => {
    setFormType(nextType);
    if (nextType === 'SINGLE_SELECT' || nextType === 'RADIO') {
      setFormOptions(prev => {
        let seenDefault = false;
        return prev.map(opt => {
          if (opt.isDefault && !seenDefault) {
            seenDefault = true;
            return opt;
          }
          return { ...opt, isDefault: false };
        });
      });
    }
  };

  // Create / Update Variation Submit
  const handleSaveVariation = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = formName.trim().replace(/\s+/g, ' ');
    if (trimmedName.length < 2) {
      showToast('Nama variasi minimal 2 karakter', 'warning');
      return;
    }

    if (formOptions.length === 0) {
      showToast('Variasi harus memiliki minimal satu opsi pilihan', 'warning');
      return;
    }

    for (const opt of formOptions) {
      if (!opt.name.trim()) {
        showToast('Semua nama opsi harus diisi', 'warning');
        return;
      }
      if (Number(opt.extraPrice) < 0 || Number.isNaN(Number(opt.extraPrice))) {
        showToast('Harga ekstra tidak boleh negatif', 'warning');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        name: trimmedName,
        type: formType,
        required: formRequired,
        options: formOptions.map(opt => ({
          id: opt.id,
          name: opt.name.trim().replace(/\s+/g, ' '),
          extraPrice: Math.round(Number(opt.extraPrice || 0)),
          isDefault: !!opt.isDefault
        })),
        productIds: formProductIds
      };

      const endpoint = editingVariation
        ? `/api/products/product-variations/${editingVariation.id}`
        : '/api/products/product-variations';
      const method = editingVariation ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        showToast(
          editingVariation ? 'Variasi produk berhasil diperbarui!' : 'Variasi produk berhasil dibuat!',
          'success'
        );
        clearClientCatalogCache();
        setIsModalOpen(false);
        await fetchVariationsAndProducts(false);
      } else {
        showToast(data.error || 'Gagal menyimpan variasi produk', 'error');
      }
    } catch (err) {
      console.error('Error saving variation:', err);
      showToast('Terjadi kesalahan sistem saat menyimpan variasi', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Toggle Required Status
  const handleToggleRequired = async (variation: ProductVariation) => {
    if (!isManager) return;
    const nextRequired = !variation.required;
    setTogglingId(variation.id);
    try {
      const res = await fetch(`/api/products/product-variations/${variation.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({ required: nextRequired })
      });
      const data = await res.json();
      if (data.success) {
        setVariations(prev =>
          prev.map(v => (v.id === variation.id ? { ...v, required: nextRequired } : v))
        );
        clearClientCatalogCache();
        showToast(
          `'${variation.name}' diatur menjadi ${nextRequired ? 'Wajib Dipilih' : 'Opsional'}`,
          'success'
        );
      } else {
        showToast(data.error || 'Gagal mengubah status wajib variasi', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  // Delete Variation
  const handleDeleteVariation = async () => {
    if (!variationToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products/product-variations/${variationToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token || ''}` }
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Variasi produk berhasil dihapus!', 'success');
        clearClientCatalogCache();
        setVariationToDelete(null);
        await fetchVariationsAndProducts(false);
      } else {
        showToast(data.error || 'Gagal menghapus variasi produk', 'error');
      }
    } catch (err) {
      console.error('Error deleting variation:', err);
      showToast('Terjadi kesalahan sistem saat menghapus variasi', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter & Search Logic
  const filteredVariations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return variations.filter(v => {
      const matchesSearch =
        !q ||
        v.name.toLowerCase().includes(q) ||
        (v.options || []).some(opt => opt.name.toLowerCase().includes(q)) ||
        (v.productNames && v.productNames.some(pName => pName.toLowerCase().includes(q)));

      const vType = (v.type || 'SINGLE_SELECT') as SelectionType;
      const matchesType = typeFilter === 'ALL' || vType === typeFilter;

      const matchesRequired =
        requiredFilter === 'ALL' ||
        (requiredFilter === 'REQUIRED' && !!v.required) ||
        (requiredFilter === 'OPTIONAL' && !v.required);

      return matchesSearch && matchesType && matchesRequired;
    });
  }, [variations, searchQuery, typeFilter, requiredFilter]);

  const filteredModalProducts = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      p => p.name.toLowerCase().includes(q) || String(p.category || '').toLowerCase().includes(q)
    );
  }, [products, productSearchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = variations.length;
    const requiredCount = variations.filter(v => !!v.required).length;
    const totalOptions = variations.reduce((acc, curr) => acc + (curr.options?.length || 0), 0);
    const avgOptions = total > 0 ? (totalOptions / total).toFixed(1) : '0.0';
    const totalLinkedProducts = variations.reduce(
      (acc, curr) => acc + (curr.usedInProductsCount ?? curr.productIds?.length ?? 0),
      0
    );

    return { total, requiredCount, totalOptions, avgOptions, totalLinkedProducts };
  }, [variations]);

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Sub-Navigation Breadcrumb / Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 dark:border-stone-800 pb-3">
        <nav aria-label="Navigasi Manajemen Produk" className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => (onNavigateTab ? onNavigateTab('produk-manajemen') : null)}
            className="text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 py-1.5 px-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Manajemen Produk</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-stone-900 dark:text-stone-100 whitespace-nowrap shrink-0 px-2 py-1.5">
            Variasi Produk
          </span>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fetchVariationsAndProducts(false)}
            disabled={isRefreshing}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 min-h-[40px]"
            title="Muat ulang data variasi"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          {isManager && (
            <button
              type="button"
              id="add-variation-btn"
              onClick={openCreateModal}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-accent hover:bg-accent/90 text-white transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 min-h-[40px]"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Variasi</span>
            </button>
          )}
        </div>
      </div>

      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 font-heading tracking-tight">
            Manajemen Variasi Produk
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Kelola grup modifier (Ukuran Cup, Level Es, Tingkat Gula, Topping) dan hubungkan langsung ke produk.
          </p>
        </div>
        <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums whitespace-nowrap">
          {filteredVariations.length} dari {variations.length} variasi ditampilkan
        </div>
      </div>

      {/* Cashier Notice Banner */}
      {isCashier && (
        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center gap-3 text-xs text-amber-900 dark:text-amber-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            Mode Lihat Saja: Anda dapat melihat daftar variasi dan harga ekstra untuk referensi kasir. Perubahan data dilakukan oleh Manager.
          </p>
        </div>
      )}

      {/* Metrics Strip (Single-Elevation, Hairline Borders, Tabular Numerals) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <div className="text-xs font-medium text-stone-500 dark:text-stone-400">Total Variasi</div>
          <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 mt-1 tabular-nums">
            {metrics.total}
          </div>
          <div className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">Grup modifier aktif</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <div className="text-xs font-medium text-stone-500 dark:text-stone-400">Variasi Wajib</div>
          <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 mt-1 tabular-nums">
            {metrics.requiredCount}
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
            Mandatori saat transaksi kasir
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <div className="text-xs font-medium text-stone-500 dark:text-stone-400">Total Opsi Pilihan</div>
          <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 mt-1 tabular-nums">
            {metrics.totalOptions}
          </div>
          <div className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5 tabular-nums">
            Rata-rata {metrics.avgOptions} opsi per variasi
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <div className="text-xs font-medium text-stone-500 dark:text-stone-400">Keterkaitan Produk</div>
          <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 mt-1 tabular-nums">
            {metrics.totalLinkedProducts}
          </div>
          <div className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
            Total tautan aktif di {products.length} produk
          </div>
        </div>
      </div>

      {/* Filter, Search & View Mode Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama variasi, opsi (contoh: Large, Oat Milk), atau nama produk..."
            className="w-full pl-10 pr-9 py-2 bg-stone-50 dark:bg-stone-800/70 rounded-xl text-xs sm:text-sm border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-accent min-h-[40px]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Hapus pencarian"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Selection Type Filter */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl overflow-x-auto">
            {(['ALL', 'SINGLE_SELECT', 'MULTI_SELECT', 'RADIO', 'CHECKBOX'] as const).map(typeKey => (
              <button
                key={typeKey}
                type="button"
                onClick={() => setTypeFilter(typeKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  typeFilter === typeKey
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-semibold shadow-2xs'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                {typeKey === 'ALL' ? 'Semua Tipe' : TYPE_LABELS[typeKey]}
              </button>
            ))}
          </div>

          {/* Required Status Filter */}
          <select
            aria-label="Filter status wajib"
            value={requiredFilter}
            onChange={e => setRequiredFilter(e.target.value as 'ALL' | 'REQUIRED' | 'OPTIONAL')}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 focus:outline-hidden focus:ring-2 focus:ring-accent cursor-pointer min-h-[40px]"
          >
            <option value="ALL">Semua Status</option>
            <option value="REQUIRED">Wajib Dipilih</option>
            <option value="OPTIONAL">Opsional</option>
          </select>

          {/* View Mode Toggle: Grid vs Table */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Tampilan Kartu"
              title="Tampilan Kartu"
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-label="Tampilan Tabel"
              title="Tampilan Tabel"
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <Table2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map(idx => (
            <div
              key={idx}
              className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 space-y-4 animate-pulse"
            >
              <div className="space-y-2">
                <div className="h-5 w-2/3 bg-stone-200 dark:bg-stone-800 rounded" />
                <div className="h-3.5 w-1/2 bg-stone-100 dark:bg-stone-800/70 rounded" />
              </div>
              <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                <div className="h-7 bg-stone-100 dark:bg-stone-800/60 rounded" />
                <div className="h-7 bg-stone-100 dark:bg-stone-800/60 rounded" />
                <div className="h-7 bg-stone-100 dark:bg-stone-800/60 rounded" />
              </div>
              <div className="h-4 w-3/4 bg-stone-100 dark:bg-stone-800/60 rounded" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="p-10 text-center bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
            Gagal Memuat Data Variasi
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">{loadError}</p>
          <button
            type="button"
            onClick={() => fetchVariationsAndProducts(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-accent hover:bg-accent/90 text-white inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Coba Lagi</span>
          </button>
        </div>
      ) : filteredVariations.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 flex items-center justify-center">
            <SlidersHorizontal className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              {searchQuery || typeFilter !== 'ALL' || requiredFilter !== 'ALL'
                ? 'Tidak ada variasi yang cocok dengan filter saat ini'
                : 'Belum ada variasi produk tersimpan'}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto mt-1">
              Tambahkan variasi seperti Ukuran Cup, Level Es, Tingkat Gula, atau Topping agar kasir dapat menyesuaikan pesanan pelanggan.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            {(searchQuery || typeFilter !== 'ALL' || requiredFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('ALL');
                  setRequiredFilter('ALL');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                Reset Filter
              </button>
            )}
            {isManager && (
              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-accent hover:bg-accent/90 text-white transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Variasi Pertama</span>
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View (Single-Elevation Cards, Clean Hairline Dividers, Zero Static Pills) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVariations.map(variation => {
            const vType = (variation.type || 'SINGLE_SELECT') as SelectionType;
            const linkedCount = variation.usedInProductsCount ?? variation.productIds?.length ?? 0;

            return (
              <div
                key={variation.id}
                className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 flex flex-col justify-between transition-colors hover:border-stone-300 dark:hover:border-stone-700"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-100 dark:border-stone-800">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading truncate">
                        {variation.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 mt-1">
                        <span>{TYPE_LABELS[vType] || vType}</span>
                        <span aria-hidden="true">·</span>
                        {isManager ? (
                          <button
                            type="button"
                            disabled={togglingId === variation.id}
                            onClick={() => handleToggleRequired(variation)}
                            title="Klik untuk ubah status Wajib / Opsional"
                            className={`font-medium underline-offset-2 hover:underline cursor-pointer disabled:opacity-50 ${
                              variation.required
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-stone-500 dark:text-stone-400'
                            }`}
                          >
                            {variation.required ? 'Wajib dipilih' : 'Opsional'}
                          </button>
                        ) : (
                          <span className={variation.required ? 'text-amber-700 dark:text-amber-400 font-medium' : ''}>
                            {variation.required ? 'Wajib dipilih' : 'Opsional'}
                          </span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{variation.options?.length || 0} opsi</span>
                      </div>
                    </div>

                    {isManager && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => duplicateVariation(variation)}
                          className="w-9 h-9 rounded-xl text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center transition-colors cursor-pointer"
                          title="Duplikasi Variasi"
                          aria-label={`Duplikasi ${variation.name}`}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(variation)}
                          className="w-9 h-9 rounded-xl text-stone-400 hover:text-accent hover:bg-orange-50 dark:hover:bg-orange-950/40 flex items-center justify-center transition-colors cursor-pointer"
                          title="Edit Variasi"
                          aria-label={`Edit ${variation.name}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setVariationToDelete(variation)}
                          className="w-9 h-9 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                          title="Hapus Variasi"
                          aria-label={`Hapus ${variation.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Options List (Hairline Dividers, No Nested Cards) */}
                  <div className="divide-y divide-stone-100 dark:divide-stone-800 my-2">
                    {(variation.options || []).map((opt, optIdx) => (
                      <div
                        key={opt.id || optIdx}
                        className="flex items-center justify-between gap-2 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-stone-800 dark:text-stone-200 truncate">
                            {opt.name}
                          </span>
                          {opt.isDefault && (
                            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
                              (Default)
                            </span>
                          )}
                        </div>
                        <span
                          className={`font-mono text-xs tabular-nums shrink-0 ${
                            opt.extraPrice > 0
                              ? 'text-stone-900 dark:text-stone-100 font-semibold'
                              : 'text-stone-400 dark:text-stone-500'
                          }`}
                        >
                          {opt.extraPrice > 0 ? `+Rp ${opt.extraPrice.toLocaleString('id-ID')}` : 'Gratis'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Linked Products Summary (Unboxed Metadata Text) */}
                <div className="pt-3 border-t border-stone-100 dark:border-stone-800 mt-2 text-xs">
                  <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-1">
                    <span>Produk tertaut</span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200 tabular-nums">
                      {linkedCount} produk
                    </span>
                  </div>
                  {variation.productNames && variation.productNames.length > 0 ? (
                    <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-2 leading-relaxed">
                      {variation.productNames.join(' · ')}
                    </p>
                  ) : (
                    <p className="text-xs text-stone-400 dark:text-stone-500">
                      Belum dihubungkan ke produk
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Dense Master Table View */
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-500 dark:text-stone-400 bg-stone-50/70 dark:bg-stone-800/40">
                  <th className="py-3 px-4">Nama Variasi</th>
                  <th className="py-3 px-4">Tipe Seleksi</th>
                  <th className="py-3 px-4">Aturan</th>
                  <th className="py-3 px-4">Opsi &amp; Harga Ekstra</th>
                  <th className="py-3 px-4 text-right">Produk Tertaut</th>
                  {isManager && <th className="py-3 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800 text-xs">
                {filteredVariations.map(variation => {
                  const vType = (variation.type || 'SINGLE_SELECT') as SelectionType;
                  const linkedCount = variation.usedInProductsCount ?? variation.productIds?.length ?? 0;
                  return (
                    <tr
                      key={variation.id}
                      className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-semibold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                        {variation.name}
                      </td>
                      <td className="py-3 px-4 text-stone-600 dark:text-stone-300 whitespace-nowrap">
                        {TYPE_LABELS[vType] || vType}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isManager ? (
                          <button
                            type="button"
                            disabled={togglingId === variation.id}
                            onClick={() => handleToggleRequired(variation)}
                            className={`font-medium hover:underline cursor-pointer ${
                              variation.required
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-stone-500 dark:text-stone-400'
                            }`}
                          >
                            {variation.required ? 'Wajib' : 'Opsional'}
                          </button>
                        ) : (
                          <span className={variation.required ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-stone-500'}>
                            {variation.required ? 'Wajib' : 'Opsional'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-stone-600 dark:text-stone-300 max-w-md">
                        <div className="truncate">
                          {(variation.options || [])
                            .map(o =>
                              o.extraPrice > 0
                                ? `${o.name} (+Rp ${o.extraPrice.toLocaleString('id-ID')})`
                                : o.name
                            )
                            .join(' · ')}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-stone-700 dark:text-stone-200 whitespace-nowrap">
                        {linkedCount} produk
                      </td>
                      {isManager && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => duplicateVariation(variation)}
                              className="p-2 rounded-lg text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                              title="Duplikasi"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(variation)}
                              className="p-2 rounded-lg text-stone-400 hover:text-accent hover:bg-orange-50 dark:hover:bg-orange-950/40 cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setVariationToDelete(variation)}
                              className="p-2 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 w-full max-w-2xl p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-4 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-heading">
                  {editingVariation ? 'Edit Variasi Produk' : 'Tambah Variasi Produk'}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Atur nama grup variasi, daftar opsi beserta harga ekstra, dan produk yang menggunakannya.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup modal"
                className="w-9 h-9 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="shrink-0">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-600 dark:text-stone-300 mb-2">
                <span>Template Cepat (Opsional):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'ukuran', label: 'Ukuran Cup' },
                  { id: 'es', label: 'Level Es' },
                  { id: 'gula', label: 'Tingkat Gula' },
                  { id: 'shot', label: 'Espresso Shot' },
                  { id: 'susu', label: 'Pilihan Susu' },
                  { id: 'topping', label: 'Topping Ekstra' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveVariation} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    Nama Variasi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Contoh: Ukuran Cup, Topping..."
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 rounded-xl text-xs sm:text-sm border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    Tipe Seleksi
                  </label>
                  <select
                    value={formType}
                    onChange={e => handleTypeChange(e.target.value as SelectionType)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 rounded-xl text-xs sm:text-sm border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-accent"
                  >
                    <option value="SINGLE_SELECT">Single Select (Pilih 1)</option>
                    <option value="RADIO">Radio Buttons (Pilih 1)</option>
                    <option value="MULTI_SELECT">Multi Select (Pilih Banyak)</option>
                    <option value="CHECKBOX">Checkboxes (Pilih Banyak)</option>
                  </select>
                </div>
              </div>

              {/* Required Switch */}
              <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                    Wajib Dipilih Kasir ({formRequired ? 'Aktif' : 'Opsional'})
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    Kasir wajib memilih opsi variasi ini sebelum menambahkan item ke keranjang.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formRequired}
                  onClick={() => setFormRequired(!formRequired)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    formRequired ? 'bg-accent' : 'bg-stone-300 dark:bg-stone-700'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      formRequired ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Options Builder */}
              <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-orange-500" />
                    <span className="tabular-nums">Daftar Opsi ({formOptions.length})</span>
                  </label>
                  <button
                    type="button"
                    onClick={addOption}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-100 dark:bg-orange-950 text-accent hover:bg-orange-200 dark:hover:bg-orange-900 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Opsi</span>
                  </button>
                </div>

                <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  {formOptions.map((opt, idx) => (
                    <div
                      key={opt.id || idx}
                      className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 bg-white dark:bg-stone-900"
                    >
                      <span className="text-[11px] font-mono text-stone-400 w-5 text-center tabular-nums">
                        {idx + 1}
                      </span>

                      <input
                        type="text"
                        required
                        value={opt.name}
                        onChange={e => updateOptionField(idx, 'name', e.target.value)}
                        placeholder="Nama opsi (misal: Large 16oz)"
                        className="flex-1 min-w-[140px] px-3 py-1.5 bg-stone-50 dark:bg-stone-800 rounded-lg text-xs border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-1 focus:ring-accent"
                      />

                      <div className="w-32 relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-stone-400">
                          +Rp
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          value={opt.extraPrice}
                          onChange={e => updateOptionField(idx, 'extraPrice', Number(e.target.value))}
                          placeholder="0"
                          className="w-full pl-8 pr-2 py-1.5 bg-stone-50 dark:bg-stone-800 rounded-lg text-xs font-mono tabular-nums border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-1 focus:ring-accent"
                        />
                      </div>

                      <label className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300 cursor-pointer shrink-0 px-1">
                        <input
                          type={formType === 'MULTI_SELECT' || formType === 'CHECKBOX' ? 'checkbox' : 'radio'}
                          name="variationDefaultOption"
                          checked={!!opt.isDefault}
                          onChange={e => updateOptionField(idx, 'isDefault', e.target.checked)}
                          className="w-3.5 h-3.5 accent-orange-500 rounded"
                        />
                        <span>Default</span>
                      </label>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveOption(idx, -1)}
                          disabled={idx === 0}
                          className="w-7 h-7 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-30 flex items-center justify-center cursor-pointer"
                          title="Geser ke atas"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveOption(idx, 1)}
                          disabled={idx === formOptions.length - 1}
                          className="w-7 h-7 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-30 flex items-center justify-center cursor-pointer"
                          title="Geser ke bawah"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeOption(idx)}
                          className="w-7 h-7 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center cursor-pointer"
                          title="Hapus opsi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Link to Products */}
              <div className="pt-3 border-t border-stone-100 dark:border-stone-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 tabular-nums">
                    Hubungkan ke Produk ({formProductIds.length} dipilih)
                  </span>
                  {products.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setFormProductIds(products.map(p => p.id))}
                        className="text-accent hover:underline font-medium cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-stone-300 dark:text-stone-700">|</span>
                      <button
                        type="button"
                        onClick={() => setFormProductIds([])}
                        className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-medium cursor-pointer"
                      >
                        Kosongkan
                      </button>
                    </div>
                  )}
                </div>

                {products.length > 4 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={productSearchQuery}
                      onChange={e => setProductSearchQuery(e.target.value)}
                      placeholder="Filter produk berdasarkan nama atau kategori..."
                      className="w-full pl-8 pr-3 py-1.5 bg-stone-50 dark:bg-stone-800 rounded-lg text-xs border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-1 focus:ring-accent"
                    />
                  </div>
                )}

                {products.length === 0 ? (
                  <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl text-xs text-stone-500 text-center">
                    Belum ada produk. Tambahkan produk di halaman Manajemen Produk.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                    {filteredModalProducts.map(prod => {
                      const isChecked = formProductIds.includes(prod.id);
                      return (
                        <label
                          key={prod.id}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-colors flex items-center gap-2 ${
                            isChecked
                              ? 'bg-orange-50/70 dark:bg-orange-950/30 border-orange-500/70 text-stone-900 dark:text-stone-100 font-semibold'
                              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) {
                                setFormProductIds(prev => (prev.includes(prod.id) ? prev : [...prev, prod.id]));
                              } else {
                                setFormProductIds(prev => prev.filter(pId => pId !== prod.id));
                              }
                            }}
                            className="w-3.5 h-3.5 accent-orange-500 rounded shrink-0"
                          />
                          <span className="truncate flex-1">{prod.name}</span>
                          <span className="text-[11px] text-stone-400 shrink-0 capitalize">{prod.category}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-stone-100 dark:border-stone-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer min-h-[40px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-accent hover:bg-accent/90 text-white transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 min-h-[40px]"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingVariation ? 'Perbarui Variasi' : 'Simpan Variasi'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {variationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="w-11 h-11 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-heading">
                Hapus Variasi Produk?
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                Anda akan menghapus variasi{' '}
                <strong className="text-stone-900 dark:text-stone-100">
                  '{variationToDelete.name}'
                </strong>
                . Tindakan ini tidak dapat dibatalkan.
              </p>
              {variationToDelete.usedInProductsCount && variationToDelete.usedInProductsCount > 0 ? (
                <p className="mt-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                  Variasi ini sedang terhubung ke {variationToDelete.usedInProductsCount} produk (
                  {variationToDelete.productNames?.join(', ')}). Menghapusnya akan melepaskan variasi tersebut dari produk terkait.
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setVariationToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer min-h-[40px]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteVariation}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[40px]"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Variasi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
