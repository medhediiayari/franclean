import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  users: User[];
  login: (email: string, password: string) => boolean;
  logout: () => void;
  addUser: (user: User) => void;
  updateUser: (id: string, data: Partial<User>) => void;
  deleteUser: (id: string) => void;
}

const defaultUsers: User[] = [
  {
    id: 'admin-1',
    firstName: 'Mohamed',
    lastName: 'Admin',
    email: 'admin@franclean.fr',
    phone: '+33 6 12 34 56 78',
    role: 'admin',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'agent-1',
    firstName: 'Ahmed',
    lastName: 'Benali',
    email: 'ahmed@franclean.fr',
    phone: '+33 6 22 33 44 55',
    role: 'agent',
    isActive: true,
    createdAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'agent-2',
    firstName: 'Sara',
    lastName: 'Mansouri',
    email: 'sara@franclean.fr',
    phone: '+33 6 33 44 55 66',
    role: 'agent',
    isActive: true,
    createdAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'agent-3',
    firstName: 'Karim',
    lastName: 'Dupont',
    email: 'karim@franclean.fr',
    phone: '+33 6 44 55 66 77',
    role: 'agent',
    isActive: true,
    createdAt: '2024-02-15T00:00:00Z',
  },
  {
    id: 'agent-4',
    firstName: 'Fatima',
    lastName: 'El Amrani',
    email: 'fatima@franclean.fr',
    phone: '+33 6 55 66 77 88',
    role: 'agent',
    isActive: false,
    createdAt: '2024-03-01T00:00:00Z',
  },
];

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      users: defaultUsers,

      login: (email: string, _password: string) => {
        const user = get().users.find((u) => u.email === email && u.isActive);
        if (user) {
          set({ user, isAuthenticated: true });
          return true;
        }
        return false;
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
      },

      addUser: (user: User) => {
        set((state) => ({ users: [...state.users, user] }));
      },

      updateUser: (id: string, data: Partial<User>) => {
        set((state) => ({
          users: state.users.map((u) => (u.id === id ? { ...u, ...data } : u)),
        }));
      },

      deleteUser: (id: string) => {
        set((state) => ({
          users: state.users.filter((u) => u.id !== id),
        }));
      },
    }),
    { name: 'franclean-auth' },
  ),
);
