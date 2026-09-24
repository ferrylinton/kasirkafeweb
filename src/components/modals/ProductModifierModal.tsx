import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Minus, Check, Coffee, CupSoda, GlassWater, Cookie, Info, Sparkles } from 'lucide-react';
import { Product, CartItemModifier, Category, CategoryVariation, VariationOption } from '../../types';
import { useCart } from '../../contexts/CartContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { ProductImage } from '../common/ProductImage';
import { getCachedCategories } from '../../utils/productCache';

export interface ProductModifierModalProps {
  product: Product | null;
  categories?: Category[];
  onClose: () => void;
}

export const ProductModifierModal: React.FC<ProductModifierModalProps> = ({
  product,
  categories: propCategories,
  onClose
}) => {
  const { addItem } = useCart();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  const [categoriesList, setCategoriesList] = useState<Category[]>(() => {
    if (propCategories && propCategories.length > 0) return propCategories;
    const cached = getCachedCategories();
    return cached?.categories || [];
  });

  // If categories weren't passed or cached, fetch them
  useEffect(() => {
    if (propCategories && propCategories.length > 0) {
      setCategoriesList(propCategories);
    } else if (categoriesList.length === 0) {
      fetch('/api/products/categories')
        .then(r => r.json())
        .then(data => {
          if (data.success && Array.isArray(data.categories)) {
            setCategoriesList(data.categories);
          }
        })
        .catch(() => {});
    }
  }, [propCategories]);

  // Find matching category from database
  const matchingCategory = useMemo(() => {
    if (!product) return null;
    const pCat = (product.category || '').toLowerCase().trim();
    return categoriesList.find(
      c => c.code.toLowerCase().trim() === pCat || c.name.toLowerCase().trim() === pCat
    );
  }, [product, categoriesList]);

  // Determine if category has variations in DB
  const categoryVariations: CategoryVariation[] = useMemo(() => {
    if (!product) return [];
    if (matchingCategory && Array.isArray(matchingCategory.variations)) {
      return matchingCategory.variations;
    }

    // Fallback if category not found in DB list yet:
    const pCat = (product.category || '').toLowerCase().trim();
    const isKopi = pCat === 'kopi' || pCat.includes('kopi') || pCat.includes('coffee');
    const isTeh = pCat === 'teh' || pCat.includes('teh') || pCat.includes('tea');
    const isJus = pCat === 'jus' || pCat.includes('jus') || pCat.includes('juice');
    const isCemilan = pCat === 'cemilan' || pCat.includes('cemilan') || pCat.includes('snack') || pCat.includes('pastry');

    if (isCemilan) {
      return []; // Cemilan tidak ada variasi
    }

    const standardSize: CategoryVariation = {
      id: 'var_ukuran',
      name: 'Ukuran Cup',
      type: 'SINGLE_SELECT',
      required: true,
      options: [
        { id: 'opt_reg', name: 'Regular 12oz', extraPrice: 0, isDefault: true },
        { id: 'opt_large', name: 'Large 16oz', extraPrice: 5000 },
        { id: 'opt_jumbo', name: 'Jumbo 22oz', extraPrice: 9000 }
      ]
    };

    const standardIce: CategoryVariation = {
      id: 'var_es',
      name: 'Level Es',
      type: 'SINGLE_SELECT',
      required: false,
      options: [
        { id: 'opt_norm_ice', name: 'Normal Ice', extraPrice: 0, isDefault: true },
        { id: 'opt_less_ice', name: 'Less Ice', extraPrice: 0 },
        { id: 'opt_no_ice', name: 'No Ice', extraPrice: 0 }
      ]
    };

    const standardSugar: CategoryVariation = {
      id: 'var_gula',
      name: 'Tingkat Gula',
      type: 'SINGLE_SELECT',
      required: false,
      options: [
        { id: 'opt_norm_sug', name: '100% Normal', extraPrice: 0, isDefault: true },
        { id: 'opt_less_sug', name: '50% Less Sugar', extraPrice: 0 },
        { id: 'opt_no_sug', name: '0% No Sugar', extraPrice: 0 }
      ]
    };

    const standardShot: CategoryVariation = {
      id: 'var_shot',
      name: 'Espresso Shot',
      type: 'SINGLE_SELECT',
      required: false,
      options: [
        { id: 'opt_norm_shot', name: 'Normal (1 Shot)', extraPrice: 0, isDefault: true },
        { id: 'opt_extra1_shot', name: '+1 Extra Shot', extraPrice: 5000 },
        { id: 'opt_extra2_shot', name: '+2 Extra Shot', extraPrice: 10000 }
      ]
    };

    if (isKopi) return [standardSize, standardIce, standardSugar, standardShot];
    if (isTeh || isJus) return [standardSize, standardIce, standardSugar];
    return [];
  }, [product, matchingCategory]);

  // State: Selected option per variation id (mapping varId -> selected option)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, VariationOption>>({});
  const [notes, setNotes] = useState<string>('');

  // Pastikan saat ProductModifierModal jumlah produk dimulai dari satu
  const [quantity, setQuantity] = useState<number>(1);

  // Reset state when product changes
  useEffect(() => {
    if (product) {
      setQuantity(1);
      setNotes('');

      // Initialize default selections for variations
      const initialSelections: Record<string, VariationOption> = {};
      categoryVariations.forEach(v => {
        if (v.options && v.options.length > 0) {
          const defaultOpt = v.options.find(o => o.isDefault) || v.options[0];
          initialSelections[v.id] = defaultOpt;
        }
      });
      setSelectedOptions(initialSelections);
    }
  }, [product?.id, categoryVariations]);

  if (!product) return null;

  const categoryLower = (product.category || '').toLowerCase().trim();
  const isCemilan =
    categoryLower === 'cemilan' ||
    categoryLower.includes('cemilan') ||
    categoryLower.includes('snack') ||
    categoryLower.includes('pastry');

  const hasVariations = categoryVariations.length > 0;

  // Calculate extra price from selected variation options
  const totalVariationsExtra = Object.values(selectedOptions).reduce(
    (sum, opt) => sum + (Number(opt?.extraPrice) || 0),
    0
  );

  const unitPrice = product.price + totalVariationsExtra;
  const totalPrice = unitPrice * quantity;

  const handleSelectOption = (variationId: string, option: VariationOption) => {
    setSelectedOptions(prev => ({
      ...prev,
      [variationId]: option
    }));
  };

  const handleQuickNote = (noteText: string) => {
    if (notes.includes(noteText)) {
      setNotes(notes.replace(noteText, '').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim());
    } else {
      setNotes(prev => (prev.trim() ? `${prev.trim()}, ${noteText}` : noteText));
    }
  };

  const handleAdd = () => {
    let modifier: CartItemModifier | undefined = undefined;

    if (!hasVariations) {
      // Cemilan / Kategori tanpa variasi
      if (notes.trim()) {
        modifier = { notes: notes.trim() };
      }
    } else {
      // Extract standard fields if present in variations for compatibility
      let sizeVal: any = undefined;
      let sizeExtraVal = 0;
      let iceVal: any = undefined;
      let sugarVal: any = undefined;
      let shotVal: any = undefined;
      let shotExtraVal = 0;

      Object.entries(selectedOptions).forEach(([varId, opt]) => {
        const v = categoryVariations.find(item => item.id === varId);
        const vName = (v?.name || '').toLowerCase();
        if (vName.includes('ukuran') || vName.includes('size')) {
          sizeVal = opt.name;
          sizeExtraVal = opt.extraPrice;
        } else if (vName.includes('es') || vName.includes('ice')) {
          iceVal = opt.name;
        } else if (vName.includes('gula') || vName.includes('sugar')) {
          sugarVal = opt.name;
        } else if (vName.includes('shot')) {
          shotVal = opt.name;
          shotExtraVal = opt.extraPrice;
        }
      });

      modifier = {
        size: sizeVal,
        sizeExtra: sizeExtraVal,
        ice: iceVal,
        sugar: sugarVal,
        shot: shotVal,
        shotExtra: shotExtraVal,
        notes: notes.trim()
      };
    }

    addItem(product, modifier, quantity);
    showToast(`${product.name} (${quantity}x) ${t('itemAddedSuccess')}`, 'success');
    onClose();
  };

  const getCategoryIcon = () => {
    if (matchingCategory?.icon) {
      return <span className="text-sm">{matchingCategory.icon}</span>;
    }
    if (categoryLower.includes('kopi')) return <Coffee className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />;
    if (categoryLower.includes('teh')) return <CupSoda className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
    if (categoryLower.includes('jus')) return <GlassWater className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />;
    return <Cookie className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
  };

  const categoryDisplayName = matchingCategory?.name || product.category;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)'
        }}
        onClick={e => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-[#251e1c] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 overflow-hidden"
        >
          {/* Top Bar with Title & Close button */}
          <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/60 text-accent">
                {getCategoryIcon()}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                {!hasVariations ? `Detail Produk ${categoryDisplayName}` : `Kustomisasi ${categoryDisplayName}`}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Header: Product Image & Details */}
            <div className="flex gap-4 items-center bg-stone-50/70 dark:bg-stone-900/40 p-3.5 rounded-2xl border border-stone-100 dark:border-stone-800/80">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0 shadow-xs">
                <ProductImage
                  src={product.image}
                  alt={product.name}
                  category={product.category}
                  className="w-full h-full object-cover"
                  containerClassName="w-full h-full relative"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-base sm:text-lg font-bold font-heading truncate">{product.name}</h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center gap-1">
                    {matchingCategory?.icon || '🏷️'} {categoryDisplayName}
                  </span>
                  {product.tag && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 dark:bg-orange-950/60 text-accent">
                      {product.tag}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-1">
                  {product.description || (isCemilan ? 'Cemilan lezat dan renyah pelengkap hidangan.' : 'Pilihan racikan terbaik barista toko.')}
                </p>
                <div className="text-sm font-bold text-accent mt-1">
                  Rp {product.price.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            {/* DYNAMIC VARIATIONS FROM DATABASE */}
            {!hasVariations ? (
              /* Cemilan / Tanpa Variasi */
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shrink-0">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                    {t('noSnackVariationTitle')}
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
                    {isCemilan
                      ? t('noSnackVariationDesc')
                      : 'Kategori produk ini tidak memiliki opsi variasi tambahan di database toko.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {categoryVariations.map((v, vIdx) => {
                  const currentSelected = selectedOptions[v.id];
                  return (
                    <div key={v.id || vIdx}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                          <span>
                            {vIdx + 1}. {v.name}
                          </span>
                          {v.required && (
                            <span className="text-[10px] text-accent font-semibold">{t('requiredSelect1')}</span>
                          )}
                        </label>
                        <span className="text-[10px] text-stone-400">Pilih 1</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {v.options.map(opt => {
                          const isSelected = currentSelected?.id === opt.id || currentSelected?.name === opt.name;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleSelectOption(v.id, opt)}
                              className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-accent bg-orange-50/70 dark:bg-orange-950/40 text-accent font-bold ring-1 ring-accent'
                                  : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-xs font-semibold">{opt.name}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                              </div>
                              <span className="text-[10px] opacity-80 mt-1">
                                {opt.extraPrice > 0 ? `+Rp ${opt.extraPrice.toLocaleString('id-ID')}` : '+Rp 0'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Catatan Khusus */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-2">
                {t('baristaNotes')}
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(isCemilan
                  ? (language === 'en'
                      ? ['+ Warm Up', '+ Separate Packaging', '+ Extra Fork/Napkin']
                      : ['+ Hangatkan', '+ Pisah Kemasan', '+ Pakai Sendok/Garpu'])
                  : (language === 'en'
                      ? ['+ Separate Ice', '+ Use Tumbler', '+ Extra Hot']
                      : ['+ Pisah Es', '+ Pakai Tumbler', '+ Shot Pisah'])
                ).map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleQuickNote(preset)}
                    className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={isCemilan ? 'Contoh: Minta dipanaskan, pisah saus/topping...' : t('notesPlaceholder')}
                rows={2}
                className="w-full p-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Bottom Sticky Action Bar: Pastikan Jumlah Produk Dimulai dari Satu */}
          <div
            className="p-4 border-t border-stone-100 dark:border-stone-800 bg-[#fff8f6] dark:bg-[#251e1c] flex items-center gap-3"
            style={{
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))'
            }}
          >
            {/* Quantity Stepper with Stock Cap (Starts from 1) */}
            <div className="flex items-center border border-stone-200 dark:border-stone-700 rounded-2xl p-1 bg-white dark:bg-stone-900 shrink-0 shadow-2xs">
              <button
                type="button"
                disabled={quantity <= 1}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300 transition-colors disabled:opacity-30 cursor-pointer"
                title="Kurangi jumlah (minimal 1)"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center text-sm font-bold select-none">{quantity}</span>
              <button
                type="button"
                disabled={quantity >= product.stock}
                onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                className="w-8 h-8 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300 transition-colors disabled:opacity-30 cursor-pointer"
                title={quantity >= product.stock ? 'Maksimal stok tercapai' : 'Tambah'}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Add to Order Button */}
            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={handleAdd}
              className="flex-1 py-3.5 px-4 rounded-2xl bg-accent text-white font-bold text-sm shadow-md hover:opacity-95 active:scale-98 transition-all flex items-center justify-between disabled:opacity-50 cursor-pointer"
            >
              <span>{t('addToOrder')}</span>
              <span>Rp {totalPrice.toLocaleString('id-ID')}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// Export DrinkModifierModal alias for backward compatibility
export const DrinkModifierModal = ProductModifierModal;
export type DrinkModifierModalProps = ProductModifierModalProps;
