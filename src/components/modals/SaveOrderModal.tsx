import React, { useState, useEffect } from 'react';
import { Bookmark, X, FileText, User, Phone, Check, RefreshCw, AlertCircle, ShoppingBag } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../common/Toast';
import { useLanguage } from '../../contexts/LanguageContext';

interface SaveOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SaveOrderModal: React.FC<SaveOrderModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const {
    items,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    totalAmount,
    totalItemsCount,
    activeDraftId,
    activeDraftNumber,
    activeDraftNote,
    saveCurrentOrderAsDraft,
    updateSavedOrderDraft
  } = useCart();

  const { showToast } = useToast();
  const { language } = useLanguage();

  const [note, setNote] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveMode, setSaveMode] = useState<'update' | 'new'>('update');

  useEffect(() => {
    if (isOpen) {
      setNote(activeDraftNote || (customerName ? `Pesanan ${customerName}` : ''));
      setCustName(customerName || '');
      setCustPhone(customerPhone || '');
      setSaveMode(activeDraftId ? 'update' : 'new');
    }
  }, [isOpen, activeDraftId, activeDraftNote, customerName, customerPhone]);

  if (!isOpen) return null;

  const quickOrderTags = [
    'Dine In Regular',
    'Takeaway Bungkus',
    'VIP Area Lantai 2',
    'Area Outdoor Depan',
    'Area Smoking Bar'
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      showToast(
        language === 'en'
          ? 'Cart is empty. Add items first.'
          : 'Keranjang kosong. Tambahkan item sebelum menyimpan.',
        'error'
      );
      return;
    }

    const trimmedNote = note.trim();
    if (trimmedNote.length < 5 || trimmedNote.length > 50) {
      showToast(
        language === 'en'
          ? 'Order Note must be between 5 and 50 characters.'
          : 'Catatan pesanan harus antara 5 hingga 50 karakter.',
        'error'
      );
      return;
    }

    setIsSubmitting(true);

    // Sync customer info back to cart context if provided
    if (custName) setCustomerName(custName);
    if (custPhone) setCustomerPhone(custPhone);

    const finalNote = trimmedNote;

    if (activeDraftId && saveMode === 'update') {
      const res = await updateSavedOrderDraft(activeDraftId, finalNote);
      setIsSubmitting(false);
      if (res.success) {
        showToast(
          language === 'en'
            ? `Order #${activeDraftNumber} updated successfully!`
            : `Pesanan #${activeDraftNumber} berhasil diperbarui!`,
          'success'
        );
        onSuccess?.();
        onClose();
      } else {
        showToast(res.error || 'Gagal memperbarui pesanan', 'error');
      }
    } else {
      const res = await saveCurrentOrderAsDraft(finalNote);
      setIsSubmitting(false);
      if (res.success) {
        showToast(
          language === 'en'
            ? `Order successfully held (${res.draft?.draftNumber})!`
            : `Pesanan berhasil disimpan (${res.draft?.draftNumber})!`,
          'success'
        );
        onSuccess?.();
        onClose();
      } else {
        showToast(res.error || 'Gagal menyimpan pesanan', 'error');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white dark:bg-[#1f1a19] rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-stone-100 dark:border-stone-800/80 flex items-center justify-between bg-stone-50/50 dark:bg-stone-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-stone-900 dark:text-stone-100 text-lg">
                {activeDraftId && saveMode === 'update'
                  ? (language === 'en' ? `Update Hold Order #${activeDraftNumber}` : `Perbarui Pesanan #${activeDraftNumber}`)
                  : (language === 'en' ? 'Save Order (Hold Bill)' : 'Simpan Pesanan Sementara')}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {language === 'en'
                  ? 'Keep this order on hold before payment'
                  : 'Pesanan dapat dilihat dan diubah kembali nanti'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Active draft switcher if already editing an order */}
          {activeDraftId && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {language === 'en'
                    ? `Currently editing Hold Order #${activeDraftNumber}`
                    : `Sedang mengedit Pesanan Tersimpan #${activeDraftNumber}`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setSaveMode('update')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    saveMode === 'update'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {language === 'en' ? 'Update Existing' : 'Perbarui Ini'}
                </button>
                <button
                  type="button"
                  onClick={() => setSaveMode('new')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    saveMode === 'new'
                      ? 'bg-accent text-white shadow-xs'
                      : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  {language === 'en' ? 'Save as New Hold' : 'Simpan Nomor Baru'}
                </button>
              </div>
            </div>
          )}

          {/* Cart Summary Banner */}
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-800 dark:text-stone-200">
                  {totalItemsCount} item di keranjang
                </p>
                <p className="text-[11px] text-stone-400">
                  {(items || []).map(i => `${i?.name || ''} (x${i?.quantity || 1})`).slice(0, 2).join(', ')}
                  {(items || []).length > 2 ? ` + ${(items || []).length - 2} lainnya` : ''}
                </p>
              </div>
            </div>
            <span className="font-extrabold text-sm text-stone-900 dark:text-stone-100 font-heading">
              Rp {totalAmount.toLocaleString('id-ID')}
            </span>
          </div>

          {/* Order Note */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-accent" />
                <span>{language === 'en' ? 'Order Note *' : 'Catatan Pesanan *'}</span>
              </label>
              <span className={`text-[11px] font-semibold ${
                note.trim().length >= 5 && note.trim().length <= 50
                  ? 'text-stone-400 dark:text-stone-500'
                  : note.trim().length > 50
                    ? 'text-red-500 font-bold'
                    : 'text-amber-500'
              }`}>
                {note.trim().length}/50 {language === 'en' ? '(min 5)' : '(min 5)'}
              </span>
            </div>
            <input
              type="text"
              required
              minLength={5}
              maxLength={50}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={language === 'en' ? 'e.g. VIP Order Kak Sarah (5-50 characters)' : 'Contoh: Pesanan Takeaway Kak Doni (5-50 karakter)'}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {note.trim().length > 0 && note.trim().length < 5 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                {language === 'en' ? 'Minimum 5 characters required.' : 'Minimal 5 karakter diperlukan.'}
              </p>
            )}
            {/* Quick order tag pills */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickOrderTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setNote(tag)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                    note === tag
                      ? 'bg-accent text-white font-bold'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Name (Optional) */}
          <div>
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-4 h-4 text-stone-400" />
              <span>{language === 'en' ? 'Customer Name (Optional)' : 'Nama Pelanggan (Opsional)'}</span>
            </label>
            <input
              type="text"
              value={custName}
              onChange={e => setCustName(e.target.value)}
              placeholder="Nama pelanggan / pemesan"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Customer Phone (Optional) */}
          <div>
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-stone-400" />
              <span>{language === 'en' ? 'Phone Number (Optional)' : 'Nomor WhatsApp / HP (Opsional)'}</span>
            </label>
            <input
              type="tel"
              value={custPhone}
              onChange={e => setCustPhone(e.target.value)}
              placeholder="0812xxxxxxxx"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold text-sm transition-colors cursor-pointer"
            >
              {language === 'en' ? 'Cancel' : 'Batal'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || items.length === 0}
              className="flex-2 py-3 px-4 rounded-2xl bg-accent hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>
                    {activeDraftId && saveMode === 'update'
                      ? (language === 'en' ? 'Save Changes' : 'Simpan Perubahan')
                      : (language === 'en' ? 'Save Order' : 'Simpan Pesanan')}
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
