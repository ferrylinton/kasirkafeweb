import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Receipt,
  Layers,
  Sparkles,
  Info,
  Scale,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { Product, ProductRecipe, RawMaterial } from '../../types';

export const DrinkRecipesScreen: React.FC = () => {
  const { user, token } = useAuth();
  const { showToast } = useToast();

  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
