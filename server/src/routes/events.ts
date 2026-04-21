import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, adminOnly } from '../lib/auth.js';
import { emitEventsChanged, emitToAdmins, emitToUser } from '../lib/socket.js';
import { sendEmail, emailAgentAssigned, emailEventRefused, type ShiftInfo } from '../lib/email.js';
import { sendSms, smsAgentAssigned, smsEventRefused } from '../lib/sms.js';
import { notifyMissionCancelled } from '../lib/notificationEngine.js';
import { sendPushToUser, sendPushToAdmins } from '../lib/push.js';
import { z } from 'zod';

// Helper: send agent-assigned notification (email + sms) if rule is enabled
async function notifyAgentAssigned(agentIds: string[], event: any) {
  try {
    const rule = await prisma.emailNotificationRule.findUnique({ where: { type: 'agent_assigned' } });
    if (!rule || (!rule.enabled && !rule.smsEnabled)) return;

    const agents = await prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, email: true, phone: true, firstName: true, lastName: true } });
    const dates = `${event.startDate.toISOString().slice(0, 10)} → ${event.endDate.toISOString().slice(0, 10)}`;

    // Build shifts per agent from event data
    const allShifts: { agentId: string | null; date: Date; startTime: string; endTime: string }[] = event.shifts || [];

    for (const agent of agents) {
      // Filter shifts for this agent (or unassigned shifts if no agentId)
      const agentShifts: ShiftInfo[] = allShifts
        .filter((s: any) => s.agentId === agent.id || s.agentId === null)
        .map((s: any) => ({
          date: s.date instanceof Date ? s.date.toISOString().slice(0, 10) : String(s.date).slice(0, 10),
          startTime: s.startTime,
          endTime: s.endTime,
        }))
        .sort((a: ShiftInfo, b: ShiftInfo) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

      if (rule.enabled) {
        const already = await prisma.emailLog.findFirst({
          where: { ruleType: 'agent_assigned', entityId: `${event.id}-${agent.id}`, recipient: agent.email },
        });
        if (!already) {
          const html = emailAgentAssigned(`${agent.firstName} ${agent.lastName}`, event.title, event.client || '', dates, event.address, agentShifts);
          const sent = await sendEmail(agent.email, `Nouvelle mission : ${event.title}`, html);
          if (sent) {
            await prisma.emailLog.create({ data: { ruleType: 'agent_assigned', recipient: agent.email, subject: `Nouvelle mission : ${event.title}`, entityId: `${event.id}-${agent.id}` } });
          }
        }
      }

      if (rule.smsEnabled && agent.phone) {
        const alreadySms = await prisma.emailLog.findFirst({
          where: { ruleType: 'agent_assigned', entityId: `${event.id}-${agent.id}`, recipient: agent.phone, channel: 'sms' },
        });
        if (!alreadySms) {
          const smsBody = smsAgentAssigned(`${agent.firstName} ${agent.lastName}`, event.title, dates);
          const sent = await sendSms(agent.phone, smsBody);
          if (sent) {
            await prisma.emailLog.create({ data: { ruleType: 'agent_assigned', recipient: agent.phone, subject: 'SMS: nouvelle mission', channel: 'sms', entityId: `${event.id}-${agent.id}` } });
          }
        }
      }

      // Push notification to agent
      await sendPushToUser(agent.id, {
        title: '🎯 Nouvelle mission',
        body: `${event.title} — ${dates}`,
        url: '/agent/planning',
        tag: `assigned-${event.id}`,
      });
    }
  } catch (err) {
    console.error('Notification (agent_assigned) error:', err);
  }
}

