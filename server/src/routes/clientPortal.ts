import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../lib/auth.js';
import { agentMatricule } from './auth.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

// Helper: resolve photo visibility for a client (per-client overrides > global settings)
async function getPhotoVisibility(clientId: string): Promise<{ checkin: boolean; work: boolean }> {
  const [client, settings] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { canSeeCheckinPhotos: true, canSeeWorkPhotos: true } }),
    prisma.appSettings.findUnique({ where: { id: 'singleton' } }),
  ]);
  const globalCheckin = settings?.clientPhotosCheckin ?? true;
  const globalWork = settings?.clientPhotosWork ?? true;
  return {
    checkin: client?.canSeeCheckinPhotos ?? globalCheckin,
    work: client?.canSeeWorkPhotos ?? globalWork,
  };
}

interface ClientAccess {
  clientId: string;
  isMainAccount: boolean;
  allowedSiteNames: string[] | null; // null = all sites (main account)
}

// Helper: get client access info for the current user
async function getClientAccess(req: Request, res: Response): Promise<ClientAccess | null> {
  if (req.auth!.role !== 'client') {
    res.status(403).json({ error: 'Accès réservé aux clients' });
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: {
      clientId: true,
      isMainAccount: true,
      assignedSites: { include: { site: { select: { name: true } } } },
    },
  });
  if (!user?.clientId) {
    res.status(403).json({ error: 'Aucun client lié à ce compte' });
    return null;
  }
  // Main accounts see everything, sub-accounts see only assigned sites
  const allowedSiteNames = user.isMainAccount
    ? null
    : user.assignedSites.map((s) => s.site.name);

  return { clientId: user.clientId, isMainAccount: user.isMainAccount, allowedSiteNames };
}

// Backward-compatible helper
async function getClientForUser(req: Request, res: Response): Promise<string | null> {
  const access = await getClientAccess(req, res);
  return access?.clientId ?? null;
}

// GET /api/client-portal/me — client info + sites
router.get('/me', async (req: Request, res: Response) => {
  const access = await getClientAccess(req, res);
  if (!access) return;

  const client = await prisma.client.findUnique({
    where: { id: access.clientId },
    include: { sites: { orderBy: { name: 'asc' } } },
  });
  if (!client) {
    res.status(404).json({ error: 'Client introuvable' });
    return;
  }
  // Sub-accounts: filter sites to only assigned ones
  let sites = client.sites;
  if (access.allowedSiteNames !== null) {
    sites = sites.filter((s) => access.allowedSiteNames!.includes(s.name));
  }

  const photoVis = await getPhotoVisibility(access.clientId);

  res.json({ ...client, sites, isMainAccount: access.isMainAccount, photoVisibility: photoVis });
});

// GET /api/client-portal/missions — all events for this client
router.get('/missions', async (req: Request, res: Response) => {
  const access = await getClientAccess(req, res);
  if (!access) return;

  const client = await prisma.client.findUnique({ where: { id: access.clientId }, select: { name: true } });
  if (!client) { res.status(404).json({ error: 'Client introuvable' }); return; }

  const where: any = { client: client.name };
  // Sub-accounts: filter by assigned sites only
  if (access.allowedSiteNames !== null) {
    where.site = { in: access.allowedSiteNames };
  }

  const events = await prisma.event.findMany({
    where,
    include: {
      shifts: { orderBy: { date: 'asc' } },
      agents: { include: { agent: { select: { id: true } } } },
      attendances: {
        include: {
          photos: { orderBy: { createdAt: 'asc' } },
          agent: { select: { id: true } },
        },
      },
    },
    orderBy: { startDate: 'desc' },
  });

  const photoVis = await getPhotoVisibility(access.clientId);

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
      matricule: agentMatricule(a.agent.id),
    })),
    attendances: evt.attendances.map((att) => ({
      id: att.id,
      agentMatricule: agentMatricule(att.agent.id),
      date: att.date.toISOString().slice(0, 10),
      checkInTime: att.checkInTime?.toISOString() ?? null,
      checkOutTime: att.checkOutTime?.toISOString() ?? null,
      hoursWorked: att.billedHours ?? att.hoursWorked,
      checkInPhotoUrl: photoVis.checkin ? att.checkInPhotoUrl : null,
      checkOutPhotoUrl: photoVis.checkin ? att.checkOutPhotoUrl : null,
      status: att.status,
      photos: photoVis.work ? att.photos.map((p) => ({
        id: p.id,
        photoUrl: p.photoUrl,
        caption: p.caption,
        createdAt: p.createdAt.toISOString(),
      })) : [],
    })),
  }));

  res.json(formatted);
});

