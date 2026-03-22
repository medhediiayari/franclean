// ── Rôles ───────────────────────────────────────────────
export type Role = 'admin' | 'agent';

// ── Utilisateur ─────────────────────────────────────────
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: Role;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
}

// ── Événement Planning ──────────────────────────────────
export type EventStatus = 'planifie' | 'en_cours' | 'termine' | 'a_reattribuer' | 'annule';

export interface EventShift {
  id: string;
  agentId?: string | null;
  date: string;        // YYYY-MM-DD
  startTime: string;   // HH:mm
  endTime: string;     // HH:mm
}

export interface PlanningEvent {
  id: string;
  title: string;
  description: string;
  client?: string;
  color: string;
  startDate: string;   // YYYY-MM-DD (date début de l'événement)
  endDate: string;     // YYYY-MM-DD (date fin de l'événement)
  shifts: EventShift[];
  address: string;
  latitude?: number;
  longitude?: number;
  geoRadius?: number;
  hourlyRate?: number;
  assignedAgentIds: string[];
  status: EventStatus;
  agentResponses?: Record<string, 'accepted' | 'refused' | 'pending'>;
  history: EventHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface EventHistoryEntry {
  action: string;
  userId: string;
  timestamp: string;
  details?: string;
}

// ── Pointage ────────────────────────────────────────────
export type AttendanceStatus = 'en_attente' | 'valide' | 'refuse' | 'suspect';

export interface Attendance {
  id: string;
  eventId: string;
  shiftId?: string;
  agentId: string;
  date: string;

  // Check-in
  checkInTime?: string;
  checkInPhotoUrl?: string;
  checkInLatitude?: number;
  checkInLongitude?: number;
  checkInLocationValid?: boolean;

  // Check-out
  checkOutTime?: string;
  checkOutPhotoUrl?: string;
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  checkOutLocationValid?: boolean;

  // Calculated
  hoursWorked?: number;

  // Validation
  status: AttendanceStatus;
  validatedBy?: string;
  validatedAt?: string;
  refusalReason?: string;

  // Flags
  isSuspect: boolean;
  suspectReasons: string[];

  createdAt: string;
  updatedAt: string;
}

// ── Notification ────────────────────────────────────────
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

// ── Heures récapitulatives ──────────────────────────────
export interface HoursSummary {
  agentId: string;
  agentName: string;
  client: string;
  period: string;
  hoursPointed: number;
  hoursValidated: number;
  hoursBilled: number;
  validationStatus: 'complete' | 'partielle' | 'en_attente';
  gap: number; // difference pointed - billed
}