// Helper: send event-refused notification (email + sms) if rule is enabled
async function notifyEventRefused(agentId: string, event: any) {
  try {
    const rule = await prisma.emailNotificationRule.findUnique({ where: { type: 'event_refused' } });
    if (!rule || (!rule.enabled && !rule.smsEnabled)) return;

    const agent = await prisma.user.findUnique({ where: { id: agentId }, select: { firstName: true, lastName: true, phone: true } });
    if (!agent) return;

    const agentName = `${agent.firstName} ${agent.lastName}`;

    if (rule.enabled) {
      const recipients = rule.recipients.length > 0 ? rule.recipients : (await prisma.user.findMany({ where: { role: 'admin', isActive: true }, select: { email: true } })).map(a => a.email);
      const html = emailEventRefused(agentName, event.title, event.client || '');
      const subject = `❌ Mission refusée : ${event.title}`;
      for (const email of recipients) {
        const sent = await sendEmail(email, subject, html);
        if (sent) {
          await prisma.emailLog.create({ data: { ruleType: 'event_refused', recipient: email, subject, entityId: event.id } });
        }
      }
    }

    if (rule.smsEnabled) {
      const adminPhones = (await prisma.user.findMany({ where: { role: 'admin', isActive: true, phone: { not: '' } }, select: { phone: true } })).map(a => a.phone);
      const smsBody = smsEventRefused(agentName, event.title);
      for (const phone of adminPhones) {
        const sent = await sendSms(phone, smsBody);
        if (sent) {
          await prisma.emailLog.create({ data: { ruleType: 'event_refused', recipient: phone, subject: 'SMS: mission refusée', channel: 'sms', entityId: event.id } });
        }
      }
    }

    // Push to admins
    await sendPushToAdmins({
      title: '❌ Mission refusée',
      body: `${agentName} a refusé "${event.title}"`,
      url: '/admin/planning',
      tag: `refused-${event.id}`,
    });
  } catch (err) {
    console.error('Notification (event_refused) error:', err);
  }
}

const router = Router();
router.use(authMiddleware);

// Helper: format event for frontend
function formatEvent(event: any) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    client: event.client,
    clientPhone: event.clientPhone,
    site: event.site,
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
    hourlyRate: event.hourlyRate,
    assignedAgentIds: (event.agents || []).map((ea: any) => ea.agentId),
    agentResponses: Object.fromEntries(
      (event.agents || []).map((ea: any) => [ea.agentId, ea.response]),
    ),
    status: event.status,
    isDraft: event.isDraft ?? false,
    publishedAt: event.publishedAt ? event.publishedAt.toISOString() : null,
    draftVersions: (event.draftVersions || []).map((v: any) => ({
      id: v.id,
      versionNum: v.versionNum,
      snapshot: v.snapshot,
      label: v.label,
      createdBy: v.createdBy,
      createdAt: v.createdAt.toISOString(),
    })),
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
  draftVersions: { orderBy: { versionNum: 'desc' as const } },
};

// GET /api/events
router.get('/', async (req: Request, res: Response) => {
  const where: any = {};

  // Agents only see their own published events (not drafts)
  if (req.auth!.role === 'agent') {
    where.agents = { some: { agentId: req.auth!.userId } };
    where.isDraft = false;
  }

  const events = await prisma.event.findMany({
    where,
    include: eventInclude,
    orderBy: { startDate: 'desc' },
  });

  res.json(events.map(formatEvent));
});

// POST /api/events/mark-seen (agent marks all pending missions as seen/accepted)
router.post('/mark-seen', async (req: Request, res: Response) => {
  const agentId = req.auth!.userId;
  const agent = await prisma.user.findUnique({ where: { id: agentId }, select: { canRefuseEvents: true } });
  if (!agent || agent.canRefuseEvents) {
    res.json({ ok: true, count: 0 });
    return;
  }
  const result = await prisma.eventAgent.updateMany({
    where: { agentId, response: 'pending' },
    data: { response: 'accepted' },
  });
  if (result.count > 0) emitEventsChanged();
  res.json({ ok: true, count: result.count });
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
  clientPhone: z.string().optional(),
  site: z.string().optional(),
  color: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shifts: z.array(shiftSchema).optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  geoRadius: z.number().int().optional(),
  hourlyRate: z.number().optional(),
  assignedAgentIds: z.array(z.string()).optional(),
  status: z.enum(['planifie', 'en_cours', 'termine', 'a_reattribuer', 'annule']).optional(),
  isDraft: z.boolean().optional(),
});

