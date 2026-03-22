import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, adminOnly } from '../lib/auth.js';
import { emitAttendanceChanged, emitToAdmins } from '../lib/socket.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

function formatRecord(r: any) {
  return {
    id: r.id,
    eventId: r.eventId,
    shiftId: r.shiftId,
    agentId: r.agentId,
    date: r.date.toISOString().slice(0, 10),
    checkInTime: r.checkInTime?.toISOString() ?? null,
    checkInPhotoUrl: r.checkInPhotoUrl,
    checkInLatitude: r.checkInLatitude,
    checkInLongitude: r.checkInLongitude,
    checkInLocationValid: r.checkInLocationValid,
    checkOutTime: r.checkOutTime?.toISOString() ?? null,
    checkOutPhotoUrl: r.checkOutPhotoUrl,
    checkOutLatitude: r.checkOutLatitude,
    checkOutLongitude: r.checkOutLongitude,
    checkOutLocationValid: r.checkOutLocationValid,
    hoursWorked: r.hoursWorked,
    status: r.status,
    validatedBy: r.validatedBy,
    validatedAt: r.validatedAt?.toISOString() ?? null,
    refusalReason: r.refusalReason,
    isSuspect: r.isSuspect,
    suspectReasons: r.suspectReasons,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// GET /api/attendance
router.get('/', async (req: Request, res: Response) => {
  const where: any = {};

  if (req.auth!.role === 'agent') {
    where.agentId = req.auth!.userId;
  }

  // Optional filters
  if (req.query.agentId && req.auth!.role === 'admin') {
    where.agentId = req.query.agentId;
  }
  if (req.query.date) {
    where.date = new Date(req.query.date as string);
  }
  if (req.query.eventId) {
    where.eventId = req.query.eventId;
  }

  const records = await prisma.attendance.findMany({
    where,
    orderBy: { date: 'desc' },
  });

  res.json(records.map(formatRecord));
});

// GET /api/attendance/:id
router.get('/:id', async (req: Request, res: Response) => {
  const record = await prisma.attendance.findUnique({
    where: { id: req.params.id },
  });
  if (!record) {
    res.status(404).json({ error: 'Pointage introuvable' });
    return;
  }
  res.json(formatRecord(record));
});

const createSchema = z.object({
  eventId: z.string(),
  shiftId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkInTime: z.string().optional(),
  checkInPhotoUrl: z.string().optional(),
  checkInLatitude: z.number().optional(),
  checkInLongitude: z.number().optional(),
  checkInLocationValid: z.boolean().optional(),
});

// POST /api/attendance (agent check-in)
router.post('/', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const { date, checkInTime, ...rest } = parsed.data;
  const record = await prisma.attendance.create({
    data: {
      ...rest,
      agentId: req.auth!.userId,
      date: new Date(date),
      checkInTime: checkInTime ? new Date(checkInTime) : undefined,
    },
  });

  res.status(201).json(formatRecord(record));
  emitAttendanceChanged();
  emitToAdmins('notification:newAttendance', {
    agentId: req.auth!.userId,
    eventId: parsed.data.eventId,
  });
});

const updateSchema = z.object({
  checkInTime: z.string().optional(),
  checkInPhotoUrl: z.string().optional(),
  checkInLatitude: z.number().optional(),
  checkInLongitude: z.number().optional(),
  checkInLocationValid: z.boolean().optional(),
  checkOutTime: z.string().optional(),
  checkOutPhotoUrl: z.string().optional(),
  checkOutLatitude: z.number().optional(),
  checkOutLongitude: z.number().optional(),
  checkOutLocationValid: z.boolean().optional(),
  hoursWorked: z.number().optional(),
  isSuspect: z.boolean().optional(),
  suspectReasons: z.array(z.string()).optional(),
});

// PUT /api/attendance/:id (agent updates check-in/out)
router.put('/:id', async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const data: any = { ...parsed.data };
  if (data.checkInTime) data.checkInTime = new Date(data.checkInTime);
  if (data.checkOutTime) data.checkOutTime = new Date(data.checkOutTime);

  try {
    const record = await prisma.attendance.update({
      where: { id: req.params.id },
      data,
    });
    res.json(formatRecord(record));
    emitAttendanceChanged();
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: 'Pointage introuvable' });
      return;
    }
    throw e;
  }
});

const validateSchema = z.object({
  status: z.enum(['valide', 'refuse', 'suspect']),
  refusalReason: z.string().optional(),
});

// POST /api/attendance/:id/validate (admin only)
router.post('/:id/validate', adminOnly, async (req: Request, res: Response) => {
  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides' });
    return;
  }

  try {
    const record = await prisma.attendance.update({
      where: { id: req.params.id },
      data: {
        status: parsed.data.status,
        refusalReason: parsed.data.refusalReason,
        validatedBy: req.auth!.userId,
        validatedAt: new Date(),
      },
    });
    res.json(formatRecord(record));
    emitAttendanceChanged();
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: 'Pointage introuvable' });
      return;
    }
    throw e;
  }
});

export default router;
