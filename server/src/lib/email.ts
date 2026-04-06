import nodemailer from 'nodemailer';
import path from 'path';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify connection on startup
transporter.verify().then(() => {
  console.log('📧 SMTP connection verified');
}).catch((err) => {
  console.error('📧 SMTP connection failed:', err.message);
});

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@bipbip.fr';

// Resolve logo path — works in dev (server/) and in Docker (/app with public-assets volume)
import fs from 'fs';
const LOGO_FILENAME = 'logobipbip new.png';
const LOGO_CANDIDATES = [
  path.resolve(process.cwd(), '..', 'public', LOGO_FILENAME),       // dev: server/../public/
  path.resolve(process.cwd(), 'public-assets', LOGO_FILENAME),      // docker: /app/public-assets/
  path.resolve(process.cwd(), 'public', LOGO_FILENAME),             // fallback
];
const LOGO_PATH = LOGO_CANDIDATES.find(p => fs.existsSync(p)) || LOGO_CANDIDATES[0];

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html,
      attachments: [{
        filename: 'logo.png',
        path: LOGO_PATH,
        cid: 'bipbip-logo',
      }],
    });
    console.log(`📧 Email sent to ${to}: ${subject}`);
    return true;
  } catch (err: any) {
    console.error(`📧 Failed to send email to ${to}:`, err.message);
    return false;
  }
}

// ── Email templates ─────────────────────────────────────

function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
<tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
    <!-- Header -->
    <tr><td style="background:#ffffff;padding:20px 32px;border-bottom:2px solid #e2e8f0;" align="center">
      <img src="cid:bipbip-logo" alt="Bipbip" width="180" style="display:block;max-width:180px;height:auto;" />
    </td></tr>
    <!-- Title -->
    <tr><td style="padding:24px 32px 8px;">
      <h2 style="margin:0;color:#1e293b;font-size:18px;">${title}</h2>
    </td></tr>
    <!-- Body -->
    <tr><td style="padding:8px 32px 24px;color:#475569;font-size:14px;line-height:1.6;">
      ${body}
    </td></tr>
    <!-- Footer -->
    <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
      <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
        Cet email a été envoyé automatiquement par Bipbip • Ne pas répondre
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

