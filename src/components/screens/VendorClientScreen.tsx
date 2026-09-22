import React, { useState, useEffect } from 'react';
import {
  Building2,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  ShieldCheck,
  Lock,
  Code2,
  AlertCircle,
  CheckCircle2,
  Server,
  ArrowRight,
  Database,
  Users
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
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // M2M API Token Simulator State
  const [simClientId, setSimClientId] = useState<string>('');
  const [simClientSecret, setSimClientSecret] = useState<string>('');
  const [isGeneratingToken, setIsGeneratingToken] = useState<boolean>(false);
  const [generatedToken, setGeneratedToken] = useState<any>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

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
        setSimClientId(currentData.vendor.clientId || '');
        setSimClientSecret(currentData.vendor.clientSecret || '');
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

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    showToast(`${label} disalin ke clipboard!`, 'success');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleRegenerateSecret = async () => {
    if (!currentVendor) return;
    if (!window.confirm('PERINGATAN: Menghasilkan Client Secret baru akan membatalkan kredensial lama. Aplikasi yang menggunakan secret lama tidak akan bisa mengakses data lagi. Lanjutkan?')) {
      return;
    }

    setIsRegenerating(true);
    try {
      const res = await fetch(`/api/vendors/${currentVendor.id}/regenerate-secret`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token || ''}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.success && data.clientSecret) {
        setCurrentVendor(prev => prev ? { ...prev, clientSecret: data.clientSecret } : null);
        setSimClientSecret(data.clientSecret);
        setShowSecret(true);
        showToast('Client Secret baru berhasil dibuat!', 'success');
      } else {
        showToast(data.error || 'Gagal membuat secret baru', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan saat membuat secret baru', 'error');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSimulateTokenRequest = async () => {
    setIsGeneratingToken(true);
    setTokenError(null);
    setGeneratedToken(null);

    try {
      const res = await fetch('/api/vendors/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: simClientId,
          client_secret: simClientSecret
        })
      });

      const data = await res.json();
      if (res.ok && data.access_token) {
        setGeneratedToken(data);
        showToast('Token M2M berhasil diterbitkan!', 'success');
      } else {
        setTokenError(data.error_description || data.error || 'Autentikasi Client Credentials gagal.');
      }
    } catch (e: any) {
      setTokenError('Gagal terhubung ke endpoint token autentikasi.');
    } finally {
      setIsGeneratingToken(false);
    }
  };

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
                Multi-Tenant & Kredensial Vendor (Klien)
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Isolasi data ketat per klien menggunakan Client ID & Client Secret
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchVendorData}
            className="px-3 py-2 rounded-xl text-xs font-bold border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewVendorModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-accent text-white hover:bg-accent/90 transition-colors flex items-center gap-1.5 shadow-xs"
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
        {/* Left Column: Vendor Profile & Credentials */}
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
                <span className="text-stone-400 dark:text-stone-500 font-medium">Email Vendor:</span>
                <p className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5">
                  {currentVendor?.email || 'pusat@sipspot.com'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/50 dark:border-stone-800/50">
                <span className="text-stone-400 dark:text-stone-500 font-medium">No. Kontak:</span>
                <p className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5">
                  {currentVendor?.phone || '+628123456789'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/50 dark:border-stone-800/50 sm:col-span-2">
                <span className="text-stone-400 dark:text-stone-500 font-medium">Alamat Operasional:</span>
                <p className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5">
                  {currentVendor?.address || 'Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan'}
                </p>
              </div>
            </div>

            {/* Client ID & Client Secret Section */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-400 dark:text-stone-500 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-accent" />
                <span>Kredensial Autentikasi API (M2M)</span>
              </h3>

              {/* Client ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  Client ID (Klien ID)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={currentVendor?.clientId || ''}
                    className="flex-1 px-3.5 py-2.5 rounded-xl text-xs font-mono bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(currentVendor?.clientId || '', 'Client ID')}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5 text-stone-700 dark:text-stone-300"
                  >
                    {copiedKey === 'Client ID' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'Client ID' ? 'Disalin' : 'Salin'}</span>
                  </button>
                </div>
              </div>

              {/* Client Secret */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    Client Secret (Rahasia Klien)
                  </label>
                  <button
                    type="button"
                    onClick={handleRegenerateSecret}
                    disabled={isRegenerating}
                    className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                    <span>Regenerate Secret</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      readOnly
                      value={currentVendor?.clientSecret || ''}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 focus:outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                      title={showSecret ? 'Sembunyikan' : 'Tampilkan'}
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(currentVendor?.clientSecret || '', 'Client Secret')}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5 text-stone-700 dark:text-stone-300"
                  >
                    {copiedKey === 'Client Secret' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'Client Secret' ? 'Disalin' : 'Salin'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* M2M Token Simulator / API Tester */}
          <div className="bg-white dark:bg-[#251e1b] rounded-2xl border border-stone-200/70 dark:border-stone-800/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-accent" />
                <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 font-heading">
                  Simulator OAuth2 Client Credentials (M2M)
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-mono">
                POST /api/vendors/token
              </span>
            </div>

            <p className="text-xs text-stone-500 dark:text-stone-400">
              Gunakan Client ID & Client Secret untuk memperoleh Bearer Access Token bagi sistem eksternal (ERP, Aplikasi Mobile, Integrasi Kasir Mandiri).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400">Client ID</label>
                <input
                  type="text"
                  value={simClientId}
                  onChange={e => setSimClientId(e.target.value)}
                  placeholder="client_..."
                  className="w-full mt-1 px-3 py-2 rounded-xl text-xs font-mono bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400">Client Secret</label>
                <input
                  type="password"
                  value={simClientSecret}
                  onChange={e => setSimClientSecret(e.target.value)}
                  placeholder="sec_..."
                  className="w-full mt-1 px-3 py-2 rounded-xl text-xs font-mono bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSimulateTokenRequest}
              disabled={isGeneratingToken || !simClientId || !simClientSecret}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 shadow-xs"
            >
              {isGeneratingToken ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
              <span>{isGeneratingToken ? 'Meminta Token...' : 'Kirim Permintaan Token (OAuth2)'}</span>
            </button>

            {/* Token Result */}
            {tokenError && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-red-700 dark:text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{tokenError}</span>
              </div>
            )}

            {generatedToken && (
              <div className="p-4 rounded-xl bg-stone-900 text-stone-100 text-xs font-mono space-y-2.5 border border-stone-800">
                <div className="flex items-center justify-between text-emerald-400 font-bold">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>200 OK - Access Token Diterbitkan</span>
                  </div>
                  <span className="text-[10px] text-stone-400">Exp: {generatedToken.expires_in} detik (24 jam)</span>
                </div>

                <div className="space-y-1">
                  <div className="text-stone-400 text-[10px]">Access Token (Bearer):</div>
                  <div className="break-all p-2 rounded bg-stone-950 text-[11px] text-amber-300 select-all">
                    {generatedToken.access_token}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1 border-t border-stone-800">
                  <span>Vendor: <strong>{generatedToken.vendor_name}</strong></span>
                  <span>Scope: <strong>{generatedToken.scope}</strong></span>
                </div>
              </div>
            )}
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
                          Kode: <strong className="text-stone-700 dark:text-stone-300">{vnd.code}</strong> • ID: {vnd.id}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shrink-0">
                        {vnd.status}
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-stone-200/50 dark:border-stone-800/50 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                      <span className="font-mono text-[10px] truncate max-w-[160px]">{vnd.clientId}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSimClientId(vnd.clientId);
                          setSimClientSecret(vnd.clientSecret || '');
                          showToast(`Kredensial '${vnd.name}' dimuat ke simulator!`, 'info');
                        }}
                        className="text-[10px] font-bold text-accent hover:underline flex items-center gap-0.5"
                      >
                        <span>Uji API</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
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
                  <div className="text-[10px] text-stone-500">manager@beverage.com (PIN: 123456)</div>
                </div>
                <span className="text-[10px] font-bold text-stone-400">Arabika & Boba</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-stone-900/80 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-stone-900 dark:text-stone-100">2. Kopi Kulo (Kemang)</div>
                  <div className="text-[10px] text-stone-500">kulo.manager@beverage.com (PIN: 223344)</div>
                </div>
                <span className="text-[10px] font-bold text-amber-600">Avocatto & Toast</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-stone-900/80 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-stone-900 dark:text-stone-100">3. Teh Poci (Bekasi)</div>
                  <div className="text-[10px] text-stone-500">poci.manager@beverage.com (PIN: 334455)</div>
                </div>
                <span className="text-[10px] font-bold text-emerald-600">Teh Poci & Dimsum</span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="w-full mt-2 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-2xs"
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
                  Daftarkan Vendor (Klien) Baru
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewVendorModal(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVendor} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300">Nama Vendor / Klien *</label>
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
                <label className="font-bold text-stone-700 dark:text-stone-300">Alamat</label>
                <textarea
                  rows={2}
                  value={newVendorForm.address}
                  onChange={e => setNewVendorForm({ ...newVendorForm, address: e.target.value })}
                  placeholder="Lokasi gerai / toko vendor"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 focus:outline-none focus:border-accent resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-900 text-stone-500 dark:text-stone-400 text-[11px] leading-relaxed">
                ℹ️ Sistem akan secara otomatis mengenerate <strong>Client ID</strong> dan <strong>Client Secret</strong> unik yang terenkripsi untuk vendor ini.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowNewVendorModal(false)}
                  className="px-4 py-2 rounded-xl font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingVendor}
                  className="px-5 py-2 rounded-xl font-bold bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-all shadow-xs"
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
