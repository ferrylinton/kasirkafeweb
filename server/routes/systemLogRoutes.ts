import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { authMiddleware, requireAdmin } from '../auth';
import {
  listDailyLogFiles,
  queryDailyLogs,
  pruneOldLogFiles,
  writeDailyLog,
  getTodayLogDateString,
  getLogFilePath,
  logLogin,
  logOrder,
  logDataMutation,
  logDatabase,
  logRedis,
  logError,
  LogCategory,
  LogLevel
} from '../dailyRollingLogger';
import { isDbConnected } from '../db';
import { getRedisClient } from '../redis';

export const systemLogRouter = Router();

// Strictly guarded for ADMIN
systemLogRouter.use(authMiddleware, requireAdmin);

/**
 * GET /api/admin/system-logs/files
 * List all rolling log files available on disk
 */
systemLogRouter.get('/files', async (req: Request, res: Response) => {
  try {
    const files = await listDailyLogFiles();
    res.json({
      success: true,
      files,
      todayDate: getTodayLogDateString(),
      totalFiles: files.length
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to list log files',
      message: err.message
    });
  }
});

/**
 * GET /api/admin/system-logs/status
 * Get connection statuses (MongoDB, Redis) and logging metrics
 */
systemLogRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const files = await listDailyLogFiles();
    const today = getTodayLogDateString();
    const todayFile = files.find(f => f.date === today);

    const isMongoOnline = isDbConnected();
    const redisClient = getRedisClient();
    const isRedisOnline = !!redisClient;

    // Quick today query for stats
    const todayQuery = await queryDailyLogs({
      date: today,
      page: 1,
      limit: 1
    });

    res.json({
      success: true,
      todayDate: today,
      activeLogFile: todayFile ? todayFile.fileName : `app-${today}.log`,
      activeFileSize: todayFile ? todayFile.formattedSize : '0 B',
      totalFiles: files.length,
      database: {
        type: 'MongoDB',
        status: isMongoOnline ? 'CONNECTED' : 'FALLBACK_IN_MEMORY',
        connected: isMongoOnline,
        modeDescription: isMongoOnline
          ? 'Terhubung langsung ke cluster MongoDB Atlas'
          : 'Berjalan dalam Resilience In-Memory Layer (Fallback aktif)',
        uriConfigured: !!process.env.MONGODB_URI
      },
      redis: {
        type: 'Upstash Redis',
        status: isRedisOnline ? 'CONNECTED' : 'FALLBACK_IN_MEMORY',
        connected: isRedisOnline,
        modeDescription: isRedisOnline
          ? 'Terhubung langsung ke cluster Upstash Redis'
          : 'Berjalan dengan In-Memory Token Bucket Rate Limiter',
        urlConfigured: !!process.env.REDIS_URL
      },
      todayStats: todayQuery.stats
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system status',
      message: err.message
    });
  }
});

/**
 * GET /api/admin/system-logs
 * Fetch parsed log entries from a specific daily rolling file
 */
systemLogRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { date, file, category, level, search, vendorId, page, limit } = req.query;

    const result = await queryDailyLogs({
      date: date as string,
      fileName: file as string,
      category: category as string,
      level: level as string,
      search: search as string,
      vendorId: vendorId as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 50
    });

    res.json({
      success: true,
      entries: result.entries,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      stats: result.stats,
      fileMeta: result.fileMeta
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch daily logs',
      message: err.message
    });
  }
});

/**
 * GET /api/admin/system-logs/download
 * Download raw log file for a specific date or file
 */
systemLogRouter.get('/download', async (req: Request, res: Response) => {
  try {
    const { date, file } = req.query;
    const targetDate = (date as string) || getTodayLogDateString();
    const targetFileName = (file as string) || `app-${targetDate}.log`;
    const logsDir = path.join(process.cwd(), 'logs');
    const filePath = path.join(logsDir, path.basename(targetFileName));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
        message: `Berkas log ${targetFileName} tidak ditemukan di server.`
      });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${targetFileName}"`);
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Download error',
      message: err.message
    });
  }
});

/**
 * POST /api/admin/system-logs/test
 * Trigger on-demand test log entry (for admin verification)
 */
