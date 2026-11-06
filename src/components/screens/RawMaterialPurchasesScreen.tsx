import React, { useState, useEffect, useMemo } from 'react';
import {
  PackagePlus,
  Receipt,
  Boxes,
  FlaskConical,
  Plus,
  Trash2,
  Search,
  AlertTriangle,
  CheckCircle2,
  Coffee,
  Calendar,
  Building,
  CreditCard,
  FileText,
  Eye,
  RefreshCw,
  X,
  Layers,
  Sparkles,
  Info,
  Scale
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { RawMaterial, RawMaterialPurchase, ProductRecipe, Product, RawMaterialPurchaseItem } from '../../types';

interface SummaryStats {
  totalMaterials: number;
  outOfStockCount: number;
  lowStockCount: number;
  safeCount: number;
  totalRecipes: number;
  totalSpendThisMonth: number;
  purchasesThisMonthCount: number;
}

export const RawMaterialPurchasesScreen: React.FC = () => {
  const { user, token } = useAuth();
  const { showToast } = useToast();

  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';

  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as 'pembelian-baru' | 'riwayat-pembelian' | 'stok-bahan' | 'resep-minuman' | null;

  // Active Tab: 'pembelian-baru' | 'riwayat-pembelian' | 'stok-bahan' | 'resep-minuman'
  const [activeTab, setActiveTab] = useState<'pembelian-baru' | 'riwayat-pembelian' | 'stok-bahan' | 'resep-minuman'>(() => {
    if (urlTab && ['pembelian-baru', 'riwayat-pembelian', 'stok-bahan', 'resep-minuman'].includes(urlTab)) {
      return urlTab;
    }
    return 'pembelian-baru';
  });

  useEffect(() => {
    if (urlTab && ['pembelian-baru', 'riwayat-pembelian', 'stok-bahan', 'resep-minuman'].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  const handleTabChange = (newTab: 'pembelian-baru' | 'riwayat-pembelian' | 'stok-bahan' | 'resep-minuman') => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };

  // State
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [purchases, setPurchases] = useState<RawMaterialPurchase[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filters & Searches
  const [materialSearch, setMaterialSearch] = useState<string>('');
  const [materialCategoryFilter, setMaterialCategoryFilter] = useState<string>('all');
  const [purchaseSearch, setPurchaseSearch] = useState<string>('');
  const [recipeSearch, setRecipeSearch] = useState<string>('');

  // Selected Purchase for Detail Modal
  const [selectedPurchase, setSelectedPurchase] = useState<RawMaterialPurchase | null>(null);

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

  // Modal: Recipe Editor
  const [editingRecipeProduct, setEditingRecipeProduct] = useState<Product | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<Array<{ materialId: string; materialName: string; quantityNeeded: number; unit: string }>>([]);
  const [recipeInstructions, setRecipeInstructions] = useState<string>('');
  const [recipeAutoDeduct, setRecipeAutoDeduct] = useState<boolean>(true);

  // Form: New Purchase
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

  // Load All Data
  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [matRes, purRes, recRes, prodRes, sumRes] = await Promise.all([
        fetch('/api/raw-materials', { headers }),
        fetch('/api/raw-materials/purchases', { headers }),
        fetch('/api/raw-materials/recipes', { headers }),
        fetch('/api/products?refresh=true', { headers }),
        fetch('/api/raw-materials/summary', { headers })
      ]);

      const [matData, purData, recData, prodData, sumData] = await Promise.all([
        matRes.json(),
        purRes.json(),
        recRes.json(),
        prodRes.json(),
        sumRes.json()
      ]);

      if (matData.success) setMaterials(matData.materials || []);
      if (purData.success) setPurchases(purData.purchases || []);
      if (recData.success) setRecipes(recData.recipes || []);
      if (prodData.success) setProducts(prodData.products || []);
      if (sumData.success) setSummary(sumData.summary || null);
    } catch (err) {
      console.error('Error fetching raw materials data:', err);
      showToast('Gagal memuat data bahan baku', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Handle Unauthorized Screen
  if (!isManager && !isAdmin) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-20">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-950/60 rounded-3xl flex items-center justify-center mx-auto mb-4 text-red-600">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2">Akses Terbatas: Khusus Role MANAGER</h2>
        <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
          Halaman data pembelian bahan baku minuman dan sinkronisasi resep racikan hanya dapat diakses oleh akun Manager.
        </p>
      </div>
    );
  }

  // Helper for purchase item row changes
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
      showToast('Minimal 1 bahan baku harus diisi', 'warning');
      return;
    }
    const newItems = purchaseForm.items.filter((_, i) => i !== index);
    setPurchaseForm({ ...purchaseForm, items: newItems });
  };

  // Submit New Purchase
  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseForm.supplierName.trim()) {
      showToast('Nama supplier wajib diisi', 'warning');
      return;
    }

    // Validate items
    const validItems = purchaseForm.items.filter(it => it.materialId && it.quantity > 0);
    if (validItems.length === 0) {
      showToast('Pilih minimal 1 bahan baku yang valid dengan jumlah > 0', 'warning');
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
        await loadData();
        handleTabChange('riwayat-pembelian');
      } else {
        showToast(data.error || 'Gagal menyimpan faktur pembelian', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        await loadData();
      } else {
        showToast(data.error || 'Gagal menyimpan bahan baku', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Recipe Editor for a Drink Product
  const handleOpenRecipeModal = (prod: Product) => {
    setEditingRecipeProduct(prod);
    const existingRecipe = recipes.find(r => r.productId === prod.id || r.productName.toLowerCase() === prod.name.toLowerCase());
    if (existingRecipe) {
      setRecipeIngredients(existingRecipe.ingredients || []);
      setRecipeInstructions(existingRecipe.instructions || '');
      setRecipeAutoDeduct(existingRecipe.isAutoDeduct !== false);
    } else {
      setRecipeIngredients([]);
      setRecipeInstructions('');
      setRecipeAutoDeduct(true);
    }
  };

  const handleAddRecipeIngredient = () => {
    if (materials.length === 0) {
      showToast('Belum ada master bahan baku. Tambahkan bahan baku terlebih dahulu.', 'warning');
      return;
    }
    const firstMat = materials[0];
    setRecipeIngredients([
      ...recipeIngredients,
      {
        materialId: firstMat.id,
        materialName: firstMat.name,
        quantityNeeded: 10,
        unit: firstMat.unit
      }
    ]);
  };

  const handleSaveRecipe = async () => {
    if (!editingRecipeProduct) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/raw-materials/recipes/${editingRecipeProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: editingRecipeProduct.id,
          productName: editingRecipeProduct.name,
          category: editingRecipeProduct.category,
          ingredients: recipeIngredients,
          instructions: recipeInstructions,
          isAutoDeduct: recipeAutoDeduct
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Resep untuk '${editingRecipeProduct.name}' berhasil disimpan!`, 'success');
        setEditingRecipeProduct(null);
        await loadData();
      } else {
        showToast(data.error || 'Gagal menyimpan resep', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculations for purchase form total
  const purchaseTotal = useMemo(() => {
    return purchaseForm.items.reduce((acc, it) => acc + (it.subtotal || 0), 0);
  }, [purchaseForm.items]);

  // Filtered lists
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const matchSearch = m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
        (m.category && m.category.toLowerCase().includes(materialSearch.toLowerCase()));
      const matchCat = materialCategoryFilter === 'all' || m.category === materialCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [materials, materialSearch, materialCategoryFilter]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const matchSearch = p.supplierName.toLowerCase().includes(purchaseSearch.toLowerCase()) ||
        p.purchaseNumber.toLowerCase().includes(purchaseSearch.toLowerCase()) ||
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(purchaseSearch.toLowerCase()));
      return matchSearch;
    });
  }, [purchases, purchaseSearch]);

  const beverageProducts = useMemo(() => {
    return products.filter(p => {
      const cat = (p.category || '').toLowerCase();
      // Beverage categories or items that have drinks/recipes
      return cat === 'kopi' || cat === 'teh' || cat === 'jus' || p.hasRecipe;
    }).filter(p => p.name.toLowerCase().includes(recipeSearch.toLowerCase()));
  }, [products, recipeSearch]);

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-4xl mx-auto flex flex-col gap-5">
      {/* Tab Content */}

      {/* 4. Tab Content */}
      {/* TAB 1: FORM PEMBELIAN BARU */}
      {activeTab === 'pembelian-baru' && (
        <form onSubmit={handleSubmitPurchase} className="space-y-6">
          <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 p-5 sm:p-6 shadow-2xs space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-heading">
                  <PackagePlus className="w-5 h-5 text-accent" />
                  <span>Input Faktur / Nota Pembelian Bahan Baku</span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Setiap bahan baku yang disimpan di sini akan langsung menambah kuantiti stok bahan baku secara otomatis.
                </p>
              </div>
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
                className="px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950 text-accent hover:bg-orange-100 dark:hover:bg-orange-900 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Bahan Baku Baru</span>
              </button>
            </div>

            {/* Faktur Info Header */}
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
                    className="w-full pl-9 pr-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
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
                    className="w-full pl-9 pr-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
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
                    className="w-full pl-9 pr-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
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
                  className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="TRANSFER">Transfer Bank / Virtual Account</option>
                  <option value="CASH">Tunai / Kas Kecil</option>
                  <option value="TEMPO">Tempo / Kredit Supplier</option>
                </select>
              </div>
            </div>

            {/* Table of Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  Rincian Bahan Baku yang Dibeli ({purchaseForm.items.length})
                </label>
                <span className="text-[11px] text-stone-500">Satuan & harga akan memperbarui histori biaya</span>
              </div>

              <div className="overflow-x-auto border border-stone-200 dark:border-stone-700 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100 dark:bg-stone-850 text-stone-600 dark:text-stone-400 font-bold border-b border-stone-200 dark:border-stone-700">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3 min-w-[200px]">Pilih Bahan Baku</th>
                      <th className="p-3 w-28">Jumlah (Qty)</th>
                      <th className="p-3 w-24">Satuan</th>
                      <th className="p-3 w-36">Harga Satuan (Rp)</th>
                      <th className="p-3 w-36 text-right">Subtotal (Rp)</th>
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
                            className="w-full px-2.5 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-medium focus:ring-2 focus:ring-accent"
                          >
                            <option value="">-- Pilih Bahan Baku --</option>
                            {materials.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.category}) - Stok skrg: {m.stock} {m.unit}
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
                            className="w-full px-2.5 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold text-center focus:ring-2 focus:ring-accent"
                          />
                        </td>
                        <td className="p-3">
                          <span className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold text-[11px] uppercase">
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
                            className="w-full px-2.5 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-right font-medium focus:ring-2 focus:ring-accent"
                          />
                        </td>
                        <td className="p-3 text-right font-bold text-stone-900 dark:text-stone-100">
                          Rp {(item.subtotal || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            disabled={purchaseForm.items.length <= 1}
                            className="p-1 rounded-lg text-stone-400 hover:text-red-500 disabled:opacity-20 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-3">
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-accent" />
                  <span>Tambah Baris Bahan Baku</span>
                </button>

                <div className="text-right">
                  <span className="text-xs text-stone-500 mr-2">Total Faktur:</span>
                  <span className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100 font-heading">
                    Rp {purchaseTotal.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            {/* Catatan Tambahan */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                Catatan Pembelian (Opsional)
              </label>
              <textarea
                value={purchaseForm.notes}
                onChange={e => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                placeholder="Contoh: Pengiriman langsung oleh supir supplier, kondisi karung kopi tersegel baik."
                rows={2}
                className="w-full p-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* Action Bar */}
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
      )}

      {/* TAB 2: RIWAYAT PEMBELIAN */}
      {activeTab === 'riwayat-pembelian' && (
        <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading">
                Riwayat Faktur Pembelian Bahan Baku
              </h3>
              <p className="text-xs text-stone-500">
                Arsip lengkap pengeluaran dan mutasi masuk bahan baku minuman.
              </p>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={purchaseSearch}
                onChange={e => setPurchaseSearch(e.target.value)}
                placeholder="Cari Supplier, No. PO / Faktur..."
                className="w-full pl-9 pr-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {filteredPurchases.length === 0 ? (
            <div className="py-16 text-center text-stone-400">
              <Receipt className="w-12 h-12 mx-auto opacity-30 mb-2" />
              <p className="text-sm font-semibold">Belum ada riwayat pembelian ditemukan.</p>
              <button
                type="button"
                onClick={() => handleTabChange('pembelian-baru')}
                className="mt-3 px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Pembelian Sekarang</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-stone-200 dark:border-stone-700 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 dark:bg-stone-850 text-stone-600 dark:text-stone-400 font-bold border-b border-stone-200 dark:border-stone-700">
                  <tr>
                    <th className="p-3">No. Pembelian</th>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Supplier</th>
                    <th className="p-3">No. Faktur</th>
                    <th className="p-3">Jumlah Item</th>
                    <th className="p-3 text-right">Total Biaya (Rp)</th>
                    <th className="p-3">Metode Bayar</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filteredPurchases.map(p => (
                    <tr key={p.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-850/50 transition-colors">
                      <td className="p-3 font-bold text-accent">{p.purchaseNumber}</td>
                      <td className="p-3 text-stone-600 dark:text-stone-300">{p.purchaseDate}</td>
                      <td className="p-3 font-semibold text-stone-900 dark:text-stone-100">{p.supplierName}</td>
                      <td className="p-3 text-stone-500 font-mono text-[11px]">{p.invoiceNumber || '-'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 font-bold text-[10px]">
                          {p.items?.length || 0} macam bahan
                        </span>
                      </td>
                      <td className="p-3 text-right font-black text-stone-900 dark:text-stone-100">
                        Rp {(p.totalAmount || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedPurchase(p)}
                          className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
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
      )}

      {/* TAB 3: STOK BAHAN BAKU */}
      {activeTab === 'stok-bahan' && (
        <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading">
                Master Stok Bahan Baku Minuman
              </h3>
              <p className="text-xs text-stone-500">
                Data master bahan racikan minuman kafe, pantau stok aman, dan batas peringatan habis.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={materialSearch}
                  onChange={e => setMaterialSearch(e.target.value)}
                  placeholder="Cari nama bahan baku..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:ring-2 focus:ring-accent"
                />
              </div>

              <select
                value={materialCategoryFilter}
                onChange={e => setMaterialCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold"
              >
                <option value="all">Semua Kategori</option>
                <option value="KOPI">Kopi (Beans/Ground)</option>
                <option value="SUSU">Susu & Dairy</option>
                <option value="SIRUP_PEMANIS">Sirup & Gula</option>
                <option value="TEH_BUAH">Teh & Powder</option>
                <option value="KEMASAN">Kemasan & Cup</option>
              </select>

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
                className="px-3.5 py-1.5 rounded-xl bg-accent text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:opacity-90 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Bahan Baru</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-stone-200 dark:border-stone-700 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 dark:bg-stone-850 text-stone-600 dark:text-stone-400 font-bold border-b border-stone-200 dark:border-stone-700">
                <tr>
                  <th className="p-3">Nama Bahan Baku</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Stok Saat Ini</th>
                  <th className="p-3">Ambang Batas Minimum</th>
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
                    <tr key={m.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-850/50 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-stone-900 dark:text-stone-100">{m.name}</div>
                        {m.notes && <div className="text-[10px] text-stone-400 mt-0.5">{m.notes}</div>}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 font-bold text-[10px]">
                          {m.category}
                        </span>
                      </td>
                      <td className="p-3 font-black text-sm">
                        <span className={isDepleted ? 'text-red-600 font-bold' : isLow ? 'text-amber-600' : 'text-stone-900 dark:text-stone-100'}>
                          {m.stock.toLocaleString('id-ID')}
                        </span>
                        <span className="text-xs font-semibold text-stone-500 ml-1">{m.unit}</span>
                      </td>
                      <td className="p-3 text-stone-600 dark:text-stone-400">
                        {m.minimumStock} {m.unit}
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
                      <td className="p-3 text-stone-700 dark:text-stone-300 font-medium">
                        Rp {(m.avgCostPerUnit || 0).toLocaleString('id-ID')} / {m.unit}
                      </td>
                      <td className="p-3 text-center">
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
                          className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-[11px] font-bold cursor-pointer"
                        >
                          Ubah
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: RESEP RACIKAN MINUMAN & SINKRONISASI KASIR */}
      {activeTab === 'resep-minuman' && (
        <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-purple-500" />
                <span>Resep & Bill of Materials (BOM) Minuman</span>
              </h3>
              <p className="text-xs text-stone-500">
                Hubungkan setiap menu minuman ke bahan baku racikannya. Jika ada bahan yang habis, produk minuman otomatis berstatus <strong>Tidak Tersedia</strong> di kasir.
              </p>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={recipeSearch}
                onChange={e => setRecipeSearch(e.target.value)}
                placeholder="Cari nama menu minuman..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {beverageProducts.map(prod => {
              const recipe = recipes.find(r => r.productId === prod.id || r.productName.toLowerCase() === prod.name.toLowerCase());
              const isAvailable = prod.isAvailable;
              const maxServings = prod.maxServingsPossible ?? prod.stock;

              return (
                <div
                  key={prod.id}
                  className={`p-4 rounded-3xl border flex flex-col justify-between transition-all ${
                    !isAvailable
                      ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/60'
                      : 'bg-white dark:bg-stone-900 border-stone-200/80 dark:border-stone-800 shadow-2xs hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 dark:bg-stone-800 uppercase text-stone-600 dark:text-stone-300">
                        {prod.category}
                      </span>

                      {!isAvailable ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs animate-pulse">
                          Bahan Habis (Tidak Tersedia)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                          Tersedia (~{maxServings} porsi)
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-base text-stone-900 dark:text-stone-100 font-heading">
                      {prod.name}
                    </h4>
                    <div className="text-xs font-semibold text-accent mt-0.5">
                      Rp {prod.price.toLocaleString('id-ID')}
                    </div>

                    {/* Ingredients summary */}
                    <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800/80">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5 flex items-center justify-between">
                        <span>Bahan Baku Racikan:</span>
                        <span className="font-mono text-[10px] text-stone-400">
                          {recipe?.ingredients?.length || 0} bahan
                        </span>
                      </div>

                      {recipe && recipe.ingredients && recipe.ingredients.length > 0 ? (
                        <div className="space-y-1">
                          {recipe.ingredients.map((ing, iIdx) => {
                            const mat = materials.find(m => m.id === ing.materialId || m.name === ing.materialName);
                            const currentStock = mat ? mat.stock : 0;
                            const isEnough = currentStock >= ing.quantityNeeded;

                            return (
                              <div
                                key={iIdx}
                                className={`text-[11px] flex items-center justify-between px-2 py-1 rounded-lg ${
                                  !isEnough
                                    ? 'bg-red-100/70 dark:bg-red-950/50 text-red-700 dark:text-red-300 font-semibold'
                                    : 'bg-stone-50 dark:bg-stone-850 text-stone-700 dark:text-stone-300'
                                }`}
                              >
                                <span>{ing.materialName}</span>
                                <span className="font-bold">
                                  {ing.quantityNeeded} {ing.unit}{' '}
                                  <span className="font-normal text-[10px] opacity-75">
                                    (stok: {currentStock} {ing.unit})
                                  </span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-2 text-center text-stone-400 text-xs italic bg-stone-50 dark:bg-stone-850/50 rounded-xl">
                          Belum ada resep bahan baku tersambung.
                        </div>
                      )}

                      {/* Out of Stock Reason Banner */}
                      {!isAvailable && prod.rawMaterialReason && (
                        <div className="mt-2.5 p-2 rounded-xl bg-red-100/80 dark:bg-red-950/80 text-red-700 dark:text-red-300 text-[11px] font-medium flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                          <span>{prod.rawMaterialReason}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800">
                    <button
                      type="button"
                      onClick={() => handleOpenRecipeModal(prod)}
                      className="w-full py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FlaskConical className="w-3.5 h-3.5 text-accent" />
                      <span>{recipe ? 'Edit Resep Racikan' : '+ Atur Resep Racikan'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: DETAIL FAKTUR PEMBELIAN */}
      {selectedPurchase && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#251e1c] rounded-3xl max-w-2xl w-full border border-stone-200 dark:border-stone-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Rincian Faktur</span>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-heading">
                  {selectedPurchase.purchaseNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPurchase(null)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 hover:text-stone-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-stone-50 dark:bg-stone-850 p-3 rounded-2xl">
              <div>
                <span className="text-stone-400 block text-[10px] uppercase">Supplier</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{selectedPurchase.supplierName}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] uppercase">Tanggal Beli</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{selectedPurchase.purchaseDate}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] uppercase">No. Faktur Vendor</span>
                <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{selectedPurchase.invoiceNumber || '-'}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] uppercase">Metode Pembayaran</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{selectedPurchase.paymentMethod}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] uppercase">Dicatat Oleh</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{selectedPurchase.createdBy?.name || 'Manager'}</span>
              </div>
            </div>

            <div className="overflow-x-auto border border-stone-200 dark:border-stone-700 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 dark:bg-stone-850 font-bold text-stone-600 dark:text-stone-400">
                  <tr>
                    <th className="p-2.5">Bahan Baku</th>
                    <th className="p-2.5 text-center">Jumlah</th>
                    <th className="p-2.5 text-right">Harga Satuan</th>
                    <th className="p-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {selectedPurchase.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-bold text-stone-900 dark:text-stone-100">{it.materialName}</td>
                      <td className="p-2.5 text-center font-semibold">
                        {it.quantity} {it.unit}
                      </td>
                      <td className="p-2.5 text-right text-stone-600 dark:text-stone-300">
                        Rp {it.unitPrice.toLocaleString('id-ID')}
                      </td>
                      <td className="p-2.5 text-right font-black text-stone-900 dark:text-stone-100">
                        Rp {it.subtotal.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-stone-500">Total Nilai Pembelian:</span>
              <span className="text-lg font-black text-stone-900 dark:text-stone-100 font-heading">
                Rp {selectedPurchase.totalAmount.toLocaleString('id-ID')}
              </span>
            </div>

            {selectedPurchase.notes && (
              <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-850 text-xs text-stone-600 dark:text-stone-400">
                <strong>Catatan:</strong> {selectedPurchase.notes}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH / UBAH MASTER BAHAN BAKU */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#251e1c] rounded-3xl max-w-lg w-full border border-stone-200 dark:border-stone-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading">
                {editingMaterial ? 'Ubah Data Bahan Baku' : 'Tambah Bahan Baku Baru'}
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
                  placeholder="Contoh: Biji Kopi Arabika Aceh Gayo"
                  className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:ring-2 focus:ring-accent"
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
                    className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:ring-2 focus:ring-accent"
                  >
                    <option value="KOPI">Kopi (Beans/Ground)</option>
                    <option value="SUSU">Susu & Dairy</option>
                    <option value="SIRUP_PEMANIS">Sirup & Pemanis</option>
                    <option value="TEH_BUAH">Teh & Bubuk</option>
                    <option value="TOPPING">Topping & Boba</option>
                    <option value="KEMASAN">Kemasan & Cup</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                    Satuan Takaran
                  </label>
                  <select
                    value={materialForm.unit}
                    onChange={e => setMaterialForm({ ...materialForm, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:ring-2 focus:ring-accent"
                  >
                    <option value="gram">gram (gr)</option>
                    <option value="ml">mililiter (ml)</option>
                    <option value="pcs">pieces (pcs)</option>
                    <option value="shot">shot</option>
                    <option value="lembar">lembar</option>
                    <option value="pack">pack</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                    {editingMaterial ? 'Stok Saat Ini' : 'Stok Awal'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={materialForm.stock}
                    onChange={e => setMaterialForm({ ...materialForm, stock: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:ring-2 focus:ring-accent"
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
                    className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:ring-2 focus:ring-accent"
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
                  placeholder="Contoh: 250 (Rp 250/gram)"
                  className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:ring-2 focus:ring-accent"
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
                  className="w-full p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:ring-2 focus:ring-accent"
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

      {/* MODAL: RESEP EDITOR RACIKAN MINUMAN */}
      {editingRecipeProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#251e1c] rounded-3xl max-w-2xl w-full border border-stone-200 dark:border-stone-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Formula Racikan Barista</span>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-heading">
                  Resep: {editingRecipeProduct.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecipeProduct(null)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 hover:text-stone-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-400">
              Tentukan takaran bahan yang digunakan per 1 cup / porsi. Setiap produk ini terjual di kasir, stok bahan di bawah akan <strong>otomatis berkurang</strong>.
            </p>

            {/* List of Ingredients */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {recipeIngredients.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700">
                  <div className="flex-1">
                    <select
                      value={item.materialId}
                      onChange={e => {
                        const mat = materials.find(m => m.id === e.target.value);
                        if (!mat) return;
                        const newIngs = [...recipeIngredients];
                        newIngs[idx] = {
                          ...newIngs[idx],
                          materialId: mat.id,
                          materialName: mat.name,
                          unit: mat.unit
                        };
                        setRecipeIngredients(newIngs);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-semibold"
                    >
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.category}) - Stok: {m.stock} {m.unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-28 flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      value={item.quantityNeeded}
                      onChange={e => {
                        const newIngs = [...recipeIngredients];
                        newIngs[idx].quantityNeeded = parseFloat(e.target.value) || 0;
                        setRecipeIngredients(newIngs);
                      }}
                      className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-bold text-center"
                    />
                    <span className="text-[11px] font-bold text-stone-500 uppercase">{item.unit}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx));
                    }}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddRecipeIngredient}
              className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-850 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-accent" />
              <span>Tambah Bahan Racikan</span>
            </button>

            {/* Petunjuk Barista */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                Petunjuk Seduh / Barista (Opsional)
              </label>
              <textarea
                value={recipeInstructions}
                onChange={e => setRecipeInstructions(e.target.value)}
                placeholder="Contoh: Ekstraksi 18g espresso, tuang 150ml fresh milk, aduk rata."
                rows={2}
                className="w-full p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* Toggle Auto Deduct */}
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-stone-50 dark:bg-stone-850">
              <input
                type="checkbox"
                id="auto-deduct"
                checked={recipeAutoDeduct}
                onChange={e => setRecipeAutoDeduct(e.target.checked)}
                className="w-4 h-4 text-accent rounded"
              />
              <label htmlFor="auto-deduct" className="text-xs text-stone-700 dark:text-stone-300 font-semibold cursor-pointer">
                Kurangi stok bahan secara otomatis setiap kali menu ini dipesan di kasir
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setEditingRecipeProduct(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveRecipe}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold shadow-xs hover:opacity-90 cursor-pointer"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Formula Resep'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
