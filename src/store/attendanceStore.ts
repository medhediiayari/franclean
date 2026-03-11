import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Attendance, AttendanceStatus } from '../types';

interface AttendanceState {
  records: Attendance[];
  addRecord: (record: Attendance) => void;
  updateRecord: (id: string, data: Partial<Attendance>) => void;
  validateRecord: (id: string, status: AttendanceStatus, adminId: string, reason?: string) => void;
  getRecordsByAgent: (agentId: string) => Attendance[];
  getRecordsByDate: (date: string) => Attendance[];
  getTodayRecord: (agentId: string, eventId: string) => Attendance | undefined;
}

const now = new Date();
const today = now.toISOString().slice(0, 10);
const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10);
const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10);
const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000).toISOString().slice(0, 10);

// Placeholder photos (colored SVGs simulating real photos)
const photoIn = (color: string, label: string) =>
  `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="${color}" width="400" height="300" rx="8"/><text x="200" y="140" text-anchor="middle" fill="white" font-size="18" font-family="sans-serif">${label}</text><text x="200" y="170" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="12" font-family="sans-serif">Photo prise sur site</text></svg>`;

const defaultRecords: Attendance[] = [
  // ===== AGENT-1 (Ahmed) =====
  // Aujourd'hui evt-1 : photo entrée faite, PAS de sortie → tester photo de clôture
  {
    id: 'att-1',
    eventId: 'evt-1',
    agentId: 'agent-1',
    date: today,
    checkInTime: `${today}T08:05:00`,
    checkInPhotoUrl: photoIn('%234F46E5', '📸 Entrée Bureau Central'),
    checkInLatitude: 48.8739,
    checkInLongitude: 2.3371,
    checkInLocationValid: true,
    status: 'en_attente',
    isSuspect: false,
    suspectReasons: [],
    createdAt: `${today}T08:05:00Z`,
    updatedAt: `${today}T08:05:00Z`,
  },
  // Aujourd'hui evt-7 : aucune photo → tester entrée ET sortie
  // (pas de record = l'agent doit tout faire)

  // Hier evt-8 : mission complète avec photos entrée + sortie
  {
    id: 'att-6',
    eventId: 'evt-8',
    agentId: 'agent-1',
    date: yesterday,
    checkInTime: `${yesterday}T07:10:00`,
    checkInPhotoUrl: photoIn('%230EA5E9', '📸 Entrée Showroom Renault'),
    checkInLatitude: 48.8761,
    checkInLongitude: 2.2851,
    checkInLocationValid: true,
    checkOutTime: `${yesterday}T15:05:00`,
    checkOutPhotoUrl: photoIn('%23F97316', '📸 Sortie Showroom Renault'),
    checkOutLatitude: 48.8760,
    checkOutLongitude: 2.2849,
    checkOutLocationValid: true,
    hoursWorked: 7.92,
    status: 'valide',
    validatedBy: 'admin-1',
    validatedAt: `${yesterday}T16:00:00Z`,
    isSuspect: false,
    suspectReasons: [],
    createdAt: `${yesterday}T07:10:00Z`,
    updatedAt: `${yesterday}T16:00:00Z`,
  },
  // Il y a 3 jours evt-9 : mission complète, statut suspect (hors zone à la sortie)
  {
    id: 'att-7',
    eventId: 'evt-9',
    agentId: 'agent-1',
    date: threeDaysAgo,
    checkInTime: `${threeDaysAgo}T06:08:00`,
    checkInPhotoUrl: photoIn('%2310B981', '📸 Entrée Restaurant'),
    checkInLatitude: 48.8541,
    checkInLongitude: 2.3331,
    checkInLocationValid: true,
    checkOutTime: `${threeDaysAgo}T12:15:00`,
    checkOutPhotoUrl: photoIn('%23EF4444', '📸 Sortie Restaurant'),
    checkOutLatitude: 48.8700,
    checkOutLongitude: 2.3500,
    checkOutLocationValid: false,
    hoursWorked: 6.12,
    status: 'suspect',
    isSuspect: true,
    suspectReasons: ['Localisation hors zone à la sortie (1.8km)'],
    createdAt: `${threeDaysAgo}T06:08:00Z`,
    updatedAt: `${threeDaysAgo}T12:15:00Z`,
  },
  // Il y a 5 jours evt-10 : mission complète, validée
  {
    id: 'att-8',
    eventId: 'evt-10',
    agentId: 'agent-1',
    date: fiveDaysAgo,
    checkInTime: `${fiveDaysAgo}T08:02:00`,
    checkInPhotoUrl: photoIn('%238B5CF6', '📸 Entrée Appartement T3'),
    checkInLatitude: 48.8601,
    checkInLongitude: 2.3401,
    checkInLocationValid: true,
    checkOutTime: `${fiveDaysAgo}T15:55:00`,
    checkOutPhotoUrl: photoIn('%23EC4899', '📸 Sortie Appartement T3'),
    checkOutLatitude: 48.8600,
    checkOutLongitude: 2.3399,
    checkOutLocationValid: true,
    hoursWorked: 7.88,
    status: 'valide',
    validatedBy: 'admin-1',
    validatedAt: `${fiveDaysAgo}T17:00:00Z`,
    isSuspect: false,
    suspectReasons: [],
    createdAt: `${fiveDaysAgo}T08:02:00Z`,
    updatedAt: `${fiveDaysAgo}T17:00:00Z`,
  },

  // ===== AGENT-2 (Sara) =====
  // Aujourd'hui evt-2 : entrée + sortie complètes
  {
    id: 'att-2',
    eventId: 'evt-2',
    agentId: 'agent-2',
    date: today,
    checkInTime: `${today}T09:02:00`,
    checkInPhotoUrl: photoIn('%2310B981', '📸 Entrée Résidence Lilas'),
    checkInLatitude: 48.8797,
    checkInLongitude: 2.4190,
    checkInLocationValid: true,
    checkOutTime: `${today}T12:30:00`,
    checkOutPhotoUrl: photoIn('%23F59E0B', '📸 Sortie Résidence Lilas'),
    checkOutLatitude: 48.8798,
    checkOutLongitude: 2.4188,
    checkOutLocationValid: true,
    hoursWorked: 3.47,
    status: 'en_attente',
    isSuspect: false,
    suspectReasons: [],
    createdAt: `${today}T09:02:00Z`,
    updatedAt: `${today}T12:30:00Z`,
  },
  // Hier evt-5 : mission complète validée
  {
    id: 'att-3',
    eventId: 'evt-5',
    agentId: 'agent-2',
    date: yesterday,
    checkInTime: `${yesterday}T06:10:00`,
    checkInPhotoUrl: photoIn('%234F46E5', '📸 Entrée Clinique'),
    checkInLatitude: 48.8334,
    checkInLongitude: 2.3134,
    checkInLocationValid: true,
    checkOutTime: `${yesterday}T14:05:00`,
    checkOutPhotoUrl: photoIn('%2310B981', '📸 Sortie Clinique'),
    checkOutLatitude: 48.8335,
    checkOutLongitude: 2.3132,
    checkOutLocationValid: true,
    hoursWorked: 7.92,
    status: 'valide',
    validatedBy: 'admin-1',
    validatedAt: `${yesterday}T15:00:00Z`,
    isSuspect: false,
    suspectReasons: [],
    createdAt: `${yesterday}T06:10:00Z`,
    updatedAt: `${yesterday}T15:00:00Z`,
  },
  // Il y a 2 jours evt-13 : mission complète, validée
  {
    id: 'att-9',
    eventId: 'evt-13',
    agentId: 'agent-2',
    date: twoDaysAgo,
    checkInTime: `${twoDaysAgo}T07:35:00`,
    checkInPhotoUrl: photoIn('%230EA5E9', '📸 Entrée Hôtel Mercure'),
    checkInLatitude: 48.8534,
    checkInLongitude: 2.3682,
    checkInLocationValid: true,
    checkOutTime: `${twoDaysAgo}T13:02:00`,
    checkOutPhotoUrl: photoIn('%23F97316', '📸 Sortie Hôtel Mercure'),
    checkOutLatitude: 48.8533,
    checkOutLongitude: 2.3680,
    checkOutLocationValid: true,
    hoursWorked: 5.45,
    status: 'valide',
    validatedBy: 'admin-1',
    validatedAt: `${twoDaysAgo}T14:00:00Z`,
    isSuspect: false,
    suspectReasons: [],
    createdAt: `${twoDaysAgo}T07:35:00Z`,
    updatedAt: `${twoDaysAgo}T14:00:00Z`,
  },

  // ===== AGENT-3 (Karim) =====
  // Ancien suspect sur evt-1 (hier)
  {
    id: 'att-4',
    eventId: 'evt-1',
    agentId: 'agent-3',
    date: yesterday,
    checkInTime: `${yesterday}T08:00:00`,
    checkInPhotoUrl: photoIn('%23EF4444', '⚠️ Photo Suspecte Entrée'),
    checkInLatitude: 48.9000,
    checkInLongitude: 2.5000,
    checkInLocationValid: false,
    checkOutTime: `${yesterday}T17:00:00`,
    checkOutPhotoUrl: photoIn('%23EF4444', '⚠️ Photo Suspecte Sortie'),
    checkOutLatitude: 48.9001,
    checkOutLongitude: 2.5001,
    checkOutLocationValid: false,
    hoursWorked: 9.0,
    status: 'suspect',
    isSuspect: true,
    suspectReasons: ['Localisation hors zone (3.2km)', 'Durée supérieure au prévu'],
    createdAt: `${yesterday}T08:00:00Z`,
    updatedAt: `${yesterday}T17:00:00Z`,
  },
  {
    id: 'att-5',
    eventId: 'evt-5',
    agentId: 'agent-3',
    date: twoDaysAgo,
    checkInTime: `${twoDaysAgo}T07:00:00`,
    checkInPhotoUrl: photoIn('%234F46E5', '📸 Entrée Clinique'),
    checkInLatitude: 48.8334,
    checkInLongitude: 2.3134,
    checkInLocationValid: true,
    checkOutTime: `${twoDaysAgo}T15:00:00`,
    checkOutPhotoUrl: photoIn('%2310B981', '📸 Sortie Clinique'),
    checkOutLatitude: 48.8333,
    checkOutLongitude: 2.3133,
    checkOutLocationValid: true,
    hoursWorked: 8.0,
    status: 'valide',
    validatedBy: 'admin-1',
    validatedAt: `${twoDaysAgo}T16:00:00Z`,
    isSuspect: false,
    suspectReasons: [],
    createdAt: `${twoDaysAgo}T07:00:00Z`,
    updatedAt: `${twoDaysAgo}T16:00:00Z`,
  },
];

export const useAttendanceStore = create<AttendanceState>()(
  persist(
    (set, get) => ({
      records: defaultRecords,

      addRecord: (record) => {
        set((state) => ({ records: [...state.records, record] }));
      },

      updateRecord: (id, data) => {
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r,
          ),
        }));
      },

      validateRecord: (id, status, adminId, reason) => {
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status,
                  validatedBy: adminId,
                  validatedAt: new Date().toISOString(),
                  refusalReason: reason,
                  updatedAt: new Date().toISOString(),
                }
              : r,
          ),
        }));
      },

      getRecordsByAgent: (agentId) => {
        return get().records.filter((r) => r.agentId === agentId);
      },

      getRecordsByDate: (date) => {
        return get().records.filter((r) => r.date === date);
      },

      getTodayRecord: (agentId, eventId) => {
        const today = new Date().toISOString().slice(0, 10);
        return get().records.find(
          (r) => r.agentId === agentId && r.eventId === eventId && r.date === today,
        );
      },
    }),
    { name: 'franclean-attendance' },
  ),
);
