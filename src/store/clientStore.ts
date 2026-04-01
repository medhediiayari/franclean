import { create } from 'zustand';
import { api } from '../lib/api';
import type { ClientData, ClientSite } from '../types';

interface ClientStore {
  clients: ClientData[];
  loading: boolean;
  fetchClients: () => Promise<void>;
  addClient: (data: { name: string; email?: string; phone?: string; address?: string; notes?: string; siret?: string; siren?: string; formeJuridique?: string; tvaNumber?: string; representantLegal?: string; representantRole?: string; codeApe?: string; capitalSocial?: string; rcs?: string }) => Promise<ClientData>;
  updateClient: (id: string, data: Partial<{ name: string; email: string | null; phone: string | null; address: string | null; notes: string | null; siret: string | null; siren: string | null; formeJuridique: string | null; tvaNumber: string | null; representantLegal: string | null; representantRole: string | null; codeApe: string | null; capitalSocial: string | null; rcs: string | null }>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addSite: (clientId: string, data: { name: string; address?: string; latitude?: number | null; longitude?: number | null; geoRadius?: number; hourlyRate?: number | null; notes?: string }) => Promise<ClientSite>;
  updateSite: (clientId: string, siteId: string, data: Partial<{ name: string; address: string; latitude: number | null; longitude: number | null; geoRadius: number; hourlyRate: number | null; notes: string | null }>) => Promise<void>;
  deleteSite: (clientId: string, siteId: string) => Promise<void>;
  createClientAccount: (clientId: string) => Promise<{ email: string; password: string }>;
  deleteClientAccount: (clientId: string) => Promise<void>;
}

export const useClientStore = create<ClientStore>((set, get) => ({
  clients: [],
  loading: false,

  fetchClients: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const clients = await api.get<ClientData[]>('/clients');
      set({ clients });
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      set({ loading: false });
    }
  },

  addClient: async (data) => {
    const client = await api.post<ClientData>('/clients', data);
    set((s) => ({ clients: [...s.clients, client].sort((a, b) => a.name.localeCompare(b.name)) }));
    return client;
  },

  updateClient: async (id, data) => {
    const updated = await api.put<ClientData>(`/clients/${id}`, data);
    set((s) => ({ clients: s.clients.map((c) => (c.id === id ? updated : c)) }));
  },

  deleteClient: async (id) => {
    await api.delete(`/clients/${id}`);
    set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }));
  },

  addSite: async (clientId, data) => {
    const site = await api.post<ClientSite>(`/clients/${clientId}/sites`, data);
    set((s) => ({
      clients: s.clients.map((c) =>
        c.id === clientId ? { ...c, sites: [...c.sites, site].sort((a, b) => a.name.localeCompare(b.name)) } : c
      ),
    }));
    return site;
  },

  updateSite: async (clientId, siteId, data) => {
    const site = await api.put<ClientSite>(`/clients/${clientId}/sites/${siteId}`, data);
    set((s) => ({
      clients: s.clients.map((c) =>
        c.id === clientId ? { ...c, sites: c.sites.map((st) => (st.id === siteId ? site : st)) } : c
      ),
    }));
  },

  deleteSite: async (clientId, siteId) => {
    await api.delete(`/clients/${clientId}/sites/${siteId}`);
    set((s) => ({
      clients: s.clients.map((c) =>
        c.id === clientId ? { ...c, sites: c.sites.filter((st) => st.id !== siteId) } : c
      ),
    }));
  },

  createClientAccount: async (clientId) => {
    const result = await api.post<{ userId: string; email: string; password: string }>(`/clients/${clientId}/create-account`, {});
    // Refresh clients to get the user link
    const clients = await api.get<ClientData[]>('/clients');
    set({ clients });
    return { email: result.email, password: result.password };
  },

  deleteClientAccount: async (clientId) => {
    await api.delete(`/clients/${clientId}/account`);
    const clients = await api.get<ClientData[]>('/clients');
    set({ clients });
  },
}));
