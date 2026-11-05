import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDB, connectDB } from '../db';
import { authMiddleware } from '../auth';
import { recordActivityLog } from '../activityLogger';
import { serverProductCache } from '../cache/productCache';

export const rawMaterialRouter = Router();

/**
 * RBAC Guard: Strictly role MANAGER (and ADMIN read-only / system management)
 * Cashier role is explicitly forbidden.
 */
function requireManagerRole(req: Request, res: Response, next: () => void) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Autentikasi diperlukan.'
    });
  }

  if (user.role !== 'MANAGER' && user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Akses ditolak: Halaman dan data pembelian bahan baku hanya dapat diakses oleh role MANAGER.'
    });
  }

  next();
}

function requireManagerMutationRole(req: Request, res: Response, next: () => void) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Autentikasi diperlukan.'
    });
  }

  // Admin read-only rule across inventory, MANAGER is mutation authority
  if (user.role === 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Akses ditolak: Role ADMIN hanya memiliki hak baca. Pembelian dan perubahan bahan baku hanya dapat dilakukan oleh role MANAGER.'
    });
  }

  if (user.role !== 'MANAGER') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Akses ditolak: Operasi pembelian bahan baku hanya dapat dilakukan oleh role MANAGER.'
    });
  }

  next();
}

function getVendorFilter(vendorId?: string): any {
  const v = vendorId || 'vnd_kasirkafe_central';
  if (v === 'vnd_kasirkafe_central' || v === '6ab58389b2a71518d2beb887') {
    return {
      $or: [
        { vendorId: '6ab58389b2a71518d2beb887' },
        { vendorId: 'vnd_kasirkafe_central' },
        { vendorId: { $exists: false } },
        { vendorId: null }
      ]
    };
  }
  return { vendorId: v };
}

// Schemas
const rawMaterialSchema = z.object({
  name: z.string().min(2, 'Nama bahan baku minimal 2 karakter'),
  category: z.string().default('KOPI'),
  unit: z.enum(['gram', 'ml', 'shot', 'pcs', 'lembar', 'pack', 'kg', 'liter']),
  stock: z.number().min(0, 'Stok tidak boleh negatif').default(0),
  minimumStock: z.number().min(0, 'Stok minimum tidak boleh negatif').default(100),
  avgCostPerUnit: z.number().min(0).default(0),
  notes: z.string().optional()
});

const purchaseItemSchema = z.object({
  materialId: z.string().min(1, 'ID bahan baku wajib diisi'),
  materialName: z.string().min(1, 'Nama bahan baku wajib diisi'),
  quantity: z.number().positive('Jumlah pembelian harus lebih dari 0'),
  unit: z.string().min(1, 'Satuan wajib diisi'),
  unitPrice: z.number().min(0, 'Harga satuan minimal 0'),
  subtotal: z.number().min(0, 'Subtotal minimal 0')
});

const purchaseOrderSchema = z.object({
  purchaseNumber: z.string().optional(),
  supplierName: z.string().min(2, 'Nama supplier minimal 2 karakter'),
  purchaseDate: z.string().min(8, 'Tanggal pembelian wajib diisi'),
  items: z.array(purchaseItemSchema).min(1, 'Minimal 1 item bahan baku harus dibeli'),
  paymentMethod: z.enum(['TRANSFER', 'CASH', 'TEMPO']).default('TRANSFER'),
  invoiceNumber: z.string().optional(),
  notes: z.string().optional()
});

const recipeItemSchema = z.object({
  materialId: z.string().min(1, 'ID bahan baku wajib diisi'),
  materialName: z.string().min(1, 'Nama bahan baku wajib diisi'),
  quantityNeeded: z.number().positive('Kebutuhan bahan harus lebih dari 0'),
  unit: z.string().min(1, 'Satuan wajib diisi')
});

const productRecipeSchema = z.object({
  productId: z.string().min(1, 'Product ID wajib diisi'),
  productName: z.string().min(1, 'Nama produk wajib diisi'),
  category: z.string().optional(),
  ingredients: z.array(recipeItemSchema).default([]),
  instructions: z.string().optional(),
  isAutoDeduct: z.boolean().default(true)
});

/**
 * GET /api/raw-materials
 * List all raw materials for active vendor
 */
