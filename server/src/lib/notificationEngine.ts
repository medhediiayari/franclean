import cron from 'node-cron';
import prisma from './prisma.js';
import {
  sendEmail,
  emailUnassignedAlert,
  emailNoCheckinAlert,
  emailMissionReminder,
  emailNoCheckoutAlert,
  emailLateCheckin,
  emailEarlyCheckout,
  emailMissionCancelled,
  emailWeeklyAgentSummary,
  emailMonthlyClientReport,
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
  smsLateCheckin,
  smsEarlyCheckout,
  smsMissionCancelled,
  smsWeeklyAgentSummary,
  smsMonthlyClientReport,
} from './sms.js';
import { sendPushToUser, sendPushToAdmins, sendPushToUsers } from './push.js';

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
  {
    key: 'late_checkin',
    label: 'Agent en retard',
    description: "Alerte admin quand un agent pointe son entrée en retard (> seuil minutes après le début prévu)",
    defaultThreshold: 10,
    thresholdUnit: 'minutes',
    cronType: 'instant',
  },
  {
    key: 'early_checkout',
    label: 'Sortie anticipée',
    description: "Alerte admin quand un agent pointe sa sortie avant la fin prévue du créneau",
    defaultThreshold: 15,
    thresholdUnit: 'minutes',
    cronType: 'instant',
  },
  {
    key: 'mission_cancelled',
    label: 'Mission annulée',
    description: "Email envoyé aux agents assignés quand une mission est annulée",
    defaultThreshold: 0,
    thresholdUnit: '',
    cronType: 'instant',
  },
  {
    key: 'weekly_agent_summary',
    label: 'Récap hebdomadaire par agent',
    description: "Email récapitulatif hebdomadaire des heures par agent (envoyé le lundi matin)",
    defaultThreshold: 0,
    thresholdUnit: '',
    cronType: 'scheduled',
  },
  {
    key: 'monthly_client_report',
    label: 'Récap mensuel par client',
    description: "Email récapitulatif mensuel des heures par client pour facturation (envoyé le 1er du mois)",
    defaultThreshold: 0,
    thresholdUnit: '',
    cronType: 'scheduled',
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

  // Push to admins
  await sendPushToAdmins({
    title: '⚠️ Missions sans agent',
    body: `${unassigned.length} mission(s) sans agent assigné`,
    url: '/admin/planning',
    tag: 'unassigned_mission',
  });
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

  // Push to admins
  await sendPushToAdmins({
    title: '🚨 Pointage manquant',
    body: `${items.length} agent(s) sans pointage d'entrée`,
    url: '/admin/heures',
    tag: 'no_checkin',
  });
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

  // Push to admins
  await sendPushToAdmins({
    title: '⚠️ Check-out manquant',
    body: `${items.length} agent(s) sans check-out`,
    url: '/admin/heures',
    tag: 'no_checkout',
  });
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

    // Push to agent
    await sendPushToUser(agent.id, {
      title: '⏰ Rappel mission demain',
      body: `${event.title} — ${shiftTimes.join(', ')}`,
      url: '/agent/planning',
      tag: `reminder-${event.id}`,
    });
  }
}