// GET /api/client-portal/photos?site=xxx — all work photos, optionally filtered by site
router.get('/photos', async (req: Request, res: Response) => {
  const access = await getClientAccess(req, res);
  if (!access) return;

  const client = await prisma.client.findUnique({ where: { id: access.clientId }, select: { name: true } });
  if (!client) { res.status(404).json({ error: 'Client introuvable' }); return; }

  const siteFilter = req.query.site as string | undefined;

  const where: any = { client: client.name };
  if (siteFilter) {
    where.site = siteFilter;
  }
  // Sub-accounts: restrict to assigned sites
  if (access.allowedSiteNames !== null && !siteFilter) {
    where.site = { in: access.allowedSiteNames };
  }

  const events = await prisma.event.findMany({
    where,
    include: {
      attendances: {
        include: {
          photos: { orderBy: { createdAt: 'asc' } },
          agent: { select: { id: true } },
        },
      },
    },
    orderBy: { startDate: 'desc' },
  });

  const photoVis = await getPhotoVisibility(access.clientId);

  const photos: Array<{
    id: string;
    photoUrl: string;
    caption: string | null;
    createdAt: string;
    eventTitle: string;
    site: string | null;
    agentMatricule: string;
    date: string;
    type: 'work' | 'checkin' | 'checkout';
  }> = [];

  for (const evt of events) {
    for (const att of evt.attendances) {
      const agentMat = agentMatricule(att.agent.id);
      const date = att.date.toISOString().slice(0, 10);

      // Check-in photo
      if (photoVis.checkin && att.checkInPhotoUrl) {
        photos.push({
          id: `${att.id}-checkin`,
          photoUrl: att.checkInPhotoUrl,
          caption: 'Photo d\'arrivée',
          createdAt: att.checkInTime?.toISOString() ?? att.createdAt.toISOString(),
          eventTitle: evt.title,
          site: evt.site,
          agentMatricule: agentMat,
          date,
          type: 'checkin',
        });
      }
      // Check-out photo
      if (photoVis.checkin && att.checkOutPhotoUrl) {
        photos.push({
          id: `${att.id}-checkout`,
          photoUrl: att.checkOutPhotoUrl,
          caption: 'Photo de départ',
          createdAt: att.checkOutTime?.toISOString() ?? att.updatedAt.toISOString(),
          eventTitle: evt.title,
          site: evt.site,
          agentMatricule: agentMat,
          date,
          type: 'checkout',
        });
      }
      // Work photos
      if (photoVis.work) {
        for (const p of att.photos) {
          photos.push({
            id: p.id,
            photoUrl: p.photoUrl,
            caption: p.caption,
            createdAt: p.createdAt.toISOString(),
            eventTitle: evt.title,
            site: evt.site,
            agentMatricule: agentMat,
            date,
            type: 'work',
          });
        }
      }
    }
  }

  // Sort by date desc
  photos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json(photos);
});

// GET /api/client-portal/dashboard — summary stats
router.get('/dashboard', async (req: Request, res: Response) => {
  const access = await getClientAccess(req, res);
  if (!access) return;

  const client = await prisma.client.findUnique({
    where: { id: access.clientId },
    include: { sites: true },
  });
  if (!client) { res.status(404).json({ error: 'Client introuvable' }); return; }

  const eventsWhere: any = { client: client.name };
  if (access.allowedSiteNames !== null) {
    eventsWhere.site = { in: access.allowedSiteNames };
  }

  const events = await prisma.event.findMany({
    where: eventsWhere,
    include: {
      attendances: { include: { photos: true } },
    },
  });

  let sites = client.sites;
  if (access.allowedSiteNames !== null) {
    sites = sites.filter((s) => access.allowedSiteNames!.includes(s.name));
  }

  const totalMissions = events.length;
  const missionsTerminees = events.filter((e) => e.status === 'termine').length;
  const missionsEnCours = events.filter((e) => e.status === 'en_cours').length;
  const missionsPlanifiees = events.filter((e) => e.status === 'planifie').length;

  let totalHours = 0;
  let totalPhotos = 0;
  for (const evt of events) {
    for (const att of evt.attendances) {
      totalHours += att.billedHours ?? att.hoursWorked ?? 0;
      totalPhotos += att.photos.length;
      if (att.checkInPhotoUrl) totalPhotos++;
      if (att.checkOutPhotoUrl) totalPhotos++;
    }
  }

  res.json({
    clientName: client.name,
    sitesCount: sites.length,
    totalMissions,
    missionsTerminees,
    missionsEnCours,
    missionsPlanifiees,
    totalHours: Math.round(totalHours * 100) / 100,
    totalPhotos,
  });
});

