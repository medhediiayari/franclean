import { create } from 'zustand';
import { api } from '../lib/api';

export interface AppSettings {
  id: string;
  appName: string;
  appSubtitle: string;
  appLogoBase64: string | null;
  companyName: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  updatedAt: string;
}

interface AppSettingsState {
  settings: AppSettings | null;
  loading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (data: Partial<Omit<AppSettings, 'id' | 'updatedAt'>>) => Promise<void>;
}

const DEFAULTS: Omit<AppSettings, 'id' | 'updatedAt'> = {
  appName: 'Bipbip',
  appSubtitle: 'Gestion RH',
  appLogoBase64: null,
  companyName: null,
  companyEmail: null,
  companyPhone: null,
  companyAddress: null,
};

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  settings: null,
  loading: false,

  fetchSettings: async () => {
    set({ loading: true });
    try {
      const data = await api.get<AppSettings>('/settings');
      set({ settings: data });
    } catch {
      // Use defaults if fetch fails
      set({ settings: { id: 'singleton', updatedAt: '', ...DEFAULTS } });
    } finally {
      set({ loading: false });
    }
  },

  updateSettings: async (data) => {
    const updated = await api.put<AppSettings>('/settings', data);
    set({ settings: updated });
  },
}));

/** Helper: returns the best available logo src (custom base64 or fallback to /newfavicon.png) */
export function getLogoSrc(settings: AppSettings | null): string {
  return settings?.appLogoBase64 || '/newfavicon.png';
}
