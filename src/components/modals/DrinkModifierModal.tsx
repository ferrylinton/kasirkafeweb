import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Minus, Check, Sparkles } from 'lucide-react';
import { Product, CartItemModifier } from '../../types';
import { useCart } from '../../contexts/CartContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { ProductImage } from '../common/ProductImage';

interface DrinkModifierModalProps {
  product: Product | null;
  onClose: () => void;
}

export const DrinkModifierModal: React.FC<DrinkModifierModalProps> = ({ product, onClose }) => {
  const { addItem } = useCart();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  const [size, setSize] = useState<'Regular' | 'Large' | 'Jumbo'>('Regular');
  const [ice, setIce] = useState<'Normal Ice' | 'Less Ice' | 'No Ice'>('Normal Ice');
  const [sugar, setSugar] = useState<'100% Normal' | '50% Less' | '0% No Sugar'>('100% Normal');
  const [milk, setMilk] = useState<'Fresh Milk' | 'Oat Milk' | 'Almond Milk'>('Fresh Milk');
  const [toppings, setToppings] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

  if (!product) return null;

  // Price calculations
  const sizeExtras: Record<string, number> = { Regular: 0, Large: 5000, Jumbo: 9000 };
  const milkExtras: Record<string, number> = { 'Fresh Milk': 0, 'Oat Milk': 6000, 'Almond Milk': 6000 };
  const toppingPrices: Record<string, number> = {
    'Extra Espresso Shot': 5000,
    'Brown Sugar Boba': 4000,
    'Grass Jelly': 3500,
    'Creamy Cheese Foam': 6000
  };

  const currentSizeExtra = sizeExtras[size] || 0;
  const currentMilkExtra = milkExtras[milk] || 0;
  const currentToppingsExtra = toppings.reduce((sum, top) => sum + (toppingPrices[top] || 0), 0);

  const unitPrice = product.price + currentSizeExtra + currentMilkExtra + currentToppingsExtra;
  const totalPrice = unitPrice * quantity;

  const toggleTopping = (topName: string) => {
    if (toppings.includes(topName)) {
      setToppings(toppings.filter(t => t !== topName));
    } else {
      setToppings([...toppings, topName]);
    }
  };

  const handleQuickNote = (noteText: string) => {
    if (notes.includes(noteText)) {
      setNotes(notes.replace(noteText, '').trim());
    } else {
      setNotes(prev => (prev ? `${prev}, ${noteText}` : noteText));
    }
  };

  const handleAdd = () => {
    const modifier: CartItemModifier = {
      size,
      sizeExtra: currentSizeExtra,
      ice,
      sugar,
      milk,
      milkExtra: currentMilkExtra,
      toppings,
      toppingsExtra: currentToppingsExtra,
      notes
    };

    addItem(product, modifier, quantity);
    showToast(`${product.name} ${t('itemAddedSuccess')}`, 'success');
    onClose();
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
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-[#251e1c] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 overflow-hidden"
        >
          {/* Top Bar with Close button */}
          <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              {t('drinkModifier')}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Header: Image & Details */}
            <div className="flex gap-4 items-center">
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
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold font-heading truncate">{product.name}</h3>
                  {product.tag && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 dark:bg-orange-950/60 text-accent">
                      {product.tag}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-0.5">
                  {product.description || 'Pilihan minuman segar racikan barista terbaik.'}
                </p>
                <div className="text-sm font-bold text-accent mt-1">
                  Rp {product.price.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            {/* 1. Ukuran Cup (Wajib) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  {t('cupSize')}
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
                    className={`p-3 rounded-2xl border text-left flex flex-col transition-all ${
                      size === s.id
                        ? 'border-accent bg-orange-50/70 dark:bg-orange-950/40 text-accent font-bold ring-1 ring-accent'
                        : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <span className="text-xs font-semibold">{s.name}</span>
                    <span className="text-[10px] opacity-80 mt-0.5">{s.extra}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Level Es */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-2">
                {t('iceLevel')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Normal Ice', 'Less Ice', 'No Ice'].map(i => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIce(i as any)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                      ice === i
                        ? 'border-accent bg-orange-50/70 dark:bg-orange-950/40 text-accent ring-1 ring-accent'
                        : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Tingkat Gula */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-2">
                {t('sugarLevel')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['100% Normal', '50% Less', '0% No Sugar'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSugar(s as any)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                      sugar === s
                        ? 'border-accent bg-orange-50/70 dark:bg-orange-950/40 text-accent ring-1 ring-accent'
                        : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Pilihan Susu */}
            {product.category === 'kopi' || product.category === 'teh' ? (
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-2">
                  {t('milkChoice')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Fresh Milk', label: 'Fresh Milk', extra: language === 'en' ? 'Standard' : 'Standar' },
                    { id: 'Oat Milk', label: 'Oat Milk', extra: '+Rp 6.000' },
                    { id: 'Almond Milk', label: 'Almond Milk', extra: '+Rp 6.000' }
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMilk(m.id as any)}
                      className={`p-2.5 rounded-xl border text-left flex flex-col transition-all ${
                        milk === m.id
                          ? 'border-accent bg-orange-50/70 dark:bg-orange-950/40 text-accent ring-1 ring-accent'
                          : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
                      }`}
                    >
                      <span className="text-xs font-semibold">{m.label}</span>
                      <span className="text-[10px] opacity-80">{m.extra}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* 5. Tambahan Topping */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  {t('toppingsTitle')}
                </label>
                <span className="text-[10px] text-stone-400">{t('toppingsSubtitle')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(toppingPrices).map(([name, price]) => {
                  const active = toppings.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleTopping(name)}
                      className={`p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                        active
                          ? 'border-accent bg-orange-50/70 dark:bg-orange-950/40 text-accent ring-1 ring-accent'
                          : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold">{name}</div>
                        <div className="text-[10px] opacity-80">+Rp {price.toLocaleString('id-ID')}</div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                          active ? 'bg-accent border-accent text-white' : 'border-stone-300 dark:border-stone-600'
                        }`}
                      >
                        {active && <Check className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 6. Catatan Khusus Barista */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-2">
                {t('baristaNotes')}
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(language === 'en'
                  ? ['+ Separate Ice', '+ Tumbler / Eco Cup', '+ Extra Hot']
                  : ['+ Pisah Es', '+ Pakai Tumbler', '+ Shot Pisah']
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
                placeholder={t('notesPlaceholder')}
                rows={2}
                className="w-full p-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Bottom Sticky Action Bar */}
          <div
            className="p-4 border-t border-stone-100 dark:border-stone-800 bg-[#fff8f6] dark:bg-[#251e1c] flex items-center gap-3"
            style={{
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))'
            }}
          >
            {/* Quantity Stepper with Stock Cap */}
            <div className="flex items-center border border-stone-200 dark:border-stone-700 rounded-2xl p-1 bg-white dark:bg-stone-900 shrink-0">
              <button
                type="button"
                disabled={quantity <= 1}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300 transition-colors disabled:opacity-30"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center text-sm font-bold">{quantity}</span>
              <button
                type="button"
                disabled={quantity >= product.stock}
                onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                className="w-8 h-8 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300 transition-colors disabled:opacity-30"
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
              className="flex-1 py-3.5 px-4 rounded-2xl bg-accent text-white font-bold text-sm shadow-md hover:opacity-95 active:scale-98 transition-all flex items-center justify-between disabled:opacity-50"
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
