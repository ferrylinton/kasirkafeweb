import React, { useState, useEffect, useMemo } from 'react';
import {
  Building,
  Calendar,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { RawMaterial } from '../../types';

export const NewPurchaseScreen: React.FC = () => {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';

  // State
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modal: Add New Material on-the-fly
  const [showMaterialModal, setShowMaterialModal] = useState<boolean>(false);
  const [materialForm, setMaterialForm] = useState({
    name: '',
    category: 'KOPI',
    unit: 'gram',
    stock: 0,
    minimumStock: 200,
    avgCostPerUnit: 0,
    notes: ''
  });

  // Purchase Form State
  const [purchaseForm, setPurchaseForm] = useState({
    supplierName: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    invoiceNumber: '',
    paymentMethod: 'TRANSFER' as 'TRANSFER' | 'CASH' | 'TEMPO',
    notes: '',
    items: [
      { materialId: '', materialName: '', quantity: 1, unit: 'gram', unitPrice: 0, subtotal: 0 }
    ]
  });

  // Load Materials from backend
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
      }
    } catch (err) {
      console.error('Error fetching raw materials:', err);
      showToast('Gagal memuat master bahan baku', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, [token]);

  // Access check
  if (!isManager && !isAdmin) {
    return (
      <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-4xl mx-auto flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-950/60 rounded-3xl flex items-center justify-center mx-auto mb-4 text-red-600">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2">Akses Terbatas: Khusus Role MANAGER</h2>
        <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
          Halaman pencatatan faktur masuk bahan baku minuman hanya dapat diakses oleh akun Manager atau Admin.
        </p>
      </div>
    );
  }

  // Row item change handlers
  const handleItemMaterialChange = (index: number, materialId: string) => {
    const mat = materials.find(m => m.id === materialId);
    if (!mat) return;

    const newItems = [...purchaseForm.items];
    const qty = newItems[index].quantity || 1;
    const price = mat.avgCostPerUnit || newItems[index].unitPrice || 0;

    newItems[index] = {
      ...newItems[index],
      materialId: mat.id,
      materialName: mat.name,
      unit: mat.unit,
      unitPrice: price,
      subtotal: qty * price
    };
    setPurchaseForm({ ...purchaseForm, items: newItems });
  };

  const handleItemQtyChange = (index: number, qty: number) => {
    const validQty = Math.max(0, qty);
    const newItems = [...purchaseForm.items];
    const item = newItems[index];
    newItems[index] = {
      ...item,
      quantity: validQty,
      subtotal: validQty * (item.unitPrice || 0)
    };
    setPurchaseForm({ ...purchaseForm, items: newItems });
  };

  const handleItemPriceChange = (index: number, price: number) => {
    const validPrice = Math.max(0, price);
    const newItems = [...purchaseForm.items];
    const item = newItems[index];
    newItems[index] = {
      ...item,
      unitPrice: validPrice,
      subtotal: (item.quantity || 1) * validPrice
    };
    setPurchaseForm({ ...purchaseForm, items: newItems });
  };

  const handleAddItemRow = () => {
    setPurchaseForm({
      ...purchaseForm,
      items: [
        ...purchaseForm.items,
        { materialId: '', materialName: '', quantity: 1, unit: 'gram', unitPrice: 0, subtotal: 0 }
      ]
    });
  };

  const handleRemoveItemRow = (index: number) => {
    if (purchaseForm.items.length <= 1) {
      showToast('Minimal 1 bahan baku harus diisi dalam faktur', 'warning');
      return;
    }
    const newItems = purchaseForm.items.filter((_, i) => i !== index);
    setPurchaseForm({ ...purchaseForm, items: newItems });
  };

  // Calculate Total Invoice Cost
  const purchaseTotal = useMemo(() => {
    return purchaseForm.items.reduce((acc, it) => acc + (it.subtotal || 0), 0);
  }, [purchaseForm.items]);

  // Submit Purchase Form
  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseForm.supplierName.trim()) {
      showToast('Nama supplier / pemasok wajib diisi', 'warning');
      return;
    }

    const validItems = purchaseForm.items.filter(it => it.materialId && it.quantity > 0);
    if (validItems.length === 0) {
      showToast('Pilih minimal 1 bahan baku yang valid dengan jumlah kuantiti > 0', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/raw-materials/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          supplierName: purchaseForm.supplierName.trim(),
          purchaseDate: purchaseForm.purchaseDate,
          invoiceNumber: purchaseForm.invoiceNumber.trim() || undefined,
          paymentMethod: purchaseForm.paymentMethod,
          notes: purchaseForm.notes.trim() || undefined,
          items: validItems
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Faktur pembelian berhasil disimpan dan stok otomatis bertambah!', 'success');
        // Reset form
        setPurchaseForm({
          supplierName: '',
          purchaseDate: new Date().toISOString().slice(0, 10),
          invoiceNumber: '',
          paymentMethod: 'TRANSFER',
          notes: '',
          items: [{ materialId: '', materialName: '', quantity: 1, unit: 'gram', unitPrice: 0, subtotal: 0 }]
        });
        await loadMaterials();
        // Redirect to Purchase History
        navigate('/riwayat-pembelian');
      } else {
        showToast(data.error || 'Gagal menyimpan faktur pembelian', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem saat menyimpan pembelian', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save new material on-the-fly
  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialForm.name.trim()) {
      showToast('Nama bahan baku wajib diisi', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/raw-materials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(materialForm)
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Bahan baku baru berhasil ditambahkan!', 'success');
        setShowMaterialModal(false);
        setMaterialForm({
          name: '',
          category: 'KOPI',
          unit: 'gram',
          stock: 0,
          minimumStock: 200,
          avgCostPerUnit: 0,
          notes: ''
        });
        await loadMaterials();
      } else {
        showToast(data.error || 'Gagal menyimpan bahan baku', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-7xl mx-auto flex flex-col gap-6 p-4 sm:p-6">
      {/* Main Invoice Form */}
      <form onSubmit={handleSubmitPurchase} className="space-y-6">
        <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 p-5 sm:p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-heading">
                <FileText className="w-5 h-5 text-accent" />
                <span>Rincian Nota / Faktur Supplier</span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Pastikan nama supplier, tanggal, dan no. faktur sesuai dengan dokumen fisik pemasok.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
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
              className="px-3.5 py-2 rounded-xl bg-orange-50 dark:bg-orange-950 text-accent hover:bg-orange-100 dark:hover:bg-orange-900 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Master Bahan Baru</span>
            </button>
          </div>

          {/* Supplier Info Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                Nama Supplier / Pemasok *
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={purchaseForm.supplierName}
                  onChange={e => setPurchaseForm({ ...purchaseForm, supplierName: e.target.value })}
                  placeholder="Contoh: PT Sukses Kopi Nusantara"
                  className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                Tanggal Pembelian *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  required
                  value={purchaseForm.purchaseDate}
                  onChange={e => setPurchaseForm({ ...purchaseForm, purchaseDate: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                No. Faktur / Invoice Supplier
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={purchaseForm.invoiceNumber}
                  onChange={e => setPurchaseForm({ ...purchaseForm, invoiceNumber: e.target.value })}
                  placeholder="Contoh: INV-2026/XI/0091"
                  className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                Metode Pembayaran
              </label>
              <select
                value={purchaseForm.paymentMethod}
                onChange={e => setPurchaseForm({ ...purchaseForm, paymentMethod: e.target.value as any })}
                className="w-full px-3 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent font-medium"
              >
                <option value="TRANSFER">Transfer Bank / Virtual Account</option>
                <option value="CASH">Tunai / Kas Kecil Toko</option>
                <option value="TEMPO">Tempo / Hutang Dagang Supplier</option>
              </select>
            </div>
          </div>

          {/* Table of Purchase Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Rincian Bahan Baku Yang Dibeli ({purchaseForm.items.length} item)
              </label>
              <span className="text-[11px] text-stone-500">Kuantiti masuk akan memperbarui stok fisik dan rata-rata harga beli</span>
            </div>

            <div className="overflow-x-auto border border-stone-200 dark:border-stone-700 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 dark:bg-stone-850 text-stone-600 dark:text-stone-400 font-bold border-b border-stone-200 dark:border-stone-700">
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3 min-w-[220px]">Pilih Bahan Baku</th>
                    <th className="p-3 w-32">Jumlah (Qty)</th>
                    <th className="p-3 w-24">Satuan</th>
                    <th className="p-3 w-40">Harga Beli Satuan (Rp)</th>
                    <th className="p-3 w-40 text-right">Subtotal (Rp)</th>
                    <th className="p-3 w-12 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {purchaseForm.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/50 dark:hover:bg-stone-850/50 transition-colors">
                      <td className="p-3 text-center text-stone-400 font-bold">{idx + 1}</td>
                      <td className="p-3">
                        <select
                          required
                          value={item.materialId}
                          onChange={e => handleItemMaterialChange(idx, e.target.value)}
                          className="w-full px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-medium focus:ring-2 focus:ring-accent"
                        >
                          <option value="">-- Pilih Bahan Baku --</option>
                          {materials.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.category}) — Stok skrg: {m.stock} {m.unit}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          required
                          value={item.quantity || ''}
                          onChange={e => handleItemQtyChange(idx, parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold text-center focus:ring-2 focus:ring-accent"
                        />
                      </td>
                      <td className="p-3">
                        <span className="px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold text-[11px] uppercase block text-center">
                          {item.unit || '-'}
                        </span>
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          step="100"
                          required
                          value={item.unitPrice || ''}
                          onChange={e => handleItemPriceChange(idx, parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-right font-medium focus:ring-2 focus:ring-accent"
                        />
                      </td>
                      <td className="p-3 text-right font-black text-stone-900 dark:text-stone-100">
                        Rp {(item.subtotal || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          disabled={purchaseForm.items.length <= 1}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 disabled:opacity-20 transition-colors cursor-pointer"
                          title="Hapus baris item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
              <button
                type="button"
                onClick={handleAddItemRow}
                className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer w-fit"
              >
                <Plus className="w-4 h-4 text-accent" />
                <span>Tambah Baris Bahan Baku</span>
              </button>

              <div className="p-3 rounded-2xl bg-orange-50/80 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-800/40 flex items-center gap-3">
                <span className="text-xs font-bold text-stone-600 dark:text-stone-400">Total Faktur Pembelian:</span>
                <span className="text-lg sm:text-xl font-black text-accent font-heading">
                  Rp {purchaseTotal.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* Catatan Pembelian */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
              Catatan Faktur / Pengiriman (Opsional)
            </label>
            <textarea
              value={purchaseForm.notes}
              onChange={e => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
              placeholder="Contoh: Pengiriman langsung oleh kurir supplier, nomor resi ekspedisi, atau catatan kondisi kemasan."
              rows={2}
              className="w-full p-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Submit Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-stone-100 dark:border-stone-800">
            <button
              type="submit"
              disabled={isSubmitting || purchaseTotal <= 0}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-accent text-white font-bold text-sm shadow-md hover:opacity-95 active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan & Menambah Stok...' : 'Simpan & Tambah ke Stok Bahan Baku'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Modal: Add New Material On-The-Fly */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#251e1c] rounded-3xl max-w-lg w-full border border-stone-200 dark:border-stone-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading">
                Tambah Master Bahan Baku Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowMaterialModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 hover:text-stone-900 cursor-pointer"
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
                  placeholder="Contoh: Biji Kopi Arabika House Blend"
                  className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                    Kategori
                  </label>
                  <select
                    value={materialForm.category}
                    onChange={e => setMaterialForm({ ...materialForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-medium"
                  >
                    <option value="KOPI">Kopi (Beans/Ground)</option>
                    <option value="SUSU">Susu & Dairy</option>
                    <option value="SIRUP_PEMANIS">Sirup & Gula</option>
                    <option value="TEH_BUAH">Teh & Powder</option>
                    <option value="KEMASAN">Kemasan & Cup</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                    Satuan Takar / Unit
                  </label>
                  <select
                    value={materialForm.unit}
                    onChange={e => setMaterialForm({ ...materialForm, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-medium"
                  >
                    <option value="gram">Gram (g)</option>
                    <option value="ml">Mililiter (ml)</option>
                    <option value="pcs">Pieces (Pcs / Cup)</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="liter">Liter (L)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                    Batas Minimum Menipis
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={materialForm.minimumStock}
                    onChange={e => setMaterialForm({ ...materialForm, minimumStock: parseFloat(e.target.value) || 0 })}
                    placeholder="200"
                    className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                    Estimasi Biaya / Unit (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={materialForm.avgCostPerUnit || ''}
                    onChange={e => setMaterialForm({ ...materialForm, avgCostPerUnit: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                  Catatan Bahan
                </label>
                <textarea
                  value={materialForm.notes}
                  onChange={e => setMaterialForm({ ...materialForm, notes: e.target.value })}
                  placeholder="Keterangan spesifikasi bahan atau merk..."
                  rows={2}
                  className="w-full p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowMaterialModal(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 text-xs font-bold hover:bg-stone-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold shadow-xs hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Bahan Baku'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