systemLogRouter.post('/test', async (req: Request, res: Response) => {
  try {
    const { category, level, message, details } = req.body;
    const validCategory: LogCategory = category || 'SYSTEM';
    const validLevel: LogLevel = level || 'INFO';
    const testMsg = message || `Uji coba pencatatan log manual kategori [${validCategory}] oleh ${req.user?.name || 'Admin'}`;

    let createdEntry;

    switch (validCategory) {
      case 'AUTH':
        createdEntry = await logLogin({
          status: 'SUCCESS',
          email: req.user?.email,
          name: req.user?.name,
          role: req.user?.role,
          userId: req.user?.userId,
          loginMethod: 'PASSWORD',
          req,
          details: { isManualTest: true, ...details }
        });
        break;

      case 'ORDER':
        createdEntry = await logOrder({
          action: 'CREATED',
          orderId: `test_ord_${Date.now()}`,
          orderNumber: 'TEST-099',
          vendorId: req.user?.vendorId || 'vnd_sipspot_central',
          totalAmount: 48000,
          paymentMethod: 'QRIS',
          itemsCount: 2,
          cashierName: req.user?.name || 'Admin Testing',
          customerName: 'Pelanggan Simulasi',
          req,
          details: { isManualTest: true, ...details }
        });
        break;

      case 'DATA_MUTATION':
        createdEntry = await logDataMutation({
          action: 'UPDATE',
          entity: 'PRODUCT',
          entityId: 'prod_test_1',
          entityName: 'Kopi Susu Gula Aren (Test)',
          summary: 'Simulasi pembaruan stok dan harga produk',
          performer: {
            id: req.user?.userId,
            name: req.user?.name,
            role: req.user?.role
          },
          req,
          details: { isManualTest: true, oldPrice: 20000, newPrice: 22000, ...details }
        });
        break;

      case 'DATABASE':
        createdEntry = await logDatabase({
          event: isDbConnected() ? 'CONNECTED' : 'FALLBACK_MODE',
          message: `Verifikasi status koneksi basis data: ${isDbConnected() ? 'MongoDB Atlas Aktif' : 'In-Memory Layer Aktif'}`,
          dbName: process.env.MONGODB_DB_NAME || 'beverage_app_db',
          details: { isManualTest: true, isConnected: isDbConnected(), ...details }
        });
        break;

      case 'REDIS':
        createdEntry = await logRedis({
          event: getRedisClient() ? 'CONNECTED' : 'FALLBACK_MODE',
          message: `Verifikasi status token bucket rate limiter: ${getRedisClient() ? 'Upstash Redis Terhubung' : 'Local In-Memory Bucket Aktif'}`,
          details: { isManualTest: true, isRedisReady: !!getRedisClient(), ...details }
        });
        break;

      case 'ERROR':
        createdEntry = await logError({
          message: testMsg,
          context: 'AdminTestSimulation',
          error: new Error('Simulasi galat sistem yang dipicu secara sengaja oleh administrator'),
          req,
          details: { isManualTest: true, simulatedBy: req.user?.email, ...details }
        });
        break;

      default:
        createdEntry = await writeDailyLog({
          level: validLevel,
          category: validCategory,
          message: testMsg,
          req,
          details: { isManualTest: true, ...details }
        });
        break;
    }

    res.json({
      success: true,
      message: 'Log berhasil ditulis ke berkas harian (Daily Rolling File)',
      entry: createdEntry
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Test log trigger failed',
      message: err.message
    });
  }
});

/**
 * POST /api/admin/system-logs/prune
 * Trigger retention cleanup of old log files
 */
systemLogRouter.post('/prune', async (req: Request, res: Response) => {
  try {
    const days = req.body.days ? parseInt(req.body.days, 10) : 30;
    const result = await pruneOldLogFiles(days);
    res.json({
      success: true,
      message: `Pembersihan berhasil. ${result.deletedFiles.length} berkas log lama dihapus (${(result.freedBytes / 1024).toFixed(1)} KB dibebaskan).`,
      ...result
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to prune logs',
      message: err.message
    });
  }
});
