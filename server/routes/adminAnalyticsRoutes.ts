import { Router, Request, Response } from 'express';
import { authMiddleware, requireAdmin } from '../auth';
import { getDB, fallbackStore } from '../db';
import { getAllVendors, VendorRecord } from '../vendorMiddleware';

export const adminAnalyticsRouter = Router();

// Guarded exclusively for ADMIN & SUPERADMIN
adminAnalyticsRouter.use(authMiddleware, requireAdmin);

const VENDOR_COLORS: Record<string, string> = {
  vnd_sipspot_central: '#ea580c', // Orange Amber
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
      code: v.code,
      color: VENDOR_COLORS[v.id] || DYNAMIC_PALETTE[idx % DYNAMIC_PALETTE.length]
    }));

    // 2. Fetch all orders
    const db = getDB();
    let orders: any[] = [];
    if (db) {
      try {
        orders = await db.collection('orders').find({}).sort({ createdAt: 1 }).toArray();
      } catch (e) {
        console.error('[AdminAnalytics] MongoDB find error:', e);
      }
    }
    if (orders.length === 0) {
      orders = fallbackStore.orders || [];
    }

    // Reference now: 2026-09-20T12:00:00Z
    const now = new Date('2026-09-20T12:00:00.000Z');
    const todayStr = formatDateYMD(now);

    // Normalize each order
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

    const cleanOrders: CleanOrder[] = orders.map((o: any) => {
      const d = new Date(o.createdAt || now);
      const amount = Number(o.totalAmount ?? o.total ?? 0);
      const vendorId = o.vendorId || 'vnd_sipspot_central';
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

    // 6. PERIOD 3: PER BULAN (Monthly Breakdown - 12 Months)
    const monthlyData = [];
    for (let m = 11; m >= 0; m--) {
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
        code: v.code,
        color: VENDOR_COLORS[v.id] || '#ea580c',
        orderCount: stats.count,
        revenue: stats.revenue,
        share: globalTotalRev > 0 ? Number(((stats.revenue / globalTotalRev) * 100).toFixed(1)) : 0
      };
    });

    return res.json({
      success: true,
      requestedVendorId,
      vendors: vendorMeta,
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
