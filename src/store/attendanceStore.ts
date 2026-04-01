import { create } from 'zustand';
import { api } from '../lib/api';
import type { Attendance, AttendanceStatus, AttendancePhoto } from '../types';

interface AttendanceState {
  records: Attendance[];
  fetchRecords: () => Promise<void>;
  addRecord: (record: Omit<Attendance, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Attendance>;
  updateRecord: (id: string, data: Partial<Attendance>) => Promise<void>;
  validateRecord: (id: string, status: AttendanceStatus, adminId: string, reason?: string, billedHours?: number) => Promise<void>;
  addWorkPhoto: (attendanceId: string, photoUrl: string, caption?: string) => Promise<AttendancePhoto>;
  deleteWorkPhoto: (attendanceId: string, photoId: string) => Promise<void>;
  getRecordsByAgent: (agentId: string) => Attendance[];
  getRecordsByDate: (date: string) => Attendance[];
  getTodayRecord: (agentId: string, eventId: string) => Attendance | undefined;
}

export const useAttendanceStore = create<AttendanceState>()((set, get) => ({
  records: [],

  fetchRecords: async () => {
    const records = await api.get<Attendance[]>('/attendance');
    set({ records });
  },

  addRecord: async (data) => {
    const record = await api.post<Attendance>('/attendance', data);
    set((state) => ({ records: [...state.records, record] }));
    return record;
  },

  updateRecord: async (id, data) => {
    const updated = await api.put<Attendance>(`/attendance/${id}`, data);
    set((state) => ({
      records: state.records.map((r) => (r.id === id ? updated : r)),
    }));
  },

  validateRecord: async (id, status, _adminId, reason, billedHours) => {
    const updated = await api.post<Attendance>(`/attendance/${id}/validate`, { status, refusalReason: reason, billedHours });
    set((state) => ({
      records: state.records.map((r) => (r.id === id ? updated : r)),
    }));
  },

  addWorkPhoto: async (attendanceId, photoUrl, caption) => {
    const photo = await api.post<AttendancePhoto>(`/attendance/${attendanceId}/photos`, { photoUrl, caption });
    set((state) => ({
      records: state.records.map((r) =>
        r.id === attendanceId ? { ...r, photos: [...(r.photos || []), photo] } : r,
      ),
    }));
    return photo;
  },

  deleteWorkPhoto: async (attendanceId, photoId) => {
    await api.delete(`/attendance/${attendanceId}/photos/${photoId}`);
    set((state) => ({
      records: state.records.map((r) =>
        r.id === attendanceId ? { ...r, photos: (r.photos || []).filter((p) => p.id !== photoId) } : r,
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
    const t = new Date();
    const today = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
    return get().records.find(
      (r) => r.agentId === agentId && r.eventId === eventId && r.date === today,
    );
  },
}));
