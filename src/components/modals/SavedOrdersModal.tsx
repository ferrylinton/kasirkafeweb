import React, { useState } from 'react';
import { 
  PauseCircle, 
  X, 
  Search, 
  Clock, 
  User, 
  Phone, 
  FileText, 
  ArrowRight, 
  Trash2, 
  AlertCircle,
  RefreshCw,
  ShoppingBag
} from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../common/Toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { SavedOrder } from '../../types';

interface SavedOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder?: (order: SavedOrder) => void;
}

export const SavedOrdersModal: React.FC<SavedOrdersModalProps> = ({
  isOpen,
  onClose,
  onSelectOrder
}) => {
  const {
    items: currentCartItems,
    savedOrders,
    isLoadingSavedOrders,
    loadSavedOrders,
    loadDraftIntoCart,
    deleteSavedOrderDraft,
    activeDraftId
  } = useCart();

  const { showToast } = useToast();
  const { language } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmOverwriteDraft, setConfirmOverwriteDraft] = useState<SavedOrder | null>(null);

  if (!isOpen) return null;

  const filteredOrders = savedOrders.filter(order => {
    const q = searchQuery.toLowerCase();
    const num = order.draftNumber.toLowerCase();
    const note = (order.tableNameOrNote || '').toLowerCase();
    const cust = (order.customer?.name || '').toLowerCase();
    const phone = (order.customer?.phone || '').toLowerCase();
    return num.includes(q) || note.includes(q) || cust.includes(q) || phone.includes(q);
  });

  const handleLoadDraft = (draft: SavedOrder) => {
    // If cart already has items and it's not the same draft, ask confirmation
    if (currentCartItems.length > 0 && activeDraftId !== draft.id) {
      setConfirmOverwriteDraft(draft);
      return;
    }

    loadDraftIntoCart(draft);
    showToast(
      language === 'en'
        ? `Order #${draft.draftNumber} loaded into cart!`
        : `Pesanan #${draft.draftNumber} dibuka di kasir!`,
      'success'
    );
    onSelectOrder?.(draft);
    onClose();
  };

  const handleConfirmOverwrite = () => {
    if (!confirmOverwriteDraft) return;
    loadDraftIntoCart(confirmOverwriteDraft);
    showToast(
      language === 'en'
        ? `Order #${confirmOverwriteDraft.draftNumber} loaded into cart!`
        : `Pesanan #${confirmOverwriteDraft.draftNumber} dibuka di kasir!`,
      'success'
    );
    onSelectOrder?.(confirmOverwriteDraft);
    setConfirmOverwriteDraft(null);
    onClose();
  };

  const handleDelete = async (draftId: string) => {
    setIsDeleting(true);
    const res = await deleteSavedOrderDraft(draftId);
    setIsDeleting(false);
    setConfirmDeleteId(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#1f1a19] rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-stone-100 dark:border-stone-800/80 flex items-center justify-between bg-stone-50/50 dark:bg-stone-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <PauseCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-extrabold text-stone-900 dark:text-stone-100 text-lg">
                  {language === 'en' ? 'Saved Orders (Hold Bills)' : 'Pesanan Tersimpan (Hold)'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  {savedOrders.length}
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {language === 'en'
                  ? 'List of active hold orders waiting for completion or payment'
                  : 'Daftar pesanan yang belum dibayar, dapat dibuka dan diubah kapan saja'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => loadSavedOrders()}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingSavedOrders ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-stone-100 dark:border-stone-800/80 bg-stone-50/30 dark:bg-stone-900/20">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={language === 'en' ? 'Search by hold code, note, or customer...' : 'Cari nomor hold, catatan, atau nama pelanggan...'}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        {/* Content list */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {isLoadingSavedOrders && savedOrders.length === 0 ? (
            <div className="space-y-3 py-4">
              {[1, 2].map(i => (
                <div key={i} className="h-28 rounded-2xl bg-stone-100 dark:bg-stone-800/50 animate-pulse" />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-14 text-center text-stone-400 bg-stone-50/50 dark:bg-stone-900/20 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800">
              <ShoppingBag className="w-10 h-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm font-bold text-stone-600 dark:text-stone-300">
                {searchQuery
                  ? (language === 'en' ? 'No saved orders match your search' : 'Tidak ada pesanan tersimpan yang cocok')
                  : (language === 'en' ? 'No saved orders at the moment' : 'Belum ada pesanan yang disimpan')}
              </p>
              <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                {language === 'en'
                  ? 'Orders placed on hold from the cart will show up here.'
                  : 'Klik "Simpan Pesanan" di layar kasir untuk menyimpan pesanan sementara.'}
              </p>
            </div>
          ) : (
            filteredOrders.map(order => {
              const isCurrentlyActiveInCart = activeDraftId === order.id;

              return (
                <div
                  key={order.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col gap-3 ${
                    isCurrentlyActiveInCart
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700 ring-1 ring-amber-400'
                      : 'bg-white dark:bg-[#251e1c] border-stone-200/80 dark:border-stone-800 shadow-2xs hover:border-amber-300/60'
                  }`}
                >
                  {/* Top row: Hold Code, Table/Note, Timestamp */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-xl text-xs font-black tracking-wide bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono">
                        {order.draftNumber}
                      </span>
                      <span className="font-extrabold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-stone-400" />
                        {order.tableNameOrNote || 'Pesanan Disimpan'}
                      </span>
                      {isCurrentlyActiveInCart && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white">
                          {language === 'en' ? 'Active in Cart' : 'Sedang Dibuka'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-stone-400">
                      <Clock className="w-3 h-3" />
                      <span>{formatElapsed(order.updatedAt || order.createdAt)}</span>
                    </div>
                  </div>

                  {/* Middle row: Items preview */}
                  <div className="bg-stone-50/70 dark:bg-stone-900/40 p-2.5 rounded-xl border border-stone-100 dark:border-stone-800/80">
                    <p className="text-xs text-stone-700 dark:text-stone-300 font-semibold line-clamp-2">
                      {order.items?.map(it => {
                        const mods: string[] = [];
                        if (it.modifier?.size && it.modifier.size !== 'Regular') mods.push(it.modifier.size);
                        if (it.modifier?.ice) mods.push(it.modifier.ice);
                        if (it.modifier?.notes) mods.push(`"${it.modifier.notes}"`);
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

                  {/* Customer, Cashier & Bill Total */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-100 dark:border-stone-800/60">
                    <div className="flex items-center gap-2.5 text-[11px] text-stone-500 dark:text-stone-400">
                      {order.customer?.name && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-stone-400" />
                          <span className="font-semibold text-stone-700 dark:text-stone-300">{order.customer.name}</span>
                        </span>
                      )}
                      {order.customer?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{order.customer.phone}</span>
                        </span>
                      )}
                      <span className="text-stone-300">•</span>
                      <span>Kasir: {order.cashier?.name || 'Kasir'}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-stone-400 mr-1.5">{order.totalItemsCount || order.items.length} item</span>
                      <span className="font-extrabold text-sm sm:text-base text-accent font-heading">
                        Rp {order.totalAmount?.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(order.id)}
                      className="px-2.5 py-1.5 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Hapus pesanan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{language === 'en' ? 'Delete' : 'Hapus'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleLoadDraft(order)}
                      className="px-4 py-2 rounded-xl bg-accent hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <span>{language === 'en' ? 'Open & Edit' : 'Buka & Ubah'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100 dark:border-stone-800/80 bg-stone-50/50 dark:bg-stone-900/40 flex items-center justify-between">
          <p className="text-xs text-stone-400">
            {language === 'en'
              ? 'Hold orders are saved safely on the server.'
              : 'Pesanan tersimpan aman di server dan dapat diproses kasir mana pun.'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold text-xs transition-colors cursor-pointer"
          >
            {language === 'en' ? 'Close' : 'Tutup'}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
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
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2 px-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs cursor-pointer"
              >
                {language === 'en' ? 'Cancel' : 'Batal'}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? '...' : (language === 'en' ? 'Delete' : 'Ya, Hapus')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overwrite Cart Confirmation Modal */}
      {confirmOverwriteDraft && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-[#251e1c] rounded-2xl p-5 border border-stone-200 dark:border-stone-800 shadow-xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-stone-900 dark:text-stone-100">
                {language === 'en' ? 'Replace current cart?' : 'Ganti isi keranjang saat ini?'}
              </h4>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                {language === 'en'
                  ? `Your active cart has items. Opening #${confirmOverwriteDraft.draftNumber} will replace the items in your cart.`
                  : `Keranjang saat ini berisi item. Membuka #${confirmOverwriteDraft.draftNumber} akan menggantikan isi keranjang dengan pesanan ini.`}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmOverwriteDraft(null)}
                className="flex-1 py-2 px-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs cursor-pointer"
              >
                {language === 'en' ? 'Cancel' : 'Batal'}
              </button>
              <button
                type="button"
                onClick={handleConfirmOverwrite}
                className="flex-1 py-2 px-3 rounded-xl bg-accent hover:bg-orange-600 text-white font-bold text-xs cursor-pointer"
              >
                {language === 'en' ? 'Replace & Open' : 'Ganti & Buka'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
