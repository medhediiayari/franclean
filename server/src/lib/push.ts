import webpush from 'web-push';
import prisma from './prisma.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:notif.bipbip@gmail.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('🔔 Web Push configured');
} else {
  console.warn('🔔 Web Push not configured (missing VAPID keys)');
}

export { VAPID_PUBLIC_KEY };

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

/** Send push to a specific user (all their subscriptions) */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return 0;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err: any) {
      // 410 Gone or 404 = subscription expired, remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error(`🔔 Push failed for ${sub.endpoint.slice(0, 50)}:`, err.message);
      }
    }
  }
  return sent;
}

/** Send push to all admins */
export async function sendPushToAdmins(payload: PushPayload): Promise<number> {
  const admins = await prisma.user.findMany({
    where: { role: 'admin', isActive: true },
    select: { id: true },
  });
  let total = 0;
  for (const admin of admins) {
    total += await sendPushToUser(admin.id, payload);
  }
  return total;
}

/** Send push to specific users */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  let total = 0;
  for (const userId of userIds) {
    total += await sendPushToUser(userId, payload);
  }
  return total;
}
