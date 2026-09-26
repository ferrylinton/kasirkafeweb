import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  Sparkles,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  Coffee,
  CupSoda,
  GlassWater,
  Cookie,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { Category, CategoryVariation, VariationOption } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { clearClientCatalogCache } from '../../utils/productCache';

interface CategoryManagementScreenProps {
  onNavigateTab?: (tab: string) => void;
}

export const CategoryManagementScreen: React.FC<CategoryManagementScreenProps> = ({ onNavigateTab }) => {
  const { user, token } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';
  const isCashier = user?.role === 'CASHIER';
  const canManage = isManager || isAdmin;

  const [categories, setCategories] = useState<Category[]>([]);
  const [masterVariations, setMasterVariations] = useState<CategoryVariation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formVariations, setFormVariations] = useState<CategoryVariation[]>([]);

  // Delete Confirmation Modal
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchCategories = async (showLoadingState = true) => {
    if (showLoadingState) setLoading(true);
    setIsRefreshing(true);
    try {
      const [catRes, varRes] = await Promise.all([
        fetch('/api/products/categories?bypassCache=true', {
          headers: { Authorization: `Bearer ${token || ''}` }
        }),
        fetch('/api/products/category-variations', {
          headers: { Authorization: `Bearer ${token || ''}` }
        })
      ]);

      const data = await catRes.json();
      if (data.success && Array.isArray(data.categories)) {
        setCategories(data.categories);
      } else {
        showToast('Gagal memuat kategori vendor', 'error');
      }

      const varData = await varRes.json();
      if (varData.success && Array.isArray(varData.variations)) {
        setMasterVariations(varData.variations);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      showToast('Terjadi kesalahan jaringan saat memuat kategori', 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [token]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormName('');
    setFormDescription('');
    // Default drink variations
    setFormVariations([
      {
        id: `var_${Date.now()}_0`,
        name: 'Ukuran Cup',
        options: [
          { id: `opt_${Date.now()}_0`, name: 'Regular 12oz', extraPrice: 0, isDefault: true },
          { id: `opt_${Date.now()}_1`, name: 'Large 16oz', extraPrice: 5000 },
          { id: `opt_${Date.now()}_2`, name: 'Jumbo 22oz', extraPrice: 9000 }
        ]
      },
      {
        id: `var_${Date.now()}_1`,
        name: 'Level Es',
        options: [
          { id: `opt_${Date.now()}_3`, name: 'Normal Ice', extraPrice: 0, isDefault: true },
          { id: `opt_${Date.now()}_4`, name: 'Less Ice', extraPrice: 0 },
          { id: `opt_${Date.now()}_5`, name: 'No Ice', extraPrice: 0 }
        ]
      },
      {
        id: `var_${Date.now()}_2`,
        name: 'Tingkat Gula',
        options: [
          { id: `opt_${Date.now()}_6`, name: '100% Normal', extraPrice: 0, isDefault: true },
          { id: `opt_${Date.now()}_7`, name: '50% Less Sugar', extraPrice: 0 },
          { id: `opt_${Date.now()}_8`, name: '0% No Sugar', extraPrice: 0 }
        ]
      }
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormDescription(cat.description || '');
    setFormVariations(cat.variations ? JSON.parse(JSON.stringify(cat.variations)) : []);
    setIsModalOpen(true);
  };

  // Quick Templates
  const applyKopiTemplate = () => {
    setFormVariations([
      {
        id: `var_ukuran_${Date.now()}`,
        name: 'Ukuran Cup',
        options: [
          { id: `opt_reg_${Date.now()}`, name: 'Regular 12oz', extraPrice: 0, isDefault: true },
          { id: `opt_lrg_${Date.now()}`, name: 'Large 16oz', extraPrice: 5000 },
          { id: `opt_jmb_${Date.now()}`, name: 'Jumbo 22oz', extraPrice: 9000 }
        ]
      },
      {
        id: `var_es_${Date.now()}`,
        name: 'Level Es',
        options: [
          { id: `opt_norm_ice_${Date.now()}`, name: 'Normal Ice', extraPrice: 0, isDefault: true },
          { id: `opt_less_ice_${Date.now()}`, name: 'Less Ice', extraPrice: 0 },
          { id: `opt_no_ice_${Date.now()}`, name: 'No Ice', extraPrice: 0 }
        ]
      },
      {
        id: `var_gula_${Date.now()}`,
        name: 'Tingkat Gula',
        options: [
          { id: `opt_norm_sug_${Date.now()}`, name: '100% Normal', extraPrice: 0, isDefault: true },
          { id: `opt_less_sug_${Date.now()}`, name: '50% Less Sugar', extraPrice: 0 },
          { id: `opt_no_sug_${Date.now()}`, name: '0% No Sugar', extraPrice: 0 }
        ]
      },
      {
        id: `var_shot_${Date.now()}`,
        name: 'Espresso Shot',
        options: [
          { id: `opt_norm_shot_${Date.now()}`, name: 'Normal (1 Shot)', extraPrice: 0, isDefault: true },
          { id: `opt_extra1_shot_${Date.now()}`, name: '+1 Extra Shot', extraPrice: 5000 },
          { id: `opt_extra2_shot_${Date.now()}`, name: '+2 Extra Shot', extraPrice: 10000 }
        ]
      }
    ]);
    showToast('Template variasi Kopi berhasil diterapkan', 'info');
  };

  const applyTehJusTemplate = () => {
    setFormVariations([
      {
        id: `var_ukuran_${Date.now()}`,
        name: 'Ukuran Cup',
        options: [
          { id: `opt_reg_${Date.now()}`, name: 'Regular 12oz', extraPrice: 0, isDefault: true },
          { id: `opt_lrg_${Date.now()}`, name: 'Large 16oz', extraPrice: 5000 },
          { id: `opt_jmb_${Date.now()}`, name: 'Jumbo 22oz', extraPrice: 9000 }
        ]
      },
      {
        id: `var_es_${Date.now()}`,
        name: 'Level Es',
        options: [
          { id: `opt_norm_ice_${Date.now()}`, name: 'Normal Ice', extraPrice: 0, isDefault: true },
          { id: `opt_less_ice_${Date.now()}`, name: 'Less Ice', extraPrice: 0 },
          { id: `opt_no_ice_${Date.now()}`, name: 'No Ice', extraPrice: 0 }
        ]
      },
      {
        id: `var_gula_${Date.now()}`,
        name: 'Tingkat Gula',
        options: [
          { id: `opt_norm_sug_${Date.now()}`, name: '100% Normal', extraPrice: 0, isDefault: true },
          { id: `opt_less_sug_${Date.now()}`, name: '50% Less Sugar', extraPrice: 0 },
          { id: `opt_no_sug_${Date.now()}`, name: '0% No Sugar', extraPrice: 0 }
        ]
      }
    ]);
    showToast('Template variasi Teh/Jus berhasil diterapkan', 'info');
  };

  const clearVariations = () => {
    setFormVariations([]);
    showToast('Variasi dikosongkan (cocok untuk Cemilan / Produk Siap Saji)', 'info');
  };

  // Add / Edit / Remove Variation
  const addVariation = () => {
    const newVar: CategoryVariation = {
      id: `var_${Date.now()}`,
      name: 'Variasi Baru',
      options: [
        { id: `opt_${Date.now()}_0`, name: 'Pilihan Standar', extraPrice: 0, isDefault: true }
      ]
    };
    setFormVariations(prev => [...prev, newVar]);
  };

  const removeVariation = (index: number) => {
    setFormVariations(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateVariationName = (index: number, name: string) => {
    setFormVariations(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], name };
      return copy;
    });
  };

  const addOption = (varIndex: number) => {
    setFormVariations(prev => {
      const copy = [...prev];
      const targetVar = { ...copy[varIndex] };
      const newOpt: VariationOption = {
        id: `opt_${Date.now()}`,
        name: 'Opsi Tambahan',
        extraPrice: 3000,
        isDefault: false
      };
      targetVar.options = [...targetVar.options, newOpt];
      copy[varIndex] = targetVar;
      return copy;
    });
  };

  const removeOption = (varIndex: number, optIndex: number) => {
    setFormVariations(prev => {
      const copy = [...prev];
      const targetVar = { ...copy[varIndex] };
      targetVar.options = targetVar.options.filter((_, idx) => idx !== optIndex);
      copy[varIndex] = targetVar;
      return copy;
    });
  };

  const updateOption = (varIndex: number, optIndex: number, field: keyof VariationOption, val: any) => {
    setFormVariations(prev => {
      const copy = [...prev];
      const targetVar = { ...copy[varIndex] };
      const opts = [...targetVar.options];
      opts[optIndex] = { ...opts[optIndex], [field]: val };

      // If marking as default in single select, unmark others in this variation
      if (field === 'isDefault' && val === true) {
        opts.forEach((o, i) => {
          if (i !== optIndex) o.isDefault = false;
        });
      }

      targetVar.options = opts;
      copy[varIndex] = targetVar;
      return copy;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Nama kategori tidak boleh kosong', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim(),
        categoryVariationIds: formVariations.map(v => v.id).filter(Boolean),
        variationIds: formVariations.map(v => v.id).filter(Boolean),
        variations: formVariations
      };

      let res: Response;
      if (editingCategory) {
        // PUT update
        res = await fetch(`/api/products/categories/${editingCategory.id || editingCategory.name}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || ''}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        // POST create
        res = await fetch('/api/products/categories', {
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
          editingCategory ? 'Kategori & variasi berhasil diperbarui!' : 'Kategori & variasi berhasil ditambahkan!',
          'success'
        );
        clearClientCatalogCache();
        setIsModalOpen(false);
        fetchCategories(false);
      } else {
        showToast(data.error || 'Gagal menyimpan kategori', 'error');
      }
    } catch (err) {
      console.error('Error saving category:', err);
      showToast('Terjadi kesalahan saat menyimpan kategori', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products/categories/${categoryToDelete.id || categoryToDelete.name}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token || ''}`
        }
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Kategori '${categoryToDelete.name}' berhasil dihapus`, 'success');
        clearClientCatalogCache();
        setCategoryToDelete(null);
        fetchCategories(false);
      } else {
        showToast(data.error || 'Gagal menghapus kategori', 'error');
      }
    } catch (err) {
      console.error('Error deleting category:', err);
      showToast('Gagal menghapus kategori', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!canManage && !isCashier) {
    return (
      <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-4xl mx-auto flex items-center justify-center p-6">
        <div className="bg-white dark:bg-[#251e1c] p-8 rounded-3xl border border-stone-200 dark:border-stone-800 text-center max-w-md shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold font-heading text-stone-900 dark:text-stone-100 mb-2">
            Akses Ditolak
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            Pengelolaan kategori dan variasi produk khusus dipegang oleh role <strong>MANAGER</strong> atau <strong>ADMIN</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-7xl mx-auto flex flex-col gap-6 p-4 sm:p-6">
      {/* Sub-Navigation Switcher: Kategori Menu vs Variasi Kategori */}
      <div className="flex items-center gap-2 border-b border-stone-200/80 dark:border-stone-800 pb-2">
        <button
          type="button"
          className="px-4 py-2 rounded-xl text-xs font-bold bg-accent text-white shadow-xs flex items-center gap-2 cursor-pointer"
        >
          <Layers className="w-4 h-4" />
          <span>Kategori Menu</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab ? onNavigateTab('variasi-kategori') : null}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-750 text-stone-600 dark:text-stone-300 transition-colors flex items-center gap-2 cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4 text-amber-500" />
          <span>Variasi Kategori (Master Table)</span>
          <span className="px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
            Master
          </span>
        </button>
      </div>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#251e1c] p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-accent">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black font-heading tracking-tight text-stone-900 dark:text-stone-100">
              Kategori & Variasi Menu
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
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-2xl">
            Kelola kategori toko dan variasinya (ukuran, es, gula, shot, topping). Setiap vendor memiliki variasi tersendiri yang tersimpan di database dan langsung sinkron ke katalog kasir.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => fetchCategories(false)}
            disabled={isRefreshing}
            className="p-3 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors disabled:opacity-50 cursor-pointer"
            title="Segarkan Kategori"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-accent' : ''}`} />
          </button>
          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-accent text-white font-bold text-xs shadow-md hover:opacity-95 active:scale-98 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Kategori Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Categories Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 text-stone-500">
          <RefreshCw className="w-8 h-8 animate-spin text-accent mb-3" />
          <p className="text-xs font-semibold">Memuat kategori dan variasi database...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center mb-4">
            <Layers className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-stone-800 dark:text-stone-200 mb-1">
            Belum Ada Kategori untuk Toko Ini
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mb-4">
            Klik tombol di bawah untuk membuat kategori pertama toko Anda beserta variasinya.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-accent text-white text-xs font-bold shadow-sm"
          >
            + Tambah Kategori
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {categories.map(cat => {
            const hasVars = Array.isArray(cat.variations) && cat.variations.length > 0;
            return (
              <div
                key={cat.id || cat.name}
                className="bg-white dark:bg-[#251e1c] p-5 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col justify-between transition-all hover:border-orange-300 dark:hover:border-orange-800/60"
              >
                <div>
                  {/* Category Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shrink-0 shadow-2xs">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold font-heading truncate text-stone-900 dark:text-stone-100">
                          {cat.name}
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-1 mt-0.5">
                          {cat.description || 'Tidak ada deskripsi'}
                        </p>
                      </div>
                    </div>

                    {/* Actions: Edit & Delete */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(cat)}
                        className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-stone-600 dark:text-stone-300 hover:text-accent transition-colors cursor-pointer"
                        title="Ubah Kategori & Variasi"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryToDelete(cat)}
                        className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-stone-600 dark:text-stone-300 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Hapus Kategori"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Variations Section */}
                  <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        {hasVars ? `${cat.variations?.length} Variasi Tersedia` : 'Variasi Menu'}
                      </span>
                      {hasVars ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 dark:bg-orange-950/60 text-accent">
                          Aktif di Kasir
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-500">
                          Siap Saji (Tanpa Variasi)
                        </span>
                      )}
                    </div>

                    {hasVars ? (
                      <div className="space-y-2">
                        {cat.variations?.map((v, vIdx) => (
                          <div
                            key={v.id || vIdx}
                            className="bg-stone-50/70 dark:bg-stone-900/50 p-2.5 rounded-2xl border border-stone-100 dark:border-stone-800/60 text-xs"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-stone-800 dark:text-stone-200">
                                {vIdx + 1}. {v.name}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {v.options?.map(opt => (
                                <span
                                  key={opt.id}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 ${
                                    opt.isDefault
                                      ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-accent font-semibold'
                                      : 'bg-white dark:bg-stone-800 border-stone-200/80 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                                  }`}
                                >
                                  <span>{opt.name}</span>
                                  {opt.extraPrice > 0 && (
                                    <span className="text-[10px] text-accent font-bold">
                                      (+Rp {opt.extraPrice.toLocaleString('id-ID')})
                                    </span>
                                  )}
                                  {opt.isDefault && <Check className="w-3 h-3 text-accent" />}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-300/90">
                        <Info className="w-4 h-4 shrink-0" />
                        <span>Kategori ini tidak memiliki variasi. Di kasir, produk langsung ditambah ke pesanan tanpa modal pilihan.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Quick Info */}
                <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800/60 flex items-center justify-between text-[11px] text-stone-400">
                  <span>ID: {cat.id}</span>
                  <button
                    type="button"
                    onClick={() => openEditModal(cat)}
                    className="text-accent font-bold hover:underline cursor-pointer"
                  >
                    Kelola Variasi →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Create / Edit Category & Variations */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs"
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)'
          }}
        >
          <div className="w-full sm:max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-[#251e1c] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-accent">
                  <SlidersHorizontal className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold font-heading">
                    {editingCategory ? `Ubah Kategori & Variasi: ${editingCategory.name}` : 'Tambah Kategori & Variasi Baru'}
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Atur nama kategori dan opsi variasi yang bisa dipilih pelanggan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Form Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Category Core Details */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                  Nama Kategori <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Contoh: Kopi, Teh, Jus, Cemilan..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                  Deskripsi Kategori (Opsional)
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Keterangan singkat kategori untuk kasir & pelanggan..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* VARIATIONS MANAGEMENT */}
              <div className="pt-4 border-t border-stone-100 dark:border-stone-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100 block">
                      Variasi untuk Kategori Ini
                    </label>
                    <span className="text-[11px] text-stone-400">
                      Kopi: Ukuran, Es, Gula, Shot • Teh/Jus: Ukuran, Es, Gula • Cemilan: Kosongkan variasi
                    </span>
                  </div>

                  {/* Preset & Master Variations Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={applyKopiTemplate}
                      className="px-2.5 py-1 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-accent text-[11px] font-bold hover:bg-orange-200 transition-colors cursor-pointer"
                    >
                      ☕ Template Kopi
                    </button>
                    <button
                      type="button"
                      onClick={applyTehJusTemplate}
                      className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold hover:bg-emerald-200 transition-colors cursor-pointer"
                    >
                      🍵 Template Teh/Jus
                    </button>
                    <button
                      type="button"
                      onClick={clearVariations}
                      className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[11px] font-bold hover:bg-stone-200 transition-colors cursor-pointer"
                    >
                      🥐 Cemilan (Tanpa Variasi)
                    </button>
                  </div>

                  {masterVariations.length > 0 && (
                    <div className="pt-2 border-t border-stone-200/60 dark:border-stone-800">
                      <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 block mb-1.5">
                        Pilih dari Master Variasi Database:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {masterVariations.map(mv => {
                          const isAlreadyAdded = formVariations.some(fv => fv.id === mv.id || fv.name.toLowerCase() === mv.name.toLowerCase());
                          return (
                            <button
                              key={mv.id}
                              type="button"
                              disabled={isAlreadyAdded}
                              onClick={() => {
                                setFormVariations(prev => [...prev, JSON.parse(JSON.stringify(mv))]);
                                showToast(`Variasi '${mv.name}' ditambahkan ke kategori`, 'info');
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                                isAlreadyAdded
                                  ? 'bg-stone-100 dark:bg-stone-800 text-stone-400 cursor-not-allowed border border-stone-200/50 dark:border-stone-700/50'
                                  : 'bg-white dark:bg-stone-800 border border-orange-200 dark:border-orange-900/60 text-stone-700 dark:text-stone-200 hover:border-orange-500 cursor-pointer shadow-xs'
                              }`}
                            >
                              <span>+ {mv.name}</span>
                              {isAlreadyAdded && <Check className="w-3 h-3 text-emerald-500" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {formVariations.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-dashed border-stone-300 dark:border-stone-700 text-center">
                    <p className="text-xs font-semibold text-stone-600 dark:text-stone-400 mb-2">
                      Kategori ini saat ini TIDAK memiliki variasi (seperti halnya produk Cemilan).
                    </p>
                    <button
                      type="button"
                      onClick={addVariation}
                      className="px-3.5 py-1.5 rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-bold hover:bg-stone-300 transition-colors cursor-pointer"
                    >
                      + Tambah Variasi Kustom
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formVariations.map((v, vIdx) => (
                      <div
                        key={v.id || vIdx}
                        className="p-4 rounded-2xl bg-stone-50/80 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-700/80 space-y-3"
                      >
                        {/* Variation Header */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-950/80 text-accent font-bold text-xs flex items-center justify-center shrink-0">
                              {vIdx + 1}
                            </span>
                            <input
                              type="text"
                              value={v.name}
                              onChange={e => updateVariationName(vIdx, e.target.value)}
                              placeholder="Nama Variasi (cth: Ukuran Cup, Level Es)"
                              className="px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-bold flex-1 focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => removeVariation(vIdx)}
                            className="p-1.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-500 transition-colors cursor-pointer"
                            title="Hapus variasi ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Options List */}
                        <div className="space-y-2 pl-2 sm:pl-8">
                          <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                            Pilihan Opsi & Tambahan Harga:
                          </div>
                          {v.options.map((opt, oIdx) => (
                            <div key={opt.id || oIdx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={opt.name}
                                onChange={e => updateOption(vIdx, oIdx, 'name', e.target.value)}
                                placeholder="Nama Opsi (cth: Regular 12oz)"
                                className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs"
                              />
                              <div className="flex items-center gap-1 bg-white dark:bg-stone-800 px-2 py-1 rounded-xl border border-stone-200 dark:border-stone-700 w-32 shrink-0">
                                <span className="text-[10px] text-stone-400">+Rp</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={500}
                                  value={opt.extraPrice}
                                  onChange={e => updateOption(vIdx, oIdx, 'extraPrice', Number(e.target.value))}
                                  className="w-full text-xs font-bold text-accent bg-transparent focus:outline-none"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => updateOption(vIdx, oIdx, 'isDefault', !opt.isDefault)}
                                className={`px-2 py-1.5 rounded-xl text-[10px] font-bold border transition-colors shrink-0 cursor-pointer ${
                                  opt.isDefault
                                    ? 'bg-accent text-white border-accent'
                                    : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500'
                                }`}
                                title="Set opsi standar default"
                              >
                                {opt.isDefault ? 'Default' : 'Set Default'}
                              </button>
                              <button
                                type="button"
                                disabled={v.options.length <= 1}
                                onClick={() => removeOption(vIdx, oIdx)}
                                className="p-1 text-stone-400 hover:text-rose-500 disabled:opacity-20 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => addOption(vIdx)}
                            className="mt-1 text-[11px] font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Tambah Opsi untuk {v.name || 'Variasi Ini'}
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addVariation}
                      className="w-full py-2.5 rounded-2xl border border-dashed border-accent/40 bg-orange-50/50 dark:bg-orange-950/20 text-accent text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-orange-50 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Variasi Baru ke Kategori Ini</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
                  <span>{editingCategory ? 'Simpan Perubahan' : 'Buat Kategori & Variasi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-[#251e1c] rounded-3xl p-6 border border-stone-200 dark:border-stone-800 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mb-1">
                Hapus Kategori '{categoryToDelete.name}'?
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Semua variasi pada kategori ini akan ikut terhapus. Tindakan ini hanya dapat dilakukan oleh role Manager.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="flex-1 py-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
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
