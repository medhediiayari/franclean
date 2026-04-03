import { create } from 'zustand';
import type { PlanningEvent, Attendance, User, Notification } from '../types';

export type NotificationType =
  | 'suspect'        // Pointage suspect
  | 'reassign'       // Événement à réattribuer
  | 'overtime'       // Agent a dépassé les heures planifiées
  | 'early_leave'    // Agent est parti trop tôt
  | 'no_checkout'    // Pointage sans check-out
  | 'accepted'       // Agent a accepté un événement
  | 'refused'        // Agent a refusé un événement
  | 'pending'        // Pointage en attente de validation
  | 'unassigned';    // Créneaux sans agent affecté

export interface AdminNotification {
  id: string;
  type: NotificationType;
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  link: string;
  timestamp: string;
  isRead: boolean;
  entityId?: string; // eventId, attendanceId, etc.
}

interface NotificationState {
  notifications: AdminNotification[];
  readIds: Set<string>;
  generateNotifications: (events: PlanningEvent[], records: Attendance[], users: User[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  unreadCount: () => number;
}

function getAgentName(users: User[], id: string): string {
  const u = users.find((u) => u.id === id);
  return u ? `${u.firstName} ${u.lastName}` : 'Agent inconnu';
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseHHmm(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
}

const STORAGE_KEY = 'bipbip_read_notification_ids';

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set<string>();
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {}
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  readIds: loadReadIds(),

  generateNotifications: (events, records, users) => {
    const notifs: AdminNotification[] = [];
    const now = new Date();
    const today = localDateStr(now);
    const { readIds } = get();

    // ── 1. Pointages suspects ──────────────────────────────
    records
      .filter((r) => r.isSuspect || r.status === 'suspect')
      .forEach((r) => {
        const agentName = getAgentName(users, r.agentId);
        const event = events.find((e) => e.id === r.eventId);
        const reasons = r.suspectReasons?.length > 0
          ? r.suspectReasons.join(', ')
          : 'Anomalie détectée';
        notifs.push({
          id: `suspect-${r.id}`,
          type: 'suspect',
          severity: 'error',
          title: 'Pointage suspect',
          message: `${agentName} — ${event?.title || 'Événement'} (${r.date}). ${reasons}`,
          link: '/admin/pointage',
          timestamp: r.updatedAt || r.createdAt,
          isRead: readIds.has(`suspect-${r.id}`),
          entityId: r.id,
        });
      });

    // ── 2. Événements à réattribuer ────────────────────────
    events
      .filter((e) => e.status === 'a_reattribuer')
      .forEach((e) => {
        notifs.push({
          id: `reassign-${e.id}`,
          type: 'reassign',
          severity: 'error',
          title: 'Événement à réattribuer',
          message: `"${e.title}" (${e.client || 'Sans client'}) nécessite une réattribution`,
          link: '/admin/gestion',
          timestamp: e.updatedAt,
          isRead: readIds.has(`reassign-${e.id}`),
          entityId: e.id,
        });
      });

    // ── 3. Décalage horaire : dépassement ou sortie anticipée ──
    for (const r of records) {
      if (!r.checkInTime || r.status === 'refuse') continue;

      const event = events.find((e) => e.id === r.eventId);
      if (!event) continue;

      // Find the matching shift for this record
      const shift = event.shifts.find(
        (s) =>
          s.date === r.date &&
          (s.agentId === r.agentId || (!s.agentId && event.assignedAgentIds.includes(r.agentId))),
      );
      if (!shift || shift.startTime === '—' || !shift.startTime || !shift.endTime) continue;

      const plannedHours = parseHHmm(shift.endTime) - parseHHmm(shift.startTime);
      if (plannedHours <= 0) continue;

      const agentName = getAgentName(users, r.agentId);

      // 3a. Agent a dépassé les heures planifiées (> 1.5h de plus)
      if (r.hoursWorked && r.hoursWorked > plannedHours + 1.5) {
        const excess = Math.round((r.hoursWorked - plannedHours) * 60);
        notifs.push({
          id: `overtime-${r.id}`,
          type: 'overtime',
          severity: 'warning',
          title: 'Dépassement horaire',
          message: `${agentName} a travaillé ${excess}min de plus que prévu sur "${event.title}" le ${r.date}`,
          link: '/admin/pointage',
          timestamp: r.updatedAt || r.createdAt,
          isRead: readIds.has(`overtime-${r.id}`),
          entityId: r.id,
        });
      }

      // 3b. Agent est parti trop tôt (> 1h avant la fin prévue)
      if (r.checkOutTime && r.hoursWorked && r.hoursWorked < plannedHours - 1) {
        const deficit = Math.round((plannedHours - r.hoursWorked) * 60);
        notifs.push({
          id: `early-${r.id}`,
          type: 'early_leave',
          severity: 'warning',
          title: 'Sortie anticipée',
          message: `${agentName} est parti ${deficit}min plus tôt que prévu sur "${event.title}" le ${r.date}`,
          link: '/admin/pointage',
          timestamp: r.updatedAt || r.createdAt,
          isRead: readIds.has(`early-${r.id}`),
          entityId: r.id,
        });
      }
    }

    // ── 4. Pointage sans check-out (check-in depuis > 14h) ──
    records
      .filter((r) => r.checkInTime && !r.checkOutTime && r.date <= today)
      .forEach((r) => {
        const checkIn = new Date(r.checkInTime!);
        const diffH = (now.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
        if (diffH > 14) {
          const agentName = getAgentName(users, r.agentId);
          const event = events.find((e) => e.id === r.eventId);
          notifs.push({
            id: `nocheckout-${r.id}`,
            type: 'no_checkout',
            severity: 'warning',
            title: 'Check-out manquant',
            message: `${agentName} n'a pas fait de check-out sur "${event?.title || 'Événement'}" le ${r.date}`,
            link: '/admin/pointage',
            timestamp: r.checkInTime!,
            isRead: readIds.has(`nocheckout-${r.id}`),
            entityId: r.id,
          });
        }
      });

    // ── 5. Agent a accepté / refusé un événement ──────────
    for (const e of events) {
      if (!e.agentResponses) continue;
      for (const [agentId, response] of Object.entries(e.agentResponses)) {
        const agentName = getAgentName(users, agentId);
        if (response === 'accepted') {
          notifs.push({
            id: `accepted-${e.id}-${agentId}`,
            type: 'accepted',
            severity: 'info',
            title: 'Mission acceptée',
            message: `${agentName} a accepté la mission "${e.title}"`,
            link: '/admin/gestion',
            timestamp: e.updatedAt,
            isRead: readIds.has(`accepted-${e.id}-${agentId}`),
            entityId: e.id,
          });
        } else if (response === 'refused') {
          notifs.push({
            id: `refused-${e.id}-${agentId}`,
            type: 'refused',
            severity: 'warning',
            title: 'Mission refusée',
            message: `${agentName} a refusé la mission "${e.title}"`,
            link: '/admin/gestion',
            timestamp: e.updatedAt,
            isRead: readIds.has(`refused-${e.id}-${agentId}`),
            entityId: e.id,
          });
        }
      }
    }

    // ── 6. Pointages en attente de validation ─────────────
    const pendingRecords = records.filter((r) => r.status === 'en_attente');
    if (pendingRecords.length > 0) {
      notifs.push({
        id: `pending-batch-${pendingRecords.length}`,
        type: 'pending',
        severity: 'info',
        title: 'Pointages en attente',
        message: `${pendingRecords.length} pointage(s) en attente de validation`,
        link: '/admin/pointage',
        timestamp: pendingRecords[0].updatedAt || pendingRecords[0].createdAt,
        isRead: readIds.has(`pending-batch-${pendingRecords.length}`),
      });
    }

    // ── 7. Créneaux non affectés sur événements actifs ────
    const activeEvents = events.filter((e) => e.status === 'planifie' || e.status === 'en_cours');
    const unassignedCount = activeEvents.reduce(
      (sum, e) => sum + (e.shifts || []).filter((s) => !s.agentId).length,
      0,
    );
    if (unassignedCount > 0) {
      notifs.push({
        id: `unassigned-${unassignedCount}`,
        type: 'unassigned',
        severity: 'info',
        title: 'Créneaux non affectés',
        message: `${unassignedCount} créneau(x) sans agent affecté sur les événements actifs`,
        link: '/admin/gestion',
        timestamp: new Date().toISOString(),
        isRead: readIds.has(`unassigned-${unassignedCount}`),
      });
    }

    // Sort by timestamp desc
    notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    set({ notifications: notifs });
  },

  markAsRead: (id) => {
    set((state) => {
      const newReadIds = new Set(state.readIds);
      newReadIds.add(id);
      saveReadIds(newReadIds);
      return {
        readIds: newReadIds,
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n,
        ),
      };
    });
  },

  markAllAsRead: () => {
    set((state) => {
      const newReadIds = new Set(state.readIds);
      state.notifications.forEach((n) => newReadIds.add(n.id));
      saveReadIds(newReadIds);
      return {
        readIds: newReadIds,
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      };
    });
  },

  unreadCount: () => {
    return get().notifications.filter((n) => !n.isRead).length;
  },
}));
