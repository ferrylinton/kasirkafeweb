import fs from 'fs';
import path from 'path';
import { Request } from 'express';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
export type LogCategory =
  | 'AUTH'
  | 'ORDER'
  | 'DATA_MUTATION'
  | 'DATABASE'
  | 'REDIS'
  | 'ERROR'
  | 'SYSTEM';

export interface DailyLogPerformer {
  id: string;
  name: string;
  email?: string;
  role: string;
}

export interface DailyLogEntry {
  id: string;
  timestamp: string; // ISO string
  date: string;      // YYYY-MM-DD
  time: string;      // HH:mm:ss.SSS
  level: LogLevel;
  category: LogCategory;
  message: string;
  performer?: DailyLogPerformer;
  vendorId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  stack?: string;
}

export interface DailyLogFileMeta {
  fileName: string;
  date: string;
  filePath: string;
  sizeBytes: number;
  formattedSize: string;
  totalEntries: number;
  lastModified: string;
  isToday: boolean;
}

const LOGS_DIR = path.join(process.cwd(), 'logs');

// Ensure logs directory exists
function ensureLogsDir(): void {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('[DailyRollingLogger] Failed to create logs directory:', err);
  }
}

/**
 * Returns today's date in YYYY-MM-DD string using Asia/Jakarta (WIB) timezone
 */
export function getTodayLogDateString(): string {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d);
}

/**
 * Formats a timestamp into HH:mm:ss.SSS in Asia/Jakarta timezone
 */
export function formatTimeWIB(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false
  });
  return formatter.format(date);
}

/**
 * Get daily log file path for a given date YYYY-MM-DD
 */
export function getLogFilePath(dateStr: string = getTodayLogDateString()): string {
  return path.join(LOGS_DIR, `app-${dateStr}.log`);
}

/**
 * Format bytes to readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// In-memory ring buffer of the most recent entries for ultra-fast queries & realtime dashboard
const RECENT_BUFFER_LIMIT = 500;
const recentLogsBuffer: DailyLogEntry[] = [];

// Write queue to ensure sequential and clean file appends
let writeQueue: Promise<void> = Promise.resolve();

/**
 * Internal worker to append a log entry into the daily file
 */
async function appendEntryToFile(entry: DailyLogEntry): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    try {
      ensureLogsDir();
      const filePath = getLogFilePath(entry.date);
      const line = JSON.stringify(entry) + '\n';
      await fs.promises.appendFile(filePath, line, { encoding: 'utf8' });
    } catch (err) {
      console.error('[DailyRollingLogger] Write error to file:', err);
    }
  });
  await writeQueue;
}

/**
 * Main function to write a structured daily rolling log entry
 */
