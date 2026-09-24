import { Router, Request, Response } from 'express';
import { authMiddleware, requireManager } from '../auth';
import { getDB } from '../db';
import { getAllVendors, VendorRecord } from '../vendorMiddleware';
import {
  getCutoffDate,
  getRetentionStatus,
  runRetentionCleanup,
  RETENTION_DAYS,
  RETENTION_MONTHS
} from '../retentionScheduler';

export const adminAnalyticsRouter = Router();

// Guarded for ADMIN & MANAGER
adminAnalyticsRouter.use(authMiddleware, requireManager);

const VENDOR_COLORS: Record<string, string> = {
  vnd_kasirkafe_central: '#ea580c', // Orange Amber
  vnd_kopi_kulo_kemang: '#8b5cf6', // Violet Purple
  vnd_tehpoci_nusantara: '#10b981', // Emerald Green
};

const DYNAMIC_PALETTE = ['#0284c7', '#ec4899', '#f59e0b', '#06b6d4', '#84cc16', '#6366f1'];

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
 * GET /api/admin/analytics/transactions
 * Returns comprehensive multi-vendor analytics across Day, Week, Month, and Year
 */
adminAnalyticsRouter.get('/transactions', async (req: Request, res: Response) => {
  try {
    const requestedVendorId = (req.query.vendorId as string) || 'all';

    // 1. Fetch vendors
    const allVendors = await getAllVendors();
    const activeVendors = allVendors.filter(v => v.id !== 'vnd_admin');

    const vendorMeta = activeVendors.map((v, idx) => ({
      id: v.id,
      name: v.name,
      color: VENDOR_COLORS[v.id] || DYNAMIC_PALETTE[idx % DYNAMIC_PALETTE.length]
    }));

    // Reference now: 2026-09-20 (or current runtime date)
    const now = new Date().getFullYear() >= 2026 ? new Date() : new Date('2026-09-20T12:00:00.000Z');
    const todayStr = formatDateYMD(now);
    const cutoffDate = getCutoffDate(); // Enforce 3-month (90 days) retention policy

    // 2. Fetch orders within 3-month retention window
    const db = getDB();
    let orders: any[] = [];
    if (db) {
      try {
        orders = await db.collection('orders').find({
          createdAt: { $gte: cutoffDate }
        }).sort({ createdAt: 1 }).toArray();
      } catch (e) {
        console.error('[AdminAnalytics] MongoDB find error:', e);
      }
    }

    // Normalize each order within 3-month window
    interface CleanOrder {
      id: string;
      vendorId: string;
      amount: number;
      paymentMethod: string;
      date: Date;
      ymd: string;
      year: number;
      monthKey: string;
    }

    const cleanOrders: CleanOrder[] = orders
      .filter((o: any) => {
        const d = new Date(o.createdAt || now);
        return d >= cutoffDate;
      })
      .map((o: any) => {
        const d = new Date(o.createdAt || now);
        const amount = Number(o.totalAmount ?? o.total ?? 0);
        const vendorId = o.vendorId || 'vnd_kasirkafe_central';
        const ymd = formatDateYMD(d);
        const year = d.getFullYear();
        const monthKey = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        return {
          id: (o._id ? o._id.toString() : o.id) || '',
          vendorId,
          amount,
          paymentMethod: o.paymentMethod || 'QRIS',
          date: d,
          ymd,
          year,
          monthKey
        };
      });

    // Orders filtered for targeted vendor or all
    const filteredOrders = requestedVendorId === 'all'
      ? cleanOrders
      : cleanOrders.filter(o => o.vendorId === requestedVendorId);

    // 3. Compute High-Level Summary KPIs
    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.amount, 0);
    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Today stats
    const todayOrders = filteredOrders.filter(o => o.ymd === todayStr);
    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.amount, 0);

    // This week stats
    const { start: weekStart, end: weekEnd } = getWeekNumber(now);
    const thisWeekOrders = filteredOrders.filter(o => o.date >= weekStart && o.date <= weekEnd);
    const thisWeekRevenue = thisWeekOrders.reduce((sum, o) => sum + o.amount, 0);

    // This month stats
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthOrders = filteredOrders.filter(o => o.monthKey === currentMonthKey);
    const thisMonthRevenue = thisMonthOrders.reduce((sum, o) => sum + o.amount, 0);

    // This year stats
    const currentYear = now.getFullYear();
    const thisYearOrders = filteredOrders.filter(o => o.year === currentYear);
    const thisYearRevenue = thisYearOrders.reduce((sum, o) => sum + o.amount, 0);

    // Top Vendor
    const vendorRevenues: Record<string, { count: number; revenue: number }> = {};
    activeVendors.forEach(v => {
      vendorRevenues[v.id] = { count: 0, revenue: 0 };
    });
    cleanOrders.forEach(o => {
      if (!vendorRevenues[o.vendorId]) {
        vendorRevenues[o.vendorId] = { count: 0, revenue: 0 };
      }
      vendorRevenues[o.vendorId].count++;
      vendorRevenues[o.vendorId].revenue += o.amount;
    });

    let topVendorObj = { id: '', name: 'Semua Vendor', revenue: 0, percentage: 100 };
    const globalTotalRev = Object.values(vendorRevenues).reduce((sum, v) => sum + v.revenue, 0);
    let maxRev = -1;

    for (const v of activeVendors) {
      const stats = vendorRevenues[v.id];
      if (stats && stats.revenue > maxRev) {
        maxRev = stats.revenue;
        topVendorObj = {
          id: v.id,
          name: v.name,
          revenue: stats.revenue,
          percentage: globalTotalRev > 0 ? Math.round((stats.revenue / globalTotalRev) * 100) : 0
        };
      }
    }

    // 4. PERIOD 1: PER HARI (Daily Breakdown - Last 30 Days)
    const dailyData = [];
    for (let i = 29; i >= 0; i--) {
      const dayDate = new Date(now.getTime() - i * 86400000);
      const ymd = formatDateYMD(dayDate);
      const dayName = INDONESIAN_DAYS[dayDate.getDay()];
      const dayLabel = `${dayDate.getDate()} ${INDONESIAN_MONTHS[dayDate.getMonth()]}`;

      // Orders for this day
      const dayOrders = cleanOrders.filter(o => o.ymd === ymd);
      const targetDayOrders = requestedVendorId === 'all'
        ? dayOrders
        : dayOrders.filter(o => o.vendorId === requestedVendorId);

      const dayRevenue = targetDayOrders.reduce((sum, o) => sum + o.amount, 0);

      const byVendor: Record<string, { orders: number; revenue: number }> = {};
      const flatVendorFields: Record<string, number> = {};

      activeVendors.forEach(v => {
        const vOrders = dayOrders.filter(o => o.vendorId === v.id);
        const vRev = vOrders.reduce((sum, o) => sum + o.amount, 0);
        byVendor[v.id] = { orders: vOrders.length, revenue: vRev };
        flatVendorFields[`${v.id}_orders`] = vOrders.length;
        flatVendorFields[`${v.id}_revenue`] = vRev;
      });

      dailyData.push({
        date: ymd,
        label: dayLabel,
        dayName,
        totalOrders: targetDayOrders.length,
        totalRevenue: dayRevenue,
        averageTicket: targetDayOrders.length > 0 ? Math.round(dayRevenue / targetDayOrders.length) : 0,
        byVendor,
        ...flatVendorFields
      });
    }

    // 5. PERIOD 2: PER MINGGU (Weekly Breakdown - Last 12 Weeks)
    const weeklyData = [];
    for (let w = 11; w >= 0; w--) {
      const refDate = new Date(now.getTime() - w * 7 * 86400000);
      const { year: wYear, week: wNumber, start: wStart, end: wEnd } = getWeekNumber(refDate);

      const weekKey = `${wYear}-W${String(wNumber).padStart(2, '0')}`;
      const startLabel = `${wStart.getDate()} ${INDONESIAN_MONTHS[wStart.getMonth()]}`;
      const endLabel = `${wEnd.getDate()} ${INDONESIAN_MONTHS[wEnd.getMonth()]}`;
      const weekLabel = `Mgg ${wNumber} (${startLabel} - ${endLabel})`;

      const weekOrders = cleanOrders.filter(o => o.date >= wStart && o.date <= wEnd);
      const targetWeekOrders = requestedVendorId === 'all'
        ? weekOrders
        : weekOrders.filter(o => o.vendorId === requestedVendorId);

      const weekRevenue = targetWeekOrders.reduce((sum, o) => sum + o.amount, 0);

      const byVendor: Record<string, { orders: number; revenue: number }> = {};
      const flatVendorFields: Record<string, number> = {};

      activeVendors.forEach(v => {
        const vOrders = weekOrders.filter(o => o.vendorId === v.id);
        const vRev = vOrders.reduce((sum, o) => sum + o.amount, 0);
        byVendor[v.id] = { orders: vOrders.length, revenue: vRev };
        flatVendorFields[`${v.id}_orders`] = vOrders.length;
        flatVendorFields[`${v.id}_revenue`] = vRev;
      });

      weeklyData.push({
        weekKey,
        label: weekLabel,
        shortLabel: `Mgg ${wNumber}`,
        startDate: formatDateYMD(wStart),
        endDate: formatDateYMD(wEnd),
        totalOrders: targetWeekOrders.length,
        totalRevenue: weekRevenue,
        averageTicket: targetWeekOrders.length > 0 ? Math.round(weekRevenue / targetWeekOrders.length) : 0,
        byVendor,
        ...flatVendorFields
      });
    }

    // 6. PERIOD 3: PER BULAN (Monthly Breakdown - 3 Bulan Terakhir sesuai Kebijakan Retensi 90 Hari)
    const monthlyData = [];
    for (let m = 2; m >= 0; m--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const mYear = monthDate.getFullYear();
      const mMonth = monthDate.getMonth();
      const monthKey = `${mYear}-${String(mMonth + 1).padStart(2, '0')}`;
      const monthLabel = `${INDONESIAN_MONTHS[mMonth]} ${mYear}`;

      const monthOrders = cleanOrders.filter(o => o.monthKey === monthKey);
      const targetMonthOrders = requestedVendorId === 'all'
        ? monthOrders
        : monthOrders.filter(o => o.vendorId === requestedVendorId);

      const monthRevenue = targetMonthOrders.reduce((sum, o) => sum + o.amount, 0);

      const byVendor: Record<string, { orders: number; revenue: number }> = {};
      const flatVendorFields: Record<string, number> = {};

      activeVendors.forEach(v => {
        const vOrders = monthOrders.filter(o => o.vendorId === v.id);
        const vRev = vOrders.reduce((sum, o) => sum + o.amount, 0);
        byVendor[v.id] = { orders: vOrders.length, revenue: vRev };
        flatVendorFields[`${v.id}_orders`] = vOrders.length;
        flatVendorFields[`${v.id}_revenue`] = vRev;
      });

      monthlyData.push({
        monthKey,
        label: monthLabel,
        year: mYear,
        month: mMonth + 1,
        totalOrders: targetMonthOrders.length,
        totalRevenue: monthRevenue,
        averageTicket: targetMonthOrders.length > 0 ? Math.round(monthRevenue / targetMonthOrders.length) : 0,
        byVendor,
        ...flatVendorFields
      });
    }

    // 7. PERIOD 4: PER TAHUN (Yearly Breakdown - 2024, 2025, 2026)
    const yearlyData = [];
    const years = [2024, 2025, 2026];

    for (const y of years) {
      const yearOrders = cleanOrders.filter(o => o.year === y);
      const targetYearOrders = requestedVendorId === 'all'
        ? yearOrders
        : yearOrders.filter(o => o.vendorId === requestedVendorId);

      const yearRevenue = targetYearOrders.reduce((sum, o) => sum + o.amount, 0);

      const byVendor: Record<string, { orders: number; revenue: number }> = {};
      const flatVendorFields: Record<string, number> = {};

      activeVendors.forEach(v => {
        const vOrders = yearOrders.filter(o => o.vendorId === v.id);
        const vRev = vOrders.reduce((sum, o) => sum + o.amount, 0);
        byVendor[v.id] = { orders: vOrders.length, revenue: vRev };
        flatVendorFields[`${v.id}_orders`] = vOrders.length;
        flatVendorFields[`${v.id}_revenue`] = vRev;
      });

      yearlyData.push({
        yearKey: String(y),
        label: `Tahun ${y}`,
        shortLabel: String(y),
        year: y,
        totalOrders: targetYearOrders.length,
        totalRevenue: yearRevenue,
        averageTicket: targetYearOrders.length > 0 ? Math.round(yearRevenue / targetYearOrders.length) : 0,
        byVendor,
        ...flatVendorFields
      });
    }

    // 8. Payment Method Distribution for Filtered Orders
    const paymentMap: Record<string, { count: number; total: number }> = {
      QRIS: { count: 0, total: 0 },
      CASH: { count: 0, total: 0 },
      EDC: { count: 0, total: 0 },
      TRANSFER: { count: 0, total: 0 }
    };

    filteredOrders.forEach(o => {
      const method = (o.paymentMethod || 'QRIS').toUpperCase();
      if (!paymentMap[method]) {
        paymentMap[method] = { count: 0, total: 0 };
      }
      paymentMap[method].count++;
      paymentMap[method].total += o.amount;
    });

    const paymentMethods = Object.entries(paymentMap).map(([method, data]) => ({
      method,
      count: data.count,
      total: data.total,
      percentage: totalRevenue > 0 ? Math.round((data.total / totalRevenue) * 100) : 0
    }));

    // 9. Vendor Market Shares
    const vendorShares = activeVendors.map(v => {
      const stats = vendorRevenues[v.id] || { count: 0, revenue: 0 };
      return {
        vendorId: v.id,
        name: v.name,
        color: VENDOR_COLORS[v.id] || '#ea580c',
        orderCount: stats.count,
        revenue: stats.revenue,
        share: globalTotalRev > 0 ? Number(((stats.revenue / globalTotalRev) * 100).toFixed(1)) : 0
      };
    });

    const retentionStatus = await getRetentionStatus();

    return res.json({
      success: true,
      requestedVendorId,
      vendors: vendorMeta,
      retention: retentionStatus,
      retentionPolicy: {
        months: RETENTION_MONTHS,
        days: RETENTION_DAYS,
        cutoffDate: cutoffDate.toISOString(),
        description: 'Data transaksi disimpan selama 3 bulan terakhir (90 hari). Data transaksi yang lebih lama otomatis dihapus oleh skeduler berkala.'
      },
      summary: {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        topVendor: topVendorObj,
        today: { orders: todayOrders.length, revenue: todayRevenue },
        thisWeek: { orders: thisWeekOrders.length, revenue: thisWeekRevenue },
        thisMonth: { orders: thisMonthOrders.length, revenue: thisMonthRevenue },
        thisYear: { orders: thisYearOrders.length, revenue: thisYearRevenue }
      },
      daily: dailyData,
      weekly: weeklyData,
      monthly: monthlyData,
      yearly: yearlyData,
      paymentMethods,
      vendorShares
    });
  } catch (err: any) {
    console.error('[AdminAnalytics] GET /transactions error:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

/**
 * GET /api/admin/analytics/transactions/export
 * Exports transactions or summarized analytics for the 3-month retention window as CSV or JSON
 */
adminAnalyticsRouter.get('/transactions/export', async (req: Request, res: Response) => {
  try {
    const period = ((req.query.period as string) || 'all').toLowerCase(); // 'day' | 'week' | 'month' | 'all'
    const requestedVendorId = (req.query.vendorId as string) || 'all';
    const format = ((req.query.format as string) || 'csv').toLowerCase(); // 'csv' | 'json'
    const exportType = ((req.query.type as string) || 'transactions').toLowerCase(); // 'transactions' | 'summary'

    const now = new Date().getFullYear() >= 2026 ? new Date() : new Date('2026-09-20T12:00:00.000Z');
    const cutoffDate = getCutoffDate(); // Enforce 3 months retention (90 days)

    const allVendors = await getAllVendors();
    const vendorMap = new Map<string, VendorRecord>();
    allVendors.forEach(v => vendorMap.set(v.id, v));

    // Determine date boundaries based on period within the 3-month retention window
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
      periodTitle = `Seluruh Transaksi Retensi 3 Bulan Terakhir (${formatDateYMD(startDate)} sd ${formatDateYMD(now)})`;
    }

    if (startDate < cutoffDate) {
      startDate = new Date(cutoffDate.getTime());
    }

    // Fetch raw orders
    const db = getDB();
    let orders: any[] = [];
    if (db) {
      try {
        orders = await db.collection('orders').find({
          createdAt: { $gte: startDate, $lte: endDate }
        }).sort({ createdAt: -1 }).toArray();
      } catch (e) {
        console.error('[AdminAnalytics] Export Mongo query error:', e);
      }
    }

    // Vendor filter
    if (requestedVendorId !== 'all') {
      orders = orders.filter(o => o.vendorId === requestedVendorId);
    }

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount ?? o.total ?? 0), 0);
    const totalOrders = orders.length;
    const averageTicket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // JSON Format Export
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="kasirkafe_transaksi_3bulan_${period}_${requestedVendorId}.json"`);
      return res.json({
        success: true,
        exportDate: new Date().toISOString(),
        retentionPolicy: `${RETENTION_MONTHS} Bulan (${RETENTION_DAYS} Hari)`,
        cutoffDate: cutoffDate.toISOString(),
        schedulerNotice: 'Data lebih tua dari 3 bulan otomatis dibersihkan oleh skeduler retensi berkala.',
        period: periodTitle,
        vendorFilter: requestedVendorId,
        summary: {
          totalOrders,
          totalRevenue,
          averageOrderValue: averageTicket
        },
        transactions: orders.map(o => {
          const vObj = vendorMap.get(o.vendorId);
          return {
            id: (o._id ? o._id.toString() : o.id) || '',
            orderNumber: o.orderNumber || o.id,
            queueNumber: o.queueNumber || '-',
            createdAt: o.createdAt,
            vendorId: o.vendorId,
            vendorName: vObj?.name || o.vendorId,
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
      const vObj = vendorMap.get(o.vendorId);
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
        `"#${o.queueNumber || '001'}"`,
        `"${dateStr}"`,
        `"${(vObj?.name || o.vendorId || 'KasirKafe Central').replace(/"/g, '""')}"`,
        `"${(o.cashier?.name || 'Kasir KasirKafe').replace(/"/g, '""')}"`,
        `"${o.paymentMethod || 'QRIS'}"`,
        `"${itemDesc.replace(/"/g, '""')}"`,
        totalQty,
        sub,
        disc,
        tax,
        amount,
        `"COMPLETED"`,
        `"Tersimpan 3 Bulan (${RETENTION_DAYS} Hari)"`
      ];
    });

    const csvContent = '\uFEFF' + [csvHeader.join(','), ...csvRows.map(r => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kasirkafe_transaksi_3bulan_${period}_${requestedVendorId}_${formatDateYMD(now)}.csv"`);
    return res.status(200).send(csvContent);
  } catch (err: any) {
    console.error('[AdminAnalytics] Export transactions error:', err);
    return res.status(500).json({ success: false, error: 'Export failed' });
  }
});

