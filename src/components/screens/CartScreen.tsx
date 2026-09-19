import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  User, 
  Mail, 
  Phone, 
  ArrowRight, 
  PauseCircle, 
  Gift, 
  Tag, 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Edit3, 
  Sparkles,
  Info
} from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { ProductImage } from '../common/ProductImage';
import { DiscountItemSelectorModal } from '../cart/DiscountItemSelectorModal';
import { Product } from '../../types';

interface CartScreenProps {
  onProceedToPayment: () => void;
  onNavigateToCatalog: () => void;
}

export const CartScreen: React.FC<CartScreenProps> = ({ onProceedToPayment, onNavigateToCatalog }) => {
  const {
    items,
    customerName,
    setCustomerName,
    customerEmail,
    setCustomerEmail,
    customerPhone,
    setCustomerPhone,
    eligibleDiscounts,
    allDiscounts,
    selectedDiscountCode,
    setSelectedDiscountCode,
    discountItem,
    selectDiscountItemFromProduct,
    selectDiscountItemFromCart,
    removeDiscountItem,
    appliedDiscounts,
    totalDiscount,
    subtotal,
    discountItemPrice,
    pb1Tax,
    totalAmount,
    updateQuantity,
    removeItem,
    clearCart
  } = useCart();

  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isSelectorModalOpen, setIsSelectorModalOpen] = useState(false);
  const [showNonEligible, setShowNonEligible] = useState(false);

  const handleHoldBill = () => {
    showToast('Pesanan berhasil disimpan ke Hold Bill #0142', 'info');
  };

  // Find currently active discount rule object
  const activeRule = 
    eligibleDiscounts.find(d => d.code === selectedDiscountCode) ||
    allDiscounts.find(d => d.code === selectedDiscountCode) || null;

  // Non-eligible discounts
  const nonEligibleDiscounts = allDiscounts.filter(d => !d.isEligible);

  const handleSelectDiscountCode = (code: string | null) => {
    if (code === selectedDiscountCode) {
      // Toggle off if already selected
      setSelectedDiscountCode(null);
      showToast('Diskon dinonaktifkan', 'info');
    } else {
      setSelectedDiscountCode(code);
      if (code !== null) {
        showToast('Diskon dipilih! Silakan pilih item yang jadi item diskon.', 'success');
        // Auto open selector modal to choose discount item
        setIsSelectorModalOpen(true);
      }
    }
  };

  const handleProductChosen = (product: Product) => {
    if (activeRule) {
      selectDiscountItemFromProduct(product, activeRule);
      showToast(`${product.name} dipilih sebagai Item Diskon!`, 'success');
    }
  };

  const handleCartItemChosen = (cartItemId: string) => {
    if (activeRule) {
      selectDiscountItemFromCart(cartItemId, activeRule);
      showToast('Item berhasil dijadikan Item Diskon dengan harga promo!', 'success');
    }
  };

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-4xl mx-auto flex flex-col gap-5">
      {/* 1. Header Order Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200/80 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-accent uppercase tracking-wider">
              {t('orderHeader')}
            </span>
            <span className="text-xs text-stone-400">•</span>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              {t('roleCashier')}: {user?.name || t('roleCashier')}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-stone-900 dark:text-stone-100 mt-0.5">
            {t('orderedItems')} ({items.reduce((s, i) => s + i.quantity, 0)})
          </h2>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'Clear Cart' : 'Kosongkan Keranjang'}</span>
          </button>
        )}
      </div>

      {/* 2. Regular Ordered Items List */}
      {items.length === 0 ? (
        <div className="py-16 text-center text-stone-400 bg-white dark:bg-[#251e1c] rounded-3xl border border-dashed border-stone-200 dark:border-stone-800">
          <ShoppingBag className="w-12 h-12 mx-auto opacity-30 mb-2" />
          <p className="text-sm font-semibold">{t('emptyCartSubtitle')}</p>
          <button
            type="button"
            onClick={onNavigateToCatalog}
            className="mt-4 px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            {language === 'en' ? 'Browse Catalog' : 'Buka Katalog Menu'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            return (
              <div
                key={item.cartItemId}
                className="bg-white dark:bg-[#251e1c] rounded-3xl p-4 shadow-2xs border border-stone-200/80 dark:border-stone-800 flex items-start justify-between gap-3"
              >
                {/* Image */}
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0">
                  <ProductImage
                    src={item.image}
                    alt={item.name}
                    category={item.category}
                    className="w-full h-full object-cover"
                    containerClassName="w-full h-full relative"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 font-heading truncate">
                      {item.name}
                    </h4>
                    <button
                      type="button"
                      onClick={() => removeItem(item.cartItemId)}
                      className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Modifier Tags */}
                  {item.modifier && (
                    <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-stone-500 dark:text-stone-400">
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800">
                        {item.modifier.size}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800">
                        {item.modifier.ice}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800">
                        {item.modifier.sugar}
                      </span>
                      {item.modifier.milk && item.modifier.milk !== 'Fresh Milk' && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 font-semibold">
                          {item.modifier.milk}
                        </span>
                      )}
                      {item.modifier.toppings?.map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/40 text-accent font-semibold">
                          +{t}
                        </span>
                      ))}
                      {item.modifier.notes && (
                        <span className="w-full text-stone-400 italic">
                          Catatan: {item.modifier.notes}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Price & Quantity Stepper */}
                  <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-stone-100 dark:border-stone-800/80">
                    <span className="text-xs sm:text-sm font-bold text-stone-800 dark:text-stone-200">
                      Rp {item.itemTotal.toLocaleString('id-ID')}
                    </span>

                    <div className="flex items-center gap-2 border border-stone-200 dark:border-stone-700 rounded-xl px-1.5 py-0.5 bg-stone-50 dark:bg-stone-900">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.cartItemId, -1)}
                        className="p-1 hover:text-accent transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.cartItemId, 1)}
                        className="p-1 hover:text-accent transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. ITEM DISKON (DIBEDAKAN DARI ITEM YANG DIPESAN) */}
      {discountItem && (
        <div 
          id="discount-item-card"
          className="rounded-3xl p-4 sm:p-5 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-950/40 dark:via-orange-950/20 border-2 border-dashed border-amber-400 dark:border-amber-600 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-amber-200/80 dark:border-amber-900/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <Gift className="w-4 h-4" />
              </div>
              <div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white">
                  {t('discountItemSection')}
                </span>
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 ml-2">
                  {discountItem.ruleName}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsSelectorModalOpen(true)}
                className="px-2.5 py-1 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors flex items-center gap-1"
                title={t('changeDiscountItem')}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('changeDiscountItem')}</span>
              </button>
              <button
                type="button"
                onClick={removeDiscountItem}
                className="p-1.5 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                title={t('removeDiscountItem')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-2 mb-3">
            {t('discountItemDescription')}
          </p>

          <div className="bg-white dark:bg-[#251e1c] rounded-2xl p-3.5 border border-amber-200/70 dark:border-amber-900/50 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0 border border-stone-200 dark:border-stone-700">
                <ProductImage
                  src={discountItem.image}
                  alt={discountItem.name}
                  category={discountItem.category}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {discountItem.category}
                </span>
                <h4 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 truncate">
                  {discountItem.name}
                </h4>
                <div className="text-[11px] text-stone-500 flex items-center gap-2 mt-0.5">
                  <span>{t('normalPriceLabel')}: <del>Rp {discountItem.originalPrice.toLocaleString('id-ID')}</del></span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    (Hemat Rp {discountItem.discountAmount.toLocaleString('id-ID')})
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-stone-400 block uppercase">
                {t('discountedPriceLabel')}
              </span>
              <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-heading">
                {discountItem.discountedPrice === 0 ? (
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs">
                    {t('freeText')} (Rp 0)
                  </span>
                ) : (
                  `Rp ${discountItem.discountedPrice.toLocaleString('id-ID')}`
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. DAFTAR DISKON YANG SESUAI (HANYA 1 DISKON BOLEH DIPILIH) */}
      <div 
        id="applicable-discounts-section"
        className="bg-white dark:bg-[#251e1c] rounded-3xl p-5 shadow-2xs border border-stone-200/80 dark:border-stone-800 flex flex-col gap-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-accent" />
              <h3 className="text-sm sm:text-base font-bold font-heading text-stone-900 dark:text-stone-100">
                {t('eligibleDiscountsTitle')}
              </h3>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              {t('eligibleDiscountsSubtitle')}
            </p>
          </div>

          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 shrink-0">
            {eligibleDiscounts.length} Tersedia
          </span>
        </div>

        {/* Radio Option: Tanpa Diskon */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => handleSelectDiscountCode(null)}
            className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all ${
              selectedDiscountCode === null
                ? 'border-accent bg-accent/5 dark:bg-accent/10 shadow-xs'
                : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 bg-stone-50/50 dark:bg-stone-900/30'
            }`}
          >
            <div className="flex items-center gap-3">
              {selectedDiscountCode === null ? (
                <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-stone-300 dark:text-stone-600 shrink-0" />
              )}
              <div>
                <span className="text-xs sm:text-sm font-bold text-stone-800 dark:text-stone-200 block">
                  {t('noDiscountOption')}
                </span>
                <span className="text-[11px] text-stone-400">
                  Pesanan tanpa potongan promo
                </span>
              </div>
            </div>
          </button>

          {/* Eligible Discounts List */}
          {eligibleDiscounts.length === 0 ? (
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/40 border border-dashed border-stone-200 dark:border-stone-800 text-center text-xs text-stone-500">
              <Info className="w-4 h-4 mx-auto mb-1 text-stone-400" />
              <span>{t('noEligibleDiscounts')}</span>
            </div>
          ) : (
            eligibleDiscounts.map(discount => {
              const isSelected = selectedDiscountCode === discount.code;

              return (
                <div
                  key={discount.code}
                  className={`rounded-2xl border transition-all ${
                    isSelected
                      ? 'border-accent bg-amber-50/60 dark:bg-amber-950/30 shadow-xs'
                      : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 bg-stone-50/50 dark:bg-stone-900/30'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectDiscountCode(discount.code)}
                    className="w-full p-3.5 text-left flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="pt-0.5">
                        {isSelected ? (
                          <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-stone-300 dark:text-stone-600 shrink-0" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
                            {discount.name}
                          </span>
                          {discount.type === 'BIRTHDAY' || discount.code === 'BIRTHDAY_REWARD' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 flex items-center gap-1">
                              🎂 Selalu Aktif
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              Memenuhi Syarat
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                          {discount.description}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-accent">
                        {discount.rewardType === 'FREE_SNACK' && 'Gratis 1 Snack'}
                        {discount.rewardType === 'FREE_DRINK_OR_SNACK' && 'Gratis 1 Item'}
                        {discount.rewardType === 'PERCENTAGE' && `${discount.rewardValue}% OFF`}
                        {discount.rewardType === 'FIXED_AMOUNT' && `Potongan Rp ${(discount.rewardValue || 0).toLocaleString('id-ID')}`}
                      </span>
                    </div>
                  </button>

                  {/* Active prompt to select item if this rule is selected */}
                  {isSelected && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t border-amber-200/60 dark:border-amber-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-amber-100/40 dark:bg-amber-900/20 rounded-b-2xl">
                      <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>
                          {discountItem ? (
                            <span>Item diskon aktif: <strong>{discountItem.name}</strong></span>
                          ) : (
                            <span>Pilih item yang ingin dijadikan item promo diskon ini:</span>
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSelectorModalOpen(true)}
                        className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                      >
                        <Gift className="w-3.5 h-3.5" />
                        <span>{discountItem ? t('changeDiscountItem') : t('selectDiscountItem')}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Other Promo Rules that are not yet eligible */}
        {nonEligibleDiscounts.length > 0 && (
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setShowNonEligible(prev => !prev)}
              className="text-xs font-semibold text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 flex items-center justify-between w-full cursor-pointer"
            >
              <span>{t('nearEligibleTitle')} ({nonEligibleDiscounts.length})</span>
              <span className="text-[11px] underline">
                {language === 'en'
                  ? (showNonEligible ? 'Hide' : 'Show')
                  : (showNonEligible ? 'Sembunyikan' : 'Tampilkan')}
              </span>
            </button>

            {showNonEligible && (
              <div className="space-y-2 mt-2.5">
                {nonEligibleDiscounts.map(rule => (
                  <div
                    key={rule.code}
                    className="p-3 rounded-2xl bg-stone-50/60 dark:bg-stone-900/30 border border-stone-200 dark:border-stone-800 flex items-start justify-between gap-3 text-xs opacity-75"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-stone-700 dark:text-stone-300">
                          {rule.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        {rule.description}
                      </p>
                    </div>
                    {rule.missingRequirement && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0 border border-amber-200 dark:border-amber-900">
                        {rule.missingRequirement}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Customer Info Box (All Optional) */}
      <div className="bg-white dark:bg-[#251e1c] rounded-3xl p-5 shadow-2xs border border-stone-200/80 dark:border-stone-800 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
            <User className="w-4 h-4 text-accent" />
            {t('customerInfo')}
          </span>
          <span className="text-[10px] text-stone-400">
            {language === 'en' ? 'Optional for receipts & notifications' : 'Opsional untuk Struk & Kontak'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 block mb-1">
              {t('customerNameLabel')}
            </label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder={language === 'en' ? 'e.g. Alex (optional)' : 'Contoh: Kak Adelia (opsional)'}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 block mb-1">
              {t('customerEmailLabel')}
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                placeholder={language === 'en' ? 'name@gmail.com (optional)' : 'nama@gmail.com (opsional)'}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 block mb-1">
              {t('customerPhoneLabel')}
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="tel"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="0812-xxxx-xxxx"
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 6. Payment Summary Card */}
      <div className="bg-white dark:bg-[#251e1c] rounded-3xl p-5 shadow-sm border border-stone-200/80 dark:border-stone-800 flex flex-col gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          {t('paymentSummary')}
        </span>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-stone-600 dark:text-stone-400">
            <span>{t('subtotal')} ({items.reduce((s, i) => s + i.quantity, 0)} item pesanan)</span>
            <span className="font-semibold text-stone-900 dark:text-stone-100">
              Rp {subtotal.toLocaleString('id-ID')}
            </span>
          </div>

          {discountItem && (
            <div className="flex justify-between items-center text-amber-700 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200/60 dark:border-amber-900/50">
              <div>
                <span>🎁 Item Diskon: {discountItem.name}</span>
                <span className="text-[10px] text-stone-400 block">
                  Normal: <del>Rp {discountItem.originalPrice.toLocaleString('id-ID')}</del> (Hemat Rp {discountItem.discountAmount.toLocaleString('id-ID')})
                </span>
              </div>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {discountItem.discountedPrice === 0 ? 'GRATIS (Rp 0)' : `Rp ${discountItem.discountedPrice.toLocaleString('id-ID')}`}
              </span>
            </div>
          )}

          <div className="flex justify-between text-stone-600 dark:text-stone-400">
            <span>{t('restoTax')} (PB1 10%)</span>
            <span className="font-semibold text-stone-900 dark:text-stone-100">
              Rp {pb1Tax.toLocaleString('id-ID')}
            </span>
          </div>

          {totalDiscount > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>{t('promoDiscount')} ({discountItem?.ruleName || activeRule?.name})</span>
              <span>-Rp {totalDiscount.toLocaleString('id-ID')}</span>
            </div>
          )}

          <div className="pt-2 border-t border-stone-200 dark:border-stone-700 flex justify-between items-baseline">
            <div>
              <span className="text-sm font-extrabold text-stone-900 dark:text-stone-100 font-heading">
                {t('totalBill')}
              </span>
              <span className="text-[10px] text-stone-400 block">{t('taxIncluded')}</span>
            </div>
            <span className="text-xl font-extrabold text-accent font-heading">
              Rp {totalAmount.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-3">
          <button
            type="button"
            onClick={handleHoldBill}
            disabled={items.length === 0}
            className="py-3.5 px-4 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
          >
            <PauseCircle className="w-4 h-4" />
            <span>{t('holdBill')}</span>
          </button>

          <button
            type="button"
            onClick={onProceedToPayment}
            disabled={items.length === 0}
            className="py-3.5 px-4 rounded-2xl bg-accent text-white font-bold text-xs shadow-md hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{t('payNow')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Discount Item Selector Modal */}
      <DiscountItemSelectorModal
        isOpen={isSelectorModalOpen}
        onClose={() => setIsSelectorModalOpen(false)}
        selectedRule={activeRule}
        cartItems={items}
        onSelectProduct={handleProductChosen}
        onSelectCartItem={handleCartItemChosen}
      />

      {/* Confirmation Modal to Clear Cart */}
      <ConfirmationModal
        isOpen={showClearConfirm}
        title={language === 'en' ? 'Clear Cart' : 'Kosongkan Keranjang'}
        message={language === 'en' ? 'Are you sure you want to remove all items from this order cart?' : 'Apakah Anda yakin ingin menghapus semua item dalam keranjang pesanan ini?'}
        confirmText={language === 'en' ? 'Clear' : 'Kosongkan'}
        cancelText={t('cancel')}
        confirmVariant="danger"
        onConfirm={() => {
          clearCart();
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
};
