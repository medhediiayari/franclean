import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlanningEvent, EventStatus } from '../types';

interface EventState {
  events: PlanningEvent[];
  addEvent: (event: PlanningEvent) => void;
  updateEvent: (id: string, data: Partial<PlanningEvent>) => void;
  deleteEvent: (id: string) => void;
  setAgentResponse: (eventId: string, response: 'accepted' | 'refused') => void;
  getEventsByAgent: (agentId: string) => PlanningEvent[];
  getConflicts: (agentId: string, start: string, end: string, excludeId?: string) => PlanningEvent[];
}

const now = new Date();
const today = now.toISOString().slice(0, 10);
const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
const dayAfter = new Date(now.getTime() + 2 * 86400000).toISOString().slice(0, 10);
const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10);
const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10);
const fourDaysAgo = new Date(now.getTime() - 4 * 86400000).toISOString().slice(0, 10);
const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000).toISOString().slice(0, 10);
const inThreeDays = new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10);
const inFourDays = new Date(now.getTime() + 4 * 86400000).toISOString().slice(0, 10);

const defaultEvents: PlanningEvent[] = [
  // ===== AGENT-1 (Ahmed) =====
  // Aujourd'hui - mission en cours, 2 créneaux (matin + après-midi)
  {
    id: 'evt-1',
    title: 'Nettoyage Bureau Central',
    description: 'Nettoyage complet des bureaux du 3ème étage',
    client: 'Société Générale',
    startDate: today,
    endDate: today,
    shifts: [
      { id: 'sh-1a', date: today, startTime: '08:00', endTime: '12:00' },
      { id: 'sh-1b', date: today, startTime: '14:00', endTime: '17:00' },
    ],
    address: '29 Boulevard Haussmann, 75009 Paris',
    latitude: 48.8738,
    longitude: 2.3370,
    geoRadius: 200,
    assignedAgentId: 'agent-1',
    status: 'en_cours',
    agentResponse: 'accepted',
    history: [
      { action: 'Création', userId: 'admin-1', timestamp: `${yesterday}T10:00:00Z` },
      { action: 'Accepté par agent', userId: 'agent-1', timestamp: `${yesterday}T11:00:00Z` },
    ],
    createdAt: `${yesterday}T10:00:00Z`,
    updatedAt: `${yesterday}T11:00:00Z`,
  },
  // Aujourd'hui - 2e mission, 1 créneau (aucune photo → tester entrée + sortie)
  {
    id: 'evt-7',
    title: 'Entretien Cage d\'Escalier Immeuble B',
    description: 'Nettoyage cage d\'escalier et paliers du RDC au 6ème',
    client: 'Foncia Paris',
    startDate: today,
    endDate: today,
    shifts: [
      { id: 'sh-7a', date: today, startTime: '18:00', endTime: '20:00' },
    ],
    address: '88 Rue de la Pompe, 75016 Paris',
    latitude: 48.8630,
    longitude: 2.2756,
    geoRadius: 150,
    assignedAgentId: 'agent-1',
    status: 'en_cours',
    agentResponse: 'accepted',
    history: [
      { action: 'Création', userId: 'admin-1', timestamp: `${yesterday}T14:00:00Z` },
      { action: 'Accepté par agent', userId: 'agent-1', timestamp: `${yesterday}T15:00:00Z` },
    ],
    createdAt: `${yesterday}T14:00:00Z`,
    updatedAt: `${yesterday}T15:00:00Z`,
  },
  // Hier - terminée, photos complètes
  {
    id: 'evt-8',
    title: 'Nettoyage Showroom Automobile',
    description: 'Lavage sols, vitres et présentoirs du showroom',
    client: 'Renault Paris Étoile',
    startDate: yesterday,
    endDate: yesterday,
    shifts: [
      { id: 'sh-8a', date: yesterday, startTime: '07:00', endTime: '12:00' },
      { id: 'sh-8b', date: yesterday, startTime: '13:00', endTime: '15:00' },
    ],
    address: '53 Avenue de la Grande Armée, 75116 Paris',
    latitude: 48.8760,
    longitude: 2.2850,
    geoRadius: 200,
    assignedAgentId: 'agent-1',
    status: 'termine',
    agentResponse: 'accepted',
    history: [
      { action: 'Création', userId: 'admin-1', timestamp: `${twoDaysAgo}T09:00:00Z` },
      { action: 'Accepté par agent', userId: 'agent-1', timestamp: `${twoDaysAgo}T10:00:00Z` },
      { action: 'Terminé', userId: 'agent-1', timestamp: `${yesterday}T15:00:00Z` },
    ],
    createdAt: `${twoDaysAgo}T09:00:00Z`,
    updatedAt: `${yesterday}T15:00:00Z`,
  },
  // Il y a 3 jours - terminée
  {
    id: 'evt-9',
    title: 'Désinfection Restaurant Le Petit Zinc',
    description: 'Désinfection cuisine et salle après fermeture sanitaire',
    client: 'Le Petit Zinc',
    startDate: threeDaysAgo,
    endDate: threeDaysAgo,
    shifts: [
      { id: 'sh-9a', date: threeDaysAgo, startTime: '06:00', endTime: '12:00' },
    ],
    address: '11 Rue Saint-Benoît, 75006 Paris',
    latitude: 48.8540,
    longitude: 2.3330,
    geoRadius: 100,
    assignedAgentId: 'agent-1',
    status: 'termine',
    agentResponse: 'accepted',
    history: [
      { action: 'Création', userId: 'admin-1', timestamp: `${fourDaysAgo}T16:00:00Z` },
      { action: 'Accepté par agent', userId: 'agent-1', timestamp: `${fourDaysAgo}T17:00:00Z` },
      { action: 'Terminé', userId: 'agent-1', timestamp: `${threeDaysAgo}T12:10:00Z` },
    ],
    createdAt: `${fourDaysAgo}T16:00:00Z`,
    updatedAt: `${threeDaysAgo}T12:10:00Z`,
  },
  // Il y a 5 jours - terminée
  {
    id: 'evt-10',
    title: 'Remise en état Appartement T3',
    description: 'Nettoyage complet après travaux de rénovation',
    client: 'Century 21 Paris',
    startDate: fiveDaysAgo,
    endDate: fiveDaysAgo,
    shifts: [
      { id: 'sh-10a', date: fiveDaysAgo, startTime: '08:00', endTime: '12:00' },
      { id: 'sh-10b', date: fiveDaysAgo, startTime: '13:00', endTime: '16:00' },
    ],
    address: '130 Rue de Rivoli, 75001 Paris',
    latitude: 48.8600,
    longitude: 2.3400,
    geoRadius: 150,
    assignedAgentId: 'agent-1',
    status: 'termine',
    agentResponse: 'accepted',
    history: [
      { action: 'Création', userId: 'admin-1', timestamp: new Date(now.getTime() - 6 * 86400000).toISOString() },
      { action: 'Accepté par agent', userId: 'agent-1', timestamp: new Date(now.getTime() - 6 * 86400000).toISOString() },
      { action: 'Terminé', userId: 'agent-1', timestamp: `${fiveDaysAgo}T16:00:00Z` },
    ],
    createdAt: new Date(now.getTime() - 6 * 86400000).toISOString(),
    updatedAt: `${fiveDaysAgo}T16:00:00Z`,
  },
  // Demain - planifié, 1 créneau
  {
    id: 'evt-4',
    title: 'Vitrerie Tour Montparnasse',
    description: 'Nettoyage des vitres - Niveaux 1 à 5',
    client: 'Tour Montparnasse SA',
    startDate: tomorrow,
    endDate: tomorrow,
    shifts: [
      { id: 'sh-4a', date: tomorrow, startTime: '08:00', endTime: '12:00' },
      { id: 'sh-4b', date: tomorrow, startTime: '13:00', endTime: '17:00' },
    ],
    address: '33 Avenue du Maine, 75015 Paris',
    latitude: 48.8421,
    longitude: 2.3219,
    geoRadius: 200,
    assignedAgentId: 'agent-1',
    status: 'planifie',
    agentResponse: 'pending',
    history: [
      { action: 'Création', userId: 'admin-1', timestamp: `${today}T09:00:00Z` },
    ],
    createdAt: `${today}T09:00:00Z`,
    updatedAt: `${today}T09:00:00Z`,
  },
  // Dans 3 jours
  {
    id: 'evt-11',
    title: 'Nettoyage Salle de Sport',
    description: 'Nettoyage vestiaires, douches et espace fitness',
    client: 'Fitness Park',
    startDate: inThreeDays,
    endDate: inThreeDays,
    shifts: [
      { id: 'sh-11a', date: inThreeDays, startTime: '06:00', endTime: '10:00' },
    ],
    address: '5 Rue de Bercy, 75012 Paris',
    latitude: 48.8396,
    longitude: 2.3826,
    geoRadius: 200,
    assignedAgentId: 'agent-1',
    status: 'planifie',
    agentResponse: 'accepted',
    history: [
      { action: 'Création', userId: 'admin-1', timestamp: `${today}T07:00:00Z` },
      { action: 'Accepté par agent', userId: 'agent-1', timestamp: `${today}T07:30:00Z` },
    ],
    createdAt: `${today}T07:00:00Z`,
    updatedAt: `${today}T07:30:00Z`,
  },
  // Dans 4 jours - multi-jours avec créneaux par jour
  {
    id: 'evt-12',
    title: 'Entretien Siège Social TechCorp',
    description: 'Nettoyage open space, salles de réunion et cafétéria',
    client: 'TechCorp',
    startDate: inFourDays,
    endDate: new Date(now.getTime() + 5 * 86400000).toISOString().slice(0, 10),
    shifts: [
      { id: 'sh-12a', date: inFourDays, startTime: '09:00', endTime: '13:00' },
      { id: 'sh-12b', date: inFourDays, startTime: '14:00', endTime: '18:00' },
      { id: 'sh-12c', date: new Date(now.getTime() + 5 * 86400000).toISOString().slice(0, 10), startTime: '09:00', endTime: '13:00' },
    ],
    address: '100 Avenue des Champs-Élysées, 75008 Paris',
    latitude: 48.8710,
    longitude: 2.3030,
    geoRadius: 250,
    assignedAgentId: 'agent-1',
    status: 'planifie',
    agentResponse: 'pending',
    history: [
      { action: 'Création', userId: 'admin-1', timestamp: `${today}T10:00:00Z` },
    ],
    createdAt: `${today}T10:00:00Z`,
    updatedAt: `${today}T10:00:00Z`,
  },

  // ===== AGENT-2 (Sara) =====
  {
    id: 'evt-2',
    title: 'Entretien Résidence Les Lilas',
    description: 'Entretien des parties communes - Hall et escaliers',
    client: 'Nexity',
    startDate: today,
    endDate: today,
    shifts: [
      { id: 'sh-2a', date: today, startTime: '09:00', endTime: '12:00' },
      { id: 'sh-2b', date: today, startTime: '13:00', endTime: '16:00' },
    ],
    address: '15 Rue des Lilas, 93260 Les Lilas',
    latitude: 48.8796,
    longitude: 2.4189,
    geoRadius: 150,
    assignedAgentId: 'agent-2',
    status: 'en_cours',
    agentResponse: 'accepted',
    history: [
      { action: 'Création', userId: 'admin-1', timestamp: `${yesterday}T09:00:00Z` },
      { action: 'Accepté par agent', userId: 'agent-2', timestamp: `${yesterday}T09:30:00Z` },
    ],
    createdAt: `${yesterday}T09:00:00Z`,
    updatedAt: `${yesterday}T09:30:00Z`,
  },
  {
    id: 'evt-5',
    title: 'Désinfection Clinique',
    description: 'Désinfection complète des salles de consultation',
    client: 'Clinique Saint-Joseph',
    startDate: yesterday,
    endDate: yesterday,
    shifts: [
      { id: 'sh-5a', date: yesterday, startTime: '06:00', endTime: '10:00' },
      { id: 'sh-5b', date: yesterday, startTime: '11:00', endTime: '14:00' },
    ],
    address: '185 Rue Raymond Losserand, 75014 Paris',
    latitude: 48.8333,
    longitude: 2.3133,
    geoRadius: 100,
    assignedAgentId: 'agent-2',
    status: 'termine',
    agentResponse: 'accepted',
    history: [
      { action: 'Création', userId: 'admin-1', timestamp: new Date(now.getTime() - 3 * 86400000).toISOString() },
      { action: 'Accepté par agent', userId: 'agent-2', timestamp: new Date(now.getTime() - 3 * 86400000).toISOString() },
      { action: 'Terminé', userId: 'agent-2', timestamp: `${yesterday}T14:00:00Z` },
    ],
    createdAt: new Date(now.getTime() - 3 * 86400000).toISOString(),
    updatedAt: `${yesterday}T14:00:00Z`,
  },
  {
    id: 'evt-13',
    title: 'Lavage Vitres Hôtel Mercure',
    description: 'Nettoyage vitres hall d\'entrée et restaurant',
    client: 'Hôtel Mercure Bastille',
    startDate: twoDaysAgo,
    endDate: twoDaysAgo,
    shifts: [
      { id: 'sh-13a', date: twoDaysAgo, startTime: '07:30', endTime: '13:00' },
    ],
    address: '4 Boulevard Beaumarchais, 75011 Paris',
    latitude: 48.8533,
    longitude: 2.3681,
    geoRadius: 150,
    assignedAgentId: 'agent-2',
    status: 'termine',
    agentResponse: 'accepted',
    history: [
      { action: 'Création', userId: 'admin-1', timestamp: `${threeDaysAgo}T10:00:00Z` },
      { action: 'Accepté par agent', userId: 'agent-2', timestamp: `${threeDaysAgo}T11:00:00Z` },
      { action: 'Terminé', userId: 'agent-2', timestamp: `${twoDaysAgo}T13:05:00Z` },
    ],
    createdAt: `${threeDaysAgo}T10:00:00Z`,
    updatedAt: `${twoDaysAgo}T13:05:00Z`,
  },
  {
    id: 'evt-14',
    title: 'Nettoyage Cabinet Médical',
    description: 'Entretien quotidien cabinet de 3 praticiens',
    client: 'Dr. Martin & Associés',
    startDate: tomorrow,
    endDate: tomorrow,
    shifts: [
      { id: 'sh-14a', date: tomorrow, startTime: '17:00', endTime: '20:00' },
    ],
    address: '22 Rue de Passy, 75016 Paris',
    latitude: 48.8570,
    longitude: 2.2810,
    geoRadius: 100,
    assignedAgentId: 'agent-2',
    status: 'planifie',
    agentResponse: 'accepted',
    history: [
      { action: 'Création', userId: 'admin-1', timestamp: `${today}T08:00:00Z` },
      { action: 'Accepté par agent', userId: 'agent-2', timestamp: `${today}T08:20:00Z` },
    ],
    createdAt: `${today}T08:00:00Z`,
    updatedAt: `${today}T08:20:00Z`,
  },

  // ===== AGENT-3 (Karim) =====
  {
    id: 'evt-3',
    title: 'Nettoyage Chantier BTP',
    description: 'Nettoyage de fin de chantier - 2 étages',
    client: 'Bouygues Construction',
    startDate: tomorrow,
    endDate: dayAfter,
    shifts: [
      { id: 'sh-3a', date: tomorrow, startTime: '07:00', endTime: '12:00' },
      { id: 'sh-3b', date: tomorrow, startTime: '13:00', endTime: '18:00' },
      { id: 'sh-3c', date: dayAfter, startTime: '07:00', endTime: '12:00' },
      { id: 'sh-3d', date: dayAfter, startTime: '13:00', endTime: '18:00' },
    ],
    address: '42 Avenue de la République, 75011 Paris',
    latitude: 48.8654,
    longitude: 2.3817,
    geoRadius: 300,
    assignedAgentId: 'agent-3',
    status: 'planifie',
    agentResponse: 'pending',
    history: [
      { action: 'Création', userId: 'admin-1', timestamp: `${today}T08:00:00Z` },
    ],
    createdAt: `${today}T08:00:00Z`,
    updatedAt: `${today}T08:00:00Z`,
  },
  {
    id: 'evt-15',
    title: 'Entretien Crèche Les Petits Lutins',
    description: 'Nettoyage et désinfection des salles de jeux et dortoirs',
    client: 'Crèche Les Petits Lutins',
    startDate: today,
    endDate: today,
    shifts: [
      { id: 'sh-15a', date: today, startTime: '18:00', endTime: '21:00' },
    ],
    address: '75 Rue de la Convention, 75015 Paris',
    latitude: 48.8400,
    longitude: 2.2960,
    geoRadius: 100,
    assignedAgentId: 'agent-3',
    status: 'en_cours',
    agentResponse: 'accepted',
    history: [
      { action: 'Création', userId: 'admin-1', timestamp: `${yesterday}T12:00:00Z` },
      { action: 'Accepté par agent', userId: 'agent-3', timestamp: `${yesterday}T13:00:00Z` },
    ],
    createdAt: `${yesterday}T12:00:00Z`,
    updatedAt: `${yesterday}T13:00:00Z`,
  },

  // ===== AGENT-4 (Fatima) =====
  {
    id: 'evt-6',
    title: 'Nettoyage Entrepôt Logistique',
    description: 'Nettoyage sol et zones de stockage',
    client: 'Amazon Logistics',
    startDate: today,
    endDate: today,
    shifts: [
      { id: 'sh-6a', date: today, startTime: '06:00', endTime: '10:00' },
      { id: 'sh-6b', date: today, startTime: '11:00', endTime: '14:00' },
    ],
    address: '1 Rue de la Logistique, 93200 Saint-Denis',
    latitude: 48.9362,
    longitude: 2.3574,
    geoRadius: 500,
    assignedAgentId: 'agent-4',
    status: 'a_reattribuer',
    agentResponse: 'refused',
    history: [
      { action: 'Création', userId: 'admin-1', timestamp: `${yesterday}T15:00:00Z` },
      { action: 'Refusé par agent', userId: 'agent-4', timestamp: `${yesterday}T16:00:00Z`, details: 'Agent indisponible' },
    ],
    createdAt: `${yesterday}T15:00:00Z`,
    updatedAt: `${yesterday}T16:00:00Z`,
  },
  {
    id: 'evt-16',
    title: 'Nettoyage Boutique Zara',
    description: 'Lavage sols, miroirs et cabines d\'essayage',
    client: 'Inditex France',
    startDate: today,
    endDate: today,
    shifts: [
      { id: 'sh-16a', date: today, startTime: '20:00', endTime: '23:00' },
    ],
    address: '44 Avenue des Champs-Élysées, 75008 Paris',
    latitude: 48.8700,
    longitude: 2.3050,
    geoRadius: 200,
    assignedAgentId: 'agent-4',
    status: 'en_cours',
    agentResponse: 'accepted',
    history: [
      { action: 'Création', userId: 'admin-1', timestamp: `${yesterday}T18:00:00Z` },
      { action: 'Accepté par agent', userId: 'agent-4', timestamp: `${yesterday}T18:30:00Z` },
    ],
    createdAt: `${yesterday}T18:00:00Z`,
    updatedAt: `${yesterday}T18:30:00Z`,
  },
];