// ── Instant: Late check-in ──────────────────────────────
export async function notifyLateCheckin(agentId: string, eventId: string, checkInTime: Date) {
  try {
    const rule = await getRule('late_checkin');
    if (!rule || (!rule.enabled && !rule.smsEnabled)) return;

    const thresholdMin = rule.threshold || 10;
    const today = todayStr();

    // Find the agent's shift for today
    const shift = await prisma.eventShift.findFirst({
      where: { eventId, agentId, date: new Date(today) },
    });
    if (!shift) return;

    const [h, m] = shift.startTime.split(':').map(Number);
    const shiftStart = new Date(today + 'T00:00:00');
    shiftStart.setHours(h, m, 0, 0);

    const lateMinutes = Math.round((checkInTime.getTime() - shiftStart.getTime()) / 60000);
    if (lateMinutes <= thresholdMin) return; // Not late enough

    const agent = await prisma.user.findUnique({ where: { id: agentId } });
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!agent || !event) return;

    const agentName = `${agent.firstName} ${agent.lastName}`;
    const entityId = `late-${agentId}-${eventId}-${today}`;

    if (rule.enabled) {
      const recipients = await getRecipients(rule);
      const subject = `⏰ Retard : ${agentName} (+${lateMinutes} min)`;
      const html = emailLateCheckin(agentName, event.title, shift.startTime, checkInTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), lateMinutes);
      for (const email of recipients) {
        if (await wasAlreadySent('late_checkin', entityId, email)) continue;
        const sent = await sendEmail(email, subject, html);
        if (sent) await logEmail('late_checkin', email, subject, entityId);
      }
    }

    if (rule.smsEnabled) {
      const phones = await getAdminPhones();
      const body = smsLateCheckin(agentName, event.title, lateMinutes);
      for (const phone of phones) {
        if (await wasAlreadySent('late_checkin', entityId, phone)) continue;
        const sent = await sendSms(phone, body);
        if (sent) await logEmail('late_checkin', phone, 'SMS: retard agent', entityId, 'sms');
      }
    }

    // Push to admins
    await sendPushToAdmins({
      title: `⏰ Retard : ${agentName}`,
      body: `+${lateMinutes} min sur "${event.title}"`,
      url: '/admin/heures',
      tag: `late-${entityId}`,
    });
  } catch (err) {
    console.error('📧 notifyLateCheckin error:', err);
  }
}

// ── Instant: Early check-out ────────────────────────────
export async function notifyEarlyCheckout(agentId: string, eventId: string, checkOutTime: Date) {
  try {
    const rule = await getRule('early_checkout');
    if (!rule || (!rule.enabled && !rule.smsEnabled)) return;

    const thresholdMin = rule.threshold || 15;
    const today = todayStr();

    const shift = await prisma.eventShift.findFirst({
      where: { eventId, agentId, date: new Date(today) },
    });
    if (!shift) return;

    const [h, m] = shift.endTime.split(':').map(Number);
    const shiftEnd = new Date(today + 'T00:00:00');
    shiftEnd.setHours(h, m, 0, 0);

    const earlyMinutes = Math.round((shiftEnd.getTime() - checkOutTime.getTime()) / 60000);
    if (earlyMinutes <= thresholdMin) return; // Not early enough

    const agent = await prisma.user.findUnique({ where: { id: agentId } });
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!agent || !event) return;

    const agentName = `${agent.firstName} ${agent.lastName}`;
    const entityId = `early-${agentId}-${eventId}-${today}`;

    if (rule.enabled) {
      const recipients = await getRecipients(rule);
      const subject = `⚡ Sortie anticipée : ${agentName} (-${earlyMinutes} min)`;
      const html = emailEarlyCheckout(agentName, event.title, shift.endTime, checkOutTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), earlyMinutes);
      for (const email of recipients) {
        if (await wasAlreadySent('early_checkout', entityId, email)) continue;
        const sent = await sendEmail(email, subject, html);
        if (sent) await logEmail('early_checkout', email, subject, entityId);
      }
    }

    if (rule.smsEnabled) {
      const phones = await getAdminPhones();
      const body = smsEarlyCheckout(agentName, event.title, earlyMinutes);
      for (const phone of phones) {
        if (await wasAlreadySent('early_checkout', entityId, phone)) continue;
        const sent = await sendSms(phone, body);
        if (sent) await logEmail('early_checkout', phone, 'SMS: sortie anticipée', entityId, 'sms');
      }
    }

    // Push to admins
    await sendPushToAdmins({
      title: `⚡ Sortie anticipée : ${agentName}`,
      body: `-${earlyMinutes} min sur "${event.title}"`,
      url: '/admin/heures',
      tag: `early-${entityId}`,
    });
  } catch (err) {
    console.error('📧 notifyEarlyCheckout error:', err);
  }
}

