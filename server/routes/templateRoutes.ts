import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB, fallbackStore } from '../db';
import { authMiddleware, requireManager } from '../auth';
import { ObjectId } from 'mongodb';
import { recordActivityLog } from '../activityLogger';

export const templateRouter = Router();

const updateTemplateSchema = z.object({
  subject: z.string().min(3, 'Subject minimal 3 karakter'),
  bodyHtml: z.string().min(10, 'Body HTML minimal 10 karakter'),
  isActive: z.boolean().optional()
});

/**
 * GET /api/templates
 */
templateRouter.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const isAdmin = (req as any).user?.role === 'ADMIN' || (req as any).user?.role === 'SUPERADMIN';
    const isAllVendors = (req.query.allVendors === 'true' || req.query.vendorId === 'all') && isAdmin;
    const requestedVendor = (req.query.vendorId as string) || '';
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_sipspot_central';

    const db = getDB();
    let templates: any[] = [];
    if (db) {
      try {
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
              { vendorId: 'vnd_sipspot_central' }
            ]
          };
        }
        templates = await db.collection('email_templates').find(filter).toArray();
      } catch (e) {}
    }
    if (templates.length === 0) {
      if (isAllVendors) {
        templates = fallbackStore.email_templates;
      } else if (isAdmin && requestedVendor && requestedVendor !== 'all') {
        templates = fallbackStore.email_templates.filter(
          t => (t as any).vendorId === requestedVendor
        );
      } else {
        templates = fallbackStore.email_templates.filter(
          t => (t as any).vendorId === activeVendorId || !(t as any).vendorId || (t as any).vendorId === 'vnd_sipspot_central'
        );
      }
    }

    return res.json({
      success: true,
      vendorId: isAllVendors ? 'all' : (requestedVendor || activeVendorId),
      isAllVendors,
      templates: templates.map(t => ({
        id: t._id ? t._id.toString() : t.code,
        vendorId: (t as any).vendorId || 'vnd_sipspot_central',
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
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_sipspot_central';
    const isSuperAdmin = (req as any).user?.role === 'SUPERADMIN';
    const db = getDB();
    let logs: any[] = [];

    if (db) {
      try {
        const filter = isSuperAdmin
          ? {}
          : (activeVendorId === 'vnd_sipspot_central'
              ? { $or: [{ vendorId: 'vnd_sipspot_central' }, { vendorId: { $exists: false } }, { vendorId: null }] }
              : { vendorId: activeVendorId });
        logs = await db.collection('email_logs').find(filter).sort({ sentAt: -1 }).limit(100).toArray();
      } catch (e) {}
    }

    if (logs.length === 0) {
      logs = fallbackStore.email_logs.filter(
        l => isSuperAdmin || (l.vendorId || 'vnd_sipspot_central') === activeVendorId
      );
    }

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
 * PUT /api/templates/:id
 * Manager only: update dynamic email template in MongoDB
 */
templateRouter.put('/:id', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_sipspot_central';
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
    let targetTemplate: any = null;

    if (db) {
      try {
        const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { code: id };
        targetTemplate = await db.collection('email_templates').findOne(query);
        await db.collection('email_templates').updateOne(query, { $set: updateData });
      } catch (e) {}
    }

    const idx = fallbackStore.email_templates.findIndex(t => (t._id && t._id.toString() === id) || t.code === id);
    if (idx !== -1) {
      if (!targetTemplate) targetTemplate = fallbackStore.email_templates[idx];
      fallbackStore.email_templates[idx] = { ...fallbackStore.email_templates[idx], ...updateData };
    }

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
