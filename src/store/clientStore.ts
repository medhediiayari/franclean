import { create } from 'zustand';
import { api } from '../lib/api';

interface Client {
  id: string;
  name: string;
  createdAt: string;
}

interface ClientStore {
  clients: Client[];
  loading: boolean;
  fetchClients: () => Promise<void>;
  addClient: (name: string) => Promise<Client>;
}

export const useClientStore = create<ClientStore>((set, get) => ({
  clients: [],
  loading: false,

  fetchClients: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const clients = await api.get<Client[]>('/clients');
      set({ clients });
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      set({ loading: false });
    }
  },

  addClient: async (name: string) => {
    const client = await api.post<Client>('/clients', { name });
    // Re-fetch to stay in sync
    const clients = await api.get<Client[]>('/clients');
    set({ clients });
    return client;
  },
}));
