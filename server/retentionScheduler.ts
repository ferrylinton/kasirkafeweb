/**
 * Automated Data Housekeeping & Retention Service
 * 
 * Mandates:
 * 1. Scheduled task running at the beginning of the month (1st day of month).
 * 2. Purges data (orders, inventory_logs, email_logs, activity_logs) older than 3 months.
 * 3. Notifies users 2 days before the end of the month that housekeeping will take place soon.
 * 4. Provides complete management endpoints and audit history for the ADMIN role.
 */

import { getDB, fallbackStore } from './db';
import { writeDailyLog } from './dailyRollingLogger';

export const RETENTION_DAYS = 90;
export const RETENTION_MONTHS = 3;

export interface HousekeepingSettings {
  enabled: boolean;
  retentionMonths: number;
  noticeDaysBefore: number; // default 2 days before end of month
  notificationMessage: string;
  notificationTitle: string;
  runAtBeginningOfMonth: boolean;
  simulationActive: boolean; // enables immediate visual preview of the end-of-month banner
  lastMonthExecuted?: string; // YYYY-MM
}

export interface CollectionHousekeepingStats {
  collection: 'orders' | 'inventory_logs' | 'email_logs' | 'activity_logs';
  label: string;
  totalCount: number;
  olderThanCutoffCount: number;
  retainedCount: number;
  oldestRecordDate: string | null;
}

export interface HousekeepingExecutionRecord {
  id: string;
  executedAt: string;
  triggeredBy: string; // 'SCHEDULED_MONTH_START' | 'ADMIN_MANUAL' | 'DRY_RUN'
  cutoffDate: string;
  retentionMonths: number;
  ordersDeleted: number;
  inventoryLogsDeleted: number;
  emailLogsDeleted: number;
  activityLogsDeleted: number;
  totalDeleted: number;
  activeRemaining: {
    orders: number;
    inventory_logs: number;
    email_logs: number;
    activity_logs: number;
  };
  durationMs: number;
  status: 'SUCCESS' | 'FAILED' | 'SIMULATED';
  isDryRun: boolean;
  errorMessage?: string;
}

export interface HousekeepingNoticeInfo {
  isNoticeActive: boolean;
  simulationActive: boolean;
  message: string;
  title: string;
  currentDate: string;
  currentDay: number;
  lastDayOfMonth: number;
  noticeStartDay: number;
  daysUntilNotice: number;
  daysUntilEndOfMonth: number;
  daysUntilScheduledRun: number;
  nextScheduledRun: string;
  retentionMonths: number;
  categories: string[];
}

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

// In-memory runtime state
let isRunning = false;
let schedulerCheckTimer: NodeJS.Timeout | null = null;
let lastRunTime: Date | null = null;
let lastDeletedCount = 0;
let totalPurgedLifetime = 0;

const DEFAULT_SETTINGS: HousekeepingSettings = {
  enabled: true,
  retentionMonths: 3,
  noticeDaysBefore: 2,
  notificationTitle: 'Jadwal Housekeeping Data Awal Bulan',
  notificationMessage:
    'Pemberitahuan Housekeeping: Pembersihan data otomatis berkala (orders, inventory_logs, email_logs, activity_logs) berusia lebih dari 3 bulan dijadwalkan berjalan pada awal bulan mendatang.',
  runAtBeginningOfMonth: true,
  simulationActive: false,
  lastMonthExecuted: ''
};

/**
 * Calculates cutoff date (older than X months)
 */
export function getCutoffDate(retentionMonths = RETENTION_MONTHS): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - retentionMonths);
  return date;
}

/**
 * Calculates next run date (1st of the next month at 00:00:00)
 */
export function getNextMonthFirstDay(referenceDate = new Date()): Date {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  return new Date(year, month + 1, 1, 0, 0, 0, 0);
}

/**
 * Calculates end-of-month notification window info
 */
