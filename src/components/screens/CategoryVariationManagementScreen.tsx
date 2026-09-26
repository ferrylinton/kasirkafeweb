import React, { useState, useEffect, useMemo } from 'react';
import {
  SlidersHorizontal,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  Sparkles,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  Layers,
  ChevronRight,
  Search,
  CheckCircle2,
  Copy,
  FolderTree,
  Tag,
  DollarSign,
  ArrowUpDown
} from 'lucide-react';
import { Category, CategoryVariation, VariationOption } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { clearClientCatalogCache } from '../../utils/productCache';

interface CategoryVariationManagementScreenProps {
  onNavigateTab?: (tab: string) => void;
}

export const CategoryVariationManagementScreen: React.FC<CategoryVariationManagementScreenProps> = ({ onNavigateTab }) => {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';
  const isCashier = user?.role === 'CASHIER';
  const canManage = isManager || isAdmin;

  const [variations, setVariations] = useState<CategoryVariation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingVariation, setEditingVariation] = useState<CategoryVariation | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formType, setFormType] = useState<'SINGLE_SELECT' | 'MULTI_SELECT' | 'RADIO' | 'CHECKBOX'>('SINGLE_SELECT');
  const [formRequired, setFormRequired] = useState<boolean>(false);
  const [formOptions, setFormOptions] = useState<VariationOption[]>([]);
  const [formCategoryIds, setFormCategoryIds] = useState<string[]>([]);

  // Delete Confirmation Modal
  const [variationToDelete, setVariationToDelete] = useState<CategoryVariation | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchVariationsAndCategories = async (showLoadingState = true) => {
    if (showLoadingState) setLoading(true);
    setIsRefreshing(true);
    try {
      const vendorParam = isAdmin ? (selectedVendor === 'all' ? '?allVendors=true' : `?vendorId=${selectedVendor}`) : '';
      const [varRes, catRes] = await Promise.all([
        fetch(`/api/products/category-variations${vendorParam}`, {
          headers: { Authorization: `Bearer ${token || ''}` }
        }),
        fetch(`/api/products/categories?bypassCache=true${vendorParam ? '&' + vendorParam.slice(1) : ''}`, {
          headers: { Authorization: `Bearer ${token || ''}` }
        })
      ]);

      const varData = await varRes.json();
      const catData = await catRes.json();

      if (varData.success && Array.isArray(varData.variations)) {
        setVariations(varData.variations);
      } else {
        showToast('Gagal memuat variasi kategori', 'error');
      }

      if (catData.success && Array.isArray(catData.categories)) {
        setCategories(catData.categories);
      }
    } catch (err) {
      console.error('Error fetching variations/categories:', err);
      showToast('Terjadi kesalahan jaringan saat memuat data variasi', 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVariationsAndCategories();
  }, [token, selectedVendor]);

  // Open Create Modal
  const openCreateModal = () => {
    setEditingVariation(null);
    setFormName('');
    setFormOptions([
      { id: `opt_${Date.now()}_0`, name: 'Pilihan 1', extraPrice: 0, isDefault: true },
      { id: `opt_${Date.now()}_1`, name: 'Pilihan 2', extraPrice: 5000, isDefault: false }
    ]);
    setFormCategoryIds([]);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (variation: CategoryVariation) => {
    setEditingVariation(variation);
    setFormName(variation.name);
    setFormOptions(
      Array.isArray(variation.options) && variation.options.length > 0
        ? JSON.parse(JSON.stringify(variation.options))
        : [{ id: `opt_${Date.now()}_0`, name: 'Opsi Standar', extraPrice: 0, isDefault: true }]
    );

    // Identify which categories currently reference this variation
    const linkedCatIds = categories
      .filter(c => {
        const catVarIds = [
          ...(Array.isArray(c.categoryVariationIds) ? c.categoryVariationIds : []),
          ...(Array.isArray(c.variationIds) ? c.variationIds : []),
          c.categoryVariationId
        ].filter(Boolean);
        return catVarIds.some(vId => vId && vId.toString() === variation.id);
      })
      .map(c => c.id);

    setFormCategoryIds(linkedCatIds);
    setIsModalOpen(true);
  };

  // Duplicate Variation
  const duplicateVariation = (variation: CategoryVariation) => {
    setEditingVariation(null);
    setFormName(`${variation.name} (Salinan)`);
    setFormOptions(
      variation.options.map(opt => ({
        ...opt,
        id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      }))
    );
    setFormCategoryIds([]);
    setIsModalOpen(true);
    showToast(`Membuat duplikasi variasi '${variation.name}'`, 'info');
  };

  // Preset Templates
  const applyPreset = (presetName: string) => {
    switch (presetName) {
      case 'ukuran':
        setFormName('Ukuran Cup');
        setFormType('SINGLE_SELECT');
        setFormRequired(true);
        setFormOptions([
          { id: `opt_${Date.now()}_0`, name: 'Regular 12oz', extraPrice: 0, isDefault: true },
          { id: `opt_${Date.now()}_1`, name: 'Large 16oz', extraPrice: 5000 },
          { id: `opt_${Date.now()}_2`, name: 'Jumbo 22oz', extraPrice: 9000 }
        ]);
        break;
      case 'es':
        setFormName('Level Es');
        setFormType('SINGLE_SELECT');
        setFormRequired(false);
        setFormOptions([
          { id: `opt_${Date.now()}_0`, name: 'Normal Ice', extraPrice: 0, isDefault: true },
          { id: `opt_${Date.now()}_1`, name: 'Less Ice', extraPrice: 0 },
          { id: `opt_${Date.now()}_2`, name: 'No Ice', extraPrice: 0 }
        ]);
        break;
      case 'gula':
        setFormName('Tingkat Gula');
        setFormType('SINGLE_SELECT');
        setFormRequired(false);
        setFormOptions([
          { id: `opt_${Date.now()}_0`, name: '100% Normal', extraPrice: 0, isDefault: true },
          { id: `opt_${Date.now()}_1`, name: '50% Less Sugar', extraPrice: 0 },
          { id: `opt_${Date.now()}_2`, name: '0% No Sugar', extraPrice: 0 }
        ]);
        break;
      case 'shot':
        setFormName('Espresso Shot');
        setFormType('SINGLE_SELECT');
        setFormRequired(false);
        setFormOptions([
          { id: `opt_${Date.now()}_0`, name: 'Normal (1 Shot)', extraPrice: 0, isDefault: true },
          { id: `opt_${Date.now()}_1`, name: '+1 Extra Shot', extraPrice: 5000 },
          { id: `opt_${Date.now()}_2`, name: '+2 Extra Shot', extraPrice: 10000 }
        ]);
        break;
      case 'susu':
        setFormName('Pilihan Susu');
        setFormType('SINGLE_SELECT');
        setFormRequired(false);
        setFormOptions([
          { id: `opt_${Date.now()}_0`, name: 'Fresh Milk (Dairy)', extraPrice: 0, isDefault: true },
          { id: `opt_${Date.now()}_1`, name: 'Oat Milk (Plant-based)', extraPrice: 6000 },
          { id: `opt_${Date.now()}_2`, name: 'Almond Milk', extraPrice: 8000 },
          { id: `opt_${Date.now()}_3`, name: 'Soy Milk', extraPrice: 5000 }
        ]);
        break;
      case 'topping':
        setFormName('Topping Ekstra');
        setFormType('MULTI_SELECT');
        setFormRequired(false);
        setFormOptions([
          { id: `opt_${Date.now()}_0`, name: 'Brown Sugar Boba', extraPrice: 4000 },
          { id: `opt_${Date.now()}_1`, name: 'Grass Jelly (Cincau)', extraPrice: 3500 },
          { id: `opt_${Date.now()}_2`, name: 'Egg Pudding', extraPrice: 4000 },
          { id: `opt_${Date.now()}_3`, name: 'Coffee Jelly', extraPrice: 4000 },
          { id: `opt_${Date.now()}_4`, name: 'Whipped Cream', extraPrice: 3000 }
        ]);
        break;
      default:
        break;
    }
    showToast(`Template ${presetName} diterapkan`, 'info');
  };

  // Option Operations
  const addOption = () => {
    setFormOptions(prev => [
      ...prev,
      {
        id: `opt_${Date.now()}_${prev.length}`,
        name: `Opsi Tambahan ${prev.length + 1}`,
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

  const updateOptionField = (index: number, field: keyof VariationOption, value: any) => {
    setFormOptions(prev => {
      const copy = [...prev];
      if (field === 'isDefault' && value === true && formType !== 'MULTI_SELECT') {
        // Reset defaults for others in single select mode
        copy.forEach((opt, idx) => {
          opt.isDefault = idx === index;
        });
      } else {
        copy[index] = { ...copy[index], [field]: value };
      }
      return copy;
    });
  };

  // Save Variation (Create / Update)
  const handleSaveVariation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      showToast('Nama variasi tidak boleh kosong', 'warning');
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
      if (opt.extraPrice < 0) {
        showToast('Harga ekstra tidak boleh negatif', 'warning');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        type: formType,
        required: formRequired,
        options: formOptions.map(opt => ({
          id: opt.id,
          name: opt.name.trim(),
          extraPrice: Number(opt.extraPrice || 0),
          isDefault: !!opt.isDefault
        })),
        categoryIds: formCategoryIds
      };

      const endpoint = editingVariation
        ? `/api/products/category-variations/${editingVariation.id}`
        : '/api/products/category-variations';
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
          editingVariation ? 'Variasi kategori berhasil diperbarui!' : 'Variasi kategori berhasil dibuat!',
          'success'
        );
        clearClientCatalogCache();
        setIsModalOpen(false);
        fetchVariationsAndCategories(false);
      } else {
        showToast(data.error || 'Gagal menyimpan variasi kategori', 'error');
      }
    } catch (err) {
      console.error('Error saving variation:', err);
      showToast('Terjadi kesalahan sistem saat menyimpan variasi', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Variation
  const handleDeleteVariation = async () => {
    if (!variationToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products/category-variations/${variationToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token || ''}` }
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Variasi kategori berhasil dihapus!', 'success');
        clearClientCatalogCache();
        setVariationToDelete(null);
        fetchVariationsAndCategories(false);
      } else {
        showToast(data.error || 'Gagal menghapus variasi kategori', 'error');
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
    return variations.filter(v => {
      const matchesSearch =
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.options.some(opt => opt.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.categoryNames && v.categoryNames.some(cName => cName.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesType = typeFilter === 'ALL';
      return matchesSearch && matchesType;
    });
  }, [variations, searchQuery, typeFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = variations.length;
    const totalOptions = variations.reduce((acc, curr) => acc + (curr.options?.length || 0), 0);
    const avgOptions = total > 0 ? (totalOptions / total).toFixed(1) : '0';
    const totalLinkedCategories = variations.reduce((acc, curr) => acc + (curr.usedInCategoriesCount || 0), 0);

    return { total, totalOptions, avgOptions, totalLinkedCategories };
  }, [variations]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Sub-Navigation Switcher: Kategori Menu vs Variasi Kategori */}
      <div className="flex items-center gap-2 border-b border-stone-200/80 dark:border-stone-800 pb-2">
        <button
          type="button"
          onClick={() => onNavigateTab ? onNavigateTab('kategori') : null}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-750 text-stone-600 dark:text-stone-300 transition-colors flex items-center gap-2 cursor-pointer"
        >
          <Layers className="w-4 h-4 text-orange-500" />
          <span>Kategori Menu</span>
        </button>

        <button
          type="button"
          className="px-4 py-2 rounded-xl text-xs font-bold bg-accent text-white shadow-xs flex items-center gap-2 cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Variasi Kategori (Master Table)</span>
          <span className="px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
            Master
          </span>
        </button>
      </div>

      {/* Cashier Notice Banner */}
      {isCashier && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300">
          <HelpCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <p>
            <strong>Mode Kasir (Hanya Lihat):</strong> Anda dapat melihat master variasi dan harga ekstra modifier untuk referensi operasional. Pembuatan atau pengubahan variasi dilakukan oleh role <strong>Manager</strong> atau <strong>Admin</strong>.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200/80 dark:border-stone-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading tracking-tight">
                  Manajemen Variasi Kategori
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isAdmin
                    ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300'
                    : isManager
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                }`}>
                  {isAdmin ? 'Role: Admin Sistem' : isManager ? 'Role: Manager' : 'Role: Kasir (Lihat)'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                Tabel master variasi menu (Ukuran, Level Es, Gula, Topping). Kategori menu mereferensikan ID variasi ini.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs">
              <span className="font-semibold text-stone-500 text-[11px]">Vendor:</span>
              <select
                value={selectedVendor}
                onChange={e => setSelectedVendor(e.target.value)}
                className="bg-transparent font-bold text-stone-800 dark:text-stone-200 focus:outline-none cursor-pointer"
              >
                <option value="all">Semua Vendor</option>
                <option value="6ab58389b2a71518d2beb887">KasirKafe Pusat</option>
                <option value="6ab58389b2a71518d2beb888">Kopi Kulo (Kemang)</option>
                <option value="6ab58389b2a71518d2beb889">Teh Poci (Bekasi)</option>
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => fetchVariationsAndCategories(false)}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            title="Muat ulang data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          {canManage && (
            <button
              type="button"
              id="add-variation-btn"
              onClick={openCreateModal}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-accent hover:bg-accent/90 text-white transition-all shadow-md shadow-orange-500/20 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Variasi Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/70 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-1">
            <span className="text-xs font-medium">Total Variasi</span>
            <SlidersHorizontal className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-black text-stone-900 dark:text-stone-100">
            {metrics.total}
          </div>
          <span className="text-[11px] text-stone-400 dark:text-stone-500">Tersimpan di database</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/70 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-1">
            <span className="text-xs font-medium">Variasi Wajib</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Mandatori kasir</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/70 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-1">
            <span className="text-xs font-medium">Total Opsi Pilihan</span>
            <Tag className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-stone-900 dark:text-stone-100">
            {metrics.totalOptions}
          </div>
          <span className="text-[11px] text-stone-400 dark:text-stone-500">Rata-rata {metrics.avgOptions} opsi / variasi</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/70 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-1">
            <span className="text-xs font-medium">Relasi Kategori</span>
            <FolderTree className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-stone-900 dark:text-stone-100">
            {metrics.totalLinkedCategories}
          </div>
          <span className="text-[11px] text-stone-400 dark:text-stone-500">Keterkaitan aktif di menu</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-stone-900 p-3.5 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari variasi berdasarkan nama, opsi (misal: Large, Aren, No Ice), atau kategori..."
            className="w-full pl-10 pr-4 py-2 bg-stone-50 dark:bg-stone-800/60 rounded-xl text-xs sm:text-sm border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-accent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'SINGLE_SELECT', 'MULTI_SELECT', 'RADIO', 'CHECKBOX'] as const).map(typeKey => (
            <button
              key={typeKey}
              type="button"
              onClick={() => setTypeFilter(typeKey)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                typeFilter === typeKey
                  ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200/80 dark:hover:bg-stone-750'
              }`}
            >
              {typeKey === 'ALL' && 'Semua Tipe'}
              {typeKey === 'SINGLE_SELECT' && 'Single Select'}
              {typeKey === 'MULTI_SELECT' && 'Multi Select'}
              {typeKey === 'RADIO' && 'Radio'}
              {typeKey === 'CHECKBOX' && 'Checkbox'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Variation Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/70 dark:border-stone-800 shadow-xs">
          <div className="w-10 h-10 rounded-full border-3 border-orange-500 border-t-transparent animate-spin mb-3" />
          <span className="text-xs font-bold text-stone-500 dark:text-stone-400">Memuat variasi kategori...</span>
        </div>
      ) : filteredVariations.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/70 dark:border-stone-800 shadow-xs space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center">
            <SlidersHorizontal className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">
              {searchQuery || typeFilter !== 'ALL'
                ? 'Tidak ada variasi yang cocok dengan pencarian / filter'
                : 'Belum ada variasi kategori tersimpan'}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto mt-1">
              Variasi memungkinkan kasir memilih modifier pesanan (misal: ukuran regular/large, level es, tingkat gula) saat transaksi.
            </p>
          </div>
          {isManager && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-accent hover:bg-accent/90 text-white transition-all shadow-md shadow-orange-500/20 inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Variasi Sekarang</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVariations.map(variation => {

            return (
              <div
                key={variation.id}
                className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/80 dark:border-stone-800 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Badges & Actions */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">


                      <h3 className="text-base font-extrabold text-stone-900 dark:text-stone-100 mt-2 font-heading tracking-tight truncate">
                        {variation.name}
                      </h3>
                      <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono">
                        ID: {variation.id}
                      </span>
                    </div>

                    {isManager && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => duplicateVariation(variation)}
                          className="w-8 h-8 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center transition-colors cursor-pointer"
                          title="Duplikasi Variasi"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(variation)}
                          className="w-8 h-8 rounded-xl text-stone-400 hover:text-accent hover:bg-orange-50 dark:hover:bg-orange-950/40 flex items-center justify-center transition-colors cursor-pointer"
                          title="Edit Variasi"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setVariationToDelete(variation)}
                          className="w-8 h-8 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                          title="Hapus Variasi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Options List */}
                  <div className="space-y-1.5 my-3 bg-stone-50/70 dark:bg-stone-850/60 p-3 rounded-2xl border border-stone-100 dark:border-stone-800">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1 flex items-center justify-between">
                      <span>Daftar Opsi ({variation.options?.length || 0})</span>
                      <span>Harga Ekstra</span>
                    </div>

                    {variation.options?.map((opt, optIdx) => (
                      <div
                        key={opt.id || optIdx}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white/70 dark:bg-stone-800/80 border border-stone-200/50 dark:border-stone-700/50"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {opt.isDefault && (
                            <span className="px-1.5 py-0.2 rounded-sm text-[9px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                              DEFAULT
                            </span>
                          )}
                          <span className="font-semibold text-stone-800 dark:text-stone-200 truncate">
                            {opt.name}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-[11px] font-bold shrink-0 ml-2 ${
                            opt.extraPrice > 0
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-stone-400 dark:text-stone-500'
                          }`}
                        >
                          {opt.extraPrice > 0 ? `+Rp ${opt.extraPrice.toLocaleString('id-ID')}` : 'Rp 0'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom: Linked Categories Chips */}
                <div className="pt-3 border-t border-stone-100 dark:border-stone-800/80 mt-2">
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
                      <FolderTree className="w-3 h-3 text-orange-500" />
                      <span>Digunakan di Kategori:</span>
                    </span>
                    <span className="text-[11px] font-black text-stone-700 dark:text-stone-300">
                      {variation.usedInCategoriesCount || 0}
                    </span>
                  </div>

                  {variation.categoryNames && variation.categoryNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {variation.categoryNames.map((cName, cIdx) => (
                        <span
                          key={cIdx}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-orange-100/70 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-200/50 dark:border-orange-800/50"
                        >
                          {cName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-stone-400 italic">
                      Belum dihubungkan ke kategori manapun
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create / Edit Variation */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 w-full max-w-2xl p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-stone-900 dark:text-stone-100 font-heading">
                    {editingVariation ? 'Edit Variasi Kategori' : 'Tambah Variasi Kategori Baru'}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Disimpan di tabel master variasi dan dapat direferensikan oleh berbagai kategori menu.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets Picker */}
            <div className="shrink-0 bg-stone-50 dark:bg-stone-850 p-3 rounded-2xl border border-stone-200/70 dark:border-stone-800">
              <div className="flex items-center justify-between text-xs font-bold text-stone-600 dark:text-stone-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Preset Cepat Minuman & Makanan:</span>
                </span>
                <span className="text-[10px] text-stone-400 font-normal">Klik untuk mengisi instan</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'ukuran', label: 'Ukuran Cup (Reg/Large/Jumbo)' },
                  { id: 'es', label: 'Level Es (Normal/Less/No Ice)' },
                  { id: 'gula', label: 'Tingkat Gula (100%/50%/0%)' },
                  { id: 'shot', label: 'Espresso Shot (+1, +2)' },
                  { id: 'susu', label: 'Pilihan Susu (Oat/Almond/Soy)' },
                  { id: 'topping', label: 'Topping (Boba/Jelly/Pudding)' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:border-orange-500 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Body (Scrollable) */}
            <form onSubmit={handleSaveVariation} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Variation Name */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Nama Variasi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Contoh: Ukuran Cup, Level Gula, Topping..."
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 rounded-xl text-xs sm:text-sm border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-accent"
                  />
                </div>

                {/* Selection Type */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Tipe Seleksi
                  </label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 rounded-xl text-xs sm:text-sm border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-accent"
                  >
                    <option value="SINGLE_SELECT">Single Select (Pilih 1 saja)</option>
                    <option value="RADIO">Radio Buttons (Pilih 1 saja)</option>
                    <option value="MULTI_SELECT">Multi Select (Boleh pilih banyak / Topping)</option>
                    <option value="CHECKBOX">Checkboxes (Boleh pilih banyak)</option>
                  </select>
                </div>
              </div>

              {/* Required Switch */}
              <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/70 dark:border-stone-700/70 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                    <span>Wajib Dipilih Oleh Kasir</span>
                    {formRequired && (
                      <span className="px-1.5 py-0.2 rounded-md text-[9px] font-black bg-rose-500 text-white">
                        MANDATORI
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    Jika diaktifkan, produk tidak dapat ditambahkan ke keranjang sebelum variasi ini ditentukan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormRequired(!formRequired)}
                  className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer ${
                    formRequired ? 'bg-accent' : 'bg-stone-300 dark:bg-stone-700'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                      formRequired ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Options Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-orange-500" />
                    <span>Daftar Opsi Pilihan ({formOptions.length})</span>
                  </label>
                  <button
                    type="button"
                    onClick={addOption}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-100 dark:bg-orange-950 text-accent hover:bg-orange-200 dark:hover:bg-orange-900 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Opsi</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {formOptions.map((opt, idx) => (
                    <div
                      key={opt.id || idx}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
                    >
                      <span className="text-[10px] font-mono text-stone-400 w-4 text-center">
                        {idx + 1}
                      </span>

                      {/* Option Name */}
                      <input
                        type="text"
                        required
                        value={opt.name}
                        onChange={e => updateOptionField(idx, 'name', e.target.value)}
                        placeholder="Nama Opsi (misal: Large 16oz)"
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-stone-900 rounded-lg text-xs border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-1 focus:ring-accent"
                      />

                      {/* Extra Price */}
                      <div className="w-32 relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-400">
                          +Rp
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          value={opt.extraPrice}
                          onChange={e => updateOptionField(idx, 'extraPrice', Number(e.target.value))}
                          placeholder="0"
                          className="w-full pl-8 pr-2 py-1.5 bg-white dark:bg-stone-900 rounded-lg text-xs font-mono font-bold border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-1 focus:ring-accent"
                        />
                      </div>

                      {/* Default Toggle */}
                      <label className="flex items-center gap-1 text-[11px] font-medium text-stone-600 dark:text-stone-300 cursor-pointer shrink-0 px-1">
                        <input
                          type={formType === 'MULTI_SELECT' || formType === 'CHECKBOX' ? 'checkbox' : 'radio'}
                          name="variationDefaultOption"
                          checked={!!opt.isDefault}
                          onChange={e => updateOptionField(idx, 'isDefault', e.target.checked)}
                          className="w-3.5 h-3.5 accent-orange-500 rounded"
                        />
                        <span>Default</span>
                      </label>

                      {/* Delete Option */}
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="w-7 h-7 rounded-lg text-stone-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        title="Hapus opsi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Link to Categories Selector */}
              <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
                <label className="block text-xs font-bold text-stone-800 dark:text-stone-200 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FolderTree className="w-3.5 h-3.5 text-blue-500" />
                    <span>Hubungkan ke Kategori Menu:</span>
                  </span>
                  <span className="text-[10px] text-stone-400 font-normal">
                    {formCategoryIds.length} dipilih
                  </span>
                </label>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mb-2">
                  Kategori yang dicentang akan otomatis mereferensikan variasi ini di menu POS.
                </p>

                {categories.length === 0 ? (
                  <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-xl text-xs text-stone-400 text-center">
                    Belum ada kategori menu. Buat kategori terlebih dahulu di halaman Kategori.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                    {categories.map(cat => {
                      const isChecked = formCategoryIds.includes(cat.id);
                      return (
                        <label
                          key={cat.id}
                          className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all flex items-center gap-2 ${
                            isChecked
                              ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500/80 text-orange-900 dark:text-orange-200 shadow-xs'
                              : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-750'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) {
                                setFormCategoryIds(prev => [...prev, cat.id]);
                              } else {
                                setFormCategoryIds(prev => prev.filter(cId => cId !== cat.id));
                              }
                            }}
                            className="w-3.5 h-3.5 accent-orange-500 rounded"
                          />
                          <span className="truncate">{cat.name}</span>
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
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-accent hover:bg-accent/90 text-white transition-all shadow-md shadow-orange-500/20 flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
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
          <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-black text-stone-900 dark:text-stone-100 font-heading">
                Hapus Variasi Kategori?
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Apakah Anda yakin ingin menghapus variasi{' '}
                <strong className="text-stone-900 dark:text-stone-100">
                  '{variationToDelete.name}'
                </strong>
                ?
              </p>
              {variationToDelete.usedInCategoriesCount && variationToDelete.usedInCategoriesCount > 0 ? (
                <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200">
                  ⚠️ Variasi ini sedang direferensikan oleh {variationToDelete.usedInCategoriesCount} kategori (
                  {variationToDelete.categoryNames?.join(', ')}). Menghapusnya akan melepaskan relasi dari kategori tersebut.
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setVariationToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteVariation}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-md shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Sekarang</span>
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