// ── Instant: Mission cancelled ──────────────────────────
export async function notifyMissionCancelled(eventId: string) {
  try {
    const rule = await getRule('mission_cancelled');
    if (!rule || (!rule.enabled && !rule.smsEnabled)) return;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        agents: { include: { agent: true } },
      },
    });
    if (!event) return;

    const assignedAgents = event.agents.filter(ea => ea.agent);

    for (const ea of assignedAgents) {
      const agent = ea.agent!;
      const agentName = `${agent.firstName} ${agent.lastName}`;
      const entityId = `cancelled-${eventId}-${agent.id}`;

      if (rule.enabled) {
        if (!(await wasAlreadySent('mission_cancelled', entityId, agent.email))) {
          const subject = `🚫 Mission annulée : ${event.title}`;
          const html = emailMissionCancelled(agentName, event.title, event.client || '', event.address);
          const sent = await sendEmail(agent.email, subject, html);
          if (sent) await logEmail('mission_cancelled', agent.email, subject, entityId);
        }
      }

      if (rule.smsEnabled && agent.phone) {
        if (!(await wasAlreadySent('mission_cancelled', entityId, agent.phone))) {
          const body = smsMissionCancelled(agentName, event.title);
          const sent = await sendSms(agent.phone, body);
          if (sent) await logEmail('mission_cancelled', agent.phone, 'SMS: mission annulée', entityId, 'sms');
        }
      }

      // Push to agent
      await sendPushToUser(agent.id, {
        title: '🚫 Mission annulée',
        body: `"${event.title}" a été annulée`,
        url: '/agent/planning',
        tag: `cancelled-${eventId}`,
      });
    }
  } catch (err) {
    console.error('📧 notifyMissionCancelled error:', err);
  }
}

// ── Cron: Weekly agent summary (every Monday 8:00 AM) ───
async function checkWeeklyAgentSummary() {
  const rule = await getRule('weekly_agent_summary');
  if (!rule || (!rule.enabled && !rule.smsEnabled)) return;

  const now = new Date();
  // Last 7 days
  const weekStart = new Date(now.getTime() - 7 * 86400000);
  const weekStartStr = dateStr(weekStart);
  const weekEndStr = dateStr(now);

  const attendances = await prisma.attendance.findMany({
    where: {
      date: { gte: weekStart, lt: now },
      checkInTime: { not: null },
      status: { in: ['valide', 'en_attente'] },
    },
    include: {
      agent: true,
      event: true,
    },
  });

  // Group by agent
  const byAgent = new Map<string, { name: string; email: string; phone: string; totalHours: number; missions: Set<string>; days: Set<string> }>();
  for (const att of attendances) {
    if (!att.agent || !att.checkInTime) continue;
    const agentId = att.agentId;
    if (!byAgent.has(agentId)) {
      byAgent.set(agentId, {
        name: `${att.agent.firstName} ${att.agent.lastName}`,
        email: att.agent.email,
        phone: att.agent.phone || '',
        totalHours: 0,
        missions: new Set(),
        days: new Set(),
      });
    }
    const entry = byAgent.get(agentId)!;
    if (att.event) entry.missions.add(att.event.title);
    entry.days.add(dateStr(att.date));

    if (att.checkInTime && att.checkOutTime) {
      const hours = (new Date(att.checkOutTime).getTime() - new Date(att.checkInTime).getTime()) / 3600000;
      entry.totalHours += Math.max(0, hours);
    }
  }

  if (byAgent.size === 0) return;

  const agentSummaries = Array.from(byAgent.values()).map(a => ({
    name: a.name,
    totalHours: Math.round(a.totalHours * 100) / 100,
    missionCount: a.missions.size,
    dayCount: a.days.size,
  })).sort((a, b) => b.totalHours - a.totalHours);

  const entityId = `weekly-${weekStartStr}`;

  if (rule.enabled) {
    const recipients = await getRecipients(rule);
    const subject = `📊 Récap hebdomadaire des heures (${weekStartStr} → ${weekEndStr})`;
    const html = emailWeeklyAgentSummary(agentSummaries, weekStartStr, weekEndStr);
    for (const email of recipients) {
      if (await wasAlreadySent('weekly_agent_summary', entityId, email)) continue;
      const sent = await sendEmail(email, subject, html);
      if (sent) await logEmail('weekly_agent_summary', email, subject, entityId);
    }
  }

  if (rule.smsEnabled) {
    const phones = await getAdminPhones();
    const totalH = agentSummaries.reduce((s, a) => s + a.totalHours, 0);
    const body = smsWeeklyAgentSummary(byAgent.size, Math.round(totalH * 100) / 100);
    for (const phone of phones) {
      if (await wasAlreadySent('weekly_agent_summary', entityId, phone)) continue;
      const sent = await sendSms(phone, body);
      if (sent) await logEmail('weekly_agent_summary', phone, 'SMS: récap hebdo', entityId, 'sms');
    }
  }
}