// GET /api/client-portal/recap — per-site summary with agent breakdown
router.get('/recap', async (req: Request, res: Response) => {
  const access = await getClientAccess(req, res);
  if (!access) return;

  const client = await prisma.client.findUnique({
    where: { id: access.clientId },
    include: { sites: true },
  });
  if (!client) { res.status(404).json({ error: 'Client introuvable' }); return; }

  let sites = client.sites;
  if (access.allowedSiteNames !== null) {
    sites = sites.filter((s) => access.allowedSiteNames!.includes(s.name));
  }

  const result = [];

  for (const site of sites) {
    const events = await prisma.event.findMany({
      where: { client: client.name, site: site.name },
      include: {
        attendances: {
          include: { agent: { select: { id: true } } },
        },
      },
    });

    // Aggregate hours per agent
    const agentHoursMap = new Map<string, number>();
    let totalHours = 0;

    for (const evt of events) {
      for (const att of evt.attendances) {
        const hrs = att.billedHours ?? att.hoursWorked ?? 0;
        totalHours += hrs;
        const agentId = att.agent.id;
        agentHoursMap.set(agentId, (agentHoursMap.get(agentId) || 0) + hrs);
      }
    }

    const agents = Array.from(agentHoursMap.entries()).map(([agentId, hours]) => ({
      matricule: agentMatricule(agentId),
      hours: Math.round(hours * 100) / 100,
    }));

    result.push({
      siteId: site.id,
      siteName: site.name,
      totalHours: Math.round(totalHours * 100) / 100,
      contractualHours: site.contractualHours ?? 0,
      remainingHours: Math.round(((site.contractualHours ?? 0) - totalHours) * 100) / 100,
      agents,
    });
  }

  res.json(result);
});

// GET /api/client-portal/sites/:siteId — site detail with mission stats
router.get('/sites/:siteId', async (req: Request, res: Response) => {
  const access = await getClientAccess(req, res);
  if (!access) return;

  const { siteId } = req.params;

  const site = await prisma.clientSite.findUnique({ where: { id: siteId } });
  if (!site || site.clientId !== access.clientId) {
    res.status(404).json({ error: 'Site introuvable' });
    return;
  }

  // Sub-accounts: check access to this site
  if (access.allowedSiteNames !== null && !access.allowedSiteNames.includes(site.name)) {
    res.status(403).json({ error: 'Accès non autorisé à ce site' });
    return;
  }

  const client = await prisma.client.findUnique({ where: { id: access.clientId }, select: { name: true } });
  if (!client) { res.status(404).json({ error: 'Client introuvable' }); return; }

  const events = await prisma.event.findMany({
    where: { client: client.name, site: site.name },
    include: {
      shifts: { orderBy: { date: 'asc' } },
      agents: { include: { agent: { select: { id: true, firstName: true, lastName: true } } } },
      attendances: {
        include: {
          agent: { select: { firstName: true, lastName: true } },
          photos: true,
        },
      },
    },
    orderBy: { startDate: 'desc' },
  });

  const missionsEnCours = events.filter((e) => e.status === 'en_cours').length;
  const missionsTerminees = events.filter((e) => e.status === 'termine').length;
  const missionsPlanifiees = events.filter((e) => e.status === 'planifie').length;

  let totalHours = 0;
  let totalPhotos = 0;
  for (const evt of events) {
    for (const att of evt.attendances) {
      totalHours += att.billedHours ?? att.hoursWorked ?? 0;
      totalPhotos += att.photos.length;
      if (att.checkInPhotoUrl) totalPhotos++;
      if (att.checkOutPhotoUrl) totalPhotos++;
    }
  }

  // Use contractual hours defined on the site, not computed from shifts
  const contractualHours = site.contractualHours ?? 0;

  const missions = events.map((evt) => ({
    id: evt.id,
    title: evt.title,
    status: evt.status,
    startDate: evt.startDate.toISOString().slice(0, 10),
    endDate: evt.endDate.toISOString().slice(0, 10),
    agents: evt.agents.map((a) => ({ id: a.agent.id, name: `${a.agent.firstName} ${a.agent.lastName}` })),
    shifts: evt.shifts.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      startTime: s.startTime,
      endTime: s.endTime,
    })),
    hoursWorked: evt.attendances.reduce((sum, a) => sum + (a.billedHours ?? a.hoursWorked ?? 0), 0),
  }));

  res.json({
    site: {
      id: site.id,
      name: site.name,
      address: site.address,
      geoRadius: site.geoRadius,
      hourlyRate: site.hourlyRate,
      contractualHours: site.contractualHours,
      notes: site.notes,
    },
    stats: {
      totalMissions: events.length,
      missionsEnCours,
      missionsTerminees,
      missionsPlanifiees,
      totalHours: Math.round(totalHours * 100) / 100,
      contractualHours: Math.round(contractualHours * 100) / 100,
      totalPhotos,
    },
    missions,
  });
});

// ── Sub-accounts management (main account only) ────────

const subAccountSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
  siteIds: z.array(z.string()).optional(), // ClientSite IDs to grant access to
});

