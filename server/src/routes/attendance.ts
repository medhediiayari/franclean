import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, adminOnly } from '../lib/auth.js';
import { emitAttendanceChanged, emitToAdmins } from '../lib/socket.js';
import { sendEmail, emailSuspectAttendance } from '../lib/email.js';
import { sendSms, smsSuspectAttendance } from '../lib/sms.js';
import { z } from 'zod';

// Helper: send suspect attendance notification (email + sms) if rule is enabled
async function notifySuspectAttendance(record: any) {
  try {
    const rule = await prisma.emailNotificationRule.findUnique({ where: { type: 'suspect_attendance' } });
    if (!rule || (!rule.enabled && !rule.smsEnabled)) return;

    const agent = await prisma.user.findUnique({ where: { id: record.agentId }, select: { firstName: true, lastName: true } });
    const event = await prisma.event.findUnique({ where: { id: record.eventId }, select: { title: true } });
    if (!agent || !event) return;

    const agentName = `${agent.firstName} ${agent.lastName}`;
    const dateStr = record.date instanceof Date ? record.date.toISOString().slice(0, 10) : String(record.date).slice(0, 10);

    if (rule.enabled) {
      const recipients = rule.recipients.length > 0 ? rule.recipients : (await prisma.user.findMany({ where: { role: 'admin', isActive: true }, select: { email: true } })).map(a => a.email);
      const html = emailSuspectAttendance(agentName, event.title, dateStr, record.suspectReasons || ['Anomalie détectée']);
      const subject = `🔴 Pointage suspect : ${agentName}`;
      for (const email of recipients) {
        const sent = await sendEmail(email, subject, html);
        if (sent) {
          await prisma.emailLog.create({ data: { ruleType: 'suspect_attendance', recipient: email, subject, entityId: record.id } });
        }
      }
    }

    if (rule.smsEnabled) {
      const adminPhones = (await prisma.user.findMany({ where: { role: 'admin', isActive: true, phone: { not: '' } }, select: { phone: true } })).map(a => a.phone);
      const smsBody = smsSuspectAttendance(agentName, event.title);
      for (const phone of adminPhones) {
        const sent = await sendSms(phone, smsBody);
        if (sent) {
          await prisma.emailLog.create({ data: { ruleType: 'suspect_attendance', recipient: phone, subject: 'SMS: pointage suspect', channel: 'sms', entityId: record.id } });
        }
      }
    }
  } catch (err) {
    console.error('Notification (suspect_attendance) error:', err);
  }
}

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
    billedHours: r.billedHours,
    status: r.status,
    validatedBy: r.validatedBy,
    validatedAt: r.validatedAt?.toISOString() ?? null,
    refusalReason: r.refusalReason,
    isSuspect: r.isSuspect,
    suspectReasons: r.suspectReasons,
    photos: (r.photos || []).map((p: any) => ({
      id: p.id,
      photoUrl: p.photoUrl,
      caption: p.caption,
      createdAt: p.createdAt.toISOString(),
    })),
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
    include: { photos: { orderBy: { createdAt: 'asc' } } },
  });

  res.json(records.map(formatRecord));
});

// GET /api/attendance/:id
router.get('/:id', async (req: Request, res: Response) => {
  const record = await prisma.attendance.findUnique({
    where: { id: req.params.id },
    include: { photos: { orderBy: { createdAt: 'asc' } } },
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
  status: z.string().optional(),
  isSuspect: z.boolean().optional(),
  suspectReasons: z.array(z.string()).optional(),
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
    include: { photos: true },
  });

  res.status(201).json(formatRecord(record));
  emitAttendanceChanged();

  if (record.isSuspect) {
    notifySuspectAttendance(record);
  }
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
      include: { photos: { orderBy: { createdAt: 'asc' } } },
    });
    res.json(formatRecord(record));
    emitAttendanceChanged();

    // Send suspect email if marked as suspect
    if (data.isSuspect === true) {
      notifySuspectAttendance(record);
    }
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
  billedHours: z.number().min(0).optional(),
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
        billedHours: parsed.data.billedHours,
        validatedBy: req.auth!.userId,
        validatedAt: new Date(),
      },
      include: { photos: { orderBy: { createdAt: 'asc' } } },
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

// ── Work Photos ─────────────────────────────────────────

const photoSchema = z.object({
  photoUrl: z.string().min(1),
  caption: z.string().optional(),
});

// POST /api/attendance/:id/photos (agent adds work photo)
router.post('/:id/photos', async (req: Request, res: Response) => {
  const parsed = photoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides' });
    return;
  }

  // Verify attendance exists and belongs to agent
  const attendance = await prisma.attendance.findUnique({ where: { id: req.params.id } });
  if (!attendance) {
    res.status(404).json({ error: 'Pointage introuvable' });
    return;
  }
  if (attendance.agentId !== req.auth!.userId && req.auth!.role !== 'admin') {
    res.status(403).json({ error: 'Non autorisé' });
    return;
  }

  const photo = await prisma.attendancePhoto.create({
    data: {
      attendanceId: req.params.id,
      photoUrl: parsed.data.photoUrl,
      caption: parsed.data.caption,
    },
  });

  res.status(201).json({
    id: photo.id,
    photoUrl: photo.photoUrl,
    caption: photo.caption,
    createdAt: photo.createdAt.toISOString(),
  });
  emitAttendanceChanged();
});

// DELETE /api/attendance/:id/photos/:photoId
router.delete('/:id/photos/:photoId', async (req: Request, res: Response) => {
  const photo = await prisma.attendancePhoto.findUnique({
    where: { id: req.params.photoId },
    include: { attendance: true },
  });
  if (!photo) {
    res.status(404).json({ error: 'Photo introuvable' });
    return;
  }
  if (photo.attendance.agentId !== req.auth!.userId && req.auth!.role !== 'admin') {
    res.status(403).json({ error: 'Non autorisé' });
    return;
  }

  await prisma.attendancePhoto.delete({ where: { id: req.params.photoId } });
  res.json({ success: true });
  emitAttendanceChanged();
});

export default router;
