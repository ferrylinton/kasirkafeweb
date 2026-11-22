import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB, connectDB } from '../db';
import { authMiddleware, requireManager } from '../auth';
import { ObjectId } from 'mongodb';
import { recordActivityLog } from '../activityLogger';
import { IParam } from '@/src/types';
import { serverProductCache } from '../cache/productCache';
import {
  getVendorStockMode,
  computeRawMaterialProductStock
} from '../stockSync';
import { StockManagementMode, resolveVendorId, buildVendorQuery, CENTRAL_VENDOR_ID } from '../vendorMiddleware';

function isVendorOwner(docVendorId: any, activeVendorId: string): boolean {
  const normalizedDoc = resolveVendorId(docVendorId ? String(docVendorId) : CENTRAL_VENDOR_ID);
  const normalizedActive = resolveVendorId(activeVendorId);
  return normalizedDoc === normalizedActive;
}

function normalizeEntityName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function normalizeCategoryName(name: string): string {
  return normalizeEntityName(name);
}

function normalizeProductName(name: string): string {
  return normalizeEntityName(name);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildDuplicateNameRegex(normalizedName: string): RegExp {
  const pattern = `^\\s*${escapeRegExp(normalizedName).replace(/ /g, '\\s+')}\\s*$`;
  return new RegExp(pattern, 'i');
}

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

const productSchema = z.object({
  name: z.string().min(2, 'Nama produk minimal 2 karakter'),
  category: z.string().min(1, 'Kategori wajib dipilih'),
  price: z.number().min(0, 'Harga tidak boleh negatif'),
  stock: z.number().int().min(0, 'Stok minimal 0'),
  lowStockThreshold: z.number().int().min(0).default(10),
  description: z.string().optional(),
  tag: z.string().optional(),
  image: z.string().url('URL gambar tidak valid').or(z.literal('')).optional(),
  isAvailable: z.boolean().default(true),
  variationIds: z.array(z.string()).optional()
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
  const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
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
 * GET /api/products/categories
 * Returns categories strictly partitioned by active vendor (with Server In-Memory Cache)
 */
productRouter.get('/categories', async (req: Request, res: Response) => {
  try {
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
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

    // Deduplicate by normalized category name in case legacy DB has duplicate rows
    const dedupedMap = new Map<string, any>();
    for (const c of categories) {
      const normKey = normalizeCategoryName(String(c.name || '')).toLowerCase();
      if (!normKey) continue;
      if (!dedupedMap.has(normKey)) {
        dedupedMap.set(normKey, c);
      }
    }
    const uniqueCategories = Array.from(dedupedMap.values());

    const payload = {
      success: true,
      vendorId: activeVendorId,
      cached: false,
      categories: uniqueCategories.map(c => ({
        id: c._id ? c._id.toString() : (c.id || c.name),
        vendorId: c.vendorId ? resolveVendorId(String(c.vendorId)) : resolveVendorId(activeVendorId),
        name: normalizeCategoryName(String(c.name || '')),
        description: c.description
      }))
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
 */
const categorySchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi'),
  description: z.string().optional()
});

const categoryUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional()
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

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const normalizedName = normalizeCategoryName(parsed.data.name);
    if (!normalizedName) {
      return res.status(400).json({
        success: false,
        error: 'Nama kategori tidak boleh kosong'
      });
    }

    const newCategory = {
      name: normalizedName,
      description: parsed.data.description?.trim() || '',
      vendorId: activeVendorId,
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

    // Check if category name already exists for this vendor (case-insensitive, whitespace-normalized)
    const duplicatePattern = `^\\s*${escapeRegExp(normalizedName).replace(/ /g, '\\s+')}\\s*$`;
    const existing = await db.collection('categories').findOne({
      $and: [
        buildVendorQuery(activeVendorId),
        { name: { $regex: new RegExp(duplicatePattern, 'i') } }
      ]
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Kategori dengan nama '${normalizedName}' sudah ada untuk vendor Anda.`
      });
    }

    let insertedId = `cat_${Date.now()}`;
    try {
      const result = await db.collection('categories').insertOne(newCategory);
      insertedId = result.insertedId.toString();
    } catch (e: any) {
      if (e?.code === 11000) {
        return res.status(409).json({
          success: false,
          error: `Kategori dengan nama '${normalizedName}' sudah ada untuk vendor Anda.`
        });
      }
      throw e;
    }

    // Invalidate categories cache for active vendor
    serverProductCache.invalidateCategories(activeVendorId);

    await recordActivityLog({
      action: 'CREATE',
      entity: 'CATEGORY',
      entityId: insertedId,
      entityName: newCategory.name,
      summary: `Menambahkan kategori baru '${newCategory.name}'`,
      details: newCategory,
      req
    });

    return res.status(201).json({
      success: true,
      category: { id: insertedId, ...newCategory },
      message: 'Kategori berhasil disimpan!'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * PUT /api/products/categories/:id
 * Update category (Manager only)
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

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db'
      });
    }

    // Find category strictly by ID or name AND vendorId
    const idOrNameQuery: any = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { $or: [{ id }, { name: id }] };
    const query = { $and: [buildVendorQuery(activeVendorId), idOrNameQuery] };

    const category = await db.collection('categories').findOne(query);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Kategori tidak ditemukan atau bukan milik vendor Anda.'
      });
    }

    const updateFields: any = {
      updatedAt: new Date()
    };

    if (parsed.data.name !== undefined) {
      const normalizedName = normalizeCategoryName(parsed.data.name);
      if (!normalizedName) {
        return res.status(400).json({
          success: false,
          error: 'Nama kategori tidak boleh kosong'
        });
      }

      const duplicatePattern = `^\\s*${escapeRegExp(normalizedName).replace(/ /g, '\\s+')}\\s*$`;
      const duplicateCategory = await db.collection('categories').findOne({
        $and: [
          buildVendorQuery(activeVendorId),
          { _id: { $ne: category._id } },
          { name: { $regex: new RegExp(duplicatePattern, 'i') } }
        ]
      });

      if (duplicateCategory) {
        return res.status(409).json({
          success: false,
          error: `Kategori dengan nama '${normalizedName}' sudah ada untuk vendor Anda.`
        });
      }

      updateFields.name = normalizedName;
    }
    if (parsed.data.description !== undefined) updateFields.description = parsed.data.description.trim();

    try {
      await db.collection('categories').updateOne({ _id: category._id }, { $set: updateFields });
    } catch (e: any) {
      if (e?.code === 11000) {
        return res.status(409).json({
          success: false,
          error: `Kategori dengan nama '${updateFields.name || category.name}' sudah ada untuk vendor Anda.`
        });
      }
      throw e;
    }

    // Invalidate categories cache
    serverProductCache.invalidateCategories(activeVendorId);

    await recordActivityLog({
      action: 'UPDATE',
      entity: 'CATEGORY',
      entityId: category._id.toString(),
      entityName: updateFields.name || category.name,
      summary: `Memperbarui kategori '${updateFields.name || category.name}'`,
      details: updateFields,
      req
    });

    const updatedDoc = await db.collection('categories').findOne({ _id: category._id });

    return res.json({
      success: true,
      category: {
        id: updatedDoc?._id.toString() || id,
        vendorId: updatedDoc?.vendorId,
        name: updatedDoc?.name,
        description: updatedDoc?.description
      },
      message: 'Kategori berhasil diperbarui!'
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
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';

    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db'
      });
    }

    const idOrNameQuery: any = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { $or: [{ id }, { name: id }] };
    const query = { $and: [buildVendorQuery(activeVendorId), idOrNameQuery] };

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
 * GET /api/products/product-variations
 * List product variations for active vendor (or all vendors for admin), linked to products
 */
productRouter.get('/product-variations', async (req: Request, res: Response) => {
  try {
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const isAllVendors = (req.query.allVendors === 'true' || req.query.vendorId === 'all') && isAdmin;
    const requestedVendor = (req.query.vendorId as string) || '';
    const targetVendor = isAllVendors ? 'all' : (requestedVendor || activeVendorId);

    const db = getDB();
    if (!db) {
      return res.status(503).json({ success: false, error: 'Database not available' });
    }

    const varQuery = targetVendor === 'all' ? {} : buildVendorQuery(targetVendor);
    const prodQuery = targetVendor === 'all' ? {} : buildVendorQuery(targetVendor);

    const [variationsDocs, productsDocs] = await Promise.all([
      db.collection('product_variations').find(varQuery).toArray().catch(() => []),
      db.collection('products').find(prodQuery).toArray().catch(() => [])
    ]);

    const variationsMap = new Map<string, any>();
    for (const v of variationsDocs) {
      const vId = v.id || v._id?.toString();
      const normVendor = resolveVendorId(String(v.vendorId || activeVendorId));
      const normName = normalizeEntityName(String(v.name || ''));
      const linkedProds = productsDocs.filter(p => {
        const pId = p._id ? p._id.toString() : String(p.id);
        const matchesProdList = Array.isArray(v.productIds) && v.productIds.includes(pId);
        const matchesProdField = Array.isArray(p.variationIds) && p.variationIds.includes(vId);
        return matchesProdList || matchesProdField;
      });
      const productIds = Array.from(new Set(linkedProds.map(p => (p._id ? p._id.toString() : String(p.id)))));
      const productNames = Array.from(new Set(linkedProds.map(p => String(p.name || '')).filter(Boolean)));

      variationsMap.set(vId, {
        id: vId,
        vendorId: normVendor,
        name: normName,
        type: v.type || 'SINGLE_SELECT',
        required: !!v.required,
        options: Array.isArray(v.options) ? v.options : [],
        productIds,
        productNames,
        usedInProductsCount: productNames.length,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt
      });
    }

    return res.json({
      success: true,
      variations: Array.from(variationsMap.values())
    });
  } catch (err: any) {
    console.error('Error fetching product-variations:', err);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * POST /api/products/product-variations
 * Create a new master product variation and link it to selected products
 */
productRouter.post('/product-variations', authMiddleware, requireInventoryWriteAccess, async (req: Request, res: Response) => {
  try {
    const { name, type, required, options, productIds } = req.body;
    const normalizedName = typeof name === 'string' ? normalizeEntityName(name) : '';
    if (normalizedName.length < 2) {
      return res.status(400).json({ success: false, error: 'Nama variasi minimal 2 karakter' });
    }

    const allowedTypes = ['SINGLE_SELECT', 'MULTI_SELECT', 'RADIO', 'CHECKBOX'];
    const safeType = allowedTypes.includes(String(type)) ? String(type) : 'SINGLE_SELECT';

    if (!Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ success: false, error: 'Variasi harus memiliki minimal satu opsi pilihan' });
    }

    const formattedOptions: any[] = [];
    for (let idx = 0; idx < options.length; idx++) {
      const opt = options[idx];
      const optName = typeof opt?.name === 'string' ? normalizeEntityName(opt.name) : '';
      if (!optName) {
        return res.status(400).json({ success: false, error: `Nama opsi ke-${idx + 1} wajib diisi` });
      }
      const extraPrice = Number(opt?.extraPrice ?? 0);
      if (Number.isNaN(extraPrice) || extraPrice < 0) {
        return res.status(400).json({ success: false, error: `Harga ekstra opsi '${optName}' tidak boleh negatif` });
      }
      formattedOptions.push({
        id: opt.id || `opt_${Date.now()}_${idx}`,
        name: optName,
        extraPrice: Math.round(extraPrice),
        isDefault: !!opt.isDefault
      });
    }

    const user = (req as any).user;
    const activeVendorId = resolveVendorId(user?.vendorId || req.vendorId || CENTRAL_VENDOR_ID);
    const db = getDB();
    if (!db) {
      return res.status(503).json({ success: false, error: 'Database tidak tersedia' });
    }

    const duplicateVar = await db.collection('product_variations').findOne({
      $and: [
        buildVendorQuery(activeVendorId),
        { name: { $regex: buildDuplicateNameRegex(normalizedName) } }
      ]
    });
    if (duplicateVar) {
      return res.status(409).json({
        success: false,
        error: `Variasi produk dengan nama '${normalizedName}' sudah ada untuk vendor Anda.`
      });
    }

    const varId = `var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const cleanProductIds = Array.isArray(productIds) ? Array.from(new Set(productIds.map(String))) : [];

    const newDoc = {
      id: varId,
      vendorId: activeVendorId,
      name: normalizedName,
      type: safeType,
      required: !!required,
      options: formattedOptions,
      productIds: cleanProductIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('product_variations').insertOne(newDoc);

    // Sync variationIds on selected products for this vendor
    if (cleanProductIds.length > 0) {
      const objIds = cleanProductIds.filter(pid => ObjectId.isValid(pid)).map(pid => new ObjectId(pid));
      await db.collection('products').updateMany(
        {
          $and: [
            buildVendorQuery(activeVendorId),
            { $or: [{ _id: { $in: objIds } }, { id: { $in: cleanProductIds } }] }
          ]
        },
        { $addToSet: { variationIds: varId }, $set: { updatedAt: new Date() } }
      );
    }

    await recordActivityLog({
      action: 'CREATE',
      entity: 'PRODUCT',
      entityId: varId,
      entityName: normalizedName,
      summary: `Menambahkan variasi produk '${normalizedName}' (${formattedOptions.length} opsi, tertaut ke ${cleanProductIds.length} produk)`,
      details: {
        variationId: varId,
        type: safeType,
        required: !!required,
        optionsCount: formattedOptions.length,
        productIds: cleanProductIds
      },
      req
    });

    serverProductCache.invalidateProducts(activeVendorId);

    return res.status(201).json({
      success: true,
      message: 'Variasi produk berhasil dibuat!',
      variation: newDoc
    });
  } catch (err: any) {
    console.error('Error creating product-variation:', err);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * PUT /api/products/product-variations/:id
 * Update a product variation and sync linked products
 */
productRouter.put('/product-variations/:id', authMiddleware, requireInventoryWriteAccess, async (req: Request, res: Response) => {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const { name, type, required, options, productIds } = req.body;
    const user = (req as any).user;
    const activeVendorId = resolveVendorId(user?.vendorId || req.vendorId || CENTRAL_VENDOR_ID);

    const db = getDB();
    if (!db) {
      return res.status(503).json({ success: false, error: 'Database tidak tersedia' });
    }

    const idQuery = ObjectId.isValid(id) ? { $or: [{ _id: new ObjectId(id) }, { id }] } : { id };
    const vendorScopedQuery = { $and: [buildVendorQuery(activeVendorId), idQuery] };
    const existingVar = await db.collection('product_variations').findOne(vendorScopedQuery);
    if (!existingVar) {
      return res.status(404).json({ success: false, error: 'Variasi produk tidak ditemukan.' });
    }

    const updateFields: any = {
      updatedAt: new Date().toISOString()
    };

    if (name !== undefined) {
      const normalizedName = normalizeEntityName(String(name));
      if (normalizedName.length < 2) {
        return res.status(400).json({ success: false, error: 'Nama variasi minimal 2 karakter' });
      }
      const duplicateVar = await db.collection('product_variations').findOne({
        $and: [
          buildVendorQuery(activeVendorId),
          { _id: { $ne: existingVar._id } },
          { name: { $regex: buildDuplicateNameRegex(normalizedName) } }
        ]
      });
      if (duplicateVar) {
        return res.status(409).json({
          success: false,
          error: `Variasi produk dengan nama '${normalizedName}' sudah ada untuk vendor Anda.`
        });
      }
      updateFields.name = normalizedName;
    }

    const allowedTypes = ['SINGLE_SELECT', 'MULTI_SELECT', 'RADIO', 'CHECKBOX'];
    if (type !== undefined) {
      if (!allowedTypes.includes(String(type))) {
        return res.status(400).json({ success: false, error: 'Tipe seleksi variasi tidak valid' });
      }
      updateFields.type = String(type);
    }

    if (typeof required === 'boolean') {
      updateFields.required = required;
    }

    if (options !== undefined) {
      if (!Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ success: false, error: 'Variasi harus memiliki minimal satu opsi pilihan' });
      }
      const formattedOptions: any[] = [];
      for (let idx = 0; idx < options.length; idx++) {
        const opt = options[idx];
        const optName = typeof opt?.name === 'string' ? normalizeEntityName(opt.name) : '';
        if (!optName) {
          return res.status(400).json({ success: false, error: `Nama opsi ke-${idx + 1} wajib diisi` });
        }
        const extraPrice = Number(opt?.extraPrice ?? 0);
        if (Number.isNaN(extraPrice) || extraPrice < 0) {
          return res.status(400).json({ success: false, error: `Harga ekstra opsi '${optName}' tidak boleh negatif` });
        }
        formattedOptions.push({
          id: opt.id || `opt_${Date.now()}_${idx}`,
          name: optName,
          extraPrice: Math.round(extraPrice),
          isDefault: !!opt.isDefault
        });
      }
      updateFields.options = formattedOptions;
    }

    const cleanProductIds = Array.isArray(productIds) ? Array.from(new Set(productIds.map(String))) : undefined;
    if (cleanProductIds !== undefined) {
      updateFields.productIds = cleanProductIds;
    }

    await db.collection('product_variations').updateOne({ _id: existingVar._id }, { $set: updateFields });

    const canonicalVarId = String(existingVar.id || id);
    // Sync variationIds on this vendor's products when productIds provided
    if (cleanProductIds !== undefined) {
      const objIds = cleanProductIds.filter(pid => ObjectId.isValid(pid)).map(pid => new ObjectId(pid));
      // Remove from products no longer linked
      await db.collection('products').updateMany(
        buildVendorQuery(activeVendorId),
        { $pull: { variationIds: { $in: Array.from(new Set([canonicalVarId, id])) } } as any }
      );
      if (cleanProductIds.length > 0) {
        await db.collection('products').updateMany(
          {
            $and: [
              buildVendorQuery(activeVendorId),
              { $or: [{ _id: { $in: objIds } }, { id: { $in: cleanProductIds } }] }
            ]
          },
          { $addToSet: { variationIds: canonicalVarId }, $set: { updatedAt: new Date() } }
        );
      }
    }

    const updatedVar = await db.collection('product_variations').findOne({ _id: existingVar._id });

    await recordActivityLog({
      action: 'UPDATE',
      entity: 'PRODUCT',
      entityId: canonicalVarId,
      entityName: updatedVar?.name || existingVar.name,
      summary: `Memperbarui variasi produk '${updatedVar?.name || existingVar.name}'`,
      details: {
        variationId: canonicalVarId,
        updates: updateFields
      },
      req
    });

    serverProductCache.invalidateProducts(activeVendorId);

    return res.json({
      success: true,
      message: 'Variasi produk berhasil diperbarui!',
      variation: updatedVar
        ? {
            id: updatedVar.id || updatedVar._id?.toString(),
            vendorId: resolveVendorId(String(updatedVar.vendorId || activeVendorId)),
            name: updatedVar.name,
            type: updatedVar.type || 'SINGLE_SELECT',
            required: !!updatedVar.required,
            options: Array.isArray(updatedVar.options) ? updatedVar.options : [],
            productIds: Array.isArray(updatedVar.productIds) ? updatedVar.productIds : [],
            updatedAt: updatedVar.updatedAt
          }
        : undefined
    });
  } catch (err: any) {
    console.error('Error updating product-variation:', err);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * DELETE /api/products/product-variations/:id
 * Delete a product variation and detach from products
 */
productRouter.delete('/product-variations/:id', authMiddleware, requireInventoryWriteAccess, async (req: Request, res: Response) => {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const user = (req as any).user;
    const activeVendorId = resolveVendorId(user?.vendorId || req.vendorId || CENTRAL_VENDOR_ID);

    const db = getDB();
    if (!db) {
      return res.status(503).json({ success: false, error: 'Database tidak tersedia' });
    }

    const idQuery = ObjectId.isValid(id) ? { $or: [{ _id: new ObjectId(id) }, { id }] } : { id };
    const vendorScopedQuery = { $and: [buildVendorQuery(activeVendorId), idQuery] };
    const existingVar = await db.collection('product_variations').findOne(vendorScopedQuery);
    if (!existingVar) {
      return res.status(404).json({ success: false, error: 'Variasi produk tidak ditemukan.' });
    }

    const canonicalVarId = String(existingVar.id || id);
    await db.collection('product_variations').deleteOne({ _id: existingVar._id });

    // Detach variationId from all products of this vendor
    await db.collection('products').updateMany(
      buildVendorQuery(activeVendorId),
      { $pull: { variationIds: { $in: Array.from(new Set([canonicalVarId, id])) } } as any }
    );

    await recordActivityLog({
      action: 'DELETE',
      entity: 'PRODUCT',
      entityId: canonicalVarId,
      entityName: existingVar.name,
      summary: `Menghapus variasi produk '${existingVar.name}' dan melepaskannya dari produk tertaut`,
      details: { variationId: canonicalVarId, name: existingVar.name },
      req
    });

    serverProductCache.invalidateProducts(activeVendorId);

    return res.json({
      success: true,
      message: `Variasi produk '${existingVar.name}' berhasil dihapus!`
    });
  } catch (err: any) {
    console.error('Error deleting product-variation:', err);
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
    const activeVendorId = req.vendorId || 'vnd_kasirkafe_central';
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
      const andClauses: any[] = [];
      if (isAllVendors) {
        // No vendor restriction across all vendors
      } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
        andClauses.push(buildVendorQuery(requestedVendor));
      } else {
        andClauses.push(buildVendorQuery(activeVendorId));
      }

      if (category && category !== 'all') {
        andClauses.push({ category: category.toLowerCase() });
      }
      if (search) {
        andClauses.push({ name: { $regex: search, $options: 'i' } });
      }
      const filter = andClauses.length > 0 ? (andClauses.length === 1 ? andClauses[0] : { $and: andClauses }) : {};
      products = await db.collection('products').find(filter).toArray();
    } catch (e) {
      console.error('[Products Query Error]', e);
    }

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

    // Synchronize vendor stock mode, recipes, raw materials, and product variations
    let stockManagementMode: StockManagementMode = 'RAW_MATERIAL';
    const vendorModeMap = new Map<string, StockManagementMode>();
    const recipeMap = new Map<string, any>();
    const rawMaterialMap = new Map<string, any>();
    const variationByIdMap = new Map<string, any>();
    const variationsByProductIdMap = new Map<string, any[]>();
    try {
      const vendorFilter = isAllVendors ? {} : buildVendorQuery(targetVendor);
      const [vendorsList, recipes, rawMaterials, productVariations] = await Promise.all([
        db.collection('vendors').find({}).toArray(),
        db.collection('product_recipes').find(vendorFilter).toArray(),
        db.collection('raw_materials').find(vendorFilter).toArray(),
        db.collection('product_variations').find(vendorFilter).toArray().catch(() => [])
      ]);

      vendorsList.forEach(v => {
        const vId = v._id ? v._id.toString() : String(v.id || '');
        const mode: StockManagementMode = v.stockManagementMode === 'PRODUCT_STOCK' ? 'PRODUCT_STOCK' : 'RAW_MATERIAL';
        if (vId) vendorModeMap.set(vId, mode);
      });

      if (!isAllVendors) {
        stockManagementMode = vendorModeMap.get(resolveVendorId(targetVendor)) || await getVendorStockMode(db, targetVendor);
      }

      productVariations.forEach(pv => {
        const vId = pv.id || pv._id?.toString();
        const pvVId = resolveVendorId(pv.vendorId || targetVendor);
        const formattedVar = {
          id: vId,
          vendorId: pvVId,
          name: pv.name,
          type: pv.type || 'SINGLE_SELECT',
          required: !!pv.required,
          options: Array.isArray(pv.options) ? pv.options : [],
          productIds: Array.isArray(pv.productIds) ? pv.productIds : []
        };
        if (vId) {
          variationByIdMap.set(`${pvVId}:${vId}`, formattedVar);
          variationByIdMap.set(vId, formattedVar);
        }
        if (Array.isArray(pv.productIds)) {
          for (const linkedProdId of pv.productIds) {
            const list = variationsByProductIdMap.get(String(linkedProdId)) || [];
            if (!list.some(x => x.id === vId)) list.push(formattedVar);
            variationsByProductIdMap.set(String(linkedProdId), list);
          }
        }
      });

      recipes.forEach(r => {
        const rVId = resolveVendorId(r.vendorId);
        if (r.productId) {
          recipeMap.set(String(r.productId), r);
          recipeMap.set(`${rVId}:${String(r.productId)}`, r);
        }
        if (r.productName) {
          recipeMap.set(r.productName.toLowerCase().trim(), r);
          recipeMap.set(`${rVId}:${r.productName.toLowerCase().trim()}`, r);
        }
      });

      rawMaterials.forEach(m => {
        const mVId = resolveVendorId(m.vendorId);
        rawMaterialMap.set(m._id.toString(), m);
        rawMaterialMap.set(`${mVId}:${m._id.toString()}`, m);
        if (m.id) {
          rawMaterialMap.set(String(m.id), m);
          rawMaterialMap.set(`${mVId}:${String(m.id)}`, m);
        }
        if (m.name) {
          rawMaterialMap.set(m.name.toLowerCase().trim(), m);
          rawMaterialMap.set(`${mVId}:${m.name.toLowerCase().trim()}`, m);
        }
      });
    } catch (e) {
      console.warn('[Products] Error fetching recipes or raw materials:', e);
    }

    const payload = {
      success: true,
      vendorId: targetVendor,
      isAllVendors,
      stockManagementMode,
      cached: false,
      products: products.map(p => {
        const prodId = p._id ? p._id.toString() : p.id;
        const prodVendorResolved = resolveVendorId(p.vendorId || targetVendor);
        const activeMode: StockManagementMode = isAllVendors
          ? (vendorModeMap.get(prodVendorResolved) || 'RAW_MATERIAL')
          : stockManagementMode;

        const stockRec = stockMap.get(prodId);
        const directStock = stockRec ? stockRec.stock : (typeof p.stock === 'number' ? p.stock : 0);
        const threshold = stockRec ? stockRec.lowStockThreshold : (typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 10);

        const recipe =
          recipeMap.get(`${prodVendorResolved}:${prodId}`) ||
          recipeMap.get(prodId) ||
          recipeMap.get(`${prodVendorResolved}:${p.name?.toLowerCase().trim()}`) ||
          recipeMap.get(p.name?.toLowerCase().trim());
        const hasRecipe = Boolean(recipe && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0);

        let effectiveStock = directStock;
        let isAvailable = p.isAvailable !== false && directStock > 0;
        let rawMaterialAvailable = true;
        let rawMaterialReason = '';
        let maxServingsPossible = directStock;
        let stockSource: StockManagementMode = 'PRODUCT_STOCK';
        let hasLowStockIngredient = false;
        let lowStockIngredients: any[] = [];
        let ingredientBreakdown: any[] = [];

        if (activeMode === 'RAW_MATERIAL' && hasRecipe) {
          // Build vendor-scoped view of raw materials when in all-vendors mode
          const scopedMaterialMap = isAllVendors
            ? new Map(
                Array.from(rawMaterialMap.entries())
                  .filter(([k]) => k.startsWith(`${prodVendorResolved}:`))
                  .map(([k, v]) => [k.slice(prodVendorResolved.length + 1), v])
              )
            : rawMaterialMap;

          const computed = computeRawMaterialProductStock(recipe, scopedMaterialMap);
          effectiveStock = computed.stock;
          maxServingsPossible = computed.maxServingsPossible;
          rawMaterialAvailable = computed.rawMaterialAvailable;
          rawMaterialReason = computed.rawMaterialReason;
          hasLowStockIngredient = computed.hasLowStockIngredient;
          lowStockIngredients = computed.lowStockIngredients;
          ingredientBreakdown = computed.ingredientBreakdown;
          isAvailable = p.isAvailable !== false && computed.rawMaterialAvailable && computed.stock > 0;
          stockSource = 'RAW_MATERIAL';
        }

        const isLowStock = isAvailable && effectiveStock > 0 && (effectiveStock <= threshold || hasLowStockIngredient);
        const explicitVarIds: string[] = Array.isArray(p.variationIds) ? p.variationIds.map(String) : [];
        const reverseVars = variationsByProductIdMap.get(prodId) || [];
        const resolvedVarMap = new Map<string, any>();
        for (const vId of explicitVarIds) {
          const found = variationByIdMap.get(`${prodVendorResolved}:${vId}`) || variationByIdMap.get(vId);
          if (found) resolvedVarMap.set(found.id, found);
        }
        for (const rv of reverseVars) {
          if (!resolvedVarMap.has(rv.id)) resolvedVarMap.set(rv.id, rv);
        }
        const resolvedVariations = Array.from(resolvedVarMap.values());
        const resolvedVariationIds = resolvedVariations.map(v => v.id);

        return {
          id: prodId,
          vendorId: p.vendorId || 'vnd_kasirkafe_central',
          name: p.name,
          category: p.category,
          price: p.price,
          stock: effectiveStock,
          lowStockThreshold: threshold,
          description: p.description,
          tag: p.tag,
          image: p.image,
          isAvailable,
          variationIds: resolvedVariationIds,
          variations: resolvedVariations,
          rawMaterialAvailable,
          rawMaterialReason: rawMaterialReason || p.temporaryUnavailableReason,
          maxServingsPossible,
          hasRecipe,
          hasLowStockIngredient,
          lowStockIngredients,
          ingredientBreakdown,
          isLowStock,
          stockSource,
          stockManagementMode: activeMode
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
    const activeVendorId = req.vendorId || 'vnd_kasirkafe_central';
    const targetVendor = isAllVendors ? 'all' : (requestedVendor || activeVendorId);

    const db = getDB();
    if (!db) {
      return res.status(503).json({ success: false, error: 'can not connect to db' });
    }

    let filter: any = {};
    if (isAllVendors) {
      // All vendors
    } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
      filter = buildVendorQuery(requestedVendor);
    } else {
      filter = buildVendorQuery(activeVendorId);
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

    const [vendorsList, recipes, rawMaterials] = await Promise.all([
      db.collection('vendors').find({}).toArray(),
      db.collection('product_recipes').find(filter).toArray(),
      db.collection('raw_materials').find(filter).toArray()
    ]);

    const vendorModeMap = new Map<string, StockManagementMode>();
    vendorsList.forEach(v => {
      const vId = v._id ? v._id.toString() : String(v.id || '');
      if (vId) vendorModeMap.set(vId, v.stockManagementMode === 'PRODUCT_STOCK' ? 'PRODUCT_STOCK' : 'RAW_MATERIAL');
    });

    const stockManagementMode: StockManagementMode = isAllVendors
      ? 'RAW_MATERIAL'
      : (vendorModeMap.get(resolveVendorId(targetVendor)) || await getVendorStockMode(db, targetVendor));

    const recipeMap = new Map<string, any>();
    recipes.forEach(r => {
      const rVId = resolveVendorId(r.vendorId);
      if (r.productId) {
        recipeMap.set(String(r.productId), r);
        recipeMap.set(`${rVId}:${String(r.productId)}`, r);
      }
      if (r.productName) {
        recipeMap.set(r.productName.toLowerCase().trim(), r);
        recipeMap.set(`${rVId}:${r.productName.toLowerCase().trim()}`, r);
      }
    });

    const rawMaterialMap = new Map<string, any>();
    rawMaterials.forEach(m => {
      const mVId = resolveVendorId(m.vendorId);
      rawMaterialMap.set(m._id.toString(), m);
      rawMaterialMap.set(`${mVId}:${m._id.toString()}`, m);
      if (m.id) {
        rawMaterialMap.set(String(m.id), m);
        rawMaterialMap.set(`${mVId}:${String(m.id)}`, m);
      }
      if (m.name) {
        rawMaterialMap.set(m.name.toLowerCase().trim(), m);
        rawMaterialMap.set(`${mVId}:${m.name.toLowerCase().trim()}`, m);
      }
    });

    const stocks = products.map(p => {
      const prodId = p._id ? p._id.toString() : p.id;
      const prodVendorResolved = resolveVendorId(p.vendorId || targetVendor);
      const s = stockMap.get(prodId);
      const directStock = s ? s.stock : 0;
      const threshold = s ? s.lowStockThreshold : 10;
      const activeMode: StockManagementMode = isAllVendors
        ? (vendorModeMap.get(prodVendorResolved) || 'RAW_MATERIAL')
        : stockManagementMode;

      const recipe =
        recipeMap.get(`${prodVendorResolved}:${prodId}`) ||
        recipeMap.get(prodId) ||
        recipeMap.get(`${prodVendorResolved}:${p.name?.toLowerCase().trim()}`) ||
        recipeMap.get(p.name?.toLowerCase().trim());
      const hasRecipe = Boolean(recipe && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0);

      let effectiveStock = directStock;
      let isAvailable = p.isAvailable !== false && directStock > 0;
      let rawMaterialAvailable = true;
      let rawMaterialReason = '';
      let stockSource: StockManagementMode = 'PRODUCT_STOCK';
      let hasLowStockIngredient = false;
      let lowStockIngredients: any[] = [];
      let ingredientBreakdown: any[] = [];

      if (activeMode === 'RAW_MATERIAL' && hasRecipe) {
        const scopedMaterialMap = isAllVendors
          ? new Map(
              Array.from(rawMaterialMap.entries())
                .filter(([k]) => k.startsWith(`${prodVendorResolved}:`))
                .map(([k, v]) => [k.slice(prodVendorResolved.length + 1), v])
            )
          : rawMaterialMap;
        const computed = computeRawMaterialProductStock(recipe, scopedMaterialMap);
        effectiveStock = computed.stock;
        rawMaterialAvailable = computed.rawMaterialAvailable;
        rawMaterialReason = computed.rawMaterialReason;
        hasLowStockIngredient = computed.hasLowStockIngredient;
        lowStockIngredients = computed.lowStockIngredients;
        ingredientBreakdown = computed.ingredientBreakdown;
        isAvailable = p.isAvailable !== false && computed.rawMaterialAvailable && computed.stock > 0;
        stockSource = 'RAW_MATERIAL';
      }

      const isLowStock = isAvailable && effectiveStock > 0 && (effectiveStock <= threshold || hasLowStockIngredient);

      return {
        id: s?._id ? s._id.toString() : `stk_${prodId}`,
        productId: prodId,
        vendorId: p.vendorId || activeVendorId,
        productName: p.name,
        category: p.category,
        image: p.image,
        price: p.price,
        stock: effectiveStock,
        lowStockThreshold: threshold,
        isAvailable,
        rawMaterialAvailable,
        rawMaterialReason: rawMaterialReason || p.temporaryUnavailableReason,
        hasRecipe,
        hasLowStockIngredient,
        lowStockIngredients,
        ingredientBreakdown,
        isLowStock,
        stockSource,
        stockManagementMode: activeMode,
        updatedAt: s?.updatedAt || p.updatedAt
      };
    });

    return res.json({
      success: true,
      vendorId: targetVendor,
      isAllVendors,
      stockManagementMode,
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
    const activeVendorId = req.vendorId || 'vnd_kasirkafe_central';

    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    let query: any = {};
    if (isAllVendors) {
      query = {};
    } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
      query = buildVendorQuery(requestedVendor);
    } else {
      query = buildVendorQuery(activeVendorId);
    }

    let products: any[] = [];
    try {
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

    const stockManagementMode: StockManagementMode = isAllVendors
      ? 'RAW_MATERIAL'
      : await getVendorStockMode(db, requestedVendor || activeVendorId);

    const [recipes, rawMaterials] = await Promise.all([
      db.collection('product_recipes').find(query).toArray(),
      db.collection('raw_materials').find(query).toArray()
    ]);

    const recipeMap = new Map<string, any>();
    recipes.forEach(r => {
      const rVId = resolveVendorId(r.vendorId);
      if (r.productId) {
        recipeMap.set(String(r.productId), r);
        recipeMap.set(`${rVId}:${String(r.productId)}`, r);
      }
      if (r.productName) {
        recipeMap.set(r.productName.toLowerCase().trim(), r);
        recipeMap.set(`${rVId}:${r.productName.toLowerCase().trim()}`, r);
      }
    });

    const rawMaterialMap = new Map<string, any>();
    rawMaterials.forEach(m => {
      const mVId = resolveVendorId(m.vendorId);
      rawMaterialMap.set(m._id.toString(), m);
      rawMaterialMap.set(`${mVId}:${m._id.toString()}`, m);
      if (m.id) {
        rawMaterialMap.set(String(m.id), m);
        rawMaterialMap.set(`${mVId}:${String(m.id)}`, m);
      }
      if (m.name) {
        rawMaterialMap.set(m.name.toLowerCase().trim(), m);
        rawMaterialMap.set(`${mVId}:${m.name.toLowerCase().trim()}`, m);
      }
    });

    const mapped = products.map(p => {
      const prodId = p._id ? p._id.toString() : p.id;
      const prodVendorResolved = resolveVendorId(p.vendorId || activeVendorId);
      const s = stockMap.get(prodId);
      const threshold = s && typeof s.lowStockThreshold === 'number' ? s.lowStockThreshold : (typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 10);
      const directStock = s && typeof s.stock === 'number' ? s.stock : (typeof p.stock === 'number' ? p.stock : 0);

      let stock = directStock;
      let hasLowStockIngredient = false;
      let lowStockIngredients: any[] = [];
      let rawMaterialReason = '';

      if (stockManagementMode === 'RAW_MATERIAL') {
        const recipe =
          recipeMap.get(`${prodVendorResolved}:${prodId}`) ||
          recipeMap.get(prodId) ||
          recipeMap.get(`${prodVendorResolved}:${p.name?.toLowerCase().trim()}`) ||
          recipeMap.get(p.name?.toLowerCase().trim());
        if (recipe && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
          const scopedMaterialMap = isAllVendors
            ? new Map(
                Array.from(rawMaterialMap.entries())
                  .filter(([k]) => k.startsWith(`${prodVendorResolved}:`))
                  .map(([k, v]) => [k.slice(prodVendorResolved.length + 1), v])
              )
            : rawMaterialMap;
          const computed = computeRawMaterialProductStock(recipe, scopedMaterialMap);
          stock = computed.stock;
          hasLowStockIngredient = computed.hasLowStockIngredient;
          lowStockIngredients = computed.lowStockIngredients;
          rawMaterialReason = computed.rawMaterialReason;
        }
      }

      const isOutOfStock = stock === 0;
      const isLowStock = !isOutOfStock && (stock <= threshold || hasLowStockIngredient);
      return {
        id: prodId,
        vendorId: p.vendorId || 'vnd_kasirkafe_central',
        name: p.name,
        category: p.category,
        price: p.price,
        stock,
        lowStockThreshold: threshold,
        description: p.description,
        tag: p.tag,
        image: p.image,
        isAvailable: p.isAvailable !== false && stock > 0,
        hasLowStockIngredient,
        lowStockIngredients,
        rawMaterialReason,
        isLowStock,
        isOutOfStock
      };
    });

    const rawMaterialAlerts = rawMaterials
      .filter(m => {
        const st = typeof m.stock === 'number' ? m.stock : 0;
        const minSt = typeof m.minimumStock === 'number' ? m.minimumStock : 100;
        return st <= minSt;
      })
      .map(m => {
        const st = typeof m.stock === 'number' ? m.stock : 0;
        const minSt = typeof m.minimumStock === 'number' ? m.minimumStock : 100;
        return {
          id: m._id ? m._id.toString() : String(m.id || ''),
          vendorId: m.vendorId || activeVendorId,
          name: m.name,
          category: m.category || 'LAINNYA',
          unit: m.unit || 'unit',
          stock: st,
          minimumStock: minSt,
          status: st <= 0 ? ('OUT_OF_STOCK' as const) : ('LOW_STOCK' as const)
        };
      })
      .sort((a, b) => a.stock - b.stock);

    const rawMaterialLowCount = rawMaterialAlerts.filter(r => r.status === 'LOW_STOCK').length;
    const rawMaterialOutCount = rawMaterialAlerts.filter(r => r.status === 'OUT_OF_STOCK').length;

    const healthyCount = mapped.filter(p => !p.isOutOfStock && !p.isLowStock).length;
    const lowStockCount = mapped.filter(p => p.isLowStock).length;
    const outOfStockCount = mapped.filter(p => p.isOutOfStock).length;
    const totalStockUnits = mapped.reduce((sum, p) => sum + p.stock, 0);
    const totalStockValue = mapped.reduce((sum, p) => sum + (p.stock * p.price), 0);

    const alerts = mapped
      .filter(p => p.isOutOfStock || p.isLowStock)
      .sort((a, b) => a.stock - b.stock);

    return res.json({
      success: true,
      vendorId: isAllVendors ? 'all' : (requestedVendor || activeVendorId),
      isAllVendors,
      stockManagementMode,
      summary: {
        totalProducts: mapped.length,
        healthyCount,
        lowStockCount,
        outOfStockCount,
        totalStockUnits,
        totalStockValue,
        defaultThreshold: 10,
        alerts,
        rawMaterialAlerts,
        rawMaterialLowCount,
        rawMaterialOutCount,
        combinedAlertCount: Math.max(alerts.length, rawMaterialAlerts.length)
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
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
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
        vendorId: l.vendorId || 'vnd_kasirkafe_central',
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

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    const filter: any = {
      ...buildVendorQuery(activeVendorId)
    };
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
      details: { threshold: thresholdNum, category: category || 'all', vendorId: activeVendorId },
      req
    });

    // Invalidate product cache for active vendor
    serverProductCache.invalidateProducts(activeVendorId);

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

    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
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
      const rawName = normalizeProductName(String(item.name || ''));
      if (!rawName) continue;

      const itemId = item.id ? String(item.id).trim() : null;
      // Match existing by ID or case-insensitive, whitespace-normalized Name within active vendor's catalog
      const existing = currentProducts.find(p => {
        if (itemId) {
          const pId = p._id ? p._id.toString() : String(p.id);
          if (pId === itemId) return true;
        }
        return normalizeProductName(String(p.name || '')).toLowerCase() === rawName.toLowerCase();
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
              $setOnInsert: { vendorId: existing.vendorId || activeVendorId }
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
            vendorId: existing.vendorId || activeVendorId,
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
          vendorId: activeVendorId,
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
            vendorId: activeVendorId,
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
    const activeVendorId = user?.vendorId || req.vendorId || 'vnd_kasirkafe_central';
    const prodVendorId = product.vendorId || CENTRAL_VENDOR_ID;
    const isOwner = isVendorOwner(prodVendorId, activeVendorId);

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
        { $set: stockUpdateFields, $setOnInsert: { vendorId: prodVendorId } },
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
      await db.collection('products').updateOne(query, { $set: prodUpdateFields });
    } catch (e) {}

    const stockChange = newStock - currentStock;
    const logDoc = {
      vendorId: product.vendorId || req.vendorId || 'vnd_kasirkafe_central',
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
    const targetVendor = product.vendorId || req.vendorId || 'vnd_kasirkafe_central';
    serverProductCache.invalidateProducts(targetVendor);

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

    const { stock, lowStockThreshold, variationIds, ...productCleanData } = parsed.data;
    const normalizedName = normalizeProductName(productCleanData.name);
    if (normalizedName.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Nama produk minimal 2 karakter'
      });
    }

    const cleanVariationIds = Array.isArray(variationIds) ? Array.from(new Set(variationIds.map(String))) : [];
    const user = (req as any).user;
    const activeVendorId = user?.vendorId || req.vendorId || 'vnd_kasirkafe_central';
    const newProd = {
      ...productCleanData,
      name: normalizedName,
      category: parsed.data.category.toLowerCase().trim(),
      variationIds: cleanVariationIds,
      vendorId: activeVendorId,
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

    // Enforce unique product name per vendor (case-insensitive, whitespace-normalized)
    const duplicateProduct = await db.collection('products').findOne({
      $and: [
        buildVendorQuery(activeVendorId),
        { name: { $regex: buildDuplicateNameRegex(normalizedName) } }
      ]
    });

    if (duplicateProduct) {
      return res.status(409).json({
        success: false,
        error: `Produk dengan nama '${normalizedName}' sudah ada untuk vendor Anda.`
      });
    }

    let insertedId = new ObjectId().toString();
    const stockVal = typeof stock === 'number' ? Math.max(0, Math.floor(stock)) : 20;
    const thresholdVal = typeof lowStockThreshold === 'number' ? Math.max(0, Math.floor(lowStockThreshold)) : 10;

    try {
      const result = await db.collection('products').insertOne(newProd);
      insertedId = result.insertedId.toString();

      // Store in new product_stocks table
      await db.collection('product_stocks').insertOne({
        productId: insertedId,
        vendorId: activeVendorId,
        stock: stockVal,
        lowStockThreshold: thresholdVal,
        updatedAt: new Date()
      });

      // Sync productIds in product_variations
      if (cleanVariationIds.length > 0) {
        await db.collection('product_variations').updateMany(
          { $and: [buildVendorQuery(activeVendorId), { id: { $in: cleanVariationIds } }] },
          { $addToSet: { productIds: insertedId } }
        );
      }
    } catch (e: any) {
      if (e?.code === 11000) {
        return res.status(409).json({
          success: false,
          error: `Produk dengan nama '${normalizedName}' sudah ada untuk vendor Anda.`
        });
      }
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
        vendorId: activeVendorId
      },
      req
    });

    // Invalidate product cache for active vendor
    serverProductCache.invalidateProducts(activeVendorId);

    return res.status(201).json({
      success: true,
      message: 'Produk berhasil ditambahkan!',
      product: {
        id: insertedId,
        ...newProd,
        stock: stockVal,
        lowStockThreshold: thresholdVal
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
    const activeVendorId = user?.vendorId || req.vendorId || 'vnd_kasirkafe_central';
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

    const prodVendorId = existingProd.vendorId || CENTRAL_VENDOR_ID;
    const isOwner = isVendorOwner(prodVendorId, activeVendorId);

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Akses Ditolak: Anda tidak berhak mengubah produk milik vendor lain.'
      });
    }

    // Enforce unique product name per vendor when name is updated
    if (updateData.name !== undefined) {
      const normalizedName = normalizeProductName(String(updateData.name));
      if (normalizedName.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Nama produk minimal 2 karakter'
        });
      }

      const duplicateProduct = await db.collection('products').findOne({
        $and: [
          buildVendorQuery(prodVendorId),
          { _id: { $ne: existingProd._id } },
          { name: { $regex: buildDuplicateNameRegex(normalizedName) } }
        ]
      });

      if (duplicateProduct) {
        return res.status(409).json({
          success: false,
          error: `Produk dengan nama '${normalizedName}' sudah ada untuk vendor Anda.`
        });
      }

      updateData.name = normalizedName;
    }

    const prodIdStr = existingProd._id ? existingProd._id.toString() : id;
    if (Object.keys(stockToUpdate).length > 0) {
      stockToUpdate.updatedAt = new Date();
      try {
        await db.collection('product_stocks').updateOne(
          { productId: prodIdStr },
          { $set: stockToUpdate, $setOnInsert: { vendorId: prodVendorId, stock: 20, lowStockThreshold: 10 } },
          { upsert: true }
        );
      } catch (e) {}
    }

    // Do not overwrite vendorId or _id
    delete updateData._id;
    delete updateData.id;
    delete updateData.vendorId;

    const cleanVariationIds = Array.isArray(updateData.variationIds)
      ? Array.from(new Set(updateData.variationIds.map(String)))
      : undefined;
    if (cleanVariationIds !== undefined) {
      updateData.variationIds = cleanVariationIds;
    }

    try {
      await db.collection('products').updateOne({ _id: existingProd._id }, { $set: updateData });
      if (cleanVariationIds !== undefined) {
        await db.collection('product_variations').updateMany(
          buildVendorQuery(prodVendorId),
          { $pull: { productIds: prodIdStr } as any }
        );
        if (cleanVariationIds.length > 0) {
          await db.collection('product_variations').updateMany(
            { $and: [buildVendorQuery(prodVendorId), { id: { $in: cleanVariationIds } }] },
            { $addToSet: { productIds: prodIdStr } }
          );
        }
      }
    } catch (e: any) {
      if (e?.code === 11000) {
        return res.status(409).json({
          success: false,
          error: `Produk dengan nama '${updateData.name || existingProd.name}' sudah ada untuk vendor Anda.`
        });
      }
      throw e;
    }

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
    serverProductCache.invalidateProducts(activeVendorId);

    const updatedProduct = await db.collection('products').findOne({ _id: existingProd._id });
    const stockDoc = await db.collection('product_stocks').findOne({ productId: prodIdStr });

    return res.json({
      success: true,
      message: 'Produk berhasil diperbarui!',
      product: {
        id: updatedProduct?._id ? updatedProduct._id.toString() : id,
        vendorId: updatedProduct?.vendorId,
        name: updatedProduct?.name,
        category: updatedProduct?.category,
        price: updatedProduct?.price,
        stock: stockDoc ? stockDoc.stock : (typeof stockToUpdate.stock === 'number' ? stockToUpdate.stock : 0),
        lowStockThreshold: stockDoc ? stockDoc.lowStockThreshold : (typeof stockToUpdate.lowStockThreshold === 'number' ? stockToUpdate.lowStockThreshold : 10),
        description: updatedProduct?.description,
        tag: updatedProduct?.tag,
        image: updatedProduct?.image,
        isAvailable: updatedProduct?.isAvailable,
        variationIds: Array.isArray(updatedProduct?.variationIds) ? updatedProduct.variationIds : []
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
    const activeVendorId = user?.vendorId || req.vendorId || 'vnd_kasirkafe_central';
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

    const prodVendorId = targetProd.vendorId || CENTRAL_VENDOR_ID;
    const isOwner = isVendorOwner(prodVendorId, activeVendorId);

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
      await db.collection('product_variations').updateMany(
        buildVendorQuery(prodVendorId),
        { $pull: { productIds: targetProdIdStr } as any }
      );
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
    serverProductCache.invalidateProducts(activeVendorId);

    return res.json({
      success: true,
      message: `Produk '${prodName}' berhasil dihapus dari database.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});