export async function writeDailyLog(input: {
  level: LogLevel;
  category: LogCategory;
  message: string;
  performer?: Partial<DailyLogPerformer>;
  vendorId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  stack?: string;
  req?: Request;
}): Promise<DailyLogEntry> {
  ensureLogsDir();
  const now = new Date();
  const dateStr = getTodayLogDateString();
  const timeStr = formatTimeWIB(now);

  // Extract client IP if request provided
  let ip = input.ipAddress;
  if (!ip && input.req) {
    const forwarded = input.req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      ip = forwarded.split(',')[0].trim();
    } else if (Array.isArray(forwarded) && forwarded.length > 0) {
      ip = forwarded[0].trim();
    } else {
      ip = input.req.socket?.remoteAddress || input.req.ip || '127.0.0.1';
    }
  }
  if (!ip) ip = '127.0.0.1';

  // Extract user agent
  const userAgent = input.userAgent || (input.req ? (input.req.headers['user-agent'] as string) : undefined);

  // Resolve performer
  let performer: DailyLogPerformer | undefined = undefined;
  if (input.performer?.name || input.performer?.id) {
    performer = {
      id: input.performer.id || 'unknown',
      name: input.performer.name || 'User',
      email: input.performer.email,
      role: input.performer.role || 'STAFF'
    };
  } else if (input.req?.user) {
    performer = {
      id: input.req.user.userId || 'unknown',
      name: input.req.user.name || 'User',
      email: input.req.user.email,
      role: input.req.user.role || 'STAFF'
    };
  }

  // Resolve vendorId
  const vendorId = input.vendorId || (input.req as any)?.vendorId || undefined;

  const entry: DailyLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: now.toISOString(),
    date: dateStr,
    time: timeStr,
    level: input.level,
    category: input.category,
    message: input.message,
    performer,
    vendorId,
    ipAddress: ip,
    userAgent,
    details: input.details,
    stack: input.stack
  };

  // Add to in-memory buffer (newest first)
  recentLogsBuffer.unshift(entry);
  if (recentLogsBuffer.length > RECENT_BUFFER_LIMIT) {
    recentLogsBuffer.pop();
  }

  // Write asynchronously to the daily file
  appendEntryToFile(entry).catch(() => {});

  // Also print to stdout for standard container logging
  const colorTag = input.level === 'ERROR' ? '\x1b[31m[ERROR]\x1b[0m' : input.level === 'WARN' ? '\x1b[33m[WARN]\x1b[0m' : '\x1b[32m[INFO]\x1b[0m';
  console.log(`[DailyLog] ${colorTag} [${entry.category}] ${entry.message}`);

  return entry;
}

// ============================================================================
// Specialized Helper Functions
// ============================================================================

/**
 * 1. Log Login & Authentication events
 */
export async function logLogin(params: {
  status: 'SUCCESS' | 'FAILED' | 'LOCKED' | 'REVOKED' | 'LOGOUT';
  email?: string;
  name?: string;
  role?: string;
  userId?: string;
  vendorId?: string;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  loginMethod?: 'PIN' | 'PASSWORD' | 'AUTO';
  req?: Request;
  details?: Record<string, any>;
}): Promise<DailyLogEntry> {
  const level: LogLevel =
    params.status === 'SUCCESS' ? 'INFO' :
    params.status === 'LOGOUT' ? 'INFO' :
    params.status === 'LOCKED' ? 'ERROR' : 'WARN';

  let msg = '';
  switch (params.status) {
    case 'SUCCESS':
      msg = `Login berhasil untuk akun ${params.name || params.email || 'User'} (${params.role || 'STAFF'}) via ${params.loginMethod || 'PIN'}`;
      break;
    case 'FAILED':
      msg = `Percobaan login gagal untuk email/PIN: ${params.email || 'N/A'}. Alasan: ${params.reason || 'Kredensial tidak valid'}`;
      break;
    case 'LOCKED':
      msg = `Akun ${params.email || 'N/A'} diblokir sementara (15 menit) karena 3x gagal login berturut-turut`;
      break;
    case 'REVOKED':
      msg = `Sesi login ${params.email || 'User'} diputus paksa karena ada login baru dari browser lain`;
      break;
    case 'LOGOUT':
      msg = `Pengguna ${params.name || params.email || 'User'} telah keluar dari sistem (Logout)`;
      break;
  }

  return writeDailyLog({
    level,
    category: 'AUTH',
    message: msg,
    performer: params.userId ? {
      id: params.userId,
      name: params.name || params.email || 'User',
      email: params.email,
      role: params.role || 'STAFF'
    } : undefined,
    vendorId: params.vendorId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    req: params.req,
    details: {
      status: params.status,
      loginMethod: params.loginMethod,
      reason: params.reason,
      ...params.details
    }
  });
}

/**
 * 2. Log Order / Transaction events
 */
