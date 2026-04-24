import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { authMiddleware, adminOnly } from '../lib/auth.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

const clientInclude = { sites: { orderBy: { name: 'asc' as const } }, users: { select: { id: true, email: true, isActive: true, isMainAccount: true } } };

// ── Clients ─────────────────────────────────────────────

// GET /api/clients
router.get('/', async (_req: Request, res: Response) => {
  const clients = await prisma.client.findMany({
    include: clientInclude,
    orderBy: { name: 'asc' },
  });
  res.json(clients);
});

// GET /api/clients/:id
router.get('/:id', async (req: Request, res: Response) => {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: clientInclude,
  });
  if (!client) { res.status(404).json({ error: 'Client introuvable' }); return; }
  res.json(client);
});

const createClientSchema = z.object({
  name: z.string().min(1).transform((v) => v.trim().toUpperCase()),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  siret: z.string().optional().nullable(),
  siren: z.string().optional().nullable(),
  formeJuridique: z.string().optional().nullable(),
  tvaNumber: z.string().optional().nullable(),
  representantLegal: z.string().optional().nullable(),
  representantRole: z.string().optional().nullable(),
  codeApe: z.string().optional().nullable(),
  capitalSocial: z.string().optional().nullable(),
  rcs: z.string().optional().nullable(),
});

// POST /api/clients (admin)
router.post('/', adminOnly, async (req: Request, res: Response) => {
  const parsed = createClientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.client.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    res.status(409).json({ error: 'Un client avec ce nom existe déjà' });
    return;
  }

  const client = await prisma.client.create({
    data: parsed.data,
    include: clientInclude,
  });
  res.status(201).json(client);
});

const updateClientSchema = z.object({
  name: z.string().min(1).transform((v) => v.trim().toUpperCase()).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  siret: z.string().nullable().optional(),
  siren: z.string().nullable().optional(),
  formeJuridique: z.string().nullable().optional(),
  tvaNumber: z.string().nullable().optional(),
  representantLegal: z.string().nullable().optional(),
  representantRole: z.string().nullable().optional(),
  codeApe: z.string().nullable().optional(),
  capitalSocial: z.string().nullable().optional(),
  rcs: z.string().nullable().optional(),
});

// PUT /api/clients/:id (admin)
router.put('/:id', adminOnly, async (req: Request, res: Response) => {
  const parsed = updateClientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const client = await prisma.client.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: clientInclude,
  });
  res.json(client);
});

// DELETE /api/clients/:id (admin)
router.delete('/:id', adminOnly, async (req: Request, res: Response) => {
  await prisma.client.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ── Sites ───────────────────────────────────────────────

const createSiteSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  geoRadius: z.number().int().optional(),
  hourlyRate: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// POST /api/clients/:clientId/sites (admin)
router.post('/:clientId/sites', adminOnly, async (req: Request, res: Response) => {
  const parsed = createSiteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const site = await prisma.clientSite.create({
    data: { clientId: req.params.clientId, ...parsed.data },
  });
  res.status(201).json(site);
});

const updateSiteSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  geoRadius: z.number().int().optional(),
  hourlyRate: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// PUT /api/clients/:clientId/sites/:siteId (admin)
router.put('/:clientId/sites/:siteId', adminOnly, async (req: Request, res: Response) => {
  const parsed = updateSiteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const site = await prisma.clientSite.update({
    where: { id: req.params.siteId },
    data: parsed.data,
  });
  res.json(site);
});

// DELETE /api/clients/:clientId/sites/:siteId (admin)
router.delete('/:clientId/sites/:siteId', adminOnly, async (req: Request, res: Response) => {
  await prisma.clientSite.delete({ where: { id: req.params.siteId } });
  res.json({ success: true });
});

// ── Client Account Management ──────────────────────────

function generatePassword(): string {
  return crypto.randomBytes(6).toString('base64url').slice(0, 10);
}

function generateClientEmail(clientName: string): string {
  const slug = clientName
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return `${slug}@client.bipbip.fr`;
}

// POST /api/clients/:id/create-account — auto-generate user account for client
router.post('/:id/create-account', adminOnly, async (req: Request, res: Response) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id }, include: { users: true } });
  if (!client) { res.status(404).json({ error: 'Client introuvable' }); return; }
  const mainUser = client.users.find((u) => u.isMainAccount);
  if (mainUser) { res.status(409).json({ error: 'Ce client a déjà un compte', email: mainUser.email }); return; }

  const plainPassword = generatePassword();
  const email = client.email || generateClientEmail(client.name);
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  // Check email uniqueness
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    res.status(409).json({ error: `L'email ${email} est déjà utilisé` });
    return;
  }

  const user = await prisma.user.create({
    data: {
      firstName: client.name,
      lastName: 'Client',
      email,
      password: hashedPassword,
      role: 'client',
      isActive: true,
      isMainAccount: true,
      clientId: client.id,
    },
  });

  res.status(201).json({
    userId: user.id,
    email,
    password: plainPassword, // shown once to admin
    clientName: client.name,
  });
});

// DELETE /api/clients/:id/account — remove client account
router.delete('/:id/account', adminOnly, async (req: Request, res: Response) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id }, include: { users: true } });
  if (!client) { res.status(404).json({ error: 'Client introuvable' }); return; }
  const mainUser = client.users.find((u) => u.isMainAccount);
  if (!mainUser) { res.status(404).json({ error: 'Ce client n\'a pas de compte' }); return; }

  await prisma.user.delete({ where: { id: mainUser.id } });
  res.json({ success: true });
});

// POST /api/clients/:id/reset-password — generate new password for client
router.post('/:id/reset-password', adminOnly, async (req: Request, res: Response) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id }, include: { users: true } });
  if (!client) { res.status(404).json({ error: 'Client introuvable' }); return; }
  const mainUser = client.users.find((u) => u.isMainAccount);
  if (!mainUser) { res.status(404).json({ error: 'Ce client n\'a pas de compte' }); return; }

  const plainPassword = generatePassword();
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  await prisma.user.update({
    where: { id: mainUser.id },
    data: { password: hashedPassword },
  });

  res.json({ email: mainUser.email, password: plainPassword });
});

export default router;
