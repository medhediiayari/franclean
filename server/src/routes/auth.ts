import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { signToken, authMiddleware } from '../lib/auth.js';
import { sendPasswordResetEmail } from '../lib/email.js';
import { z } from 'zod';

// Utility: generate a stable matricule from user id (e.g. AGT-A3F2B1)
export function agentMatricule(userId: string): string {
  const clean = userId.replace(/[^a-zA-Z0-9]/g, '');
  return 'AGT-' + clean.slice(-6).toUpperCase();
}

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  persist: z.boolean().optional(),
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Email et mot de passe requis' });
    return;
  }

  const { email, password, persist } = parsed.data;
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

  // Long-lived token for mobile/PWA (persist=true)
  const token = signToken({ userId: user.id, role: user.role }, persist === true);
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

// PUT /api/auth/profile — update own profile (name, phone, avatar)
const profileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  avatar: z.string().nullable().optional(), // base64 data URL or null to remove
});

router.put('/profile', authMiddleware, async (req: Request, res: Response) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides' });
    return;
  }
  const data: Record<string, any> = {};
  if (parsed.data.firstName !== undefined) data.firstName = parsed.data.firstName;
  if (parsed.data.lastName !== undefined) data.lastName = parsed.data.lastName;
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone;
  if (parsed.data.avatar !== undefined) data.avatar = parsed.data.avatar;

  const user = await prisma.user.update({
    where: { id: req.auth!.userId },
    data,
    omit: { password: true },
  });
  res.json(user);
});

// PUT /api/auth/password — change own password
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

router.put('/password', authMiddleware, async (req: Request, res: Response) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  const valid = await bcrypt.compare(parsed.data.currentPassword, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    return;
  }
  const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: req.auth!.userId }, data: { password: hashed } });
  res.json({ success: true });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email requis' });
    return;
  }

  // Always return 200 to not reveal whether the email exists
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (user && user.isActive) {
    // Invalidate any existing tokens
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: rawToken, expiresAt },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, user.firstName, resetUrl);
  }

  res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
});

// POST /api/auth/reset-password
const resetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6),
});

router.post('/reset-password', async (req: Request, res: Response) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides' });
    return;
  }

  const { token, newPassword } = parsed.data;
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!record) {
    res.status(400).json({ error: 'Lien invalide ou expiré' });
    return;
  }
  if (record.usedAt) {
    res.status(400).json({ error: 'Ce lien a déjà été utilisé' });
    return;
  }
  if (record.expiresAt < new Date()) {
    res.status(400).json({ error: 'Ce lien a expiré. Veuillez faire une nouvelle demande.' });
    return;
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { password: hashed } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  res.json({ message: 'Mot de passe réinitialisé avec succès.' });
});

export default router;
