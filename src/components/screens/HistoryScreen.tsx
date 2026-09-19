import React, { useState, useEffect } from 'react';
import { Receipt, Mail, Send, CheckCircle2, AlertCircle, RefreshCw, Eye, X, Printer, DollarSign, ShoppingBag, ShieldCheck } from 'lucide-react';
import { Order } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { LoginHistoryView } from '../security/LoginHistoryView';

export const HistoryScreen: React.FC = () => {
  const { token } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  const [activeHistoryTab, setActiveHistoryTab] = useState<'TRANSACTIONS' | 'LOGIN_SECURITY'>('TRANSACTIONS');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);

  // Resend Email Modal state
  const [orderForResend, setOrderForResend] = useState<Order | null>(null);
  const [resendEmailInput, setResendEmailInput] = useState<string>('');
  const [isResending, setIsResending] = useState<boolean>(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        headers: {
          Authorization: `Bearer ${token || ''}`
        }
      });
      const data = await res.json();
      if (data.success && data.orders) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.warn('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token]);

  const handleOpenResendModal = (order: Order) => {
    setOrderForResend(order);
    setResendEmailInput(order.customer?.email || '');
  };

  const handleSendReceiptEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForResend || !resendEmailInput) {
      showToast('Masukkan alamat email tujuan.', 'error');
      return;
    }

    setIsResending(true);
    try {
      const res = await fetch(`/api/orders/${orderForResend.id}/resend-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({ targetEmail: resendEmailInput })
      });
      const data = await res.json();
      setIsResending(false);

      if (data.success) {
        showToast(`Struk berhasil dikirimkan ke ${resendEmailInput}!`, 'success');
        setOrderForResend(null);
        fetchOrders();
      } else {
        showToast(data.error || 'Gagal mengirimkan struk email.', 'error');
      }
    } catch (err) {
      setIsResending(false);
      showToast('Koneksi server gagal.', 'error');
    }
  };

  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-4xl mx-auto flex flex-col gap-5">
      {/* 1. Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-200/80 dark:border-stone-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-stone-900 dark:text-stone-100">
            {t('salesHistoryTitle')}
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {t('salesSubtitle')}
          </p>
        </div>

        <button
          onClick={fetchOrders}
          disabled={loading}
          className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-600 dark:text-stone-300 transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200/80 dark:border-stone-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveHistoryTab('TRANSACTIONS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
            activeHistoryTab === 'TRANSACTIONS'
              ? 'bg-accent text-white shadow-xs'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>{t('salesHistoryTitle')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveHistoryTab('LOGIN_SECURITY')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
            activeHistoryTab === 'LOGIN_SECURITY'
              ? 'bg-accent text-white shadow-xs'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{t('loginHistoryTitle')}</span>
        </button>
      </div>

      {activeHistoryTab === 'LOGIN_SECURITY' ? (
        <LoginHistoryView />
      ) : (
        <>
          {/* 2. Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-400 block mb-1">
            {t('totalOrders')}
          </span>
          <span className="text-xl font-extrabold text-stone-900 dark:text-stone-100 font-heading">
            {orders.length}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-400 block mb-1">
            {t('totalRevenue')}
          </span>
          <span className="text-xl font-extrabold text-accent font-heading">
            Rp {totalRevenue.toLocaleString('id-ID')}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-stone-400 block mb-1">
            {language === 'en' ? 'SMTP Server Status' : 'Status Pengiriman SMTP'}
          </span>
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {language === 'en' ? 'Active (mail.marmeam.com)' : 'Aktif (mail.marmeam.com)'}
          </span>
        </div>
      </div>

      {/* 3. Orders List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-3xl bg-stone-200/60 dark:bg-stone-800/60 animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center text-stone-400 bg-white dark:bg-[#251e1c] rounded-3xl border border-dashed border-stone-200 dark:border-stone-800">
          <Receipt className="w-10 h-10 mx-auto opacity-30 mb-2" />
          <p className="text-sm font-semibold">{t('noOrdersFound')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            return (
              <div
                key={order.id}
                className="p-4 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-accent">
                      {language === 'en' ? 'Queue #' : 'Antrean #'}{order.orderNumber}
                    </span>
                    <span className="text-stone-300">•</span>
                    <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                      {new Date(order.createdAt).toLocaleString(language === 'en' ? 'en-US' : 'id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>

                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-1">
                    {order.items?.map(it => `${it.name} (${it.quantity})`).join(', ')}
                    {order.discountItem && (
                      <span className="text-accent font-semibold ml-1.5">
                        + 🎁 {language === 'en' ? 'Discount Item:' : 'Item Diskon:'} {order.discountItem.name}
                      </span>
                    )}
                  </p>

                  <div className="flex items-center gap-2 mt-2 text-[11px]">
                    <span className="text-stone-400">
                      {t('roleCashier')}: {order.cashier?.name || t('roleCashier')}
                    </span>
                    {order.customer?.name && (
                      <>
                        <span className="text-stone-300">•</span>
                        <span className="text-stone-600 dark:text-stone-400">
                          {order.customer.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Total, Email status & Actions */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-stone-800">
                  <div className="text-right">
                    <div className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-stone-100 font-heading">
                      Rp {order.totalAmount?.toLocaleString('id-ID')}
                    </div>
                    {/* Email status badge */}
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      {order.emailStatus === 'success' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {t('statusSent')}
                        </span>
                      ) : order.emailStatus === 'failed' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {t('statusFailed')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-400">
                          {t('statusNoEmail')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForDetail(order)}
                      className="px-2.5 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title={t('viewReceipt')}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t('viewReceipt')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenResendModal(order)}
                      className="px-2.5 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 text-accent text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title={language === 'en' ? 'Resend Receipt via Email' : 'Kirim Ulang Struk via Email'}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{language === 'en' ? 'Send Email' : 'Kirim Email'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Detail Receipt Modal */}
      {selectedOrderForDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
          }}
        >
          <div className="w-full max-w-sm bg-white dark:bg-[#251e1c] rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 flex flex-col gap-3 font-mono text-xs max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-700">
              <span className="font-bold font-heading text-sm">
                {language === 'en' ? 'SIPSPOT OFFICIAL RECEIPT' : 'STRUK RESMI SIPSPOT'}
              </span>
              <button
                onClick={() => setSelectedOrderForDetail(null)}
                className="p-1 text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="font-bold text-accent">
              {language === 'en' ? 'Queue No.:' : 'No. Antrean:'} #{selectedOrderForDetail.orderNumber}
            </div>
            <div>
              {language === 'en' ? 'Time:' : 'Waktu:'} {new Date(selectedOrderForDetail.createdAt).toLocaleString(language === 'en' ? 'en-US' : 'id-ID')}
            </div>
            <div>
              {language === 'en' ? 'Cashier:' : 'Kasir:'} {selectedOrderForDetail.cashier?.name}
            </div>
            {selectedOrderForDetail.customer?.name && (
              <div>
                {language === 'en' ? 'Customer:' : 'Pelanggan:'} {selectedOrderForDetail.customer.name}
              </div>
            )}

            <div className="py-2 border-t border-b border-dashed border-stone-300 dark:border-stone-700 space-y-1">
              {selectedOrderForDetail.items?.map((it, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>
                    {it.name} x{it.quantity}
                  </span>
                  <span>Rp {it.itemTotal?.toLocaleString('id-ID')}</span>
                </div>
              ))}
              {selectedOrderForDetail.discountItem && (
                <div className="mt-1.5 p-2 rounded-xl bg-orange-50/80 dark:bg-orange-950/40 border border-dashed border-orange-300 dark:border-orange-800 text-[11px]">
                  <div className="flex justify-between font-bold text-accent">
                    <span>🎁 {language === 'en' ? 'DISCOUNT ITEM:' : 'ITEM DISKON:'} {selectedOrderForDetail.discountItem.name}</span>
                    <span>
                      {selectedOrderForDetail.discountItem.discountedPrice === 0
                        ? (language === 'en' ? 'FREE (Rp 0)' : 'GRATIS (Rp 0)')
                        : `Rp ${selectedOrderForDetail.discountItem.discountedPrice?.toLocaleString('id-ID')}`}
                    </span>
                  </div>
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 flex justify-between mt-0.5">
                    <span>{selectedOrderForDetail.discountItem.ruleName}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {language === 'en' ? 'Saved' : 'Hemat'} Rp {selectedOrderForDetail.discountItem.discountAmount?.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>Rp {selectedOrderForDetail.subtotal?.toLocaleString('id-ID')}</span>
              </div>
              {selectedOrderForDetail.discountAmount > 0 && (
                <div className="flex justify-between text-accent font-bold">
                  <span>{language === 'en' ? 'Discount:' : 'Diskon:'}</span>
                  <span>-Rp {selectedOrderForDetail.discountAmount?.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>PB1 (10%):</span>
                <span>Rp {selectedOrderForDetail.pb1Tax?.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-stone-300 dark:border-stone-700">
                <span>TOTAL:</span>
                <span>Rp {selectedOrderForDetail.totalAmount?.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'en' ? 'Method:' : 'Metode:'}</span>
                <span>{selectedOrderForDetail.paymentMethod}</span>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="mt-2 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{language === 'en' ? 'Print Physical Receipt' : 'Cetak Struk Fisik'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Resend Email Modal */}
      {orderForResend && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
          }}
        >
          <form
            onSubmit={handleSendReceiptEmail}
            className="w-full max-w-sm bg-white dark:bg-[#251e1c] rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-heading">{t('resendReceipt')}</h3>
                  <p className="text-[11px] text-stone-400">Order #{orderForResend.orderNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderForResend(null)}
                className="p-1 text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                {language === 'en' ? 'Recipient Email Address' : 'Alamat Email Penerima'}
              </label>
              <input
                type="email"
                value={resendEmailInput}
                onChange={e => setResendEmailInput(e.target.value)}
                placeholder="customer@example.com"
                required
                className="w-full px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <span className="text-[10px] text-stone-400 mt-1 block">
                {language === 'en'
                  ? 'HTML receipt automatically delivered via SMTP server (mail.marmeam.com)'
                  : 'Struk HTML otomatis dikirim via SMTP server (mail.marmeam.com)'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOrderForResend(null)}
                className="py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold cursor-pointer"
              >
                {t('cancelBtn')}
              </button>
              <button
                type="submit"
                disabled={isResending}
                className="py-2.5 rounded-xl bg-accent text-white text-xs font-semibold shadow-sm hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {language === 'en'
                    ? (isResending ? 'Sending...' : 'Send Now')
                    : (isResending ? 'Mengirim...' : 'Kirim Sekarang')}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
