import { Request } from 'express';
import { ObjectId } from 'mongodb';
import { getDB, fallbackStore } from './db';
import { logDataMutation } from './dailyRollingLogger';

export type ActivityAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'FORGOT_PIN_REQUEST'
  | 'PIN_RESET_COMPLETED'
  | 'ADMIN_PIN_RESET_REQUESTED'
  | 'ADMIN_SENT_NEW_PIN'
  | 'FORGOT_PASSWORD_REQUEST'
  | 'PASSWORD_RESET_COMPLETED'
  | 'ADMIN_PASSWORD_RESET_REQUESTED'
  | 'ADMIN_SENT_NEW_PASSWORD'
  | 'VENDOR_REGISTER';
export type ActivityEntity =
  | 'PRODUCT'
  | 'INVENTORY'
  | 'DISCOUNT_RULE'
  | 'USER'
  | 'ORDER'
  | 'EMAIL_TEMPLATE'
  | 'CATEGORY'
  | 'VENDOR';

export interface PerformedByUser {
  id: string;
  name: string;
  email?: string;
  role: string;
}

export interface ActivityLogEntry {
  id: string;
  _id?: any;
  vendorId?: string;
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: string;
  entityName?: string;
  summary: string;
  details?: Record<string, any>;
  performedBy: PerformedByUser;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date | string;
}

interface RecordActivityParams {
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: string;
  entityName?: string;
  summary: string;
  details?: Record<string, any>;
  req?: Request;
  user?: Partial<PerformedByUser>;
  vendorId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Extract clean client IP address from express request
 */
function extractClientIp(req?: Request): string {
  if (!req) return '127.0.0.1';
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

/**
 * Global helper to record an activity log in the database (MongoDB + in-memory store)
 * whenever data is created, modified, or deleted.
 */
export async function recordActivityLog(params: RecordActivityParams): Promise<ActivityLogEntry> {
  const { action, entity, entityId, entityName, summary, details, req, user, ipAddress, userAgent } = params;

  // Resolve user info from request or explicit user param
  let performer: PerformedByUser = {
    id: 'system',
    name: 'Sistem POS',
    email: 'system@sipspot.local',
    role: 'SYSTEM'
  };

  if (req?.user) {
    performer = {
      id: req.user.userId || 'unknown',
      name: req.user.name || 'User',
      email: req.user.email || '',
      role: req.user.role || 'CASHIER'
    };
  } else if (user) {
    performer = {
      id: user.id || 'unknown',
      name: user.name || 'User',
      email: user.email || '',
      role: user.role || 'CASHIER'
    };
  }

  const clientIp = ipAddress || extractClientIp(req);
  const clientAgent = userAgent || (req ? (req.headers['user-agent'] as string) : undefined);
  const now = new Date();
  const generatedId = new ObjectId().toString();

  const resolvedVendorId = (req as any)?.vendorId || (req?.user as any)?.vendorId || (params as any)?.vendorId || 'vnd_sipspot_central';

  const logDoc: ActivityLogEntry = {
    id: generatedId,
    _id: generatedId,
    vendorId: resolvedVendorId,
    action,
    entity,
    entityId: entityId ? String(entityId) : undefined,
    entityName,
    summary,
    details: details || {},
    performedBy: performer,
    ipAddress: clientIp,
    userAgent: clientAgent,
    createdAt: now
  };

  // 1. Persist to MongoDB if connected
  const db = getDB();
  if (db) {
    try {
      const res = await db.collection('activity_logs').insertOne({
        ...logDoc,
        _id: new ObjectId(generatedId)
      });
      if (res.insertedId) {
        logDoc._id = res.insertedId.toString();
        logDoc.id = res.insertedId.toString();
      }
    } catch (err: any) {
      console.warn('[ActivityLogger] MongoDB insert warning:', err.message);
    }
  }

  // 2. Persist to fallback store for resilient in-memory retrieval
  if (!fallbackStore.activity_logs) {
    fallbackStore.activity_logs = [];
  }
  fallbackStore.activity_logs.unshift(logDoc);

  // Keep in-memory store bounded to prevent unlimited growth (keep latest 2000 entries)
  if (fallbackStore.activity_logs.length > 2000) {
    fallbackStore.activity_logs.pop();
  }

  // 3. Mirror data modifications to the daily rolling log file (DATA_MUTATION category)
  if (entity !== 'ORDER') {
    logDataMutation({
      action: action as any,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      entityName,
      summary,
      performer,
      vendorId: resolvedVendorId,
      req,
      details
    }).catch(() => {});
  }

  console.log(`[ActivityLog] [${action}] ${entity}: ${summary} (by ${performer.name} - ${performer.role})`);

  return logDoc;
}

export interface ActivityFilterOptions {
  action?: string;
  entity?: string;
  userId?: string;
  vendorId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

/**
 * Query activity logs with flexible filters, search, pagination, and statistics
 */
export async function queryActivityLogs(options: ActivityFilterOptions) {
  const {
    action,
    entity,
    userId,
    vendorId,
    search,
    startDate,
    endDate,
    page = 1,
    limit = 20
  } = options;

  const db = getDB();
  let allLogs: any[] = [];

  if (db) {
    try {
      const filter: any = {};

      if (vendorId && vendorId !== 'ALL') {
        filter.vendorId = vendorId;
      }
      if (action && action !== 'ALL') {
        filter.action = action.toUpperCase();
      }
      if (entity && entity !== 'ALL') {
        filter.entity = entity.toUpperCase();
      }
      if (userId && userId !== 'ALL') {
        filter.$or = [
          { 'performedBy.id': userId },
          { 'performedBy.email': userId }
        ];
      }
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          filter.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = end;
        }
      }
      if (search && search.trim()) {
        const regex = { $regex: search.trim(), $options: 'i' };
        filter.$or = [
          { summary: regex },
          { entityName: regex },
          { 'performedBy.name': regex },
          { 'performedBy.email': regex },
          { ipAddress: regex }
        ];
      }

      allLogs = await db
        .collection('activity_logs')
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();
    } catch (err: any) {
      console.warn('[ActivityLogger] MongoDB query warning:', err.message);
    }
  }

  // Fallback to in-memory store if db returns empty or is disconnected
  if (allLogs.length === 0 && fallbackStore.activity_logs.length > 0) {
    allLogs = fallbackStore.activity_logs.filter(log => {
      if (vendorId && vendorId !== 'ALL' && (log.vendorId || 'vnd_sipspot_central') !== vendorId) {
        return false;
      }
      if (action && action !== 'ALL' && log.action !== action.toUpperCase()) {
        return false;
      }
      if (entity && entity !== 'ALL' && log.entity !== entity.toUpperCase()) {
        return false;
      }
      if (userId && userId !== 'ALL' && log.performedBy?.id !== userId && log.performedBy?.email !== userId) {
        return false;
      }
      if (startDate) {
        const logTime = new Date(log.createdAt).getTime();
        const start = new Date(startDate).getTime();
        if (logTime < start) return false;
      }
      if (endDate) {
        const logTime = new Date(log.createdAt).getTime();
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (logTime > end.getTime()) return false;
      }
      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        const matchSummary = (log.summary || '').toLowerCase().includes(term);
        const matchEntityName = (log.entityName || '').toLowerCase().includes(term);
        const matchPerformer = (log.performedBy?.name || '').toLowerCase().includes(term);
        const matchEmail = (log.performedBy?.email || '').toLowerCase().includes(term);
        const matchIp = (log.ipAddress || '').toLowerCase().includes(term);
        if (!matchSummary && !matchEntityName && !matchPerformer && !matchEmail && !matchIp) {
          return false;
        }
      }
      return true;
    });
  }

