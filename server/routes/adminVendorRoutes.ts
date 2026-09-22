import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { authMiddleware, requireAdmin } from '../auth';
import { getDB, fallbackStore } from '../db';
import {
  VendorRecord,
  findVendorById,
  getAllVendors
} from '../vendorMiddleware';
import { recordActivityLog } from '../activityLogger';
import { IParam } from '@/src/types';

export const adminVendorRouter = Router();

// Strictly guard ALL admin vendor routes: Auth + ADMIN Role
adminVendorRouter.use(authMiddleware, requireAdmin);

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
  } else {
    productCount = fallbackStore.products?.filter(p => (p as any).vendorId === vendorId).length || 0;
    userCount = fallbackStore.users?.filter(u => (u as any).vendorId === vendorId).length || 0;
    const orders = fallbackStore.orders?.filter(o => (o as any).vendorId === vendorId) || [];
    orderCount = orders.length;
    totalRevenue = orders.reduce((sum, o: any) => sum + (Number(o.totalAmount ?? o.total ?? 0)), 0);
  }

  return { productCount, orderCount, userCount, totalRevenue };
}

/**
 * GET /api/admin/vendors
 * List all vendors with enriched statistics, search, and status filter
 */
adminVendorRouter.get('/', async (req: Request, res: Response) => {
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
          v.name.toLowerCase().includes(q) ||
          v.code.toLowerCase().includes(q) ||
          (v.email && v.email.toLowerCase().includes(q)) ||
          v.id.toLowerCase().includes(q)
      );
    }

    // Enrich with stats
    const enriched = await Promise.all(
      filtered.map(async v => {
        const stats = await computeVendorStats(v.id);
        return {
          ...v,
          stats
        };
      })
    );

    // Global summary
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
adminVendorRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, code, email, phone, address, currency, status } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama vendor wajib diisi.' });
    }

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Kode singkatan vendor wajib diisi.' });
    }

    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    if (!cleanCode) {
      return res.status(400).json({ success: false, message: 'Kode vendor tidak valid (harus alfanumerik).' });
    }

    // Check duplicate code
    const existing = await getAllVendors();
    if (existing.some(v => v.code.toUpperCase() === cleanCode)) {
      return res.status(400).json({
        success: false,
        message: `Kode vendor '${cleanCode}' sudah digunakan. Gunakan kode lain.`
      });
    }

    const idSuffix = Date.now().toString(36).slice(-4);
    const newVendorId = `vnd_${cleanCode.toLowerCase()}_${idSuffix}`;

    const newVendor: VendorRecord = {
      id: newVendorId,
      name: name.trim(),
      code: cleanCode,
      status: status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
      email: email ? email.trim() : '',
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
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

    // Keep fallback store in sync
    if (!fallbackStore.vendors) fallbackStore.vendors = [];
    fallbackStore.vendors.push({ ...newVendor });

    // Record activity log
    await recordActivityLog({
      action: 'CREATE',
      entity: 'VENDOR',
      entityId: newVendor.id,
      entityName: newVendor.name,
      summary: `Admin membuat vendor baru '${newVendor.name}' (${newVendor.code})`,
      details: {
        vendorId: newVendor.id,
        code: newVendor.code,
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
 * Update vendor profile
 */
adminVendorRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as IParam;
    const { name, code, email, phone, address, currency, status } = req.body;

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
    if (code && typeof code === 'string' && code.trim()) {
      const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      if (cleanCode && cleanCode !== vendor.code) {
        // Verify unique
        const existing = await getAllVendors();
        if (existing.some(v => v.id !== id && v.code.toUpperCase() === cleanCode)) {
          return res.status(400).json({
            success: false,
            message: `Kode vendor '${cleanCode}' sudah digunakan oleh vendor lain.`
          });
        }
        updates.code = cleanCode;
      }
    }
    if (typeof email === 'string') updates.email = email.trim();
    if (typeof phone === 'string') updates.phone = phone.trim();
    if (typeof address === 'string') updates.address = address.trim();
    if (typeof currency === 'string') updates.currency = currency.trim();
    if (status === 'ACTIVE' || status === 'SUSPENDED') {
      if ((id === 'vnd_sipspot_central' || id === 'vnd_admin') && status === 'SUSPENDED') {
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

    // Update in-memory fallback
    if (fallbackStore.vendors) {
      const idx = fallbackStore.vendors.findIndex(v => v.id === id);
      if (idx !== -1) {
        fallbackStore.vendors[idx] = { ...fallbackStore.vendors[idx], ...updates };
      }
    }

    const updatedVendor = { ...vendor, ...updates };

    await recordActivityLog({
      action: 'UPDATE',
      entity: 'VENDOR',
      entityId: id,
      entityName: updatedVendor.name,
      summary: `Admin memperbarui data profil vendor '${updatedVendor.name}'`,
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
 * Toggle or set vendor status (ACTIVE / SUSPENDED)
 */
adminVendorRouter.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as IParam;
    const { status } = req.body;

    if ((id === 'vnd_sipspot_central' || id === 'vnd_admin') && (status === 'SUSPENDED' || !status)) {
      return res.status(400).json({
        success: false,
        message: 'Vendor Utama / Admin Sistem tidak dapat dinonaktifkan.'
      });
    }

    const vendor = await findVendorById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor tidak ditemukan.' });
    }

    const newStatus: 'ACTIVE' | 'SUSPENDED' =
      status === 'ACTIVE' || status === 'SUSPENDED'
        ? status
        : vendor.status === 'ACTIVE'
        ? 'SUSPENDED'
        : 'ACTIVE';

    const db = getDB();
    if (db) {
      await db.collection('vendors').updateOne({ id }, { $set: { status: newStatus, updatedAt: new Date() } });
    }

    if (fallbackStore.vendors) {
      const found = fallbackStore.vendors.find(v => v.id === id);
      if (found) {
        found.status = newStatus;
        found.updatedAt = new Date();
      }
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
 * Delete a vendor (Protected against central vendor)
 */
adminVendorRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as IParam;

    if (id === 'vnd_sipspot_central' || id === 'vnd_admin') {
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

    if (fallbackStore.vendors) {
      fallbackStore.vendors = fallbackStore.vendors.filter(v => v.id !== id);
    }
    if (fallbackStore.products) {
      fallbackStore.products = fallbackStore.products.filter(p => (p as any).vendorId !== id);
    }
    if (fallbackStore.categories) {
      fallbackStore.categories = fallbackStore.categories.filter(c => (c as any).vendorId !== id);
    }

    await recordActivityLog({
      action: 'DELETE',
      entity: 'VENDOR',
      entityId: id,
      entityName: vendor.name,
      summary: `Admin menghapus vendor '${vendor.name}' (${id})`,
      details: { deletedVendorId: id, vendorCode: vendor.code },
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
