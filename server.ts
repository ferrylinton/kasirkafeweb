import express from 'express';
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
import { vendorMiddleware } from './server/vendorMiddleware';
import { i18nMiddleware } from './server/i18n';

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();

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

  // Vite Middleware / Static Serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  // Bind to 0.0.0.0:3000
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] SipSpot POS running on http://0.0.0.0:${PORT}`);
  });

  // If external MongoDB URI is configured, connect and seed remote DB in background
  if (process.env.MONGODB_URI) {
    connectDB()
      .then(() => seedDatabase())
      .catch((err: any) => {
        console.warn('[Bootstrap] Database setup warning:', err.message);
      });
  }
}

startServer().catch(err => {
  console.error('[Server] Fatal bootstrap error:', err);
});
