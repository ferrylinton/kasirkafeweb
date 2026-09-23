import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB, fallbackStore } from '../db';
import { calculateDiscounts, getActiveDiscountRules } from '../discounts';
import { sendReceiptEmail } from '../mail';
import { authMiddleware } from '../auth';
import { ObjectId } from 'mongodb';
import { recordActivityLog } from '../activityLogger';
import { logOrder } from '../dailyRollingLogger';
import { IParam } from '@/src/types';
import { serverProductCache } from '../cache/productCache';

export const orderRouter = Router();

const orderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  category: z.string(),
  price: z.number().min(0),
  quantity: z.number().int().min(1),
  size: z.string().optional(),
  ice: z.string().optional(),
  sugar: z.string().optional(),
  milk: z.string().optional(),
  toppings: z.array(z.string()).optional(),
  notes: z.string().optional(),
  itemTotal: z.number().min(0)
});

const discountItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  category: z.string(),
  originalPrice: z.number(),
  discountedPrice: z.number(),
  discountAmount: z.number(),
  ruleCode: z.string(),
  ruleName: z.string(),
  image: z.string().optional()
});

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Pesanan harus berisi minimal 1 item'),
  paymentMethod: z.enum(['CASH', 'QRIS', 'EDC', 'TRANSFER']),
  cashReceived: z.number().min(0).default(0),
  customerName: z.string().optional().nullable(),
  customerEmail: z.string().email().or(z.literal('')).optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  customerBirthDate: z.string().optional().nullable(),
  isBirthdayClaimed: z.boolean().optional(),
  selectedDiscountCode: z.string().optional().nullable(),
  discountItem: discountItemSchema.optional().nullable(),
  draftId: z.string().optional().nullable()
});

const draftItemSchema = z.object({
  cartItemId: z.string().optional(),
  productId: z.string(),
  name: z.string(),
  category: z.string(),
  price: z.number().min(0),
  quantity: z.number().int().min(1),
  modifier: z.object({
    size: z.enum(['Regular', 'Large', 'Jumbo']).optional(),
    sizeExtra: z.number().optional(),
    ice: z.enum(['Normal Ice', 'Less Ice', 'No Ice']).optional(),
    sugar: z.enum(['100% Normal', '50% Less', '0% No Sugar']).optional(),
    milk: z.enum(['Fresh Milk', 'Oat Milk', 'Almond Milk']).optional(),
    milkExtra: z.number().optional(),
    toppings: z.array(z.string()).optional(),
    toppingsExtra: z.number().optional(),
    notes: z.string().optional()
  }).optional(),
  itemTotal: z.number().min(0),
  image: z.string().optional()
});

const adjustOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Pesanan harus berisi minimal 1 item'),
  discountItem: discountItemSchema.optional().nullable(),
  selectedDiscountCode: z.string().optional().nullable(),
  settledMethod: z.enum(['CASH', 'QRIS', 'EDC', 'TRANSFER']).optional(),
  reason: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerEmail: z.string().email().or(z.literal('')).optional().nullable(),
  customerPhone: z.string().optional().nullable()
});

const cancelPaidOrderSchema = z.object({
  reason: z.string()
    .min(5, 'Alasan pembatalan minimal 5 karakter')
    .max(50, 'Alasan pembatalan maksimal 50 karakter'),
  refundMethod: z.enum(['CASH', 'QRIS', 'EDC', 'TRANSFER']).optional()
});

const saveDraftSchema = z.object({
  tableNameOrNote: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerEmail: z.string().email().or(z.literal('')).optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  items: z.array(draftItemSchema).min(1, 'Pesanan tersimpan harus berisi minimal 1 item'),
  selectedDiscountCode: z.string().optional().nullable(),
  discountItem: discountItemSchema.optional().nullable()
});

/**
 * Returns today's date in YYYY-MM-DD string using Asia/Jakarta (WIB) timezone
 */
export function getTodayDateString(): string {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d);
}

/**
 * Generates a sequential order number (as queue number) that resets to 1 each day.
 * Example format: "001", "002", "003"...
 */
export async function getNextDailyOrderSequence(vendorId?: string): Promise<{ orderNumber: string; queueNumber: number; date: string }> {
  const today = getTodayDateString();
  const activeVendorId = vendorId || 'vnd_kasirkafe_central';
  const db = getDB();
  let seq = 1;

  if (db) {
    try {
      const counterResult: any = await db.collection('daily_counters').findOneAndUpdate(
        { date: today, vendorId: activeVendorId },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
      );
      const doc = counterResult?.value || counterResult;
      if (doc && typeof doc.seq === 'number') {
        seq = doc.seq;
      }
    } catch (e) {
      console.warn('[Orders] Could not get daily counter from DB, using fallback memory store:', e);
      fallbackStore.daily_counters = fallbackStore.daily_counters || {};
      const key = `${today}_${activeVendorId}`;
      fallbackStore.daily_counters[key] = (fallbackStore.daily_counters[key] || 0) + 1;
      seq = fallbackStore.daily_counters[key];
    }
  } else {
    fallbackStore.daily_counters = fallbackStore.daily_counters || {};
    const key = `${today}_${activeVendorId}`;
    fallbackStore.daily_counters[key] = (fallbackStore.daily_counters[key] || 0) + 1;
    seq = fallbackStore.daily_counters[key];
  }

  const orderNumber = String(seq).padStart(3, '0');
  return {
    orderNumber,
    queueNumber: seq,
    date: today
  };
}

/**
 * GET /api/orders/next-queue
 * Preview current queue count and next queue number for today
 * RBAC: Operasional Kasir hanya boleh diakses role CASHIER dan role MANAGER
 */
