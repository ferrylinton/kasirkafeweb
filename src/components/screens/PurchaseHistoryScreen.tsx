import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Search,
  RefreshCw,
  Plus,
  Eye,
  Calendar,
  Building,
  CreditCard,
  FileText,
  X,
  AlertTriangle,
  ArrowRight,
  Boxes,
  PackagePlus,
  Coins,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { RawMaterialPurchase } from '../../types';

export const PurchaseHistoryScreen: React.FC = () => {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';

  // State
  const [purchases, setPurchases] = useState<RawMaterialPurchase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [purchaseSearch, setPurchaseSearch] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [selectedPurchase, setSelectedPurchase] = useState<RawMaterialPurchase | null>(null);

  // Load purchase history from backend
  const loadPurchases = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/raw-materials/purchases', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPurchases(data.purchases || []);
      } else {
        showToast(data.error || 'Gagal memuat riwayat pembelian', 'error');
      }
    } catch (err) {
      console.error('Error fetching purchases:', err);
      showToast('Gagal memuat data riwayat pembelian bahan baku', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, [token]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalTransactions = purchases.length;
    const totalExpenditure = purchases.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
    const avgPO = totalTransactions > 0 ? Math.round(totalExpenditure / totalTransactions) : 0;
    
    // Total items across all purchases
    const totalItemsPurchased = purchases.reduce((acc, p) => acc + (p.items?.length || 0), 0);

    return { totalTransactions, totalExpenditure, avgPO, totalItemsPurchased };
  }, [purchases]);

  // Filtered Purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const query = purchaseSearch.toLowerCase();
      const matchSearch =
        p.supplierName.toLowerCase().includes(query) ||
        p.purchaseNumber.toLowerCase().includes(query) ||
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(query)) ||
        (p.notes && p.notes.toLowerCase().includes(query));

      const matchPayment = paymentFilter === 'all' || p.paymentMethod === paymentFilter;

      return matchSearch && matchPayment;
    });
  }, [purchases, purchaseSearch, paymentFilter]);

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
          Riwayat faktur pembelian bahan baku kafe hanya dapat diakses oleh akun Manager atau Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-7xl mx-auto flex flex-col gap-6 p-4 sm:p-6">
      {/* Top Header & Navigation Actions */}
      <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 mb-1">
              <span>Bahan Baku</span>
              <span>/</span>
              <span className="text-accent font-bold">Riwayat Pembelian</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading flex items-center gap-2.5">
              <Receipt className="w-6 h-6 text-accent" />
              <span>Riwayat Faktur Pembelian Bahan Baku</span>
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1 max-w-2xl">
              Arsip lengkap nota belanja, pengeluaran kulakan, dan mutasi masuk bahan racikan minuman kafe.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadPurchases}
              disabled={loading}
              className="px-3.5 py-2 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Segarkan data faktur"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/bahan-baku')}
              className="px-3.5 py-2 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Boxes className="w-3.5 h-3.5 text-stone-500" />
              <span>Master Stok Bahan</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/pembelian-bahan')}
              className="px-4 py-2 rounded-2xl bg-accent text-white hover:opacity-95 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span>Faktur Pembelian Baru</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-stone-100 dark:border-stone-800">
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/60 dark:border-stone-800/80">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
              Total Transaksi
            </span>
            <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading">
              {summaryMetrics.totalTransactions} <span className="text-xs font-normal text-stone-400">faktur</span>
            </div>
            <span className="text-[10px] text-stone-400 mt-0.5 block">Tercatat di sistem</span>
          </div>

          <div className="p-4 rounded-2xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40">
            <span className="text-[11px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider block mb-1">
              Total Pengeluaran
            </span>
            <div className="text-xl sm:text-2xl font-black text-accent font-heading truncate">
              Rp {summaryMetrics.totalExpenditure.toLocaleString('id-ID')}
            </div>
            <span className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 block">Belanja bahan baku</span>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/60 dark:border-stone-800/80">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
              Rata-rata PO
            </span>
            <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading truncate">
              Rp {summaryMetrics.avgPO.toLocaleString('id-ID')}
            </div>
            <span className="text-[10px] text-stone-400 mt-0.5 block">Per nota pembelian</span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">
              Item Masuk
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-heading">
              {summaryMetrics.totalItemsPurchased} <span className="text-xs font-normal text-stone-400">line items</span>
            </div>
            <span className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 block">Otomatis masuk stok</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 p-5 sm:p-6 shadow-2xs space-y-4">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading">
              Daftar Faktur Pembelian ({filteredPurchases.length})
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Klik &quot;Rincian&quot; pada baris untuk melihat item bahan baku dan biaya satuan nota.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] sm:min-w-[260px]">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={purchaseSearch}
                onChange={e => setPurchaseSearch(e.target.value)}
                placeholder="Cari Supplier, No. PO / Faktur..."
                className="w-full pl-9 pr-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
              className="px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-300 font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">Semua Metode Bayar</option>
              <option value="TRANSFER">Transfer Bank</option>
              <option value="CASH">Tunai (Cash)</option>
              <option value="TEMPO">Tempo / Hutang Dagang</option>
            </select>
          </div>
        </div>

        {/* Content Table or Empty State */}
        {filteredPurchases.length === 0 ? (
          <div className="py-16 text-center text-stone-400">
            <Receipt className="w-12 h-12 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">
              {purchaseSearch ? 'Tidak ada faktur pembelian yang cocok dengan kata kunci.' : 'Belum ada riwayat faktur pembelian.'}
            </p>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              {purchaseSearch ? 'Coba periksa kembali ejaan supplier atau nomor faktur.' : 'Catat nota belanja pertama Anda untuk menambah stok bahan baku secara otomatis.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/pembelian-bahan')}
              className="mt-4 px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Pembelian Sekarang</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-stone-200 dark:border-stone-700/80 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 dark:bg-stone-850 text-stone-600 dark:text-stone-400 font-bold border-b border-stone-200 dark:border-stone-700">
                <tr>
                  <th className="p-3">No. Pembelian</th>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Supplier / Pemasok</th>
                  <th className="p-3">No. Faktur Vendor</th>
                  <th className="p-3">Jumlah Item</th>
                  <th className="p-3 text-right">Total Biaya (Rp)</th>
                  <th className="p-3">Metode Bayar</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredPurchases.map(p => (
                  <tr key={p.id} className="hover:bg-stone-50/60 dark:hover:bg-stone-850/60 transition-colors">
                    <td className="p-3 font-bold text-accent">{p.purchaseNumber}</td>
                    <td className="p-3 text-stone-600 dark:text-stone-300 whitespace-nowrap">{p.purchaseDate}</td>
                    <td className="p-3 font-semibold text-stone-900 dark:text-stone-100">{p.supplierName}</td>
                    <td className="p-3 text-stone-500 font-mono text-[11px]">{p.invoiceNumber || '-'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 font-bold text-[10px] text-stone-700 dark:text-stone-300">
                        {p.items?.length || 0} macam bahan
                      </span>
                    </td>
                    <td className="p-3 text-right font-black text-stone-900 dark:text-stone-100 whitespace-nowrap">
                      Rp {(p.totalAmount || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.paymentMethod === 'TRANSFER'
                          ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400'
                          : p.paymentMethod === 'CASH'
                          ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400'
                      }`}>
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedPurchase(p)}
                        className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Rincian</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: DETAIL FAKTUR PEMBELIAN */}
      {selectedPurchase && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-[#251e1c] rounded-3xl max-w-2xl w-full border border-stone-200 dark:border-stone-800 p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Rincian Faktur Bahan Baku</span>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-heading">
                  {selectedPurchase.purchaseNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPurchase(null)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info Supplier & PO */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200/60 dark:border-stone-800 text-xs">
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Supplier</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{selectedPurchase.supplierName}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Tanggal Beli</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{selectedPurchase.purchaseDate}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">No. Faktur Vendor</span>
                <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{selectedPurchase.invoiceNumber || '-'}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Metode Pembayaran</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{selectedPurchase.paymentMethod}</span>
              </div>
              <div className="col-span-2">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Dicatat Oleh</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{selectedPurchase.createdBy?.name || 'Manager KasirKafe'}</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto border border-stone-200 dark:border-stone-700 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 dark:bg-stone-850 text-stone-600 dark:text-stone-400 font-bold border-b border-stone-200 dark:border-stone-700">
                  <tr>
                    <th className="p-2.5">Bahan Baku</th>
                    <th className="p-2.5 text-right">Kuantitas</th>
                    <th className="p-2.5 text-right">Harga Satuan (Rp)</th>
                    <th className="p-2.5 text-right">Subtotal (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {selectedPurchase.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-bold text-stone-900 dark:text-stone-100">{it.materialName}</td>
                      <td className="p-2.5 text-right font-medium text-stone-700 dark:text-stone-300">
                        {it.quantity} {it.unit}
                      </td>
                      <td className="p-2.5 text-right text-stone-700 dark:text-stone-300">
                        Rp {(it.unitPrice || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="p-2.5 text-right font-bold text-stone-900 dark:text-stone-100">
                        Rp {(it.subtotal || 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-orange-50/60 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40">
              <span className="text-xs font-bold text-orange-950 dark:text-orange-200">TOTAL BELANJA NOTA</span>
              <span className="text-lg font-black text-accent font-heading">
                Rp {selectedPurchase.totalAmount.toLocaleString('id-ID')}
              </span>
            </div>

            {selectedPurchase.notes && (
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850 text-xs text-stone-600 dark:text-stone-400 border border-stone-200/60 dark:border-stone-800">
                <strong className="text-stone-900 dark:text-stone-100">Catatan:</strong> {selectedPurchase.notes}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedPurchase(null)}
                className="px-5 py-2 rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold text-xs hover:bg-stone-300 dark:hover:bg-stone-700 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PurchaseHistoryScreen;
