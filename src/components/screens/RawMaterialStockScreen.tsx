import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  Search,
  RefreshCw,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Trash2,
  X,
  PackagePlus,
  FlaskConical,
  ArrowRight,
  Filter,
  Sparkles,
  Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { RawMaterial } from '../../types';

export const RawMaterialStockScreen: React.FC = () => {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';

  // State
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filters & Searches
  const [materialSearch, setMaterialSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
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

  // Load raw materials
  const loadMaterials = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/raw-materials', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setMaterials(data.materials || []);
      } else {
        showToast(data.error || 'Gagal memuat master bahan baku', 'error');
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

  // Summary Metrics
  const stockSummary = useMemo(() => {
    let outOfStock = 0;
    let lowStock = 0;
    let safe = 0;

    materials.forEach(m => {
      if (m.stock <= 0) {
        outOfStock++;
      } else if (m.stock <= m.minimumStock) {
        lowStock++;
      } else {
        safe++;
      }
    });

    return {
      total: materials.length,
      outOfStock,
      lowStock,
      safe
    };
  }, [materials]);

  // Filtered Materials
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const query = materialSearch.toLowerCase();
      const matchSearch =
        m.name.toLowerCase().includes(query) ||
        (m.category && m.category.toLowerCase().includes(query)) ||
        (m.notes && m.notes.toLowerCase().includes(query));

      const matchCategory = categoryFilter === 'all' || m.category === categoryFilter;

      let matchStatus = true;
      if (statusFilter === 'depleted') {
        matchStatus = m.stock <= 0;
      } else if (statusFilter === 'low') {
        matchStatus = m.stock > 0 && m.stock <= m.minimumStock;
      } else if (statusFilter === 'safe') {
        matchStatus = m.stock > m.minimumStock;
      }

      return matchSearch && matchCategory && matchStatus;
    });
  }, [materials, materialSearch, categoryFilter, statusFilter]);

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
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 mb-1">
              <span>Bahan Baku</span>
              <span>/</span>
              <span className="text-accent font-bold">Master Stok Bahan</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading flex items-center gap-2.5">
              <Boxes className="w-6 h-6 text-accent" />
              <span>Master Stok Bahan Baku Minuman</span>
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1 max-w-2xl">
              Pantau kuantiti fisik bahan racikan barista, tentukan ambang batas minimum, dan kelola estimasi biaya per gram/ml.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadMaterials}
              disabled={loading}
              className="px-3.5 py-2 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Segarkan data bahan"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/pembelian-bahan')}
              className="px-3.5 py-2 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <PackagePlus className="w-3.5 h-3.5 text-stone-500" />
              <span>Kulakan / Tambah Stok</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/resep-minuman')}
              className="px-3.5 py-2 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FlaskConical className="w-3.5 h-3.5 text-purple-500" />
              <span>Resep Minuman</span>
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
              className="px-4 py-2 rounded-2xl bg-accent text-white hover:opacity-95 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Bahan Baku Baru</span>
            </button>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-stone-100 dark:border-stone-800">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`p-4 rounded-2xl text-left transition-all cursor-pointer border ${
              statusFilter === 'all'
                ? 'bg-stone-100 dark:bg-stone-800 border-accent/60'
                : 'bg-stone-50 dark:bg-stone-900/60 border-stone-200/60 dark:border-stone-800/80 hover:border-stone-300'
            }`}
          >
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
              Total Master Bahan
            </span>
            <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading">
              {stockSummary.total} <span className="text-xs font-normal text-stone-400">varian</span>
            </div>
            <span className="text-[10px] text-stone-400 mt-0.5 block">Semua bahan terdaftar</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('depleted')}
            className={`p-4 rounded-2xl text-left transition-all cursor-pointer border ${
              statusFilter === 'depleted'
                ? 'bg-red-100/60 dark:bg-red-950/40 border-red-500'
                : 'bg-red-50/60 dark:bg-red-950/20 border-red-200/60 dark:border-red-900/40 hover:border-red-300'
            }`}
          >
            <span className="text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider block mb-1 flex items-center justify-between">
              <span>Stok Habis (0)</span>
              {stockSummary.outOfStock > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              )}
            </span>
            <div className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400 font-heading">
              {stockSummary.outOfStock} <span className="text-xs font-normal text-red-400">bahan</span>
            </div>
            <span className="text-[10px] text-red-500/80 dark:text-red-400/80 mt-0.5 block">Menu terkait otomatis nonaktif</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('low')}
            className={`p-4 rounded-2xl text-left transition-all cursor-pointer border ${
              statusFilter === 'low'
                ? 'bg-amber-100/60 dark:bg-amber-950/40 border-amber-500'
                : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40 hover:border-amber-300'
            }`}
          >
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block mb-1">
              Stok Menipis
            </span>
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-heading">
              {stockSummary.lowStock} <span className="text-xs font-normal text-amber-400">bahan</span>
            </div>
            <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5 block">Di bawah batas minimum</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('safe')}
            className={`p-4 rounded-2xl text-left transition-all cursor-pointer border ${
              statusFilter === 'safe'
                ? 'bg-emerald-100/60 dark:bg-emerald-950/40 border-emerald-500'
                : 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40 hover:border-emerald-300'
            }`}
          >
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">
              Stok Aman
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-heading">
              {stockSummary.safe} <span className="text-xs font-normal text-emerald-400">bahan</span>
            </div>
            <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 block">Kuantiti di atas ambang</span>
          </button>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 p-5 sm:p-6 shadow-2xs space-y-4">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading">
              Daftar Stok Bahan Baku ({filteredMaterials.length})
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
                placeholder="Cari nama bahan baku..."
                className="w-full pl-9 pr-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">Semua Kategori</option>
              <option value="KOPI">Kopi (Beans/Ground)</option>
              <option value="SUSU">Susu & Dairy</option>
              <option value="SIRUP_PEMANIS">Sirup & Pemanis</option>
              <option value="TEH_BUAH">Teh & Bubuk</option>
              <option value="TOPPING">Topping & Boba</option>
              <option value="KEMASAN">Kemasan & Cup</option>
              <option value="LAINNYA">Lainnya</option>
            </select>

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
        {filteredMaterials.length === 0 ? (
          <div className="py-16 text-center text-stone-400">
            <Boxes className="w-12 h-12 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">
              {materialSearch || categoryFilter !== 'all' || statusFilter !== 'all'
                ? 'Tidak ada bahan baku yang cocok dengan filter yang dipilih.'
                : 'Belum ada data bahan baku terdaftar.'}
            </p>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              Tambahkan bahan baku dasar kafe Anda seperti Biji Kopi, Fresh Milk, Sirup Vanila, atau Cup Takeaway.
            </p>
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
                  <th className="p-3">Estimasi Biaya / Satuan</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredMaterials.map(m => {
                  const isDepleted = m.stock <= 0;
                  const isLow = m.stock > 0 && m.stock <= m.minimumStock;

                  return (
                    <tr key={m.id} className="hover:bg-stone-50/60 dark:hover:bg-stone-850/60 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">{m.name}</div>
                        {m.notes && <div className="text-[10px] text-stone-400 mt-0.5 max-w-xs truncate">{m.notes}</div>}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 font-bold text-[10px] text-stone-700 dark:text-stone-300">
                          {m.category}
                        </span>
                      </td>
                      <td className="p-3 font-black text-sm whitespace-nowrap">
                        <span className={isDepleted ? 'text-red-600 font-black' : isLow ? 'text-amber-600 font-bold' : 'text-stone-900 dark:text-stone-100'}>
                          {m.stock.toLocaleString('id-ID')}
                        </span>
                        <span className="text-xs font-semibold text-stone-500 ml-1">{m.unit}</span>
                      </td>
                      <td className="p-3 text-stone-600 dark:text-stone-400 whitespace-nowrap">
                        {m.minimumStock.toLocaleString('id-ID')} {m.unit}
                      </td>
                      <td className="p-3">
                        {isDepleted ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 dark:bg-red-950/80 text-red-600 flex items-center gap-1 w-fit animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Habis (0)</span>
                          </span>
                        ) : isLow ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center gap-1 w-fit">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Menipis</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Aman</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-stone-700 dark:text-stone-300 font-medium whitespace-nowrap">
                        Rp {(m.avgCostPerUnit || 0).toLocaleString('id-ID')} <span className="text-[11px] text-stone-400">/ {m.unit}</span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
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
