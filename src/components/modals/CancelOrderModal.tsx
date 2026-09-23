import React, { useState } from 'react';
import { 
  X, 
  AlertTriangle, 
  RotateCcw, 
  Check, 
  FileText, 
  DollarSign, 
  CreditCard,
  Ban
} from 'lucide-react';
import { Order } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { useAuth } from '../../contexts/AuthContext';

interface CancelOrderModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onOrderCancelled: (cancelledOrder: Order) => void;
}

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  onOrderCancelled
}) => {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const { token } = useAuth();

  const [reason, setReason] = useState<string>('');
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'QRIS' | 'EDC' | 'TRANSFER'>(
    order?.paymentMethod || 'CASH'
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !order) return null;

  const refundAmount = order.totalAmount || 0;
  const reasonLength = reason.trim().length;
  const isReasonValid = reasonLength >= 5 && reasonLength <= 50;

  const quickReasons = [
    language === 'en' ? 'Customer cancelled order' : 'Pelanggan membatalkan pesanan',
    language === 'en' ? 'Item out of stock / unavailable' : 'Stok bahan habis / tidak tersedia',
    language === 'en' ? 'Order inputted by mistake' : 'Kesalahan input kasir',
    language === 'en' ? 'Customer had emergency' : 'Pelanggan mendadak harus pergi',
    language === 'en' ? 'Duplicate bill transaction' : 'Transaksi ganda atau dobel cetak'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isReasonValid) {
      showToast(
        language === 'en'
          ? 'Cancellation reason must be between 5 and 50 characters.'
          : 'Alasan pembatalan harus memiliki panjang 5 hingga 50 karakter.',
        'error'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          reason: reason.trim(),
          refundMethod
        })
      });

      const data = await res.json();
      setIsSubmitting(false);

      if (data.success && data.order) {
        showToast(
          data.message ||
            (language === 'en'
              ? 'Order cancelled and payment refunded successfully.'
              : 'Pesanan berhasil dibatalkan dan pembayaran dikembalikan.'),
          'success'
        );
        onOrderCancelled(data.order);
        onClose();
      } else {
        showToast(data.error || data.message || 'Gagal membatalkan pesanan.', 'error');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      showToast('Koneksi server terputus.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-[#1f1a19] rounded-3xl border border-red-200 dark:border-red-950/60 shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200/80 dark:border-stone-800 flex items-center justify-between bg-red-50/70 dark:bg-red-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500 text-white flex items-center justify-center font-black shadow-md shadow-red-500/20">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-stone-900 dark:text-stone-100 font-heading">
                  {language === 'en' ? 'Cancel Order & Refund' : 'Batalkan Pesanan & Kembalikan Dana'}
                </h3>
                <span className="px-2 py-0.5 rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 text-xs font-mono font-black">
                  #{order.orderNumber}
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {language === 'en'
                  ? 'Revert order status to Cancelled and record customer refund'
                  : 'Ubah status pesanan jadi Dibatalkan & catat pengembalian dana pelanggan'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          
          {/* Refund Notice Card */}
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider block">
                  {language === 'en' ? 'Total Refund to Customer' : 'Total Dana yang Harus Dikembalikan'}
                </span>
                <span className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400 font-heading">
                  Rp {refundAmount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="text-right text-xs">
              <span className="text-stone-400 block text-[10px] uppercase font-bold">
                {language === 'en' ? 'Original Pay Method' : 'Metode Bayar Awal'}
              </span>
              <span className="font-extrabold text-stone-800 dark:text-stone-200">
                {order.paymentMethod}
              </span>
            </div>
          </div>

          {/* Refund Settlement Method */}
          <div>
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 block">
              {language === 'en' ? 'Refund Method' : 'Metode Pengembalian Uang'}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['CASH', 'QRIS', 'EDC', 'TRANSFER'] as const).map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setRefundMethod(method)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    refundMethod === method
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Cancellation Reason with min 5 max 50 chars validation */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                <span>{language === 'en' ? 'Cancellation Reason *' : 'Alasan Pembatalan *'}</span>
                <span className="text-red-500">*</span>
              </label>
              <span
                className={`text-[11px] font-mono font-bold ${
                  reasonLength === 0
                    ? 'text-stone-400'
                    : isReasonValid
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-500'
                }`}
              >
                {reasonLength}/50 (min 5)
              </span>
            </div>

            <textarea
              required
              rows={2}
              minLength={5}
              maxLength={50}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={
                language === 'en'
                  ? 'Type cancellation reason (5 - 50 characters)...'
                  : 'Tuliskan alasan pembatalan (5 - 50 karakter)...'
              }
              className={`w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-800 border text-xs font-semibold text-stone-900 dark:text-stone-100 focus:outline-none transition-colors ${
                reasonLength > 0 && !isReasonValid
                  ? 'border-red-500 focus:ring-2 focus:ring-red-400'
                  : 'border-stone-200 dark:border-stone-700 focus:ring-2 focus:ring-red-500'
              }`}
            />

            {reasonLength > 0 && !isReasonValid && (
              <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {reasonLength < 5
                  ? `Kurang ${5 - reasonLength} karakter lagi (minimal 5 karakter).`
                  : 'Alasan melebihi batas 50 karakter.'}
              </p>
            )}

            {/* Quick Reason Suggestions */}
            <div className="mt-2.5">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                {language === 'en' ? 'Quick Reasons:' : 'Pilihan Alasan Cepat:'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {quickReasons.map(qr => (
                  <button
                    key={qr}
                    type="button"
                    onClick={() => setReason((qr || '').slice(0, 50))}
                    className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 text-stone-600 dark:text-stone-400 text-[11px] font-semibold border border-stone-200/60 dark:border-stone-700/60 transition-colors cursor-pointer"
                  >
                    {qr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-stone-200/80 dark:border-stone-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold text-xs transition-colors cursor-pointer"
            >
              {language === 'en' ? 'Keep Order' : 'Batal / Pertahankan'}
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !isReasonValid}
              className="px-5 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-red-600/20 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>
                    {language === 'en'
                      ? `Confirm & Refund Rp ${refundAmount.toLocaleString('id-ID')}`
                      : `Batalkan & Kembalikan Rp ${refundAmount.toLocaleString('id-ID')}`}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
