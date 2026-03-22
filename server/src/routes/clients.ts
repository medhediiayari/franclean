import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../lib/auth.js';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/clients — list all clients sorted by name
router.get('/', async (_req: Request, res: Response) => {
  const clients = await prisma.client.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(clients);
});

// POST /api/clients — create a new client
const createSchema = z.object({
  name: z.string().min(1).transform((v) => v.trim().toUpperCase()),
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Nom du client requis' });
    return;
  }

  const { name } = parsed.data;

  // Upsert: return existing if already exists
  const client = await prisma.client.upsert({
    where: { name },
    update: {},
    create: { name },
  });

  res.status(201).json(client);
});

// DELETE /api/clients/:id
router.delete('/:id', async (req: Request, res: Response) => {
  await prisma.client.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
