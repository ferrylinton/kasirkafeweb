import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Minus, Check, Coffee, CupSoda, GlassWater, Cookie, Info } from 'lucide-react';
import { Product, CartItemModifier } from '../../types';
import { useCart } from '../../contexts/CartContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { ProductImage } from '../common/ProductImage';

export interface ProductModifierModalProps {
  product: Product | null;
  onClose: () => void;
}

export const ProductModifierModal: React.FC<ProductModifierModalProps> = ({ product, onClose }) => {
  const { addItem } = useCart();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  // Variations states
  const [size, setSize] = useState<'Regular' | 'Large' | 'Jumbo'>('Regular');
  const [ice, setIce] = useState<'Normal Ice' | 'Less Ice' | 'No Ice'>('Normal Ice');
  const [sugar, setSugar] = useState<'100% Normal' | '50% Less' | '0% No Sugar'>('100% Normal');
  const [shot, setShot] = useState<'Normal Shot' | '+1 Extra Shot' | '+2 Extra Shot'>('Normal Shot');
  const [notes, setNotes] = useState<string>('');
  
  // Ensure product quantity always starts at 1
  const [quantity, setQuantity] = useState<number>(1);

  // Reset all state whenever a product is opened or changed
  useEffect(() => {
    if (product) {
      setQuantity(1);
      setSize('Regular');
      setIce('Normal Ice');
      setSugar('100% Normal');
      setShot('Normal Shot');
      setNotes('');
    }
  }, [product?.id]);

  if (!product) return null;

  // Category determination (kopi, teh, jus, cemilan)
  const categoryLower = (product.category || '').toLowerCase().trim();
  const isKopi = categoryLower === 'kopi' || categoryLower.includes('kopi') || categoryLower.includes('coffee');
  const isTeh = categoryLower === 'teh' || categoryLower.includes('teh') || categoryLower.includes('tea');
  const isJus = categoryLower === 'jus' || categoryLower.includes('jus') || categoryLower.includes('juice');
  const isCemilan = categoryLower === 'cemilan' || categoryLower.includes('cemilan') || categoryLower.includes('snack') || categoryLower.includes('pastry');

  // Variations configuration:
  // - Kopi: ukuran, es, gula, shot
  // - Teh: ukuran, es, gula
  // - Jus: ukuran, es, gula
  // - Cemilan: tidak ada variasi
  const hasDrinkVariations = isKopi || isTeh || isJus || !isCemilan;
  const hasShotVariation = isKopi;

  // Price calculations
  const sizeExtras: Record<string, number> = { Regular: 0, Large: 5000, Jumbo: 9000 };
  const shotExtras: Record<string, number> = { 'Normal Shot': 0, '+1 Extra Shot': 5000, '+2 Extra Shot': 10000 };

  const currentSizeExtra = hasDrinkVariations ? (sizeExtras[size] || 0) : 0;
  const currentShotExtra = hasShotVariation ? (shotExtras[shot] || 0) : 0;

  const unitPrice = product.price + currentSizeExtra + currentShotExtra;
  const totalPrice = unitPrice * quantity;

  const handleQuickNote = (noteText: string) => {
    if (notes.includes(noteText)) {
      setNotes(notes.replace(noteText, '').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim());
    } else {
      setNotes(prev => (prev.trim() ? `${prev.trim()}, ${noteText}` : noteText));
    }
  };

  const handleAdd = () => {
    let modifier: CartItemModifier | undefined = undefined;

    if (isCemilan) {
      // Cemilan: tidak ada variasi ukuran, es, gula, atau shot
      if (notes.trim()) {
        modifier = {
          notes: notes.trim()
        };
      }
    } else {
      // Minuman (kopi, teh, jus)
      modifier = {
        size,
        sizeExtra: currentSizeExtra,
        ice,
        sugar,
        ...(hasShotVariation ? { shot, shotExtra: currentShotExtra } : {}),
        notes: notes.trim()
      };
    }

    addItem(product, modifier, quantity);
    showToast(`${product.name} (${quantity}x) ${t('itemAddedSuccess')}`, 'success');
    onClose();
  };

  const getCategoryIcon = () => {
    if (isKopi) return <Coffee className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />;
    if (isTeh) return <CupSoda className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
    if (isJus) return <GlassWater className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />;
    return <Cookie className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
  };

  const getCategoryBadgeLabel = () => {
    if (isKopi) return 'Kategori Kopi';
    if (isTeh) return 'Kategori Teh';
    if (isJus) return 'Kategori Jus';
    if (isCemilan) return 'Kategori Cemilan';
    return `Kategori ${product.category}`;
  };

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
                {isCemilan ? 'Detail Produk Cemilan' : t('productModifier')}
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
                    {getCategoryBadgeLabel()}
                  </span>
                  {product.tag && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 dark:bg-orange-950/60 text-accent">
                      {product.tag}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-1">
                  {product.description || (isCemilan ? 'Cemilan lezat dan renyah pelengkap hidangan.' : 'Pilihan minuman segar racikan terbaik.')}
                </p>
                <div className="text-sm font-bold text-accent mt-1">
                  Rp {product.price.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            {/* VARIATIONS ACCORDING TO CATEGORY:
                - Kopi: Ukuran, Es, Gula, Shot
                - Teh: Ukuran, Es, Gula
                - Jus: Ukuran, Es, Gula
                - Cemilan: Tidak ada variasi
            */}

            {isCemilan ? (
              /* Cemilan: Tidak ada variasi */
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shrink-0">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                    {t('noSnackVariationTitle')}
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
                    {t('noSnackVariationDesc')}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* 1. Variasi Ukuran (Kopi, Teh, Jus) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                      1. {t('cupSize')}
                    </label>
                    <span className="text-[10px] text-accent font-semibold">{t('requiredSelect1')}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'Regular', name: 'Regular 12oz', extra: '+Rp 0' },
                      { id: 'Large', name: 'Large 16oz', extra: '+Rp 5.000' },
                      { id: 'Jumbo', name: 'Jumbo 22oz', extra: '+Rp 9.000' }
                    ].map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSize(s.id as any)}
                        className={`p-3 rounded-2xl border text-left flex flex-col transition-all cursor-pointer ${
                          size === s.id
                            ? 'border-accent bg-orange-50/70 dark:bg-orange-950/40 text-accent font-bold ring-1 ring-accent'
                            : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-semibold">{s.name}</span>
                          {size === s.id && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                        </div>
                        <span className="text-[10px] opacity-80 mt-1">{s.extra}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Variasi Level Es (Kopi, Teh, Jus) */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-2">
                    2. {t('iceLevel')}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Normal Ice', 'Less Ice', 'No Ice'].map(i => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setIce(i as any)}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          ice === i
                            ? 'border-accent bg-orange-50/70 dark:bg-orange-950/40 text-accent ring-1 ring-accent font-bold'
                            : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {ice === i && <Check className="w-3.5 h-3.5 text-accent" />}
                        <span>{i}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Variasi Tingkat Gula (Kopi, Teh, Jus) */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-2">
                    3. {t('sugarLevel')}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['100% Normal', '50% Less', '0% No Sugar'].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSugar(s as any)}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          sugar === s
                            ? 'border-accent bg-orange-50/70 dark:bg-orange-950/40 text-accent ring-1 ring-accent font-bold'
                            : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {sugar === s && <Check className="w-3.5 h-3.5 text-accent" />}
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Variasi Espresso Shot (KHUSUS Kategori Kopi) */}
                {hasShotVariation && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                        <span>4. {t('shotEspresso')}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold normal-case">
                          Khusus Kopi
                        </span>
                      </label>
                      <span className="text-[10px] text-stone-400">Pilihan ekstra rasa kopi</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'Normal Shot', label: 'Normal (1 Shot)', extra: '+Rp 0' },
                        { id: '+1 Extra Shot', label: '+1 Extra Shot', extra: '+Rp 5.000' },
                        { id: '+2 Extra Shot', label: '+2 Extra Shot', extra: '+Rp 10.000' }
                      ].map(st => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setShot(st.id as any)}
                          className={`p-2.5 rounded-2xl border text-left flex flex-col transition-all cursor-pointer ${
                            shot === st.id
                              ? 'border-accent bg-orange-50/70 dark:bg-orange-950/40 text-accent ring-1 ring-accent font-bold'
                              : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-semibold">{st.label}</span>
                            {shot === st.id && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                          </div>
                          <span className="text-[10px] opacity-80 mt-1">{st.extra}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
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