rawMaterialRouter.get('/', authMiddleware, requireManagerRole, async (req: Request, res: Response) => {
  try {
    let db = getDB();
    if (!db) db = await connectDB();
    if (!db) return res.status(503).json({ success: false, error: 'Database tidak terhubung' });

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const materials = await db.collection('raw_materials')
      .find(getVendorFilter(activeVendorId))
      .sort({ name: 1 })
      .toArray();

    return res.json({
      success: true,
      vendorId: activeVendorId,
      materials: materials.map(m => ({
        id: m._id ? m._id.toString() : m.id,
        vendorId: m.vendorId,
        name: m.name,
        category: m.category || 'KOPI',
        unit: m.unit || 'gram',
        stock: typeof m.stock === 'number' ? m.stock : 0,
        minimumStock: typeof m.minimumStock === 'number' ? m.minimumStock : 100,
        avgCostPerUnit: typeof m.avgCostPerUnit === 'number' ? m.avgCostPerUnit : 0,
        notes: m.notes || '',
        createdAt: m.createdAt,
        updatedAt: m.updatedAt
      }))
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Server Error' });
  }
});

/**
 * POST /api/raw-materials
 * Create a new raw material record (Manager only)
 */
rawMaterialRouter.post('/', authMiddleware, requireManagerMutationRole, async (req: Request, res: Response) => {
  try {
    const parsed = rawMaterialSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Data bahan baku tidak valid',
        details: parsed.error.issues
      });
    }

    let db = getDB();
    if (!db) db = await connectDB();
    if (!db) return res.status(503).json({ success: false, error: 'Database tidak terhubung' });

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const materialData = {
      ...parsed.data,
      vendorId: activeVendorId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('raw_materials').insertOne(materialData);
    const newId = result.insertedId.toString();

    // Log activity
    await recordActivityLog({
      action: 'CREATE',
      entity: 'RAW_MATERIAL',
      entityId: newId,
      entityName: parsed.data.name,
      summary: `Menambahkan master bahan baku: ${parsed.data.name} (${parsed.data.stock} ${parsed.data.unit})`,
      details: parsed.data,
      req
    });

    // Invalidate product cache
    serverProductCache.invalidateProducts(activeVendorId);

    return res.status(201).json({
      success: true,
      message: `Bahan baku '${parsed.data.name}' berhasil ditambahkan!`,
      material: {
        id: newId,
        ...materialData
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Server Error' });
  }
});

/**
 * PUT /api/raw-materials/:id
 * Update an existing raw material
 */
rawMaterialRouter.put('/:id', authMiddleware, requireManagerMutationRole, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id || '');
    const parsed = rawMaterialSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Data bahan baku tidak valid',
        details: parsed.error.issues
      });
    }

    let db = getDB();
    if (!db) db = await connectDB();
    if (!db) return res.status(503).json({ success: false, error: 'Database tidak terhubung' });

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const query: any = { vendorId: activeVendorId };
    if (ObjectId.isValid(id)) {
      query._id = new ObjectId(id);
    } else {
      query.id = id;
    }

    const existing = await db.collection('raw_materials').findOne(query);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Bahan baku tidak ditemukan' });
    }

    const updateDoc = {
      ...parsed.data,
      updatedAt: new Date()
    };

    await db.collection('raw_materials').updateOne(query, { $set: updateDoc });

    // Invalidate product cache to recalculate drink availability
    serverProductCache.invalidateProducts(activeVendorId);

    await recordActivityLog({
      action: 'UPDATE',
      entity: 'RAW_MATERIAL',
      entityId: id,
      entityName: parsed.data.name || existing.name,
      summary: `Memperbarui data bahan baku: ${parsed.data.name || existing.name}`,
      details: parsed.data,
      req
    });

    return res.json({
      success: true,
      message: 'Data bahan baku berhasil diperbarui!'
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Server Error' });
  }
});

/**
 * DELETE /api/raw-materials/:id
 * Delete a raw material
 */
rawMaterialRouter.delete('/:id', authMiddleware, requireManagerMutationRole, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id || '');
    let db = getDB();
    if (!db) db = await connectDB();
    if (!db) return res.status(503).json({ success: false, error: 'Database tidak terhubung' });

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const query: any = { vendorId: activeVendorId };
    if (ObjectId.isValid(id)) {
      query._id = new ObjectId(id);
    } else {
      query.id = id;
    }

    const existing = await db.collection('raw_materials').findOne(query);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Bahan baku tidak ditemukan' });
    }

    await db.collection('raw_materials').deleteOne(query);

    serverProductCache.invalidateProducts(activeVendorId);

    await recordActivityLog({
      action: 'DELETE',
      entity: 'RAW_MATERIAL',
      entityId: id,
      entityName: existing.name,
      summary: `Menghapus master bahan baku: ${existing.name}`,
      details: existing,
      req
    });

    return res.json({
      success: true,
      message: `Bahan baku '${existing.name}' berhasil dihapus!`
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Server Error' });
  }
});

// ==========================================
// PURCHASES (PEMBELIAN BAHAN BAKU)
// ==========================================

/**
 * GET /api/raw-materials/purchases
 * List all purchase orders of raw materials
 */
