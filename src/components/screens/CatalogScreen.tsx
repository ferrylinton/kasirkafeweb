import React, { useState, useEffect } from 'react';
import { Search, ScanBarcode, Sparkles, Coffee, CupSoda, GlassWater, Cookie, Plus, ShoppingBag } from 'lucide-react';
import { Product, Category } from '../../types';
import { useCart } from '../../contexts/CartContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { DrinkModifierModal } from '../modals/DrinkModifierModal';
import { useToast } from '../common/Toast';
import { ProductImage } from '../common/ProductImage';
import { getCategoryLabel } from '../../utils/i18nData';

interface CatalogScreenProps {
  onNavigateToCart?: () => void;
}

export const CatalogScreen: React.FC<CatalogScreenProps> = ({ onNavigateToCart }) => {
  const { addItem } = useCart();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Load categories and products from backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          fetch('/api/products/categories'),
          fetch(`/api/products?category=${selectedCategory}&search=${encodeURIComponent(searchQuery)}`)
        ]);
        const catData = await catRes.json();
        const prodData = await prodRes.json();

        if (catData.success && catData.categories) {
          setCategories(catData.categories);
        }
        if (prodData.success && prodData.products) {
          setProducts(prodData.products);
        }
      } catch (err) {
        console.warn('Could not fetch products, using offline state');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedCategory, searchQuery]);

  const getCategoryIcon = (code: string) => {
    switch (code.toLowerCase()) {
      case 'kopi':
        return <Coffee className="w-4 h-4" />;
      case 'teh':
        return <CupSoda className="w-4 h-4" />;
      case 'jus':
        return <GlassWater className="w-4 h-4" />;
      case 'cemilan':
        return <Cookie className="w-4 h-4" />;
      default:
        return <Sparkles className="w-4 h-4" />;
    }
  };

  const handleProductCardClick = (product: Product) => {
    if (product.stock <= 0) {
      showToast(`${product.name} saat ini sedang habis (stok 0)!`, 'warning');
      return;
    }
    // If it's a beverage (kopi/teh/jus), open modifier modal. If snack, quick add or customize.
    setSelectedProductForModal(product);
  };

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-7xl mx-auto flex flex-col gap-5">
      {/* 1. Search Bar with Barcode Icon matching mockup Image 5 */}
      <div className="relative flex items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-11 pr-12 py-3 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-accent shadow-xs text-stone-900 dark:text-stone-100 placeholder-stone-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-12 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs px-1"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 flex items-center justify-center absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
            title="Scan Barcode"
          >
            <ScanBarcode className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Horizontal Categories Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 ${
            selectedCategory === 'all'
              ? 'bg-accent text-white shadow-xs scale-102'
              : 'bg-white dark:bg-[#251e1c] border border-stone-200/70 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{t('allCategory')}</span>
        </button>

        {categories.map(cat => {
          const active = selectedCategory === cat.code;
          return (
            <button
              key={cat.code}
              type="button"
              onClick={() => setSelectedCategory(cat.code)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                active
                  ? 'bg-accent text-white shadow-xs scale-102'
                  : 'bg-white dark:bg-[#251e1c] border border-stone-200/70 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50'
              }`}
            >
              {getCategoryIcon(cat.code)}
              <span>{getCategoryLabel(cat.code, language) || cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Promotional Banner matching Image 5 (Rush Hour Deal) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent border border-orange-200/60 dark:border-orange-900/40 p-4 sm:p-5 flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 font-heading">
                {t('rushHourDeal')}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-accent text-white uppercase tracking-wider">
                {t('activeBadge')}
              </span>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5 leading-relaxed">
              {t('rushHourDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Products Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div
              key={i}
              className="h-64 rounded-3xl bg-stone-200/60 dark:bg-stone-800/60 animate-pulse"
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="py-16 text-center text-stone-400">
          <Coffee className="w-10 h-10 mx-auto opacity-30 mb-2" />
          <p className="text-sm font-semibold">{t('noRulesFound') || 'Tidak ada produk ditemukan.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {products.map(product => {
            const threshold = product.lowStockThreshold || 10;
            const isOutOfStock = product.stock <= 0;
            const isLowStock = product.stock > 0 && product.stock <= threshold;

            return (
              <div
                key={product.id}
                onClick={() => handleProductCardClick(product)}
                className={`group cursor-pointer rounded-3xl bg-white dark:bg-[#251e1c] border p-3 sm:p-3.5 flex flex-col justify-between shadow-2xs transition-all active:scale-[0.99] ${
                  isOutOfStock
                    ? 'border-red-300 dark:border-red-900/60 opacity-80'
                    : isLowStock
                    ? 'border-amber-300 dark:border-amber-800/80 hover:shadow-md'
                    : 'border-stone-200/80 dark:border-stone-800 hover:shadow-md hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                <div>
                  {/* Image + Tag + Stock badge */}
                  <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 mb-3">
                    <ProductImage
                      src={product.image}
                      alt={product.name}
                      category={product.category}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      containerClassName="w-full h-full relative"
                      loading="lazy"
                    />
                    {product.tag && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-accent text-white shadow-xs">
                        {product.tag}
                      </span>
                    )}

                    {/* Stock badge */}
                    {isOutOfStock ? (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                        <span className="px-2.5 py-1 rounded-xl bg-red-600 text-white text-[11px] font-black tracking-wider uppercase shadow-md">
                          {t('outOfStockBadge')}
                        </span>
                      </div>
                    ) : isLowStock ? (
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500 text-white shadow-xs animate-pulse flex items-center gap-1">
                        <span>{t('stockRemaining')}: {product.stock}!</span>
                      </span>
                    ) : (
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-stone-900/75 backdrop-blur-xs text-white">
                        {t('stockPrefix')}: {product.stock}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <h4 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 font-heading line-clamp-1">
                    {product.name}
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 mt-0.5 leading-relaxed">
                    {product.description || 'Segar dan nikmat racikan barista berpengalaman.'}
                  </p>
                </div>

                {/* Price & Add button */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-100 dark:border-stone-800/80">
                  <span className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                    Rp {product.price.toLocaleString('id-ID')}
                  </span>
                  <button
                    type="button"
                    disabled={isOutOfStock}
                    onClick={e => {
                      e.stopPropagation();
                      handleProductCardClick(product);
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs transition-all ${
                      isOutOfStock
                        ? 'bg-stone-300 dark:bg-stone-700 text-stone-400 cursor-not-allowed'
                        : 'bg-accent text-white hover:opacity-90 active:scale-95'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drink Modifier Modal */}
      <DrinkModifierModal
        product={selectedProductForModal}
        onClose={() => setSelectedProductForModal(null)}
      />
    </div>
  );
};
