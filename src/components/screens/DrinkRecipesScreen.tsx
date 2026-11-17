import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Search,
  RefreshCw,
  FlaskConical,
  Edit2,
  Eye
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { Product, ProductRecipe, ProductRecipeItem, RawMaterial } from '../../types';

const BEVERAGE_CATEGORIES = new Set([
  'kopi',
  'teh',
  'jus',
  'minuman',
  'boba',
  'spesial',
  'non-kopi',
  'coklat',
  'matcha'
]);

export const DrinkRecipesScreen: React.FC = () => {
  const { user, token } = useAuth();
  const { showToast } = useToast();

  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';
  const isReadOnly = !isManager;

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal: Recipe Editor
  const [editingRecipeProduct, setEditingRecipeProduct] = useState<Product | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<ProductRecipeItem[]>([]);
  const [recipeInstructions, setRecipeInstructions] = useState<string>('');
  const [recipeAutoDeduct, setRecipeAutoDeduct] = useState<boolean>(true);

  // Load Data
  const loadData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
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

      if (!prodRes.ok || !prodData.success) {
        showToast(prodData.error || prodData.message || 'Gagal memuat daftar produk minuman', 'error');
      } else {
        setProducts(Array.isArray(prodData.products) ? prodData.products : []);
      }

      if (!recRes.ok || !recData.success) {
        showToast(recData.error || recData.message || 'Gagal memuat data resep minuman', 'error');
      } else {
        setRecipes(Array.isArray(recData.recipes) ? recData.recipes : []);
      }

      if (!matRes.ok || !matData.success) {
        showToast(matData.error || matData.message || 'Gagal memuat data master bahan baku', 'error');
      } else {
        setMaterials(Array.isArray(matData.materials) ? matData.materials : []);
      }
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

  // Helper: Find recipe for a product reliably by productId or normalized name
  const findRecipeForProduct = (prod: Product): ProductRecipe | undefined => {
    const normalizedName = (prod.name || '').trim().toLowerCase();
    return recipes.find(
      r => r.productId === prod.id || (r.productName || '').trim().toLowerCase() === normalizedName
    );
  };

  // Helper: Find material reliably by materialId or normalized name
  const findMaterial = (materialId?: string, materialName?: string): RawMaterial | undefined => {
    const normalizedName = (materialName || '').trim().toLowerCase();
    return materials.find(
      m => (materialId && m.id === materialId) || (normalizedName && m.name.trim().toLowerCase() === normalizedName)
    );
  };

  // Filtered beverage / recipe rows
  const filteredBeverages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return products
      .filter(prod => {
        const cat = (prod.category || '').trim().toLowerCase();
        const hasLinkedRecipe = Boolean(findRecipeForProduct(prod));
        return BEVERAGE_CATEGORIES.has(cat) || Boolean(prod.hasRecipe) || hasLinkedRecipe;
      })
      .filter(prod => {
        if (!query) return true;
        const recipe = findRecipeForProduct(prod);
        const matchProduct =
          prod.name.toLowerCase().includes(query) ||
          (prod.category || '').toLowerCase().includes(query);
        const matchIngredient = recipe?.ingredients?.some(ing =>
          ing.materialName.toLowerCase().includes(query)
        );
        return matchProduct || Boolean(matchIngredient);
      });
  }, [products, recipes, searchQuery]);

  // Open Recipe Modal
  const handleOpenRecipeModal = (prod: Product) => {
    setEditingRecipeProduct(prod);
    const existingRecipe = findRecipeForProduct(prod);

    if (existingRecipe && Array.isArray(existingRecipe.ingredients) && existingRecipe.ingredients.length > 0) {
      // Sync material references against live master materials so select bindings stay valid
      const syncedIngredients = existingRecipe.ingredients.map(ing => {
        const matchedMat = findMaterial(ing.materialId, ing.materialName);
        return {
          materialId: matchedMat ? matchedMat.id : ing.materialId,
          materialName: matchedMat ? matchedMat.name : ing.materialName,
          quantityNeeded: Number(ing.quantityNeeded) || 0,
          unit: matchedMat ? matchedMat.unit : ing.unit
        };
      });
      setRecipeIngredients(syncedIngredients);
      setRecipeInstructions(existingRecipe.instructions || '');
      setRecipeAutoDeduct(existingRecipe.isAutoDeduct !== false);
    } else {
      if (materials.length > 0 && !isReadOnly) {
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
    if (isReadOnly) return;
    if (materials.length === 0) {
      showToast('Belum ada master bahan baku. Tambahkan bahan baku terlebih dahulu.', 'warning');
      return;
    }
    const usedIds = new Set(recipeIngredients.map(i => i.materialId));
    const nextMat = materials.find(m => !usedIds.has(m.id)) || materials[0];
    setRecipeIngredients([
      ...recipeIngredients,
      {
        materialId: nextMat.id,
        materialName: nextMat.name,
        quantityNeeded: 10,
        unit: nextMat.unit
      }
    ]);
  };

  const handleSaveRecipe = async () => {
    if (!editingRecipeProduct) return;
    if (isReadOnly) {
      showToast('Hanya role MANAGER yang dapat mengubah formula resep minuman.', 'warning');
      return;
    }

    // Validate ingredient rows
    for (let i = 0; i < recipeIngredients.length; i++) {
      const ing = recipeIngredients[i];
      if (!ing.materialId || !ing.materialName) {
        showToast(`Pilih bahan baku yang valid pada baris #${i + 1}`, 'warning');
        return;
      }
      if (!ing.quantityNeeded || ing.quantityNeeded <= 0) {
        showToast(`Takaran bahan "${ing.materialName}" harus lebih dari 0`, 'warning');
        return;
      }
    }

    const materialIds = recipeIngredients.map(i => i.materialId);
    if (new Set(materialIds).size !== materialIds.length) {
      showToast('Terdapat bahan baku duplikat dalam satu resep. Gabungkan takarannya menjadi satu baris.', 'warning');
      return;
    }

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
          instructions: recipeInstructions.trim(),
          isAutoDeduct: recipeAutoDeduct
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Resep racikan untuk '${editingRecipeProduct.name}' berhasil disimpan!`, 'success');
        setEditingRecipeProduct(null);
        await loadData();
      } else {
        showToast(data.error || data.message || 'Gagal menyimpan resep', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem saat menyimpan resep', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

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
      {/* Main Recipes Table Card */}
      <div className="bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 p-5 sm:p-6 shadow-2xs space-y-4">
        {/* Search & Refresh Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading">
              Daftar Resep & Racikan Minuman ({filteredBeverages.length})
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Komposisi bahan baku per porsi, estimasi HPP bahan, dan sinkronisasi ketersediaan stok kasir.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] sm:min-w-[260px]">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari menu minuman atau bahan..."
                className="w-full pl-9 pr-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors cursor-pointer shrink-0"
              title="Refresh Data Resep"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Loading, Empty, or Table View */}
        {loading ? (
          <div className="py-16 text-center text-stone-400">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-accent mb-2" />
            <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              Memuat data resep minuman & stok bahan baku...
            </p>
          </div>
        ) : filteredBeverages.length === 0 ? (
          <div className="py-16 text-center text-stone-400">
            <FlaskConical className="w-12 h-12 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">
              {searchQuery
                ? 'Tidak ada menu minuman atau bahan yang cocok dengan pencarian.'
                : 'Belum ada produk minuman terdaftar.'}
            </p>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'Coba kata kunci lain atau bersihkan kolom pencarian.'
                : 'Tambahkan produk kategori minuman terlebih dahulu di menu Manajemen Produk.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-stone-200 dark:border-stone-700/80 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 dark:bg-stone-850 text-stone-600 dark:text-stone-400 font-bold border-b border-stone-200 dark:border-stone-700">
                <tr>
                  <th className="p-3">Menu Minuman</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Komposisi Bahan Baku (BOM)</th>
                  <th className="p-3 text-right">Estimasi HPP Bahan</th>
                  <th className="p-3">Ketersediaan & Auto-Deduct</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredBeverages.map(prod => {
                  const recipe = findRecipeForProduct(prod);
                  const ingredients = recipe?.ingredients || [];
                  const maxServings = prod.maxServingsPossible ?? prod.stock;
                  const estimatedCost = ingredients.reduce((sum, ing) => {
                    const mat = findMaterial(ing.materialId, ing.materialName);
                    return sum + (Number(ing.quantityNeeded) || 0) * (mat?.avgCostPerUnit || 0);
                  }, 0);

                  return (
                    <tr key={prod.id} className="hover:bg-stone-50/60 dark:hover:bg-stone-850/60 transition-colors align-top">
                      <td className="p-3">
                        <div className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
                          {prod.name}
                        </div>
                        <div className="text-[11px] font-semibold text-accent mt-0.5">
                          Harga Jual: Rp {(prod.price || 0).toLocaleString('id-ID')}
                        </div>
                        {recipe?.instructions && (
                          <div className="text-[10px] text-stone-400 mt-1 max-w-xs line-clamp-2">
                            {recipe.instructions}
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 font-bold text-[10px] uppercase text-stone-700 dark:text-stone-300">
                          {prod.category}
                        </span>
                      </td>

                      <td className="p-3 min-w-[260px]">
                        {ingredients.length > 0 ? (
                          <div className="space-y-1">
                            {ingredients.map((ing, iIdx) => {
                              const mat = findMaterial(ing.materialId, ing.materialName);
                              const currentStock = mat ? mat.stock : 0;
                              const isEnough = mat ? currentStock >= ing.quantityNeeded : false;

                              return (
                                <div
                                  key={`${ing.materialId}-${iIdx}`}
                                  className={`text-[11px] flex items-center justify-between gap-3 px-2 py-1 rounded-lg ${
                                    !isEnough
                                      ? 'bg-red-100/70 dark:bg-red-950/50 text-red-700 dark:text-red-300 font-semibold'
                                      : 'bg-stone-50 dark:bg-stone-850 text-stone-700 dark:text-stone-300'
                                  }`}
                                >
                                  <span className="truncate">{mat ? mat.name : ing.materialName}</span>
                                  <span className="font-bold whitespace-nowrap">
                                    {ing.quantityNeeded} {mat ? mat.unit : ing.unit}{' '}
                                    <span className="font-normal text-[10px] opacity-75">
                                      (stok: {currentStock.toLocaleString('id-ID')})
                                    </span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[11px] italic text-stone-400">
                            Belum ada resep bahan baku tersambung
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        {ingredients.length > 0 ? (
                          <div>
                            <div className="font-bold text-stone-900 dark:text-stone-100">
                              Rp {Math.round(estimatedCost).toLocaleString('id-ID')}
                            </div>
                            <div className="text-[10px] text-stone-400">
                              {ingredients.length} bahan / porsi
                            </div>
                          </div>
                        ) : (
                          <span className="text-stone-400">-</span>
                        )}
                      </td>

                      <td className="p-3 space-y-1.5">
                        {!prod.isAvailable ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/80 text-red-600 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Tidak Tersedia</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Tersedia (~{maxServings} porsi)</span>
                          </span>
                        )}

                        {recipe && (
                          <div className="text-[10px] text-stone-500 dark:text-stone-400">
                            Potong Stok:{' '}
                            <strong className={recipe.isAutoDeduct !== false ? 'text-accent' : 'text-stone-500'}>
                              {recipe.isAutoDeduct !== false ? 'Otomatis' : 'Manual'}
                            </strong>
                          </div>
                        )}

                        {!prod.isAvailable && prod.rawMaterialReason && (
                          <div className="text-[10px] text-red-600 dark:text-red-400 max-w-[200px]">
                            {prod.rawMaterialReason}
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenRecipeModal(prod)}
                          className="px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                        >
                          {isReadOnly ? (
                            <>
                              <Eye className="w-3 h-3" />
                              <span>Lihat Resep</span>
                            </>
                          ) : (
                            <>
                              <Edit2 className="w-3 h-3 text-accent" />
                              <span>{recipe ? 'Edit Resep' : 'Atur Resep'}</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                  Belum ada bahan baku racikan. {!isReadOnly && 'Klik tombol di bawah untuk menambah bahan.'}
                </div>
              ) : (
                recipeIngredients.map((item, idx) => {
                  const hasMatchedMat = materials.some(m => m.id === item.materialId);
                  return (
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
                          disabled={isReadOnly}
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
                          className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                        >
                          {!hasMatchedMat && item.materialId && (
                            <option value={item.materialId}>
                              {item.materialName} (Master bahan tidak ditemukan)
                            </option>
                          )}
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
                            disabled={isReadOnly}
                            value={item.quantityNeeded}
                            onChange={e => {
                              const newIngs = [...recipeIngredients];
                              newIngs[idx] = {
                                ...newIngs[idx],
                                quantityNeeded: parseFloat(e.target.value) || 0
                              };
                              setRecipeIngredients(newIngs);
                            }}
                            className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-bold text-center text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                          />
                          <span className="text-[11px] font-bold text-stone-500 uppercase shrink-0">{item.unit}</span>
                        </div>
                      </div>

                      {!isReadOnly && (
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
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {!isReadOnly && (
              <button
                type="button"
                onClick={handleAddRecipeIngredient}
                className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-850 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-accent" />
                <span>Tambah Bahan Racikan</span>
              </button>
            )}

            {/* Petunjuk Barista */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                Petunjuk Seduh / Barista (Opsional)
              </label>
              <textarea
                value={recipeInstructions}
                disabled={isReadOnly}
                onChange={e => setRecipeInstructions(e.target.value)}
                placeholder="Contoh: Ekstraksi 18g espresso, steam 150ml fresh milk hingga suhu 65°C, tuang latte art."
                rows={2}
                className="w-full p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
              />
            </div>

            {/* Toggle Auto Deduct */}
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200/60 dark:border-stone-800">
              <input
                type="checkbox"
                id="auto-deduct"
                disabled={isReadOnly}
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
                {isReadOnly ? 'Tutup' : 'Batal'}
              </button>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleSaveRecipe}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold shadow-xs hover:opacity-90 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Formula Resep'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default DrinkRecipesScreen;
