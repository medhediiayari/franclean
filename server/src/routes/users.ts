import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { authMiddleware, adminOnly } from '../lib/auth.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

// GET /api/users
router.get('/', async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    omit: { password: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(users);
});

// GET /api/users/:id
router.get('/:id', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    omit: { password: true },
  });
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  res.json(user);
});

const createUserSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(4),
  phone: z.string().optional(),
  role: z.enum(['admin', 'agent']).optional(),
  isActive: z.boolean().optional(),
});

// POST /api/users (admin only)
router.post('/', adminOnly, async (req: Request, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const { password, ...rest } = parsed.data;
  const hashed = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: { ...rest, password: hashed },
      omit: { password: true },
    });
    res.status(201).json(user);
  } catch (e: any) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: 'Cet email existe déjà' });
      return;
    }
    throw e;
  }
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(4).optional(),
  phone: z.string().optional(),
  role: z.enum(['admin', 'agent']).optional(),
  isActive: z.boolean().optional(),
  avatar: z.string().nullable().optional(),
});

// PUT /api/users/:id (admin only)
router.put('/:id', adminOnly, async (req: Request, res: Response) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const { password, ...rest } = parsed.data;
  const data: any = { ...rest };
  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      omit: { password: true },
    });
    res.json(user);
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    throw e;
  }
});

// DELETE /api/users/:id (admin only)
router.delete('/:id', adminOnly, async (req: Request, res: Response) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    throw e;
  }
});

export default router;