orderRouter.get('/next-queue', authMiddleware, async (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;
  if (userRole !== 'CASHIER' && userRole !== 'MANAGER') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Akses ditolak. Operasional Kasir hanya boleh diakses role CASHIER dan role MANAGER.'
    });
  }

  const today = getTodayDateString();
  const activeVendorId = req.vendorId || 'vnd_kasirkafe_central';
  const db = getDB();
  let currentSeq = 0;

  if (db) {
    try {
      const doc = await db.collection('daily_counters').findOne({ date: today, vendorId: activeVendorId });
      if (doc && typeof doc.seq === 'number') {
        currentSeq = doc.seq;
      }
    } catch (e) {}
  }
  const key = `${today}_${activeVendorId}`;
  if (!currentSeq && fallbackStore.daily_counters && (fallbackStore.daily_counters[key] || fallbackStore.daily_counters[today])) {
    currentSeq = fallbackStore.daily_counters[key] || fallbackStore.daily_counters[today];
  }

  const nextSeq = currentSeq + 1;
  const nextOrderNumber = String(nextSeq).padStart(3, '0');

  return res.json({
    success: true,
    vendorId: activeVendorId,
    today,
    currentQueueNumber: currentSeq,
    nextQueueNumber: nextSeq,
    nextOrderNumber
  });
});

/**
 * POST /api/orders
 * Create new order, process payment, deduct stock, send email receipt
 * RBAC: Operasional Kasir hanya boleh diakses role CASHIER dan role MANAGER
 */
