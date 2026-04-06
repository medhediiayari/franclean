import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../lib/auth.js';
import { VAPID_PUBLIC_KEY } from '../lib/push.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

// GET /api/push/vapid-key — return public VAPID key
router.get('/vapid-key', (_req: Request, res: Response) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

// POST /api/push/subscribe — save push subscription
router.post('/subscribe', async (req: Request, res: Response) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides' });
    return;
  }

  const { endpoint, keys } = parsed.data;
  const userId = req.auth!.userId;

  // Upsert: update if endpoint already exists
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth },
  });

  res.json({ ok: true });
});

// POST /api/push/unsubscribe — remove push subscription
router.post('/unsubscribe', async (req: Request, res: Response) => {
  const { endpoint } = req.body || {};
  if (!endpoint) {
    res.status(400).json({ error: 'Endpoint manquant' });
    return;
  }

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.auth!.userId } });
  res.json({ ok: true });
});

export default router;
