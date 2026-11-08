import React, { useState, useEffect, useMemo } from 'react';
import {
  FlaskConical,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Coffee,
  X,
  Boxes,
  PackagePlus,
  Receipt,
  Layers,
  Sparkles,
  Info,
  Scale,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { Product, ProductRecipe, RawMaterial } from '../../types';

export const DrinkRecipesScreen: React.FC = () => {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Search & Filters
  const [recipeSearch, setRecipeSearch] = useState<string>('');
  const [recipeFilter, setRecipeFilter] = useState<'all' | 'configured' | 'unconfigured' | 'available' | 'depleted'>('all');

  // Modal: Recipe Editor
  const [editingRecipeProduct, setEditingRecipeProduct] = useState<Product | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<
    Array<{ materialId: string; materialName: string; quantityNeeded: number; unit: string }>
  >([]);
  const [recipeInstructions, setRecipeInstructions] = useState<string>('');
  const [recipeAutoDeduct, setRecipeAutoDeduct] = useState<boolean>(true);

  // Load Data
  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [prodRes, recRes, matRes] = await Promise.all([
        fetch('/api/products?refresh=true', { headers }),
        fetch('/api/raw-materials/recipes', { headers }),
        fetch('/api/raw-materials', { headers })
      ]);

      const [prodData, recData, matData] = await Promise.all([
        prodRes.json(),
        recRes.json(),
        matRes.json()
      ]);

      if (prodData.success) setProducts(prodData.products || []);
      if (recData.success) setRecipes(recData.recipes || []);
      if (matData.success) setMaterials(matData.materials || []);
    } catch (err) {
      console.error('Error fetching recipes data:', err);
      showToast('Gagal memuat formula resep racikan minuman', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Open Recipe Modal
  const handleOpenRecipeModal = (prod: Product) => {
    setEditingRecipeProduct(prod);
    const existingRecipe = recipes.find(
      r => r.productId === prod.id || r.productName.toLowerCase() === prod.name.toLowerCase()
    );

    if (existingRecipe && existingRecipe.ingredients?.length > 0) {
      setRecipeIngredients(existingRecipe.ingredients || []);
      setRecipeInstructions(existingRecipe.instructions || '');
      setRecipeAutoDeduct(existingRecipe.isAutoDeduct !== false);
    } else {
      // If no ingredients, start with 1 row if materials are available
      if (materials.length > 0) {
        setRecipeIngredients([
          {
            materialId: materials[0].id,
            materialName: materials[0].name,
            quantityNeeded: 15,
            unit: materials[0].unit
          }
        ]);
      } else {
        setRecipeIngredients([]);
      }
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
        showToast(`Resep racikan untuk '${editingRecipeProduct.name}' berhasil disimpan!`, 'success');
        setEditingRecipeProduct(null);
        await loadData();
      } else {
        showToast(data.error || 'Gagal menyimpan resep', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem saat menyimpan resep', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Beverage products list
  const beverageProducts = useMemo(() => {
    return products.filter(p => {
      const cat = (p.category || '').toLowerCase();
      // Beverage categories, drinks, or items flagged with recipe
      return cat.includes('kopi') || cat.includes('teh') || cat.includes('jus') || cat.includes('drink') || cat.includes('minum') || p.hasRecipe;
    });
  }, [products]);

  // Metrics
  const recipeMetrics = useMemo(() => {
    let configuredCount = 0;
    let availableCount = 0;
    let depletedCount = 0;

    beverageProducts.forEach(p => {
      const rec = recipes.find(r => r.productId === p.id || r.productName.toLowerCase() === p.name.toLowerCase());
      if (rec && rec.ingredients?.length > 0) {
        configuredCount++;
      }
      if (p.isAvailable) {
        availableCount++;
      } else {
        depletedCount++;
      }
    });

    return {
      total: beverageProducts.length,
      configuredCount,
      availableCount,
      depletedCount
    };
  }, [beverageProducts, recipes]);

  // Filtered Beverage Products
  const filteredProducts = useMemo(() => {
    return beverageProducts.filter(p => {
      const matchSearch =
        p.name.toLowerCase().includes(recipeSearch.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(recipeSearch.toLowerCase()));

      const rec = recipes.find(r => r.productId === p.id || r.productName.toLowerCase() === p.name.toLowerCase());
      const hasConfiguredRecipe = !!(rec && rec.ingredients?.length > 0);

      let matchFilter = true;
      if (recipeFilter === 'configured') matchFilter = hasConfiguredRecipe;
      if (recipeFilter === 'unconfigured') matchFilter = !hasConfiguredRecipe;
      if (recipeFilter === 'available') matchFilter = p.isAvailable === true;
      if (recipeFilter === 'depleted') matchFilter = p.isAvailable === false;

      return matchSearch && matchFilter;
    });
  }, [beverageProducts, recipes, recipeSearch, recipeFilter]);

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
          Resep dan racikan Bill of Materials (BOM) minuman hanya dapat diakses oleh akun Manager atau Admin.
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
              <span className="text-accent font-bold">Resep Racikan Minuman</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading flex items-center gap-2.5">
              <FlaskConical className="w-6 h-6 text-purple-500" />
              <span>Resep & Bill of Materials (BOM) Minuman</span>
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1 max-w-2xl">
              Hubungkan setiap menu minuman ke bahan baku racikannya. Setiap menu terjual di kasir, stok bahan baku akan berkurang secara proporsional.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="px-3.5 py-2 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Segarkan data resep & stok"
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
              <span>Master Bahan Baku</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/pembelian-bahan')}
              className="px-3.5 py-2 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <PackagePlus className="w-3.5 h-3.5 text-stone-500" />
              <span>Kulakan / Pembelian Baru</span>
            </button>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-stone-100 dark:border-stone-800">
          <button
            type="button"
            onClick={() => setRecipeFilter('all')}
            className={`p-4 rounded-2xl text-left transition-all cursor-pointer border ${
              recipeFilter === 'all'
                ? 'bg-stone-100 dark:bg-stone-800 border-accent/60'
                : 'bg-stone-50 dark:bg-stone-900/60 border-stone-200/60 dark:border-stone-800/80 hover:border-stone-300'
            }`}
          >
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
              Menu Minuman
            </span>
            <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading">
              {recipeMetrics.total} <span className="text-xs font-normal text-stone-400">item</span>
            </div>
            <span className="text-[10px] text-stone-400 mt-0.5 block">Kategori kopi/teh/minuman</span>
          </button>

          <button
            type="button"
            onClick={() => setRecipeFilter('configured')}
            className={`p-4 rounded-2xl text-left transition-all cursor-pointer border ${
              recipeFilter === 'configured'
                ? 'bg-purple-100/60 dark:bg-purple-950/40 border-purple-500'
                : 'bg-purple-50/60 dark:bg-purple-950/20 border-purple-200/60 dark:border-purple-900/40 hover:border-purple-300'
            }`}
          >
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider block mb-1">
              Sudah Punya Resep
            </span>
            <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 font-heading">
              {recipeMetrics.configuredCount} <span className="text-xs font-normal text-purple-400">menu</span>
            </div>
            <span className="text-[10px] text-purple-600/80 dark:text-purple-400/80 mt-0.5 block">BOM racikan terhubung</span>
          </button>

          <button
            type="button"
            onClick={() => setRecipeFilter('available')}
            className={`p-4 rounded-2xl text-left transition-all cursor-pointer border ${
              recipeFilter === 'available'
                ? 'bg-emerald-100/60 dark:bg-emerald-950/40 border-emerald-500'
                : 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40 hover:border-emerald-300'
            }`}
          >
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">
              Siap Disajikan
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-heading">
              {recipeMetrics.availableCount} <span className="text-xs font-normal text-emerald-400">menu</span>
            </div>
            <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 block">Semua bahan tersedia</span>
          </button>

          <button
            type="button"
            onClick={() => setRecipeFilter('depleted')}
            className={`p-4 rounded-2xl text-left transition-all cursor-pointer border ${
              recipeFilter === 'depleted'
                ? 'bg-red-100/60 dark:bg-red-950/40 border-red-500'
                : 'bg-red-50/60 dark:bg-red-950/20 border-red-200/60 dark:border-red-900/40 hover:border-red-300'
            }`}
          >
            <span className="text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider block mb-1 flex items-center justify-between">
              <span>Bahan Habis</span>
              {recipeMetrics.depletedCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              )}
            </span>
            <div className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400 font-heading">
              {recipeMetrics.depletedCount} <span className="text-xs font-normal text-red-400">menu</span>
            </div>
            <span className="text-[10px] text-red-500/80 dark:text-red-400/80 mt-0.5 block">Otomatis nonaktif di kasir</span>
          </button>
        </div>
      </div>

      {/* Main Grid Card */}
      <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 p-5 sm:p-6 shadow-2xs space-y-4">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading">
              Daftar Menu & Formula Racikan ({filteredProducts.length})
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Pilih menu untuk mengatur takaran bahan racikan per porsi (misal 18g biji kopi + 150ml susu).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] sm:min-w-[260px]">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={recipeSearch}
                onChange={e => setRecipeSearch(e.target.value)}
                placeholder="Cari nama menu minuman..."
                className="w-full pl-9 pr-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <select
              value={recipeFilter}
              onChange={e => setRecipeFilter(e.target.value as any)}
              className="px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">Semua Menu</option>
              <option value="configured">Sudah Ada Resep</option>
              <option value="unconfigured">Belum Ada Resep</option>
              <option value="available">Tersedia Siap Jual</option>
              <option value="depleted">Bahan Habis (Nonaktif)</option>
            </select>
          </div>
        </div>

        {/* Beverage Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-stone-400">
            <Coffee className="w-12 h-12 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">
              Tidak ada menu minuman yang cocok.
            </p>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              Pastikan Anda sudah mendaftarkan produk berkategori Kopi, Teh, atau Minuman di menu Manajemen Produk.
            </p>
            <button
              type="button"
              onClick={() => navigate('/produk-manajemen')}
              className="mt-4 px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90"
            >
              <span>Kelola Produk Kafe</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map(prod => {
              const recipe = recipes.find(
                r => r.productId === prod.id || r.productName.toLowerCase() === prod.name.toLowerCase()
              );
              const hasIngredients = !!(recipe && recipe.ingredients && recipe.ingredients.length > 0);
              const isAvailable = prod.isAvailable;
              const maxServings = prod.maxServingsPossible ?? prod.stock;

              return (
                <div
                  key={prod.id}
                  className={`p-4 rounded-3xl border flex flex-col justify-between transition-all ${
                    !isAvailable
                      ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/60 shadow-2xs'
                      : 'bg-white dark:bg-stone-900 border-stone-200/80 dark:border-stone-800 shadow-2xs hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 dark:bg-stone-800 uppercase text-stone-600 dark:text-stone-300">
                        {prod.category || 'Minuman'}
                      </span>

                      {!isAvailable ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs animate-pulse">
                          Bahan Habis
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                          Tersedia (~{maxServings} porsi)
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 font-heading">
                      {prod.name}
                    </h3>
                    <div className="text-xs font-semibold text-accent mt-0.5">
                      Rp {prod.price.toLocaleString('id-ID')}
                    </div>

                    {/* Ingredients summary */}
                    <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800/80">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5 flex items-center justify-between">
                        <span>Komposisi Racikan:</span>
                        <span className="font-mono text-[10px] text-stone-400">
                          {recipe?.ingredients?.length || 0} bahan
                        </span>
                      </div>

                      {hasIngredients ? (
                        <div className="space-y-1.5">
                          {recipe!.ingredients.map((ing, i) => {
                            const mat = materials.find(m => m.id === ing.materialId);
                            const isMatLow = mat && mat.stock <= mat.minimumStock;
                            const isMatDepleted = !mat || mat.stock <= 0;

                            return (
                              <div
                                key={i}
                                className="flex items-center justify-between text-xs p-1.5 rounded-xl bg-stone-50 dark:bg-stone-800/50"
                              >
                                <span className="font-medium text-stone-800 dark:text-stone-200 truncate pr-2">
                                  {ing.materialName}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="font-bold text-stone-900 dark:text-stone-100 text-[11px]">
                                    {ing.quantityNeeded} {ing.unit}
                                  </span>
                                  {isMatDepleted ? (
                                    <span className="w-2 h-2 rounded-full bg-red-500" title="Bahan Habis" />
                                  ) : isMatLow ? (
                                    <span className="w-2 h-2 rounded-full bg-amber-500" title="Bahan Menipis" />
                                  ) : (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" title="Bahan Aman" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/50 text-stone-400 text-xs italic text-center">
                          Belum ada formula bahan racikan
                        </div>
                      )}

                      {recipe?.instructions && (
                        <div className="mt-2.5 p-2 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/30 text-[11px] text-purple-900 dark:text-purple-300">
                          <span className="font-bold block text-[10px] uppercase tracking-wider text-purple-700 dark:text-purple-400 mb-0.5">
                            Petunjuk Seduh Barista:
                          </span>
                          {recipe.instructions}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-stone-400">
                      {recipe?.isAutoDeduct !== false ? 'Otomatis potong stok' : 'Manual'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenRecipeModal(prod)}
                      className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FlaskConical className="w-3.5 h-3.5 text-accent" />
                      <span>{hasIngredients ? 'Ubah Resep' : 'Buat Resep'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: RESEP EDITOR RACIKAN MINUMAN */}
      {editingRecipeProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-[#251e1c] rounded-3xl max-w-2xl w-full border border-stone-200 dark:border-stone-800 p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
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
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-400">
              Tentukan takaran bahan yang digunakan per 1 cup / porsi. Setiap produk ini terjual di kasir, stok bahan baku di bawah akan <strong>otomatis berkurang</strong>.
            </p>

            {/* List of Ingredients */}
            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
              {recipeIngredients.length === 0 ? (
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center text-xs text-stone-400">
                  Belum ada bahan baku racikan. Klik tombol di bawah untuk menambah bahan.
                </div>
              ) : (
                recipeIngredients.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
                  >
                    <div className="flex-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                        Bahan Baku #{idx + 1}
                      </label>
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
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.category}) - Stok: {m.stock} {m.unit}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-32">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                        Takaran
                      </label>
                      <div className="flex items-center gap-1.5">
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
                          className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-bold text-center text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        <span className="text-[11px] font-bold text-stone-500 uppercase shrink-0">{item.unit}</span>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx));
                        }}
                        className="p-2 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer transition-colors"
                        title="Hapus baris bahan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={handleAddRecipeIngredient}
              className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-850 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
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
                placeholder="Contoh: Ekstraksi 18g espresso, steam 150ml fresh milk hingga suhu 65°C, tuang latte art."
                rows={2}
                className="w-full p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* Toggle Auto Deduct */}
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200/60 dark:border-stone-800">
              <input
                type="checkbox"
                id="auto-deduct"
                checked={recipeAutoDeduct}
                onChange={e => setRecipeAutoDeduct(e.target.checked)}
                className="w-4 h-4 text-accent rounded focus:ring-accent"
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
export default DrinkRecipesScreen;
