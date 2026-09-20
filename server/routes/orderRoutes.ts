import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB, fallbackStore } from '../db';
import { calculateDiscounts, getActiveDiscountRules } from '../discounts';
import { sendReceiptEmail } from '../mail';
import { authMiddleware } from '../auth';
import { ObjectId } from 'mongodb';
import { recordActivityLog } from '../activityLogger';

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
  const activeVendorId = vendorId || 'vnd_sipspot_central';
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
  const activeVendorId = req.vendorId || 'vnd_sipspot_central';
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
      discountItem
    } = parsed.data;

    // 1. Calculate items subtotal
    const subtotal = items.reduce((acc, item) => acc + item.itemTotal, 0);

    // Active Vendor ID resolution
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_sipspot_central';

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
    const cashierName = req.user?.name || 'Kasir SipSpot';

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
          customerName: customerName || 'Sahabat SipSpot',
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
 * GET /api/orders
 * List sales history with email delivery logs
 */
orderRouter.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN' || (req.user as any)?.role === 'SUPERADMIN';
    const isAllVendors = (req.query.allVendors === 'true' || req.query.vendorId === 'all') && isAdmin;
    const requestedVendor = (req.query.vendorId as string) || '';
    const activeVendorId = req.vendorId || 'vnd_sipspot_central';
    const db = getDB();
    let orders: any[] = [];

    if (db) {
      try {
        let query: any = {};
        if (isAllVendors) {
          query = {};
        } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
          query = requestedVendor === 'vnd_sipspot_central'
            ? { $or: [{ vendorId: 'vnd_sipspot_central' }, { vendorId: { $exists: false } }, { vendorId: null }] }
            : { vendorId: requestedVendor };
        } else {
          query = activeVendorId === 'vnd_sipspot_central'
            ? { $or: [{ vendorId: 'vnd_sipspot_central' }, { vendorId: { $exists: false } }, { vendorId: null }] }
            : { vendorId: activeVendorId };
        }
        orders = await db.collection('orders').find(query).sort({ createdAt: -1 }).limit(200).toArray();
      } catch (e) {}
    }

    if (orders.length === 0) {
      if (isAllVendors) {
        orders = fallbackStore.orders;
      } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
        orders = fallbackStore.orders.filter(o => (o.vendorId || 'vnd_sipspot_central') === requestedVendor);
      } else {
        orders = fallbackStore.orders.filter(o => (o.vendorId || 'vnd_sipspot_central') === activeVendorId);
      }
    }

    return res.json({
      success: true,
      vendorId: isAllVendors ? 'all' : (requestedVendor || activeVendorId),
      isAllVendors,
      orders: orders.map(o => ({
        id: o._id ? o._id.toString() : o.id,
        vendorId: o.vendorId || 'vnd_sipspot_central',
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
        createdAt: o.createdAt
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
    const { id } = req.params;
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
      vendorId: order.vendorId || req.vendorId || 'vnd_sipspot_central',
      recipientEmail: emailToSend,
      orderId: order._id ? order._id.toString() : id,
      orderNumber: order.orderNumber,
      variables: {
        orderNumber: order.orderNumber,
        customerName: order.customer?.name || 'Pelanggan Setia',
        cashierName: order.cashier?.name || 'Kasir SipSpot',
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