rawMaterialRouter.get('/purchases', authMiddleware, requireManagerRole, async (req: Request, res: Response) => {
  try {
    let db = getDB();
    if (!db) db = await connectDB();
    if (!db) return res.status(503).json({ success: false, error: 'Database tidak terhubung' });

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const purchases = await db.collection('raw_material_purchases')
      .find(getVendorFilter(activeVendorId))
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return res.json({
      success: true,
      vendorId: activeVendorId,
      purchases: purchases.map(p => ({
        id: p._id ? p._id.toString() : p.id,
        vendorId: p.vendorId,
        purchaseNumber: p.purchaseNumber,
        supplierName: p.supplierName,
        purchaseDate: p.purchaseDate,
        items: p.items || [],
        totalAmount: p.totalAmount || 0,
        paymentMethod: p.paymentMethod || 'TRANSFER',
        invoiceNumber: p.invoiceNumber || '',
        notes: p.notes || '',
        createdBy: p.createdBy,
        createdAt: p.createdAt
      }))
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Server Error' });
  }
});

/**
 * POST /api/raw-materials/purchases
 * Record a new raw material purchase order:
 * Automatically increases stock of each purchased material and logs audit!
 */
rawMaterialRouter.post('/purchases', authMiddleware, requireManagerMutationRole, async (req: Request, res: Response) => {
  try {
    const parsed = purchaseOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Data pembelian bahan baku tidak valid',
        details: parsed.error.issues
      });
    }

    let db = getDB();
    if (!db) db = await connectDB();
    if (!db) return res.status(503).json({ success: false, error: 'Database tidak terhubung' });

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const user = (req as any).user;

    // Generate sequential purchase number if not provided
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let purchaseNumber = parsed.data.purchaseNumber;
    if (!purchaseNumber) {
      const countToday = await db.collection('raw_material_purchases').countDocuments({
        vendorId: activeVendorId,
        purchaseDate: parsed.data.purchaseDate
      });
      purchaseNumber = `PO-${today}-${String(countToday + 1).padStart(3, '0')}`;
    }

    // Compute total amount
    const totalAmount = parsed.data.items.reduce((acc, it) => acc + (it.subtotal || it.quantity * it.unitPrice), 0);

    const purchaseDoc: any = {
      vendorId: activeVendorId,
      purchaseNumber,
      supplierName: parsed.data.supplierName.trim(),
      purchaseDate: parsed.data.purchaseDate,
      items: parsed.data.items,
      totalAmount,
      paymentMethod: parsed.data.paymentMethod,
      invoiceNumber: parsed.data.invoiceNumber || '',
      notes: parsed.data.notes || '',
      createdBy: {
        id: user.userId || user.id || '',
        name: user.name || 'Manager',
        role: user.role || 'MANAGER'
      },
      createdAt: new Date()
    };

    const purchaseResult = await db.collection('raw_material_purchases').insertOne(purchaseDoc);
    const purchaseId = purchaseResult.insertedId.toString();

    // SINKRONISASI OTOMATIS: Update stok bahan baku
    for (const item of parsed.data.items) {
      try {
        const matQuery: any = { vendorId: activeVendorId };
        if (ObjectId.isValid(item.materialId)) {
          matQuery._id = new ObjectId(item.materialId);
        } else {
          matQuery.$or = [{ id: item.materialId }, { name: item.materialName }];
        }

        const material = await db.collection('raw_materials').findOne(matQuery);
        if (material) {
          const prevStock = material.stock || 0;
          const newStock = prevStock + item.quantity;
          const newAvgCost = item.unitPrice > 0 ? item.unitPrice : (material.avgCostPerUnit || 0);

          await db.collection('raw_materials').updateOne(
            { _id: material._id },
            {
              $inc: { stock: item.quantity },
              $set: {
                avgCostPerUnit: newAvgCost,
                updatedAt: new Date()
              }
            }
          );

          // Log material stock mutation
          await db.collection('raw_material_logs').insertOne({
            vendorId: activeVendorId,
            materialId: material._id.toString(),
            materialName: material.name,
            change: item.quantity,
            previousStock: prevStock,
            newStock,
            type: 'PURCHASE_RECEIPT',
            referenceNumber: purchaseNumber,
            supplierName: parsed.data.supplierName,
            unitCost: item.unitPrice,
            performedBy: {
              id: user.userId || '',
              name: user.name || 'Manager',
              role: user.role || 'MANAGER'
            },
            createdAt: new Date()
          });
        }
      } catch (err) {
        console.error(`[Purchases] Error updating material ${item.materialName}:`, err);
      }
    }

    // Invalidate product cache because restocking materials makes out-of-stock drinks available again!
    serverProductCache.invalidateProducts(activeVendorId);

    await recordActivityLog({
      action: 'CREATE',
      entity: 'RAW_MATERIAL_PURCHASE',
      entityId: purchaseId,
      entityName: purchaseNumber,
      summary: `Mencatat faktur pembelian bahan baku #${purchaseNumber} dari ${parsed.data.supplierName} (Total Rp ${totalAmount.toLocaleString('id-ID')})`,
      details: purchaseDoc,
      req
    });

    return res.status(201).json({
      success: true,
      message: `Faktur pembelian #${purchaseNumber} berhasil disimpan dan stok bahan baku bertambah otomatis!`,
      purchase: {
        id: purchaseId,
        ...purchaseDoc
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Server Error' });
  }
});

// ==========================================
// RESEP MINUMAN (PRODUCT RECIPES / BOM)
// ==========================================

/**
 * GET /api/raw-materials/recipes
 * List all product recipes for active vendor
 */
rawMaterialRouter.get('/recipes', authMiddleware, requireManagerRole, async (req: Request, res: Response) => {
  try {
    let db = getDB();
    if (!db) db = await connectDB();
    if (!db) return res.status(503).json({ success: false, error: 'Database tidak terhubung' });

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const recipes = await db.collection('product_recipes')
      .find(getVendorFilter(activeVendorId))
      .toArray();

    return res.json({
      success: true,
      vendorId: activeVendorId,
      recipes: recipes.map(r => ({
        id: r._id ? r._id.toString() : r.id,
        vendorId: r.vendorId,
        productId: r.productId,
        productName: r.productName,
        category: r.category || '',
        ingredients: r.ingredients || [],
        instructions: r.instructions || '',
        isAutoDeduct: r.isAutoDeduct !== false,
        updatedAt: r.updatedAt
      }))
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Server Error' });
  }
});

/**
 * PUT /api/raw-materials/recipes/:productId
 * Upsert recipe for a product (Manager only)
 */
rawMaterialRouter.put('/recipes/:productId', authMiddleware, requireManagerMutationRole, async (req: Request, res: Response) => {
  try {
    const productId = Array.isArray(req.params.productId) ? req.params.productId[0] : String(req.params.productId || '');
    const parsed = productRecipeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Data resep minuman tidak valid',
        details: parsed.error.issues
      });
    }

    let db = getDB();
    if (!db) db = await connectDB();
    if (!db) return res.status(503).json({ success: false, error: 'Database tidak terhubung' });

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';

    const recipeData = {
      vendorId: activeVendorId,
      productId,
      productName: parsed.data.productName,
      category: parsed.data.category || '',
      ingredients: parsed.data.ingredients,
      instructions: parsed.data.instructions || '',
      isAutoDeduct: parsed.data.isAutoDeduct,
      updatedAt: new Date()
    };

    await db.collection('product_recipes').updateOne(
      { vendorId: activeVendorId, productId },
      { $set: recipeData },
      { upsert: true }
    );

    // Invalidate product cache so availability reflects new recipe immediately
    serverProductCache.invalidateProducts(activeVendorId);

    await recordActivityLog({
      action: 'UPDATE',
      entity: 'PRODUCT_RECIPE',
      entityId: productId,
      entityName: parsed.data.productName,
      summary: `Memperbarui resep racikan minuman: ${parsed.data.productName} (${parsed.data.ingredients.length} bahan)`,
      details: recipeData,
      req
    });

    return res.json({
      success: true,
      message: `Resep racikan minuman '${parsed.data.productName}' berhasil disimpan!`,
      recipe: recipeData
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Server Error' });
  }
});

/**
 * GET /api/raw-materials/summary
 * Summary stats for dashboard cards
 */
rawMaterialRouter.get('/summary', authMiddleware, requireManagerRole, async (req: Request, res: Response) => {
  try {
    let db = getDB();
    if (!db) db = await connectDB();
    if (!db) return res.status(503).json({ success: false, error: 'Database tidak terhubung' });

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const vFilter = getVendorFilter(activeVendorId);

    const materials = await db.collection('raw_materials').find(vFilter).toArray();
    const recipes = await db.collection('product_recipes').find(vFilter).toArray();

    // Get current month purchases total
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const purchasesThisMonth = await db.collection('raw_material_purchases')
      .find({
        $and: [
          vFilter,
          { purchaseDate: { $regex: `^${currentMonthStr}` } }
        ]
      })
      .toArray();

    const totalSpendThisMonth = purchasesThisMonth.reduce((acc, p) => acc + (p.totalAmount || 0), 0);

    let outOfStockCount = 0;
    let lowStockCount = 0;
    let safeCount = 0;

    materials.forEach(m => {
      const stock = m.stock || 0;
      const min = m.minimumStock || 100;
      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= min) {
        lowStockCount++;
      } else {
        safeCount++;
      }
    });

    return res.json({
      success: true,
      summary: {
        totalMaterials: materials.length,
        outOfStockCount,
        lowStockCount,
        safeCount,
        totalRecipes: recipes.length,
        totalSpendThisMonth,
        purchasesThisMonthCount: purchasesThisMonth.length
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Server Error' });
  }
});
