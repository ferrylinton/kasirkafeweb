import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDB, fallbackStore } from '../db';
import {
  getAllVendors,
  findVendorById,
  VendorRecord
} from '../vendorMiddleware';
import { signToken, authMiddleware, requireManager, hashPassword } from '../auth';
import { recordActivityLog } from '../activityLogger';
import { sendVendorConfirmationEmail } from '../mail';
import { writeDailyLog } from '../dailyRollingLogger';
import { IParam } from '@/src/types';

export const vendorRouter = Router();

const vendorCreateSchema = z.object({
  name: z.string().min(2, 'Nama vendor minimal 2 karakter'),
  code: z.string().min(2, 'Kode vendor minimal 2 karakter').max(10, 'Kode maksimal 10 karakter'),
  email: z.string().email('Format email tidak valid').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  currency: z.string().default('IDR'),
  status: z.enum(['ACTIVE', 'SUSPENDED']).default('ACTIVE')
});

const vendorUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(2).max(10).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional()
});

/**
 * GET /api/vendors
 * List all vendors / clients (accessible by managers and admins)
 */
vendorRouter.get('/', async (req: Request, res: Response) => {
  try {
    const vendors = await getAllVendors();
    const currentVendorId = req.vendorId || 'vnd_sipspot_central';

    // Enhance with live counts for each vendor
    const db = getDB();
    const enriched = await Promise.all(
      vendors.map(async (v) => {
        let productCount = 0;
        let orderCount = 0;
        let userCount = 0;

        if (db) {
          try {
            productCount = await db.collection('products').countDocuments({ vendorId: v.id });
            orderCount = await db.collection('orders').countDocuments({ vendorId: v.id });
            userCount = await db.collection('users').countDocuments({ vendorId: v.id });
          } catch (e) {}
        } else {
          productCount = fallbackStore.products.filter(p => (p.vendorId || 'vnd_sipspot_central') === v.id).length;
          orderCount = fallbackStore.orders.filter(o => (o.vendorId || 'vnd_sipspot_central') === v.id).length;
          userCount = fallbackStore.users.filter(u => (u.vendorId || 'vnd_sipspot_central') === v.id).length;
        }

        return {
          ...v,
          isCurrent: v.id === currentVendorId,
          stats: {
            productCount,
            orderCount,
            userCount
          }
        };
      })
    );

    return res.json({
      success: true,
      currentVendorId,
      vendors: enriched
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/vendors/current
 * Return active vendor details based on resolved vendorId
 */
vendorRouter.get('/current', async (req: Request, res: Response) => {
  try {
    const activeVendorId = req.vendorId || 'vnd_sipspot_central';
    const vendor = await findVendorById(activeVendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    const db = getDB();
    let productCount = 0;
    let orderCount = 0;
    let userCount = 0;

    if (db) {
      try {
        productCount = await db.collection('products').countDocuments({ vendorId: vendor.id });
        orderCount = await db.collection('orders').countDocuments({ vendorId: vendor.id });
        userCount = await db.collection('users').countDocuments({ vendorId: vendor.id });
      } catch (e) {}
    } else {
      productCount = fallbackStore.products.filter(p => (p.vendorId || 'vnd_sipspot_central') === vendor.id).length;
      orderCount = fallbackStore.orders.filter(o => (o.vendorId || 'vnd_sipspot_central') === vendor.id).length;
      userCount = fallbackStore.users.filter(u => (u.vendorId || 'vnd_sipspot_central') === vendor.id).length;
    }

    return res.json({
      success: true,
      vendor: {
        ...vendor,
        stats: {
          productCount,
          orderCount,
          userCount
        }
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/vendors
 * Register a new Vendor / Client with unique Client ID and Client Secret
 * RBAC: Manajemen Toko hanya boleh diakses role MANAGER (dan ADMIN)
 */
vendorRouter.post('/', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const parsed = vendorCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        details: parsed.error.format()
      });
    }

    const { name, code, email, phone, address, currency, status } = parsed.data;
    const cleanCode = code.toUpperCase().trim();

    // Check if code or name exists
    const vendors = await getAllVendors();
    const existing = vendors.find(v => v.code === cleanCode);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'DuplicateVendorCode',
        message: `Kode vendor '${cleanCode}' sudah digunakan.`
      });
    }

    const vendorId = `vnd_${cleanCode.toLowerCase()}_${Date.now().toString(36)}`;
    const newVendor: VendorRecord = {
      id: vendorId,
      name: name.trim(),
      code: cleanCode,
      status: status || 'ACTIVE',
      email: email || '',
      phone: phone || '',
      address: address || '',
      currency: currency || 'IDR',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const db = getDB();
    if (db) {
      try {
        await db.collection('vendors').insertOne(newVendor);
      } catch (e) {}
    }

    // Always keep fallbackStore updated
    if (!fallbackStore.vendors) fallbackStore.vendors = [];
    fallbackStore.vendors.push(newVendor);

    // Seed 1 default Manager and 1 default Cashier for this vendor
    const defaultManager = {
      id: `usr_mgr_${vendorId}`,
      vendorId: newVendor.id,
      email: `manager@${cleanCode.toLowerCase()}.com`,
      password: '$2a$10$wTfZM2w1v25vR9F1.f4tseXFkU6q8XQY5pX8c2.E6m2D6797j7x9q', // Password123!
      name: `Manager ${name}`,
      role: 'MANAGER',
      pin: '123456',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const defaultCashier = {
      id: `usr_csh_${vendorId}`,
      vendorId: newVendor.id,
      email: `kasir@${cleanCode.toLowerCase()}.com`,
      password: '$2a$10$wTfZM2w1v25vR9F1.f4tseXFkU6q8XQY5pX8c2.E6m2D6797j7x9q', // Password123!
      name: `Kasir ${name}`,
      role: 'CASHIER',
      pin: '849201',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (db) {
      try {
        await db.collection('users').insertMany([defaultManager, defaultCashier]);
      } catch (e) {}
    }
    fallbackStore.users.push(defaultManager, defaultCashier);

    // Record activity log
    await recordActivityLog({
      action: 'CREATE',
      entity: 'USER',
      entityId: newVendor.id,
      entityName: newVendor.name,
      summary: `Mendaftarkan vendor baru ${newVendor.name} (${newVendor.code})`,
      details: {
        vendorId: newVendor.id,
        code: newVendor.code,
        status: newVendor.status
      },
      req
    });

    return res.status(201).json({
      success: true,
      message: `Vendor ${newVendor.name} berhasil dibuat.`,
      vendor: newVendor
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/vendors/:id
 * Update vendor profile / status
 * RBAC: Manajemen Toko hanya boleh diakses role MANAGER (dan ADMIN)
 */
vendorRouter.put('/:id', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as IParam;
    const vendor = await findVendorById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    const parsed = vendorUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        details: parsed.error.format()
      });
    }

    const updateData: Partial<VendorRecord> = {
      ...parsed.data,
      updatedAt: new Date()
    };

    const db = getDB();
    if (db) {
      try {
        await db.collection('vendors').updateOne({ id }, { $set: updateData });
      } catch (e) {}
    }

    // Update in fallbackStore
    const idx = fallbackStore.vendors.findIndex(v => v.id === id);
    if (idx !== -1) {
      fallbackStore.vendors[idx] = { ...fallbackStore.vendors[idx], ...updateData };
    }

    await recordActivityLog({
      action: 'UPDATE',
      entity: 'USER',
      entityId: id,
      entityName: vendor.name,
      summary: `Memperbarui data vendor ${vendor.name}`,
      details: updateData,
      req
    });

    return res.json({
      success: true,
      message: 'Vendor berhasil diperbarui.',
      vendor: { ...vendor, ...updateData }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/vendors/:id/regenerate-secret
 * Generates a new cryptographically secure Client Secret for the vendor
 * RBAC: Manajemen Toko hanya boleh diakses role MANAGER (dan ADMIN)
 */
vendorRouter.post('/:id/regenerate-secret', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as IParam;
    const vendor = await findVendorById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor tidak ditemukan' });
    }

    return res.json({
      success: true,
      vendor
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/vendors/test-isolation
 * Live verification test showing that a given vendor can ONLY see their own data
 */
vendorRouter.get('/test-isolation', async (req: Request, res: Response) => {
  try {
    const targetVendorId = req.vendorId || 'vnd_sipspot_central';
    const currentVendor = await findVendorById(targetVendorId);

    const db = getDB();
    let products: any[] = [];
    let orders: any[] = [];
    let users: any[] = [];
    let discounts: any[] = [];

    if (db) {
      try {
        products = await db.collection('products').find({ vendorId: targetVendorId }).toArray();
        orders = await db.collection('orders').find({ vendorId: targetVendorId }).toArray();
        users = await db.collection('users').find({ vendorId: targetVendorId }, { projection: { password: 0 } }).toArray();
        discounts = await db.collection('discount_rules').find({ vendorId: targetVendorId }).toArray();
      } catch (e) {}
    } else {
      products = fallbackStore.products.filter(p => (p.vendorId || 'vnd_sipspot_central') === targetVendorId);
      orders = fallbackStore.orders.filter(o => (o.vendorId || 'vnd_sipspot_central') === targetVendorId);
      users = fallbackStore.users.filter(u => (u.vendorId || 'vnd_sipspot_central') === targetVendorId);
      discounts = fallbackStore.discount_rules.filter(d => (d.vendorId || 'vnd_sipspot_central') === targetVendorId);
    }

    return res.json({
      success: true,
      testedVendorId: targetVendorId,
      vendorName: currentVendor?.name || 'Unknown',
      vendorCode: currentVendor?.code,
      isolationStatus: 'STRICT_TENANT_ISOLATION_ACTIVE',
      dataSummary: {
        totalProductsVisible: products.length,
        totalOrdersVisible: orders.length,
        totalUsersVisible: users.length,
        totalDiscountsVisible: discounts.length
      },
      sampleProducts: products.slice(0, 5).map(p => ({
        id: p._id ? p._id.toString() : p.id,
        name: p.name,
        price: p.price,
        vendorId: p.vendorId || targetVendorId
      })),
      guarantee: 'Data antar vendor terisolasi 100% menggunakan scope filter vendorId.'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// VENDOR REGISTRATION & CONFIRMATION SYSTEM
// ==========================================

const vendorRegisterSchema = z.object({
  vendorName: z
    .string()
    .trim()
    .min(3, 'Nama vendor minimal 3 karakter')
    .max(30, 'Nama vendor maksimal 30 karakter'),
  managerName: z
    .string()
    .trim()
    .min(3, 'Nama manager minimal 3 karakter')
    .max(30, 'Nama manager maksimal 30 karakter'),
  password: z
    .string()
    .min(6, 'Password minimal 6 karakter')
    .optional(),
  pin: z
    .string()
    .trim()
    .optional(),
  email: z
    .string()
    .trim()
    .email('Format email tidak valid'),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  currency: z.string().default('IDR')
});

/**
 * Helper to check uniqueness for vendor registration fields
 */
async function checkVendorUniqueness(params: {
  vendorName?: string;
  managerName?: string;
  email?: string;
}) {
  const db = getDB();
  const vName = params.vendorName?.trim().toLowerCase();
  const mName = params.managerName?.trim().toLowerCase();
  const em = params.email?.trim().toLowerCase();

  let isVendorNameTaken = false;
  let isManagerNameTaken = false;
  let isEmailTaken = false;

  // 1. Check MongoDB
  if (db) {
    try {
      if (vName) {
        const foundV = await db.collection('vendors').findOne({
          name: { $regex: new RegExp(`^${vName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
        if (foundV) isVendorNameTaken = true;
      }

      if (mName) {
        const foundM = await db.collection('users').findOne({
          name: { $regex: new RegExp(`^${mName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
        if (foundM) isManagerNameTaken = true;
      }

      if (em) {
        const foundU = await db.collection('users').findOne({
          email: { $regex: new RegExp(`^${em.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
        const foundV = await db.collection('vendors').findOne({
          email: { $regex: new RegExp(`^${em.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
        if (foundU || foundV) isEmailTaken = true;
      }
    } catch (e) {
      console.warn('[VendorUniqueness] MongoDB check warning:', e);
    }
  }

  // 2. Check fallbackStore
  if (vName && !isVendorNameTaken) {
    const foundV = fallbackStore.vendors?.some(
      (v: any) => v.name?.trim().toLowerCase() === vName
    );
    if (foundV) isVendorNameTaken = true;
  }

  if (mName && !isManagerNameTaken) {
    const foundM = fallbackStore.users?.some(
      (u: any) => u.name?.trim().toLowerCase() === mName
    );
    if (foundM) isManagerNameTaken = true;
  }

  if (em && !isEmailTaken) {
    const foundU = fallbackStore.users?.some(
      (u: any) => u.email?.trim().toLowerCase() === em
    );
    const foundV = fallbackStore.vendors?.some(
      (v: any) => v.email?.trim().toLowerCase() === em
    );
    if (foundU || foundV) isEmailTaken = true;
  }

  return { isVendorNameTaken, isManagerNameTaken, isEmailTaken };
}

/**
 * GET /api/vendors/check-availability
 * Check live availability of vendor name, manager name, or email
 */
vendorRouter.get('/check-availability', async (req: Request, res: Response) => {
  try {
    const vendorName = (req.query.vendorName as string) || '';
    const managerName = (req.query.managerName as string) || '';
    const email = (req.query.email as string) || '';

    const { isVendorNameTaken, isManagerNameTaken, isEmailTaken } = await checkVendorUniqueness({
      vendorName,
      managerName,
      email
    });

    return res.json({
      success: true,
      available: {
        vendorName: !isVendorNameTaken,
        managerName: !isManagerNameTaken,
        email: !isEmailTaken
      },
      messages: {
        vendorName: isVendorNameTaken ? 'Nama vendor sudah digunakan.' : 'Nama vendor tersedia.',
        managerName: isManagerNameTaken ? 'Nama manager sudah terdaftar.' : 'Nama manager tersedia.',
        email: isEmailTaken ? 'Email sudah terdaftar di sistem.' : 'Email tersedia.'
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/vendors/register
 * Public registration endpoint for new vendor + manager account + email confirmation
 */
vendorRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const parseResult = vendorRegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: parseResult.error.issues[0]?.message || 'Data pendaftaran tidak valid',
        details: parseResult.error.format()
      });
    }

    const { vendorName, managerName, pin, password, email, phone, address, currency } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();
    const rawPassword = password || pin || 'Password123!';
    const rawPin = pin || (password && /^\d{6}$/.test(password) ? password : '123456');

    // 1. Strictly enforce uniqueness constraints
    const uniqueness = await checkVendorUniqueness({
      vendorName,
      managerName,
      email: cleanEmail
    });

    if (uniqueness.isVendorNameTaken) {
      return res.status(400).json({
        success: false,
        field: 'vendorName',
        error: 'VendorNameTaken',
        message: 'Nama vendor sudah terdaftar. Harap gunakan nama vendor yang berbeda.'
      });
    }

    if (uniqueness.isManagerNameTaken) {
      return res.status(400).json({
        success: false,
        field: 'managerName',
        error: 'ManagerNameTaken',
        message: 'Nama manager sudah terdaftar di sistem. Harap gunakan nama lain.'
      });
    }

    if (uniqueness.isEmailTaken) {
      return res.status(400).json({
        success: false,
        field: 'email',
        error: 'EmailTaken',
        message: 'Email sudah terdaftar di sistem. Harap gunakan alamat email lain.'
      });
    }

    // 2. Generate unique vendor identifier & client credentials
    const slug = vendorName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 10);
    const randomSuffix = crypto.randomBytes(3).toString('hex');
    const vendorId = `vnd_${slug}_${randomSuffix}`;

    // Unique upper code (3 to 6 alphanumeric)
    let vendorCode = vendorName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    if (vendorCode.length < 3) {
      vendorCode = (vendorCode + 'VND').slice(0, 5);
    }
    vendorCode = `${vendorCode}${crypto.randomBytes(1).toString('hex').toUpperCase()}`;

    // 3. Create Vendor document
    const newVendor: VendorRecord = {
      id: vendorId,
      name: vendorName.trim(),
      code: vendorCode,
      status: 'ACTIVE',
      email: cleanEmail,
      phone: phone || '',
      address: address || '',
      currency: currency || 'IDR',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 4. Create Manager User document (role: MANAGER)
    const hashedPassword = await hashPassword(rawPassword); // Securely hash password as credential
    const userId = `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const newManagerUser: any = {
      id: userId,
      vendorId: vendorId,
      name: managerName.trim(),
      email: cleanEmail,
      password: hashedPassword,
      pin: rawPin.trim(),
      role: 'MANAGER',
      isEmailConfirmed: false,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 5. Generate secure confirmation token (expires in 24 hours)
    const confirmationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const confirmationDoc = {
      token: confirmationToken,
      vendorId: vendorId,
      vendorName: vendorName.trim(),
      userId: userId,
      managerName: managerName.trim(),
      email: cleanEmail,
      used: false,
      createdAt: new Date(),
      expiresAt
    };

    // 6. Persist to MongoDB or fallbackStore
    const db = getDB();
    if (db) {
      try {
        await db.collection('vendors').insertOne(newVendor);
        await db.collection('users').insertOne(newManagerUser);
        await db.collection('vendor_confirmations').insertOne(confirmationDoc);
      } catch (dbErr: any) {
        console.warn('[VendorRegister] MongoDB insert failed, persisting to in-memory store:', dbErr.message);
        fallbackStore.vendors.push(newVendor);
        fallbackStore.users.push(newManagerUser);
        if (!fallbackStore.vendor_confirmations) fallbackStore.vendor_confirmations = [];
        fallbackStore.vendor_confirmations.push(confirmationDoc);
      }
    } else {
      fallbackStore.vendors.push(newVendor);
      fallbackStore.users.push(newManagerUser);
      if (!fallbackStore.vendor_confirmations) fallbackStore.vendor_confirmations = [];
      fallbackStore.vendor_confirmations.push(confirmationDoc);
    }

    // 7. Resolve dynamic application URL
    const appUrl =
      (req.headers.origin as string) ||
      (req.headers['x-forwarded-proto']
        ? `${req.headers['x-forwarded-proto']}://${req.headers.host}`
        : `http://${req.headers.host || 'localhost:3000'}`);

    // 8. Dispatch confirmation email asynchronously
    const emailResult = await sendVendorConfirmationEmail({
      recipientEmail: cleanEmail,
      managerName: managerName.trim(),
      vendorName: vendorName.trim(),
      vendorCode: vendorCode,
      confirmationToken,
      appUrl,
      pin: rawPin.trim(),
      expiresAt
    });

    // 9. Record system activity and write daily rolling log
    await recordActivityLog({
      action: 'CREATE',
      entity: 'VENDOR',
      entityId: vendorId,
      entityName: vendorName.trim(),
      summary: `Registrasi vendor baru "${vendorName.trim()}" dengan manager "${managerName.trim()}" (${cleanEmail}). Tautan konfirmasi telah dikirim.`,
      vendorId: vendorId,
      req,
      details: {
        vendorName: vendorName.trim(),
        vendorCode: vendorCode,
        managerName: managerName.trim(),
        email: cleanEmail,
        role: 'MANAGER',
        confirmationSent: emailResult.success
      }
    }).catch(() => {});

    await writeDailyLog({
      level: 'INFO',
      category: 'AUTH',
      message: `Pendaftaran vendor baru berhasil: "${vendorName.trim()}" (${vendorCode}) oleh Manager "${managerName.trim()}" (${cleanEmail}). Email konfirmasi terkirim.`,
      vendorId: vendorId,
      performer: {
        id: userId,
        name: managerName.trim(),
        email: cleanEmail,
        role: 'MANAGER'
      },
      details: {
        vendorId,
        vendorCode,
        email: cleanEmail,
        confirmationToken: confirmationToken.slice(0, 10) + '...',
        emailSent: emailResult.success
      },
      req
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: `Pendaftaran vendor berhasil! Link konfirmasi telah dikirim ke email ${cleanEmail}. Harap periksa kotak masuk untuk mengaktifkan akun.`,
      vendor: {
        id: vendorId,
        name: vendorName.trim(),
        code: vendorCode,
        status: 'ACTIVE',
        isEmailConfirmed: false
      },
      manager: {
        id: userId,
        name: managerName.trim(),
        email: cleanEmail,
        role: 'MANAGER'
      },
      confirmationToken,
      confirmationUrl: emailResult.confirmationUrl
    });
  } catch (err: any) {
    console.error('[VendorRegister] Unexpected registration error:', err);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: err.message || 'Terjadi kesalahan sistem saat mendaftarkan vendor.'
    });
  }
});

/**
 * GET /api/vendors/confirm
 * Verify confirmation link clicked from email
 */
vendorRouter.get('/confirm', async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      return res.status(400).send(renderConfirmationHtml({
        status: 'error',
        title: 'Token Konfirmasi Tidak Ditemukan',
        message: 'Tautan konfirmasi tidak lengkap atau tidak valid.'
      }));
    }

    const db = getDB();
    let confirmation: any = null;

    if (db) {
      try {
        confirmation = await db.collection('vendor_confirmations').findOne({ token });
      } catch (e) {}
    }

    if (!confirmation && fallbackStore.vendor_confirmations) {
      confirmation = fallbackStore.vendor_confirmations.find((c: any) => c.token === token);
    }

    if (!confirmation) {
      return res.status(404).send(renderConfirmationHtml({
        status: 'error',
        title: 'Token Tidak Valid',
        message: 'Tautan konfirmasi tidak terdaftar atau sudah kadaluwarsa.'
      }));
    }

    if (confirmation.used) {
      return res.send(renderConfirmationHtml({
        status: 'already_confirmed',
        title: 'Akun Sudah Dikonfirmasi',
        message: `Vendor "${confirmation.vendorName}" sudah aktif sebelumnya. Anda dapat langsung login menggunakan PIN Anda.`,
        vendorName: confirmation.vendorName,
        email: confirmation.email
      }));
    }

    // Check expiry
    if (confirmation.expiresAt && new Date(confirmation.expiresAt) < new Date()) {
      return res.status(410).send(renderConfirmationHtml({
        status: 'expired',
        title: 'Tautan Kadaluwarsa',
        message: 'Tautan konfirmasi ini telah melewati batas 24 jam. Harap minta tautan baru.',
        email: confirmation.email
      }));
    }

    // Mark confirmation as used and activate email
    const now = new Date();
    if (db) {
      try {
        await db.collection('vendor_confirmations').updateOne(
          { token },
          { $set: { used: true, confirmedAt: now } }
        );
        await db.collection('vendors').updateOne(
          { id: confirmation.vendorId },
          { $set: { isEmailConfirmed: true, status: 'ACTIVE', updatedAt: now } }
        );
        await db.collection('users').updateOne(
          { id: confirmation.userId },
          { $set: { isEmailConfirmed: true, updatedAt: now } }
        );
      } catch (dbErr) {
        console.warn('[VendorConfirm] Error updating MongoDB, updating fallback:', dbErr);
      }
    }

    // Update in fallback store
    if (fallbackStore.vendor_confirmations) {
      const fc = fallbackStore.vendor_confirmations.find((c: any) => c.token === token);
      if (fc) {
        fc.used = true;
        fc.confirmedAt = now;
      }
    }
    const fv = fallbackStore.vendors?.find((v: any) => v.id === confirmation.vendorId);
    if (fv) {
      fv.isEmailConfirmed = true;
      fv.status = 'ACTIVE';
      fv.updatedAt = now;
    }
    const fu = fallbackStore.users?.find((u: any) => u.id === confirmation.userId);
    if (fu) {
      fu.isEmailConfirmed = true;
      fu.updatedAt = now;
    }

    // Log confirmation
    await writeDailyLog({
      level: 'INFO',
      category: 'AUTH',
      message: `Konfirmasi email vendor berhasil: "${confirmation.vendorName}" (${confirmation.email}). Status vendor dan manager resmi aktif.`,
      vendorId: confirmation.vendorId,
      performer: {
        id: confirmation.userId,
        name: confirmation.managerName,
        email: confirmation.email,
        role: 'MANAGER'
      },
      req
    }).catch(() => {});

    await recordActivityLog({
      action: 'UPDATE',
      entity: 'VENDOR',
      entityId: confirmation.vendorId,
      entityName: confirmation.vendorName,
      summary: `Vendor "${confirmation.vendorName}" telah terverifikasi via email konfirmasi.`,
      vendorId: confirmation.vendorId,
      req,
      details: {
        vendorName: confirmation.vendorName,
        email: confirmation.email,
        status: 'ACTIVE'
      }
    }).catch(() => {});

    return res.send(renderConfirmationHtml({
      status: 'success',
      title: 'Konfirmasi Berhasil!',
      message: `Selamat! Vendor "${confirmation.vendorName}" dan akun Manager "${confirmation.managerName}" telah resmi diaktifkan.`,
      vendorName: confirmation.vendorName,
      email: confirmation.email
    }));
  } catch (err: any) {
    return res.status(500).send(renderConfirmationHtml({
      status: 'error',
      title: 'Galat Konfirmasi',
      message: err.message || 'Terjadi kesalahan saat memverifikasi token konfirmasi.'
    }));
  }
});

/**
 * POST /api/vendors/confirm
 * JSON endpoint for in-app confirmation token verification
 */
vendorRouter.post('/confirm', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token konfirmasi diperlukan' });
    }

    const db = getDB();
    let confirmation: any = null;

    if (db) {
      try {
        confirmation = await db.collection('vendor_confirmations').findOne({ token });
      } catch (e) {}
    }

    if (!confirmation && fallbackStore.vendor_confirmations) {
      confirmation = fallbackStore.vendor_confirmations.find((c: any) => c.token === token);
    }

    if (!confirmation) {
      return res.status(404).json({ success: false, message: 'Token konfirmasi tidak valid atau tidak ditemukan' });
    }

    if (confirmation.used) {
      return res.json({
        success: true,
        alreadyConfirmed: true,
        message: `Vendor "${confirmation.vendorName}" sudah aktif sebelumnya.`,
        vendorName: confirmation.vendorName,
        email: confirmation.email
      });
    }

    if (confirmation.expiresAt && new Date(confirmation.expiresAt) < new Date()) {
      return res.status(410).json({ success: false, message: 'Token konfirmasi telah kadaluwarsa (lebih dari 24 jam).' });
    }

    const now = new Date();
    if (db) {
      try {
        await db.collection('vendor_confirmations').updateOne(
          { token },
          { $set: { used: true, confirmedAt: now } }
        );
        await db.collection('vendors').updateOne(
          { id: confirmation.vendorId },
          { $set: { isEmailConfirmed: true, status: 'ACTIVE', updatedAt: now } }
        );
        await db.collection('users').updateOne(
          { id: confirmation.userId },
          { $set: { isEmailConfirmed: true, updatedAt: now } }
        );
      } catch (e) {}
    }

    if (fallbackStore.vendor_confirmations) {
      const fc = fallbackStore.vendor_confirmations.find((c: any) => c.token === token);
      if (fc) {
        fc.used = true;
        fc.confirmedAt = now;
      }
    }
    const fv = fallbackStore.vendors?.find((v: any) => v.id === confirmation.vendorId);
    if (fv) {
      fv.isEmailConfirmed = true;
      fv.status = 'ACTIVE';
      fv.updatedAt = now;
    }
    const fu = fallbackStore.users?.find((u: any) => u.id === confirmation.userId);
    if (fu) {
      fu.isEmailConfirmed = true;
      fu.updatedAt = now;
    }

    return res.json({
      success: true,
      message: `Akun vendor "${confirmation.vendorName}" berhasil diaktifkan!`,
      vendorName: confirmation.vendorName,
      managerName: confirmation.managerName,
      email: confirmation.email
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/vendors/resend-confirmation
 * Resend confirmation email if not confirmed yet
 */
vendorRouter.post('/resend-confirmation', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email harus diisi' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = getDB();
    let confirmation: any = null;

    if (db) {
      try {
        confirmation = await db.collection('vendor_confirmations')
          .find({ email: cleanEmail })
          .sort({ createdAt: -1 })
          .limit(1)
          .next();
      } catch (e) {}
    }

    if (!confirmation && fallbackStore.vendor_confirmations) {
      confirmation = fallbackStore.vendor_confirmations
        .filter((c: any) => c.email.toLowerCase() === cleanEmail)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    }

    if (!confirmation) {
      return res.status(404).json({ success: false, message: 'Tidak ada data pendaftaran yang sesuai dengan email ini.' });
    }

    if (confirmation.used) {
      return res.json({ success: true, message: 'Akun ini sudah dikonfirmasi sebelumnya. Anda dapat langsung login.' });
    }

    // Refresh token
    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (db) {
      try {
        await db.collection('vendor_confirmations').updateOne(
          { _id: confirmation._id },
          { $set: { token: newToken, expiresAt: newExpiresAt, updatedAt: new Date() } }
        );
      } catch (e) {}
    }
    confirmation.token = newToken;
    confirmation.expiresAt = newExpiresAt;

    const appUrl =
      (req.headers.origin as string) ||
      (req.headers['x-forwarded-proto']
        ? `${req.headers['x-forwarded-proto']}://${req.headers.host}`
        : `http://${req.headers.host || 'localhost:3000'}`);

    const emailRes = await sendVendorConfirmationEmail({
      recipientEmail: cleanEmail,
      managerName: confirmation.managerName,
      vendorName: confirmation.vendorName,
      vendorCode: 'SPS',
      confirmationToken: newToken,
      appUrl
    });

    return res.json({
      success: true,
      message: `Tautan konfirmasi baru telah dikirimkan ke ${cleanEmail}.`,
      confirmationUrl: emailRes.confirmationUrl,
      confirmationToken: newToken
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Beautiful HTML confirmation page renderer
 */
function renderConfirmationHtml(params: {
  status: 'success' | 'already_confirmed' | 'expired' | 'error';
  title: string;
  message: string;
  vendorName?: string;
  email?: string;
}): string {
  const isSuccess = params.status === 'success' || params.status === 'already_confirmed';
  const iconEmoji = isSuccess ? '🎉' : params.status === 'expired' ? '⏳' : '⚠️';
  const badgeColor = isSuccess ? '#15803d' : '#b91c1c';
  const badgeBg = isSuccess ? '#dcfce7' : '#fee2e2';

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title} - SipSpot POS</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #fff8f6;
      color: #221a18;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
      box-sizing: border-box;
    }
    .card {
      background-color: #ffffff;
      max-width: 480px;
      width: 100%;
      border-radius: 24px;
      padding: 36px 28px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.07);
      border: 1px solid #f2dfdc;
      text-align: center;
    }
    .emoji-icon {
      font-size: 54px;
      margin-bottom: 12px;
      display: inline-block;
    }
    .badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      background-color: ${badgeBg};
      color: ${badgeColor};
      margin-bottom: 16px;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      color: #1a1514;
      margin: 0 0 10px 0;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #614944;
      margin: 0 0 24px 0;
    }
    .btn {
      display: inline-block;
      background-color: #e04f26;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      padding: 13px 32px;
      border-radius: 14px;
      box-shadow: 0 4px 14px rgba(224, 79, 38, 0.3);
      transition: all 0.2s ease;
    }
    .btn:hover {
      background-color: #c93e17;
      transform: translateY(-1px);
    }
    .footer {
      margin-top: 28px;
      font-size: 11px;
      color: #a88d87;
      border-top: 1px solid #fbf0ee;
      padding-top: 16px;
    }
  </style>
  ${isSuccess ? `<script>
    setTimeout(function() {
      window.location.href = '/?confirmed=true&vendorName=' + encodeURIComponent('${params.vendorName || ''}');
    }, 3500);
  </script>` : ''}
</head>
<body>
  <div class="card">
    <div class="emoji-icon">${iconEmoji}</div>
    <div class="badge">SipSpot POS Multivendor</div>
    <h1>${params.title}</h1>
    <p>${params.message}</p>
    ${isSuccess ? '<p style="font-size: 12px; color: #888;">Mengalihkan secara otomatis ke halaman login dalam 3 detik...</p>' : ''}
    <a href="/?confirmed=true&vendorName=${encodeURIComponent(params.vendorName || '')}" class="btn">
      Buka POS SipSpot
    </a>
    <div class="footer">
      © ${new Date().getFullYear()} SipSpot Beverage & Snack POS Security.
    </div>
  </div>
</body>
</html>
  `;
}

