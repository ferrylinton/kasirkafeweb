import {
  AlertCircle,
  Edit3,
  Layers,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Category } from '../../types';
import { clearClientCatalogCache } from '../../utils/productCache';
import { useToast } from '../common/Toast';

export const CategoryManagementScreen: React.FC = () => {
  const { user, token } = useAuth();
  const { showToast } = useToast();

  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';
  const isCashier = user?.role === 'CASHIER';
  const canManage = isManager || isAdmin;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');

  // Delete Confirmation Modal
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const normalizeCategoryName = (name: string) => name.trim().replace(/\s+/g, ' ');
  const normalizedFormName = normalizeCategoryName(formName);
  const isDuplicateName =
    normalizedFormName.length > 0 &&
    categories.some(cat => {
      if (editingCategory) {
        const isSameCategory =
          cat.id && editingCategory.id
            ? cat.id === editingCategory.id
            : normalizeCategoryName(cat.name).toLowerCase() ===
              normalizeCategoryName(editingCategory.name).toLowerCase();
        if (isSameCategory) return false;
      }
      return normalizeCategoryName(cat.name).toLowerCase() === normalizedFormName.toLowerCase();
    });

  const fetchCategories = async (showLoadingState = true) => {
    if (showLoadingState) setLoading(true);
    setIsRefreshing(true);
    try {
      const catRes = await fetch('/api/products/categories?bypassCache=true', {
        headers: { Authorization: `Bearer ${token || ''}` }
      });

      if (catRes.ok) {
        const data = await catRes.json();
        if (data && data.success && Array.isArray(data.categories)) {
          setCategories(data.categories);
        } else {
          showToast('Gagal memuat kategori vendor', 'error');
        }
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
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormDescription(cat.description || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedFormName) {
      showToast('Nama kategori tidak boleh kosong', 'warning');
      return;
    }
    if (isDuplicateName) {
      showToast(`Kategori dengan nama '${normalizedFormName}' sudah ada! Gunakan nama lain.`, 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: normalizedFormName,
        description: formDescription.trim()
      };

      let res: Response;
      if (editingCategory) {
        res = await fetch(`/api/products/categories/${editingCategory.id || editingCategory.name}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || ''}`
          },
          body: JSON.stringify(payload)
        });
      } else {
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
          editingCategory ? 'Kategori berhasil diperbarui!' : 'Kategori berhasil ditambahkan!',
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
            Pengelolaan kategori produk khusus dipegang oleh role <strong>MANAGER</strong> atau <strong>ADMIN</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-7xl mx-auto flex flex-col gap-6 p-4 sm:p-6">
      {/* Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4 bg-white dark:bg-[#251e1c] p-4 sm:p-5 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xs">
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap justify-end">
          {/* View Mode Toggle (Grid vs Table) */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-[#251e1c] text-accent shadow-xs'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
              title="Tampilan Tabel Kategori"
              aria-label="Tampilan Tabel Kategori"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-[#251e1c] text-accent shadow-xs'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
              title="Tampilan Grid Kartu"
              aria-label="Tampilan Grid Kartu"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

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
          <p className="text-xs font-semibold">Memuat kategori dari database...</p>
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
            Klik tombol di bawah untuk membuat kategori pertama toko Anda.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2.5 rounded-xl bg-accent text-white text-xs font-bold shadow-sm cursor-pointer"
            >
              + Tambah Kategori
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => (
            <div
              key={cat.id || cat.name}
              className="bg-white dark:bg-[#251e1c] p-5 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col justify-between transition-all hover:border-orange-300 dark:hover:border-orange-800/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shrink-0 shadow-2xs">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold font-heading truncate text-stone-900 dark:text-stone-100">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-1">
                      {cat.description || 'Tidak ada deskripsi kategori'}
                    </p>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(cat)}
                      className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-stone-600 dark:text-stone-300 hover:text-accent transition-colors cursor-pointer"
                      title="Ubah Kategori"
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
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800/60 flex items-center justify-between text-[11px] text-stone-400">
                <span className="font-mono truncate">ID: {cat.id}</span>
                <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-semibold shrink-0">
                  Aktif di Katalog
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-stone-50/50 dark:bg-stone-900/50 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500">
            <span className="font-bold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-accent" />
              <span>Tabel Kategori Produk</span>
            </span>
            <span className="text-[11px] text-stone-400">Total {categories.length} Kategori</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 dark:bg-stone-900 border-b border-stone-200/80 dark:border-stone-800 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">ID Kategori</th>
                  <th className="py-3 px-4">Nama Kategori</th>
                  <th className="py-3 px-4">Deskripsi</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  {canManage && <th className="py-3 px-4 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {categories.map(cat => (
                  <tr key={cat.id || cat.name} className="hover:bg-stone-50/70 dark:hover:bg-stone-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-stone-500 dark:text-stone-400">
                      {cat.id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shrink-0">
                          <Layers className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-heading">
                          {cat.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-stone-500 dark:text-stone-400 max-w-md">
                      <span className="line-clamp-1">
                        {cat.description || 'Tidak ada deskripsi kategori'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[10px] font-semibold">
                        Aktif di Katalog
                      </span>
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(cat)}
                            className="p-1.5 rounded-lg text-stone-600 dark:text-stone-300 hover:text-accent hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                            title="Ubah Kategori"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCategoryToDelete(cat)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer"
                            title="Hapus Kategori"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Create / Edit Category */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs"
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)'
          }}
        >
          <div className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-[#251e1c] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-accent">
                  <Layers className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold font-heading">
                    {editingCategory ? `Ubah Kategori: ${editingCategory.name}` : 'Tambah Kategori Baru'}
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Nama kategori wajib unik dan tidak boleh sama dengan kategori lain di toko ini.
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

            {/* Modal Form Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
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
                  className={`w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border text-sm focus:outline-none focus:ring-2 ${
                    isDuplicateName
                      ? 'border-rose-500 dark:border-rose-500 focus:ring-rose-500'
                      : 'border-stone-200 dark:border-stone-700 focus:ring-accent'
                  }`}
                />
                {isDuplicateName && (
                  <p className="mt-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Nama kategori '{normalizedFormName}' sudah ada. Nama kategori harus unik.</span>
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                  Deskripsi Kategori (Opsional)
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Keterangan singkat kategori untuk kasir & pelanggan..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                />
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !normalizedFormName || isDuplicateName}
                  className="px-6 py-2.5 rounded-2xl bg-accent text-white text-xs font-bold shadow-md hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingCategory ? 'Simpan Perubahan' : 'Buat Kategori'}</span>
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
                Kategori akan dihapus dari daftar katalog toko. Tindakan ini hanya dapat dilakukan oleh role Manager atau Admin.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="flex-1 py-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
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
