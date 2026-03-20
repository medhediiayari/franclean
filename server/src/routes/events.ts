import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, adminOnly } from '../lib/auth.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

// Helper: format event for frontend
function formatEvent(event: any) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    client: event.client,
    color: event.color,
    startDate: event.startDate.toISOString().slice(0, 10),
    endDate: event.endDate.toISOString().slice(0, 10),
    shifts: (event.shifts || []).map((s: any) => ({
      id: s.id,
      agentId: s.agentId || null,
      date: s.date.toISOString().slice(0, 10),
      startTime: s.startTime,
      endTime: s.endTime,
    })),
    address: event.address,
    latitude: event.latitude,
    longitude: event.longitude,
    geoRadius: event.geoRadius,
    assignedAgentIds: (event.agents || []).map((ea: any) => ea.agentId),
    agentResponses: Object.fromEntries(
      (event.agents || []).map((ea: any) => [ea.agentId, ea.response]),
    ),
    status: event.status,
    history: (event.history || []).map((h: any) => ({
      action: h.action,
      userId: h.userId,
      timestamp: h.timestamp.toISOString(),
      details: h.details,
    })),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

const eventInclude = {
  shifts: { orderBy: { date: 'asc' as const } },
  agents: true,
  history: { orderBy: { timestamp: 'asc' as const } },
};

// GET /api/events
router.get('/', async (req: Request, res: Response) => {
  const where: any = {};

  // Agents only see their own events
  if (req.auth!.role === 'agent') {
    where.agents = { some: { agentId: req.auth!.userId } };
  }

  const events = await prisma.event.findMany({
    where,
    include: eventInclude,
    orderBy: { startDate: 'desc' },
  });

  res.json(events.map(formatEvent));
});

// GET /api/events/:id
router.get('/:id', async (req: Request, res: Response) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: eventInclude,
  });
  if (!event) {
    res.status(404).json({ error: 'Événement introuvable' });
    return;
  }
  res.json(formatEvent(event));
});

const shiftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  agentId: z.string().optional().nullable(),
});

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  client: z.string().optional(),
  color: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shifts: z.array(shiftSchema).optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  geoRadius: z.number().int().optional(),
  assignedAgentIds: z.array(z.string()).optional(),
  status: z.enum(['planifie', 'en_cours', 'termine', 'a_reattribuer', 'annule']).optional(),
});

// POST /api/events (admin only)
router.post('/', adminOnly, async (req: Request, res: Response) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const { shifts, assignedAgentIds, startDate, endDate, ...rest } = parsed.data;

  const event = await prisma.event.create({
    data: {
      ...rest,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      shifts: shifts
        ? { create: shifts.map((s) => ({ date: new Date(s.date), startTime: s.startTime, endTime: s.endTime, agentId: s.agentId || null })) }
        : undefined,
      agents: assignedAgentIds
        ? { create: assignedAgentIds.map((agentId) => ({ agentId, response: 'pending' })) }
        : undefined,
      history: {
        create: {
          action: 'Création',
          userId: req.auth!.userId,
        },
      },
    },
    include: eventInclude,
  });

  res.status(201).json(formatEvent(event));
});

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  client: z.string().nullable().optional(),
  color: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  shifts: z.array(shiftSchema).optional(),
  address: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  geoRadius: z.number().int().optional(),
  assignedAgentIds: z.array(z.string()).optional(),
  status: z.enum(['planifie', 'en_cours', 'termine', 'a_reattribuer', 'annule']).optional(),
});

// PUT /api/events/:id (admin only)
router.put('/:id', adminOnly, async (req: Request, res: Response) => {
  const parsed = updateEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const { shifts, assignedAgentIds, startDate, endDate, ...rest } = parsed.data;
  const eventId = req.params.id;

  // Build update data
  const updateData: any = { ...rest };
  if (startDate) updateData.startDate = new Date(startDate);
  if (endDate) updateData.endDate = new Date(endDate);

  await prisma.$transaction(async (tx) => {
    // Update shifts if provided
    if (shifts) {
      await tx.eventShift.deleteMany({ where: { eventId } });
      await tx.eventShift.createMany({
        data: shifts.map((s) => ({
          eventId,
          date: new Date(s.date),
          startTime: s.startTime,
          endTime: s.endTime,
          agentId: s.agentId || null,
        })),
      });
    }

    // Update agents if provided
    if (assignedAgentIds) {
      // Get existing agents to preserve their response
      const existing = await tx.eventAgent.findMany({ where: { eventId } });
      const existingMap = new Map(existing.map((ea) => [ea.agentId, ea.response]));

      await tx.eventAgent.deleteMany({ where: { eventId } });
      await tx.eventAgent.createMany({
        data: assignedAgentIds.map((agentId) => ({
          eventId,
          agentId,
          response: existingMap.get(agentId) || 'pending',
        })),
      });
    }

    // Add history entry
    await tx.eventHistory.create({
      data: {
        eventId,
        action: 'Modification',
        userId: req.auth!.userId,
      },
    });

    await tx.event.update({
      where: { id: eventId },
      data: updateData,
    });
  });

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: eventInclude,
  });

  res.json(formatEvent(event));
});

// DELETE /api/events/:id (admin only)
router.delete('/:id', adminOnly, async (req: Request, res: Response) => {
  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: 'Événement introuvable' });
      return;
    }
    throw e;
  }
});

// POST /api/events/:id/response (agent sets their response)
const responseSchema = z.object({
  response: z.enum(['accepted', 'refused']),
});

router.post('/:id/response', async (req: Request, res: Response) => {
  const parsed = responseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Réponse invalide' });
    return;
  }

  const agentId = req.auth!.userId;
  const eventId = req.params.id;

  const ea = await prisma.eventAgent.findUnique({
    where: { eventId_agentId: { eventId, agentId } },
  });
  if (!ea) {
    res.status(404).json({ error: 'Vous n\'êtes pas assigné à cet événement' });
    return;
  }

  const { response } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.eventAgent.update({
      where: { id: ea.id },
      data: { response },
    });

    await tx.eventHistory.create({
      data: {
        eventId,
        action: response === 'accepted' ? 'Accepté par agent' : 'Refusé par agent',
        userId: agentId,
      },
    });

    // If refused, check if we need to update event status
    if (response === 'refused') {
      await tx.event.update({
        where: { id: eventId },
        data: { status: 'a_reattribuer' },
      });
    }
  });

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: eventInclude,
  });

  res.json(formatEvent(event));
});

// GET /api/events/conflicts?agentId=...&start=...&end=...&excludeId=...
router.get('/check/conflicts', async (req: Request, res: Response) => {
  const { agentId, start, end, excludeId } = req.query as Record<string, string>;
  if (!agentId || !start || !end) {
    res.status(400).json({ error: 'agentId, start, end requis' });
    return;
  }

  const events = await prisma.event.findMany({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      agents: { some: { agentId } },
      status: { notIn: ['annule', 'a_reattribuer'] },
      startDate: { lte: new Date(end) },
      endDate: { gte: new Date(start) },
    },
    include: eventInclude,
  });

  res.json(events.map(formatEvent));
});

export default router;
