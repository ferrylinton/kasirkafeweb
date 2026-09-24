import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB } from '../db';
import { authMiddleware, requireManager } from '../auth';
import { ObjectId } from 'mongodb';
import { recordActivityLog } from '../activityLogger';
import { IParam } from '@/src/types';

export const templateRouter = Router();

/**
 * RBAC Rule: Role ADMIN HANYA bisa melihat Template Email (Read-Only).
 * ADMIN TIDAK BISA menambah, mengubah, atau menghapus template email.
 * Hak menambah, mengubah, dan menghapus template email dipegang khusus oleh role MANAGER.
 */
function requireTemplateWriteAccess(req: Request, res: Response, next: () => void) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Autentikasi diperlukan.'
    });
  }

  // Khusus role ADMIN: tolak akses mutasi template email secara eksplisit
  if (user.role === 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Akses Ditolak: Role ADMIN hanya memiliki hak akses melihat Template Email (Read-Only). Tidak diizinkan menambah, mengubah, atau menghapus template email.'
    });
  }

  // Pastikan hanya MANAGER yang memiliki izin kelola template
  if (user.role !== 'MANAGER') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Akses Ditolak: Pengelolaan template email (tambah, ubah, hapus) hanya dapat dilakukan oleh role MANAGER.'
    });
  }

  next();
}

const updateTemplateSchema = z.object({
  subject: z.string().min(3, 'Subject minimal 3 karakter'),
  bodyHtml: z.string().min(10, 'Body HTML minimal 10 karakter'),
  isActive: z.boolean().optional()
});

/**
 * GET /api/templates
 * RBAC: Manajemen Toko hanya boleh diakses role MANAGER (dan ADMIN)
 */
templateRouter.get('/', authMiddleware, requireManager, async (req: Request, res: Response) => {
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

    let filter: any = {};
    if (isAllVendors) {
      filter = {};
    } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
      filter = { vendorId: requestedVendor };
    } else {
      filter = {
        $or: [
          { vendorId: activeVendorId },
          { vendorId: { $exists: false } },
          { vendorId: 'vnd_kasirkafe_central' }
        ]
      };
    }
    const templates = await db.collection('email_templates').find(filter).toArray();

    return res.json({
      success: true,
      vendorId: isAllVendors ? 'all' : (requestedVendor || activeVendorId),
      isAllVendors,
      templates: templates.map(t => ({
        id: t._id ? t._id.toString() : t.code,
        vendorId: (t as any).vendorId || 'vnd_kasirkafe_central',
        code: t.code,
        name: t.name,
        description: t.description,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        isActive: t.isActive !== false
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * GET /api/templates/email-logs
 * List email dispatch history filtered by vendor
 */
templateRouter.get('/email-logs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    const filter = (activeVendorId === 'vnd_kasirkafe_central'
          ? { $or: [{ vendorId: 'vnd_kasirkafe_central' }, { vendorId: { $exists: false } }, { vendorId: null }] }
          : { vendorId: activeVendorId });
    const logs = await db.collection('email_logs').find(filter).sort({ sentAt: -1 }).limit(100).toArray();

    return res.json({
      success: true,
      vendorId: activeVendorId,
      logs: logs.map(l => ({
        id: l._id ? l._id.toString() : l.id,
        vendorId: l.vendorId || activeVendorId,
        orderId: l.orderId,
        orderNumber: l.orderNumber,
        recipientEmail: l.recipientEmail,
        subject: l.subject,
        templateCode: l.templateCode,
        status: l.status,
        errorMessage: l.errorMessage,
        messageId: l.messageId,
        sentAt: l.sentAt
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * POST /api/templates
 * Manager only: create new dynamic email template
 */
templateRouter.post('/', authMiddleware, requireTemplateWriteAccess, async (req: Request, res: Response) => {
  try {
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const parsed = updateTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: parsed.error.format()
      });
    }

    const { code, name, description } = req.body;
    if (!code || !name) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Kode dan nama template wajib diisi.'
      });
    }

    const newTemplate = {
      code: code.trim().toUpperCase().replace(/\s+/g, '_'),
      name: name.trim(),
      description: (description || '').trim(),
      subject: parsed.data.subject,
      bodyHtml: parsed.data.bodyHtml,
      isActive: parsed.data.isActive !== false,
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

    const result = await db.collection('email_templates').insertOne(newTemplate);
    (newTemplate as any)._id = result.insertedId;

    await recordActivityLog({
      action: 'CREATE',
      entity: 'EMAIL_TEMPLATE',
      entityId: (newTemplate as any)._id?.toString() || newTemplate.code,
      entityName: newTemplate.name,
      summary: `Menambahkan template email baru '${newTemplate.name}'`,
      details: newTemplate,
      req
    });

    return res.status(201).json({
      success: true,
      message: 'Template email baru berhasil dibuat!',
      template: newTemplate
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * PUT /api/templates/:id
 * Manager only: update dynamic email template in MongoDB
 */
templateRouter.put('/:id', authMiddleware, requireTemplateWriteAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as IParam;
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_kasirkafe_central';
    const parsed = updateTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: parsed.error.format()
      });
    }

    const updateData = {
      ...parsed.data,
      vendorId: activeVendorId,
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

    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { code: id };
    const targetTemplate: any = await db.collection('email_templates').findOne(query);
    if (!targetTemplate) {
      return res.status(404).json({ success: false, error: 'Template email tidak ditemukan.' });
    }

    await db.collection('email_templates').updateOne(query, { $set: updateData });

    const templateName = targetTemplate?.name || id;

    // Record system-wide activity log
    await recordActivityLog({
      action: 'UPDATE',
      entity: 'EMAIL_TEMPLATE',
      entityId: id,
      entityName: templateName,
      summary: `Memperbarui template email '${templateName}' [Subjek: ${parsed.data.subject}]`,
      details: {
        templateId: id,
        subject: parsed.data.subject,
        isActive: parsed.data.isActive
      },
      req
    });

    return res.json({
      success: true,
      message: 'Template email berhasil diperbarui di database!'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * DELETE /api/templates/:id
 * Manager only: delete dynamic email template
 */
templateRouter.delete('/:id', authMiddleware, requireTemplateWriteAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as IParam;
    const db = getDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'can not connect to db',
        message: 'can not connect to db'
      });
    }

    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { code: id };
    const targetTemplate: any = await db.collection('email_templates').findOne(query);
    if (!targetTemplate) {
      return res.status(404).json({ success: false, error: 'Template email tidak ditemukan.' });
    }

    await db.collection('email_templates').deleteOne(query);

    const templateName = targetTemplate?.name || id;

    await recordActivityLog({
      action: 'DELETE',
      entity: 'EMAIL_TEMPLATE',
      entityId: id,
      entityName: templateName,
      summary: `Menghapus template email '${templateName}'`,
      details: { templateId: id },
      req
    });

    return res.json({
      success: true,
      message: 'Template email berhasil dihapus!'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});
