import { Request, Response, NextFunction } from 'express';
import { getDB, fallbackStore } from './db';
import { verifyToken } from './auth';

export interface VendorRecord {
  id: string;
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  address?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  logo?: string;
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

/**
 * Find vendor by ID from MongoDB or fallback in-memory store
 */
export async function findVendorById(id: string): Promise<VendorRecord | null> {
  if (!id) return null;
  const db = getDB();
  if (db) {
    try {
      const doc = await db.collection('vendors').findOne({ id });
      if (doc) return doc as unknown as VendorRecord;
    } catch (e) {}
  }
  const found = fallbackStore.vendors?.find((v: VendorRecord) => v.id === id);
  return found || null;
}

/**
 * Get all vendors
 */
export async function getAllVendors(): Promise<VendorRecord[]> {
  const db = getDB();
  let vendors: VendorRecord[] = [];
  if (db) {
    try {
      vendors = (await db.collection('vendors').find({}).toArray()) as unknown as VendorRecord[];
    } catch (e) {}
  }
  if (!vendors || vendors.length === 0) {
    vendors = (fallbackStore.vendors || []) as VendorRecord[];
  }
  return vendors;
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
    const match = req.headers.cookie.match(/(?:^|;\s*)sipspot_vendor_id=([^;]+)/);
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
      // Default to user's assigned vendorId
      let chosenVendorId = decoded.vendorId || 'vnd_sipspot_central';

      // Admins and Managers can switch active vendor via X-Vendor-Id header or query param
      if ((decoded.role === 'ADMIN' || decoded.role === 'MANAGER') && vendorIdHeader) {
        chosenVendorId = vendorIdHeader.trim();
      }

      req.vendorId = chosenVendorId;
      req.vendor = (await findVendorById(chosenVendorId)) || undefined;
      return next();
    }
  }

  // Case 2: Explicit X-Vendor-Id header from client/POS
  if (vendorIdHeader) {
    const chosenVendorId = vendorIdHeader.trim();
    req.vendorId = chosenVendorId;
    req.vendor = (await findVendorById(chosenVendorId)) || undefined;
    return next();
  }

  // Case 3: Default Primary Vendor Fallback
  req.vendorId = 'vnd_sipspot_central';
  req.vendor = (await findVendorById('vnd_sipspot_central')) || undefined;
  next();
}
