import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, adminOnly } from '../lib/auth.js';
import { z } from 'zod';

const router = Router();

// GET /api/settings — public, returns current app settings
router.get('/', async (_req: Request, res: Response) => {
  let settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings) {
    settings = await prisma.appSettings.create({ data: { id: 'singleton' } });
  }
  res.json(settings);
});

// PUT /api/settings — admin only, update settings
const updateSettingsSchema = z.object({
  appName: z.string().min(1).max(100).optional(),
  appSubtitle: z.string().max(100).optional(),
  appLogoBase64: z.string().nullable().optional(),
  companyName: z.string().max(200).nullable().optional(),
  companyEmail: z.string().email().max(200).nullable().optional(),
  companyPhone: z.string().max(50).nullable().optional(),
  companyAddress: z.string().max(500).nullable().optional(),
  clientPhotosCheckin: z.boolean().optional(),
  clientPhotosWork: z.boolean().optional(),
});

router.put('/', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;

  const settings = await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  });

  res.json(settings);
});

export default router;