// POST /api/events (admin only)
router.post('/', adminOnly, async (req: Request, res: Response) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const { shifts, assignedAgentIds, startDate, endDate, isDraft, ...rest } = parsed.data;
  const savingAsDraft = isDraft === true;

  // Check which agents cannot refuse events (auto-accept)
  let agentRefuseMap = new Map<string, boolean>();
  if (assignedAgentIds && assignedAgentIds.length > 0) {
    const agents = await prisma.user.findMany({
      where: { id: { in: assignedAgentIds } },
      select: { id: true, canRefuseEvents: true },
    });
    agentRefuseMap = new Map(agents.map((a) => [a.id, a.canRefuseEvents]));
  }

  const event = await prisma.event.create({
    data: {
      ...rest,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isDraft: savingAsDraft,
      publishedAt: savingAsDraft ? null : new Date(),
      shifts: shifts
        ? { create: shifts.map((s) => ({ date: new Date(s.date), startTime: s.startTime, endTime: s.endTime, agentId: s.agentId || null })) }
        : undefined,
      agents: assignedAgentIds
        ? { create: assignedAgentIds.map((agentId) => ({ agentId, response: agentRefuseMap.get(agentId) === false ? 'accepted' : 'pending' })) }
        : undefined,
      history: {
        create: {
          action: savingAsDraft ? 'Brouillon créé' : 'Création',
          userId: req.auth!.userId,
        },
      },
    },
    include: eventInclude,
  });

  res.status(201).json(formatEvent(event));
  // Only notify agents if not a draft
  if (!savingAsDraft) {
    emitEventsChanged();
    // Send email to newly assigned agents
    if (assignedAgentIds && assignedAgentIds.length > 0) {
      notifyAgentAssigned(assignedAgentIds, event);
    }
  } else {
    // Notify only admins so they see the draft
    emitToAdmins('events:changed', null);
  }
});

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  client: z.string().nullable().optional(),
  clientPhone: z.string().nullable().optional(),
  site: z.string().nullable().optional(),
  color: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  shifts: z.array(shiftSchema).optional(),
  address: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  geoRadius: z.number().int().optional(),
  hourlyRate: z.number().nullable().optional(),
  assignedAgentIds: z.array(z.string()).optional(),
  status: z.enum(['planifie', 'en_cours', 'termine', 'a_reattribuer', 'annule']).optional(),
  isDraft: z.boolean().optional(),
});

