import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB, connectDB } from '../db';
import { authMiddleware, requireManager } from '../auth';
import { ObjectId } from 'mongodb';
import { recordActivityLog } from '../activityLogger';
import { IParam } from '@/src/types';
import { serverProductCache } from '../cache/productCache';
import { resolveVendorId, toVendorObjectId, buildVendorQuery } from '../vendorMiddleware';

export const productRouter = Router();

/**
 * RBAC Rule: Role ADMIN HANYA bisa melihat Data Inventaris (Read-Only).
 * ADMIN TIDAK BISA menambah, mengubah, atau menghapus inventaris atau produk.
 * Hak menambah, mengubah, dan menghapus inventaris khusus dipegang oleh role MANAGER.
 */
function requireInventoryWriteAccess(req: Request, res: Response, next: () => void) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Autentikasi diperlukan.'
    });
  }

  // Khusus role ADMIN: tolak akses mutasi inventaris secara eksplisit
  if (user.role === 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Akses Ditolak: Role ADMIN hanya memiliki hak akses melihat Data Inventaris (Read-Only). Tidak diizinkan menambah, mengubah, atau menghapus.'
    });
  }

  // Pastikan hanya MANAGER yang memiliki izin kelola inventaris
  if (user.role !== 'MANAGER') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Akses Ditolak: Pengelolaan data inventaris (tambah, ubah, hapus) hanya dapat dilakukan oleh role MANAGER.'
    });
  }

  next();
}

/**
 * Access check for Category Variations: Allowed for MANAGER and ADMIN
 */
function requireCategoryVariationWriteAccess(req: Request, res: Response, next: () => void) {
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
      message: 'Akses Ditolak: Pengelolaan variasi kategori hanya dapat dilakukan oleh role MANAGER atau ADMIN.'
    });
  }

  next();
}

const productSchema = z.object({
  name: z.string().min(2, 'Nama produk minimal 2 karakter'),
  category: z.string().min(1, 'Kategori wajib dipilih'),
  price: z.number().min(0, 'Harga tidak boleh negatif'),
  stock: z.number().int().min(0, 'Stok minimal 0'),
  lowStockThreshold: z.number().int().min(0).default(10),
  description: z.string().optional(),
  tag: z.string().optional(),
  image: z.string().url('URL gambar tidak valid').or(z.literal('')).optional(),
  isAvailable: z.boolean().default(true)
});

/**
 * GET /api/products/cache/stats
 * Monitor cache performance
 */
productRouter.get('/cache/stats', (req: Request, res: Response) => {
  return res.json({
    success: true,
    stats: serverProductCache.getStats()
  });
});

/**
 * POST /api/products/cache/clear
 * Clear in-memory product and category cache
 */
productRouter.post('/cache/clear', (req: Request, res: Response) => {
  const activeVendorId = req.vendorId || (req as any).user?.vendorId || '6ab58389b2a71518d2beb887';
  const isAdmin = (req as any).user?.role === 'ADMIN';
  const clearAll = req.query.all === 'true' && isAdmin;

  if (clearAll) {
    serverProductCache.clearAll();
  } else {
    serverProductCache.invalidateProducts(activeVendorId);
    serverProductCache.invalidateCategories(activeVendorId);
  }

  return res.json({
    success: true,
    message: clearAll ? 'Semua cache server berhasil dibersihkan!' : `Cache vendor ${activeVendorId} berhasil dibersihkan!`,
    stats: serverProductCache.getStats()
  });
});

/**
 * GET /api/products/category-variations
 * Returns list of category variations for the active vendor
 * Table: category_variations (on table use '_id', on node js code use 'id')
 */
const variationOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nama opsi variasi tidak boleh kosong'),
  extraPrice: z.number().min(0, 'Harga ekstra tidak boleh negatif').default(0),
  isDefault: z.boolean().optional()
});

const categoryVariationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nama variasi tidak boleh kosong'),
  type: z.enum(['SINGLE_SELECT', 'MULTI_SELECT', 'RADIO', 'CHECKBOX']).default('SINGLE_SELECT'),
  required: z.boolean().default(false),
  options: z.array(variationOptionSchema).default([])
});

const categoryVariationInputSchema = z.object({
  name: z.string().min(1, 'Nama variasi wajib diisi'),
  type: z.enum(['SINGLE_SELECT', 'MULTI_SELECT', 'RADIO', 'CHECKBOX']).default('SINGLE_SELECT'),
  required: z.boolean().default(false),
  options: z.array(variationOptionSchema).default([]),
  categoryIds: z.array(z.string()).optional()
});

const categoryVariationUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['SINGLE_SELECT', 'MULTI_SELECT', 'RADIO', 'CHECKBOX']).optional(),
  required: z.boolean().optional(),
  options: z.array(variationOptionSchema).optional(),
  categoryIds: z.array(z.string()).optional()
});

