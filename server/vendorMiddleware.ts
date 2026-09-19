import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getDB, fallbackStore } from './db';
import { verifyToken } from './auth';

export interface VendorRecord {
  id: string;
  name: string;
  code: string;
  clientId: string;
  clientSecret: string;
  status: 'ACTIVE' | 'SUSPENDED';
  email?: string;
  phone?: string;
  address?: string;
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
      isClientCredentialsAuth?: boolean;
    }
  }
}

/**
 * Generate a random, cryptographically secure Client ID
 */
export function generateClientId(prefix: string = 'client'): string {
  const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  const randomHex = crypto.randomBytes(8).toString('hex');
  return `${cleanPrefix}_${randomHex}`;
}

/**
 * Generate a random, cryptographically secure Client Secret
 */
export function generateClientSecret(prefix: string = 'sec'): string {
  const randomHex = crypto.randomBytes(24).toString('hex');
  return `${prefix}_${randomHex}`;
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
 * Find vendor by Client ID from MongoDB or fallback in-memory store
 */
export async function findVendorByClientId(clientId: string): Promise<VendorRecord | null> {
  if (!clientId) return null;
  const db = getDB();
  if (db) {
    try {
      const doc = await db.collection('vendors').findOne({ clientId });
      if (doc) return doc as unknown as VendorRecord;
    } catch (e) {}
  }
  const found = fallbackStore.vendors?.find((v: VendorRecord) => v.clientId === clientId);
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
 * Resolves the active vendor for every incoming request and strictly guarantees:
 * 1. If X-Client-Id and X-Client-Secret are provided: Authenticates the vendor credentials.
 *    - Invalid secret => 401 Unauthorized (immediately rejected).
 *    - Suspended vendor => 403 Forbidden.
 * 2. If Bearer Token is provided: extracts user's assigned vendorId (or respects manager vendor switch).
 * 3. If X-Vendor-Id header is provided: selects that vendor (with fallback to default).
 * 4. Ensures req.vendorId is ALWAYS defined and isolated.
 */
export async function vendorMiddleware(req: Request, res: Response, next: NextFunction) {
  const clientIdHeader = req.headers['x-client-id'] as string | undefined;
  const clientSecretHeader = req.headers['x-client-secret'] as string | undefined;
  const vendorIdHeader = req.headers['x-vendor-id'] as string | undefined;

  // Case 1: Client ID & Client Secret Authentication (M2M / API Vendor Integration)
  if (clientIdHeader) {
    const vendor = await findVendorByClientId(clientIdHeader.trim());
    if (!vendor) {
      return res.status(401).json({
        success: false,
        error: 'InvalidClientId',
        message: `Client ID '${clientIdHeader}' tidak terdaftar pada sistem.`
      });
    }

    if (vendor.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: 'VendorSuspended',
        message: `Vendor '${vendor.name}' berstatus nonaktif (SUSPENDED). Akses ditolak.`
      });
    }

    // Check Client Secret if provided
    if (clientSecretHeader) {
      if (vendor.clientSecret !== clientSecretHeader.trim()) {
        return res.status(401).json({
          success: false,
          error: 'InvalidClientSecret',
          message: 'Client Secret tidak cocok. Akses data vendor ditolak.'
        });
      }
    }

    req.vendor = vendor;
    req.vendorId = vendor.id;
    req.isClientCredentialsAuth = !!clientSecretHeader;
    return next();
  }

  // Case 2: User JWT Token Bearer (Logged in Cashier / Manager)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
      // Default to user's assigned vendorId
      let chosenVendorId = decoded.vendorId || 'vnd_sipspot_central';

      // Managers & Superadmins can switch active vendor via X-Vendor-Id header or query param
      if ((decoded.role === 'MANAGER' || (decoded as any).role === 'SUPERADMIN') && vendorIdHeader) {
        chosenVendorId = vendorIdHeader.trim();
      }

      req.vendorId = chosenVendorId;
      return next();
    }
  }

  // Case 3: Explicit X-Vendor-Id header from client/POS
  if (vendorIdHeader) {
    req.vendorId = vendorIdHeader.trim();
    return next();
  }

  // Case 4: Default Primary Vendor Fallback
  req.vendorId = 'vnd_sipspot_central';
  next();
}

/**
 * Strict Guard for API endpoints that REQUIRE Client ID and Client Secret
 */
export function requireClientCredentials(req: Request, res: Response, next: NextFunction) {
  const clientId = req.headers['x-client-id'] as string;
  const clientSecret = req.headers['x-client-secret'] as string;

  if (!clientId || !clientSecret) {
    return res.status(401).json({
      success: false,
      error: 'MissingClientCredentials',
      message: 'Header X-Client-Id dan X-Client-Secret wajib disertakan untuk mengakses endpoint ini.'
    });
  }

  if (!req.vendor || req.vendor.clientSecret !== clientSecret.trim()) {
    return res.status(401).json({
      success: false,
      error: 'InvalidClientCredentials',
      message: 'Kombinasi Client ID dan Client Secret tidak valid.'
    });
  }

  next();
}