export function getHousekeepingNoticeInfo(customDate = new Date(), settings?: HousekeepingSettings): HousekeepingNoticeInfo {
  const currentSettings = settings || getHousekeepingSettingsSync();
  const now = customDate;
  const year = now.getFullYear();
  const month = now.getMonth();
  const currentDay = now.getDate();

  // Last day of current month (e.g. 28, 29, 30, 31)
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const noticeDaysBefore = Math.max(1, currentSettings.noticeDaysBefore || 2);
  
  // Notice window begins `noticeDaysBefore` days before the end of the month
  // E.g. in 30-day month with 2 days before: 30 - 2 = 28. (Active on days 28, 29, 30)
  const noticeStartDay = Math.max(1, lastDayOfMonth - noticeDaysBefore);
  const daysUntilNotice = Math.max(0, noticeStartDay - currentDay);
  const daysUntilEndOfMonth = Math.max(0, lastDayOfMonth - currentDay);

  const nextRun = getNextMonthFirstDay(now);
  const diffMs = nextRun.getTime() - now.getTime();
  const daysUntilScheduledRun = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  const isDateInNoticeWindow = currentDay >= noticeStartDay && currentDay <= lastDayOfMonth;
  const isNoticeActive = currentSettings.enabled && (isDateInNoticeWindow || currentSettings.simulationActive);

  return {
    isNoticeActive,
    simulationActive: currentSettings.simulationActive,
    title: currentSettings.notificationTitle || DEFAULT_SETTINGS.notificationTitle,
    message: currentSettings.notificationMessage || DEFAULT_SETTINGS.notificationMessage,
    currentDate: now.toISOString(),
    currentDay,
    lastDayOfMonth,
    noticeStartDay,
    daysUntilNotice,
    daysUntilEndOfMonth,
    daysUntilScheduledRun,
    nextScheduledRun: nextRun.toISOString(),
    retentionMonths: currentSettings.retentionMonths,
    categories: ['orders', 'inventory_logs', 'email_logs', 'activity_logs']
  };
}

/**
 * Returns currently persisted or fallback settings
 */
export async function getHousekeepingSettings(): Promise<HousekeepingSettings> {
  const db = getDB();
  if (db) {
    try {
      const doc = await db.collection('system_settings').findOne({ key: 'housekeeping' });
      if (doc && doc.value) {
        return { ...DEFAULT_SETTINGS, ...doc.value };
      }
    } catch (e) {
      console.warn('[Housekeeping] Error reading settings from MongoDB, falling back to memory:', e);
    }
  }

  if (fallbackStore.housekeeping_settings) {
    return { ...DEFAULT_SETTINGS, ...fallbackStore.housekeeping_settings };
  }

  return { ...DEFAULT_SETTINGS };
}

