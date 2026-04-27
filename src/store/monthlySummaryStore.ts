import { create } from 'zustand';
import { api } from '../lib/api';

export interface MonthlyHoursSummary {
  id: string;
  agentId: string;
  year: number;
  month: number;
  totalHours: number;
  validatedHours: number;
  confirmedByAgent: boolean;
  confirmedAt: string | null;
  agentNote: string | null;
  updatedAt: string;
  // included when fetching as admin
  agent?: { id: string; firstName: string; lastName: string };
}

interface MonthlySummaryState {
  // Agent
  summaries: MonthlyHoursSummary[];
  fetchMySummaries: () => Promise<void>;
  confirmMonth: (year: number, month: number, note?: string) => Promise<void>;
  // Admin
  adminSummaries: MonthlyHoursSummary[];
  fetchAdminSummaries: (year: number, month: number) => Promise<void>;
  allSummaries: MonthlyHoursSummary[];
  fetchAllSummaries: () => Promise<void>;
}

export const useMonthlySummaryStore = create<MonthlySummaryState>()((set) => ({
  summaries: [],
  adminSummaries: [],
  allSummaries: [],

  fetchMySummaries: async () => {
    const data = await api.get<MonthlyHoursSummary[]>('/monthly-summary/mine');
    set({ summaries: data });
  },

  confirmMonth: async (year, month, note) => {
    const updated = await api.post<MonthlyHoursSummary>('/monthly-summary/confirm', { year, month, note });
    set((state) => ({
      summaries: state.summaries.map((s) =>
        s.year === year && s.month === month ? updated : s
      ),
    }));
  },

  fetchAdminSummaries: async (year, month) => {
    const data = await api.get<MonthlyHoursSummary[]>(`/monthly-summary/admin?year=${year}&month=${month}`);
    set({ adminSummaries: data });
  },

  fetchAllSummaries: async () => {
    const data = await api.get<MonthlyHoursSummary[]>('/monthly-summary/admin/all');
    set({ allSummaries: data });
  },
}));
