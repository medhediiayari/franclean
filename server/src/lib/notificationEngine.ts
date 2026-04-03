import cron from 'node-cron';
import prisma from './prisma.js';
import {
  sendEmail,
  emailUnassignedAlert,
  emailNoCheckinAlert,
  emailMissionReminder,
  emailNoCheckoutAlert,
} from './email.js';
import {
  sendSms,
  smsAgentAssigned,
  smsMissionReminder,
  smsUnassignedAlert,
  smsNoCheckinAlert,
  smsNoCheckoutAlert,
  smsSuspectAttendance,
  smsEventRefused,
} from './sms.js';

// ── Rule type definitions ───────────────────────────────
// Each rule type has:
//   key: unique identifier stored in DB
//   label: display name in French
//   description: explanation
//   defaultThreshold: default value (minutes or days)
//   thresholdUnit: 'minutes' | 'jours'
//   cronType: 'scheduled' (cron) or 'instant' (triggered by events)

export const RULE_TYPES = [
  {
    key: 'agent_assigned',
    label: 'Agent assigné à une mission',
    description: "Email envoyé à l'agent quand il est assigné à une mission",
    defaultThreshold: 0,
    thresholdUnit: '',
    cronType: 'instant',
  },
  {
    key: 'mission_reminder',
    label: 'Rappel de mission (veille)',
    description: "Email envoyé à l'agent la veille de sa mission",
    defaultThreshold: 1,
    thresholdUnit: 'jours',
    cronType: 'scheduled',
  },
  {
    key: 'unassigned_mission',
    label: 'Mission sans agent assigné',
    description: "Alerte admin quand une mission n'a pas d'agent X jours avant le début",
    defaultThreshold: 2,
    thresholdUnit: 'jours',
    cronType: 'scheduled',
  },
  {
    key: 'no_checkin',
    label: "Pas de pointage d'entrée",
    description: "Alerte admin quand un agent n'a pas pointé X minutes après le début de son créneau",
    defaultThreshold: 15,
    thresholdUnit: 'minutes',
    cronType: 'scheduled',
  },
  {
    key: 'no_checkout',
    label: 'Pas de pointage de sortie',
    description: "Alerte admin quand un agent n'a pas fait de check-out X minutes après la fin de son créneau",
    defaultThreshold: 30,
    thresholdUnit: 'minutes',
    cronType: 'scheduled',
  },
  {
    key: 'suspect_attendance',
    label: 'Pointage suspect',
    description: "Alerte admin quand un pointage est marqué comme suspect",
    defaultThreshold: 0,
    thresholdUnit: '',
    cronType: 'instant',
  },
  {
    key: 'event_refused',
    label: 'Mission refusée par un agent',
    description: "Alerte admin quand un agent refuse une mission",
    defaultThreshold: 0,
    thresholdUnit: '',
    cronType: 'instant',
  },
] as const;

export type RuleKey = typeof RULE_TYPES[number]['key'];

// ── Helpers ─────────────────────────────────────────────

async function getRule(type: string) {
  return prisma.emailNotificationRule.findUnique({ where: { type } });
}

async function getAdminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'admin', isActive: true },
    select: { email: true },
  });
  return admins.map((a) => a.email);
}

async function getAdminPhones(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'admin', isActive: true, phone: { not: '' } },
    select: { phone: true },
  });
  return admins.map((a) => a.phone).filter(Boolean);
}

async function getRecipients(rule: { recipients: string[] }): Promise<string[]> {
  if (rule.recipients.length > 0) return rule.recipients;
  return getAdminEmails();
}

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function wasAlreadySent(ruleType: string, entityId: string, recipient: string): Promise<boolean> {
  const existing = await prisma.emailLog.findFirst({
    where: {
      ruleType,
      entityId,
      recipient,
      sentAt: { gte: new Date(todayStr() + 'T00:00:00Z') },
    },
  });
  return !!existing;
}

async function logEmail(ruleType: string, recipient: string, subject: string, entityId?: string, channel: string = 'email') {
  await prisma.emailLog.create({
    data: { ruleType, recipient, subject, channel, entityId },
  });
}

