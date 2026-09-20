import { Router, Request, Response } from 'express';
import { authMiddleware, requireManager } from '../auth';
import { getDB, fallbackStore } from '../db';
import { getAllVendors, findVendorById } from '../vendorMiddleware';
import {
  getCutoffDate,
  getRetentionStatus,
  runRetentionCleanup,
  RETENTION_DAYS,
  RETENTION_MONTHS
} from '../retentionScheduler';

export const managerAnalyticsRouter = Router();

// Guarded for MANAGER, ADMIN, and SUPERADMIN
managerAnalyticsRouter.use(authMiddleware, requireManager);

const INDONESIAN_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const INDONESIAN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatDateYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekNumber(d: Date): { year: number; week: number; start: Date; end: Date } {
  const date = new Date(d.getTime());
  const day = (date.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);

  const start = new Date(date);
  const end = new Date(date);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

  return {
    year: date.getFullYear(),
    week: weekNumber,
    start,
    end
  };
}

/**
 * Helper: Resolve manager's assigned vendor
 * Strict isolation: MANAGER can ONLY view their own vendor's transactions
 */
async function resolveManagerVendor(req: Request) {
  const user = req.user!;
  let targetVendorId = user.vendorId || req.vendorId || 'vnd_sipspot_central';

  // If user is ADMIN or SUPERADMIN testing or managing, they may optionally pass a specific vendor
  if ((user.role === 'ADMIN' || user.role === 'SUPERADMIN') && req.query.vendorId && req.query.vendorId !== 'all') {
    targetVendorId = req.query.vendorId as string;
  }

  const allVendors = await getAllVendors();
  const vendorObj = allVendors.find(v => v.id === targetVendorId) ||
    allVendors.find(v => v.id !== 'vnd_admin') ||
    allVendors[0];

  return {
    vendorId: vendorObj ? vendorObj.id : targetVendorId,
    vendor: vendorObj
  };
}

/**
 * GET /api/manager/analytics/transactions
 * Returns transaction analytics strictly scoped to the manager's assigned vendor
 * Enforces 3-month (90 days) data retention policy
 */
