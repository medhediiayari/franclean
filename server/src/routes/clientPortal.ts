import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../lib/auth.js';

const router = Router();
router.use(authMiddleware);

// Middleware: ensure user is a client and get their linked client
async function getClientForUser(req: Request, res: Response): Promise<string | null> {
  if (req.auth!.role !== 'client') {
    res.status(403).json({ error: 'Accès réservé aux clients' });
    return null;
  }
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { clientId: true } });
  if (!user?.clientId) {
    res.status(403).json({ error: 'Aucun client lié à ce compte' });
    return null;
  }
  return user.clientId;
}

// GET /api/client-portal/me — client info + sites
router.get('/me', async (req: Request, res: Response) => {
  const clientId = await getClientForUser(req, res);
  if (!clientId) return;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { sites: { orderBy: { name: 'asc' } } },
  });
  if (!client) {
    res.status(404).json({ error: 'Client introuvable' });
    return;
  }
  res.json(client);
});

// GET /api/client-portal/missions — all events for this client
router.get('/missions', async (req: Request, res: Response) => {
  const clientId = await getClientForUser(req, res);
  if (!clientId) return;

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
  if (!client) { res.status(404).json({ error: 'Client introuvable' }); return; }

  const events = await prisma.event.findMany({
    where: { client: client.name },
    include: {
      shifts: { orderBy: { date: 'asc' } },
      agents: { include: { agent: { select: { id: true, firstName: true, lastName: true } } } },
      attendances: {
        include: {
          photos: { orderBy: { createdAt: 'asc' } },
          agent: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { startDate: 'desc' },
  });

  const formatted = events.map((evt) => ({
    id: evt.id,
    title: evt.title,
    description: evt.description,
    site: evt.site,
    status: evt.status,
    startDate: evt.startDate.toISOString().slice(0, 10),
    endDate: evt.endDate.toISOString().slice(0, 10),
    address: evt.address,
    shifts: evt.shifts.map((s) => ({
      id: s.id,
      date: s.date.toISOString().slice(0, 10),
      startTime: s.startTime,
      endTime: s.endTime,
      agentId: s.agentId,
    })),
    agents: evt.agents.map((a) => ({
      id: a.agent.id,
      name: `${a.agent.firstName} ${a.agent.lastName}`,
    })),
    attendances: evt.attendances.map((att) => ({
      id: att.id,
      agentName: `${att.agent.firstName} ${att.agent.lastName}`,
      date: att.date.toISOString().slice(0, 10),
      checkInTime: att.checkInTime?.toISOString() ?? null,
      checkOutTime: att.checkOutTime?.toISOString() ?? null,
      hoursWorked: att.hoursWorked,
      checkInPhotoUrl: att.checkInPhotoUrl,
      checkOutPhotoUrl: att.checkOutPhotoUrl,
      status: att.status,
      photos: att.photos.map((p) => ({
        id: p.id,
        photoUrl: p.photoUrl,
        caption: p.caption,
        createdAt: p.createdAt.toISOString(),
      })),
    })),
  }));

  res.json(formatted);
});

// GET /api/client-portal/photos?site=xxx — all work photos, optionally filtered by site
router.get('/photos', async (req: Request, res: Response) => {
  const clientId = await getClientForUser(req, res);
  if (!clientId) return;

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
  if (!client) { res.status(404).json({ error: 'Client introuvable' }); return; }

  const siteFilter = req.query.site as string | undefined;

  const where: any = { client: client.name };
  if (siteFilter) {
    where.site = siteFilter;
  }

  const events = await prisma.event.findMany({
    where,
    include: {
      attendances: {
        include: {
          photos: { orderBy: { createdAt: 'asc' } },
          agent: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { startDate: 'desc' },
  });

  const photos: Array<{
    id: string;
    photoUrl: string;
    caption: string | null;
    createdAt: string;
    eventTitle: string;
    site: string | null;
    agentName: string;
    date: string;
    type: 'work' | 'checkin' | 'checkout';
  }> = [];

  for (const evt of events) {
    for (const att of evt.attendances) {
      const agentName = `${att.agent.firstName} ${att.agent.lastName}`;
      const date = att.date.toISOString().slice(0, 10);

      // Check-in photo
      if (att.checkInPhotoUrl) {
        photos.push({
          id: `${att.id}-checkin`,
          photoUrl: att.checkInPhotoUrl,
          caption: 'Photo d\'arrivée',
          createdAt: att.checkInTime?.toISOString() ?? att.createdAt.toISOString(),
          eventTitle: evt.title,
          site: evt.site,
          agentName,
          date,
          type: 'checkin',
        });
      }
      // Check-out photo
      if (att.checkOutPhotoUrl) {
        photos.push({
          id: `${att.id}-checkout`,
          photoUrl: att.checkOutPhotoUrl,
          caption: 'Photo de départ',
          createdAt: att.checkOutTime?.toISOString() ?? att.updatedAt.toISOString(),
          eventTitle: evt.title,
          site: evt.site,
          agentName,
          date,
          type: 'checkout',
        });
      }
      // Work photos
      for (const p of att.photos) {
        photos.push({
          id: p.id,
          photoUrl: p.photoUrl,
          caption: p.caption,
          createdAt: p.createdAt.toISOString(),
          eventTitle: evt.title,
          site: evt.site,
          agentName,
          date,
          type: 'work',
        });
      }
    }
  }

  // Sort by date desc
  photos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json(photos);
});

// GET /api/client-portal/dashboard — summary stats
router.get('/dashboard', async (req: Request, res: Response) => {
  const clientId = await getClientForUser(req, res);
  if (!clientId) return;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { sites: true },
  });
  if (!client) { res.status(404).json({ error: 'Client introuvable' }); return; }

  const events = await prisma.event.findMany({
    where: { client: client.name },
    include: {
      attendances: { include: { photos: true } },
    },
  });

  const totalMissions = events.length;
  const missionsTerminees = events.filter((e) => e.status === 'termine').length;
  const missionsEnCours = events.filter((e) => e.status === 'en_cours').length;
  const missionsPlanifiees = events.filter((e) => e.status === 'planifie').length;

  let totalHours = 0;
  let totalPhotos = 0;
  for (const evt of events) {
    for (const att of evt.attendances) {
      if (att.hoursWorked) totalHours += att.hoursWorked;
      totalPhotos += att.photos.length;
      if (att.checkInPhotoUrl) totalPhotos++;
      if (att.checkOutPhotoUrl) totalPhotos++;
    }
  }

  res.json({
    clientName: client.name,
    sitesCount: client.sites.length,
    totalMissions,
    missionsTerminees,
    missionsEnCours,
    missionsPlanifiees,
    totalHours: Math.round(totalHours * 100) / 100,
    totalPhotos,
  });
});

export default router;
