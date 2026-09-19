import React, { useState, useEffect } from 'react';
import { X, Search, Sparkles, ShoppingBag, CheckCircle, Gift, AlertCircle } from 'lucide-react';
import { Product, EligibleDiscount, CartItem } from '../../types';
import { calculateItemDiscountPrice } from '../../contexts/CartContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { ProductImage } from '../common/ProductImage';

interface DiscountItemSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRule: EligibleDiscount | null;
  cartItems: CartItem[];
  onSelectProduct: (product: Product) => void;
  onSelectCartItem: (cartItemId: string) => void;
}

export const DiscountItemSelectorModal: React.FC<DiscountItemSelectorModalProps> = ({
  isOpen,
  onClose,
  selectedRule,
  cartItems,
  onSelectProduct,
  onSelectCartItem
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'MENU' | 'CART'>('MENU');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/products');
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.products)) {
          setProducts(data.products);
        }
      } catch (err) {
        console.error('Failed to load products for discount selector', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProducts();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen || !selectedRule) return null;

  // Filter products matching rule eligibility (e.g. snacks only for FREE_SNACK)
  const eligibleCategories = selectedRule.eligibleCategories || ['kopi', 'teh', 'jus', 'cemilan'];

  const filteredMenuProducts = products.filter(p => {
    const matchCategory = eligibleCategories.includes(p.category.toLowerCase());
    const matchSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch && p.isAvailable !== false;
  });

  // Eligible items currently in cart
  const eligibleCartItems = cartItems.filter(item => {
    return eligibleCategories.includes(item.category.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="discount-item-selector-modal"
        className="w-full max-w-2xl bg-white dark:bg-[#251e1c] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-stone-100 dark:border-stone-800 flex items-start justify-between bg-stone-50/70 dark:bg-stone-900/40">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                  {selectedRule.name}
                </span>
              </div>
              <h3 className="text-lg font-bold font-heading text-stone-900 dark:text-stone-100 mt-1">
                {t('selectItemModalTitle')}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {t('selectItemModalSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-5 pt-3 pb-2 border-b border-stone-100 dark:border-stone-800 flex items-center gap-2 bg-white dark:bg-[#251e1c]">
          <button
            type="button"
            onClick={() => setActiveTab('MENU')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'MENU'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{t('chooseFromMenu')}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/20">
              {filteredMenuProducts.length}
            </span>
          </button>

          {eligibleCartItems.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('CART')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'CART'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{t('chooseFromCart')}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/20">
                {eligibleCartItems.length}
              </span>
            </button>
          )}
        </div>

        {/* Search Input (For Menu Tab) */}
        {activeTab === 'MENU' && (
          <div className="px-5 pt-3 pb-1">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('searchProductForDiscount')}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3 max-h-[55vh]">
          {activeTab === 'MENU' ? (
            loading ? (
              <div className="py-12 text-center text-xs text-stone-400">
                Memuat daftar produk yang memenuhi syarat...
              </div>
            ) : filteredMenuProducts.length === 0 ? (
              <div className="py-12 text-center text-xs text-stone-400">
                Tidak ada produk yang cocok dengan kategori promo ({eligibleCategories.join(', ')}).
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredMenuProducts.map(prod => {
                  const { discountAmount, discountedPrice } = calculateItemDiscountPrice(
                    prod.price,
                    selectedRule.rewardType,
                    selectedRule.rewardValue
                  );

                  return (
                    <div
                      key={prod.id}
                      className="p-3.5 rounded-2xl border border-stone-200 dark:border-stone-750 bg-white dark:bg-stone-900/50 hover:border-amber-400 dark:hover:border-amber-600 transition-all flex flex-col justify-between gap-3 shadow-2xs hover:shadow-xs group"
                    >
                      <div className="flex items-center gap-3">
                        <ProductImage
                          src={prod.image}
                          alt={prod.name}
                          category={prod.category}
                          containerClassName="w-14 h-14 rounded-xl shrink-0 overflow-hidden border border-stone-100 dark:border-stone-800"
                          className="w-full h-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            {prod.category}
                          </span>
                          <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                            {prod.name}
                          </h4>
                          <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-xs text-stone-400 line-through">
                              Rp {prod.price.toLocaleString('id-ID')}
                            </span>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                              {discountedPrice === 0 ? (
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold text-[11px]">
                                  GRATIS (Rp 0)
                                </span>
                              ) : (
                                `Rp ${discountedPrice.toLocaleString('id-ID')}`
                              )}
                            </span>
                          </div>
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                            Hemat Rp {discountAmount.toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectProduct(prod);
                          onClose();
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Pilih sebagai Item Diskon</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Cart Tab */
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Memilih item dari keranjang akan memindahkannya dari <strong>Item Dipesan</strong> ke <strong>Item Diskon</strong> dengan penyesuaian harga sesuai promo.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {eligibleCartItems.map(item => {
                  const { discountAmount, discountedPrice } = calculateItemDiscountPrice(
                    item.price,
                    selectedRule.rewardType,
                    selectedRule.rewardValue
                  );

                  return (
                    <div
                      key={item.cartItemId}
                      className="p-3.5 rounded-2xl border border-stone-200 dark:border-stone-750 bg-white dark:bg-stone-900/50 hover:border-amber-400 transition-all flex flex-col justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <ProductImage
                          src={item.image}
                          alt={item.name}
                          category={item.category}
                          containerClassName="w-14 h-14 rounded-xl shrink-0 overflow-hidden border border-stone-100 dark:border-stone-800"
                          className="w-full h-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                            Di Keranjang (x{item.quantity})
                          </span>
                          <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                            {item.name}
                          </h4>
                          <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="text-xs text-stone-400 line-through">
                              Rp {item.price.toLocaleString('id-ID')}
                            </span>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                              {discountedPrice === 0 ? (
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold text-[11px]">
                                  GRATIS (Rp 0)
                                </span>
                              ) : (
                                `Rp ${discountedPrice.toLocaleString('id-ID')}`
                              )}
                            </span>
                          </div>
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                            Hemat Rp {discountAmount.toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectCartItem(item.cartItemId);
                          onClose();
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Gunakan Item Ini sebagai Item Diskon</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