managerAnalyticsRouter.get('/transactions', async (req: Request, res: Response) => {
  try {
    const { vendorId, vendor } = await resolveManagerVendor(req);

    // Reference now: current runtime timestamp
    const now = new Date().getFullYear() >= 2026 ? new Date() : new Date('2026-09-20T12:00:00.000Z');
    const todayStr = formatDateYMD(now);
    const cutoffDate = getCutoffDate(); // Strict 90 days retention window

    // Fetch orders within 3-month retention window for this vendor ONLY
    const db = getDB();
    let rawOrders: any[] = [];
    if (db) {
      try {
        rawOrders = await db.collection('orders').find({
          vendorId: vendorId,
          createdAt: { $gte: cutoffDate }
        }).sort({ createdAt: 1 }).toArray();
      } catch (e) {
        console.error('[ManagerAnalytics] MongoDB find error:', e);
      }
    }
    if (rawOrders.length === 0) {
      rawOrders = (fallbackStore.orders || []).filter((o: any) => {
        const d = new Date(o.createdAt || o.date);
        return o.vendorId === vendorId && d >= cutoffDate;
      });
    }

    interface CleanOrder {
      id: string;
      orderNumber: string;
      vendorId: string;
      amount: number;
      subtotal: number;
      discountAmount: number;
      pb1Tax: number;
      paymentMethod: string;
      cashierName: string;
      customerName: string;
      itemsCount: number;
      date: Date;
      ymd: string;
      year: number;
      monthKey: string;
    }

    const cleanOrders: CleanOrder[] = rawOrders
      .filter((o: any) => {
        const d = new Date(o.createdAt || now);
        return d >= cutoffDate;
      })
      .map((o: any) => {
        const d = new Date(o.createdAt || now);
        const amount = Number(o.totalAmount ?? o.total ?? 0);
        const ymd = formatDateYMD(d);
        const year = d.getFullYear();
        const monthKey = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const items = Array.isArray(o.items) ? o.items : [];
        const itemsCount = items.reduce((sum: number, i: any) => sum + Number(i.quantity || 1), 0);

        return {
          id: (o._id ? o._id.toString() : o.id) || '',
          orderNumber: o.orderNumber || o.id || '',
          vendorId,
          amount,
          subtotal: Number(o.subtotal || amount),
          discountAmount: Number(o.discountAmount || 0),
          pb1Tax: Number(o.pb1Tax || 0),
          paymentMethod: o.paymentMethod || 'QRIS',
          cashierName: o.cashier?.name || 'Kasir',
          customerName: o.customerName || 'Pelanggan Walk-in',
          itemsCount,
          date: d,
          ymd,
          year,
          monthKey
        };
      });

    // 1. Summary KPIs for Manager's Vendor
    const totalOrders = cleanOrders.length;
    const totalRevenue = cleanOrders.reduce((sum, o) => sum + o.amount, 0);
    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    const todayOrders = cleanOrders.filter(o => o.ymd === todayStr);
    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.amount, 0);

    const { start: weekStart, end: weekEnd } = getWeekNumber(now);
    const thisWeekOrders = cleanOrders.filter(o => o.date >= weekStart && o.date <= weekEnd);
    const thisWeekRevenue = thisWeekOrders.reduce((sum, o) => sum + o.amount, 0);

    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthOrders = cleanOrders.filter(o => o.monthKey === currentMonthKey);
    const thisMonthRevenue = thisMonthOrders.reduce((sum, o) => sum + o.amount, 0);

    // 2. PERIOD 1: PER HARI (Daily Breakdown - Last 30 Days)
    const dailyData = [];
    for (let i = 29; i >= 0; i--) {
      const dayDate = new Date(now.getTime() - i * 86400000);
      const ymd = formatDateYMD(dayDate);
      const dayName = INDONESIAN_DAYS[dayDate.getDay()];
      const dayLabel = `${dayDate.getDate()} ${INDONESIAN_MONTHS[dayDate.getMonth()]}`;

      const dayOrders = cleanOrders.filter(o => o.ymd === ymd);
      const dayRevenue = dayOrders.reduce((sum, o) => sum + o.amount, 0);
      const avgTicket = dayOrders.length > 0 ? Math.round(dayRevenue / dayOrders.length) : 0;

      // Payment counts for this day
      const paymentCounts: Record<string, number> = {};
      dayOrders.forEach(o => {
        paymentCounts[o.paymentMethod] = (paymentCounts[o.paymentMethod] || 0) + 1;
      });

      dailyData.push({
        date: ymd,
        label: dayLabel,
        dayName,
        totalOrders: dayOrders.length,
        totalRevenue: dayRevenue,
        averageTicket: avgTicket,
        paymentCounts
      });
    }

    // 3. PERIOD 2: PER MINGGU (Weekly Breakdown - Last 12 Weeks)
    const weeklyData = [];
    for (let w = 11; w >= 0; w--) {
      const refDate = new Date(now.getTime() - w * 7 * 86400000);
      const { year: wYear, week: wNumber, start: wStart, end: wEnd } = getWeekNumber(refDate);

      const weekKey = `${wYear}-W${String(wNumber).padStart(2, '0')}`;
      const startLabel = `${wStart.getDate()} ${INDONESIAN_MONTHS[wStart.getMonth()]}`;
      const endLabel = `${wEnd.getDate()} ${INDONESIAN_MONTHS[wEnd.getMonth()]}`;
      const weekLabel = `Mgg ${wNumber} (${startLabel} - ${endLabel})`;

      const weekOrders = cleanOrders.filter(o => o.date >= wStart && o.date <= wEnd);
      const weekRevenue = weekOrders.reduce((sum, o) => sum + o.amount, 0);
      const avgTicket = weekOrders.length > 0 ? Math.round(weekRevenue / weekOrders.length) : 0;

      weeklyData.push({
        weekKey,
        label: weekLabel,
        shortLabel: `Mgg ${wNumber}`,
        startDate: formatDateYMD(wStart),
        endDate: formatDateYMD(wEnd),
        totalOrders: weekOrders.length,
        totalRevenue: weekRevenue,
        averageTicket: avgTicket
      });
    }

    // 4. PERIOD 3: PER BULAN (Monthly Breakdown - 3 Bulan Terakhir sesuai Kebijakan Retensi)
    const monthlyData = [];
    for (let m = 2; m >= 0; m--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const mYear = monthDate.getFullYear();
      const mMonth = monthDate.getMonth();
      const monthKey = `${mYear}-${String(mMonth + 1).padStart(2, '0')}`;
      const monthLabel = `${INDONESIAN_MONTHS[mMonth]} ${mYear}`;

      const monthOrders = cleanOrders.filter(o => o.monthKey === monthKey);
      const monthRevenue = monthOrders.reduce((sum, o) => sum + o.amount, 0);
      const avgTicket = monthOrders.length > 0 ? Math.round(monthRevenue / monthOrders.length) : 0;

      monthlyData.push({
        monthKey,
        label: monthLabel,
        year: mYear,
        month: mMonth + 1,
        totalOrders: monthOrders.length,
        totalRevenue: monthRevenue,
        averageTicket: avgTicket
      });
    }

    // 5. Payment Methods Breakdown
    const paymentMap: Record<string, { count: number; revenue: number }> = {};
    cleanOrders.forEach(o => {
      if (!paymentMap[o.paymentMethod]) {
        paymentMap[o.paymentMethod] = { count: 0, revenue: 0 };
      }
      paymentMap[o.paymentMethod].count++;
      paymentMap[o.paymentMethod].revenue += o.amount;
    });

    const paymentMethods = Object.entries(paymentMap).map(([method, data]) => ({
      method,
      count: data.count,
      revenue: data.revenue,
      percentage: totalRevenue > 0 ? Number(((data.revenue / totalRevenue) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.revenue - a.revenue);

    const retentionStatus = await getRetentionStatus();

    return res.json({
      success: true,
      vendor: {
        id: vendor?.id || vendorId,
        name: vendor?.name || 'Vendor Toko',
        code: vendor?.code || 'VENDOR',
        address: vendor?.address || '',
        currency: vendor?.currency || 'IDR'
      },
      retention: {
        ...retentionStatus,
        vendorOrdersCount: cleanOrders.length
      },
      retentionPolicy: {
        months: RETENTION_MONTHS,
        days: RETENTION_DAYS,
        cutoffDate: cutoffDate.toISOString(),
        description: 'Data transaksi vendor Anda disimpan selama 3 bulan terakhir (90 hari). Data yang lebih lama otomatis dibersihkan oleh skeduler berkala.'
      },
      summary: {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        today: { orders: todayOrders.length, revenue: todayRevenue },
        thisWeek: { orders: thisWeekOrders.length, revenue: thisWeekRevenue },
        thisMonth: { orders: thisMonthOrders.length, revenue: thisMonthRevenue }
      },
      daily: dailyData,
      weekly: weeklyData,
      monthly: monthlyData,
      paymentMethods
    });
  } catch (err: any) {
    console.error('[ManagerAnalytics] GET /transactions error:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

/**
 * GET /api/manager/analytics/transactions/export
 * Exports vendor transactions within the 3-month retention window as CSV or JSON
 * Strict vendor isolation enforced
 */
managerAnalyticsRouter.get('/transactions/export', async (req: Request, res: Response) => {
  try {
    const { vendorId, vendor } = await resolveManagerVendor(req);
    const period = ((req.query.period as string) || 'all').toLowerCase(); // 'day' | 'week' | 'month' | 'all'
    const format = ((req.query.format as string) || 'csv').toLowerCase(); // 'csv' | 'json'

    const now = new Date().getFullYear() >= 2026 ? new Date() : new Date('2026-09-20T12:00:00.000Z');
    const cutoffDate = getCutoffDate(); // Enforce 3-month retention (90 days)

    let startDate: Date;
    let endDate = new Date(now.getTime());
    endDate.setHours(23, 59, 59, 999);
    let periodTitle = '';

    if (period === 'day') {
      startDate = new Date(now.getTime() - 30 * 86400000); // 30 days
      startDate.setHours(0, 0, 0, 0);
      periodTitle = `Transaksi Harian 30 Hari Terakhir (${formatDateYMD(startDate)} sd ${formatDateYMD(now)})`;
    } else if (period === 'week') {
      startDate = new Date(now.getTime() - 12 * 7 * 86400000); // 12 weeks
      startDate.setHours(0, 0, 0, 0);
      periodTitle = `Transaksi Mingguan 12 Minggu Terakhir (${formatDateYMD(startDate)} sd ${formatDateYMD(now)})`;
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1); // 3 months
      startDate.setHours(0, 0, 0, 0);
      periodTitle = `Transaksi Bulanan 3 Bulan Terakhir (${formatDateYMD(startDate)} sd ${formatDateYMD(now)})`;
    } else {
      startDate = new Date(cutoffDate.getTime());
      periodTitle = `Seluruh Transaksi Vendor 3 Bulan Terakhir (${formatDateYMD(startDate)} sd ${formatDateYMD(now)})`;
    }

    if (startDate < cutoffDate) {
      startDate = new Date(cutoffDate.getTime());
    }

    // Fetch vendor orders
    const db = getDB();
    let orders: any[] = [];
    if (db) {
      try {
        orders = await db.collection('orders').find({
          vendorId: vendorId,
          createdAt: { $gte: startDate, $lte: endDate }
        }).sort({ createdAt: -1 }).toArray();
      } catch (e) {
        console.error('[ManagerAnalytics] Export find error:', e);
      }
    }
    if (orders.length === 0) {
      orders = (fallbackStore.orders || []).filter((o: any) => {
        const d = new Date(o.createdAt || o.date);
        return o.vendorId === vendorId && d >= startDate && d <= endDate;
      }).sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
    }

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount ?? o.total ?? 0), 0);
    const vendorName = vendor?.name || 'Vendor Toko';
    const vendorCode = vendor?.code || 'VENDOR';

    // JSON Format Export
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="transaksi_${vendorCode.toLowerCase()}_3bulan_${period}_${formatDateYMD(now)}.json"`);

      return res.status(200).json({
        exportMeta: {
          title: `Laporan Transaksi - ${vendorName}`,
          vendorId,
          vendorName,
          vendorCode,
          period,
          periodDescription: periodTitle,
          retentionPolicy: '3 Bulan (90 Hari Terakhir)',
          cutoffDate: cutoffDate.toISOString(),
          exportedAt: now.toISOString(),
          totalTransactions: orders.length,
          totalRevenue
        },
        transactions: orders.map((o: any) => {
          const d = new Date(o.createdAt || now);
          return {
            orderNumber: o.orderNumber || o.id,
            queueNumber: o.queueNumber || '-',
            timestamp: d.toISOString(),
            formattedDate: `${formatDateYMD(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
            cashier: o.cashier?.name || 'Kasir',
            paymentMethod: o.paymentMethod || 'QRIS',
            totalAmount: Number(o.totalAmount ?? o.total ?? 0),
            subtotal: Number(o.subtotal || o.totalAmount || 0),
            discountAmount: Number(o.discountAmount || 0),
            pb1Tax: Number(o.pb1Tax || 0),
            items: (o.items || []).map((i: any) => ({
              name: i.name,
              category: i.category,
              quantity: i.quantity,
              price: i.price,
              itemTotal: i.itemTotal || (i.price * i.quantity)
            }))
          };
        })
      });
    }

    // CSV Format Export with UTF-8 BOM
    const csvHeader = [
      'No. Transaksi',
      'No. Antrean',
      'Waktu Transaksi (WIB)',
      'Vendor / Cabang',
      'Kode Vendor',
      'Kasir',
      'Metode Bayar',
      'Rincian Menu Produk',
      'Total Item',
      'Subtotal (Rp)',
      'Diskon (Rp)',
      'Pajak PB1 (Rp)',
      'Total Omzet (Rp)',
      'Status',
      'Kebijakan Retensi Data'
    ];

    const csvRows = orders.map(o => {
      const items = Array.isArray(o.items) ? o.items : [];
      const itemDesc = items.map((i: any) => `${i.name} (x${i.quantity || 1})`).join('; ');
      const totalQty = items.reduce((sum: number, i: any) => sum + Number(i.quantity || 1), 0);
      const d = new Date(o.createdAt || now);
      const dateStr = `${formatDateYMD(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const amount = Number(o.totalAmount ?? o.total ?? 0);
      const sub = Number(o.subtotal || amount);
      const disc = Number(o.discountAmount || 0);
      const tax = Number(o.pb1Tax || 0);

      return [
        `"${(o.orderNumber || o.id || '').replace(/"/g, '""')}"`,
        `"${(o.queueNumber || '-').replace(/"/g, '""')}"`,
        `"${dateStr}"`,
        `"${vendorName.replace(/"/g, '""')}"`,
        `"${vendorCode.replace(/"/g, '""')}"`,
        `"${(o.cashier?.name || 'Kasir').replace(/"/g, '""')}"`,
        `"${(o.paymentMethod || 'QRIS').replace(/"/g, '""')}"`,
        `"${itemDesc.replace(/"/g, '""')}"`,
        totalQty,
        sub,
        disc,
        tax,
        amount,
        `"LUNAS"`,
        `"Retensi 3 Bulan (90 Hari)"`
      ].join(',');
    });

    // Summary metadata row for Excel
    const summaryRow = [
      `"TOTAL KESELURUHAN"`,
      `""`,
      `"Diekspor: ${formatDateYMD(now)}"`,
      `"${vendorName.replace(/"/g, '""')}"`,
      `"${vendorCode}"`,
      `""`,
      `""`,
      `"Total: ${orders.length} Transaksi"`,
      `""`,
      `""`,
      `""`,
      `""`,
      totalRevenue,
      `""`,
      `"Batas Cutoff: ${formatDateYMD(cutoffDate)}"`
    ].join(',');

    const csvContent = '\uFEFF' + [csvHeader.join(','), summaryRow, ...csvRows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transaksi_${vendorCode.toLowerCase()}_3bulan_${period}_${formatDateYMD(now)}.csv"`);
    return res.status(200).send(csvContent);
  } catch (err: any) {
    console.error('[ManagerAnalytics] Export transactions error:', err);
    return res.status(500).json({ success: false, error: 'Export failed' });
  }
});