export const useEventStore = create<EventState>()(
  persist(
    (set, get) => ({
      events: defaultEvents,

      addEvent: (event) => {
        set((state) => ({ events: [...state.events, event] }));
      },

      updateEvent: (id, data) => {
        set((state) => ({
          events: state.events.map((e) =>
            e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e,
          ),
        }));
      },

      deleteEvent: (id) => {
        set((state) => ({ events: state.events.filter((e) => e.id !== id) }));
      },

      setAgentResponse: (eventId, response) => {
        const event = get().events.find((e) => e.id === eventId);
        if (!event) return;

        const newStatus: EventStatus = response === 'refused' ? 'a_reattribuer' : event.status;
        const historyEntry = {
          action: response === 'accepted' ? 'Accepté par agent' : 'Refusé par agent',
          userId: event.assignedAgentId,
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          events: state.events.map((e) =>
            e.id === eventId
              ? {
                  ...e,
                  agentResponse: response,
                  status: newStatus,
                  history: [...e.history, historyEntry],
                  updatedAt: new Date().toISOString(),
                }
              : e,
          ),
        }));
      },

      getEventsByAgent: (agentId) => {
        return get().events.filter((e) => e.assignedAgentId === agentId);
      },

      getConflicts: (agentId, start, end, excludeId) => {
        return get().events.filter(
          (e) =>
            e.id !== excludeId &&
            e.assignedAgentId === agentId &&
            e.status !== 'annule' &&
            e.status !== 'a_reattribuer' &&
            e.startDate <= end &&
            e.endDate >= start,
        );
      },
    }),
    { name: 'franclean-events' },
  ),
);
