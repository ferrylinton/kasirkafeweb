import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { authMiddleware, requireAdmin } from '../auth';
import { getDB } from '../db';
import {
  VendorRecord,
  findVendorById,
  getAllVendors
} from '../vendorMiddleware';
import { recordActivityLog } from '../activityLogger';
import { revokeAllSessionsForVendor } from './authRoutes';
import { IParam } from '@/src/types';

export const adminVendorRouter = Router();

// Authenticate all routes
adminVendorRouter.use(authMiddleware);

/**
 * Helper to compute stats for a single vendor
 */
async function computeVendorStats(vendorId: string) {
  const db = getDB();
  let productCount = 0;
  let orderCount = 0;
  let userCount = 0;
  let totalRevenue = 0;

  if (db) {
    try {
      productCount = await db.collection('products').countDocuments({ vendorId });
      userCount = await db.collection('users').countDocuments({ vendorId });
      const orders = await db.collection('orders').find({ vendorId }).toArray();
      orderCount = orders.length;
      totalRevenue = orders.reduce((sum, o: any) => sum + (Number(o.totalAmount ?? o.total ?? 0)), 0);
    } catch (e) {
      console.error('[AdminVendor] Error counting stats from MongoDB:', e);
    }
  }

  return { productCount, orderCount, userCount, totalRevenue };
}

/**
 * GET /api/admin/vendors
 * List all vendors with enriched statistics, search, and status filter (Strictly ADMIN only)
 */