export async function logOrder(params: {
  action: 'CREATED' | 'UPDATED' | 'REFUNDED' | 'CANCELLED';
  orderId: string;
  orderNumber: string;
  vendorId?: string;
  totalAmount: number;
  paymentMethod: string;
  itemsCount: number;
  cashierName?: string;
  cashierId?: string;
  customerName?: string;
  discountItemName?: string;
  req?: Request;
  details?: Record<string, any>;
}): Promise<DailyLogEntry> {
  const msg = `Transaksi #${params.orderNumber} ${params.action === 'CREATED' ? 'berhasil dibuat' : params.action}: Total Rp ${params.totalAmount.toLocaleString('id-ID')} (${params.paymentMethod}) oleh ${params.cashierName || 'Kasir'} [${params.itemsCount} item]`;

  return writeDailyLog({
    level: 'INFO',
    category: 'ORDER',
    message: msg,
    performer: params.cashierId ? {
      id: params.cashierId,
      name: params.cashierName || 'Kasir',
      role: 'CASHIER'
    } : undefined,
    vendorId: params.vendorId,
    req: params.req,
    details: {
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      totalAmount: params.totalAmount,
      paymentMethod: params.paymentMethod,
      itemsCount: params.itemsCount,
      customerName: params.customerName,
      discountItemName: params.discountItemName,
      ...params.details
    }
  });
}

/**
 * 3. Log Data Modification events (Products, Inventory, Discounts, Users, Templates, Vendors)
 */
export async function logDataMutation(params: {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  entityId?: string;
  entityName?: string;
  summary: string;
  performer?: Partial<DailyLogPerformer>;
  vendorId?: string;
  req?: Request;
  details?: Record<string, any>;
}): Promise<DailyLogEntry> {
  const level: LogLevel = params.action === 'DELETE' ? 'WARN' : 'INFO';
  const msg = `[${params.action}] ${params.entity}: ${params.summary}`;

  return writeDailyLog({
    level,
    category: 'DATA_MUTATION',
    message: msg,
    performer: params.performer,
    vendorId: params.vendorId,
    req: params.req,
    details: {
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      entityName: params.entityName,
      ...params.details
    }
  });
}

/**
 * 4. Log Database Connection events
 */
export async function logDatabase(params: {
  event: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'FALLBACK_MODE' | 'SEED_COMPLETED';
  message: string;
  dbName?: string;
  error?: any;
  details?: Record<string, any>;
}): Promise<DailyLogEntry> {
  const level: LogLevel =
    params.event === 'ERROR' ? 'ERROR' :
    params.event === 'DISCONNECTED' || params.event === 'FALLBACK_MODE' ? 'WARN' : 'INFO';

  return writeDailyLog({
    level,
    category: 'DATABASE',
    message: `[MongoDB] ${params.message}`,
    details: {
      event: params.event,
      dbName: params.dbName,
      errorMessage: params.error?.message || params.error,
      ...params.details
    },
    stack: params.error?.stack
  });
}

/**
 * 5. Log Redis Connection & Rate Limiter events
 */
export async function logRedis(params: {
  event: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'FALLBACK_MODE' | 'RATE_LIMIT_EXCEEDED';
  message: string;
  ipAddress?: string;
  error?: any;
  details?: Record<string, any>;
}): Promise<DailyLogEntry> {
  const level: LogLevel =
    params.event === 'ERROR' ? 'ERROR' :
    params.event === 'RATE_LIMIT_EXCEEDED' || params.event === 'FALLBACK_MODE' ? 'WARN' : 'INFO';

  return writeDailyLog({
    level,
    category: 'REDIS',
    message: `[Redis] ${params.message}`,
    ipAddress: params.ipAddress,
    details: {
      event: params.event,
      errorMessage: params.error?.message || params.error,
      ...params.details
    },
    stack: params.error?.stack
  });
}

/**
 * 6. Log Global / Unhandled Errors
 */
export async function logError(params: {
  message: string;
  error?: any;
  context?: string;
  req?: Request;
  performer?: Partial<DailyLogPerformer>;
  vendorId?: string;
  details?: Record<string, any>;
  statusCode?: number
}): Promise<DailyLogEntry> {
  const errMsg = params.error?.message || params.message || 'Unknown Server Error';
  const fullMsg = params.context ? `[${params.context}] ${errMsg}` : errMsg;

  return writeDailyLog({
    level: 'ERROR',
    category: 'ERROR',
    message: fullMsg,
    performer: params.performer,
    vendorId: params.vendorId,
    req: params.req,
    details: {
      context: params.context,
      errorName: params.error?.name,
      ...params.details
    },
    stack: params.error?.stack
  });
}

