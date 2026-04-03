import { create } from 'zustand';
import { api } from '../lib/api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  users: User[];
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  initAuth: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  addUser: (data: Omit<User, 'id' | 'createdAt'> & { password: string }) => Promise<User>;
  updateUser: (id: string, data: Partial<User> & { password?: string }) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

const TOKEN_KEY = 'bipbip-token';

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  users: [],

  login: async (email: string, password: string) => {
    try {
      const { token, user } = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
      api.setToken(token);
      sessionStorage.setItem(TOKEN_KEY, token);
      set({ user, isAuthenticated: true });
      return true;
    } catch {
      return false;
    }
  },

  logout: () => {
    api.setToken(null);
    sessionStorage.removeItem(TOKEN_KEY);
    set({ user: null, isAuthenticated: false, users: [] });
  },

  initAuth: async () => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;
    api.setToken(token);
    try {
      const user = await api.get<User>('/auth/me');
      set({ user, isAuthenticated: true });
    } catch {
      sessionStorage.removeItem(TOKEN_KEY);
      api.setToken(null);
    }
  },

  fetchUsers: async () => {
    const users = await api.get<User[]>('/users');
    set({ users });
  },

  addUser: async (data) => {
    const user = await api.post<User>('/users', data);
    set((state) => ({ users: [...state.users, user] }));
    return user;
  },

  updateUser: async (id, data) => {
    const updated = await api.put<User>(`/users/${id}`, data);
    set((state) => ({
      users: state.users.map((u) => (u.id === id ? updated : u)),
      user: state.user?.id === id ? updated : state.user,
    }));
  },

  deleteUser: async (id) => {
    await api.delete(`/users/${id}`);
    set((state) => ({ users: state.users.filter((u) => u.id !== id) }));
  },
}));
