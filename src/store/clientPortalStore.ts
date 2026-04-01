import { create } from 'zustand';
import { api } from '../lib/api';

interface ClientPortalDashboard {
  clientName: string;
  sitesCount: number;
  totalMissions: number;
  missionsTerminees: number;
  missionsEnCours: number;
  missionsPlanifiees: number;
  totalHours: number;
  totalPhotos: number;
}

interface ClientPortalMission {
  id: string;
  title: string;
  description: string;
  site: string | null;
  status: string;
  startDate: string;
  endDate: string;
  address: string;
  shifts: Array<{ id: string; date: string; startTime: string; endTime: string; agentId: string | null }>;
  agents: Array<{ id: string; name: string }>;
  attendances: Array<{
    id: string;
    agentName: string;
    date: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    hoursWorked: number | null;
    checkInPhotoUrl: string | null;
    checkOutPhotoUrl: string | null;
    status: string;
    photos: Array<{ id: string; photoUrl: string; caption: string | null; createdAt: string }>;
  }>;
}

interface ClientPortalPhoto {
  id: string;
  photoUrl: string;
  caption: string | null;
  createdAt: string;
  eventTitle: string;
  site: string | null;
  agentName: string;
  date: string;
  type: 'work' | 'checkin' | 'checkout';
}

interface ClientPortalSite {
  id: string;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  geoRadius: number;
  hourlyRate?: number | null;
  notes?: string | null;
}

interface ClientPortalInfo {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  sites: ClientPortalSite[];
}

interface ClientPortalState {
  dashboard: ClientPortalDashboard | null;
  missions: ClientPortalMission[];
  photos: ClientPortalPhoto[];
  clientInfo: ClientPortalInfo | null;
  loading: boolean;
  fetchDashboard: () => Promise<void>;
  fetchMissions: () => Promise<void>;
  fetchPhotos: (site?: string) => Promise<void>;
  fetchClientInfo: () => Promise<void>;
}

export const useClientPortalStore = create<ClientPortalState>()((set) => ({
  dashboard: null,
  missions: [],
  photos: [],
  clientInfo: null,
  loading: false,

  fetchDashboard: async () => {
    set({ loading: true });
    try {
      const data = await api.get<ClientPortalDashboard>('/client-portal/dashboard');
      set({ dashboard: data });
    } finally {
      set({ loading: false });
    }
  },

  fetchMissions: async () => {
    set({ loading: true });
    try {
      const data = await api.get<ClientPortalMission[]>('/client-portal/missions');
      set({ missions: data });
    } finally {
      set({ loading: false });
    }
  },

  fetchPhotos: async (site?: string) => {
    set({ loading: true });
    try {
      const url = site ? `/client-portal/photos?site=${encodeURIComponent(site)}` : '/client-portal/photos';
      const data = await api.get<ClientPortalPhoto[]>(url);
      set({ photos: data });
    } finally {
      set({ loading: false });
    }
  },

  fetchClientInfo: async () => {
    set({ loading: true });
    try {
      const data = await api.get<ClientPortalInfo>('/client-portal/me');
      set({ clientInfo: data });
    } finally {
      set({ loading: false });
    }
  },
}));
