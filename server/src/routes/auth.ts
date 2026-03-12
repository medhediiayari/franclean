import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { signToken, authMiddleware } from '../lib/auth.js';
import { z } from 'zod';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Email et mot de passe requis' });
    return;
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Identifiants invalides' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Identifiants invalides' });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role });
  const { password: _, ...userWithoutPassword } = user;

  res.json({ token, user: userWithoutPassword });
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    omit: { password: true },
  });
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  res.json(user);
});

export default router;
