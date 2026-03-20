import { create } from 'zustand';
import { api } from '../lib/api';
import type { PlanningEvent } from '../types';

interface EventState {
  events: PlanningEvent[];
  fetchEvents: () => Promise<void>;
  addEvent: (event: Omit<PlanningEvent, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'agentResponses' | 'shifts'> & { shifts: Array<{ date: string; startTime: string; endTime: string; agentId?: string }>; agentResponses?: Record<string, 'accepted' | 'refused' | 'pending'>; history?: PlanningEvent['history'] }) => Promise<PlanningEvent>;
  updateEvent: (id: string, data: Partial<Omit<PlanningEvent, 'shifts'>> & { shifts?: Array<{ date: string; startTime: string; endTime: string; agentId?: string }> }) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  setAgentResponse: (eventId: string, agentId: string, response: 'accepted' | 'refused') => Promise<void>;
  getEventsByAgent: (agentId: string) => PlanningEvent[];
  getConflicts: (agentId: string, start: string, end: string, excludeId?: string) => Promise<PlanningEvent[]>;
}

export const useEventStore = create<EventState>()((set, get) => ({
  events: [],

  fetchEvents: async () => {
    const events = await api.get<PlanningEvent[]>('/events');
    set({ events });
  },

  addEvent: async (eventData) => {
    const event = await api.post<PlanningEvent>('/events', eventData);
    set((state) => ({ events: [...state.events, event] }));
    return event;
  },

  updateEvent: async (id, data) => {
    const updated = await api.put<PlanningEvent>(`/events/${id}`, data);
    set((state) => ({
      events: state.events.map((e) => (e.id === id ? updated : e)),
    }));
  },

  deleteEvent: async (id) => {
    await api.delete(`/events/${id}`);
    set((state) => ({ events: state.events.filter((e) => e.id !== id) }));
  },

  setAgentResponse: async (eventId, agentId, response) => {
    const updated = await api.post<PlanningEvent>(`/events/${eventId}/response`, { agentId, response });
    set((state) => ({
      events: state.events.map((e) => (e.id === eventId ? updated : e)),
    }));
  },

  getEventsByAgent: (agentId) => {
    return get().events.filter((e) => e.assignedAgentIds.includes(agentId));
  },

  getConflicts: async (agentId, start, end, excludeId) => {
    const params = new URLSearchParams({ agentId, start, end });
    if (excludeId) params.set('excludeId', excludeId);
    return api.get<PlanningEvent[]>(`/events/check/conflicts?${params}`);
  },
}));

