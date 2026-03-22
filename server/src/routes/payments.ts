import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../lib/auth.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

// GET /api/payments?agentId=&periodStart=&periodEnd=
// Returns payments filtered by optional agentId and/or period
router.get('/', async (req: Request, res: Response) => {
  const { agentId, periodStart, periodEnd } = req.query;

  const where: Record<string, unknown> = {};
  if (agentId && typeof agentId === 'string') {
    where.agentId = agentId;
  }
  if (periodStart && typeof periodStart === 'string') {
    where.periodStart = periodStart;
  }
  if (periodEnd && typeof periodEnd === 'string') {
    where.periodEnd = periodEnd;
  }

  const payments = await prisma.agentPayment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  res.json(payments);
});

// GET /api/payments/agent/:agentId — all payments for an agent
router.get('/agent/:agentId', async (req: Request, res: Response) => {
  const payments = await prisma.agentPayment.findMany({
    where: { agentId: req.params.agentId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(payments);
});

// POST /api/payments — create a payment entry
const createSchema = z.object({
  agentId: z.string().min(1),
  type: z.enum(['virement', 'acompte']),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const payment = await prisma.agentPayment.create({
    data: parsed.data,
  });
  res.status(201).json(payment);
});

// PUT /api/payments/:id — update a payment entry
const updateSchema = z.object({
  amount: z.number().positive().optional(),
  note: z.string().optional(),
  type: z.enum(['virement', 'acompte']).optional(),
});

router.put('/:id', async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides' });
    return;
  }

  try {
    const payment = await prisma.agentPayment.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(payment);
  } catch {
    res.status(404).json({ error: 'Paiement introuvable' });
  }
});

// DELETE /api/payments/:id — delete a payment entry
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.agentPayment.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'Paiement introuvable' });
  }
});

export default router;