productRouter.get('/category-variations', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const requestedVendor = (req.query.vendorId as string)?.trim();
    const isAllVendors = req.query.allVendors === 'true' || requestedVendor === 'all';

    let activeVendorId = req.vendorId || user?.vendorId || '6ab58389b2a71518d2beb887';
    // If user is ADMIN and no specific non-admin vendor is given, or if activeVendorId is Admin vendor
    if (requestedVendor && requestedVendor !== 'all') {
      activeVendorId = resolveVendorId(requestedVendor);
    } else if (activeVendorId === '6ab58389b2a71518d2beb886' || activeVendorId === 'vnd_admin') {
      activeVendorId = '6ab58389b2a71518d2beb887';
    }

    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    const varQuery = isAllVendors ? {} : buildVendorQuery(activeVendorId);
    const variationsRaw = await db.collection('category_variations').find(varQuery).sort({ createdAt: -1 }).toArray();

    // Query categories for this vendor to find where each variation is referenced
    const catQuery = isAllVendors ? {} : buildVendorQuery(activeVendorId);
    const categories = await db.collection('categories').find(catQuery).toArray();

    const variations = variationsRaw.map(v => {
      const vIdStr = v._id.toString();
      // Find categories referencing this variation
      const referencingCats = categories.filter(c => {
        const catVarIds: any[] = [
          ...(Array.isArray(c.categoryVariationIds) ? c.categoryVariationIds : []),
          ...(Array.isArray(c.variationIds) ? c.variationIds : []),
          c.categoryVariationId
        ].filter(Boolean);
        return catVarIds.some(refId => refId && (refId.toString() === vIdStr || refId === vIdStr));
      });

      const vVendorOid = toVendorObjectId(v.vendorId || activeVendorId);
      return {
        id: v._id.toString(), // on node js code use 'id', on table use '_id'
        vendorId: vVendorOid.toString(), // on node js code use 'id'
        name: v.name,
        type: v.type || 'SINGLE_SELECT',
        required: !!v.required,
        options: Array.isArray(v.options) ? v.options : [],
        usedInCategoriesCount: referencingCats.length,
        categoryNames: referencingCats.map(c => c.name),
        createdAt: v.createdAt,
        updatedAt: v.updatedAt
      };
    });

    return res.json({
      success: true,
      vendorId: toVendorObjectId(activeVendorId).toString(),
      variations
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * GET /api/products/category-variations/:id
 */
productRouter.get('/category-variations/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || '6ab58389b2a71518d2beb887';
    const db = getDB();
    if (!db) {
      return res.status(503).json({ success: false, error: 'can not connect to db' });
    }

    let query: any = buildVendorQuery(activeVendorId);
    if (ObjectId.isValid(id)) {
      query._id = new ObjectId(id);
    } else {
      query.name = id;
    }

    const variation = await db.collection('category_variations').findOne(query);
    if (!variation) {
      return res.status(404).json({ success: false, error: 'Variasi kategori tidak ditemukan.' });
    }

    const vVendorOid = toVendorObjectId(variation.vendorId || activeVendorId);
    return res.json({
      success: true,
      variation: {
        id: variation._id.toString(),
        vendorId: vVendorOid.toString(),
        name: variation.name,
        type: variation.type,
        required: variation.required,
        options: variation.options,
        createdAt: variation.createdAt,
        updatedAt: variation.updatedAt
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * POST /api/products/category-variations
 * Create Category Variation in new table (Manager & Admin)
 * on table use '_id', on node js code use 'id'
 */
productRouter.post('/category-variations', authMiddleware, requireCategoryVariationWriteAccess, async (req: Request, res: Response) => {
  try {
    const parsed = categoryVariationInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Data variasi kategori tidak valid',
        details: parsed.error.issues
      });
    }

    const user = (req as any).user;
    let activeVendorId = req.vendorId || user?.vendorId || '6ab58389b2a71518d2beb887';
    if (user?.role === 'ADMIN') {
      const targetVendor = (req.body?.vendorId || (req.query?.vendorId as string))?.trim();
      if (targetVendor && targetVendor !== 'all') {
        activeVendorId = resolveVendorId(targetVendor);
      } else if (activeVendorId === '6ab58389b2a71518d2beb886' || activeVendorId === 'vnd_admin') {
        activeVendorId = '6ab58389b2a71518d2beb887';
      }
    }

    const vendorOid = toVendorObjectId(activeVendorId);
    const vendorIdStr = vendorOid.toString();

    const db = getDB();
    if (!db) {
      return res.status(503).json({ success: false, error: 'can not connect to db' });
    }

    // Format options with IDs
    const formattedOptions = (parsed.data.options || []).map((opt, oIdx) => ({
      id: opt.id || `opt_${Date.now()}_${oIdx}`,
      name: opt.name.trim(),
      extraPrice: Number(opt.extraPrice || 0),
      isDefault: !!opt.isDefault
    }));

    // New ObjectId for table (on table use '_id', on node js code use 'id')
    const newId = new ObjectId();
    const newVariationDoc = {
      _id: newId,
      name: parsed.data.name.trim(),
      type: parsed.data.type || 'SINGLE_SELECT',
      required: !!parsed.data.required,
      options: formattedOptions,
      vendorId: vendorOid, // on table use ObjectId from table Vendor
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('category_variations').insertOne(newVariationDoc);

    // If categoryIds were supplied to link this variation immediately:
    if (Array.isArray(parsed.data.categoryIds) && parsed.data.categoryIds.length > 0) {
      const catObjectIds = parsed.data.categoryIds
        .filter(cId => ObjectId.isValid(cId))
        .map(cId => new ObjectId(cId));

      if (catObjectIds.length > 0) {
        await db.collection('categories').updateMany(
          { _id: { $in: catObjectIds }, ...(user?.role === 'ADMIN' ? {} : buildVendorQuery(activeVendorId)) },
          {
            $addToSet: {
              categoryVariationIds: newId,
              variationIds: newId
            } as any
          }
        );
      }
    }

    // Invalidate categories cache
    serverProductCache.invalidateCategories(vendorIdStr);

    await recordActivityLog({
      action: 'CREATE',
      entity: 'CATEGORY_VARIATION',
      entityId: newId.toString(),
      entityName: newVariationDoc.name,
      summary: `Menambahkan variasi kategori baru '${newVariationDoc.name}' dengan ${formattedOptions.length} opsi`,
      details: newVariationDoc,
      req
    });

    return res.status(201).json({
      success: true,
      variation: {
        id: newId.toString(), // on node js code use 'id'
        vendorId: vendorIdStr, // on node js code use 'id'
        name: newVariationDoc.name,
        type: newVariationDoc.type,
        required: newVariationDoc.required,
        options: newVariationDoc.options,
        createdAt: newVariationDoc.createdAt,
        updatedAt: newVariationDoc.updatedAt
      },
      message: 'Variasi kategori berhasil dibuat!'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * PUT /api/products/category-variations/:id
 * Update Category Variation (Manager & Admin)
 */
productRouter.put('/category-variations/:id', authMiddleware, requireCategoryVariationWriteAccess, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const parsed = categoryVariationUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Data pembaruan variasi tidak valid',
        details: parsed.error.issues
      });
    }

    const user = (req as any).user;
    let activeVendorId = req.vendorId || user?.vendorId || '6ab58389b2a71518d2beb887';
    if (user?.role === 'ADMIN') {
      const targetVendor = (req.body?.vendorId || (req.query?.vendorId as string))?.trim();
      if (targetVendor && targetVendor !== 'all') {
        activeVendorId = resolveVendorId(targetVendor);
      } else if (activeVendorId === '6ab58389b2a71518d2beb886' || activeVendorId === 'vnd_admin') {
        activeVendorId = '6ab58389b2a71518d2beb887';
      }
    }

    const vendorOid = toVendorObjectId(activeVendorId);
    const vendorIdStr = vendorOid.toString();

    const db = getDB();
    if (!db) {
      return res.status(503).json({ success: false, error: 'can not connect to db' });
    }

    let query: any = user?.role === 'ADMIN' ? {} : buildVendorQuery(activeVendorId);
    if (ObjectId.isValid(id)) {
      query._id = new ObjectId(id);
    } else {
      query.$or = [{ id }, { name: id }];
    }

    const existingVar = await db.collection('category_variations').findOne(query);
    if (!existingVar) {
      return res.status(404).json({ success: false, error: 'Variasi kategori tidak ditemukan atau bukan milik vendor Anda.' });
    }

    const varVendorOid = toVendorObjectId(existingVar.vendorId || activeVendorId);
    const updateFields: any = {
      vendorId: varVendorOid,
      updatedAt: new Date()
    };

    if (parsed.data.name !== undefined) updateFields.name = parsed.data.name.trim();
    if (parsed.data.type !== undefined) updateFields.type = parsed.data.type;
    if (parsed.data.required !== undefined) updateFields.required = !!parsed.data.required;
    if (parsed.data.options !== undefined) {
      updateFields.options = parsed.data.options.map((opt, oIdx) => ({
        id: opt.id || `opt_${Date.now()}_${oIdx}`,
        name: opt.name.trim(),
        extraPrice: Number(opt.extraPrice || 0),
        isDefault: !!opt.isDefault
      }));
    }

    await db.collection('category_variations').updateOne({ _id: existingVar._id }, { $set: updateFields });

    // If categoryIds is specified, sync categories referencing this variation
    if (Array.isArray(parsed.data.categoryIds)) {
      const targetCatObjectIds = parsed.data.categoryIds
        .filter(cId => ObjectId.isValid(cId))
        .map(cId => new ObjectId(cId));

      // Remove from categories not in target list
      await db.collection('categories').updateMany(
        { _id: { $nin: targetCatObjectIds }, ...buildVendorQuery(activeVendorId) },
        {
          $pull: {
            categoryVariationIds: existingVar._id,
            variationIds: existingVar._id
          } as any
        }
      );

      // Add to categories in target list
      if (targetCatObjectIds.length > 0) {
        await db.collection('categories').updateMany(
          { _id: { $in: targetCatObjectIds }, ...buildVendorQuery(activeVendorId) },
          {
            $addToSet: {
              categoryVariationIds: existingVar._id,
              variationIds: existingVar._id
            } as any
          }
        );
      }
    }

    // Invalidate categories cache
    serverProductCache.invalidateCategories(varVendorOid.toString());

    await recordActivityLog({
      action: 'UPDATE',
      entity: 'CATEGORY_VARIATION',
      entityId: existingVar._id.toString(),
      entityName: updateFields.name || existingVar.name,
      summary: `Memperbarui variasi kategori '${updateFields.name || existingVar.name}'`,
      details: updateFields,
      req
    });

    const updatedDoc = await db.collection('category_variations').findOne({ _id: existingVar._id });

    return res.json({
      success: true,
      variation: {
        id: updatedDoc?._id.toString() || id,
        vendorId: varVendorOid.toString(), // on node js code use 'id'
        name: updatedDoc?.name,
        type: updatedDoc?.type,
        required: updatedDoc?.required,
        options: updatedDoc?.options || [],
        updatedAt: updatedDoc?.updatedAt
      },
      message: 'Variasi kategori berhasil diperbarui!'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * DELETE /api/products/category-variations/:id
 * Delete Category Variation & remove its reference from categories (Manager & Admin)
 */
productRouter.delete('/category-variations/:id', authMiddleware, requireCategoryVariationWriteAccess, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const user = (req as any).user;
    let activeVendorId = req.vendorId || user?.vendorId || '6ab58389b2a71518d2beb887';
    if (user?.role === 'ADMIN') {
      const targetVendor = (req.query?.vendorId as string)?.trim();
      if (targetVendor && targetVendor !== 'all') {
        activeVendorId = resolveVendorId(targetVendor);
      } else if (activeVendorId === '6ab58389b2a71518d2beb886' || activeVendorId === 'vnd_admin') {
        activeVendorId = '6ab58389b2a71518d2beb887';
      }
    }

    const vendorOid = toVendorObjectId(activeVendorId);
    const vendorIdStr = vendorOid.toString();

    const db = getDB();
    if (!db) {
      return res.status(503).json({ success: false, error: 'can not connect to db' });
    }

    let query: any = user?.role === 'ADMIN' ? {} : buildVendorQuery(activeVendorId);
    if (ObjectId.isValid(id)) {
      query._id = new ObjectId(id);
    } else {
      query.$or = [{ id }, { name: id }];
    }

    const variation = await db.collection('category_variations').findOne(query);
    if (!variation) {
      return res.status(404).json({ success: false, error: 'Variasi kategori tidak ditemukan atau bukan milik vendor Anda.' });
    }

    // Delete from category_variations table
    await db.collection('category_variations').deleteOne({ _id: variation._id });

    // Pull reference from all categories
    await db.collection('categories').updateMany(
      buildVendorQuery(activeVendorId),
      {
        $pull: {
          categoryVariationIds: variation._id,
          variationIds: variation._id
        } as any
      }
    );

    // Also handle categoryVariationId unset if matched
    await db.collection('categories').updateMany(
      { ...buildVendorQuery(activeVendorId), categoryVariationId: variation._id },
      { $unset: { categoryVariationId: '' } }
    );

    // Invalidate categories cache
    serverProductCache.invalidateCategories(vendorIdStr);

    await recordActivityLog({
      action: 'DELETE',
      entity: 'CATEGORY_VARIATION',
      entityId: variation._id.toString(),
      entityName: variation.name,
      summary: `Menghapus variasi kategori '${variation.name}'`,
      details: { name: variation.name },
      req
    });

    return res.json({
      success: true,
      message: `Variasi kategori '${variation.name}' berhasil dihapus!`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * GET /api/products/categories
 * Returns categories strictly partitioned by active vendor (with Server In-Memory Cache)
 * Category references the Category Variation id (on table use '_id', on node js code use 'id')
 */
productRouter.get('/categories', async (req: Request, res: Response) => {
  try {
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || '6ab58389b2a71518d2beb887';
    const bypassCache = req.query.bypassCache === 'true' || req.query.refresh === 'true';
    const cacheKey = `categories:${activeVendorId}`;

    // 1. Check in-memory server cache
    if (!bypassCache) {
      const cached = serverProductCache.get<any>(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Age-Ms', String(cached.ageMs));
        return res.json({
          ...cached.data,
          cached: true,
          cacheAgeMs: cached.ageMs
        });
      }
    }

    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    let categories: any[] = [];
    try {
      const query = buildVendorQuery(activeVendorId);
      categories = await db.collection('categories').find(query).toArray();
    } catch (e) {}

    // Collect all referenced Category Variation ObjectIds
    const allVarObjectIds: ObjectId[] = [];
    for (const c of categories) {
      const rawRefs = [
        ...(Array.isArray(c.categoryVariationIds) ? c.categoryVariationIds : []),
        ...(Array.isArray(c.variationIds) ? c.variationIds : []),
        c.categoryVariationId
      ].filter(Boolean);

      for (const r of rawRefs) {
        if (r instanceof ObjectId) {
          allVarObjectIds.push(r);
        } else if (typeof r === 'string' && ObjectId.isValid(r)) {
          allVarObjectIds.push(new ObjectId(r));
        }
      }
    }

    // Load referenced category_variations from table
    const varMap = new Map<string, any>();
    if (allVarObjectIds.length > 0) {
      try {
        const foundVars = await db.collection('category_variations').find({
          _id: { $in: allVarObjectIds }
        }).toArray();

        for (const fv of foundVars) {
          varMap.set(fv._id.toString(), {
            id: fv._id.toString(), // on node js code use 'id', on table use '_id'
            vendorId: fv.vendorId,
            name: fv.name,
            type: fv.type || 'SINGLE_SELECT',
            required: !!fv.required,
            options: fv.options || []
          });
        }
      } catch (e) {}
    }

    const payload = {
      success: true,
      vendorId: activeVendorId,
      cached: false,
      categories: categories.map(c => {
        const rawRefs = [
          ...(Array.isArray(c.categoryVariationIds) ? c.categoryVariationIds : []),
          ...(Array.isArray(c.variationIds) ? c.variationIds : []),
          c.categoryVariationId
        ].filter(Boolean);

        const refIdStrings = Array.from(new Set(rawRefs.map((r: any) => r ? r.toString() : ''))).filter(Boolean);
        const populatedVariations = refIdStrings
          .map(idStr => varMap.get(idStr))
          .filter(Boolean);

        return {
          id: c._id ? c._id.toString() : (c.id || c.name), // on node js code use 'id'
          vendorId: c.vendorId || activeVendorId,
          name: c.name,
          description: c.description,
          categoryVariationIds: refIdStrings, // reference Category Variation id on node js code use 'id'
          variationIds: refIdStrings,
          categoryVariationId: c.categoryVariationId ? c.categoryVariationId.toString() : (refIdStrings[0] || undefined),
          variations: populatedVariations.length > 0
            ? populatedVariations
            : (Array.isArray(c.variations) ? c.variations : [])
        };
      })
    };

    // Store in cache (5 minutes TTL)
    serverProductCache.set(cacheKey, payload, 5 * 60 * 1000, [
      'type:category',
      `cat_vendor:${activeVendorId}`
    ]);

    res.setHeader('X-Cache', 'MISS');
    return res.json(payload);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * POST /api/products/categories
 * Add category for the active vendor (Manager only)
 * Category references the Category Variation id (on table use '_id', on node js code use 'id')
 */
const categorySchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi'),
  description: z.string().optional(),
  categoryVariationIds: z.array(z.string()).optional(),
  variationIds: z.array(z.string()).optional(),
  categoryVariationId: z.string().optional(),
  variations: z.array(categoryVariationSchema).optional()
});

const categoryUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  categoryVariationIds: z.array(z.string()).optional(),
  variationIds: z.array(z.string()).optional(),
  categoryVariationId: z.string().optional(),
  variations: z.array(categoryVariationSchema).optional()
});

productRouter.post('/categories', authMiddleware, requireInventoryWriteAccess, async (req: Request, res: Response) => {
  try {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Data kategori tidak valid',
        details: parsed.error.issues
      });
    }

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || '6ab58389b2a71518d2beb887';
    const vendorOid = toVendorObjectId(activeVendorId);
    const vendorIdStr = vendorOid.toString();

    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    // Check if category name already exists for this vendor
    const existing = await db.collection('categories').findOne({
      name: { $regex: new RegExp(`^${parsed.data.name.trim()}$`, 'i') },
      ...buildVendorQuery(activeVendorId)
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Kategori dengan nama ini sudah ada untuk vendor Anda.'
      });
    }

    // Collect Category Variation ObjectIds
    const variationObjectIds: ObjectId[] = [];

    // 1. If explicit categoryVariationIds / variationIds provided
    const explicitIds = [
      ...(parsed.data.categoryVariationIds || []),
      ...(parsed.data.variationIds || []),
      ...(parsed.data.categoryVariationId ? [parsed.data.categoryVariationId] : [])
    ];

    for (const vId of explicitIds) {
      if (ObjectId.isValid(vId)) {
        const oid = new ObjectId(vId);
        if (!variationObjectIds.some(existingOid => existingOid.equals(oid))) {
          variationObjectIds.push(oid);
        }
      }
    }

    // 2. If inline variations were supplied, save them to category_variations table if not already present
    if (Array.isArray(parsed.data.variations) && parsed.data.variations.length > 0) {
      for (const v of parsed.data.variations) {
        if (v.id && ObjectId.isValid(v.id)) {
          const oid = new ObjectId(v.id);
          if (!variationObjectIds.some(existingOid => existingOid.equals(oid))) {
            variationObjectIds.push(oid);
          }
        } else {
          // Create new Category Variation document in category_variations table
          const newVarId = new ObjectId();
          const newVarDoc = {
            _id: newVarId, // on table use '_id'
            name: v.name.trim(),
            type: v.type || 'SINGLE_SELECT',
            required: !!v.required,
            options: (v.options || []).map((opt, oIdx) => ({
              id: opt.id || `opt_${Date.now()}_${oIdx}`,
              name: opt.name.trim(),
              extraPrice: Number(opt.extraPrice || 0),
              isDefault: !!opt.isDefault
            })),
            vendorId: vendorOid, // on table use ObjectId from table Vendor
            createdAt: new Date(),
            updatedAt: new Date()
          };
          await db.collection('category_variations').insertOne(newVarDoc);
          variationObjectIds.push(newVarId);
        }
      }
    }

    const newCategoryId = new ObjectId();
    const newCategoryDoc = {
      _id: newCategoryId, // on table use '_id', on node js code use 'id'
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || '',
      categoryVariationIds: variationObjectIds, // reference Category Variation id on table use '_id'
      variationIds: variationObjectIds,
      categoryVariationId: variationObjectIds[0] || null,
      vendorId: vendorOid, // on table use ObjectId from table Vendor
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('categories').insertOne(newCategoryDoc);

    // Invalidate categories cache for active vendor
    serverProductCache.invalidateCategories(vendorIdStr);

    await recordActivityLog({
      action: 'CREATE',
      entity: 'CATEGORY',
      entityId: newCategoryId.toString(),
      entityName: newCategoryDoc.name,
      summary: `Menambahkan kategori baru '${newCategoryDoc.name}' dengan ${variationObjectIds.length} variasi`,
      details: newCategoryDoc,
      req
    });

    // Populate variations for response
    const populatedVars = await db.collection('category_variations').find({
      _id: { $in: variationObjectIds }
    }).toArray();

    return res.status(201).json({
      success: true,
      category: {
        id: newCategoryId.toString(), // on node js code use 'id'
        vendorId: vendorIdStr, // on node js code use 'id'
        name: newCategoryDoc.name,
        description: newCategoryDoc.description,
        categoryVariationIds: variationObjectIds.map(oid => oid.toString()), // on node js code use 'id'
        variationIds: variationObjectIds.map(oid => oid.toString()),
        categoryVariationId: variationObjectIds[0]?.toString(),
        variations: populatedVars.map(pv => ({
          id: pv._id.toString(), // on node js code use 'id'
          name: pv.name,
          type: pv.type,
          required: pv.required,
          options: pv.options
        }))
      },
      message: 'Kategori berhasil disimpan!'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * PUT /api/products/categories/:id
 * Update category & variations (Manager only)
 * Category references the Category Variation id (on table use '_id', on node js code use 'id')
 */
productRouter.put('/categories/:id', authMiddleware, requireInventoryWriteAccess, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const parsed = categoryUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Data pembaruan kategori tidak valid',
        details: parsed.error.issues
      });
    }

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || '6ab58389b2a71518d2beb887';
    const activeVendorOid = toVendorObjectId(activeVendorId);
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db'
      });
    }

    // Find category strictly by ID or name AND vendorId
    let query: any = buildVendorQuery(activeVendorId);
    if (ObjectId.isValid(id)) {
      query._id = new ObjectId(id);
    } else {
      query.$or = [{ id }, { name: id }];
    }

    const category = await db.collection('categories').findOne(query);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Kategori tidak ditemukan atau bukan milik vendor Anda.'
      });
    }

    const catVendorOid = toVendorObjectId(category.vendorId || activeVendorId);
    const updateFields: any = {
      vendorId: catVendorOid,
      updatedAt: new Date()
    };

    if (parsed.data.name !== undefined) updateFields.name = parsed.data.name.trim();
    if (parsed.data.description !== undefined) updateFields.description = parsed.data.description.trim();

    // Check if variations or variation IDs are provided
    const hasVarUpdate = parsed.data.categoryVariationIds !== undefined ||
      parsed.data.variationIds !== undefined ||
      parsed.data.categoryVariationId !== undefined ||
      parsed.data.variations !== undefined;

    if (hasVarUpdate) {
      const variationObjectIds: ObjectId[] = [];

      const explicitIds = [
        ...(parsed.data.categoryVariationIds || []),
        ...(parsed.data.variationIds || []),
        ...(parsed.data.categoryVariationId ? [parsed.data.categoryVariationId] : [])
      ];

      for (const vId of explicitIds) {
        if (ObjectId.isValid(vId)) {
          const oid = new ObjectId(vId);
          if (!variationObjectIds.some(existingOid => existingOid.equals(oid))) {
            variationObjectIds.push(oid);
          }
        }
      }

      if (Array.isArray(parsed.data.variations)) {
        for (const v of parsed.data.variations) {
          if (v.id && ObjectId.isValid(v.id)) {
            const oid = new ObjectId(v.id);
            if (!variationObjectIds.some(existingOid => existingOid.equals(oid))) {
              variationObjectIds.push(oid);
            }
          } else {
            // Create new Category Variation document
            const newVarId = new ObjectId();
            const newVarDoc = {
              _id: newVarId,
              name: v.name.trim(),
              type: v.type || 'SINGLE_SELECT',
              required: !!v.required,
              options: (v.options || []).map((opt, oIdx) => ({
                id: opt.id || `opt_${Date.now()}_${oIdx}`,
                name: opt.name.trim(),
                extraPrice: Number(opt.extraPrice || 0),
                isDefault: !!opt.isDefault
              })),
              vendorId: catVendorOid,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await db.collection('category_variations').insertOne(newVarDoc);
            variationObjectIds.push(newVarId);
          }
        }
      }

      // Store references on table as ObjectId (on table use '_id')
      updateFields.categoryVariationIds = variationObjectIds;
      updateFields.variationIds = variationObjectIds;
      updateFields.categoryVariationId = variationObjectIds[0] || null;
    }

    await db.collection('categories').updateOne({ _id: category._id }, { $set: updateFields });

    // Invalidate categories cache
    serverProductCache.invalidateCategories(catVendorOid.toString());

    await recordActivityLog({
      action: 'UPDATE',
      entity: 'CATEGORY',
      entityId: category._id.toString(),
      entityName: updateFields.name || category.name,
      summary: `Memperbarui kategori '${updateFields.name || category.name}' dan variasinya`,
      details: updateFields,
      req
    });

    const updatedDoc = await db.collection('categories').findOne({ _id: category._id });
    const finalVarObjectIds: ObjectId[] = (updatedDoc?.categoryVariationIds || []).filter((v: any) => v instanceof ObjectId || ObjectId.isValid(v)).map((v: any) => v instanceof ObjectId ? v : new ObjectId(v));

    const populatedVars = finalVarObjectIds.length > 0
      ? await db.collection('category_variations').find({ _id: { $in: finalVarObjectIds } }).toArray()
      : [];

    return res.json({
      success: true,
      category: {
        id: updatedDoc?._id.toString() || id, // on node js code use 'id'
        vendorId: catVendorOid.toString(), // on node js code use 'id'
        name: updatedDoc?.name,
        description: updatedDoc?.description,
        categoryVariationIds: finalVarObjectIds.map(oid => oid.toString()), // on node js code use 'id'
        variationIds: finalVarObjectIds.map(oid => oid.toString()),
        categoryVariationId: finalVarObjectIds[0]?.toString(),
        variations: populatedVars.map(pv => ({
          id: pv._id.toString(), // on node js code use 'id'
          name: pv.name,
          type: pv.type,
          required: pv.required,
          options: pv.options
        }))
      },
      message: 'Kategori dan variasi berhasil diperbarui!'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * DELETE /api/products/categories/:id
 * Delete category (Manager only)
 */
productRouter.delete('/categories/:id', authMiddleware, requireInventoryWriteAccess, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || '6ab58389b2a71518d2beb887';

    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db'
      });
    }

    let query: any = buildVendorQuery(activeVendorId);
    if (ObjectId.isValid(id)) {
      query._id = new ObjectId(id);
    } else {
      query.$or = [{ id }, { name: id }];
    }

    const category = await db.collection('categories').findOne(query);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Kategori tidak ditemukan atau bukan milik vendor Anda.'
      });
    }

    await db.collection('categories').deleteOne({ _id: category._id });

    // Invalidate categories cache
    serverProductCache.invalidateCategories(activeVendorId);

    await recordActivityLog({
      action: 'DELETE',
      entity: 'CATEGORY',
      entityId: category._id.toString(),
      entityName: category.name,
      summary: `Menghapus kategori '${category.name}'`,
      details: { name: category.name },
      req
    });

    return res.json({
      success: true,
      message: `Kategori '${category.name}' berhasil dihapus!`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * GET /api/products
 * Public / Authenticated catalog with query params: ?category=kopi&search=latte (with Server Cache)
 */
productRouter.get('/', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;

    const isAdmin = (req as any).user?.role === 'ADMIN';
    const isAllVendors = (req.query.allVendors === 'true' || req.query.vendorId === 'all') && isAdmin;
    const requestedVendor = (req.query.vendorId as string) || '';
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || '6ab58389b2a71518d2beb887';
    const targetVendor = isAllVendors ? 'all' : (requestedVendor || activeVendorId);

    const bypassCache = req.query.bypassCache === 'true' || req.query.refresh === 'true';
    const cacheKey = `products:${targetVendor}:${category || 'all'}:${search || ''}`;

    // 1. Check in-memory server cache
    if (!bypassCache) {
      const cached = serverProductCache.get<any>(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Age-Ms', String(cached.ageMs));
        return res.json({
          ...cached.data,
          cached: true,
          cacheAgeMs: cached.ageMs
        });
      }
    }

    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    let products: any[] = [];
    try {
      const filter: any = {};
      if (isAllVendors) {
        // No vendor restriction across all vendors
      } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
        Object.assign(filter, buildVendorQuery(requestedVendor));
      } else {
        Object.assign(filter, buildVendorQuery(activeVendorId));
      }

      if (category && category !== 'all') {
        filter.category = category.toLowerCase();
      }
      if (search) {
        filter.name = { $regex: search, $options: 'i' };
      }
      products = await db.collection('products').find(filter).toArray();
    } catch (e) {}

    // Join with isolated product_stocks table
    const productIds = products.map(p => (p._id ? p._id.toString() : p.id));
    const productObjIds = productIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
    const stockMap = new Map<string, any>();
    try {
      const stockDocs = await db.collection('product_stocks').find({
        $or: [
          { productId: { $in: productIds } },
          { productId: { $in: productObjIds } }
        ]
      }).toArray();
      stockDocs.forEach(s => stockMap.set(String(s.productId), s));
    } catch (e) {}

    const payload = {
      success: true,
      vendorId: targetVendor,
      isAllVendors,
      cached: false,
      products: products.map(p => {
        const prodId = p._id ? p._id.toString() : p.id;
        const stockRec = stockMap.get(prodId);
        const pVendorOid = toVendorObjectId(p.vendorId || activeVendorId);
        return {
          id: prodId,
          vendorId: pVendorOid.toString(), // On Node.js code use 'id'
          name: p.name,
          category: p.category,
          price: p.price,
          stock: stockRec ? stockRec.stock : (typeof p.stock === 'number' ? p.stock : 0),
          lowStockThreshold: stockRec ? stockRec.lowStockThreshold : (typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 10),
          description: p.description,
          tag: p.tag,
          image: p.image,
          isAvailable: p.isAvailable !== false
        };
      })
    };

    // Cache products for 5 minutes
    const vendorTag = isAllVendors ? 'type:all_vendors' : `vendor:${targetVendor}`;
    serverProductCache.set(cacheKey, payload, 5 * 60 * 1000, [
      'type:product',
      vendorTag
    ]);

    res.setHeader('X-Cache', 'MISS');
    return res.json(payload);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * GET /api/products/stocks
 * Returns product stocks from dedicated product_stocks table joined with product metadata
 */
productRouter.get('/stocks', async (req: Request, res: Response) => {
  try {
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const isAllVendors = (req.query.allVendors === 'true' || req.query.vendorId === 'all') && isAdmin;
    const requestedVendor = (req.query.vendorId as string) || '';
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || '6ab58389b2a71518d2beb887';
    const targetVendor = isAllVendors ? 'all' : (requestedVendor || activeVendorId);

    const db = getDB();
    if (!db) {
      return res.status(503).json({ success: false, error: 'can not connect to db' });
    }

    let filter: any = {};
    if (isAllVendors) {
      // All vendors
    } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
      Object.assign(filter, buildVendorQuery(requestedVendor));
    } else {
      Object.assign(filter, buildVendorQuery(activeVendorId));
    }

    const products = await db.collection('products').find(filter).toArray();
    const productIds = products.map(p => (p._id ? p._id.toString() : p.id));
    const productObjIds = productIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));

    const stockDocs = await db.collection('product_stocks').find({
      $or: [
        { productId: { $in: productIds } },
        { productId: { $in: productObjIds } }
      ]
    }).toArray();
    const stockMap = new Map<string, any>();
    stockDocs.forEach(s => stockMap.set(String(s.productId), s));

    const stocks = products.map(p => {
      const prodId = p._id ? p._id.toString() : p.id;
      const s = stockMap.get(prodId);
      const pVendorOid = toVendorObjectId(p.vendorId || activeVendorId);
      return {
        id: s?._id ? s._id.toString() : `stk_${prodId}`,
        productId: prodId,
        vendorId: pVendorOid.toString(), // On Node.js code use 'id'
        productName: p.name,
        category: p.category,
        image: p.image,
        price: p.price,
        stock: s ? s.stock : 0,
        lowStockThreshold: s ? s.lowStockThreshold : 10,
        isAvailable: p.isAvailable !== false,
        updatedAt: s?.updatedAt || p.updatedAt
      };
    });

    return res.json({
      success: true,
      vendorId: targetVendor,
      isAllVendors,
      stocks
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * GET /api/products/inventory/alerts
 * Summary statistics and low-stock products below configurable threshold
 * RBAC: Manajemen Toko hanya boleh diakses role MANAGER (dan ADMIN)
 */
productRouter.get('/inventory/alerts', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const isAllVendors = (req.query.allVendors === 'true' || req.query.vendorId === 'all') && isAdmin;
    const requestedVendor = (req.query.vendorId as string) || '';
    const activeVendorId = req.vendorId || '6ab58389b2a71518d2beb887';

    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    let products: any[] = [];
    try {
      let query: any = {};
      if (isAllVendors) {
        query = {};
      } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
        query = buildVendorQuery(requestedVendor);
      } else {
        query = buildVendorQuery(activeVendorId);
      }
      products = await db.collection('products').find(query).toArray();
    } catch (e) {}

    const productIds = products.map(p => (p._id ? p._id.toString() : p.id));
    const productObjIds = productIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
    const stockDocs = await db.collection('product_stocks').find({
      $or: [
        { productId: { $in: productIds } },
        { productId: { $in: productObjIds } }
      ]
    }).toArray();
    const stockMap = new Map<string, any>();
    stockDocs.forEach(s => stockMap.set(String(s.productId), s));

    const mapped = products.map(p => {
      const prodId = p._id ? p._id.toString() : p.id;
      const s = stockMap.get(prodId);
      const threshold = s && typeof s.lowStockThreshold === 'number' ? s.lowStockThreshold : (typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 10);
      const stock = s && typeof s.stock === 'number' ? s.stock : (typeof p.stock === 'number' ? p.stock : 0);
      const isOutOfStock = stock === 0;
      const isLowStock = stock > 0 && stock <= threshold;
      const pVendorOid = toVendorObjectId(p.vendorId || activeVendorId);
      return {
        id: prodId,
        vendorId: pVendorOid.toString(), // On Node.js code use 'id'
        name: p.name,
        category: p.category,
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
 * RBAC: Manajemen Toko hanya boleh diakses role MANAGER (dan ADMIN)
 */
productRouter.get('/inventory/logs', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const isAllVendors = (req.query.allVendors === 'true' || req.query.vendorId === 'all') && isAdmin;
    const requestedVendor = (req.query.vendorId as string) || '';
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || '6ab58389b2a71518d2beb887';
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    let logs: any[] = [];
    try {
      let query: any = {};
      if (isAllVendors) {
        query = {};
      } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
        query = buildVendorQuery(requestedVendor);
      } else {
        query = buildVendorQuery(activeVendorId);
      }
      logs = await db.collection('inventory_logs').find(query).sort({ createdAt: -1 }).limit(200).toArray();
    } catch (e) {}

    return res.json({
      success: true,
      vendorId: isAllVendors ? 'all' : (requestedVendor || activeVendorId),
      isAllVendors,
      logs: logs.map(l => ({
        id: l._id ? l._id.toString() : l.id,
        vendorId: l.vendorId ? toVendorObjectId(l.vendorId).toString() : toVendorObjectId(activeVendorId).toString(),
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
 * Configure threshold globally or by category for active vendor (Manager only - ADMIN Read-Only)
 */
productRouter.post('/inventory/bulk-threshold', authMiddleware, requireInventoryWriteAccess, async (req: Request, res: Response) => {
  try {
    const { threshold, category } = req.body;
    const thresholdNum = Number(threshold);
    if (isNaN(thresholdNum) || thresholdNum < 0) {
      return res.status(400).json({ success: false, error: 'Batas threshold harus berupa angka positif' });
    }

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || '6ab58389b2a71518d2beb887';
    const vendorOid = toVendorObjectId(activeVendorId);
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    const filter: any = buildVendorQuery(activeVendorId);
    if (category && category !== 'all') {
      filter.category = category.toLowerCase();
    }

    try {
      const prodsToUpdate = await db.collection('products').find(filter).toArray();
      const pIds = prodsToUpdate.map(p => (p._id ? p._id.toString() : p.id));
      await db.collection('product_stocks').updateMany(
        { productId: { $in: pIds } },
        { $set: { lowStockThreshold: thresholdNum, updatedAt: new Date() } }
      );
    } catch (e) {}

    const logDoc = {
      vendorId: vendorOid,
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

    try {
      await db.collection('inventory_logs').insertOne(logDoc);
    } catch (e) {}

    // Record system-wide activity log
    await recordActivityLog({
      action: 'UPDATE',
      entity: 'INVENTORY',
      entityId: 'BULK',
      entityName: category && category !== 'all' ? `Kategori ${category}` : 'Semua Produk',
      summary: `Mengatur batas peringatan stok menjadi ${thresholdNum} untuk ${category && category !== 'all' ? `kategori ${category}` : 'seluruh produk'}`,
      details: { threshold: thresholdNum, category: category || 'all', vendorId: vendorOid.toString() },
      req
    });

    // Invalidate product cache for active vendor
    serverProductCache.invalidateProducts(vendorOid.toString());

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
 * Bulk import CSV to update prices & stock or add new products (Manager only - ADMIN Read-Only)
 */
productRouter.post('/inventory/import-csv', authMiddleware, requireInventoryWriteAccess, async (req: Request, res: Response) => {
  try {
    const { items, stockMode = 'set' } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Data baris CSV tidak boleh kosong' });
    }

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || '6ab58389b2a71518d2beb887';
    const vendorOid = toVendorObjectId(activeVendorId);
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    let currentProducts: any[] = [];
    try {
      const query = buildVendorQuery(activeVendorId);
      currentProducts = await db.collection('products').find(query).toArray();
    } catch (e) {}

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
        const prodVendorOid = toVendorObjectId(existing.vendorId || activeVendorId);
        const updateFields: any = { updatedAt: new Date(), vendorId: prodVendorOid };

        // Price update
        if (item.price !== undefined && item.price !== null && !isNaN(Number(item.price))) {
          const newPrice = Math.max(0, Math.round(Number(item.price)));
          updateFields.price = newPrice;
          existing.price = newPrice;
        }

        // Stock update in product_stocks table
        let stockChange = 0;
        let newStock = prevStock;
        if (item.stock !== undefined && item.stock !== null && !isNaN(Number(item.stock))) {
          const parsedStock = Math.floor(Number(item.stock));
          if (stockMode === 'add') {
            newStock = Math.max(0, prevStock + parsedStock);
          } else {
            newStock = Math.max(0, parsedStock);
          }
          stockChange = newStock - prevStock;
          existing.stock = newStock;
        }

        // Low stock threshold
        let newThresh = typeof existing.lowStockThreshold === 'number' ? existing.lowStockThreshold : 10;
        if (item.lowStockThreshold !== undefined && item.lowStockThreshold !== null && !isNaN(Number(item.lowStockThreshold))) {
          newThresh = Math.max(0, Math.floor(Number(item.lowStockThreshold)));
          existing.lowStockThreshold = newThresh;
        }

        // Category
        if (item.category && typeof item.category === 'string' && item.category.trim() !== '') {
          const newCat = item.category.trim().toLowerCase();
          updateFields.category = newCat;
          existing.category = newCat;
        }

        // Description
        if (item.description && typeof item.description === 'string') {
          updateFields.description = item.description.trim();
          existing.description = item.description.trim();
        }

        const existingId = existing._id ? existing._id.toString() : existing.id;
        try {
          const query: any = ObjectId.isValid(existingId) ? { _id: new ObjectId(existingId) } : { _id: existingId };
          await db.collection('products').updateOne(query, { $set: updateFields });
          await db.collection('product_stocks').updateOne(
            { productId: existingId },
            {
              $set: {
                stock: newStock,
                lowStockThreshold: newThresh,
                updatedAt: new Date()
              },
              $setOnInsert: { vendorId: prodVendorOid }
            },
            { upsert: true }
          );
        } catch (e) {}

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
            vendorId: prodVendorOid,
            productId: existingId,
            productName: existing.name,
            previousStock: prevStock,
            newStock,
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
        // CREATE new product (without stock in products table, stored in product_stocks table)
        const newStock = item.stock !== undefined && !isNaN(Number(item.stock)) ? Math.max(0, Math.floor(Number(item.stock))) : 0;
        const newPrice = item.price !== undefined && !isNaN(Number(item.price)) ? Math.max(0, Math.round(Number(item.price))) : 0;
        const newThreshold = item.lowStockThreshold !== undefined && !isNaN(Number(item.lowStockThreshold)) ? Math.max(0, Math.floor(Number(item.lowStockThreshold))) : 10;
        const newCat = (item.category && String(item.category).trim().toLowerCase()) || 'kopi';
        const newDesc = item.description ? String(item.description).trim() : '';
        const newImg = item.image ? String(item.image).trim() : '';

        const newDoc: any = {
          vendorId: vendorOid, // On table use ObjectId from table Vendor
          name: rawName,
          category: newCat,
          price: newPrice,
          description: newDesc,
          image: newImg,
          isAvailable: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        let insertedId = new ObjectId().toString();
        try {
          const resInsert = await db.collection('products').insertOne(newDoc);
          insertedId = resInsert.insertedId.toString();
          await db.collection('product_stocks').insertOne({
            productId: insertedId,
            vendorId: vendorOid, // On table use ObjectId
            stock: newStock,
            lowStockThreshold: newThreshold,
            updatedAt: new Date()
          });
        } catch (e) {}
        newDoc._id = insertedId;
        newDoc.id = insertedId;
        newDoc.stock = newStock;
        newDoc.lowStockThreshold = newThreshold;
        currentProducts.push(newDoc);

        const logDoc = {
          vendorId: vendorOid,
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
      try {
        await db.collection('inventory_logs').insertMany(inventoryLogs);
      } catch (e) {}
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

    // Invalidate product cache for active vendor
    serverProductCache.invalidateProducts(activeVendorId);

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
 * Manual stock update & threshold configuration (Manager only - ADMIN Read-Only)
 */
productRouter.patch('/:id/stock', authMiddleware, requireInventoryWriteAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as IParam;
    const { stock, adjustment, lowStockThreshold, reason, isAvailable, temporaryUnavailableReason } = req.body;

    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    let product: any = null;
    try {
      const query: any = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
      product = await db.collection('products').findOne(query);
    } catch (e) {}

    if (!product) {
      return res.status(404).json({ success: false, error: 'Produk tidak ditemukan' });
    }

    const user = (req as any).user;
    const activeVendorId = user?.vendorId || req.vendorId || '6ab58389b2a71518d2beb887';
    const activeVendorOid = toVendorObjectId(activeVendorId);
    const prodVendorOid = toVendorObjectId(product.vendorId);
    const isOwner = prodVendorOid.toString() === activeVendorOid.toString();

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Akses Ditolak: Anda tidak berhak mengubah stok produk milik vendor lain.'
      });
    }

    const prodIdStr = product._id ? product._id.toString() : id;
    const stockDoc = await db.collection('product_stocks').findOne({ productId: prodIdStr });
    const currentStock = stockDoc && typeof stockDoc.stock === 'number' ? stockDoc.stock : (typeof product.stock === 'number' ? product.stock : 0);
    let newStock = currentStock;

    if (typeof stock === 'number') {
      newStock = Math.max(0, Math.floor(stock));
    } else if (typeof adjustment === 'number') {
      newStock = Math.max(0, currentStock + Math.floor(adjustment));
    }

    const currentThreshold = stockDoc && typeof stockDoc.lowStockThreshold === 'number' ? stockDoc.lowStockThreshold : (typeof product.lowStockThreshold === 'number' ? product.lowStockThreshold : 10);
    const newThreshold = typeof lowStockThreshold === 'number' ? Math.max(0, Math.floor(lowStockThreshold)) : currentThreshold;

    const stockUpdateFields: any = {
      stock: newStock,
      lowStockThreshold: newThreshold,
      updatedAt: new Date()
    };

    try {
      await db.collection('product_stocks').updateOne(
        { productId: prodIdStr },
        { $set: stockUpdateFields, $setOnInsert: { vendorId: prodVendorOid } },
        { upsert: true }
      );
    } catch (e) {}

    const prodUpdateFields: any = {
      updatedAt: new Date()
    };
    if (typeof isAvailable === 'boolean') {
      prodUpdateFields.isAvailable = isAvailable;
      if (!isAvailable) {
        prodUpdateFields.temporaryUnavailableReason = temporaryUnavailableReason ? String(temporaryUnavailableReason).trim() : 'Habis / Tidak tersedia sementara';
      } else {
        prodUpdateFields.temporaryUnavailableReason = null;
      }
    } else if (temporaryUnavailableReason !== undefined) {
      prodUpdateFields.temporaryUnavailableReason = temporaryUnavailableReason ? String(temporaryUnavailableReason).trim() : null;
    }

    try {
      const query: any = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
      await db.collection('products').updateOne(query, { $set: { ...prodUpdateFields, vendorId: prodVendorOid } });
    } catch (e) {}

    const stockChange = newStock - currentStock;
    const logDoc = {
      vendorId: prodVendorOid,
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

    try {
      await db.collection('inventory_logs').insertOne(logDoc);
    } catch (e) {}

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
        lowStockThreshold: newThreshold,
        reason
      },
      req
    });

    // Invalidate product cache for product's vendor
    serverProductCache.invalidateProducts(prodVendorOid.toString());

    return res.json({
      success: true,
      message: `Stok ${product.name} berhasil diperbarui menjadi ${newStock}!`,
      product: {
        id: product._id ? product._id.toString() : product.id,
        name: product.name,
        stock: newStock,
        lowStockThreshold: newThreshold,
        isAvailable: prodUpdateFields.isAvailable !== undefined ? prodUpdateFields.isAvailable : (product.isAvailable !== false),
        temporaryUnavailableReason: prodUpdateFields.temporaryUnavailableReason !== undefined ? prodUpdateFields.temporaryUnavailableReason : product.temporaryUnavailableReason
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * POST /api/products
 * Create product (Manager only - ADMIN Read-Only)
 */
productRouter.post('/', authMiddleware, requireInventoryWriteAccess, async (req: Request, res: Response) => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: parsed.error.format()
      });
    }

    const { stock, lowStockThreshold, ...productCleanData } = parsed.data;
    const user = (req as any).user;
    const activeVendorId = user?.vendorId || req.vendorId || '6ab58389b2a71518d2beb887';
    const vendorOid = toVendorObjectId(activeVendorId);
    const vendorIdStr = vendorOid.toString();

    const newProd = {
      ...productCleanData,
      category: parsed.data.category.toLowerCase().trim(),
      vendorId: vendorOid, // On table use ObjectId from table Vendor
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    let insertedId = new ObjectId().toString();
    const stockVal = typeof stock === 'number' ? Math.max(0, Math.floor(stock)) : 20;
    const thresholdVal = typeof lowStockThreshold === 'number' ? Math.max(0, Math.floor(lowStockThreshold)) : 10;

    try {
      const result = await db.collection('products').insertOne(newProd);
      insertedId = result.insertedId.toString();

      // Store in new product_stocks table with Vendor ObjectId
      await db.collection('product_stocks').insertOne({
        productId: insertedId,
        vendorId: vendorOid, // On table use ObjectId
        stock: stockVal,
        lowStockThreshold: thresholdVal,
        updatedAt: new Date()
      });
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Failed to create product in db' });
    }

    // Record system-wide activity log
    await recordActivityLog({
      action: 'CREATE',
      entity: 'PRODUCT',
      entityId: insertedId,
      entityName: newProd.name,
      summary: `Menambahkan produk baru '${newProd.name}' (${newProd.category}) - Rp ${newProd.price.toLocaleString('id-ID')} (Stok: ${stockVal})`,
      details: {
        id: insertedId,
        name: newProd.name,
        category: newProd.category,
        price: newProd.price,
        stock: stockVal,
        lowStockThreshold: thresholdVal,
        vendorId: vendorIdStr
      },
      req
    });

    // Invalidate product cache for active vendor
    serverProductCache.invalidateProducts(vendorIdStr);

    return res.status(201).json({
      success: true,
      message: 'Produk berhasil ditambahkan!',
      product: {
        id: insertedId,
        ...productCleanData,
        category: newProd.category,
        vendorId: vendorIdStr, // On Node.js code use 'id'
        stock: stockVal,
        lowStockThreshold: thresholdVal,
        createdAt: newProd.createdAt,
        updatedAt: newProd.updatedAt
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * GET /api/products/:id
 * Retrieve a single product by ID
 */
productRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const db = getDB();
    if (!db) {
      return res.status(503).json({ success: false, error: 'can not connect to db' });
    }

    const p = await db.collection('products').findOne({ _id: new ObjectId(id) });
    if (!p) {
      return res.status(404).json({ success: false, error: 'Produk tidak ditemukan' });
    }

    const prodId = p._id ? p._id.toString() : p.id;
    const stockRec = await db.collection('product_stocks').findOne({
      $or: [
        { productId: prodId },
        ...(ObjectId.isValid(prodId) ? [{ productId: new ObjectId(prodId) }] : [])
      ]
    });

    const pVendorOid = toVendorObjectId(p.vendorId);
    return res.json({
      success: true,
      product: {
        id: prodId,
        vendorId: pVendorOid.toString(), // On Node.js code use 'id'
        name: p.name,
        category: p.category,
        price: p.price,
        stock: stockRec ? stockRec.stock : (typeof p.stock === 'number' ? p.stock : 0),
        lowStockThreshold: stockRec ? stockRec.lowStockThreshold : (typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 10),
        description: p.description,
        tag: p.tag,
        image: p.image,
        isAvailable: p.isAvailable !== false
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * PUT /api/products/:id
 * Update product (Manager only - ADMIN Read-Only)
 */
productRouter.put('/:id', authMiddleware, requireInventoryWriteAccess, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const updateData: any = { ...req.body, updatedAt: new Date() };

    if (updateData.category) {
      updateData.category = String(updateData.category).toLowerCase().trim();
    }
    if (updateData.price !== undefined) {
      updateData.price = Math.max(0, Number(updateData.price));
    }

    // Handle stock update in isolated product_stocks table
    const stockToUpdate: any = {};
    if (updateData.stock !== undefined) {
      stockToUpdate.stock = Math.max(0, Math.floor(Number(updateData.stock)));
      delete updateData.stock;
    }
    if (updateData.lowStockThreshold !== undefined) {
      stockToUpdate.lowStockThreshold = Math.max(0, Math.floor(Number(updateData.lowStockThreshold)));
      delete updateData.lowStockThreshold;
    }

    const user = (req as any).user;
    const activeVendorId = user?.vendorId || req.vendorId || '6ab58389b2a71518d2beb887';
    const activeVendorOid = toVendorObjectId(activeVendorId);
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    let existingProd: any = null;
    let query: any = {};
    try {
      query = ObjectId.isValid(id)
        ? { $or: [{ _id: new ObjectId(id) }, { id }, { _id: id }] }
        : { $or: [{ id }, { _id: id }] };
      existingProd = await db.collection('products').findOne(query);
    } catch (e) {}

    if (!existingProd) {
      return res.status(404).json({ success: false, error: 'Produk tidak ditemukan.' });
    }

    const prodVendorOid = toVendorObjectId(existingProd.vendorId);
    const isOwner = prodVendorOid.toString() === activeVendorOid.toString();

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Akses Ditolak: Anda tidak berhak mengubah produk milik vendor lain.'
      });
    }

    const prodIdStr = existingProd._id ? existingProd._id.toString() : id;
    if (Object.keys(stockToUpdate).length > 0) {
      stockToUpdate.updatedAt = new Date();
      try {
        await db.collection('product_stocks').updateOne(
          { productId: prodIdStr },
          { $set: stockToUpdate, $setOnInsert: { vendorId: prodVendorOid, stock: 20, lowStockThreshold: 10 } },
          { upsert: true }
        );
      } catch (e) {}
    }

    // Do not overwrite _id or id; ensure vendorId is properly set to Vendor ObjectId
    delete updateData._id;
    delete updateData.id;
    delete updateData.vendorId;

    try {
      await db.collection('products').updateOne(
        { _id: existingProd._id },
        { $set: { ...updateData, vendorId: prodVendorOid } }
      );
    } catch (e) {}

    const prodName = updateData.name || existingProd.name || id;

    // Record system-wide activity log
    await recordActivityLog({
      action: 'UPDATE',
      entity: 'PRODUCT',
      entityId: id,
      entityName: prodName,
      summary: `Memperbarui data produk '${prodName}'`,
      details: {
        productId: id,
        updates: updateData,
        stockUpdates: stockToUpdate
      },
      req
    });

    // Invalidate product cache for active vendor
    serverProductCache.invalidateProducts(activeVendorOid.toString());

    const updatedProduct = await db.collection('products').findOne({ _id: existingProd._id });
    const stockDoc = await db.collection('product_stocks').findOne({ productId: prodIdStr });

    return res.json({
      success: true,
      message: 'Produk berhasil diperbarui!',
      product: {
        id: updatedProduct?._id ? updatedProduct._id.toString() : id,
        vendorId: prodVendorOid.toString(), // On Node.js code use 'id'
        name: updatedProduct?.name,
        category: updatedProduct?.category,
        price: updatedProduct?.price,
        stock: stockDoc ? stockDoc.stock : (typeof stockToUpdate.stock === 'number' ? stockToUpdate.stock : 0),
        lowStockThreshold: stockDoc ? stockDoc.lowStockThreshold : (typeof stockToUpdate.lowStockThreshold === 'number' ? stockToUpdate.lowStockThreshold : 10),
        description: updatedProduct?.description,
        tag: updatedProduct?.tag,
        image: updatedProduct?.image,
        isAvailable: updatedProduct?.isAvailable
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * DELETE /api/products/:id
 * Delete product (Manager only - ADMIN Read-Only)
 */
productRouter.delete('/:id', authMiddleware, requireInventoryWriteAccess, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const user = (req as any).user;
    const activeVendorId = user?.vendorId || req.vendorId || '6ab58389b2a71518d2beb887';
    const activeVendorOid = toVendorObjectId(activeVendorId);
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    let targetProd: any = null;
    let query: any = {};
    try {
      query = ObjectId.isValid(id)
        ? { $or: [{ _id: new ObjectId(id) }, { id }, { _id: id }] }
        : { $or: [{ id }, { _id: id }] };
      targetProd = await db.collection('products').findOne(query);
    } catch (e) {}

    if (!targetProd) {
      return res.status(404).json({ success: false, error: 'Produk tidak ditemukan.' });
    }

    const prodVendorOid = toVendorObjectId(targetProd.vendorId);
    const isOwner = prodVendorOid.toString() === activeVendorOid.toString();

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Akses Ditolak: Anda tidak berhak menghapus produk milik vendor lain.'
      });
    }

    const targetProdIdStr = targetProd._id ? targetProd._id.toString() : targetProd.id;
    try {
      await db.collection('products').deleteOne({ _id: targetProd._id });
      await db.collection('product_stocks').deleteOne({ productId: targetProdIdStr });
    } catch (e) {}

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

    // Invalidate product cache for active vendor
    serverProductCache.invalidateProducts(activeVendorOid.toString());

    return res.json({
      success: true,
      message: `Produk '${prodName}' berhasil dihapus dari database.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});