// ── Cron: Monthly client report (1st of month 9:00 AM) ──
async function checkMonthlyClientReport() {
  const rule = await getRule('monthly_client_report');
  if (!rule || (!rule.enabled && !rule.smsEnabled)) return;

  const now = new Date();
  // Previous month
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const monthName = prevMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const attendances = await prisma.attendance.findMany({
    where: {
      date: { gte: prevMonth, lte: monthEnd },
      checkInTime: { not: null },
      status: { in: ['valide', 'en_attente'] },
    },
    include: {
      event: true,
      agent: true,
    },
  });

  // Group by client
  const byClient = new Map<string, { client: string; totalHours: number; missions: Set<string>; agents: Set<string> }>();
  for (const att of attendances) {
    if (!att.event || !att.checkInTime) continue;
    const clientName = att.event.client || 'Sans client';
    if (!byClient.has(clientName)) {
      byClient.set(clientName, { client: clientName, totalHours: 0, missions: new Set(), agents: new Set() });
    }
    const entry = byClient.get(clientName)!;
    entry.missions.add(att.event.title);
    if (att.agent) entry.agents.add(`${att.agent.firstName} ${att.agent.lastName}`);
    if (att.checkInTime && att.checkOutTime) {
      const hours = (new Date(att.checkOutTime).getTime() - new Date(att.checkInTime).getTime()) / 3600000;
      entry.totalHours += Math.max(0, hours);
    }
  }

  if (byClient.size === 0) return;

  const clientSummaries = Array.from(byClient.values()).map(c => ({
    client: c.client,
    totalHours: Math.round(c.totalHours * 100) / 100,
    missionCount: c.missions.size,
    agentCount: c.agents.size,
  })).sort((a, b) => b.totalHours - a.totalHours);

  const entityId = `monthly-${dateStr(prevMonth)}`;

  if (rule.enabled) {
    const recipients = await getRecipients(rule);
    const subject = `📋 Récap mensuel par client — ${monthName}`;
    const html = emailMonthlyClientReport(clientSummaries, monthName);
    for (const email of recipients) {
      if (await wasAlreadySent('monthly_client_report', entityId, email)) continue;
      const sent = await sendEmail(email, subject, html);
      if (sent) await logEmail('monthly_client_report', email, subject, entityId);
    }
  }

  if (rule.smsEnabled) {
    const phones = await getAdminPhones();
    const totalH = clientSummaries.reduce((s, c) => s + c.totalHours, 0);
    const body = smsMonthlyClientReport(byClient.size, Math.round(totalH * 100) / 100, monthName);
    for (const phone of phones) {
      if (await wasAlreadySent('monthly_client_report', entityId, phone)) continue;
      const sent = await sendSms(phone, body);
      if (sent) await logEmail('monthly_client_report', phone, 'SMS: récap mensuel', entityId, 'sms');
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

  // Every Monday at 8:00 AM: weekly agent summary
  cron.schedule('0 8 * * 1', async () => {
    try {
      await checkWeeklyAgentSummary();
    } catch (err) {
      console.error('📧 Cron error (weekly summary):', err);
    }
  });

  // 1st of month at 9:00 AM: monthly client report
  cron.schedule('0 9 1 * *', async () => {
    try {
      await checkMonthlyClientReport();
    } catch (err) {
      console.error('📧 Cron error (monthly report):', err);
    }
  });

  console.log('⏰ Email notification cron jobs started');
}
