import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  AlertCircle, 
  Check, 
  RefreshCw, 
  ArrowRight, 
  DollarSign, 
  Search, 
  Receipt,
  Scale,
  ArrowUpRight,
  ArrowDownLeft,
  Equal,
  Sparkles
} from 'lucide-react';
import { Order, CartItem, Product } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { ProductImage } from '../common/ProductImage';

interface EditPaidOrderModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: (updatedOrder: Order) => void;
}

export const EditPaidOrderModal: React.FC<EditPaidOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  onOrderUpdated
}) => {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const { token } = useAuth();

  // Local state for editable items
  const [items, setItems] = useState<any[]>([]);
  const [reason, setReason] = useState<string>('Koreksi pesanan pelanggan');
  const [settledMethod, setSettledMethod] = useState<'CASH' | 'QRIS' | 'EDC' | 'TRANSFER'>('CASH');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // Catalog search state to add new products to this paid order
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize editable order data
  useEffect(() => {
    if (order && isOpen) {
      setItems(
        order.items.map((it, idx) => ({
          ...it,
          tempId: `item_${idx}_${Date.now()}`
        }))
      );
      setSettledMethod(order.paymentMethod || 'CASH');
      setCustomerName(order.customer?.name || '');
      setCustomerPhone(order.customer?.phone || '');
      setReason(language === 'en' ? 'Customer order correction' : 'Koreksi item pesanan pelanggan');
    }
  }, [order, isOpen, language]);

  // Load products for adding new items
  useEffect(() => {
    if (isOpen) {
      fetch('/api/products')
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.products)) {
            setAvailableProducts(data.products);
          }
        })
        .catch(err => console.warn('Could not fetch catalog:', err));
    }
  }, [isOpen]);

  if (!isOpen || !order) return null;

  // Real-time calculations
  const originalTotal = order.totalAmount || 0;

  // New Subtotal
  const newSubtotal = items.reduce((sum, item) => sum + (item.itemTotal || item.price * item.quantity), 0);

  // Preserve previous discountItem if it exists
  const discountItemPrice = order.discountItem ? order.discountItem.discountedPrice : 0;
  const discountAmount = order.discountItem ? order.discountItem.discountAmount : (order.discountAmount || 0);

  const taxableSubtotal = Math.max(0, newSubtotal + discountItemPrice - (order.discountItem ? 0 : discountAmount));
  const newPb1Tax = Math.round(taxableSubtotal * 0.1);
  const newTotalAmount = taxableSubtotal + newPb1Tax;

  // Difference calculation
  const netDifference = newTotalAmount - originalTotal; // > 0 customer owes, < 0 refund, === 0 no change
  const absDifference = Math.abs(netDifference);

  // Item modification handlers
  const handleQuantityChange = (tempId: string, delta: number) => {
    setItems(prev =>
      prev
        .map(it => {
          if (it.tempId === tempId) {
            const newQty = Math.max(0, it.quantity + delta);
            if (newQty === 0) return null;
            const singleUnitPrice = it.price || Math.round(it.itemTotal / it.quantity);
            return {
              ...it,
              quantity: newQty,
              itemTotal: singleUnitPrice * newQty
            };
          }
          return it;
        })
        .filter(Boolean)
    );
  };

  const handleRemoveItem = (tempId: string) => {
    if (items.length <= 1) {
      showToast(
        language === 'en'
          ? 'Order must have at least 1 item. You cannot remove all items.'
          : 'Pesanan harus memiliki minimal 1 item.',
        'error'
      );
      return;
    }
    setItems(prev => prev.filter(it => it.tempId !== tempId));
  };

  const handleAddProduct = (product: Product) => {
    const existingIdx = items.findIndex(it => it.productId === product.id && !it.size && !it.notes);
    if (existingIdx !== -1) {
      handleQuantityChange(items[existingIdx].tempId, 1);
      showToast(`${product.name} (+1)`, 'success');
      return;
    }

    const newItem = {
      tempId: `new_${product.id}_${Date.now()}`,
      productId: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      quantity: 1,
      itemTotal: product.price,
      notes: ''
    };

    setItems(prev => [...prev, newItem]);
    showToast(`${product.name} ditambahkan`, 'success');
  };

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      showToast(
        language === 'en'
          ? 'Order cannot be empty. Please add items.'
          : 'Pesanan tidak boleh kosong.',
        'error'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        items: items.map(it => ({
          productId: it.productId,
          name: it.name,
          category: it.category || 'kopi',
          price: it.price,
          quantity: it.quantity,
          size: it.size,
          ice: it.ice,
          sugar: it.sugar,
          milk: it.milk,
          toppings: it.toppings,
          notes: it.notes,
          itemTotal: it.itemTotal
        })),
        discountItem: order.discountItem || null,
        selectedDiscountCode: order.selectedDiscountCode || null,
        settledMethod,
        reason: reason.trim() || (language === 'en' ? 'Order updated by cashier' : 'Koreksi pesanan oleh kasir'),
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined
      };

      const res = await fetch(`/api/orders/${order.id}/adjust`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setIsSubmitting(false);

      if (data.success && data.order) {
        showToast(data.message || 'Pesanan berhasil diperbarui!', 'success');
        onOrderUpdated(data.order);
        onClose();
      } else {
        showToast(data.error || data.message || 'Gagal mengubah pesanan', 'error');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      showToast('Koneksi server gagal.', 'error');
    }
  };

  const filteredCatalog = availableProducts.filter(p =>
    p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-[#1f1a19] rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200/80 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center font-black">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-stone-900 dark:text-stone-100 font-heading">
                  {language === 'en' ? 'Modify Paid Order' : 'Ubah Pesanan Sudah Dibayar'}
                </h3>
                <span className="px-2 py-0.5 rounded-lg bg-accent/15 text-accent text-xs font-mono font-black">
                  #{order.orderNumber}
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {language === 'en'
                  ? 'Update items, recalculate total, and balance payment differences directly'
                  : 'Perbaiki menu pesanan, hitung ulang total & selisih pembayaran otomatis'}
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

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          
          {/* Payment Difference Live Summary Banner */}
          <div className={`p-4 rounded-2xl border transition-all ${
            netDifference > 0
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
              : netDifference < 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                : 'bg-stone-100 dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  netDifference > 0
                    ? 'bg-amber-500 text-white'
                    : netDifference < 0
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-400 text-white'
                }`}>
                  {netDifference > 0 && <ArrowUpRight className="w-6 h-6" />}
                  {netDifference < 0 && <ArrowDownLeft className="w-6 h-6" />}
                  {netDifference === 0 && <Equal className="w-6 h-6" />}
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider block opacity-80">
                    {netDifference > 0
                      ? (language === 'en' ? 'Payment Shortage (Customer Pays More)' : 'Kurang Bayar (Pelanggan Perlu Tambah)')
                      : netDifference < 0
                        ? (language === 'en' ? 'Refund Due (Return to Customer)' : 'Lebih Bayar (Kembalikan ke Pelanggan)')
                        : (language === 'en' ? 'No Payment Difference' : 'Nominal Pembayaran Sama')}
                  </span>
                  <div className="text-xl sm:text-2xl font-black font-heading mt-0.5">
                    {netDifference === 0 ? 'Rp 0' : `Rp ${absDifference.toLocaleString('id-ID')}`}
                  </div>
                </div>
              </div>

              {/* Comparison Numbers */}
              <div className="flex items-center gap-4 text-xs font-semibold pt-2 sm:pt-0 border-t sm:border-t-0 border-current/10">
                <div>
                  <span className="block opacity-70 text-[10px]">
                    {language === 'en' ? 'Old Total' : 'Total Semula'}
                  </span>
                  <span className="font-bold line-through opacity-80">
                    Rp {originalTotal.toLocaleString('id-ID')}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 opacity-50" />
                <div>
                  <span className="block opacity-70 text-[10px]">
                    {language === 'en' ? 'New Total' : 'Total Baru'}
                  </span>
                  <span className="font-extrabold text-sm sm:text-base text-accent">
                    Rp {newTotalAmount.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Items List & Actions */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>{language === 'en' ? 'Ordered Items List' : 'Daftar Item Pesanan'}</span>
                <span className="text-stone-400">({items.reduce((s, it) => s + it.quantity, 0)})</span>
              </label>

              <button
                type="button"
                onClick={() => setIsCatalogOpen(!isCatalogOpen)}
                className="px-3 py-1.5 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isCatalogOpen ? (language === 'en' ? 'Close Catalog' : 'Tutup Menu') : (language === 'en' ? '+ Add More Items' : '+ Tambah Menu Lain')}</span>
              </button>
            </div>

            {/* Catalog Selector Accordion */}
            {isCatalogOpen && (
              <div className="mb-4 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3 animate-in fade-in duration-150">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                    placeholder={language === 'en' ? 'Search catalog product...' : 'Cari produk minuman atau makanan...'}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {filteredCatalog.slice(0, 10).map(product => (
                    <div
                      key={product.id}
                      className="p-2.5 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700/80 flex items-center justify-between gap-2 hover:border-accent transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ProductImage
                          src={product.image}
                          alt={product.name}
                          className="w-8 h-8 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                            {product.name}
                          </p>
                          <p className="text-[11px] font-semibold text-accent font-heading">
                            Rp {product.price.toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddProduct(product)}
                        className="px-2.5 py-1 rounded-lg bg-accent hover:bg-orange-600 text-white text-xs font-bold shrink-0 cursor-pointer"
                      >
                        + Tambah
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Editable Item Rows */}
            <div className="space-y-2.5">
              {items.map(it => {
                const singleUnitPrice = it.price || Math.round(it.itemTotal / it.quantity);
                const mods: string[] = [];
                if (it.size && it.size !== 'Regular') mods.push(it.size);
                if (it.ice) mods.push(it.ice);
                if (it.sugar) mods.push(it.sugar);
                if (it.milk && it.milk !== 'Fresh Milk') mods.push(it.milk);
                if (it.notes) mods.push(`"${it.notes}"`);

                return (
                  <div
                    key={it.tempId}
                    className="p-3 rounded-2xl bg-stone-50/80 dark:bg-stone-900/50 border border-stone-200/80 dark:border-stone-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                          {it.name}
                        </span>
                        <span className="text-xs font-semibold text-stone-400 font-mono">
                          @Rp {singleUnitPrice.toLocaleString('id-ID')}
                        </span>
                      </div>
                      {mods.length > 0 && (
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                          {mods.join(' • ')}
                        </p>
                      )}
                    </div>

                    {/* Quantity Stepper & Subtotal */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1 bg-white dark:bg-stone-800 rounded-xl p-1 border border-stone-200 dark:border-stone-700 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(it.tempId, -1)}
                          className="w-6 h-6 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center text-xs font-bold font-mono">
                          {it.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(it.tempId, 1)}
                          className="w-6 h-6 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-right min-w-[75px]">
                        <span className="text-xs font-extrabold text-stone-900 dark:text-stone-100 font-heading block">
                          Rp {(singleUnitPrice * it.quantity).toLocaleString('id-ID')}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(it.tempId)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Hapus menu ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Settlement Method & Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 block">
                {netDifference > 0
                  ? (language === 'en' ? 'Payment Method for Shortage' : 'Metode Bayar Kekurangan')
                  : netDifference < 0
                    ? (language === 'en' ? 'Refund Method' : 'Metode Pengembalian Selisih')
                    : (language === 'en' ? 'Original Settlement Method' : 'Metode Transaksi')}
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['CASH', 'QRIS', 'EDC', 'TRANSFER'] as const).map(method => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setSettledMethod(method)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      settledMethod === method
                        ? 'bg-accent text-white shadow-xs'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 block">
                {language === 'en' ? 'Correction Reason / Note *' : 'Alasan Koreksi / Catatan Kasir *'}
              </label>
              <input
                type="text"
                required
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Contoh: Salah input pesanan, ganti varian, atau tambah menu"
                className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Customer Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 block">
                {language === 'en' ? 'Customer Name' : 'Nama Pelanggan'}
              </label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Nama pemesan"
                className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 block">
                {language === 'en' ? 'Phone Number (WhatsApp)' : 'Nomor WhatsApp / Telepon'}
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Price Breakdown Calculation Card */}
          <div className="p-3.5 rounded-2xl bg-stone-100/70 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 font-mono text-xs space-y-1.5">
            <div className="flex justify-between text-stone-600 dark:text-stone-400">
              <span>Subtotal Baru:</span>
              <span>Rp {newSubtotal.toLocaleString('id-ID')}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Diskon Terpasang:</span>
                <span>-Rp {discountAmount.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between text-stone-600 dark:text-stone-400">
              <span>PB1 (10%):</span>
              <span>Rp {newPb1Tax.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-stone-900 dark:text-stone-100 pt-1 border-t border-stone-200 dark:border-stone-700">
              <span>TOTAL BARU:</span>
              <span className="text-accent">Rp {newTotalAmount.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-[11px] text-stone-500 dark:text-stone-400">
              <span>Total Sudah Dibayar Sebelumnya:</span>
              <span>Rp {originalTotal.toLocaleString('id-ID')}</span>
            </div>
            <div className={`flex justify-between font-extrabold text-xs pt-1 border-t border-dashed border-stone-300 dark:border-stone-700 ${
              netDifference > 0
                ? 'text-amber-600 dark:text-amber-400'
                : netDifference < 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-stone-600 dark:text-stone-300'
            }`}>
              <span>
                {netDifference > 0
                  ? '>>> KURANG BAYAR (TAGIH KE PELANGGAN):'
                  : netDifference < 0
                    ? '<<< LEBIH BAYAR (KEMBALIKAN KE PELANGGAN):'
                    : 'SELISIH PEMBAYARAN:'}
              </span>
              <span>
                {netDifference > 0 && `+Rp ${absDifference.toLocaleString('id-ID')}`}
                {netDifference < 0 && `-Rp ${absDifference.toLocaleString('id-ID')}`}
                {netDifference === 0 && 'Rp 0 (Pas)'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-stone-200/80 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold text-xs transition-colors cursor-pointer"
          >
            {language === 'en' ? 'Cancel' : 'Batal'}
          </button>

          <button
            type="button"
            disabled={isSubmitting || items.length === 0}
            onClick={handleSubmitAdjustment}
            className="px-5 py-2.5 rounded-2xl bg-accent hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>
                  {netDifference > 0
                    ? `Simpan & Tagih Kurang Rp ${absDifference.toLocaleString('id-ID')}`
                    : netDifference < 0
                      ? `Simpan & Kembalikan Rp ${absDifference.toLocaleString('id-ID')}`
                      : 'Simpan Perubahan Pesanan'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
