import prisma from './prisma.js';

interface SmsConfigData {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  enabled: boolean;
}

let cachedConfig: SmsConfigData | null = null;
let lastFetch = 0;

async function getConfig(): Promise<SmsConfigData | null> {
  // Cache for 60 seconds
  if (cachedConfig && Date.now() - lastFetch < 60000) return cachedConfig;

  const config = await prisma.smsConfig.findUnique({ where: { id: 'singleton' } });
  if (!config || !config.enabled || !config.accountSid || !config.authToken || !config.phoneNumber) {
    cachedConfig = null;
    return null;
  }

  cachedConfig = {
    accountSid: config.accountSid,
    authToken: config.authToken,
    phoneNumber: config.phoneNumber,
    enabled: config.enabled,
  };
  lastFetch = Date.now();
  return cachedConfig;
}

export function clearSmsConfigCache() {
  cachedConfig = null;
  lastFetch = 0;
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  const config = await getConfig();
  if (!config) {
    console.log('📱 SMS skipped (Twilio not configured)');
    return false;
  }

  // Normalize phone: ensure it starts with +
  const phone = to.startsWith('+') ? to : `+33${to.replace(/^0/, '').replace(/\s/g, '')}`;

  try {
    // Dynamic import to avoid crash if twilio is not installed
    const twilio = await import('twilio');
    const client = twilio.default(config.accountSid, config.authToken);

    await client.messages.create({
      body,
      from: config.phoneNumber,
      to: phone,
    });

    console.log(`📱 SMS sent to ${phone}`);
    return true;
  } catch (err: any) {
    console.error(`📱 SMS failed to ${phone}:`, err.message);
    return false;
  }
}

// ── SMS Templates ───────────────────────────────────────

export function smsAgentAssigned(agentName: string, eventTitle: string, dates: string): string {
  return `🐦 Bipbip\n\nBonjour ${agentName},\nVous êtes assigné(e) à : ${eventTitle}\nDates : ${dates}\n\nConnectez-vous à l'app pour confirmer.`;
}

export function smsMissionReminder(agentName: string, eventTitle: string, shifts: string): string {
  return `🐦 Bipbip - Rappel\n\n${agentName}, mission demain :\n${eventTitle}\nCréneaux : ${shifts}\n\nBonne préparation !`;
}

export function smsUnassignedAlert(count: number): string {
  return `🐦 Bipbip ⚠️\n\n${count} mission(s) sans agent assigné. Vérifiez dans l'application.`;
}

export function smsNoCheckinAlert(count: number): string {
  return `🐦 Bipbip 🚨\n\n${count} agent(s) n'ont pas pointé leur entrée. Vérifiez la situation.`;
}

export function smsNoCheckoutAlert(count: number): string {
  return `🐦 Bipbip ⚠️\n\n${count} agent(s) sans check-out. Vérifiez dans l'application.`;
}

export function smsSuspectAttendance(agentName: string, eventTitle: string): string {
  return `🐦 Bipbip 🔴\n\nPointage suspect détecté :\nAgent : ${agentName}\nMission : ${eventTitle}\n\nVérifiez dans l'application.`;
}

export function smsEventRefused(agentName: string, eventTitle: string): string {
  return `🐦 Bipbip ❌\n\n${agentName} a refusé la mission "${eventTitle}". Réaffectation nécessaire.`;
}