adminVendorRouter.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { search, status } = req.query;
    const vendors = await getAllVendors();
    let filtered = vendors;

    if (status && status !== 'ALL') {
      filtered = filtered.filter(v => v.status === status);
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(
        v =>
          (v.name && v.name.toLowerCase().includes(q)) ||
          (v.id && typeof v.id === 'string' && v.id.toLowerCase().includes(q))
      );
    }

    // Enrich with stats
    const enriched = await Promise.all(
      filtered.map(async v => {
        const stats = await computeVendorStats(v.id || '');
        const code = v.code || (v.id && typeof v.id === 'string'
          ? (v.id.startsWith('vnd_') ? v.id.replace(/^vnd_/, '').slice(0, 6).toUpperCase() : v.id.slice(0, 6).toUpperCase())
          : 'VND');
        return {
          ...v,
          id: v.id || (v._id ? v._id.toString() : 'VND'),
          code,
          stats
        };
      })
    );

    // Summary calculation (scoped to current view)
    const totalVendors = vendors.length;
    const activeVendors = vendors.filter(v => v.status === 'ACTIVE').length;
    const suspendedVendors = vendors.filter(v => v.status === 'SUSPENDED').length;

    return res.json({
      success: true,
      summary: {
        totalVendors,
        activeVendors,
        suspendedVendors
      },
      vendors: enriched
    });
  } catch (err: any) {
    console.error('[AdminVendor] GET / error:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

/**
 * POST /api/admin/vendors
 * Create a new vendor (Admin only)
 */
adminVendorRouter.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, currency, status } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama vendor wajib diisi.' });
    }

    const cleanName = name.trim();
    const idSuffix = Date.now().toString(36).slice(-4);
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'vnd';
    const newVendorId = `vnd_${slug}_${idSuffix}`;

    const newVendor: VendorRecord = {
      id: newVendorId,
      name: cleanName,
      status: status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
      currency: currency ? currency.trim() : 'IDR',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const db = getDB();
    if (db) {
      await db.collection('vendors').insertOne({ ...newVendor });
      // Initialize default categories for the new vendor so staff can immediately add menu items
      const initialCategories = [
        { code: 'kopi', name: 'Kopi', icon: '☕', description: 'Menu racikan kopi khas vendor', vendorId: newVendorId },
        { code: 'teh', name: 'Teh', icon: '🍵', description: 'Artisan teh segar dan seduhan', vendorId: newVendorId },
        { code: 'jus', name: 'Jus & Segar', icon: '🍹', description: 'Minuman buah dan sparkling segar', vendorId: newVendorId },
        { code: 'cemilan', name: 'Cemilan', icon: '🥐', description: 'Pastry, snack, dan makanan pendamping', vendorId: newVendorId }
      ];
      await db.collection('categories').insertMany(initialCategories);
    }

    // Record activity log
    await recordActivityLog({
      action: 'CREATE',
      entity: 'VENDOR',
      entityId: newVendor.id,
      entityName: newVendor.name,
      summary: `Admin membuat vendor baru '${newVendor.name}'`,
      details: {
        vendorId: newVendor.id,
        status: newVendor.status
      },
      req,
      vendorId: newVendor.id
    });

    return res.status(201).json({
      success: true,
      message: `Vendor '${newVendor.name}' berhasil didaftarkan.`,
      vendor: newVendor
    });
  } catch (err: any) {
    console.error('[AdminVendor] POST / error:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

/**
 * PUT /api/admin/vendors/:id
 * Update vendor profile (Strictly ADMIN only)
 */
adminVendorRouter.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as IParam;
    const userRole = (req as any).user?.role || 'ADMIN';
    const { name, currency, status } = req.body;

    const vendor = await findVendorById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor tidak ditemukan.' });
    }

    const updates: Partial<VendorRecord> = {
      updatedAt: new Date()
    };

    if (name && typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }
    if (typeof currency === 'string') updates.currency = currency.trim();
    
    // Only ADMIN can change vendor operational status (ACTIVE/SUSPENDED)
    if (userRole === 'ADMIN' && (status === 'ACTIVE' || status === 'SUSPENDED')) {
      if ((id === 'vnd_kasirkafe_central' || id === 'vnd_admin') && status === 'SUSPENDED') {
        return res.status(400).json({
          success: false,
          message: 'Vendor Utama / Admin Sistem tidak dapat disuspend.'
        });
      }
      updates.status = status;
    }

    const db = getDB();
    if (db) {
      await db.collection('vendors').updateOne({ id }, { $set: updates });
    }

    const updatedVendor = { ...vendor, ...updates };

    await recordActivityLog({
      action: 'UPDATE',
      entity: 'VENDOR',
      entityId: id,
      entityName: updatedVendor.name,
      summary: `${userRole} memperbarui data profil vendor '${updatedVendor.name}'`,
      details: updates,
      req,
      vendorId: id
    });

    return res.json({
      success: true,
      message: `Vendor '${updatedVendor.name}' berhasil diperbarui.`,
      vendor: updatedVendor
    });
  } catch (err: any) {
    console.error('[AdminVendor] PUT /:id error:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

/**
 * PATCH /api/admin/vendors/:id/status
 * Toggle or set vendor status (ACTIVE / SUSPENDED) - Strictly ADMIN Only
 */
adminVendorRouter.patch('/:id/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as IParam;
    const { status } = req.body;

    if ((id === 'vnd_kasirkafe_central' || id === 'vnd_admin') && (status === 'SUSPENDED' || !status)) {
      return res.status(400).json({
        success: false,
        message: 'Vendor Utama / Admin Sistem tidak dapat dinonaktifkan.'
      });
    }

    const vendor = await findVendorById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor tidak ditemukan.' });
    }

    const newStatus: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATE' =
      status === 'ACTIVE' || status === 'SUSPENDED' || status === 'DEACTIVATE'
        ? status
        : vendor.status === 'ACTIVE'
        ? 'SUSPENDED'
        : 'ACTIVE';

    const db = getDB();
    if (db) {
      await db.collection('vendors').updateOne({ id }, { $set: { status: newStatus, updatedAt: new Date() } });
    }

    // If deactivated, revoke all active sessions for this vendor
    if (newStatus === 'DEACTIVATE') {
      await revokeAllSessionsForVendor(id, 'Vendor dinonaktifkan oleh Admin');
    }

    await recordActivityLog({
      action: 'UPDATE',
      entity: 'VENDOR',
      entityId: id,
      entityName: vendor.name,
      summary: `Admin mengubah status vendor '${vendor.name}' menjadi ${newStatus}`,
      details: { previousStatus: vendor.status, newStatus },
      req,
      vendorId: id
    });

    return res.json({
      success: true,
      message: `Status vendor '${vendor.name}' berhasil diubah menjadi ${newStatus}.`,
      status: newStatus
    });
  } catch (err: any) {
    console.error('[AdminVendor] PATCH /:id/status error:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

/**
 * DELETE /api/admin/vendors/:id
 * Delete a vendor (Strictly ADMIN Only)
 */
adminVendorRouter.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as IParam;

    if (id === 'vnd_kasirkafe_central' || id === 'vnd_admin') {
      return res.status(400).json({
        success: false,
        message: 'Vendor Utama / Admin Sistem tidak dapat dihapus.'
      });
    }

    const vendor = await findVendorById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor tidak ditemukan.' });
    }

    const db = getDB();
    if (db) {
      await db.collection('vendors').deleteOne({ id });
      // Optional: clean up products and categories for this vendor
      await db.collection('products').deleteMany({ vendorId: id });
      await db.collection('categories').deleteMany({ vendorId: id });
    }

    await recordActivityLog({
      action: 'DELETE',
      entity: 'VENDOR',
      entityId: id,
      entityName: vendor.name,
      summary: `Admin menghapus vendor '${vendor.name}' (${id})`,
      details: { deletedVendorId: id },
      req,
      vendorId: id
    });

    return res.json({
      success: true,
      message: `Vendor '${vendor.name}' dan seluruh katalognya berhasil dihapus.`
    });
  } catch (err: any) {
    console.error('[AdminVendor] DELETE /:id error:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});
