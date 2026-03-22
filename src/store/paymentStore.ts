import { create } from 'zustand';
import { api } from '../lib/api';

export interface AgentPaymentEntry {
  id: string;
  agentId: string;
  type: 'virement' | 'acompte';
  amount: number;
  date: string;       // YYYY-MM-DD
  periodStart: string;
  periodEnd: string;
  note?: string;
  createdAt: string;
}

interface PaymentStore {
  payments: AgentPaymentEntry[];
  loading: boolean;

  // Fetch all payments (optionally filtered by period)
  fetchPayments: (periodStart?: string, periodEnd?: string) => Promise<void>;

  // Fetch all payments for a specific agent
  fetchAgentPayments: (agentId: string) => Promise<AgentPaymentEntry[]>;

  // Add a payment
  addPayment: (data: {
    agentId: string;
    type: 'virement' | 'acompte';
    amount: number;
    date: string;
    periodStart: string;
    periodEnd: string;
    note?: string;
  }) => Promise<AgentPaymentEntry>;

  // Delete a payment
  deletePayment: (id: string) => Promise<void>;
}

export const usePaymentStore = create<PaymentStore>((set, get) => ({
  payments: [],
  loading: false,

  fetchPayments: async (periodStart?: string, periodEnd?: string) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (periodStart) params.set('periodStart', periodStart);
      if (periodEnd) params.set('periodEnd', periodEnd);
      const qs = params.toString();
      const data = await api.get<AgentPaymentEntry[]>(`/payments${qs ? `?${qs}` : ''}`);
      set({ payments: data });
    } catch (err) {
      console.error('Failed to fetch payments', err);
    } finally {
      set({ loading: false });
    }
  },

  fetchAgentPayments: async (agentId: string) => {
    try {
      const data = await api.get<AgentPaymentEntry[]>(`/payments/agent/${agentId}`);
      return data;
    } catch (err) {
      console.error('Failed to fetch agent payments', err);
      return [];
    }
  },

  addPayment: async (data) => {
    const payment = await api.post<AgentPaymentEntry>('/payments', data);
    set((state) => ({ payments: [payment, ...state.payments] }));
    return payment;
  },

  deletePayment: async (id: string) => {
    await api.delete(`/payments/${id}`);
    set((state) => ({ payments: state.payments.filter((p) => p.id !== id) }));
  },
}));
