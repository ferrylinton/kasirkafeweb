import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  X, 
  Printer, 
  DollarSign, 
  ShoppingBag,
  PauseCircle,
  Clock,
  FileText,
  User,
  Phone,
  ArrowRight,
  Trash2,
  Edit3,
  Scale,
  Ban,
  RotateCcw
} from 'lucide-react';
import { Order, SavedOrder } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { AdminAllVendorsHeader, VendorBadge } from '../common/AdminAllVendorsHeader';
import { useCart } from '../../contexts/CartContext';
import { EditPaidOrderModal } from '../modals/EditPaidOrderModal';
import { CancelOrderModal } from '../modals/CancelOrderModal';

interface OrderHistoryScreenProps {
  allVendorsMode?: boolean;
  onNavigateTab?: (tab: string) => void;
}

export const OrderHistoryScreen: React.FC<OrderHistoryScreenProps> = ({ 
  allVendorsMode = false,
  onNavigateTab
}) => {
  const { token } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const { 
    savedOrders, 
    isLoadingSavedOrders, 
    loadSavedOrders, 
    loadDraftIntoCart, 
    deleteSavedOrderDraft 
  } = useCart();

  const [historyTab, setHistoryTab] = useState<'completed' | 'hold'>('completed');
  const [completedStatusFilter, setCompletedStatusFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [draftDeleteConfirmId, setDraftDeleteConfirmId] = useState<string | null>(null);
  const [isDeletingDraft, setIsDeletingDraft] = useState<boolean>(false);

  // Resend Email Modal state
  const [orderForResend, setOrderForResend] = useState<Order | null>(null);
  const [resendEmailInput, setResendEmailInput] = useState<string>('');
  const [isResending, setIsResending] = useState<boolean>(false);

  // Edit Paid Order modal state
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);

  // Cancel Paid Order modal state
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const url = allVendorsMode
        ? (selectedVendor === 'all' ? '/api/orders?allVendors=true' : `/api/orders?vendorId=${selectedVendor}`)
        : '/api/orders';

      const res = await fetch(url, {
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
  }, [token, allVendorsMode, selectedVendor]);

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

  const handleOrderUpdated = (updatedOrder: Order) => {
    setOrders(prev => prev.map(o => (o.id === updatedOrder.id ? updatedOrder : o)));
    if (selectedOrderForDetail && selectedOrderForDetail.id === updatedOrder.id) {
      setSelectedOrderForDetail(updatedOrder);
    }
    fetchOrders();
  };

  const handleOrderCancelled = (cancelledOrder: Order) => {
    setOrders(prev => prev.map(o => (o.id === cancelledOrder.id ? cancelledOrder : o)));
    if (selectedOrderForDetail && selectedOrderForDetail.id === cancelledOrder.id) {
      setSelectedOrderForDetail(cancelledOrder);
    }
    fetchOrders();
  };

  const safeOrders = orders || [];
  const safeSavedOrders = savedOrders || [];

  const totalRevenue = safeOrders
    .filter(o => o?.status !== 'CANCELLED')
    .reduce((sum, o) => sum + (o?.totalAmount || 0), 0);
  const totalHoldValue = safeSavedOrders.reduce((sum, o) => sum + (o?.totalAmount || 0), 0);

  const handleLoadDraftToCart = (draft: SavedOrder) => {
    loadDraftIntoCart(draft);
    showToast(
      language === 'en'
        ? `Order #${draft.draftNumber} loaded into POS cart!`
        : `Pesanan #${draft.draftNumber} dibuka di kasir! Silakan ubah atau bayar.`,
      'success'
    );
    if (onNavigateTab) {
      onNavigateTab('pesanan');
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    setIsDeletingDraft(true);
    const res = await deleteSavedOrderDraft(draftId);
    setIsDeletingDraft(false);
    setDraftDeleteConfirmId(null);
    if (res.success) {
      showToast(
        language === 'en' ? 'Saved order deleted.' : 'Pesanan tersimpan berhasil dihapus.',
        'info'
      );
    } else {
      showToast(res.error || 'Gagal menghapus pesanan', 'error');
    }
  };

  const formatElapsed = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return language === 'en' ? 'Just now' : 'Baru saja';
      if (diffMins < 60) return `${diffMins} ${language === 'en' ? 'mins ago' : 'menit lalu'}`;
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours} ${language === 'en' ? 'hours ago' : 'jam lalu'}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-4xl mx-auto flex flex-col gap-5">
      {/* 1. Header */}
      {allVendorsMode ? (
        <AdminAllVendorsHeader
          title={t('navAdminOrders')}
          subtitle="Pantau dan kelola seluruh riwayat transaksi pesanan kasir dari seluruh vendor jaringan"
          selectedVendor={selectedVendor}
          onVendorChange={setSelectedVendor}
          onRefresh={fetchOrders}
          isLoading={loading}
          itemCount={orders.length}
          itemLabel="Pesanan"
        />
      ) : (
        <div className="flex items-center justify-between pb-3 border-b border-stone-200/80 dark:border-stone-800">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-heading text-stone-900 dark:text-stone-100">
              {t('salesHistoryTitle')}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              {t('salesSubtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchOrders();
                loadSavedOrders();
              }}
              disabled={loading || isLoadingSavedOrders}
              className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-600 dark:text-stone-300 transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading || isLoadingSavedOrders ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Tab Switcher: Completed Orders vs Saved Orders (Hold) */}
      <div className="flex items-center gap-2 p-1.5 bg-stone-100 dark:bg-stone-900/60 rounded-2xl w-fit border border-stone-200/80 dark:border-stone-800">
        <button
          type="button"
          onClick={() => setHistoryTab('completed')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            historyTab === 'completed'
              ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
              : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
          }`}
        >
          <Receipt className="w-4 h-4 text-accent" />
          <span>{language === 'en' ? 'Paid Orders' : 'Selesai Dibayar'}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 font-extrabold">
            {safeOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setHistoryTab('hold')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            historyTab === 'hold'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
          }`}
        >
          <PauseCircle className="w-4 h-4" />
          <span>{language === 'en' ? 'Saved Orders (Hold)' : 'Pesanan Tersimpan (Hold)'}</span>
          {safeSavedOrders.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              historyTab === 'hold' ? 'bg-amber-700 text-white' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
            }`}>
              {safeSavedOrders.length}
            </span>
          )}
        </button>
      </div>

      {/* 2. Metric Cards */}
      {historyTab === 'completed' ? (
        <>
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

          {/* Status Sub-filter: All / Completed / Cancelled */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 p-1 bg-stone-100 dark:bg-stone-900/60 rounded-xl border border-stone-200/80 dark:border-stone-800 text-xs">
              <button
                type="button"
                onClick={() => setCompletedStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  completedStatusFilter === 'ALL'
                    ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                }`}
              >
                {language === 'en' ? 'All Orders' : 'Semua Pesanan'} ({orders.length})
              </button>

              <button
                type="button"
                onClick={() => setCompletedStatusFilter('COMPLETED')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  completedStatusFilter === 'COMPLETED'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                }`}
              >
                {language === 'en' ? 'Completed' : 'Selesai'} ({orders.filter(o => o.status !== 'CANCELLED').length})
              </button>

              <button
                type="button"
                onClick={() => setCompletedStatusFilter('CANCELLED')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  completedStatusFilter === 'CANCELLED'
                    ? 'bg-red-600 text-white shadow-2xs'
                    : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                }`}
              >
                {language === 'en' ? 'Cancelled / Refunded' : 'Dibatalkan'} ({orders.filter(o => o.status === 'CANCELLED').length})
              </button>
            </div>
          </div>

          {/* 3. Completed Orders List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 rounded-3xl bg-stone-200/60 dark:bg-stone-800/60 animate-pulse" />
              ))}
            </div>
          ) : orders.filter(o => completedStatusFilter === 'ALL' || (completedStatusFilter === 'CANCELLED' ? o.status === 'CANCELLED' : o.status !== 'CANCELLED')).length === 0 ? (
            <div className="py-16 text-center text-stone-400 bg-white dark:bg-[#251e1c] rounded-3xl border border-dashed border-stone-200 dark:border-stone-800">
              <Receipt className="w-10 h-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm font-semibold">{t('noOrdersFound')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders
                .filter(o => completedStatusFilter === 'ALL' || (completedStatusFilter === 'CANCELLED' ? o.status === 'CANCELLED' : o.status !== 'CANCELLED'))
                .map(order => {
                return (
                  <div
                    key={order.id}
                    className="p-4 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-accent">
                          {language === 'en' ? 'Queue #' : 'Antrean #'}{order.orderNumber}
                        </span>
                        {allVendorsMode && (
                          <VendorBadge vendorId={order.vendorId} />
                        )}
                        {order.status === 'CANCELLED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 flex items-center gap-1">
                            <Ban className="w-3 h-3" />
                            {language === 'en' ? 'Cancelled / Refunded' : 'Dibatalkan (Refund)'}
                          </span>
                        ) : order.isAdjusted ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                            <Scale className="w-3 h-3" />
                            {language === 'en' ? 'Adjusted' : 'Diperbaiki'}
                          </span>
                        ) : null}
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

                      {order.status === 'CANCELLED' && order.cancellation?.reason && (
                        <div className="mt-2 text-[11px] px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 border border-red-200/60 dark:border-red-900/40">
                          <span className="font-bold">{language === 'en' ? 'Reason: ' : 'Alasan Pembatalan: '}</span>
                          <span>"{order.cancellation.reason}"</span>
                          <span className="text-[10px] text-stone-400 ml-1.5">
                            ({order.cancellation.cancelledBy})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right: Total, Email status & Actions */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-stone-800">
                      <div className="text-right">
                        <div className={`text-sm sm:text-base font-extrabold font-heading ${
                          order.status === 'CANCELLED' 
                            ? 'line-through text-red-500 opacity-70' 
                            : 'text-stone-900 dark:text-stone-100'
                        }`}>
                          Rp {order.totalAmount?.toLocaleString('id-ID')}
                        </div>
                        {order.status === 'CANCELLED' && (
                          <div className="text-[10px] font-extrabold text-red-600 dark:text-red-400">
                            {language === 'en' ? 'Refunded: ' : 'Dana Kembali: '}
                            Rp {order.totalAmount?.toLocaleString('id-ID')}
                          </div>
                        )}
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

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {order.status !== 'CANCELLED' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setOrderToEdit(order)}
                              className="px-2.5 py-1.5 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title={language === 'en' ? 'Modify Order & Recalculate' : 'Ubah Pesanan & Hitung Ulang'}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>{language === 'en' ? 'Edit Order' : 'Ubah Pesanan'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setOrderToCancel(order)}
                              className="px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title={language === 'en' ? 'Cancel Order & Refund' : 'Batalkan Pesanan & Kembalikan Pembayaran'}
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>{language === 'en' ? 'Cancel' : 'Batalkan'}</span>
                            </button>
                          </>
                        )}

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
      ) : (
        /* HOLD / SAVED ORDERS TAB */
        <>
          {/* Hold Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-2xs">
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 block mb-1">
                {language === 'en' ? 'Total Hold Orders' : 'Total Pesanan Tersimpan'}
              </span>
              <span className="text-xl font-extrabold text-amber-900 dark:text-amber-100 font-heading">
                {safeSavedOrders.length}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs">
              <span className="text-[11px] font-semibold text-stone-400 block mb-1">
                {language === 'en' ? 'Pending Bill Value' : 'Estimasi Nilai Tertunda'}
              </span>
              <span className="text-xl font-extrabold text-accent font-heading">
                Rp {totalHoldValue.toLocaleString('id-ID')}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-stone-400 block mb-1">
                {language === 'en' ? 'Workflow Action' : 'Status Alur'}
              </span>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <PauseCircle className="w-4 h-4" />
                {language === 'en' ? 'Ready to Edit & Pay' : 'Siap Diubah & Dibayar di Kasir'}
              </span>
            </div>
          </div>

          {/* Hold Orders List */}
          {isLoadingSavedOrders && safeSavedOrders.length === 0 ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-28 rounded-3xl bg-stone-200/60 dark:bg-stone-800/60 animate-pulse" />
              ))}
            </div>
          ) : safeSavedOrders.length === 0 ? (
            <div className="py-16 text-center text-stone-400 bg-white dark:bg-[#251e1c] rounded-3xl border border-dashed border-stone-200 dark:border-stone-800">
              <PauseCircle className="w-10 h-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm font-semibold">
                {language === 'en' ? 'No hold orders currently' : 'Tidak ada pesanan yang sedang disimpan'}
              </p>
              <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                {language === 'en'
                  ? 'Cashiers can hold an order before payment. It will appear here and can be opened to edit anytime.'
                  : 'Kasir dapat menyimpan pesanan sebelum bayar. Pesanan akan muncul di sini dan dapat dibuka kembali untuk diubah.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {safeSavedOrders.map(order => {
                return (
                  <div
                    key={order.id}
                    className="p-4 rounded-3xl bg-white dark:bg-[#251e1c] border border-amber-500/20 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-500/40 transition-all"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-xs px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          {order.draftNumber}
                        </span>
                        <span className="font-extrabold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-stone-400" />
                          {order.tableNameOrNote || 'Pesanan Disimpan'}
                        </span>
                        <span className="text-stone-300">•</span>
                        <span className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-stone-400" />
                          {formatElapsed(order.updatedAt || order.createdAt)}
                        </span>
                      </div>

                      <div className="bg-stone-50/70 dark:bg-stone-900/40 p-2 rounded-xl border border-stone-100 dark:border-stone-800/80 mt-2">
                        <p className="text-xs text-stone-700 dark:text-stone-300 font-semibold line-clamp-2">
                          {order.items?.map(it => {
                            const mods: string[] = [];
                            if (it.modifier?.size && it.modifier.size !== 'Regular') mods.push(it.modifier.size);
                            if (it.modifier?.ice) mods.push(it.modifier.ice);
                            const modStr = mods.length > 0 ? ` (${mods.join(', ')})` : '';
                            return `${it.quantity}x ${it.name}${modStr}`;
                          }).join(' • ')}
                          {order.discountItem && (
                            <span className="text-accent font-semibold ml-1.5">
                              + 🎁 {order.discountItem.name}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 mt-2 text-[11px] text-stone-500 dark:text-stone-400">
                        <span>Kasir: {order.cashier?.name || 'Kasir'}</span>
                        {order.customer?.name && (
                          <>
                            <span className="text-stone-300">•</span>
                            <span className="flex items-center gap-1 font-semibold text-stone-700 dark:text-stone-300">
                              <User className="w-3 h-3 text-stone-400" />
                              {order.customer.name}
                            </span>
                          </>
                        )}
                        {order.customer?.phone && (
                          <>
                            <span className="text-stone-300">•</span>
                            <span className="flex items-center gap-1 text-stone-400">
                              <Phone className="w-3 h-3" />
                              {order.customer.phone}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: Total & Open / Delete */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-stone-800 shrink-0">
                      <div className="text-right">
                        <span className="text-xs text-stone-400 mr-1.5">{order.totalItemsCount || order.items.length} item</span>
                        <span className="text-sm sm:text-base font-extrabold text-accent font-heading">
                          Rp {order.totalAmount?.toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDraftDeleteConfirmId(order.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-stone-600 hover:text-red-600 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Hapus pesanan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{language === 'en' ? 'Delete' : 'Hapus'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleLoadDraftToCart(order)}
                          className="px-3.5 py-1.5 rounded-xl bg-accent hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          <span>{language === 'en' ? 'Open & Edit' : 'Buka & Ubah'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
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

      {/* Delete Draft Confirmation Modal */}
      {draftDeleteConfirmId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-[#251e1c] rounded-2xl p-5 border border-stone-200 dark:border-stone-800 shadow-xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-stone-900 dark:text-stone-100">
                {language === 'en' ? 'Delete this hold order?' : 'Hapus pesanan tersimpan ini?'}
              </h4>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                {language === 'en'
                  ? 'This action cannot be undone. Items in this order will be removed from hold.'
                  : 'Pesanan yang belum dibayar ini akan dihapus permanen dari antrean simpan.'}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDraftDeleteConfirmId(null)}
                className="flex-1 py-2 px-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs cursor-pointer"
              >
                {language === 'en' ? 'Cancel' : 'Batal'}
              </button>
              <button
                type="button"
                disabled={isDeletingDraft}
                onClick={() => handleDeleteDraft(draftDeleteConfirmId)}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                {isDeletingDraft ? '...' : (language === 'en' ? 'Delete' : 'Ya, Hapus')}
              </button>
            </div>
          </div>
        </div>
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

              {selectedOrderForDetail.status === 'CANCELLED' && selectedOrderForDetail.cancellation && (
                <div className="mt-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-[11px] space-y-1">
                  <div className="flex items-center gap-1 font-bold text-red-700 dark:text-red-400">
                    <Ban className="w-3.5 h-3.5" />
                    <span>{language === 'en' ? 'TRANSACTION CANCELLED & REFUNDED' : 'TRANSAKSI DIBATALKAN & DANA DIKEMBALIKAN'}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-red-600 dark:text-red-400">
                    <span>{language === 'en' ? 'Refund Processed:' : 'Pengembalian Dana:'}</span>
                    <span>Rp {selectedOrderForDetail.cancellation.refundAmount.toLocaleString('id-ID')} via {selectedOrderForDetail.cancellation.refundMethod}</span>
                  </div>
                  <div className="flex justify-between text-stone-500 dark:text-stone-400 text-[10px]">
                    <span>{language === 'en' ? 'Cancelled By:' : 'Dibatalkan Oleh:'}</span>
                    <span>{selectedOrderForDetail.cancellation.cancelledBy}</span>
                  </div>
                  <div className="text-[10px] text-stone-600 dark:text-stone-400 pt-0.5 border-t border-red-200/50 dark:border-red-900/50">
                    <span className="font-bold">{language === 'en' ? 'Reason: ' : 'Alasan: '}</span>
                    <span>"{selectedOrderForDetail.cancellation.reason}"</span>
                  </div>
                </div>
              )}

              {selectedOrderForDetail.isAdjusted && selectedOrderForDetail.paymentAdjustment && (
                <div className="mt-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] space-y-1">
                  <div className="flex items-center gap-1 font-bold text-amber-800 dark:text-amber-300">
                    <Scale className="w-3.5 h-3.5" />
                    <span>{language === 'en' ? 'ORDER MODIFICATION / ADJUSTMENT' : 'KOREKSI / PENYESUAIAN PESANAN'}</span>
                  </div>
                  {selectedOrderForDetail.originalTotalAmount && (
                    <div className="flex justify-between text-stone-600 dark:text-stone-400">
                      <span>{language === 'en' ? 'Original Total:' : 'Total Semula:'}</span>
                      <span>Rp {selectedOrderForDetail.originalTotalAmount.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className={`flex justify-between font-extrabold ${
                    selectedOrderForDetail.paymentAdjustment.type === 'ADDITIONAL_PAYMENT'
                      ? 'text-amber-700 dark:text-amber-400'
                      : selectedOrderForDetail.paymentAdjustment.type === 'REFUND'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-stone-600'
                  }`}>
                    <span>
                      {selectedOrderForDetail.paymentAdjustment.type === 'ADDITIONAL_PAYMENT'
                        ? (language === 'en' ? 'Shortage Settled:' : 'Kurang Bayar Diterima:')
                        : selectedOrderForDetail.paymentAdjustment.type === 'REFUND'
                          ? (language === 'en' ? 'Refund Given:' : 'Lebih Bayar Dikembalikan:')
                          : (language === 'en' ? 'Net Difference:' : 'Selisih Transaksi:')}
                    </span>
                    <span>
                      {selectedOrderForDetail.paymentAdjustment.type === 'ADDITIONAL_PAYMENT' && '+'}
                      {selectedOrderForDetail.paymentAdjustment.type === 'REFUND' && '-'}
                      Rp {selectedOrderForDetail.paymentAdjustment.differenceAmount.toLocaleString('id-ID')}
                    </span>
                  </div>
                  {selectedOrderForDetail.paymentAdjustment.reason && (
                    <p className="text-[10px] text-stone-500 italic mt-0.5">
                      "{selectedOrderForDetail.paymentAdjustment.reason}"
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-2">
              {selectedOrderForDetail.status !== 'CANCELLED' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const targetOrder = selectedOrderForDetail;
                      setSelectedOrderForDetail(null);
                      setOrderToEdit(targetOrder);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-accent/15 hover:bg-accent/25 text-accent font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>{language === 'en' ? 'Edit Order' : 'Ubah Pesanan'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const targetOrder = selectedOrderForDetail;
                      setSelectedOrderForDetail(null);
                      setOrderToCancel(targetOrder);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-red-100 dark:bg-red-950/60 hover:bg-red-200 text-red-600 dark:text-red-400 font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Ban className="w-4 h-4" />
                    <span>{language === 'en' ? 'Cancel' : 'Batalkan'}</span>
                  </button>
                </>
              ) : null}

              <button
                onClick={() => window.print()}
                className={`${selectedOrderForDetail.status === 'CANCELLED' ? 'w-full' : 'flex-1'} py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold flex items-center justify-center gap-1.5 cursor-pointer`}
              >
                <Printer className="w-4 h-4" />
                <span>{language === 'en' ? 'Print' : 'Cetak'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Paid Order Modal */}
      {orderToEdit && (
        <EditPaidOrderModal
          order={orderToEdit}
          isOpen={!!orderToEdit}
          onClose={() => setOrderToEdit(null)}
          onOrderUpdated={handleOrderUpdated}
        />
      )}

      {/* Cancel Paid Order Modal */}
      {orderToCancel && (
        <CancelOrderModal
          order={orderToCancel}
          isOpen={!!orderToCancel}
          onClose={() => setOrderToCancel(null)}
          onOrderCancelled={handleOrderCancelled}
        />
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

export { OrderHistoryScreen as HistoryScreen };
export default OrderHistoryScreen;
