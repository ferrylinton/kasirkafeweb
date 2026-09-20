import { Router, Request, Response } from 'express';
import { authMiddleware, requireManager } from '../auth';
import { queryActivityLogs, recordActivityLog } from '../activityLogger';
import { getDB, fallbackStore } from '../db';

export const activityLogRouter = Router();

// Protect all activity log routes with auth & Manager role
activityLogRouter.use(authMiddleware, requireManager);

/**
 * GET /api/activity-logs
 * Fetch activity logs with filters, search, pagination, and statistics
 */
activityLogRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { action, entity, userId, search, startDate, endDate, date, page, limit, vendorId: vendorQuery, allVendors } = req.query;

    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN';
    const isAllVendors = (allVendors === 'true' || vendorQuery === 'all' || vendorQuery === 'ALL' || (!vendorQuery && isAdmin)) && isAdmin;
    const targetVendor = isAllVendors ? 'ALL' : ((vendorQuery as string) || req.vendorId || 'vnd_sipspot_central');

    let computedStartDate = startDate as string;
    let computedEndDate = endDate as string;

    if (date && typeof date === 'string') {
      computedStartDate = `${date}T00:00:00.000Z`;
      computedEndDate = `${date}T23:59:59.999Z`;
    }

    const result = await queryActivityLogs({
      vendorId: targetVendor,
      action: action as string,
      entity: entity as string,
      userId: userId as string,
      search: search as string,
      startDate: computedStartDate,
      endDate: computedEndDate,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 15
    });

    return res.json({
      success: true,
      logs: result.logs,
      pagination: result.pagination,
      stats: result.stats
    });
  } catch (err: any) {
    console.error('[ActivityLogRouter] Error:', err);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * GET /api/activity-logs/stats
 * Quick summary stats for dashboard cards
 */
activityLogRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const result = await queryActivityLogs({ vendorId: req.vendorId, limit: 1 });
    return res.json({
      success: true,
      stats: result.stats
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * DELETE /api/activity-logs/clear
 * Manager utility to clean up older activity logs
 */
activityLogRouter.delete('/clear', async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.body;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(days));

    const db = getDB();
    let deletedCount = 0;

    if (db) {
      try {
        const resMongo = await db.collection('activity_logs').deleteMany({
          createdAt: { $lt: cutoff }
        });
        deletedCount = resMongo.deletedCount || 0;
      } catch (e) {}
    }

    const beforeLen = fallbackStore.activity_logs.length;
    fallbackStore.activity_logs = fallbackStore.activity_logs.filter(
      l => new Date(l.createdAt) >= cutoff
    );
    if (!db) {
      deletedCount = beforeLen - fallbackStore.activity_logs.length;
    }

    // Record this cleanup action itself in the activity log!
    await recordActivityLog({
      action: 'DELETE',
      entity: 'USER',
      summary: `Pembersihan log aktivitas lama (> ${days} hari): ${deletedCount} log dihapus`,
      req
    });

    return res.json({
      success: true,
      message: `Berhasil membersihkan ${deletedCount} log aktivitas lebih tua dari ${days} hari.`,
      deletedCount
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});