orderRouter.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'CASHIER' && userRole !== 'MANAGER') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Akses ditolak. Operasional Kasir hanya boleh diakses role CASHIER dan role MANAGER.'
      });
    }

    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: parsed.error.format()
      });
    }

    const {
      items,
      paymentMethod,
      cashReceived,
      customerName,
      customerEmail,
      customerPhone,
      customerBirthDate,
      isBirthdayClaimed,
      selectedDiscountCode,
      discountItem,
      draftId
    } = parsed.data;

    // 1. Calculate items subtotal
    const subtotal = items.reduce((acc, item) => acc + item.itemTotal, 0);

    // Active Vendor ID resolution
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';

    // 2. Calculate discounts
    let discountAmount = 0;
    let appliedDiscounts: any[] = [];
    let freeItemsSummary: string[] = [];

    if (discountItem) {
      discountAmount = discountItem.discountAmount;
      appliedDiscounts = [{
        ruleCode: discountItem.ruleCode,
        ruleName: discountItem.ruleName,
        description: `Item Diskon: ${discountItem.name} (Hemat Rp ${discountItem.discountAmount.toLocaleString('id-ID')})`,
        discountAmount: discountItem.discountAmount,
        rewardItemName: discountItem.name
      }];
      freeItemsSummary = [`${discountItem.name} (${discountItem.ruleName}): Rp ${discountItem.discountedPrice.toLocaleString('id-ID')}`];
    } else if (selectedDiscountCode) {
      const rules = await getActiveDiscountRules(activeVendorId);
      const matchedRule = rules.find(r => r.code === selectedDiscountCode);
      if (matchedRule) {
        if (matchedRule.rewardType === 'PERCENTAGE') {
          const pct = Math.min(100, Math.max(1, matchedRule.rewardValue || 10));
          discountAmount = Math.round((subtotal * pct) / 100);
        } else if (matchedRule.rewardType === 'FIXED_AMOUNT') {
          discountAmount = Math.min(subtotal, matchedRule.rewardValue || 10000);
        }
        appliedDiscounts = [{
          ruleCode: matchedRule.code,
          ruleName: matchedRule.name,
          description: matchedRule.description,
          discountAmount,
          rewardItemName: undefined
        }];
      }
    }

    const discountItemPrice = discountItem ? discountItem.discountedPrice : 0;
    const taxableSubtotal = Math.max(0, subtotal + discountItemPrice - (discountItem ? 0 : discountAmount));
    const pb1Tax = Math.round(taxableSubtotal * 0.1); // PB1 10%
    const totalAmount = taxableSubtotal + pb1Tax;

    const change = paymentMethod === 'CASH' ? Math.max(0, cashReceived - totalAmount) : 0;

    // Sequential order number resetting daily as queue number
    const { orderNumber, queueNumber, date } = await getNextDailyOrderSequence(activeVendorId);
    const cashierName = req.user?.name || 'Kasir KasirKafe';

    const orderDoc: any = {
      vendorId: activeVendorId,
      orderNumber,
      queueNumber,
      orderDate: date,
      items,
      discountItem: discountItem || null,
      selectedDiscountCode: selectedDiscountCode || null,
      subtotal,
      discountAmount,
      appliedDiscounts,
      freeItemsSummary,
      pb1Tax,
      totalAmount,
      paymentMethod,
      cashReceived,
      change,
      customer: {
        name: customerName || 'Pelanggan Walk-In',
        email: customerEmail || '',
        phone: customerPhone || ''
      },
      cashier: {
        id: req.user?.userId || '',
        name: cashierName
      },
      status: 'COMPLETED',
      emailStatus: customerEmail ? 'pending' : 'none',
      createdAt: new Date()
    };

    const db = getDB();
    let orderId = new ObjectId().toString();

    // Deduct stock for ordered products
    for (const item of items) {
      if (db) {
        try {
          const query: any = ObjectId.isValid(item.productId)
            ? { _id: new ObjectId(item.productId) }
            : { _id: item.productId };
          await db.collection('products').updateOne(query, {
            $inc: { stock: -item.quantity }
          });
        } catch (e) {}
      }

      const pIdx = fallbackStore.products.findIndex(
        p => (p._id && p._id.toString() === item.productId) || p.id === item.productId
      );
      if (pIdx !== -1) {
        fallbackStore.products[pIdx].stock = Math.max(0, fallbackStore.products[pIdx].stock - item.quantity);
      }
      const prevStock = pIdx !== -1 ? fallbackStore.products[pIdx].stock + item.quantity : 0;
      const nextStock = pIdx !== -1 ? fallbackStore.products[pIdx].stock : 0;

      const saleLog = {
        vendorId: activeVendorId,
        productId: item.productId,
        productName: item.name,
        previousStock: prevStock,
        newStock: nextStock,
        change: -item.quantity,
        type: 'SALE_DEDUCTION',
        reason: `Pengurangan penjualan Order #${orderNumber}`,
        performedBy: {
          id: req.user?.userId || '',
          name: cashierName,
          role: req.user?.role || 'CASHIER'
        },
        createdAt: new Date()
      };

      if (db) {
        try {
          await db.collection('inventory_logs').insertOne(saleLog);
        } catch (e) {}
      }
      fallbackStore.inventory_logs = fallbackStore.inventory_logs || [];
      fallbackStore.inventory_logs.unshift({ id: new ObjectId().toString(), ...saleLog });
    }

    // Deduct stock for discount item if provided
    if (discountItem) {
      if (db) {
        try {
          const query: any = ObjectId.isValid(discountItem.productId)
            ? { _id: new ObjectId(discountItem.productId) }
            : { _id: discountItem.productId };
          await db.collection('products').updateOne(query, {
            $inc: { stock: -1 }
          });
        } catch (e) {}
      }

      const pIdx = fallbackStore.products.findIndex(
        p => (p._id && p._id.toString() === discountItem.productId) || p.id === discountItem.productId
      );
      if (pIdx !== -1) {
        fallbackStore.products[pIdx].stock = Math.max(0, fallbackStore.products[pIdx].stock - 1);
      }
      const prevStock = pIdx !== -1 ? fallbackStore.products[pIdx].stock + 1 : 0;
      const nextStock = pIdx !== -1 ? fallbackStore.products[pIdx].stock : 0;

      const promoLog = {
        vendorId: activeVendorId,
        productId: discountItem.productId,
        productName: discountItem.name,
        previousStock: prevStock,
        newStock: nextStock,
        change: -1,
        type: 'SALE_DEDUCTION',
        reason: `Pengurangan promo diskon Order #${orderNumber} (${discountItem.ruleName})`,
        performedBy: {
          id: req.user?.userId || '',
          name: cashierName,
          role: req.user?.role || 'CASHIER'
        },
        createdAt: new Date()
      };

      if (db) {
        try {
          await db.collection('inventory_logs').insertOne(promoLog);
        } catch (e) {}
      }
      fallbackStore.inventory_logs = fallbackStore.inventory_logs || [];
      fallbackStore.inventory_logs.unshift({ id: new ObjectId().toString(), ...promoLog });
    }

    if (db) {
      try {
        const insertRes = await db.collection('orders').insertOne(orderDoc);
        orderId = insertRes.insertedId.toString();
      } catch (e) {
        fallbackStore.orders.unshift({ ...orderDoc, _id: orderId });
      }
    } else {
      fallbackStore.orders.unshift({ ...orderDoc, _id: orderId });
    }

    // If order was loaded from a saved draft, remove the draft now that it has been paid & completed
    if (draftId) {
      if (db) {
        try {
          const q = ObjectId.isValid(draftId) ? { _id: new ObjectId(draftId) } : { id: draftId };
          await db.collection('saved_orders').deleteOne(q);
        } catch (e) {}
      }
      fallbackStore.saved_orders = (fallbackStore.saved_orders || []).filter(
        d => (d._id && d._id.toString() !== draftId) && d.id !== draftId
      );
    }

    // Invalidate product cache so updated stock is immediately reflected in catalog
    serverProductCache.invalidateProducts(activeVendorId);

    // Record system-wide activity log
    await recordActivityLog({
      action: 'CREATE',
      entity: 'ORDER',
      entityId: orderId,
      entityName: `Order #${orderNumber}`,
      summary: `Transaksi kasir #${orderNumber}: Total Rp ${totalAmount.toLocaleString('id-ID')} (${paymentMethod}) - ${customerName || 'Pelanggan Umum'}`,
      details: {
        orderId,
        orderNumber,
        queueNumber,
        totalAmount,
        subtotal,
        discountAmount,
        paymentMethod,
        itemCount: items.length,
        customerName: customerName || 'Umum',
        discountItem: discountItem ? discountItem.name : null
      },
      req,
      user: {
        id: req.user?.userId,
        name: cashierName,
        role: req.user?.role || 'CASHIER'
      }
    });

    // Write to Daily Rolling Log File (ORDER category)
    logOrder({
      action: 'CREATED',
      orderId,
      orderNumber,
      vendorId: activeVendorId,
      totalAmount,
      paymentMethod,
      itemsCount: items.length,
      cashierName,
      cashierId: req.user?.userId,
      customerName: customerName || 'Pelanggan Walk-In',
      discountItemName: discountItem ? discountItem.name : undefined,
      req,
      details: {
        queueNumber,
        subtotal,
        discountAmount,
        pb1Tax,
        cashReceived,
        change,
        customerEmail,
        customerPhone
      }
    }).catch(() => {});

    // 3. Send email receipt if email was provided
    let emailResult = null;
    if (customerEmail) {
      const itemsTableHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background-color: #fbeae7; color: #59413c;">
              <th style="padding: 8px; text-align: left;">Item</th>
              <th style="padding: 8px; text-align: center;">Qty</th>
              <th style="padding: 8px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                it => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #fbf0ee;">
                  <strong>${it.name}</strong>
                  ${it.size ? `<br><span style="font-size: 11px; color: #8d716a;">${it.size}, ${it.ice || ''}, ${it.sugar || ''}</span>` : ''}
                  ${it.milk ? `<br><span style="font-size: 11px; color: #006c49;">Susu: ${it.milk}</span>` : ''}
                  ${it.toppings && it.toppings.length ? `<br><span style="font-size: 11px; color: #ae3115;">Topping: ${it.toppings.join(', ')}</span>` : ''}
                </td>
                <td style="padding: 8px; text-align: center; border-bottom: 1px solid #fbf0ee;">${it.quantity}</td>
                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #fbf0ee;">Rp ${it.itemTotal.toLocaleString('id-ID')}</td>
              </tr>
            `
              )
              .join('')}
            ${discountItem ? `
              <tr>
                <td colspan="3" style="padding: 10px; background-color: #fff8f5; border-top: 1px dashed #e87a5d; border-bottom: 1px dashed #e87a5d;">
                  <span style="display: inline-block; padding: 2px 6px; background-color: #ffedd5; color: #c2410c; font-size: 10px; font-weight: bold; border-radius: 4px; margin-bottom: 4px;">🎁 ITEM DISKON / PROMO</span><br>
                  <strong style="color: #431407;">${discountItem.name}</strong> (${discountItem.ruleName})<br>
                  <span style="font-size: 11px; color: #78716c;">
                    Harga Normal: <del>Rp ${discountItem.originalPrice.toLocaleString('id-ID')}</del> &rarr; 
                    <strong style="color: #047857;">${discountItem.discountedPrice === 0 ? 'GRATIS (Rp 0)' : 'Rp ' + discountItem.discountedPrice.toLocaleString('id-ID')}</strong>
                    (Hemat Rp ${discountItem.discountAmount.toLocaleString('id-ID')})
                  </span>
                </td>
              </tr>
            ` : ''}
          </tbody>
        </table>
      `;

      emailResult = await sendReceiptEmail({
        vendorId: activeVendorId,
        recipientEmail: customerEmail,
        orderId,
        orderNumber,
        variables: {
          orderNumber,
          customerName: customerName || 'Sahabat KasirKafe',
          cashierName,
          date: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
          itemsTable: itemsTableHtml,
          subtotal: `Rp ${subtotal.toLocaleString('id-ID')}`,
          discount: `Rp ${discountAmount.toLocaleString('id-ID')}`,
          tax: `Rp ${pb1Tax.toLocaleString('id-ID')}`,
          total: `Rp ${totalAmount.toLocaleString('id-ID')}`,
          paymentMethod,
          change: `Rp ${change.toLocaleString('id-ID')}`
        }
      });

      orderDoc.emailStatus = emailResult.success ? 'success' : 'failed';
    }

    return res.status(201).json({
      success: true,
      message: 'Transaksi Berhasil!',
      order: {
        id: orderId,
        ...orderDoc
      },
      emailSent: emailResult?.success ?? false,
      emailError: emailResult?.error
    });
  } catch (err: any) {
    console.error('[Orders] Create order error:', err);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * GET /api/orders/drafts
 * List all saved/held orders for the active vendor
 * RBAC: CASHIER, MANAGER, ADMIN
 */
orderRouter.get('/drafts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'CASHIER' && userRole !== 'MANAGER' && userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Akses ditolak.'
      });
    }

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const db = getDB();
    let drafts: any[] = [];

    if (db) {
      try {
        const query: any = activeVendorId === 'vnd_kasirkafe_central'
          ? { $or: [{ vendorId: 'vnd_kasirkafe_central' }, { vendorId: { $exists: false } }, { vendorId: null }] }
          : { vendorId: activeVendorId };
        drafts = await db.collection('saved_orders').find(query).sort({ updatedAt: -1, createdAt: -1 }).toArray();
      } catch (e) {}
    }

    if (drafts.length === 0) {
      fallbackStore.saved_orders = fallbackStore.saved_orders || [];
      drafts = fallbackStore.saved_orders.filter(
        d => (d.vendorId || 'vnd_kasirkafe_central') === activeVendorId
      );
    }

    return res.json({
      success: true,
      drafts: drafts.map(d => ({
        id: d._id ? d._id.toString() : d.id,
        vendorId: d.vendorId || 'vnd_kasirkafe_central',
        draftNumber: d.draftNumber,
        tableNameOrNote: d.tableNameOrNote || '',
        items: d.items,
        discountItem: d.discountItem || null,
        selectedDiscountCode: d.selectedDiscountCode || null,
        subtotal: d.subtotal,
        discountAmount: d.discountAmount || 0,
        pb1Tax: d.pb1Tax,
        totalAmount: d.totalAmount,
        totalItemsCount: d.totalItemsCount || (d.items ? d.items.reduce((s: number, i: any) => s + (i.quantity || 1), 0) : 0),
        customer: d.customer,
        cashier: d.cashier,
        status: d.status || 'HOLD',
        createdAt: d.createdAt,
        updatedAt: d.updatedAt || d.createdAt
      }))
    });
  } catch (err: any) {
    console.error('[Orders] Get drafts error:', err);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * POST /api/orders/drafts
 * Save current order as draft / hold bill
 * RBAC: CASHIER, MANAGER
 */
orderRouter.post('/drafts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'CASHIER' && userRole !== 'MANAGER') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Akses ditolak.'
      });
    }

    const parsed = saveDraftSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: parsed.error.format()
      });
    }

    const {
      tableNameOrNote,
      customerName,
      customerEmail,
      customerPhone,
      items,
      selectedDiscountCode,
      discountItem
    } = parsed.data;

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const subtotal = items.reduce((acc, it) => acc + it.itemTotal, 0);
    const discountAmount = discountItem ? discountItem.discountAmount : 0;
    const discountItemPrice = discountItem ? discountItem.discountedPrice : 0;
    const taxableSubtotal = Math.max(0, subtotal + discountItemPrice);
    const pb1Tax = Math.round(taxableSubtotal * 0.1);
    const totalAmount = taxableSubtotal + pb1Tax;
    const totalItemsCount = items.reduce((acc, it) => acc + it.quantity, 0) + (discountItem ? 1 : 0);

    const cashierName = req.user?.name || 'Kasir';
    const now = new Date();

    // Generate Hold sequence number (e.g. HOLD-012)
    const holdCode = `HOLD-${Math.floor(100 + Math.random() * 900)}`;

    const draftDoc: any = {
      vendorId: activeVendorId,
      draftNumber: holdCode,
      tableNameOrNote: tableNameOrNote || customerName || 'Pesanan Disimpan',
      items,
      discountItem: discountItem || null,
      selectedDiscountCode: selectedDiscountCode || null,
      subtotal,
      discountAmount,
      pb1Tax,
      totalAmount,
      totalItemsCount,
      customer: {
        name: customerName || '',
        email: customerEmail || '',
        phone: customerPhone || ''
      },
      cashier: {
        id: req.user?.userId || '',
        name: cashierName
      },
      status: 'HOLD',
      createdAt: now,
      updatedAt: now
    };

    const db = getDB();
    let draftId = new ObjectId().toString();

    if (db) {
      try {
        const insertRes = await db.collection('saved_orders').insertOne(draftDoc);
        draftId = insertRes.insertedId.toString();
      } catch (e) {
        fallbackStore.saved_orders = fallbackStore.saved_orders || [];
        fallbackStore.saved_orders.unshift({ ...draftDoc, _id: draftId, id: draftId });
      }
    } else {
      fallbackStore.saved_orders = fallbackStore.saved_orders || [];
      fallbackStore.saved_orders.unshift({ ...draftDoc, _id: draftId, id: draftId });
    }

    await recordActivityLog({
      action: 'CREATE',
      entity: 'ORDER',
      entityId: draftId,
      entityName: `Pesanan Tersimpan ${holdCode}`,
      summary: `Menyimpan pesanan sementara ${holdCode} (${tableNameOrNote || customerName || 'Tanpa Catatan'}): Rp ${totalAmount.toLocaleString('id-ID')}`,
      details: { draftId, holdCode, totalAmount, itemCount: items.length },
      req,
      user: { id: req.user?.userId, name: cashierName, role: req.user?.role || 'CASHIER' }
    });

    return res.status(201).json({
      success: true,
      message: `Pesanan berhasil disimpan (#${holdCode})`,
      draft: {
        id: draftId,
        ...draftDoc
      }
    });
  } catch (err: any) {
    console.error('[Orders] Save draft error:', err);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * PUT /api/orders/drafts/:id
 * Update an existing draft/hold order
 * RBAC: CASHIER, MANAGER
 */
orderRouter.put('/drafts/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'CASHIER' && userRole !== 'MANAGER') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Akses ditolak.'
      });
    }

    const { id } = req.params as unknown as IParam;
    const parsed = saveDraftSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: parsed.error.format()
      });
    }

    const {
      tableNameOrNote,
      customerName,
      customerEmail,
      customerPhone,
      items,
      selectedDiscountCode,
      discountItem
    } = parsed.data;

    const subtotal = items.reduce((acc, it) => acc + it.itemTotal, 0);
    const discountAmount = discountItem ? discountItem.discountAmount : 0;
    const discountItemPrice = discountItem ? discountItem.discountedPrice : 0;
    const taxableSubtotal = Math.max(0, subtotal + discountItemPrice);
    const pb1Tax = Math.round(taxableSubtotal * 0.1);
    const totalAmount = taxableSubtotal + pb1Tax;
    const totalItemsCount = items.reduce((acc, it) => acc + it.quantity, 0) + (discountItem ? 1 : 0);
    const now = new Date();

    const updateFields: any = {
      tableNameOrNote: tableNameOrNote || customerName || 'Pesanan Disimpan',
      items,
      discountItem: discountItem || null,
      selectedDiscountCode: selectedDiscountCode || null,
      subtotal,
      discountAmount,
      pb1Tax,
      totalAmount,
      totalItemsCount,
      customer: {
        name: customerName || '',
        email: customerEmail || '',
        phone: customerPhone || ''
      },
      updatedAt: now
    };

    const db = getDB();
    let updatedDraft: any = null;

    if (db) {
      try {
        const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };
        const result = await db.collection('saved_orders').findOneAndUpdate(
          query,
          { $set: updateFields },
          { returnDocument: 'after' }
        );
        updatedDraft = result?.value || result;
      } catch (e) {}
    }

    fallbackStore.saved_orders = fallbackStore.saved_orders || [];
    const idx = fallbackStore.saved_orders.findIndex(
      d => (d._id && d._id.toString() === id) || d.id === id
    );
    if (idx !== -1) {
      fallbackStore.saved_orders[idx] = {
        ...fallbackStore.saved_orders[idx],
        ...updateFields,
        customer: {
          name: customerName || '',
          email: customerEmail || '',
          phone: customerPhone || ''
        },
        updatedAt: now
      };
      if (!updatedDraft) {
        updatedDraft = fallbackStore.saved_orders[idx];
      }
    }

    return res.json({
      success: true,
      message: 'Pesanan tersimpan berhasil diperbarui!',
      draft: updatedDraft ? {
        id: updatedDraft._id ? updatedDraft._id.toString() : updatedDraft.id,
        ...updatedDraft
      } : null
    });
  } catch (err: any) {
    console.error('[Orders] Update draft error:', err);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * DELETE /api/orders/drafts/:id
 * Delete/cancel a saved draft
 * RBAC: CASHIER, MANAGER, ADMIN
 */
orderRouter.delete('/drafts/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'CASHIER' && userRole !== 'MANAGER' && userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Akses ditolak.'
      });
    }

    const { id } = req.params as unknown as IParam;
    const db = getDB();

    if (db) {
      try {
        const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };
        await db.collection('saved_orders').deleteOne(query);
      } catch (e) {}
    }

    fallbackStore.saved_orders = (fallbackStore.saved_orders || []).filter(
      d => (d._id && d._id.toString() !== id) && d.id !== id
    );

    return res.json({
      success: true,
      message: 'Pesanan tersimpan berhasil dihapus.'
    });
  } catch (err: any) {
    console.error('[Orders] Delete draft error:', err);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * PUT /api/orders/:id/adjust
 * Modify an already paid/completed order, recompute payment differences (shortage / refund)
 * RBAC: CASHIER, MANAGER, ADMIN
 */
orderRouter.put('/:id/adjust', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'CASHIER' && userRole !== 'MANAGER' && userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Akses ditolak. Mengubah pesanan yang sudah dibayar membutuhkan role CASHIER atau MANAGER.'
      });
    }

    const { id } = req.params as unknown as IParam;
    const parsed = adjustOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: parsed.error.format()
      });
    }

    const {
      items,
      discountItem,
      selectedDiscountCode,
      settledMethod,
      reason,
      customerName,
      customerEmail,
      customerPhone
    } = parsed.data;

    const db = getDB();
    let existingOrder: any = null;

    if (db) {
      try {
        const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };
        existingOrder = await db.collection('orders').findOne(query);
      } catch (e) {}
    }

    if (!existingOrder) {
      existingOrder = fallbackStore.orders.find(o => (o._id && o._id.toString() === id) || o.id === id || o.orderNumber === id);
    }

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: 'Pesanan tidak ditemukan.'
      });
    }

    // Active Vendor ID resolution
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || existingOrder.vendorId || 'vnd_kasirkafe_central';

    // 1. Calculate new totals
    const newSubtotal = items.reduce((acc, item) => acc + item.itemTotal, 0);

    let newDiscountAmount = 0;
    let newAppliedDiscounts: any[] = [];
    let newFreeItemsSummary: string[] = [];

    if (discountItem) {
      newDiscountAmount = discountItem.discountAmount;
      newAppliedDiscounts = [{
        ruleCode: discountItem.ruleCode,
        ruleName: discountItem.ruleName,
        description: `Item Diskon: ${discountItem.name} (Hemat Rp ${discountItem.discountAmount.toLocaleString('id-ID')})`,
        discountAmount: discountItem.discountAmount,
        rewardItemName: discountItem.name
      }];
      newFreeItemsSummary = [`${discountItem.name} (${discountItem.ruleName}): Rp ${discountItem.discountedPrice.toLocaleString('id-ID')}`];
    } else if (selectedDiscountCode) {
      const rules = await getActiveDiscountRules(activeVendorId);
      const matchedRule = rules.find(r => r.code === selectedDiscountCode);
      if (matchedRule) {
        if (matchedRule.rewardType === 'PERCENTAGE') {
          const pct = Math.min(100, Math.max(1, matchedRule.rewardValue || 10));
          newDiscountAmount = Math.round((newSubtotal * pct) / 100);
        } else if (matchedRule.rewardType === 'FIXED_AMOUNT') {
          newDiscountAmount = Math.min(newSubtotal, matchedRule.rewardValue || 10000);
        }
        newAppliedDiscounts = [{
          ruleCode: matchedRule.code,
          ruleName: matchedRule.name,
          description: matchedRule.description,
          discountAmount: newDiscountAmount,
          rewardItemName: undefined
        }];
      }
    }

    const discountItemPrice = discountItem ? discountItem.discountedPrice : 0;
    const newTaxableSubtotal = Math.max(0, newSubtotal + discountItemPrice - (discountItem ? 0 : newDiscountAmount));
    const newPb1Tax = Math.round(newTaxableSubtotal * 0.1);
    const newTotalAmount = newTaxableSubtotal + newPb1Tax;

    // Previous Total comparison
    const previousTotal = existingOrder.totalAmount || 0;
    const netDifference = newTotalAmount - previousTotal; // > 0: customer owes more; < 0: refund to customer
    const differenceAmount = Math.abs(netDifference);

    let adjustmentType: 'ADDITIONAL_PAYMENT' | 'REFUND' | 'NO_CHANGE' = 'NO_CHANGE';
    if (netDifference > 0) {
      adjustmentType = 'ADDITIONAL_PAYMENT';
    } else if (netDifference < 0) {
      adjustmentType = 'REFUND';
    }

    const now = new Date();
    const cashierName = (req as any).user?.name || 'Kasir';

    const paymentAdjustment = {
      type: adjustmentType,
      differenceAmount,
      netDifference,
      settledMethod: settledMethod || existingOrder.paymentMethod,
      reason: reason || 'Koreksi item pesanan oleh kasir',
      adjustedAt: now.toISOString(),
      adjustedBy: cashierName
    };

    const updateFields: any = {
      items,
      discountItem: discountItem || null,
      selectedDiscountCode: selectedDiscountCode || null,
      subtotal: newSubtotal,
      discountAmount: newDiscountAmount,
      appliedDiscounts: newAppliedDiscounts,
      freeItemsSummary: newFreeItemsSummary,
      pb1Tax: newPb1Tax,
      totalAmount: newTotalAmount,
      isAdjusted: true,
      originalTotalAmount: existingOrder.originalTotalAmount || previousTotal,
      paymentAdjustment,
      updatedAt: now
    };

    if (customerName !== undefined) {
      updateFields['customer.name'] = customerName || existingOrder.customer?.name || '';
    }
    if (customerEmail !== undefined) {
      updateFields['customer.email'] = customerEmail || existingOrder.customer?.email || '';
    }
    if (customerPhone !== undefined) {
      updateFields['customer.phone'] = customerPhone || existingOrder.customer?.phone || '';
    }

    let updatedOrder: any = null;

    if (db) {
      try {
        const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };
        const result = await db.collection('orders').findOneAndUpdate(
          query,
          { $set: updateFields },
          { returnDocument: 'after' }
        );
        updatedOrder = result?.value || result;
      } catch (e) {
        console.warn('[Orders] Could not update order in MongoDB, updating memory store:', e);
      }
    }

    // Update fallback store
    fallbackStore.orders = fallbackStore.orders || [];
    const orderIdx = fallbackStore.orders.findIndex(
      o => (o._id && o._id.toString() === id) || o.id === id || o.orderNumber === id
    );

    if (orderIdx !== -1) {
      fallbackStore.orders[orderIdx] = {
        ...fallbackStore.orders[orderIdx],
        ...updateFields,
        customer: {
          ...fallbackStore.orders[orderIdx].customer,
          ...(customerName !== undefined ? { name: customerName } : {}),
          ...(customerEmail !== undefined ? { email: customerEmail } : {}),
          ...(customerPhone !== undefined ? { phone: customerPhone } : {})
        },
        updatedAt: now
      };
      if (!updatedOrder) {
        updatedOrder = fallbackStore.orders[orderIdx];
      }
    }

    // Record activity log
    await recordActivityLog({
      action: 'UPDATE',
      entity: 'ORDER',
      entityId: id,
      entityName: `Pesanan #${existingOrder.orderNumber}`,
      summary: `Mengubah pesanan #${existingOrder.orderNumber}: Total ${previousTotal.toLocaleString('id-ID')} -> ${newTotalAmount.toLocaleString('id-ID')} (${adjustmentType === 'ADDITIONAL_PAYMENT' ? `Kurang bayar Rp ${differenceAmount.toLocaleString('id-ID')}` : adjustmentType === 'REFUND' ? `Kembalikan selisih Rp ${differenceAmount.toLocaleString('id-ID')}` : 'Tidak ada selisih'})`,
      details: {
        orderId: id,
        orderNumber: existingOrder.orderNumber,
        previousTotal,
        newTotalAmount,
        netDifference,
        adjustmentType,
        settledMethod
      },
      req,
      vendorId: activeVendorId
    });

    return res.json({
      success: true,
      message: adjustmentType === 'ADDITIONAL_PAYMENT'
        ? `Pesanan berhasil diperbarui! Pelanggan perlu membayar kekurangan Rp ${differenceAmount.toLocaleString('id-ID')}.`
        : adjustmentType === 'REFUND'
          ? `Pesanan berhasil diperbarui! Kembalikan kelebihan bayar Rp ${differenceAmount.toLocaleString('id-ID')} kepada pelanggan.`
          : 'Pesanan berhasil diperbarui tanpa perubahan total pembayaran.',
      order: updatedOrder ? {
        id: updatedOrder._id ? updatedOrder._id.toString() : updatedOrder.id,
        ...updatedOrder
      } : null,
      paymentAdjustment
    });
  } catch (err: any) {
    console.error('[Orders] Adjust order error:', err);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * POST /api/orders/:id/cancel
 * Cancel an already paid/completed order, process refund, and store reason (5-50 chars)
 * RBAC: CASHIER, MANAGER, ADMIN
 */
orderRouter.post('/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'CASHIER' && userRole !== 'MANAGER' && userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Akses ditolak. Membatalkan pesanan membutuhkan role CASHIER atau MANAGER.'
      });
    }

    const { id } = req.params as unknown as IParam;
    const parsed = cancelPaidOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return res.status(400).json({
        success: false,
        error: issue ? issue.message : 'Alasan pembatalan tidak valid (harus 5 - 50 karakter)'
      });
    }

    const { reason, refundMethod } = parsed.data;

    const db = getDB();
    let existingOrder: any = null;

    if (db) {
      try {
        const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };
        existingOrder = await db.collection('orders').findOne(query);
      } catch (e) {}
    }

    if (!existingOrder) {
      existingOrder = fallbackStore.orders.find(o => (o._id && o._id.toString() === id) || o.id === id || o.orderNumber === id);
    }

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: 'Pesanan tidak ditemukan.'
      });
    }

    if (existingOrder.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: 'Pesanan ini sudah dibatalkan sebelumnya.'
      });
    }

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || existingOrder.vendorId || 'vnd_kasirkafe_central';
    const now = new Date();
    const cashierName = (req as any).user?.name || 'Kasir';
    const refundAmount = existingOrder.totalAmount || 0;
    const resolvedRefundMethod = refundMethod || existingOrder.paymentMethod || 'CASH';

    const cancellationData = {
      reason: reason.trim(),
      refundAmount,
      refundMethod: resolvedRefundMethod,
      cancelledAt: now.toISOString(),
      cancelledBy: cashierName
    };

    const updateFields: any = {
      status: 'CANCELLED',
      cancellation: cancellationData,
      updatedAt: now
    };

    let updatedOrder: any = null;

    if (db) {
      try {
        const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };
        const result = await db.collection('orders').findOneAndUpdate(
          query,
          { $set: updateFields },
          { returnDocument: 'after' }
        );
        updatedOrder = result?.value || result;
      } catch (e) {
        console.warn('[Orders] Could not update order cancellation in MongoDB:', e);
      }
    }

    fallbackStore.orders = fallbackStore.orders || [];
    const orderIdx = fallbackStore.orders.findIndex(
      o => (o._id && o._id.toString() === id) || o.id === id || o.orderNumber === id
    );

    if (orderIdx !== -1) {
      fallbackStore.orders[orderIdx] = {
        ...fallbackStore.orders[orderIdx],
        ...updateFields
      };
      if (!updatedOrder) {
        updatedOrder = fallbackStore.orders[orderIdx];
      }
    }

    // Record activity log
    await recordActivityLog({
      action: 'UPDATE',
      entity: 'ORDER',
      entityId: id,
      entityName: `Pembatalan Pesanan #${existingOrder.orderNumber}`,
      summary: `Membatalkan pesanan #${existingOrder.orderNumber}. Pengembalian dana: Rp ${refundAmount.toLocaleString('id-ID')} via ${resolvedRefundMethod}. Alasan: "${reason.trim()}"`,
      details: {
        orderId: id,
        orderNumber: existingOrder.orderNumber,
        refundAmount,
        refundMethod: resolvedRefundMethod,
        reason: reason.trim()
      },
      req,
      vendorId: activeVendorId
    });

    return res.json({
      success: true,
      message: `Pesanan #${existingOrder.orderNumber} berhasil dibatalkan. Pengembalian dana Rp ${refundAmount.toLocaleString('id-ID')} diproses via ${resolvedRefundMethod}.`,
      order: updatedOrder ? {
        id: updatedOrder._id ? updatedOrder._id.toString() : updatedOrder.id,
        ...updatedOrder
      } : null,
      cancellation: cancellationData
    });
  } catch (err: any) {
    console.error('[Orders] Cancel order error:', err);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * GET /api/orders
 * List sales history with email delivery logs
 */
orderRouter.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN';
    const isAllVendors = (req.query.allVendors === 'true' || req.query.vendorId === 'all') && isAdmin;
    const requestedVendor = (req.query.vendorId as string) || '';
    const activeVendorId = req.vendorId || 'vnd_kasirkafe_central';
    const db = getDB();
    let orders: any[] = [];

    if (db) {
      try {
        let query: any = {};
        if (isAllVendors) {
          query = {};
        } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
          query = requestedVendor === 'vnd_kasirkafe_central'
            ? { $or: [{ vendorId: 'vnd_kasirkafe_central' }, { vendorId: { $exists: false } }, { vendorId: null }] }
            : { vendorId: requestedVendor };
        } else {
          query = activeVendorId === 'vnd_kasirkafe_central'
            ? { $or: [{ vendorId: 'vnd_kasirkafe_central' }, { vendorId: { $exists: false } }, { vendorId: null }] }
            : { vendorId: activeVendorId };
        }
        orders = await db.collection('orders').find(query).sort({ createdAt: -1 }).limit(200).toArray();
      } catch (e) {}
    }

    if (orders.length === 0) {
      if (isAllVendors) {
        orders = fallbackStore.orders;
      } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
        orders = fallbackStore.orders.filter(o => (o.vendorId || 'vnd_kasirkafe_central') === requestedVendor);
      } else {
        orders = fallbackStore.orders.filter(o => (o.vendorId || 'vnd_kasirkafe_central') === activeVendorId);
      }
    }

    return res.json({
      success: true,
      vendorId: isAllVendors ? 'all' : (requestedVendor || activeVendorId),
      isAllVendors,
      orders: orders.map(o => ({
        id: o._id ? o._id.toString() : o.id,
        vendorId: o.vendorId || 'vnd_kasirkafe_central',
        orderNumber: o.orderNumber,
        queueNumber: o.queueNumber,
        items: o.items,
        discountItem: o.discountItem || null,
        selectedDiscountCode: o.selectedDiscountCode || null,
        subtotal: o.subtotal,
        discountAmount: o.discountAmount,
        appliedDiscounts: o.appliedDiscounts || [],
        freeItemsSummary: o.freeItemsSummary || [],
        pb1Tax: o.pb1Tax,
        totalAmount: o.totalAmount,
        paymentMethod: o.paymentMethod,
        cashReceived: o.cashReceived,
        change: o.change,
        customer: o.customer,
        cashier: o.cashier,
        status: o.status,
        emailStatus: o.emailStatus || 'none',
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        isAdjusted: o.isAdjusted || false,
        originalTotalAmount: o.originalTotalAmount,
        paymentAdjustment: o.paymentAdjustment || null,
        cancellation: o.cancellation || null
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * POST /api/orders/:id/resend-email
 */
orderRouter.post('/:id/resend-email', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as IParam;
    const { targetEmail } = req.body;

    const db = getDB();
    let order: any = null;

    if (db) {
      try {
        const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { orderNumber: id };
        order = await db.collection('orders').findOne(query);
      } catch (e) {}
    }

    if (!order) {
      order = fallbackStore.orders.find(o => (o._id && o._id.toString() === id) || o.orderNumber === id);
    }

    if (!order) {
      return res.status(404).json({ success: false, error: 'Pesanan tidak ditemukan' });
    }

    const emailToSend = targetEmail || order.customer?.email;
    if (!emailToSend) {
      return res.status(400).json({
        success: false,
        error: 'Email diperlukan untuk mengirimkan struk.'
      });
    }

    const itemsTableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tbody>
          ${order.items
            .map(
              (it: any) => `
            <tr>
              <td style="padding: 6px 0; border-bottom: 1px solid #fbf0ee;">
                <strong>${it.name}</strong> x ${it.quantity}
              </td>
              <td style="padding: 6px 0; text-align: right; border-bottom: 1px solid #fbf0ee;">
                Rp ${it.itemTotal?.toLocaleString('id-ID')}
              </td>
            </tr>
          `
            )
            .join('')}
          ${order.discountItem ? `
            <tr>
              <td colspan="2" style="padding: 8px; background-color: #fff8f5; border: 1px dashed #e87a5d; border-radius: 6px; margin-top: 4px;">
                <span style="font-size: 10px; font-weight: bold; color: #c2410c;">🎁 ITEM DISKON: ${order.discountItem.name}</span><br>
                <span style="font-size: 11px; color: #78716c;">
                  ${order.discountItem.ruleName} | Normal: <del>Rp ${order.discountItem.originalPrice?.toLocaleString('id-ID')}</del> &rarr; 
                  <strong style="color: #047857;">${order.discountItem.discountedPrice === 0 ? 'GRATIS' : 'Rp ' + order.discountItem.discountedPrice?.toLocaleString('id-ID')}</strong>
                  (Hemat Rp ${order.discountItem.discountAmount?.toLocaleString('id-ID')})
                </span>
              </td>
            </tr>
          ` : ''}
        </tbody>
      </table>
    `;

    const result = await sendReceiptEmail({
      vendorId: order.vendorId || req.vendorId || 'vnd_kasirkafe_central',
      recipientEmail: emailToSend,
      orderId: order._id ? order._id.toString() : id,
      orderNumber: order.orderNumber,
      variables: {
        orderNumber: order.orderNumber,
        customerName: order.customer?.name || 'Pelanggan Setia',
        cashierName: order.cashier?.name || 'Kasir KasirKafe',
        date: new Date(order.createdAt).toLocaleString('id-ID'),
        itemsTable: itemsTableHtml,
        subtotal: `Rp ${order.subtotal?.toLocaleString('id-ID')}`,
        discount: `Rp ${order.discountAmount?.toLocaleString('id-ID')}`,
        tax: `Rp ${order.pb1Tax?.toLocaleString('id-ID')}`,
        total: `Rp ${order.totalAmount?.toLocaleString('id-ID')}`,
        paymentMethod: order.paymentMethod,
        change: `Rp ${order.change?.toLocaleString('id-ID')}`
      }
    });

    return res.json({
      success: result.success,
      message: result.success ? `Struk berhasil dikirim ulang ke ${emailToSend}!` : 'Gagal mengirim email.',
      error: result.error
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});
