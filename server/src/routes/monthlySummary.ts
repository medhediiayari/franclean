import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../lib/auth.js';

const router = Router();
router.use(authMiddleware);

// ── Helpers ──────────────────────────────────────────────

/** Compute total & validated hours for an agent for a given month from attendances */
async function computeHours(agentId: string, year: number, month: number) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);

  const records = await prisma.attendance.findMany({
    where: {
      agentId,
      date: { gte: from, lt: to },
    },
  });

  const totalHours = records.reduce((s, r) => s + (r.hoursWorked ?? 0), 0);
  const validatedHours = records
    .filter((r) => r.status === 'valide')
    .reduce((s, r) => s + (r.billedHours ?? r.hoursWorked ?? 0), 0);

  return { totalHours, validatedHours, count: records.length };
}

/** Upsert a monthly summary row, recomputing hours from attendances */
async function upsertSummary(agentId: string, year: number, month: number) {
  const { totalHours, validatedHours } = await computeHours(agentId, year, month);

  return prisma.monthlyHoursSummary.upsert({
    where: { agentId_year_month: { agentId, year, month } },
    create: { agentId, year, month, totalHours, validatedHours },
    update: { totalHours, validatedHours },
    include: { agent: { select: { id: true, firstName: true, lastName: true, agentPercentage: true } } },
  });
}

// ── Agent routes ─────────────────────────────────────────

/**
 * GET /api/monthly-summary/mine
 * Returns all monthly summaries for the authenticated agent (last 12 months + any older)
 */
router.get('/mine', async (req: Request, res: Response) => {
  if (req.auth!.role === 'client') {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  const agentId = req.auth!.userId;
  const now = new Date();

  // Auto-upsert last 12 months so agent always sees recent months
  const upserts: Promise<any>[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    upserts.push(upsertSummary(agentId, d.getFullYear(), d.getMonth() + 1).catch(() => null));
  }
  await Promise.all(upserts);

  const summaries = await prisma.monthlyHoursSummary.findMany({
    where: { agentId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });

  res.json(summaries);
});

/**
 * POST /api/monthly-summary/confirm
 * Agent confirms their hours for a given month
 */
router.post('/confirm', async (req: Request, res: Response) => {
  if (req.auth!.role === 'client') {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  const { year, month, note } = req.body;
  if (!year || !month) {
    res.status(400).json({ error: 'year et month requis' });
    return;
  }

  const agentId = req.auth!.userId;
  // Recompute hours at confirmation time
  const { totalHours, validatedHours } = await computeHours(agentId, year, month);

  const summary = await prisma.monthlyHoursSummary.upsert({
    where: { agentId_year_month: { agentId, year, month } },
    create: {
      agentId, year, month, totalHours, validatedHours,
      confirmedByAgent: true,
      confirmedAt: new Date(),
      agentNote: note ?? null,
    },
    update: {
      totalHours,
      validatedHours,
      confirmedByAgent: true,
      confirmedAt: new Date(),
      agentNote: note ?? null,
    },
  });

  res.json(summary);
});

// ── Admin routes ─────────────────────────────────────────

/**
 * GET /api/monthly-summary/admin?year=YYYY&month=M
 * Returns all agents' summaries for the given month (auto-creating if missing)
 */
router.get('/admin', async (req: Request, res: Response) => {
  if (req.auth!.role !== 'admin') {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  const now = new Date();
  const year = parseInt(req.query.year as string) || now.getFullYear();
  const month = parseInt(req.query.month as string) || (now.getMonth() + 1);

  // Get all active agents
  const agents = await prisma.user.findMany({
    where: { role: 'agent', isActive: true },
    select: { id: true, firstName: true, lastName: true, agentPercentage: true },
  });

  // Upsert summaries for all agents (recompute hours)
  const summaries = await Promise.all(
    agents.map((a) => upsertSummary(a.id, year, month))
  );

  res.json(summaries);
});

/**
 * GET /api/monthly-summary/admin/all
 * Returns all confirmation statuses across all months, for the confirmations overview
 */
router.get('/admin/all', async (req: Request, res: Response) => {
  if (req.auth!.role !== 'admin') {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  const summaries = await prisma.monthlyHoursSummary.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { agentId: 'asc' }],
    include: {
      agent: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  res.json(summaries);
});

export default router;
