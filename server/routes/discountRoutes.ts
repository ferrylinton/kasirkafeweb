import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { 
  calculateDiscounts, 
  getActiveDiscountRules, 
  DEFAULT_RULES, 
  evaluateDiscountsForOrder,
  calculateItemDiscountPrice
} from '../discounts';
import { getDB, fallbackStore } from '../db';
import { authMiddleware, requireManager } from '../auth';
import { ObjectId } from 'mongodb';
import { recordActivityLog } from '../activityLogger';

export const discountRouter = Router();

const evaluateSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    category: z.string(),
    price: z.number(),
    quantity: z.number().int().min(1)
  })),
  subtotal: z.number().min(0)
});

/**
 * POST /api/discounts/evaluate
 * Returns eligible discount rules and all rules for the current order
 */
discountRouter.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const parsed = evaluateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: parsed.error.format()
      });
    }

    const { items, subtotal } = parsed.data;
    const result = await evaluateDiscountsForOrder(items, subtotal);

    return res.json({
      success: true,
      eligibleDiscounts: result.eligibleDiscounts,
      allRules: result.allRules
    });
  } catch (err: any) {
    console.error('[Discounts] Evaluation error:', err);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

const calculateSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    category: z.string(),
    price: z.number(),
    quantity: z.number().int().min(1)
  })),
  subtotal: z.number().min(0),
  customerBirthDate: z.string().optional(),
  isBirthdayClaimed: z.boolean().optional()
});

/**
 * POST /api/discounts/calculate
 */
discountRouter.post('/calculate', async (req: Request, res: Response) => {
  try {
    const parsed = calculateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: parsed.error.format()
      });
    }

    const { items, subtotal, customerBirthDate, isBirthdayClaimed } = parsed.data;
    const result = await calculateDiscounts(items, subtotal, customerBirthDate, isBirthdayClaimed);

    return res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * GET /api/discounts/rules
 */