// PUT /api/events/:id (admin only)
router.put('/:id', adminOnly, async (req: Request, res: Response) => {
  const parsed = updateEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const { shifts, assignedAgentIds, startDate, endDate, isDraft, ...rest } = parsed.data;
  const eventId = req.params.id;

  // Build update data
  const updateData: any = { ...rest };
  if (startDate) updateData.startDate = new Date(startDate);
  if (endDate) updateData.endDate = new Date(endDate);
  if (isDraft !== undefined) updateData.isDraft = isDraft;

  await prisma.$transaction(async (tx) => {
    // Snapshot current state before modification (for versioning)
    const currentEvent = await tx.event.findUnique({
      where: { id: eventId },
      include: { shifts: true, agents: true },
    });
    if (currentEvent) {
      const lastVersion = await tx.eventDraftVersion.findFirst({
        where: { eventId },
        orderBy: { versionNum: 'desc' },
      });
      const nextVersionNum = (lastVersion?.versionNum ?? 0) + 1;
      const snapshot = JSON.stringify({
        title: currentEvent.title,
        description: currentEvent.description,
        client: currentEvent.client,
        clientPhone: currentEvent.clientPhone,
        site: currentEvent.site,
        color: currentEvent.color,
        startDate: currentEvent.startDate.toISOString().slice(0, 10),
        endDate: currentEvent.endDate.toISOString().slice(0, 10),
        address: currentEvent.address,
        latitude: currentEvent.latitude,
        longitude: currentEvent.longitude,
        geoRadius: currentEvent.geoRadius,
        hourlyRate: currentEvent.hourlyRate,
        status: currentEvent.status,
        isDraft: currentEvent.isDraft,
        shifts: currentEvent.shifts.map((s) => ({
          date: s.date.toISOString().slice(0, 10),
          startTime: s.startTime,
          endTime: s.endTime,
          agentId: s.agentId,
        })),
        assignedAgentIds: currentEvent.agents.map((a) => a.agentId),
      });
      await tx.eventDraftVersion.create({
        data: {
          eventId,
          versionNum: nextVersionNum,
          snapshot,
          label: `Version ${nextVersionNum}`,
          createdBy: req.auth!.userId,
        },
      });
    }

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

      // Check which agents cannot refuse events
      const agents = await tx.user.findMany({
        where: { id: { in: assignedAgentIds } },
        select: { id: true, canRefuseEvents: true },
      });
      const refuseMap = new Map(agents.map((a) => [a.id, a.canRefuseEvents]));

      await tx.eventAgent.deleteMany({ where: { eventId } });
      await tx.eventAgent.createMany({
        data: assignedAgentIds.map((agentId) => ({
          eventId,
          agentId,
          response: existingMap.get(agentId) || (refuseMap.get(agentId) === false ? 'accepted' : 'pending'),
        })),
      });
    }

    const currentIsDraft = currentEvent?.isDraft;
    const newIsDraft = isDraft !== undefined ? isDraft : currentIsDraft;

    // Add history entry
    await tx.eventHistory.create({
      data: {
        eventId,
        action: newIsDraft ? 'Brouillon modifié' : 'Modification',
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

  const resultIsDraft = event?.isDraft;
  res.json(formatEvent(event));
  // Only fully broadcast if not a draft
  if (!resultIsDraft) {
    emitEventsChanged();
    // Send email to newly assigned agents (only new ones)
    if (assignedAgentIds && assignedAgentIds.length > 0) {
      notifyAgentAssigned(assignedAgentIds, event);
    }
    // Notify agents when mission is cancelled
    if (rest.status === 'annule') {
      notifyMissionCancelled(eventId);
    }
  } else {
    emitToAdmins('events:changed', null);
  }
});

// DELETE /api/events/:id (admin only)
router.delete('/:id', adminOnly, async (req: Request, res: Response) => {
  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
    emitEventsChanged();
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
  // Notify admins in real-time about agent response
  emitEventsChanged();

  // Send email if agent refused
  if (parsed.data.response === 'refused') {
    notifyEventRefused(agentId, event);
  }

  emitToAdmins('notification:agentResponse', {
    eventId,
    agentId,
    response: parsed.data.response,
    eventTitle: event!.title,
  });
});

// POST /api/events/:id/publish (admin publishes a draft)
router.post('/:id/publish', adminOnly, async (req: Request, res: Response) => {
  const eventId = req.params.id;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    res.status(404).json({ error: 'Événement introuvable' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: eventId },
      data: { isDraft: false, publishedAt: new Date() },
    });

    await tx.eventHistory.create({
      data: {
        eventId,
        action: 'Publié',
        userId: req.auth!.userId,
        details: 'Le brouillon a été publié — notifications envoyées aux agents',
      },
    });
  });

  const updated = await prisma.event.findUnique({
    where: { id: eventId },
    include: eventInclude,
  });

  res.json(formatEvent(updated));

  // Now broadcast to everyone including agents
  emitEventsChanged();
});

// POST /api/events/:id/restore/:versionId (admin restores a draft version)
router.post('/:id/restore/:versionId', adminOnly, async (req: Request, res: Response) => {
  const { id: eventId, versionId } = req.params;

  const version = await prisma.eventDraftVersion.findUnique({
    where: { id: versionId },
  });
  if (!version || version.eventId !== eventId) {
    res.status(404).json({ error: 'Version introuvable' });
    return;
  }

  let snapshot: any;
  try {
    snapshot = JSON.parse(version.snapshot);
  } catch {
    res.status(500).json({ error: 'Snapshot corrompu' });
    return;
  }

  const { shifts: snapshotShifts, assignedAgentIds: snapshotAgentIds, startDate, endDate, ...restSnapshot } = snapshot;

  await prisma.$transaction(async (tx) => {
    // Save current state as a new version before restoring
    const currentEvent = await tx.event.findUnique({
      where: { id: eventId },
      include: { shifts: true, agents: true },
    });
    if (currentEvent) {
      const lastVersion = await tx.eventDraftVersion.findFirst({
        where: { eventId },
        orderBy: { versionNum: 'desc' },
      });
      const nextVersionNum = (lastVersion?.versionNum ?? 0) + 1;
      const currentSnapshot = JSON.stringify({
        title: currentEvent.title,
        description: currentEvent.description,
        client: currentEvent.client,
        clientPhone: currentEvent.clientPhone,
        site: currentEvent.site,
        color: currentEvent.color,
        startDate: currentEvent.startDate.toISOString().slice(0, 10),
        endDate: currentEvent.endDate.toISOString().slice(0, 10),
        address: currentEvent.address,
        latitude: currentEvent.latitude,
        longitude: currentEvent.longitude,
        geoRadius: currentEvent.geoRadius,
        hourlyRate: currentEvent.hourlyRate,
        status: currentEvent.status,
        isDraft: currentEvent.isDraft,
        shifts: currentEvent.shifts.map((s) => ({
          date: s.date.toISOString().slice(0, 10),
          startTime: s.startTime,
          endTime: s.endTime,
          agentId: s.agentId,
        })),
        assignedAgentIds: currentEvent.agents.map((a) => a.agentId),
      });
      await tx.eventDraftVersion.create({
        data: {
          eventId,
          versionNum: nextVersionNum,
          snapshot: currentSnapshot,
          label: `Avant restauration v${version.versionNum}`,
          createdBy: req.auth!.userId,
        },
      });
    }

    // Restore event fields
    const updateData: any = { ...restSnapshot };
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    // Keep it as draft after restore
    updateData.isDraft = true;

    await tx.event.update({
      where: { id: eventId },
      data: updateData,
    });

    // Restore shifts
    if (snapshotShifts) {
      await tx.eventShift.deleteMany({ where: { eventId } });
      if (snapshotShifts.length > 0) {
        await tx.eventShift.createMany({
          data: snapshotShifts.map((s: any) => ({
            eventId,
            date: new Date(s.date),
            startTime: s.startTime,
            endTime: s.endTime,
            agentId: s.agentId || null,
          })),
        });
      }
    }

    // Restore agents
    if (snapshotAgentIds) {
      await tx.eventAgent.deleteMany({ where: { eventId } });
      if (snapshotAgentIds.length > 0) {
        await tx.eventAgent.createMany({
          data: snapshotAgentIds.map((agentId: string) => ({
            eventId,
            agentId,
            response: 'pending' as const,
          })),
        });
      }
    }

    await tx.eventHistory.create({
      data: {
        eventId,
        action: `Restauration version ${version.versionNum}`,
        userId: req.auth!.userId,
        details: `Restauré depuis "${version.label}"`,
      },
    });
  });

  const updated = await prisma.event.findUnique({
    where: { id: eventId },
    include: eventInclude,
  });

  res.json(formatEvent(updated));
  emitToAdmins('events:changed', null);
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

// ── Duplicate week ──────────────────────────────────────
const duplicateWeekSchema = z.object({
  sourceStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Monday of source week
  targetStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Monday of target week
});

router.post('/bulk/duplicate-week', adminOnly, async (req: Request, res: Response) => {
  const parsed = duplicateWeekSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const { sourceStart, targetStart } = parsed.data;
  const srcMonday = new Date(sourceStart);
  const srcSunday = new Date(srcMonday);
  srcSunday.setDate(srcSunday.getDate() + 6);

  const tgtMonday = new Date(targetStart);
  const dayOffset = Math.round((tgtMonday.getTime() - srcMonday.getTime()) / (1000 * 60 * 60 * 24));

  // Find all events overlapping the source week
  const sourceEvents = await prisma.event.findMany({
    where: {
      startDate: { lte: srcSunday },
      endDate: { gte: srcMonday },
      status: { notIn: ['annule'] },
    },
    include: eventInclude,
  });

  if (sourceEvents.length === 0) {
    res.status(400).json({ error: 'Aucun événement trouvé dans la semaine source.' });
    return;
  }

  const created: any[] = [];

  for (const src of sourceEvents) {
    const newStart = new Date(src.startDate);
    newStart.setDate(newStart.getDate() + dayOffset);
    const newEnd = new Date(src.endDate);
    newEnd.setDate(newEnd.getDate() + dayOffset);

    const agentIds = src.agents.map((a: any) => a.agentId);
    let agentRefuseMap = new Map<string, boolean>();
    if (agentIds.length > 0) {
      const agentsInfo = await prisma.user.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, canRefuseEvents: true },
      });
      agentRefuseMap = new Map(agentsInfo.map((a) => [a.id, a.canRefuseEvents]));
    }

    const event = await prisma.event.create({
      data: {
        title: src.title,
        description: src.description,
        client: src.client,
        clientPhone: src.clientPhone,
        site: src.site,
        color: src.color,
        startDate: newStart,
        endDate: newEnd,
        address: src.address,
        latitude: src.latitude,
        longitude: src.longitude,
        geoRadius: src.geoRadius,
        hourlyRate: src.hourlyRate,
        status: 'planifie',
        shifts: src.shifts.length > 0
          ? {
              create: src.shifts.map((s: any) => {
                const newDate = new Date(s.date);
                newDate.setDate(newDate.getDate() + dayOffset);
                return { date: newDate, startTime: s.startTime, endTime: s.endTime, agentId: s.agentId || null };
              }),
            }
          : undefined,
        agents: agentIds.length > 0
          ? { create: agentIds.map((agentId: string) => ({ agentId, response: agentRefuseMap.get(agentId) === false ? 'accepted' : 'pending' })) }
          : undefined,
        history: { create: { action: 'Duplication (semaine)', userId: req.auth!.userId } },
      },
      include: eventInclude,
    });

    created.push(formatEvent(event));

    // Notify assigned agents
    if (agentIds.length > 0) {
      notifyAgentAssigned(agentIds, event);
    }
  }

  res.status(201).json({ count: created.length, events: created });
  emitEventsChanged();
});