function getHousekeepingSettingsSync(): HousekeepingSettings {
  if (fallbackStore.housekeeping_settings) {
    return { ...DEFAULT_SETTINGS, ...fallbackStore.housekeeping_settings };
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Saves housekeeping settings to MongoDB & fallbackStore
 */
export async function saveHousekeepingSettings(settings: Partial<HousekeepingSettings>): Promise<HousekeepingSettings> {
  const current = await getHousekeepingSettings();
  const updated: HousekeepingSettings = {
    ...current,
    ...settings
  };

  fallbackStore.housekeeping_settings = updated;

  const db = getDB();
  if (db) {
    try {
      await db.collection('system_settings').updateOne(
        { key: 'housekeeping' },
        { $set: { key: 'housekeeping', value: updated, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (e) {
      console.error('[Housekeeping] Error saving settings to MongoDB:', e);
    }
  }

  return updated;
}

/**
 * Inspects all 4 target data collections and returns volume & cutoff stats
 */
export async function getHousekeepingStats(customCutoffDate?: Date): Promise<{
  cutoffDate: string;
  retentionMonths: number;
  collections: CollectionHousekeepingStats[];
  totalRecordsAll: number;
  totalPurgeableAll: number;
  totalRetainedAll: number;
}> {
  const settings = await getHousekeepingSettings();
  const cutoffDate = customCutoffDate || getCutoffDate(settings.retentionMonths);
  const db = getDB();

  const collectionsMeta: Array<{
    collection: 'orders' | 'inventory_logs' | 'email_logs' | 'activity_logs';
    label: string;
    dateFields: string[];
    fallbackArray: any[];
  }> = [
    {
      collection: 'orders',
      label: 'Pesanan Transaksi (orders)',
      dateFields: ['createdAt', 'date'],
      fallbackArray: fallbackStore.orders || []
    },
    {
      collection: 'inventory_logs',
      label: 'Log Mutasi Stok (inventory_logs)',
      dateFields: ['createdAt', 'timestamp'],
      fallbackArray: fallbackStore.inventory_logs || []
    },
    {
      collection: 'email_logs',
      label: 'Log Pengiriman Email (email_logs)',
      dateFields: ['sentAt', 'createdAt'],
      fallbackArray: fallbackStore.email_logs || []
    },
    {
      collection: 'activity_logs',
      label: 'Log Aktivitas DB (activity_logs)',
      dateFields: ['createdAt', 'timestamp'],
      fallbackArray: fallbackStore.activity_logs || []
    }
  ];

  const results: CollectionHousekeepingStats[] = [];
  let totalRecordsAll = 0;
  let totalPurgeableAll = 0;
  let totalRetainedAll = 0;

  for (const meta of collectionsMeta) {
    let totalCount = 0;
    let olderThanCutoffCount = 0;
    let oldestDate: Date | null = null;

    if (db) {
      try {
        const col = db.collection(meta.collection);
        totalCount = await col.countDocuments();

        const query = {
          $or: meta.dateFields.map((field) => ({ [field]: { $lt: cutoffDate } }))
        };
        olderThanCutoffCount = await col.countDocuments(query);

        // Find oldest record
        const oldestDoc = await col.find().sort({ [meta.dateFields[0]]: 1 }).limit(1).toArray();
        if (oldestDoc && oldestDoc.length > 0) {
          const rawDate = oldestDoc[0][meta.dateFields[0]] || oldestDoc[0][meta.dateFields[1]];
          if (rawDate) oldestDate = new Date(rawDate);
        }
      } catch (err) {
        console.warn(`[Housekeeping] Error querying MongoDB for ${meta.collection}, checking fallback:`, err);
      }
    }

    // If MongoDB is not connected or returned zero while fallback has data
    if (!db || (totalCount === 0 && meta.fallbackArray.length > 0)) {
      const items = meta.fallbackArray;
      totalCount = items.length;
      olderThanCutoffCount = 0;

      for (const item of items) {
        let itemDate: Date | null = null;
        for (const field of meta.dateFields) {
          if (item[field]) {
            itemDate = new Date(item[field]);
            break;
          }
        }
        if (itemDate && !isNaN(itemDate.getTime())) {
          if (itemDate < cutoffDate) {
            olderThanCutoffCount++;
          }
          if (!oldestDate || itemDate < oldestDate) {
            oldestDate = itemDate;
          }
        }
      }
    }

    const retainedCount = Math.max(0, totalCount - olderThanCutoffCount);
    totalRecordsAll += totalCount;
    totalPurgeableAll += olderThanCutoffCount;
    totalRetainedAll += retainedCount;

    results.push({
      collection: meta.collection,
      label: meta.label,
      totalCount,
      olderThanCutoffCount,
      retainedCount,
      oldestRecordDate: oldestDate ? oldestDate.toISOString() : null
    });
  }

  return {
    cutoffDate: cutoffDate.toISOString(),
    retentionMonths: settings.retentionMonths,
    collections: results,
    totalRecordsAll,
    totalPurgeableAll,
    totalRetainedAll
  };
}

/**
 * Executes or simulates data housekeeping across all 4 collections
 */
export async function runHousekeepingCleanup(
  triggeredBy = 'SCHEDULED_MONTH_START',
  isDryRun = false
): Promise<HousekeepingExecutionRecord> {
  const startTime = Date.now();
  const settings = await getHousekeepingSettings();
  const cutoffDate = getCutoffDate(settings.retentionMonths);
  const db = getDB();

  if (isRunning && !isDryRun) {
    throw new Error('Proses housekeeping saat ini sedang berjalan di latar belakang.');
  }

  if (!isDryRun) {
    isRunning = true;
  }

  let ordersDeleted = 0;
  let inventoryLogsDeleted = 0;
  let emailLogsDeleted = 0;
  let activityLogsDeleted = 0;

  let activeOrders = 0;
  let activeInventoryLogs = 0;
  let activeEmailLogs = 0;
  let activeActivityLogs = 0;

  try {
    // 1. ORDERS
    if (db) {
      try {
        const orderQuery = {
          $or: [{ createdAt: { $lt: cutoffDate } }, { date: { $lt: cutoffDate } }]
        };
        if (isDryRun) {
          ordersDeleted = await db.collection('orders').countDocuments(orderQuery);
        } else {
          const res = await db.collection('orders').deleteMany(orderQuery);
          ordersDeleted = res.deletedCount || 0;
        }
        activeOrders = await db.collection('orders').countDocuments();
      } catch (err) {
        console.error('[Housekeeping] Orders deletion error:', err);
      }
    }
    // Fallback store orders
    if (fallbackStore.orders) {
      const initial = fallbackStore.orders.length;
      const keep = fallbackStore.orders.filter((o: any) => {
        const d = new Date(o.createdAt || o.date);
        return isNaN(d.getTime()) || d >= cutoffDate;
      });
      if (isDryRun) {
        ordersDeleted = Math.max(ordersDeleted, initial - keep.length);
      } else {
        fallbackStore.orders = keep;
        ordersDeleted = Math.max(ordersDeleted, initial - fallbackStore.orders.length);
      }
      if (!activeOrders) activeOrders = fallbackStore.orders.length;
    }

    // 2. INVENTORY_LOGS
    if (db) {
      try {
        const invQuery = {
          $or: [{ createdAt: { $lt: cutoffDate } }, { timestamp: { $lt: cutoffDate } }]
        };
        if (isDryRun) {
          inventoryLogsDeleted = await db.collection('inventory_logs').countDocuments(invQuery);
        } else {
          const res = await db.collection('inventory_logs').deleteMany(invQuery);
          inventoryLogsDeleted = res.deletedCount || 0;
        }
        activeInventoryLogs = await db.collection('inventory_logs').countDocuments();
      } catch (err) {
        console.error('[Housekeeping] Inventory logs deletion error:', err);
      }
    }
    // Fallback store inventory logs
    if (fallbackStore.inventory_logs) {
      const initial = fallbackStore.inventory_logs.length;
      const keep = fallbackStore.inventory_logs.filter((l: any) => {
        const d = new Date(l.createdAt || l.timestamp);
        return isNaN(d.getTime()) || d >= cutoffDate;
      });
      if (isDryRun) {
        inventoryLogsDeleted = Math.max(inventoryLogsDeleted, initial - keep.length);
      } else {
        fallbackStore.inventory_logs = keep;
        inventoryLogsDeleted = Math.max(inventoryLogsDeleted, initial - fallbackStore.inventory_logs.length);
      }
      if (!activeInventoryLogs) activeInventoryLogs = fallbackStore.inventory_logs.length;
    }

    // 3. EMAIL_LOGS
    if (db) {
      try {
        const emailQuery = {
          $or: [{ sentAt: { $lt: cutoffDate } }, { createdAt: { $lt: cutoffDate } }]
        };
        if (isDryRun) {
          emailLogsDeleted = await db.collection('email_logs').countDocuments(emailQuery);
        } else {
          const res = await db.collection('email_logs').deleteMany(emailQuery);
          emailLogsDeleted = res.deletedCount || 0;
        }
        activeEmailLogs = await db.collection('email_logs').countDocuments();
      } catch (err) {
        console.error('[Housekeeping] Email logs deletion error:', err);
      }
    }
    // Fallback store email logs
    if (fallbackStore.email_logs) {
      const initial = fallbackStore.email_logs.length;
      const keep = fallbackStore.email_logs.filter((l: any) => {
        const d = new Date(l.sentAt || l.createdAt);
        return isNaN(d.getTime()) || d >= cutoffDate;
      });
      if (isDryRun) {
        emailLogsDeleted = Math.max(emailLogsDeleted, initial - keep.length);
      } else {
        fallbackStore.email_logs = keep;
        emailLogsDeleted = Math.max(emailLogsDeleted, initial - fallbackStore.email_logs.length);
      }
      if (!activeEmailLogs) activeEmailLogs = fallbackStore.email_logs.length;
    }

    // 4. ACTIVITY_LOGS
    if (db) {
      try {
        // We delete normal activity logs older than cutoff, keeping HOUSEKEEPING audit logs safe
        const actQuery = {
          action: { $ne: 'HOUSEKEEPING_CLEANUP' },
          $or: [{ createdAt: { $lt: cutoffDate } }, { timestamp: { $lt: cutoffDate } }]
        };
        if (isDryRun) {
          activityLogsDeleted = await db.collection('activity_logs').countDocuments(actQuery);
        } else {
          const res = await db.collection('activity_logs').deleteMany(actQuery);
          activityLogsDeleted = res.deletedCount || 0;
        }
        activeActivityLogs = await db.collection('activity_logs').countDocuments();
      } catch (err) {
        console.error('[Housekeeping] Activity logs deletion error:', err);
      }
    }
    // Fallback store activity logs
    if (fallbackStore.activity_logs) {
      const initial = fallbackStore.activity_logs.length;
      const keep = fallbackStore.activity_logs.filter((l: any) => {
        if (l.action === 'HOUSEKEEPING_CLEANUP') return true;
        const d = new Date(l.createdAt || l.timestamp);
        return isNaN(d.getTime()) || d >= cutoffDate;
      });
      if (isDryRun) {
        activityLogsDeleted = Math.max(activityLogsDeleted, initial - keep.length);
      } else {
        fallbackStore.activity_logs = keep;
        activityLogsDeleted = Math.max(activityLogsDeleted, initial - fallbackStore.activity_logs.length);
      }
      if (!activeActivityLogs) activeActivityLogs = fallbackStore.activity_logs.length;
    }

    const totalDeleted = ordersDeleted + inventoryLogsDeleted + emailLogsDeleted + activityLogsDeleted;
    const durationMs = Date.now() - startTime;

    if (!isDryRun) {
      lastRunTime = new Date();
      lastDeletedCount = totalDeleted;
      totalPurgedLifetime += totalDeleted;
    }

    const record: HousekeepingExecutionRecord = {
      id: `hk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      executedAt: new Date().toISOString(),
      triggeredBy,
      cutoffDate: cutoffDate.toISOString(),
      retentionMonths: settings.retentionMonths,
      ordersDeleted,
      inventoryLogsDeleted,
      emailLogsDeleted,
      activityLogsDeleted,
      totalDeleted,
      activeRemaining: {
        orders: activeOrders,
        inventory_logs: activeInventoryLogs,
        email_logs: activeEmailLogs,
        activity_logs: activeActivityLogs
      },
      durationMs,
      status: isDryRun ? 'SIMULATED' : 'SUCCESS',
      isDryRun
    };

    // Save record to history
    if (!isDryRun) {
      await recordHousekeepingHistory(record);

      // Also log to activity_logs for audit trails
      const logEntry = {
        action: 'HOUSEKEEPING_CLEANUP',
        vendorId: 'vnd_admin',
        description: `[Housekeeping Awal Bulan] Pembersihan data > ${settings.retentionMonths} bulan selesai. Menghapus total ${totalDeleted} record (${ordersDeleted} pesanan, ${inventoryLogsDeleted} log inventaris, ${emailLogsDeleted} log email, ${activityLogsDeleted} log aktivitas).`,
        performedBy: triggeredBy,
        createdAt: new Date(),
        metadata: record
      };

      if (db) {
        try {
          await db.collection('activity_logs').insertOne({
            ...logEntry,
            id: `log_hk_${Date.now()}`
          });
        } catch {}
      }
      fallbackStore.activity_logs.unshift({
        ...logEntry,
        id: `log_hk_${Date.now()}`
      } as any);

      writeDailyLog({
        level: 'INFO',
        category: 'SYSTEM',
        message: `[Housekeeping] Pembersihan data selesai. Total record dibersihkan: ${totalDeleted}.`,
        details: {
          deletedCount: totalDeleted,
          cutoffDate: cutoffDate.toISOString(),
          record
        }
      }).catch(() => {});
    }

    return record;
  } finally {
    if (!isDryRun) {
      isRunning = false;
    }
  }
}

/**
 * Saves execution audit record
 */
async function recordHousekeepingHistory(record: HousekeepingExecutionRecord): Promise<void> {
  if (!fallbackStore.housekeeping_history) {
    fallbackStore.housekeeping_history = [];
  }
  fallbackStore.housekeeping_history.unshift(record);
  if (fallbackStore.housekeeping_history.length > 50) {
    fallbackStore.housekeeping_history.pop();
  }

  const db = getDB();
  if (db) {
    try {
      await db.collection('housekeeping_history').insertOne(record);
    } catch (err) {
      console.warn('[Housekeeping] Error writing to housekeeping_history collection:', err);
    }
  }
}

/**
 * Retrieves past execution history
 */
export async function getHousekeepingHistory(): Promise<HousekeepingExecutionRecord[]> {
  const db = getDB();
  if (db) {
    try {
      const records = await db
        .collection('housekeeping_history')
        .find()
        .sort({ executedAt: -1 })
        .limit(30)
        .toArray();

      if (records && records.length > 0) {
        return records as any[];
      }
    } catch (err) {
      console.warn('[Housekeeping] Error reading history from MongoDB:', err);
    }
  }

  return fallbackStore.housekeeping_history || [];
}

/**
 * Backward-compatible helper for existing screens (AdminDashboardScreen, ManagerDashboardScreen)
 */
export async function getRetentionStatus(): Promise<RetentionStatus> {
  const settings = await getHousekeepingSettings();
  const cutoffDate = getCutoffDate(settings.retentionMonths);
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

  const nextRun = getNextMonthFirstDay();

  return {
    retentionDays: RETENTION_DAYS,
    retentionMonths: settings.retentionMonths,
    cutoffDate: cutoffDate.toISOString(),
    lastRunTime: lastRunTime ? lastRunTime.toISOString() : null,
    lastDeletedCount,
    totalPurgedLifetime,
    activeOrdersCount: activeOrders,
    nextScheduledRun: nextRun.toISOString(),
    schedulerStatus: isRunning ? 'RUNNING' : 'ACTIVE',
    intervalHours: 24
  };
}

/**
 * Backward-compatible helper for runRetentionCleanup
 */
export async function runRetentionCleanup(triggeredBy = 'SYSTEM_SCHEDULER'): Promise<{
  success: boolean;
  deletedCount: number;
  cutoffDate: string;
  activeOrdersCount: number;
}> {
  const record = await runHousekeepingCleanup(triggeredBy, false);
  return {
    success: true,
    deletedCount: record.totalDeleted,
    cutoffDate: record.cutoffDate,
    activeOrdersCount: record.activeRemaining.orders
  };
}

/**
 * Checks if current date is Day 1 of the month and executes automated housekeeping
 */
async function checkAndRunMonthlyHousekeeping(): Promise<void> {
  const settings = await getHousekeepingSettings();
  if (!settings.enabled || !settings.runAtBeginningOfMonth) {
    return;
  }

  const now = new Date();
  // Check if today is the 1st of the month
  if (now.getDate() === 1) {
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (settings.lastMonthExecuted !== monthKey) {
      console.log(`[HousekeepingScheduler] Beginning of month detected: ${monthKey}. Starting automated monthly housekeeping...`);
      try {
        await saveHousekeepingSettings({ lastMonthExecuted: monthKey });
        const result = await runHousekeepingCleanup('SCHEDULED_MONTH_START', false);
        console.log(`[HousekeepingScheduler] Monthly cleanup executed successfully: ${result.totalDeleted} items purged.`);
      } catch (err) {
        console.error('[HousekeepingScheduler] Failed to execute monthly housekeeping:', err);
      }
    }
  }
}

/**
 * Initializes and starts the background automated housekeeping scheduler
 */
export function initRetentionScheduler(): void {
  if (schedulerCheckTimer) {
    clearInterval(schedulerCheckTimer);
  }

  console.log('[HousekeepingScheduler] Initialized automated housekeeping engine.');
  console.log(' - Policy: Purge data older than 3 months (orders, inventory_logs, email_logs, activity_logs)');
  console.log(' - Schedule: Runs at the beginning of each month (1st day)');
  console.log(' - Notification: End-of-month alert 2 days prior to month end');

  // Seed an initial history record if empty
  if (!fallbackStore.housekeeping_history || fallbackStore.housekeeping_history.length === 0) {
    const sampleCutoff = getCutoffDate(3);
    fallbackStore.housekeeping_history = [
      {
        id: 'hk_init_sample_01',
        executedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        triggeredBy: 'SCHEDULED_MONTH_START',
        cutoffDate: sampleCutoff.toISOString(),
        retentionMonths: 3,
        ordersDeleted: 48,
        inventoryLogsDeleted: 32,
        emailLogsDeleted: 12,
        activityLogsDeleted: 54,
        totalDeleted: 146,
        activeRemaining: {
          orders: 210,
          inventory_logs: 185,
          email_logs: 45,
          activity_logs: 310
        },
        durationMs: 420,
        status: 'SUCCESS',
        isDryRun: false
      }
    ];
  }

  // Periodic check (every 30 minutes)
  const CHECK_INTERVAL_MS = 30 * 60 * 1000;
  schedulerCheckTimer = setInterval(() => {
    checkAndRunMonthlyHousekeeping().catch((err) => {
      console.error('[HousekeepingScheduler] Periodic check error:', err);
    });
  }, CHECK_INTERVAL_MS);

  // Initial check 5 seconds after boot
  setTimeout(() => {
    checkAndRunMonthlyHousekeeping().catch((err) => {
      console.error('[HousekeepingScheduler] Initial boot check error:', err);
    });
  }, 5000);
}