  // Compute summary stats over all logs in store
  const fullCollection = fallbackStore.activity_logs.length > allLogs.length
    ? fallbackStore.activity_logs
    : allLogs;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const stats = {
    totalLogs: fullCollection.length,
    createCount: fullCollection.filter(l => l.action === 'CREATE').length,
    updateCount: fullCollection.filter(l => l.action === 'UPDATE').length,
    deleteCount: fullCollection.filter(l => l.action === 'DELETE').length,
    todayCount: fullCollection.filter(l => new Date(l.createdAt) >= todayStart).length,
    entityBreakdown: {
      PRODUCT: fullCollection.filter(l => l.entity === 'PRODUCT').length,
      INVENTORY: fullCollection.filter(l => l.entity === 'INVENTORY').length,
      DISCOUNT_RULE: fullCollection.filter(l => l.entity === 'DISCOUNT_RULE').length,
      USER: fullCollection.filter(l => l.entity === 'USER').length,
      ORDER: fullCollection.filter(l => l.entity === 'ORDER').length,
      EMAIL_TEMPLATE: fullCollection.filter(l => l.entity === 'EMAIL_TEMPLATE').length
    }
  };

  // Pagination calculation
  const total = allLogs.length;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Math.min(100, Number(limit)));
  const totalPages = Math.ceil(total / limitNum) || 1;
  const startIndex = (pageNum - 1) * limitNum;
  const paginatedLogs = allLogs.slice(startIndex, startIndex + limitNum).map(l => ({
    id: l._id ? l._id.toString() : l.id,
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    entityName: l.entityName,
    summary: l.summary,
    details: l.details,
    performedBy: l.performedBy,
    ipAddress: l.ipAddress,
    userAgent: l.userAgent,
    createdAt: l.createdAt
  }));

  return {
    logs: paginatedLogs,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages
    },
    stats
  };
}