// ── Cron Job: Unassigned missions ───────────────────────
async function checkUnassignedMissions() {
  const rule = await getRule('unassigned_mission');
  if (!rule || (!rule.enabled && !rule.smsEnabled)) return;

  const thresholdDays = rule.threshold || 2;
  const now = new Date();
  const limitDate = new Date(now.getTime() + thresholdDays * 86400000);

  const events = await prisma.event.findMany({
    where: {
      status: 'planifie',
      startDate: { lte: limitDate },
    },
    include: { shifts: true },
  });

  const unassigned = events.filter((e) =>
    e.shifts.some((s) => !s.agentId)
  ).map((e) => ({
    title: e.title,
    client: e.client || '',
    startDate: dateStr(e.startDate),
    daysLeft: Math.max(0, Math.ceil((e.startDate.getTime() - now.getTime()) / 86400000)),
    id: e.id,
  }));

  if (unassigned.length === 0) return;

  const key = unassigned.map(u => u.id).sort().join(',');

  if (rule.enabled) {
    const recipients = await getRecipients(rule);
    const subject = `⚠️ ${unassigned.length} mission(s) sans agent assigné`;
    const html = emailUnassignedAlert(unassigned);
    for (const email of recipients) {
      if (await wasAlreadySent('unassigned_mission', key, email)) continue;
      const sent = await sendEmail(email, subject, html);
      if (sent) await logEmail('unassigned_mission', email, subject, key);
    }
  }

  if (rule.smsEnabled) {
    const phones = await getAdminPhones();
    const smsBody = smsUnassignedAlert(unassigned.length);
    for (const phone of phones) {
      if (await wasAlreadySent('unassigned_mission', key, phone)) continue;
      const sent = await sendSms(phone, smsBody);
      if (sent) await logEmail('unassigned_mission', phone, 'SMS: missions sans agent', key, 'sms');
    }
  }
}

// ── Cron Job: No check-in after shift start ─────────────
async function checkNoCheckin() {
  const rule = await getRule('no_checkin');
  if (!rule || (!rule.enabled && !rule.smsEnabled)) return;

  const thresholdMinutes = rule.threshold || 15;
  const now = new Date();
  const today = todayStr();

  // Get today's shifts with agents
  const shifts = await prisma.eventShift.findMany({
    where: {
      date: new Date(today),
      agentId: { not: null },
    },
    include: {
      event: true,
      agent: true,
    },
  });

  const items: { agentName: string; eventTitle: string; shiftTime: string; minutesLate: number; entityId: string }[] = [];

  for (const shift of shifts) {
    if (!shift.agent || !shift.event || shift.event.status === 'annule' || shift.event.status === 'termine') continue;

    const [h, m] = shift.startTime.split(':').map(Number);
    const shiftStart = new Date(today + 'T00:00:00');
    shiftStart.setHours(h, m, 0, 0);
    const deadline = new Date(shiftStart.getTime() + thresholdMinutes * 60000);

    if (now < deadline) continue; // not yet past threshold

    // Check if attendance exists for this agent/event/date
    const attendance = await prisma.attendance.findFirst({
      where: {
        agentId: shift.agentId!,
        eventId: shift.eventId,
        date: new Date(today),
        checkInTime: { not: null },
      },
    });

    if (attendance) continue; // already checked in

    const minutesLate = Math.round((now.getTime() - shiftStart.getTime()) / 60000);
    items.push({
      agentName: `${shift.agent.firstName} ${shift.agent.lastName}`,
      eventTitle: shift.event.title,
      shiftTime: `${shift.startTime} - ${shift.endTime}`,
      minutesLate,
      entityId: shift.id,
    });
  }

  if (items.length === 0) return;

  const key = items.map(i => i.entityId).sort().join(',');

  if (rule.enabled) {
    const recipients = await getRecipients(rule);
    const subject = `🚨 ${items.length} agent(s) sans pointage d'entrée`;
    const html = emailNoCheckinAlert(items);
    for (const email of recipients) {
      if (await wasAlreadySent('no_checkin', key, email)) continue;
      const sent = await sendEmail(email, subject, html);
      if (sent) await logEmail('no_checkin', email, subject, key);
    }
  }

  if (rule.smsEnabled) {
    const phones = await getAdminPhones();
    const smsBody = smsNoCheckinAlert(items.length);
    for (const phone of phones) {
      if (await wasAlreadySent('no_checkin', key, phone)) continue;
      const sent = await sendSms(phone, smsBody);
      if (sent) await logEmail('no_checkin', phone, 'SMS: pas de check-in', key, 'sms');
    }
  }
}

