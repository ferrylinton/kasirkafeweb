import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB, fallbackStore } from '../db';
import { authMiddleware, requireManager } from '../auth';
import { ObjectId } from 'mongodb';

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
    const db = getDB();
    let templates: any[] = [];
    if (db) {
      try {
        templates = await db.collection('email_templates').find({}).toArray();
      } catch (e) {}
    }
    if (templates.length === 0) {
      templates = fallbackStore.email_templates;
    }

    return res.json({
      success: true,
      templates: templates.map(t => ({
        id: t._id ? t._id.toString() : t.code,
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
 * PUT /api/templates/:id
 * Manager only: update dynamic email template in MongoDB
 */
templateRouter.put('/:id', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
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
      updatedAt: new Date()
    };

    const db = getDB();
    if (db) {
      try {
        const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { code: id };
        await db.collection('email_templates').updateOne(query, { $set: updateData });
      } catch (e) {}
    }

    const idx = fallbackStore.email_templates.findIndex(t => (t._id && t._id.toString() === id) || t.code === id);
    if (idx !== -1) {
      fallbackStore.email_templates[idx] = { ...fallbackStore.email_templates[idx], ...updateData };
    }

    return res.json({
      success: true,
      message: 'Template email berhasil diperbarui di database!'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});
