import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  CartItem, 
  Product, 
  CartItemModifier, 
  AppliedDiscount, 
  EligibleDiscount, 
  OrderDiscountItem,
  SavedOrder
} from '../types';

interface CartContextType {
  items: CartItem[];
  customerName: string;
  setCustomerName: (name: string) => void;
  customerEmail: string;
  setCustomerEmail: (email: string) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  // Discounts state
  eligibleDiscounts: EligibleDiscount[];
  allDiscounts: EligibleDiscount[];
  selectedDiscountCode: string | null;
  setSelectedDiscountCode: (code: string | null) => void;
  discountItem: OrderDiscountItem | null;
  selectDiscountItemFromProduct: (product: Product, rule: EligibleDiscount) => void;
  selectDiscountItemFromCart: (cartItemId: string, rule: EligibleDiscount) => void;
  removeDiscountItem: () => void;
  appliedDiscounts: AppliedDiscount[];
  totalDiscount: number;
  freeItemsSummary: string[];
  // Totals
  subtotal: number;
  discountItemPrice: number;
  taxableSubtotal: number;
  pb1Tax: number;
  totalAmount: number;
  totalItemsCount: number;
  // Cart Actions
  addItem: (product: Product, modifier?: CartItemModifier, qty?: number) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  removeItem: (cartItemId: string) => void;
  clearCart: () => void;
  // Saved Orders / Hold Bills
  savedOrders: SavedOrder[];
  isLoadingSavedOrders: boolean;
  activeDraftId: string | null;
  activeDraftNumber: string | null;
  activeDraftNote: string | null;
  loadSavedOrders: () => Promise<void>;
  saveCurrentOrderAsDraft: (note?: string) => Promise<{ success: boolean; draft?: SavedOrder; error?: string }>;
  updateSavedOrderDraft: (draftId: string, note?: string) => Promise<{ success: boolean; draft?: SavedOrder; error?: string }>;
  loadDraftIntoCart: (draft: SavedOrder) => void;
  deleteSavedOrderDraft: (draftId: string) => Promise<{ success: boolean; error?: string }>;
  clearActiveDraft: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const calculateItemDiscountPrice = (
  price: number,
  rewardType: 'FREE_SNACK' | 'FREE_DRINK_OR_SNACK' | 'PERCENTAGE' | 'FIXED_AMOUNT',
  rewardValue?: number
): { discountAmount: number; discountedPrice: number } => {
  let discountAmount = 0;
  if (rewardType === 'FREE_SNACK' || rewardType === 'FREE_DRINK_OR_SNACK') {
    const maxVal = rewardValue && rewardValue > 0 ? rewardValue : price;
    discountAmount = Math.min(price, maxVal);
  } else if (rewardType === 'PERCENTAGE') {
    const pct = Math.min(100, Math.max(1, rewardValue || 10));
    discountAmount = Math.round((price * pct) / 100);
  } else if (rewardType === 'FIXED_AMOUNT') {
    const val = rewardValue || 10000;
    discountAmount = Math.min(price, val);
  }
  const discountedPrice = Math.max(0, price - discountAmount);
  return { discountAmount, discountedPrice };
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    // Initial demo items
    return [
      {
        cartItemId: 'item-1',
        productId: 'prod_1',
        name: 'Caramel Macchiato',
        category: 'kopi',
        price: 29000,
        quantity: 2,
        modifier: {
          size: 'Large',
          sizeExtra: 5000,
          ice: 'Less Ice',
          sugar: '100% Normal',
          milk: 'Oat Milk',
          milkExtra: 0,
          toppings: [],
          toppingsExtra: 0,
          notes: ''
        },
        itemTotal: 68000,
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBpnFKC-H8k2sIAtGjjoSN2DS0T72TbyE9qtMuouOhOVn4amQitM2rWQGwj9X-40uEr2_2wLzgI82o2efWjBfmREvC-HsB5c3ObP_cngIHeGLBQ2X3wxkNDUQJ97Yl1lOG6MFMiHogt9l19rqyri0J19DmJTn5B1B2gdz8a3811zG15uverHerHc9KEvy7j1nUNFfPegRU4dI3V4gBa75uvEderned9-rn5YGHhdLOa-9d7LLqEtebbow'
      },
      {
        cartItemId: 'item-2',
        productId: 'prod_6',
        name: 'Jasmine Green Tea',
        category: 'teh',
        price: 22000,
        quantity: 2,
        modifier: {
          size: 'Regular',
          sizeExtra: 0,
          ice: 'Normal Ice',
          sugar: '50% Less',
          milk: 'Fresh Milk',
          milkExtra: 0,
          toppings: [],
          toppingsExtra: 0,
          notes: ''
        },
        itemTotal: 44000,
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBEDdNAgqpFDYomBUwebjH1cUlD6u-s6RdfV_B3Zb2sErpLrfWBAlI-B4p9ghPK0MgP7u-BExqyPi0O6Fy5nc1a9JyE3lDkxO1GyavPWK6Rmk67W9jItT13snorCP72I1AEUd4jAYXNMKn2Lz44DGZ6HM9_iOY7NSczXkEJzmmMyq-3b2vxTM-puw_0iCpUshE4u_GwKW-TTggh5T670zI2UA3bRKmSkfrEPZWMX1SqFzQj0F5diM9zYQ'
      },
      {
        cartItemId: 'item-3',
        productId: 'prod_9',
        name: 'Mango Berry Breeze Jus',
        category: 'jus',
        price: 28000,
        quantity: 1,
        modifier: {
          size: 'Regular',
          sizeExtra: 0,
          ice: 'Normal Ice',
          sugar: '100% Normal',
          milk: 'Fresh Milk',
          milkExtra: 0,
          toppings: [],
          toppingsExtra: 0,
          notes: ''
        },
        itemTotal: 28000,
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAsJDrQVcuTN15ytH6JXl2Sy1VxvsGMvJXf-uUvj-Cb8PrNhnnWViYvbqt5iYdo5tOkmdoUOoAGQyzqygOJaIomUHbcGWh68FXlZAm7maoXw8duNaOEuU40MckVywC0bynGatT1MLvbjyce6fsgcqhT0XmnqgVCRgC3XFamT00-1Y5E2HMq6ccb5Rn4pZFXHPpPQ2D-tpTrlrRWvLghCVS3qLc3PjAKjk2kh_Vli28UF9GS_LwWvg61Zw'
      }
    ];
  });

  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // Saved Orders / Hold Bills State
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>(() => {
    try {
      const cached = localStorage.getItem('kasirkafe_saved_orders');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [isLoadingSavedOrders, setIsLoadingSavedOrders] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeDraftNumber, setActiveDraftNumber] = useState<string | null>(null);
  const [activeDraftNote, setActiveDraftNote] = useState<string | null>(null);

  const getAuthToken = () => {
    return localStorage.getItem('kasirkafe_token') || '';
  };

  const loadSavedOrders = useCallback(async () => {
    setIsLoadingSavedOrders(true);
    try {
      const token = getAuthToken();
      const res = await fetch('/api/orders/drafts', {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.drafts)) {
        setSavedOrders(data.drafts);
        localStorage.setItem('kasirkafe_saved_orders', JSON.stringify(data.drafts));
      }
    } catch (e) {
      console.warn('Failed to fetch drafts, using local cached version');
    } finally {
      setIsLoadingSavedOrders(false);
    }
  }, []);

  useEffect(() => {
    loadSavedOrders();
  }, [loadSavedOrders]);

  const clearActiveDraft = useCallback(() => {
    setActiveDraftId(null);
    setActiveDraftNumber(null);
    setActiveDraftNote(null);
  }, []);

  const saveCurrentOrderAsDraft = async (note?: string): Promise<{ success: boolean; draft?: SavedOrder; error?: string }> => {
    if (items.length === 0) {
      return { success: false, error: 'Keranjang kosong. Tambahkan item sebelum menyimpan.' };
    }

    try {
      const payload = {
        tableNameOrNote: note || customerName || 'Pesanan Disimpan',
        customerName: customerName || undefined,
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
        items,
        selectedDiscountCode: selectedDiscountCode || undefined,
        discountItem: discountItem || undefined
      };

      const token = getAuthToken();
      const res = await fetch('/api/orders/drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.draft) {
        setSavedOrders(prev => [data.draft, ...prev.filter(d => d.id !== data.draft.id)]);
        localStorage.setItem('kasirkafe_saved_orders', JSON.stringify([data.draft, ...savedOrders.filter(d => d.id !== data.draft.id)]));
        clearCart();
        return { success: true, draft: data.draft };
      }
      return { success: false, error: data.error || data.message || 'Gagal menyimpan pesanan' };
    } catch (err: any) {
      return { success: false, error: 'Koneksi server gagal' };
    }
  };

  const updateSavedOrderDraft = async (draftId: string, note?: string): Promise<{ success: boolean; draft?: SavedOrder; error?: string }> => {
    if (items.length === 0) {
      return { success: false, error: 'Keranjang kosong.' };
    }

    try {
      const payload = {
        tableNameOrNote: note || activeDraftNote || customerName || 'Pesanan Disimpan',
        customerName: customerName || undefined,
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
        items,
        selectedDiscountCode: selectedDiscountCode || undefined,
        discountItem: discountItem || undefined
      };

      const token = getAuthToken();
      const res = await fetch(`/api/orders/drafts/${draftId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.draft) {
        setSavedOrders(prev => prev.map(d => d.id === draftId ? data.draft : d));
        setActiveDraftNote(payload.tableNameOrNote);
        return { success: true, draft: data.draft };
      }
      return { success: false, error: data.error || data.message || 'Gagal memperbarui pesanan tersimpan' };
    } catch (err: any) {
      return { success: false, error: 'Koneksi server gagal' };
    }
  };

  const loadDraftIntoCart = (draft: SavedOrder) => {
    setItems(draft.items || []);
    setCustomerName(draft.customer?.name || '');
    setCustomerEmail(draft.customer?.email || '');
    setCustomerPhone(draft.customer?.phone || '');
    setSelectedDiscountCodeState(draft.selectedDiscountCode || null);
    setDiscountItem(draft.discountItem || null);
    setActiveDraftId(draft.id);
    setActiveDraftNumber(draft.draftNumber);
    setActiveDraftNote(draft.tableNameOrNote || '');
  };

  const deleteSavedOrderDraft = async (draftId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/orders/drafts/${draftId}`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      const data = await res.json();
      if (data.success) {
        setSavedOrders(prev => {
          const updated = prev.filter(d => d.id !== draftId);
          localStorage.setItem('kasirkafe_saved_orders', JSON.stringify(updated));
          return updated;
        });
        if (activeDraftId === draftId) {
          clearActiveDraft();
        }
        return { success: true };
      }
      return { success: false, error: data.error || 'Gagal menghapus pesanan tersimpan' };
    } catch (err: any) {
      return { success: false, error: 'Koneksi server gagal' };
    }
  };

  // Discount Selection States
  const [eligibleDiscounts, setEligibleDiscounts] = useState<EligibleDiscount[]>([]);
  const [allDiscounts, setAllDiscounts] = useState<EligibleDiscount[]>([]);
  const [selectedDiscountCode, setSelectedDiscountCodeState] = useState<string | null>(null);
  const [discountItem, setDiscountItem] = useState<OrderDiscountItem | null>(null);

  // Subtotal of regular ordered items
  const subtotal = items.reduce((sum, item) => sum + item.itemTotal, 0);

  // Evaluate applicable discounts whenever items or subtotal changes
  useEffect(() => {
    let isCancelled = false;

    const runDiscountEvaluation = async () => {
      if (items.length === 0) {
        setEligibleDiscounts([]);
        setAllDiscounts([]);
        setSelectedDiscountCodeState(null);
        setDiscountItem(null);
        return;
      }

      try {
        const res = await fetch('/api/discounts/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map(i => ({
              productId: i.productId,
              name: i.name,
              category: i.category,
              price: i.price,
              quantity: i.quantity
            })),
            subtotal
          })
        });
        const data = await res.json();
        if (!isCancelled && data.success) {
          const eligible: EligibleDiscount[] = data.eligibleDiscounts || [];
          const all: EligibleDiscount[] = data.allRules || [];
          setEligibleDiscounts(eligible);
          setAllDiscounts(all);

          // If the currently selected discount code is no longer eligible, unselect it
          if (selectedDiscountCode && !eligible.some(d => d.code === selectedDiscountCode)) {
            setSelectedDiscountCodeState(null);
            setDiscountItem(null);
          }
        }
      } catch (err) {
        // Fallback local evaluation
        const totalDrinks = items
          .filter(i => ['kopi', 'teh', 'jus'].includes(i.category.toLowerCase()))
          .reduce((sum, i) => sum + i.quantity, 0);

        const localEligible: EligibleDiscount[] = [];
        const localAll: EligibleDiscount[] = [
          {
            code: 'BUY_5_FREE_1_SNACK',
            name: 'Beli 5 Gratis 1 Snek',
            description: 'Beli minimal 5 minuman, gratis 1 snack s.d. Rp 20.000.',
            type: 'QUANTITY_THRESHOLD',
            threshold: 5,
            rewardType: 'FREE_SNACK',
            rewardValue: 20000,
            isEligible: totalDrinks >= 5,
            missingRequirement: totalDrinks >= 5 ? undefined : `Kurang ${5 - totalDrinks} minuman lagi`,
            eligibleCategories: ['cemilan']
          },
          {
            code: 'BUY_10_FREE_1_DRINK_OR_SNACK',
            name: 'Beli 10 Gratis 1 Kopi / Snack',
            description: 'Beli minimal 10 minuman, gratis 1 kopi atau 1 snack s.d. Rp 28.000.',
            type: 'QUANTITY_THRESHOLD',
            threshold: 10,
            rewardType: 'FREE_DRINK_OR_SNACK',
            rewardValue: 28000,
            isEligible: totalDrinks >= 10,
            missingRequirement: totalDrinks >= 10 ? undefined : `Kurang ${10 - totalDrinks} minuman lagi`,
            eligibleCategories: ['kopi', 'teh', 'jus', 'cemilan']
          },
          {
            code: 'SPEND_100K_FREE_ITEM',
            name: 'Belanja Min. Rp 100.000 Gratis 1 Kopi / Snack',
            description: 'Belanja minimal Rp 100.000, dapatkan 1 gratis item s.d. Rp 28.000.',
            type: 'MIN_SPEND',
            threshold: 100000,
            rewardType: 'FREE_DRINK_OR_SNACK',
            rewardValue: 28000,
            isEligible: subtotal >= 100000,
            missingRequirement: subtotal >= 100000 ? undefined : `Kurang belanja Rp ${(100000 - subtotal).toLocaleString('id-ID')}`,
            eligibleCategories: ['kopi', 'teh', 'jus', 'cemilan']
          },
          {
            code: 'BIRTHDAY_REWARD',
            name: 'Diskon Ulang Tahun Pembeli',
            description: 'Promo hari ulang tahun pembeli: Dapatkan 1 minuman atau 1 snack gratis (senilai hingga Rp 28.000).',
            type: 'BIRTHDAY',
            rewardType: 'FREE_DRINK_OR_SNACK',
            rewardValue: 28000,
            isEligible: true,
            eligibleCategories: ['kopi', 'teh', 'jus', 'cemilan']
          }
        ];

        localAll.forEach(r => {
          if (r.isEligible) localEligible.push(r);
        });

        if (!isCancelled) {
          setEligibleDiscounts(localEligible);
          setAllDiscounts(localAll);
          if (selectedDiscountCode && !localEligible.some(d => d.code === selectedDiscountCode)) {
            setSelectedDiscountCodeState(null);
            setDiscountItem(null);
          }
        }
      }
    };

    runDiscountEvaluation();

    return () => {
      isCancelled = true;
    };
  }, [items, subtotal, selectedDiscountCode]);

  // Handle single discount selection
  const setSelectedDiscountCode = (code: string | null) => {
    if (code === null) {
      // Remove any chosen discount item
      if (discountItem?.source === 'CART_ITEM' && discountItem.originalCartItemId) {
        restoreCartItem(discountItem);
      }
      setDiscountItem(null);
      setSelectedDiscountCodeState(null);
      return;
    }

    setSelectedDiscountCodeState(code);

    // If an item is already selected as discount item, recalculate its price for the new rule
    if (discountItem) {
      const newRule = eligibleDiscounts.find(d => d.code === code) || allDiscounts.find(d => d.code === code);
      if (newRule) {
        const { discountAmount, discountedPrice } = calculateItemDiscountPrice(
          discountItem.originalPrice,
          newRule.rewardType,
          newRule.rewardValue
        );
        setDiscountItem(prev => (prev ? {
          ...prev,
          discountAmount,
          discountedPrice,
          ruleCode: newRule.code,
          ruleName: newRule.name
        } : null));
      }
    }
  };

  // Helper to restore an item converted from cart back to items list
  const restoreCartItem = (item: OrderDiscountItem) => {
    setItems(prev => {
      const existing = prev.find(p => p.cartItemId === item.originalCartItemId);
      if (existing) {
        return prev.map(p =>
          p.cartItemId === item.originalCartItemId
            ? { ...p, quantity: p.quantity + 1, itemTotal: p.itemTotal + item.originalPrice }
            : p
        );
      }
      // Re-create cart item
      const restored: CartItem = {
        cartItemId: item.originalCartItemId || `cart-${Date.now()}`,
        productId: item.productId,
        name: item.name,
        category: item.category,
        price: item.originalPrice,
        quantity: 1,
        itemTotal: item.originalPrice,
        image: item.image
      };
      return [...prev, restored];
    });
  };

  // Select discount item from the Menu Catalog
  const selectDiscountItemFromProduct = (product: Product, rule: EligibleDiscount) => {
    // If previous discount item was from cart, restore it
    if (discountItem?.source === 'CART_ITEM') {
      restoreCartItem(discountItem);
    }

    const { discountAmount, discountedPrice } = calculateItemDiscountPrice(
      product.price,
      rule.rewardType,
      rule.rewardValue
    );

    setDiscountItem({
      productId: product.id,
      name: product.name,
      category: product.category,
      originalPrice: product.price,
      discountedPrice,
      discountAmount,
      ruleCode: rule.code,
      ruleName: rule.name,
      image: product.image,
      source: 'CATALOG_ITEM'
    });
  };

  // Select discount item from an existing Cart Item
  const selectDiscountItemFromCart = (cartItemId: string, rule: EligibleDiscount) => {
    const target = items.find(i => i.cartItemId === cartItemId);
    if (!target) return;

    // If previous discount item was from cart, restore it first
    if (discountItem?.source === 'CART_ITEM') {
      restoreCartItem(discountItem);
    }

    // Deduct 1 unit from cart item
    setItems(prev => {
      return prev
        .map(i => {
          if (i.cartItemId === cartItemId) {
            if (i.quantity <= 1) return null;
            const singleUnitPrice = i.itemTotal / i.quantity;
            return {
              ...i,
              quantity: i.quantity - 1,
              itemTotal: singleUnitPrice * (i.quantity - 1)
            };
          }
          return i;
        })
        .filter(Boolean) as CartItem[];
    });

    const { discountAmount, discountedPrice } = calculateItemDiscountPrice(
      target.price,
      rule.rewardType,
      rule.rewardValue
    );

    setDiscountItem({
      productId: target.productId,
      name: target.name,
      category: target.category,
      originalPrice: target.price,
      discountedPrice,
      discountAmount,
      ruleCode: rule.code,
      ruleName: rule.name,
      image: target.image,
      source: 'CART_ITEM',
      originalCartItemId: cartItemId
    });
  };

  // Remove discount item
  const removeDiscountItem = () => {
    if (discountItem?.source === 'CART_ITEM') {
      restoreCartItem(discountItem);
    }
    setDiscountItem(null);
  };

  // Calculate totals and applied discount details
  const totalDiscount = discountItem ? discountItem.discountAmount : 0;
  const discountItemPrice = discountItem ? discountItem.discountedPrice : 0;
  const taxableSubtotal = Math.max(0, subtotal + discountItemPrice);
  const pb1Tax = Math.round(taxableSubtotal * 0.1); // PB1 10%
  const totalAmount = taxableSubtotal + pb1Tax;
  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0) + (discountItem ? 1 : 0);

  const appliedDiscounts: AppliedDiscount[] = discountItem
    ? [
        {
          ruleCode: discountItem.ruleCode,
          ruleName: discountItem.ruleName,
          description: `Diskon Item: ${discountItem.name} (Hemat Rp ${discountItem.discountAmount.toLocaleString('id-ID')})`,
          discountAmount: discountItem.discountAmount,
          rewardItemName: discountItem.name
        }
      ]
    : [];

  const freeItemsSummary: string[] = discountItem
    ? [`${discountItem.name} (${discountItem.ruleName}): Rp ${discountItem.discountedPrice.toLocaleString('id-ID')}`]
    : [];

  const addItem = (product: Product, modifier?: CartItemModifier, qty: number = 1) => {
    const singleItemPrice =
      product.price +
      (modifier?.sizeExtra || 0) +
      (modifier?.shotExtra || 0) +
      (modifier?.milkExtra || 0) +
      (modifier?.toppingsExtra || 0);
    const itemTotal = singleItemPrice * qty;

    const newItem: CartItem = {
      cartItemId: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      productId: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      quantity: qty,
      modifier: modifier,
      itemTotal,
      image: product.image
    };

    setItems(prev => [...prev, newItem]);
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setItems(prev => {
      return prev
        .map(item => {
          if (item.cartItemId === cartItemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            const singleUnitPrice = item.itemTotal / item.quantity;
            return {
              ...item,
              quantity: newQty,
              itemTotal: singleUnitPrice * newQty
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeItem = (cartItemId: string) => {
    setItems(prev => prev.filter(item => item.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    setItems([]);
    setDiscountItem(null);
    setSelectedDiscountCodeState(null);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    clearActiveDraft();
  };

  return (
    <CartContext.Provider
      value={{
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
        freeItemsSummary,
        subtotal,
        discountItemPrice,
        taxableSubtotal,
        pb1Tax,
        totalAmount,
        totalItemsCount,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        savedOrders,
        isLoadingSavedOrders,
        activeDraftId,
        activeDraftNumber,
        activeDraftNote,
        loadSavedOrders,
        saveCurrentOrderAsDraft,
        updateSavedOrderDraft,
        loadDraftIntoCart,
        deleteSavedOrderDraft,
        clearActiveDraft
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