discountRouter.get('/rules', async (req: Request, res: Response) => {
  try {
    const activeVendorId = (req as any).activeVendorId || (req as any).user?.vendorId || 'vnd_sipspot_central';
    const isSuperAdmin = (req as any).user?.role === 'SUPERADMIN';

    const db = getDB();
    let rules: any[] = [];
    if (db) {
      try {
        const filter = isSuperAdmin
          ? {}
          : { $or: [{ vendorId: activeVendorId }, { vendorId: { $exists: false } }] };
        rules = await db.collection('discount_rules').find(filter).toArray();
      } catch (e) {}
    }
    if (rules.length === 0) {
      const source = fallbackStore.discount_rules.length > 0 ? fallbackStore.discount_rules : DEFAULT_RULES;
      rules = isSuperAdmin
        ? source
        : source.filter(r => (r.vendorId || 'vnd_sipspot_central') === activeVendorId || !r.vendorId);
    }

    return res.json({
      success: true,
      rules: rules.map(r => ({
        id: r._id ? r._id.toString() : r.code,
        vendorId: r.vendorId || 'vnd_sipspot_central',
        code: r.code,
        name: r.name,
        description: r.description,
        type: r.type,
        threshold: r.threshold,
        rewardType: r.rewardType,
        rewardValue: r.rewardValue,
        isActive: r.isActive !== false
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * POST /api/discounts/rules
 * Create a new discount rule (Manager only)
 */
const ruleInputSchema = z.object({
  code: z.string().min(2).max(60),
  name: z.string().min(2).max(100),
  description: z.string().min(2).max(300),
  type: z.enum(['QUANTITY_THRESHOLD', 'MIN_SPEND', 'BIRTHDAY', 'CUSTOM']),
  threshold: z.number().optional().nullable(),
  rewardType: z.enum(['FREE_SNACK', 'FREE_DRINK_OR_SNACK', 'PERCENTAGE', 'FIXED_AMOUNT']),
  rewardValue: z.number().optional().nullable(),
  isActive: z.boolean().default(true)
});

discountRouter.post('/rules', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const parsed = ruleInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Data aturan diskon tidak valid',
        details: parsed.error.format()
      });
    }

    const { code, name, description, type, threshold, rewardType, rewardValue, isActive } = parsed.data;
    const formattedCode = code.trim().toUpperCase().replace(/\s+/g, '_');

    const db = getDB();

    // Check if code already exists
    let existingRule = null;
    if (db) {
      try {
        existingRule = await db.collection('discount_rules').findOne({ code: formattedCode });
      } catch (e) {}
    }
    if (!existingRule) {
      existingRule = fallbackStore.discount_rules.find(r => r.code === formattedCode);
    }

    if (existingRule) {
      return res.status(400).json({
        success: false,
        error: `Kode promo "${formattedCode}" sudah digunakan. Gunakan kode yang unik!`
      });
    }

    const activeVendorId = (req as any).activeVendorId || (req as any).user?.vendorId || 'vnd_sipspot_central';

    const newRuleData = {
      vendorId: activeVendorId,
      code: formattedCode,
      name: name.trim(),
      description: description.trim(),
      type,
      threshold: typeof threshold === 'number' ? threshold : 0,
      rewardType,
      rewardValue: typeof rewardValue === 'number' ? rewardValue : 0,
      isActive: isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    let insertedId = `rule_${Date.now()}`;
    if (db) {
      try {
        const result = await db.collection('discount_rules').insertOne(newRuleData);
        insertedId = result.insertedId.toString();
      } catch (e) {}
    }

    const createdRule = {
      ...newRuleData,
      _id: insertedId,
      id: insertedId
    };

    fallbackStore.discount_rules.push(createdRule);

    // Record system-wide activity log
    await recordActivityLog({
      action: 'CREATE',
      entity: 'DISCOUNT_RULE',
      entityId: insertedId,
      entityName: `${name} (${formattedCode})`,
      summary: `Menambahkan aturan diskon baru '${name}' [${formattedCode}] - ${rewardType}`,
      details: {
        id: insertedId,
        code: formattedCode,
        name,
        type,
        threshold,
        rewardType,
        rewardValue,
        isActive
      },
      req
    });

    return res.status(201).json({
      success: true,
      rule: {
        id: insertedId,
        code: createdRule.code,
        name: createdRule.name,
        description: createdRule.description,
        type: createdRule.type,
        threshold: createdRule.threshold,
        rewardType: createdRule.rewardType,
        rewardValue: createdRule.rewardValue,
        isActive: createdRule.isActive
      },
      message: 'Aturan diskon baru berhasil dibuat!'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * GET /api/discounts/rules/:id
 */
discountRouter.get('/rules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDB();
    let rule = null;

    if (db) {
      try {
        const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { code: id };
        rule = await db.collection('discount_rules').findOne(query);
      } catch (e) {}
    }

    if (!rule) {
      rule = fallbackStore.discount_rules.find(r => (r._id && r._id.toString() === id) || r.code === id);
    }

    if (!rule) {
      return res.status(404).json({ success: false, error: 'Aturan diskon tidak ditemukan' });
    }

    return res.json({
      success: true,
      rule: {
        id: rule._id ? rule._id.toString() : rule.code,
        code: rule.code,
        name: rule.name,
        description: rule.description,
        type: rule.type,
        threshold: rule.threshold,
        rewardType: rule.rewardType,
        rewardValue: rule.rewardValue,
        isActive: rule.isActive !== false
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * PUT /api/discounts/rules/:id
 * Manager can toggle or edit discount rules
 */
discountRouter.put('/rules/:id', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date() };

    if (updateData.code) {
      updateData.code = updateData.code.trim().toUpperCase().replace(/\s+/g, '_');
    }
    if (updateData.name) {
      updateData.name = updateData.name.trim();
    }
    if (updateData.description) {
      updateData.description = updateData.description.trim();
    }

    const db = getDB();
    let existingRule: any = null;

    const activeVendorId = (req as any).activeVendorId || (req as any).user?.vendorId || 'vnd_sipspot_central';
    const isSuperAdmin = (req as any).user?.role === 'SUPERADMIN';

    if (db) {
      try {
        const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { code: id };
        existingRule = await db.collection('discount_rules').findOne(query);
        if (existingRule && !isSuperAdmin && existingRule.vendorId && existingRule.vendorId !== activeVendorId) {
          return res.status(403).json({ success: false, error: 'Akses ditolak: Aturan diskon milik vendor lain' });
        }
        await db.collection('discount_rules').updateOne(query, { $set: updateData });
      } catch (e) {}
    }

    const idx = fallbackStore.discount_rules.findIndex(r => (r._id && r._id.toString() === id) || r.code === id);
    if (idx !== -1) {
      if (!existingRule) existingRule = fallbackStore.discount_rules[idx];
      if (existingRule && !isSuperAdmin && existingRule.vendorId && existingRule.vendorId !== activeVendorId) {
        return res.status(403).json({ success: false, error: 'Akses ditolak: Aturan diskon milik vendor lain' });
      }
      fallbackStore.discount_rules[idx] = { ...fallbackStore.discount_rules[idx], ...updateData };
    }

    const ruleLabel = existingRule?.name || updateData.name || id;

    // Record system-wide activity log
    await recordActivityLog({
      action: 'UPDATE',
      entity: 'DISCOUNT_RULE',
      entityId: id,
      entityName: ruleLabel,
      summary: `Memperbarui aturan diskon '${ruleLabel}'`,
      details: {
        ruleId: id,
        updates: updateData
      },
      req
    });

    return res.json({ success: true, message: 'Aturan diskon berhasil diperbarui!' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * DELETE /api/discounts/rules/:id
 * Manager can delete discount rules
 */
discountRouter.delete('/rules/:id', authMiddleware, requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDB();
    let targetRule: any = null;

    const activeVendorId = (req as any).activeVendorId || (req as any).user?.vendorId || 'vnd_sipspot_central';
    const isSuperAdmin = (req as any).user?.role === 'SUPERADMIN';

    if (db) {
      try {
        const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { code: id };
        targetRule = await db.collection('discount_rules').findOne(query);
        if (targetRule && !isSuperAdmin && targetRule.vendorId && targetRule.vendorId !== activeVendorId) {
          return res.status(403).json({ success: false, error: 'Akses ditolak: Aturan diskon milik vendor lain' });
        }
        await db.collection('discount_rules').deleteOne(query);
      } catch (e) {}
    }

    const idx = fallbackStore.discount_rules.findIndex(r => (r._id && r._id.toString() === id) || r.code === id);
    if (idx !== -1) {
      if (!targetRule) targetRule = fallbackStore.discount_rules[idx];
      if (targetRule && !isSuperAdmin && targetRule.vendorId && targetRule.vendorId !== activeVendorId) {
        return res.status(403).json({ success: false, error: 'Akses ditolak: Aturan diskon milik vendor lain' });
      }
    }

    fallbackStore.discount_rules = fallbackStore.discount_rules.filter(
      r => !(r._id && r._id.toString() === id) && r.code !== id
    );

    const ruleLabel = targetRule?.name ? `${targetRule.name} [${targetRule.code}]` : id;

    // Record system-wide activity log
    await recordActivityLog({
      action: 'DELETE',
      entity: 'DISCOUNT_RULE',
      entityId: id,
      entityName: ruleLabel,
      summary: `Menghapus aturan diskon '${ruleLabel}' dari database`,
      details: {
        ruleId: id,
        deletedRule: targetRule
      },
      req
    });

    return res.json({ success: true, message: 'Aturan diskon berhasil dihapus!' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});