// ── Duplicate event with repetition ─────────────────────
const repeatEventSchema = z.object({
  eventId: z.string(),
  frequency: z.enum(['daily', 'weekly']),
  endRepeatDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  skipWeekends: z.boolean().optional(),
});

router.post('/bulk/repeat', adminOnly, async (req: Request, res: Response) => {
  const parsed = repeatEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const { eventId, frequency, endRepeatDate, skipWeekends } = parsed.data;

  const source = await prisma.event.findUnique({
    where: { id: eventId },
    include: eventInclude,
  });
  if (!source) {
    res.status(404).json({ error: 'Événement introuvable' });
    return;
  }

  const srcStart = new Date(source.startDate);
  const srcEnd = new Date(source.endDate);
  const eventDuration = Math.round((srcEnd.getTime() - srcStart.getTime()) / (1000 * 60 * 60 * 24));
  const repeatEnd = new Date(endRepeatDate);
  const stepDays = frequency === 'weekly' ? 7 : 1;

  const agentIds = source.agents.map((a: any) => a.agentId);
  let agentRefuseMap = new Map<string, boolean>();
  if (agentIds.length > 0) {
    const agentsInfo = await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, canRefuseEvents: true },
    });
    agentRefuseMap = new Map(agentsInfo.map((a) => [a.id, a.canRefuseEvents]));
  }

  const created: any[] = [];
  let currentOffset = stepDays;

  // Safety limit: max 200 events
  while (created.length < 200) {
    const newStart = new Date(srcStart);
    newStart.setDate(newStart.getDate() + currentOffset);

    if (newStart > repeatEnd) break;

    // Skip weekends if option enabled
    if (skipWeekends && frequency === 'daily') {
      const dow = newStart.getDay();
      if (dow === 0 || dow === 6) {
        currentOffset += 1;
        continue;
      }
    }

    const newEnd = new Date(newStart);
    newEnd.setDate(newEnd.getDate() + eventDuration);

    const event = await prisma.event.create({
      data: {
        title: source.title,
        description: source.description,
        client: source.client,
        clientPhone: source.clientPhone,
        site: source.site,
        color: source.color,
        startDate: newStart,
        endDate: newEnd,
        address: source.address,
        latitude: source.latitude,
        longitude: source.longitude,
        geoRadius: source.geoRadius,
        hourlyRate: source.hourlyRate,
        status: 'planifie',
        shifts: source.shifts.length > 0
          ? {
              create: source.shifts.map((s: any) => {
                const shiftOffset = Math.round((new Date(s.date).getTime() - srcStart.getTime()) / (1000 * 60 * 60 * 24));
                const newDate = new Date(newStart);
                newDate.setDate(newDate.getDate() + shiftOffset);
                return { date: newDate, startTime: s.startTime, endTime: s.endTime, agentId: s.agentId || null };
              }),
            }
          : undefined,
        agents: agentIds.length > 0
          ? { create: agentIds.map((agentId: string) => ({ agentId, response: agentRefuseMap.get(agentId) === false ? 'accepted' : 'pending' })) }
          : undefined,
        history: { create: { action: 'Duplication (répétition)', userId: req.auth!.userId } },
      },
      include: eventInclude,
    });

    created.push(formatEvent(event));
    currentOffset += stepDays;
  }

  // Notify assigned agents for all new events
  if (agentIds.length > 0 && created.length > 0) {
    for (const evt of created) {
      notifyAgentAssigned(agentIds, { ...source, id: evt.id, startDate: new Date(evt.startDate), endDate: new Date(evt.endDate), shifts: evt.shifts });
    }
  }

  res.status(201).json({ count: created.length, events: created });
  emitEventsChanged();
});

export default router;
