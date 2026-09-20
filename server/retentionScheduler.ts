/**
 * Automated Data Retention Scheduler for 3 Months (90 Days)
 * Periodically purges transaction orders older than 90 days across MongoDB and fallback storage.
 * Records all cleanup cycles to system activity logs.
 */

import { getDB, fallbackStore } from './db';

export const RETENTION_DAYS = 90;
export const RETENTION_MONTHS = 3;

export interface RetentionStatus {
  retentionDays: number;
  retentionMonths: number;
  cutoffDate: string;
  lastRunTime: string | null;
  lastDeletedCount: number;
  totalPurgedLifetime: number;
  activeOrdersCount: number;
  nextScheduledRun: string | null;
  schedulerStatus: 'ACTIVE' | 'RUNNING';
  intervalHours: number;
}

let lastRunTime: Date | null = null;
let lastDeletedCount = 0;
let totalPurgedLifetime = 0;
let nextScheduledRun: Date | null = null;
let isRunning = false;
let schedulerTimer: NodeJS.Timeout | null = null;

const INTERVAL_MS = 6 * 60 * 60 * 1000; // Run every 6 hours

export function getCutoffDate(): Date {
  const now = new Date();
  return new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Executes a retention cleanup pass
 */
export async function runRetentionCleanup(triggeredBy = 'SYSTEM_SCHEDULER'): Promise<{
  success: boolean;
  deletedCount: number;
  cutoffDate: string;
  activeOrdersCount: number;
}> {
  if (isRunning) {
    return {
      success: false,
      deletedCount: 0,
      cutoffDate: getCutoffDate().toISOString(),
      activeOrdersCount: 0
    };
  }

  isRunning = true;
  const cutoffDate = getCutoffDate();
  let deletedFromMongo = 0;
  let deletedFromFallback = 0;
  let activeOrders = 0;

  try {
    const db = getDB();

    // 1. Cleanup in MongoDB if connected
    if (db) {
      try {
        const toDeleteCount = await db.collection('orders').countDocuments({
          createdAt: { $lt: cutoffDate }
        });

        if (toDeleteCount > 0) {
          const deleteRes = await db.collection('orders').deleteMany({
            createdAt: { $lt: cutoffDate }
          });
          deletedFromMongo = deleteRes.deletedCount || 0;
        }

        activeOrders = await db.collection('orders').countDocuments();
      } catch (mongoErr) {
        console.error('[RetentionScheduler] MongoDB deletion error:', mongoErr);
      }
    }

    // 2. Cleanup in in-memory fallbackStore
    if (fallbackStore.orders && fallbackStore.orders.length > 0) {
      const initialCount = fallbackStore.orders.length;
      fallbackStore.orders = fallbackStore.orders.filter(
        (o: any) => new Date(o.createdAt || o.date) >= cutoffDate
      );
      deletedFromFallback = initialCount - fallbackStore.orders.length;
      if (!activeOrders) {
        activeOrders = fallbackStore.orders.length;
      }
    }

    const totalDeleted = Math.max(deletedFromMongo, deletedFromFallback);
    lastDeletedCount = totalDeleted;
    totalPurgedLifetime += totalDeleted;
    lastRunTime = new Date();
    nextScheduledRun = new Date(Date.now() + INTERVAL_MS);

    // 3. Log to activity_logs
    const logEntry = {
      action: 'RETENTION_CLEANUP',
      vendorId: 'vnd_admin',
      description: `[Skeduler Retensi 3 Bulan] Menghapus ${totalDeleted} pesanan sebelum ${cutoffDate.toLocaleDateString('id-ID')}. Total pesanan aktif tersisa: ${activeOrders}.`,
      performedBy: triggeredBy,
      createdAt: new Date(),
      metadata: {
        cutoffDate: cutoffDate.toISOString(),
        deletedCount: totalDeleted,
        activeOrdersCount: activeOrders,
        retentionDays: RETENTION_DAYS
      }
    };

    if (db) {
      try {
        await db.collection('activity_logs').insertOne({
          ...logEntry,
          id: `log_retention_${Date.now()}`
        });
      } catch (logErr) {
        console.error('[RetentionScheduler] Failed to write Mongo activity log:', logErr);
      }
    }

    if (!fallbackStore.activity_logs) {
      fallbackStore.activity_logs = [];
    }
    fallbackStore.activity_logs.unshift({
      ...logEntry,
      id: `log_retention_${Date.now()}`
    } as any);

    console.log(`[RetentionScheduler] Completed cleanup: ${totalDeleted} old orders purged. Active: ${activeOrders}`);

    return {
      success: true,
      deletedCount: totalDeleted,
      cutoffDate: cutoffDate.toISOString(),
      activeOrdersCount: activeOrders
    };
  } finally {
    isRunning = false;
  }
}

/**
 * Returns current status of data retention and scheduler
 */
export async function getRetentionStatus(): Promise<RetentionStatus> {
  const cutoffDate = getCutoffDate();
  let activeOrders = 0;

  const db = getDB();
  if (db) {
    try {
      activeOrders = await db.collection('orders').countDocuments();
    } catch {
      activeOrders = fallbackStore.orders?.length || 0;
    }
  } else {
    activeOrders = fallbackStore.orders?.length || 0;
  }

  return {
    retentionDays: RETENTION_DAYS,
    retentionMonths: RETENTION_MONTHS,
    cutoffDate: cutoffDate.toISOString(),
    lastRunTime: lastRunTime ? lastRunTime.toISOString() : null,
    lastDeletedCount,
    totalPurgedLifetime,
    activeOrdersCount: activeOrders,
    nextScheduledRun: nextScheduledRun ? nextScheduledRun.toISOString() : null,
    schedulerStatus: isRunning ? 'RUNNING' : 'ACTIVE',
    intervalHours: INTERVAL_MS / (60 * 60 * 1000)
  };
}

/**
 * Initializes and starts the background automated scheduler
 */
export function initRetentionScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  console.log(`[RetentionScheduler] Starting automatic retention cleaner (policy: ${RETENTION_DAYS} days / ${RETENTION_MONTHS} months, interval: 6h)`);

  // Initial run 3 seconds after boot
  setTimeout(() => {
    runRetentionCleanup('BOOT_AUTO_SCHEDULER').catch(err => {
      console.error('[RetentionScheduler] Initial boot cleanup error:', err);
    });
  }, 3000);

  // Set recurring interval
  schedulerTimer = setInterval(() => {
    runRetentionCleanup('AUTOMATIC_CRON').catch(err => {
      console.error('[RetentionScheduler] Interval cleanup error:', err);
    });
  }, INTERVAL_MS);

  nextScheduledRun = new Date(Date.now() + 3000);
}