// ── Cron Job: No check-out ──────────────────────────────
async function checkNoCheckout() {
  const rule = await getRule('no_checkout');
  if (!rule || (!rule.enabled && !rule.smsEnabled)) return;

  const thresholdMinutes = rule.threshold || 30;
  const now = new Date();
  const today = todayStr();

  // Get today's attendances with check-in but no check-out
  const attendances = await prisma.attendance.findMany({
    where: {
      date: new Date(today),
      checkInTime: { not: null },
      checkOutTime: null,
    },
    include: {
      agent: true,
      event: { include: { shifts: true } },
    },
  });

  const items: { agentName: string; eventTitle: string; checkInTime: string; entityId: string }[] = [];

  for (const att of attendances) {
    if (!att.agent || !att.event) continue;

    // Find the agent's shift for this event today
    const shift = att.event.shifts.find(
      (s) => dateStr(s.date) === today && s.agentId === att.agentId
    );
    if (!shift) continue;

    const [h, m] = shift.endTime.split(':').map(Number);
    const shiftEnd = new Date(today + 'T00:00:00');
    shiftEnd.setHours(h, m, 0, 0);
    const deadline = new Date(shiftEnd.getTime() + thresholdMinutes * 60000);

    if (now < deadline) continue;

    const checkIn = att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';

    items.push({
      agentName: `${att.agent.firstName} ${att.agent.lastName}`,
      eventTitle: att.event.title,
      checkInTime: checkIn,
      entityId: att.id,
    });
  }

  if (items.length === 0) return;

  const key = items.map(i => i.entityId).sort().join(',');

  if (rule.enabled) {
    const recipients = await getRecipients(rule);
    const subject = `⚠️ ${items.length} agent(s) sans check-out`;
    const html = emailNoCheckoutAlert(items);
    for (const email of recipients) {
      if (await wasAlreadySent('no_checkout', key, email)) continue;
      const sent = await sendEmail(email, subject, html);
      if (sent) await logEmail('no_checkout', email, subject, key);
    }
  }

  if (rule.smsEnabled) {
    const phones = await getAdminPhones();
    const smsBody = smsNoCheckoutAlert(items.length);
    for (const phone of phones) {
      if (await wasAlreadySent('no_checkout', key, phone)) continue;
      const sent = await sendSms(phone, smsBody);
      if (sent) await logEmail('no_checkout', phone, 'SMS: pas de check-out', key, 'sms');
    }
  }
}

// ── Cron Job: Mission reminder (next day) ───────────────
async function checkMissionReminders() {
  const rule = await getRule('mission_reminder');
  if (!rule || (!rule.enabled && !rule.smsEnabled)) return;

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const tomorrowStr = dateStr(tomorrow);

  const shifts = await prisma.eventShift.findMany({
    where: {
      date: new Date(tomorrowStr),
      agentId: { not: null },
    },
    include: {
      event: true,
      agent: true,
    },
  });

  const grouped = new Map<string, { agent: any; event: any; shifts: string[] }>();
  for (const s of shifts) {
    if (!s.agent || !s.event || s.event.status === 'annule') continue;
    const key = `${s.agentId}-${s.eventId}`;
    if (!grouped.has(key)) {
      grouped.set(key, { agent: s.agent, event: s.event, shifts: [] });
    }
    grouped.get(key)!.shifts.push(`${s.startTime} - ${s.endTime}`);
  }

  for (const [key, { agent, event, shifts: shiftTimes }] of grouped) {
    const entityId = `reminder-${key}-${tomorrowStr}`;

    if (rule.enabled) {
      if (!(await wasAlreadySent('mission_reminder', entityId, agent.email))) {
        const html = emailMissionReminder(
          `${agent.firstName} ${agent.lastName}`,
          event.title,
          event.client || '',
          tomorrowStr,
          shiftTimes.join(', '),
          event.address,
        );
        const subject = `⏰ Rappel : mission "${event.title}" demain`;
        const sent = await sendEmail(agent.email, subject, html);
        if (sent) await logEmail('mission_reminder', agent.email, subject, entityId);
      }
    }

    if (rule.smsEnabled && agent.phone) {
      if (!(await wasAlreadySent('mission_reminder', entityId, agent.phone))) {
        const smsBody = smsMissionReminder(
          `${agent.firstName} ${agent.lastName}`,
          event.title,
          shiftTimes.join(', '),
        );
        const sent = await sendSms(agent.phone, smsBody);
        if (sent) await logEmail('mission_reminder', agent.phone, 'SMS: rappel mission', entityId, 'sms');
      }
    }
  }
}

// ── Initialize cron jobs ────────────────────────────────
// Seed all rule types into the DB if they don't exist yet
async function seedRules() {
  for (const rt of RULE_TYPES) {
    await prisma.emailNotificationRule.upsert({
      where: { type: rt.key },
      create: {
        type: rt.key,
        enabled: true,
        smsEnabled: false,
        recipients: [],
        threshold: rt.defaultThreshold,
      },
      update: {},  // don't overwrite existing settings
    });
  }
}

export async function startNotificationCron() {
  // Make sure all rules exist in DB
  await seedRules();

  // Every 5 minutes: check no-checkin and no-checkout
  cron.schedule('*/5 * * * *', async () => {
    try {
      await checkNoCheckin();
      await checkNoCheckout();
    } catch (err) {
      console.error('📧 Cron error (checkin/checkout):', err);
    }
  });

  // Every day at 8:00 AM: check unassigned missions
  cron.schedule('0 8 * * *', async () => {
    try {
      await checkUnassignedMissions();
    } catch (err) {
      console.error('📧 Cron error (unassigned):', err);
    }
  });

  // Every day at 18:00: send mission reminders for tomorrow
  cron.schedule('0 18 * * *', async () => {
    try {
      await checkMissionReminders();
    } catch (err) {
      console.error('📧 Cron error (reminders):', err);
    }
  });

  console.log('⏰ Email notification cron jobs started');
}