/**
 * GET /api/admin/analytics/top-products
 * Returns Top 10 Best-Selling products across Day, Week, and Month
 * Adheres to 3-month data retention policy and multi-vendor filtering
 */
adminAnalyticsRouter.get('/top-products', async (req: Request, res: Response) => {
  try {
    const period = ((req.query.period as string) || 'day').toLowerCase(); // 'day' | 'week' | 'month'
    const requestedVendorId = (req.query.vendorId as string) || 'all';
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '10', 10), 1), 50);

    const allVendors = await getAllVendors();
    const activeVendors = allVendors.filter(v => v.id !== 'vnd_admin');
    const vendorMap = new Map<string, VendorRecord>();
    activeVendors.forEach(v => vendorMap.set(v.id, v));

    const vendorMeta = activeVendors.map((v, idx) => ({
      id: v.id,
      name: v.name,
      color: VENDOR_COLORS[v.id] || DYNAMIC_PALETTE[idx % DYNAMIC_PALETTE.length]
    }));

    // Reference now: 2026-09-20 (local environment timestamp)
    const now = new Date().getFullYear() >= 2026 ? new Date() : new Date('2026-09-20T14:30:00.000Z');
    const cutoffDate = getCutoffDate(); // 90 days retention

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
      // 7 days ago until today
      startDate = new Date(now.getTime() - 7 * 86400000);
      startDate.setHours(0, 0, 0, 0);
      periodLabel = `Per Minggu (7 Hari Terakhir: ${startDate.getDate()} ${INDONESIAN_MONTHS[startDate.getMonth()]} - ${now.getDate()} ${INDONESIAN_MONTHS[now.getMonth()]} ${now.getFullYear()})`;
    } else if (period === 'year') {
      // Year-to-date bounded by 3-month retention window
      startDate = new Date(now.getFullYear(), 0, 1);
      startDate.setHours(0, 0, 0, 0);
      periodLabel = `Per Tahun (${now.getFullYear()} - Dibatasi Retensi 3 Bulan Terakhir)`;
    } else {
      // 'month' - past 30 days
      startDate = new Date(now.getTime() - 30 * 86400000);
      startDate.setHours(0, 0, 0, 0);
      periodLabel = `Per Bulan (30 Hari Terakhir: ${startDate.getDate()} ${INDONESIAN_MONTHS[startDate.getMonth()]} - ${now.getDate()} ${INDONESIAN_MONTHS[now.getMonth()]} ${now.getFullYear()})`;
    }

    if (startDate < cutoffDate) {
      startDate = new Date(cutoffDate.getTime());
    }

    // Fetch orders from Mongo or fallback
    const db = getDB();
    let orders: any[] = [];
    if (db) {
      try {
        orders = await db.collection('orders').find({
          createdAt: { $gte: startDate, $lte: endDate }
        }).toArray();
      } catch (e) {
        console.error('[AdminAnalytics] Mongo query error:', e);
      }
    }

    // Filter by vendor if requested
    if (requestedVendorId !== 'all') {
      orders = orders.filter(o => o.vendorId === requestedVendorId);
    }

    // Aggregate products
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
    let totalItemsSoldAll = 0;
    let totalRevenueAll = 0;
    const categoryTotals: Record<string, { quantity: number; revenue: number }> = {};

    orders.forEach((o: any) => {
      const vId = o.vendorId || 'vnd_kasirkafe_central';
      const vObj = vendorMap.get(vId);
      const vName = vObj?.name || 'KasirKafe Central';

      const items = Array.isArray(o.items) ? o.items : [];
      const seenInOrder = new Set<string>();

      items.forEach((item: any) => {
        const pId = item.productId || item.id || `prod_${item.name}`;
        const name = item.name || 'Item Minuman';
        const category = item.category || 'Minuman';
        const qty = Number(item.quantity || 1);
        const price = Number(item.price || 0);
        const itemTotal = Number(item.itemTotal || (qty * price));

        const aggKey = `${pId}_${name}_${vId}`;
        let agg = productMap.get(aggKey);
        if (!agg) {
          agg = {
            productId: pId,
            name,
            category,
            vendorId: vId,
            vendorName: vName,
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
      requestedVendorId,
      vendors: vendorMeta,
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
      retention: retentionStatus
    });
  } catch (err: any) {
    console.error('[AdminAnalytics] GET /top-products error:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

/**
 * GET /api/admin/analytics/top-products/export
 * Exports Top Products data directly as CSV or JSON format
 */
adminAnalyticsRouter.get('/top-products/export', async (req: Request, res: Response) => {
  try {
    const period = ((req.query.period as string) || 'day').toLowerCase();
    const requestedVendorId = (req.query.vendorId as string) || 'all';
    const format = ((req.query.format as string) || 'csv').toLowerCase();

    const allVendors = await getAllVendors();
    const vendorMap = new Map<string, VendorRecord>();
    allVendors.forEach(v => vendorMap.set(v.id, v));

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
          createdAt: { $gte: startDate, $lte: endDate }
        }).toArray();
      } catch (e) {
        console.error('[AdminAnalytics] Export Mongo query error:', e);
      }
    }

    if (requestedVendorId !== 'all') {
      orders = orders.filter(o => o.vendorId === requestedVendorId);
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
      const vId = o.vendorId || 'vnd_kasirkafe_central';
      const vObj = vendorMap.get(vId);
      const vName = vObj?.name || 'KasirKafe Central';
      const items = Array.isArray(o.items) ? o.items : [];
      const seen = new Set<string>();

      items.forEach((item: any) => {
        const pId = item.productId || item.id || `prod_${item.name}`;
        const name = item.name || 'Item Minuman';
        const category = item.category || 'Minuman';
        const qty = Number(item.quantity || 1);
        const price = Number(item.price || 0);
        const itemTotal = Number(item.itemTotal || (qty * price));
        const key = `${pId}_${name}_${vId}`;

        let agg = productMap.get(key);
        if (!agg) {
          agg = {
            productId: pId,
            name,
            category,
            vendorId: vId,
            vendorName: vName,
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
      res.setHeader('Content-Disposition', `attachment; filename="top10_products_${period}_${requestedVendorId}.json"`);
      return res.json({
        exportDate: new Date().toISOString(),
        period: periodTitle,
        vendor: requestedVendorId,
        retentionPolicy: `${RETENTION_MONTHS} Bulan (${RETENTION_DAYS} Hari)`,
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
    res.setHeader('Content-Disposition', `attachment; filename="top10_produk_${period}_${requestedVendorId}_${formatDateYMD(now)}.csv"`);
    return res.status(200).send(csvContent);
  } catch (err: any) {
    console.error('[AdminAnalytics] Export top-products error:', err);
    return res.status(500).json({ success: false, error: 'Export failed' });
  }
});

/**
 * GET /api/admin/analytics/retention-status
 * Returns detailed health and status of the 3-month data retention policy
 */
adminAnalyticsRouter.get('/retention-status', async (req: Request, res: Response) => {
  try {
    const status = await getRetentionStatus();
    return res.json({ success: true, ...status });
  } catch (err: any) {
    console.error('[AdminAnalytics] GET /retention-status error:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

/**
 * POST /api/admin/analytics/retention-run
 * Manually executes data retention cleanup of orders older than 90 days
 */
adminAnalyticsRouter.post('/retention-run', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const operator = user ? `${user.name} (${user.role})` : 'ADMIN_MANUAL';

    const result = await runRetentionCleanup(operator);
    const currentStatus = await getRetentionStatus();

    return res.json({
      success: true,
      message: `Pembersihan retensi data 3 bulan berhasil dijalankan. ${result.deletedCount} pesanan usang dihapus.`,
      result,
      status: currentStatus
    });
  } catch (err: any) {
    console.error('[AdminAnalytics] POST /retention-run error:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