/**
 * GET /api/manager/analytics/retention-status
 * Fetches current data retention status and scheduler schedule
 */
managerAnalyticsRouter.get('/retention-status', async (req: Request, res: Response) => {
  try {
    const status = await getRetentionStatus();
    return res.json({ success: true, ...status });
  } catch (err: any) {
    console.error('[ManagerAnalytics] GET /retention-status error:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

/**
 * POST /api/manager/analytics/retention-run
 * Allows Manager to trigger retention cleanup scheduler on demand
 */
managerAnalyticsRouter.post('/retention-run', async (req: Request, res: Response) => {
  try {
    const { vendor } = await resolveManagerVendor(req);
    const user = req.user!;
    const operator = `${user.name} (MANAGER - ${vendor?.name || 'Vendor'})`;

    const result = await runRetentionCleanup(operator);
    const currentStatus = await getRetentionStatus();

    return res.json({
      success: true,
      message: `Pembersihan retensi data 3 bulan berhasil dijalankan. ${result.deletedCount} pesanan usang dihapus.`,
      result,
      status: currentStatus
    });
  } catch (err: any) {
    console.error('[ManagerAnalytics] POST /retention-run error:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

/**
 * GET /api/manager/analytics/top-products
 * Returns Top 10 Best-Selling items for the Manager's assigned vendor ONLY
 * Strictly scoped to manager's vendor and enforces 3-month (90 days) data retention policy
 */
managerAnalyticsRouter.get('/top-products', async (req: Request, res: Response) => {
  try {
    const { vendorId, vendor } = await resolveManagerVendor(req);
    const period = ((req.query.period as string) || 'day').toLowerCase(); // 'day' | 'week' | 'month'
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '10', 10), 1), 50);

    const vendorName = vendor?.name || 'Vendor Toko';
    const vendorCode = vendor?.code || 'VENDOR';

    // Reference now: 2026-09-20 (or current runtime date)
    const now = new Date().getFullYear() >= 2026 ? new Date() : new Date('2026-09-20T14:30:00.000Z');
    const cutoffDate = getCutoffDate(); // Enforce 3-month (90 days) retention policy

    let startDate: Date;
    let endDate = new Date(now.getTime());
    endDate.setHours(23, 59, 59, 999);
    let periodLabel = '';

    if (period === 'day') {
      startDate = new Date(now.getTime());
      startDate.setHours(0, 0, 0, 0);
      const dayName = INDONESIAN_DAYS[startDate.getDay()];
      periodLabel = `Hari Ini (${dayName}, ${startDate.getDate()} ${INDONESIAN_MONTHS[startDate.getMonth()]} ${startDate.getFullYear()})`;
    } else if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 86400000);
      startDate.setHours(0, 0, 0, 0);
      periodLabel = `Per Minggu (7 Hari Terakhir: ${startDate.getDate()} ${INDONESIAN_MONTHS[startDate.getMonth()]} - ${now.getDate()} ${INDONESIAN_MONTHS[now.getMonth()]} ${now.getFullYear()})`;
    } else {
      // 'month' - last 30 days
      startDate = new Date(now.getTime() - 30 * 86400000);
      startDate.setHours(0, 0, 0, 0);
      periodLabel = `Per Bulan (30 Hari Terakhir: ${startDate.getDate()} ${INDONESIAN_MONTHS[startDate.getMonth()]} - ${now.getDate()} ${INDONESIAN_MONTHS[now.getMonth()]} ${now.getFullYear()})`;
    }

    if (startDate < cutoffDate) {
      startDate = new Date(cutoffDate.getTime());
    }

    // Fetch vendor orders strictly for this vendor within date range & retention window
    const db = getDB();
    let orders: any[] = [];
    if (db) {
      try {
        orders = await db.collection('orders').find({
          vendorId: vendorId,
          createdAt: { $gte: startDate, $lte: endDate }
        }).toArray();
      } catch (e) {
        console.error('[ManagerAnalytics] Mongo query error:', e);
      }
    }
    if (orders.length === 0) {
      orders = (fallbackStore.orders || []).filter((o: any) => {
        const d = new Date(o.createdAt || o.date);
        return o.vendorId === vendorId && d >= startDate && d <= endDate && d >= cutoffDate;
      });
    }

    interface ProductAgg {
      productId: string;
      name: string;
      category: string;
      vendorId: string;
      vendorName: string;
      vendorCode: string;
      quantitySold: number;
      totalRevenue: number;
      orderCount: number;
    }

    const productMap = new Map<string, ProductAgg>();
    let totalItemsSoldAll = 0;
    let totalRevenueAll = 0;
    const categoryTotals: Record<string, { quantity: number; revenue: number }> = {};

    orders.forEach((o: any) => {
      const items = Array.isArray(o.items) ? o.items : [];
      const seenInOrder = new Set<string>();

      items.forEach((item: any) => {
        const pId = item.productId || item.id || `prod_${item.name}`;
        const name = item.name || 'Item Minuman';
        const category = item.category || 'Minuman';
        const qty = Number(item.quantity || 1);
        const price = Number(item.price || 0);
        const itemTotal = Number(item.itemTotal || (qty * price));

        const aggKey = `${pId}_${name}`;
        let agg = productMap.get(aggKey);
        if (!agg) {
          agg = {
            productId: pId,
            name,
            category,
            vendorId,
            vendorName,
            vendorCode,
            quantitySold: 0,
            totalRevenue: 0,
            orderCount: 0
          };
          productMap.set(aggKey, agg);
        }

        agg.quantitySold += qty;
        agg.totalRevenue += itemTotal;
        if (!seenInOrder.has(aggKey)) {
          agg.orderCount++;
          seenInOrder.add(aggKey);
        }

        totalItemsSoldAll += qty;
        totalRevenueAll += itemTotal;

        if (!categoryTotals[category]) {
          categoryTotals[category] = { quantity: 0, revenue: 0 };
        }
        categoryTotals[category].quantity += qty;
        categoryTotals[category].revenue += itemTotal;
      });
    });

    const sortedList = Array.from(productMap.values()).sort((a, b) => {
      if (b.quantitySold !== a.quantitySold) {
        return b.quantitySold - a.quantitySold;
      }
      return b.totalRevenue - a.totalRevenue;
    });

    const COLOR_PALETTE = [
      '#ea580c', '#8b5cf6', '#10b981', '#0284c7', '#ec4899',
      '#eab308', '#06b6d4', '#6366f1', '#14b8a6', '#f43f5e'
    ];

    const allRanked = sortedList.map((item, index) => {
      const averagePrice = item.quantitySold > 0 ? Math.round(item.totalRevenue / item.quantitySold) : 0;
      const percentageOfTotal = totalItemsSoldAll > 0 ? Number(((item.quantitySold / totalItemsSoldAll) * 100).toFixed(1)) : 0;
      const percentageOfRevenue = totalRevenueAll > 0 ? Number(((item.totalRevenue / totalRevenueAll) * 100).toFixed(1)) : 0;

      return {
        rank: index + 1,
        ...item,
        averagePrice,
        percentageOfTotal,
        percentageOfRevenue,
        color: COLOR_PALETTE[index % COLOR_PALETTE.length]
      };
    });

    const top10 = allRanked.slice(0, limit);

    let topCategoryObj = { name: '-', quantity: 0, revenue: 0 };
    let maxCatQty = -1;
    for (const [catName, cData] of Object.entries(categoryTotals)) {
      if (cData.quantity > maxCatQty) {
        maxCatQty = cData.quantity;
        topCategoryObj = { name: catName, quantity: cData.quantity, revenue: cData.revenue };
      }
    }

    const categoryBreakdown = Object.entries(categoryTotals).map(([cat, val]) => ({
      category: cat,
      quantity: val.quantity,
      revenue: val.revenue,
      percentage: totalItemsSoldAll > 0 ? Number(((val.quantity / totalItemsSoldAll) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.quantity - a.quantity);

    const retentionStatus = await getRetentionStatus();

    return res.json({
      success: true,
      period,
      periodLabel,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cutoffDate: cutoffDate.toISOString()
      },
      vendor: {
        id: vendorId,
        name: vendorName,
        code: vendorCode,
        address: vendor?.address || ''
      },
      topProducts: top10,
      allProductsCount: allRanked.length,
      summary: {
        totalItemsSold: totalItemsSoldAll,
        totalRevenue: totalRevenueAll,
        totalTransactions: orders.length,
        uniqueProductsCount: allRanked.length,
        topCategory: topCategoryObj,
        topProduct: top10.length > 0 ? {
          name: top10[0].name,
          category: top10[0].category,
          vendorName: top10[0].vendorName,
          quantitySold: top10[0].quantitySold,
          totalRevenue: top10[0].totalRevenue
        } : null
      },
      categoryBreakdown,
      retention: {
        ...retentionStatus,
        vendorOrdersCount: orders.length,
        retentionPolicy: `${RETENTION_MONTHS} Bulan (${RETENTION_DAYS} Hari Terakhir)`
      }
    });
  } catch (err: any) {
    console.error('[ManagerAnalytics] GET /top-products error:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

/**
 * GET /api/manager/analytics/top-products/export
 * Exports Top 10 Products for the Manager's assigned vendor in CSV or JSON format
 */
managerAnalyticsRouter.get('/top-products/export', async (req: Request, res: Response) => {
  try {
    const { vendorId, vendor } = await resolveManagerVendor(req);
    const period = ((req.query.period as string) || 'day').toLowerCase();
    const format = ((req.query.format as string) || 'csv').toLowerCase();

    const vendorName = vendor?.name || 'Vendor Toko';
    const vendorCode = vendor?.code || 'VENDOR';

    const now = new Date().getFullYear() >= 2026 ? new Date() : new Date('2026-09-20T14:30:00.000Z');
    const cutoffDate = getCutoffDate();

    let startDate: Date;
    let endDate = new Date(now.getTime());
    endDate.setHours(23, 59, 59, 999);
    let periodTitle = '';

    if (period === 'day') {
      startDate = new Date(now.getTime());
      startDate.setHours(0, 0, 0, 0);
      periodTitle = `Hari Ini (${formatDateYMD(now)})`;
    } else if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 86400000);
      startDate.setHours(0, 0, 0, 0);
      periodTitle = `Mingguan (${formatDateYMD(startDate)} sd ${formatDateYMD(now)})`;
    } else {
      startDate = new Date(now.getTime() - 30 * 86400000);
      startDate.setHours(0, 0, 0, 0);
      periodTitle = `Bulanan (${formatDateYMD(startDate)} sd ${formatDateYMD(now)})`;
    }

    if (startDate < cutoffDate) {
      startDate = new Date(cutoffDate.getTime());
    }

    const db = getDB();
    let orders: any[] = [];
    if (db) {
      try {
        orders = await db.collection('orders').find({
          vendorId: vendorId,
          createdAt: { $gte: startDate, $lte: endDate }
        }).toArray();
      } catch (e) {
        console.error('[ManagerAnalytics] Export top-products Mongo error:', e);
      }
    }
    if (orders.length === 0) {
      orders = (fallbackStore.orders || []).filter((o: any) => {
        const d = new Date(o.createdAt || o.date);
        return o.vendorId === vendorId && d >= startDate && d <= endDate && d >= cutoffDate;
      });
    }

    interface ProductAgg {
      productId: string;
      name: string;
      category: string;
      vendorId: string;
      vendorName: string;
      quantitySold: number;
      totalRevenue: number;
      orderCount: number;
    }

    const productMap = new Map<string, ProductAgg>();
    let totalQtyAll = 0;

    orders.forEach((o: any) => {
      const items = Array.isArray(o.items) ? o.items : [];
      const seen = new Set<string>();

      items.forEach((item: any) => {
        const pId = item.productId || item.id || `prod_${item.name}`;
        const name = item.name || 'Item Minuman';
        const category = item.category || 'Minuman';
        const qty = Number(item.quantity || 1);
        const price = Number(item.price || 0);
        const itemTotal = Number(item.itemTotal || (qty * price));
        const key = `${pId}_${name}`;

        let agg = productMap.get(key);
        if (!agg) {
          agg = {
            productId: pId,
            name,
            category,
            vendorId,
            vendorName,
            quantitySold: 0,
            totalRevenue: 0,
            orderCount: 0
          };
          productMap.set(key, agg);
        }

        agg.quantitySold += qty;
        agg.totalRevenue += itemTotal;
        if (!seen.has(key)) {
          agg.orderCount++;
          seen.add(key);
        }
        totalQtyAll += qty;
      });
    });

    const sortedList = Array.from(productMap.values()).sort((a, b) => b.quantitySold - a.quantitySold);
    const top10 = sortedList.slice(0, 10).map((item, idx) => ({
      rank: idx + 1,
      ...item,
      averagePrice: item.quantitySold > 0 ? Math.round(item.totalRevenue / item.quantitySold) : 0,
      sharePercentage: totalQtyAll > 0 ? Number(((item.quantitySold / totalQtyAll) * 100).toFixed(1)) : 0
    }));

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="top10_produk_${vendorCode.toLowerCase()}_${period}_${formatDateYMD(now)}.json"`);
      return res.json({
        exportDate: new Date().toISOString(),
        vendor: {
          id: vendorId,
          name: vendorName,
          code: vendorCode
        },
        period: periodTitle,
        retentionPolicy: `${RETENTION_MONTHS} Bulan (${RETENTION_DAYS} Hari Terakhir)`,
        cutoffDate: cutoffDate.toISOString(),
        topProducts: top10
      });
    }

    // CSV format with UTF-8 BOM
    const header = [
      'Peringkat',
      'Nama Produk',
      'Kategori',
      'Vendor / Cabang',
      'Qty Terjual',
      'Total Omzet (Rp)',
      'Rata-rata Harga (Rp)',
      'Jumlah Transaksi',
      'Kontribusi Penjualan (%)',
      'Periode Laporan',
      'Kebijakan Retensi'
    ];

    const rows = top10.map(item => [
      item.rank,
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.category}"`,
      `"${item.vendorName}"`,
      item.quantitySold,
      item.totalRevenue,
      item.averagePrice,
      item.orderCount,
      `${item.sharePercentage}%`,
      `"${periodTitle}"`,
      `"3 Bulan (${RETENTION_DAYS} Hari)"`
    ]);

    const csvContent = '\uFEFF' + [header.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="top10_produk_${vendorCode.toLowerCase()}_${period}_${formatDateYMD(now)}.csv"`);
    return res.status(200).send(csvContent);
  } catch (err: any) {
    console.error('[ManagerAnalytics] Export top-products error:', err);
    return res.status(500).json({ success: false, error: 'Export failed' });
  }
});