// Helper: ensure main account
async function requireMainAccount(req: Request, res: Response): Promise<ClientAccess | null> {
  const access = await getClientAccess(req, res);
  if (!access) return null;
  if (!access.isMainAccount) {
    res.status(403).json({ error: 'Seul le compte principal peut gérer les sous-comptes' });
    return null;
  }
  return access;
}

// GET /api/client-portal/sub-accounts — list sub-accounts
router.get('/sub-accounts', async (req: Request, res: Response) => {
  const access = await requireMainAccount(req, res);
  if (!access) return;

  const subAccounts = await prisma.user.findMany({
    where: {
      clientId: access.clientId,
      isMainAccount: false,
      role: 'client',
    },
    omit: { password: true },
    include: {
      assignedSites: {
        include: { site: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const formatted = subAccounts.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    sites: u.assignedSites.map((s) => ({ id: s.site.id, name: s.site.name })),
  }));

  res.json(formatted);
});

// POST /api/client-portal/sub-accounts — create sub-account
router.post('/sub-accounts', async (req: Request, res: Response) => {
  const access = await requireMainAccount(req, res);
  if (!access) return;

  const parsed = subAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const { firstName, lastName, email, password, phone, siteIds } = parsed.data;

  if (!password) {
    res.status(400).json({ error: 'Le mot de passe est requis pour la création' });
    return;
  }

  // Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Un compte avec cet email existe déjà' });
    return;
  }

  // Validate that siteIds belong to this client
  if (siteIds && siteIds.length > 0) {
    const validSites = await prisma.clientSite.findMany({
      where: { id: { in: siteIds }, clientId: access.clientId },
      select: { id: true },
    });
    if (validSites.length !== siteIds.length) {
      res.status(400).json({ error: 'Certains sites ne sont pas valides' });
      return;
    }
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phone: phone || '',
      role: 'client',
      isActive: true,
      isMainAccount: false,
      clientId: access.clientId,
      assignedSites: siteIds && siteIds.length > 0
        ? { create: siteIds.map((siteId) => ({ clientSiteId: siteId })) }
        : undefined,
    },
    omit: { password: true },
    include: {
      assignedSites: {
        include: { site: { select: { id: true, name: true } } },
      },
    },
  });

  res.status(201).json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    sites: user.assignedSites.map((s) => ({ id: s.site.id, name: s.site.name })),
  });
});

// PUT /api/client-portal/sub-accounts/:id — update sub-account
router.put('/sub-accounts/:id', async (req: Request, res: Response) => {
  const access = await requireMainAccount(req, res);
  if (!access) return;

  const { id } = req.params;

  // Ensure the sub-account belongs to this client
  const target = await prisma.user.findUnique({ where: { id }, select: { clientId: true, isMainAccount: true } });
  if (!target || target.clientId !== access.clientId || target.isMainAccount) {
    res.status(404).json({ error: 'Sous-compte introuvable' });
    return;
  }

  const parsed = subAccountSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const { firstName, lastName, email, password, phone, isActive, siteIds } = parsed.data;

  // Check email uniqueness if changed
  if (email) {
    const existing = await prisma.user.findFirst({ where: { email, id: { not: id } } });
    if (existing) {
      res.status(409).json({ error: 'Un compte avec cet email existe déjà' });
      return;
    }
  }

  // Validate siteIds
  if (siteIds) {
    const validSites = await prisma.clientSite.findMany({
      where: { id: { in: siteIds }, clientId: access.clientId },
      select: { id: true },
    });
    if (validSites.length !== siteIds.length) {
      res.status(400).json({ error: 'Certains sites ne sont pas valides' });
      return;
    }
  }

  const updateData: any = {};
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (password) updateData.password = bcrypt.hashSync(password, 10);

  // Update sites: delete all and recreate
  if (siteIds) {
    await prisma.clientUserSite.deleteMany({ where: { userId: id } });
    if (siteIds.length > 0) {
      await prisma.clientUserSite.createMany({
        data: siteIds.map((siteId) => ({ userId: id, clientSiteId: siteId })),
      });
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    omit: { password: true },
    include: {
      assignedSites: {
        include: { site: { select: { id: true, name: true } } },
      },
    },
  });

  res.json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    sites: user.assignedSites.map((s) => ({ id: s.site.id, name: s.site.name })),
  });
});

// DELETE /api/client-portal/sub-accounts/:id — delete sub-account
router.delete('/sub-accounts/:id', async (req: Request, res: Response) => {
  const access = await requireMainAccount(req, res);
  if (!access) return;

  const { id } = req.params;

  const target = await prisma.user.findUnique({ where: { id }, select: { clientId: true, isMainAccount: true } });
  if (!target || target.clientId !== access.clientId || target.isMainAccount) {
    res.status(404).json({ error: 'Sous-compte introuvable' });
    return;
  }

  await prisma.user.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