// ============================================================================
// File Reading, Listing, Filtering & Retention
// ============================================================================

/**
 * List all daily log files present on disk with metadata
 */
export async function listDailyLogFiles(): Promise<DailyLogFileMeta[]> {
  ensureLogsDir();
  const today = getTodayLogDateString();

  try {
    const files = await fs.promises.readdir(LOGS_DIR);
    const logFiles = files.filter(f => f.startsWith('app-') && f.endsWith('.log'));

    const result: DailyLogFileMeta[] = [];

    for (const fileName of logFiles) {
      const filePath = path.join(LOGS_DIR, fileName);
      try {
        const stats = await fs.promises.stat(filePath);
        // Extract date YYYY-MM-DD from app-YYYY-MM-DD.log
        const dateMatch = fileName.match(/^app-(\d{4}-\d{2}-\d{2})\.log$/);
        const date = dateMatch ? dateMatch[1] : fileName;

        // Estimate total lines / entries by counting newlines
        let totalEntries = 0;
        try {
          const content = await fs.promises.readFile(filePath, 'utf8');
          totalEntries = content.split('\n').filter(line => line.trim().length > 0).length;
        } catch {}

        result.push({
          fileName,
          date,
          filePath,
          sizeBytes: stats.size,
          formattedSize: formatBytes(stats.size),
          totalEntries,
          lastModified: stats.mtime.toISOString(),
          isToday: date === today
        });
      } catch {}
    }

    // Sort newest date first
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  } catch (err) {
    console.error('[DailyRollingLogger] Error listing log files:', err);
    return [];
  }
}

/**
 * Query daily logs from a specific file or date with filtering and pagination
 */
export async function queryDailyLogs(params: {
  date?: string;
  fileName?: string;
  category?: string;
  level?: string;
  search?: string;
  vendorId?: string;
  page?: number;
  limit?: number;
}): Promise<{
  entries: DailyLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    total: number;
    infoCount: number;
    warnCount: number;
    errorCount: number;
    authCount: number;
    orderCount: number;
    dataMutationCount: number;
    databaseCount: number;
    redisCount: number;
  };
  fileMeta?: DailyLogFileMeta;
}> {
  ensureLogsDir();
  const targetDate = params.date || getTodayLogDateString();
  const targetFileName = params.fileName || `app-${targetDate}.log`;
  const filePath = path.join(LOGS_DIR, targetFileName);

  let rawEntries: DailyLogEntry[] = [];

  if (fs.existsSync(filePath)) {
    try {
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = fileContent.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as DailyLogEntry;
          rawEntries.push(parsed);
        } catch {
          // If a plain text line exists, wrap as entry
          rawEntries.push({
            id: `legacy_${Math.random()}`,
            timestamp: new Date().toISOString(),
            date: targetDate,
            time: '00:00:00',
            level: 'INFO',
            category: 'SYSTEM',
            message: line
          });
        }
      }
    } catch (err) {
      console.error('[DailyRollingLogger] Failed to read log file:', err);
    }
  } else if (targetDate === getTodayLogDateString()) {
    // If today's file hasn't flushed yet or is in buffer, use in-memory buffer
    rawEntries = [...recentLogsBuffer.filter(e => e.date === targetDate)];
  }

  // Calculate stats over the entire file
  const stats = {
    total: rawEntries.length,
    infoCount: rawEntries.filter(e => e.level === 'INFO').length,
    warnCount: rawEntries.filter(e => e.level === 'WARN').length,
    errorCount: rawEntries.filter(e => e.level === 'ERROR').length,
    authCount: rawEntries.filter(e => e.category === 'AUTH').length,
    orderCount: rawEntries.filter(e => e.category === 'ORDER').length,
    dataMutationCount: rawEntries.filter(e => e.category === 'DATA_MUTATION').length,
    databaseCount: rawEntries.filter(e => e.category === 'DATABASE').length,
    redisCount: rawEntries.filter(e => e.category === 'REDIS').length,
  };

  // Filter entries
  let filtered = [...rawEntries];

  if (params.category && params.category !== 'ALL') {
    filtered = filtered.filter(e => e.category === params.category);
  }

  if (params.level && params.level !== 'ALL') {
    filtered = filtered.filter(e => e.level === params.level);
  }

  if (params.vendorId && params.vendorId !== 'ALL' && params.vendorId !== 'all') {
    filtered = filtered.filter(e => !e.vendorId || e.vendorId === params.vendorId || e.vendorId === 'ALL');
  }

  if (params.search && params.search.trim()) {
    const q = params.search.toLowerCase().trim();
    filtered = filtered.filter(e => {
      const msgMatch = e.message.toLowerCase().includes(q);
      const perfMatch = e.performer?.name?.toLowerCase().includes(q) || e.performer?.email?.toLowerCase().includes(q);
      const ipMatch = e.ipAddress?.toLowerCase().includes(q);
      const detailsMatch = e.details ? JSON.stringify(e.details).toLowerCase().includes(q) : false;
      return msgMatch || perfMatch || ipMatch || detailsMatch;
    });
  }

  // Sort descending (latest first)
  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 50));
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  // Get file meta if available
  let fileMeta: DailyLogFileMeta | undefined = undefined;
  try {
    if (fs.existsSync(filePath)) {
      const st = fs.statSync(filePath);
      fileMeta = {
        fileName: targetFileName,
        date: targetDate,
        filePath,
        sizeBytes: st.size,
        formattedSize: formatBytes(st.size),
        totalEntries: rawEntries.length,
        lastModified: st.mtime.toISOString(),
        isToday: targetDate === getTodayLogDateString()
      };
    }
  } catch {}

  return {
    entries: paginated,
    total,
    page,
    limit,
    totalPages,
    stats,
    fileMeta
  };
}

