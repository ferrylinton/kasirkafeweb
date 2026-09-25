import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  RefreshCw,
  Search,
  X,
  Edit2,
  Trash2,
  Power,
  Mail,
  Phone,
  MapPin,
  Lock,
  Copy,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  Store,
  Users,
  ShoppingCart,
  TrendingUp,
  ShieldAlert,
  Clock,
  Check,
  FileText,
  MessageSquare,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { VendorStatusRequest } from '../../types';
import { AdminReviewVendorRequestModal } from '../modals/AdminReviewVendorRequestModal';

interface AdminVendorItem {
  id: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATE';
  currency: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  stats?: {
    productCount: number;
    orderCount: number;
    userCount: number;
    totalRevenue: number;
  };
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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATE'>('ALL');

  // Admin Tab Navigation
  const [adminTab, setAdminTab] = useState<'VENDORS' | 'REQUESTS'>('VENDORS');

  // Status Requests (Deactivation / Reactivation)
  const [statusRequests, setStatusRequests] = useState<VendorStatusRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState<boolean>(false);
  const [requestStatusFilter, setRequestStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [requestTypeFilter, setRequestTypeFilter] = useState<'ALL' | 'DEACTIVATE' | 'REACTIVATE'>('ALL');

  // Modal State for Admin Reviewing Request
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [selectedReviewRequest, setSelectedReviewRequest] = useState<VendorStatusRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');

  // Modal State for Vendor CRUD
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    currency: 'IDR',
    status: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATE'
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delete Confirmation Modal (Admin only)
  const [vendorToDelete, setVendorToDelete] = useState<AdminVendorItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Fetch Status Requests
  const fetchStatusRequests = async () => {
    setIsLoadingRequests(true);
    try {
      const res = await fetch('/api/vendors/status-requests', {
        headers: {
          Authorization: `Bearer ${token || ''}`
        }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setStatusRequests(data.requests);
      }
    } catch (err) {
      console.error('Failed to load vendor status requests:', err);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  // Fetch Vendors (Strictly ADMIN only)
  const fetchVendors = async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    try {
      const queryParam = `?status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(`/api/admin/vendors${queryParam}`, {
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
      fetchStatusRequests();
    }
  }, [isAdmin, statusFilter, token]);

  // Open Create Modal (Admin Only)
  const handleOpenCreateModal = () => {
    if (!isAdmin) {
      showToast('Hanya role ADMIN yang berhak menambah vendor baru.', 'warning');
      return;
    }
    setModalMode('CREATE');
    setEditingVendorId(null);
    setFormData({
      name: '',
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
    if (modalMode === 'CREATE' && !isAdmin) {
      showToast('Hanya role ADMIN yang berhak menambah vendor baru.', 'error');
      return;
    }

    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Nama vendor wajib diisi.';

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

  // Toggle Vendor Status (Admin Only)
  const handleToggleStatus = async (vendor: AdminVendorItem) => {
    if (!isAdmin) {
      showToast('Hanya role ADMIN yang berhak mengubah status operasional vendor.', 'error');
      return;
    }
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

  // Confirm Delete Vendor (Admin Only)
  const handleConfirmDelete = async () => {
    if (!isAdmin) {
      showToast('Hanya role ADMIN yang berhak menghapus vendor.', 'error');
      return;
    }
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

  // Client-side search filter (Admin view)
  const filteredVendors = useMemo(() => {
    if (!searchQuery.trim()) return vendors || [];
    const q = searchQuery.toLowerCase().trim();
    return (vendors || []).filter(
      v =>
        (v.name || '').toLowerCase().includes(q) ||
        (v.email && v.email.toLowerCase().includes(q)) ||
        (v.id || '').toLowerCase().includes(q)
    );
  }, [vendors, searchQuery]);

  // Pending requests count for Admin badge
  const pendingRequestsCount = useMemo(() => {
    return statusRequests.filter(r => r.status === 'PENDING').length;
  }, [statusRequests]);

  // Admin filter for requests
  const filteredRequests = useMemo(() => {
    return statusRequests.filter(req => {
      if (requestStatusFilter !== 'ALL' && req.status !== requestStatusFilter) return false;
      if (requestTypeFilter !== 'ALL' && req.type !== requestTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchVendor = (req.vendorName || '').toLowerCase().includes(q) || (req.vendorId || '').toLowerCase().includes(q);
        const matchRequester = (req.requestedByName || '').toLowerCase().includes(q) || (req.requestedByEmail || '').toLowerCase().includes(q);
        const matchReason = (req.reason || '').toLowerCase().includes(q);
        if (!matchVendor && !matchRequester && !matchReason) return false;
      }
      return true;
    });
  }, [statusRequests, requestStatusFilter, requestTypeFilter, searchQuery]);

  // Access Denied: Strictly ADMIN only
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
            Halaman Manajemen Vendor ini dibatasi khusus hanya untuk staf dengan wewenang{' '}
            <strong className="text-stone-900 dark:text-stone-100 font-semibold">ADMIN SISTEM</strong>.{' '}
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
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase border bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60">
              Khusus ADMIN
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
            Kelola pendaftaran merchant, status operasional, isolasi data per vendor, dan verifikasi permintaan status.
          </p>
        </div>

        {/* Action Buttons: Tambah Vendor & Registrasi Link HANYA UNTUK ADMIN */}
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
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
          )}

          <button
            type="button"
            onClick={fetchVendors}
            disabled={isLoading}
            className="w-10 h-10 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:text-accent hover:border-accent/40 flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-accent' : ''}`} />
          </button>

          {/* Hanya ADMIN yang bisa menambah vendor */}
          {isAdmin && (
            <button
              type="button"
              id="btn-add-vendor"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-accent text-white font-bold text-xs sm:text-sm hover:bg-orange-600 active:scale-95 transition-all shadow-md shadow-orange-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Vendor Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin Sub-Navigation Tabs */}
      {isAdmin && (
        <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
          <button
            type="button"
            id="tab-vendors-list"
            onClick={() => setAdminTab('VENDORS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              adminTab === 'VENDORS'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/25'
                : 'bg-stone-100 dark:bg-stone-850 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Daftar Vendor</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              adminTab === 'VENDORS' ? 'bg-purple-700 text-white' : 'bg-stone-200 dark:bg-stone-750 text-stone-700 dark:text-stone-300'
            }`}>
              {vendors.length}
            </span>
          </button>

          <button
            type="button"
            id="tab-status-requests"
            onClick={() => setAdminTab('REQUESTS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              adminTab === 'REQUESTS'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/25'
                : 'bg-stone-100 dark:bg-stone-850 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Permintaan Status Vendor</span>
            {pendingRequestsCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                {pendingRequestsCount} Menunggu
              </span>
            ) : (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                adminTab === 'REQUESTS' ? 'bg-purple-700 text-white' : 'bg-stone-200 dark:bg-stone-750 text-stone-700 dark:text-stone-300'
              }`}>
                {statusRequests.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADMIN VIEW: REQUESTS TAB (Review Deactivate / Reactivate) */}
      {/* ======================================================== */}
      {isAdmin && adminTab === 'REQUESTS' && (
        <div className="space-y-6">
          {/* Requests KPI Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-[#251e1c] rounded-2xl p-4 border border-stone-200/80 dark:border-stone-800 shadow-2xs">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Total Permintaan</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-stone-900 dark:text-stone-100 font-heading">
                {statusRequests.length}
              </div>
              <span className="text-[11px] text-stone-400">Pengajuan dari Manager</span>
            </div>

            <div className="bg-white dark:bg-[#251e1c] rounded-2xl p-4 border border-stone-200/80 dark:border-stone-800 shadow-2xs">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Menunggu Review</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-heading">
                {pendingRequestsCount}
              </div>
              <span className="text-[11px] text-stone-400">Perlu tindakan Admin</span>
            </div>

            <div className="bg-white dark:bg-[#251e1c] rounded-2xl p-4 border border-stone-200/80 dark:border-stone-800 shadow-2xs">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Permintaan Nonaktif</span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Power className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-heading">
                {statusRequests.filter(r => r.type === 'DEACTIVATE').length}
              </div>
              <span className="text-[11px] text-stone-400">Tipe DEACTIVATE</span>
            </div>

            <div className="bg-white dark:bg-[#251e1c] rounded-2xl p-4 border border-stone-200/80 dark:border-stone-800 shadow-2xs">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Permintaan Aktivasi</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-heading">
                {statusRequests.filter(r => r.type === 'REACTIVATE').length}
              </div>
              <span className="text-[11px] text-stone-400">Tipe REACTIVATE</span>
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="bg-white dark:bg-[#251e1c] rounded-2xl p-4 border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Search Input */}
              <div className="relative w-full sm:max-w-md">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari vendor, nama manager, email, atau alasan..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9.5 pr-8 py-2 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 text-xs sm:text-sm text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-purple-500/25 focus:border-purple-500"
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

              {/* Status Chips */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setRequestStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      requestStatusFilter === st
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-stone-100 dark:bg-stone-850 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
                    }`}
                  >
                    {st === 'ALL'
                      ? 'Semua Status'
                      : st === 'PENDING'
                      ? 'Menunggu Review'
                      : st === 'APPROVED'
                      ? 'Disetujui'
                      : 'Ditolak'}
                  </button>
                ))}
              </div>
            </div>

            {/* Type Filters */}
            <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-800/80 text-xs text-stone-500">
              <span className="font-bold text-[11px] uppercase tracking-wider">Tipe:</span>
              {(['ALL', 'DEACTIVATE', 'REACTIVATE'] as const).map(tp => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setRequestTypeFilter(tp)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    requestTypeFilter === tp
                      ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-2xs'
                      : 'bg-stone-100 dark:bg-stone-850 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
                  }`}
                >
                  {tp === 'ALL' ? 'Semua Tipe' : tp === 'DEACTIVATE' ? 'Penonaktifan' : 'Aktivasi'}
                </button>
              ))}
            </div>
          </div>

          {/* Requests Cards List */}
          {isLoadingRequests ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full border-3 border-purple-600 border-t-transparent animate-spin" />
              <span className="text-xs font-bold text-stone-500">Memuat permintaan status vendor...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="bg-white dark:bg-[#251e1c] rounded-3xl p-12 text-center border border-stone-200 dark:border-stone-800 shadow-2xs">
              <ShieldAlert className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-stone-800 dark:text-stone-200 font-heading mb-1">
                Tidak ada permintaan status ditemukan
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {requestStatusFilter === 'PENDING'
                  ? 'Saat ini tidak ada permohonan penonaktifan atau aktivasi yang sedang menunggu keputusan Anda.'
                  : 'Belum ada data pengajuan status vendor yang cocok dengan filter yang dipilih.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map(req => {
                const isPending = req.status === 'PENDING';
                const isDeactivate = req.type === 'DEACTIVATE';

                return (
                  <div
                    key={req.id}
                    className={`bg-white dark:bg-[#251e1c] rounded-3xl p-5 sm:p-6 border transition-all duration-200 shadow-2xs ${
                      isPending
                        ? 'border-amber-300 dark:border-amber-800 bg-amber-50/15 dark:bg-amber-950/10'
                        : 'border-stone-200/80 dark:border-stone-800'
                    }`}
                  >
                    {/* Header: Vendor Name, Type Badge, Status Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-stone-200/60 dark:border-stone-800/60">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 shadow-2xs ${
                            isDeactivate
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isDeactivate ? <Power className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100 font-heading">
                              {req.vendorName}
                            </h3>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-stone-100 dark:bg-stone-850 text-stone-600 dark:text-stone-300">
                              ID: {req.vendorId}
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            Diajukan: {new Date(req.createdAt).toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            isDeactivate
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                          }`}
                        >
                          {isDeactivate ? 'Penonaktifan Vendor' : 'Pengaktifan Kembali Vendor'}
                        </span>

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : req.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 animate-pulse'
                          }`}
                        >
                          {req.status === 'APPROVED'
                            ? 'Disetujui'
                            : req.status === 'REJECTED'
                            ? 'Ditolak'
                            : 'Menunggu Keputusan'}
                        </span>
                      </div>
                    </div>

                    {/* Body: Requester & Reason */}
                    <div className="py-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
                        <Users className="w-4 h-4 text-stone-400" />
                        <span>
                          Diajukan oleh Manager:{' '}
                          <strong className="text-stone-900 dark:text-stone-100 font-bold">
                            {req.requestedByName}
                          </strong>{' '}
                          ({req.requestedByEmail})
                        </span>
                      </div>

                      {/* Alasan Box */}
                      <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/60 dark:border-stone-800/60">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-1 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-stone-400" />
                          <span>Alasan Pengajuan ({req.reason?.length || 0} Karakter):</span>
                        </div>
                        <p className="text-xs sm:text-sm text-stone-800 dark:text-stone-200 font-medium italic leading-relaxed">
                          "{req.reason}"
                        </p>
                      </div>

                      {/* Review Info if reviewed */}
                      {!isPending && (
                        <div className="p-3 rounded-2xl bg-stone-100/70 dark:bg-stone-900/40 border border-stone-200/40 dark:border-stone-800/40 text-xs text-stone-600 dark:text-stone-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span>Direview oleh: </span>
                            <strong className="text-stone-800 dark:text-stone-200">
                              {req.reviewedBy || 'Admin'}
                            </strong>{' '}
                            pada {req.reviewedAt ? new Date(req.reviewedAt).toLocaleString('id-ID') : '-'}
                          </div>
                          {req.adminNotes && (
                            <div>
                              <span>Catatan: </span>
                              <span className="font-semibold text-stone-800 dark:text-stone-200">
                                "{req.adminNotes}"
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions if Pending */}
                    {isPending && (
                      <div className="pt-3 border-t border-stone-200/60 dark:border-stone-800/60 flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReviewRequest(req);
                            setReviewAction('REJECT');
                            setIsReviewModalOpen(true);
                          }}
                          className="px-4 py-2 rounded-xl border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          Tolak Permintaan
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReviewRequest(req);
                            setReviewAction('APPROVE');
                            setIsReviewModalOpen(true);
                          }}
                          className={`px-5 py-2 rounded-xl text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                            isDeactivate
                              ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                              : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          <span>
                            {isDeactivate ? 'Setujui & Nonaktifkan Vendor' : 'Setujui & Aktifkan Vendor'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* VENDORS TAB (Admin View) */}
      {/* ======================================================== */}
      {adminTab === 'VENDORS' && (
        <>
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
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-heading">
                {vendors.filter(v => v.status === 'SUSPENDED').length}
              </div>
              <span className="text-[11px] text-stone-400">Akses dibatasi</span>
            </div>

            <div className="bg-white dark:bg-[#251e1c] rounded-2xl p-4 border border-stone-200/80 dark:border-stone-800 shadow-2xs">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">DEACTIVATE</span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Power className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-heading">
                {vendors.filter(v => v.status === 'DEACTIVATE').length}
              </div>
              <span className="text-[11px] text-stone-400">Nonaktif / Blokir login</span>
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
                {(['ALL', 'ACTIVE', 'SUSPENDED', 'DEACTIVATE'] as const).map(tab => (
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
                    {tab === 'ALL'
                      ? 'Semua Status'
                      : tab === 'ACTIVE'
                      ? 'Aktif Saja'
                      : tab === 'SUSPENDED'
                      ? 'Ditangguhkan'
                      : 'DEACTIVATE'}
                  </button>
                ))}
              </div>
            </div>

          {/* Vendors List Cards */}
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full border-3 border-purple-600 border-t-transparent animate-spin" />
              <span className="text-xs font-bold text-stone-500">Memuat data vendor...</span>
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
                  : 'Belum ada data vendor yang terdaftar pada sistem.'}
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold shadow-xs hover:bg-orange-600 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Vendor Sekarang</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredVendors.map(vendor => {
                const isCentral = vendor.id === 'vnd_kasirkafe_central' || vendor.id === 'vnd_admin';
                const isAdminVendor = vendor.id === 'vnd_admin';
                const isSuspended = vendor.status === 'SUSPENDED';
                const isDeactivated = vendor.status === 'DEACTIVATE';

                return (
                  <div
                    key={vendor.id}
                    className={`bg-white dark:bg-[#251e1c] rounded-3xl p-5 border transition-all duration-200 flex flex-col justify-between shadow-2xs ${
                      isDeactivated
                        ? 'border-rose-300/80 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20'
                        : isSuspended
                        ? 'border-amber-200/80 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10'
                        : 'border-stone-200/80 dark:border-stone-800 hover:border-purple-500/40 hover:shadow-md'
                    }`}
                  >
                    <div>
                      {/* Card Header: Icon, Name, ID, Badges & Edit Button */}
                      <div className="flex items-start justify-between gap-3 mb-3.5">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 shadow-2xs ${
                              isDeactivated
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                                : isSuspended
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                                : 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                            }`}
                          >
                            <Store className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-extrabold text-sm sm:text-base text-stone-900 dark:text-stone-100 font-heading truncate">
                                {vendor.name}
                              </h3>
                              {isCentral && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                                  {isAdminVendor ? 'Admin Root' : 'Sistem Pusat'}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-850">
                                ID: {vendor.id}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isDeactivated
                                    ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                                    : isSuspended
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                                    : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                }`}
                              >
                                {isDeactivated
                                  ? 'DEACTIVATE (Nonaktif)'
                                  : isSuspended
                                  ? 'Ditangguhkan'
                                  : 'Aktif'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Controls */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(vendor)}
                            className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-stone-850 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center transition-colors cursor-pointer"
                            title="Edit Data Vendor"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Hapus Vendor HANYA UNTUK ADMIN */}
                          {isAdmin && !isCentral && (
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

                    {/* Footer Controls */}
                    <div className="pt-3 border-t border-stone-200/60 dark:border-stone-800/60 flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-[11px] text-stone-400 truncate flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-stone-400" />
                        <span>Omzet:</span>
                        <strong className="text-stone-700 dark:text-stone-300 font-bold">
                          Rp {(vendor.stats?.totalRevenue || 0).toLocaleString('id-ID')}
                        </strong>
                      </div>

                      {/* Status Toggle Button: HANYA UNTUK ADMIN */}
                      {!isCentral && (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(vendor)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                            isDeactivated || isSuspended
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{isDeactivated || isSuspended ? 'Aktifkan Kembali' : 'Tangguhkan'}</span>
                        </button>
                      )}

                      {isCentral && (
                        <span className="text-[11px] font-semibold text-stone-400">
                          Vendor Utama
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
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
                className="w-8 h-8 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 flex items-center justify-center cursor-pointer"
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

              {/* Status Operasional (Hanya Admin yang dapat mengubah status) */}
              {isAdmin && (
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
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20'
                          : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      Ditangguhkan (Suspended)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'DEACTIVATE' })}
                      className={`col-span-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        formData.status === 'DEACTIVATE'
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20'
                          : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      Nonaktifkan (DEACTIVATE - Blokir Semua Login Pengguna)
                    </button>
                  </div>
                </div>
              )}

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

      {/* DELETE CONFIRMATION MODAL (Strictly ADMIN Only) */}
      {isAdmin && vendorToDelete && (
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
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 shadow-xs cursor-pointer"
              >
                {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Hapus Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN REVIEW VENDOR REQUEST MODAL (ADMIN: Approve / Reject) */}
      <AdminReviewVendorRequestModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedReviewRequest(null);
        }}
        request={selectedReviewRequest}
        action={reviewAction}
        onReviewed={() => {
          fetchStatusRequests();
          fetchVendors();
        }}
      />
    </div>
  );
};
