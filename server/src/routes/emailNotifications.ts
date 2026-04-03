import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, adminOnly } from '../lib/auth.js';
import { RULE_TYPES } from '../lib/notificationEngine.js';
import { sendEmail } from '../lib/email.js';
import { sendSms, clearSmsConfigCache } from '../lib/sms.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);
router.use(adminOnly);

// GET /api/email-notifications/rules — list all rules (with defaults for missing ones)
router.get('/rules', async (_req: Request, res: Response) => {
  const dbRules = await prisma.emailNotificationRule.findMany();
  const dbMap = new Map(dbRules.map((r) => [r.type, r]));

  const rules = RULE_TYPES.map((rt) => {
    const dbRule = dbMap.get(rt.key);
    return {
      type: rt.key,
      label: rt.label,
      description: rt.description,
      thresholdUnit: rt.thresholdUnit,
      cronType: rt.cronType,
      enabled: dbRule?.enabled ?? true,
      smsEnabled: dbRule?.smsEnabled ?? false,
      recipients: dbRule?.recipients ?? [],
      threshold: dbRule?.threshold ?? rt.defaultThreshold,
    };
  });

  res.json(rules);
});

// PUT /api/email-notifications/rules/:type — update a rule
const updateRuleSchema = z.object({
  enabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  recipients: z.array(z.string().email()).optional(),
  threshold: z.number().int().min(0).optional(),
});

router.put('/rules/:type', async (req: Request, res: Response) => {
  const { type } = req.params;
  const validType = RULE_TYPES.find((rt) => rt.key === type);
  if (!validType) {
    res.status(400).json({ error: 'Type de règle invalide' });
    return;
  }

  const parsed = updateRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const rule = await prisma.emailNotificationRule.upsert({
    where: { type },
    create: {
      type,
      enabled: parsed.data.enabled ?? true,
      smsEnabled: parsed.data.smsEnabled ?? false,
      recipients: parsed.data.recipients ?? [],
      threshold: parsed.data.threshold ?? validType.defaultThreshold,
    },
    update: {
      ...(parsed.data.enabled !== undefined && { enabled: parsed.data.enabled }),
      ...(parsed.data.smsEnabled !== undefined && { smsEnabled: parsed.data.smsEnabled }),
      ...(parsed.data.recipients !== undefined && { recipients: parsed.data.recipients }),
      ...(parsed.data.threshold !== undefined && { threshold: parsed.data.threshold }),
    },
  });

  res.json({
    type: rule.type,
    label: validType.label,
    description: validType.description,
    thresholdUnit: validType.thresholdUnit,
    cronType: validType.cronType,
    enabled: rule.enabled,
    smsEnabled: rule.smsEnabled,
    recipients: rule.recipients,
    threshold: rule.threshold,
  });
});

// ── SMS Config endpoints ────────────────────────────────

// GET /api/email-notifications/sms-config
router.get('/sms-config', async (_req: Request, res: Response) => {
  let config = await prisma.smsConfig.findUnique({ where: { id: 'singleton' } });
  if (!config) {
    config = await prisma.smsConfig.create({ data: { id: 'singleton' } });
  }
  // Mask auth token
  res.json({
    accountSid: config.accountSid,
    authToken: config.authToken ? '••••••••' + config.authToken.slice(-4) : '',
    phoneNumber: config.phoneNumber,
    enabled: config.enabled,
    isConfigured: !!(config.accountSid && config.authToken && config.phoneNumber),
  });
});

// PUT /api/email-notifications/sms-config
const smsConfigSchema = z.object({
  accountSid: z.string().optional(),
  authToken: z.string().optional(),
  phoneNumber: z.string().optional(),
  enabled: z.boolean().optional(),
});

router.put('/sms-config', async (req: Request, res: Response) => {
  const parsed = smsConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides' });
    return;
  }

  const updateData: any = {};
  if (parsed.data.accountSid !== undefined) updateData.accountSid = parsed.data.accountSid;
  if (parsed.data.authToken !== undefined && !parsed.data.authToken.startsWith('••')) updateData.authToken = parsed.data.authToken;
  if (parsed.data.phoneNumber !== undefined) updateData.phoneNumber = parsed.data.phoneNumber;
  if (parsed.data.enabled !== undefined) updateData.enabled = parsed.data.enabled;

  const config = await prisma.smsConfig.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...updateData },
    update: updateData,
  });

  clearSmsConfigCache();

  res.json({
    accountSid: config.accountSid,
    authToken: config.authToken ? '••••••••' + config.authToken.slice(-4) : '',
    phoneNumber: config.phoneNumber,
    enabled: config.enabled,
    isConfigured: !!(config.accountSid && config.authToken && config.phoneNumber),
  });
});

// POST /api/email-notifications/test-sms — send a test SMS
router.post('/test-sms', async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== 'string') {
    res.status(400).json({ error: 'Numéro de téléphone requis' });
    return;
  }

  const sent = await sendSms(phone, '🐦 Bipbip — Test SMS\n\nSi vous recevez ce message, la configuration Twilio fonctionne !');
  if (sent) {
    res.json({ success: true, message: 'SMS de test envoyé' });
  } else {
    res.status(500).json({ error: 'Échec de l\'envoi. Vérifiez la configuration Twilio.' });
  }
});

// POST /api/email-notifications/test — send a test email
router.post('/test', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email requis' });
    return;
  }

  const html = `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:24px;">
  <h2>🐦 Bipbip — Test Email</h2>
  <p>Si vous recevez cet email, la configuration SMTP fonctionne correctement !</p>
  <p style="color:#64748b;font-size:12px;">Envoyé le ${new Date().toLocaleString('fr-FR')}</p>
</body></html>`;

  const sent = await sendEmail(email, '🐦 Test Bipbip — Email de notification', html);
  if (sent) {
    res.json({ success: true, message: 'Email de test envoyé' });
  } else {
    res.status(500).json({ error: 'Échec de l\'envoi. Vérifiez la configuration SMTP.' });
  }
});

// GET /api/email-notifications/logs — recent email logs
router.get('/logs', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const logs = await prisma.emailLog.findMany({
    orderBy: { sentAt: 'desc' },
    take: limit,
  });
  res.json(logs);
});

// DELETE /api/email-notifications/logs — clear old logs
router.delete('/logs', async (_req: Request, res: Response) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const result = await prisma.emailLog.deleteMany({
    where: { sentAt: { lt: thirtyDaysAgo } },
  });
  res.json({ deleted: result.count });
});

export default router;
