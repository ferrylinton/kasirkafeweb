import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import { connectDB } from './server/db';
import { seedDatabase } from './server/seeder';
import { tokenBucketRateLimiter } from './server/redis';
import { authRouter } from './server/routes/authRoutes';
import { userRouter } from './server/routes/userRoutes';
import { productRouter } from './server/routes/productRoutes';
import { discountRouter } from './server/routes/discountRoutes';
import { orderRouter } from './server/routes/orderRoutes';
import { templateRouter } from './server/routes/templateRoutes';
import { activityLogRouter } from './server/routes/activityLogRoutes';
import { vendorRouter } from './server/routes/vendorRoutes';
import { adminVendorRouter } from './server/routes/adminVendorRoutes';
import { adminAnalyticsRouter } from './server/routes/adminAnalyticsRoutes';
import { managerAnalyticsRouter } from './server/routes/managerAnalyticsRoutes';
import { systemLogRouter } from './server/routes/systemLogRoutes';
import { vendorMiddleware } from './server/vendorMiddleware';
import { i18nMiddleware } from './server/i18n';
import { initRetentionScheduler } from './server/retentionScheduler';
import { initDailyRollingLogger, logError, writeDailyLog } from './server/dailyRollingLogger';
import dns from "node:dns/promises";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  // Basic Middlewares
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(i18nMiddleware);

  // Token Bucket Rate Limiting Middleware (connected to Upstash Redis)
  app.use('/api', tokenBucketRateLimiter({ capacity: 80, refillRate: 5 }));

  // Multi-Vendor Resolution & Isolation Middleware
  app.use('/api', vendorMiddleware);

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'SipSpot POS API',
      timestamp: new Date().toISOString()
    });
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/vendors', vendorRouter);
  app.use('/api/users', userRouter);
  app.use('/api/products', productRouter);
  app.use('/api/discounts', discountRouter);
  app.use('/api/orders', orderRouter);
  app.use('/api/templates', templateRouter);
  app.use('/api/activity-logs', activityLogRouter);
  app.use('/api/admin/vendors', adminVendorRouter);
  app.use('/api/admin/analytics', adminAnalyticsRouter);
  app.use('/api/manager/analytics', managerAnalyticsRouter);
  app.use('/api/admin/system-logs', systemLogRouter);

  // Global Express API Error Handler (logs all 500s to Daily Rolling Logger)
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[API Error]', err);
    logError({
      message: err.message || 'Internal Server API Error',
      context: `${req.method} ${req.originalUrl || req.url}`,
      error: err,
      req,
      statusCode: err.status || 500
    }).catch(() => {});

    if (res.headersSent) {
      return next(err);
    }
    return res.status(err.status || 500).json({
      success: false,
      error: err.name || 'Internal Server Error',
      message: err.message || 'Terjadi galat pada server'
    });
  });

  // Initialize Daily Rolling Logger (creates /logs directory & prunes old archives)
  await initDailyRollingLogger();

  // Vite Middleware / Static Serving
  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer }
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Populate in-memory database immediately so all endpoints have data from moment one
  await seedDatabase();

  // Initialize automated 3-month data retention background scheduler
  initRetentionScheduler();

  httpServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Server] Port ${PORT} is already in use.`);
    } else {
      console.error('[Server] Server error:', err);
    }
  });

  const cleanup = () => {
    httpServer.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  // Bind to 0.0.0.0:3000
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] SipSpot POS running on http://0.0.0.0:${PORT}`);
    writeDailyLog({
      level: 'INFO',
      category: 'SYSTEM',
      message: `SipSpot POS Server berhasil dijalankan pada port ${PORT} (PID: ${process.pid})`
    }).catch(() => {});
  });

  // Connect to MongoDB or establish resilient in-memory mode
  connectDB()
    .then(() => seedDatabase())
    .catch((err: any) => {
      console.warn('[Bootstrap] Database setup warning:', err.message);
    });
}

startServer().catch(err => {
  console.error('[Server] Fatal bootstrap error:', err);
  logError({
    message: 'Fatal server bootstrap error',
    context: 'startServer',
    error: err
  }).catch(() => {});
});
