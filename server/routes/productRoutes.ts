import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB, fallbackStore } from '../db';
import { authMiddleware, requireManager } from '../auth';
import { ObjectId } from 'mongodb';
import { recordActivityLog } from '../activityLogger';

export const productRouter = Router();

const productSchema = z.object({
  name: z.string().min(2, 'Nama produk minimal 2 karakter'),
  category: z.string().min(1, 'Kategori wajib dipilih'),
  subCategory: z.string().optional(),
  price: z.number().min(0, 'Harga tidak boleh negatif'),
  stock: z.number().int().min(0, 'Stok minimal 0'),
  lowStockThreshold: z.number().int().min(0).default(10),
  description: z.string().optional(),
  tag: z.string().optional(),
  image: z.string().url('URL gambar tidak valid').or(z.literal('')).optional(),
  isAvailable: z.boolean().default(true)
});

/**
 * GET /api/products/categories
 * Returns categories strictly partitioned by active vendor
 */
productRouter.get('/categories', async (req: Request, res: Response) => {
  try {
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_sipspot_central';
    const isSuperAdmin = (req as any).user?.role === 'SUPERADMIN';
    const db = getDB();
    let categories: any[] = [];

    if (db) {
      try {
        const query = isSuperAdmin
          ? {}
          : (activeVendorId === 'vnd_sipspot_central'
              ? { $or: [{ vendorId: 'vnd_sipspot_central' }, { vendorId: { $exists: false } }, { vendorId: null }] }
              : { vendorId: activeVendorId });
        categories = await db.collection('categories').find(query).toArray();
      } catch (e) {}
    }

    if (categories.length === 0) {
      const source = fallbackStore.categories || [];
      categories = isSuperAdmin
        ? source
        : source.filter(c => (c.vendorId || 'vnd_sipspot_central') === activeVendorId);
      
      // If vendor doesn't have custom categories yet, fallback to all default categories
      if (categories.length === 0) {
        categories = source.filter(c => !c.vendorId || c.vendorId === 'vnd_sipspot_central');
      }
    }

    return res.json({
      success: true,
      vendorId: activeVendorId,
      categories: categories.map(c => ({
        id: c._id ? c._id.toString() : c.code,
        vendorId: c.vendorId || activeVendorId,
        code: c.code,
        name: c.name,
        icon: c.icon,
        description: c.description
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * POST /api/products/categories
 * Add category for the active vendor (Manager only)
 */
const categorySchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  icon: z.string().default('🏷️'),
  description: z.string().optional()
});

productRouter.post('/categories', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Data kategori tidak valid' });
    }

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_sipspot_central';
    const formattedCode = parsed.data.code.trim().toLowerCase().replace(/\s+/g, '_');

    const newCategory = {
      ...parsed.data,
      code: formattedCode,
      vendorId: activeVendorId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const db = getDB();
    let insertedId = `cat_${Date.now()}`;

    if (db) {
      try {
        const result = await db.collection('categories').insertOne(newCategory);
        insertedId = result.insertedId.toString();
      } catch (e) {}
    }

    fallbackStore.categories.push({ ...newCategory, _id: insertedId });

    await recordActivityLog({
      action: 'CREATE',
      entity: 'CATEGORY',
      entityId: insertedId,
      entityName: newCategory.name,
      summary: `Menambahkan kategori baru '${newCategory.name}' [${newCategory.code}] untuk vendor`,
      details: newCategory,
      req
    });

    return res.status(201).json({
      success: true,
      category: { id: insertedId, ...newCategory },
      message: 'Kategori berhasil ditambahkan!'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * GET /api/products
 * Public / Authenticated catalog with query params: ?category=kopi&search=latte
 */
productRouter.get('/', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;

    const isAdmin = (req as any).user?.role === 'ADMIN' || (req as any).user?.role === 'SUPERADMIN';
    const isAllVendors = (req.query.allVendors === 'true' || req.query.vendorId === 'all') && isAdmin;
    const requestedVendor = (req.query.vendorId as string) || '';
    const activeVendorId = req.vendorId || 'vnd_sipspot_central';
    const db = getDB();
    let products: any[] = [];

    if (db) {
      try {
        const filter: any = {};
        if (isAllVendors) {
          // No vendor restriction across all vendors
        } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
          filter.vendorId = requestedVendor === 'vnd_sipspot_central'
            ? { $or: [{ vendorId: 'vnd_sipspot_central' }, { vendorId: { $exists: false } }, { vendorId: null }] }
            : requestedVendor;
        } else if (activeVendorId === 'vnd_sipspot_central') {
          filter.$or = [{ vendorId: 'vnd_sipspot_central' }, { vendorId: { $exists: false } }, { vendorId: null }];
        } else {
          filter.vendorId = activeVendorId;
        }

        if (category && category !== 'all') {
          filter.category = category.toLowerCase();
        }
        if (search) {
          filter.name = { $regex: search, $options: 'i' };
        }
        products = await db.collection('products').find(filter).toArray();
      } catch (e) {}
    }

    if (products.length === 0) {
      products = fallbackStore.products.filter(p => {
        const pVendor = p.vendorId || 'vnd_sipspot_central';
        let matchVendor = true;
        if (isAllVendors) {
          matchVendor = true;
        } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
          matchVendor = pVendor === requestedVendor;
        } else {
          matchVendor = pVendor === activeVendorId;
        }
        const matchCategory = !category || category === 'all' || p.category.toLowerCase() === category.toLowerCase();
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
        return matchVendor && matchCategory && matchSearch;
      });
    }

    return res.json({
      success: true,
      vendorId: isAllVendors ? 'all' : (requestedVendor || activeVendorId),
      isAllVendors,
      products: products.map(p => ({
        id: p._id ? p._id.toString() : p.id,
        vendorId: p.vendorId || 'vnd_sipspot_central',
        name: p.name,
        category: p.category,
        subCategory: p.subCategory,
        price: p.price,
        stock: p.stock,
        lowStockThreshold: typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 10,
        description: p.description,
        tag: p.tag,
        image: p.image,
        isAvailable: p.isAvailable !== false
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * GET /api/products/inventory/alerts
 * Summary statistics and low-stock products below configurable threshold
 */
productRouter.get('/inventory/alerts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const isAdmin = (req as any).user?.role === 'ADMIN' || (req as any).user?.role === 'SUPERADMIN';
    const isAllVendors = (req.query.allVendors === 'true' || req.query.vendorId === 'all') && isAdmin;
    const requestedVendor = (req.query.vendorId as string) || '';
    const activeVendorId = req.vendorId || 'vnd_sipspot_central';

    const db = getDB();
    let products: any[] = [];
    if (db) {
      try {
        let query: any = {};
        if (isAllVendors) {
          query = {};
        } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
          query = requestedVendor === 'vnd_sipspot_central'
            ? { $or: [{ vendorId: 'vnd_sipspot_central' }, { vendorId: { $exists: false } }, { vendorId: null }] }
            : { vendorId: requestedVendor };
        } else {
          query = activeVendorId === 'vnd_sipspot_central'
            ? { $or: [{ vendorId: 'vnd_sipspot_central' }, { vendorId: { $exists: false } }, { vendorId: null }] }
            : { vendorId: activeVendorId };
        }
        products = await db.collection('products').find(query).toArray();
      } catch (e) {}
    }
    if (products.length === 0) {
      if (isAllVendors) {
        products = fallbackStore.products;
      } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
        products = fallbackStore.products.filter(p => (p.vendorId || 'vnd_sipspot_central') === requestedVendor);
      } else {
        products = fallbackStore.products.filter(p => (p.vendorId || 'vnd_sipspot_central') === activeVendorId);
      }
    }

    const mapped = products.map(p => {
      const threshold = typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 10;
      const stock = typeof p.stock === 'number' ? p.stock : 0;
      const isOutOfStock = stock === 0;
      const isLowStock = stock > 0 && stock <= threshold;
      return {
        id: p._id ? p._id.toString() : p.id,
        vendorId: p.vendorId || 'vnd_sipspot_central',
        name: p.name,
        category: p.category,
        subCategory: p.subCategory,
        price: p.price,
        stock,
        lowStockThreshold: threshold,
        description: p.description,
        tag: p.tag,
        image: p.image,
        isAvailable: p.isAvailable !== false,
        isLowStock,
        isOutOfStock
      };
    });

    const healthyCount = mapped.filter(p => p.stock > p.lowStockThreshold).length;
    const lowStockCount = mapped.filter(p => p.isLowStock).length;
    const outOfStockCount = mapped.filter(p => p.isOutOfStock).length;
    const totalStockUnits = mapped.reduce((sum, p) => sum + p.stock, 0);
    const totalStockValue = mapped.reduce((sum, p) => sum + (p.stock * p.price), 0);

    const alerts = mapped
      .filter(p => p.stock <= p.lowStockThreshold)
      .sort((a, b) => a.stock - b.stock);

    return res.json({
      success: true,
      vendorId: isAllVendors ? 'all' : (requestedVendor || activeVendorId),
      isAllVendors,
      summary: {
        totalProducts: mapped.length,
        healthyCount,
        lowStockCount,
        outOfStockCount,
        totalStockUnits,
        totalStockValue,
        defaultThreshold: 10,
        alerts
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * GET /api/products/inventory/logs
 * Audit history of stock restocks and adjustments partitioned by vendor
 */
productRouter.get('/inventory/logs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const isAdmin = (req as any).user?.role === 'ADMIN' || (req as any).user?.role === 'SUPERADMIN';
    const isAllVendors = (req.query.allVendors === 'true' || req.query.vendorId === 'all') && isAdmin;
    const requestedVendor = (req.query.vendorId as string) || '';
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_sipspot_central';
    const db = getDB();
    let logs: any[] = [];

    if (db) {
      try {
        let query: any = {};
        if (isAllVendors) {
          query = {};
        } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
          query = requestedVendor === 'vnd_sipspot_central'
            ? { $or: [{ vendorId: 'vnd_sipspot_central' }, { vendorId: { $exists: false } }, { vendorId: null }] }
            : { vendorId: requestedVendor };
        } else {
          query = activeVendorId === 'vnd_sipspot_central'
            ? { $or: [{ vendorId: 'vnd_sipspot_central' }, { vendorId: { $exists: false } }, { vendorId: null }] }
            : { vendorId: activeVendorId };
        }
        logs = await db.collection('inventory_logs').find(query).sort({ createdAt: -1 }).limit(200).toArray();
      } catch (e) {}
    }
    if (logs.length === 0) {
      const source = fallbackStore.inventory_logs || [];
      if (isAllVendors) {
        logs = source;
      } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
        logs = source.filter(l => (l.vendorId || 'vnd_sipspot_central') === requestedVendor);
      } else {
        logs = source.filter(l => (l.vendorId || 'vnd_sipspot_central') === activeVendorId);
      }
    }

    return res.json({
      success: true,
      vendorId: isAllVendors ? 'all' : (requestedVendor || activeVendorId),
      isAllVendors,
      logs: logs.map(l => ({
        id: l._id ? l._id.toString() : l.id,
        vendorId: l.vendorId || 'vnd_sipspot_central',
        productId: l.productId,
        productName: l.productName,
        previousStock: l.previousStock,
        newStock: l.newStock,
        change: l.change,
        type: l.type,
        reason: l.reason,
        performedBy: l.performedBy,
        createdAt: l.createdAt
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * POST /api/products/inventory/bulk-threshold
 * Configure threshold globally or by category for active vendor
 */
productRouter.post('/inventory/bulk-threshold', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const { threshold, category } = req.body;
    const thresholdNum = Number(threshold);
    if (isNaN(thresholdNum) || thresholdNum < 0) {
      return res.status(400).json({ success: false, error: 'Batas threshold harus berupa angka positif' });
    }

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_sipspot_central';
    const db = getDB();
    const filter: any = {
      $or: [
        { vendorId: activeVendorId },
        ...(activeVendorId === 'vnd_sipspot_central' ? [{ vendorId: { $exists: false } }, { vendorId: null }] : [])
      ]
    };
    if (category && category !== 'all') {
      filter.category = category.toLowerCase();
    }

    if (db) {
      try {
        await db.collection('products').updateMany(filter, {
          $set: { lowStockThreshold: thresholdNum, updatedAt: new Date() }
        });
      } catch (e) {}
    }

    fallbackStore.products.forEach(p => {
      const pVendor = p.vendorId || 'vnd_sipspot_central';
      if (pVendor === activeVendorId) {
        if (!category || category === 'all' || p.category?.toLowerCase() === category.toLowerCase()) {
          p.lowStockThreshold = thresholdNum;
          p.updatedAt = new Date();
        }
      }
    });

    const logDoc = {
      vendorId: activeVendorId,
      productId: 'BULK',
      productName: category && category !== 'all' ? `Kategori: ${category.toUpperCase()}` : 'Semua Produk',
      previousStock: 0,
      newStock: 0,
      change: 0,
      type: 'THRESHOLD_UPDATE',
      reason: `Konfigurasi batas peringatan stok diatur ke ${thresholdNum} untuk ${category && category !== 'all' ? `kategori ${category}` : 'seluruh produk'}`,
      performedBy: {
        id: req.user?.userId || '',
        name: req.user?.name || 'Manager',
        role: req.user?.role || 'MANAGER'
      },
      createdAt: new Date()
    };

    if (db) {
      try {
        await db.collection('inventory_logs').insertOne(logDoc);
      } catch (e) {}
    }
    fallbackStore.inventory_logs.unshift({ id: new ObjectId().toString(), ...logDoc });

    // Record system-wide activity log
    await recordActivityLog({
      action: 'UPDATE',
      entity: 'INVENTORY',
      entityId: 'BULK',
      entityName: category && category !== 'all' ? `Kategori ${category}` : 'Semua Produk',
      summary: `Mengatur batas peringatan stok menjadi ${thresholdNum} untuk ${category && category !== 'all' ? `kategori ${category}` : 'seluruh produk'}`,
      details: { threshold: thresholdNum, category: category || 'all', vendorId: activeVendorId },
      req
    });

    return res.json({
      success: true,
      message: `Batas peringatan stok berhasil diubah ke ${thresholdNum}!`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * POST /api/products/inventory/import-csv
 * Bulk import CSV to update prices & stock or add new products (Manager only)
 */
productRouter.post('/inventory/import-csv', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const { items, stockMode = 'set' } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Data baris CSV tidak boleh kosong' });
    }

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_sipspot_central';
    const isSuperAdmin = (req as any).user?.role === 'SUPERADMIN';
    const db = getDB();
    let currentProducts: any[] = [];
    if (db) {
      try {
        const query = isSuperAdmin
          ? {}
          : (activeVendorId === 'vnd_sipspot_central'
              ? { $or: [{ vendorId: 'vnd_sipspot_central' }, { vendorId: { $exists: false } }, { vendorId: null }] }
              : { vendorId: activeVendorId });
        currentProducts = await db.collection('products').find(query).toArray();
      } catch (e) {}
    }
    if (currentProducts.length === 0) {
      const source = fallbackStore.products || [];
      currentProducts = isSuperAdmin
        ? [...source]
        : source.filter(p => (p.vendorId || 'vnd_sipspot_central') === activeVendorId);
    }

    let updatedCount = 0;
    let createdCount = 0;
    const inventoryLogs: any[] = [];

    for (const item of items) {
      const rawName = String(item.name || '').trim();
      if (!rawName) continue;

      const itemId = item.id ? String(item.id).trim() : null;
      // Match existing by ID or case-insensitive Name within active vendor's catalog
      const existing = currentProducts.find(p => {
        if (itemId) {
          const pId = p._id ? p._id.toString() : String(p.id);
          if (pId === itemId) return true;
        }
        return (p.name || '').toLowerCase().trim() === rawName.toLowerCase();
      });

      if (existing) {
        // UPDATE existing product
        const prevStock = typeof existing.stock === 'number' ? existing.stock : 0;
        const prevPrice = typeof existing.price === 'number' ? existing.price : 0;
        const updateFields: any = { updatedAt: new Date() };

        // Price update
        if (item.price !== undefined && item.price !== null && !isNaN(Number(item.price))) {
          const newPrice = Math.max(0, Math.round(Number(item.price)));
          updateFields.price = newPrice;
          existing.price = newPrice;
        }

        // Stock update
        let stockChange = 0;
        if (item.stock !== undefined && item.stock !== null && !isNaN(Number(item.stock))) {
          const parsedStock = Math.floor(Number(item.stock));
          let newStock = prevStock;
          if (stockMode === 'add') {
            newStock = Math.max(0, prevStock + parsedStock);
          } else {
            newStock = Math.max(0, parsedStock);
          }
          stockChange = newStock - prevStock;
          updateFields.stock = newStock;
          existing.stock = newStock;
        }

        // Low stock threshold
        if (item.lowStockThreshold !== undefined && item.lowStockThreshold !== null && !isNaN(Number(item.lowStockThreshold))) {
          const newThresh = Math.max(0, Math.floor(Number(item.lowStockThreshold)));
          updateFields.lowStockThreshold = newThresh;
          existing.lowStockThreshold = newThresh;
        }

        // Category
        if (item.category && typeof item.category === 'string' && item.category.trim() !== '') {
          const newCat = item.category.trim().toLowerCase();
          updateFields.category = newCat;
          existing.category = newCat;
        }

        // Subcategory
        if (item.subCategory && typeof item.subCategory === 'string' && item.subCategory.trim() !== '') {
          updateFields.subCategory = item.subCategory.trim();
          existing.subCategory = item.subCategory.trim();
        }

        // Description
        if (item.description && typeof item.description === 'string') {
          updateFields.description = item.description.trim();
          existing.description = item.description.trim();
        }

        const existingId = existing._id ? existing._id.toString() : existing.id;
        if (db) {
          try {
            const query: any = ObjectId.isValid(existingId) ? { _id: new ObjectId(existingId) } : { _id: existingId };
            await db.collection('products').updateOne(query, { $set: updateFields });
          } catch (e) {}
        }

        const fbIdx = fallbackStore.products.findIndex(p => (p._id && p._id.toString() === existingId) || p.id === existingId);
        if (fbIdx !== -1) {
          fallbackStore.products[fbIdx] = { ...fallbackStore.products[fbIdx], ...updateFields };
        }

        // Audit log if stock changed or price changed
        const priceChanged = updateFields.price !== undefined && updateFields.price !== prevPrice;
        if (stockChange !== 0 || priceChanged) {
          const reasons: string[] = [];
          if (stockChange !== 0) {
            reasons.push(stockChange > 0 ? `Restock CSV +${stockChange}` : `Penyesuaian stok CSV ${stockChange}`);
          }
          if (priceChanged) {
            reasons.push(`Harga Rp ${prevPrice.toLocaleString('id-ID')} -> Rp ${updateFields.price.toLocaleString('id-ID')}`);
          }

          const logDoc = {
            vendorId: existing.vendorId || activeVendorId,
            productId: existingId,
            productName: existing.name,
            previousStock: prevStock,
            newStock: updateFields.stock ?? prevStock,
            change: stockChange,
            type: 'CSV_IMPORT',
            reason: reasons.join(' • '),
            performedBy: {
              id: req.user?.userId || '',
              name: req.user?.name || 'Manager',
              role: req.user?.role || 'MANAGER'
            },
            createdAt: new Date()
          };
          inventoryLogs.push(logDoc);
        }

        updatedCount++;
      } else {
        // CREATE new product
        const newStock = item.stock !== undefined && !isNaN(Number(item.stock)) ? Math.max(0, Math.floor(Number(item.stock))) : 0;
        const newPrice = item.price !== undefined && !isNaN(Number(item.price)) ? Math.max(0, Math.round(Number(item.price))) : 0;
        const newThreshold = item.lowStockThreshold !== undefined && !isNaN(Number(item.lowStockThreshold)) ? Math.max(0, Math.floor(Number(item.lowStockThreshold))) : 10;
        const newCat = (item.category && String(item.category).trim().toLowerCase()) || 'kopi';
        const newSubCat = item.subCategory ? String(item.subCategory).trim() : 'Katalog Baru';
        const newDesc = item.description ? String(item.description).trim() : '';
        const newImg = item.image ? String(item.image).trim() : '';

        const newDoc: any = {
          vendorId: activeVendorId,
          name: rawName,
          category: newCat,
          subCategory: newSubCat,
          price: newPrice,
          stock: newStock,
          lowStockThreshold: newThreshold,
          description: newDesc,
          image: newImg,
          isAvailable: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        let insertedId = new ObjectId().toString();
        if (db) {
          try {
            const resInsert = await db.collection('products').insertOne(newDoc);
            insertedId = resInsert.insertedId.toString();
          } catch (e) {}
        }
        newDoc._id = insertedId;
        newDoc.id = insertedId;
        currentProducts.push(newDoc);
        fallbackStore.products.push(newDoc);

        const logDoc = {
          vendorId: activeVendorId,
          productId: insertedId,
          productName: rawName,
          previousStock: 0,
          newStock: newStock,
          change: newStock,
          type: 'CSV_IMPORT',
          reason: `Tambah produk baru via CSV (+${newStock} unit, Rp ${newPrice.toLocaleString('id-ID')})`,
          performedBy: {
            id: req.user?.userId || '',
            name: req.user?.name || 'Manager',
            role: req.user?.role || 'MANAGER'
          },
          createdAt: new Date()
        };
        inventoryLogs.push(logDoc);

        createdCount++;
      }
    }

    // Insert logs
    if (inventoryLogs.length > 0) {
      if (db) {
        try {
          await db.collection('inventory_logs').insertMany(inventoryLogs);
        } catch (e) {}
      }
      for (const log of inventoryLogs) {
        fallbackStore.inventory_logs.unshift({ id: new ObjectId().toString(), ...log });
      }
    }

    // Record system-wide activity log
    await recordActivityLog({
      action: createdCount > 0 && updatedCount > 0 ? 'UPDATE' : createdCount > 0 ? 'CREATE' : 'UPDATE',
      entity: 'INVENTORY',
      summary: `Import CSV katalog: ${createdCount} produk baru ditambahkan, ${updatedCount} produk diperbarui (Total: ${updatedCount + createdCount} item)`,
      details: {
        updatedCount,
        createdCount,
        totalProcessed: updatedCount + createdCount,
        stockMode
      },
      req
    });

    return res.json({
      success: true,
      message: `Import CSV berhasil: ${updatedCount} produk diperbarui, ${createdCount} produk baru ditambahkan.`,
      summary: {
        updatedCount,
        createdCount,
        totalProcessed: updatedCount + createdCount
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Server Error' });
  }
});

/**
 * PATCH /api/products/:id/stock
 * Manual stock update & threshold configuration (Manager only)
 */
productRouter.patch('/:id/stock', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { stock, adjustment, lowStockThreshold, reason } = req.body;

    const db = getDB();
    let product: any = null;

    if (db) {
      try {
        const query: any = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
        product = await db.collection('products').findOne(query);
      } catch (e) {}
    }

    if (!product) {
      product = fallbackStore.products.find(p => (p._id && p._id.toString() === id) || p.id === id);
    }

    if (!product) {
      return res.status(404).json({ success: false, error: 'Produk tidak ditemukan' });
    }

    const currentStock = typeof product.stock === 'number' ? product.stock : 0;
    let newStock = currentStock;

    if (typeof stock === 'number') {
      newStock = Math.max(0, Math.floor(stock));
    } else if (typeof adjustment === 'number') {
      newStock = Math.max(0, currentStock + Math.floor(adjustment));
    }

    const updateFields: any = {
      stock: newStock,
      updatedAt: new Date()
    };

    if (typeof lowStockThreshold === 'number') {
      updateFields.lowStockThreshold = Math.max(0, Math.floor(lowStockThreshold));
    }

    if (db) {
      try {
        const query: any = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
        await db.collection('products').updateOne(query, { $set: updateFields });
      } catch (e) {}
    }

    const fbIdx = fallbackStore.products.findIndex(p => (p._id && p._id.toString() === id) || p.id === id);
    if (fbIdx !== -1) {
      fallbackStore.products[fbIdx] = { ...fallbackStore.products[fbIdx], ...updateFields };
    }

    const stockChange = newStock - currentStock;
    const logDoc = {
      vendorId: product.vendorId || req.vendorId || 'vnd_sipspot_central',
      productId: id,
      productName: product.name,
      previousStock: currentStock,
      newStock,
      change: stockChange,
      type: stockChange > 0 ? 'MANUAL_RESTOCK' : stockChange < 0 ? 'MANUAL_ADJUSTMENT' : 'THRESHOLD_UPDATE',
      reason:
        reason ||
        (stockChange > 0
          ? `Restock manual +${stockChange}`
          : stockChange < 0
          ? `Penyesuaian stok ${stockChange}`
          : 'Pembaruan batas threshold stok'),
      performedBy: {
        id: req.user?.userId || '',
        name: req.user?.name || 'Manager',
        role: req.user?.role || 'MANAGER'
      },
      createdAt: new Date()
    };

    if (db) {
      try {
        await db.collection('inventory_logs').insertOne(logDoc);
      } catch (e) {}
    }
    fallbackStore.inventory_logs.unshift({ id: new ObjectId().toString(), ...logDoc });

    // Record system-wide activity log
    await recordActivityLog({
      action: 'UPDATE',
      entity: 'INVENTORY',
      entityId: id,
      entityName: product.name,
      summary: `Penyesuaian stok '${product.name}': ${currentStock} -> ${newStock} (${stockChange >= 0 ? '+' : ''}${stockChange} unit)${reason ? ` - ${reason}` : ''}`,
      details: {
        productId: id,
        productName: product.name,
        previousStock: currentStock,
        newStock,
        change: stockChange,
        lowStockThreshold: updateFields.lowStockThreshold,
        reason
      },
      req
    });

    return res.json({
      success: true,
      message: `Stok ${product.name} berhasil diperbarui menjadi ${newStock}!`,
      product: {
        id: product._id ? product._id.toString() : product.id,
        name: product.name,
        stock: newStock,
        lowStockThreshold: updateFields.lowStockThreshold ?? (product.lowStockThreshold || 10)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * POST /api/products
 * Create product (Manager only)
 */
productRouter.post('/', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: parsed.error.format()
      });
    }

    const activeVendorId = req.vendorId || 'vnd_sipspot_central';
    const newProd = {
      ...parsed.data,
      vendorId: activeVendorId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const db = getDB();
    let insertedId = new ObjectId().toString();

    if (db) {
      try {
        const result = await db.collection('products').insertOne(newProd);
        insertedId = result.insertedId.toString();
      } catch (e) {
        fallbackStore.products.push({ ...newProd, _id: insertedId });
      }
    } else {
      fallbackStore.products.push({ ...newProd, _id: insertedId });
    }

    // Record system-wide activity log
    await recordActivityLog({
      action: 'CREATE',
      entity: 'PRODUCT',
      entityId: insertedId,
      entityName: newProd.name,
      summary: `Menambahkan produk baru '${newProd.name}' (${newProd.category}) - Rp ${newProd.price.toLocaleString('id-ID')} (Stok: ${newProd.stock})`,
      details: {
        id: insertedId,
        name: newProd.name,
        category: newProd.category,
        subCategory: newProd.subCategory,
        price: newProd.price,
        stock: newProd.stock,
        lowStockThreshold: newProd.lowStockThreshold
      },
      req
    });

    return res.status(201).json({
      success: true,
      message: 'Produk berhasil ditambahkan!',
      product: { id: insertedId, ...newProd }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * PUT /api/products/:id
 */
productRouter.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date() };

    const activeVendorId = req.vendorId || 'vnd_sipspot_central';
    const db = getDB();
    let existingProd: any = null;

    if (db) {
      try {
        const query: any = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
        existingProd = await db.collection('products').findOne(query);
      } catch (e) {}
    }

    if (!existingProd) {
      existingProd = fallbackStore.products.find(p => (p._id && p._id.toString() === id) || p.id === id);
    }

    if (!existingProd) {
      return res.status(404).json({ success: false, error: 'Produk tidak ditemukan.' });
    }

    const prodVendorId = existingProd.vendorId || 'vnd_sipspot_central';
    if (prodVendorId !== activeVendorId && req.user?.role !== 'SUPERADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Akses Ditolak: Anda tidak berhak mengubah produk milik vendor lain.'
      });
    }

    if (db) {
      try {
        const query: any = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
        await db.collection('products').updateOne(query, { $set: updateData });
      } catch (e) {}
    }

    const idx = fallbackStore.products.findIndex(p => (p._id && p._id.toString() === id) || p.id === id);
    if (idx !== -1) {
      fallbackStore.products[idx] = { ...fallbackStore.products[idx], ...updateData };
    }

    const prodName = existingProd?.name || updateData.name || id;

    // Record system-wide activity log
    await recordActivityLog({
      action: 'UPDATE',
      entity: 'PRODUCT',
      entityId: id,
      entityName: prodName,
      summary: `Memperbarui data produk '${prodName}'`,
      details: {
        productId: id,
        updates: updateData
      },
      req
    });

    return res.json({ success: true, message: 'Produk / Stok berhasil diperbarui!' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * DELETE /api/products/:id
 */
productRouter.delete('/:id', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const activeVendorId = req.vendorId || 'vnd_sipspot_central';
    const db = getDB();
    let targetProd: any = null;

    if (db) {
      try {
        const query: any = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
        targetProd = await db.collection('products').findOne(query);
      } catch (e) {}
    }

    if (!targetProd) {
      targetProd = fallbackStore.products.find(p => (p._id && p._id.toString() === id) || p.id === id);
    }

    if (!targetProd) {
      return res.status(404).json({ success: false, error: 'Produk tidak ditemukan.' });
    }

    const prodVendorId = targetProd.vendorId || 'vnd_sipspot_central';
    if (prodVendorId !== activeVendorId && req.user?.role !== 'SUPERADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Akses Ditolak: Anda tidak berhak menghapus produk milik vendor lain.'
      });
    }

    if (db) {
      try {
        const query: any = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
        await db.collection('products').deleteOne(query);
      } catch (e) {}
    }

    const idx = fallbackStore.products.findIndex(p => (p._id && p._id.toString() === id) || p.id === id);
    if (idx !== -1) {
      fallbackStore.products.splice(idx, 1);
    }

    const prodName = targetProd?.name || id;

    // Record system-wide activity log
    await recordActivityLog({
      action: 'DELETE',
      entity: 'PRODUCT',
      entityId: id,
      entityName: prodName,
      summary: `Menghapus produk '${prodName}' dari katalog database`,
      details: {
        productId: id,
        deletedProduct: targetProd
      },
      req
    });

    return res.json({ success: true, message: 'Produk berhasil dihapus.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});