/**
 * Prune log files older than N days (default: 30 days)
 */
export async function pruneOldLogFiles(retentionDays: number = 30): Promise<{ deletedFiles: string[]; freedBytes: number }> {
  ensureLogsDir();
  const deletedFiles: string[] = [];
  let freedBytes = 0;

  try {
    const files = await fs.promises.readdir(LOGS_DIR);
    const now = Date.now();
    const cutoffTime = now - (retentionDays * 24 * 60 * 60 * 1000);

    for (const file of files) {
      if (!file.startsWith('app-') || !file.endsWith('.log')) continue;
      const filePath = path.join(LOGS_DIR, file);
      try {
        const stats = await fs.promises.stat(filePath);
        if (stats.mtimeMs < cutoffTime) {
          freedBytes += stats.size;
          await fs.promises.unlink(filePath);
          deletedFiles.push(file);
          console.log(`[DailyRollingLogger] Pruned old log file: ${file} (${formatBytes(stats.size)})`);
        }
      } catch {}
    }
  } catch (err) {
    console.error('[DailyRollingLogger] Error pruning log files:', err);
  }

  return { deletedFiles, freedBytes };
}

/**
 * Initialize daily rolling logger on server start:
 * - Creates today's log file
 * - Emits startup system log
 * - Prunes log files older than 30 days
 */
export async function initDailyRollingLogger(): Promise<void> {
  ensureLogsDir();
  const today = getTodayLogDateString();
  const filePath = getLogFilePath(today);

  // If today's file doesn't exist, create it with a start entry
  if (!fs.existsSync(filePath)) {
    await writeDailyLog({
      level: 'INFO',
      category: 'SYSTEM',
      message: `Daily Rolling Log diinisialisasi untuk tanggal ${today} (Zona Waktu: Asia/Jakarta WIB)`,
      details: {
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
        logDirectory: LOGS_DIR
      }
    });
  }

  // Prune files older than 30 days
  pruneOldLogFiles(30).catch(() => {});
}
