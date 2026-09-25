import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from './db';
import { verifyToken } from './auth';

export interface VendorRecord {
  id: string;
  name: string;
  address?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATE';
  currency?: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

// Extend Express Request to guarantee vendorId and vendor object are typed
declare global {
  namespace Express {
    interface Request {
      vendorId?: string;
      vendor?: VendorRecord;
    }
  }
}

export const CENTRAL_VENDOR_ID = '6ab58389b2a71518d2beb887';
export const ADMIN_VENDOR_ID = '6ab58389b2a71518d2beb886';

const LEGACY_VENDOR_MAP: Record<string, string> = {
  vnd_admin: '6ab58389b2a71518d2beb886',
  vnd_kasirkafe_central: '6ab58389b2a71518d2beb887',
  vnd_kopi_kulo_kemang: '6ab58389b2a71518d2beb888',
  vnd_tehpoci_nusantara: '6ab58389b2a71518d2beb889'
};

/**
 * Resolves legacy or modern vendor IDs to standard ObjectId hex string
 */
export function resolveVendorId(id?: string): string {
  if (!id) return CENTRAL_VENDOR_ID;
  const trimmed = id.trim();
  return LEGACY_VENDOR_MAP[trimmed] || trimmed;
}

/**
 * Maps raw MongoDB vendor document (which uses _id as ObjectId) to Node.js VendorRecord (using id)
 * and strips any legacy code field.
 */
export function mapVendorDoc(doc: any): VendorRecord {
  const { _id, ...rest } = doc;
  delete rest.code;
  delete rest.id;
  return {
    id: _id ? _id.toString() : (doc.id || ''),
    name: rest.name || '',
    address: rest.address,
    status: rest.status || 'ACTIVE',
    currency: rest.currency || 'IDR',
    createdAt: rest.createdAt || new Date(),
    updatedAt: rest.updatedAt
  };
}

/**
 * Find vendor by ID from MongoDB table using _id (ObjectId)
 */
export async function findVendorById(id: string): Promise<VendorRecord | null> {
  if (!id) return null;
  const db = getDB();
  if (!db) return null;

  try {
    const resolvedId = resolveVendorId(id);
    let query: any = {};
    if (ObjectId.isValid(resolvedId) && resolvedId.length === 24) {
      query = { $or: [{ _id: new ObjectId(resolvedId) }, { id: resolvedId }] };
    } else {
      query = { $or: [{ id: resolvedId }, { _id: resolvedId }] };
    }

    const doc = await db.collection('vendors').findOne(query);
    if (doc) {
      return mapVendorDoc(doc);
    }
  } catch (e) {
    console.error('[findVendorById] Error querying vendor:', e);
  }
  return null;
}

/**
 * Get all vendors from MongoDB table
 */
export async function getAllVendors(): Promise<VendorRecord[]> {
  const db = getDB();
  if (!db) return [];

  try {
    const rawDocs = await db.collection('vendors').find({}).toArray();
    return rawDocs.map(mapVendorDoc);
  } catch (e) {
    console.error('[getAllVendors] Error retrieving vendors:', e);
    return [];
  }
}

/**
 * Vendor Isolation Middleware
 * Resolves the active vendor for every incoming request:
 * 1. If Bearer Token is provided: extracts user's assigned vendorId (or respects manager vendor switch).
 * 2. If X-Vendor-Id header/cookie/query is provided: selects that vendor.
 * 3. Ensures req.vendorId and req.vendor are ALWAYS defined and isolated.
 */
export async function vendorMiddleware(req: Request, res: Response, next: NextFunction) {
  let cookieVendorId: string | undefined;
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)kasirkafe_vendor_id=([^;]+)/);
    if (match) {
      try {
        cookieVendorId = decodeURIComponent(match[1].trim());
      } catch {
        cookieVendorId = match[1].trim();
      }
    }
  }

  const vendorIdHeader = (req.headers['x-vendor-id'] as string) || 
    cookieVendorId ||
    (req.query.vendorId as string) || 
    (req.body && typeof req.body.vendorId === 'string' ? req.body.vendorId : undefined);

  // Case 1: User JWT Token Bearer (Logged in Cashier / Manager / Admin)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
      let chosenVendorId = resolveVendorId(decoded.vendorId || CENTRAL_VENDOR_ID);

      // Only Admins can switch active vendor via X-Vendor-Id header or query param.
      // Managers and Cashiers are strictly isolated to their own vendorId.
      if (decoded.role === 'ADMIN' && vendorIdHeader) {
        chosenVendorId = resolveVendorId(vendorIdHeader.trim());
      }

      req.vendorId = chosenVendorId;
      req.vendor = (await findVendorById(chosenVendorId)) || undefined;
      return next();
    }
  }

  // Case 2: Explicit X-Vendor-Id header from client/POS
  if (vendorIdHeader) {
    const chosenVendorId = resolveVendorId(vendorIdHeader.trim());
    req.vendorId = chosenVendorId;
    req.vendor = (await findVendorById(chosenVendorId)) || undefined;
    return next();
  }

  // Case 3: Default Primary Vendor Fallback
  req.vendorId = CENTRAL_VENDOR_ID;
  req.vendor = (await findVendorById(CENTRAL_VENDOR_ID)) || undefined;
  next();
}
