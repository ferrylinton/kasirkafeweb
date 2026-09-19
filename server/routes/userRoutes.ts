import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB, fallbackStore } from '../db';
import { hashPassword, authMiddleware, requireManager } from '../auth';
import { ObjectId } from 'mongodb';
import { recordActivityLog } from '../activityLogger';

export const userRouter = Router();

// Protect all routes in this router with JWT auth & Manager role
userRouter.use(authMiddleware, requireManager);

const createUserSchema = z.object({
  name: z.string().min(2, 'Nama pengguna minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  role: z.enum(['MANAGER', 'CASHIER']),
  pin: z.string().length(6, 'PIN harus 6 digit angka'),
  avatar: z.string().optional()
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['MANAGER', 'CASHIER']).optional(),
  pin: z.string().length(6, 'PIN harus 6 digit angka').optional(),
  avatar: z.string().optional(),
  newPassword: z.string().min(6).optional()
});

/**
 * GET /api/users
 */
userRouter.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDB();
    let usersList: any[] = [];

    if (db) {
      try {
        const cursor = db.collection('users').find({}, { projection: { password: 0 } });
        usersList = await cursor.toArray();
      } catch (e) {
        // Fallback
      }
    }

    if (usersList.length === 0) {
      usersList = fallbackStore.users.map(({ password, ...rest }) => rest);
    }

    return res.json({
      success: true,
      users: usersList.map(u => ({
        id: u._id ? u._id.toString() : u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        pin: u.pin,
        avatar: u.avatar,
        createdAt: u.createdAt
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * POST /api/users
 */
userRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: parsed.error.format()
      });
    }

    const { name, email, password, role, pin, avatar } = parsed.data;
    const db = getDB();

    // Check existing email
    let existingUser = null;
    if (db) {
      try {
        existingUser = await db.collection('users').findOne({ email: email.toLowerCase() });
      } catch (e) {}
    }
    if (!existingUser) {
      existingUser = fallbackStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    }

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email Exists',
        message: 'Email tersebut sudah terdaftar di sistem.'
      });
    }

    const hashedPassword = await hashPassword(password);
    const newUser = {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      pin,
      avatar: avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    let insertedId: any = new ObjectId().toString();
    if (db) {
      try {
        const result = await db.collection('users').insertOne(newUser);
        insertedId = result.insertedId.toString();
      } catch (e) {
        fallbackStore.users.push({ ...newUser, _id: insertedId });
      }
    } else {
      fallbackStore.users.push({ ...newUser, _id: insertedId });
    }

    // Record system-wide activity log
    await recordActivityLog({
      action: 'CREATE',
      entity: 'USER',
      entityId: insertedId,
      entityName: `${name} (${role})`,
      summary: `Mendaftarkan pengguna baru '${name}' dengan peran ${role} (${email})`,
      details: {
        userId: insertedId,
        name,
        email,
        role
      },
      req
    });

    return res.status(201).json({
      success: true,
      message: `User ${name} (${role}) berhasil didaftarkan!`,
      user: {
        id: insertedId,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        pin: newUser.pin
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * PUT /api/users/:id
 * Update user details or reset password
 */
userRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: parsed.error.format()
      });
    }

    const updateFields: any = { updatedAt: new Date() };
    if (parsed.data.name) updateFields.name = parsed.data.name;
    if (parsed.data.email) updateFields.email = parsed.data.email.toLowerCase();
    if (parsed.data.role) updateFields.role = parsed.data.role;
    if (parsed.data.pin) updateFields.pin = parsed.data.pin;
    if (parsed.data.avatar !== undefined) updateFields.avatar = parsed.data.avatar;
    if (parsed.data.newPassword) {
      updateFields.password = await hashPassword(parsed.data.newPassword);
    }

    const db = getDB();
    let existingUser: any = null;

    if (db) {
      try {
        const query: any = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
        existingUser = await db.collection('users').findOne(query);
        await db.collection('users').updateOne(query, { $set: updateFields });
      } catch (e) {}
    }

    // Update fallback store
    const idx = fallbackStore.users.findIndex(u => (u._id && u._id.toString() === id) || u.id === id);
    if (idx !== -1) {
      if (!existingUser) existingUser = fallbackStore.users[idx];
      fallbackStore.users[idx] = { ...fallbackStore.users[idx], ...updateFields };
    }

    const userName = existingUser?.name || updateFields.name || id;

    // Record system-wide activity log
    await recordActivityLog({
      action: 'UPDATE',
      entity: 'USER',
      entityId: id,
      entityName: userName,
      summary: `Memperbarui data akun pengguna '${userName}'${parsed.data.newPassword ? ' (termasuk reset password)' : ''}`,
      details: {
        userId: id,
        updatedFields: Object.keys(updateFields).filter(k => k !== 'password'),
        passwordChanged: !!parsed.data.newPassword
      },
      req
    });

    return res.json({
      success: true,
      message: 'Data pengguna dan password berhasil diperbarui!'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * DELETE /api/users/:id
 */
userRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Prevent deleting self
    if (req.user?.userId === id) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.'
      });
    }

    const db = getDB();
    let targetUser: any = null;

    if (db) {
      try {
        const query: any = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
        targetUser = await db.collection('users').findOne(query);
        await db.collection('users').deleteOne(query);
      } catch (e) {}
    }

    const idx = fallbackStore.users.findIndex(u => (u._id && u._id.toString() === id) || u.id === id);
    if (idx !== -1) {
      if (!targetUser) targetUser = fallbackStore.users[idx];
      fallbackStore.users.splice(idx, 1);
    }

    const userName = targetUser?.name ? `${targetUser.name} (${targetUser.role || 'User'})` : id;

    // Record system-wide activity log
    await recordActivityLog({
      action: 'DELETE',
      entity: 'USER',
      entityId: id,
      entityName: userName,
      summary: `Menghapus pengguna '${userName}' dari sistem POS`,
      details: {
        userId: id,
        deletedUser: targetUser ? {
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role
        } : null
      },
      req
    });

    return res.json({
      success: true,
      message: 'Pengguna berhasil dihapus dari sistem.'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});
