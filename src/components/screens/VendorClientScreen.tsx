import React, { useState, useEffect } from 'react';
import {
  Building2,
  RefreshCw,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Store,
  Phone,
  Mail,
  MapPin,
  Users,
  Coins
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Vendor } from '../../types';
import { useToast } from '../common/Toast';

export const VendorClientScreen: React.FC = () => {
  const { user, token, logout } = useAuth();
  const { showToast } = useToast();

  const [currentVendor, setCurrentVendor] = useState<Vendor | null>(null);
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // New Vendor Modal State
  const [showNewVendorModal, setShowNewVendorModal] = useState<boolean>(false);
  const [newVendorForm, setNewVendorForm] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: ''
  });
  const [isCreatingVendor, setIsCreatingVendor] = useState<boolean>(false);

  const fetchVendorData = async () => {
    setIsLoading(true);
    try {
      // Fetch current vendor profile
      const currentRes = await fetch('/api/vendors/current', {
        headers: { Authorization: `Bearer ${token || ''}` }
      });
      const currentData = await currentRes.json();
      if (currentData.success && currentData.vendor) {
        setCurrentVendor(currentData.vendor);
      }

      // Fetch all vendors (for list & switcher demo)
      const listRes = await fetch('/api/vendors', {
        headers: { Authorization: `Bearer ${token || ''}` }
      });
      const listData = await listRes.json();
      if (listData.success && listData.vendors) {
        setAllVendors(listData.vendors);
      }
    } catch (err: any) {
      showToast('Gagal memuat data vendor', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVendorData();
  }, [token]);

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorForm.name.trim() || !newVendorForm.code.trim()) {
      showToast('Nama dan kode vendor wajib diisi', 'error');
      return;
    }

    setIsCreatingVendor(true);
    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token || ''}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newVendorForm)
      });
      const data = await res.json();
      if (data.success && data.vendor) {
        showToast(`Vendor '${data.vendor.name}' berhasil didaftarkan!`, 'success');
        setShowNewVendorModal(false);
        setNewVendorForm({ name: '', code: '', email: '', phone: '', address: '' });
        fetchVendorData();
      } else {
        showToast(data.error || 'Gagal mendaftarkan vendor', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan saat mendaftarkan vendor', 'error');
    } finally {
      setIsCreatingVendor(false);
    }
  };

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-[#251e1b] p-6 rounded-2xl border border-stone-200/70 dark:border-stone-800/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-stone-900 dark:text-stone-100 font-heading">
                Multi-Tenant & Profil Vendor
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Isolasi data ketat dan pengelolaan gerai vendor mandiri
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchVendorData}
            className="px-3 py-2 rounded-xl text-xs font-bold border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewVendorModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-accent text-white hover:bg-accent/90 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Vendor Baru</span>
          </button>
        </div>
      </div>

      {/* Security & Data Isolation Notice */}
      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-3 text-emerald-900 dark:text-emerald-100 text-xs">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">Prinsip Keamanan & Isolasi Data Terjamin:</span>
          <p className="text-emerald-800 dark:text-emerald-200 leading-relaxed">
            Sistem memastikan data katalog produk, stok inventaris, riwayat transaksi, antrean kasir, serta log database terpisah secara mandiri untuk setiap vendor. Data vendor Anda tidak dapat diakses atau diubah oleh vendor lain.
          </p>
        </div>
      </div>

      {/* Grid Content: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Vendor Profile & Isolation Architecture */}
        <div className="lg:col-span-7 space-y-6">
          {/* Current Vendor Card */}
          <div className="bg-white dark:bg-[#251e1b] rounded-2xl border border-stone-200/70 dark:border-stone-800/80 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-stone-200/60 dark:border-stone-800/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center font-black text-lg">
                  {currentVendor?.code?.substring(0, 3) || 'VND'}
                </div>
                <div>
                  <h2 className="text-base font-black text-stone-900 dark:text-stone-100">
                    {currentVendor?.name || 'SipSpot Coffee & Boba (Pusat)'}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                      ID: {currentVendor?.id || 'vnd_sipspot_central'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      {currentVendor?.status || 'ACTIVE'}
                    </span>
                  </div>
                </div>
              </div>

              <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-bold bg-orange-100 dark:bg-orange-950/50 text-accent">
                Vendor Anda
              </span>
            </div>

            {/* Vendor Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/50 dark:border-stone-800/50">
                <div className="flex items-center gap-1.5 text-stone-400 dark:text-stone-500 font-medium">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Vendor:</span>
                </div>
                <p className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5 truncate">
                  {currentVendor?.email || 'pusat@sipspot.com'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/50 dark:border-stone-800/50">
                <div className="flex items-center gap-1.5 text-stone-400 dark:text-stone-500 font-medium">
                  <Phone className="w-3.5 h-3.5" />
                  <span>No. Kontak:</span>
                </div>
                <p className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5">
                  {currentVendor?.phone || '+628123456789'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/50 dark:border-stone-800/50 sm:col-span-2">
                <div className="flex items-center gap-1.5 text-stone-400 dark:text-stone-500 font-medium">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Alamat Operasional:</span>
                </div>
                <p className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5">
                  {currentVendor?.address || 'Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/50 dark:border-stone-800/50">
                <div className="flex items-center gap-1.5 text-stone-400 dark:text-stone-500 font-medium">
                  <Coins className="w-3.5 h-3.5" />
                  <span>Mata Uang Transaksi:</span>
                </div>
                <p className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5">
                  {currentVendor?.currency || 'IDR (Rupiah)'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/50 dark:border-stone-800/50">
                <div className="flex items-center gap-1.5 text-stone-400 dark:text-stone-500 font-medium">
                  <Store className="w-3.5 h-3.5" />
                  <span>Kode Gerai:</span>
                </div>
                <p className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5 uppercase font-mono">
                  {currentVendor?.code || 'SIPSPOT'}
                </p>
              </div>
            </div>

            {/* Multi-Tenant Features Card */}
            <div className="pt-2 border-t border-stone-200/60 dark:border-stone-800/60 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-400 dark:text-stone-500 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-accent" />
                <span>Cakupan Isolasi Data Multi-Tenant</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/40 border border-stone-200/60 dark:border-stone-800/60 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Katalog Menu</span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Produk dan kategori terisolasi per cabang
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/40 border border-stone-200/60 dark:border-stone-800/60 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Stok & Bahan</span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Pengurangan stok hanya memengaruhi gudang toko aktif
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/40 border border-stone-200/60 dark:border-stone-800/60 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Kasir & Shift</span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Laporan transaksi dan kas kasir terpisah 100%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-Vendor Switcher & Demo Accounts */}
        <div className="lg:col-span-5 space-y-6">
          {/* Registered Vendors List */}
          <div className="bg-white dark:bg-[#251e1b] rounded-2xl border border-stone-200/70 dark:border-stone-800/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 font-heading">
                Daftar Vendor Terdaftar ({allVendors.length})
              </h3>
              <span className="text-[10px] text-stone-400 dark:text-stone-500 font-bold">
                Toko Mandiri
              </span>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {allVendors.map((vnd) => {
                const isCurrent = currentVendor?.id === vnd.id;
                return (
                  <div
                    key={vnd.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-orange-50/70 dark:bg-orange-950/30 border-accent/40 ring-1 ring-accent/20'
                        : 'bg-stone-50 dark:bg-stone-900/50 border-stone-200/60 dark:border-stone-800/60 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs text-stone-900 dark:text-stone-100 truncate">
                            {vnd.name}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-accent text-white shrink-0">
                              Aktif
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                          Kode: <strong className="text-stone-700 dark:text-stone-300">{vnd.code || '-'}</strong> • ID: {vnd.id}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shrink-0">
                        {vnd.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Demo Switcher Card */}
          <div className="bg-amber-50/80 dark:bg-amber-950/30 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 p-5 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold">
              <Users className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Coba Login Sebagai Vendor Lain:</span>
            </div>
            <p className="text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
              Untuk membuktikan isolasi data, silakan logout lalu masuk dengan akun vendor lain. Anda akan melihat bahwa daftar menu, harga, pesanan, dan log aktivitasnya 100% terpisah.
            </p>

            <div className="space-y-2 pt-1">
              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-stone-900/80 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-stone-900 dark:text-stone-100">1. SipSpot Pusat</div>
                  <div className="text-[10px] text-stone-500">manager@beverage.com (Password: Password123!)</div>
                </div>
                <span className="text-[10px] font-bold text-stone-400">Arabika & Boba</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-stone-900/80 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-stone-900 dark:text-stone-100">2. Kopi Kulo (Kemang)</div>
                  <div className="text-[10px] text-stone-500">kulo.manager@beverage.com (Password: Password123!)</div>
                </div>
                <span className="text-[10px] font-bold text-amber-600">Avocatto & Toast</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-stone-900/80 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-stone-900 dark:text-stone-100">3. Teh Poci (Bekasi)</div>
                  <div className="text-[10px] text-stone-500">poci.manager@beverage.com (Password: Password123!)</div>
                </div>
                <span className="text-[10px] font-bold text-emerald-600">Teh Poci & Dimsum</span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="w-full mt-2 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-2xs cursor-pointer"
            >
              Ganti Akun Vendor (Logout)
            </button>
          </div>
        </div>
      </div>

      {/* New Vendor Modal */}
      {showNewVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#251e1b] rounded-2xl border border-stone-200 dark:border-stone-800 w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-accent" />
                <h3 className="font-black text-stone-900 dark:text-stone-100 text-base font-heading">
                  Daftarkan Vendor Baru
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewVendorModal(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVendor} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300">Nama Vendor *</label>
                <input
                  type="text"
                  required
                  value={newVendorForm.name}
                  onChange={e => setNewVendorForm({ ...newVendorForm, name: e.target.value })}
                  placeholder="Contoh: Kopi Janji Jiwa (Cilandak)"
                  className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300">Kode Unik Toko *</label>
                <input
                  type="text"
                  required
                  value={newVendorForm.code}
                  onChange={e => setNewVendorForm({ ...newVendorForm, code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                  placeholder="Contoh: JJCILANDAK"
                  className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 focus:outline-none focus:border-accent uppercase font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300">Email Vendor</label>
                  <input
                    type="email"
                    value={newVendorForm.email}
                    onChange={e => setNewVendorForm({ ...newVendorForm, email: e.target.value })}
                    placeholder="kontak@vendor.id"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300">No. Telepon</label>
                  <input
                    type="text"
                    value={newVendorForm.phone}
                    onChange={e => setNewVendorForm({ ...newVendorForm, phone: e.target.value })}
                    placeholder="+628..."
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300">Alamat Gerai</label>
                <textarea
                  rows={2}
                  value={newVendorForm.address}
                  onChange={e => setNewVendorForm({ ...newVendorForm, address: e.target.value })}
                  placeholder="Lokasi gerai / toko vendor"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 focus:outline-none focus:border-accent resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-900 text-stone-500 dark:text-stone-400 text-[11px] leading-relaxed">
                ℹ️ Toko baru akan didaftarkan dengan ruang data dan inventaris mandiri.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowNewVendorModal(false)}
                  className="px-4 py-2 rounded-xl font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingVendor}
                  className="px-5 py-2 rounded-xl font-bold bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
                >
                  {isCreatingVendor ? 'Menyimpan...' : 'Daftarkan Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