export interface ShiftInfo {
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
}

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function emailAgentAssigned(agentName: string, eventTitle: string, client: string, dates: string, address: string, shifts?: ShiftInfo[]): string {
  // Build shifts table grouped by date
  let shiftsHtml = '';
  if (shifts && shifts.length > 0) {
    const byDate = new Map<string, ShiftInfo[]>();
    for (const s of shifts) {
      const arr = byDate.get(s.date) || [];
      arr.push(s);
      byDate.set(s.date, arr);
    }
    const sortedDates = [...byDate.keys()].sort();

    let shiftRows = '';
    for (const date of sortedDates) {
      const dayShifts = byDate.get(date)!;
      const dateFr = formatDateFr(date);
      for (let i = 0; i < dayShifts.length; i++) {
        const s = dayShifts[i];
        shiftRows += `<tr>
          ${i === 0 ? `<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#1e293b;vertical-align:top;" rowspan="${dayShifts.length}">${dateFr}</td>` : ''}
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#059669;font-weight:600;">${s.startTime}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#dc2626;font-weight:600;">${s.endTime}</td>
        </tr>`;
      }
    }

    shiftsHtml = `
    <p style="margin:16px 0 8px;font-weight:600;color:#1e293b;">📅 Créneaux par jour :</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;">Jour</th>
        <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;">Entrée</th>
        <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;">Sortie</th>
      </tr></thead>
      <tbody>${shiftRows}</tbody>
    </table>`;
  }

  return baseTemplate('🎯 Nouvelle mission assignée', `
    <p>Bonjour <strong>${agentName}</strong>,</p>
    <p>Vous avez été assigné(e) à une nouvelle mission :</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 12px;background:#f1f5f9;border-radius:6px 0 0 0;font-weight:600;color:#64748b;width:120px;">Mission</td>
          <td style="padding:8px 12px;background:#f1f5f9;border-radius:0 6px 0 0;">${eventTitle}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;color:#64748b;">Client</td>
          <td style="padding:8px 12px;">${client || '—'}</td></tr>
      <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#64748b;">Dates</td>
          <td style="padding:8px 12px;background:#f1f5f9;">${dates}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;color:#64748b;border-radius:0 0 0 6px;">Adresse</td>
          <td style="padding:8px 12px;border-radius:0 0 6px 0;">${address || '—'}</td></tr>
    </table>
    ${shiftsHtml}
    <p>Veuillez vous connecter à l'application pour confirmer ou consulter les détails.</p>
  `);
}

export function emailMissionReminder(agentName: string, eventTitle: string, client: string, date: string, shifts: string, address: string): string {
  return baseTemplate('⏰ Rappel de mission — demain', `
    <p>Bonjour <strong>${agentName}</strong>,</p>
    <p>Rappel : vous avez une mission programmée <strong>demain</strong> :</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#64748b;width:120px;">Mission</td>
          <td style="padding:8px 12px;background:#f1f5f9;">${eventTitle}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;color:#64748b;">Client</td>
          <td style="padding:8px 12px;">${client || '—'}</td></tr>
      <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#64748b;">Date</td>
          <td style="padding:8px 12px;background:#f1f5f9;">${date}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;color:#64748b;">Créneaux</td>
          <td style="padding:8px 12px;">${shifts}</td></tr>
      <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#64748b;">Adresse</td>
          <td style="padding:8px 12px;background:#f1f5f9;">${address || '—'}</td></tr>
    </table>
    <p>Bonne préparation !</p>
  `);
}

export function emailUnassignedAlert(events: { title: string; client: string; startDate: string; daysLeft: number }[]): string {
  const rows = events.map(e =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${e.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${e.client || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${e.startDate}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#ef4444;font-weight:600;">J-${e.daysLeft}</td>
    </tr>`
  ).join('');
  return baseTemplate('⚠️ Missions sans agent assigné', `
    <p>Les missions suivantes n'ont <strong>toujours pas d'agent assigné</strong> et approchent de leur date de début :</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:8px 12px;text-align:left;color:#64748b;">Mission</th>
        <th style="padding:8px 12px;text-align:left;color:#64748b;">Client</th>
        <th style="padding:8px 12px;text-align:left;color:#64748b;">Date début</th>
        <th style="padding:8px 12px;text-align:left;color:#64748b;">Délai</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p>Veuillez assigner des agents au plus vite.</p>
  `);
}

export function emailNoCheckinAlert(items: { agentName: string; eventTitle: string; shiftTime: string; minutesLate: number }[]): string {
  const rows = items.map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${i.agentName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${i.eventTitle}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${i.shiftTime}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#ef4444;font-weight:600;">+${i.minutesLate} min</td>
    </tr>`
  ).join('');
  return baseTemplate('🚨 Pointage d\'entrée manquant', `
    <p>Les agents suivants n'ont <strong>pas pointé leur entrée</strong> alors que leur créneau a déjà commencé :</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:8px 12px;text-align:left;color:#64748b;">Agent</th>
        <th style="padding:8px 12px;text-align:left;color:#64748b;">Mission</th>
        <th style="padding:8px 12px;text-align:left;color:#64748b;">Créneau</th>
        <th style="padding:8px 12px;text-align:left;color:#64748b;">Retard</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p>Veuillez vérifier la situation de ces agents.</p>
  `);
}

export function emailSuspectAttendance(agentName: string, eventTitle: string, date: string, reasons: string[]): string {
  return baseTemplate('🔴 Pointage suspect détecté', `
    <p>Un pointage suspect a été détecté :</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#64748b;width:120px;">Agent</td>
          <td style="padding:8px 12px;background:#f1f5f9;">${agentName}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;color:#64748b;">Mission</td>
          <td style="padding:8px 12px;">${eventTitle}</td></tr>
      <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#64748b;">Date</td>
          <td style="padding:8px 12px;background:#f1f5f9;">${date}</td></tr>
    </table>
    <p><strong>Raisons :</strong></p>
    <ul style="margin:8px 0;">${reasons.map(r => `<li style="color:#ef4444;">${r}</li>`).join('')}</ul>
    <p>Veuillez examiner ce pointage dans l'application.</p>
  `);
}

export function emailEventRefused(agentName: string, eventTitle: string, client: string): string {
  return baseTemplate('❌ Mission refusée par un agent', `
    <p>L'agent <strong>${agentName}</strong> a <span style="color:#ef4444;font-weight:600;">refusé</span> la mission suivante :</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#64748b;width:120px;">Mission</td>
          <td style="padding:8px 12px;background:#f1f5f9;">${eventTitle}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;color:#64748b;">Client</td>
          <td style="padding:8px 12px;">${client || '—'}</td></tr>
    </table>
    <p>La mission nécessite une réaffectation.</p>
  `);
}

export function emailNoCheckoutAlert(items: { agentName: string; eventTitle: string; checkInTime: string }[]): string {
  const rows = items.map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${i.agentName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${i.eventTitle}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${i.checkInTime}</td>
    </tr>`
  ).join('');
  return baseTemplate('⚠️ Check-out manquant', `
    <p>Les agents suivants ont pointé leur entrée mais <strong>n'ont pas encore fait de check-out</strong> :</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:8px 12px;text-align:left;color:#64748b;">Agent</th>
        <th style="padding:8px 12px;text-align:left;color:#64748b;">Mission</th>
        <th style="padding:8px 12px;text-align:left;color:#64748b;">Heure entrée</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `);
}

export function emailLateCheckin(agentName: string, eventTitle: string, expectedTime: string, actualTime: string, lateMinutes: number): string {
  return baseTemplate('⏰ Agent en retard', `
    <p>L'agent <strong>${agentName}</strong> a pointé son entrée en <span style="color:#ef4444;font-weight:600;">retard de ${lateMinutes} minutes</span> :</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#64748b;width:140px;">Mission</td>
          <td style="padding:8px 12px;background:#f1f5f9;">${eventTitle}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;color:#64748b;">Heure prévue</td>
          <td style="padding:8px 12px;">${expectedTime}</td></tr>
      <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#64748b;">Heure réelle</td>
          <td style="padding:8px 12px;background:#f1f5f9;color:#ef4444;font-weight:600;">${actualTime}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;color:#64748b;">Retard</td>
          <td style="padding:8px 12px;color:#ef4444;font-weight:600;">+${lateMinutes} min</td></tr>
    </table>
  `);
}

export function emailEarlyCheckout(agentName: string, eventTitle: string, expectedTime: string, actualTime: string, earlyMinutes: number): string {
  return baseTemplate('⚡ Sortie anticipée', `
    <p>L'agent <strong>${agentName}</strong> a pointé sa sortie <span style="color:#f59e0b;font-weight:600;">${earlyMinutes} minutes avant</span> la fin prévue :</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#64748b;width:140px;">Mission</td>
          <td style="padding:8px 12px;background:#f1f5f9;">${eventTitle}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;color:#64748b;">Fin prévue</td>
          <td style="padding:8px 12px;">${expectedTime}</td></tr>
      <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#64748b;">Sortie réelle</td>
          <td style="padding:8px 12px;background:#f1f5f9;color:#f59e0b;font-weight:600;">${actualTime}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;color:#64748b;">Avance</td>
          <td style="padding:8px 12px;color:#f59e0b;font-weight:600;">-${earlyMinutes} min</td></tr>
    </table>
  `);
}

export function emailMissionCancelled(agentName: string, eventTitle: string, client: string, address: string): string {
  return baseTemplate('🚫 Mission annulée', `
    <p>Bonjour <strong>${agentName}</strong>,</p>
    <p>La mission suivante a été <span style="color:#ef4444;font-weight:600;">annulée</span> :</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#64748b;width:120px;">Mission</td>
          <td style="padding:8px 12px;background:#f1f5f9;">${eventTitle}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;color:#64748b;">Client</td>
          <td style="padding:8px 12px;">${client || '—'}</td></tr>
      <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#64748b;">Adresse</td>
          <td style="padding:8px 12px;background:#f1f5f9;">${address || '—'}</td></tr>
    </table>
    <p>Vous n'avez plus besoin de vous présenter pour cette mission.</p>
  `);
}

export function emailWeeklyAgentSummary(agents: { name: string; totalHours: number; missionCount: number; dayCount: number }[], weekStart: string, weekEnd: string): string {
  const totalHours = agents.reduce((s, a) => s + a.totalHours, 0);
  const rows = agents.map(a =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:500;">${a.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;color:#059669;">${a.totalHours}h</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${a.missionCount}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${a.dayCount}j</td>
    </tr>`
  ).join('');
  return baseTemplate('📊 Récap hebdomadaire des heures', `
    <p>Voici le récapitulatif des heures de la semaine du <strong>${weekStart}</strong> au <strong>${weekEnd}</strong> :</p>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px 16px;margin:16px 0;text-align:center;">
      <span style="font-size:24px;font-weight:700;color:#059669;">${Math.round(totalHours * 100) / 100}h</span>
      <span style="display:block;font-size:12px;color:#64748b;margin-top:4px;">Total heures — ${agents.length} agent(s)</span>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:8px 12px;text-align:left;color:#64748b;">Agent</th>
        <th style="padding:8px 12px;text-align:center;color:#64748b;">Heures</th>
        <th style="padding:8px 12px;text-align:center;color:#64748b;">Missions</th>
        <th style="padding:8px 12px;text-align:center;color:#64748b;">Jours</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `);
}

export function emailMonthlyClientReport(clients: { client: string; totalHours: number; missionCount: number; agentCount: number }[], monthName: string): string {
  const totalHours = clients.reduce((s, c) => s + c.totalHours, 0);
  const rows = clients.map(c =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:500;">${c.client}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;color:#6366f1;">${c.totalHours}h</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${c.missionCount}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${c.agentCount}</td>
    </tr>`
  ).join('');
  return baseTemplate(`📋 Récap mensuel par client — ${monthName}`, `
    <p>Voici le récapitulatif des heures par client pour <strong>${monthName}</strong> :</p>
    <div style="background:#eef2ff;border:1px solid #a5b4fc;border-radius:8px;padding:12px 16px;margin:16px 0;text-align:center;">
      <span style="font-size:24px;font-weight:700;color:#6366f1;">${Math.round(totalHours * 100) / 100}h</span>
      <span style="display:block;font-size:12px;color:#64748b;margin-top:4px;">Total heures — ${clients.length} client(s)</span>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:8px 12px;text-align:left;color:#64748b;">Client</th>
        <th style="padding:8px 12px;text-align:center;color:#64748b;">Heures</th>
        <th style="padding:8px 12px;text-align:center;color:#64748b;">Missions</th>
        <th style="padding:8px 12px;text-align:center;color:#64748b;">Agents</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#64748b;font-size:12px;">Ce récapitulatif peut servir de base pour la facturation.</p>
  `);
}
