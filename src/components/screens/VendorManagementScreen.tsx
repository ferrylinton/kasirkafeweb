import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Copy,
  Edit2,
  Trash2,
  Power,
  Store,
  Phone,
  Mail,
  MapPin,
  Boxes,
  Receipt,
  Users,
  TrendingUp,
  X,
  AlertCircle,
  Lock,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';

export interface VendorStats {
  productCount: number;
  orderCount: number;
  userCount: number;
  totalRevenue: number;
}

export interface AdminVendorItem {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'SUSPENDED';
  email?: string;
  phone?: string;
  address?: string;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
  stats?: VendorStats;
}

export const VendorManagementScreen: React.FC = () => {
  const { user, token } = useAuth();
  const { showToast } = useToast();

  const isAdmin = user?.role === 'ADMIN';

  const [vendors, setVendors] = useState<AdminVendorItem[]>([]);
  const [summary, setSummary] = useState({
    totalVendors: 0,
    activeVendors: 0,
    suspendedVendors: 0
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: '',
    currency: 'IDR',
    status: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED'
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delete Confirmation Modal
  const [vendorToDelete, setVendorToDelete] = useState<AdminVendorItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Fetch Vendors
  const fetchVendors = async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/vendors?status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`, {
        headers: {
          Authorization: `Bearer ${token || ''}`
        }
      });
      const data = await res.json();
      if (data.success && data.vendors) {
        setVendors(data.vendors);
        if (data.summary) {
          setSummary(data.summary);
        }
      } else {
        showToast(data.message || 'Gagal memuat data vendor', 'error');
      }
    } catch (err) {
      showToast('Koneksi server gagal saat memuat vendor', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchVendors();
    }
  }, [isAdmin, statusFilter, token]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setModalMode('CREATE');
    setEditingVendorId(null);
    setFormData({
      name: '',
      code: '',
      email: '',
      phone: '',
      address: '',
      currency: 'IDR',
      status: 'ACTIVE'
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (vendor: AdminVendorItem) => {
    setModalMode('EDIT');
    setEditingVendorId(vendor.id);
    setFormData({
      name: vendor.name,
      code: vendor.code,
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      currency: vendor.currency || 'IDR',
      status: vendor.status
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Submit Create or Edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) errors.name = 'Nama vendor wajib diisi.';
    if (!formData.code.trim()) errors.code = 'Kode vendor wajib diisi.';
    else if (!/^[A-Za-z0-9]+$/.test(formData.code.trim())) {
      errors.code = 'Kode harus berupa huruf dan angka (tanpa spasi).';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      if (modalMode === 'CREATE') {
        const res = await fetch('/api/admin/vendors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || ''}`
          },
          body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'Vendor baru berhasil didaftarkan', 'success');
          setIsModalOpen(false);
          fetchVendors();
        } else {
          showToast(data.message || 'Gagal menambahkan vendor', 'error');
          if (data.message.includes('Kode')) {
            setFormErrors({ code: data.message });
          }
        }
      } else {
        const res = await fetch(`/api/admin/vendors/${editingVendorId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || ''}`
          },
          body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'Data vendor berhasil diperbarui', 'success');
          setIsModalOpen(false);
          fetchVendors();
        } else {
          showToast(data.message || 'Gagal memperbarui vendor', 'error');
        }
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan saat menyimpan vendor', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Vendor Status
  const handleToggleStatus = async (vendor: AdminVendorItem) => {
    if (vendor.id === 'vnd_kasirkafe_central' || vendor.id === 'vnd_admin') {
      showToast('Vendor Sistem / Pusat tidak dapat dinonaktifkan.', 'warning');
      return;
    }

    const nextStatus = vendor.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/admin/vendors/${vendor.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Status ${vendor.name} diubah menjadi ${nextStatus}`, 'success');
        setVendors(prev =>
          prev.map(v => (v.id === vendor.id ? { ...v, status: nextStatus } : v))
        );
      } else {
        showToast(data.message || 'Gagal mengubah status vendor', 'error');
      }
    } catch {
      showToast('Gagal mengubah status vendor', 'error');
    }
  };

  // Confirm Delete Vendor
  const handleConfirmDelete = async () => {
    if (!vendorToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token || ''}`
        }
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Vendor ${vendorToDelete.name} berhasil dihapus`, 'success');
        setVendors(prev => prev.filter(v => v.id !== vendorToDelete.id));
        setVendorToDelete(null);
      } else {
        showToast(data.message || 'Gagal menghapus vendor', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan saat menghapus vendor', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Client-side search filter
  const filteredVendors = useMemo(() => {
    if (!searchQuery.trim()) return vendors;
    const q = searchQuery.toLowerCase().trim();
    return vendors.filter(
      v =>
        v.name.toLowerCase().includes(q) ||
        v.code.toLowerCase().includes(q) ||
        (v.email && v.email.toLowerCase().includes(q)) ||
        v.id.toLowerCase().includes(q)
    );
  }, [vendors, searchQuery]);

  // If user is not ADMIN, show strict Access Denied view
  if (!isAdmin) {
    return (
      <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-4xl mx-auto py-8">
        <div className="bg-white dark:bg-[#251e1c] rounded-3xl p-8 border border-rose-200 dark:border-rose-900/50 shadow-xl text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 mb-2">
            Akses Ditolak
          </span>
          <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100 font-heading mb-2">
            Halaman Khusus Role ADMIN
          </h2>
          <p className="text-stone-600 dark:text-stone-400 max-w-md text-sm leading-relaxed mb-6">
            Halaman Manajemen Vendor multi-tenant dibatasi secara ketat hanya untuk akun staf dengan role{' '}
            <strong className="text-rose-600 dark:text-rose-400 font-semibold">ADMIN</strong> atau{' '}
            Akun Anda saat ini memiliki role <span className="font-bold underline">{user?.role || 'KASIR'}</span>.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold text-xs hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
            >
              Segarkan Halaman
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-7xl mx-auto space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-stone-100 font-heading tracking-tight">
              Manajemen Vendor
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
              Khusus ADMIN
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
            Kelola pendaftaran merchant, status operasional, dan isolasi data per vendor.
          </p>
        </div>

        {/* Action Button: Tambah Vendor */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            id="btn-copy-public-register-url"
            onClick={() => {
              const registerUrl = `${window.location.origin}/?action=register-vendor`;
              navigator.clipboard.writeText(registerUrl);
              showToast('Tautan pendaftaran vendor disalin ke clipboard!', 'success');
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs hover:border-orange-500/50 hover:text-orange-600 transition-all shadow-2xs active:scale-95 cursor-pointer"
            title="Salin Tautan Pendaftaran Vendor Publik"
          >
            <Copy className="w-4 h-4 text-orange-600" />
            <span className="hidden sm:inline">Tautan Registrasi</span>
          </button>

          <button
            type="button"
            onClick={fetchVendors}
            disabled={isLoading}
            className="w-10 h-10 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:text-accent hover:border-accent/40 flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-accent' : ''}`} />
          </button>

          <button
            type="button"
            id="btn-add-vendor"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-accent text-white font-bold text-xs sm:text-sm hover:bg-orange-600 active:scale-95 transition-all shadow-md shadow-orange-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Vendor Baru</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white dark:bg-[#251e1c] rounded-2xl p-4 border border-stone-200/80 dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Total Vendor</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 dark:text-stone-100 font-heading">
            {summary.totalVendors || vendors.length}
          </div>
          <span className="text-[11px] text-stone-400">Merchant terdaftar</span>
        </div>

        <div className="bg-white dark:bg-[#251e1c] rounded-2xl p-4 border border-stone-200/80 dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Vendor Aktif</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-heading">
            {vendors.filter(v => v.status === 'ACTIVE').length}
          </div>
          <span className="text-[11px] text-stone-400">Siap bertransaksi</span>
        </div>

        <div className="bg-white dark:bg-[#251e1c] rounded-2xl p-4 border border-stone-200/80 dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Ditangguhkan</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-heading">
            {vendors.filter(v => v.status === 'SUSPENDED').length}
          </div>
          <span className="text-[11px] text-stone-400">Akses dibatasi</span>
        </div>

        <div className="bg-white dark:bg-[#251e1c] rounded-2xl p-4 border border-stone-200/80 dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Total Produk</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 dark:text-stone-100 font-heading">
            {vendors.reduce((acc, v) => acc + (v.stats?.productCount || 0), 0)}
          </div>
          <span className="text-[11px] text-stone-400">Katalog lintas vendor</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-[#251e1c] rounded-2xl p-3 sm:p-4 border border-stone-200/80 dark:border-stone-800 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        {/* Search Input */}
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama vendor, kode, email, atau ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9.5 pr-8 py-2 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 text-xs sm:text-sm text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-850 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
              }`}
            >
              {tab === 'ALL' ? 'Semua Status' : tab === 'ACTIVE' ? 'Aktif Saja' : 'Ditangguhkan'}
            </button>
          ))}
        </div>
      </div>

      {/* Vendors List Cards */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-purple-600 border-t-transparent animate-spin" />
          <span className="text-xs font-bold text-stone-500">Memuat daftar vendor...</span>
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="bg-white dark:bg-[#251e1c] rounded-3xl p-12 text-center border border-stone-200 dark:border-stone-800 shadow-2xs">
          <Building2 className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-stone-800 dark:text-stone-200 font-heading mb-1">
            Tidak ada vendor ditemukan
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto mb-4">
            {searchQuery
              ? `Tidak ada vendor yang cocok dengan pencarian "${searchQuery}".`
              : 'Belum ada vendor terdaftar untuk filter yang dipilih.'}
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold shadow-xs hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Vendor Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredVendors.map(vendor => {
            const isCentral = vendor.id === 'vnd_kasirkafe_central' || vendor.id === 'vnd_admin';
            const isAdminVendor = vendor.id === 'vnd_admin';
            const isSuspended = vendor.status === 'SUSPENDED';

            return (
              <div
                key={vendor.id}
                className={`bg-white dark:bg-[#251e1c] rounded-3xl p-5 border transition-all shadow-xs flex flex-col justify-between ${
                  isSuspended
                    ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50/20'
                    : 'border-stone-200/90 dark:border-stone-800 hover:border-purple-300 dark:hover:border-purple-900'
                }`}
              >
                <div>
                  {/* Card Header: Icon, Name, Badges, Edit/Delete Action */}
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-black text-sm shadow-xs ${
                          isSuspended
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600'
                            : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                        }`}
                      >
                        {vendor.code.slice(0, 3)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100 font-heading truncate">
                            {vendor.name}
                          </h3>
                          {isCentral && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                              {isAdminVendor ? 'Admin Sistem' : 'Pusat'}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1 ${
                              isSuspended
                                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                                : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSuspended ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'
                              }`}
                            />
                            {isSuspended ? 'Ditangguhkan' : 'Aktif'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                          <span className="font-mono font-semibold text-stone-700 dark:text-stone-300">
                            ID: {vendor.id}
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-purple-600 dark:text-purple-400">
                            [{vendor.code}]
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Edit Button */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(vendor)}
                        className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-stone-850 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center transition-colors cursor-pointer"
                        title="Edit Data Vendor"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {!isCentral && (
                        <button
                          type="button"
                          onClick={() => setVendorToDelete(vendor)}
                          className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-stone-850 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-stone-500 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                          title="Hapus Vendor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-600 dark:text-stone-400 mb-3.5 bg-stone-50/70 dark:bg-stone-900/40 p-3 rounded-2xl border border-stone-200/60 dark:border-stone-800/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{vendor.email || 'Email belum diisi'}</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{vendor.phone || 'Telepon belum diisi'}</span>
                    </div>
                    <div className="flex items-center gap-2 col-span-1 sm:col-span-2 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{vendor.address || 'Alamat gerai belum diisi'}</span>
                    </div>
                  </div>

                  {/* Vendor Live Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3.5">
                    <div className="bg-stone-50 dark:bg-stone-900/60 p-2 rounded-xl border border-stone-200/60 dark:border-stone-800/60">
                      <span className="block text-[10px] text-stone-400 uppercase font-bold">Produk</span>
                      <span className="font-black text-sm text-stone-800 dark:text-stone-200">
                        {vendor.stats?.productCount ?? 0}
                      </span>
                    </div>
                    <div className="bg-stone-50 dark:bg-stone-900/60 p-2 rounded-xl border border-stone-200/60 dark:border-stone-800/60">
                      <span className="block text-[10px] text-stone-400 uppercase font-bold">Pesanan</span>
                      <span className="font-black text-sm text-stone-800 dark:text-stone-200">
                        {vendor.stats?.orderCount ?? 0}
                      </span>
                    </div>
                    <div className="bg-stone-50 dark:bg-stone-900/60 p-2 rounded-xl border border-stone-200/60 dark:border-stone-800/60">
                      <span className="block text-[10px] text-stone-400 uppercase font-bold">Staf</span>
                      <span className="font-black text-sm text-stone-800 dark:text-stone-200">
                        {vendor.stats?.userCount ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Controls: Status Toggle Button */}
                <div className="pt-3 border-t border-stone-200/60 dark:border-stone-800/60 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-stone-400 truncate">
                    Omzet: <strong className="text-stone-700 dark:text-stone-300 font-bold">Rp {(vendor.stats?.totalRevenue || 0).toLocaleString('id-ID')}</strong>
                  </div>

                  {!isCentral ? (
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(vendor)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSuspended
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-2xs'
                          : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{isSuspended ? 'Aktifkan Vendor' : 'Tangguhkan'}</span>
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold text-stone-400">
                      Vendor Utama (Terkunci)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT VENDOR MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#251e1c] rounded-3xl max-w-lg w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200/80 dark:border-stone-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-heading">
                    {modalMode === 'CREATE' ? 'Tambah Vendor Baru' : 'Edit Profil Vendor'}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {modalMode === 'CREATE'
                      ? 'Daftarkan merchant baru dan terbitkan kredensial API otomatis'
                      : 'Perbarui rincian kontak dan profil merchant'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3.5">
              {/* Nama Vendor */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Nama Usaha / Gerai Vendor <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kopi Janji Jiwa (Senopati)"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 ${
                    formErrors.name
                      ? 'border-rose-500 focus:ring-rose-500/25'
                      : 'border-stone-200 dark:border-stone-800 focus:ring-accent/25 focus:border-accent'
                  }`}
                />
                {formErrors.name && (
                  <span className="text-[11px] text-rose-500 font-medium mt-1 block">
                    {formErrors.name}
                  </span>
                )}
              </div>

              {/* Kode Singkatan Vendor */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Kode Singkatan Vendor (Alfanumerik) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: JJIWA (Maks 10 karakter)"
                  value={formData.code}
                  maxLength={10}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                    })
                  }
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border text-xs sm:text-sm font-mono uppercase text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 ${
                    formErrors.code
                      ? 'border-rose-500 focus:ring-rose-500/25'
                      : 'border-stone-200 dark:border-stone-800 focus:ring-accent/25 focus:border-accent'
                  }`}
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  Digunakan untuk identifikasi unik kode cabang vendor.
                </span>
                {formErrors.code && (
                  <span className="text-[11px] text-rose-500 font-medium mt-1 block">
                    {formErrors.code}
                  </span>
                )}
              </div>

              {/* Email & Telepon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Email Resmi
                  </label>
                  <input
                    type="email"
                    placeholder="merchant@vendor.id"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Nomor Telepon
                  </label>
                  <input
                    type="tel"
                    placeholder="08123456789"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent"
                  />
                </div>
              </div>

              {/* Alamat Gerai */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Alamat Gerai / Cabang
                </label>
                <textarea
                  rows={2}
                  placeholder="Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent resize-none"
                />
              </div>

              {/* Status Operasional */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Status Operasional
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'ACTIVE' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      formData.status === 'ACTIVE'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                        : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    Aktif (Active)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'SUSPENDED' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      formData.status === 'SUSPENDED'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20'
                        : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    Ditangguhkan (Suspended)
                  </button>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-stone-200/80 dark:border-stone-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 text-xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 active:scale-95 transition-all shadow-md shadow-purple-600/25 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{modalMode === 'CREATE' ? 'Daftarkan Vendor' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {vendorToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#251e1c] rounded-3xl max-w-md w-full p-6 border border-rose-200 dark:border-rose-900 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-heading mb-1.5">
              Hapus Vendor {vendorToDelete.name}?
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed mb-4">
              Apakah Anda yakin ingin menghapus merchant ini beserta seluruh data katalog dan kategorinya? Tindakan
              ini bersifat permanen dan tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setVendorToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 shadow-xs"
              >
                {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Hapus Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
