import { create } from 'zustand';
import { api } from '../lib/api';
import type { Attendance, AttendanceStatus } from '../types';

interface AttendanceState {
  records: Attendance[];
  fetchRecords: () => Promise<void>;
  addRecord: (record: Omit<Attendance, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Attendance>;
  updateRecord: (id: string, data: Partial<Attendance>) => Promise<void>;
  validateRecord: (id: string, status: AttendanceStatus, adminId: string, reason?: string) => Promise<void>;
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

  validateRecord: async (id, status, _adminId, reason) => {
    const updated = await api.post<Attendance>(`/attendance/${id}/validate`, { status, reason });
    set((state) => ({
      records: state.records.map((r) => (r.id === id ? updated : r)),
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
}));
