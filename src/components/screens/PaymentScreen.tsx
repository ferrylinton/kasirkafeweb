import React, { useState } from 'react';
import { ArrowLeft, Banknote, QrCode, CreditCard, Landmark, Check, Mail, Printer, Share2, AlertCircle, Sparkles, X } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { Order } from '../../types';

interface PaymentScreenProps {
  onBackToCart: () => void;
  onPaymentComplete: () => void;
}

export const PaymentScreen: React.FC<PaymentScreenProps> = ({ onBackToCart, onPaymentComplete }) => {
  const {
    items,
    customerName,
    setCustomerName,
    customerEmail,
    setCustomerEmail,
    customerPhone,
    setCustomerPhone,
    selectedDiscountCode,
    discountItem,
    subtotal,
    pb1Tax,
    totalDiscount,
    totalAmount,
    clearCart,
    activeDraftId,
    activeDraftNumber,
    activeDraftNote,
    clearActiveDraft,
    loadSavedOrders
  } = useCart();

  const { t, language } = useLanguage();
  const { token } = useAuth();
  const { showToast } = useToast();

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'EDC' | 'TRANSFER'>('CASH');
  const [cashReceived, setCashReceived] = useState<number>(100000);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Cash presets
  const cashPresets = [
    { label: t('exactAmount'), value: totalAmount },
    { label: 'Rp 100.000', value: 100000 },
    { label: 'Rp 150.000', value: 150000 },
    { label: 'Rp 200.000', value: 200000 }
  ];

  const change = Math.max(0, cashReceived - totalAmount);
  const isUnderpaid = paymentMethod === 'CASH' && cashReceived < totalAmount;

  const handleProcessPayment = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);

    try {
      const payload = {
        items: items.map(it => ({
          productId: it.productId,
          name: it.name,
          category: it.category,
          price: it.price,
          quantity: it.quantity,
          size: it.modifier?.size,
          ice: it.modifier?.ice,
          sugar: it.modifier?.sugar,
          milk: it.modifier?.milk,
          toppings: it.modifier?.toppings,
          notes: it.modifier?.notes,
          itemTotal: it.itemTotal
        })),
        discountItem: discountItem || undefined,
        selectedDiscountCode: selectedDiscountCode || undefined,
        paymentMethod,
        cashReceived: paymentMethod === 'CASH' ? cashReceived : totalAmount,
        customerName: customerName || undefined,
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
        draftId: activeDraftId || undefined
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setIsSubmitting(false);

      if (data.success && data.order) {
        showToast(t('paymentSuccessToast'), 'success');
        if (customerEmail && data.emailSent) {
          showToast(`Struk otomatis terkirim via SMTP ke ${customerEmail}`, 'info');
        }
        if (activeDraftId) {
          clearActiveDraft();
          loadSavedOrders();
        }
        setCompletedOrder(data.order);
      } else {
        showToast(data.error || 'Gagal memproses pembayaran.', 'error');
      }
    } catch (err) {
      setIsSubmitting(false);
      showToast('Koneksi server gagal.', 'error');
    }
  };

  const handleFinishTransaction = () => {
    clearCart();
    setCompletedOrder(null);
    onPaymentComplete();
  };

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-2xl mx-auto flex flex-col gap-5">
      {/* 1. Header with Back Button */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-200/80 dark:border-stone-800">
        <button
          type="button"
          onClick={onBackToCart}
          className="flex items-center gap-2 text-xs font-bold text-stone-600 dark:text-stone-300 hover:text-accent transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{language === 'en' ? 'Back to Cart' : 'Kembali ke Keranjang'}</span>
        </button>
        <span className="text-xs font-bold text-accent uppercase tracking-wider">
          {t('readyToPay')}
        </span>
      </div>

      {/* 2. Total Bill Banner */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            {t('totalBill')}
          </span>
          <p className="text-[11px] text-stone-400">
            {items.reduce((acc, it) => acc + it.quantity, 0)} item pesanan
            {discountItem && (
              <span className="text-accent font-semibold ml-1">
                + 1 Item Diskon ({discountItem.name})
              </span>
            )}
          </p>
        </div>
        <span className="text-2xl sm:text-3xl font-extrabold text-accent font-heading">
          Rp {totalAmount.toLocaleString('id-ID')}
        </span>
      </div>

      {/* 3. Payment Method Selector matching Image 9 */}
      <div className="bg-white dark:bg-[#251e1c] rounded-3xl p-5 shadow-2xs border border-stone-200/80 dark:border-stone-800 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            {t('paymentMethod')}
          </span>
          <span className="text-[10px] text-stone-400">{t('chooseOne')}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Uang Tunai */}
          <button
            type="button"
            onClick={() => setPaymentMethod('CASH')}
            className={`p-3.5 rounded-2xl border text-left flex flex-col items-start gap-1 transition-all ${
              paymentMethod === 'CASH'
                ? 'border-accent bg-orange-50/70 dark:bg-orange-950/40 text-accent font-bold ring-1 ring-accent'
                : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
            }`}
          >
            <Banknote className="w-5 h-5 mb-1" />
            <span className="text-xs font-bold">{t('cash')}</span>
            <span className="text-[10px] opacity-75">{t('cashSubtitle')}</span>
          </button>

          {/* QRIS */}
          <button
            type="button"
            onClick={() => setPaymentMethod('QRIS')}
            className={`p-3.5 rounded-2xl border text-left flex flex-col items-start gap-1 transition-all ${
              paymentMethod === 'QRIS'
                ? 'border-accent bg-orange-50/70 dark:bg-orange-950/40 text-accent font-bold ring-1 ring-accent'
                : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
            }`}
          >
            <QrCode className="w-5 h-5 mb-1" />
            <span className="text-xs font-bold">{t('qris')}</span>
            <span className="text-[10px] opacity-75">{t('qrisSubtitle')}</span>
          </button>

          {/* EDC Card */}
          <button
            type="button"
            onClick={() => setPaymentMethod('EDC')}
            className={`p-3.5 rounded-2xl border text-left flex flex-col items-start gap-1 transition-all ${
              paymentMethod === 'EDC'
                ? 'border-accent bg-orange-50/70 dark:bg-orange-950/40 text-accent font-bold ring-1 ring-accent'
                : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
            }`}
          >
            <CreditCard className="w-5 h-5 mb-1" />
            <span className="text-xs font-bold">{t('edc')}</span>
            <span className="text-[10px] opacity-75">{t('edcSubtitle')}</span>
          </button>

          {/* Transfer Bank */}
          <button
            type="button"
            onClick={() => setPaymentMethod('TRANSFER')}
            className={`p-3.5 rounded-2xl border text-left flex flex-col items-start gap-1 transition-all ${
              paymentMethod === 'TRANSFER'
                ? 'border-accent bg-orange-50/70 dark:bg-orange-950/40 text-accent font-bold ring-1 ring-accent'
                : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
            }`}
          >
            <Landmark className="w-5 h-5 mb-1" />
            <span className="text-xs font-bold">{t('transfer')}</span>
            <span className="text-[10px] opacity-75">{t('transferSubtitle')}</span>
          </button>
        </div>

        {/* Dynamic Cash Input & Change Calculation */}
        {paymentMethod === 'CASH' && (
          <div className="mt-3 p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-700 dark:text-stone-300">
                {t('receivedAmount')}
              </span>
              <span className="text-stone-400">Pilih nominal atau ketik</span>
            </div>

            {/* Cash Presets */}
            <div className="grid grid-cols-4 gap-2">
              {cashPresets.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setCashReceived(preset.value)}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all ${
                    cashReceived === preset.value
                      ? 'border-accent bg-accent text-white shadow-xs'
                      : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400">
                Rp
              </span>
              <input
                type="number"
                value={cashReceived}
                onChange={e => setCashReceived(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* Change Status */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800 text-sm">
              <span className="font-semibold text-stone-600 dark:text-stone-400">
                {isUnderpaid ? t('underpaid') : t('changeAmount')}
              </span>
              <span
                className={`font-extrabold ${
                  isUnderpaid ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                Rp {Math.abs(cashReceived - totalAmount).toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        )}

        {/* QRIS / EDC helper badge */}
        {paymentMethod === 'QRIS' && (
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 flex flex-col items-center text-center gap-2">
            <div className="w-32 h-32 bg-white p-2 rounded-xl shadow-xs flex items-center justify-center">
              <QrCode className="w-28 h-28 text-stone-900" />
            </div>
            <p className="text-xs font-bold text-stone-800 dark:text-stone-200">
              QRIS Statis Toko KasirKafe Senopati
            </p>
            <p className="text-[11px] text-stone-400">
              Pelanggan dapat scan menggunakan aplikasi e-wallet apa saja.
            </p>
          </div>
        )}
      </div>

      {/* 4. Eco E-Receipt & Customer Inputs matching Image 9 */}
      <div className="bg-white dark:bg-[#251e1c] rounded-3xl p-5 shadow-2xs border border-stone-200/80 dark:border-stone-800 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-accent" />
            {t('sendReceiptTitle')}
          </span>
          <span className="text-[10px] text-emerald-600 font-semibold">{t('ecoPaperless')}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 block mb-1">
              Email Pelanggan (Opsional - kirim struk)
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={e => setCustomerEmail(e.target.value)}
              placeholder="nama@gmail.com (opsional)"
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 block mb-1">
              No. WhatsApp Pelanggan (Opsional)
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              placeholder="0812-xxxx-xxxx (opsional)"
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
      </div>

      {/* 5. Submit Pay Button */}
      <button
        type="button"
        onClick={() => setShowConfirmModal(true)}
        disabled={isSubmitting || isUnderpaid}
        className="w-full py-4 rounded-2xl bg-accent text-white font-bold text-sm shadow-lg hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <span>{t('processingPayment')}</span>
        ) : (
          <>
            <span>{t('payAndPrint')}</span>
            <span>•</span>
            <span>Rp {totalAmount.toLocaleString('id-ID')}</span>
          </>
        )}
      </button>

      {/* Confirmation Dialog before payment process */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        title={t('confirmSaveTxTitle')}
        message={`${t('confirmSaveTxMessage')} Total: Rp ${totalAmount.toLocaleString('id-ID')} via ${paymentMethod}.`}
        confirmText={language === 'en' ? 'Yes, Complete Payment' : 'Ya, Selesaikan Pembayaran'}
        cancelText={t('cancel')}
        confirmVariant="success"
        onConfirm={handleProcessPayment}
        onCancel={() => setShowConfirmModal(false)}
      />

      {/* Success Receipt Modal */}
      {completedOrder && (
        <div
          id="receipt-modal-backdrop"
          onClick={handleFinishTransaction}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
          }}
        >
          <div
            id="receipt-content-box"
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-[#251e1c] rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 flex flex-col gap-4 max-h-[90vh] overflow-y-auto relative"
          >
            {/* Close Button */}
            <button
              type="button"
              id="close-receipt-modal-button"
              onClick={handleFinishTransaction}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 flex items-center justify-center transition-all cursor-pointer z-10 shadow-xs active:scale-95"
              title={language === 'en' ? 'Close Receipt' : 'Tutup Struk'}
              aria-label={language === 'en' ? 'Close Receipt' : 'Tutup Struk'}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="text-center pb-3 border-b border-dashed border-stone-200 dark:border-stone-700">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold font-heading">{t('paymentSuccessToast')}</h3>
              
              <div className="mt-2.5 inline-flex flex-col items-center px-6 py-2 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800/60">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-orange-600 dark:text-orange-400">
                  {language === 'en' ? "Today's Queue Number" : 'Nomor Antrean Hari Ini'}
                </span>
                <span className="text-2xl sm:text-3xl font-black text-accent font-heading">
                  #{completedOrder.orderNumber}
                </span>
              </div>
            </div>

            {/* Receipt Content */}
            <div className="text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span>{language === 'en' ? 'Date:' : 'Tanggal:'}</span>
                <span>{new Date(completedOrder.createdAt).toLocaleString(language === 'en' ? 'en-US' : 'id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'en' ? 'Cashier:' : 'Kasir:'}</span>
                <span>{completedOrder.cashier?.name || (language === 'en' ? 'KasirKafe Cashier' : 'Kasir KasirKafe')}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'en' ? 'Queue No.:' : 'No. Antrean:'}</span>
                <span className="font-bold text-accent">#{completedOrder.orderNumber}</span>
              </div>
              {completedOrder.customer?.name && (
                <div className="flex justify-between">
                  <span>{language === 'en' ? 'Customer:' : 'Pelanggan:'}</span>
                  <span>{completedOrder.customer.name}</span>
                </div>
              )}

              <div className="pt-2 border-t border-dashed border-stone-200 dark:border-stone-700">
                {completedOrder.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between py-0.5">
                    <span>
                      {it.name} x{it.quantity}
                    </span>
                    <span>Rp {it.itemTotal.toLocaleString('id-ID')}</span>
                  </div>
                ))}
                {completedOrder.discountItem && (
                  <div className="mt-2 p-2.5 rounded-xl bg-orange-50/90 dark:bg-orange-950/40 border border-dashed border-orange-300 dark:border-orange-800 text-[11px]">
                    <div className="flex justify-between font-bold text-accent">
                      <span>🎁 {language === 'en' ? 'DISCOUNT ITEM:' : 'ITEM DISKON:'} {completedOrder.discountItem.name}</span>
                      <span>
                        {completedOrder.discountItem.discountedPrice === 0
                          ? (language === 'en' ? 'FREE (Rp 0)' : 'GRATIS (Rp 0)')
                          : `Rp ${completedOrder.discountItem.discountedPrice.toLocaleString('id-ID')}`}
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-500 dark:text-stone-400 flex justify-between mt-0.5">
                      <span>{completedOrder.discountItem.ruleName}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {language === 'en' ? 'Saved' : 'Hemat'} Rp {completedOrder.discountItem.discountAmount.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-dashed border-stone-200 dark:border-stone-700 space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>Rp {completedOrder.subtotal.toLocaleString('id-ID')}</span>
                </div>
                {completedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-accent font-bold">
                    <span>{language === 'en' ? 'Promo Discount:' : 'Diskon Promo:'}</span>
                    <span>-Rp {completedOrder.discountAmount.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>PB1 (10%):</span>
                  <span>Rp {completedOrder.pb1Tax.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-stone-200 dark:border-stone-700">
                  <span>TOTAL:</span>
                  <span>Rp {completedOrder.totalAmount.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{language === 'en' ? 'Method:' : 'Metode:'}</span>
                  <span>{completedOrder.paymentMethod}</span>
                </div>
                {completedOrder.paymentMethod === 'CASH' && (
                  <div className="flex justify-between">
                    <span>{language === 'en' ? 'Change:' : 'Kembalian:'}</span>
                    <span>Rp {completedOrder.change.toLocaleString('id-ID')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Email delivery badge */}
            {completedOrder.customer?.email && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Mail className="w-4 h-4 shrink-0" />
                <span>
                  {language === 'en' ? (
                    <>Receipt automatically sent to <strong>{completedOrder.customer.email}</strong> via SMTP server!</>
                  ) : (
                    <>Struk otomatis dikirimkan ke <strong>{completedOrder.customer.email}</strong> via SMTP server!</>
                  )}
                </span>
              </div>
            )}

            {/* Done Action */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="py-3 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{language === 'en' ? 'Print Receipt' : 'Cetak Struk'}</span>
              </button>
              <button
                type="button"
                onClick={handleFinishTransaction}
                className="py-3 rounded-2xl bg-accent text-white font-bold text-xs shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{language === 'en' ? 'New Transaction' : 'Transaksi Baru'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
