import { Request, Response, NextFunction } from 'express';
import { getDB } from './db';
import { verifyToken } from './auth';

export interface VendorRecord {
  id: string;
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  address?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATE';
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
 * Find vendor by ID from MongoDB
 */
export async function findVendorById(id: string): Promise<VendorRecord | null> {
  if (!id) return null;
  const db = getDB();
  let vendor: VendorRecord | null = null;
  if (db) {
    try {
      const doc = await db.collection('vendors').findOne({ id });
      if (doc) vendor = doc as unknown as VendorRecord;
    } catch (e) {}
  }
  if (vendor && !vendor.code) {
    vendor.code = vendor.id ? vendor.id.replace(/^vnd_/, '').slice(0, 6).toUpperCase() : 'VND';
  }
  return vendor;
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
  return (vendors || []).map(v => ({
    ...v,
    code: v.code || (v.id ? v.id.replace(/^vnd_/, '').slice(0, 6).toUpperCase() : 'VND')
  }));
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
      // Default to user's assigned vendorId
      let chosenVendorId = decoded.vendorId || 'vnd_kasirkafe_central';

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
  req.vendorId = 'vnd_kasirkafe_central';
  req.vendor = (await findVendorById('vnd_kasirkafe_central')) || undefined;
  next();
}
