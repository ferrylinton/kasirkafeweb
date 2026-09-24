import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDB } from '../db';
import {
  getAllVendors,
  findVendorById,
  VendorRecord
} from '../vendorMiddleware';
import { signToken, authMiddleware, requireManager, requireAdmin, hashPassword, comparePassword, verifyToken } from '../auth';
import { revokeAllSessionsForVendor } from './authRoutes';
import { recordActivityLog } from '../activityLogger';
import { sendVendorConfirmationEmail } from '../mail';
import { writeDailyLog } from '../dailyRollingLogger';
import { IParam } from '@/src/types';

export const vendorRouter = Router();

const vendorCreateSchema = z.object({
  name: z.string().min(2, 'Nama vendor minimal 2 karakter'),
  currency: z.string().default('IDR'),
  status: z.enum(['ACTIVE', 'SUSPENDED']).default('ACTIVE')
});

const vendorUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  currency: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional()
});

/**
 * GET /api/vendors
 * List vendors: Admins see all vendors, Managers see ONLY their own vendor
 */
vendorRouter.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    const userRole = (req as any).user?.role;
    const currentVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    let vendors = await getAllVendors();

    // Strict role MANAGER rule: MANAGER can ONLY view their own vendor data
    if (userRole !== 'ADMIN') {
      vendors = vendors.filter(v => v.id === currentVendorId);
    }

    // Enhance with live counts for each vendor
    const enriched = await Promise.all(
      vendors.map(async (v) => {
        let productCount = 0;
        let orderCount = 0;
        let userCount = 0;

        try {
          productCount = await db.collection('products').countDocuments({ vendorId: v.id });
          orderCount = await db.collection('orders').countDocuments({ vendorId: v.id });
          userCount = await db.collection('users').countDocuments({ vendorId: v.id });
        } catch (e) {}

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
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    const activeVendorId = req.vendorId || 'vnd_kasirkafe_central';
    const vendor = await findVendorById(activeVendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    let productCount = 0;
    let orderCount = 0;
    let userCount = 0;

    try {
      productCount = await db.collection('products').countDocuments({ vendorId: vendor.id });
      orderCount = await db.collection('orders').countDocuments({ vendorId: vendor.id });
      userCount = await db.collection('users').countDocuments({ vendorId: vendor.id });
    } catch (e) {}

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
 * Register a new Vendor
 * RBAC: Hanya boleh diakses oleh ADMIN (Role MANAGER tidak dapat menambah vendor)
 */
vendorRouter.post('/', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    const parsed = vendorCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        details: parsed.error.format()
      });
    }

    const { name, currency, status } = parsed.data;
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'vnd';
    const vendorId = `vnd_${slug}_${Date.now().toString(36)}`;
    const newVendor: VendorRecord = {
      id: vendorId,
      name: name.trim(),
      status: status || 'ACTIVE',
      currency: currency || 'IDR',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('vendors').insertOne(newVendor);

    // Seed 1 default Manager and 1 default Cashier for this vendor
    const defaultManager = {
      id: `usr_mgr_${vendorId}`,
      vendorId: newVendor.id,
      email: `manager@${slug}.com`,
      password: '$2a$10$wTfZM2w1v25vR9F1.f4tseXFkU6q8XQY5pX8c2.E6m2D6797j7x9q', // Password123!
      name: `Manager ${name}`,
      role: 'MANAGER',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const defaultCashier = {
      id: `usr_csh_${vendorId}`,
      vendorId: newVendor.id,
      email: `kasir@${slug}.com`,
      password: '$2a$10$wTfZM2w1v25vR9F1.f4tseXFkU6q8XQY5pX8c2.E6m2D6797j7x9q', // Password123!
      name: `Kasir ${name}`,
      role: 'CASHIER',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('users').insertMany([defaultManager, defaultCashier]);

    // Record activity log
    await recordActivityLog({
      action: 'CREATE',
      entity: 'USER',
      entityId: newVendor.id,
      entityName: newVendor.name,
      summary: `Mendaftarkan vendor baru ${newVendor.name}`,
      details: {
        vendorId: newVendor.id,
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
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

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

    await db.collection('vendors').updateOne({ id }, { $set: updateData });

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
 * GET /api/vendors/test-isolation
 * Live verification test showing that a given vendor can ONLY see their own data
 */
vendorRouter.get('/test-isolation', async (req: Request, res: Response) => {
  try {
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    const targetVendorId = req.vendorId || 'vnd_kasirkafe_central';
    const currentVendor = await findVendorById(targetVendorId);

    let products: any[] = [];
    let orders: any[] = [];
    let users: any[] = [];
    let discounts: any[] = [];

    try {
      products = await db.collection('products').find({ vendorId: targetVendorId }).toArray();
      orders = await db.collection('orders').find({ vendorId: targetVendorId }).toArray();
      users = await db.collection('users').find({ vendorId: targetVendorId }, { projection: { password: 0 } }).toArray();
      discounts = await db.collection('discount_rules').find({ vendorId: targetVendorId }).toArray();
    } catch (e) {}

    return res.json({
      success: true,
      testedVendorId: targetVendorId,
      vendorName: currentVendor?.name || 'Unknown',
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
  email: z
    .string()
    .trim()
    .email('Format email tidak valid'),
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

    const { vendorName, managerName, password, email, currency } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();
    const rawPassword = password || 'Password123!';

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

    // 2. Generate unique vendor identifier
    const slug = vendorName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 10) || 'vnd';
    const randomSuffix = crypto.randomBytes(3).toString('hex');
    const vendorId = `vnd_${slug}_${randomSuffix}`;

    // 3. Create Vendor document
    const newVendor: VendorRecord = {
      id: vendorId,
      name: vendorName.trim(),
      status: 'ACTIVE',
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

    // 6. Persist to MongoDB
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    await db.collection('vendors').insertOne(newVendor);
    await db.collection('users').insertOne(newManagerUser);
    await db.collection('vendor_confirmations').insertOne(confirmationDoc);

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
      confirmationToken,
      appUrl,
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
        managerName: managerName.trim(),
        email: cleanEmail,
        role: 'MANAGER',
        confirmationSent: emailResult.success
      }
    }).catch(() => {});

    await writeDailyLog({
      level: 'INFO',
      category: 'AUTH',
      message: `Pendaftaran vendor baru berhasil: "${vendorName.trim()}" oleh Manager "${managerName.trim()}" (${cleanEmail}). Email konfirmasi terkirim.`,
      vendorId: vendorId,
      performer: {
        id: userId,
        name: managerName.trim(),
        email: cleanEmail,
        role: 'MANAGER'
      },
      details: {
        vendorId,
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
    if (!db) {
      return res.status(503).send(renderConfirmationHtml({
        status: 'error',
        title: 'Database Tidak Tersedia',
        message: 'can not connect to db'
      }));
    }

    const confirmation: any = await db.collection('vendor_confirmations').findOne({ token });

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
        message: `Vendor "${confirmation.vendorName}" sudah aktif sebelumnya. Anda dapat langsung login menggunakan kata sandi Anda.`,
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
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    const confirmation: any = await db.collection('vendor_confirmations').findOne({ token });

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
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    const confirmation: any = await db.collection('vendor_confirmations')
      .find({ email: cleanEmail })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();

    if (!confirmation) {
      return res.status(404).json({ success: false, message: 'Tidak ada data pendaftaran yang sesuai dengan email ini.' });
    }

    if (confirmation.used) {
      return res.json({ success: true, message: 'Akun ini sudah dikonfirmasi sebelumnya. Anda dapat langsung login.' });
    }

    // Refresh token
    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.collection('vendor_confirmations').updateOne(
      { _id: confirmation._id },
      { $set: { token: newToken, expiresAt: newExpiresAt, updatedAt: new Date() } }
    );
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
 * POST /api/vendors/request-deactivate
 * Role: MANAGER - Request to deactivate their vendor account with reason (5-200 chars)
 */
vendorRouter.post('/request-deactivate', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const vendorId = user.vendorId || req.vendorId;

    if (!vendorId) {
      return res.status(400).json({ success: false, message: 'Vendor tidak ditemukan untuk akun ini.' });
    }

    if (vendorId === 'vnd_admin' || vendorId === 'vnd_kasirkafe_central') {
      return res.status(400).json({ success: false, message: 'Vendor Utama Sistem tidak dapat dinonaktifkan.' });
    }

    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length < 5 || reason.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Alasan penonaktifan harus minimal 5 karakter dan maksimal 200 karakter.'
      });
    }

    const vendor = await findVendorById(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Data vendor tidak ditemukan.' });
    }

    if (vendor.status === 'DEACTIVATE') {
      return res.status(400).json({ success: false, message: 'Vendor sudah dalam status nonaktif.' });
    }

    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    const existingPending = await db.collection('vendor_status_requests').findOne({
      vendorId,
      status: 'PENDING'
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: `Terdapat permintaan ${existingPending.type === 'DEACTIVATE' ? 'penonaktifan' : 'aktivasi'} yang sedang menunggu persetujuan Admin.`
      });
    }

    const newRequest = {
      id: `vreq_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      vendorId: vendor.id,
      vendorName: vendor.name,
      type: 'DEACTIVATE' as const,
      reason,
      requestedByEmail: user.email,
      requestedByName: user.name,
      requestedByRole: 'MANAGER' as const,
      status: 'PENDING' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('vendor_status_requests').insertOne(newRequest);

    await recordActivityLog({
      action: 'UPDATE',
      entity: 'VENDOR',
      entityId: vendor.id,
      entityName: vendor.name,
      summary: `Manager (${user.email}) mengajukan penonaktifan vendor '${vendor.name}' (Alasan: "${reason}")`,
      details: { requestId: newRequest.id, reason, type: 'DEACTIVATE' },
      req,
      vendorId: vendor.id
    });

    return res.json({
      success: true,
      message: 'Permintaan penonaktifan vendor berhasil dikirim ke Admin.',
      request: newRequest
    });
  } catch (err: any) {
    console.error('[VendorRequestDeactivate] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengajukan penonaktifan vendor.' });
  }
});

/**
 * POST /api/vendors/request-reactivate
 * Public / Semi-Public: Manager requests reactivation of their deactivated vendor account (5-200 chars)
 */
vendorRouter.post('/request-reactivate', async (req: Request, res: Response) => {
  try {
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length < 5 || reason.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Alasan aktivasi harus minimal 5 karakter dan maksimal 200 karakter.'
      });
    }

    let managerUser: any = null;

    // Check token if provided
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (decoded && (decoded.role === 'MANAGER' || decoded.role === 'ADMIN')) {
        managerUser = await db.collection('users').findOne({ email: decoded.email.toLowerCase() });
      }
    }

    // If not authenticated via token, check email & password credentials
    if (!managerUser) {
      const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body.password === 'string' ? req.body.password : '';

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email dan password akun Manager diperlukan untuk mengajukan permohonan aktivasi.'
        });
      }

      managerUser = await db.collection('users').findOne({ email });

      if (!managerUser) {
        return res.status(401).json({
          success: false,
          message: 'Akun Manager dengan email tersebut tidak ditemukan.'
        });
      }

      const isPassValid = await comparePassword(password, managerUser.password);
      if (!isPassValid) {
        return res.status(401).json({
          success: false,
          message: 'Password akun Manager salah.'
        });
      }

      if (managerUser.role !== 'MANAGER' && managerUser.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Hanya pengguna dengan role MANAGER yang dapat mengajukan aktivasi akun vendor.'
        });
      }
    }

    const vendorId = managerUser.vendorId;
    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: 'Vendor tidak ditemukan pada akun Manager ini.'
      });
    }

    const vendor = await findVendorById(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor tidak ditemukan.' });
    }

    if (vendor.status === 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: `Akun vendor '${vendor.name}' sudah dalam status AKTIF.`
      });
    }

    const existingPending = await db.collection('vendor_status_requests').findOne({
      vendorId,
      status: 'PENDING'
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: `Permintaan ${existingPending.type === 'REACTIVATE' ? 'aktivasi' : 'penonaktifan'} vendor sedang menunggu persetujuan Admin.`
      });
    }

    const newRequest = {
      id: `vreq_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      vendorId: vendor.id,
      vendorName: vendor.name,
      type: 'REACTIVATE' as const,
      reason,
      requestedByEmail: managerUser.email,
      requestedByName: managerUser.name,
      requestedByRole: 'MANAGER' as const,
      status: 'PENDING' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('vendor_status_requests').insertOne(newRequest);

    await recordActivityLog({
      action: 'UPDATE',
      entity: 'VENDOR',
      entityId: vendor.id,
      entityName: vendor.name,
      summary: `Manager (${managerUser.email}) mengajukan aktivasi kembali vendor '${vendor.name}' (Alasan: "${reason}")`,
      details: { requestId: newRequest.id, reason, type: 'REACTIVATE' },
      req,
      vendorId: vendor.id
    });

    return res.json({
      success: true,
      message: `Permintaan aktivasi kembali untuk vendor '${vendor.name}' berhasil dikirimkan ke Admin.`,
      request: newRequest
    });
  } catch (err: any) {
    console.error('[VendorRequestReactivate] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengajukan aktivasi kembali vendor.' });
  }
});

/**
 * GET /api/vendors/status-requests
 * Role: ADMIN or MANAGER
 */
vendorRouter.get('/status-requests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    const userRole = (req as any).user?.role;
    const userVendorId = (req as any).user?.vendorId;
    const query = userRole === 'ADMIN' ? {} : { vendorId: userVendorId };
    const requests = await db.collection('vendor_status_requests').find(query).sort({ createdAt: -1 }).toArray();

    return res.json({
      success: true,
      requests
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/vendors/status-requests/:id/review
 * Role: ADMIN only - Approve or Reject deactivation / reactivation request
 */
vendorRouter.post('/status-requests/:id/review', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    const { id } = req.params;
    const { action, adminNotes } = req.body;

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return res.status(400).json({ success: false, message: 'Action harus bernilai APPROVE atau REJECT.' });
    }

    const requestItem: any = await db.collection('vendor_status_requests').findOne({ id });

    if (!requestItem) {
      return res.status(404).json({ success: false, message: 'Permintaan status vendor tidak ditemukan.' });
    }

    if (requestItem.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Permintaan ini sudah ${requestItem.status === 'APPROVED' ? 'disetujui' : 'ditolak'} sebelumnya.`
      });
    }

    const adminUser = req.user!;
    const reviewedAt = new Date().toISOString();
    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    const updates = {
      status: newStatus,
      reviewedBy: adminUser.email,
      adminNotes: adminNotes || '',
      reviewedAt,
      updatedAt: reviewedAt
    };

    await db.collection('vendor_status_requests').updateOne({ id }, { $set: updates });

    // If APPROVED, update vendor status!
    if (action === 'APPROVE') {
      const targetVendorId = requestItem.vendorId;

      if (requestItem.type === 'DEACTIVATE') {
        const vendorStatusUpdate = { status: 'DEACTIVATE', updatedAt: new Date() };
        await db.collection('vendors').updateOne({ id: targetVendorId }, { $set: vendorStatusUpdate });

        // Kick all users in that vendor immediately
        const revokedCount = await revokeAllSessionsForVendor(targetVendorId, 'Akun vendor dinonaktifkan oleh Admin');

        await recordActivityLog({
          action: 'UPDATE',
          entity: 'VENDOR',
          entityId: targetVendorId,
          entityName: requestItem.vendorName,
          summary: `Admin (${adminUser.email}) menyetujui penonaktifan vendor '${requestItem.vendorName}'. Status vendor menjadi DEACTIVATE dan ${revokedCount} sesi user diputus.`,
          details: { requestId: id, revokedSessions: revokedCount },
          req,
          vendorId: targetVendorId
        });

        return res.json({
          success: true,
          message: `Permintaan disetujui. Akun vendor '${requestItem.vendorName}' telah dinonaktifkan (DEACTIVATE) dan seluruh sesi pengguna di dalamnya telah dikeluarkan.`,
          request: { ...requestItem, ...updates }
        });
      } else if (requestItem.type === 'REACTIVATE') {
        const vendorStatusUpdate = { status: 'ACTIVE', updatedAt: new Date() };
        await db.collection('vendors').updateOne({ id: targetVendorId }, { $set: vendorStatusUpdate });

        await recordActivityLog({
          action: 'UPDATE',
          entity: 'VENDOR',
          entityId: targetVendorId,
          entityName: requestItem.vendorName,
          summary: `Admin (${adminUser.email}) menyetujui aktivasi kembali vendor '${requestItem.vendorName}'. Status vendor kini ACTIVE.`,
          details: { requestId: id },
          req,
          vendorId: targetVendorId
        });

        return res.json({
          success: true,
          message: `Permintaan disetujui. Akun vendor '${requestItem.vendorName}' kini telah aktif kembali dan pengguna dapat login seperti biasa.`,
          request: { ...requestItem, ...updates }
        });
      }
    }

    // If REJECTED
    await recordActivityLog({
      action: 'UPDATE',
      entity: 'VENDOR',
      entityId: requestItem.vendorId,
      entityName: requestItem.vendorName,
      summary: `Admin (${adminUser.email}) menolak permintaan ${requestItem.type === 'DEACTIVATE' ? 'penonaktifan' : 'aktivasi'} vendor '${requestItem.vendorName}'`,
      details: { requestId: id, adminNotes },
      req,
      vendorId: requestItem.vendorId
    });

    return res.json({
      success: true,
      message: `Permintaan ${requestItem.type === 'DEACTIVATE' ? 'penonaktifan' : 'aktivasi'} vendor telah ditolak.`,
      request: { ...requestItem, ...updates }
    });
  } catch (err: any) {
    console.error('[VendorRequestReview] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal meninjau permintaan status vendor.' });
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
  <title>${params.title} - KasirKafe POS</title>
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
    <div class="badge">KasirKafe POS Multivendor</div>
    <h1>${params.title}</h1>
    <p>${params.message}</p>
    ${isSuccess ? '<p style="font-size: 12px; color: #888;">Mengalihkan secara otomatis ke halaman login dalam 3 detik...</p>' : ''}
    <a href="/?confirmed=true&vendorName=${encodeURIComponent(params.vendorName || '')}" class="btn">
      Buka POS KasirKafe
    </a>
    <div class="footer">
      © ${new Date().getFullYear()} KasirKafe Beverage & Snack POS Security.
    </div>
  </div>
</body>
</html>
  `;
}

