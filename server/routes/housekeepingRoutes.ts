import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, requireAdmin } from '../auth';
import {
  getHousekeepingSettings,
  saveHousekeepingSettings,
  getHousekeepingStats,
  runHousekeepingCleanup,
  getHousekeepingHistory,
  getHousekeepingNoticeInfo
} from '../retentionScheduler';

export const housekeepingRouter = Router();

/**
 * GET /api/admin/housekeeping/notification
 * Accessible by any authenticated user to render the end-of-month notification banner
 */
housekeepingRouter.get('/notification', authMiddleware, async (req: Request, res: Response) => {
  try {
    const settings = await getHousekeepingSettings();
    const notice = getHousekeepingNoticeInfo(new Date(), settings);
    return res.json({
      success: true,
      notice
    });
  } catch (err: any) {
    console.error('[Housekeeping] GET /notification error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

// All remaining housekeeping management endpoints require ADMIN role
housekeepingRouter.use(authMiddleware, requireAdmin);

/**
 * GET /api/admin/housekeeping/status
 * Complete dashboard state: settings, current stats of 4 collections, notice status, and recent history
 */
housekeepingRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const settings = await getHousekeepingSettings();
    const stats = await getHousekeepingStats();
    const notice = getHousekeepingNoticeInfo(new Date(), settings);
    const history = await getHousekeepingHistory();

    return res.json({
      success: true,
      settings,
      stats,
      notice,
      history
    });
  } catch (err: any) {
    console.error('[Housekeeping] GET /status error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

/**
 * GET /api/admin/housekeeping/stats
 * Real-time calculation of counts across all 4 target data collections
 */
housekeepingRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getHousekeepingStats();
    return res.json({
      success: true,
      stats
    });
  } catch (err: any) {
    console.error('[Housekeeping] GET /stats error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

/**
 * POST /api/admin/housekeeping/run
 * Manually trigger full housekeeping cleanup for data older than 3 months
 */
housekeepingRouter.post('/run', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const operator = user ? `${user.name} (${user.email} - ${user.role})` : 'ADMIN_MANUAL';

    const executionRecord = await runHousekeepingCleanup(operator, false);
    const updatedStats = await getHousekeepingStats();
    const updatedHistory = await getHousekeepingHistory();

    return res.json({
      success: true,
      message: `Proses housekeeping data berhasil dieksekusi. Total ${executionRecord.totalDeleted} record usang telah dibersihkan.`,
      execution: executionRecord,
      stats: updatedStats,
      history: updatedHistory
    });
  } catch (err: any) {
    console.error('[Housekeeping] POST /run error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

/**
 * POST /api/admin/housekeeping/dry-run
 * Simulates housekeeping without actually deleting records
 */
housekeepingRouter.post('/dry-run', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const operator = user ? `SIMULATION_DRY_RUN (${user.name})` : 'SIMULATION_DRY_RUN';

    const simulationRecord = await runHousekeepingCleanup(operator, true);

    return res.json({
      success: true,
      message: 'Simulasi dry-run housekeeping selesai.',
      simulation: simulationRecord
    });
  } catch (err: any) {
    console.error('[Housekeeping] POST /dry-run error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

const updateSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  retentionMonths: z.number().int().min(1).max(24).optional(),
  noticeDaysBefore: z.number().int().min(1).max(10).optional(),
  notificationTitle: z.string().min(3).max(100).optional(),
  notificationMessage: z.string().min(5).max(300).optional(),
  runAtBeginningOfMonth: z.boolean().optional(),
  simulationActive: z.boolean().optional()
});

/**
 * PUT /api/admin/housekeeping/settings
 * Updates housekeeping configuration
 */
housekeepingRouter.put('/settings', async (req: Request, res: Response) => {
  try {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Payload',
        details: parsed.error.issues
      });
    }

    const updated = await saveHousekeepingSettings(parsed.data);
    const notice = getHousekeepingNoticeInfo(new Date(), updated);
    const stats = await getHousekeepingStats();

    return res.json({
      success: true,
      message: 'Pengaturan housekeeping data berhasil diperbarui.',
      settings: updated,
      notice,
      stats
    });
  } catch (err: any) {
    console.error('[Housekeeping] PUT /settings error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

/**
 * GET /api/admin/housekeeping/history
 * Returns historical audit records of past executions
 */
housekeepingRouter.get('/history', async (req: Request, res: Response) => {
  try {
    const history = await getHousekeepingHistory();
    return res.json({
      success: true,
      history
    });
  } catch (err: any) {
    console.error('[Housekeeping] GET /history error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});
